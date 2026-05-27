'use client'

import { useState, useMemo } from 'react'
import { X, Minus, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseCents, formatCents } from '@/lib/billMath'
import type { Item, ItemId, PersonId } from '@/stores/useBillStore'

type EditType = 'add' | 'remove' | 'edit_price' | 'edit_name'

export interface EditRequestFormProps {
  sessionId: string
  personId: PersonId
  items: Item[]
  open: boolean
  onClose: () => void
  mutate: () => Promise<unknown>
  initialType?: EditType
  initialItemId?: ItemId
}

const TYPE_LABELS: Record<EditType, string> = {
  add: 'Add',
  remove: 'Remove',
  edit_name: 'Rename',
  edit_price: 'Reprice',
}

export function EditRequestForm({
  sessionId,
  personId,
  items,
  open,
  onClose,
  mutate,
  initialType,
  initialItemId,
}: EditRequestFormProps) {
  const [type, setType] = useState<EditType>(initialType ?? 'add')
  const [itemId, setItemId] = useState<ItemId | ''>(initialItemId ?? '')
  const [name, setName] = useState('')
  const [priceText, setPriceText] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [newNameText, setNewNameText] = useState('')
  const [newPriceText, setNewPriceText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitDisabled = useMemo(() => {
    if (submitting) return true
    if (type === 'add') {
      const priceCents = parseCents(priceText)
      return name.trim().length === 0 || priceCents === null || priceCents <= 0 || quantity < 1
    }
    if (type === 'remove') {
      return itemId === ''
    }
    if (type === 'edit_price') {
      const priceCents = parseCents(newPriceText)
      return itemId === '' || priceCents === null || priceCents <= 0
    }
    // edit_name
    return itemId === '' || newNameText.trim().length === 0
  }, [type, name, priceText, quantity, itemId, newNameText, newPriceText, submitting])

  if (!open) return null

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      let payload: Record<string, unknown>
      if (type === 'add') {
        payload = {
          name: name.trim(),
          priceCents: parseCents(priceText) ?? 0,
          quantity,
        }
      } else if (type === 'remove') {
        payload = { itemId }
      } else if (type === 'edit_price') {
        payload = { itemId, newPriceCents: parseCents(newPriceText) ?? 0 }
      } else {
        payload = { itemId, newName: newNameText.trim() }
      }

      const res = await fetch(`/api/session/${sessionId}/edit-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, type, payload }),
      })
      if (!res.ok) {
        setError("Couldn't send request — try again")
        return
      }
      await mutate()
      onClose()
    } catch {
      setError("Couldn't send request — try again")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        role="presentation"
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40"
      />
      <div
        role="dialog"
        aria-label="Request edit"
        data-testid="edit-request-form"
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto h-[90vh] max-w-[480px] overflow-hidden rounded-t-xl border-t border-border bg-background"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-[20px] font-semibold">Request edit</h2>
          <button
            type="button"
            aria-label="Close request form"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-zinc-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Segmented type selector */}
        <div
          role="tablist"
          aria-label="Request type"
          className="flex gap-1 border-b border-border px-6 py-2"
        >
          {(['add', 'remove', 'edit_name', 'edit_price'] as EditType[]).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={type === t}
              onClick={() => setType(t)}
              className={[
                'h-11 flex-1 rounded-md text-[14px]',
                type === t ? 'bg-amber-600 text-white font-semibold' : 'bg-zinc-100 text-zinc-700',
              ].join(' ')}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="flex h-[calc(90vh-180px)] flex-col gap-4 overflow-y-auto px-6 py-4">
          {type === 'add' && (
            <div className="flex flex-col gap-3" data-testid="add-fields">
              <label className="flex flex-col gap-1">
                <span className="text-[14px] text-zinc-600">Name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Coffee"
                  aria-label="Item name"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[14px] text-zinc-600">Price</span>
                <Input
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  inputMode="decimal"
                  placeholder="$0.00"
                  aria-label="Item price"
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-[14px] text-zinc-600">Quantity</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                  >
                    <Minus size={16} />
                  </Button>
                  <span
                    className="min-w-[2ch] text-center text-[16px] font-semibold text-amber-600"
                    data-testid="add-qty-count"
                  >
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {(type === 'remove' || type === 'edit_price' || type === 'edit_name') && (
            <div className="flex flex-col gap-3" data-testid={`${type}-fields`}>
              <label className="flex flex-col gap-1">
                <span className="text-[14px] text-zinc-600">Item</span>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value as ItemId)}
                  aria-label="Item picker"
                  className="h-11 rounded-md border border-border bg-background px-3 text-[16px]"
                >
                  <option value="">Pick an item</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({formatCents(it.priceCents)})
                    </option>
                  ))}
                </select>
              </label>

              {type === 'remove' && itemId && (
                <p className="text-[14px] text-zinc-500">
                  Remove &quot;{items.find((it) => it.id === itemId)?.name}&quot;? Host approval required.
                </p>
              )}

              {type === 'edit_price' && (
                <label className="flex flex-col gap-1">
                  <span className="text-[14px] text-zinc-600">New price</span>
                  <Input
                    value={newPriceText}
                    onChange={(e) => setNewPriceText(e.target.value)}
                    inputMode="decimal"
                    placeholder="$0.00"
                    aria-label="New price"
                  />
                </label>
              )}

              {type === 'edit_name' && (
                <label className="flex flex-col gap-1">
                  <span className="text-[14px] text-zinc-600">New name</span>
                  <Input
                    value={newNameText}
                    onChange={(e) => setNewNameText(e.target.value)}
                    placeholder="e.g. Espresso"
                    aria-label="New name"
                  />
                </label>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-[14px] text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-border px-6 py-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1"
              onClick={onClose}
              aria-label="Cancel request"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 bg-amber-600 hover:bg-amber-700"
              disabled={submitDisabled}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Submit request'
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
