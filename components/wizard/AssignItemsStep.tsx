'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useBillStore, AVATAR_COLORS } from '@/stores/useBillStore'
import { formatCents } from '@/lib/billMath'
import type { ItemId, PersonId } from '@/stores/useBillStore'
import { ShareLinkButton } from './ShareLinkButton'

export function AssignItemsStep() {
  const items = useBillStore((s) => s.items)
  const people = useBillStore((s) => s.people)
  const assignments = useBillStore((s) => s.assignments)
  const setAssignment = useBillStore((s) => s.setAssignment)
  const setStep = useBillStore((s) => s.setStep)

  function toggleAssignment(itemId: ItemId, personId: PersonId) {
    const current = assignments[itemId] ?? []
    const next = current.includes(personId)
      ? current.filter((p) => p !== personId)
      : [...current, personId]
    setAssignment(itemId, next)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Heading */}
      <div>
        <h1 className="text-[20px] font-semibold leading-[1.2]">Assign items</h1>
        <p className="mt-1 text-[14px] leading-[1.4] text-zinc-500">
          Tap a person to assign. Tap again to share.
        </p>
      </div>

      {/* Scrollable items list */}
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const assignedIds = assignments[item.id] ?? []
          const isShared = assignedIds.length >= 2
          const base = isShared ? Math.floor(item.priceCents / assignedIds.length) : null
          const remainder = isShared ? item.priceCents % assignedIds.length : 0

          return (
            <li key={item.id}>
              <Card className="flex flex-col gap-3 px-4 py-3">
                {/* Item header */}
                <div className="flex items-center justify-between">
                  <span className="text-[16px] font-medium">{item.name}</span>
                  <div className="flex items-center gap-2">
                    {isShared && (
                      <Badge variant="secondary">Shared</Badge>
                    )}
                    <span className="text-[14px] text-zinc-500">
                      {formatCents(item.priceCents)}
                    </span>
                  </div>
                </div>

                {/* Person chips */}
                <div className="flex flex-wrap gap-2">
                  {people.map((person) => {
                    const isFilled = assignedIds.includes(person.id)
                    return (
                      <button
                        key={person.id}
                        type="button"
                        aria-label={`Assign ${item.name} to ${person.name}`}
                        onClick={() => toggleAssignment(item.id, person.id)}
                        className={[
                          'flex min-h-12 min-w-12 h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all',
                          isFilled
                            ? `${AVATAR_COLORS[person.colorIndex]} text-white ring-2 ring-amber-600 ring-offset-2`
                            : 'bg-zinc-200 text-zinc-600',
                        ].join(' ')}
                      >
                        {person.name.charAt(0).toUpperCase()}
                      </button>
                    )
                  })}
                </div>

                {/* Unassigned state */}
                {assignedIds.length === 0 && (
                  <p className="text-[14px] text-zinc-400">Tap a name to assign</p>
                )}

                {/* Shared split display */}
                {isShared && base !== null && (
                  <p className="text-[14px] text-zinc-500">
                    {remainder === 0
                      ? `Split equally — ${formatCents(base)} each`
                      : `Split equally — ${formatCents(base)}–${formatCents(base + 1)} each`}
                  </p>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      {/* Bottom CTA row */}
      <div className="mt-auto flex flex-col gap-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
        <Button
          variant="outline"
          onClick={() => setStep(3)}
          className="h-12 w-full"
        >
          Back
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setStep(5)}
            className="h-12 flex-1"
          >
            See results
          </Button>
          <ShareLinkButton />
        </div>
      </div>
    </div>
  )
}
