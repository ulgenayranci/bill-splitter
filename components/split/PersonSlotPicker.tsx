'use client'

// Phase 6 (D-13): Identity-only picker. Host is NOT pre-locked — host identity
// derives from URL hostToken match in CollaborativeClaimingView, not from being
// the first person in session.people. No 'taken by host' special treatment.
// Phase 9 (IDENT-03): Added "I'm not listed" inline add form + opacity-50 fix.
// GAP-09-NOLOCK: All names are always selectable — no taken/greyed/disabled state.
// The flat model has no host role, so exclusive slot ownership is removed entirely.

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import type { PublicSessionPayload } from '@/lib/sessionSchema'
import type { PersonId } from '@/stores/useBillStore'

interface PersonSlotPickerProps {
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => void | Promise<void>
  onAddPerson?: (name: string) => Promise<void>
}

export function PersonSlotPicker({ session, onSelect, onAddPerson }: PersonSlotPickerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')

  const handleAddMe = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    onAddPerson?.(trimmed)
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-3">
        {session.people.map((person) => {
          return (
            <li key={person.id}>
              <Card
                role="button"
                aria-label={`Claim slot ${person.name}`}
                onClick={() => onSelect(person.id)}
                className="flex min-h-[72px] flex-col items-center justify-center gap-2 px-3 py-4 cursor-pointer"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
                  aria-hidden="true"
                >
                  {person.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[16px]">
                  {person.name}
                </span>
              </Card>
            </li>
          )
        })}
      </ul>

      {!showAddForm && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="text-[14px] text-amber-600 underline self-start"
        >
          I&apos;m not listed
        </button>
      )}

      {showAddForm && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Your name"
            maxLength={50}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700"
            onClick={handleAddMe}
          >
            Add me
          </Button>
        </div>
      )}
    </div>
  )
}
