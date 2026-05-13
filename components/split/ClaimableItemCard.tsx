'use client'

import { Check, Circle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import { formatCents } from '@/lib/billMath'
import type { Item, Person, PersonId } from '@/stores/useBillStore'

interface ClaimableItemCardProps {
  item: Item
  claimedBy: PersonId | undefined
  myPersonId: PersonId
  peopleById: Record<PersonId, Person>
  onTap: () => void
}

export function ClaimableItemCard({
  item,
  claimedBy,
  myPersonId,
  peopleById,
  onTap,
}: ClaimableItemCardProps) {
  const mine = claimedBy === myPersonId
  const takenByOther = claimedBy !== undefined && claimedBy !== myPersonId
  const otherPerson = takenByOther ? peopleById[claimedBy as PersonId] : undefined

  return (
    <Card
      role="button"
      aria-label={
        mine
          ? `Un-claim ${item.name}`
          : takenByOther
          ? `${item.name} taken by ${otherPerson?.name ?? 'someone'}`
          : `Claim ${item.name}`
      }
      onClick={() => { if (!takenByOther) onTap() }}
      className={[
        'flex items-center gap-3 px-4 py-3 transition-colors',
        takenByOther ? 'opacity-50 pointer-events-none' : 'cursor-pointer',
        mine ? 'bg-amber-50' : '',
      ].join(' ')}
    >
      <div className="shrink-0">
        {mine ? (
          <Check size={24} className="text-amber-600" aria-hidden="true" />
        ) : (
          <Circle size={24} className="text-zinc-300" aria-hidden="true" />
        )}
      </div>
      <span
        className={[
          'flex-1 text-[16px]',
          mine ? 'font-semibold' : '',
          takenByOther ? 'line-through' : '',
        ].join(' ')}
      >
        {item.name}
      </span>
      {takenByOther && otherPerson && (
        <span className="flex items-center gap-2 text-[14px] text-zinc-500">
          <span
            className={`inline-block h-4 w-4 rounded-full ${AVATAR_COLORS[otherPerson.colorIndex]}`}
            aria-hidden="true"
          />
          Taken by {otherPerson.name}
        </span>
      )}
      <span className="text-[14px] text-zinc-500">{formatCents(item.priceCents)}</span>
    </Card>
  )
}
