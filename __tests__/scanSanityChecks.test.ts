import { describe, it, expect } from 'vitest'
import {
  flagScannedLines,
  shouldForceScanReview,
  SCAN_FLAG_REASONS,
  type ScanSanityLine,
} from '@/lib/scanSanityChecks'

const L = (over: Partial<ScanSanityLine> = {}): ScanSanityLine => ({
  name: 'Burger',
  quantity: 1,
  priceCents: 1200,
  ...over,
})

describe('flagScannedLines', () => {
  it('empty list', () => {
    expect(flagScannedLines([])).toEqual({ lineFlags: [], flaggedCount: 0, emptyList: true })
  })

  it('clean bill has no flags', () => {
    const r = flagScannedLines([
      L({ name: 'Burger', priceCents: 1200 }),
      L({ name: 'Fries', priceCents: 450 }),
      L({ name: 'Beer', quantity: 2, priceCents: 1000 }),
    ])
    expect(r.lineFlags).toEqual([null, null, null])
    expect(r.flaggedCount).toBe(0)
    expect(r.emptyList).toBe(false)
  })

  it('low and ambiguous confidence -> Hard to read', () => {
    const r = flagScannedLines([
      L({ confidence: 'low' }),
      L({ confidence: 'ambiguous' }),
      L({ confidence: 'high' }),
      L(),
    ])
    expect(r.lineFlags).toEqual([
      SCAN_FLAG_REASONS.hardToRead,
      SCAN_FLAG_REASONS.hardToRead,
      null,
      null,
    ])
    expect(r.flaggedCount).toBe(2)
  })

  it('quantity > 10 flagged, 10 not', () => {
    const r = flagScannedLines([
      L({ quantity: 11, priceCents: 1100 }),
      L({ quantity: 10, priceCents: 1000 }),
    ])
    expect(r.lineFlags).toEqual([SCAN_FLAG_REASONS.quantity, null])
  })

  it('price > 10x median flagged (>= 3 items)', () => {
    const r = flagScannedLines([
      L({ priceCents: 500 }),
      L({ priceCents: 600 }),
      L({ priceCents: 700 }),
      L({ priceCents: 80000 }),
    ])
    expect(r.lineFlags).toEqual([null, null, null, SCAN_FLAG_REASONS.price])
  })

  it('exactly 10x median not flagged', () => {
    // unit prices 500, 500, 5000 -> median 500, 5000 == 10x
    const r = flagScannedLines([
      L({ priceCents: 500 }),
      L({ priceCents: 500 }),
      L({ priceCents: 5000 }),
    ])
    expect(r.lineFlags).toEqual([null, null, null])
  })

  it('price check needs >= 3 items', () => {
    const r = flagScannedLines([L({ priceCents: 100 }), L({ priceCents: 10000 })])
    expect(r.lineFlags).toEqual([null, null])
  })

  it('uses unit price (derived from line total / quantity)', () => {
    const r = flagScannedLines([
      L({ priceCents: 500 }),
      L({ priceCents: 500 }),
      L({ quantity: 4, priceCents: 2000 }),
    ])
    expect(r.lineFlags).toEqual([null, null, null])
  })

  it('uses unitPriceCents when present', () => {
    const r = flagScannedLines([
      L({ priceCents: 500 }),
      L({ priceCents: 500 }),
      L({ priceCents: 500 }),
      L({ quantity: 2, priceCents: 20000, unitPriceCents: 10000 }),
    ])
    expect(r.lineFlags[3]).toBe(SCAN_FLAG_REASONS.price)
  })

  it('even-count median averages the middle two', () => {
    // 100, 200, 300, 2200 -> median 250 -> 2200 < 2500 not flagged
    const r = flagScannedLines([
      L({ priceCents: 100 }),
      L({ priceCents: 200 }),
      L({ priceCents: 300 }),
      L({ priceCents: 2200 }),
    ])
    expect(r.lineFlags[3]).toBeNull()
  })

  it.each([
    'TOTAL',
    'Sub Total',
    'Subtotal',
    'Tax',
    'VAT 8%',
    'KDV',
    'Tip',
    'Service charge',
    'Discount',
    'Change',
    'Cash',
    'Card',
    'Balance',
    'Toplam',
    'Ara Toplam',
    'MwSt',
    'IVA',
    'TVA',
    'Servis',
    'Indirim',
    'Nakit',
    'Kredi Karti',
  ])('flags non-item "%s"', (name) => {
    const r = flagScannedLines([L({ name })])
    expect(r.lineFlags[0]).toBe(SCAN_FLAG_REASONS.nonItem)
  })

  it.each([
    'Tipsy cocktail',
    'Taxi burger',
    'Totally vegan bowl',
    'Cardamom tea',
    'Cashew salad',
    'Changua soup',
    'Servisi',
  ])('does not flag real dish "%s"', (name) => {
    const r = flagScannedLines([L({ name })])
    expect(r.lineFlags[0]).toBeNull()
  })

  it('priority: nonItem > quantity > price > hard to read', () => {
    expect(
      flagScannedLines([L({ name: 'Total', quantity: 20, priceCents: 2000, confidence: 'low' })])
        .lineFlags[0],
    ).toBe(SCAN_FLAG_REASONS.nonItem)
    expect(
      flagScannedLines([L({ quantity: 20, priceCents: 2000, confidence: 'low' })]).lineFlags[0],
    ).toBe(SCAN_FLAG_REASONS.quantity)
    const r = flagScannedLines([
      L({ priceCents: 500 }),
      L({ priceCents: 500 }),
      L({ priceCents: 500 }),
      L({ priceCents: 90000, confidence: 'low' }),
    ])
    expect(r.lineFlags[3]).toBe(SCAN_FLAG_REASONS.price)
  })
})

describe('shouldForceScanReview', () => {
  const base = { itemCount: 3, mismatch: false, targetCents: 5000, flaggedCount: 0 }

  it('no items', () => {
    const r = shouldForceScanReview({ ...base, itemCount: 0 })
    expect(r.forceReview).toBe(true)
    expect(r.reasons).toContain('no-items')
  })
  it('mismatch', () => {
    expect(shouldForceScanReview({ ...base, mismatch: true })).toEqual({
      forceReview: true,
      reasons: ['mismatch'],
    })
  })
  it('no total', () => {
    const r = shouldForceScanReview({ ...base, targetCents: null })
    expect(r.forceReview).toBe(true)
    expect(r.reasons).toContain('no-total')
  })
  it('flagged lines', () => {
    expect(shouldForceScanReview({ ...base, flaggedCount: 2 })).toEqual({
      forceReview: true,
      reasons: ['flagged-lines'],
    })
  })
  it('clean', () => {
    expect(shouldForceScanReview(base)).toEqual({ forceReview: false, reasons: [] })
  })
  it('multiple causes in fixed order', () => {
    expect(
      shouldForceScanReview({ itemCount: 0, mismatch: true, targetCents: null, flaggedCount: 1 })
        .reasons,
    ).toEqual(['no-items', 'mismatch', 'no-total', 'flagged-lines'])
  })
})

describe('autoFixed flag precedence', () => {
  it('autoFixed wins over quantity/price/hardToRead', () => {
    const { lineFlags } = flagScannedLines([L({ autoFixed: true, quantity: 20, confidence: 'low' })])
    expect(lineFlags[0]).toBe(SCAN_FLAG_REASONS.autoFixed)
  })
  it('nonItem still wins over autoFixed', () => {
    const { lineFlags } = flagScannedLines([L({ autoFixed: true, name: 'Service charge' })])
    expect(lineFlags[0]).toBe(SCAN_FLAG_REASONS.nonItem)
  })
})
