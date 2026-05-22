'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useBillStore, AVATAR_COLORS } from '@/stores/useBillStore'
import type { PersonId } from '@/stores/useBillStore'

export function AddPeopleStep() {
  const people = useBillStore((s) => s.people)
  const addPerson = useBillStore((s) => s.addPerson)
  const removePerson = useBillStore((s) => s.removePerson)
  const setStep = useBillStore((s) => s.setStep)

  const inputRef = useRef<HTMLInputElement>(null)
  const [canAdd, setCanAdd] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<{ id: PersonId; name: string } | null>(null)

  // Attach native DOM listeners directly — bypasses React's synthetic event
  // delegation, which silently drops input events on iOS WKWebView (Safari and
  // all iOS Chrome builds). The 'input', 'change', and 'compositionend' paths
  // cover every text-entry route the browser might use.
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const sync = () => setCanAdd(input.value.trim().length > 0)
    input.addEventListener('input', sync)
    input.addEventListener('change', sync)
    input.addEventListener('compositionend', sync)
    return () => {
      input.removeEventListener('input', sync)
      input.removeEventListener('change', sync)
      input.removeEventListener('compositionend', sync)
    }
  }, [])

  const handleAdd = () => {
    const trimmed = inputRef.current?.value.trim() ?? ''
    if (!trimmed) return
    addPerson(trimmed)
    if (inputRef.current) inputRef.current.value = ''
    setCanAdd(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {people.length === 0 ? (
        <div className="text-center">
          <h1 className="text-[20px] font-semibold leading-[1.2]">Who&apos;s at the table?</h1>
          <p className="mt-4 text-[16px] leading-[1.5] text-zinc-500">
            Add each person&apos;s name. You&apos;ll assign items to them next.
          </p>
        </div>
      ) : (
        <h1 className="text-[20px] font-semibold leading-[1.2]">Add people to your bill</h1>
      )}

      {/* form wrapper ensures iOS gives this input a proper keyboard session */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleAdd() }}
        className="flex flex-col gap-3"
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Enter name"
          defaultValue=""
          maxLength={100}
          autoCapitalize="words"
          className="h-12 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed"
        />
        <Button
          type="submit"
          disabled={!canAdd}
          className="h-12 w-full"
        >
          Add Person
        </Button>
      </form>

      <ul className="flex flex-col gap-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex h-14 items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex]}`}
              aria-hidden="true"
            >
              {person.name.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 text-[16px]">{person.name}</span>
            <button
              type="button"
              aria-label={`Remove ${person.name}`}
              onClick={() => setPendingRemove({ id: person.id, name: person.name })}
              className="flex h-12 w-12 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
            >
              <Trash2 size={20} />
            </button>
          </li>
        ))}
      </ul>

      <Button
        onClick={() => setStep(2)}
        disabled={people.length === 0}
        className="mt-auto h-12 w-full bg-amber-600 hover:bg-amber-700"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        Continue to items
      </Button>

      <Dialog
        open={pendingRemove !== null}
        onOpenChange={(open) => { if (!open) setPendingRemove(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {pendingRemove?.name}?</DialogTitle>
            <DialogDescription>
              Any items currently assigned to them will become unassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingRemove) {
                  removePerson(pendingRemove.id)
                  setPendingRemove(null)
                }
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
