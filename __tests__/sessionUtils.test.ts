import { describe, it, expect } from 'vitest'
import { getClaimedUnitCounts, getUnclaimedCounts } from '@/lib/sessionUtils'
import type { SessionPayload } from '@/lib/sessionSchema'

function makeSession(over: Partial<SessionPayload> = {}): SessionPayload {
  return {
    people: [
      { id: 'p1', name: 'Alice', colorIndex: 0 },
      { id: 'p2', name: 'Bob', colorIndex: 1 },
    ],
    items: [
      { id: 'i1', name: 'Pizza', priceCents: 1000, quantity: 1 },
      { id: 'i2', name: 'Cokes', priceCents: 2500, quantity: 5 },
    ],
    claims: { items: {}, personSlots: {}, donePeople: {} },
    tips: {},
    currencyCode: 'USD',
    createdAt: 1_700_000_000_000,
    ...over,
  }
}

describe('getClaimedUnitCounts (R3-1)', () => {
  it('counts a multi-quantity row by its quantity, not as one row', () => {
    // Nothing claimed: total units = 1 (Pizza) + 5 (Cokes) = 6
    const { claimedUnits, totalUnits } = getClaimedUnitCounts(makeSession())
    expect(totalUnits).toBe(6)
    expect(claimedUnits).toBe(0)
  })

  it('sums claimed units across claimants', () => {
    const session = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } },              // Pizza fully claimed → 1
          i2: { p1: { qty: 2 }, p2: { qty: 1 } }, // 3 of 5 Cokes claimed → 3
        },
        personSlots: {},
        donePeople: {},
      },
    })
    const { claimedUnits, totalUnits } = getClaimedUnitCounts(session)
    expect(totalUnits).toBe(6)
    expect(claimedUnits).toBe(4)
  })

  it('caps claimed units at the item quantity (no over-count)', () => {
    const session = makeSession({
      claims: {
        items: {
          i2: { p1: { qty: 9 } }, // claims exceed quantity 5 → capped at 5
        },
        personSlots: {},
        donePeople: {},
      },
    })
    expect(getClaimedUnitCounts(session).claimedUnits).toBe(5)
  })

  it('differs from getUnclaimedCounts which counts rows', () => {
    // Both items fully claimed by units
    const session = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } },
          i2: { p1: { qty: 5 } },
        },
        personSlots: {},
        donePeople: {},
      },
    })
    expect(getClaimedUnitCounts(session)).toEqual({ claimedUnits: 6, totalUnits: 6 })
    expect(getUnclaimedCounts(session).unclaimed).toBe(0)
  })
})
