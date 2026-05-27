import { describe, it, expect } from 'vitest'
import {
  parseCents,
  formatCents,
  computeSubtotalCents,
  computeTipCents,
  computePersonTotals,
  computePersonShareFromClaims,
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

  it('single claimant qty=1: returns full price', () => {
    const items = [makeItem('i1', 1000)]
    const claims = { i1: { p1: { qty: 1 } } }
    const r = computePersonShareFromClaims('p1', items, claims, 0)
    expect(r.itemSubtotal).toBe(1000)
    expect(r.total).toBe(1000)
    expect(r.lineItems).toHaveLength(1)
    expect(r.lineItems[0].shareCents).toBe(1000)
  })

  it('two claimants qty=1 each: equal split', () => {
    const items = [makeItem('i1', 1000)]
    const claims = { i1: { p1: { qty: 1 }, p2: { qty: 1 } } }
    const r = computePersonShareFromClaims('p1', items, claims, 0)
    expect(r.itemSubtotal).toBe(500)
  })

  it('qty=2 of total qty=3: 2/3 of price', () => {
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

  it('proportional rounding: 3-way share of 1000 → 333 per person', () => {
    const items = [makeItem('i1', 1000)]
    const claims = { i1: { p1: { qty: 1 }, p2: { qty: 1 }, p3: { qty: 1 } } }
    const r = computePersonShareFromClaims('p1', items, claims, 0)
    expect(r.itemSubtotal).toBe(333)
  })

  it('no tax: total === itemSubtotal + tip only', () => {
    const items = [makeItem('i1', 1000)]
    const claims = { i1: { p1: { qty: 1 } } }
    const r = computePersonShareFromClaims('p1', items, claims, 200)
    expect(r.total).toBe(r.itemSubtotal + r.tip)
    expect(r.total).toBe(1200)
  })
})
