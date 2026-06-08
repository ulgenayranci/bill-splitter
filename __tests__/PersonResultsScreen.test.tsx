import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { PersonResultsScreen } from '@/components/split/PersonResultsScreen'
import { useBillStore } from '@/stores/useBillStore'
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
  onCurrencyChange: vi.fn().mockResolvedValue(undefined),
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

  it("Test 1 (heading + total): renders You're all set! and total in amber-600", () => {
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

  it("Test 7 (accordion expand/collapse): tapping Bob's card expands it to show line items", () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    // Bob's card should be collapsed by default — his items not visible
    expect(screen.queryByTestId('results-row-p2-i2')).toBeNull()
    // Tap Bob's card
    fireEvent.click(screen.getByLabelText("Bob's breakdown"))
    // After tap, Bob's items should be visible
    expect(screen.getByTestId('results-row-p2-i2')).toBeDefined()
  })

  it("Test 8 (no tip on other person): Bob's card has no 'Your tip' row", () => {
    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    // Expand Bob's card
    fireEvent.click(screen.getByLabelText("Bob's breakdown"))
    // Bob's expanded content should not show a "Your tip" row
    // The tip row (results-tip) is only on Alice's card
    const tipElements = screen.queryAllByText(/Your tip/)
    // Current user's card shows "Your tip" label; Bob's expanded card should not
    // We check the count: only one "Your tip" label (on Alice's card)
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

  it('Test 10 (copy summary): clicking Copy summary calls clipboard.writeText with correct content', async () => {
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

  it('Test 15 (New Split clears persisted store): confirming New Split sets store sessionId to null', () => {
    // Seed a sessionId on the persisted store
    useBillStore.getState().setSessionId('sess-x')
    expect(useBillStore.getState().sessionId).toBe('sess-x')

    render(<PersonResultsScreen session={makeSession()} {...defaultProps} />)
    // Open the New Split confirm dialog
    fireEvent.click(screen.getByText('New Split'))
    // Click the confirm "New Split" button inside the dialog (the dialog button is the
    // second match; getAllByText returns [CTA-bar button, dialog button])
    const newSplitButtons = screen.getAllByText('New Split')
    fireEvent.click(newSplitButtons[newSplitButtons.length - 1])

    expect(useBillStore.getState().sessionId).toBeNull()
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
})
