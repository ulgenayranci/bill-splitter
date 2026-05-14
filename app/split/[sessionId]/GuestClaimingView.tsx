'use client'

import { useState, useEffect, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { Button } from '@/components/ui/button'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import type { SessionPayload } from '@/lib/sessionSchema'
import type { ItemId, PersonId, Person } from '@/stores/useBillStore'
import { PersonSlotPicker } from '@/components/split/PersonSlotPicker'
import { ClaimableItemCard } from '@/components/split/ClaimableItemCard'
import { GuestDoneScreen } from '@/components/split/GuestDoneScreen'
import { SessionExpiredScreen } from '@/components/split/SessionExpiredScreen'

const fetcher = (url: string): Promise<SessionPayload> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('session_not_found')
    return r.json()
  })

interface GuestClaimingViewProps { sessionId: string }

export function GuestClaimingView({ sessionId }: GuestClaimingViewProps) {
  const [selectedPersonId, setSelectedPersonId] = useState<PersonId | null>(null)
  const [optimisticClaims, setOptimisticClaims] = useState<Record<ItemId, PersonId | null>>({})
  const [itemErrors, setItemErrors] = useState<Record<ItemId, boolean>>({})
  const [doneError, setDoneError] = useState<string | null>(null)

  const swrKey = `/api/session/${sessionId}`
  const { data: session, error } = useSWR<SessionPayload>(swrKey, fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: false,
  })

  // Clear optimistic overrides when server state changes (Pitfall 5 / T-04-CL-02)
  useEffect(() => {
    setOptimisticClaims({})
  }, [session?.claims])

  const peopleById = useMemo<Record<PersonId, Person>>(() => {
    if (!session) return {}
    return Object.fromEntries(session.people.map((p) => [p.id, p]))
  }, [session])

  if (error) return <SessionExpiredScreen />
  if (!session) return <div role="status" className="p-6">Loading…</div>

  async function handleSelect(personId: PersonId) {
    try {
      const res = await fetch(`/api/session/${sessionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, action: 'slot' }),
      })
      if (!res.ok) {
        await mutate(swrKey)
        return
      }
      const data = (await res.json()) as { ok: boolean; reason?: string }
      if (data.ok) {
        setSelectedPersonId(personId)
      } else {
        await mutate(swrKey)
      }
    } catch {
      await mutate(swrKey)
    }
  }

  async function handleItemTap(itemId: ItemId) {
    if (!selectedPersonId) return
    const currentOwner = session?.claims?.items?.[itemId]
    const newClaim = currentOwner === selectedPersonId ? null : selectedPersonId
    setOptimisticClaims((prev) => ({ ...prev, [itemId]: newClaim }))
    try {
      const claimRes = await fetch(`/api/session/${sessionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: selectedPersonId, itemId, action: 'item' }),
      })
      if (!claimRes.ok) {
        // Revert optimistic and surface error — same path as the catch block
        setOptimisticClaims((prev) => { const next = { ...prev }; delete next[itemId]; return next })
        setItemErrors((prev) => ({ ...prev, [itemId]: true }))
        return
      }
      await mutate(swrKey)
      setItemErrors((prev) => {
        if (!prev[itemId]) return prev
        const next = { ...prev }
        delete next[itemId]
        return next
      })
    } catch {
      // Revert optimistic — next poll will reconcile
      setOptimisticClaims((prev) => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
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
        body: JSON.stringify({ personId: selectedPersonId }),
      })
      if (!res.ok) throw new Error(`done route returned ${res.status}`)
      await mutate(swrKey)
    } catch (err) {
      console.error('Done submission failed:', err)
      setDoneError("Couldn't submit — tap to retry")
    }
  }

  if (selectedPersonId === null) {
    return (
      <main className="mx-auto min-h-screen max-w-[480px] bg-background">
        <PersonSlotPicker session={session} onSelect={handleSelect} />
      </main>
    )
  }

  // After selection: check if this person is already marked done -> show done screen
  if (session.claims?.donePeople?.[selectedPersonId] === true) {
    return (
      <main className="mx-auto min-h-screen max-w-[480px] bg-background">
        <GuestDoneScreen session={session} personId={selectedPersonId} />
      </main>
    )
  }

  const me = session.people.find((p) => p.id === selectedPersonId)
  if (!me) return <SessionExpiredScreen />

  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-background">
      {/* Fixed header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background px-6">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[me.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
          aria-hidden="true"
        >
          {me.name.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-[20px] font-semibold">Hi, {me.name}!</h1>
      </header>

      {/* Item list */}
      <ul className="flex flex-col gap-2 px-6 py-4 pb-[80px]">
        {session.items.map((item) => {
          const serverOwner = session.claims?.items?.[item.id]
          const optimistic =
            item.id in optimisticClaims ? optimisticClaims[item.id] : undefined
          const effectiveOwner =
            optimistic === undefined ? serverOwner : (optimistic ?? undefined)
          return (
            <li key={item.id}>
              <ClaimableItemCard
                item={item}
                claimedBy={effectiveOwner ?? undefined}
                myPersonId={selectedPersonId}
                peopleById={peopleById}
                onTap={() => handleItemTap(item.id)}
                hasError={!!itemErrors[item.id]}
              />
            </li>
          )
        })}
      </ul>

      {/* Fixed "I'm done" bar */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-border bg-background px-6 py-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
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
