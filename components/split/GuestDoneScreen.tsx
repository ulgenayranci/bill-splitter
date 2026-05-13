'use client'

import { Separator } from '@/components/ui/separator'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import {
  computePersonTotals,
  computeSubtotalCents,
  computeTipCents,
  formatCents,
} from '@/lib/billMath'
import type { SessionPayload } from '@/lib/sessionSchema'
import type { ItemId, PersonId } from '@/stores/useBillStore'

interface GuestDoneScreenProps {
  session: SessionPayload
  personId: PersonId
}

function claimsToAssignments(
  claims: Record<ItemId, PersonId>
): Record<ItemId, PersonId[]> {
  const out: Record<ItemId, PersonId[]> = {}
  for (const [itemId, owner] of Object.entries(claims)) {
    out[itemId] = [owner]
  }
  return out
}

export function GuestDoneScreen({ session, personId }: GuestDoneScreenProps) {
  const person = session.people.find((p) => p.id === personId)
  if (!person) return null

  const assignments = claimsToAssignments(session.claims?.items ?? {})
  const totals = computePersonTotals(session.people, session.items, assignments, session.tipPercent)
  const personIndex = session.people.findIndex((p) => p.id === personId)
  const subtotalCents = computeSubtotalCents(session.items)
  const tipCents = computeTipCents(subtotalCents, session.tipPercent)
  const tipBase = Math.floor(tipCents / Math.max(session.people.length, 1))
  const tipRemainder = tipCents % Math.max(session.people.length, 1)
  const tipShare = tipBase + (personIndex < tipRemainder ? 1 : 0)

  const myItems = session.items.filter(
    (i) => session.claims?.items?.[i.id] === personId
  )

  return (
    <div className="flex flex-col gap-4 px-6 py-8">
      <h1 className="text-[20px] font-semibold leading-[1.2]">You&rsquo;re done!</h1>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex]}`}
          aria-hidden="true"
        >
          {person.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-[28px] font-semibold text-amber-600">
            {formatCents(totals[personId] ?? 0)}
          </span>
          <span className="text-[14px] text-zinc-500">Your share</span>
        </div>
      </div>
      <Separator />
      <ul className="flex flex-col gap-1">
        {myItems.map((item) => (
          <li key={item.id} className="flex justify-between text-[14px]">
            <span>{item.name}</span>
            <span>{formatCents(item.priceCents)}</span>
          </li>
        ))}
        <li className="flex justify-between text-[14px]">
          <span>Tip</span>
          <span>{formatCents(tipShare)}</span>
        </li>
      </ul>
      <Separator />
      <div className="flex justify-between text-[14px] font-semibold">
        <span>Total</span>
        <span>{formatCents(totals[personId] ?? 0)}</span>
      </div>
    </div>
  )
}
