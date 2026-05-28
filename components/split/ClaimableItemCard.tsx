'use client'

import { Check, Minus, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import { formatCents } from '@/lib/billMath'
import type { ClaimEntry } from '@/lib/sessionSchema'
import type { Item, Person, PersonId } from '@/stores/useBillStore'

interface ClaimableItemCardProps {
  item: Item
  claimsForItem: Record<PersonId, ClaimEntry>
  myPersonId: PersonId
  peopleById: Record<PersonId, Person>
  onQtyChange: (newQty: number) => void
  hasError?: boolean
}

const MAX_VISIBLE_AVATARS = 3

export function ClaimableItemCard({
  item,
  claimsForItem,
  myPersonId,
  peopleById,
  onQtyChange,
  hasError,
}: ClaimableItemCardProps) {
  const myEntry = claimsForItem[myPersonId]
  const myQty = myEntry?.qty ?? 0
  const isMultiQty = (item.quantity ?? 1) > 1
  const mine = myQty > 0
  const isHostAssigned = myEntry?.assignedBy === 'host'

  const otherClaimantEntries = Object.entries(claimsForItem).filter(
    ([pid, entry]) => pid !== myPersonId && entry.qty > 0
  )
  const visibleOthers = otherClaimantEntries.slice(0, MAX_VISIBLE_AVATARS)
  const overflowCount = Math.max(0, otherClaimantEntries.length - MAX_VISIBLE_AVATARS)

  // Total qty claimed across everyone — for "X of N claimed" display on multi-qty items
  const totalClaimedQty = Object.values(claimsForItem).reduce(
    (sum, entry) => sum + entry.qty,
    0
  )

  // Single-qty toggle handler
  const handleToggle = () => {
    onQtyChange(myQty === 0 ? 1 : 0)
  }

  // Multi-qty stepper handlers
  const handleDecrement = () => {
    if (myQty > 0) onQtyChange(myQty - 1)
  }
  const handleIncrement = () => {
    if (myQty < (item.quantity ?? 1)) onQtyChange(myQty + 1)
  }

  const cardClasses = [
    'flex min-h-[44px] flex-col gap-2 px-4 py-3 transition-colors',
    mine ? 'bg-amber-50' : '',
    isHostAssigned ? 'border-amber-200' : '',
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

      {/* Host-assigned label */}
      {isHostAssigned && (
        <span className="text-[14px] text-zinc-500">Assigned by host</span>
      )}

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
              disabled={myQty >= (item.quantity ?? 1)}
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

      {/* Shared-with label — names of everyone who claimed this item */}
      {otherClaimantEntries.length > 0 && (
        <div
          className="flex items-center gap-2"
          data-testid="claimant-stack"
        >
          {visibleOthers.map(([pid]) => {
            const person = peopleById[pid]
            const colorClass = AVATAR_COLORS[(person?.colorIndex ?? 0) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]
            return (
              <span
                key={pid}
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${colorClass}`}
                aria-hidden="true"
                title={person?.name ?? ''}
              >
                {(person?.name ?? '?').charAt(0).toUpperCase()}
              </span>
            )
          })}
          <span className="text-[13px] text-zinc-500" data-testid="claimant-names">
            {mine ? 'Sharing with ' : 'Claimed by '}
            {visibleOthers.map(([pid]) => peopleById[pid]?.name ?? 'someone').join(', ')}
            {overflowCount > 0 && ` +${overflowCount} more`}
          </span>
        </div>
      )}

      {hasError && (
        <span className="text-sm text-red-600">Couldn&rsquo;t save — tap to retry</span>
      )}
    </Card>
  )
}
