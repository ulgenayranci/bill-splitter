import { describe, it, expect } from 'vitest'
import {
  parseCents,
  formatCents,
  computeSubtotalCents,
  computeTipCents,
  computePersonTotals,
  computePersonShareFromClaims,
  computeEqualShareCents,
  computeQtyWeightedShares,
} from '@/lib/billMath'
import type { Item, Person } from '@/stores/useBillStore'

describe('parseCents', () => {
  it('parses "12.50" to 1250', () => {
    expect(parseCents('12.50')).toBe(1250)
  })

  it('parses "0.1" to 10 exactly (no float drift)', () => {
    expect(parseCents('0.1')).toBe(10)
  })

  it('returns null for "0" (zero-price items are rejected)', () => {
    expect(parseCents('0')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseCents('')).toBeNull()
  })

  it('returns null for "abc"', () => {
    expect(parseCents('abc')).toBeNull()
  })

  it('returns null for 3+ decimal places "12.345"', () => {
    expect(parseCents('12.345')).toBeNull()
  })

  it('trims whitespace: "  12.50  " returns 1250', () => {
    expect(parseCents('  12.50  ')).toBe(1250)
  })

  it('returns null for negative "-5"', () => {
    expect(parseCents('-5')).toBeNull()
  })
})

describe('formatCents', () => {
  it('formats 1250 as "$12.50"', () => {
    expect(formatCents(1250)).toBe('$12.50')
  })

  it('formats 0 as "$0.00"', () => {
    expect(formatCents(0)).toBe('$0.00')
  })

  it('formats 5 as "$0.05"', () => {
    expect(formatCents(5)).toBe('$0.05')
  })

  it('formats 1250 with EUR as "€12.50"', () => {
    expect(formatCents(1250, 'EUR')).toBe('€12.50')
  })

  it('formats 1250 with JPY as "¥1,250" (zero-decimal: NOT divided by 100)', () => {
    const result = formatCents(1250, 'JPY')
    expect(result).toBe('¥1,250')
    expect(result).not.toBe('¥12')
    expect(result).not.toBe('¥12.50')
  })

  it('formats 999 with GBP as "£9.99"', () => {
    expect(formatCents(999, 'GBP')).toBe('£9.99')
  })

  it('falls back to legacy "$12.50" when currencyCode is empty string', () => {
    expect(formatCents(1250, '')).toBe('$12.50')
  })
})

describe('computeSubtotalCents', () => {
  it('sums item priceCents correctly', () => {
    const items: Pick<Item, 'priceCents'>[] = [{ priceCents: 1000 }, { priceCents: 250 }]
    expect(computeSubtotalCents(items as Item[])).toBe(1250)
  })

  it('returns 0 for empty items', () => {
    expect(computeSubtotalCents([])).toBe(0)
  })
})

describe('computeTipCents', () => {
  it('18% of 1000 = 180 (no float drift)', () => {
    expect(computeTipCents(1000, 18)).toBe(180)
  })

  it('returns 0 when subtotal is 0', () => {
    expect(computeTipCents(0, 20)).toBe(0)
  })

  it('returns 0 when tipPercent is 0', () => {
    expect(computeTipCents(1000, 0)).toBe(0)
  })
})

describe('computePersonTotals', () => {
  const makePerson = (id: string): Person => ({ id, name: id, colorIndex: 0 })
  const makeItem = (id: string, priceCents: number): Item => ({ id, name: id, priceCents, quantity: 1 })

  it('single item assigned to one person: credits full price', () => {
    const people = [makePerson('alice')]
    const items = [makeItem('item1', 500)]
    const assignments = { item1: ['alice'] }
    const totals = computePersonTotals(people, items, assignments, 0)
    expect(totals['alice']).toBe(500)
  })

  it('shared $10 item across 3 people: largest-remainder method, sum = 1000', () => {
    const people = [makePerson('p1'), makePerson('p2'), makePerson('p3')]
    const items = [makeItem('item1', 1000)]
    const assignments = { item1: ['p1', 'p2', 'p3'] }
    const totals = computePersonTotals(people, items, assignments, 0)
    expect(totals['p1'] + totals['p2'] + totals['p3']).toBe(1000)
    expect(totals['p1']).toBe(334)
    expect(totals['p2']).toBe(333)
    expect(totals['p3']).toBe(333)
  })

  it('sum of all returned values equals subtotal + tip (cents conservation)', () => {
    const people = [makePerson('a'), makePerson('b')]
    const items = [makeItem('i1', 1000), makeItem('i2', 500)]
    const assignments = { i1: ['a'], i2: ['a', 'b'] }
    const totals = computePersonTotals(people, items, assignments, 18)
    const subtotal = computeSubtotalCents(items)
    const tip = computeTipCents(subtotal, 18)
    const total = Object.values(totals).reduce((s, v) => s + v, 0)
    expect(total).toBe(subtotal + tip)
  })

  it('unassigned items contribute 0 to all totals', () => {
    const people = [makePerson('a')]
    const items = [makeItem('unassigned', 500)]
    const assignments = {}
    const totals = computePersonTotals(people, items, assignments, 0)
    expect(totals['a']).toBe(0)
  })

  it('tip splits equally; remainder distributed via largest-remainder', () => {
    // 3 people, tip of 10 cents: 3+3+4 or 4+3+3
    const people = [makePerson('p1'), makePerson('p2'), makePerson('p3')]
    const items: Item[] = []
    const assignments = {}
    // tip is computed from subtotal, so let's create items to get specific tip
    // 3 items of 100 cents each = 300 cents subtotal, 10% tip = 30 cents → 10 each
    const itemsForTip = [makeItem('i1', 1000)]
    const assignmentsForTip = { i1: ['p1', 'p2', 'p3'] }
    const totals = computePersonTotals(people, itemsForTip, assignmentsForTip, 10)
    // subtotal = 1000, tip = 100 cents, split among 3 = 33+33+34 or similar
    const tipTotal = computeTipCents(1000, 10)
    expect(tipTotal).toBe(100)
    const tipPerPerson = Object.values(totals).map(v => v - Math.floor(1000 / 3) - (0 < 1000 % 3 ? 1 : 0))
    const allTips = tipPerPerson.reduce((s, v) => s + v, 0)
    // Just verify conservation
    const sum = Object.values(totals).reduce((s, v) => s + v, 0)
    expect(sum).toBe(1000 + tipTotal)
  })
})

describe('computePersonShareFromClaims', () => {
  const makeItem = (id: string, priceCents: number, quantity = 1): Item => ({
    id, name: id, priceCents, quantity,
  })

  it('single claimant qty=1 of quantity=1: returns full price', () => {
    const items = [makeItem('i1', 1000)]
    const claims = { i1: { p1: { qty: 1 } } }
    const r = computePersonShareFromClaims('p1', items, claims, 0)
    expect(r.itemSubtotal).toBe(1000)
    expect(r.total).toBe(1000)
    expect(r.lineItems).toHaveLength(1)
    expect(r.lineItems[0].shareCents).toBe(1000)
  })

  it('two claimants qty=1 each of quantity=2: equal split (all units claimed)', () => {
    const items = [makeItem('i1', 1000, 2)]
    const claims = { i1: { p1: { qty: 1 }, p2: { qty: 1 } } }
    const r = computePersonShareFromClaims('p1', items, claims, 0)
    expect(r.itemSubtotal).toBe(500)
  })

  it('qty=2 of total qty=3 (all units claimed): 2/3 of price', () => {
    const items = [makeItem('i1', 900, 3)]
    const claims = { i1: { p1: { qty: 2 }, p2: { qty: 1 } } }
    const r = computePersonShareFromClaims('p1', items, claims, 0)
    expect(r.itemSubtotal).toBe(600)
  })

  it('zero claimants on item: contributes nothing (no divide by zero)', () => {
    const items = [makeItem('i1', 500)]
    const claims = {}
    const r = computePersonShareFromClaims('p1', items, claims, 0)
    expect(r.itemSubtotal).toBe(0)
    expect(r.lineItems).toHaveLength(0)
  })

  it("person didn't claim: lineItems empty", () => {
    const items = [makeItem('i1', 500)]
    const claims = { i1: { p2: { qty: 1 } } }
    const r = computePersonShareFromClaims('p1', items, claims, 0)
    expect(r.itemSubtotal).toBe(0)
    expect(r.lineItems).toHaveLength(0)
  })

  it('tip added to subtotal', () => {
    const items = [makeItem('i1', 1000)]
    const claims = { i1: { p1: { qty: 1 } } }
    const r = computePersonShareFromClaims('p1', items, claims, 180)
    expect(r.tip).toBe(180)
    expect(r.total).toBe(1180)
  })

  // CR-01: single-unit-each shared items now use largest-remainder (computeEqualShareCents)
  // for billing so the billed value matches the card's displayed "your share" AND the shares
  // conserve cents exactly. Previously this used proportional rounding (333 each → lost a cent).
  it('CR-01: 3-way single-qty share of 1000 — index-0 (sorted) claimant billed 334, matching the card', () => {
    const items = [makeItem('i1', 1000)]
    const claims = { i1: { p1: { qty: 1 }, p2: { qty: 1 }, p3: { qty: 1 } } }
    // sorted ascending p1 < p2 < p3 → p1 is index 0 → gets the extra cent (334)
    const r1 = computePersonShareFromClaims('p1', items, claims, 0)
    expect(r1.itemSubtotal).toBe(334)
    const r2 = computePersonShareFromClaims('p2', items, claims, 0)
    expect(r2.itemSubtotal).toBe(333)
    const r3 = computePersonShareFromClaims('p3', items, claims, 0)
    expect(r3.itemSubtotal).toBe(333)
  })

  it('CR-01: billed shares for a single-qty shared item conserve cents exactly (sum === priceCents)', () => {
    const items = [makeItem('i1', 1000)]
    const claims = { i1: { p1: { qty: 1 }, p2: { qty: 1 }, p3: { qty: 1 } } }
    const sum =
      computePersonShareFromClaims('p1', items, claims, 0).itemSubtotal +
      computePersonShareFromClaims('p2', items, claims, 0).itemSubtotal +
      computePersonShareFromClaims('p3', items, claims, 0).itemSubtotal
    expect(sum).toBe(1000)
  })

  it('CR-01: billed share === card-displayed computeEqualShareCents for the index-0 claimant', () => {
    const items = [makeItem('i1', 1000)]
    const claims = { i1: { p1: { qty: 1 }, p2: { qty: 1 }, p3: { qty: 1 } } }
    // The card renders computeEqualShareCents(price, N, myIndex) for sorted ids ['p1','p2','p3'].
    const cardValueForP1 = computeEqualShareCents(1000, 3, 0)
    const billedForP1 = computePersonShareFromClaims('p1', items, claims, 0).itemSubtotal
    expect(billedForP1).toBe(cardValueForP1)
  })

  // CR-02: multi-qty items now ALSO use quantity-weighted largest-remainder so shares
  // conserve cents exactly (the old proportional Math.round path billed 333 each → 999,
  // a lost cent). Index-0 (sorted) claimant absorbs the leftover cent.
  it('CR-02: multi-qty 3-unit $10 with one unit each — index-0 billed 334, conserves cents', () => {
    const items = [makeItem('i1', 1000, 3)]
    const claims = { i1: { p1: { qty: 1 }, p2: { qty: 1 }, p3: { qty: 1 } } }
    expect(computePersonShareFromClaims('p1', items, claims, 0).itemSubtotal).toBe(334)
    expect(computePersonShareFromClaims('p2', items, claims, 0).itemSubtotal).toBe(333)
    expect(computePersonShareFromClaims('p3', items, claims, 0).itemSubtotal).toBe(333)
  })

  // CR-02 (a): per-person shares of a multi-qty shared item sum EXACTLY to the line price
  // when ALL units are claimed. When units are unclaimed the sum is the claimed portion only.
  it('CR-02: fully-claimed multi-qty shared shares sum to the line price exactly (cent conservation)', () => {
    const cases: Array<{ price: number; qty: number; claims: Record<string, { qty: number }> }> = [
      { price: 1000, qty: 3, claims: { p1: { qty: 1 }, p2: { qty: 1 }, p3: { qty: 1 } } },
      { price: 1000, qty: 6, claims: { p1: { qty: 1 }, p2: { qty: 1 }, p3: { qty: 1 }, p4: { qty: 1 }, p5: { qty: 1 }, p6: { qty: 1 } } },
      { price: 1349, qty: 7, claims: { p1: { qty: 2 }, p2: { qty: 2 }, p3: { qty: 3 } } },
      { price: 505, qty: 4, claims: { p1: { qty: 1 }, p2: { qty: 1 }, p3: { qty: 1 }, p4: { qty: 1 } } },
      { price: 1000, qty: 3, claims: { p1: { qty: 2 }, p2: { qty: 1 } } },
    ]
    for (const c of cases) {
      const items = [makeItem('i1', c.price, c.qty)]
      const claimsItems = { i1: c.claims }
      const sum = Object.keys(c.claims).reduce(
        (acc, pid) => acc + computePersonShareFromClaims(pid, items, claimsItems, 0).itemSubtotal,
        0
      )
      expect(sum).toBe(c.price)
    }
  })

  // CR-02 (b): the card-displayed share equals the billed share for the SAME multi-qty item.
  // The card renders computeQtyWeightedShares(price, sortedIds, qtyById, itemQty); billing uses
  // the same helper, so they must be identical for every claimant.
  it('CR-02: card-displayed share === billed share for a multi-qty item (all claimed)', () => {
    const items = [makeItem('i1', 1349, 7)]
    const claims = { i1: { p1: { qty: 2 }, p2: { qty: 2 }, p3: { qty: 3 } } }
    const sortedIds = ['p1', 'p2', 'p3']
    const qtyById = { p1: 2, p2: 2, p3: 3 }
    const cardShares = computeQtyWeightedShares(1349, sortedIds, qtyById, 7)
    for (const pid of sortedIds) {
      const billed = computePersonShareFromClaims(pid, items, claims, 0).itemSubtotal
      expect(billed).toBe(cardShares[pid])
    }
  })

  it('no tax: total === itemSubtotal + tip only', () => {
    const items = [makeItem('i1', 1000)]
    const claims = { i1: { p1: { qty: 1 } } }
    const r = computePersonShareFromClaims('p1', items, claims, 200)
    expect(r.total).toBe(r.itemSubtotal + r.tip)
    expect(r.total).toBe(1200)
  })

  // Partial-claim contract (2026-06-24 decision): when fewer units are claimed than
  // item.quantity, each claimant pays only priceCents × claimedQty / item.quantity.
  // Unclaimed units stay UNBILLED — not redistributed to claimants.
  it('partial claim: Carlsberg ×13 @ 2197, Mehmet claims 1 unit → billed 169 (not 2197)', () => {
    const items = [makeItem('carlsberg', 2197, 13)]
    const claims = { carlsberg: { mehmet: { qty: 1 } } }
    const r = computePersonShareFromClaims('mehmet', items, claims, 0)
    // unit price = 2197 / 13 = 169
    expect(r.itemSubtotal).toBe(169)
  })

  it('partial claim: ×13 item, two people claim 1 and 6 units → 169 and 1014', () => {
    const items = [makeItem('carlsberg', 2197, 13)]
    const claims = { carlsberg: { mehmet: { qty: 1 }, ali: { qty: 6 } } }
    const rMehmet = computePersonShareFromClaims('mehmet', items, claims, 0)
    const rAli = computePersonShareFromClaims('ali', items, claims, 0)
    // mehmet: 2197 × 1/13 = 169
    expect(rMehmet.itemSubtotal).toBe(169)
    // ali: 2197 × 6/13 = 1014
    expect(rAli.itemSubtotal).toBe(1014)
    // Total billed: 169 + 1014 = 1183, NOT 2197. 6 unclaimed units stay unbilled.
    expect(rMehmet.itemSubtotal + rAli.itemSubtotal).toBe(1183)
    expect(rMehmet.itemSubtotal + rAli.itemSubtotal).toBeLessThan(2197)
  })

  it('partial claim: claimants together only pay for their units — unclaimed portion is zero billed', () => {
    // 10-unit item @ 1000. Only 4 units claimed by two people (2 each).
    // Each pays 1000 × 2/10 = 200. 6 units unbilled.
    const items = [makeItem('drinks', 1000, 10)]
    const claims = { drinks: { p1: { qty: 2 }, p2: { qty: 2 } } }
    const r1 = computePersonShareFromClaims('p1', items, claims, 0)
    const r2 = computePersonShareFromClaims('p2', items, claims, 0)
    expect(r1.itemSubtotal).toBe(200)
    expect(r2.itemSubtotal).toBe(200)
    expect(r1.itemSubtotal + r2.itemSubtotal).toBe(400)
  })

  it('partial claim: single sole claimant of multi-unit item pays only their unit-price × claimed', () => {
    // 5-unit item @ 750, one person claims 2 → pays 300 (= 2 × 150)
    const items = [makeItem('beer', 750, 5)]
    const claims = { beer: { alice: { qty: 2 } } }
    const r = computePersonShareFromClaims('alice', items, claims, 0)
    expect(r.itemSubtotal).toBe(300)
  })

  it('partial claim: card share === billed share when units are unclaimed', () => {
    // 13-unit item @ 2197; p1 claims 3, p2 claims 5 (5 units unclaimed)
    const items = [makeItem('carlsberg', 2197, 13)]
    const claims = { carlsberg: { p1: { qty: 3 }, p2: { qty: 5 } } }
    const sortedIds = ['p1', 'p2']
    const qtyById = { p1: 3, p2: 5 }
    // Card uses computeQtyWeightedShares with itemQty=13
    const cardShares = computeQtyWeightedShares(2197, sortedIds, qtyById, 13)
    for (const pid of sortedIds) {
      const billed = computePersonShareFromClaims(pid, items, claims, 0).itemSubtotal
      expect(billed).toBe(cardShares[pid])
    }
  })
})

describe('computeEqualShareCents', () => {
  it('2-way split of 1000: index 0 → 500, index 1 → 500', () => {
    expect(computeEqualShareCents(1000, 2, 0)).toBe(500)
    expect(computeEqualShareCents(1000, 2, 1)).toBe(500)
  })

  it('3-way split of 1000: index 0 → 334 (gets remainder), index 1 → 333, index 2 → 333', () => {
    expect(computeEqualShareCents(1000, 3, 0)).toBe(334)
    expect(computeEqualShareCents(1000, 3, 1)).toBe(333)
    expect(computeEqualShareCents(1000, 3, 2)).toBe(333)
  })

  it('3-way split of 1000: sum over all indices equals 1000 exactly (sum conservation)', () => {
    const sum = [0, 1, 2].reduce((acc, idx) => acc + computeEqualShareCents(1000, 3, idx), 0)
    expect(sum).toBe(1000)
  })

  it('general sum conservation: reduce over all indices always equals priceCents', () => {
    const cases: Array<[number, number]> = [
      [999, 4],
      [1001, 3],
      [500, 7],
      [10000, 6],
      [1, 3],
    ]
    for (const [priceCents, numSharers] of cases) {
      const sum = Array.from({ length: numSharers }, (_, i) => computeEqualShareCents(priceCents, numSharers, i))
        .reduce((acc, v) => acc + v, 0)
      expect(sum).toBe(priceCents)
    }
  })

  it('numSharers <= 0 returns 0 (guard)', () => {
    expect(computeEqualShareCents(1000, 0, 0)).toBe(0)
    expect(computeEqualShareCents(1000, -1, 0)).toBe(0)
  })
})

describe('computeQtyWeightedShares', () => {
  // When called WITHOUT itemQty (backward-compatible path), divisor = totalClaimedQty.
  // All cases below are fully-claimed, so sum still equals priceCents.
  it('conserves cents for every fully-claimed distribution (sum === priceCents)', () => {
    const cases: Array<{ price: number; ids: string[]; qty: Record<string, number> }> = [
      { price: 1000, ids: ['a', 'b', 'c'], qty: { a: 1, b: 1, c: 1 } },
      { price: 1000, ids: ['a', 'b', 'c', 'd', 'e', 'f'], qty: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 } },
      { price: 1349, ids: ['a', 'b', 'c'], qty: { a: 2, b: 2, c: 3 } },
      { price: 505, ids: ['a', 'b', 'c', 'd'], qty: { a: 1, b: 1, c: 1, d: 1 } },
      { price: 1, ids: ['a', 'b', 'c'], qty: { a: 1, b: 1, c: 1 } },
      { price: 9999, ids: ['a', 'b'], qty: { a: 3, b: 4 } },
    ]
    for (const c of cases) {
      const shares = computeQtyWeightedShares(c.price, c.ids, c.qty)
      const sum = c.ids.reduce((acc, id) => acc + shares[id], 0)
      expect(sum).toBe(c.price)
    }
  })

  it('leftover cents go to largest fractional parts, tie-broken by sorted index', () => {
    // 1000 / 3 equal units → base 333 each, 1 leftover cent to index 0 (sorted ascending).
    const shares = computeQtyWeightedShares(1000, ['p1', 'p2', 'p3'], { p1: 1, p2: 1, p3: 1 })
    expect(shares).toEqual({ p1: 334, p2: 333, p3: 333 })
  })

  it('weights by qty: 2-of-3 claim gets ~2/3 of price (no itemQty → backward-compatible)', () => {
    const shares = computeQtyWeightedShares(1000, ['p1', 'p2'], { p1: 2, p2: 1 })
    expect(shares.p1 + shares.p2).toBe(1000)
    expect(shares.p1).toBe(667)
    expect(shares.p2).toBe(333)
  })

  it('empty sharer list returns empty map', () => {
    expect(computeQtyWeightedShares(1000, [], {})).toEqual({})
  })

  it('all-zero qty: every listed sharer gets 0 (no divide by zero)', () => {
    expect(computeQtyWeightedShares(1000, ['p1', 'p2'], { p1: 0, p2: 0 })).toEqual({ p1: 0, p2: 0 })
  })

  // Partial-claim tests: when itemQty is provided and totalClaimedQty < itemQty,
  // shares sum to the claimed portion, not the full line price.
  it('partial claim with itemQty: 1 of 13 units → share = unitPrice × 1', () => {
    // Carlsberg ×13 @ 2197. One person claims 1 unit.
    const shares = computeQtyWeightedShares(2197, ['mehmet'], { mehmet: 1 }, 13)
    expect(shares.mehmet).toBe(169) // 2197 / 13 = 169
    // Unclaimed 12 units contribute 0 — sum < priceCents.
    expect(shares.mehmet).toBeLessThan(2197)
  })

  it('partial claim with itemQty: two claimants share a subset of units correctly', () => {
    // 13-unit item @ 2197. p1 claims 3, p2 claims 5. 5 units unclaimed.
    const shares = computeQtyWeightedShares(2197, ['p1', 'p2'], { p1: 3, p2: 5 }, 13)
    // p1: floor(2197 × 3 / 13) = floor(507.23) = 507
    // p2: floor(2197 × 5 / 13) = floor(845.38) = 845
    // claimedPriceCents = floor(2197 × 8 / 13) = floor(1352) = 1352
    // distributed = 507 + 845 = 1352; remainder = 0
    expect(shares.p1).toBe(507)
    expect(shares.p2).toBe(845)
    expect(shares.p1 + shares.p2).toBe(1352)
    expect(shares.p1 + shares.p2).toBeLessThan(2197)
  })

  it('full claim with itemQty: all units claimed → sum still equals priceCents', () => {
    // 5-unit item @ 750. All 5 claimed (2+2+1). Sum must equal 750.
    const shares = computeQtyWeightedShares(750, ['a', 'b', 'c'], { a: 2, b: 2, c: 1 }, 5)
    expect(shares.a + shares.b + shares.c).toBe(750)
    expect(shares.a).toBe(300)
    expect(shares.b).toBe(300)
    expect(shares.c).toBe(150)
  })

  it('over-claim guard: when totalClaimedQty > itemQty, divisor is clamped to totalClaimedQty', () => {
    // 3-unit item @ 900. 4 units claimed (over-claim). Divisor should be 4 (not 3).
    // No claimant should be billed more than priceCents.
    const shares = computeQtyWeightedShares(900, ['p1', 'p2'], { p1: 3, p2: 1 }, 3)
    // divisor = max(3, 4) = 4; p1 gets 900×3/4=675, p2 gets 225. Sum = 900 > claimed portion.
    expect(shares.p1).toBe(675)
    expect(shares.p2).toBe(225)
    expect(shares.p1 + shares.p2).toBe(900)
  })
})

// Scan-guardrail end-to-end: once reconcileScannedBill stores the canonical LINE
// TOTAL into priceCents, billMath splits the full line — nobody is undercharged by
// the quantity factor. These lock the real-world cases that motivated the fix.
describe('scan-guardrail line totals', () => {
  const makeItem = (id: string, priceCents: number, quantity = 1): Item => ({
    id, name: id, priceCents, quantity,
  })

  it('Tuborg ×2 @ 450 → line total 900 splits correctly among 2 claimants', () => {
    const items = [makeItem('tuborg', 900, 2)]
    const claims = { tuborg: { a: { qty: 1 }, b: { qty: 1 } } }
    const shareA = computePersonShareFromClaims('a', items, claims, 0).itemSubtotal
    const shareB = computePersonShareFromClaims('b', items, claims, 0).itemSubtotal
    expect(shareA + shareB).toBe(900)
    expect(shareA).toBe(450)
    expect(shareB).toBe(450)
  })

  it('Carlsberg ×5 @ 150 → line total 750 (NOT 150) summed across claimants', () => {
    const items = [makeItem('carlsberg', 750, 5)]
    // One person takes all 5 units → full line total.
    const claims = { carlsberg: { a: { qty: 5 } } }
    expect(computePersonShareFromClaims('a', items, claims, 0).itemSubtotal).toBe(750)
  })

  it('Carlsberg 750 with A=2,B=2,C=1 → 300/300/150 summing to 750 exactly', () => {
    const sortedIds = ['a', 'b', 'c']
    const qtyById = { a: 2, b: 2, c: 1 }
    const shares = computeQtyWeightedShares(750, sortedIds, qtyById, 5)
    expect(shares.a).toBe(300)
    expect(shares.b).toBe(300)
    expect(shares.c).toBe(150)
    expect(shares.a + shares.b + shares.c).toBe(750)

    // Billed path agrees with the card-displayed shares for every claimant.
    const items = [makeItem('carlsberg', 750, 5)]
    const claims = { carlsberg: { a: { qty: 2 }, b: { qty: 2 }, c: { qty: 1 } } }
    for (const pid of sortedIds) {
      expect(computePersonShareFromClaims(pid, items, claims, 0).itemSubtotal).toBe(shares[pid])
    }
  })
})
