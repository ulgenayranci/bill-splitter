'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCents } from '@/lib/billMath'
import type { PublicSessionPayload } from '@/lib/sessionSchema'
import type { ItemId, PersonId } from '@/stores/useBillStore'

export interface ReviewHostAssignedScreenProps {
  session: PublicSessionPayload
  sessionId: string
  personId: PersonId
  onAcceptAll: () => void
  onBack: () => void
  mutate: () => Promise<unknown>
}

interface HostAssignedItem {
  itemId: ItemId
  itemName: string
  shareCents: number
}

export function ReviewHostAssignedScreen({
  session,
  sessionId,
  personId,
  onAcceptAll,
  onBack,
  mutate,
}: ReviewHostAssignedScreenProps) {
  // Track which items this person has personally accepted (local state — not persisted)
  const [acceptedItems, setAcceptedItems] = useState<Record<ItemId, boolean>>({})
  // Track which items have a pending dispute in flight (mapped to disputeId once created)
  const [pendingDisputeByItem, setPendingDisputeByItem] = useState<Record<ItemId, string>>({})
  const [errorByItem, setErrorByItem] = useState<Record<ItemId, string>>({})

  // Derive the list of host-assigned items for this person from the session payload.
  // An item is host-assigned for this person if claims.items[itemId][personId].assignedBy === 'host'
  // AND no pending dispute exists yet (resolved disputes return the item to claiming, not here).
  const hostAssignedItems: HostAssignedItem[] = []
  for (const item of session.items) {
    const claim = session.claims?.items?.[item.id]?.[personId]
    if (!claim || claim.assignedBy !== 'host' || claim.qty <= 0) continue

    // Compute proportional share (matches computePersonShareFromClaims logic)
    const claimsForItem = session.claims?.items?.[item.id] ?? {}
    const totalQty = Object.values(claimsForItem).reduce(
      (sum, e) => sum + (e?.qty ?? 0),
      0
    )
    if (totalQty === 0) continue
    const shareCents = Math.round((item.priceCents * claim.qty) / totalQty)
    hostAssignedItems.push({ itemId: item.id, itemName: item.name, shareCents })
  }

  // Detect when a pending dispute has been resolved by the host on the server.
  // When resolved, the host either reassigned (assignedBy stays 'host' but personId changes — item no longer in our list)
  // or rejected (status='rejected'). In either case, clear local pendingDisputeByItem.
  useEffect(() => {
    setPendingDisputeByItem((prev) => {
      const next = { ...prev }
      let changed = false
      for (const [itemId, disputeId] of Object.entries(prev)) {
        const dispute = session.disputes?.[disputeId]
        if (!dispute || dispute.status !== 'pending') {
          delete next[itemId]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [session.disputes])

  async function handleDispute(itemId: ItemId) {
    setErrorByItem((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
    try {
      const res = await fetch(`/api/session/${sessionId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, itemId }),
      })
      if (!res.ok) {
        setErrorByItem((prev) => ({
          ...prev,
          [itemId]: "Couldn't submit dispute — try again",
        }))
        return
      }
      const data = (await res.json()) as { ok: boolean; disputeId?: string }
      if (data.disputeId) {
        setPendingDisputeByItem((prev) => ({ ...prev, [itemId]: data.disputeId! }))
      }
      await mutate()
    } catch {
      setErrorByItem((prev) => ({
        ...prev,
        [itemId]: "Couldn't submit dispute — try again",
      }))
    }
  }

  function handleAcceptOne(itemId: ItemId) {
    setAcceptedItems((prev) => ({ ...prev, [itemId]: true }))
  }

  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          type="button"
          variant="ghost"
          className="h-10 px-3"
          onClick={onBack}
          aria-label="Back to claiming"
        >
          Back to claiming
        </Button>
      </header>

      <div className="flex flex-col gap-4 px-6 py-8 pb-[120px]">
        <h1 className="text-[20px] font-semibold leading-[1.2]">Review assigned items</h1>
        <p className="text-[14px] text-zinc-500">
          The host assigned these items to you. Accept or dispute each one.
        </p>

        <ul className="flex flex-col gap-2" data-testid="review-list">
          {hostAssignedItems.map(({ itemId, itemName, shareCents }) => {
            const isAccepted = acceptedItems[itemId] === true
            const isDisputePending = pendingDisputeByItem[itemId] !== undefined
            const itemError = errorByItem[itemId]
            return (
              <Card
                key={itemId}
                className="flex flex-col gap-2 border-amber-200 bg-amber-50 px-4 py-3"
                data-testid={`review-row-${itemId}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[16px] font-semibold">{itemName}</span>
                  <span className="text-[14px] text-zinc-500">
                    {formatCents(shareCents)}
                  </span>
                </div>
                {isDisputePending ? (
                  <div
                    className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-2"
                    data-testid={`review-pending-${itemId}`}
                  >
                    <Loader2
                      size={16}
                      className="animate-spin text-zinc-400"
                      aria-hidden="true"
                    />
                    <span className="text-[14px] text-zinc-400">Waiting for host…</span>
                  </div>
                ) : isAccepted ? (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Check size={16} aria-hidden="true" />
                    <span className="text-[14px]">Accepted</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="h-11 flex-1 bg-amber-600 hover:bg-amber-700"
                      onClick={() => handleAcceptOne(itemId)}
                      aria-label={`Accept ${itemName}`}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1"
                      onClick={() => handleDispute(itemId)}
                      aria-label={`Dispute ${itemName}`}
                    >
                      Dispute
                    </Button>
                  </div>
                )}
                {itemError && (
                  <span className="text-[14px] text-red-600">{itemError}</span>
                )}
              </Card>
            )
          })}
        </ul>

        <Separator />
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] border-t border-border bg-background px-6 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        {/* WR-05: disable "Accept all" while any dispute is pending to prevent advancing
            with unresolved contests. The per-item isDisputePending state is the source of truth. */}
        {Object.keys(pendingDisputeByItem).length > 0 ? (
          <Button
            type="button"
            className="h-12 w-full"
            disabled
            aria-label="Waiting for host to resolve disputes"
            data-testid="accept-all-waiting"
          >
            Waiting for host…
          </Button>
        ) : (
          <Button
            type="button"
            className="h-12 w-full bg-amber-600 hover:bg-amber-700"
            onClick={onAcceptAll}
            aria-label="Accept all and continue"
            data-testid="accept-all-button"
          >
            Accept all and continue
          </Button>
        )}
      </div>
    </main>
  )
}
