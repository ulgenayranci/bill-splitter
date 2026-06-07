'use client'

import { Check, Minus, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import { formatCents, computeEqualShareCents } from '@/lib/billMath'
import type { ClaimEntry } from '@/lib/sessionSchema'
import type { Item, Person, PersonId } from '@/stores/useBillStore'

interface ClaimableItemCardProps {
  item: Item
  claimsForItem: Record<PersonId, ClaimEntry>
  myPersonId: PersonId
  peopleById: Record<PersonId, Person>
  onQtyChange: (newQty: number) => void
  onShareChange?: (joining: boolean) => void
  errorMessage?: string
}

const MAX_VISIBLE_AVATARS = 3

export function ClaimableItemCard({
  item,
  claimsForItem,
  myPersonId,
  peopleById,
  onQtyChange,
  onShareChange,
  errorMessage,
}: ClaimableItemCardProps) {
  const myEntry = claimsForItem[myPersonId]
  const myQty = myEntry?.qty ?? 0
  const isMultiQty = (item.quantity ?? 1) > 1
  const mine = myQty > 0

  // All claimants with qty > 0 — current user first, then others
  // WR-03: guard entry?.qty everywhere — a null entry in claimsForItem would otherwise crash
  // this component, blanking the entire bill view (it renders once per item in a list).
  const allClaimantEntries = [
    ...Object.entries(claimsForItem).filter(([pid, entry]) => pid === myPersonId && (entry?.qty ?? 0) > 0),
    ...Object.entries(claimsForItem).filter(([pid, entry]) => pid !== myPersonId && (entry?.qty ?? 0) > 0),
  ]
  const visibleClaimants = allClaimantEntries.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = Math.max(0, allClaimantEntries.length - MAX_VISIBLE_AVATARS)

  // Total qty claimed across everyone — for "X of N claimed" display on multi-qty items
  const totalClaimedQty = Object.values(claimsForItem).reduce(
    (sum, entry) => sum + (entry?.qty ?? 0),
    0
  )

  // Single-qty toggle handler — routes through onShareChange if provided (D-13)
  const handleToggle = () => {
    if (onShareChange) {
      onShareChange(myQty === 0)
    } else {
      onQtyChange(myQty === 0 ? 1 : 0)
    }
  }

  // How many more this person can claim = total item qty minus everyone else's claims
  const remainingForMe = (item.quantity ?? 1) - (totalClaimedQty - myQty)

  // Multi-qty stepper handlers
  const handleDecrement = () => {
    if (myQty > 0) onQtyChange(myQty - 1)
  }
  const handleIncrement = () => {
    if (myQty < remainingForMe) onQtyChange(myQty + 1)
  }

  // Compute "your share" for shared single-qty items (D-15)
  const claimantCount = allClaimantEntries.length
  let yourShareCents: number | null = null
  if (!isMultiQty && mine && claimantCount > 1) {
    // Sort claimant personIds lexicographically ascending (determinism rule from computeEqualShareCents JSDoc)
    const sortedIds = allClaimantEntries.map(([pid]) => pid).sort()
    const myIndex = sortedIds.indexOf(myPersonId)
    yourShareCents = computeEqualShareCents(item.priceCents, claimantCount, myIndex)
  }

  const cardClasses = [
    'flex min-h-[44px] flex-col gap-2 px-4 py-3 transition-colors',
    mine ? 'bg-amber-50 border border-amber-400' : '',
    !isMultiQty ? 'cursor-pointer' : '',
  ].filter(Boolean).join(' ')

  const cardRole = isMultiQty ? undefined : 'button'
  const cardAriaLabel = isMultiQty
    ? undefined
    : mine
    ? `Un-claim ${item.name}`
    : `Claim ${item.name}`
  const cardOnClick = isMultiQty ? undefined : handleToggle

  return (
    <Card
      role={cardRole}
      aria-label={cardAriaLabel}
      onClick={cardOnClick}
      className={cardClasses}
    >
      {/* Top row: name + price + (qty=1) Check icon */}
      <div className="flex items-center gap-3">
        {!isMultiQty && (
          <div className="shrink-0">
            {mine ? (
              <Check size={24} className="text-amber-600" aria-hidden="true" />
            ) : (
              <span className="inline-block h-6 w-6 rounded-full border-2 border-zinc-300" aria-hidden="true" />
            )}
          </div>
        )}
        <span className={['flex-1 text-[16px]', mine ? 'font-semibold' : ''].join(' ')}>
          {item.name}
          {isMultiQty && (
            <span className="ml-2 text-[14px] text-zinc-500">×{item.quantity}</span>
          )}
        </span>
        <span className="text-[14px] text-zinc-500">{formatCents(item.priceCents)}</span>
      </div>

      {/* Multi-qty stepper row */}
      {isMultiQty && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2" data-testid="qty-stepper">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Decrease ${item.name} quantity`}
              onClick={handleDecrement}
              disabled={myQty === 0}
              className="h-11 w-11"
            >
              <Minus size={16} />
            </Button>
            <span
              className={`min-w-[2ch] text-center text-[16px] font-semibold ${myQty > 0 ? 'text-amber-600' : 'text-zinc-400'}`}
              data-testid="qty-count"
            >
              {myQty}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Increase ${item.name} quantity`}
              onClick={handleIncrement}
              disabled={myQty >= remainingForMe}
              className="h-11 w-11"
            >
              <Plus size={16} />
            </Button>
          </div>
          <span className="text-[14px] text-zinc-400" data-testid="claimed-count">
            {totalClaimedQty} of {item.quantity ?? 1} claimed
          </span>
        </div>
      )}

      {/* Shared-with row — shown whenever anyone other than me has claimed this item */}
      {allClaimantEntries.some(([pid]) => pid !== myPersonId) && (
        <div
          className="flex items-center gap-1"
          data-testid="claimant-stack"
        >
          {visibleClaimants.map(([pid]) => {
            const person = peopleById[pid]
            const isMe = pid === myPersonId
            const colorClass = AVATAR_COLORS[(person?.colorIndex ?? 0) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]
            return (
              <span
                key={pid}
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${colorClass} ${isMe ? 'ring-2 ring-amber-600 ring-offset-1' : ''}`}
                title={isMe ? 'You' : (person?.name ?? '')}
              >
                {isMe ? 'Y' : (person?.name ?? '?').charAt(0).toUpperCase()}
              </span>
            )
          })}
          {overflowCount > 0 && (
            <span className="text-[14px] text-zinc-400">+{overflowCount}</span>
          )}
          <span className="ml-1 text-[13px] text-zinc-500" data-testid="claimant-names">
            {mine
              ? `You + ${allClaimantEntries.filter(([pid]) => pid !== myPersonId).slice(0, 2).map(([pid]) => peopleById[pid]?.name ?? 'someone').join(', ')}${allClaimantEntries.length > 3 ? ` +${allClaimantEntries.length - 3} more` : ''}`
              : `${visibleClaimants.map(([pid]) => peopleById[pid]?.name ?? 'someone').join(', ')}${overflowCount > 0 ? ` +${overflowCount} more` : ''}`
            }
          </span>
        </div>
      )}

      {/* Your share line — shown for shared single-qty items the current user has joined (D-15) */}
      {yourShareCents !== null && (
        <p className="text-[14px] text-zinc-500 mt-1" data-testid="your-share">
          your share: {formatCents(yourShareCents)}
        </p>
      )}

      {errorMessage && (
        <span className="text-sm text-red-600">{errorMessage}</span>
      )}
    </Card>
  )
}
