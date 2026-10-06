import { describe, it, expect } from 'vitest'
import { repairFromPriceColumn, type RepairInputLine } from '@/lib/repairScannedPrices'
import { reconcileScannedBill, itemsReconcileTarget } from '@/lib/reconcileScannedBill'
import { flagScannedLines, shouldForceScanReview, SCAN_FLAG_REASONS } from '@/lib/scanSanityChecks'
import ippudo from './fixtures/ippudo-ocr-output.json'

const IPPUDO_PRINTED = [33000, 44000, 114000, 19000, 86000, 99000, 96000, 165000, 210000, 405000, 198000, 38000]
const FIXED_IDX = [1, 3, 4, 5, 6, 7, 8, 9, 10]

const line = (over: Partial<RepairInputLine> = {}): RepairInputLine => ({
  name: 'Item',
  quantity: 1,
  unitPriceCents: null,
  lineTotalCents: null,
  ...over,
})

describe('repairFromPriceColumn', () => {
  it('returns none when items already reconcile', () => {
    const items = [line({ unitPriceCents: 500 }), line({ lineTotalCents: 700 })]
    const r = repairFromPriceColumn(items, [], 1200)
    expect(r.method).toBe('none')
    expect(r.items).toBe(items)
  })

  it('returns none for null target or empty items', () => {
    expect(repairFromPriceColumn([line({ unitPriceCents: 5 })], [5], null).method).toBe('none')
    expect(repairFromPriceColumn([], [], 100).method).toBe('none')
  })

  it('does not use a price column with the wrong length, wrong sum or bad entries', () => {
    const items = [line({ unitPriceCents: 500 }), line({ unitPriceCents: 500 })]
    expect(repairFromPriceColumn(items, [1400], 1400).method).toBe('none')
    expect(repairFromPriceColumn(items, [700, 600], 1400).method).toBe('none')
    expect(repairFromPriceColumn(items, [1400, 0], 1400).method).toBe('none')
    expect(repairFromPriceColumn(items, [700.5, 699.5], 1400).method).toBe('none')
  })

  it('re-pairs by position with a non-divisible total as null unit', () => {
    const items = [line({ quantity: 3, unitPriceCents: 999 })]
    const r = repairFromPriceColumn(items, [1000], 1000)
    expect(r.method).toBe('price-column')
    expect(r.items[0].lineTotalCents).toBe(1000)
    expect(r.items[0].unitPriceCents).toBeNull()
    const rec = reconcileScannedBill(r.items, { subtotalCents: 1000 })
    expect(rec.items[0].corrected).toBe(false)
    expect(rec.completeness.mismatch).toBe(false)
  })

  it('reinterprets raw amounts as line totals (decision B)', () => {
    const items = [line({ quantity: 2, unitPriceCents: 900 }), line({ unitPriceCents: 500 })]
    const r = repairFromPriceColumn(items, [], 1400)
    expect(r.method).toBe('line-totals')
    expect(r.items[0].lineTotalCents).toBe(900)
    expect(r.items[0].unitPriceCents).toBe(450)
    expect(r.items[0].autoFixed).toBe(true)
    expect(r.items[1].autoFixed).toBeUndefined()
    expect(items[0].lineTotalCents).toBeNull() // input not mutated
  })

  it('Ippudo regression: full pipeline', () => {
    const items = ippudo.items as RepairInputLine[]
    const target = itemsReconcileTarget(
      ippudo.subtotalCents,
      ippudo.grandTotalCents,
      ippudo.serviceFeeCents,
      ippudo.taxCents,
      [IPPUDO_PRINTED.reduce((a, b) => a + b, 0)],
    )
    expect(target).toBe(1507000)

    const r = repairFromPriceColumn(items, IPPUDO_PRINTED, target)
    expect(r.method).toBe('price-column')
    expect(r.items.map((i) => i.lineTotalCents)).toEqual(IPPUDO_PRINTED)
    expect(r.items.map((i, idx) => (i.autoFixed ? idx : -1)).filter((i) => i >= 0)).toEqual(FIXED_IDX)
    expect([1, 8, 9, 10].map((i) => r.items[i].unitPriceCents)).toEqual([22000, 70000, 135000, 99000])

    const rec = reconcileScannedBill(r.items, { subtotalCents: target })
    expect(rec.completeness.reconciledSumCents).toBe(1507000)
    expect(rec.completeness.mismatch).toBe(false)

    const { lineFlags, flaggedCount } = flagScannedLines(rec.items)
    lineFlags.forEach((f, idx) =>
      expect(f).toBe(FIXED_IDX.includes(idx) ? SCAN_FLAG_REASONS.autoFixed : null),
    )
    expect(SCAN_FLAG_REASONS.autoFixed).toBe('Auto-fixed — please check')
    const decision = shouldForceScanReview({
      itemCount: rec.items.length,
      mismatch: rec.completeness.mismatch,
      targetCents: target,
      flaggedCount,
    })
    expect(decision.forceReview).toBe(true)
    expect(decision.reasons).toEqual(['flagged-lines'])
  })
})
