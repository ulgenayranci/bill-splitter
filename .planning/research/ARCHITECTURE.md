# Architecture Patterns — v2.1 Faster People Setup

**Domain:** Seat-based people setup on top of the existing flat collaborative bill splitter
**Researched:** 2026-10-06
**Confidence:** HIGH (all findings come from reading the current code; no new libraries needed)

## Bottom line

Model an empty seat as a normal `Person` whose `name` is `''`. No new field, no schema migration, no change to `billMath`. Tax and service already split equally across `session.people`, so empty seats pay their share without any math changes. All new server work is three small Lua ops that mirror `ADD_PERSON_SCRIPT` and `RENAME_PERSON_SCRIPT`. Most of the risk is in the UI, which uses `person.name` in many places and currently assumes it is non-empty.

## 1. Seat representation: empty-name Person, not a flag

**Recommendation: `Person { id, name: '', colorIndex }`. Empty name means empty seat.** `isEmptySeat(p) = p.name.trim() === ''`.

| Criterion | Empty-name Person | `isSeat` / `claimed` flag |
|---|---|---|
| Schema change | None (`name: string` already allowed) | New field on Person, SessionPayload, Lua, validators |
| Old sessions (24h TTL) | Valid as-is | Need a default for the missing flag |
| `computeEqualChargeShares`, `computePersonShareFromClaims`, `done` route, `tips` | Work unchanged | Work unchanged |
| `POST /api/session` `isValidPeople` | `typeof name === 'string'` accepts `''` | Needs an update |
| Two sources of truth | None (name IS the state) | Flag and name can disagree |
| "Claim seat = name the person" | One field changes, so one atomic compare-and-set | Two fields change |

The only cost is that every `person.name` display site must tolerate `''`. Add one helper, `lib/seats.ts`:

```ts
export const isEmptySeat = (p: Person) => p.name.trim() === ''
export const seatLabel = (p: Person) => (isEmptySeat(p) ? 'Empty seat' : p.name)
export const seatInitial = (p: Person) => (isEmptySeat(p) ? '?' : p.name.charAt(0).toUpperCase())
```

Then replace the raw `person.name` and `.name.charAt(0)` uses. Known sites (from grep):
- `components/split/PersonSlotPicker.tsx`: card label, avatar initial, rename form.
- `components/split/BillViewHeader.tsx`: people strip, initials and `title`.
- `components/split/PersonResultsScreen.tsx`: accordion rows (about lines 264-297), the Copy text at about line 159, and the swipe handler that passes `person.name`.
- `components/split/ClaimableItemCard.tsx`: `peopleById[pid]?.name`. Empty seats never hold claims, so this is safe, but use the helper anyway.

Seat numbering: do NOT derive "Seat 3" from array index. Removing an empty seat shifts everyone after it and confuses people looking at the same list. Use the avatar colour plus a "?" and "Empty seat" label. If numbering is wanted later, store it.

`colorIndex`: `ADD_PERSON_SCRIPT` uses `#people % 6`. After a removal this can duplicate a colour. That is cosmetic and acceptable. Seats created on Setup use `nextColorIndex`.

The scanner's own seat is a named person created on Setup. Her `personId` is already known client-side because `randomId()` ids are sent to the server in `createSession`.

## 2. Server ops

All three go in `app/api/session/[sessionId]/edit/route.ts`, in the existing branch-before-GET/SET style. Lua cannot generate ids, so ids come from TS (`nanoid()`), as `add_person` already does. Add the new op names to `VALID_OPS`.

### 2a. `claim_seat` (atomic, concurrent): NEW Lua `CLAIM_SEAT_SCRIPT`

ARGV = `[personId, trimmedName]`. Compare-and-set on the empty name:

```lua
-- find person; if not found -> 'person_not_found'
-- if p.name ~= '' then return 'seat_taken' end
-- p.name = ARGV[2]; SET ... EX 86400; return 'OK'
```

Why a guard here when the app is otherwise "no name locking": the lock is NOT on names. It is a one-time empty-to-named transition. Without it, two friends tapping the same empty seat at once would silently overwrite each other's name, and the loser would then be sitting in a seat that now has someone else's name. With the compare-and-set, the loser gets 409 `seat_taken`. The client then calls `mutate()`, the list refreshes, and the modal re-renders with that seat now named and selectable under the existing flat "names always selectable" rule. Keep that fallback friendly: a short inline "Someone just took that seat, pick another".

After success the client does what `handleAddPerson` does now: `await mutate()`, `setSelectedPersonId(personId)`, write `split:${sessionId}:personId` to localStorage, and close the modal. A separate `action: 'slot'` call is not needed. Selecting an already-named seat still goes through the existing `handleSelect` / slot path.

Reuse `validateOp`'s name rules from `add_person` (trimmed, 1-50 characters). `rename_person` stays unchanged and still rejects empty names, so a named person can never turn back into an empty seat, which keeps "empty" a one-way state.

Race to be aware of: `rename_person` on an empty seat's id (the pencil on a seat in the picker) bypasses the empty-name guard. Hide the rename pencil for empty seats (the name input on claim replaces it), or route empty seats only through `claim_seat`.

### 2b. `add_seat`: NEW or parameterised `ADD_PERSON_SCRIPT`

Easiest: allow `add_person` to accept `name: ''` through a new op `add_seat` that reuses the same Lua with an empty-string name. The script already:
- appends atomically (no append race),
- enforces the 20-person cap (`session_full`),
- assigns `colorIndex`.

Only the validator differs, so `validateOp('add_seat')` has no name. The response returns `{ ok, personId }`. Do not set `personSlots`. The "+ I'm not listed" modal flow stays as `add_person` with a typed name (creates a named person), which is correct because that friend is naming themselves.

### 2c. `remove_seat`: NEW Lua `REMOVE_SEAT_SCRIPT` (the riskiest one)

This is the only new op that deletes. The prior descope was caused by a Lua purge with 2 Critical findings and no execution test. Keep it deliberately narrow: **refuse unless the seat is provably empty, and never purge anything.** If it succeeds, there is nothing else to clean up.

ARGV = `[personId]`. All checks and the delete run in one Lua call, so a concurrent `claim_seat` or item claim cannot sneak in between the check and the remove:

```lua
-- locate person index i; none -> 'person_not_found'
-- if p.name ~= '' -> 'seat_not_empty'
-- for each itemId, claimMap in pairs(session.claims.items or {}):
--     if claimMap[personId] ~= nil -> 'seat_not_empty'
-- if session.claims.personSlots and session.claims.personSlots[personId] -> 'seat_not_empty'
-- if session.claims.donePeople and session.claims.donePeople[personId] -> 'seat_not_empty'
-- if session.tips and session.tips[personId] -> 'seat_not_empty'
-- if #session.people <= 2 -> 'too_few_people'   -- floor chosen to match the Setup gate
-- table.remove(session.people, i)
-- SET ... EX 86400; return 'OK'
```

Notes and traps:
- "Empty" = no name AND no claims, matching the locked requirement. A seat with a name is never removable, so no purge logic is needed. This is what keeps it out of the scope that was descoped.
- A seat could only ever carry claims/slots/tips if someone adopted its identity, and adopting means naming it first. The extra checks are defence in depth; they are cheap.
- cjson trap already present in this codebase: a table that is empty after decoding is re-encoded as `[]`. `people` stays non-empty (floor of 2), so it is safe. Do not remove the last person. Do not rewrite `claims.*` sub-tables in this script. Only the `session.people` array changes.
- Reading `claims.items[*][personId]`: after a prior Lua write `claims.items` can be `[]` (empty array). `pairs()` over it simply yields nothing, which is correct. Test with that shape.
- `table.remove` shifts the array, which changes the remainder-cent distribution order in `computeEqualChargeShares`. This is server-authoritative and identical on every device, so it is fine.
- Stale-client cases: a client whose localStorage `personId` points to a removed seat would hit `!me -> SessionExpiredScreen`. That cannot happen for empty seats because nobody adopts an unnamed identity. If a modal is open on a removed seat, the existing effect that clears state when the person disappears (`PersonSlotPicker` lines 31-35) handles it.
- The old failure mode was untested Lua. **Phase gate: write an execution-style test** (see 6) before shipping this op.

### Other consumers

- `done` route: validates `personId` against `session.people`. Unchanged.
- `tip` route: per-person, unchanged. Empty seats get no tip.
- `claim` route (`slot`, `share`, `qty`): unchanged. The `share`/`qty` Lua operates on string ids and does not check person existence. A claim on a removed seat id is impossible in practice. Optional hardening: none needed this milestone.
- `GET /api/session/[id]`: unchanged. 3-second SWR polling propagates seat changes with no extra plumbing.

## 3. billMath and Results flow

- `lib/billMath.ts`: **no changes.** `computeEqualChargeShares(charge, session.people)` already divides by `people.length`, so empty seats are counted automatically. This is the whole "empty seats pay equal tax/service" requirement, delivered for free. Add tests that a `name: ''` person still gets a share and that shares sum exactly to the charge.
- Item subtotals: an empty seat has no claims, so `computePersonShareFromClaims` yields `itemSubtotal 0`, `tax` share, `fee` share, `tip 0`. Correct by definition.
- `app/split/[sessionId]/CollaborativeClaimingView.tsx`: computes `feeShares`/`taxShares` from `session.people`. Unchanged.
- `components/split/PersonResultsScreen.tsx`:
  - The accordion lists all people. Empty seats will appear as "Empty seat" rows owing tax/service. Keep them visible, because they are part of the totals and hiding them would make the sum look wrong. Use `seatLabel`.
  - Copy text (about line 150): `${p.name} owes ...` becomes `${seatLabel(p)} owes ...`. Decide product-side whether to emit "Empty seat" lines. Recommendation: include them, since the user said they pay.
  - Swipe handler `handleTouchEnd(e, person.id, person.name)`: guard for empty names.
- Known property worth surfacing in the roadmap: if the headcount is too high, the surplus empty seats permanently take a tax/service share from real people. The remedy is "remove empty seat", so Phase UX must make the empty-seat affordance discoverable (no nudge by decision, but the remove control must be easy to find).
- Unclaimed-items callout (`getUnclaimedCounts`): unchanged. Item claim logic does not depend on people.

## 4. Identity modal changes

Files: `components/split/IdentityModal.tsx` (shell, copy), `components/split/PersonSlotPicker.tsx` (list; this is where the real change is), `app/split/[sessionId]/CollaborativeClaimingView.tsx` (handlers).

- Props: add `onClaimSeat(personId, name): Promise<void>` to `IdentityModal` and `PersonSlotPicker`.
- Picker rendering: two groups in the grid. Named people tap-to-select, with a rename pencil (unchanged). Empty seats render as dashed/"Empty seat" cards; tapping reveals an inline "Your name" input plus a confirm button, reusing the existing inline-add pattern (`showAddForm`, `newName`) and the same Input/Button styling. Track `claimingSeatId` state (like `editingPersonId`).
- "+ I'm not listed" remains, unchanged (`add_person` with a typed name).
- Copy: `DialogDescription` "Pick your name from the list below." becomes "Pick your seat and type your name." when empty seats exist.
- Stale-state effect: extend the existing `useEffect` guard so that if `claimingSeatId` seat gets named by someone else while the form is open, the form closes and shows the "taken" message. The 409 path also covers this.
- Scanner shortcut: in `SetupStep.handleContinue`, after `createSession`, write `localStorage.setItem('split:${sessionId}:personId', hostPerson.id)` so the scanner skips the modal entirely (her seat is the only named one). Currently the restore effect (`CollaborativeClaimingView` about lines 141-166) opens the modal when nothing is stored. Verify against `phase === 'invite'` behaviour (G4) so the invite step still shows first. Also keep the existing "Who are you?" route available for the scanner via the header strip tap.
- Header strip (`BillViewHeader.tsx`): shows `otherPeople` as initial circles; empty seats must render as neutral "?" circles; add a small "+" (add seat) control. A seat-management surface is needed on the Bill View (see 5).
- Seat management on the live Bill View: new component, suggested `components/split/SeatManager.tsx` (or a sheet from the header strip). It lists empty seats with a remove button and offers "+ Add seat". It calls `add_seat` / `remove_seat`, then `mutate()`. Handle 409 `seat_not_empty` ("Someone just joined that seat").

## 5. Setup side (headcount counter, store, createSession)

Files: `components/wizard/SetupStep.tsx` (modify), `stores/useBillStore.ts` (modify), `lib/createSession.ts` (no change needed), `app/api/session/route.ts` (no change; `''` passes `isValidPeople`).

Store:
- Keep `people: Person[]`. Seats are `{ id: randomId(), name: '', colorIndex }`. Add actions:
  - `setHeadcount(n)`: pad with empty seats up to `n`; shrink only by dropping trailing EMPTY seats; never below `max(2, namedCount)`; cap 20 (server `session_full`).
  - `setPersonName(id, name)` (or reuse `addPerson` for the scanner's own name: first person gets the name, rest are seats).
- `guestCount` is not needed as persisted state; it only seeds `setHeadcount` after OCR. Persisted `people` carries the result. `partialize` already persists `people`. Persisted `version: 1` data stays valid (named people only), so no migration. Bump only if you later add persisted fields.
- `removePerson` stays for named-people removal on Setup (existing safe path).
- The Setup gate `canContinue = billScanned && people.length >= 2` currently counts only added people. New gate: scanned AND her name entered AND headcount >= 2. People array length is now the headcount, so the gate must check that the scanner's own seat is named (e.g. `people.some(p => !isEmptySeat(p))`).
- UI: −/+ counter replacing the people list; one name input labelled for herself. Counter clamps at min 2 and max 20. Optional: show hint "Pre-filled from receipt" when OCR supplied the count.

## 6. OCR `guestCount` field

Files: `app/api/ocr/route.ts` (modify), `components/wizard/SetupStep.tsx` (consume), `__tests__/ocrRoute.test.ts` and `__tests__/fixtures/ippudo-ocr-output.json` (update).

- Prompt: add a bullet, e.g. "guestCount (top level): the number of guests/covers/pax printed on the receipt (labels like Pax, Covers, Guests, Couverts, Kisi). null if not printed. Do not invent it. Do not use table numbers, check numbers, or item quantities."
- JSON schema (strict mode): add `guestCount: { type: ['integer', 'null'] }` to `properties` AND to the `required` list (strict mode requires every property to be listed; optionality is the null union), keeping `additionalProperties: false`.
- `OcrParsed`: add `guestCount: number | null`. `parseOcrResponse`: accept only an integer in `[1, 50]`, else null (hallucination guard). Cap on the client at 20.
- Response: `guestCount: best.guestCount ?? undefined` (matches the omit-when-null pattern of `taxCents`). Because `best` is whichever pass reconciled closer, `guestCount` flows with `best` automatically; no merge logic needed. Optionally prefer pass 1 value if pass 2 returns null.
- Client: in `handleFileChange` read `data.guestCount`; if valid, call `setHeadcount(clamp(guestCount, 2, 20))`; otherwise leave the default (2). Do not overwrite a headcount the user has already adjusted after a retake. Track a `headcountTouched` ref/flag if that matters, or simply re-prefill on every successful scan (simplest, and defensible).
- Risk: LLM misreads (a "table 12" read as 12 guests). Prefill is only a default and the counter is editable; empty seats are removable live. No server-side trust is placed on it.

## Component boundaries (new vs modified)

| File | Status | Change |
|---|---|---|
| `lib/seats.ts` | NEW | `isEmptySeat`, `seatLabel`, `seatInitial` helpers |
| `components/split/SeatManager.tsx` | NEW | Add seat / remove empty seat UI on Bill View |
| `app/api/session/[sessionId]/edit/route.ts` | MODIFIED | Add ops `claim_seat`, `add_seat`, `remove_seat` + 2 new Lua scripts, extend `VALID_OPS` and `validateOp` |
| `app/api/ocr/route.ts` | MODIFIED | `guestCount` prompt/schema/parse/response |
| `stores/useBillStore.ts` | MODIFIED | `setHeadcount`, seat-aware people actions |
| `components/wizard/SetupStep.tsx` | MODIFIED | Counter UI, own-name input, Continue gate, OCR prefill, pre-store identity in localStorage |
| `components/split/PersonSlotPicker.tsx` | MODIFIED | Empty-seat cards, inline claim-with-name, hide rename on empty |
| `components/split/IdentityModal.tsx` | MODIFIED | `onClaimSeat` prop, copy |
| `app/split/[sessionId]/CollaborativeClaimingView.tsx` | MODIFIED | `handleClaimSeat`, `handleAddSeat`, `handleRemoveSeat`, wire SeatManager |
| `components/split/BillViewHeader.tsx` | MODIFIED | Empty-seat circles, seat entry point |
| `components/split/PersonResultsScreen.tsx` | MODIFIED | `seatLabel`/`seatInitial`, Copy text, swipe guard |
| `components/split/ClaimableItemCard.tsx` | MODIFIED (minor) | Name helper |
| `lib/billMath.ts`, `lib/sessionSchema.ts`, `lib/createSession.ts`, claim/done/tip routes, `app/api/session/route.ts` | UNCHANGED | Verified: no change required |

## Data flow

```
Setup:  OCR guestCount -> setHeadcount(N) -> people = [me(named), seat x (N-1)]
        -> createSession(people[]) -> Redis session.people (names '' for seats)
        -> localStorage personId = me.id -> /split/[id] (skip modal)

Share link: GET session (SWR 3s) -> modal lists named + empty
        tap empty seat + type name -> POST /edit {op:'claim_seat'} -> Lua CAS
            OK -> adopt personId, close modal
            seat_taken (409) -> mutate(), "pick another"
        "I'm not listed" -> POST /edit {op:'add_person', name} (unchanged)

Live:   add_seat -> Lua append (cap 20)
        remove_seat -> Lua: name=='' AND no claims/slots/done/tips AND people>2 -> table.remove
        every device sees changes on the next 3s poll

Money:  computeEqualChargeShares(tax/fee, session.people)  // empty seats included
```

## Patterns to follow

- **Atomic field-level Lua for any concurrent mutation** (`ADD_PERSON_SCRIPT` / `RENAME_PERSON_SCRIPT` / `UPDATE_CURRENCY_SCRIPT` style): GET, pcall(cjson.decode), mutate one field, SET with `EX 86400`. Never use GET/mutate/SET in JS for these (the CR-01 clobber lesson). `redis.multi()` is not atomic on Upstash REST.
- **Return string status codes from Lua** and map them to HTTP codes in TS (`404`, `409`, `500`).
- **Normalise once** in `validateOp` and pass `normalizedName` to Lua (WR-05).
- **Derive, never store**: seat emptiness is derived from `name`, shares are derived at render time.

## Anti-patterns to avoid

- **A separate `seats[]` array or `isSeat` flag.** Creates two sources of truth and touches every consumer that iterates `people`.
- **Purging claims on remove.** That is exactly what got live remove-person descoped. Refuse instead of cleaning up.
- **Blind rename of an empty seat.** Always use the CAS op so concurrent claimants cannot overwrite each other.
- **Deriving "Seat N" from array index.** Shifts on removal.
- **Trusting `guestCount` blindly.** Clamp and keep it editable.
- **Rewriting `claims.*` in the new Lua.** cjson turns empty tables into `[]`; only touch `session.people`.

## Suggested build order (dependency driven)

1. **Foundations (no UI):** `lib/seats.ts`; store `setHeadcount`; tests for `computeEqualChargeShares` with `name: ''` people. Unblocks everything, near-zero risk.
2. **Server ops:** `add_seat`, `claim_seat`, `remove_seat` Lua + route branches + `validateOp`. Write route tests in `__tests__/editRoute.test.ts` style, and add a real Lua execution test for `remove_seat` and `claim_seat` (e.g. run the scripts against a Lua runtime/Redis in test or a minimal cjson-compatible harness). Include: concurrent double-claim, remove after claim, remove with claims, `claims.items == []` shape, the floor of 2 people. **This is the descope gate; do not ship `remove_seat` without it.**
3. **OCR `guestCount`:** prompt, schema, parse, response, test + fixture. Independent of 2, so it can run in parallel.
4. **Setup UI:** counter, own-name input, gate, OCR prefill, pre-store `personId`. Depends on 1 and 3.
5. **Identity modal / picker:** empty-seat cards, `claim_seat` wiring, 409 handling, "I'm not listed" kept. Depends on 1 and 2.
6. **Live seat management + display pass:** `SeatManager`, header strip, `PersonResultsScreen` copy and labels, `ClaimableItemCard` helper. Depends on 2 and 5.
7. **End-to-end check at 375px:** multi-device concurrent claim, empty seats in Results totals, expiry path.

## Scalability considerations

| Concern | Now | Note |
|---|---|---|
| Session size | <5KB with 20 seats | Seats add about 60 bytes each |
| Lua cost | O(items x people) in `remove_seat` scan | Trivial at 20 people |
| Poll load | 3s SWR | Unchanged |
| Concurrency | Single JSON blob per session | Whole-session read/write inside Lua is atomic per script; `/done` is still non-atomic (pre-existing WR-01), not worsened here |

## Open questions and risks

- `/done` is a non-atomic GET/SET and can clobber a concurrent Lua write to `people` (a `claim_seat` landing between its GET and SET would be lost). Window is tiny and pre-existing, but seat claims increase the number of people-array writes. Consider moving `done` to Lua as hardening in step 2 (MEDIUM priority).
- `/edit` generic ops (add/remove/edit item) also GET/SET the whole session and could clobber seat changes in the same window. Same pre-existing pattern; note it, do not fix this milestone unless testing shows trouble.
- Pre-storing the scanner's identity may interact with the G4 invite step and the `restoreAttempted` ref; verify in step 4.
- Minimum people floor (2) is a recommendation. The requirement does not state it explicitly; confirm with the product owner.
- Empty-seat tax share impact is a product consequence the team has accepted ("pay an equal share"); the discoverability of the remove control is the only mitigation since there is no nudge by design.

## Sources

- Code read directly: `app/api/session/[sessionId]/edit/route.ts`, `claim/route.ts`, `done/route.ts`, `app/api/session/route.ts`, `app/api/ocr/route.ts`, `lib/billMath.ts`, `lib/sessionSchema.ts`, `lib/createSession.ts`, `stores/useBillStore.ts`, `components/wizard/SetupStep.tsx`, `components/split/IdentityModal.tsx`, `PersonSlotPicker.tsx`, `BillViewHeader.tsx`, `PersonResultsScreen.tsx`, `app/split/[sessionId]/CollaborativeClaimingView.tsx` (HIGH)
- `.planning/PROJECT.md` (milestone scope and decisions) (HIGH)
- Upstash `redis.multi()` non-atomicity: from existing code comments (RESEARCH Pitfall 1), not re-verified this session (MEDIUM)
