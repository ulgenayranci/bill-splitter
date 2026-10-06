import { describe, it, expect } from 'vitest'
import { normalizeSession } from '@/lib/normalizeSession'

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o as object).forEach(deepFreeze)
    Object.freeze(o)
  }
  return o
}

const good = () => ({
  people: [{ id: 'p1', name: 'A', colorIndex: 0 }],
  items: [{ id: 'i1', name: 'X', priceCents: 100, quantity: 1 }],
  claims: { items: { i1: { p1: { qty: 1 } } }, personSlots: { p1: true }, donePeople: {} },
  tips: { p1: 5 },
  createdAt: 1,
  currencyCode: 'EUR',
})

describe('normalizeSession', () => {
  it.each([null, undefined, 'str', 42, []])('returns null for %j', (v) => {
    expect(normalizeSession(v)).toBeNull()
  })

  it('coerces [] map fields to {}', () => {
    const out = normalizeSession({ ...good(), tips: [], claims: { items: [], personSlots: [], donePeople: [] } })!
    expect(out.tips).toEqual({})
    expect(out.claims).toEqual({ items: {}, personSlots: {}, donePeople: {} })
    expect(Array.isArray(out.tips)).toBe(false)
    expect(Array.isArray(out.claims.items)).toBe(false)
    expect(Array.isArray(out.claims.personSlots)).toBe(false)
    expect(Array.isArray(out.claims.donePeople)).toBe(false)
  })

  it('coerces {} people/items to []', () => {
    const out = normalizeSession({ ...good(), people: {}, items: {} })!
    expect(out.people).toEqual([])
    expect(out.items).toEqual([])
  })

  it('fills missing claims and tips', () => {
    const { claims: _c, tips: _t, ...rest } = good()
    const out = normalizeSession(rest)!
    expect(out.claims).toEqual({ items: {}, personSlots: {}, donePeople: {} })
    expect(out.tips).toEqual({})
  })

  it('coerces per-item [] claim map to {}', () => {
    const g = good()
    const out = normalizeSession({ ...g, claims: { ...g.claims, items: { i1: [] } } })!
    expect(out.claims.items.i1).toEqual({})
    expect(Array.isArray(out.claims.items.i1)).toBe(false)
  })

  it('defaults currencyCode to USD when missing or non-string, keeps EUR', () => {
    const { currencyCode: _cc, ...rest } = good()
    expect(normalizeSession(rest)!.currencyCode).toBe('USD')
    expect(normalizeSession({ ...good(), currencyCode: 5 })!.currencyCode).toBe('USD')
    expect(normalizeSession(good())!.currencyCode).toBe('EUR')
  })

  it('leaves a correct session deep-equal and preserves legacy keys', () => {
    const g = good()
    expect(normalizeSession(g)).toEqual(g)
    const withLegacy = { ...good(), hostToken: 'secret' }
    expect(normalizeSession(withLegacy)).toEqual(withLegacy)
    const out = normalizeSession(good()) as unknown as Record<string, unknown>
    expect('serviceFeeCents' in out).toBe(false)
    expect('taxCents' in out).toBe(false)
    expect('guestNumber' in (out.people as object[])[0]).toBe(false)
  })

  it('does not mutate input and is idempotent', () => {
    const input = deepFreeze({ ...good(), tips: [], claims: { items: [], personSlots: [], donePeople: [] } })
    const once = normalizeSession(input)
    expect(normalizeSession(once)).toEqual(once)
  })
})
