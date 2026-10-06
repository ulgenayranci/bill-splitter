import { describe, it, expect } from 'vitest'
import {
  isEmptySeat,
  seatLabel,
  seatInitial,
  nextGuestNumber,
  isValidGuestNumber,
  MAX_GUEST_NUMBER,
  buildSeatPeople,
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
  it('ignores invalid stored values but counts those seats as fallback-numbered (Guest 1, Guest 2)', () => {
    expect(nextGuestNumber([p('a', '', 0), p('b', '', 1.5)])).toBe(3)
  })
  it('accounts for unnumbered empty seats so a new seat never duplicates a label (WR-03)', () => {
    expect(nextGuestNumber([p('n', 'N'), p('a', ''), p('b', '')])).toBe(3)
    expect(nextGuestNumber([p('x', 'X')])).toBe(1)
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

describe('WR-03: labels stay unique when stored and unnumbered seats mix', () => {
  const labels = (list: Person[]) => list.filter(isEmptySeat).map((x) => seatLabel(x, list))
  it('unnumbered seat skips a number already stored on another seat', () => {
    expect(labels([p('a', '', 2), p('b', '')])).toEqual(['Guest 2', 'Guest 1'])
  })
  it('skips numbers stored on any person, including a seat later claimed', () => {
    expect(labels([p('n', 'Ana', 1), p('b', ''), p('c', '')])).toEqual(['Guest 2', 'Guest 3'])
  })
  it('a seat added with nextGuestNumber never duplicates an existing label', () => {
    const list = [p('n', 'N'), p('a', ''), p('b', '', 1)]
    const added = p('new', '', nextGuestNumber(list))
    const all = labels([...list, added])
    expect(new Set(all).size).toBe(all.length)
  })
  it('v2.0-style seats with no guestNumber still read Guest 1, Guest 2 in order', () => {
    expect(labels([p('n', 'N'), p('a', ''), p('b', '')])).toEqual(['Guest 1', 'Guest 2'])
  })
})

describe('WR-05: seatInitial is locale-independent and one character', () => {
  it('upper-cases i to I regardless of the device locale', () => {
    expect(seatInitial({ name: 'irem' })).toBe('I')
  })
  it('keeps a single character when upper case expands (ß -> S)', () => {
    expect(seatInitial({ name: 'ßeta' })).toBe('S')
  })
})

describe('buildSeatPeople', () => {
  let n = 0
  const makeId = () => `id${++n}`
  it('scanner first (trimmed name), then headcount-1 empty Guest seats numbered 1..', () => {
    const people = buildSeatPeople('  Ayse ', 4, makeId)
    expect(people.map((x) => x.name)).toEqual(['Ayse', '', '', ''])
    expect(people.map((x) => x.guestNumber)).toEqual([undefined, 1, 2, 3])
    expect(people.slice(1).map((x) => seatLabel(x, people))).toEqual(['Guest 1', 'Guest 2', 'Guest 3'])
    expect(new Set(people.map((x) => x.id)).size).toBe(4)
  })
  it('headcount 2 gives the scanner plus one guest', () => {
    expect(buildSeatPeople('A', 2, makeId)).toHaveLength(2)
  })
})
