'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useBillStore, AVATAR_COLORS } from '@/stores/useBillStore'
import type { PersonId, Item, ItemId } from '@/stores/useBillStore'
import {
  computePersonTotals,
  computeSubtotalCents,
  computeTipCents,
  formatCents,
} from '@/lib/billMath'

/**
 * Compute a single person's share of an item using the largest-remainder method.
 * This is a UI display helper — same math as computePersonTotals but per item.
 */
function personItemShare(
  item: Item,
  personId: PersonId,
  assignments: Record<ItemId, PersonId[]>
): number {
  const sharers = assignments[item.id] ?? []
  if (!sharers.includes(personId)) return 0
  const base = Math.floor(item.priceCents / sharers.length)
  const remainder = item.priceCents % sharers.length
  const idx = sharers.indexOf(personId)
  return base + (idx < remainder ? 1 : 0)
}

export function ResultsStep() {
  const people = useBillStore((s) => s.people)
  const items = useBillStore((s) => s.items)
  const assignments = useBillStore((s) => s.assignments)
  const tipPercent = useBillStore((s) => s.tipPercent)
  const setStep = useBillStore((s) => s.setStep)

  const [expandedPersonId, setExpandedPersonId] = useState<PersonId | null>(null)

  // Compute totals once per render
  const totals = computePersonTotals(people, items, assignments, tipPercent)
  const subtotalCents = computeSubtotalCents(items)
  const tipCents = computeTipCents(subtotalCents, tipPercent)
  const totalBillCents = subtotalCents + tipCents

  const handleCardClick = (personId: PersonId) => {
    setExpandedPersonId((prev) => (prev === personId ? null : personId))
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Heading */}
      <h1 className="text-[20px] font-semibold leading-[1.2]">
        Here&apos;s what each person owes
      </h1>

      {/* Back button */}
      <Button
        variant="outline"
        onClick={() => setStep(4)}
        className="h-12 self-start px-6"
      >
        Back to tip
      </Button>

      {/* Per-person cards */}
      <ul className="flex flex-col gap-3">
        {people.map((person, personIndex) => {
          const isExpanded = expandedPersonId === person.id
          const personTotal = totals[person.id] ?? 0

          // Compute tip share for this person
          const tipBase = Math.floor(tipCents / people.length)
          const tipRemainder = tipCents % people.length
          const tipShare = tipBase + (personIndex < tipRemainder ? 1 : 0)

          // Items this person has a share in
          const personItems = items.filter(
            (item) =>
              (assignments[item.id] ?? []).includes(person.id)
          )

          return (
            <li key={person.id}>
              <Card
                className="cursor-pointer px-4 py-3 gap-0"
                onClick={() => handleCardClick(person.id)}
              >
                {/* Card header row */}
                <div className="flex items-center gap-3">
                  {/* Avatar circle */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex]}`}
                    aria-hidden="true"
                  >
                    {person.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + total */}
                  <div className="flex flex-1 items-center justify-between">
                    <span className="text-[20px] font-semibold">
                      {person.name}
                    </span>
                    <span
                      className={`text-[28px] font-semibold text-amber-600`}
                    >
                      {formatCents(personTotal)}
                    </span>
                  </div>

                  {/* Chevron */}
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-3 flex flex-col gap-2">
                    {/* Item lines */}
                    {personItems.map((item) => {
                      const share = personItemShare(item, person.id, assignments)
                      return (
                        <div
                          key={item.id}
                          className="flex justify-between text-[14px] text-zinc-600"
                        >
                          <span>{item.name}</span>
                          <span>{formatCents(share)}</span>
                        </div>
                      )
                    })}

                    {/* Tip share line */}
                    <div className="flex justify-between text-[14px] text-zinc-600">
                      <span>Tip: {formatCents(tipShare)}</span>
                    </div>

                    <Separator />

                    {/* Line total */}
                    <div className="flex justify-between text-[14px] font-semibold">
                      <span>Total: {formatCents(personTotal)}</span>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      {/* Fixed bottom strip */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-zinc-100 dark:bg-zinc-900 p-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <p className="font-semibold text-[16px]">
          Total bill: {formatCents(totalBillCents)}
        </p>
      </div>
    </div>
  )
}
