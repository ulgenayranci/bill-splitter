# Phase 4: Shareable Links - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 15 (11 from prompt + 4 component files inferred from RESEARCH.md structure)
**Analogs found:** 13 / 15

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/redis.ts` | utility/config | request-response | `lib/billMath.ts` (module singleton pattern) | partial |
| `app/api/session/route.ts` | route handler | request-response | `app/api/ocr/route.ts` | exact |
| `app/api/session/[sessionId]/route.ts` | route handler | request-response | `app/api/expand/route.ts` | role-match |
| `app/api/session/[sessionId]/claim/route.ts` | route handler | request-response | `app/api/ocr/route.ts` | role-match |
| `app/api/session/[sessionId]/done/route.ts` | route handler | request-response | `app/api/expand/route.ts` | role-match |
| `app/split/[sessionId]/page.tsx` | page (Server Component shell) | request-response | `app/page.tsx` | partial |
| `stores/useBillStore.ts` | store | event-driven | `stores/useBillStore.ts` (self) | exact (modify) |
| `components/wizard/WizardShell.tsx` | component | event-driven | `components/wizard/WizardShell.tsx` (self) | exact (modify) |
| `components/wizard/AssignItemsStep.tsx` | component | event-driven | `components/wizard/AssignItemsStep.tsx` (self) | exact (modify) |
| `components/wizard/SetTipStep.tsx` | component | event-driven | `components/wizard/SetTipStep.tsx` (self) | exact (modify) |
| `components/wizard/ResultsStep.tsx` | component | event-driven | `components/wizard/ResultsStep.tsx` (self) | exact (modify) |
| `components/wizard/ShareLinkButton.tsx` | component | request-response | `components/wizard/AddItemsStep.tsx` (fetch + loading state) | role-match |
| `components/wizard/HostWaitingScreen.tsx` | component | event-driven (polling) | `components/wizard/OcrLoadingOverlay.tsx` (waiting UI) | partial |
| `components/split/PersonSlotPicker.tsx` | component | request-response | `components/wizard/AddPeopleStep.tsx` (person list) | role-match |
| `components/split/ClaimableItemCard.tsx` | component | event-driven | `components/wizard/AssignItemsStep.tsx` (item card with toggle) | role-match |
| `components/split/GuestDoneScreen.tsx` | component | request-response | `components/wizard/ResultsStep.tsx` (per-person total) | role-match |
| `components/split/SessionExpiredScreen.tsx` | component | — | `components/wizard/OcrLoadingOverlay.tsx` (fullscreen overlay) | partial |

---

## Pattern Assignments

### `lib/redis.ts` (utility, singleton)

**Analog:** `lib/billMath.ts` (module-level singleton export pattern)

**Imports pattern** (`lib/billMath.ts` lines 1):
```typescript
import type { Item, ItemId, Person, PersonId } from '@/stores/useBillStore'
```

**Core pattern — Redis singleton** (from RESEARCH.md Pattern 1):
```typescript
// lib/redis.ts
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
// Alternatively: export const redis = Redis.fromEnv()
```

**Env var security note:** Never prefix with `NEXT_PUBLIC_`. Follow the same pattern as `OPENAI_API_KEY` in `app/api/ocr/route.ts` line 6 — server-side only.

**No test file** — validated by route handler tests mocking `@upstash/redis` at the module level (see Shared Patterns > Test Mocking).

---

### `app/api/session/route.ts` (route handler, POST, request-response)

**Analog:** `app/api/ocr/route.ts`

**Imports pattern** (`app/api/ocr/route.ts` lines 1-2):
```typescript
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
```
For session route, substitute:
```typescript
import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'
```

**Input validation pattern** (`app/api/ocr/route.ts` lines 22-37):
```typescript
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const image =
    body && typeof body === 'object' && 'image' in body
      ? (body as { image: unknown }).image
      : undefined

  // ... field-level validation returns 400 with { error: '...' } ...
  if (typeof image !== 'string' || image.length > 10_000_000 || !DATA_URI_RE.test(image)) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }
```
Apply same 3-tier pattern to session POST: parse JSON → extract fields → validate types, return 400 on any failure.

**Core pattern** (`app/api/ocr/route.ts` lines 100-101):
```typescript
    return NextResponse.json({ items })
```
Session POST returns `NextResponse.json({ sessionId })`.

**Error handling pattern** (`app/api/ocr/route.ts` lines 101-105):
```typescript
  } catch (err) {
    // Log server-side only. Do NOT echo OpenAI internals to the client.
    console.error('OCR error:', err)
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  }
```
Same structure for session routes — log internally, return generic `{ error: '...' }` with status 500.

**No params needed** — this route is at `/api/session` (no dynamic segment). No `await params` pattern needed here.

---

### `app/api/session/[sessionId]/route.ts` (route handler, GET, request-response)

**Analog:** `app/api/expand/route.ts` (closest existing GET-style read that returns structured data)

**Critical Next.js 15 pattern — params as Promise** (RESEARCH.md Pattern 5):
```typescript
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params   // MUST await — Next.js 15 breaking change
  const session = await redis.get(`session:${sessionId}`)
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  return NextResponse.json(session)
}
```

**Error handling pattern** (`app/api/ocr/route.ts` lines 101-105):
```typescript
  } catch (err) {
    console.error('Session GET error:', err)
    return NextResponse.json({ error: 'Session not found' }, { status: 500 })
  }
```

---

### `app/api/session/[sessionId]/claim/route.ts` (route handler, POST, atomic write)

**Analog:** `app/api/ocr/route.ts` (POST with input validation + try/catch error handling)

**Imports pattern:**
```typescript
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'
```

**Params pattern** (same as GET above — both nested under `[sessionId]`):
```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params   // MUST await
```

**Input validation pattern** (`app/api/ocr/route.ts` lines 22-27):
```typescript
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  // Then extract and validate: personId (string), itemId (string), action ('claim'|'slot')
```

**Core atomic claim pattern** (RESEARCH.md Pattern 4):
```typescript
  const raw = await redis.get<string>(`session:${sessionId}`)
  if (!raw) return NextResponse.json({ error: 'session_not_found' }, { status: 404 })

  const session: SessionPayload = JSON.parse(raw as string)
  const currentOwner = session.claims.items[itemId]
  if (currentOwner && currentOwner !== personId) {
    return NextResponse.json({ ok: false, reason: 'conflict', takenBy: currentOwner })
  }

  // Toggle claim/un-claim (D-09)
  const updatedSession = { ...session }
  if (currentOwner === personId) {
    delete updatedSession.claims.items[itemId]
  } else {
    updatedSession.claims.items[itemId] = personId
  }

  const tx = redis.multi()
  tx.set(`session:${sessionId}`, JSON.stringify(updatedSession), { ex: 86400 })
  await tx.exec()

  return NextResponse.json({ ok: true })
```

**Error handling pattern** (`app/api/ocr/route.ts` lines 101-105):
```typescript
  } catch (err) {
    console.error('Claim error:', err)
    return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  }
```

---

### `app/api/session/[sessionId]/done/route.ts` (route handler, POST, simple write)

**Analog:** `app/api/expand/route.ts` (POST that transforms and writes data)

**Params pattern:** Same `await params` pattern as claim route above.

**Core pattern** (simpler than claim — no conflict check, just flag):
```typescript
  // Mark personId done in session.claims.donePeople
  const updatedSession = {
    ...session,
    claims: {
      ...session.claims,
      donePeople: { ...session.claims.donePeople, [personId]: true },
    },
  }
  await redis.set(`session:${sessionId}`, JSON.stringify(updatedSession), { ex: 86400 })
  return NextResponse.json({ ok: true })
```

**Error handling pattern** (`app/api/expand/route.ts` lines 131-134):
```typescript
  } catch (err) {
    console.error('Done error:', err)
    return NextResponse.json({ error: 'Done failed' }, { status: 500 })
  }
```

---

### `app/split/[sessionId]/page.tsx` (Server Component page, dynamic route)

**Analog:** `app/page.tsx`

**Pattern** (`app/page.tsx` lines 1-22):
```typescript
'use client'

import { useBillStore } from '@/stores/useBillStore'
import { WizardShell } from '@/components/wizard/WizardShell'
// ...

export default function Page() {
  const step = useBillStore((s) => s.step)
  return (
    <WizardShell>
      {step === 1 && <AddPeopleStep />}
      // ...
    </WizardShell>
  )
}
```

For `app/split/[sessionId]/page.tsx`, this is a **Server Component shell** (no `'use client'`) that awaits params and renders a Client Component:

```typescript
// app/split/[sessionId]/page.tsx (Server Component — no 'use client')
export default async function SplitPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params   // MUST await in Next.js 15
  // Optionally fetch initial session server-side for first paint
  // Then hand off to a client component for SWR polling
  return <GuestClaimingView sessionId={sessionId} />
}
```

**Note:** Unlike `app/page.tsx` which is `'use client'`, this page is a Server Component shell that renders a `'use client'` child. This keeps Redis credentials server-side and enables `await params`.

---

### `stores/useBillStore.ts` (store, modify — add syncStatus and sessionId)

**Analog:** `stores/useBillStore.ts` (self — extend existing pattern)

**Existing status field pattern** (`stores/useBillStore.ts` lines 38-41):
```typescript
  ocrStatus: 'idle' | 'loading' | 'done' | 'error'
  expandStatus: 'idle' | 'loading' | 'done' | 'error'
  // ...
  setOcrStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void
  setExpandStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void
```

**New fields to add** (mirror the ocrStatus/expandStatus pattern exactly):
```typescript
  // In BillState interface:
  syncStatus: 'idle' | 'waiting' | 'results'
  sessionId: string | null

  // Actions:
  setSyncStatus: (status: 'idle' | 'waiting' | 'results') => void
  setSessionId: (id: string | null) => void
```

**INITIAL_STATE extension** (`stores/useBillStore.ts` lines 54-64):
```typescript
const INITIAL_STATE = {
  // ... existing fields ...
  syncStatus: 'idle' as const,
  sessionId: null,
}
```

**Setter pattern** (`stores/useBillStore.ts` lines 108-112):
```typescript
  setOcrStatus: (status) => set({ ocrStatus: status }),
  setExpandStatus: (status) => set({ expandStatus: status }),
  // Add:
  setSyncStatus: (status) => set({ syncStatus: status }),
  setSessionId: (id) => set({ sessionId: id }),
```

---

### `components/wizard/WizardShell.tsx` (component, modify — reorder steps)

**Analog:** `components/wizard/WizardShell.tsx` (self)

**Current STEP_LABELS** (`components/wizard/WizardShell.tsx` line 10):
```typescript
const STEP_LABELS = ['Add People', 'Add Items', 'Assign', 'Tip', 'Results']
```

**Change to** (D-04 — SetTip moves to step 3, AssignItems to step 4):
```typescript
const STEP_LABELS = ['Add People', 'Add Items', 'Tip', 'Assign / Share', 'Results']
```

**Hash navigation pattern** (`components/wizard/WizardShell.tsx` lines 27-31) remains unchanged — step numbers 1-5 still valid:
```typescript
      const match = window.location.hash.match(/#step-([1-5])/)
      if (match) {
        const num = Number(match[1])
        if (num >= 1 && num <= 5) {
          setStep(num as 1 | 2 | 3 | 4 | 5)
```

---

### `components/wizard/AssignItemsStep.tsx` (component, modify — add Share link button)

**Analog:** `components/wizard/AssignItemsStep.tsx` (self)

**Existing CTA row** (`components/wizard/AssignItemsStep.tsx` lines 102-118):
```typescript
      {/* Bottom CTA row */}
      <div className="mt-auto flex gap-3">
        <Button
          variant="outline"
          onClick={() => setStep(2)}
          className="h-12 flex-1"
        >
          Back
        </Button>
        <Button
          onClick={() => setStep(4)}
          className="h-12 flex-1 bg-amber-600 hover:bg-amber-700"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        >
          Set tip
        </Button>
      </div>
```

**Step number change** (D-04 — AssignItems is now step 4, back goes to step 3, forward goes to step 5):
- Back button: `setStep(3)` (was `setStep(2)` before reorder)
- Forward button: `setStep(5)` for manual path (results)

**New Share link button** replaces or accompanies the forward button (D-05 — both paths remain available). Add `<ShareLinkButton />` component alongside the existing "See results" button.

**Fetch pattern** (`components/wizard/AddItemsStep.tsx` lines 146-153):
```typescript
        abortRef.current?.abort()
        abortRef.current = new AbortController()
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
          signal: abortRef.current.signal,
        })
        if (!res.ok) throw new Error(`OCR route returned ${res.status}`)
```
`ShareLinkButton` follows same fetch pattern to `POST /api/session`.

---

### `components/wizard/SetTipStep.tsx` (component, modify — step numbers only)

**Analog:** `components/wizard/SetTipStep.tsx` (self)

**Only change is navigation step numbers** (`components/wizard/SetTipStep.tsx` lines 147-157):
```typescript
        <Button
          variant="outline"
          onClick={() => setStep(3)}   // Back goes to step 3 (AssignItems — was step 4 before)
          className="h-12 flex-1"
        >
          Back
        </Button>
        <Button
          onClick={() => setStep(5)}   // Forward goes to step 5 (Results — was step 5, unchanged)
          className="h-12 flex-1 bg-amber-600 hover:bg-amber-700"
        >
          See results
        </Button>
```

Wait — with the reorder: SetTip is now step **3**, AssignItems is step **4**. So SetTipStep's Back should go to step 2 (AddItems), and forward goes to step 4 (AssignItems). Update:
- Back: `setStep(2)` (to AddItems)
- Forward: `setStep(4)` (to AssignItems)

No logic changes — only these two step numbers.

---

### `components/wizard/ResultsStep.tsx` (component, modify — add host waiting view based on syncStatus)

**Analog:** `components/wizard/ResultsStep.tsx` (self)

**Existing store reads pattern** (`components/wizard/ResultsStep.tsx` lines 36-40):
```typescript
  const people = useBillStore((s) => s.people)
  const items = useBillStore((s) => s.items)
  const assignments = useBillStore((s) => s.assignments)
  const tipPercent = useBillStore((s) => s.tipPercent)
  const setStep = useBillStore((s) => s.setStep)
```
Add `syncStatus` read:
```typescript
  const syncStatus = useBillStore((s) => s.syncStatus)
  const sessionId = useBillStore((s) => s.sessionId)
```

**Conditional render** (D-06/D-12 — host waiting vs. results based on syncStatus):
```typescript
  if (syncStatus === 'waiting') {
    return <HostWaitingScreen sessionId={sessionId!} />
  }
  // ... existing ResultsStep JSX ...
```

---

### `components/wizard/ShareLinkButton.tsx` (component, new, request-response)

**Analog:** `components/wizard/AddItemsStep.tsx` (fetch + loading state pattern)

**Imports pattern** (`components/wizard/AddItemsStep.tsx` lines 1-7):
```typescript
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useBillStore } from '@/stores/useBillStore'
```

**Loading state pattern** (`components/wizard/AddItemsStep.tsx` lines 56-58):
```typescript
  const ocrStatus = useBillStore((s) => s.ocrStatus)
  // ...
  const [editState, setEditState] = useState<EditState | null>(null)
```
ShareLinkButton uses local `isLoading` state (not in store — purely transient button state):
```typescript
  const [isLoading, setIsLoading] = useState(false)
```

**AbortController pattern** (`components/wizard/AddItemsStep.tsx` lines 63-66):
```typescript
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])
```

**Fetch + error toast pattern** (`components/wizard/AddItemsStep.tsx` lines 159-168):
```typescript
      } catch (err) {
        console.error(err)
        setOcrStatus('error')
        toastManager.add({
          description: "Couldn't read the bill — try again or enter manually",
          timeout: 4000,
        })
        return
      }
```

**Core ShareLinkButton fetch** (calls POST /api/session, then sets syncStatus to 'waiting'):
```typescript
  async function handleShare() {
    setIsLoading(true)
    try {
      const { people, items, tipPercent } = useBillStore.getState()
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ people, items, tipPercent }),
      })
      if (!res.ok) throw new Error(`Session creation failed: ${res.status}`)
      const { sessionId } = await res.json() as { sessionId: string }
      setSessionId(sessionId)
      setSyncStatus('waiting')
      setStep(5)  // Move to Results/Waiting screen
    } catch (err) {
      console.error(err)
      toastManager.add({ description: "Couldn't create sharing link", timeout: 4000 })
    } finally {
      setIsLoading(false)
    }
  }
```

---

### `components/wizard/HostWaitingScreen.tsx` (component, new, polling)

**Analog:** `components/wizard/OcrLoadingOverlay.tsx` (waiting UI pattern)

**OcrLoadingOverlay structure** (`components/wizard/OcrLoadingOverlay.tsx` lines 1-31):
```typescript
'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle } from 'lucide-react'

export function OcrLoadingOverlay({ visible, message = 'Scanning your bill…' }: OcrLoadingOverlayProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted || !visible) return null
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      // ... fullscreen overlay JSX ...
    />,
    document.body,
  )
}
```

**HostWaitingScreen differs** — it is not a portal overlay but an inline step content component. SWR polling replaces the `OcrLoadingOverlay`'s static `visible` prop:

```typescript
'use client'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('session_not_found')
  return r.json()
})

export function HostWaitingScreen({ sessionId }: { sessionId: string }) {
  const { data: session, error } = useSWR(
    `/api/session/${sessionId}`,
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: false }
  )
  if (error) return <SessionExpiredScreen />
  if (!session) return <div>Loading…</div>
  // Render claim-progress list (D-06)
}
```

**Person list display pattern** (reuse avatar from `AddPeopleStep.tsx` lines 73-84):
```typescript
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex]}`}
              aria-hidden="true"
            >
              {person.name.charAt(0).toUpperCase()}
            </div>
```

---

### `components/split/PersonSlotPicker.tsx` (component, new, request-response)

**Analog:** `components/wizard/AddPeopleStep.tsx` (renders person list with interaction)

**Person list rendering pattern** (`components/wizard/AddPeopleStep.tsx` lines 69-93):
```typescript
      <ul className="flex flex-col gap-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex h-14 items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex]}`}
              aria-hidden="true"
            >
              {person.name.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 text-[16px]">{person.name}</span>
            <button
              type="button"
              aria-label={`Remove ${person.name}`}
              // ...
            >
```

**PersonSlotPicker adapts** — shows `session.people`, disables slots already in `session.claims.personSlots`, calls `POST /api/session/[id]/claim` with `action: 'slot'` on selection.

**Imports pattern:**
```typescript
'use client'

import { Button } from '@/components/ui/button'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import type { Person } from '@/stores/useBillStore'
```

---

### `components/split/ClaimableItemCard.tsx` (component, new, event-driven)

**Analog:** `components/wizard/AssignItemsStep.tsx` (item card with interactive toggles)

**Card structure pattern** (`components/wizard/AssignItemsStep.tsx` lines 44-56):
```typescript
            <li key={item.id}>
              <Card className="flex flex-col gap-3 px-4 py-3">
                {/* Item header */}
                <div className="flex items-center justify-between">
                  <span className="text-[16px] font-medium">{item.name}</span>
                  <div className="flex items-center gap-2">
                    {isShared && (
                      <Badge variant="secondary">Shared</Badge>
                    )}
                    <span className="text-[14px] text-zinc-500">
                      {formatCents(item.priceCents)}
                    </span>
                  </div>
                </div>
```

**Badge usage** (for "Taken by [Name]" — D-08, `components/wizard/AssignItemsStep.tsx` line 5):
```typescript
import { Badge } from '@/components/ui/badge'
// Usage:
<Badge variant="secondary">Taken by {takenByName}</Badge>
```

**Dimming pattern** (items claimed by others appear dimmed — D-08):
```typescript
className={[
  'flex flex-col gap-3 px-4 py-3',
  takenByOther ? 'opacity-50 pointer-events-none' : 'cursor-pointer',
].join(' ')}
```

**Optimistic state pattern** (RESEARCH.md Pattern 7):
```typescript
const [optimisticClaims, setOptimisticClaims] = useState<Record<string, string | null>>({})

async function handleItemTap(itemId: string) {
  const currentOwner = session.claims.items[itemId]
  const isMyItem = currentOwner === myPersonId

  setOptimisticClaims(prev => ({
    ...prev,
    [itemId]: isMyItem ? null : myPersonId
  }))

  await fetch(`/api/session/${sessionId}/claim`, {
    method: 'POST',
    body: JSON.stringify({ personId: myPersonId, itemId }),
    headers: { 'Content-Type': 'application/json' },
  })
}
```

---

### `components/split/GuestDoneScreen.tsx` (component, new, request-response)

**Analog:** `components/wizard/ResultsStep.tsx` (per-person total display)

**computePersonTotals usage** (`components/wizard/ResultsStep.tsx` lines 44-46):
```typescript
  const totals = computePersonTotals(people, items, assignments, tipPercent)
  const subtotalCents = computeSubtotalCents(items)
  const tipCents = computeTipCents(subtotalCents, tipPercent)
```

GuestDoneScreen receives session data from SWR poll and converts claims into an assignments-compatible shape:
```typescript
import { computePersonTotals, formatCents } from '@/lib/billMath'
import type { SessionPayload } from '@/lib/sessionSchema'

// Convert session claims.items → assignments Record<ItemId, PersonId[]>
function claimsToAssignments(claims: SessionPayload['claims']['items']): Record<string, string[]> {
  const assignments: Record<string, string[]> = {}
  for (const [itemId, personId] of Object.entries(claims)) {
    assignments[itemId] = [personId]
  }
  return assignments
}
```

**Person card pattern** (`components/wizard/ResultsStep.tsx` lines 71-119):
```typescript
          const personTotal = totals[person.id] ?? 0
          // ...
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex]}`}
          >
            {person.name.charAt(0).toUpperCase()}
          </div>
          <span className={`text-[28px] font-semibold text-amber-600`}>
            {formatCents(personTotal)}
          </span>
```

**D-11:** GuestDoneScreen shows ONLY the current guest's total — not all people. Single person card, no accordion expansion needed.

---

### `components/split/SessionExpiredScreen.tsx` (component, new, error state)

**Analog:** `components/wizard/OcrLoadingOverlay.tsx` (fullscreen message component)

**Portal pattern** (`components/wizard/OcrLoadingOverlay.tsx` lines 17-30) — SessionExpiredScreen is NOT a portal (it's an inline route-level error), but borrows the full-viewport centered layout:
```typescript
<div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80">
  <div className="flex flex-col items-center gap-4">
    <p className="text-[16px] text-white">{message}</p>
  </div>
</div>
```

**Adapt as inline (no portal):**
```typescript
'use client'

export function SessionExpiredScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-[20px] font-semibold">Session expired</h1>
      <p className="text-[14px] text-zinc-500">
        This splitting session has expired or could not be found.
        Ask the host to share a new link.
      </p>
    </div>
  )
}
```

---

## Shared Patterns

### Route Handler Structure
**Source:** `app/api/ocr/route.ts` lines 21-106
**Apply to:** `app/api/session/route.ts`, `app/api/session/[sessionId]/route.ts`, `app/api/session/[sessionId]/claim/route.ts`, `app/api/session/[sessionId]/done/route.ts`

```typescript
// Canonical 3-tier route handler structure:
export async function POST(request: Request) {
  // Tier 1: Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Tier 2: Validate fields — return 400 per-field
  const field = body && typeof body === 'object' && 'field' in body
    ? (body as { field: unknown }).field
    : undefined
  if (/* invalid */) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  }

  // Tier 3: Business logic in try/catch — return 500 on unexpected errors
  try {
    // ... Redis operations ...
    return NextResponse.json({ result })
  } catch (err) {
    console.error('Route error:', err)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
```

### Next.js 15 Dynamic Params (CRITICAL)
**Source:** RESEARCH.md Pattern 5 — verified via Next.js 15 upgrade docs
**Apply to:** `app/api/session/[sessionId]/route.ts`, `app/api/session/[sessionId]/claim/route.ts`, `app/api/session/[sessionId]/done/route.ts`, `app/split/[sessionId]/page.tsx`

```typescript
// ALL dynamic route handlers and pages MUST await params:
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params  // ← REQUIRED — silently returns undefined without await
```

### Env Var Security
**Source:** `app/api/ocr/route.ts` line 4-6
**Apply to:** `lib/redis.ts`

```typescript
// Read OPENAI_API_KEY from server-only env. NEVER prefix with NEXT_PUBLIC_.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
```
Same pattern: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — server-side only, never `NEXT_PUBLIC_`.

### Zustand Store Read Pattern
**Source:** `components/wizard/AssignItemsStep.tsx` lines 11-15
**Apply to:** `components/wizard/ShareLinkButton.tsx`, `components/wizard/HostWaitingScreen.tsx`, `components/wizard/ResultsStep.tsx` (modified)

```typescript
  const items = useBillStore((s) => s.items)
  const people = useBillStore((s) => s.people)
  const assignments = useBillStore((s) => s.assignments)
  const setStep = useBillStore((s) => s.setStep)
```
One selector per value — do not subscribe to entire store.

### Avatar Color System
**Source:** `stores/useBillStore.ts` lines 6-13, used in `components/wizard/AssignItemsStep.tsx` line 6 and `components/wizard/ResultsStep.tsx` line 8
**Apply to:** `components/split/PersonSlotPicker.tsx`, `components/split/ClaimableItemCard.tsx`, `components/split/GuestDoneScreen.tsx`, `components/wizard/HostWaitingScreen.tsx`

```typescript
import { AVATAR_COLORS } from '@/stores/useBillStore'
// Usage:
className={`... ${AVATAR_COLORS[person.colorIndex]}`}
```

### SWR Polling
**Source:** RESEARCH.md Pattern 6 — verified via Context7 /vercel/swr
**Apply to:** `components/wizard/HostWaitingScreen.tsx`, guest claiming view in `app/split/[sessionId]/page.tsx`

```typescript
'use client'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('session_not_found')
  return r.json()
})

const { data: session, error } = useSWR(
  `/api/session/${sessionId}`,
  fetcher,
  {
    refreshInterval: 3000,       // D-07: poll every 3 seconds
    revalidateOnFocus: false,    // prevents burst on mobile app-switch
  }
)
```

### Integer-Cents Constraint
**Source:** `stores/useBillStore.ts` line 23 (`priceCents: number`) + `lib/billMath.ts` lines 4-9
**Apply to:** `app/api/session/route.ts` (validate priceCents is integer on session creation), `components/split/GuestDoneScreen.tsx` (use `formatCents()`, not `toFixed(2)`)

```typescript
// Always validate priceCents is integer on input:
Number.isInteger((item as { priceCents?: unknown }).priceCents)
// Always format for display via:
import { formatCents } from '@/lib/billMath'
formatCents(personTotal)  // → "$12.50"
```

### Test File Structure (Route Handler Tests)
**Source:** `__tests__/ocrRoute.test.ts` lines 1-36
**Apply to:** `__tests__/sessionRoute.test.ts`, `__tests__/sessionClaimRoute.test.ts`, `__tests__/sessionDoneRoute.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Set env vars BEFORE module import
process.env.OPENAI_API_KEY = 'test-key'
// For session tests:
// process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
// process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockMulti = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: class {
    get = mockGet
    set = mockSet
    multi = mockMulti
  }
}))

beforeEach(() => {
  vi.resetModules()        // ensures env vars + mock apply to fresh module import
  mockGet.mockReset()
  mockSet.mockReset()
  mockMulti.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function callPOST(body: unknown): Promise<{ status: number; json: unknown }> {
  const { POST } = await import('@/app/api/session/route')  // dynamic import AFTER resetModules
  const req = new Request('http://localhost/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const res = await POST(req)
  return { status: res.status, json: await res.json() }
}
```

**For dynamic route handlers** (need to mock params Promise):
```typescript
async function callGET(sessionId: string): Promise<{ status: number; json: unknown }> {
  const { GET } = await import('@/app/api/session/[sessionId]/route')
  const req = new Request(`http://localhost/api/session/${sessionId}`)
  const params = Promise.resolve({ sessionId })   // mock the Promise<params> shape
  const res = await GET(req, { params })
  return { status: res.status, json: await res.json() }
}
```

### Test File Structure (Component Tests)
**Source:** `__tests__/AssignItemsStep.test.tsx` lines 1-14
**Apply to:** `__tests__/ShareLinkButton.test.tsx`, `__tests__/PersonSlotPicker.test.tsx`, `__tests__/GuestDoneScreen.test.tsx`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useBillStore } from '@/stores/useBillStore'

beforeEach(() => {
  useBillStore.getState().reset()
  // seed test state here
})

afterEach(() => {
  cleanup()
})
```

### Toast Error Pattern
**Source:** `components/wizard/AddItemsStep.tsx` lines 61, 162-165
**Apply to:** `components/wizard/ShareLinkButton.tsx`

```typescript
import { Toast } from '@base-ui/react/toast'
// ...
const toastManager = Toast.useToastManager()
// On error:
toastManager.add({
  description: "Couldn't create sharing link — try again",
  timeout: 4000,
})
```

### AbortController Cleanup
**Source:** `components/wizard/AddItemsStep.tsx` lines 63-66
**Apply to:** `components/wizard/ShareLinkButton.tsx`

```typescript
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/sessionSchema.ts` | type definition | — | No existing schema/type-definition-only files exist; this is a new TypeScript interface file with no runtime logic |

**Note on `lib/redis.ts`:** Listed above as "partial" match to `lib/billMath.ts` (both are module-level singleton exports). The actual Redis client pattern comes from RESEARCH.md Pattern 1 (Upstash docs). The singleton export structure is the only codebase-native pattern to follow.

---

## Metadata

**Analog search scope:** `/app/api/`, `/components/wizard/`, `/components/ui/`, `/stores/`, `/lib/`, `/__tests__/`
**Files scanned:** 17 source files + 8 test files
**Pattern extraction date:** 2026-05-13
