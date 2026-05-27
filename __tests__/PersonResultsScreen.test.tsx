import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PersonResultsScreen } from '@/components/split/PersonResultsScreen'
import type { SessionPayload } from '@/lib/sessionSchema'

function makeSession(over: Partial<SessionPayload> = {}): SessionPayload {
  return {
    people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
    items: [
      { id: 'i1', name: 'Pizza', priceCents: 1000, quantity: 1 },
      { id: 'i2', name: 'Beer', priceCents: 600, quantity: 2 },
    ],
    claims: {
      items: {
        i1: { p1: { qty: 1, assignedBy: 'self' } },
        i2: { p1: { qty: 1, assignedBy: 'self' }, p2: { qty: 1, assignedBy: 'self' } },
      },
      personSlots: {},
      donePeople: {},
    },
    hostToken: 'host-token-abc',
    hostPersonId: undefined,
    tips: { p1: 250 },
    editRequests: {},
    disputes: {},
    createdAt: Date.now(),
    ...over,
  }
}

describe('PersonResultsScreen', () => {
  afterEach(() => cleanup())

  it("Test 1 (heading + total): renders You're all set! and total in amber-600", () => {
    render(<PersonResultsScreen session={makeSession()} personId="p1" />)
    expect(screen.getByText(/You.?re all set/)).toBeDefined()
    // Pizza $10.00 sole claim + Beer half-share $3.00 + tip $2.50 = $15.50
    expect(screen.getByTestId('results-total').textContent?.trim()).toBe('$15.50')
  })

  it('Test 2 (line items use proportional shares, no tax)', () => {
    render(<PersonResultsScreen session={makeSession()} personId="p1" />)
    const pizzaRow = screen.getByTestId('results-row-i1')
    expect(pizzaRow.textContent).toMatch(/Pizza/)
    expect(pizzaRow.textContent).toMatch(/\$10\.00/)
    const beerRow = screen.getByTestId('results-row-i2')
    expect(beerRow.textContent).toMatch(/Beer/)
    expect(beerRow.textContent).toMatch(/\$3\.00/)
    // No tax row anywhere
    expect(screen.queryByText(/Tax/i)).toBeNull()
  })

  it('Test 3 (tip line displays formatCents(tipCents))', () => {
    render(<PersonResultsScreen session={makeSession()} personId="p1" />)
    expect(screen.getByTestId('results-tip').textContent).toMatch(/\$2\.50/)
  })

  it('Test 4 (total = itemSubtotal + tip)', () => {
    render(<PersonResultsScreen session={makeSession()} personId="p1" />)
    expect(screen.getByTestId('results-total').textContent?.trim()).toBe('$15.50')
  })

  it('Test 5 (zero claims — empty line items but tip + total still render)', () => {
    const session = makeSession({ claims: { items: {}, personSlots: {}, donePeople: {} }, tips: { p1: 0 } })
    render(<PersonResultsScreen session={session} personId="p1" />)
    expect(screen.queryByTestId('results-row-i1')).toBeNull()
    expect(screen.getByTestId('results-tip').textContent).toMatch(/\$0\.00/)
    expect(screen.getByTestId('results-total').textContent?.trim()).toBe('$0.00')
  })
})
