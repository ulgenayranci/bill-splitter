---
phase: 11-bug-fixes-polish-bill-results-screens-participant-management
reviewed: 2026-06-09T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - app/api/session/[sessionId]/edit/route.ts
  - app/split/[sessionId]/CollaborativeClaimingView.tsx
  - components/split/BillViewHeader.tsx
  - components/split/IdentityModal.tsx
  - components/split/PersonResultsScreen.tsx
  - components/split/PersonSlotPicker.tsx
  - components/split/UnclaimedBanner.tsx
  - lib/sessionUtils.ts
  - __tests__/editRoute.test.ts
  - __tests__/BillViewHeader.test.tsx
  - __tests__/CollaborativeClaimingView.test.tsx
  - __tests__/PersonResultsScreen.test.tsx
  - __tests__/PersonSlotPicker.test.tsx
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-09
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 11 participant-management work: the two new atomic Lua ops
(`remove_person`, `rename_person`) on `/edit`, the inline remove/rename UI in
`PersonSlotPicker`, the self-removal `useEffect` in `CollaborativeClaimingView`,
Results-screen polish, and the `BillViewHeader` fix. Per the brief, the flat
no-auth model (anyone can rename/remove anyone, D-07) is intended and not flagged.

The headline concern is the Lua purge in `REMOVE_PERSON_SCRIPT`: it contradicts
its own documented "delete empty sub-keys rather than leave `{}`" discipline by
explicitly re-assigning `session.claims.items = {}` (CR-01), and it leaves
`personSlots`/`donePeople`/`tips` as cjson-`[]` arrays when their last key is
deleted (CR-02). These survive the defensive JS read paths today but corrupt the
stored shape and are latent foot-guns for any future server-side iteration. There
are also several robustness gaps in input validation and optimistic-update
ordering.

## Critical Issues

### CR-01: REMOVE_PERSON_SCRIPT re-assigns `claims.items = {}`, contradicting the cjson empty-table discipline it documents

**File:** `app/api/session/[sessionId]/edit/route.ts:117-121`
**Issue:**
The block comment at line 79 states the discipline is to "delete empty sub-keys
rather than leave `{}`", and the per-item cleanup (lines 111-114) correctly does
`session.claims.items[itemId] = nil`. But the outer cleanup does the exact opposite:

```lua
local hasItems = false
for _ in pairs(session.claims.items) do hasItems = true; break end
if not hasItems then session.claims.items = {} end
```

When the removed person was the last claimant of the last claimed item, every
item key has already been niled, so `session.claims.items` is already an empty
table. Re-assigning `= {}` is a no-op for the value but does **not** convert it to
an object — cjson encodes the empty Lua table as `[]`, not `{}`. The reference
implementation in `claim/route.ts` (lines 55-59) deliberately deletes keys and
never re-assigns an empty table for this reason. This is a direct deviation from
the established pattern the script claims to mirror.

**Fix:** Delete the lines entirely — they accomplish nothing useful and only
muddy intent. The item-level `= nil` cleanup already produces the correct empty
table:
```lua
-- (remove lines 117-121 entirely)
-- After the per-item loop, session.claims.items is already correctly empty.
```
If a canonical `{}` shape is required on the wire, follow `done/route.ts` and
normalize empties in the JS read layer rather than in Lua.

### CR-02: REMOVE_PERSON_SCRIPT leaves `personSlots`/`donePeople`/`tips` as cjson `[]` when their last key is deleted

**File:** `app/api/session/[sessionId]/edit/route.ts:123-136`
**Issue:**
Steps 3-5 delete `session.claims.personSlots[personId]`, `donePeople[personId]`,
and `tips[personId]` with `= nil`, but never apply the same empty-table guard the
script uses for `claims.items`. In a 2-person session where the removed person is
the only one who had claimed a slot / tapped done / left a tip, the corresponding
sub-table becomes empty and cjson re-encodes it as `[]` on `SET`.

On the next `cjson.decode` (in any later Lua op — slot claim, done, tip), the
field is now a Lua sequence. Subsequent code such as `SLOT_CLAIM_SCRIPT`
(`session.claims.personSlots[personId] = true`) and this script's own
`if session.tips then session.tips[personId] = nil end` mutate it by string key,
which silently re-objectifies it — so it self-heals on the next write. But until
that next write, the stored payload's shape is `Record` typed in
`sessionSchema.ts` yet serialized as a JSON array, and TS consumers like
`session.tips?.[selectedPersonId]` (`CollaborativeClaimingView.tsx:592`) and
`session.tips?.[personId]` (`PersonResultsScreen.tsx:147`) are reading an array by
string key. They survive only because of the `?.` / `?? 0` defenses; this is
accidental safety, not designed correctness, and it is the same class of bug the
`claims.items` guard exists to prevent.

**Fix:** Apply the same delete-when-empty guard the script already uses for items,
or (preferred, less Lua) leave the keys and normalize in the JS layer. Minimal Lua
guard mirroring the items cleanup:
```lua
-- after step 3 (personSlots), step 4 (donePeople), step 5 (tips), e.g.:
if session.claims.personSlots then
  session.claims.personSlots[personId] = nil
end
-- no empty re-assignment needed; an emptied sub-table will re-objectify on next
-- keyed write, BUT do NOT add `= {}` re-assignment (see CR-01).
```
The actionable change: confirm none of these sub-tables are ever re-assigned to
`{}`, and add a regression test that removes the only slot/done/tip holder and
asserts the decoded payload still has object-shaped `claims`/`tips` (the current
test suite mocks `eval` and never executes the Lua, so this path is untested).

## Warnings

### WR-01: `add` op accepts whitespace-only and over-length item names (validation asymmetry)

**File:** `app/api/session/[sessionId]/edit/route.ts:199-201, 256-259`
**Issue:**
`add_person` and `rename_person` correctly `.trim()` and enforce a 50-char cap,
but the item `add` and `edit_name` ops only check `b.name.length === 0` /
`b.newName.length === 0`. A name of `"   "` (length 3) passes, persisting a
blank-looking item; there is also no max length, so a multi-megabyte string is
accepted and stored (24h TTL, but still an unbounded write into the 256MB Upstash
quota). The client trims in `handleInlineSubmit` (line 475/488), but the route is a
public endpoint and must not rely on the client.

**Fix:** Mirror the `add_person` pattern:
```ts
if (typeof b.name !== 'string') return { ok: false, error: '...' }
const trimmed = b.name.trim()
if (trimmed.length === 0) return { ok: false, error: '...' }
if (trimmed.length > 100) return { ok: false, error: '...' }
return { ok: true, normalizedName: trimmed }
```
and persist `validation.normalizedName` for `add`/`edit_name` (the `add` branch at
line 449 currently writes the raw `b.name`).

### WR-02: `handleAddPerson` adopts identity after `mutate()`, racing the self-removal effect

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:199-209`
**Issue:**
The order is `await mutate()` then `setSelectedPersonId(data.personId)`. `mutate()`
revalidates and can resolve with a `session` snapshot that does **not** yet contain
the just-added person (the add and the GET race server-side; the comment at line
200 even assumes the new person "exists locally" but that is not guaranteed under
the 3s `refreshInterval` + immediate revalidate). If `selectedPersonId` is then
set to an id absent from `session.people`, the self-removal effect (lines 138-147)
fires on the next render, clears the identity, and re-opens the "Who are you?"
modal — bouncing the user who just added themselves back to the picker.

**Fix:** Set the identity first (it persists to localStorage via the effect at
98-106), then revalidate; the restore/self-removal effects already tolerate a
momentary mismatch because the subsequent poll will include the new person:
```ts
if (data.ok && data.personId) {
  setSelectedPersonId(data.personId as PersonId)
  setIdentityModalOpen(false)
  setChangingIdentity(false)
  await mutate() // revalidate after adopting identity
}
```
Better still, pass the optimistic person into `mutate(optimisticData)` so the new
id is present in `session.people` immediately.

### WR-03: `add` op missing `add` from the `normalizedName` persistence path lets raw name through

**File:** `app/api/session/[sessionId]/edit/route.ts:443-453`
**Issue:**
Even setting aside WR-01, the `add` branch writes `name: b.name as string`
verbatim. If WR-01 is fixed by trimming in `validateOp`, this branch must consume
`validation.normalizedName` or the trim is discarded — the same "drift out of
lockstep" hazard the code calls out for `add_person`/`rename_person` (WR-05
comments at lines 194, 237). Flagging so the two fixes stay coupled.

**Fix:** Thread `normalizedName` through to the `add` write path, identical to the
`add_person`/`rename_person` handling.

### WR-04: `parseInt(inlineForm.qty, 10) || 1` silently coerces invalid quantity input

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:483, 494`
**Issue:**
Add path uses `Math.max(1, parseInt(inlineForm.qty, 10) || 1)` and edit path uses
`Math.max(1, Math.min(99, parseInt(inlineForm.qty, 10) || 1))`. A user typing
`"abc"` or clearing the field yields `NaN || 1 → 1` with no feedback — the form
silently submits qty 1 rather than surfacing a validation error like it does for
name and price. For a bill-splitting app where quantity drives per-share math, a
silent default is a correctness foot-gun (user intended 2, gets 1).

**Fix:** Validate explicitly and show an inline error when the parsed quantity is
`NaN` or out of `[1, 99]`, matching the name/price error handling already present
a few lines above.

### WR-05: `formatBillDate` / date line produce "Invalid Date" with no guard on `createdAt`

**File:** `components/split/BillViewHeader.tsx:16-21, 54-61`
**Issue:**
`new Date(session.createdAt)` is rendered into the title and date line with no
validation. `createdAt` is `number` per the schema, but this component receives a
network-fetched `SessionPayload`; a malformed/legacy payload with a missing or
string `createdAt` renders the literal "Invalid Date" into the H1. Given the codebase
elsewhere goes out of its way to be defensive against malformed payloads (see the
explicit WR-02 guard rationale in `lib/sessionUtils.ts`), this is an inconsistent
gap on a user-visible header.

**Fix:**
```ts
const ts = typeof session.createdAt === 'number' ? session.createdAt : Date.now()
const d = new Date(ts)
// guard: if isNaN(d.getTime()) fall back to a neutral label
```

### WR-06: Rename/Remove tap targets overlap the full-card `onClick`, risking mis-selection on small screens

**File:** `components/split/PersonSlotPicker.tsx:97-134`
**Issue:**
The person `Card` is itself `role="button"` with `onClick={onSelect}` and
`min-h-[72px]`. The rename/remove controls are absolutely positioned 44x44 buttons
in the top-right corner of that same card. `stopPropagation` is correctly applied
(verified by Test 16), so a precise tap on the icon is safe. However two 44px
targets stacked in the corner of a ~150px-wide grid cell (`grid-cols-2`) heavily
overlap the card's own claim hit area; on a phone, a near-miss on the X icon lands
on the card and silently *selects that identity* instead of removing — a
destructive-intent tap producing the opposite, hard-to-notice result. This is a
UX-correctness concern, not a pure style nit.

**Fix:** Either move the rename/remove controls out of the clickable card (e.g., a
footer row below the avatar) or shrink the card's clickable region so the controls
sit in dead space. At minimum, the icon buttons should have an opaque background so
the boundary is visually obvious.

## Info

### IN-01: Dead/legacy header comment references removed "host" concept

**File:** `components/split/PersonSlotPicker.tsx:3-8`
**Issue:** The leading comment block extensively discusses host pre-locking, host
tokens, and "Host is NOT pre-locked", but the flat model removed the host concept
entirely (confirmed by tests asserting no host badge/FAB). The stale narrative is
misleading to future readers.
**Fix:** Trim the comment to the currently-relevant lines (GAP-09-NOLOCK + Phase 11
remove/rename) and drop the host history.

### IN-02: `handleRenamePerson` ignores 404 `person_not_found` soft-success unlike `handleRemovePerson`

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:249-264`
**Issue:** `handleRemovePerson` treats 404 as soft success (Pitfall 5, line 237-238).
`handleRenamePerson` does not — a rename of a concurrently-removed person just
`mutate()`s with no distinction. Harmless today (the self-removal effect handles the
removed case) but the inconsistency between the two sibling handlers invites future
confusion.
**Fix:** Either document why rename does not need the 404 carve-out, or apply the
same `res.status !== 404` guard for symmetry.

### IN-03: `console.error` calls remain in production client paths

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:404, 461, 465, 555, 560`
**Issue:** Several `console.error` calls ship in the client bundle. Not a defect, but
the project has no logging convention established and these leak internal failure
detail to the browser console. Low priority.
**Fix:** Route through a shared client logger or drop in production builds if a
convention is later adopted.

### IN-04: Lua purge path is entirely untested (eval is mocked)

**File:** `__tests__/editRoute.test.ts:354-402`
**Issue:** The remove_person tests mock `redis.eval` to return canned strings, so the
actual `REMOVE_PERSON_SCRIPT` Lua body — including the cjson empty-table behavior in
CR-01/CR-02 — is never executed. The most bug-prone code in this phase has zero
behavioral coverage. This is the direct reason CR-01/CR-02 escaped.
**Fix:** Add a Lua-execution test (e.g., against a local Redis or a Lua interpreter
harness) that removes the sole claimant/slot/tip holder and asserts the decoded
payload retains object-shaped `claims.items`, `personSlots`, `donePeople`, `tips`.

---

_Reviewed: 2026-06-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
