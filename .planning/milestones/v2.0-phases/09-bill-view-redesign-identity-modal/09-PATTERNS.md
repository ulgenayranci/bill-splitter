# Phase 9: Bill View Redesign + Identity Modal — Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/billMath.ts` | utility | transform | `lib/billMath.ts` (self — additive) | exact |
| `app/api/session/[sessionId]/claim/route.ts` | API route | request-response | `app/api/session/[sessionId]/claim/route.ts` (self — additive) | exact |
| `app/api/session/[sessionId]/edit/route.ts` | API route | request-response | `app/api/session/[sessionId]/edit/route.ts` (self — additive) | exact |
| `components/split/PersonSlotPicker.tsx` | component | request-response | `components/split/PersonSlotPicker.tsx` (self — refactor) | exact |
| `components/split/IdentityModal.tsx` (NEW) | component | request-response | `components/wizard/DisambiguationDialog.tsx` | exact |
| `components/split/BillViewHeader.tsx` (NEW) | component | event-driven | `components/wizard/AppHeader.tsx` | role-match |
| `components/split/UnclaimedBanner.tsx` (NEW) | component | transform | `components/split/ClaimableItemCard.tsx` (counter display) | partial |
| `components/split/ClaimableItemCard.tsx` | component | request-response | `components/split/ClaimableItemCard.tsx` (self — augment) | exact |
| `app/split/[sessionId]/CollaborativeClaimingView.tsx` | component (orchestrator) | event-driven | `app/split/[sessionId]/CollaborativeClaimingView.tsx` (self — rewrite) | exact |

---

## Pattern Assignments

### `lib/billMath.ts` (utility, transform)

**Analog:** `lib/billMath.ts` — existing `computePersonTotals` already uses largest-remainder. New function `computeEqualShareCents` follows the same pattern.

**Existing largest-remainder pattern to copy** (lines 49–58):
```typescript
// computePersonTotals — largest-remainder for equal splits
const base = Math.floor(item.priceCents / sharers.length)
const remainder = item.priceCents % sharers.length
sharers.forEach((pid, idx) => {
  if (totals[pid] === undefined) return // orphan defense
  totals[pid] += base + (idx < remainder ? 1 : 0)
})
```

**New function to add** (after `computePersonShareFromClaims`, line 126+):
```typescript
/**
 * Equal share in cents for one sharer, using largest-remainder.
 * Guarantees: sum of computeEqualShareCents(p, n, 0..n-1) === priceCents exactly.
 * Determinism rule: caller sorts claimant personIds lexicographically ascending
 * before assigning myIndex — first ID gets the extra cent.
 * Only for single-qty tap-to-join items (D-13). Multi-qty uses computePersonShareFromClaims.
 */
export function computeEqualShareCents(
  priceCents: number,
  numSharers: number,
  myIndex: number   // 0-based index in sorted claimant list
): number {
  if (numSharers <= 0) return 0
  const base = Math.floor(priceCents / numSharers)
  const remainder = priceCents % numSharers
  return base + (myIndex < remainder ? 1 : 0)
}
```

**Test pattern to mirror** (from `__tests__/billMath.test.ts` lines 201–206):
```typescript
// New tests follow this describe structure:
describe('computeEqualShareCents', () => {
  it('2-way split of 1000 → [500, 500]', ...)
  it('3-way split of 1000 → [334, 333, 333] (sum = 1000)', ...)
  it('sum conservation: reduce over all indices always equals priceCents', ...)
})
```

---

### `app/api/session/[sessionId]/claim/route.ts` (API route, request-response)

**Analog:** `app/api/session/[sessionId]/claim/route.ts` — extend with a new `share` action alongside the existing `qty` and `slot` actions.

**Lua script pattern to copy** (existing `QTY_CLAIM_SCRIPT`, lines 12–63):
```lua
-- New SHARE_CLAIM_SCRIPT derives from QTY_CLAIM_SCRIPT but removes the bounds check.
-- QTY_CLAIM_SCRIPT structure to replicate:
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end
-- ... mutate claims.items[itemId][personId] ...
-- ... clean up empty item entry ...
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
```

**Slot claim pattern to keep** (existing `SLOT_CLAIM_SCRIPT`, lines 71–89 — no change needed).

**ClaimBody type extension** (lines 91–96):
```typescript
// Extend ClaimBody to add 'share' action:
type ClaimBody = {
  personId: string
  action: 'qty' | 'slot' | 'share'   // add 'share'
  itemId?: string
  qty?: number
  joining?: boolean                    // new: true = join, false = leave
}
```

**validateBody extension** — add `'share'` to the accepted action union and validate `joining: boolean` is present when `action === 'share'`.

**POST handler dispatch pattern** (lines 120–179):
```typescript
// Existing dispatch pattern:
if (action === 'qty') { ... redis.eval(QTY_CLAIM_SCRIPT, ...) ... }
// action === 'slot'
redis.eval(SLOT_CLAIM_SCRIPT, ...)

// Add third branch before the slot handler:
if (action === 'share') {
  const result = await redis.eval(
    SHARE_CLAIM_SCRIPT,
    [`session:${sessionId}`],
    [itemId as string, personId, String(joining)]
  )
  // same error mapping pattern: session_not_found → 404, invalid_session → 500
  return NextResponse.json({ ok: true })
}
```

**Test pattern** (from `__tests__/sessionClaimRoute.test.ts` lines 51–66):
```typescript
// New test for share action follows this structure:
it('Test N (share join): calls redis.eval with SHARE_CLAIM_SCRIPT; ARGV=[itemId, personId, "true"]', async () => {
  mockEval.mockResolvedValue('OK')
  const { status, json } = await callPOSTWithParams('test-session', {
    personId: 'p1', itemId: 'i1', action: 'share', joining: true,
  })
  expect(status).toBe(200)
  expect((json as { ok: boolean }).ok).toBe(true)
  const [script, keys, args] = mockEval.mock.calls[0]
  expect(keys).toEqual(['session:test-session'])
  expect(args).toEqual(['i1', 'p1', 'true'])
})
```

---

### `app/api/session/[sessionId]/edit/route.ts` (API route, request-response)

**Analog:** `app/api/session/[sessionId]/edit/route.ts` — extend `VALID_OPS` with `'add_person'` and add atomic Lua execution for that op.

**VALID_OPS extension** (line 8):
```typescript
// Before:
const VALID_OPS = ['add', 'remove', 'edit_price', 'edit_name', 'edit_quantity'] as const
// After:
const VALID_OPS = ['add', 'remove', 'edit_price', 'edit_name', 'edit_quantity', 'add_person'] as const
```

**Validation pattern to mirror** (lines 20–73 `validateOp`):
```typescript
// add_person validation block — append inside validateOp:
if (op === 'add_person') {
  if (typeof b.name !== 'string' || b.name.trim().length === 0)
    return { ok: false, error: 'Invalid add_person: name must be a non-empty string' }
  if (b.name.trim().length > 50)
    return { ok: false, error: 'Invalid add_person: name too long (max 50 chars)' }
  return { ok: true }
}
```

**Lua eval pattern to replicate** (contrast with GET→mutate→SET for `add` op at lines 109–119 — `add_person` needs Lua for atomicity):
```typescript
// import nanoid at top (already imported at line 1)
// add_person uses redis.eval (not redis.get + redis.set) for atomicity
if (op === 'add_person') {
  const newPersonId = nanoid()
  const trimmedName = (b.name as string).trim()
  const result = await redis.eval(
    ADD_PERSON_SCRIPT,
    [`session:${sessionId}`],
    [trimmedName, newPersonId]
  )
  if (result === 'session_not_found') return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
  if (result === 'session_full') return NextResponse.json({ error: 'Session is full (max 20 people)' }, { status: 409 })
  // Return the new personId — client needs it immediately to set identity
  return NextResponse.json({ ok: true, personId: newPersonId })
}
```

**Error handling pattern** (lines 155–159):
```typescript
// Catch block pattern (already exists — no change):
} catch (err) {
  console.error('Edit error:', err)
  return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
}
```

**Test pattern** (from `__tests__/editRoute.test.ts` lines 66–80):
```typescript
// New test for add_person follows this structure:
it('Test N (add_person): appends person + locks slot atomically, returns personId', async () => {
  mockEval.mockResolvedValue('OK')
  mockGet.mockResolvedValue(baseSession)  // get called for validation only
  const { status, json } = await callPOST('test-session', { op: 'add_person', name: 'Carol' })
  expect(status).toBe(200)
  expect((json as { ok: boolean; personId: string }).ok).toBe(true)
  expect(typeof (json as { personId: string }).personId).toBe('string')
  expect(mockEval).toHaveBeenCalledTimes(1)
})
```

---

### `components/split/PersonSlotPicker.tsx` (component, request-response — refactor)

**Analog:** `components/split/PersonSlotPicker.tsx` — self, keep content but fix `opacity-40` → `opacity-50`.

**Bug fix** (line 37 — Pitfall 6 from RESEARCH.md):
```typescript
// BEFORE (line 37):
taken ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
// AFTER:
taken ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
```

**Content stays**: the grid layout, slot cards, avatar circles, `(taken)` label, `onSelect` callback — all preserved. This component becomes the inner content of `IdentityModal`.

**Props interface extension** — add optional `onAddPerson` prop and "I'm not listed" inline form at the bottom of the grid:
```typescript
// Extended props:
interface PersonSlotPickerProps {
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => void | Promise<void>
  onAddPerson?: (name: string) => Promise<void>  // NEW: for "I'm not listed" path
}
```

**"I'm not listed" inline form pattern** — mirror the inline add form from `CollaborativeClaimingView.tsx` (lines 482–530), simplified to name-only (no price/qty fields).

---

### `components/split/IdentityModal.tsx` (NEW component, request-response)

**Analog:** `components/wizard/DisambiguationDialog.tsx` — controlled Dialog wrapper with inner content component and async submit handler.

**Imports pattern** (from `DisambiguationDialog.tsx` lines 1–14):
```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PersonSlotPicker } from '@/components/split/PersonSlotPicker'
import type { PublicSessionPayload } from '@/lib/sessionSchema'
import type { PersonId } from '@/stores/useBillStore'
```

**Controlled Dialog pattern** (from `DisambiguationDialog.tsx` lines 165–170, and `AppHeader.tsx` lines 116–139):
```typescript
// Key: onOpenChange blocks dismiss if no identity selected yet
<Dialog
  open={open}
  onOpenChange={(nextOpen) => {
    // Block close if this is the initial identity prompt (not a change-identity open)
    if (!nextOpen && !allowClose) return
    onOpenChange(nextOpen)
  }}
>
  <DialogContent showCloseButton={allowClose}>
    <DialogHeader>
      <DialogTitle>Who are you?</DialogTitle>
      <DialogDescription>Pick your name from the list below.</DialogDescription>
    </DialogHeader>
    <PersonSlotPicker session={session} onSelect={onSelect} onAddPerson={onAddPerson} />
  </DialogContent>
</Dialog>
```

**Props interface**:
```typescript
interface IdentityModalProps {
  open: boolean
  allowClose: boolean          // false on initial load, true for change-identity
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => Promise<void>
  onAddPerson: (name: string) => Promise<void>
  onOpenChange: (open: boolean) => void
}
```

**Dialog open/close with state reset** (from `DisambiguationDialog.tsx` lines 36–43 — effect pattern):
```typescript
// DisambiguationDialog resets state on item identity change — IdentityModal resets on open change:
useEffect(() => {
  if (open) {
    setAddingNew(false)
    setNewName('')
    setError(null)
  }
}, [open])
```

---

### `components/split/BillViewHeader.tsx` (NEW component, event-driven)

**Analog:** `components/wizard/AppHeader.tsx` — sticky header bar with interactive elements, Dialog-based actions.

**Imports pattern** (from `AppHeader.tsx` lines 1–14, adapted):
```typescript
'use client'

import { Share2, Receipt } from 'lucide-react'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import type { SessionPayload } from '@/lib/sessionSchema'
import type { PersonId } from '@/stores/useBillStore'
```

**Header layout pattern** (from `AppHeader.tsx` lines 49–52, adapted for Bill View):
```typescript
// AppHeader sticky bar pattern — BillViewHeader follows same sticky/border/bg pattern:
<header className="sticky top-0 z-10 flex flex-col border-b border-border bg-background px-4">
  {/* Row 1: bill title + date + icons */}
  {/* Row 2: people strip (tappable) */}
</header>
```

**Avatar color consistency** (from `CollaborativeClaimingView.tsx` lines 380–384, and `ClaimableItemCard.tsx` lines 154–158):
```typescript
// Both existing uses of AVATAR_COLORS follow this pattern:
const colorClass = AVATAR_COLORS[(person?.colorIndex ?? 0) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]
// BillViewHeader must use the same lookup for strip consistency with card chips
```

**People strip + overflow pattern** (from `ClaimableItemCard.tsx` lines 36–41):
```typescript
// ClaimableItemCard overflow pattern — BillViewHeader strip follows same cap+overflow:
const MAX_STRIP_AVATARS = 3  // others shown before +N (own identity always shown separately)
const visibleOthers = otherPeople.slice(0, MAX_STRIP_AVATARS)
const overflowCount = Math.max(0, otherPeople.length - MAX_STRIP_AVATARS)
// render visibleOthers as compact circles + `+{overflowCount}` if needed
```

**Props interface**:
```typescript
interface BillViewHeaderProps {
  session: SessionPayload
  myPersonId: PersonId | null
  onStripTap: () => void     // D-03: opens change-identity modal
  sessionId: string          // for share URL construction
}
```

**Date formatting** (from RESEARCH.md Pattern 5 / Pitfall 7):
```typescript
// session.createdAt is Unix ms timestamp (confirmed in lib/sessionSchema.ts line 21)
function formatBillDate(createdAt: number): string {
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
// Bill title: `Bill — ${formatBillDate(session.createdAt)}`
```

---

### `components/split/UnclaimedBanner.tsx` (NEW component, transform)

**Analog:** `components/split/ClaimableItemCard.tsx` — pure display component driven by computed counts from SWR session data. No API calls.

**Unclaimed count computation pattern** (from `CollaborativeClaimingView.tsx` `allItemsFullyClaimed` lines 46–52, adapted):
```typescript
// Existing allItemsFullyClaimed pattern — UnclaimedBanner uses same traversal:
function getUnclaimedCounts(session: SessionPayload): { unclaimed: number; total: number } {
  let unclaimed = 0
  for (const item of session.items) {
    const total = Object.values(session.claims?.items?.[item.id] ?? {})
      .reduce((sum, e) => sum + (e?.qty ?? 0), 0)
    if (total < (item.quantity ?? 1)) unclaimed++
  }
  return { unclaimed, total: session.items.length }
}
```

**Props interface**:
```typescript
interface UnclaimedBannerProps {
  session: SessionPayload
  onTap: () => void   // D-10: scroll to first unclaimed item
}
```

**Conditional render pattern** (from `ClaimableItemCard.tsx` lines 146–175 — only render when condition true):
```typescript
// Only render banner when unclaimed > 0:
const { unclaimed, total } = getUnclaimedCounts(session)
if (unclaimed === 0) return null
// render: "{unclaimed} of {total} items still unclaimed"
```

---

### `components/split/ClaimableItemCard.tsx` (component, request-response — augment)

**Analog:** `components/split/ClaimableItemCard.tsx` — self, keep all existing behavior, add:
1. D-06: amber border on own-claim cards (currently `bg-amber-50` — add `border-amber-500 border`)
2. D-07: change `MAX_VISIBLE_AVATARS` from `5` to `3`
3. D-13: new `onShareChange` prop for single-qty tap-to-join
4. D-15: "your share: $X.XX" line using `computeEqualShareCents`

**Current chip overflow** (line 20 — change limit):
```typescript
// BEFORE:
const MAX_VISIBLE_AVATARS = 5
// AFTER (D-07):
const MAX_VISIBLE_AVATARS = 3
```

**Own-claim card highlight** (lines 65–68 — augment cardClasses):
```typescript
// BEFORE (line 67):
mine ? 'bg-amber-50' : '',
// AFTER (D-06 — amber border + tint):
mine ? 'bg-amber-50 border-amber-400' : '',
```

**New prop for tap-to-join** (lines 11–18 — extend props interface):
```typescript
interface ClaimableItemCardProps {
  // ... existing props ...
  onShareChange?: (joining: boolean) => void   // NEW: D-13, undefined for multi-qty items
}
```

**Single-qty tap handler extension** (lines 49–52 — extend `handleToggle`):
```typescript
// D-13: for qty:1 items, use onShareChange if provided (share action), else fall back to onQtyChange
const handleToggle = () => {
  if (onShareChange) {
    onShareChange(myQty === 0)   // join if unclaimed, leave if already claimed
  } else {
    onQtyChange(myQty === 0 ? 1 : 0)
  }
}
```

**"Your share" line** (D-15 — add after the chip row, lines 176–178):
```typescript
// Show "your share: $X.XX" when this person is sharing with others on a single-qty item
import { computeEqualShareCents } from '@/lib/billMath'
// Inside render, after claimant-stack section:
{!isMultiQty && mine && allClaimantEntries.length > 1 && (
  <span className="text-[13px] text-zinc-500" data-testid="your-share">
    your share: {formatCents(computeEqualShareCents(
      item.priceCents,
      allClaimantEntries.length,
      // myIndex: position of myPersonId in sorted claimant IDs
      [...allClaimantEntries.map(([pid]) => pid)].sort().indexOf(myPersonId)
    ))}
  </span>
)}
```

---

### `app/split/[sessionId]/CollaborativeClaimingView.tsx` (orchestrator, event-driven — major rewrite)

**Analog:** `app/split/[sessionId]/CollaborativeClaimingView.tsx` — self. The rewrite preserves all established patterns; changes are surgical to phase machine and identity flow.

**SWR pattern to preserve** (lines 74–78):
```typescript
// Unchanged — SWR polling is the live-update backbone for all Phase 9 features:
const swrKey = `/api/session/${sessionId}`
const { data: session, error, mutate } = useSWR<SessionPayload>(swrKey, fetcher, {
  refreshInterval: 3000,
  revalidateOnFocus: false,
})
```

**localStorage identity restore pattern to preserve** (lines 82–112):
```typescript
// Persist to localStorage (lines 82–90) — unchanged
// Restore from localStorage (lines 95–112) — update: also trigger modal open check
```

**Phase machine replacement** (lines 44 and 55–64):
```typescript
// BEFORE:
type Phase = 'claiming' | 'tip' | 'waiting' | 'results'
function derivePhase(personId, session): Phase {
  if (session.tips?.[personId] !== undefined) {
    if (!allItemsFullyClaimed(session)) return 'waiting'
    return 'results'
  }
  ...
}

// AFTER (D-12):
type Phase = 'claiming' | 'tip' | 'results'  // 'waiting' removed
function derivePhase(personId: PersonId, session: SessionPayload): Phase {
  if (session.tips?.[personId] !== undefined) return 'results'  // no gate
  if (session.claims?.donePeople?.[personId]) return 'tip'
  return 'claiming'
}
```

**handleDone update** (lines 210–226 — remove `allItemsFullyClaimed` gate, add unclaimed warning dialog):
```typescript
// BEFORE: setPhase('tip') unconditionally
// AFTER: if unclaimed items exist, show the unclaimed warning dialog first;
//        "Continue anyway" calls the original setPhase('tip') path
async function handleDone() {
  if (!selectedPersonId || !session) return
  const { unclaimed } = getUnclaimedCounts(session)
  if (unclaimed > 0) {
    setShowUnclaimedWarning(true)   // new state: opens warning Dialog
    return
  }
  // existing fetch + setPhase('tip') logic unchanged
}
```

**onTipConfirmed update** (line 361 — remove `allItemsFullyClaimed` check):
```typescript
// BEFORE:
onTipConfirmed={() => setPhase(allItemsFullyClaimed(session) ? 'results' : 'waiting')}
// AFTER (D-12):
onTipConfirmed={() => setPhase('results')}
```

**Identity modal state** (new state adjacent to existing `selectedPersonId` at line 69):
```typescript
const [identityModalOpen, setIdentityModalOpen] = useState(false)
const [changingIdentity, setChangingIdentity] = useState(false)
```

**Identity modal trigger** (new useEffect after localStorage restore effect, lines 95–112):
```typescript
// Show identity modal when session loads and no identity is stored or stored slot is gone
useEffect(() => {
  if (!session) return
  if (selectedPersonId !== null) return   // already have identity
  let stored: string | null = null
  try { stored = localStorage.getItem(`split:${sessionId}:personId`) } catch { /* ignore */ }
  if (stored && session.claims?.personSlots?.[stored] === true) {
    setSelectedPersonId(stored as PersonId)
    setPhase(derivePhase(stored as PersonId, session))
  } else {
    setIdentityModalOpen(true)   // no stored identity — show modal
  }
}, [session, sessionId])   // note: selectedPersonId NOT in deps (only fire when falsy)
```

**handleAddPerson** (new async handler following `handleSelect` pattern at lines 132–153):
```typescript
// Pattern: async fetch → on success, set personId + close modal + mutate
async function handleAddPerson(name: string) {
  const res = await fetch(`/api/session/${sessionId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'add_person', name }),
  })
  const data = (await res.json()) as { ok: boolean; personId?: string }
  if (data.ok && data.personId) {
    setSelectedPersonId(data.personId as PersonId)
    try { localStorage.setItem(`split:${sessionId}:personId`, data.personId) } catch { /* ignore */ }
    setIdentityModalOpen(false)
    await mutate()
  }
}
```

**handleShareChange** (new async handler following `handleQtyChange` optimistic update pattern at lines 155–208):
```typescript
// Same optimistic update + rollback structure as handleQtyChange
async function handleShareChange(itemId: ItemId, joining: boolean) {
  if (!selectedPersonId || !session) return
  // ... build optimistic snapshot (same claimsForItem spread as handleQtyChange) ...
  await mutate(
    async () => {
      const res = await fetch(`/api/session/${sessionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: selectedPersonId, itemId, action: 'share', joining }),
      })
      if (!res.ok) throw new Error('share_failed')
      return fetcher(swrKey)
    },
    { optimisticData: optimistic, rollbackOnError: true, revalidate: true }
  )
}
```

**Render structure update** (lines 335–341 — replace full-page PersonSlotPicker with IdentityModal):
```typescript
// BEFORE: if (selectedPersonId === null) return <main>...<PersonSlotPicker /></main>
// AFTER: modal is always present alongside the claim view; no full-page picker gate
// The IdentityModal renders as an overlay; the claiming view renders underneath once
// selectedPersonId is set. On first load, claim view is gated by selectedPersonId === null
// showing a loading/welcome state until modal completes.
```

**WaitingForClaimsScreen removal** (lines 18 and 367–369):
```typescript
// Remove import at line 18:
// import { WaitingForClaimsScreen } from '@/components/split/WaitingForClaimsScreen'

// Remove render at lines 367–369:
// if (phase === 'waiting') { return <WaitingForClaimsScreen /> }
// Delete WaitingForClaimsScreen.tsx (no tests reference it directly)
```

**Unclaimed warning Dialog** (new — follows `AppHeader.tsx` confirm-reset Dialog pattern, lines 116–139):
```typescript
// Uses Dialog + DialogContent + DialogFooter (same as AppHeader confirm reset)
// Content: "{unclaimed} items unclaimed — totals will be off"
//          + ShareLinkButton or copy-link inline (D-11)
//          + "Continue anyway" button → calls original done fetch + setPhase('tip')
```

---

## Shared Patterns

### SWR Optimistic Update
**Source:** `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 155–208 (`handleQtyChange`)
**Apply to:** `handleShareChange` in `CollaborativeClaimingView.tsx`
```typescript
// Pattern: spread claimsForItem → build optimistic SessionPayload → mutate(async fn, {optimisticData, rollbackOnError: true, revalidate: true})
// Error catch: setItemErrors((prev) => ({ ...prev, [itemId]: claimErrorMessage(err, 'save') }))
```

### Lua Redis Eval
**Source:** `app/api/session/[sessionId]/claim/route.ts` lines 141–157
**Apply to:** `SHARE_CLAIM_SCRIPT` in `claim/route.ts`, `ADD_PERSON_SCRIPT` in `edit/route.ts`
```typescript
const result = await redis.eval(SCRIPT, [`session:${sessionId}`], [...ARGV])
if (result === 'session_not_found') return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
if (result === 'invalid_session') return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
```

### localStorage Identity Persistence
**Source:** `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 82–112
**Apply to:** identity modal open logic + `handleAddPerson` in `CollaborativeClaimingView.tsx`
```typescript
// Write: localStorage.setItem(`split:${sessionId}:personId`, personId)
// Read: localStorage.getItem(`split:${sessionId}:personId`)
// Always wrapped in try/catch (private browsing guard)
```

### Avatar Color Lookup
**Source:** `components/split/ClaimableItemCard.tsx` lines 154–158, `CollaborativeClaimingView.tsx` lines 380–384
**Apply to:** `BillViewHeader.tsx` people strip, `IdentityModal.tsx` slot avatars
```typescript
const colorClass = AVATAR_COLORS[(person?.colorIndex ?? 0) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]
```

### Dialog Pattern (controlled, with optional dismiss block)
**Source:** `components/wizard/DisambiguationDialog.tsx` lines 165–170, `components/wizard/AppHeader.tsx` lines 116–139
**Apply to:** `IdentityModal.tsx`, unclaimed warning dialog in `CollaborativeClaimingView.tsx`
```typescript
// DisambiguationDialog: onOpenChange={(nextOpen) => { if (!nextOpen) onOpenChange(false) }}
// AppHeader: open={confirmReset} onOpenChange={setConfirmReset}
// IdentityModal: block onOpenChange(false) when allowClose === false
```

### Error Message Formatting
**Source:** `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 27–32 (`claimErrorMessage`)
**Apply to:** `handleShareChange`, `handleAddPerson` error paths
```typescript
function claimErrorMessage(err: unknown, type: 'save' | 'submit'): string {
  if (!navigator.onLine || err instanceof TypeError) {
    return "You're offline — reconnect and tap to retry"
  }
  return type === 'save' ? "Couldn't save — tap to retry" : "Couldn't submit — tap to retry"
}
```

### API Route Validation Structure
**Source:** `app/api/session/[sessionId]/edit/route.ts` lines 16–73 (`validateOp`)
**Apply to:** `add_person` validation in `edit/route.ts`, `share` action validation in `claim/route.ts`
```typescript
// Pattern: validateOp(op, b, session) returns { ok: true } | { ok: false; error: string }
// Caller checks: if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })
```

### Test Mock Structure (route tests)
**Source:** `__tests__/editRoute.test.ts` lines 1–38, `__tests__/sessionClaimRoute.test.ts` lines 1–38
**Apply to:** new test cases for `add_person` op, `share` action
```typescript
// Pattern: set env vars before imports, mock @upstash/redis, beforeEach reset mocks,
// callPOST helper creates Request + calls imported POST handler directly
```

### Test Mock Structure (component tests)
**Source:** `__tests__/CollaborativeClaimingView.test.tsx` lines 1–64
**Apply to:** new test cases for IDENT-01/02/03, CLAIM-02/05/06, D-12
```typescript
// Pattern: vi.mock('swr'), useSWRMock.mockReturnValue({ data: SESSION_FIXTURE, ... }),
// selectAlice() helper to reach claiming view, vi.stubGlobal('fetch', ...) per test
```

---

## No Analog Found

All files have close matches in the codebase.

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| — | — | — | No gaps |

---

## Metadata

**Analog search scope:** `app/`, `components/`, `lib/`, `stores/`, `__tests__/`
**Files scanned:** 13 source files + 4 test files read directly
**Pattern extraction date:** 2026-06-06
