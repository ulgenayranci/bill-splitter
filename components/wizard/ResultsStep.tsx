'use client'

import { useState } from 'react'
import { ChevronDown, Copy, Check } from 'lucide-react'
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
import { HostWaitingScreen } from './HostWaitingScreen'

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
  const syncStatus = useBillStore((s) => s.syncStatus)
  const sessionId = useBillStore((s) => s.sessionId)
  const reset = useBillStore((s) => s.reset)

  const [expandedPersonId, setExpandedPersonId] = useState<PersonId | null>(null)
  const [copied, setCopied] = useState(false)

  // Route to HostWaitingScreen when host has started sharing session
  if (syncStatus === 'waiting' && sessionId) {
    return <HostWaitingScreen sessionId={sessionId} />
  }

  // Compute totals once per render
  const totals = computePersonTotals(people, items, assignments, tipPercent)
  const subtotalCents = computeSubtotalCents(items)
  const tipCents = computeTipCents(subtotalCents, tipPercent)
  const totalBillCents = subtotalCents + tipCents

  const handleCardClick = (personId: PersonId) => {
    setExpandedPersonId((prev) => (prev === personId ? null : personId))
  }

  async function handleCopy() {
    try {
      const { people: ps, items: is, assignments: as_, tipPercent: tp } =
        useBillStore.getState()
      const totals = computePersonTotals(ps, is, as_, tp)
      const subtotal = computeSubtotalCents(is)
      const tip = computeTipCents(subtotal, tp)
      const lines = ps.map((p) => `${p.name} owes ${formatCents(totals[p.id] ?? 0)}`)
      lines.push(`Total: ${formatCents(subtotal + tip)}`)
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silent fallback — clipboard access denied is non-critical (matches HostWaitingScreen)
    }
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
                      <span>Tip</span>
                      <span>{formatCents(tipShare)}</span>
                    </div>

                    <Separator />

                    {/* Line total */}
                    <div className="flex justify-between text-[14px] font-semibold">
                      <span>Total</span>
                      <span>{formatCents(personTotal)}</span>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      {/* Unclaimed items section (D-13) */}
      {(() => {
        const unclaimedItems = items.filter(
          (i) => !(assignments[i.id] && assignments[i.id].length > 0)
        )
        if (unclaimedItems.length === 0) return null
        return (
          <Card className="flex flex-col gap-2 px-4 py-3">
            <span className="text-[16px] font-semibold">Unclaimed items</span>
            {unclaimedItems.map((item) => (
              <div key={item.id} className="flex justify-between text-[14px]">
                <span>{item.name}</span>
                <span>{formatCents(item.priceCents)}</span>
              </div>
            ))}
            <p className="text-[14px] text-zinc-500">
              These items were not claimed. Sort them out with the table.
            </p>
          </Card>
        )
      })()}

      {/* Fixed bottom strip */}
      <div
        className="fixed bottom-0 left-0 right-0 flex flex-col gap-3 bg-zinc-100 dark:bg-zinc-900 p-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <p className="font-semibold text-[16px]">
          Total bill: {formatCents(totalBillCents)}
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="h-12 flex-1 gap-2"
          >
            {copied ? (
              <>
                <Check size={16} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={16} />
                Copy summary
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={reset}
            className="h-12 flex-1"
          >
            Start over
          </Button>
        </div>
      </div>
    </div>
  )
}
