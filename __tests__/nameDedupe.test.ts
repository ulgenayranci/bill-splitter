import { describe, it, expect } from 'vitest'
import { uniqueName, dedupePeopleNames, shuffledEmojis, NAME_EMOJIS } from '@/lib/nameDedupe'

const order = ['🦊', '🐼', '🐸']

describe('uniqueName', () => {
  it('keeps a unique name (trimmed)', () => {
    expect(uniqueName('  Ece ', ['Mert'], order)).toBe('Ece')
  })
  it('adds the first free emoji to a duplicate (case-insensitive)', () => {
    expect(uniqueName('mert', ['Mert'], order)).toBe('mert 🦊')
    expect(uniqueName('Mert', ['Mert', 'Mert 🦊'], order)).toBe('Mert 🐼')
  })
  it('ignores empty seats', () => {
    expect(uniqueName('Mert', ['', '  '], order)).toBe('Mert')
  })
  it('falls back to a number when emojis run out', () => {
    expect(uniqueName('Mert', ['Mert', 'Mert 🦊', 'Mert 🐼', 'Mert 🐸'], order)).toBe('Mert 2')
  })
  it('blank stays blank', () => {
    expect(uniqueName('  ', ['Mert'], order)).toBe('')
  })
})

describe('dedupePeopleNames', () => {
  it('earlier people keep their names; later duplicates get emojis; empty seats untouched', () => {
    const out = dedupePeopleNames(
      [{ name: 'Ayse' }, { name: 'Mert' }, { name: '' }, { name: 'MERT' }, { name: '' }],
      order,
    )
    expect(out.map((p) => p.name)).toEqual(['Ayse', 'Mert', '', 'MERT 🦊', ''])
  })
})

describe('shuffledEmojis', () => {
  it('is a permutation of NAME_EMOJIS', () => {
    expect([...shuffledEmojis()].sort()).toEqual([...NAME_EMOJIS].sort())
  })
})
