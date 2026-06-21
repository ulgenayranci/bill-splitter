'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Check, RotateCcw, Receipt, Trash2, LoaderCircle, X } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBillStore, randomId, AVATAR_COLORS } from '@/stores/useBillStore'
import { createSession } from '@/lib/createSession'
import { reconcileScannedBill, type ReconcileCompleteness } from '@/lib/reconcileScannedBill'
import { formatCents } from '@/lib/billMath'
import { OcrLoadingOverlay } from './OcrLoadingOverlay'
import { BillPhotoLightbox } from './BillPhotoLightbox'

/**
 * Scan-first Setup screen — design screens 1 (empty) + 2 (after scan).
 * Replaces the v1 AddItems + AddPeople wizard steps (D-08).
 * Scan-FIRST entry: camera is the hero action, but the native picker also offers
 * the photo library (D-09 revised 2026-06-05 — capture attr dropped). No manual
 * item entry.
 * After a scan: thumbnail + "N items found" badge + Retake, no item list (D-10).
 * Continue is gated on a scanned bill AND ≥2 people (D-11), then bridges to
 * the existing Assign flow as a stopgap (D-12).
 */
export function SetupStep() {
  const router = useRouter()
  const items = useBillStore((s) => s.items)
  const people = useBillStore((s) => s.people)
  const addPerson = useBillStore((s) => s.addPerson)
  const removePerson = useBillStore((s) => s.removePerson)
  const setSessionId = useBillStore((s) => s.setSessionId)
  const billImageUrl = useBillStore((s) => s.billImageUrl)
  const ocrStatus = useBillStore((s) => s.ocrStatus)
  const expandStatus = useBillStore((s) => s.expandStatus)
  const setBillImage = useBillStore((s) => s.setBillImage)
  const setOcrStatus = useBillStore((s) => s.setOcrStatus)
  const setExpandStatus = useBillStore((s) => s.setExpandStatus)
  const setItems = useBillStore((s) => s.setItems)
  const currencyCode = useBillStore((s) => s.currencyCode)
  const setCurrencyCode = useBillStore((s) => s.setCurrencyCode)

  const [name, setName] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  // Non-blocking scan guardrail: how many lines were auto-corrected to match the
  // receipt + the bill-level completeness result. Cleared on retake/error.
  const [guardrail, setGuardrail] = useState<{
    correctedCount: number
    completeness: ReconcileCompleteness
  } | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [sessionCreateError, setSessionCreateError] = useState<string | null>(null)
  // G3: shown when we arrive here after an expired/dead bill link (?expired=1).
  const [expiredNotice, setExpiredNotice] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // G3: detect the ?expired=1 flag set by an auto-redirect off a dead bill link,
  // show a one-shot notice, then strip the param so a refresh won't re-show it.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('expired') === '1') {
      setExpiredNotice(true)
      window.history.replaceState(null, '', window.location.pathname)
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

  async function handleContinue() {
    if (isCreating) return
    setIsCreating(true)
    setSessionCreateError(null)
    try {
      const { people: p, items: it, currencyCode } = useBillStore.getState()
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const { sessionId } = await createSession(
        { people: p, items: it, currencyCode },
        abortRef.current.signal,
      )
      setSessionId(sessionId)
      router.push(`/split/${sessionId}`)
    } catch (err) {
      console.error(err)
      setSessionCreateError("Couldn't create session. Try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''
      setScanError(null)
      setGuardrail(null)

      const prevUrl = useBillStore.getState().billImageUrl
      if (prevUrl?.startsWith('blob:')) URL.revokeObjectURL(prevUrl)
      const blobUrl = URL.createObjectURL(file)
      setBillImage(blobUrl)
      setOcrStatus('loading')

      // Raw OCR lines (per-unit and/or line-total may each be null) + printed subtotal.
      let ocrItems:
        | { name: string; quantity: number; unitPriceCents: number | null; lineTotalCents: number | null }[]
        | null = null
      let ocrSubtotalCents: number | null = null

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
          items: { name: string; quantity: number; unitPriceCents: number | null; lineTotalCents: number | null }[]
          currencyCode?: string
          subtotalCents?: number | null
        }
        ocrItems = data.items
        ocrSubtotalCents = data.subtotalCents ?? null
        // CURR-01: store the detected ISO 4217 currency (route already defaults to USD).
        if (data.currencyCode) setCurrencyCode(data.currencyCode)
        if (ocrItems.length === 0) {
          // D-10: failed/empty scan routes back to a clear retry — never a dead end.
          // GAP 6: clear items so the stale "N items found" chip disappears and
          // billScanned (items.length > 0) flips false, re-gating Continue.
          setItems([])
          setBillImage(null)
          setOcrStatus('error')
          setGuardrail(null)
          setScanError('No items found — tap Scan to try a clearer photo')
          return
        }
      } catch (err) {
        console.error(err)
        // GAP 6: clear items on the failure path too (see empty-scan branch).
        setItems([])
        setBillImage(null)
        setOcrStatus('error')
        setGuardrail(null)
        setScanError("Couldn't read the bill — tap Scan to try again")
        return
      }

      // Scan-time guardrail: reconcile raw OCR figures into canonical LINE TOTALS
      // BEFORE anyone claims. priceCents on each reconciled item is the line total,
      // so /api/expand (which copies priceCents and passes quantity through) and all
      // downstream billMath work unchanged. unitPriceCents is re-attached by index
      // after expand, since the expand route drops it.
      const reconciled = reconcileScannedBill(ocrItems, { subtotalCents: ocrSubtotalCents })
      const correctedCount = reconciled.items.filter((i) => i.corrected).length

      // OCR succeeded. Chain into name expansion.
      setScanError(null)
      setOcrStatus('done')
      setExpandStatus('loading')
      try {
        abortRef.current?.abort()
        abortRef.current = new AbortController()
        const expandRes = await fetch('/api/expand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Send the reconciled LINE-TOTAL priceCents + quantity; expand copies
          // priceCents exactly and passes quantity through by index.
          body: JSON.stringify({
            items: reconciled.items.map((i) => ({
              name: i.name,
              priceCents: i.priceCents,
              quantity: i.quantity,
            })),
          }),
          signal: abortRef.current.signal,
        })
        if (!expandRes.ok) throw new Error(`Expand route returned ${expandRes.status}`)
        const expandData = (await expandRes.json()) as {
          items: { rawName: string; displayName: string; priceCents: number; confidence: 'high' | 'low' | 'ambiguous'; quantity: number }[]
        }
        setItems(
          expandData.items.map((ei, idx) => ({
            id: randomId(),
            name: ei.displayName,
            rawName: ei.rawName,
            // priceCents is the canonical LINE TOTAL (copied through expand).
            priceCents: ei.priceCents,
            quantity: ei.quantity ?? reconciled.items[idx]?.quantity ?? 1,
            // Re-attach unitPriceCents by index — expand drops it.
            unitPriceCents: reconciled.items[idx]?.unitPriceCents,
            confidence: ei.confidence,
          })),
        )
        setGuardrail({ correctedCount, completeness: reconciled.completeness })
        setExpandStatus('done')
      } catch (err) {
        console.error(err)
        setExpandStatus('error')
        // Fallback: build items directly from the reconciled OCR lines so the scan
        // still counts (names editable in Bill View later).
        setItems(
          reconciled.items.map((i) => ({
            id: randomId(),
            name: i.name,
            priceCents: i.priceCents,
            quantity: i.quantity,
            unitPriceCents: i.unitPriceCents,
          })),
        )
        setGuardrail({ correctedCount, completeness: reconciled.completeness })
      }
    },
    [setBillImage, setOcrStatus, setExpandStatus, setItems, setCurrencyCode, setGuardrail],
  )

  return (
    <div className="flex flex-1 flex-col gap-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
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

      {/* G3: one-shot notice after auto-redirect from an expired/dead bill link. */}
      {expiredNotice && (
        <div
          role="status"
          data-testid="expired-notice"
          className="flex items-start justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] font-medium text-amber-800"
        >
          <span>That link expired — here&rsquo;s a fresh start.</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setExpiredNotice(false)}
            className="shrink-0 text-amber-700 hover:text-amber-900"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* GAP 7: inline scan error near the scan tile (not a bottom toast) */}
      {scanError && (
        <p role="alert" data-testid="scan-error" className="text-[13px] text-red-600">
          {scanError}
        </p>
      )}

      {/* Scan guardrail — non-blocking. Continue is NEVER gated on these.
          G2.3: show the actual checksum gap (items sum vs printed receipt total)
          so the warning is actionable, not vague. */}
      {guardrail && guardrail.completeness.mismatch && guardrail.completeness.subtotalCents != null && (
        <div
          role="alert"
          data-testid="guardrail-completeness"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] font-medium text-amber-800"
        >
          Your items add up to {formatCents(guardrail.completeness.reconciledSumCents, currencyCode)}, but the
          receipt total is {formatCents(guardrail.completeness.subtotalCents, currencyCode)}. An item may be
          missing or misread — Retake, or add it manually.
        </div>
      )}
      {guardrail && guardrail.correctedCount > 0 && (
        <p
          role="status"
          data-testid="guardrail-corrected"
          className="text-[12px] text-zinc-500"
        >
          {guardrail.correctedCount === 1
            ? '1 price was adjusted to match the receipt total.'
            : `${guardrail.correctedCount} prices were adjusted to match the receipt totals.`}
        </p>
      )}

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
            onClick={() => {
              setGuardrail(null)
              fileInputRef.current?.click()
            }}
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

      {/* People — GAP 3: extra top margin (>=5px) separates the people section
          from the scan hero, on top of the container's gap-5. */}
      <div className="mt-1.5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400">
            Who&apos;s involved in the split?
          </span>
          <span className="h-px flex-1 bg-zinc-200" />
          {/* GAP 4: count chip bound to people.length */}
          <span
            data-testid="people-count-chip"
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500"
          >
            {people.length}
          </span>
        </div>

        {/* G5: no Add button — Enter/Done submits the name (handleAddPerson). */}
        <Input
          placeholder="Add a name…"
          value={name}
          enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddPerson()
            }
          }}
          maxLength={100}
          className="h-11 w-full text-base"
        />

        {people.length > 0 && (
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
        )}
      </div>

      {/* Continue (gated — D-11) */}
      <div className="mt-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
        <Button
          onClick={handleContinue}
          disabled={!canContinue || isCreating}
          className="h-12 w-full bg-amber-600 text-base hover:bg-amber-700"
        >
          {isCreating ? <LoaderCircle size={16} className="animate-spin" /> : 'Start splitting'}
        </Button>
        {!canContinue && (
          <p className="mt-2 text-center text-[12px] text-zinc-400">
            {billScanned
              ? 'Add at least two people to continue'
              : 'Scan a receipt and add at least two people to continue'}
          </p>
        )}
        {sessionCreateError && (
          <p className="mt-2 text-center text-[12px] text-red-600">{sessionCreateError}</p>
        )}
      </div>

      <OcrLoadingOverlay visible={ocrStatus === 'loading'} />
      <OcrLoadingOverlay visible={expandStatus === 'loading'} message="Expanding names…" />
      <BillPhotoLightbox open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </div>
  )
}
