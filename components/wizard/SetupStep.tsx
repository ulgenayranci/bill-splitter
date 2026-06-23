'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Check, RotateCcw, Receipt, Trash2, LoaderCircle, X, Plus } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBillStore, randomId, AVATAR_COLORS } from '@/stores/useBillStore'
import { createSession } from '@/lib/createSession'
import {
  reconcileScannedBill,
  type ReconcileCompleteness,
  TOLERANCE_CENTS,
} from '@/lib/reconcileScannedBill'
import { formatCents, parseCents, computeSubtotalCents } from '@/lib/billMath'
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
  const addItem = useBillStore((s) => s.addItem)
  const updateItem = useBillStore((s) => s.updateItem)
  const removeItem = useBillStore((s) => s.removeItem)
  const currencyCode = useBillStore((s) => s.currencyCode)
  const setCurrencyCode = useBillStore((s) => s.setCurrencyCode)

  const [name, setName] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  // Non-blocking scan guardrail: how many lines were auto-corrected to match the
  // receipt + the bill-level completeness result + the truth figure the scan was
  // reconciled against (subtotal ?? grand total). Cleared on retake/error.
  const [guardrail, setGuardrail] = useState<{
    correctedCount: number
    completeness: ReconcileCompleteness
    targetCents: number | null
  } | null>(null)
  // Per-row edit drafts for the scan-review screen, keyed by item id. Holds raw
  // strings so the user can type freely; committed to the store on blur/Enter.
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { name: string; price: string; qty: string }>
  >({})
  const [isCreating, setIsCreating] = useState(false)
  const [sessionCreateError, setSessionCreateError] = useState<string | null>(null)
  // G3: shown when we arrive here after an expired/dead bill link (?expired=1).
  const [expiredNotice, setExpiredNotice] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
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

  // Scan-review gate: only when the receipt printed a truth figure AND the scanned
  // items don't reconcile to it (mismatch after the server's retry). Clean scans
  // never enter review (locked decision 1).
  const reviewMode = Boolean(
    guardrail && guardrail.completeness.mismatch && guardrail.targetCents != null,
  )
  // Live items sum recomputed from the store so the gap updates as the user edits.
  const liveSumCents = computeSubtotalCents(items)
  const targetCents = guardrail?.targetCents ?? null
  const liveDeltaCents = targetCents != null ? targetCents - liveSumCents : 0
  // Soft gate: in review mode Continue is still enabled (decision 2). "Still off"
  // hint shows only while the live gap exceeds the rounding tolerance.
  const stillOff = reviewMode && Math.abs(liveDeltaCents) > TOLERANCE_CENTS

  // Read the live draft for a row, defaulting to the item's current store values.
  const draftFor = (item: (typeof items)[number]) =>
    reviewDrafts[item.id] ?? {
      name: item.name,
      price: (item.priceCents / 100).toFixed(2),
      qty: String(item.quantity ?? 1),
    }

  const setDraft = (id: string, patch: Partial<{ name: string; price: string; qty: string }>) =>
    setReviewDrafts((d) => ({
      ...d,
      [id]: { ...draftFor(items.find((i) => i.id === id)!), ...d[id], ...patch },
    }))

  // Commit a row's draft to the store via updateItem. priceCents is the LINE TOTAL.
  // Invalid price/qty are ignored (kept as draft) so we never silently fudge a value.
  const commitRow = (item: (typeof items)[number]) => {
    const draft = reviewDrafts[item.id]
    if (!draft) return
    const trimmedName = draft.name.trim() || item.name
    const priceCents = parseCents(draft.price)
    const qty = Number.parseInt(draft.qty, 10)
    const nextQty = Number.isInteger(qty) && qty > 0 ? qty : (item.quantity ?? 1)
    if (priceCents == null) return // invalid price — leave the draft, don't write
    updateItem(item.id, trimmedName, priceCents, nextQty)
    setReviewDrafts((d) => {
      const { [item.id]: _drop, ...rest } = d
      return rest
    })
  }

  const handleAddReviewItem = () => {
    // Seed a new line at a placeholder price so the user immediately edits it. We
    // never invent a real amount — 1 cent is the minimal non-zero parseCents allows.
    addItem('New item', 1, 1)
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
      setReviewDrafts({})

      const prevUrl = useBillStore.getState().billImageUrl
      if (prevUrl?.startsWith('blob:')) URL.revokeObjectURL(prevUrl)
      const blobUrl = URL.createObjectURL(file)
      setBillImage(blobUrl)
      setOcrStatus('loading')

      // Raw OCR lines (per-unit and/or line-total may each be null) + printed totals.
      let ocrItems:
        | { name: string; quantity: number; unitPriceCents: number | null; lineTotalCents: number | null }[]
        | null = null
      let ocrSubtotalCents: number | null = null
      let ocrGrandTotalCents: number | null = null

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
          grandTotalCents?: number | null
        }
        ocrItems = data.items
        ocrSubtotalCents = data.subtotalCents ?? null
        ocrGrandTotalCents = data.grandTotalCents ?? null
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
      // Truth figure (locked decision 3): reconcile against the printed PRE-TAX
      // subtotal, falling back to the grand total. reconcileScannedBill is agnostic —
      // it just receives the chosen target as its subtotalCents option.
      const targetCents = ocrSubtotalCents ?? ocrGrandTotalCents
      const reconciled = reconcileScannedBill(ocrItems, { subtotalCents: targetCents })
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
        setGuardrail({ correctedCount, completeness: reconciled.completeness, targetCents })
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
        setGuardrail({ correctedCount, completeness: reconciled.completeness, targetCents })
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
          className="flex items-start justify-between gap-2 rounded-xl border border-[#e0a400]/30 bg-[#e0a400]/10 px-3 py-2.5 text-[13px] font-medium text-warn"
        >
          <span>That link expired — here&rsquo;s a fresh start.</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setExpiredNotice(false)}
            className="shrink-0 text-warn"
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

      {/* Scan-review/confirm screen — shown ONLY when the scan can't reconcile to
          the printed truth figure after the server's retry (locked decision 1).
          Soft gate: the user can edit/confirm here but is never blocked (decision 2).
          Clean scans skip this entirely. */}
      {reviewMode && targetCents != null && (
        <div
          role="region"
          aria-label="Confirm detected items"
          data-testid="scan-review"
          className="flex flex-col gap-3 rounded-xl border border-[#e0a400]/30 bg-[#e0a400]/10 px-3 py-3"
        >
          <p className="text-[14px] font-semibold text-warn">
            Please confirm or edit these detected items
          </p>

          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const draft = draftFor(item)
              return (
                <li key={item.id} className="flex items-center gap-2">
                  <Input
                    aria-label="Item name"
                    value={draft.name}
                    onChange={(e) => setDraft(item.id, { name: e.target.value })}
                    onBlur={() => commitRow(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRow(item)
                    }}
                    maxLength={100}
                    className="h-10 flex-1 bg-white text-base"
                  />
                  <Input
                    aria-label="Price"
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) => setDraft(item.id, { price: e.target.value })}
                    onBlur={() => commitRow(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRow(item)
                    }}
                    maxLength={9}
                    className="h-10 w-20 bg-white text-base"
                  />
                  <Input
                    aria-label="Quantity"
                    inputMode="numeric"
                    value={draft.qty}
                    onChange={(e) => setDraft(item.id, { qty: e.target.value })}
                    onBlur={() => commitRow(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRow(item)
                    }}
                    maxLength={2}
                    className="h-10 w-12 bg-white text-center text-base"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => removeItem(item.id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-white text-zinc-400"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            onClick={handleAddReviewItem}
            className="flex items-center gap-1.5 self-start rounded-md text-[13px] font-semibold text-coral-600"
          >
            <Plus size={15} aria-hidden="true" />
            Add item
          </button>

          <p data-testid="scan-review-gap" className="text-[13px] font-medium text-warn">
            Items add up to {formatCents(liveSumCents, currencyCode)} · Receipt{' '}
            {guardrail?.completeness.subtotalCents != null ? 'subtotal' : 'total'}{' '}
            {formatCents(targetCents, currencyCode)} · off by{' '}
            {formatCents(Math.abs(liveDeltaCents), currencyCode)}
          </p>
        </div>
      )}
      {!reviewMode && guardrail && guardrail.correctedCount > 0 && (
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
              <Receipt size={22} className="text-coral-700/40" aria-hidden="true" />
            )}
            <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-coral-500 px-2.5 py-1 text-[11px] font-bold text-white">
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
            className="ml-auto mt-1 flex items-center gap-1 text-[13px] font-semibold text-coral-600"
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
              : 'border-zinc-300 bg-zinc-50'
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-50">
            <Camera size={26} className="text-coral-600" aria-hidden="true" />
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

        {/* G5 (redesign): always-visible inline "+" add button so the action is
            obvious on every device (the keyboard's return/Done key varies). Tap
            the + or press Enter to add; the box clears and keeps focus for the
            next name. The + sits inside the box, staying visible above the
            on-screen keyboard on phones. */}
        <div className="relative">
          <Input
            ref={nameInputRef}
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
            className="h-11 w-full pr-12 text-base"
          />
          <button
            type="button"
            aria-label="Add person"
            disabled={!name.trim()}
            onClick={() => {
              handleAddPerson()
              nameInputRef.current?.focus()
            }}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-40"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>

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
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-zinc-400"
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
          className="h-12 w-full bg-coral-500 text-base"
        >
          {isCreating ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : reviewMode ? (
            'Confirm & continue'
          ) : (
            'Start splitting'
          )}
        </Button>
        {/* Soft gate: in review mode the user may still proceed while a gap remains;
            we only nudge with a subtle hint (locked decision 2). */}
        {canContinue && stillOff && (
          <p data-testid="scan-review-still-off" className="mt-2 text-center text-[12px] text-warn">
            Still off by {formatCents(Math.abs(liveDeltaCents), currencyCode)} — you can confirm
            anyway or keep editing.
          </p>
        )}
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
