'use client'

// Phase 6 (D-13): Identity-only picker. Host is NOT pre-locked — host identity
// derives from URL hostToken match in CollaborativeClaimingView, not from being
// the first person in session.people. No 'taken by host' special treatment.

import { Card } from '@/components/ui/card'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import type { PublicSessionPayload } from '@/lib/sessionSchema'
import type { PersonId } from '@/stores/useBillStore'

interface PersonSlotPickerProps {
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => void | Promise<void>
}

export function PersonSlotPicker({ session, onSelect }: PersonSlotPickerProps) {
  const slots = session.claims?.personSlots ?? {}
  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-[20px] font-semibold leading-[1.2]">Who are you?</h1>
        <p className="mt-1 text-[16px] text-zinc-500">Pick your name from the list below.</p>
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {session.people.map((person) => {
          const taken = slots[person.id] === true
          return (
            <li key={person.id}>
              <Card
                role={taken ? undefined : 'button'}
                aria-label={taken ? `${person.name} (taken)` : `Claim slot ${person.name}`}
                aria-disabled={taken}
                onClick={taken ? undefined : () => onSelect(person.id)}
                className={[
                  'flex min-h-[72px] flex-col items-center justify-center gap-2 px-3 py-4 transition-opacity',
                  taken ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
                  aria-hidden="true"
                >
                  {person.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[16px]">
                  {person.name}
                  {taken && <span className="ml-1 text-[14px] text-zinc-500">(taken)</span>}
                </span>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
