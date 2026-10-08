'use client'

// Phase 6 (D-13): Identity-only picker. Host is NOT pre-locked — host identity
// derives from URL hostToken match in CollaborativeClaimingView, not from being
// the first person in session.people. No 'taken by host' special treatment.
// Phase 9 (IDENT-03): Added "I'm not listed" inline add form + opacity-50 fix.
// GAP-09-NOLOCK: All names are always selectable — no taken/greyed/disabled state.
// The flat model has no host role, so exclusive slot ownership is removed entirely.
// Phase 11 (D-05): Added onRenamePerson optional prop with per-card inline rename form.

import { useState, useEffect } from 'react'
import { Pencil, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import type { PublicSessionPayload } from '@/lib/sessionSchema'
import type { PersonId } from '@/stores/useBillStore'
import { isEmptySeat, seatLabel, seatInitial } from '@/lib/seats'
import { MIN_PEOPLE } from '@/lib/sessionSchema'

/** Result of claiming an empty seat: taken = another phone claimed it first. */
export type ClaimSeatResult = 'ok' | 'taken' | 'error'

interface PersonSlotPickerProps {
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => void | Promise<void>
  onAddPerson?: (name: string) => Promise<void>
  onRenamePerson?: (personId: PersonId, newName: string) => Promise<void>
  /** v2.1: claim an empty "Guest N" seat by typing your name. */
  onClaimSeat?: (personId: PersonId, name: string) => Promise<ClaimSeatResult>
  /** v2.1: remove a card — only offered when nobody has picked items for it. */
  onRemovePerson?: (personId: PersonId) => Promise<RemovePersonResult>
}

/** Result of removing a card: has_items = someone picked items for it meanwhile. */
export type RemovePersonResult = 'ok' | 'has_items' | 'too_few' | 'error'

export function PersonSlotPicker({ session, onSelect, onAddPerson, onRenamePerson, onClaimSeat, onRemovePerson }: PersonSlotPickerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  // v2.1 seat claim: which empty seat is open for typing a name.
  const [claimingSeatId, setClaimingSeatId] = useState<string | null>(null)
  const [seatName, setSeatName] = useState('')
  const [seatError, setSeatError] = useState<string | null>(null)
  const [claimingSeat, setClaimingSeat] = useState(false)

  // Remove (✕) is offered only for cards nobody has picked items for, and never below MIN_PEOPLE.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeNotice, setRemoveNotice] = useState<string | null>(null)
  const peopleWithItems = new Set<string>()
  for (const perItem of Object.values(session.claims?.items ?? {})) {
    if (perItem && typeof perItem === 'object') {
      for (const [pid, claim] of Object.entries(perItem)) if (claim) peopleWithItems.add(pid)
    }
  }
  const canRemove = (personId: string) =>
    Boolean(onRemovePerson) && session.people.length > MIN_PEOPLE && !peopleWithItems.has(personId)

  const handleRemove = async (personId: string, label: string) => {
    if (removing || !onRemovePerson) return
    setRemoving(true)
    try {
      const result = await onRemovePerson(personId as PersonId)
      setConfirmRemoveId(null)
      if (result === 'has_items') setRemoveNotice(`Someone just picked items for ${label}, so it can't be removed.`)
      else if (result === 'too_few') setRemoveNotice('A bill needs at least 2 people.')
      else if (result === 'error') setRemoveNotice("Couldn't remove. Try again")
      else setRemoveNotice(null)
    } finally {
      setRemoving(false)
    }
  }

  const removeButton = (personId: string, label: string) =>
    canRemove(personId) ? (
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={(e) => {
          e.stopPropagation()
          setRemoveNotice(null)
          setConfirmRemoveId(personId)
        }}
        className="absolute top-1 left-1 flex h-11 w-11 items-center justify-center rounded-md text-coral-600"
      >
        <X size={16} aria-hidden="true" />
      </button>
    ) : null

  const confirmCard = (personId: string, label: string) => (
    <Card className="flex min-h-[72px] flex-col items-center justify-center gap-2 px-3 py-3">
      <p className="text-center text-[14px] font-semibold text-zinc-900">Remove {label}?</p>
      <div className="flex w-full gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1 text-[14px]" onClick={() => setConfirmRemoveId(null)}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1 text-[14px] text-danger"
          disabled={removing}
          onClick={() => void handleRemove(personId, label)}
        >
          Remove
        </Button>
      </div>
    </Card>
  )

  // Named people first, then empty seats (stable within each group).
  const orderedPeople = [
    ...session.people.filter((p) => !isEmptySeat(p)),
    ...session.people.filter((p) => isEmptySeat(p)),
  ]

  const openSeat = (personId: string) => {
    setSeatNotice(null)
    setClaimingSeatId(personId)
    setSeatName('')
    setSeatError(null)
  }

  const handleClaimSeat = async (personId: string) => {
    if (claimingSeat) return
    const trimmed = seatName.trim()
    if (!trimmed) { setSeatError('Enter your name'); return }
    if (!onClaimSeat) return
    setClaimingSeat(true)
    try {
      const result = await onClaimSeat(personId as PersonId, trimmed)
      if (result === 'taken') {
        setClaimingSeatId(null)
        setSeatNotice('Someone just took that seat. Pick another one.')
      }
      else if (result === 'error') setSeatError("Couldn't save. Try again")
    } finally {
      setClaimingSeat(false)
    }
  }

  // Pitfall 4 guard: if the person being renamed/edited is removed by another client
  // on SWR refresh, clear editingPersonId so we don't show a stale form.
  useEffect(() => {
    if (editingPersonId && !session.people.some((p) => p.id === editingPersonId)) {
      setEditingPersonId(null)
    }
  }, [session.people, editingPersonId])

  // Shown when the seat you were typing into gets claimed (or removed) by another phone.
  const [seatNotice, setSeatNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!claimingSeatId) return
    const seat = session.people.find((p) => p.id === claimingSeatId)
    if (!seat || !isEmptySeat(seat)) {
      setClaimingSeatId(null)
      setSeatNotice('Someone just took that seat. Pick another one.')
    }
  }, [session.people, claimingSeatId])

  const handleAddMe = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    onAddPerson?.(trimmed)
  }

  const startRename = (personId: string, name: string) => {
    setRenameValue(name)
    setRenameError(null)
    setEditingPersonId(personId)
  }

  // Keep the form open until the save resolves so a failure can be shown in place.
  const handleRenameConfirm = async (personId: string) => {
    if (renaming) return
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenameError('Enter a name'); return }
    setRenaming(true)
    try {
      await onRenamePerson?.(personId as PersonId, trimmed)
      setEditingPersonId(null)
    } catch {
      setRenameError("Couldn't save. Try again")
    } finally {
      setRenaming(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {removeNotice && (
        <p role="alert" data-testid="remove-notice" className="-mb-3 text-[14px] font-medium text-warn-strong">
          {removeNotice}
        </p>
      )}
      {seatNotice && (
        <p role="alert" data-testid="seat-notice" className="-mb-3 text-[14px] font-medium text-warn-strong">
          {seatNotice}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3">
        {orderedPeople.map((person) => {
          const isEditing = editingPersonId === person.id
          const empty = isEmptySeat(person)
          const label = seatLabel(person, session.people)
          if (empty) {
            const open = claimingSeatId === person.id
            return (
              <li key={person.id} className={open || confirmRemoveId === person.id ? 'col-span-2' : undefined}>
                {open ? (
                  <Card className="flex flex-col gap-2 px-3 py-3">
                    <p className="text-[14px] font-semibold text-zinc-900">{label}</p>
                    <Input
                      placeholder="Your name"
                      aria-label="Your name"
                      maxLength={50}
                      value={seatName}
                      autoFocus
                      aria-invalid={seatError === 'Enter your name' || undefined}
                      aria-describedby={seatError ? `seat-error-${person.id}` : undefined}
                      className="h-10 text-base"
                      onChange={(e) => { setSeatName(e.target.value); setSeatError(null) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleClaimSeat(person.id)
                        if (e.key === 'Escape') setClaimingSeatId(null)
                      }}
                    />
                    {seatError && (
                      <p id={`seat-error-${person.id}`} role="alert" className="text-[14px] text-danger">
                        {seatError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 flex-1 text-[14px]"
                        onClick={() => setClaimingSeatId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="h-11 flex-1 text-[14px]"
                        disabled={claimingSeat}
                        onClick={() => void handleClaimSeat(person.id)}
                      >
                        Save
                      </Button>
                    </div>
                  </Card>
                ) : confirmRemoveId === person.id ? (
                  confirmCard(person.id, label)
                ) : (
                  <Card
                    role="button"
                    aria-label={`Take seat ${label}`}
                    data-testid="empty-seat"
                    onClick={() => openSeat(person.id)}
                    className="relative flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-2 border-dashed px-3 py-4"
                  >
                    {removeButton(person.id, label)}
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-dashed border-n400 bg-white font-semibold text-n500"
                      aria-hidden="true"
                    >
                      {seatInitial(person)}
                    </div>
                    <span className="text-[16px] text-n600">{label}</span>
                    <span className="text-[12px] text-n500">Tap if this is you</span>
                  </Card>
                )}
              </li>
            )
          }
          return (
            <li key={person.id} className={confirmRemoveId === person.id ? 'col-span-2' : undefined}>
              {isEditing ? (
                <Card className="flex flex-col gap-2 px-3 py-3">
                  <Input
                    placeholder="Name"
                    aria-label="Name"
                    maxLength={50}
                    value={renameValue}
                    autoFocus
                    aria-invalid={renameError === 'Enter a name' || undefined}
                    aria-describedby={renameError ? `rename-error-${person.id}` : undefined}
                    className="h-10 text-base"
                    onChange={(e) => { setRenameValue(e.target.value); setRenameError(null) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRenameConfirm(person.id)
                      if (e.key === 'Escape') setEditingPersonId(null)
                    }}
                  />
                  {renameError && (
                    <p id={`rename-error-${person.id}`} role="alert" className="text-[14px] text-danger">
                      {renameError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 text-[14px]"
                      onClick={() => setEditingPersonId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="h-11 flex-1 text-[14px]"
                      disabled={renaming}
                      onClick={() => void handleRenameConfirm(person.id)}
                    >
                      Save
                    </Button>
                  </div>
                </Card>
              ) : confirmRemoveId === person.id ? (
                confirmCard(person.id, label)
              ) : (
                <Card
                  role="button"
                  aria-label={`Claim slot ${label}`}
                  onClick={() => onSelect(person.id as PersonId)}
                  className="flex min-h-[72px] flex-col items-center justify-center gap-2 px-3 py-4 cursor-pointer relative"
                >
                  {removeButton(person.id, label)}
                  {/* Rename control — only render when callback is provided */}
                  {onRenamePerson && (
                    <div className="absolute top-1 right-1 flex gap-0.5">
                      <button
                        type="button"
                        aria-label={`Rename ${person.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          startRename(person.id, person.name)
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-white text-zinc-500"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
                    aria-hidden="true"
                  >
                    {seatInitial(person)}
                  </div>
                  <span className="text-[16px]">
                    {label}
                  </span>
                </Card>
              )}
            </li>
          )
        })}
      </ul>

      {!showAddForm && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="text-[14px] text-coral-600 underline self-start"
        >
          Add person
        </button>
      )}

      {showAddForm && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Name"
            aria-label="New person's name"
            maxLength={50}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-12 w-full rounded-lg text-base"
          />
          <Button
            type="button"
            className="h-12 w-full"
            onClick={handleAddMe}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  )
}
