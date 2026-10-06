import { describe, it, expect } from 'vitest'
import {
  reconcileScannedBill,
  TOLERANCE_CENTS,
  itemsReconcileTarget,
  type ReconcileInputLine,
} from '@/lib/reconcileScannedBill'

const line = (over: Partial<ReconcileInputLine> = {}): ReconcileInputLine => ({
  name: 'Item',
  quantity: 1,
  unitPriceCents: null,
  lineTotalCents: null,
  ...over,
})

describe('reconcileScannedBill — per-line canonical derivation', () => {
  it('Tuborg ×2 @ 450 (no total) → line total 900, unit 450, not corrected', () => {
    const { items } = reconcileScannedBill([
      line({ name: 'Tuborg', quantity: 2, unitPriceCents: 450 }),
    ])
    expect(items[0].priceCents).toBe(900)
    expect(items[0].unitPriceCents).toBe(450)
    expect(items[0].quantity).toBe(2)
    expect(items[0].corrected).toBe(false)
  })

  it('Carlsberg ×5 @ 150 (no total) → line total 750, unit 150', () => {
    const { items } = reconcileScannedBill([
      line({ name: 'Carlsberg', quantity: 5, unitPriceCents: 150 }),
    ])
    expect(items[0].priceCents).toBe(750)
    expect(items[0].unitPriceCents).toBe(150)
    expect(items[0].corrected).toBe(false)
  })

  it('both match: ×2 @ 450, total 900 → accept, not corrected', () => {
    const { items } = reconcileScannedBill([
      line({ quantity: 2, unitPriceCents: 450, lineTotalCents: 900 }),
    ])
    expect(items[0].priceCents).toBe(900)
    expect(items[0].unitPriceCents).toBe(450)
    expect(items[0].corrected).toBe(false)
  })

  it('both conflict: ×2 @ 450, total 800 → trust total, unit 400, corrected', () => {
    const { items } = reconcileScannedBill([
      line({ quantity: 2, unitPriceCents: 450, lineTotalCents: 800 }),
    ])
    expect(items[0].priceCents).toBe(800)
    expect(items[0].unitPriceCents).toBe(400)
    expect(items[0].corrected).toBe(true)
  })

  it('unit-only branch: ×3 @ 200 → total 600, unit 200, not corrected', () => {
    const { items } = reconcileScannedBill([
      line({ quantity: 3, unitPriceCents: 200 }),
    ])
    expect(items[0].priceCents).toBe(600)
    expect(items[0].unitPriceCents).toBe(200)
    expect(items[0].corrected).toBe(false)
  })

  it('total-only branch: ×4, total 1000 → total 1000, unit 250, not corrected', () => {
    const { items } = reconcileScannedBill([
      line({ quantity: 4, lineTotalCents: 1000 }),
    ])
    expect(items[0].priceCents).toBe(1000)
    expect(items[0].unitPriceCents).toBe(250)
    expect(items[0].corrected).toBe(false)
  })

  it('neither present (defensive): coerces qty to 1, treats 0 as line total', () => {
    const { items } = reconcileScannedBill([
      line({ name: 'Mystery', quantity: 3, unitPriceCents: null, lineTotalCents: null }),
    ])
    expect(items[0].priceCents).toBe(0)
    expect(items[0].unitPriceCents).toBe(0)
    expect(items[0].quantity).toBe(1)
    expect(items[0].corrected).toBe(false)
  })

  it('invalid/missing quantity defaults to 1 (unit-only branch)', () => {
    const { items } = reconcileScannedBill([
      line({ quantity: 0, unitPriceCents: 500 }),
    ])
    expect(items[0].quantity).toBe(1)
    expect(items[0].priceCents).toBe(500)
    expect(items[0].unitPriceCents).toBe(500)
  })
})

describe('reconcileScannedBill — completeness', () => {
  it('mismatch: subtotal 1000 vs reconciled sum 900 → mismatch true, delta 100', () => {
    const { completeness } = reconcileScannedBill(
      [line({ name: 'A', quantity: 1, lineTotalCents: 900 })],
      { subtotalCents: 1000 },
    )
    expect(completeness.hasSubtotal).toBe(true)
    expect(completeness.subtotalCents).toBe(1000)
    expect(completeness.reconciledSumCents).toBe(900)
    expect(completeness.mismatch).toBe(true)
    expect(completeness.deltaCents).toBe(100)
  })

  it('within tolerance: subtotal 901 vs sum 900 → mismatch false', () => {
    const { completeness } = reconcileScannedBill(
      [line({ name: 'A', quantity: 1, lineTotalCents: 900 })],
      { subtotalCents: 901 },
    )
    expect(completeness.mismatch).toBe(false)
    expect(completeness.deltaCents).toBe(1)
    expect(Math.abs(completeness.deltaCents)).toBeLessThanOrEqual(TOLERANCE_CENTS)
  })

  it('no subtotal supplied → hasSubtotal false, mismatch false', () => {
    const { completeness } = reconcileScannedBill([
      line({ name: 'A', quantity: 2, unitPriceCents: 450 }),
    ])
    expect(completeness.hasSubtotal).toBe(false)
    expect(completeness.subtotalCents).toBeUndefined()
    expect(completeness.reconciledSumCents).toBe(900)
    expect(completeness.mismatch).toBe(false)
    expect(completeness.deltaCents).toBe(0)
  })

  it('reconciledSumCents sums canonical line totals across multiple lines', () => {
    const { completeness } = reconcileScannedBill([
      line({ name: 'Tuborg', quantity: 2, unitPriceCents: 450 }),
      line({ name: 'Carlsberg', quantity: 5, unitPriceCents: 150 }),
    ])
    expect(completeness.reconciledSumCents).toBe(1650)
  })

  it('TOLERANCE_CENTS is the documented small fixed cents tolerance (2)', () => {
    expect(TOLERANCE_CENTS).toBe(2)
  })

  it('never invents items: returns exactly one reconciled item per input line', () => {
    const { items } = reconcileScannedBill(
      [
        line({ name: 'A', quantity: 1, lineTotalCents: 500 }),
        line({ name: 'B', quantity: 1, lineTotalCents: 300 }),
      ],
      { subtotalCents: 5000 }, // huge mismatch must NOT add phantom items
    )
    expect(items).toHaveLength(2)
  })
})

describe('itemsReconcileTarget', () => {
  it('printed subtotal wins when printed maths agree; fee ignored', () => {
    expect(itemsReconcileTarget(2000, 2500, 500)).toBe(2000)
  })
  it('maths disagree (tip inside total): subtotal kept when the items agree with it', () => {
    expect(itemsReconcileTarget(2000, 2700, 500, null, [2000])).toBe(2000)
  })
  it('maths disagree and nothing agrees: grand total minus fee and tax is the truth', () => {
    expect(itemsReconcileTarget(2000, 2700, 500)).toBe(2200)
    expect(itemsReconcileTarget(2000, 2700, 500, null, [1900])).toBe(2200)
  })
  it('maths disagree: price-column sum agreeing with the derived candidate wins (Ippudo)', () => {
    expect(itemsReconcileTarget(1507490, 1773739, 105490, 161249)).toBe(1507000)
    expect(itemsReconcileTarget(1507490, 1773739, 105490, 161249, [1507000])).toBe(1507000)
  })
  it('no fee or tax printed: subtotal kept', () => {
    expect(itemsReconcileTarget(2000, 2700, null, null)).toBe(2000)
  })
  it('grand total minus fee when no subtotal', () => {
    expect(itemsReconcileTarget(null, 2500, 500)).toBe(2000)
  })
  it('grand total unchanged when no fee', () => {
    expect(itemsReconcileTarget(null, 2500, null)).toBe(2500)
  })
  it('null when non-positive after subtracting', () => {
    expect(itemsReconcileTarget(null, 400, 500)).toBeNull()
  })
  it('null when no grand total', () => {
    expect(itemsReconcileTarget(null, null, 500)).toBeNull()
  })
})

describe('itemsReconcileTarget with tax', () => {
  it('grand total minus tax when no subtotal', () => {
    expect(itemsReconcileTarget(null, 10800, null, 800)).toBe(10000)
  })
  it('grand total minus fee and tax', () => {
    expect(itemsReconcileTarget(null, 11300, 500, 800)).toBe(10000)
  })
  it('printed subtotal wins, tax ignored', () => {
    expect(itemsReconcileTarget(10000, 10800, null, 800)).toBe(10000)
  })
  it('null when non-positive after subtracting', () => {
    expect(itemsReconcileTarget(null, 800, null, 800)).toBeNull()
  })
})
