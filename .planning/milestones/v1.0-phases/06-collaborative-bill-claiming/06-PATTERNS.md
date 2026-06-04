# Phase 6: Collaborative Bill Claiming — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 22 (new/modified files)
**Analogs found:** 22 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/api/session/route.ts` | route-handler | request-response | `app/api/session/route.ts` (self — rewrite) | exact |
| `app/api/session/[sessionId]/route.ts` | route-handler | request-response | `app/api/session/[sessionId]/route.ts` (self — extend) | exact |
| `app/api/session/[sessionId]/claim/route.ts` | route-handler | request-response | `app/api/session/[sessionId]/claim/route.ts` (self — rewrite) | exact |
| `app/api/session/[sessionId]/done/route.ts` | route-handler | request-response | `app/api/session/[sessionId]/done/route.ts` (self — extend) | exact |
| `app/api/session/[sessionId]/tip/route.ts` | route-handler | request-response | `app/api/session/[sessionId]/done/route.ts` | role-match |
| `app/api/session/[sessionId]/edit-request/route.ts` | route-handler | request-response | `app/api/session/[sessionId]/claim/route.ts` | role-match |
| `app/api/session/[sessionId]/resolve-edit/route.ts` | route-handler | request-response | `app/api/session/[sessionId]/claim/route.ts` | role-match |
| `app/api/session/[sessionId]/dispute/route.ts` | route-handler | request-response | `app/api/session/[sessionId]/done/route.ts` | role-match |
| `app/api/session/[sessionId]/resolve-dispute/route.ts` | route-handler | request-response | `app/api/session/[sessionId]/done/route.ts` | role-match |
| `app/split/[sessionId]/page.tsx` | page | request-response | `app/split/[sessionId]/page.tsx` (self — rewrite) | exact |
| `app/split/[sessionId]/CollaborativeClaimingView.tsx` | component | event-driven + polling | `app/split/[sessionId]/GuestClaimingView.tsx` | exact |
| `components/split/PersonSlotPicker.tsx` | component | event-driven | `components/split/PersonSlotPicker.tsx` (self — simplify) | exact |
| `components/split/ClaimableItemCard.tsx` | component | event-driven | `components/split/ClaimableItemCard.tsx` (self — extend) | exact |
| `components/split/HostPanel.tsx` | component | event-driven + polling | `app/split/[sessionId]/GuestClaimingView.tsx` | role-match |
| `components/split/PersonDoneReviewScreen.tsx` | component | event-driven | `components/split/GuestDoneScreen.tsx` | role-match |
| `components/split/PersonTipScreen.tsx` | component | event-driven | `components/split/GuestDoneScreen.tsx` | role-match |
| `components/split/PersonResultsScreen.tsx` | component | request-response | `components/split/GuestDoneScreen.tsx` | exact |
| `lib/sessionSchema.ts` | model | — | `lib/sessionSchema.ts` (self — extend) | exact |
| `lib/billMath.ts` | utility | transform | `lib/billMath.ts` (self — extend) | exact |
| `stores/useBillStore.ts` | store | event-driven | `stores/useBillStore.ts` (self — update) | exact |
| `components/wizard/ShareLinkButton.tsx` | component | request-response | `components/wizard/ShareLinkButton.tsx` (self — update) | exact |
| `components/wizard/WizardShell.tsx` | component | event-driven | `components/wizard/WizardShell.tsx` (self — update) | exact |

---

## Pattern Assignments

### `app/api/session/route.ts` (route-handler, request-response) — REWRITE

**Analog:** `app/api/session/route.ts` (current file, lines 1–76)

**Imports pattern** (lines 1–5):
```typescript
import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'
import type { Person, Item } from '@/stores/useBillStore'
```

**Validation pattern** (lines 9–34):
```typescript
function isValidPeople(v: unknown): v is Person[] {
  if (!Array.isArray(v)) return false
  return v.every((p) => {
    if (!p || typeof p !== 'object') return false
    const r = p as Record<string, unknown>
    return (
      typeof r.id === 'string' &&
      typeof r.name === 'string' &&
      typeof r.colorIndex === 'number'
    )
  })
}
```

**Core creation pattern** (lines 61–75):
```typescript
const sessionId = nanoid()
const payload: SessionPayload = {
  people: b.people,
  items: b.items,
  tipPercent,
  claims: { items: {}, personSlots: {}, donePeople: {} },
  createdAt: Date.now(),
}
await redis.set(`session:${sessionId}`, JSON.stringify(payload), { ex: 86400 })
return NextResponse.json({ sessionId })
```

**Phase 6 changes:** Remove `tipPercent` validation. Add `hostToken = nanoid()` generation. Store `hostToken` in payload. Return `{ sessionId, hostToken }`. Add `tips: {}`, `editRequests: {}`, `disputes: {}`, `hostPersonId: undefined` to initial payload.

**Error handling pattern** (lines 72–75):
```typescript
} catch (err) {
  console.error('Session create error:', err)
  return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
}
```

---

### `app/api/session/[sessionId]/claim/route.ts` (route-handler, request-response) — REWRITE

**Analog:** `app/api/session/[sessionId]/claim/route.ts` (current file, lines 1–86)

**Imports pattern** (lines 1–4):
```typescript
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'
```

**Validation pattern** (lines 7–26):
```typescript
type ClaimBody = {
  personId: string
  action: 'item' | 'slot'
  itemId?: string
}

function validateBody(b: unknown): { ok: true; body: ClaimBody } | { ok: false; error: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'Invalid body' }
  const r = b as Record<string, unknown>
  if (typeof r.personId !== 'string' || r.personId.length === 0) {
    return { ok: false, error: 'Invalid personId' }
  }
  // ...validate action, itemId...
  return { ok: true, body: r as unknown as ClaimBody }
}
```

**Phase 6 core pattern — Lua atomic write** (from RESEARCH.md):
```typescript
// CRITICAL: Replace redis.multi() with redis.eval() for atomic read-modify-write
const CLAIM_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return redis.error_reply('session_not_found') end
local ok, session = pcall(cjson.decode, raw)
if not ok then return redis.error_reply('invalid_session') end

local itemId = ARGV[1]
local personId = ARGV[2]
local qty = tonumber(ARGV[3])
local assignedBy = ARGV[4]

if not session.claims then session.claims = {} end
if not session.claims.items then session.claims.items = {} end
if not session.claims.items[itemId] then session.claims.items[itemId] = {} end

if qty == 0 then
  session.claims.items[itemId][personId] = nil
else
  session.claims.items[itemId][personId] = {qty=qty, assignedBy=assignedBy}
end

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

const result = await redis.eval(
  CLAIM_SCRIPT,
  [`session:${sessionId}`],
  [itemId, personId, String(qty), assignedBy]
)
if (result === 'session_not_found') {
  return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
}
```

**Anti-pattern to avoid — current Phase 4 code that MUST NOT be copied:**
```typescript
// DO NOT copy this pattern — multi() is NOT atomic read-modify-write
const tx = redis.multi()
tx.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
await tx.exec()
```

**Error handling pattern** (lines 83–85):
```typescript
} catch (err) {
  console.error('Claim error:', err)
  return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
}
```

---

### `app/api/session/[sessionId]/tip/route.ts` (route-handler, request-response) — NEW

**Analog:** `app/api/session/[sessionId]/done/route.ts` (lines 1–46)

**Imports + handler signature pattern** (lines 1–12):
```typescript
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'

export const maxDuration = 10

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
```

**Inline validation pattern** (lines 19–25):
```typescript
const personId =
  body && typeof body === 'object' && 'personId' in body
    ? (body as { personId: unknown }).personId
    : undefined
if (typeof personId !== 'string' || personId.length === 0) {
  return NextResponse.json({ error: 'Invalid personId' }, { status: 400 })
}
```

**Core write pattern** (lines 27–44):
```typescript
const session = await redis.get<SessionPayload>(`session:${sessionId}`)
if (!session) {
  return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
}
const updated: SessionPayload = {
  ...session,
  tips: { ...(session.tips ?? {}), [personId]: tipCents },
}
await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
return NextResponse.json({ ok: true })
```

**Phase 6 additional validation:** `tipCents` must be `typeof number`, `>= 0`, integer. Extract from body alongside `personId`. Validate `personId` exists in `session.people` before writing.

---

### `app/api/session/[sessionId]/edit-request/route.ts` (route-handler, request-response) — NEW

**Analog:** `app/api/session/[sessionId]/done/route.ts` (full file, lines 1–46)

**Core pattern** — same GET→validate→mutate→SET flow as `done/route.ts`, but with richer body:
```typescript
// Body: { personId, type: 'add'|'remove'|'edit_price'|'edit_name', payload: {...} }
// Write: session.editRequests[nanoid()] = { personId, type, payload, status: 'pending', createdAt: Date.now() }
```

**Imports addition** — add `nanoid`:
```typescript
import { nanoid } from 'nanoid'
```

**Validation:** Whitelist `type` against `['add', 'remove', 'edit_price', 'edit_name']`. For `'add'`, require `payload.name` (string) and `payload.priceCents` (positive integer). For `'remove'`, `'edit_price'`, `'edit_name'`, require `payload.itemId` — validate it exists in `session.items`.

---

### `app/api/session/[sessionId]/resolve-edit/route.ts` (route-handler, request-response) — NEW

**Analog:** `app/api/session/[sessionId]/claim/route.ts` (lines 44–85) — GET session then apply compound mutation

**Security pattern:** Validate `hostToken` from body against `session.hostToken`. Return 403 if missing/invalid:
```typescript
const hostToken = r.hostToken
if (typeof hostToken !== 'string' || session.hostToken !== hostToken) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

**Core write:** For `'approved'`:
1. Set `session.editRequests[requestId].status = 'approved'`
2. Apply the item mutation to `session.items` (add/remove/update name or price)
3. For `'remove'`, also delete `session.claims.items[itemId]`
4. Write back via `redis.set()`

For `'rejected'`: only update status field.

---

### `app/api/session/[sessionId]/dispute/route.ts` (route-handler, request-response) — NEW

**Analog:** `app/api/session/[sessionId]/done/route.ts` (full file, lines 1–46)

**Core pattern** — same GET→validate→SET flow:
```typescript
// Body: { personId, itemId }
// Validate itemId exists in session.items; personId exists in session.people
// Write: session.disputes[nanoid()] = { itemId, personId, status: 'pending', createdAt: Date.now() }
```

---

### `app/api/session/[sessionId]/resolve-dispute/route.ts` (route-handler, request-response) — NEW

**Analog:** `app/api/session/[sessionId]/claim/route.ts` (lines 44–85)

**Security pattern:** Same `hostToken` validation as `resolve-edit/route.ts` above (copy identical pattern).

**Core write:**
- `'resolved'` + reassignment: update `session.claims.items[itemId][personId]` to new assignee, set `disputes[disputeId].status = 'resolved'`
- `'rejected'` (confirmed original): set `disputes[disputeId].status = 'rejected'`
- Use Lua script for the reassignment path (same atomic concern as claim route)

---

### `app/split/[sessionId]/page.tsx` (page, request-response) — REWRITE

**Analog:** `app/split/[sessionId]/page.tsx` (current file, lines 1–10)

**Current pattern** (lines 1–10):
```typescript
import { GuestClaimingView } from './GuestClaimingView'

export default async function SplitPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  return <GuestClaimingView sessionId={sessionId} />
}
```

**Phase 6 pattern** — add `searchParams` for hostToken (from RESEARCH.md Pattern 4):
```typescript
import { CollaborativeClaimingView } from './CollaborativeClaimingView'

export default async function SplitPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ hostToken?: string }>
}) {
  const { sessionId } = await params
  const { hostToken } = await searchParams
  return <CollaborativeClaimingView sessionId={sessionId} hostTokenParam={hostToken ?? null} />
}
```

---

### `app/split/[sessionId]/CollaborativeClaimingView.tsx` (component, event-driven + polling) — REWRITE

**Analog:** `app/split/[sessionId]/GuestClaimingView.tsx` (full file, lines 1–191)

**Imports pattern** (lines 1–12):
```typescript
'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { Button } from '@/components/ui/button'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import type { SessionPayload } from '@/lib/sessionSchema'
import type { ItemId, PersonId, Person } from '@/stores/useBillStore'
import { PersonSlotPicker } from '@/components/split/PersonSlotPicker'
import { ClaimableItemCard } from '@/components/split/ClaimableItemCard'
```

**SWR polling pattern** (lines 14–32):
```typescript
const fetcher = (url: string): Promise<SessionPayload> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('session_not_found')
    return r.json()
  })

const swrKey = `/api/session/${sessionId}`
const { data: session, error } = useSWR<SessionPayload>(swrKey, fetcher, {
  refreshInterval: 3000,
  revalidateOnFocus: false,
})
```

**isHost derivation pattern** (from RESEARCH.md Pattern 4):
```typescript
const isHost = useMemo(
  () => hostTokenParam !== null && session?.hostToken === hostTokenParam,
  [hostTokenParam, session?.hostToken]
)
```

**Phase 6 optimistic update pattern** — replace `optimisticClaims` local state with SWR bound mutate (from RESEARCH.md Pattern 2):
```typescript
// Replace this Phase 4 pattern:
// const [optimisticClaims, setOptimisticClaims] = useState<Record<ItemId, PersonId | null>>({})

// With SWR bound mutate:
const { data: session, mutate } = useSWR<SessionPayload>(swrKey, fetcher, {
  refreshInterval: 3000,
  revalidateOnFocus: false,
})

async function handleClaimQty(itemId: string, newQty: number) {
  const optimistic: SessionPayload = {
    ...session!,
    claims: {
      ...session!.claims,
      items: {
        ...session!.claims.items,
        [itemId]: {
          ...session!.claims.items?.[itemId],
          [personId]: { qty: newQty, assignedBy: 'self' },
        },
      },
    },
  }
  await mutate(
    async () => {
      const res = await fetch(`/api/session/${sessionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, itemId, qty: newQty }),
      })
      if (!res.ok) throw new Error('claim_failed')
      return fetcher(swrKey)
    },
    { optimisticData: optimistic, rollbackOnError: true, revalidate: true }
  )
}
```

**Error + loading guards** (lines 44–45):
```typescript
if (error) return <SessionExpiredScreen />
if (!session) return <div role="status" className="p-6">Loading…</div>
```

**Fixed bottom bar pattern** (lines 178–188):
```typescript
<div
  className="fixed bottom-0 left-0 right-0 border-t border-border bg-background px-6 py-4"
  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
>
  <Button onClick={handleDone} className="h-12 w-full bg-amber-600 hover:bg-amber-700">
    I&rsquo;m done
  </Button>
</div>
```

**Layout shell pattern** (lines 122–127):
```typescript
<main className="mx-auto min-h-screen max-w-[480px] bg-background">
  {/* Fixed header */}
  <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background px-6">
    ...
  </header>
  <ul className="flex flex-col gap-2 px-6 py-4 pb-[80px]">...</ul>
</main>
```

---

### `components/split/PersonSlotPicker.tsx` (component, event-driven) — SIMPLIFY

**Analog:** `components/split/PersonSlotPicker.tsx` (full file, lines 1–53)

**Props interface pattern** (lines 8–11):
```typescript
interface PersonSlotPickerProps {
  session: SessionPayload
  onSelect: (personId: PersonId) => void | Promise<void>
}
```

**Card grid pattern** (lines 21–50):
```typescript
<ul className="grid grid-cols-2 gap-3">
  {session.people.map((person) => {
    const taken = slots[person.id] === true
    return (
      <li key={person.id}>
        <Card
          role="button"
          aria-label={taken ? `${person.name} (taken)` : `Claim slot ${person.name}`}
          aria-disabled={taken || undefined}
          onClick={() => { if (!taken) onSelect(person.id) }}
          className={[
            'flex min-h-[72px] flex-col items-center justify-center gap-2 px-3 py-4 transition-opacity',
            taken ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex]}`}>
            {person.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[16px]">{person.name}...</span>
        </Card>
      </li>
    )
  })}
</ul>
```

**Phase 6 change:** Remove the `taken by host` special treatment (D-13). The `taken` check stays (`slots[person.id] === true`), but there is no concept of a pre-locked first slot. No other structural changes needed.

---

### `components/split/ClaimableItemCard.tsx` (component, event-driven) — EXTEND

**Analog:** `components/split/ClaimableItemCard.tsx` (full file, lines 1–80)

**Props interface pattern** (lines 9–16):
```typescript
interface ClaimableItemCardProps {
  item: Item
  claimedBy: PersonId | undefined
  myPersonId: PersonId
  peopleById: Record<PersonId, Person>
  onTap: () => void
  hasError?: boolean
}
```

**Phase 6 new props to add:**
```typescript
interface ClaimableItemCardProps {
  item: Item                          // item.quantity: number (default 1) — NEW
  claimsForItem: Record<PersonId, { qty: number; assignedBy: 'self' | 'host' }>  // NEW — replaces single claimedBy
  myPersonId: PersonId
  peopleById: Record<PersonId, Person>
  onQtyChange: (newQty: number) => void  // NEW — replaces onTap toggle
  hasError?: boolean
}
```

**Card shell pattern** (lines 31–45):
```typescript
<Card
  role="button"
  aria-label={...}
  onClick={() => { if (!takenByOther) onTap() }}
  className={[
    'flex min-h-[44px] flex-col gap-1 px-4 py-3 transition-colors',
    takenByOther ? 'opacity-50 pointer-events-none' : 'cursor-pointer',
    mine ? 'bg-amber-50' : '',
  ].join(' ')}
>
```

**Error display pattern** (lines 75–77):
```typescript
{hasError && (
  <span className="text-sm text-red-600">Couldn&apos;t save — tap to retry</span>
)}
```

**Phase 6 stepper addition:** When `item.quantity > 1`, show inline `[−] N [+]` stepper instead of toggle. Stepper range: `[0, item.quantity]`. When `item.quantity === 1`, keep existing toggle behavior (qty is 0 or 1). Multi-claimant list: show avatars for all `Object.entries(claimsForItem)` with non-zero qty (below the item name row).

---

### `components/split/HostPanel.tsx` (component, event-driven + polling) — NEW

**Analog:** `app/split/[sessionId]/GuestClaimingView.tsx` (structure/fetch pattern, lines 46–119)

**Section structure** — use tabs or accordion (Claude's discretion per CONTEXT.md). Three sections:
1. Unclaimed units (items where `sum(claims) < item.quantity`)
2. Edit requests (entries in `session.editRequests` with `status: 'pending'`)
3. Disputes (entries in `session.disputes` with `status: 'pending'`)

**Fetch-and-revalidate pattern** (from `GuestClaimingView.tsx` lines 69–87):
```typescript
async function handleApprove(requestId: string) {
  try {
    const res = await fetch(`/api/session/${sessionId}/resolve-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, decision: 'approved', hostToken }),
    })
    if (!res.ok) throw new Error(`resolve-edit returned ${res.status}`)
    await mutate(swrKey)  // trigger SWR revalidation — same pattern as handleItemTap
  } catch (err) {
    console.error('Approve error:', err)
    // surface inline error same as doneError pattern
  }
}
```

**Props interface:**
```typescript
interface HostPanelProps {
  session: SessionPayload
  sessionId: string
  hostToken: string
  mutate: () => void  // SWR revalidate trigger passed down from CollaborativeClaimingView
}
```

---

### `components/split/PersonDoneReviewScreen.tsx` (component, event-driven) — NEW

**Analog:** `components/split/GuestDoneScreen.tsx` (full file, lines 1–83)

**Layout pattern** (lines 46–76):
```typescript
<div className="flex flex-col gap-4 px-6 py-8">
  <h1 className="text-[20px] font-semibold leading-[1.2]">Review your items</h1>
  ...
  <ul className="flex flex-col gap-1">
    {hostAssignedItems.map((item) => (
      <li key={item.id} className="flex justify-between text-[14px]">
        <span>{item.name}</span>
        <span>{formatCents(item.priceCents)}</span>
      </li>
    ))}
  </ul>
  <Separator />
  <Button onClick={onAcceptAll} className="h-12 w-full bg-amber-600 hover:bg-amber-700">
    Accept all
  </Button>
</div>
```

**Props interface:**
```typescript
interface PersonDoneReviewScreenProps {
  session: SessionPayload
  personId: PersonId
  sessionId: string
  onAcceptAll: () => void     // navigate to tip screen
  onDispute: (itemId: ItemId) => void  // POST /dispute, show pending state
}
```

**Imports pattern** (lines 1–12 of GuestDoneScreen):
```typescript
'use client'

import { Separator } from '@/components/ui/separator'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import { formatCents } from '@/lib/billMath'
import type { SessionPayload } from '@/lib/sessionSchema'
import type { ItemId, PersonId } from '@/stores/useBillStore'
```

---

### `components/split/PersonTipScreen.tsx` (component, event-driven) — NEW

**Analog:** `components/split/GuestDoneScreen.tsx` (layout/display pattern, lines 29–83)

**Layout pattern:**
```typescript
<div className="flex flex-col gap-4 px-6 py-8">
  <h1 className="text-[20px] font-semibold leading-[1.2]">Add a tip</h1>
  {/* Tip input — starts at 0%, free entry */}
  <div className="flex flex-col gap-2">
    <span className="text-[28px] font-semibold text-amber-600">{formatCents(tipCents)}</span>
    <span className="text-[14px] text-zinc-500">Your tip</span>
  </div>
  <Separator />
  <Button onClick={handleConfirmTip} className="h-12 w-full bg-amber-600 hover:bg-amber-700">
    Confirm
  </Button>
</div>
```

**POST tip pattern** — copy `handleDone` from `GuestClaimingView.tsx` lines 104–119, adapted:
```typescript
async function handleConfirmTip() {
  setTipError(null)
  try {
    const res = await fetch(`/api/session/${sessionId}/tip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, tipCents }),
    })
    if (!res.ok) throw new Error(`tip route returned ${res.status}`)
    await mutate(swrKey)
    onTipConfirmed()
  } catch (err) {
    console.error('Tip submission failed:', err)
    setTipError("Couldn't save tip — tap to retry")
  }
}
```

---

### `components/split/PersonResultsScreen.tsx` (component, request-response) — replaces GuestDoneScreen

**Analog:** `components/split/GuestDoneScreen.tsx` (full file, lines 1–83)

**Avatar display pattern** (lines 48–55):
```typescript
<div className="flex items-center gap-3">
  <div
    className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex]}`}
    aria-hidden="true"
  >
    {person.name.charAt(0).toUpperCase()}
  </div>
  <div className="flex flex-col">
    <span className="text-[28px] font-semibold text-amber-600">{formatCents(total)}</span>
    <span className="text-[14px] text-zinc-500">Your share</span>
  </div>
</div>
```

**Line items pattern** (lines 62–75):
```typescript
<ul className="flex flex-col gap-1">
  {lineItems.map(({ item, shareCents }) => (
    <li key={item.id} className="flex justify-between text-[14px]">
      <span>{item.name}</span>
      <span>{formatCents(shareCents)}</span>
    </li>
  ))}
  <li className="flex justify-between text-[14px]">
    <span>Tip</span>
    <span>{formatCents(tipCents)}</span>
  </li>
</ul>
```

**Phase 6 math:** Use `computePersonShareFromClaims` (new export from `lib/billMath.ts`) instead of `computePersonTotals`. Remove `claimsToAssignments` helper. No tax row.

---

### `lib/sessionSchema.ts` (model) — EXTEND

**Analog:** `lib/sessionSchema.ts` (full file, lines 1–18)

**Current pattern** (lines 1–18):
```typescript
import type { Item, ItemId, Person, PersonId } from '@/stores/useBillStore'

export interface SessionClaims {
  items: Record<ItemId, PersonId>       // Phase 4 — single owner
  personSlots: Record<PersonId, boolean>
  donePeople: Record<PersonId, boolean>
}

export interface SessionPayload {
  people: Person[]
  items: Item[]
  tipPercent: number
  claims: SessionClaims
  createdAt: number
}
```

**Phase 6 replacement shape** (from RESEARCH.md Redis Data Model section):
```typescript
export interface ClaimEntry {
  qty: number
  assignedBy: 'self' | 'host'
}

export interface EditRequest {
  personId: PersonId
  type: 'add' | 'remove' | 'edit_price' | 'edit_name'
  payload: EditPayload
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

export interface Dispute {
  itemId: ItemId
  personId: PersonId
  status: 'pending' | 'resolved' | 'rejected'
  createdAt: number
}

export interface SessionClaims {
  items: Record<ItemId, Record<PersonId, ClaimEntry>>  // breaking change
  personSlots: Record<PersonId, boolean>
  donePeople: Record<PersonId, boolean>
}

export interface SessionPayload {
  people: Person[]
  items: Item[]          // Item gains quantity: number (in useBillStore.ts)
  claims: SessionClaims
  hostToken: string      // NEW
  hostPersonId?: string  // NEW
  tips: Record<PersonId, number>            // NEW (cents)
  editRequests: Record<string, EditRequest> // NEW
  disputes: Record<string, Dispute>         // NEW
  createdAt: number
  // tipPercent REMOVED (D-17)
}
```

---

### `lib/billMath.ts` (utility, transform) — EXTEND

**Analog:** `lib/billMath.ts` (full file, lines 1–66)

**Existing function signature pattern** (lines 32–37):
```typescript
export function computePersonTotals(
  people: Person[],
  items: Item[],
  assignments: Record<ItemId, PersonId[]>,
  tipPercent: number
): Record<PersonId, number> {
```

**Largest-remainder pattern** (lines 43–51) — reuse this exact algorithm in `computePersonShareFromClaims`:
```typescript
const base = Math.floor(item.priceCents / sharers.length)
const remainder = item.priceCents % sharers.length
sharers.forEach((pid, idx) => {
  if (totals[pid] === undefined) return
  totals[pid] += base + (idx < remainder ? 1 : 0)
})
```

**New export to add** (from RESEARCH.md billMath Changes section):
```typescript
export function computePersonShareFromClaims(
  personId: PersonId,
  items: Item[],
  claimsItems: Record<ItemId, Record<PersonId, { qty: number }>>,
  tipCents: number
): { itemSubtotal: number; tip: number; total: number; lineItems: Array<{ item: Item; shareCents: number }> } {
  const lineItems: Array<{ item: Item; shareCents: number }> = []
  let itemSubtotal = 0

  for (const item of items) {
    const claimsForItem = claimsItems[item.id] ?? {}
    const myQty = claimsForItem[personId]?.qty ?? 0
    if (myQty === 0) continue

    const totalQty = Object.values(claimsForItem).reduce((s, c) => s + c.qty, 0)
    if (totalQty === 0) continue  // guard division by zero

    const rawShare = (item.priceCents * myQty) / totalQty
    const shareCents = Math.round(rawShare)
    itemSubtotal += shareCents
    lineItems.push({ item, shareCents })
  }

  return { itemSubtotal, tip: tipCents, total: itemSubtotal + tipCents, lineItems }
}
```

**Keep unchanged:** `parseCents`, `formatCents`, `computeSubtotalCents`, `computeTipCents`, `computePersonTotals` (still used by wizard ResultsStep).

---

### `stores/useBillStore.ts` (store, event-driven) — UPDATE

**Analog:** `stores/useBillStore.ts` (full file, lines 1–133)

**Interface pattern** (lines 36–63):
```typescript
interface BillState {
  step: 1 | 2 | 3 | 4 | 5
  // ... fields
  setStep: (step: BillState['step']) => void
  // ... actions
}
```

**Store creation pattern** (lines 79–133):
```typescript
export const useBillStore = create<BillState>()((set) => ({
  ...INITIAL_STATE,
  setStep: (step) => set({ step }),
  // actions use (set) => ... or (get) inside set((s) => ...)
}))
```

**Item interface addition** (lines 31–34 — add `quantity`):
```typescript
export interface Item {
  id: ItemId
  name: string
  priceCents: number
  quantity: number          // NEW — default 1; treat undefined as 1 for existing items
  rawName?: string
  confidence?: 'high' | 'low' | 'ambiguous'
}
```

**Phase 6 changes:**
- Remove: `tipPercent` field, `setTipPercent` action, `syncStatus: 'waiting'` value
- Add: `hostToken: string | null`, `setHostToken: (token: string | null) => void`
- Change: `step: 1 | 2 | 3 | 4 | 5` → `step: 1 | 2 | 3 | 4`
- `INITIAL_STATE.tipPercent` removed; `INITIAL_STATE.hostToken = null` added

---

### `components/wizard/ShareLinkButton.tsx` (component, request-response) — UPDATE

**Analog:** `components/wizard/ShareLinkButton.tsx` (full file, lines 1–61)

**Abort controller pattern** (lines 14–28 — keep exactly):
```typescript
const abortRef = useRef<AbortController | null>(null)

useEffect(() => {
  return () => { abortRef.current?.abort() }
}, [])
```

**POST session pattern** (lines 27–35 — basis for rewrite):
```typescript
const res = await fetch('/api/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ people, items, tipPercent }),
  signal: abortRef.current.signal,
})
if (!res.ok) throw new Error(`Session creation failed: ${res.status}`)
const { sessionId } = (await res.json()) as { sessionId: string }
```

**Phase 6 redirect pattern** (from RESEARCH.md ShareLinkButton section):
```typescript
import { useRouter } from 'next/navigation'

// After POST returns { sessionId, hostToken }:
const { sessionId, hostToken } = (await res.json()) as { sessionId: string; hostToken: string }
setSessionId(sessionId)
setHostToken(hostToken)           // NEW — store hostToken in zustand
// Host navigates to session page with token
router.push(`/split/${sessionId}?hostToken=${hostToken}`)
// Guest share URL — no token — only this goes to clipboard
const guestUrl = `${window.location.origin}/split/${sessionId}`
```

**Error display pattern** (lines 56–59 — keep):
```typescript
{sessionError && (
  <span className="mt-1 text-red-600 text-sm">{sessionError}</span>
)}
```

---

### `components/wizard/WizardShell.tsx` (component, event-driven) — UPDATE

**Analog:** `components/wizard/WizardShell.tsx` (full file, lines 1–53)

**STEP_LABELS pattern** (line 10 — must be updated atomically with step type):
```typescript
// Current (5 steps):
const STEP_LABELS = ['Add People', 'Add Items', 'Assign / Share', 'Tip', 'Results']

// Phase 6 (4 steps):
const STEP_LABELS = ['Add People', 'Add Items', 'Assign / Share', 'Results']
```

**Hash sync pattern** (lines 17–37 — keep structure, update range):
```typescript
// Change: match(/#step-([1-5])/) → match(/#step-([1-4])/)
// Change: num >= 1 && num <= 5 → num >= 1 && num <= 4
// Change: setStep(num as 1 | 2 | 3 | 4 | 5) → setStep(num as 1 | 2 | 3 | 4)
```

---

## Shared Patterns

### Route Handler Structure
**Source:** `app/api/session/[sessionId]/done/route.ts` (lines 1–46)
**Apply to:** All new route handlers (`tip`, `edit-request`, `resolve-edit`, `dispute`, `resolve-dispute`)

```typescript
export const maxDuration = 10

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ... inline validation ...

  try {
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }
    // ... mutate session ...
    await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[route] error:', err)
    return NextResponse.json({ error: '[route] failed' }, { status: 500 })
  }
}
```

### Host Token Auth Guard
**Source:** RESEARCH.md Security Domain (pattern described but not yet in codebase)
**Apply to:** `resolve-edit/route.ts`, `resolve-dispute/route.ts`, any future host-only route

```typescript
// After redis.get(session), before mutation:
const hostToken = r.hostToken
if (typeof hostToken !== 'string' || hostToken.length === 0 || session.hostToken !== hostToken) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### SWR Session Polling
**Source:** `app/split/[sessionId]/GuestClaimingView.tsx` (lines 14–32)
**Apply to:** `CollaborativeClaimingView.tsx`, `HostPanel.tsx` (via props)

```typescript
const fetcher = (url: string): Promise<SessionPayload> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('session_not_found')
    return r.json()
  })

const swrKey = `/api/session/${sessionId}`
const { data: session, error, mutate } = useSWR<SessionPayload>(swrKey, fetcher, {
  refreshInterval: 3000,
  revalidateOnFocus: false,
})
```

### Avatar Display
**Source:** `components/split/GuestDoneScreen.tsx` (lines 48–55) and `GuestClaimingView.tsx` (lines 144–151)
**Apply to:** `CollaborativeClaimingView.tsx`, `PersonResultsScreen.tsx`, `PersonDoneReviewScreen.tsx`, `PersonTipScreen.tsx`

```typescript
<div
  className={`flex h-8 w-8 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[me.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
  aria-hidden="true"
>
  {me.name.charAt(0).toUpperCase()}
</div>
```

### Error Inline Display
**Source:** `app/split/[sessionId]/GuestClaimingView.tsx` (line 181–183)
**Apply to:** All client components with async actions (`CollaborativeClaimingView`, `PersonTipScreen`, `HostPanel`)

```typescript
{doneError && (
  <p className="mb-2 text-center text-sm text-red-600">{doneError}</p>
)}
```

### Safe Area Bottom Padding
**Source:** `app/split/[sessionId]/GuestClaimingView.tsx` (lines 178–180)
**Apply to:** Any component with a fixed bottom bar

```typescript
style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
```

---

## Test Patterns

### Route Handler Test Structure
**Source:** `__tests__/sessionDoneRoute.test.ts` (full file, lines 1–71)
**Apply to:** All new route test files (`tipRoute`, `editRequestRoute`, `resolveEditRoute`, `disputeRoute`, `resolveDisputeRoute`)

```typescript
// Set env vars BEFORE any module import
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockEval = vi.fn()   // ADD for Phase 6 routes that use Lua

vi.mock('@upstash/redis', () => ({
  Redis: class {
    get = mockGet
    set = mockSet
    eval = mockEval          // NEW for Lua routes
    multi = vi.fn().mockReturnValue({ set: vi.fn(), exec: vi.fn() })
  },
}))

beforeEach(() => {
  vi.resetModules()
  mockGet.mockReset()
  mockSet.mockReset()
  mockEval.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function callPOSTWithParams(sessionId: string, body: unknown) {
  const { POST } = await import('@/app/api/session/[sessionId]/ROUTE_NAME/route')
  const req = new Request(`http://localhost/api/session/${sessionId}/ROUTE_NAME`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const params = Promise.resolve({ sessionId })
  const res = await POST(req, { params })
  return { status: res.status, json: await res.json() }
}
```

### Component Test Structure (with SWR mock)
**Source:** `__tests__/GuestClaimingView.test.tsx` (full file, lines 1–82)
**Apply to:** `CollaborativeClaimingView.test.tsx`, `PersonTipScreen.test.tsx`, `HostPanel.test.tsx`

```typescript
const mutateMock = vi.fn()
const useSWRMock = vi.fn()
vi.mock('swr', () => ({
  default: (...args: unknown[]) => useSWRMock(...args),
  mutate: (...args: unknown[]) => mutateMock(...args),
}))

// In beforeEach:
useSWRMock.mockReturnValue({ data: SESSION_FIXTURE, error: undefined, mutate: mutateMock })
mutateMock.mockResolvedValue(undefined)
```

**Critical:** For Phase 6 bound mutate, ensure mock returns `mutate` in the object — `useSWRMock.mockReturnValue({ data: ..., error: ..., mutate: mutateMock })`. This is the existing pattern; it correctly intercepts bound mutate calls.

### Session Fixture Pattern
**Source:** `__tests__/sessionClaimRoute.test.ts` (lines 47–53), `__tests__/GuestClaimingView.test.tsx` (lines 14–30)
**Apply to:** All Phase 6 test files

Phase 6 base session fixture shape (replaces Phase 4 fixture):
```typescript
const baseSession = {
  people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }, { id: 'p2', name: 'Bob', colorIndex: 1 }],
  items: [{ id: 'i1', name: 'Burger', priceCents: 1299, quantity: 1 }],
  claims: { items: {}, personSlots: {}, donePeople: {} },
  hostToken: 'host-token-abc',
  hostPersonId: undefined,
  tips: {},
  editRequests: {},
  disputes: {},
  createdAt: Date.now(),
}
```

---

## No Analog Found

All files have analogs in the existing codebase. No files require falling back to RESEARCH.md patterns exclusively. However, the following patterns in new files have NO direct code precedent and must be built from RESEARCH.md specifications:

| Pattern | Used In | Research Source |
|---------|---------|----------------|
| Lua `redis.eval()` claim write | `claim/route.ts` (rewrite) | RESEARCH.md Pattern 1 + Code Examples |
| SWR `optimisticData` bound mutate | `CollaborativeClaimingView.tsx` | RESEARCH.md Pattern 2 |
| Host token `403` guard | `resolve-edit/route.ts`, `resolve-dispute/route.ts` | RESEARCH.md Security Domain |
| Qty stepper UI (`[−] N [+]`) | `ClaimableItemCard.tsx` (extend) | CONTEXT.md D-04 (Claude's discretion on exact UI) |
| Dispute pending display | `PersonDoneReviewScreen.tsx` | CONTEXT.md (Claude's discretion) |

---

## Metadata

**Analog search scope:** `app/api/session/`, `app/split/`, `components/split/`, `components/wizard/`, `lib/`, `stores/`, `__tests__/`
**Files scanned:** 30
**Pattern extraction date:** 2026-05-26
