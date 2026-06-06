import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { UnclaimedBanner } from '@/components/split/UnclaimedBanner'
import type { SessionPayload } from '@/lib/sessionSchema'

function makeSession(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    people: [
      { id: 'p1', name: 'Alice', colorIndex: 0 },
      { id: 'p2', name: 'Bob', colorIndex: 1 },
    ],
    items: [
      { id: 'i1', name: 'Pizza', priceCents: 1500, quantity: 1 },
      { id: 'i2', name: 'Salad', priceCents: 1200, quantity: 1 },
      { id: 'i3', name: 'Drinks', priceCents: 2000, quantity: 3 },
    ],
    claims: {
      items: {},
      personSlots: {},
      donePeople: {},
    },
    tips: {},
    currencyCode: 'USD',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('UnclaimedBanner', () => {
  afterEach(() => cleanup())

  it('Test 1: when all items are claimed (unclaimed === 0) the component renders nothing (null)', () => {
    // All 3 items fully claimed
    const session = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } },  // Pizza: 1 of 1 claimed
          i2: { p2: { qty: 1 } },  // Salad: 1 of 1 claimed
          i3: { p1: { qty: 2 }, p2: { qty: 1 } }, // Drinks: 3 of 3 claimed
        },
        personSlots: {},
        donePeople: {},
      },
    })
    const { container } = render(
      <UnclaimedBanner session={session} onTap={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('Test 2: when exactly 1 item is unclaimed, copy is "1 item still unclaimed — tap to find it"', () => {
    // i1 and i3 fully claimed, i2 (Salad, qty=1) unclaimed
    const session = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } },                 // Pizza: fully claimed
          i3: { p1: { qty: 2 }, p2: { qty: 1 } }, // Drinks: fully claimed
        },
        personSlots: {},
        donePeople: {},
      },
    })
    render(<UnclaimedBanner session={session} onTap={vi.fn()} />)
    expect(screen.getByText('1 item still unclaimed — tap to find it')).toBeDefined()
  })

  it('Test 3: when N>1 items are unclaimed of M total, copy is "N of M items still unclaimed — tap to find them"', () => {
    // All 3 items unclaimed (no claims at all)
    const session = makeSession()
    render(<UnclaimedBanner session={session} onTap={vi.fn()} />)
    expect(screen.getByText('3 of 3 items still unclaimed — tap to find them')).toBeDefined()
  })

  it('Test 4: tapping the banner calls onTap', () => {
    const onTap = vi.fn()
    // At least one item unclaimed
    const session = makeSession()
    render(<UnclaimedBanner session={session} onTap={onTap} />)
    const banner = screen.getByText(/still unclaimed/)
    fireEvent.click(banner.closest('[data-testid="unclaimed-banner"]') ?? banner)
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('Test 5: an item with total claimed qty < item.quantity counts as unclaimed; total >= quantity does not', () => {
    // i3 has qty=3; p1 claims 2 → totalClaimed=2 < 3 → unclaimed
    // i1 (qty=1), p1 claims 1 → totalClaimed=1 >= 1 → claimed
    // i2 (qty=1), p2 claims 1 → totalClaimed=1 >= 1 → claimed
    const session = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } }, // fully claimed
          i2: { p2: { qty: 1 } }, // fully claimed
          i3: { p1: { qty: 2 } }, // partial: 2 of 3 → unclaimed
        },
        personSlots: {},
        donePeople: {},
      },
    })
    render(<UnclaimedBanner session={session} onTap={vi.fn()} />)
    // 1 item (i3) still unclaimed
    expect(screen.getByText('1 item still unclaimed — tap to find it')).toBeDefined()
  })

  it('Test 6: when 2 of 3 items are unclaimed, shows "2 of 3"', () => {
    const session = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } }, // fully claimed
          // i2 and i3 unclaimed
        },
        personSlots: {},
        donePeople: {},
      },
    })
    render(<UnclaimedBanner session={session} onTap={vi.fn()} />)
    expect(screen.getByText('2 of 3 items still unclaimed — tap to find them')).toBeDefined()
  })
})
