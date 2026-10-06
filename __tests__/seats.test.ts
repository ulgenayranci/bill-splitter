import { describe, it, expect } from 'vitest'
import {
  isEmptySeat,
  seatLabel,
  seatInitial,
  nextGuestNumber,
  isValidGuestNumber,
  MAX_GUEST_NUMBER,
} from '@/lib/seats'
import { MAX_PEOPLE, MIN_PEOPLE } from '@/lib/sessionSchema'
import type { Person } from '@/stores/useBillStore'

const p = (id: string, name: string, guestNumber?: number): Person => ({
  id,
  name,
  colorIndex: 0,
  ...(guestNumber !== undefined ? { guestNumber } : {}),
})

describe('isEmptySeat', () => {
  it('true for empty and whitespace names', () => {
    expect(isEmptySeat({ name: '' })).toBe(true)
    expect(isEmptySeat({ name: '   ' })).toBe(true)
  })
  it('false for named', () => {
    expect(isEmptySeat({ name: 'Ana' })).toBe(false)
  })
  it('treats non-string name as empty', () => {
    expect(isEmptySeat({ name: undefined as unknown as string })).toBe(true)
  })
})

describe('seatLabel', () => {
  it('uses stored guestNumber for empty seat', () => {
    expect(seatLabel(p('s', '', 3))).toBe('Guest 3')
  })
  it('returns name for named person even with guestNumber', () => {
    expect(seatLabel(p('a', 'Ana', 2))).toBe('Ana')
  })
  it('falls back to ordinal among empty seats', () => {
    const list = [p('n', 'Nia'), p('a', ''), p('b', '')]
    expect(seatLabel(list[1], list)).toBe('Guest 1')
    expect(seatLabel(list[2], list)).toBe('Guest 2')
  })
  it('returns Guest with no number and no list', () => {
    expect(seatLabel(p('a', ''))).toBe('Guest')
  })
  it('never blank, ignores invalid guestNumber', () => {
    for (const gn of [0, -1, 1.5, NaN]) {
      expect(seatLabel(p('a', '', gn))).toBe('Guest')
    }
  })
})

describe('seatInitial', () => {
  it('uppercases first letter', () => {
    expect(seatInitial({ name: 'ana' })).toBe('A')
    expect(seatInitial({ name: '  émile' })).toBe('É')
  })
  it('keeps whole emoji code point', () => {
    expect(seatInitial({ name: '😀 Bob' })).toBe('😀')
  })
  it('? for empty', () => {
    expect(seatInitial({ name: '' })).toBe('?')
  })
})

describe('nextGuestNumber', () => {
  it('1 for empty list', () => {
    expect(nextGuestNumber([])).toBe(1)
  })
  it('max + 1', () => {
    expect(nextGuestNumber([p('n', 'N'), p('a', '', 1), p('b', '', 4)])).toBe(5)
  })
  it('named with guestNumber counts', () => {
    expect(nextGuestNumber([p('n', 'N', 7), p('a', '', 2)])).toBe(8)
  })
  it('ignores invalid values', () => {
    expect(nextGuestNumber([p('a', '', 0), p('b', '', 1.5)])).toBe(1)
  })
})

describe('isValidGuestNumber', () => {
  it('accepts bounds', () => {
    expect(isValidGuestNumber(1)).toBe(true)
    expect(isValidGuestNumber(MAX_GUEST_NUMBER)).toBe(true)
    expect(MAX_GUEST_NUMBER).toBe(999)
  })
  it('rejects invalid', () => {
    for (const v of [0, -1, 1.5, '3', null, undefined, 1000]) {
      expect(isValidGuestNumber(v)).toBe(false)
    }
  })
})

describe('people bounds', () => {
  it('exports 20 and 2', () => {
    expect(MAX_PEOPLE).toBe(20)
    expect(MIN_PEOPLE).toBe(2)
  })
})
