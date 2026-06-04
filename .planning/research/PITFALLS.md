# Pitfalls Research

**Domain:** Live bill-splitter app — v2.0 easy-billsy redesign (host removal, wizard collapse, currency, flat model)
**Researched:** 2026-06-04
**Confidence:** HIGH (derived from direct codebase inspection — sessionSchema.ts, claim/route.ts, billMath.ts, 29-file test suite, and CollaborativeClaimingView.tsx; not training-data speculation)

---

## Critical Pitfalls

### Pitfall 1: Host-Removal Blast Radius — Dangling References After Deletion

**What goes wrong:**
Deleting the six host-specific files (HostPanel.tsx, ReviewHostAssignedScreen.tsx, EditRequestForm.tsx, and routes accept/edit-request/resolve-edit/resolve-dispute/dispute) leaves import references in files that are NOT being deleted. The application silently compiles if TypeScript can resolve the symbol from the deleted export, but crashes at runtime if the re-export chain breaks, or breaks the type system if `hostToken`, `hostPersonId`, `editRequests`, and `disputes` remain in `SessionPayload` while the code using them is deleted.

Concrete blast radius from codebase inspection:
- `lib/sessionSchema.ts`: `ClaimEntry.assignedBy`, `ClaimEntry.accepted`, `EditRequest`, `Dispute`, `hostToken`, `hostPersonId`, `editRequests`, `disputes` — all must be removed or the schema becomes a lie that causes old-session crashes (see Pitfall 2).
- `app/api/session/[sessionId]/claim/route.ts`: The Lua `QTY_CLAIM_SCRIPT` checks `session.hostToken` at line 26 and `SLOT_CLAIM_SCRIPT` sets `session.hostPersonId` at lines 97-99. Removing the host model requires these Lua strings to be rewritten — they are not TypeScript, so the type checker will not catch stale Lua references. A typo in the Lua rewrite silently returns `invalid_session` for every claim.
- `app/split/[sessionId]/CollaborativeClaimingView.tsx`: 17+ host-specific references including `hostTokenParam` state, `#hostToken=` URL fragment parsing, the `isHost` derived value, `ReviewHostAssignedScreen` import, `hasUnacceptedHostItems`, and the `editCount`/`disputeCount` badge counters. The view will not compile if ReviewHostAssignedScreen is deleted without also removing every reference to it.
- `app/api/session/route.ts`: Pre-populates `claims.items` with `assignedBy: 'host'` markers (lines 58-65). In the flat model this block should be removed; leaving it means new sessions still contain host markers that trigger the `accepted` check path even though that path has been deleted.
- `stores/useBillStore.ts`: Referenced for host-related types; any `hostToken` forwarding logic must be found and removed.

The 923 lines across 6 host-specific test files (`HostPanel.test.tsx`, `ReviewHostAssignedScreen.test.tsx`, `disputeRoute.test.ts`, `editRequestRoute.test.ts`, `resolveEditRoute.test.ts`, `resolveDisputeRoute.test.ts`) will fail immediately. But 59 host-concept assertions scattered across "shared" test files (`sessionClaimRoute.test.ts`, `sessionRoute.test.ts`, `sessionGetRoute.test.ts`, `tipRoute.test.ts`, etc.) will silently pass if the fixture data still contains `hostToken` even though the field is removed from the schema. This is a false-green scenario.

**Why it happens:**
Grep-driven deletion misses Lua string literals, URL fragment string matches (`#hostToken=`), and conditional checks that reference undefined fields (TypeScript does not error on accessing `session.hostToken` if `hostToken` is `string | undefined`, only on `string`). Developers delete the visible files and assume the type errors are the complete hit list.

**How to avoid:**
1. Before any deletion, generate a reference map: `grep -rn "hostToken\|hostPersonId\|editRequests\|disputes\|assignedBy\|accepted\|ClaimEntry\|EditRequest\|Dispute" --include="*.ts" --include="*.tsx" > /tmp/host-refs.txt`. Work through this file top to bottom.
2. Remove `hostToken`, `hostPersonId`, `editRequests`, `disputes` from `SessionPayload` first. This will cascade type errors that reveal every reference; fix those before deleting files.
3. Audit Lua script strings separately — they are opaque to TypeScript. Search for `'host'` inside Lua string literals in `claim/route.ts` explicitly.
4. Remove `assignedBy` and `accepted` from `ClaimEntry` only after confirming no non-host code reads them (nothing in the flat model needs them).
5. Run `npx tsc --noEmit` after every file deletion, not just at the end.

**Warning signs:**
- TypeScript compiles cleanly but Lua `evalsha` returns `invalid_session` in staging — sign that Lua was updated inconsistently with the session schema shape.
- `CollaborativeClaimingView` renders a blank screen after deletion — sign that `ReviewHostAssignedScreen` import was deleted but the JSX reference was not.
- Tests pass but `sessionRoute.test.ts` fixture still sets `hostToken: 'host-token-abc'` — sign of stale fixtures giving false confidence.

**Phase to address:**
Phase 1 (host removal) — this is the first-and-hardest refactor; must be completed atomically before any other v2 phase begins. Do not interleave with wizard collapse or currency work.

---

### Pitfall 2: Live Redis Session Backward-Compat — Old-Shape Sessions Crash New Code

**What goes wrong:**
The app is LIVE. At any moment of deployment there are Redis sessions with TTLs up to 24 hours that were written by the v1 code and contain:
- `hostToken: "abc123"` (required field in current `SessionPayload`)
- `hostPersonId: "person-id"` (optional but present)
- `editRequests: { "req1": {...} }` (present and non-empty for active dispute sessions)
- `disputes: { "d1": {...} }` (same)
- `claims.items[itemId][personId].assignedBy: "host"` and `accepted: true/false`

After deploy, the new code does `const session = JSON.parse(raw)` and treats the result as the new schema. Extra fields in JSON do not crash cjson — old sessions with `hostToken` will not break new Lua scripts. The real crash scenario is the reverse: new code reads a field old sessions NEVER had, such as `session.currencySymbol`, and treats `undefined` as a string — `undefined.toUpperCase()` crashes. Any new field access that is not null-guarded is a time-bomb on old sessions.

The `computePersonShareFromClaims` function in `billMath.ts` will receive old claim entries with `{ qty: 1, assignedBy: 'host', accepted: false }` from sessions that were active at deploy time. The math is unaffected (the function only reads `entry.qty`), but any new UI code that checks `entry.assignedBy === 'host'` and expects that field to be absent will find it present in old sessions.

**Why it happens:**
Serverless deploys are instant-cutover. There is no migration step for Redis KV data. The 24h TTL means stale data coexists with new code for up to 24 hours post-deploy.

**How to avoid:**
1. Apply a defensive read pattern at every point where session data is consumed from Redis. Every new field access must use optional chaining and a default: `session.currencySymbol ?? null`, `session.editRequests ?? {}`, `session.disputes ?? {}`. Do this at the GET /api/session route level, not scattered across components.
2. Remove required status from `hostToken` in the TypeScript schema — change it to `hostToken?: string`. This makes the type honest: sessions written before the v2 deploy have it; sessions written after do not.
3. Write a `migrateSession(raw: unknown): SessionPayload` normalizer function that is called immediately after `JSON.parse`. This function applies defaults, strips unknown fields, and returns a canonically-shaped object. The claim Lua scripts already re-encode the full session on every write (`redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)`) — the normalizer plus one Lua write would upgrade any in-flight session to the new shape on the next claim operation.
4. Do not remove `editRequests` and `disputes` from the TypeScript type on day one; mark them `editRequests?: Record<string, EditRequest>` and let them atrophy over 24 hours as sessions expire. Remove from schema in a follow-up commit.
5. The `currencySymbol` field is the highest-risk new field — it is read by `formatCents` callers. Make its absence display a neutral fallback (bare number or configurable symbol) rather than throwing.

**Warning signs:**
- `invalid_session` errors in Vercel logs spiking immediately after deploy — sign that the Lua decoder encounters unexpected schema shapes.
- `TypeError: Cannot read properties of undefined` in browser console on the Results screen — sign that `session.currencySymbol` is accessed without null-guard.
- A specific user reports their existing session shows wrong totals or crashes — they were mid-session during the deploy window.

**Phase to address:**
Phase 1 (host removal) — write the `migrateSession` normalizer as the first act of the session schema change, before any other code changes. The normalizer is the safety net for the entire migration.

---

### Pitfall 3: Currency Formatting — Zero-Decimal Currencies and the `parseCents` Contract

**What goes wrong:**
`formatCents` in `billMath.ts` currently hardcodes `$${(cents / 100).toFixed(2)}`. This assumes all currencies have 2 decimal places and use `$` as the symbol. Introducing currency recognition without changing this function means:
- JPY (¥) amounts stored as "whole yen" — e.g., ¥1500 — will be stored as `150000` cents (1500 * 100) because `parseCents` multiplies by 100. When displayed, `150000 / 100 = 1500.00` renders correctly by accident. BUT if the OCR returns `1500` and the code calls `parseCents("1500")`, it returns `150000` — then `formatCents(150000)` shows `¥1500.00` which looks wrong (meaningless .00 decimals on a zero-decimal currency).
- KWD (Kuwaiti Dinar) has 3 decimal places. `parseCents("5.250")` returns `null` because the regex `^\d+(\.\d{1,2})?$` rejects 3 decimal places. This silently drops items from Kuwaiti receipts.
- The `Intl.NumberFormat` approach to replace `.toFixed(2)` requires knowing the ISO currency code (e.g., `"JPY"`, `"USD"`, `"GBP"`), NOT just the symbol (`¥`, `$`, `£`). The OCR extracts a symbol; you must then map symbol to ISO code to use `Intl.NumberFormat`. Multiple currencies share the same symbol (`$` is used by USD, CAD, AUD, SGD, HKD, and others).
- `Math.round(parseFloat(value) * 100)` in `parseCents` is the standard JavaScript float-multiplication approach. For most values it is fine, but `parseFloat("1.005") * 100 = 100.49999...` rounds to 100 instead of 101. The correct approach for user input is to split on the decimal point and construct cents arithmetically: `parseInt(wholePart) * 100 + parseInt(fracPart.padEnd(2, '0').slice(0, 2))`.

**Why it happens:**
The existing codebase was built dollar-first. The "integer cents" model was correct for USD but the implementation encodes USD assumptions in the storage format (cents = smallest unit / 100) and the display logic (`toFixed(2)`, `$` prefix). Currency is being added as a late concern rather than a foundation concern.

**How to avoid:**
1. Do NOT use `Intl.NumberFormat` with a currency code for the initial v2 implementation — it requires knowing the ISO code, which you may not have reliably. Instead, pass `currencySymbol` as a display-only prefix/suffix parameter to `formatCents` and keep the `/ 100` and `toFixed(2)` math unchanged. This limits breakage to visually correct for 2-decimal currencies.
2. For zero-decimal currencies (JPY, KRW, VND, etc.): if `currencySymbol` is `¥` or `₩`, skip the `* 100` in `parseCents` and the `/ 100` in `formatCents`. The cleanest approach is a `currencyScale` parameter (default 100; set to 1 for zero-decimal currencies).
3. For the v2 release, explicitly scope currency recognition to common restaurant currencies: USD (`$`), EUR (`€`), GBP (`£`), JPY (`¥`), INR (`₹`), AUD (`$`), CAD (`$`). For ambiguous `$`, default to USD display; add a currency picker for override. Do not attempt to handle KWD (3 decimal) in v2.
4. Replace `parseCents`'s float multiplication with string-split arithmetic to eliminate the `1.005` edge case: split on `.`, take at most 2 fraction digits, construct cents without floating point.
5. The `billMath.test.ts` suite currently tests `formatCents(1250)` === `'$12.50'`. These tests must be updated to accept `formatCents(1250, '£')` === `'£12.50'` when the symbol parameter is added. Do not silently change the test output without understanding the dollar-sign hardcoding throughout the test suite.

**Warning signs:**
- JPY receipt items show as `¥15.00` instead of `¥1500` — sign that `parseCents` stored yen as if they were cents.
- `parseCents` returns `null` for a valid price on a non-USD receipt — sign of the 3-decimal or symbol-in-string problem.
- `formatCents` tests pass but display is wrong — sign that tests are checking the old `$` format and the currency parameter was added but not threaded to the test fixture.

**Phase to address:**
Phase 3 (currency recognition) — `formatCents` signature change must be a single atomic commit that updates the function, all 20+ call sites, and the test suite in one changeset. Do not change the signature in one commit and update call sites in scattered later commits — the intermediate state will be broken.

---

### Pitfall 4: Wizard Collapse Without Orphaning the Test Suite

**What goes wrong:**
The current test suite has tests tightly coupled to the 4-step wizard flow:
- `AddPeopleStep.test.tsx` — tests `AddPeopleStep` in isolation
- `AddItemsStep.test.tsx` — tests the OCR review step
- `AssignItemsStep.test.tsx` — tests the assignment step
- `WizardShell.test.tsx` — tests multi-step shell and step-advance logic
- `ResultsStep.test.tsx` — tests the final results view

Collapsing to a single `SetupScreen` does not mean these tests simply disappear. If the component trees are restructured without carrying test intent forward:
1. Tests are deleted without replacement — coverage drops; previously-tested calculation paths are silently unguarded.
2. Tests are kept but their component is renamed/split — tests fail with `Cannot find module` errors that look trivial but hide real coverage gaps when devs delete the failing test instead of updating it.
3. `WizardShell` tests cover step-navigation logic (back/forward, state preservation across steps). If the wizard is collapsed but some sub-navigation remains (Setup to identity modal to BillView to Results), the navigation state machine still needs tests even if the component name changes.

The `billMath.test.ts` and `sessionClaimRoute.test.ts` are pure-logic tests that survive any UI restructuring — they do not reference component trees. These are safe. The risk is in component tests that mount the wizard hierarchy.

**Why it happens:**
Refactoring UI structure is treated as a UX concern, not a test-architecture concern. The developer collapses screens, then runs the test suite and gets red, and deletes failing tests to make CI green rather than porting them.

**How to avoid:**
1. Before collapsing the wizard, audit which tests cover business logic (calculation, validation, state management) vs. which cover component wiring (does the Next button call `advanceStep`). Business logic tests must survive; wiring tests must be ported to the new component tree.
2. Create a coverage map: for each of the 5 wizard step tests, list the behaviors being tested (e.g., "empty name is rejected", "price validates as cents"). Ensure each behavior has a corresponding test in the new component before deleting the old test.
3. Keep `billMath.test.ts` completely intact — no changes needed; it tests pure functions that do not care about UI structure.
4. Keep `sessionClaimRoute.test.ts`, `tipRoute.test.ts`, `sessionGetRoute.test.ts` intact — these test API routes unchanged by the UI collapse.
5. `WizardShell.test.tsx` should be deleted only after creating `SetupScreen.test.tsx` and `BillView.test.tsx` with equivalent navigation-state tests.
6. Do not run `git rm` on test files — use `git mv` so history is preserved and the deletion intent is explicit.

**Warning signs:**
- Test count drops by more than the number of explicitly-deleted host test files (6 files, ~923 lines) — sign that component tests were silently deleted.
- CI goes from red to green without new tests being added — classic sign of test deletion rather than porting.
- `billMath.test.ts` fails after the collapse — sign that a refactor accidentally modified `billMath.ts`.

**Phase to address:**
Phase 2 (wizard collapse to Setup screen) — begin with a test inventory document listing every currently-passing test and mapping it to the new component it should test. Treat test migration as a first-class deliverable of this phase, not cleanup.

---

### Pitfall 5: Flat-Model Race Conditions — Stale SWR Cache and Over-Blocking Slot Enforcement

**What goes wrong:**
Two issues arise directly from removing the host role:

**Issue A — Stale totals at Results entry.** The SWR polling interval is 3 seconds. When a user transitions from the claiming screen to the Results screen, SWR returns the last cached value first, then revalidates. If another user changed a price or claimed an item in the last 3 seconds, the Results screen computes totals on stale data. The user sees a total that differs from the server-authoritative value, creating "why did my total change?" confusion. This was not a problem in v1 because the host controlled the transition to Results and could see the current state.

**Issue B — `slot_taken` blocks the flat identity modal.** The current `SLOT_CLAIM_SCRIPT` returns `slot_taken` and the UI treats this as a blocking error. In v1, the host model made identity exclusivity meaningful: the host's slot was a write-capability gate. In v2 with a flat model, two devices should be able to act as the same person (a common scenario when someone's battery dies and they borrow another phone). If `slot_taken` still blocks, any second device claiming "Alice" is rejected, which is a regression from expected flat-model behavior.

Additionally, the edit route that replaces the edit-request workflow is currently a non-atomic read-modify-write in TypeScript. Two concurrent edits to the same item price will race: both read the current price, both write their new price, last-write-wins silently. This is acceptable per the product decision in FEATURES.md, but the write must still go through an atomic Lua script to avoid corrupting the JSON structure (partial writes to nested objects via non-atomic SET can corrupt the session).

**Why it happens:**
`slot_taken` enforcement was designed for the host model where identity exclusivity mattered as a security property. In the flat model it becomes a UX blocker without a security benefit. SWR cache staleness was masked in v1 by host-gated transitions.

**How to avoid:**
1. Downgrade `slot_taken` from a blocking error to a soft notification or remove the personSlots exclusivity check entirely. In v2, the identity modal is informational (self-identification), not an exclusive lock.
2. Call `mutate()` (SWR) synchronously when transitioning to the Results phase to force a fresh fetch before computing final totals. This is a one-line change but critical for totals accuracy.
3. The new direct edit route must use the same Lua read-modify-write pattern as `QTY_CLAIM_SCRIPT`. Do not write a plain TypeScript GET + modify + SET sequence for item edits — the non-atomic pattern was already identified as dangerous in the existing codebase comments.
4. Accept last-write-wins for all item edits but surface an "edited by [name]" attribution label on items — this is the social self-correction mechanism and is mandatory, not optional, when conflict detection is deliberately omitted.

**Warning signs:**
- `slot_taken` response in the identity modal blocks a user from joining — sign that personSlots enforcement was left in place from v1.
- Results screen shows totals that differ from what the user saw on the claiming screen — sign that Results is reading from stale SWR cache.
- Two concurrent price edits result in a corrupt session JSON (500 from the next claim call) — sign that the edit route used a non-atomic GET+SET pattern.

**Phase to address:**
Phase 1 (host removal) — remove `slot_taken` blocking behavior when removing host enforcement. Phase 4 (Results redesign) — add forced fresh-fetch on Results entry. Phase 1 also — write the new edit route as a Lua script.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `editRequests`/`disputes` in schema as optional fields after v2 | Old sessions don't crash; gradual atrophy | Schema carries dead fields; new developers confused by their presence | Acceptable for 24h TTL window only; remove in a follow-up commit after sessions expire |
| Use symbol string (`£`) directly in `formatCents` rather than ISO code + `Intl.NumberFormat` | Avoids symbol-to-ISO-code mapping complexity | `Intl.NumberFormat` locale-aware grouping (e.g., `1.000,00` in Germany) not applied; bare `toFixed(2)` is locale-naive | Acceptable for v2; full `Intl` support is a v2.1+ concern |
| Last-write-wins for item edits without server-side conflict detection | Simpler code, no approval queue | Silent overwrites are invisible without attribution label | Acceptable IF attribution label ships in the same phase — it is not optional |
| Delete 6 host test files without full test coverage replacement in Phase 2 | Faster Phase 1 | Coverage debt on paths that were previously tested; regressions in claim math possible | Never — test replacement must be in the same phase as deletion |
| Reuse existing Lua `QTY_CLAIM_SCRIPT` without modifying `assignedBy` field storage | Saves Lua rewrite effort | Old sessions still have `assignedBy: 'host'` entries; new code that checks this field will behave unexpectedly | Only safe if `assignedBy` is fully removed from all reads — partial removal is worse than full removal |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Upstash Redis Lua eval | Using `redis.multi()` for atomic operations — NOT atomic on Upstash REST, already documented in `claim/route.ts` line 9 | Always use `redis.eval()` with Lua for any read-modify-write that must be atomic. Do not regress by adding non-Lua multi() calls in the new edit route. |
| GPT-4o-mini currency extraction | Asking the model to return a currency code (e.g., `"USD"`) — the model will often hallucinate or return inconsistent codes for ambiguous symbols like `$` | Ask the model to return the literal symbol as it appears on the receipt (`"£"`, `"€"`, `"¥"`). Map to ISO code only for `Intl.NumberFormat` use; keep the raw symbol as the primary key. |
| SWR `refreshInterval: 3000` | Assuming SWR cache is fresh when entering the Results phase — SWR returns the last cached value first, then revalidates in the background | Call `mutate()` synchronously on Results entry to force a fresh fetch before computing final totals. One-line change, critical for totals correctness. |
| Vercel serverless deployment | Old and new code serve requests simultaneously for a brief window during the Vercel rolling deploy | Ensure the `migrateSession` normalizer is deployed before any code that reads new fields. If impossible in one deploy, deploy the normalizer as a separate prior commit. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `computePersonShareFromClaims` called on every SWR poll (every 3s) for all people | Jank on Results screen with 8+ people and 20+ items | Memoize with `useMemo` keyed on `session.claims` and `session.items` reference identity | With 10+ people and 20+ items; not a real concern at typical bill-splitting scale |
| Lua script re-encodes full session JSON on every claim | Each claim operation is O(items * people) in Lua decode/encode | Already acceptable at bill-splitting scale (max ~30 items, ~10 people) | Never a real problem at this scale |
| SWR polling continues after Results screen is shown | Unnecessary network requests when session is effectively done | Set `refreshInterval: 0` when phase transitions to `results` | Cosmetic issue only |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Removing `hostToken` validation from the claim route without replacing with any authorization check | In the flat model, any caller can claim any item for any person — this is intentional. But the edit route should still validate that `personId` exists in `session.people` before applying the edit. | In the new edit route, validate `personId` is in `session.people` before applying the edit. This prevents a malicious external caller from injecting edits with made-up personIds. |
| `hostToken` stored in URL fragment (`#hostToken=abc`) in the current code (per CR-05 comment in CollaborativeClaimingView.tsx) | Fragment is not sent to server in HTTP requests — intentional and safe in v1. In v2, `hostToken` no longer exists. A dangling `#hostToken=` in shared URLs after v2 deploy is confusing but not a security risk. | Remove fragment generation from `ShareLinkButton.tsx` as part of Phase 1 host removal. Verify with incognito tab that `window.location.hash` is empty on the new share URL. |
| `currencySymbol` stored in Redis without sanitization and reflected in the Results screen | If the OCR prompt returns a maliciously-crafted currency string, it could be displayed as HTML or used as an injection vector | `currencySymbol` must be validated to a single symbol character from an allowlist (e.g., `$`, `£`, `€`, `¥`, `₹`) before storage. Do not reflect arbitrary strings from the GPT response into the DOM without sanitization. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Who are you?" identity modal appears with an empty people list because the user shared the link before adding people | User is stuck — cannot claim items and cannot proceed | The identity modal must include an inline single-field "Add my name" path, not a redirect to Setup. Documented in FEATURES.md but easy to omit in implementation. |
| Removing the host role removes the only person who could see all unassigned items | Items silently excluded from totals; group undercharges someone | The "unassigned items" warning on the pre-Results screen is the only safety net — it must be prominent (blocking, not dismissible without action) and must show item names and prices, not just a count. |
| Collapsing the wizard means the scan-first Setup screen is the landing page for returning users starting a new split | A user who taps "New Split" is forced through the scan step even if they want manual entry | Provide "Enter manually" as a clearly visible secondary action on the Setup screen from the beginning, not buried in an error state. |
| Currency symbol displayed before the user has scanned (bare number state) | Users see `$0.00` or `0.00` and are confused about what currency the app will use | During Setup, before scan, show no currency prefix at all — apply the currency symbol only after OCR succeeds and the symbol is known. |

---

## "Looks Done But Isn't" Checklist

- [ ] **Host removal:** Lua scripts in `claim/route.ts` updated — TypeScript compiles after host removal but Lua is a string; verify the Lua logic is host-free by reading the script character by character.
- [ ] **Host removal:** `app/api/session/route.ts` pre-populates `claims.items` with `assignedBy: 'host'` — this block must be removed or new sessions still carry host markers.
- [ ] **Backward-compat:** `migrateSession` normalizer handles sessions with `editRequests`, `disputes`, `hostToken`, `hostPersonId`, `assignedBy: 'host'` all gracefully — verify with a unit test that passes an old-shape session object and asserts the normalized output.
- [ ] **Currency:** `formatCents` call sites (20+ across components) all pass `currencySymbol` — verify with `grep -rn "formatCents(" --include="*.tsx"` that no call site still uses the old 1-argument signature after the signature change.
- [ ] **Currency:** `parseCents` regex `^\d+(\.\d{1,2})?$` updated or bypassed for zero-decimal currencies — verify with a test for a JPY amount `"1500"` that it returns `1500` (not `150000`) when currencyScale is 1.
- [ ] **Test suite:** After host file deletion, `npx vitest run` passes with zero skipped tests — skipped tests are a sign that host-fixture dependencies were removed but the test was not.
- [ ] **Flat model:** `personSlots` `slot_taken` blocking behavior removed from the identity modal — verify that two browser tabs can both select "Alice" without one being rejected.
- [ ] **Results screen:** `mutate()` called on entry to force fresh SWR fetch — verify by inspecting network tab that a GET /api/session request fires when transitioning to Results.
- [ ] **Share URL:** `#hostToken=` fragment no longer appended to generated share URLs — verify by opening the share URL in a fresh incognito tab and inspecting `window.location.hash`.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dangling host reference causes production crash after deploy | HIGH | Roll back the Vercel deployment immediately (takes ~30 seconds via Vercel dashboard); fix the reference; redeploy. The 24h Redis TTL means all in-flight sessions survive the rollback. |
| Old-shape sessions cause `TypeError` in new code | MEDIUM | Deploy a hotfix that adds null-guards (`?? {}`) to the failing field accesses; no data loss. The broken sessions expire within 24h. |
| `formatCents` signature change breaks call sites | LOW | TypeScript will catch all call sites at compile time via `npx tsc --noEmit`; this cannot reach production if CI enforces type checking. |
| Test suite has false-green from stale host-field fixtures | MEDIUM | Add a lint rule or CI check asserting `hostToken` does not appear in test fixture objects after Phase 1 completes. |
| Zero-decimal currency stored as 100x the correct value | MEDIUM | Display is wrong but data is intact; add `currencyScale` parameter to `formatCents` and `parseCents`, deploy hotfix. Existing sessions with wrong values expire within 24h. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Host-removal blast radius (dangling refs, Lua strings, stale fixtures) | Phase 1: Host role removal | `npx tsc --noEmit` passes; `grep -rn "hostToken" --include="*.ts"` returns zero results except the normalizer; Lua scripts inspected manually for `'host'` literals |
| Live Redis session backward-compat | Phase 1: Host role removal | Unit test for `migrateSession()` covering old-shape session; Vercel log monitoring for 24h post-deploy |
| Currency formatting (zero-decimal, parseCents float, formatCents symbol) | Phase 3: Currency recognition | `billMath.test.ts` includes JPY test cases; `grep -rn "formatCents(" --include="*.tsx"` shows all call sites use new signature |
| Wizard test suite orphaned during collapse | Phase 2: Wizard collapse | Test count after collapse equals (original count - deleted host tests) + new component tests; no tests deleted without replacement |
| Flat-model `slot_taken` blocks identity | Phase 1: Host role removal | Manual QA: two incognito tabs both successfully claim "Alice" identity in the same session |
| Results screen stale SWR cache | Phase 4: Results redesign | Network tab shows a GET /api/session request fires on Results entry; totals match what server computed |
| Unguarded new field access on old sessions | Phase 1: Host role removal | `migrateSession` unit test with v1-shape session object; no `?.` omissions on new fields |

---

## Sources

- Direct inspection of `lib/sessionSchema.ts` — confirmed 6 host-specific fields (`hostToken`, `hostPersonId`, `editRequests`, `disputes`, `ClaimEntry.assignedBy`, `ClaimEntry.accepted`)
- Direct inspection of `app/api/session/[sessionId]/claim/route.ts` — confirmed Lua string literal host references at lines 26, 97-99; `hostToken` in TypeScript body at lines 112, 135, 158, 170, 188
- Direct inspection of `lib/billMath.ts` — confirmed `formatCents` hardcodes `$` symbol and `toFixed(2)`; `parseCents` uses float multiply; regex rejects 3-decimal input
- Direct inspection of `app/split/[sessionId]/CollaborativeClaimingView.tsx` — confirmed 17+ host references including URL fragment parsing, `hasUnacceptedHostItems`, `ReviewHostAssignedScreen` import
- Blast radius analysis: `grep -rn "hostToken\|hostPersonId\|editRequests\|disputes"` — 253 lines across 31 files; 59 test assertions in shared test files
- Test file line counts: 923 lines across 6 host-specific test files; partial host references in 11 additional test files
- `app/api/session/route.ts` lines 58-65 — confirmed `assignedBy: 'host'` pre-population code that must be removed
- cjson Lua behavior: extra fields in decoded JSON objects are preserved on re-encode; missing fields return nil (not an error) — confirms old sessions with extra fields will not crash Lua scripts, but new code reading absent new fields must null-guard
- JavaScript floating point: `parseFloat("1.005") * 100` = 100.49999... — browser console verified; string-split construction is the canonical workaround (MDN: Number.toFixed rounding is implementation-dependent for midpoint values)
- Upstash Redis atomicity: `redis.multi()` is NOT atomic on Upstash REST API — already documented in existing codebase comments (`claim/route.ts` line 9); `redis.eval()` with Lua is the required pattern
- `.planning/research/FEATURES.md` (2026-06-04) — confirmed last-write-wins is the accepted product decision for item edits; attribution label is mandatory accompaniment

---
*Pitfalls research for: easy-billsy v2.0 — live bill-splitter host removal, wizard collapse, currency, flat model*
*Researched: 2026-06-04*
