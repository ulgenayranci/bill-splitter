import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PersonSlotPicker } from '@/components/split/PersonSlotPicker'
import type { SessionPayload } from '@/lib/sessionSchema'

/** Flat mockSession — no hostToken, editRequests, disputes */
const mockSession: SessionPayload = {
  people: [
    { id: 'p1', name: 'Alice', colorIndex: 0 },
    { id: 'p2', name: 'Bob', colorIndex: 1 },
    { id: 'p3', name: 'Carol', colorIndex: 2 },
  ],
  items: [{ id: 'i1', name: 'Pizza', priceCents: 1500, quantity: 1 }],
  claims: {
    items: {},
    personSlots: { p2: true }, // Bob's slot is taken
    donePeople: {},
  },
  tips: {},
  currencyCode: 'USD',
  createdAt: Date.now(),
}

describe('PersonSlotPicker', () => {
  afterEach(() => {
    cleanup()
  })

  it('Test 1: Renders one card per session.people', () => {
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('Carol')).toBeDefined()
  })

  it('Test 2: A person whose slot is taken renders with opacity-50 class and the literal "(taken)" string', () => {
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} />)
    // Bob's card should have "(taken)"
    expect(screen.getByText('(taken)')).toBeDefined()
    // Bob's card should have opacity-50 class somewhere
    const takenText = screen.getByText('(taken)')
    const bobCard = takenText.closest('li')!
    const cardEl = bobCard.querySelector('[class*="opacity-50"]')
    expect(cardEl).not.toBeNull()
  })

  it('Test 3: Tapping an available card calls onSelect(person.id)', () => {
    const onSelect = vi.fn()
    render(<PersonSlotPicker session={mockSession} onSelect={onSelect} />)
    // Alice is not taken, clicking her card should call onSelect
    fireEvent.click(screen.getByLabelText(/Claim slot Alice/i))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('Test 4: Tapping a taken card does NOT call onSelect', () => {
    const onSelect = vi.fn()
    render(<PersonSlotPicker session={mockSession} onSelect={onSelect} />)
    // Bob's slot is taken
    fireEvent.click(screen.getByLabelText(/Bob \(taken\)/i))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Test 5 (D-13): The first person in session.people is not pre-locked when their slot is unclaimed', () => {
    // Default mockSession has only Bob's slot taken; Alice (index 0) is NOT taken
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} />)
    const aliceCard = screen.getByLabelText(/Claim slot Alice/i)
    expect(aliceCard.className).not.toMatch(/opacity-50/)
    expect(aliceCard.getAttribute('aria-disabled')).not.toBe('true')
  })
})
