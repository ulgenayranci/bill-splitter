import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { PersonResultsScreen } from '@/components/split/PersonResultsScreen'
import type { SessionPayload } from '@/lib/sessionSchema'

// Mock next/navigation so useRouter() doesn't throw in jsdom
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
}))

function makeSession(over: Partial<SessionPayload> = {}): SessionPayload {
  return {
    people: [
      { id: 'p1', name: 'Alice', colorIndex: 0 },
      { id: 'p2', name: 'Bob', colorIndex: 1 },
    ],
    items: [
      { id: 'i1', name: 'Pizza', priceCents: 1000, quantity: 1 },
      { id: 'i2', name: 'Beer', priceCents: 600, quantity: 2 },
    ],
    claims: {
      items: {
        i1: { p1: { qty: 1 } },
        i2: { p1: { qty: 1 }, p2: { qty: 1 } },
      },
      personSlots: {},
      donePeople: {},
    },
    tips: { p1: 250 },
    currencyCode: 'USD',
    createdAt: Date.now(),
    ...over,
  }
}

const defaultProps = {
  personId: 'p1' as const,
  currencyCode: 'USD',
  onAddTip: vi.fn(),
  onEditBill: vi.fn(),
  sessionId: 'sess-123',
}

describe('PersonResultsScreen', () => {
  beforeEach(() => {
    mockPush.mockReset()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })
  afterEach(() => cleanup())

  // ── Legacy tests (Test 1-5) – updated to new props interface ──────────────

  it("Test 1 (heading + total): renders You're all set! when fully claimed and total in amber-600", () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.getByText(/You.?re all set/)).toBeDefined()
    // Pizza $10.00 sole claim + Beer half-share $3.00 + tip $2.50 = $15.50
    expect(screen.getByTestId('results-total').textContent?.trim()).toBe('$15.50')
  })

  it('Test 2 (line items use proportional shares, no tax)', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
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
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.getByTestId('results-tip').textContent).toMatch(/\$2\.50/)
  })

  it('Test 4 (total = itemSubtotal + tip)', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.getByTestId('results-total').textContent?.trim()).toBe('$15.50')
  })

  it('Test 5 (zero claims — empty line items but tip + total still render)', () => {
    const session = makeSession({ claims: { items: {}, personSlots: {}, donePeople: {} }, tips: { p1: 0 } })
    render(<PersonResultsScreen session={session} {...defaultProps} />)
    expect(screen.queryByTestId('results-row-i1')).toBeNull()
    expect(screen.getByTestId('results-tip').textContent).toMatch(/\$0\.00/)
    expect(screen.getByTestId('results-total').textContent?.trim()).toBe('$0.00')
  })

  // ── New accordion tests (Test 6+) ─────────────────────────────────────────

  it('Test 6 (accordion): renders both Alice and Bob names', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
  })

  it("Test 7 (accordion expand/collapse): current user expanded, others collapsed by default; tapping Bob's card expands it", () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    // R3-2: current user (Alice/p1) expanded by default — her items are visible…
    expect(screen.getByTestId('results-row-i1')).toBeDefined()
    // …but Bob's card starts collapsed
    expect(screen.queryByTestId('results-row-p2-i2')).toBeNull()
    // Tap Bob's card to expand it
    fireEvent.click(screen.getByLabelText("Bob's breakdown"))
    expect(screen.getByTestId('results-row-p2-i2')).toBeDefined()
  })

  it("Test 8 (no tip on other person): Bob's card has no 'Your tip' row", () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    // Expand Bob's card
    fireEvent.click(screen.getByLabelText("Bob's breakdown"))
    // Bob's expanded content should not show a "Your tip" row
    // The tip row (results-tip) is only on Alice's card
    const aliceTipRow = screen.getByTestId('results-tip')
    expect(aliceTipRow).toBeDefined()
    // No "Bob's tip" element
    expect(screen.queryByTestId('results-tip-p2')).toBeNull()
  })

  it('Test 9 (grand total): grand total row equals sum of all item prices (items only, no tips)', () => {
    // Session: Pizza $10 + Beer $6 = $16 total; Alice tip $2.50 should NOT be in grand total
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    const grandTotal = screen.getByTestId('results-grand-total')
    // computeSubtotalCents = 1000 + 600 = 1600 → $16.00
    expect(grandTotal.textContent).toMatch(/\$16\.00/)
  })

  it('Test 10 (share summary): clicking Share summary calls clipboard.writeText with correct content', async () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    const copyBtn = screen.getByLabelText('Copy summary to clipboard')
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })
    const callArg = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(callArg).toContain('Alice owes')
    expect(callArg).toContain('Bob owes')
    expect(callArg).toContain('Total:')
  })

  it('Test 11 (copy feedback): button shows Copied! after copy', async () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    const copyBtn = screen.getByLabelText('Copy summary to clipboard')
    fireEvent.click(copyBtn)
    await waitFor(() => {
      expect(screen.getByLabelText('Summary copied')).toBeDefined()
    })
  })

  it('Test 12 (edit bill): clicking Edit bill calls onEditBill', () => {
    const onEditBill = vi.fn()
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} onEditBill={onEditBill} />)
    fireEvent.click(screen.getByText('Edit bill'))
    expect(onEditBill).toHaveBeenCalledTimes(1)
  })

  it('Test 14 (subtotal + in-card total): current-user card shows items-only Subtotal and items+tip Total', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    // itemSubtotal = Pizza $10.00 + Beer half-share $3.00 = $13.00 (items only, no tip)
    const subtotal = screen.getByTestId('results-subtotal')
    expect(subtotal.textContent).toMatch(/Subtotal/)
    expect(subtotal.textContent).toMatch(/\$13\.00/)
    // in-card Total = itemSubtotal $13.00 + tip $2.50 = $15.50
    const cardTotal = screen.getByTestId('results-card-total')
    expect(cardTotal.textContent).toMatch(/Total/)
    expect(cardTotal.textContent).toMatch(/\$15\.50/)
    // tip row preserved
    expect(screen.getByTestId('results-tip').textContent).toMatch(/\$2\.50/)
  })

  it('Test 13 (currency): amounts use the passed currencyCode (EUR shows €)', () => {
    render(
      <PersonResultsScreen
        session={makeSession({ currencyCode: 'EUR' })}
        {...defaultProps}
        currencyCode="EUR"
      />
    )
    // The grand total should show EUR symbol
    const grandTotal = screen.getByTestId('results-grand-total')
    expect(grandTotal.textContent).toMatch(/€/)
  })

  // ── New tests for D-03, D-04, D-08, D-09 ─────────────────────────────────

  it('D-03 (unclaimed section): shows "Unclaimed items" and item name when partially claimed', () => {
    // i2 Beer has quantity 2 but only 1 claimed by p1 — still 1 unclaimed
    const unclaimedSession = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } },         // i1 Pizza fully claimed (qty: 1)
          i2: { p1: { qty: 1 } },           // i2 Beer partially claimed (qty:1 of 2)
        },
        personSlots: {},
        donePeople: {},
      },
    })
    render(<PersonResultsScreen session={unclaimedSession} {...defaultProps} />)
    expect(screen.getByText('Unclaimed items')).toBeDefined()
    // Beer appears in the unclaimed section (may also appear in claimed items list — getAllByText is fine)
    const beerElements = screen.getAllByText('Beer')
    // At least one element should be in the unclaimed section (amber-700 li)
    const unclaimedBeerLi = beerElements.find((el) => el.className.includes('amber-700'))
    expect(unclaimedBeerLi).toBeDefined()
  })

  it('D-03 (unclaimed section): does NOT render when all items fully claimed', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.queryByText('Unclaimed items')).toBeNull()
  })

  it('D-04 (headline): shows playful "up for grabs" message when items are unclaimed', () => {
    const unclaimedSession = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } },
          i2: { p1: { qty: 1 } },  // Beer qty:2, only 1 claimed
        },
        personSlots: {},
        donePeople: {},
      },
    })
    render(<PersonResultsScreen session={unclaimedSession} {...defaultProps} />)
    expect(screen.getByText(/up for grabs/i)).toBeDefined()
    expect(screen.queryByText(/You.?re all set/i)).toBeNull()
  })

  it("D-04 (headline): shows \"You're all set!\" when bill is fully claimed", () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.getByText(/You.?re all set/i)).toBeDefined()
    expect(screen.queryByText(/up for grabs/i)).toBeNull()
  })

  // G3: "Add a tip?" is now inline clickable text (not a bordered Button)
  it('G3 (tip text link): "Add a tip?" is clickable text inside the current user\'s card, not a button element', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    // The text exists
    const tipText = screen.getByText('Add a tip?')
    expect(tipText).toBeDefined()
    // It renders as a span with role="button", NOT a <button> element with button chrome
    expect(tipText.tagName.toLowerCase()).toBe('span')
  })

  it('G3 (tip text link): clicking "Add a tip?" calls onAddTip', () => {
    const onAddTip = vi.fn()
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} onAddTip={onAddTip} />)
    fireEvent.click(screen.getByText('Add a tip?'))
    expect(onAddTip).toHaveBeenCalledTimes(1)
  })

  // G2+G4: New sticky bar — Share summary + Edit bill; no New Split / Copy summary
  it('G2+G4 (sticky bar): shows "Share summary" button', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.getByLabelText('Copy summary to clipboard')).toBeDefined()
    // "Share summary" label in the button text
    expect(screen.getByText('Share summary')).toBeDefined()
  })

  it('G2+G4 (sticky bar): "Edit bill" button exists', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.getByText('Edit bill')).toBeDefined()
  })

  it('G2+G4 (sticky bar): "New Split" and "Copy summary" are removed', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.queryByText('New Split')).toBeNull()
    expect(screen.queryByText('Copy summary')).toBeNull()
  })

  // G1: current user card is rendered first
  it('G1 (order): current user card is first in the accordion', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    // Alice (p1) is the current user — her card should appear before Bob's
    const breakdowns = screen.getAllByRole('button', { name: /breakdown/ })
    expect(breakdowns[0].getAttribute('aria-label')).toBe("Alice's breakdown")
    expect(breakdowns[1].getAttribute('aria-label')).toBe("Bob's breakdown")
  })

  // R3-5: unclaimed box always lists every unclaimed item (no count-collapse)
  it('R3-5 (unclaimed list): lists item names when ≤2 unclaimed', () => {
    // 1 unclaimed item (Beer is partially claimed: qty:2, only 1 claimed)
    const session = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } },
          i2: { p1: { qty: 1 } },
        },
        personSlots: {},
        donePeople: {},
      },
    })
    render(<PersonResultsScreen session={session} {...defaultProps} />)
    // Beer should appear as a list item in the unclaimed section
    const allBeer = screen.getAllByText('Beer')
    const liInUnclaimed = allBeer.find((el) => el.tagName.toLowerCase() === 'li')
    expect(liInUnclaimed).toBeDefined()
  })

  it('R3-5 (unclaimed list): lists every unclaimed item when >2 (no count-collapse)', () => {
    // Session with 3 unclaimed items
    const session: SessionPayload = {
      people: [
        { id: 'p1', name: 'Alice', colorIndex: 0 },
      ],
      items: [
        { id: 'i1', name: 'Pizza', priceCents: 1000, quantity: 1 },
        { id: 'i2', name: 'Beer', priceCents: 600, quantity: 1 },
        { id: 'i3', name: 'Wings', priceCents: 800, quantity: 1 },
      ],
      claims: { items: {}, personSlots: {}, donePeople: {} },
      tips: {},
      currencyCode: 'USD',
      createdAt: Date.now(),
    }
    render(<PersonResultsScreen session={session} {...defaultProps} />)
    // No count-collapse copy
    expect(screen.queryByText('3 items need an owner')).toBeNull()
    // All three names listed as amber-700 <li> elements in the unclaimed section
    for (const name of ['Pizza', 'Beer', 'Wings']) {
      const li = screen.getAllByText(name).find(
        (el) => el.tagName.toLowerCase() === 'li' && el.className.includes('amber-700')
      )
      expect(li).toBeDefined()
    }
  })

  // G5: unclaimed section tappable → dialog → onEditBill
  it('G5 (unclaimed tappable): tapping unclaimed section opens confirmation dialog', () => {
    const unclaimedSession = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } },
          i2: { p1: { qty: 1 } },
        },
        personSlots: {},
        donePeople: {},
      },
    })
    render(<PersonResultsScreen session={unclaimedSession} {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /view unclaimed items/i }))
    expect(screen.getByText('Add owners for unclaimed items?')).toBeDefined()
  })

  it('G5 (unclaimed confirm): confirming calls onEditBill', () => {
    const onEditBill = vi.fn()
    const unclaimedSession = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1 } },
          i2: { p1: { qty: 1 } },
        },
        personSlots: {},
        donePeople: {},
      },
    })
    render(<PersonResultsScreen session={unclaimedSession} {...defaultProps} onEditBill={onEditBill} />)
    fireEvent.click(screen.getByRole('button', { name: /view unclaimed items/i }))
    // The dialog should show; click the "Edit bill" confirm button inside the dialog
    const editBillButtons = screen.getAllByText('Edit bill')
    // The one inside the dialog footer
    fireEvent.click(editBillButtons[editBillButtons.length - 1])
    expect(onEditBill).toHaveBeenCalled()
  })

  it('D-09 (no currency select): currency combobox/select is absent from the Results screen', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByLabelText('currency-select')).toBeNull()
  })

  // ── R3-4: swipe-to-mark-paid ──────────────────────────────────────────────

  it('R3-4 (swipe paid): no paid chip by default', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    expect(screen.queryByTestId('paid-chip-p2')).toBeNull()
  })

  it('R3-4 (swipe paid): swiping a card right marks it paid (chip + toast)', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    const card = screen.getByLabelText("Bob's breakdown").closest('div.relative') as HTMLElement
    fireEvent.touchStart(card, { touches: [{ clientX: 20, clientY: 100 }] })
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 140, clientY: 105 }] })
    expect(screen.getByTestId('paid-chip-p2')).toBeDefined()
    expect(screen.getByTestId('paid-toast').textContent).toMatch(/I have paid/)
  })

  it('R3-4 (swipe paid): swiping left reverses a paid card', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    const card = screen.getByLabelText("Bob's breakdown").closest('div.relative') as HTMLElement
    // Right → paid
    fireEvent.touchStart(card, { touches: [{ clientX: 20, clientY: 100 }] })
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 140, clientY: 100 }] })
    expect(screen.getByTestId('paid-chip-p2')).toBeDefined()
    // Left → unpaid
    fireEvent.touchStart(card, { touches: [{ clientX: 140, clientY: 100 }] })
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 20, clientY: 100 }] })
    expect(screen.queryByTestId('paid-chip-p2')).toBeNull()
  })

  it('R3-4 (swipe paid): a horizontal swipe does not toggle the accordion', () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    // Bob starts collapsed; a swipe should NOT expand him (only mark paid)
    const card = screen.getByLabelText("Bob's breakdown").closest('div.relative') as HTMLElement
    fireEvent.touchStart(card, { touches: [{ clientX: 20, clientY: 100 }] })
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 140, clientY: 100 }] })
    fireEvent.click(screen.getByLabelText("Bob's breakdown"))
    // Still collapsed (swipe-suppressed the click)
    expect(screen.queryByTestId('results-row-p2-i2')).toBeNull()
  })
})
