'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import type { SessionPayload } from '@/lib/sessionSchema'
import type { ItemId, PersonId, Person } from '@/stores/useBillStore'
import { PersonSlotPicker } from '@/components/split/PersonSlotPicker'
import { ClaimableItemCard } from '@/components/split/ClaimableItemCard'
import { SessionExpiredScreen } from '@/components/split/SessionExpiredScreen'

const fetcher = (url: string): Promise<SessionPayload> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('session_not_found')
    return r.json()
  })

interface CollaborativeClaimingViewProps {
  sessionId: string
  hostTokenParam: string | null
}

type Phase = 'claiming' | 'done-placeholder'

export function CollaborativeClaimingView({
  sessionId,
  hostTokenParam,
}: CollaborativeClaimingViewProps) {
  const [selectedPersonId, setSelectedPersonId] = useState<PersonId | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<ItemId, boolean>>({})
  const [doneError, setDoneError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('claiming')

  const swrKey = `/api/session/${sessionId}`
  const { data: session, error, mutate } = useSWR<SessionPayload>(swrKey, fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: false,
  })

  const isHost = useMemo(
    () => hostTokenParam !== null && session?.hostToken === hostTokenParam,
    [hostTokenParam, session?.hostToken]
  )

  const peopleById = useMemo<Record<PersonId, Person>>(() => {
    if (!session) return {}
    return Object.fromEntries(session.people.map((p) => [p.id, p]))
  }, [session])

  if (error) return <SessionExpiredScreen />
  if (!session) return <div role="status" className="p-6">Loading…</div>

  async function handleSelect(personId: PersonId) {
    try {
      const body: Record<string, unknown> = { personId, action: 'slot' }
      if (hostTokenParam) body.hostToken = hostTokenParam
      const res = await fetch(`/api/session/${sessionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        await mutate()
        return
      }
      const data = (await res.json()) as { ok: boolean; reason?: string }
      if (data.ok) {
        setSelectedPersonId(personId)
      } else {
        await mutate()
      }
    } catch {
      await mutate()
    }
  }

  async function handleQtyChange(itemId: ItemId, newQty: number) {
    if (!selectedPersonId || !session) return
    const personId = selectedPersonId

    // Build optimistic SessionPayload snapshot
    const claimsForItem = { ...(session.claims?.items?.[itemId] ?? {}) }
    if (newQty === 0) {
      delete claimsForItem[personId]
    } else {
      claimsForItem[personId] = { qty: newQty, assignedBy: 'self' as const }
    }
    const nextItems: SessionPayload['claims']['items'] = { ...session.claims?.items }
    if (Object.keys(claimsForItem).length === 0) {
      delete nextItems[itemId]
    } else {
      nextItems[itemId] = claimsForItem
    }
    const optimistic: SessionPayload = {
      ...session,
      claims: {
        items: nextItems,
        personSlots: session.claims?.personSlots ?? {},
        donePeople: session.claims?.donePeople ?? {},
      },
    }

    try {
      await mutate(
        async () => {
          const res = await fetch(`/api/session/${sessionId}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId, itemId, qty: newQty, action: 'qty' }),
          })
          if (!res.ok) throw new Error('claim_failed')
          // Re-fetch ground truth (server may have new state from other claimants)
          return fetcher(swrKey)
        },
        {
          optimisticData: optimistic,
          rollbackOnError: true,
          revalidate: true,
        }
      )
      setItemErrors((prev) => {
        if (!prev[itemId]) return prev
        const next = { ...prev }
        delete next[itemId]
        return next
      })
    } catch {
      setItemErrors((prev) => ({ ...prev, [itemId]: true }))
    }
  }

  async function handleDone() {
    if (!selectedPersonId) return
    setDoneError(null)
    try {
      const res = await fetch(`/api/session/${sessionId}/done`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: selectedPersonId, done: true }),
      })
      if (!res.ok) throw new Error(`done route returned ${res.status}`)
      await mutate()
      setPhase('done-placeholder')
    } catch (err) {
      console.error('Done submission failed:', err)
      setDoneError("Couldn't submit — tap to retry")
    }
  }

  async function handleBackFromDone() {
    if (!selectedPersonId) return
    try {
      await fetch(`/api/session/${sessionId}/done`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: selectedPersonId, done: false }),
      })
      await mutate()
      setPhase('claiming')
    } catch {
      setPhase('claiming') // best-effort
    }
  }

  // No slot yet — show picker
  if (selectedPersonId === null) {
    return (
      <main className="mx-auto min-h-screen max-w-[480px] bg-background">
        <PersonSlotPicker session={session} onSelect={handleSelect} />
      </main>
    )
  }

  const me = session.people.find((p) => p.id === selectedPersonId)
  if (!me) return <SessionExpiredScreen />

  // PLACEHOLDER for review/tip/results — Plan 06 replaces this.
  if (phase === 'done-placeholder') {
    return (
      <main className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-[20px] font-semibold">Done — Review/Tip/Results UI lands in Plan 06</h1>
        <p className="text-[14px] text-zinc-500">
          (D-08: tapping &ldquo;Back to claiming&rdquo; un-marks done and returns full edit rights.)
        </p>
        <Button onClick={handleBackFromDone} className="h-12 bg-amber-600 hover:bg-amber-700">
          Back to claiming
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background px-6">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[me.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
          aria-hidden="true"
        >
          {me.name.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-[20px] font-semibold">Hi, {me.name}!</h1>
        {isHost && (
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-1 text-[14px] text-amber-700" data-testid="host-badge">
            Host
          </span>
        )}
      </header>

      {/* Item list */}
      <ul className="flex flex-col gap-2 px-6 py-4 pb-[80px]">
        {session.items.map((item) => {
          const claimsForItem = session.claims?.items?.[item.id] ?? {}
          return (
            <li key={item.id}>
              <ClaimableItemCard
                item={item}
                claimsForItem={claimsForItem}
                myPersonId={selectedPersonId}
                peopleById={peopleById}
                onQtyChange={(newQty) => handleQtyChange(item.id, newQty)}
                hasError={!!itemErrors[item.id]}
              />
            </li>
          )
        })}
      </ul>

      {/* Fixed "I'm done" bar */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-border bg-background px-6 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {doneError && (
          <p className="mb-2 text-center text-sm text-red-600">{doneError}</p>
        )}
        <Button onClick={handleDone} className="h-12 w-full bg-amber-600 hover:bg-amber-700">
          I&rsquo;m done
        </Button>
      </div>
    </main>
  )
}
