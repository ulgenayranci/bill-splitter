# Domain Pitfalls

**Domain:** Headcount / empty-seat claiming on a real-time shared bill (v2.1 "Faster people setup")
**Researched:** 2026-10-06
**Confidence:** HIGH on codebase-grounded findings (read the real routes/Lua); MEDIUM on OCR behavior (prompt-level reasoning, no live scan testing)

Key facts about the existing system that drive everything below (verified in code):
- A "seat" will be a `Person` in `session.people` with an empty `name`. There is no seat concept or `claimed` flag today (`lib/sessionSchema.ts`).
- `rename_person` and `add_person` are Lua scripts in `app/api/session/[sessionId]/edit/route.ts`. `rename_person` is an unconditional overwrite (no compare-and-set).
- `done/route.ts` and `tip/route.ts` are NON-atomic GET -> spread -> `redis.set(whole session)`. They already clobber concurrent writes to `people[]`.
- `claim/route.ts` Lua never checks that `personId` exists in `session.people` (only `done` does, in TS).
- `computeEqualChargeShares(charge, people)` hands the remainder cent(s) to the first people by ARRAY INDEX.
- Identity restore in `CollaborativeClaimingView.tsx` (~line 160) already checks `session.people.some(p => p.id === stored)` once on first load, guarded by `restoreAttempted` ref; it is NOT re-checked on later polls.
- `add_person` assigns `colorIndex = #people % 6`; people cap is 20.
- Prior descope (v2.0 PART-01/02/06): live remove-person Lua had 2 Critical review findings and no execution-level test. Lesson: any new Lua here needs a real execution test before ship.

## Critical Pitfalls

### Pitfall 1: Two friends claim the same empty seat (silent last-write-wins)
**What goes wrong:** Both open the link, both pick "Seat 3", both type a name. Existing `rename_person` just overwrites, so the second name replaces the first. The first friend's phone still thinks they are Seat 3, keeps claiming items under the same personId, and now their items are attributed to someone else's name. Nobody gets an error.
**Why it happens:** The flat/no-lock model (GAP-09-NOLOCK) was designed for "names always selectable, concurrent same-name editing". Seat claiming is different: a seat is only legitimately claimable while empty. Reusing `rename_person` carries over the "overwrite" semantics.
**Consequences:** Wrong person billed; two people believe they are the same seat; confusion that is invisible until Results.
**Prevention:** Add a NEW dedicated op (e.g. `claim_seat`) with compare-and-set inside Lua: succeed only if `person.name == ''` (or missing); otherwise return `seat_taken`. Do NOT reuse `rename_person` for the first naming. The client on `seat_taken` must refetch and re-open the picker with a message ("Someone just took that seat — pick another"), and must NOT store the personId in localStorage. Keep `rename_person` unchanged for renaming already-named seats (flat model preserved: renaming a named seat is still allowed, per decision).
**Detection:** Test that fires two concurrent `claim_seat` calls on one seat at the Lua level and asserts exactly one `OK`. Warning sign: any code path where the empty->named transition goes through `rename_person`.
**Phase:** Seat-claim API phase (first backend phase). Needs an execution-level Lua test (see Pitfall 3).

### Pitfall 2: Removing an empty seat while someone is claiming it (or claiming items as it)
**What goes wrong:** A removes empty Seat 4 at the same moment B picks Seat 4. Outcomes: B's `claim_seat` returns `person_not_found` (fine if handled) OR, worse, B already holds Seat 4 locally and claims items; the claim Lua does not validate personId, so claims are written under a ghost personId that is not in `people[]`. Those units are counted as claimed (hiding them from the "unclaimed" callout) but billed to nobody — money silently disappears from the totals.
**Why it happens:** (a) remove-empty must check "no name AND no claims" atomically — a TS pre-check followed by a write is a TOCTOU race. (b) `QTY_CLAIM_SCRIPT` / `SHARE_CLAIM_SCRIPT` never verify the person exists. (c) Also the "empty" definition must include claims, not only name: today a seat could theoretically hold claims with no name.
**Consequences:** Orphan claims; item shown as claimed but charged to nobody; Results total below the receipt total.
**Prevention:**
1. `remove_seat` Lua: one script that (i) finds the person, (ii) requires `name == ''`, (iii) scans `claims.items[*][personId]`, `tips[personId]`, `donePeople[personId]`, `personSlots[personId]` and refuses with `seat_not_empty` if any exist, (iv) removes from `people`, (v) deletes any leftover keys. All in one eval.
2. Add a person-exists guard to both claim scripts (`QTY_CLAIM_SCRIPT`, `SHARE_CLAIM_SCRIPT`) returning `person_not_found`; also in `claim_seat`. Client treats `person_not_found` as "your seat was removed" -> clear identity, reopen picker.
3. Do not allow removing the seat the current device is acting as unless it is empty (a named self is never empty, so naturally blocked).
4. Never remove the last seat (`#people >= 1`), and the scanner's own seat must be named so is protected by the emptiness rule.
**Detection:** Orphan-claims invariant check in tests: every personId in `claims.*` and `tips`/`donePeople` is in `people[]`. Results total across people + unclaimed == receipt total.
**Phase:** Seat-management phase. This is the exact feature that was descoped in v2.0 for untested Lua — make Lua execution testing (not just code review) an explicit acceptance gate.

### Pitfall 3: Repeating the v2.0 failure — new Lua with no execution test
**What goes wrong:** `remove_person` was descoped because the Lua purge had 2 Critical findings and was never run. Seat claim/remove adds two more scripts of the same kind. Lua/cjson has known traps that unit tests on TS cannot catch.
**Why it happens:** Lua lives in template strings; nothing type-checks it; Upstash REST eval is hard to run in unit tests.
**Specific cjson traps to test:**
- An empty Lua table re-encodes as `[]`, not `{}`. After removing the last claim/seat, `claims.items`, `tips`, `donePeople`, `personSlots` can flip from `{}` to `[]`. The claim script already works around this for per-item maps (removes the key); the same care is needed for any new purge loop. `people` becoming `[]` is fine but must never happen.
- Deleting from a table while iterating with `pairs`/`ipairs` skips entries; rebuild a new `people` array instead of `table.remove` inside the loop.
- `nil` in arrays truncates; do not assign nil into `people` entries.
- cjson turns large numbers/floats oddly; keep all values integer cents.
- Empty string `name = ''` round-trips fine, but `name = nil` removes the key — be consistent (always write `''`).
**Prevention:** Run the scripts against a real Redis (local `redis-server` via a test harness or an `EVAL`-capable Upstash test DB — note memory: Upstash DB was recreated 2026-09-29, check env vars) and assert on the decoded JSON shape, including the "empty map stays an object" cases. Write the tests BEFORE merging the scripts.
**Detection:** Session JSON where `tips` or `claims.items` is `[]`; client `Object.entries` still works on `[]` but `{...[]}` and key writes later behave differently; `Record` typing lies.
**Phase:** Seat-management phase (gate), also applies to seat-claim phase.

### Pitfall 4: Non-atomic routes clobber seat changes (done/tip write the whole session)
**What goes wrong:** `done` and `tip` do GET, spread, then `redis.set(entire session)`. If someone adds, claims, or removes a seat between that GET and SET (a window of tens to hundreds of ms on serverless), the whole `people[]` write is reverted. A newly claimed seat name vanishes; a removed seat reappears; a new seat disappears and its holder's claims become orphans.
**Why it happens:** This was tolerated in v2.0 because `people[]` rarely changed after creation (only add_person/rename). v2.1 makes `people[]` the hottest mutating field (every friend arriving claims a seat at roughly the same moment — the exact stampede right after the link is shared).
**Consequences:** Intermittent "my name disappeared" bugs that are nearly impossible to reproduce. Lost seat claims right at the busiest moment.
**Prevention:** Convert `done` and `tip` to field-level Lua updates (mirror `UPDATE_CURRENCY_SCRIPT`, which was written for precisely this reason: CR-01) BEFORE or in the same phase as seat claiming. Ensure the Lua only touches `claims.donePeople[personId]` / `tips[personId]`.
**Detection:** Concurrent test: fire `claim_seat` and `done` together 50 times; assert the seat name is always present.
**Phase:** Must land before or with the seat-claim phase (prerequisite), not after.

### Pitfall 5: Stale identity in localStorage pointing at a removed or re-assigned seat
**What goes wrong:** Device stores `split:{id}:personId`. Restore only runs once on first load (`restoreAttempted` ref). New v2.1 scenarios: (a) the stored seat was removed while the tab was in the background — later polls return a session without that personId, but `selectedPersonId` is still set, so `me` is undefined (`session.people.find` at ~line 581), the view may crash or silently show nothing, and claim calls hit `person_not_found`. (b) the stored seat is the scanner's own device: after "New Split" or a new bill with a REUSED personId scheme... ids are nanoids, so collisions are not a risk, but cross-session leakage is avoided only because keys are namespaced by sessionId — keep it that way. (c) Seat exists but is now EMPTY (name cleared by a rename to blank, or a seat removed and re-added) — the device is "someone" in an empty seat.
**Why it happens:** The membership check is one-shot, and v2.0 had no way for a person to disappear while the view was open (live remove descoped). v2.1 reintroduces that.
**Consequences:** Blank screen/crash in the Bill View, claims returning errors, or a user acting as a seat that is now someone else's.
**Prevention:** Make identity validity a derived, continuously-checked property: on every session update, if `selectedPersonId` is set and not in `people[]`, clear it, remove the localStorage key, and reopen the "Who are you?" modal with a toast ("Your seat was removed"). Also treat "stored seat exists but is empty" as invalid (device never claimed it, since claiming sets a name). Do not rely on `restoreAttempted` for removal detection.
**Detection:** Test: open view, remove the seat server-side, wait one poll tick, assert modal reopens and no exception. Warning sign: `me` null checks scattered in render.
**Phase:** Identity/seat-picker phase; re-verify in seat-management phase.

### Pitfall 6: Results/Bill View showing unnamed seats as blank rows or "undefined"
**What goes wrong:** Every place that renders `person.name` (results list, copy-to-clipboard text at `PersonResultsScreen` ~line 150, attribution chips, picker, BillViewHeader `otherPeople`, avatars using first letter `name[0]`) assumes a non-empty name. Empty seats produce blank lines, an empty avatar initial, "owes" lines with no name, or a copy-paste summary like ": 12.40" sent to the group chat.
**Why it happens:** `isValidPeople` only requires `typeof name === 'string'`, and every renderer was written when names were mandatory.
**Consequences:** The headline output of the app (the "who owes what" text) looks broken; empty seats also tempt readers into thinking money is lost.
**Prevention:** One shared helper `displayName(person, index)` -> `name || "Seat {index+1}"` (stable numbering by array order of seat creation; do not renumber when a seat is removed — see Pitfall 8). Use it everywhere including the clipboard text, avatars (use "?" or seat number), and chips. Results must list empty seats explicitly, labeled "Seat 3 (empty) owes X — equal share of tax/service". Grep for `.name` usages as a checklist item. Initial/avatar fallbacks must not index into an empty string.
**Detection:** Snapshot test of results + copy text with one empty seat. Grep `person.name`/`p.name` for unguarded uses.
**Phase:** Seat model phase (introduce helper first), verified in results phase.

### Pitfall 7: Equal tax/service share rounding and seat-count drift
**What goes wrong:** (a) With N seats, `computeEqualChargeShares` gives the remainder cents to the first `idx < remainder` people by array order. Adding or removing a seat changes N, so every person's share changes by a cent or more live — a person who already screenshot their total now sees it change (expected, but must be understood by the design). (b) Remainder cents going to the same early array positions (usually the scanner) is stable but means the same person always pays +1 cent; fine. (c) If array order differs between clients or after a Lua rewrite, the cent could land on different people on different phones; cjson preserves array order so this is safe, but any code that sorts or re-orders `people` in a render (e.g. PersonResultsScreen puts "me" first at lines ~126-127) must NOT be fed into the share function — the share function must always receive the canonical `session.people` order. Today the call at line 115 passes `session.people` (good); the pitfall is a future refactor passing the reordered list. (d) Empty seats are intentionally charged tax/service even though they have no items: sum of all shares must still equal the charge exactly (largest-remainder already guarantees this over ALL seats; a bug that excludes empty seats from the divisor but still bills them would break it).
**Why it happens:** Headcount and `people.length` become the same number only if empty seats are real `Person` entries. Any design that stores headcount as a separate integer (e.g. `session.headcount`) while `people[]` holds only named people gives two sources of truth that drift.
**Prevention:** Single source of truth: seats ARE `people[]` entries, headcount = `people.length`. Do not add a separate headcount field. Keep passing canonical `session.people` to `computeEqualChargeShares`. Add property tests: for N in 1..20 and charges including 0, 1, N-1, prime values, `sum(shares) === charge`, and each share within 1 cent of the others. Also assert the invariant at Results: sum(person totals) + unclaimed items portion == grand total.
**Detection:** Totals not summing to receipt; cents jumping on person order change.
**Phase:** Billing-math phase (small; mostly tests). Also see service fee (`computeServiceFeeShares` alias) — one function, test once.

### Pitfall 8: Backward compatibility with live sessions in Redis (24h TTL)
**What goes wrong:** Sessions created before deploy stay live up to 24 hours. They contain only named people, no empty seats, no new fields. New code must treat that as valid: "headcount" == number of named people, no empty seats, nothing to claim.
**Specific risks:**
- Any new schema field (e.g. `seatNumber`, `claimedAt`, `headcount`) being required by new TS/Lua code will be `nil` on old sessions: Lua `nil` arithmetic errors, TS `undefined` rendering. Make every new field optional with a documented default (the file already does this for `serviceFeeCents`/`taxCents` — follow that pattern).
- Seat numbering by "index in people[]" works retroactively; storing a persisted `seatNumber` would not (old people lack it). Prefer derived labels, or optional field with fallback to index.
- Old clients (cached JS in a phone's browser tab opened before deploy) will call `add_person`/`rename_person` with the old contract; they must keep working. Do not change the contract of existing ops; add new ops. An old client rendering a session that contains empty-name people will show blanks — acceptable and short-lived, but do not crash (names are strings, so it will not).
- `POST /api/session` validation (`isValidPeople`) currently accepts empty `name`; verify it still does (it does: `typeof name === 'string'`) — and that `people.length >= 1` stays required. Tighten NOTHING that old sessions would violate.
- Existing max-20 cap in `ADD_PERSON_SCRIPT`: headcount counter must be capped at the same 20 client-side AND `claim_seat`/`add_seat` must enforce it server-side.
**Prevention:** Additive-only schema; new ops, not changed ops; fixture test that loads a v2.0-shaped session JSON through the new routes and renders. A one-line deploy note: nothing needs migrating because the TTL is 24h and the shape is a superset.
**Detection:** Console errors on old session links after deploy; `attempt to perform arithmetic on a nil value` from eval.
**Phase:** Schema phase (first); regression fixture in every later phase.

### Pitfall 9: OCR misreads Pax/Covers/Guests as a price, table number, or item
**What goes wrong:** The OCR prompt (`app/api/ocr/route.ts`) currently has no guest-count field and says "Include EVERY line the receipt prints". Once added, the model can: report table number ("Table 12"), check number, cashier id, date digits, or a quantity like "2x" as the guest count; or conversely, a "Guests: 4" line may be emitted as an ITEM (priced 4 -> 400 cents?) or contaminate `printedAmountsCents`. Some receipts show "Pax: 2" (couples), some "Covers: 0" or "1" for a table that is actually 6. Thermal receipts with Turkish ("Kişi"), Italian ("Coperti"), Spanish ("Comensales"), German ("Gäste") labels differ from the English triple the feature names. Note "coperto" is also a cover CHARGE in Italy — the existing prompt already treats it as serviceFeeCents; a guest count and a cover charge can coexist ("Coperti 4 x 2.00") and be confused.
**Why it happens:** Only the model's interpretation separates a count from an amount; it is a free-text OCR task with no checksum (unlike the subtotal self-check that protects item sums).
**Consequences:** Wrong prefilled headcount (mild if editable) — or, if the guest line leaks into items/printedAmounts, a corrupted bill (serious; the repair/reconcile pipeline `reconcileScannedBill.ts` / `repairScannedPrices.ts` may "fix" prices around it).
**Prevention:**
- Add a separate optional top-level field (`guestCount: integer | null`) to the schema with strict instructions: only a labeled count of diners (Pax, Covers, Guests, Persons, Kişi, Coperti, Comensales, Gäste, Couverts); never table/check/server numbers; null when unsure; and explicitly "do NOT include this line in items or printedAmountsCents".
- Server-side sanity clamp in TS (the app already has `scanSanityChecks.ts`): accept only an integer 1..20 (the people cap), else null. Reject values equal to a table number heuristically? Not possible; rely on label + clamp.
- Treat it ONLY as a prefill. The counter must always be editable, and the UI should visibly state the source ("From receipt: 4") so a wrong value is spottable. Default to a sensible fallback (1 = just me, or 2) when null — not 0.
- Covers = 0 or 1 on a big-table receipt is common (POS defaults): a value of 1 should arguably prefill as 1 but not pretend certainty. No special logic needed; just editable.
- Regression: run the existing item-checksum test fixtures to confirm adding the field does not change item extraction.
**Detection:** Test receipts with "Table 12 Pax 4", "Covers: 0", "Coperti 4 x 2.00", and no guest line. Watch `printedAmountsCents` length changes.
**Phase:** OCR phase. Needs a small real-receipt test set; flag for phase-specific research (cheap to run, high value).

## Moderate Pitfalls

### Pitfall 10: The scanner creates N-1 empty seats but session POST/validation assumes named people
**What goes wrong:** `POST /api/session` `isValidPeople` accepts `name: ''` today, but client code in Setup (`SetupStep`, `createSession.ts`) may filter blank names before posting, silently turning the headcount into a 1-person session. Also the Setup "remove person" path (retained from v2.0) may conflict with counter semantics (removing a person vs decrementing the counter should be the same operation).
**Prevention:** One representation for Setup: counter drives the number of seats; the scanner's name fills seat 1; remaining seats created with `name: ''` and posted as-is. Check `createSession.ts` for trimming/filtering. Decrementing the counter below the number of NAMED people (if Setup also lets her type other names) must be blocked or must warn.
**Phase:** Setup/headcount phase.

### Pitfall 11: "Who are you?" picker semantics: empty vs named seats, and "+ I'm not listed" race
**What goes wrong:** The v2.0 picker lists every person and lets you pick any (no lock). Now it must list EMPTY seats as the primary action ("claim a seat + type name") and named seats as a secondary "that's me" path (returning user on a new device). If both are shown equally, a returning friend taps an empty seat instead of their own named seat and duplicates themselves. "+ I'm not listed" appends a new seat then names it: two requests (add, then claim) can be split by a failure leaving a nameless seat the user never owns, leaking empty seats. Two friends tapping "+ I'm not listed" simultaneously each add a seat — fine — but headcount creeps if a user retries after a timeout (double-add).
**Prevention:** Make "+ I'm not listed" a single atomic op: `add_person` with name (already exists; reuse it — it appends with the name in one script) rather than add_seat + claim. Add an idempotency token (client-generated personId is passed to Lua already: ARGV[2]) so a retry with the same id is a no-op. Keep the named-seat "that's me" path visually distinct. Debounce submit buttons.
**Detection:** Seat count growing over a session without matching names.
**Phase:** Identity phase.

### Pitfall 12: colorIndex duplicates after remove/add
**What goes wrong:** `colorIndex = #people % 6` is computed at add time. After removing seat 2 of 5 and adding another, two people can share a colour; chips/avatars then look identical. With empty seats added by headcount, colours are assigned at creation, which is fine, but live add/remove cycles collide.
**Prevention:** Compute colorIndex as (max existing colorIndex + 1) % 6, or the least-used colour, inside the Lua script. Cosmetic only; low priority but cheap in the same script.
**Phase:** Seat-management phase.

### Pitfall 13: Seat label numbering instability
**What goes wrong:** If empty seats are labeled by array position ("Seat 3") and a middle seat is removed, "Seat 4" becomes "Seat 3" under people's feet; a friend told "take Seat 3" claims the wrong one. Also two empty seats are indistinguishable except by number.
**Prevention:** Number empty seats only among EMPTY seats for display ("Empty seat 1, 2…") or store an optional monotonic `seat` number assigned at creation (optional field, fall back to index for old sessions — see Pitfall 8). Prefer not asking people to coordinate by number at all; pick-any-empty-seat is the locked design, so which empty seat is irrelevant and labels merely need to be non-confusing.
**Phase:** Seat model phase.

### Pitfall 14: Polling staleness hides the race outcome
**What goes wrong:** The session is polled (SWR `refreshInterval`). A picker that renders "empty seats" from a stale snapshot shows seats already taken. Combined with Pitfall 1 prevention, this just yields `seat_taken` errors — acceptable if handled — but if the mutation optimistic-updates the local cache and the server rejects, the UI may keep showing the rejected name.
**Prevention:** On any non-OK response from seat ops, call `mutate()` to refetch before re-rendering; do not optimistically mark a seat claimed. Show the picker's empty list from fresh data (revalidate when the modal opens).
**Phase:** Identity phase.

### Pitfall 15: Anyone-can-remove-empty-seat griefing and empty-seat inflation
**What goes wrong:** Flat model means anyone can add seats (cap 20) and remove empty ones. A bored guest can push headcount up, lowering everyone's equal tax/service share and making the total look wrong; or remove an empty seat a friend is about to take. There is no host to arbitrate (by decision).
**Prevention:** Accept as a product trade-off (trusted group, no nudge by decision) but limit damage: cap at 20 server-side, keep seat add/remove visible in the UI as an explicit headcount change ("Headcount: 5"), and ensure Results shows the headcount used for the tax split ("tax split across 5 people") so an inflated count is visible. No auth work.
**Phase:** Seat-management / results phase (display only).

### Pitfall 16: "Done" and tips for empty seats
**What goes wrong:** `donePeople` / `tips` are per personId. Empty seats never press Done and have no tip; any "everyone is done" logic or tip-confirm indicator (`tips` absent = "not yet confirmed") will treat empty seats as perpetually not-done, blocking or warning forever. The warn-but-allow done flow may count empty seats among "people not done".
**Prevention:** Exclude empty (nameless, claimless) seats from done/tip completion counts. Audit any `session.people.every/filter` on done/tip state.
**Phase:** Results phase.

## Minor Pitfalls

### Pitfall 17: Counter UX edge cases
Decrement below named-people count, below 1, above 20; counter prefilled by OCR then changed after the user already typed names; rescanning (a second photo) overwriting a manually edited headcount. **Prevention:** floor at max(1, named count), ceiling 20; only prefill from OCR if the user has not touched the counter; keep the user's edit on rescan.

### Pitfall 18: Duplicate names
Two friends type "Alex" into different seats; chips and results become ambiguous. Flat model allows same names already (rename). **Prevention:** none required (decision), but show seat colour alongside names.

### Pitfall 19: Whitespace-only / long names for seat claim
`add_person` validates trim and 50 chars; `claim_seat` must apply the same validation (reuse `validateOp` branch) — a whitespace-only name would leave the seat "empty" yet claimed by the device. **Prevention:** reuse trimmed non-empty validation; Lua checks `name ~= ''`.

### Pitfall 20: Dead wizard code confusion
Retired `AddPeopleStep` etc. still exist (audit tech debt). A developer may wire headcount into the dead component. **Prevention:** target `SetupStep` and the live picker only; optionally delete dead wizard files in an early cleanup task to reduce grep noise.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Schema / seat model | Required new fields break old 24h sessions (8); blank names everywhere (6); numbering instability (13) | Additive optional fields only; `displayName` helper; fixture of v2.0 session |
| Atomic prerequisites | `done`/`tip` clobber `people[]` (4); claim scripts accept ghost personId (2) | Convert done/tip to Lua field updates; add person-exists guard to claim scripts |
| Seat claim API | Double-claim last-write-wins (1); retries double-add (11) | `claim_seat` with compare-and-set; idempotent personId |
| Seat removal API | Remove vs claim race, orphan claims (2); untested Lua repeat of v2.0 (3) | Single atomic Lua with full claims check; REAL Redis execution tests as gate |
| Identity picker | Stale localStorage / removed seat (5); stale poll data (14) | Continuous identity validity check; refetch on error |
| Setup / headcount | Blank-filtering turns seats into 1 person (10); counter edge cases (17) | Counter drives seats; post empty names as-is |
| OCR guest count | Pax vs table number/price, guest line leaking into items (9) | Separate nullable field, clamp 1..20, editable prefill, small receipt fixture set |
| Billing math | Rounding/remainder, headcount drift (7); done/tip counts (16) | Seats are people[]; property tests sum==charge; exclude empty seats from done logic |
| Results | Unnamed rows and broken copy text (6); inflated-headcount visibility (15) | Shared label helper; show headcount used for tax split |

## Research Flags
- Needs deeper phase research: OCR guest count (9) with real receipts; Lua execution test harness choice (3).
- Standard patterns, unlikely to need research: label helper, counter UI, rounding tests.

## Sources
- Codebase (read directly, HIGH): `app/api/session/[sessionId]/edit/route.ts`, `claim/route.ts`, `done/route.ts`, `tip/route.ts`, `app/api/session/route.ts`, `app/api/ocr/route.ts`, `lib/billMath.ts` (`computeEqualChargeShares`), `lib/sessionSchema.ts`, `app/split/[sessionId]/CollaborativeClaimingView.tsx`, `components/split/PersonResultsScreen.tsx`
- `.planning/milestones/v2.0-MILESTONE-AUDIT.md` (PART-01/02/06 descope rationale)
- `.planning/PROJECT.md` (v2.1 locked decisions)
- cjson empty-table-as-array behavior: already worked around in `claim/route.ts` comments (HIGH, in-repo); general Lua/cjson knowledge (MEDIUM, training data, not re-verified against Redis docs)
- OCR label variants / POS behavior: training knowledge (LOW; verify with real receipts)
