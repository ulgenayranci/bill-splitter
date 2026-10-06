/**
 * Self-correction of scanned prices using the receipt's own printed maths.
 * Pure (no React/store imports). Never mutates its input.
 *
 * Two repairs, tried only when the items do not already reconcile to the trusted target:
 *  1. price-column: the model independently read the price column (one amount per item,
 *     top to bottom). When that column has one amount per item and sums to the target, the
 *     amounts are re-paired to items by position as LINE TOTALS. This also fixes a
 *     one-row slide of prices.
 *  2. line-totals: the raw per-line amounts only add up to the target when read as line
 *     totals (not unit price x quantity), so they are reinterpreted as line totals.
 */
import { reconcileScannedBill, TOLERANCE_CENTS } from '@/lib/reconcileScannedBill'

export interface RepairInputLine {
  name: string
  quantity: number
  unitPriceCents: number | null
  lineTotalCents: number | null
  confidence?: 'high' | 'low' | 'ambiguous'
  autoFixed?: boolean
}

export type RepairMethod = 'none' | 'price-column' | 'line-totals'

function coerceQuantity(q: number): number {
  return Number.isInteger(q) && q > 0 ? q : 1
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0
}

/** Exact per-unit price, or null when the total does not divide evenly (reconcile derives it). */
function exactUnit(total: number, quantity: number): number | null {
  return total % quantity === 0 ? total / quantity : null
}

export function repairFromPriceColumn<T extends RepairInputLine>(
  items: T[],
  printedAmountsCents: readonly number[] | null | undefined,
  targetCents: number | null,
): { items: T[]; method: RepairMethod } {
  if (targetCents === null || items.length === 0) return { items, method: 'none' }

  const current = reconcileScannedBill(items)
  if (Math.abs(targetCents - current.completeness.reconciledSumCents) <= TOLERANCE_CENTS) {
    return { items, method: 'none' }
  }

  // 1. Price column, re-paired by position.
  const printed = printedAmountsCents ?? []
  if (
    printed.length === items.length &&
    printed.every(isPositiveInt) &&
    Math.abs(printed.reduce((a, b) => a + b, 0) - targetCents) <= TOLERANCE_CENTS
  ) {
    const repaired = items.map((item, i) => {
      const quantity = coerceQuantity(item.quantity)
      const total = printed[i]
      const next: T = {
        ...item,
        quantity,
        lineTotalCents: total,
        unitPriceCents: exactUnit(total, quantity),
      }
      if (total !== current.items[i].priceCents) next.autoFixed = true
      return next
    })
    return { items: repaired, method: 'price-column' }
  }

  // 2. Raw amounts only add up as line totals.
  const rawAsTotals = items.reduce((sum, it) => sum + (it.lineTotalCents ?? it.unitPriceCents ?? 0), 0)
  if (Math.abs(rawAsTotals - targetCents) <= TOLERANCE_CENTS) {
    const repaired = items.map((item) => {
      if (item.lineTotalCents != null || item.unitPriceCents == null) return item
      const quantity = coerceQuantity(item.quantity)
      const total = item.unitPriceCents
      const next: T = {
        ...item,
        lineTotalCents: total,
        unitPriceCents: exactUnit(total, quantity),
      }
      if (quantity > 1) next.autoFixed = true
      return next
    })
    return { items: repaired, method: 'line-totals' }
  }

  return { items, method: 'none' }
}
