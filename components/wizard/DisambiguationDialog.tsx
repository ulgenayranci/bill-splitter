'use client'

import { useState, useRef, useEffect } from 'react'
import { Pencil, Camera, LoaderCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Item, ItemId } from '@/stores/useBillStore'

type DialogState = 'choices' | 'editing' | 'clarifying' | 'clarify-done'

export interface DisambiguationDialogProps {
  item: Item | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: ItemId, name: string) => void
}

export function DisambiguationDialog({
  item,
  open,
  onOpenChange,
  onSave,
}: DisambiguationDialogProps) {
  const [dialogState, setDialogState] = useState<DialogState>('choices')
  const [editedName, setEditedName] = useState('')
  const menuFileInputRef = useRef<HTMLInputElement>(null)
  const clarifyAbortRef = useRef<AbortController | null>(null)

  // Pitfall 3 mitigation: re-sync editedName + reset dialogState only when
  // the item IDENTITY changes (not on every render).
  useEffect(() => {
    if (item) {
      setEditedName(item.name)
      setDialogState('choices')
    }
  }, [item?.id])

  // Pitfall 4 mitigation: cancel in-flight clarify on unmount.
  useEffect(() => {
    return () => { clarifyAbortRef.current?.abort() }
  }, [])

  const handleTakeMenuPhoto = () => {
    menuFileInputRef.current?.click()
  }

  const handleMenuFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !item) return
    e.target.value = ''
    setDialogState('clarifying')

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('FileReader failed'))
        reader.readAsDataURL(file)
      })

      clarifyAbortRef.current?.abort()
      clarifyAbortRef.current = new AbortController()
      const res = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawName: item.rawName ?? item.name, image: base64 }),
        signal: clarifyAbortRef.current.signal,
      })
      if (!res.ok) throw new Error(`Clarify route returned ${res.status}`)
      const data = (await res.json()) as { displayName: string }
      // D-09: empty string falls back to existing item.name (best guess from expansion).
      setEditedName(data.displayName.trim() || item.name)
    } catch (err) {
      console.error(err)
      // D-09: clarify failure = use the AI's best guess (item.name) as fallback.
      // No error toast — the user sees an editable field, which IS the recovery path.
      setEditedName(item.name)
    }
    setDialogState('clarify-done')
  }

  const handleSave = () => {
    if (!item) return
    const trimmed = editedName.trim() || item.name
    onSave(item.id, trimmed)
    onOpenChange(false)
  }

  // Body of the dialog content depends on dialogState.
  const renderBody = () => {
    if (dialogState === 'choices') {
      return (
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialogState('editing')}
            className="h-14 w-full justify-center gap-2"
          >
            <Pencil size={20} />
            Type name
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTakeMenuPhoto}
            className="h-14 w-full justify-center gap-2"
          >
            <Camera size={20} />
            Take menu photo
          </Button>
        </div>
      )
    }
    if (dialogState === 'clarifying') {
      return (
        <div className="flex flex-col items-center justify-center min-h-24 gap-4">
          <LoaderCircle size={32} className="text-zinc-500 animate-spin" aria-hidden="true" />
          <p className="text-[14px] text-zinc-500">Checking the menu…</p>
        </div>
      )
    }
    // 'editing' or 'clarify-done' — both show the edit field.
    return (
      <div className="flex flex-col gap-3">
        {dialogState === 'editing' && (
          <button
            type="button"
            onClick={() => setDialogState('choices')}
            className="self-start text-sm text-zinc-500 hover:text-zinc-700"
          >
            ← Back
          </button>
        )}
        <Input
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          placeholder="Item name"
          maxLength={100}
          className="h-12 text-base"
          autoFocus
          data-testid="disambiguation-input"
        />
        <p className="text-xs text-zinc-400">AI suggested a name — edit if needed</p>
        <Button
          type="button"
          onClick={handleSave}
          className="h-12 w-full"
        >
          Save name
        </Button>
      </div>
    )
  }

  const description = item ? (item.name.trim() || 'Unknown item') : ''

  return (
    <Dialog
      open={open && item !== null}
      onOpenChange={(nextOpen) => { if (!nextOpen) onOpenChange(false) }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What&apos;s this item?</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {renderBody()}
        <input
          ref={menuFileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleMenuFileChange}
          aria-hidden="true"
          tabIndex={-1}
          data-testid="menu-file-input"
        />
      </DialogContent>
    </Dialog>
  )
}
