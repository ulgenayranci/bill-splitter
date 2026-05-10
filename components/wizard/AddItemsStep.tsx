'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Trash2, Check, Plus, Camera } from 'lucide-react'
import { Toast } from '@base-ui/react/toast'
import imageCompression from 'browser-image-compression'
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
import { OcrLoadingOverlay } from './OcrLoadingOverlay'
import { Badge } from '@/components/ui/badge'

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
  const billImageUrl = useBillStore((s) => s.billImageUrl)
  const ocrStatus = useBillStore((s) => s.ocrStatus)
  const setBillImage = useBillStore((s) => s.setBillImage)
  const setOcrStatus = useBillStore((s) => s.setOcrStatus)
  const expandStatus = useBillStore((s) => s.expandStatus)
  const setExpandStatus = useBillStore((s) => s.setExpandStatus)
  const setItems = useBillStore((s) => s.setItems)

  const [editState, setEditState] = useState<EditState | null>(null)
  const [pendingRemove, setPendingRemove] = useState<{ id: ItemId; name: string } | null>(null)
  const toastManager = Toast.useToastManager()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

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

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''

      const blobUrl = URL.createObjectURL(file)
      setBillImage(blobUrl)
      setOcrStatus('loading')

      let ocrItems: { name: string; priceCents: number }[] | null = null

      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/jpeg',
        })
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('FileReader failed'))
          reader.readAsDataURL(compressed)
        })
        abortRef.current?.abort()
        abortRef.current = new AbortController()
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
          signal: abortRef.current.signal,
        })
        if (!res.ok) throw new Error(`OCR route returned ${res.status}`)
        const data = (await res.json()) as {
          items: { name: string; priceCents: number }[]
        }
        ocrItems = data.items
        setOcrStatus('done')
      } catch (err) {
        console.error(err)
        setOcrStatus('error')
        toastManager.add({
          description: "Couldn't read the bill — try again or enter manually",
          timeout: 4000,
        })
        return
      }

      // OCR succeeded. Chain into expansion.
      setExpandStatus('loading')
      try {
        abortRef.current?.abort()
        abortRef.current = new AbortController()
        const expandRes = await fetch('/api/expand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: ocrItems }),
          signal: abortRef.current.signal,
        })
        if (!expandRes.ok) throw new Error(`Expand route returned ${expandRes.status}`)
        const expandData = (await expandRes.json()) as {
          items: { rawName: string; displayName: string; priceCents: number; confidence: 'high' | 'low' | 'ambiguous' }[]
        }
        setItems(
          expandData.items.map((ei) => ({
            id: crypto.randomUUID(),
            name: ei.displayName,
            rawName: ei.rawName,
            priceCents: ei.priceCents,
            confidence: ei.confidence,
          })),
        )
        setExpandStatus('done')
      } catch (err) {
        console.error(err)
        setExpandStatus('error')
        // D-03 fallback: keep raw OCR names — still editable.
        for (const item of ocrItems) {
          addItem(item.name, item.priceCents)
        }
        toastManager.add({
          description: "Couldn't expand item names — you can edit them manually",
          timeout: 4000,
        })
      }
    },
    [setBillImage, setOcrStatus, setExpandStatus, setItems, addItem, toastManager],
  )

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

      {billImageUrl && (
        <Card className="p-2">
          <img
            src={billImageUrl}
            alt="Captured bill photo"
            className="w-full max-h-48 rounded-lg object-cover"
          />
          <span className="block px-2 pt-2 text-[14px] text-zinc-500">Bill photo</span>
        </Card>
      )}

      {ocrStatus !== 'loading' && ocrStatus !== 'done' && (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="h-12 w-full gap-2 border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50"
          aria-label="Scan bill"
        >
          <Camera size={20} />
          Scan bill
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
        data-testid="ocr-file-input"
      />

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
                    aria-describedby={editState!.priceError ? 'edit-price-error' : undefined}
                  />
                  {editState!.priceError && (
                    <span id="edit-price-error" className="text-red-600 text-sm">{editState!.priceError}</span>
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
                {(item.confidence === 'low' || item.confidence === 'ambiguous') && (
                  <Badge className="bg-amber-100 text-amber-700 border border-amber-300 text-xs font-medium">
                    Review
                  </Badge>
                )}
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
                  aria-describedby={editState!.priceError ? 'add-price-error' : undefined}
                />
                {editState!.priceError && (
                  <span id="add-price-error" className="text-red-600 text-sm">{editState!.priceError}</span>
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

      <OcrLoadingOverlay visible={ocrStatus === 'loading'} />
      <OcrLoadingOverlay visible={expandStatus === 'loading'} message="Expanding names…" />
    </div>
  )
}
