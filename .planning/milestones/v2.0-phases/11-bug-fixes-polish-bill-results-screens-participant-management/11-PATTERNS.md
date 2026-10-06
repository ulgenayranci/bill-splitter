# Phase 11: Bug Fixes & Polish — Bill/Results Screens + Participant Management - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 9 (all modify existing files — no greenfield)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/api/session/[sessionId]/edit/route.ts` | API route | request-response | self (ADD_PERSON_SCRIPT / UPDATE_CURRENCY_SCRIPT blocks) | exact |
| `app/split/[sessionId]/CollaborativeClaimingView.tsx` | orchestrator component | event-driven + request-response | self (handleAddPerson, identity-restore useEffect) | exact |
| `components/split/PersonSlotPicker.tsx` | UI component | event-driven | self ("I'm not listed" inline form) + inline edit Input pattern from CollaborativeClaimingView | exact |
| `components/split/IdentityModal.tsx` | modal wrapper | request-response | self (onAddPerson prop threading pattern) | exact |
| `components/split/PersonResultsScreen.tsx` | display component | CRUD | self (existing Button, conditional rendering, formatCents) | exact |
| `components/split/BillViewHeader.tsx` | display component | event-driven | self (Share button, icon sizing) | exact |
| `__tests__/editRoute.test.ts` | unit test | — | self (Tests 11-20: mockEval + callPOST pattern) | exact |
| `__tests__/BillViewHeader.test.tsx` | unit test | — | self (Tests 1-9: render + screen.getByLabelText pattern) | exact |
| `__tests__/PersonResultsScreen.test.tsx` | unit test | — | self (makeSession fixture + defaultProps pattern) | exact |
| `__tests__/PersonSlotPicker.test.tsx` | unit test | — | self (Tests 1-9: render + fireEvent pattern) | exact |
| `__tests__/CollaborativeClaimingView.test.tsx` | integration test | — | self (selectAlice helper + useSWRMock pattern) | exact |

---

## Pattern Assignments

### `app/api/session/[sessionId]/edit/route.ts` — add `remove_person` + `rename_person` ops

**Analog:** self — the existing `ADD_PERSON_SCRIPT` block and `UPDATE_CURRENCY_SCRIPT` block in the same file

#### VALID_OPS extension pattern (line 8)

The two new ops must be added to this const array so the guard at line 173 (`VALID_OPS as readonly string[]`) lets them through:

```typescript
// Current (line 8):
const VALID_OPS = ['add', 'remove', 'edit_price', 'edit_name', 'edit_quantity', 'add_person', 'update_currency'] as const

// Target:
const VALID_OPS = ['add', 'remove', 'edit_price', 'edit_name', 'edit_quantity', 'add_person', 'update_currency', 'remove_person', 'rename_person'] as const
```

#### Lua script constant pattern (lines 22-68)

Both new Lua scripts follow the identical JSDoc + template-literal structure. Copy the exact comment block style from `ADD_PERSON_SCRIPT` (lines 36-68):

```typescript
/**
 * REMOVE_PERSON_SCRIPT: Atomically purges a person from session.people and all claim
 * structures in a single redis.eval call. Prevents the race where a JS GET→mutate→SET
 * could clobber concurrent claim writes.
 *
 * ARGV[1] = personId to remove
 * Returns: 'OK' | 'session_not_found' | 'invalid_session' | 'person_not_found' | 'last_person'
 *
 * Mirrors ADD_PERSON_SCRIPT pattern. EX 86400 matches all other scripts in this file.
 * cjson empty-table discipline: delete empty sub-keys rather than leave {} (see claim/route.ts).
 */
const REMOVE_PERSON_SCRIPT = `
-- ... Lua body ...
`

/**
 * RENAME_PERSON_SCRIPT: Atomically updates a person's name in session.people.
 *
 * ARGV[1] = personId to rename
 * ARGV[2] = new name (already trimmed and validated in TypeScript before eval)
 * Returns: 'OK' | 'session_not_found' | 'invalid_session' | 'person_not_found'
 *
 * Mirrors ADD_PERSON_SCRIPT pattern. EX 86400 matches all other scripts in this file.
 */
const RENAME_PERSON_SCRIPT = `
-- ... Lua body ...
`
```

#### `validateOp` extension pattern (lines 80-92, 104-112)

The two new branches go inside `validateOp`, before the `itemId`-requiring ops block (line 115). Mirror the `add_person` branch for naming style and the `update_currency` branch for single-field validation:

```typescript
// Mirror of add_person branch (lines 80-92) — for rename_person name validation:
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

if (op === 'remove_person') {
  if (typeof b.personId !== 'string' || b.personId.length === 0)
    return { ok: false, error: 'Invalid remove_person: personId must be a non-empty string' }
  return { ok: true }
}
```

#### POST handler dispatch pattern (lines 180-236)

Both new ops go BEFORE the `try { const session = await redis.get(...)` block at line 238, mirroring the `update_currency` (lines 180-204) and `add_person` (lines 208-236) blocks exactly. The `add_person` block is the primary template:

```typescript
// Source: edit/route.ts lines 208-236 — the exact structure to copy for remove_person / rename_person:
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
    // result === 'OK'
    return NextResponse.json({ ok: true, personId: newPersonId })
  } catch (err) {
    console.error('Edit error:', err)
    return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
  }
}
```

For `remove_person`: ARGV array is `[b.personId as string]`. Return codes: `session_not_found` → 404, `person_not_found` → 404, `last_person` → 409, `invalid_session` → 500. Response: `{ ok: true }`.

For `rename_person`: use `validation.normalizedName` (same WR-05 pattern as `add_person`). ARGV array is `[b.personId as string, trimmedName]`. Return codes: `session_not_found` → 404, `person_not_found` → 404, `invalid_session` → 500. Response: `{ ok: true }`.

#### cjson empty-table cleanup pattern for Lua body

Source: `app/api/session/[sessionId]/claim/route.ts` QTY_CLAIM_SCRIPT lines 55-59 (referenced in RESEARCH.md). The `remove_person` Lua must apply this pattern after deleting a person's entry from each `claims.items[itemId]`:

```lua
-- After: claimants[personId] = nil
local hasAny = false
for _ in pairs(claimants) do hasAny = true; break end
if not hasAny then session.claims.items[itemId] = nil end
```

Apply the same check at the `claims.items` level after iterating all items:

```lua
local hasItems = false
for _ in pairs(session.claims.items) do hasItems = true; break end
if not hasItems then session.claims.items = {} end
```

---

### `app/split/[sessionId]/CollaborativeClaimingView.tsx` — add `handleRemovePerson` / `handleRenamePerson` + self-removal useEffect

**Analog:** self — `handleAddPerson` (lines 183-212) for handler shape; identity-restore `useEffect` (lines 122-143) for the self-removal guard effect.

#### handleAddPerson — the template for handleRemovePerson / handleRenamePerson (lines 183-212)

```typescript
// Source: CollaborativeClaimingView.tsx lines 183-212
async function handleAddPerson(name: string) {
  try {
    const res = await fetch(`/api/session/${sessionId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'add_person', name }),
    })
    if (!res.ok) {
      await mutate()
      return
    }
    const data = (await res.json()) as { ok: boolean; personId?: string }
    if (data.ok && data.personId) {
      await mutate()
      setSelectedPersonId(data.personId as PersonId)
      try {
        localStorage.setItem(`split:${sessionId}:personId`, data.personId)
      } catch {
        // private browsing — ignore
      }
      setIdentityModalOpen(false)
      setChangingIdentity(false)
    } else {
      await mutate()
    }
  } catch {
    await mutate()
  }
}
```

`handleRemovePerson` and `handleRenamePerson` follow the same try/catch/mutate skeleton — simpler because they return only `{ ok: true }` with no personId in the response. `handleRemovePerson` must NOT call `setSelectedPersonId` or close the modal itself — the self-removal useEffect handles that when the SWR poll detects the change.

#### handleDeleteItem — the confirm-then-fetch pattern (lines 499-521)

```typescript
// Source: CollaborativeClaimingView.tsx lines 499-521
async function handleDeleteItem(itemId: string) {
  if (!session) return
  const claimantCount = Object.keys(session.claims?.items?.[itemId] ?? {}).length
  const itemName = session.items.find((i) => i.id === itemId)?.name ?? 'this item'
  const confirmMessage = claimantCount > 0
    ? `${claimantCount} ${claimantCount === 1 ? 'person has' : 'people have'} claimed ${itemName} — delete anyway?`
    : `Delete ${itemName}?`
  if (!window.confirm(confirmMessage)) return
  try {
    const res = await fetch(`/api/session/${sessionId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'remove', itemId }),
    })
    if (!res.ok) {
      console.error('Delete failed:', res.status)
      return
    }
    await mutate()
  } catch (err) {
    console.error('Delete request failed:', err)
  }
}
```

`handleRemovePerson` can use the same `window.confirm` pattern for remove-with-claims confirmation (D-06: do not block removal, but a warning is appropriate).

#### Identity-restore useEffect — analog for self-removal useEffect (lines 122-143)

```typescript
// Source: CollaborativeClaimingView.tsx lines 122-143
useEffect(() => {
  if (!session) return
  if (restoreAttempted.current) return
  restoreAttempted.current = true

  let stored: string | null = null
  try {
    stored = localStorage.getItem(`split:${sessionId}:personId`)
  } catch {
    // localStorage unavailable — cannot restore
  }

  if (stored && session.people.some((p) => p.id === stored)) {
    setSelectedPersonId(stored as PersonId)
    setPhase(derivePhase(stored as PersonId, session))
  } else {
    setIdentityModalOpen(true) // no (valid) stored identity — show modal
  }
}, [session, sessionId])
```

The self-removal useEffect is a separate effect that watches `session.people` on every SWR poll (no `restoreAttempted.current` gate — it must run on every refresh after identity is set):

```typescript
// New effect to add — placement: directly after the identity-restore useEffect
useEffect(() => {
  if (!session || selectedPersonId === null) return
  const stillPresent = session.people.some((p) => p.id === selectedPersonId)
  if (!stillPresent) {
    setSelectedPersonId(null)
    try { localStorage.removeItem(`split:${sessionId}:personId`) } catch { /* ignore */ }
    setChangingIdentity(false)
    setIdentityModalOpen(true)
  }
}, [session, selectedPersonId, sessionId])
```

Note: `setChangingIdentity(false)` ensures the re-opened modal has `allowClose=false` (identity prompt, not change-identity mode). The `!me` guard at line 542 (`if (!me) return <SessionExpiredScreen />`) is kept as a safety net but should no longer be the primary self-removal handler.

#### IdentityModal render call — where new props are threaded (lines 527-537)

```typescript
// Source: CollaborativeClaimingView.tsx lines 527-537 — the IdentityModal usage to extend
<IdentityModal
  open={identityModalOpen}
  allowClose={false}
  session={session}
  onSelect={handleSelect}
  onAddPerson={handleAddPerson}
  onOpenChange={setIdentityModalOpen}
/>
```

After this change, two new optional props are added:

```typescript
<IdentityModal
  open={identityModalOpen}
  allowClose={changingIdentity}
  session={session}
  onSelect={handleSelect}
  onAddPerson={handleAddPerson}
  onRemovePerson={handleRemovePerson}
  onRenamePerson={handleRenamePerson}
  onOpenChange={setIdentityModalOpen}
/>
```

#### PersonResultsScreen render — onCurrencyChange prop removal (lines 552-577)

The current results render at line 552-577 passes `onCurrencyChange={handleCurrencyChange}`. After D-09, remove that prop from the JSX and from the `PersonResultsScreenProps` interface. Also remove `handleCurrencyChange` from this file (lines 420-427) once the prop is gone.

---

### `components/split/PersonSlotPicker.tsx` — add rename (inline Input) + remove (X) affordances

**Analogs:**
1. The existing "I'm not listed" inline add form (lines 61-87) for the rename Input pattern.
2. The item inline-edit Input in `CollaborativeClaimingView.tsx` (lines 609-648) for Pencil → confirm/cancel flow.

#### Current props interface (lines 18-22)

```typescript
// Source: PersonSlotPicker.tsx lines 18-22
interface PersonSlotPickerProps {
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => void | Promise<void>
  onAddPerson?: (name: string) => Promise<void>
}
```

Extended target:

```typescript
interface PersonSlotPickerProps {
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => void | Promise<void>
  onAddPerson?: (name: string) => Promise<void>
  onRemovePerson?: (personId: PersonId) => Promise<void>    // NEW D-05/07
  onRenamePerson?: (personId: PersonId, newName: string) => Promise<void>  // NEW D-05/07
}
```

#### Card structure to extend (lines 39-57)

```typescript
// Source: PersonSlotPicker.tsx lines 39-57 — each person card to extend with rename/remove
{session.people.map((person) => {
  return (
    <li key={person.id}>
      <Card
        role="button"
        aria-label={`Claim slot ${person.name}`}
        onClick={() => onSelect(person.id)}
        className="flex min-h-[72px] flex-col items-center justify-center gap-2 px-3 py-4 cursor-pointer"
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
          aria-hidden="true"
        >
          {person.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-[16px]">
          {person.name}
        </span>
      </Card>
    </li>
  )
})}
```

The rename icon button (`Pencil`) and remove icon button (`X` or `Trash2`) go inside the Card without propagating to the Card's main `onClick` (use `e.stopPropagation()` on each icon button's click handler). The rename Pencil triggers local `editingPersonId` state (a `string | null` useState). When `editingPersonId === person.id`, replace the Card body with an inline `Input` + confirm/cancel buttons — same pattern as `CollaborativeClaimingView`'s item inline edit form.

#### Inline add form — the Input/Button pattern to copy for rename mode (lines 71-87)

```typescript
// Source: PersonSlotPicker.tsx lines 71-87
{showAddForm && (
  <div className="flex flex-col gap-2">
    <Input
      placeholder="Your name"
      maxLength={50}
      value={newName}
      onChange={(e) => setNewName(e.target.value)}
    />
    <Button
      type="button"
      className="bg-amber-600 hover:bg-amber-700"
      onClick={handleAddMe}
    >
      Add me
    </Button>
  </div>
)}
```

The inline rename form mirrors this: `Input` (pre-filled with `person.name`), confirm `Button` (calls `onRenamePerson(person.id, trimmedValue)` then clears `editingPersonId`), cancel `Button` (variant="outline", clears `editingPersonId`).

#### Pitfall 4 guard (stale editingPersonId after person removed by another user)

After each SWR poll, if `editingPersonId` is set but the person is no longer in `session.people`, clear it:

```typescript
// Add inside PersonSlotPicker or in a useEffect in the parent
// The component re-renders from session.people on every SWR tick — if the person being
// edited disappears, simply clearing editingPersonId is sufficient (they won't render).
```

---

### `components/split/IdentityModal.tsx` — thread new props through to PersonSlotPicker

**Analog:** self — the current `onAddPerson` prop threading (lines 20-72).

#### Current IdentityModalProps interface (lines 20-29)

```typescript
// Source: IdentityModal.tsx lines 20-29
export interface IdentityModalProps {
  open: boolean
  allowClose: boolean
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => Promise<void>
  onAddPerson: (name: string) => Promise<void>
  onOpenChange: (open: boolean) => void
}
```

Extended target — add two optional props:

```typescript
export interface IdentityModalProps {
  open: boolean
  allowClose: boolean
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => Promise<void>
  onAddPerson: (name: string) => Promise<void>
  onRemovePerson?: (personId: PersonId) => Promise<void>    // NEW
  onRenamePerson?: (personId: PersonId, newName: string) => Promise<void>  // NEW
  onOpenChange: (open: boolean) => void
}
```

#### PersonSlotPicker render in IdentityModal (lines 66-72)

```typescript
// Source: IdentityModal.tsx lines 66-72
<PersonSlotPicker
  key={openKey}
  session={session}
  onSelect={onSelect}
  onAddPerson={onAddPerson}
/>
```

Extended target — forward new props:

```typescript
<PersonSlotPicker
  key={openKey}
  session={session}
  onSelect={onSelect}
  onAddPerson={onAddPerson}
  onRemovePerson={onRemovePerson}
  onRenamePerson={onRenamePerson}
/>
```

No other changes to `IdentityModal.tsx`.

---

### `components/split/PersonResultsScreen.tsx` — unclaimed section, conditional headline, tip Button, remove currency select

**Analog:** self — existing `Button` usage (lines 299-327), `formatCents` usage, conditional rendering patterns throughout.

#### Current props interface (lines 28-36)

```typescript
// Source: PersonResultsScreen.tsx lines 28-36
export interface PersonResultsScreenProps {
  session: PublicSessionPayload
  personId: PersonId
  currencyCode: string
  onAddTip: () => void
  onEditBill: () => void
  onCurrencyChange: (code: string) => Promise<void>  // REMOVE (D-09)
  sessionId: string
}
```

After D-09 — remove `onCurrencyChange`:

```typescript
export interface PersonResultsScreenProps {
  session: PublicSessionPayload
  personId: PersonId
  currencyCode: string
  onAddTip: () => void
  onEditBill: () => void
  sessionId: string
}
```

Also remove from the function signature and the `handleCurrencyChange` function body (lines 125-127), the `COMMON_CURRENCIES` constant (line 26), and the `currencyOptions` derivation (lines 62-64).

#### Current headline (line 134)

```typescript
// Source: PersonResultsScreen.tsx line 134 — REPLACE:
<h1 className="text-[20px] font-semibold leading-[1.2]">You&rsquo;re all set!</h1>
```

Replacement pattern — compute unclaimed count above, then conditionally render:

```typescript
// Use getUnclaimedCounts (from CollaborativeClaimingView or inline copy of the 7-line function)
const { unclaimed: unclaimedCount } = getUnclaimedCounts(session)

// In JSX:
<h1 className="text-[20px] font-semibold leading-[1.2]">
  {unclaimedCount > 0
    ? `Hold up — ${unclaimedCount} item${unclaimedCount === 1 ? '' : 's'} still up for grabs!`
    : "You're all set!"}
</h1>
```

#### Unclaimed items section (new, goes after headline)

```typescript
// When unclaimedCount > 0 — pattern mirrors UnclaimedBanner but listed not as a banner:
{unclaimedCount > 0 && (
  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
    <p className="text-[14px] font-medium text-amber-800 mb-2">Unclaimed items</p>
    <ul className="flex flex-col gap-1">
      {getUnclaimedItems(session).map((item) => (
        <li key={item.id} className="text-[14px] text-amber-700">{item.name}</li>
      ))}
    </ul>
  </div>
)}
```

`getUnclaimedItems` is a simple extension of `getUnclaimedCounts` (returning filtered `session.items` instead of a count). Inline it in this file or extract to `lib/sessionUtils.ts`.

#### Currency select block to delete (lines 259-274)

```typescript
// Source: PersonResultsScreen.tsx lines 259-274 — DELETE this entire block:
<div className="flex items-center gap-2 text-[14px] text-zinc-500">
  <label htmlFor="currency-select" className="shrink-0">Currency:</label>
  <select
    id="currency-select"
    value={currencyCode}
    onChange={(e) => void handleCurrencyChange(e.target.value)}
    className="rounded border border-border bg-background px-2 py-1 text-[14px] text-foreground"
  >
    {currencyOptions.map((code) => (
      <option key={code} value={code}>
        {code}
      </option>
    ))}
  </select>
</div>
```

#### Tip button — current (lines 276-283) — REPLACE with shadcn Button

```typescript
// Source: PersonResultsScreen.tsx lines 276-283 — REPLACE:
<button
  type="button"
  onClick={onAddTip}
  className="text-[14px] text-amber-600 underline self-start"
>
  Add a tip?
</button>

// Target — use existing shadcn Button (already imported line 7):
<Button
  type="button"
  variant="outline"
  className="border-amber-600 text-amber-600 hover:bg-amber-50"
  onClick={onAddTip}
>
  Add a tip
</Button>
```

---

### `components/split/BillViewHeader.tsx` — remove Receipt button, enlarge Share button

**Analog:** self — current Receipt and Share button blocks (lines 120-140).

#### Receipt button to delete (lines 121-127)

```typescript
// Source: BillViewHeader.tsx lines 121-127 — DELETE this entire button:
<button
  type="button"
  aria-label="View receipt"
  className="text-zinc-500 hover:text-zinc-700 transition-colors"
>
  <Receipt size={22} aria-hidden="true" />
</button>
```

Also delete `Receipt` from the import on line 4 (`import { Receipt, Share2, Copy, Check } from 'lucide-react'` → `import { Share2, Check } from 'lucide-react'`).

#### Share button to enlarge (lines 128-139)

```typescript
// Source: BillViewHeader.tsx lines 128-139 — current:
<button
  type="button"
  aria-label="Share bill link"
  onClick={handleShare}
  className="text-zinc-500 hover:text-zinc-700 transition-colors"
>
  {copied ? (
    <Check size={22} aria-hidden="true" />
  ) : (
    <Share2 size={22} aria-hidden="true" />
  )}
</button>

// Target — 44px touch target, larger icon, visible presence:
<button
  type="button"
  aria-label="Share bill link"
  onClick={handleShare}
  className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-white hover:bg-amber-700 transition-colors"
>
  {copied ? (
    <Check size={20} aria-hidden="true" />
  ) : (
    <Share2 size={20} aria-hidden="true" />
  )}
  <span className="text-[14px] font-medium">{copied ? 'Copied!' : 'Share'}</span>
</button>
```

---

### `__tests__/editRoute.test.ts` — add remove_person / rename_person cases

**Analog:** self — Tests 11-20 (add_person / update_currency), especially the `mockEval` mock setup and `callPOST` helper.

#### Mock setup (lines 1-26) — unchanged, already covers new ops

```typescript
// Source: editRoute.test.ts lines 1-26 — NO CHANGES NEEDED
// mockEval is already declared and reset in beforeEach.
// Both new ops use redis.eval, so mockEval covers them.
const mockEval = vi.fn()
// ...
beforeEach(() => {
  vi.resetModules()
  mockGet.mockReset()
  mockSet.mockReset()
  mockEval.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
```

#### baseSession fixture (lines 44-66) — unchanged, already has p1/p2/i1/i2

The existing `baseSession` at lines 44-66 is the fixture to use for new tests. It has `people: [p1 Alice, p2 Bob]` and `claims.items.i1: {p1:{qty:1}, p2:{qty:1}}` — perfect for testing remove_person claim cleanup.

#### add_person ok test — the exact structure to copy for remove_person / rename_person (lines 224-238)

```typescript
// Source: editRoute.test.ts lines 224-238
it('Test 11 (add_person ok): creates person atomically via Lua, returns 200 { ok:true, personId:<string> }; redis.eval called exactly once', async () => {
  mockEval.mockResolvedValue('OK')
  const { status, json } = await callPOST('test-session', {
    op: 'add_person',
    name: 'Carol',
  })
  expect(status).toBe(200)
  const body = json as { ok: boolean; personId: string }
  expect(body.ok).toBe(true)
  expect(typeof body.personId).toBe('string')
  expect(body.personId.length).toBeGreaterThan(0)
  expect(mockEval).toHaveBeenCalledTimes(1)
  expect(mockGet).not.toHaveBeenCalled()
})
```

New tests to add (mirror structure above):

- `remove_person ok`: `mockEval.mockResolvedValue('OK')`, send `{ op: 'remove_person', personId: 'p1' }`, assert status 200, `{ ok: true }`, `mockEval` called once, `mockGet` not called.
- `remove_person person_not_found`: eval returns `'person_not_found'` → 404.
- `remove_person last_person`: eval returns `'last_person'` → 409 (if that guard is added).
- `remove_person missing personId`: send `{ op: 'remove_person' }` with no `personId` → 400, `mockEval` not called.
- `rename_person ok`: `mockEval.mockResolvedValue('OK')`, send `{ op: 'rename_person', personId: 'p1', newName: 'Alicia' }` → 200, eval called once, ARGV[0] is `'p1'`, ARGV[1] is `'Alicia'`.
- `rename_person name trimmed`: `{ op: 'rename_person', personId: 'p1', newName: '  Alicia  ' }` → ARGV[1] is `'Alicia'` (trimmed).
- `rename_person name empty`: `{ op: 'rename_person', personId: 'p1', newName: '   ' }` → 400, eval not called.
- `rename_person name too long`: name 51 chars → 400, eval not called.

#### ARGV inspection pattern (lines 266-272) — use for rename_person ARGV verification

```typescript
// Source: editRoute.test.ts lines 266-272 — mirrors add_person trimmed test:
const evalArgs = mockEval.mock.calls[0]
// evalArgs[2] is the ARGV array: [trimmedName, newPersonId]
const argv = evalArgs[2] as string[]
expect(argv[0]).toBe('Carol')

// For rename_person: ARGV = [personId, trimmedName]
const argv = evalArgs[2] as string[]
expect(argv[0]).toBe('p1')
expect(argv[1]).toBe('Alicia')
```

---

### `__tests__/BillViewHeader.test.tsx` — update Test 7, add Share-target test

**Analog:** self — Tests 1-9 structure.

#### Test 7 to update (lines 117-128) — delete or change assertion

```typescript
// Source: BillViewHeader.test.tsx lines 117-128 — DELETE (receipt button is removed):
it('Test 7: receipt affordance with aria-label "View receipt" is present', () => {
  render(...)
  const receiptBtn = screen.getByLabelText('View receipt')
  expect(receiptBtn).toBeDefined()
})

// REPLACE with:
it('Test 7 (D-01): receipt button with aria-label "View receipt" is NOT present', () => {
  render(<BillViewHeader session={mockSession} myPersonId="p1" onStripTap={vi.fn()} sessionId="test-session-id" />)
  expect(screen.queryByLabelText('View receipt')).toBeNull()
})
```

#### New Share-button size test (D-02)

```typescript
// New Test 10 — follows Test 6's getByLabelText pattern:
it('Test 10 (D-02): Share button has min-h-[44px] class for ≥44px touch target', () => {
  render(<BillViewHeader session={mockSession} myPersonId="p1" onStripTap={vi.fn()} sessionId="test-session-id" />)
  const shareBtn = screen.getByLabelText('Share bill link')
  expect(shareBtn.className).toContain('min-h-[44px]')
})
```

---

### `__tests__/PersonResultsScreen.test.tsx` — add unclaimed section, headline, tip button, currency tests

**Analog:** self — `makeSession` fixture (lines 13-36) and `defaultProps` (lines 38-45).

#### defaultProps to update — remove onCurrencyChange (D-09)

```typescript
// Source: PersonResultsScreen.test.tsx lines 38-45 — REMOVE onCurrencyChange from defaultProps:
const defaultProps = {
  personId: 'p1' as const,
  currencyCode: 'USD',
  onAddTip: vi.fn(),
  onEditBill: vi.fn(),
  onCurrencyChange: vi.fn().mockResolvedValue(undefined),  // DELETE THIS LINE
  sessionId: 'sess-123',
}
```

#### makeSession for unclaimed scenario

```typescript
// For D-03/D-04 tests — use makeSession with a partially-unclaimed claims object:
const unclaimedSession = makeSession({
  claims: {
    items: {
      i1: { p1: { qty: 1 } },  // i1 claimed
      // i2 Beer (qty:2) has only 1 claimed out of 2 → unclaimed
      i2: { p1: { qty: 1 } },
    },
    personSlots: {},
    donePeople: {},
  },
})
```

New tests to add:

- D-03 unclaimed section: render with `unclaimedSession` → `screen.getByText('Unclaimed items')` is defined; item name 'Beer' appears in the unclaimed list.
- D-04 playful headline: render with unclaimed session → headline matches `/Hold up/i`; render with fully-claimed session → headline matches `/You.?re all set/i`.
- D-08 tip Button: render any session → `screen.getByRole('button', { name: /Add a tip/i })` is defined (not a bare `button[className*="underline"]`).
- D-09 currency select absent: `screen.queryByLabelText('currency-select')` is null; `screen.queryByRole('combobox')` is null.

---

### `__tests__/CollaborativeClaimingView.test.tsx` — add self-removal test

**Analog:** self — `selectAlice` helper (lines 65-82) and SWR mock pattern (lines 11-16, 51-52).

#### useSWRMock pattern for dynamic session changes (lines 51-52)

```typescript
// Source: CollaborativeClaimingView.test.tsx lines 51-52 — useSWRMock.mockReturnValue:
useSWRMock.mockReturnValue({ data: SESSION_FIXTURE, error: undefined, mutate: mutateMock })
```

For the self-removal test, update `useSWRMock` mid-test to simulate p1 being removed:

```typescript
it('Self-removal: when viewer personId removed from session, identity modal re-opens (not SessionExpiredScreen)', async () => {
  await selectAlice()  // Alice (p1) is now selected; claiming view shows

  // Simulate SWR poll returning a session where p1 is gone
  const sessionWithoutAlice = {
    ...SESSION_FIXTURE,
    people: [{ id: 'p2', name: 'Bob', colorIndex: 1 }],
    claims: { items: {}, personSlots: {}, donePeople: {} },
  }
  useSWRMock.mockReturnValue({
    data: sessionWithoutAlice,
    error: undefined,
    mutate: mutateMock,
  })

  // Trigger a re-render (SWR poll tick)
  await waitFor(() => {
    // Identity modal should re-open
    expect(screen.getByText('Who are you?')).toBeDefined()
    // Must NOT show SessionExpiredScreen
    expect(screen.queryByText(/session.*expired/i)).toBeNull()
  })
})
```

---

## Shared Patterns

### SWR mutate after /edit write
**Source:** `CollaborativeClaimingView.tsx` `handleAddPerson` (lines 196, 207), `handleDeleteItem` (line 517)
**Apply to:** `handleRemovePerson`, `handleRenamePerson` in `CollaborativeClaimingView.tsx`

```typescript
// Pattern: always call await mutate() after a successful /edit POST (and on failure too)
await mutate()  // re-syncs all clients on next poll
```

### fetch POST to /edit route
**Source:** `CollaborativeClaimingView.tsx` `handleAddPerson` (lines 185-189), `handleDeleteItem` (lines 508-511)
**Apply to:** `handleRemovePerson`, `handleRenamePerson`

```typescript
const res = await fetch(`/api/session/${sessionId}/edit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ op: 'remove_person', personId }),
})
if (!res.ok) { await mutate(); return }
```

### localStorage cleanup pattern
**Source:** `CollaborativeClaimingView.tsx` identity-restore effect and self-removal effect
**Apply to:** self-removal useEffect (clear `split:${sessionId}:personId` before re-opening modal)

```typescript
try { localStorage.removeItem(`split:${sessionId}:personId`) } catch { /* ignore */ }
```

### shadcn Button with amber-600 style
**Source:** `PersonResultsScreen.tsx` lines 299-307 (Copy summary button) and `PersonSlotPicker.tsx` lines 79-86 (Add me button)
**Apply to:** Tip button in `PersonResultsScreen`, Add me button in `PersonSlotPicker`

```typescript
// Full primary style:
<Button type="button" className="bg-amber-600 hover:bg-amber-700">...</Button>
// Outline + amber tint (for tip button — secondary action):
<Button type="button" variant="outline" className="border-amber-600 text-amber-600 hover:bg-amber-50">...</Button>
```

### Tailwind min-h/min-w 44px touch target
**Source:** RESEARCH.md "Don't Hand-Roll" table
**Apply to:** Share button in `BillViewHeader`, remove/rename icon buttons in `PersonSlotPicker`

```typescript
className="flex min-h-[44px] min-w-[44px] items-center justify-center ..."
```

### `getUnclaimedCounts` — shared logic
**Source:** `CollaborativeClaimingView.tsx` lines 56-64 and `UnclaimedBanner.tsx` lines 10-21 (identical implementations)
**Apply to:** `PersonResultsScreen.tsx` for D-03/D-04

```typescript
function getUnclaimedCounts(session: SessionPayload): { unclaimed: number; total: number } {
  let unclaimed = 0
  for (const item of session.items) {
    const entries = session.claims?.items?.[item.id] ?? {}
    const totalClaimed = Object.values(entries).reduce((sum, e) => sum + (e?.qty ?? 0), 0)
    if (totalClaimed < (item.quantity ?? 1)) unclaimed++
  }
  return { unclaimed, total: session.items.length }
}
```

Recommendation: extract to `lib/sessionUtils.ts` to serve three consumers (CollaborativeClaimingView, UnclaimedBanner, PersonResultsScreen). If minimal churn is preferred, an inline copy in PersonResultsScreen is acceptable.

---

## No Analog Found

All files in scope are modifications of existing files. All patterns have direct analogs within those same files. No file lacks a pattern reference.

---

## Metadata

**Analog search scope:** `app/api/session/[sessionId]/edit/`, `app/api/session/[sessionId]/claim/`, `app/split/[sessionId]/`, `components/split/`, `__tests__/`
**Files read:** 12 source files + 2 planning docs
**Pattern extraction date:** 2026-06-09
