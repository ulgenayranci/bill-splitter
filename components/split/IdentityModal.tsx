'use client'

// Phase 9 (IDENT-01, IDENT-03): "Who are you?" dialog wrapper around PersonSlotPicker.
// - allowClose=false: dismiss is blocked (first-time identity prompt — no close-X)
// - allowClose=true: dismiss is forwarded to props.onOpenChange (change-identity mode)
// Handlers (onSelect, onAddPerson) are passed in by the orchestrator (Plan 06).

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PersonSlotPicker } from '@/components/split/PersonSlotPicker'
import type { PublicSessionPayload } from '@/lib/sessionSchema'
import type { PersonId } from '@/stores/useBillStore'

export interface IdentityModalProps {
  open: boolean
  /** When false: initial identity prompt — cannot be dismissed without a selection.
   *  When true: change-identity mode — dismissible. */
  allowClose: boolean
  session: PublicSessionPayload
  onSelect: (personId: PersonId) => Promise<void>
  onAddPerson: (name: string) => Promise<void>
  onRenamePerson?: (personId: PersonId, newName: string) => Promise<void>
  onOpenChange: (open: boolean) => void
}

export function IdentityModal({
  open,
  allowClose,
  session,
  onSelect,
  onAddPerson,
  onRenamePerson,
  onOpenChange,
}: IdentityModalProps) {
  // Reset key increments whenever the modal opens, so PersonSlotPicker's
  // inline-add state (showAddForm, newName) clears on re-open.
  const [openKey, setOpenKey] = useState(0)

  useEffect(() => {
    if (open) {
      setOpenKey((k) => k + 1)
    }
  }, [open])

  const handleOpenChange = (nextOpen: boolean) => {
    // Block dismissal when no identity is selected yet (allowClose=false)
    if (!nextOpen && !allowClose) return
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={allowClose}>
        <DialogHeader>
          <DialogTitle className="text-[20px] font-semibold leading-[1.2]">
            Who are you?
          </DialogTitle>
          <DialogDescription className="text-[16px] text-zinc-500">
            Pick your name from the list below.
          </DialogDescription>
        </DialogHeader>
        <PersonSlotPicker
          key={openKey}
          session={session}
          onSelect={onSelect}
          onAddPerson={onAddPerson}
          onRenamePerson={onRenamePerson}
        />
      </DialogContent>
    </Dialog>
  )
}
