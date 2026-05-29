'use client'

import { ChevronLeft } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import {
  computePersonShareFromClaims,
  formatCents,
} from '@/lib/billMath'
import type { PublicSessionPayload } from '@/lib/sessionSchema'
import type { PersonId } from '@/stores/useBillStore'

export interface PersonResultsScreenProps {
  session: PublicSessionPayload
  personId: PersonId
  onBack?: () => void
}

export function PersonResultsScreen({ session, personId, onBack }: PersonResultsScreenProps) {
  const person = session.people.find((p) => p.id === personId)
  if (!person) return null

  const tipCents = session.tips?.[personId] ?? 0
  const result = computePersonShareFromClaims(
    personId,
    session.items,
    session.claims?.items ?? {},
    tipCents
  )

  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-background">
      <div className="flex flex-col gap-4 px-6 py-8">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 self-start text-[14px] text-zinc-500 hover:text-zinc-800"
            aria-label="Back to tip"
          >
            <ChevronLeft size={16} />
            Back
          </button>
        )}
        <h1 className="text-[20px] font-semibold leading-[1.2]">You&rsquo;re all set!</h1>

        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
            aria-hidden="true"
          >
            {person.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span
              className="text-[28px] font-semibold text-amber-600"
              data-testid="results-total"
            >
              {formatCents(result.total)}
            </span>
            <span className="text-[14px] text-zinc-500">Your share</span>
          </div>
        </div>

        <Separator />

        <ul className="flex flex-col gap-1" data-testid="results-line-items">
          {result.lineItems.map(({ item, shareCents, claimedQty }) => (
            <li
              key={item.id}
              className="flex justify-between text-[14px]"
              data-testid={`results-row-${item.id}`}
            >
              <span>
                {item.name}
                {claimedQty > 1 && (
                  <span className="ml-1 text-zinc-400">×{claimedQty}</span>
                )}
              </span>
              <span>{formatCents(shareCents)}</span>
            </li>
          ))}
          <li className="flex justify-between text-[14px]" data-testid="results-tip">
            <span>Tip</span>
            <span>{formatCents(result.tip)}</span>
          </li>
        </ul>

        <Separator />

        <div className="flex justify-between text-[14px] font-semibold">
          <span>Total</span>
          <span>{formatCents(result.total)}</span>
        </div>
      </div>
    </main>
  )
}
