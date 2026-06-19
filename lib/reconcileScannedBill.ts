/**
 * Scan-time reconciliation of raw OCR figures into canonical, billable line items.
 *
 * Root cause this layer fixes: OCR may return a PER-UNIT price while downstream
 * billMath treats `item.priceCents` as the FULL LINE TOTAL. Nothing multiplied by
 * quantity, so "Tuborg ×2 @ 450" was split as 450 instead of 900 — systematic
 * undercharging on every multi-quantity line.
 *
 * This module is a PURE function (no React, no store imports). For each raw line it
 * derives the canonical LINE TOTAL (`priceCents`) and a per-unit price
 * (`unitPriceCents`) using integer-cents arithmetic only — Math.round is applied
 * solely to integer-cents division so no float ever enters `priceCents`. When the
 * receipt's printed line total conflicts with unit×qty, the PRINTED TOTAL WINS and
 * the line is flagged `corrected`. A bill-level completeness check compares the
 * printed subtotal (if any) against the sum of reconciled line totals and reports a
 * non-blocking mismatch — it NEVER invents items.
 */

/** A small fixed cents tolerance for the bill-level completeness check (rounding slack). */
export const TOLERANCE_CENTS = 2

/** One raw OCR line as produced by the OCR route (unit and/or total may be absent). */
export interface ReconcileInputLine {
  name: string
  quantity: number
  /** Price per single unit, integer cents — null/absent when the receipt didn't print it. */
  unitPriceCents?: number | null
  /** Extended/line total, integer cents — null/absent when the receipt didn't print it. */
  lineTotalCents?: number | null
  /** Optional passthrough confidence; copied unchanged onto the reconciled item. */
  confidence?: 'high' | 'low' | 'ambiguous'
}

/** One reconciled line — `priceCents` is the canonical LINE TOTAL consumed by billMath. */
export interface ReconciledItem {
  name: string
  quantity: number
  /** Canonical LINE TOTAL in integer cents (price for ALL units). */
  priceCents: number
  /** Per single unit in integer cents (= round(priceCents / quantity)). */
  unitPriceCents: number
  /** True when unit×qty disagreed with the printed total and the printed total was trusted. */
  corrected: boolean
  confidence?: 'high' | 'low' | 'ambiguous'
}

/** Bill-level completeness signal — detection only, never mutates or adds items. */
export interface ReconcileCompleteness {
  hasSubtotal: boolean
  /** The printed subtotal in integer cents, present only when supplied. */
  subtotalCents?: number
  /** Sum of every reconciled line's canonical priceCents. */
  reconciledSumCents: number
  /** True when |subtotal - reconciledSum| exceeds TOLERANCE_CENTS. */
  mismatch: boolean
  /** subtotal - reconciledSum (0 when no subtotal supplied). */
  deltaCents: number
}

export interface ReconcileResult {
  items: ReconciledItem[]
  completeness: ReconcileCompleteness
}

export interface ReconcileOptions {
  /** Printed items subtotal in integer cents, if the receipt provided one. */
  subtotalCents?: number | null
}

/** Coerce to a positive integer quantity, defaulting to 1 for missing/invalid input. */
function coerceQuantity(quantity: number): number {
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1
}

/** True only for a usable positive integer cents value. */
function isUsablePrice(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function reconcileLine(raw: ReconcileInputLine): ReconciledItem {
  const quantity = coerceQuantity(raw.quantity)
  const hasUnit = isUsablePrice(raw.unitPriceCents)
  const hasTotal = isUsablePrice(raw.lineTotalCents)
  const unit = hasUnit ? (raw.unitPriceCents as number) : null
  const total = hasTotal ? (raw.lineTotalCents as number) : null

  let priceCents: number
  let unitPriceCents: number
  let corrected = false

  if (unit !== null && total !== null) {
    if (unit * quantity === total) {
      // Both present and consistent.
      priceCents = total
      unitPriceCents = unit
    } else {
      // Conflict — TRUST the printed line total; flag the auto-correction.
      priceCents = total
      unitPriceCents = Math.round(total / quantity)
      corrected = true
    }
  } else if (unit !== null) {
    // Unit only — extend by quantity.
    priceCents = unit * quantity
    unitPriceCents = unit
  } else if (total !== null) {
    // Total only — derive the unit price.
    priceCents = total
    unitPriceCents = Math.round(total / quantity)
  } else {
    // Neither present (defensive): treat any legacy single price as the line total.
    // Quantity is coerced to 1 because nothing here can be multiplied meaningfully.
    const legacy = raw.lineTotalCents ?? raw.unitPriceCents ?? 0
    priceCents = Number.isInteger(legacy) ? (legacy as number) : 0
    unitPriceCents = priceCents
    return {
      name: raw.name,
      quantity: 1,
      priceCents,
      unitPriceCents,
      corrected: false,
      confidence: raw.confidence,
    }
  }

  return {
    name: raw.name,
    quantity,
    priceCents,
    unitPriceCents,
    corrected,
    confidence: raw.confidence,
  }
}

/**
 * Reconcile raw OCR lines into canonical billable items + a bill-level completeness signal.
 *
 * @param rawLines Raw OCR lines (unit and/or total per line may be null/absent).
 * @param opts     Optional bill-level subtotalCents for the completeness check.
 */
export function reconcileScannedBill(
  rawLines: ReconcileInputLine[],
  opts: ReconcileOptions = {},
): ReconcileResult {
  const items = rawLines.map(reconcileLine)
  const reconciledSumCents = items.reduce((sum, it) => sum + it.priceCents, 0)

  const hasSubtotal = isUsablePrice(opts.subtotalCents)
  const subtotalCents = hasSubtotal ? (opts.subtotalCents as number) : undefined
  const deltaCents = hasSubtotal ? (subtotalCents as number) - reconciledSumCents : 0
  const mismatch = hasSubtotal && Math.abs(deltaCents) > TOLERANCE_CENTS

  return {
    items,
    completeness: {
      hasSubtotal,
      subtotalCents,
      reconciledSumCents,
      mismatch,
      deltaCents,
    },
  }
}
