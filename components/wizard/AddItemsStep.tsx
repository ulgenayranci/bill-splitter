'use client'

import { useState } from 'react'
import { Trash2, Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useBillStore } from '@/stores/useBillStore'
import { parseCents, formatCents } from '@/lib/billMath'
import type { ItemId } from '@/stores/useBillStore'

function parsePriceWithError(raw: string): { cents: number } | { error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { error: 'Enter a price' }
  const cents = parseCents(trimmed)
  if (cents === null) return { error: 'Numbers only' }
  return { cents }
}

interface EditState {
  id: ItemId | null // null = adding new item
  name: string
  price: string
  priceError: string | null
}

const EMPTY_EDIT: EditState = { id: null, name: '', price: '', priceError: null }

export function AddItemsStep() {
  const items = useBillStore((s) => s.items)
  const addItem = useBillStore((s) => s.addItem)
  const updateItem = useBillStore((s) => s.updateItem)
  const removeItem = useBillStore((s) => s.removeItem)
  const setStep = useBillStore((s) => s.setStep)

  const [editState, setEditState] = useState<EditState | null>(null)
  const [pendingRemove, setPendingRemove] = useState<{ id: ItemId; name: string } | null>(null)

  const isAdding = editState !== null && editState.id === null
  const editingId = editState?.id ?? null

  const handleAddItemClick = () => {
    setEditState(EMPTY_EDIT)
  }

  const handleEditItemClick = (item: { id: ItemId; name: string; priceCents: number }) => {
    if (editState?.id === item.id) return // already editing
    setEditState({
      id: item.id,
      name: item.name,
      price: (item.priceCents / 100).toFixed(2),
      priceError: null,
    })
  }

  const handleCommit = () => {
    if (!editState) return
    const priceResult = parsePriceWithError(editState.price)
    if ('error' in priceResult) {
      setEditState({ ...editState, priceError: priceResult.error })
      return
    }
    const nameVal = editState.name.trim() || 'Item'
    if (editState.id === null) {
      addItem(nameVal, priceResult.cents)
    } else {
      updateItem(editState.id, nameVal, priceResult.cents)
    }
    setEditState(null)
  }

  const handleCancel = () => {
    setEditState(null)
  }

  const handleRemoveConfirm = () => {
    if (pendingRemove) {
      removeItem(pendingRemove.id)
      setPendingRemove(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Heading region */}
      {items.length === 0 && !isAdding ? (
        <div className="text-center">
          <h1 className="text-[20px] font-semibold leading-[1.2]">What did everyone order?</h1>
          <p className="mt-4 text-[16px] leading-[1.5] text-zinc-500">
            Add each item and its price. You&apos;ll split them in the next step.
          </p>
        </div>
      ) : (
        <h1 className="text-[20px] font-semibold leading-[1.2]">Items</h1>
      )}

      {/* Items list */}
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={item.id}>
            {editingId === item.id ? (
              /* Inline edit mode */
              <Card className="flex flex-row items-center gap-2 px-4 py-3">
                <Input
                  placeholder="Item name"
                  value={editState!.name}
                  onChange={(e) => setEditState({ ...editState!, name: e.target.value })}
                  className="flex-1 h-10 text-base"
                  maxLength={100}
                />
                <div className="flex flex-col gap-1 w-28">
                  <Input
                    placeholder="Price"
                    value={editState!.price}
                    inputMode="decimal"
                    onChange={(e) => setEditState({ ...editState!, price: e.target.value, priceError: null })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCommit() } }}
                    className="h-10 text-base"
                    maxLength={9}
                    aria-invalid={editState!.priceError ? true : undefined}
                  />
                  {editState!.priceError && (
                    <span className="text-red-600 text-sm">{editState!.priceError}</span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Confirm"
                  onClick={handleCommit}
                  className="flex h-12 w-12 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100"
                >
                  <Check size={20} />
                </button>
              </Card>
            ) : (
              /* Display mode */
              <Card
                className="flex flex-row items-center gap-3 px-4 min-h-14 cursor-pointer hover:bg-zinc-50"
                onClick={() => handleEditItemClick(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleEditItemClick(item) }}
                data-testid={`item-row-${index}`}
              >
                <span className="flex-1 text-[16px]">{item.name}</span>
                <span className="text-[14px] text-zinc-500">{formatCents(item.priceCents)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPendingRemove({ id: item.id, name: item.name })
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
                >
                  <Trash2 size={20} />
                </button>
              </Card>
            )}
          </li>
        ))}

        {/* Add item inline row */}
        {isAdding ? (
          <li>
            <Card className="flex flex-row items-center gap-2 px-4 py-3">
              <Input
                placeholder="Item name"
                value={editState!.name}
                onChange={(e) => setEditState({ ...editState!, name: e.target.value })}
                className="flex-1 h-10 text-base"
                maxLength={100}
                autoFocus
              />
              <div className="flex flex-col gap-1 w-28">
                <Input
                  placeholder="Price"
                  value={editState!.price}
                  inputMode="decimal"
                  onChange={(e) => setEditState({ ...editState!, price: e.target.value, priceError: null })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCommit() } }}
                  className="h-10 text-base"
                  maxLength={9}
                  aria-invalid={editState!.priceError ? true : undefined}
                />
                {editState!.priceError && (
                  <span className="text-red-600 text-sm">{editState!.priceError}</span>
                )}
              </div>
              <button
                type="button"
                aria-label="Confirm"
                onClick={handleCommit}
                className="flex h-12 w-12 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100"
              >
                <Check size={20} />
              </button>
            </Card>
          </li>
        ) : (
          <li>
            <button
              type="button"
              aria-label="Add item"
              onClick={handleAddItemClick}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-[16px] text-zinc-500 hover:bg-zinc-50"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
            >
              <Plus size={20} />
              Add item
            </button>
          </li>
        )}
      </ul>

      {/* Bottom CTA */}
      <Button
        onClick={() => setStep(3)}
        disabled={items.length === 0}
        className="mt-auto h-12 w-full bg-amber-600 hover:bg-amber-700"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        Assign items
      </Button>

      {/* Remove confirmation Dialog */}
      <Dialog
        open={pendingRemove !== null}
        onOpenChange={(open) => { if (!open) setPendingRemove(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {pendingRemove?.name}?</DialogTitle>
            <DialogDescription>
              It will be removed from all assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveConfirm}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
