import { describe, it, expect } from 'vitest'
import {
  computeEqualChargeShares,
  computePersonShareFromClaims,
  computeSubtotalCents,
} from '@/lib/billMath'
import type { Item, Person } from '@/stores/useBillStore'

type Pattern = 'oneNamed' | 'allEmpty' | 'alternating' | 'allNamed'

function makePeople(n: number, pattern: Pattern): Person[] {
  return Array.from({ length: n }, (_, i) => {
    const empty =
      pattern === 'allEmpty'
        ? true
        : pattern === 'allNamed'
          ? false
          : pattern === 'oneNamed'
            ? i > 0
            : i % 2 === 1
    return empty
      ? { id: `p${i}`, name: '', colorIndex: i % 8, guestNumber: i + 1 }
      : { id: `p${i}`, name: `Person ${i}`, colorIndex: i % 8 }
  })
}

function charges(n: number): number[] {
  const set = new Set<number>([1, n, n + 1, 97, 9973, 100000, 10000000])
  if (n - 1 > 0) set.add(n - 1)
  return [...set]
}

describe('computeEqualChargeShares with empty seats (RESULTS-06)', () => {
  it('sums exactly to the charge with every seat keyed, spread <= 1, for n 1..20', () => {
    for (let n = 1; n <= 20; n++) {
      const people = makePeople(n, 'oneNamed')
      for (const charge of charges(n)) {
        const shares = computeEqualChargeShares(charge, people)
        const values = people.map((p) => shares[p.id])
        const ctx = `n=${n} charge=${charge}`
        expect(
          people.every((p) => p.id in shares),
          `${ctx}: all keys`
        ).toBe(true)
        expect(
          values.reduce((a, b) => a + b, 0),
          `${ctx}: sum`
        ).toBe(charge)
        expect(Math.max(...values) - Math.min(...values), `${ctx}: spread`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('name never affects the split (all empty / alternating == all named)', () => {
    for (let n = 1; n <= 20; n++) {
      const named = makePeople(n, 'allNamed')
      for (const pattern of ['allEmpty', 'alternating'] as const) {
        const people = makePeople(n, pattern)
        for (const charge of charges(n)) {
          expect(
            computeEqualChargeShares(charge, people),
            `n=${n} charge=${charge} ${pattern}`
          ).toEqual(computeEqualChargeShares(charge, named))
        }
      }
    }
  })

  it('invalid or non-positive charge gives every seat 0', () => {
    const people = makePeople(4, 'oneNamed')
    for (const charge of [0, undefined, null, -5, 12.5]) {
      const shares = computeEqualChargeShares(charge as number | null | undefined, people)
      for (const p of people) expect(shares[p.id], `charge=${String(charge)}`).toBe(0)
    }
  })

  it('canonical order: remainder goes to first array positions', () => {
    const A: Person = { id: 'A', name: 'Alice', colorIndex: 0 }
    const S1: Person = { id: 'S1', name: '', colorIndex: 1, guestNumber: 1 }
    const S2: Person = { id: 'S2', name: '', colorIndex: 2, guestNumber: 2 }
    const canonical = computeEqualChargeShares(1001, [A, S1, S2])
    expect(canonical).toEqual({ A: 334, S1: 334, S2: 333 })
    const reordered = computeEqualChargeShares(1001, [S2, A, S1])
    expect(reordered).toEqual({ S2: 334, A: 334, S1: 333 })
    expect(reordered).not.toEqual(canonical)
  })
})

describe('full-bill conservation with empty seats', () => {
  const items: Item[] = [
    { id: 'i1', name: 'Pizza', priceCents: 1200, quantity: 1 },
    { id: 'i2', name: 'Beer', priceCents: 1500, quantity: 3 },
  ]

  it('Alice claims everything, 3 empty seats pay only equal tax + service', () => {
    const people: Person[] = [
      { id: 'alice', name: 'Alice', colorIndex: 0 },
      { id: 's1', name: '', colorIndex: 1, guestNumber: 1 },
      { id: 's2', name: '', colorIndex: 2, guestNumber: 2 },
      { id: 's3', name: '', colorIndex: 3, guestNumber: 3 },
    ]
    const claims = {
      i1: { alice: { qty: 1 } },
      i2: { alice: { qty: 3 } },
    }
    const tips = { alice: 300 } as Record<string, number>
    const taxShares = computeEqualChargeShares(1001, people)
    const feeShares = computeEqualChargeShares(503, people)
    const results = people.map((p) => ({
      p,
      r: computePersonShareFromClaims(
        p.id,
        items,
        claims,
        tips[p.id] ?? 0,
        feeShares[p.id],
        taxShares[p.id]
      ),
    }))
    const total = results.reduce((a, x) => a + x.r.total, 0)
    expect(total).toBe(1200 + 1500 + 1001 + 503 + 300)
    for (const { p, r } of results.filter((x) => x.p.name === '')) {
      expect(r.itemSubtotal).toBe(0)
      expect(r.tip).toBe(0)
      expect(r.tax).toBe(taxShares[p.id])
      expect(r.serviceFee).toBe(feeShares[p.id])
    }
  })

  it('two named claimants + 2 empty seats sharing a qty-1 item still conserve', () => {
    const people: Person[] = [
      { id: 'a', name: 'Ana', colorIndex: 0 },
      { id: 'b', name: 'Ben', colorIndex: 1 },
      { id: 's1', name: '', colorIndex: 2, guestNumber: 1 },
      { id: 's2', name: '', colorIndex: 3, guestNumber: 2 },
    ]
    const claims = {
      i1: { a: { qty: 1 }, b: { qty: 1 } },
      i2: { a: { qty: 1 }, b: { qty: 2 } },
    }
    const tips = { a: 100, b: 250 } as Record<string, number>
    const taxShares = computeEqualChargeShares(1001, people)
    const feeShares = computeEqualChargeShares(503, people)
    const total = people.reduce(
      (acc, p) =>
        acc +
        computePersonShareFromClaims(
          p.id,
          items,
          claims,
          tips[p.id] ?? 0,
          feeShares[p.id],
          taxShares[p.id]
        ).total,
      0
    )
    expect(total).toBe(computeSubtotalCents(items) + 1001 + 503 + 100 + 250)
  })
})
