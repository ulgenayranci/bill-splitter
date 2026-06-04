'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Check, RotateCcw, Receipt, Trash2 } from 'lucide-react'
import { Toast } from '@base-ui/react/toast'
import imageCompression from 'browser-image-compression'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBillStore, randomId, AVATAR_COLORS } from '@/stores/useBillStore'
import { OcrLoadingOverlay } from './OcrLoadingOverlay'
import { BillPhotoLightbox } from './BillPhotoLightbox'

/**
 * Scan-first Setup screen — design screens 1 (empty) + 2 (after scan).
 * Replaces the v1 AddItems + AddPeople wizard steps (D-08).
 * Scan-only entry, no manual item entry / gallery (D-09).
 * After a scan: thumbnail + "N items found" badge + Retake, no item list (D-10).
 * Continue is gated on a scanned bill AND ≥1 person (D-11), then bridges to
 * the existing Assign flow as a stopgap (D-12).
 */
export function SetupStep() {
  const items = useBillStore((s) => s.items)
  const people = useBillStore((s) => s.people)
  const addPerson = useBillStore((s) => s.addPerson)
  const removePerson = useBillStore((s) => s.removePerson)
  const setStep = useBillStore((s) => s.setStep)
  const billImageUrl = useBillStore((s) => s.billImageUrl)
  const ocrStatus = useBillStore((s) => s.ocrStatus)
  const expandStatus = useBillStore((s) => s.expandStatus)
  const setBillImage = useBillStore((s) => s.setBillImage)
  const setOcrStatus = useBillStore((s) => s.setOcrStatus)
  const setExpandStatus = useBillStore((s) => s.setExpandStatus)
  const setItems = useBillStore((s) => s.setItems)
  const setCurrencyCode = useBillStore((s) => s.setCurrencyCode)

  const [name, setName] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const toastManager = Toast.useToastManager()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // A successful scan is what populates items — gate the "after scan" UI on that.
  const billScanned = items.length > 0
  // Continue requires a scanned bill AND at least two named people (deviation from
  // D-11's "≥1" — splitting is only meaningful with two or more participants).
  const canContinue = billScanned && people.length >= 2

  const handleAddPerson = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    addPerson(trimmed)
    setName('')
  }

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''

      const prevUrl = useBillStore.getState().billImageUrl
      if (prevUrl?.startsWith('blob:')) URL.revokeObjectURL(prevUrl)
      const blobUrl = URL.createObjectURL(file)
      setBillImage(blobUrl)
      setOcrStatus('loading')

      let ocrItems: { name: string; priceCents: number; quantity: number }[] | null = null

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
        // Swap the instant blob preview for the compressed base64 data-URL so the
        // photo persists across reloads (blob: URLs don't survive a refresh).
        if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl)
        setBillImage(base64)
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
          items: { name: string; priceCents: number; quantity: number }[]
          currencyCode?: string
        }
        ocrItems = data.items
        // CURR-01: store the detected ISO 4217 currency (route already defaults to USD).
        if (data.currencyCode) setCurrencyCode(data.currencyCode)
        if (ocrItems.length === 0) {
          // D-10: failed/empty scan routes back to a clear retry — never a dead end.
          setBillImage(null)
          setOcrStatus('error')
          toastManager.add({
            description: 'No items found — tap Scan to try a clearer photo',
            timeout: 7000,
          })
          return
        }
      } catch (err) {
        console.error(err)
        setBillImage(null)
        setOcrStatus('error')
        toastManager.add({
          description: "Couldn't read the bill — tap Scan to try again",
          timeout: 7000,
        })
        return
      }

      // OCR succeeded. Chain into name expansion.
      setOcrStatus('done')
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
          items: { rawName: string; displayName: string; priceCents: number; confidence: 'high' | 'low' | 'ambiguous'; quantity: number }[]
        }
        setItems(
          expandData.items.map((ei) => ({
            id: randomId(),
            name: ei.displayName,
            rawName: ei.rawName,
            priceCents: ei.priceCents,
            quantity: ei.quantity ?? 1,
            confidence: ei.confidence,
          })),
        )
        setExpandStatus('done')
      } catch (err) {
        console.error(err)
        setExpandStatus('error')
        // Fallback: keep raw OCR names so the scan still counts (editable in Bill View later).
        setItems(
          ocrItems.map((i) => ({
            id: randomId(),
            name: i.name,
            priceCents: i.priceCents,
            quantity: i.quantity ?? 1,
          })),
        )
      }
    },
    [setBillImage, setOcrStatus, setExpandStatus, setItems, setCurrencyCode, toastManager],
  )

  return (
    <div className="flex flex-col gap-5">
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

      {/* Tagline */}
      <p className="text-[16px] font-medium leading-[1.5] text-zinc-500">
        Split any bill in seconds.
      </p>

      {/* Scan tile (empty) OR receipt thumbnail (after scan) */}
      {billScanned ? (
        <div>
          <button
            type="button"
            onClick={() => billImageUrl && setLightboxOpen(true)}
            disabled={!billImageUrl}
            aria-label="View bill photo"
            className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-zinc-200 [background:repeating-linear-gradient(45deg,#f5ece2,#f5ece2_8px,#fdf6ef_8px,#fdf6ef_16px)] enabled:cursor-pointer"
          >
            {billImageUrl ? (
              <img
                src={billImageUrl}
                alt="Captured bill photo"
                className="h-full w-full object-cover"
              />
            ) : (
              <Receipt size={22} className="text-amber-700/40" aria-hidden="true" />
            )}
            <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white">
              <Check size={10} strokeWidth={3} aria-hidden="true" />
              {items.length} {items.length === 1 ? 'item' : 'items'} found
            </span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="ml-auto mt-1 flex items-center gap-1 text-[13px] font-semibold text-amber-600 hover:text-amber-700"
          >
            <RotateCcw size={13} aria-hidden="true" />
            Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Scan your receipt"
          className={`flex flex-col items-center gap-3 rounded-xl border-[1.5px] border-dashed px-5 py-7 text-center transition-colors ${
            ocrStatus === 'error'
              ? 'border-red-300 bg-red-50'
              : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100'
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <Camera size={26} className="text-amber-600" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[16px] font-semibold text-zinc-900">Scan your receipt</span>
            <span className="text-[13px] text-zinc-400">
              {ocrStatus === 'error'
                ? 'Something went wrong — tap to try again'
                : "Point at the bill — we'll pick up every item"}
            </span>
          </div>
        </button>
      )}

      {/* People */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400">
            Who&apos;s involved in the split?
          </span>
          <span className="h-px flex-1 bg-zinc-200" />
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Add a name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddPerson()
              }
            }}
            maxLength={100}
            className="h-11 flex-1 text-base"
          />
          <Button
            onClick={handleAddPerson}
            disabled={!name.trim()}
            className="h-11 w-[72px] bg-amber-600 hover:bg-amber-700"
          >
            Add
          </Button>
        </div>

        {people.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {people.map((person) => (
              <li
                key={person.id}
                className="flex h-12 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3"
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white ${AVATAR_COLORS[person.colorIndex]}`}
                  aria-hidden="true"
                >
                  {person.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-[15px] font-medium text-zinc-900">{person.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${person.name}`}
                  onClick={() => removePerson(person.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] leading-[1.5] text-zinc-400">
            Add people now or after scanning.
          </p>
        )}
      </div>

      {/* Continue (gated — D-11) */}
      <div className="mt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <Button
          onClick={() => setStep(3)}
          disabled={!canContinue}
          className="h-12 w-full bg-amber-600 text-base hover:bg-amber-700"
        >
          Continue to Assign →
        </Button>
        {!canContinue && (
          <p className="mt-2 text-center text-[12px] text-zinc-400">
            {billScanned
              ? 'Add at least two people to continue'
              : 'Scan a receipt and add at least two people to continue'}
          </p>
        )}
      </div>

      <OcrLoadingOverlay visible={ocrStatus === 'loading'} />
      <OcrLoadingOverlay visible={expandStatus === 'loading'} message="Expanding names…" />
      <BillPhotoLightbox open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </div>
  )
}
