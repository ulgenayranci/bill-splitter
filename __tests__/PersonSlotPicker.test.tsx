import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
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

  it('Test 2 (GAP-09-NOLOCK): even when personSlots:{p2:true}, NO "(taken)" text and NO opacity-50/aria-disabled on any card', () => {
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} />)
    // No "(taken)" text anywhere — no greyed-out names under the no-lock model
    expect(screen.queryByText('(taken)')).toBeNull()
    // Bob's card must NOT have opacity-50 or aria-disabled
    const bobCard = screen.getByLabelText(/Claim slot Bob/i).closest('li')!
    expect(bobCard.querySelector('[class*="opacity-50"]')).toBeNull()
    expect(screen.getByLabelText(/Claim slot Bob/i).getAttribute('aria-disabled')).toBeNull()
  })

  it('Test 3: Tapping an available card calls onSelect(person.id)', () => {
    const onSelect = vi.fn()
    render(<PersonSlotPicker session={mockSession} onSelect={onSelect} />)
    // Alice is not taken, clicking her card should call onSelect
    fireEvent.click(screen.getByLabelText(/Claim slot Alice/i))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('Test 4 (GAP-09-NOLOCK): tapping Bob (formerly "taken") DOES call onSelect("p2") — all names always selectable', () => {
    const onSelect = vi.fn()
    render(<PersonSlotPicker session={mockSession} onSelect={onSelect} />)
    // Bob's card is now always selectable — aria-label is "Claim slot Bob" (no "(taken)")
    fireEvent.click(screen.getByLabelText(/Claim slot Bob/i))
    expect(onSelect).toHaveBeenCalledWith('p2')
  })

  it('Test 5 (D-13): The first person in session.people is not pre-locked when their slot is unclaimed', () => {
    // Default mockSession has only Bob's slot taken; Alice (index 0) is NOT taken
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} />)
    const aliceCard = screen.getByLabelText(/Claim slot Alice/i)
    expect(aliceCard.className).not.toMatch(/opacity-50/)
    expect(aliceCard.getAttribute('aria-disabled')).not.toBe('true')
  })

  it('Test 6: "I\'m not listed" link is present', () => {
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} />)
    expect(screen.getByText("I'm not listed")).toBeDefined()
  })

  it('Test 7: Clicking "I\'m not listed" reveals input with placeholder "Your name" and "Add me" button', () => {
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByText("I'm not listed"))
    expect(screen.getByPlaceholderText('Your name')).toBeDefined()
    expect(screen.getByText('Add me')).toBeDefined()
  })

  it('Test 8: Submitting inline add with a name calls onAddPerson with the trimmed name', async () => {
    const onAddPerson = vi.fn().mockResolvedValue(undefined)
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} onAddPerson={onAddPerson} />)
    fireEvent.click(screen.getByText("I'm not listed"))
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '  Dave  ' } })
    fireEvent.click(screen.getByText('Add me'))
    expect(onAddPerson).toHaveBeenCalledWith('Dave')
  })

  it('Test 9: Submitting inline add with empty name does NOT call onAddPerson', () => {
    const onAddPerson = vi.fn()
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} onAddPerson={onAddPerson} />)
    fireEvent.click(screen.getByText("I'm not listed"))
    // Leave input empty, click Add me
    fireEvent.click(screen.getByText('Add me'))
    expect(onAddPerson).not.toHaveBeenCalled()
  })

  // ——— Phase 11 (D-05/07): remove/rename affordances ———

  it('Test 10 (D-05): rename affordance is present when callback is passed', () => {
    const onRenamePerson = vi.fn().mockResolvedValue(undefined)
    render(
      <PersonSlotPicker
        session={mockSession}
        onSelect={vi.fn()}
        onRenamePerson={onRenamePerson}
      />
    )
    // Each person should have a rename button
    expect(screen.getByLabelText('Rename Alice')).toBeDefined()
    expect(screen.getByLabelText('Rename Bob')).toBeDefined()
    // No remove buttons
    expect(screen.queryByLabelText('Remove Alice')).toBeNull()
    expect(screen.queryByLabelText('Remove Bob')).toBeNull()
  })

  it('Test 11 (D-05): rename affordance is absent when callback is NOT passed', () => {
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} />)
    expect(screen.queryByLabelText('Rename Alice')).toBeNull()
    expect(screen.queryByLabelText('Remove Alice')).toBeNull()
  })

  it('Test 12 (D-05): tapping the rename button reveals inline input pre-filled with person name', () => {
    const onRenamePerson = vi.fn().mockResolvedValue(undefined)
    render(
      <PersonSlotPicker
        session={mockSession}
        onSelect={vi.fn()}
        onRenamePerson={onRenamePerson}
      />
    )
    fireEvent.click(screen.getByLabelText('Rename Alice'))
    // Inline rename form should appear with value pre-filled
    const input = screen.getByPlaceholderText('Name') as HTMLInputElement
    expect(input).toBeDefined()
    expect(input.value).toBe('Alice')
    // Save and Cancel buttons should appear
    expect(screen.getByRole('button', { name: /save/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined()
  })

  it('Test 13 (D-05): confirming rename calls onRenamePerson with personId and trimmed new name', async () => {
    const onRenamePerson = vi.fn().mockResolvedValue(undefined)
    render(
      <PersonSlotPicker
        session={mockSession}
        onSelect={vi.fn()}
        onRenamePerson={onRenamePerson}
      />
    )
    fireEvent.click(screen.getByLabelText('Rename Alice'))
    const input = screen.getByPlaceholderText('Name')
    fireEvent.change(input, { target: { value: '  Alicia  ' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(onRenamePerson).toHaveBeenCalledWith('p1', 'Alicia'))
  })

  it('Test 14 (D-05): confirming rename with empty name does NOT call onRenamePerson', () => {
    const onRenamePerson = vi.fn().mockResolvedValue(undefined)
    render(
      <PersonSlotPicker
        session={mockSession}
        onSelect={vi.fn()}
        onRenamePerson={onRenamePerson}
      />
    )
    fireEvent.click(screen.getByLabelText('Rename Alice'))
    const input = screen.getByPlaceholderText('Name')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onRenamePerson).not.toHaveBeenCalled()
  })

  it('Test 16 (D-05): clicking rename does NOT trigger onSelect (stopPropagation)', () => {
    const onSelect = vi.fn()
    const onRenamePerson = vi.fn().mockResolvedValue(undefined)
    render(
      <PersonSlotPicker
        session={mockSession}
        onSelect={onSelect}
        onRenamePerson={onRenamePerson}
      />
    )
    fireEvent.click(screen.getByLabelText('Rename Alice'))
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
