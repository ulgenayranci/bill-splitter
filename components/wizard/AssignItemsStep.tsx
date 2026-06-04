'use client'

import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useBillStore, AVATAR_COLORS } from '@/stores/useBillStore'
import { formatCents } from '@/lib/billMath'
import type { Item, ItemId, PersonId } from '@/stores/useBillStore'
import { ShareLinkButton } from './ShareLinkButton'
import { BillPhotoLightbox } from './BillPhotoLightbox'

export function AssignItemsStep() {
  const items = useBillStore((s) => s.items)
  const people = useBillStore((s) => s.people)
  const assignments = useBillStore((s) => s.assignments)
  const setAssignment = useBillStore((s) => s.setAssignment)
  const setStep = useBillStore((s) => s.setStep)
  const billImageUrl = useBillStore((s) => s.billImageUrl)

  const [showUnassignedDialog, setShowUnassignedDialog] = useState(false)
  const [unassignedItems, setUnassignedItems] = useState<Item[]>([])
  const [photoOpen, setPhotoOpen] = useState(false)

  function toggleAssignment(itemId: ItemId, personId: PersonId) {
    const current = assignments[itemId] ?? []
    const next = current.includes(personId)
      ? current.filter((p) => p !== personId)
      : [...current, personId]
    setAssignment(itemId, next)
  }

  function handleContinue() {
    // Read directly from store to guarantee latest state at click time,
    // avoiding any stale render-time snapshot of items/assignments.
    const { items: storeItems, assignments: storeAssignments } = useBillStore.getState()
    const unassigned = storeItems.filter(
      (item) => !storeAssignments[item.id] || storeAssignments[item.id].length === 0
    )
    if (unassigned.length > 0) {
      setUnassignedItems(unassigned)
      setShowUnassignedDialog(true)
    } else {
      setStep(4)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Heading */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold leading-[1.2]">Assign items</h1>
          <p className="mt-1 text-[14px] leading-[1.4] text-zinc-500">
            Tap a person to assign. Tap again to share.
          </p>
        </div>
        {billImageUrl && (
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            aria-label="View bill photo"
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50"
          >
            <Receipt size={15} aria-hidden="true" />
            View bill
          </button>
        )}
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
                  <span className="text-[16px] font-medium">
                    {item.name}
                    {(item.quantity ?? 1) > 1 && (
                      <span className="ml-2 text-[14px] font-normal text-zinc-500">×{item.quantity}</span>
                    )}
                  </span>
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
                        aria-label={`${isFilled ? 'Remove' : 'Assign'} ${item.name} ${isFilled ? 'from' : 'to'} ${person.name}`}
                        onClick={() => toggleAssignment(item.id, person.id)}
                        className={[
                          'flex h-9 max-w-[9rem] items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition-all',
                          isFilled
                            ? `${AVATAR_COLORS[person.colorIndex]} text-white`
                            : 'border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50',
                        ].join(' ')}
                      >
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isFilled ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{person.name}</span>
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
      <div className="mt-auto flex flex-col gap-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <Button
          variant="outline"
          onClick={() => setStep(1)}
          className="h-12 w-full"
        >
          Back
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleContinue}
            className="h-12 flex-1"
          >
            See results
          </Button>
          <ShareLinkButton />
        </div>
      </div>

      <Dialog
        open={showUnassignedDialog}
        onOpenChange={(open) => { if (!open) setShowUnassignedDialog(false) }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Some items aren&apos;t assigned</DialogTitle>
            <DialogDescription>
              These items have no one assigned: {unassignedItems.map((i) => i.name).join(', ')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowUnassignedDialog(false)}>
              Go back to assign them
            </Button>
            <Button
              variant="destructive"
              onClick={() => { setShowUnassignedDialog(false); setStep(4) }}
            >
              Continue anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BillPhotoLightbox open={photoOpen} onClose={() => setPhotoOpen(false)} />
    </div>
  )
}
