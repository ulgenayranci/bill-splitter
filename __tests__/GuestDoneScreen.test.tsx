import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GuestDoneScreen } from '@/components/split/GuestDoneScreen'
import type { SessionPayload } from '@/lib/sessionSchema'

// Session: 2 people, p1 claimed i1 (1000 cents), tip 18%
// subtotal = 1000, tip = Math.round(1000 * 18 / 100) = 180
// tipBase = floor(180/2) = 90, tipRemainder = 0, so each person gets 90
// p1 total = 1000 + 90 = 1090 -> $10.90
const mockSession: SessionPayload = {
  people: [
    { id: 'p1', name: 'Alice', colorIndex: 0 },
    { id: 'p2', name: 'Bob', colorIndex: 1 },
  ],
  items: [
    { id: 'i1', name: 'Pizza', priceCents: 1000 },
    { id: 'i2', name: 'Coke', priceCents: 250 },
  ],
  tipPercent: 18,
  claims: {
    items: { i1: 'p1' }, // Alice claimed Pizza; Coke is unclaimed
    personSlots: { p1: true, p2: true },
    donePeople: { p1: true },
  },
  createdAt: Date.now(),
}

describe('GuestDoneScreen', () => {
  afterEach(() => {
    cleanup()
  })

  it('Test 1: Renders the correct personal total using computePersonTotals', () => {
    render(<GuestDoneScreen session={mockSession} personId="p1" />)
    // Alice: pizza 1000 + tip 90 = 1090 -> $10.90
    expect(screen.getByText('$10.90')).toBeDefined()
  })

  it('Test 2: Does NOT render any other person name or total (D-11)', () => {
    render(<GuestDoneScreen session={mockSession} personId="p1" />)
    // Bob's name should NOT appear
    expect(screen.queryByText('Bob')).toBeNull()
  })
})
