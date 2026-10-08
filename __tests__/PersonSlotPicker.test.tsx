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

  it('Test 6: "Add person" link is present (was "I\'m not listed")', () => {
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} />)
    expect(screen.getByText('Add person')).toBeDefined()
    expect(screen.queryByText("I'm not listed")).toBeNull()
  })

  it('Test 7: Clicking "Add person" reveals a "Name" input and an "Add" button', () => {
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByText('Add person'))
    expect(screen.getByPlaceholderText('Name')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDefined()
  })

  it('Test 8: Submitting inline add with a name calls onAddPerson with the trimmed name', async () => {
    const onAddPerson = vi.fn().mockResolvedValue(undefined)
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} onAddPerson={onAddPerson} />)
    fireEvent.click(screen.getByText('Add person'))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: '  Dave  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAddPerson).toHaveBeenCalledWith('Dave')
  })

  it('Test 9: Submitting inline add with empty name does NOT call onAddPerson', () => {
    const onAddPerson = vi.fn()
    render(<PersonSlotPicker session={mockSession} onSelect={vi.fn()} onAddPerson={onAddPerson} />)
    fireEvent.click(screen.getByText('Add person'))
    // Leave input empty, click Add
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
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
    expect(screen.getByRole('alert').textContent).toBe('Enter a name')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('Test 14b: a failed rename keeps the form open and shows an error', async () => {
    const onRenamePerson = vi.fn().mockRejectedValue(new Error('rename_failed'))
    render(
      <PersonSlotPicker
        session={mockSession}
        onSelect={vi.fn()}
        onRenamePerson={onRenamePerson}
      />
    )
    fireEvent.click(screen.getByLabelText('Rename Alice'))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Alicia' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe("Couldn't save. Try again"))
    expect(screen.getByPlaceholderText('Name')).toBeDefined()
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

describe('PersonSlotPicker — v2.1 empty "Guest N" seats', () => {
  afterEach(() => {
    cleanup()
  })

  const seatSession: SessionPayload = {
    ...mockSession,
    people: [
      { id: 'g1', name: '', colorIndex: 1, guestNumber: 1 },
      { id: 'h', name: 'Ayse', colorIndex: 0 },
      { id: 'g2', name: '', colorIndex: 2, guestNumber: 2 },
    ],
  }

  it('shows empty seats as "Guest N" (never blank), after named people, without a rename pencil', () => {
    render(<PersonSlotPicker session={seatSession} onSelect={vi.fn()} onRenamePerson={vi.fn()} />)
    const seats = screen.getAllByTestId('empty-seat')
    expect(seats.map((s) => s.textContent)).toEqual([
      expect.stringContaining('Guest 1'),
      expect.stringContaining('Guest 2'),
    ])
    expect(screen.getByRole('button', { name: 'Claim slot Ayse' })).toBeDefined()
    expect(screen.queryByRole('button', { name: /rename guest/i })).toBeNull()
    expect(screen.getAllByRole('button', { name: /rename/i })).toHaveLength(1)
  })

  it('tapping an empty seat asks for a name and claims it', async () => {
    const onClaimSeat = vi.fn().mockResolvedValue('ok')
    const onSelect = vi.fn()
    render(<PersonSlotPicker session={seatSession} onSelect={onSelect} onClaimSeat={onClaimSeat} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take seat Guest 2' }))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: '  Deniz ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onClaimSeat).toHaveBeenCalledWith('g2', 'Deniz'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('requires a name before claiming', () => {
    const onClaimSeat = vi.fn()
    render(<PersonSlotPicker session={seatSession} onSelect={vi.fn()} onClaimSeat={onClaimSeat} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take seat Guest 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert').textContent).toBe('Enter your name')
    expect(onClaimSeat).not.toHaveBeenCalled()
  })

  it('shows "Someone just took that seat" when another phone claimed it first', async () => {
    const onClaimSeat = vi.fn().mockResolvedValue('taken')
    render(<PersonSlotPicker session={seatSession} onSelect={vi.fn()} onClaimSeat={onClaimSeat} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take seat Guest 1' }))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Mert' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByTestId('seat-notice').textContent).toMatch(/someone just took that seat/i))
  })

  it('if another phone claims the seat while you type, the form closes with a notice', () => {
    const { rerender } = render(<PersonSlotPicker session={seatSession} onSelect={vi.fn()} onClaimSeat={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take seat Guest 1' }))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Deniz' } })
    const taken = { ...seatSession, people: seatSession.people.map((p) => (p.id === 'g1' ? { ...p, name: 'Mert' } : p)) }
    rerender(<PersonSlotPicker session={taken} onSelect={vi.fn()} onClaimSeat={vi.fn()} />)
    expect(screen.queryByLabelText('Your name')).toBeNull()
    expect(screen.getByTestId('seat-notice').textContent).toMatch(/someone just took that seat/i)
    expect(screen.getByRole('button', { name: 'Claim slot Mert' })).toBeDefined()
  })
})

describe('PersonSlotPicker — v2.1 remove a card', () => {
  afterEach(() => {
    cleanup()
  })

  const s3: SessionPayload = {
    ...mockSession,
    people: [
      { id: 'h', name: 'Ayse', colorIndex: 0 },
      { id: 'm', name: 'Mert', colorIndex: 1 },
      { id: 'g2', name: '', colorIndex: 2, guestNumber: 2 },
    ],
    claims: { items: { i1: { m: { qty: 1 } } }, personSlots: {}, donePeople: {} },
  }

  it('shows ✕ only on cards nobody picked items for', () => {
    render(<PersonSlotPicker session={s3} onSelect={vi.fn()} onRemovePerson={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Remove Ayse' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Remove Guest 2' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Remove Mert' })).toBeNull()
  })

  it('no ✕ at all when only 2 people are left', () => {
    const two = { ...s3, people: s3.people.slice(0, 2) }
    render(<PersonSlotPicker session={two} onSelect={vi.fn()} onRemovePerson={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^remove /i })).toBeNull()
  })

  it('✕ asks to confirm, then removes; tapping ✕ does not select the person', async () => {
    const onRemovePerson = vi.fn().mockResolvedValue('ok')
    const onSelect = vi.fn()
    render(<PersonSlotPicker session={s3} onSelect={onSelect} onRemovePerson={onRemovePerson} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ayse' }))
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByText('Remove Ayse?')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(onRemovePerson).toHaveBeenCalledWith('h'))
  })

  it('Cancel keeps the card', () => {
    const onRemovePerson = vi.fn()
    render(<PersonSlotPicker session={s3} onSelect={vi.fn()} onRemovePerson={onRemovePerson} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Guest 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onRemovePerson).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Take seat Guest 2' })).toBeDefined()
  })

  it('explains when someone picked items for that card meanwhile', async () => {
    const onRemovePerson = vi.fn().mockResolvedValue('has_items')
    render(<PersonSlotPicker session={s3} onSelect={vi.fn()} onRemovePerson={onRemovePerson} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ayse' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.getByTestId('remove-notice').textContent).toMatch(/picked items for Ayse/))
  })
})
