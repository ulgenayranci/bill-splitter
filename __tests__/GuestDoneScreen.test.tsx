import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { GuestDoneScreen } from '@/components/split/GuestDoneScreen'
import type { SessionPayload } from '@/lib/sessionSchema'

// Session: 2 people, p1 claimed i1 (1000 cents), Coke (250 cents) unclaimed, tip 18%
// computePersonTotals uses ALL items for subtotal (not just claimed):
// subtotal = 1000 + 250 = 1250, tip = round(1250 * 18 / 100) = 225
// tipBase = floor(225/2) = 112, tipRemainder = 1
// p1 (index 0): 1000 (pizza) + 112 + 1 (tip, gets remainder) = 1113 -> $11.13
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
    // Alice: pizza 1000 + tip 113 (gets remainder) = 1113 -> $11.13
    // Total appears twice: in the header amount and in the Total line at bottom
    const totals = screen.getAllByText('$11.13')
    expect(totals.length).toBeGreaterThan(0)
  })

  it('Test 2: Does NOT render any other person name or total (D-11)', () => {
    render(<GuestDoneScreen session={mockSession} personId="p1" />)
    // Bob's name should NOT appear
    expect(screen.queryByText('Bob')).toBeNull()
  })
})
