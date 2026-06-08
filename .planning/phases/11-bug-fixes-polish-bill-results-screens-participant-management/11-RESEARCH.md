# Phase 11: Bug Fixes & Polish — Bill/Results Screens + Participant Management - Research

**Researched:** 2026-06-09
**Domain:** Redis Lua atomics, React component polish, participant management, Next.js App Router
**Confidence:** HIGH — all findings verified against actual codebase source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Remove the Receipt button entirely from `BillViewHeader.tsx`. Image is not persisted to shared session; proper receipt-for-all requires deferred server-side storage phase.
- **D-02:** Enlarge the Share button to a proper ≥44px tap target. Give it real presence (larger icon + padded hit area).
- **D-03:** On Results screen, when bill is not fully claimed, show an "Unclaimed items" section at the top listing items still needing an owner. Reuse `getUnclaimedCounts()` logic.
- **D-04:** Replace unconditional "You're all set!" headline with a playful message when items remain unclaimed (e.g. "Hold up — N item(s) are still up for grabs!"). Keep positive copy for fully-claimed case.
- **D-05:** Add `remove_person` and `rename_person` ops to `/edit` route. Neither exists today.
- **D-06:** Removing a person frees their claimed items back to unclaimed. Do NOT block removal when a person has claims.
- **D-07:** Anyone can remove or rename anyone — flat no-lock model. Writes go to shared Redis session.
- **D-08:** Promote "Add a tip" to a prominent button (current: faint underlined text link).
- **D-09:** Remove the currency-change `<select>` from Results screen. OCR-detected symbol still displays. Keep `update_currency` server op (do not delete — just remove the client UI).

### Claude's Discretion
- Exact playful copy for the unclaimed-state message (within playful tone from D-04).
- Visual styling/exact placement of enlarged Share button, tip button, and remove/rename affordances — follow existing app patterns.
- Where remove/rename controls live in the UI (e.g. on the people list / identity area).

### Deferred Ideas (OUT OF SCOPE)
- Receipt viewing for all participants (requires server-side image storage).
- Currency correction control re-introduction.
</user_constraints>

---

## Summary

This phase is surgical polish and small feature additions on three existing screens. There are no new subsystems, routes, or data schemas introduced beyond two new Lua op strings. The heaviest engineering work is the `remove_person` Lua script, which must purge a person's footprint across four separate nested keys in a single atomic Redis eval. Every other change is UI-only or a straightforward extension of established patterns already in the codebase.

The most important pitfall is the cjson empty-table-as-array quirk: in Lua, an empty table `{}` serializes as `[]` via `cjson.encode`. The existing codebase already handles this correctly by deleting empty sub-keys rather than leaving empty tables in place (see `QTY_CLAIM_SCRIPT` lines 56–59 and `SHARE_CLAIM_SCRIPT` lines 94–97 in `claim/route.ts`). The new `remove_person` script must follow the same discipline for `claims.items[itemId]` (after removing a person's entry from each item), and also for `claims.items` itself if all entries are removed.

The self-removal edge case is the most nuanced UX concern: when the viewer's own `selectedPersonId` is removed from `session.people` by SWR poll, the current guard at `CollaborativeClaimingView.tsx:542` (`if (!me) return <SessionExpiredScreen />`) would incorrectly render a "session expired" screen. This must be replaced with identity modal re-open logic.

**Primary recommendation:** Mirror the `ADD_PERSON_SCRIPT` / `UPDATE_CURRENCY_SCRIPT` Lua pattern for both new ops, apply the empty-table cleanup discipline already established in `claim/route.ts`, and handle self-removal at the SWR-poll level in `CollaborativeClaimingView`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Receipt button removal | Frontend component | — | Pure JSX deletion in `BillViewHeader.tsx` |
| Share button enlargement | Frontend component | — | Tailwind class change + aria-label preservation |
| `remove_person` Lua op | API / Backend | Database / Storage | Atomic footprint purge requires Lua on Redis |
| `rename_person` Lua op | API / Backend | Database / Storage | Atomic field-level update on Redis session |
| Remove/rename UI controls | Frontend component | — | Lives in `PersonSlotPicker` inside `IdentityModal` |
| Self-removal detection | Frontend component | — | SWR poll diff → identity modal re-open |
| Unclaimed section on Results | Frontend component | — | Reads `session.claims.items` already in SWR cache |
| Conditional Results headline | Frontend component | — | Pure render-time conditional on unclaimed count |
| Tip button prominence | Frontend component | — | Tailwind class change; `onAddTip` prop already wired |
| Currency select removal | Frontend component | — | Delete JSX block; server op stays intact |

---

## Standard Stack

No new dependencies. All implementation uses packages already in `package.json`.

### Core (already installed)
| Library | Version | Purpose | Relevant to this phase |
|---------|---------|---------|------------------------|
| Next.js | ^16.2.6 | App Router + Route Handlers | `/edit` route extension |
| React | ^19.2.0 | UI | Component edits |
| TypeScript | ^5.9.3 | Type safety | New op types in `VALID_OPS` |
| Tailwind CSS | ^4.2.4 | Utility CSS | Share button, tip button, remove/rename UI |
| shadcn/ui | latest | Dialog, Button, Input, Card | Remove/rename affordances in IdentityModal |
| @upstash/redis | ^1.38.0 | Redis Lua eval | New Lua scripts |
| swr | ^2.4.1 | Session polling | Self-removal detection on poll |
| lucide-react | ^1.14.0 | Icons | Share2 (enlarged), Trash2/X (remove), Pencil (rename) |
| vitest | ^4.1.5 | Tests | Route and component tests |

**Installation:** No new packages needed.

---

## Package Legitimacy Audit

No new packages in this phase. Section not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
BillViewHeader.tsx
  [Receipt button] ──DELETE──>  (removed)
  [Share button] ──RESTYLE──>  ≥44px tap target with icon+label

PersonSlotPicker.tsx (inside IdentityModal)
  [person list cards] ──ADD──>  [remove icon] [rename inline input]
      |                                |
      v                                v
  onRemovePerson(personId)        onRenamePerson(personId, newName)
      |                                |
      v                                v
  POST /edit {op:'remove_person'}  POST /edit {op:'rename_person'}
      |                                |
      v                                v
  REMOVE_PERSON_SCRIPT (Lua)       RENAME_PERSON_SCRIPT (Lua)
  atomic: purge people[], claims.items[*][personId],
          claims.personSlots[personId], claims.donePeople[personId], tips[personId]
      |
      v
  SWR mutate() → all clients pick up new session state

CollaborativeClaimingView.tsx (SWR 3s poll)
  session.people.find(p => p.id === selectedPersonId)
      |── found ──> normal claiming view
      |── NOT found + was valid before ──> setIdentityModalOpen(true)  [SELF-REMOVAL FIX]
      |── error ──> SessionExpiredScreen  [only for 404]

PersonResultsScreen.tsx
  getUnclaimedCounts(session) ──> if unclaimed > 0:
      | ──> "Unclaimed items" section at top
      | ──> playful headline
      |── fully claimed ──> "You're all set!" headline
  [currency <select>] ──DELETE──>  (removed; currencyCode prop still read for formatCents)
  ["Add a tip?" link] ──RESTYLE──>  prominent Button
```

### Recommended Project Structure

No structural changes — all modifications are to existing files.

```
app/api/session/[sessionId]/edit/route.ts   ← +remove_person, +rename_person ops
components/split/BillViewHeader.tsx          ← D-01 remove Receipt, D-02 enlarge Share
components/split/PersonSlotPicker.tsx        ← D-05/07 remove/rename affordances
components/split/PersonResultsScreen.tsx     ← D-03/04 unclaimed section, D-08 tip btn, D-09 remove currency
app/split/[sessionId]/CollaborativeClaimingView.tsx  ← self-removal handler + new prop wiring
__tests__/editRoute.test.ts                  ← new tests for remove_person, rename_person
__tests__/BillViewHeader.test.tsx            ← update: remove Test 7 (receipt), add share size test
__tests__/PersonSlotPicker.test.tsx          ← add remove/rename UI tests
__tests__/PersonResultsScreen.test.tsx       ← add unclaimed section, headline, tip btn tests
```

---

## Critical Implementation Details

### 1. `remove_person` Lua Script

**[VERIFIED: source code — claim/route.ts, edit/route.ts]**

The script must purge a person from four locations atomically:

```lua
-- REMOVE_PERSON_SCRIPT
-- ARGV[1] = personId to remove
-- Returns: 'OK' | 'session_not_found' | 'invalid_session' | 'person_not_found'

local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

local personId = ARGV[1]

-- 1. Remove from session.people[]
if not session.people then session.people = {} end
local found = false
local newPeople = {}
for _, p in ipairs(session.people) do
  if p.id == personId then
    found = true
  else
    table.insert(newPeople, p)
  end
end
if not found then return 'person_not_found' end
session.people = newPeople

-- 2. Purge claims.items[*][personId] (free their item claims back to unclaimed)
if session.claims and session.claims.items then
  for itemId, claimants in pairs(session.claims.items) do
    if type(claimants) == 'table' then
      claimants[personId] = nil
      -- cjson quirk: empty Lua table encodes as [] not {} — delete empty item entries
      local hasAny = false
      for _ in pairs(claimants) do hasAny = true; break end
      if not hasAny then session.claims.items[itemId] = nil end
    end
  end
  -- Also clean up claims.items itself if now empty
  local hasItems = false
  for _ in pairs(session.claims.items) do hasItems = true; break end
  if not hasItems then session.claims.items = {} end
end

-- 3. Remove claims.personSlots[personId]
if session.claims and session.claims.personSlots then
  session.claims.personSlots[personId] = nil
end

-- 4. Remove claims.donePeople[personId]
if session.claims and session.claims.donePeople then
  session.claims.donePeople[personId] = nil
end

-- 5. Remove tips[personId]
if session.tips then
  session.tips[personId] = nil
end

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
```

**cjson empty-table quirk — is it benign?** [VERIFIED: source code]

The existing TS readers all use safe-access patterns:
- `session.claims?.items?.[itemId] ?? {}` — the `?? {}` handles `undefined`, not `[]`
- `Object.values(entries).reduce(...)` — if `entries` is an empty array `[]` from cjson, `Object.values([])` returns `[]` which reduces to 0. **This is safe.**
- `session.claims?.items?.[personId]` — if cjson encodes an empty claims.items as `[]`, TypeScript's `?.[personId]` on an array returns `undefined`, which `?? {}` handles. **This is safe.**

The empty-cleanup strategy (delete the sub-key rather than leave an empty table) that the existing scripts use is correct and should be followed in `remove_person` as well. The concern is **not** a bug risk but follows the established codebase convention.

### 2. `rename_person` Lua Script

**[VERIFIED: source code — edit/route.ts ADD_PERSON_SCRIPT pattern]**

```lua
-- RENAME_PERSON_SCRIPT
-- ARGV[1] = personId to rename
-- ARGV[2] = new name (already trimmed and validated in TypeScript)
-- Returns: 'OK' | 'session_not_found' | 'invalid_session' | 'person_not_found'

local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

local personId = ARGV[1]
local newName = ARGV[2]

if not session.people then return 'person_not_found' end
local found = false
for _, p in ipairs(session.people) do
  if p.id == personId then
    p.name = newName
    found = true
    break
  end
end
if not found then return 'person_not_found' end

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
```

**Validation rules (mirror `add_person`):** trim, non-empty, ≤50 chars. [VERIFIED: edit/route.ts:82-91]

**Does rename need to be atomic?** Yes — same reason as `add_person`. A GET→mutate→SET would create a race window where a concurrent claim write could clobber the rename. The Lua pattern is the right choice.

### 3. `validateOp` extensions

Add two new branches to `validateOp` in `edit/route.ts`. **[VERIFIED: source code pattern]**

```typescript
if (op === 'remove_person') {
  if (typeof b.personId !== 'string' || b.personId.length === 0)
    return { ok: false, error: 'Invalid remove_person: personId must be a non-empty string' }
  return { ok: true }
}

if (op === 'rename_person') {
  if (typeof b.personId !== 'string' || b.personId.length === 0)
    return { ok: false, error: 'Invalid rename_person: personId must be a non-empty string' }
  if (typeof b.newName !== 'string')
    return { ok: false, error: 'Invalid rename_person: newName must be a string' }
  const trimmed = b.newName.trim()
  if (trimmed.length === 0)
    return { ok: false, error: 'Invalid rename_person: newName must be a non-empty string' }
  if (trimmed.length > 50)
    return { ok: false, error: 'Invalid rename_person: newName must be 50 characters or fewer' }
  return { ok: true, normalizedName: trimmed }
}
```

Add `'remove_person'` and `'rename_person'` to `VALID_OPS`:
```typescript
const VALID_OPS = ['add', 'remove', 'edit_price', 'edit_name', 'edit_quantity', 'add_person', 'update_currency', 'remove_person', 'rename_person'] as const
```

The `remove_person` and `rename_person` branches in the POST handler both go BEFORE the `try { const session = await redis.get(...)` block (same pattern as `add_person` and `update_currency`).

### 4. Self-Removal Edge Case

**[VERIFIED: CollaborativeClaimingView.tsx:541-542]**

Current code at line 541-542:
```typescript
const me = session.people.find((p) => p.id === selectedPersonId)
if (!me) return <SessionExpiredScreen />
```

This guard was written assuming `!me` means the session has expired. After Phase 11, `!me` can also mean someone removed the current user. The fix must distinguish these two cases.

**The correct approach:** Add a secondary effect (or extend the existing SWR-poll-driven identity restore effect) that watches `session.people` for removal of the current `selectedPersonId`.

```typescript
// Add a separate effect that watches for self-removal during active sessions
// This fires on every SWR refresh (3s) when selectedPersonId is not null
useEffect(() => {
  if (!session || selectedPersonId === null) return
  const stillPresent = session.people.some((p) => p.id === selectedPersonId)
  if (!stillPresent) {
    // Person was removed — clear identity and re-open modal (not session expired)
    setSelectedPersonId(null)
    // Clear localStorage so the restore effect doesn't re-select the removed id
    try { localStorage.removeItem(`split:${sessionId}:personId`) } catch { /* ignore */ }
    setChangingIdentity(false)
    setIdentityModalOpen(true)
  }
}, [session, selectedPersonId, sessionId])
```

**Why this is safe:**
- The existing `restoreAttempted` ref is `true` by the time a self-removal can happen (session was already loaded once). The restore effect checks `restoreAttempted.current` so it won't fire again.
- Clearing `localStorage` before opening the modal ensures the restore path doesn't re-select the now-removed personId.
- Setting `selectedPersonId(null)` means the `!me` guard at line 542 will no longer be reached during the render cycle — the identity modal renders first.
- The `SessionExpiredScreen` should only appear for `error instanceof SessionNotFoundError` (line 153), which is the correct scope.

**The `!me` guard at line 542 should be kept** as a safety net for truly unexpected cases (stale local state), but it should no longer be the primary handler for the self-removal case.

### 5. Unclaimed Detection Reuse for Results Screen

**[VERIFIED: CollaborativeClaimingView.tsx:56-64, UnclaimedBanner.tsx:10-21]**

`getUnclaimedCounts()` is currently defined in two places:
- `CollaborativeClaimingView.tsx` (lines 56-64) — used for `handleDone` warning and `UnclaimedBanner` prop
- `UnclaimedBanner.tsx` (lines 10-21) — internal, private to that component

**Recommendation for D-03:** Rather than adding a third copy inside `PersonResultsScreen.tsx`, extract `getUnclaimedCounts` to `lib/sessionSchema.ts` or a new `lib/sessionUtils.ts` and import it from `PersonResultsScreen` and the existing callers. This eliminates drift risk.

If the planner prefers minimal churn, an inline copy inside `PersonResultsScreen.tsx` is also acceptable — the function is small (7 lines) and changes rarely.

**The unclaimed items list** (for D-03's "show which items") requires iterating `session.items` and filtering to those where `totalClaimed < item.quantity`. This is the same traversal as `getUnclaimedCounts`, extended to return the item objects:

```typescript
function getUnclaimedItems(session: SessionPayload): Item[] {
  return session.items.filter((item) => {
    const entries = session.claims?.items?.[item.id] ?? {}
    const totalClaimed = Object.values(entries).reduce((sum, e) => sum + (e?.qty ?? 0), 0)
    return totalClaimed < (item.quantity ?? 1)
  })
}
```

### 6. Remove/Rename UI Location

**[VERIFIED: IdentityModal.tsx, PersonSlotPicker.tsx]**

The CONTEXT.md (decisions) confirms: "UX: controls live in the 'Who are you?' / change-identity people modal." This means the remove/rename affordances belong in `PersonSlotPicker.tsx`, which renders inside `IdentityModal`.

The `PersonSlotPicker` currently renders a 2-column grid of `Card` buttons. To add remove/rename:

**Per-card controls (small icon buttons inside each card):**
- A `Trash2` or `X` icon for remove (small, secondary visual weight)
- A `Pencil` icon or inline edit-on-tap for rename
- These must NOT interfere with the existing "tap card to select identity" behavior

**Inline rename approach (mirrors `CollaborativeClaimingView` inline item edit):**
- Tap Pencil icon → card switches to inline `Input` + confirm/cancel buttons
- Submit calls `onRenamePerson(personId, newName)`

**PersonSlotPicker props extension:**
```typescript
interface PersonSlotPickerProps {
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => void | Promise<void>
  onAddPerson?: (name: string) => Promise<void>
  onRemovePerson?: (personId: PersonId) => Promise<void>    // NEW
  onRenamePerson?: (personId: PersonId, newName: string) => Promise<void>  // NEW
}
```

**Handlers in `CollaborativeClaimingView`:**
```typescript
async function handleRemovePerson(personId: PersonId) {
  const res = await fetch(`/api/session/${sessionId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'remove_person', personId }),
  })
  if (!res.ok) { /* show error */ return }
  await mutate()
  // Self-removal is handled by the SWR-poll effect added in §4
}

async function handleRenamePerson(personId: PersonId, newName: string) {
  const res = await fetch(`/api/session/${sessionId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'rename_person', personId, newName }),
  })
  if (!res.ok) { /* show error */ return }
  await mutate()
}
```

These handlers get passed through `IdentityModal` → `PersonSlotPicker` as new optional props.

### 7. PersonResultsScreen Props Interface Change

`PersonResultsScreen` currently requires `onCurrencyChange: (code: string) => Promise<void>` (D-09 removes the UI but this prop remains). Two options:

**Option A (cleanest):** Remove `onCurrencyChange` from props entirely, since no UI in the component calls it after D-09.

**Option B (safe):** Mark it optional (`onCurrencyChange?: ...`) so existing callers don't break.

**Recommendation: Option A.** The `update_currency` server op is explicitly preserved (D-09 says "do not necessarily delete the server op"), but the TS prop and all call sites in `PersonResultsScreen.tsx` can be removed. `CollaborativeClaimingView.tsx` will also need to remove the `onCurrencyChange` prop pass-through. This is a clean forward step.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic Redis field update | GET→mutate in JS→SET | Lua `redis.eval` | Race window between GET and SET loses concurrent writes |
| Empty-object safety in Lua | Leave empty `{}` in session | Delete the sub-key | cjson encodes empty Lua table as `[]`, breaking TS `Record<>` reads |
| Inline edit state | Custom state machine | Mirror existing `inlineForm` pattern in CollaborativeClaimingView | Pattern is proven, tested, handles error/cancel/submit |
| Tap target sizing | Custom touch handler | Tailwind `min-h-[44px] min-w-[44px]` + padding | Native touch target via CSS — no JS needed |

---

## Common Pitfalls

### Pitfall 1: cjson encodes empty Lua table as array, not object
**What goes wrong:** After removing the last person's claim from `claims.items[itemId]`, leaving the empty table in place causes cjson to write `{"items":{"i1":[]}}` instead of `{"items":{}}`. TypeScript's `Object.values(entries)` on an array returns the values (harmless for `.reduce`), but `entries[personId]` on an array is `undefined`, which the `?? {}` guard handles. **Net verdict: benign with current TS readers BUT violates the established codebase convention.** Always delete empty sub-keys. **[VERIFIED: claim/route.ts lines 56-59, 94-97]**

### Pitfall 2: Concurrent remove + add race
**What goes wrong:** Two requests land simultaneously: `add_person` appends a new person, `remove_person` reads the session before the add commits. One write overwrites the other.
**Why it happens:** Both ops use Lua (atomic per-operation), but they are independent transactions. Lua atomicity is per-script, not cross-script.
**How to avoid:** This is inherent to last-write-wins Redis ops. The risk is low (rare concurrent exact-overlap) and consistent with the existing behavior for `add_person` + `add_person` races. No special handling needed; document as accepted behavior. **[ASSUMED]**

### Pitfall 3: Self-removal renders SessionExpiredScreen
**What goes wrong:** SWR poll returns session where the viewer's personId is no longer in `session.people`. The guard `if (!me) return <SessionExpiredScreen />` fires incorrectly.
**Why it happens:** The original guard assumed `!me` == session 404. Phase 11 adds a removal path.
**How to avoid:** Add a dedicated effect (§4 above) that watches `session.people` for self-removal and re-opens the identity modal instead. **[VERIFIED: CollaborativeClaimingView.tsx:541-542]**

### Pitfall 4: Removing a person who is currently in the `doing an inline rename` state in another user's UI
**What goes wrong:** User A has Person B's card in edit/rename mode locally. User B (or User C) removes Person B from the server. On next SWR poll, the person disappears from the list — but the local `editingPersonId` state in `PersonSlotPicker` still points to the removed personId.
**How to avoid:** The inline rename state in `PersonSlotPicker` is local component state. On SWR refresh, the people list re-renders from `session.people`, which no longer contains Person B. The editing card simply won't render since it's keyed off the person. Clear the `editingPersonId` state if the person being edited is no longer in `session.people`. **[ASSUMED]**

### Pitfall 5: `person_not_found` from remove/rename when session is stale
**What goes wrong:** Two users try to remove the same person. The second one's Lua script finds the person already gone and returns `person_not_found`.
**How to avoid:** The client should treat `person_not_found` as a soft error (not an error toast) — the desired end state (person is gone) is already achieved. Log and call `mutate()` to sync state. **[ASSUMED]**

### Pitfall 6: Receipt button test (Test 7 in BillViewHeader.test.tsx) must be deleted
**What goes wrong:** `BillViewHeader.test.tsx` Test 7 asserts `getByLabelText('View receipt')` is present. After D-01 removes the button, this test will fail.
**How to avoid:** Delete or update Test 7 when removing the receipt button. Also update the import (line 4: `{ Receipt, Share2, Copy, Check }` in `BillViewHeader.tsx`) to remove `Receipt`. **[VERIFIED: BillViewHeader.test.tsx:117-128, BillViewHeader.tsx:4]**

### Pitfall 7: `onCurrencyChange` prop removal cascades to CollaborativeClaimingView
**What goes wrong:** If `PersonResultsScreen` no longer declares `onCurrencyChange`, `CollaborativeClaimingView.tsx`'s `phase === 'results'` branch (lines 553-577) will have a TypeScript error for the prop it passes.
**How to avoid:** Remove the prop from `PersonResultsScreen` interface and the pass-through in `CollaborativeClaimingView` in the same task. Run `npx tsc --noEmit` to verify. **[VERIFIED: CollaborativeClaimingView.tsx:559]**

### Pitfall 8: `IdentityModal` does not pass new props to `PersonSlotPicker`
**What goes wrong:** `IdentityModal.tsx` currently renders `<PersonSlotPicker session={session} onSelect={onSelect} onAddPerson={onAddPerson} />`. If `onRemovePerson` and `onRenamePerson` are added to `PersonSlotPicker` but not threaded through `IdentityModal`, they won't fire.
**How to avoid:** `IdentityModal` must accept and forward the two new optional props. Update `IdentityModalProps` interface. **[VERIFIED: IdentityModal.tsx:21-29, 66-72]**

---

## Code Examples

### Existing Lua eval dispatch pattern to mirror
```typescript
// Source: edit/route.ts — add_person branch (lines 208-236)
if (op === 'add_person') {
  const validation = validateOp('add_person', b, {} as SessionPayload)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const trimmedName = validation.normalizedName ?? ''
  try {
    const newPersonId = nanoid()
    const result = await redis.eval(ADD_PERSON_SCRIPT, [`session:${sessionId}`], [trimmedName, newPersonId])
    if (result === 'session_not_found') return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    if (result === 'session_full') return NextResponse.json({ error: 'Session is full (max 20 people)' }, { status: 409 })
    if (result === 'invalid_session') return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
    return NextResponse.json({ ok: true, personId: newPersonId })
  } catch (err) {
    console.error('Edit error:', err)
    return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
  }
}
```

### Existing cjson empty-cleanup pattern to mirror in remove_person
```lua
-- Source: claim/route.ts QTY_CLAIM_SCRIPT (lines 55-59)
-- cjson encodes empty Lua tables as []. Strategy: delete empty item key entirely.
local hasAny = false
for _ in pairs(session.claims.items[itemId]) do hasAny = true; break end
if not hasAny then session.claims.items[itemId] = nil end
```

### Existing SWR mutate pattern for edit writes
```typescript
// Source: CollaborativeClaimingView.tsx handleDeleteItem (lines 499-521)
const res = await fetch(`/api/session/${sessionId}/edit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ op: 'remove', itemId }),
})
if (!res.ok) { console.error('Delete failed:', res.status); return }
await mutate()
```

### Share button — current (to change)
```tsx
// Source: BillViewHeader.tsx lines 128-139
<button
  type="button"
  aria-label="Share bill link"
  onClick={handleShare}
  className="text-zinc-500 hover:text-zinc-700 transition-colors"
>
  {copied ? <Check size={22} /> : <Share2 size={22} />}
</button>
// Target: min-h-[44px] min-w-[44px] with flex+center, icon larger, maybe text label
```

### Tip button — current (to change)
```tsx
// Source: PersonResultsScreen.tsx lines 276-283
<button
  type="button"
  onClick={onAddTip}
  className="text-[14px] text-amber-600 underline self-start"
>
  Add a tip?
</button>
// Target: use shadcn <Button> with variant and amber-600 background or outline styling
```

### Currency select — current (to delete)
```tsx
// Source: PersonResultsScreen.tsx lines 259-274
<div className="flex items-center gap-2 text-[14px] text-zinc-500">
  <label htmlFor="currency-select" className="shrink-0">Currency:</label>
  <select
    id="currency-select"
    value={currencyCode}
    onChange={(e) => void handleCurrencyChange(e.target.value)}
    className="rounded border border-border bg-background px-2 py-1 text-[14px] text-foreground"
  >
    {currencyOptions.map((code) => <option key={code} value={code}>{code}</option>)}
  </select>
</div>
// Also delete: handleCurrencyChange function, COMMON_CURRENCIES constant, currencyOptions derivation
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `GET→mutate→SET` for person ops | Lua `redis.eval` atomic | Phase 9 (add_person), Phase 10 (update_currency) | New ops must follow Lua pattern |
| Greyed-out "taken" slots | All names always selectable | Phase 9 GAP-09-NOLOCK | Remove/rename must not re-introduce locking |
| Wizard multi-step flow | Single-page collaborative claiming | Phase 9 | No multi-step state needed for participant mgmt |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Concurrent remove+add race is low-risk and accepted behavior | Pitfall 2 | If race causes data loss in prod, may need cross-script guard (complex) |
| A2 | Removing a person whose card is being inline-renamed by another client is handled by React re-render from SWR | Pitfall 4 | If editingPersonId state persists post-removal, stale UI appears |
| A3 | `person_not_found` should be treated as soft success by client | Pitfall 5 | If surfaced as error toast, UX is confusing on concurrent remove |

**All critical implementation details (Lua scripts, self-removal fix, cjson behavior) are VERIFIED from source code.**

---

## Open Questions

1. **Should `getUnclaimedCounts` be extracted to `lib/`?**
   - What we know: It exists in two files today with identical implementations.
   - What's unclear: Whether the planner prefers a light refactor task (extract to lib) or an inline copy in PersonResultsScreen.
   - Recommendation: Extract to `lib/sessionUtils.ts` — three consumers (CollaborativeClaimingView, UnclaimedBanner, PersonResultsScreen) justify it. But an inline copy is acceptable if churn risk is a concern.

2. **Should `remove_person` be blocked if the person is the last one?**
   - What we know: The `/edit` route has no minimum-people guard today (only a maximum-20 guard in add_person).
   - What's unclear: Whether removing the last person should be allowed (leaving a 0-person session in Redis).
   - Recommendation: Block if `session.people.length <= 1` — a 0-person session is semantically broken. Return a `'last_person'` error code (409 in the HTTP response). The client can show "Can't remove the only person."

3. **`ColorIndex` after remove — should remaining people's colorIndex be recomputed?**
   - What we know: `colorIndex = #session.people % 6` at add time (ADD_PERSON_SCRIPT line 62). It is a display-only value, not recomputed after any op today.
   - What's unclear: Whether a gap in colorIndex values (after removal) is visually noticeable.
   - Recommendation: Do NOT recompute — the `AVATAR_COLORS[colorIndex % 6]` lookup in UI is already modulo-safe and doesn't require contiguous indices. Recomputing would require updating all remaining people objects and risk confusing existing avatar chips mid-session.

---

## Environment Availability

Step 2.6: SKIPPED — this phase has no new external dependencies. All tools and services already confirmed available in prior phases (Upstash Redis, Vercel, Node.js runtime).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run __tests__/<file>.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Receipt button absent from DOM | unit (component) | `npx vitest run __tests__/BillViewHeader.test.tsx` | ✅ (update Test 7) |
| D-02 | Share button has ≥44px tap target | unit (component) | `npx vitest run __tests__/BillViewHeader.test.tsx` | ✅ (add test) |
| D-03 | Unclaimed section shows when items unclaimed | unit (component) | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ (add test) |
| D-04 | Playful headline when unclaimed; positive when fully claimed | unit (component) | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ (add test) |
| D-05 `remove_person` | Lua eval called; people[] purged; claims freed | unit (route) | `npx vitest run __tests__/editRoute.test.ts` | ✅ (add tests) |
| D-05 `rename_person` | Lua eval called; name updated | unit (route) | `npx vitest run __tests__/editRoute.test.ts` | ✅ (add tests) |
| D-05 validation | Empty/too-long name → 400; missing personId → 400 | unit (route) | `npx vitest run __tests__/editRoute.test.ts` | ✅ (add tests) |
| D-06 | Removing person with claims frees those claims | unit (route) | `npx vitest run __tests__/editRoute.test.ts` | ✅ (add test) |
| D-07 | Remove/rename UI affordances present in PersonSlotPicker | unit (component) | `npx vitest run __tests__/PersonSlotPicker.test.tsx` | ✅ (add tests) |
| D-08 | Add a tip is a Button element (not anchor/underline) | unit (component) | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ (add test) |
| D-09 | Currency `<select>` absent from DOM | unit (component) | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ (add test) |
| Self-removal | When viewer's personId removed from session, identity modal opens (not SessionExpiredScreen) | unit (component) | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ (add test) |
| `person_not_found` | remove_person for missing personId returns 404 or 409 | unit (route) | `npx vitest run __tests__/editRoute.test.ts` | ✅ (add test) |

### Sampling Rate
- **Per task commit:** `npx vitest run __tests__/<modified-file>.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. No new test files need to be created; all tests extend existing files.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Flat model — anyone can remove/rename anyone (D-07, by design) |
| V5 Input Validation | yes | `validateOp` in edit/route.ts: trim, non-empty, ≤50 chars (mirrors add_person) |
| V2 Authentication | no | No auth in this app |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Removing another user's person without authorization | Spoofing/Tampering | By design (D-07 flat model) — no auth in app, accepted |
| personId injection (removing items from other sessions) | Tampering | Lua script uses `KEYS[1]` = `session:${sessionId}` — cross-session access not possible |
| XSS via rename (injecting HTML in person name) | Tampering | React renders names as text nodes (JSX escape) — no `dangerouslySetInnerHTML` in person name rendering |
| Session enumeration via `person_not_found` | Information Disclosure | Low risk — sessionId is already known to the caller |

---

## Sources

### Primary (HIGH confidence — verified against source files)
- `/Users/ulgenayranci/playground/gsd-course/app/api/session/[sessionId]/edit/route.ts` — full ADD_PERSON_SCRIPT, UPDATE_CURRENCY_SCRIPT, validateOp pattern
- `/Users/ulgenayranci/playground/gsd-course/app/api/session/[sessionId]/claim/route.ts` — QTY_CLAIM_SCRIPT and SHARE_CLAIM_SCRIPT cjson empty-table cleanup
- `/Users/ulgenayranci/playground/gsd-course/app/split/[sessionId]/CollaborativeClaimingView.tsx` — SWR pattern, identity restore, getUnclaimedCounts, self-removal guard
- `/Users/ulgenayranci/playground/gsd-course/components/split/PersonResultsScreen.tsx` — current "You're all set!" headline, currency select, tip link
- `/Users/ulgenayranci/playground/gsd-course/components/split/BillViewHeader.tsx` — current Receipt + Share buttons
- `/Users/ulgenayranci/playground/gsd-course/components/split/PersonSlotPicker.tsx` — people list structure, onAddPerson pattern
- `/Users/ulgenayranci/playground/gsd-course/components/split/IdentityModal.tsx` — controlled Dialog wrapper, prop threading
- `/Users/ulgenayranci/playground/gsd-course/components/split/UnclaimedBanner.tsx` — getUnclaimedCounts implementation
- `/Users/ulgenayranci/playground/gsd-course/lib/sessionSchema.ts` — SessionClaims structure (items, personSlots, donePeople), Person model, tips
- `/Users/ulgenayranci/playground/gsd-course/__tests__/editRoute.test.ts` — test pattern for Lua ops (mockEval, callPOST helper)
- `/Users/ulgenayranci/playground/gsd-course/__tests__/BillViewHeader.test.tsx` — Test 7 that must be updated
- `/Users/ulgenayranci/playground/gsd-course/__tests__/PersonSlotPicker.test.tsx` — component test patterns
- `/Users/ulgenayranci/playground/gsd-course/__tests__/PersonResultsScreen.test.tsx` — component test patterns
- `/Users/ulgenayranci/playground/gsd-course/__tests__/CollaborativeClaimingView.test.tsx` — selectAlice() helper, SWR mock pattern
- `/Users/ulgenayranci/playground/gsd-course/.planning/phases/09-bill-view-redesign-identity-modal/09-PATTERNS.md` — Lua Redis eval, avatar colors, Dialog patterns
- `/Users/ulgenayranci/playground/gsd-course/.planning/phases/10-results-screen-tip-modal-currency-display/10-03-SUMMARY.md` — PersonResultsScreen architecture

---

## Metadata

**Confidence breakdown:**
- Lua script correctness: HIGH — verified by reading existing scripts and following established patterns
- Self-removal fix: HIGH — verified by reading CollaborativeClaimingView source and identifying exact guard location
- UI changes (Share, Tip, Currency): HIGH — verified by reading all three components
- Remove/rename UX placement: HIGH — confirmed by CONTEXT.md ("controls live in the people modal")
- cjson empty-table behavior: HIGH — verified by reading existing cleanup code in claim/route.ts

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (stable codebase; no fast-moving dependencies)
