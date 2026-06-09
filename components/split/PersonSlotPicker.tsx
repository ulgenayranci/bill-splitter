'use client'

// Phase 6 (D-13): Identity-only picker. Host is NOT pre-locked — host identity
// derives from URL hostToken match in CollaborativeClaimingView, not from being
// the first person in session.people. No 'taken by host' special treatment.
// Phase 9 (IDENT-03): Added "I'm not listed" inline add form + opacity-50 fix.
// GAP-09-NOLOCK: All names are always selectable — no taken/greyed/disabled state.
// The flat model has no host role, so exclusive slot ownership is removed entirely.
// Phase 11 (D-05/07): Added onRemovePerson + onRenamePerson optional props with
// per-card inline rename form and remove affordances.

import { useState, useEffect } from 'react'
import { Pencil, X } from 'lucide-react'
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
  onRemovePerson?: (personId: PersonId) => Promise<void>
  onRenamePerson?: (personId: PersonId, newName: string) => Promise<void>
}

export function PersonSlotPicker({ session, onSelect, onAddPerson, onRemovePerson, onRenamePerson }: PersonSlotPickerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Pitfall 4 guard: if the person being renamed/edited is removed by another client
  // on SWR refresh, clear editingPersonId so we don't show a stale form.
  useEffect(() => {
    if (editingPersonId && !session.people.some((p) => p.id === editingPersonId)) {
      setEditingPersonId(null)
    }
  }, [session.people, editingPersonId])

  const handleAddMe = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    onAddPerson?.(trimmed)
  }

  const handleRenameConfirm = (personId: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed) return
    void onRenamePerson?.(personId as PersonId, trimmed)
    setEditingPersonId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-3">
        {session.people.map((person) => {
          const isEditing = editingPersonId === person.id
          return (
            <li key={person.id}>
              {isEditing ? (
                <Card className="flex flex-col gap-2 px-3 py-3">
                  <Input
                    placeholder="Name"
                    maxLength={50}
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameConfirm(person.id)
                      if (e.key === 'Escape') setEditingPersonId(null)
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-[13px]"
                      onClick={() => handleRenameConfirm(person.id)}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1 text-[13px]"
                      onClick={() => setEditingPersonId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card
                  role="button"
                  aria-label={`Claim slot ${person.name}`}
                  onClick={() => onSelect(person.id as PersonId)}
                  className="flex min-h-[72px] flex-col items-center justify-center gap-2 px-3 py-4 cursor-pointer relative"
                >
                  {/* Rename / Remove controls — only render when callbacks are provided */}
                  {(onRenamePerson || onRemovePerson) && (
                    <div className="absolute top-1 right-1 flex gap-0.5">
                      {onRenamePerson && (
                        <button
                          type="button"
                          aria-label={`Rename ${person.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenameValue(person.name)
                            setEditingPersonId(person.id)
                          }}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                      )}
                      {onRemovePerson && (
                        <button
                          type="button"
                          aria-label={`Remove ${person.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            void onRemovePerson(person.id as PersonId)
                          }}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-zinc-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
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
              )}
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
