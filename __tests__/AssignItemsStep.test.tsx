import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Toast } from '@base-ui/react/toast'
import { AssignItemsStep } from '@/components/wizard/AssignItemsStep'
import { useBillStore } from '@/stores/useBillStore'

function renderInProvider(ui: React.ReactElement) {
  return render(<Toast.Provider>{ui}</Toast.Provider>)
}

describe('AssignItemsStep', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    useBillStore.getState().addPerson('Carol')
    useBillStore.getState().addItem('Coke', 250)
    useBillStore.getState().addItem('Pizza', 1500)
    // Mock fetch for ShareLinkButton (not the focus of these tests)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: 'test-id' }) }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('renders one card per item with each item name visible', () => {
    renderInProvider(<AssignItemsStep />)
    expect(screen.getByText('Coke')).toBeDefined()
    expect(screen.getByText('Pizza')).toBeDefined()
  })

  it('renders an avatar chip per person on each item card (3 chips × 2 items = 6 chip elements)', () => {
    renderInProvider(<AssignItemsStep />)
    const chips = screen.getAllByRole('button', { name: /^assign /i })
    // 3 people × 2 items = 6 chips
    expect(chips.length).toBe(6)
  })

  it('each person chip has correct aria-label', () => {
    renderInProvider(<AssignItemsStep />)
    expect(screen.getByLabelText('Assign Coke to Alice')).toBeDefined()
    expect(screen.getByLabelText('Assign Coke to Bob')).toBeDefined()
    expect(screen.getByLabelText('Assign Pizza to Carol')).toBeDefined()
  })

  it('(ITEMS-02) clicking Alice chip on Coke sets assignments[coke.id] to [alice.id]', () => {
    renderInProvider(<AssignItemsStep />)
    const { items, people } = useBillStore.getState()
    const coke = items.find((i) => i.name === 'Coke')!
    const alice = people.find((p) => p.name === 'Alice')!
    fireEvent.click(screen.getByLabelText('Assign Coke to Alice'))
    const assignments = useBillStore.getState().assignments
    expect(assignments[coke.id]).toEqual([alice.id])
  })

  it('(ITEMS-02) clicking Alice then Bob on Coke sets assignments to [alice.id, bob.id] (shared mode)', () => {
    renderInProvider(<AssignItemsStep />)
    const { items, people } = useBillStore.getState()
    const coke = items.find((i) => i.name === 'Coke')!
    const alice = people.find((p) => p.name === 'Alice')!
    const bob = people.find((p) => p.name === 'Bob')!
    fireEvent.click(screen.getByLabelText('Assign Coke to Alice'))
    fireEvent.click(screen.getByLabelText('Assign Coke to Bob'))
    const assignments = useBillStore.getState().assignments
    expect(assignments[coke.id]).toEqual([alice.id, bob.id])
  })

  it('(ITEMS-03) when 2+ people assigned to an item, card renders "Shared" badge', () => {
    renderInProvider(<AssignItemsStep />)
    fireEvent.click(screen.getByLabelText('Assign Coke to Alice'))
    fireEvent.click(screen.getByLabelText('Assign Coke to Bob'))
    expect(screen.getByText('Shared')).toBeDefined()
  })

  it('(ITEMS-03) Pizza ($15) shared between 2 people shows "$7.50" per-person split', () => {
    renderInProvider(<AssignItemsStep />)
    fireEvent.click(screen.getByLabelText('Assign Pizza to Alice'))
    fireEvent.click(screen.getByLabelText('Assign Pizza to Bob'))
    expect(screen.getByText(/\$7\.50/)).toBeDefined()
  })

  it('clicking filled sole-assignee chip deselects → assignments[item.id] becomes []', () => {
    renderInProvider(<AssignItemsStep />)
    const { items } = useBillStore.getState()
    const coke = items.find((i) => i.name === 'Coke')!
    // Assign Alice
    fireEvent.click(screen.getByLabelText('Assign Coke to Alice'))
    expect(useBillStore.getState().assignments[coke.id]).toEqual([expect.any(String)])
    // Deselect Alice
    fireEvent.click(screen.getByLabelText('Assign Coke to Alice'))
    expect(useBillStore.getState().assignments[coke.id]).toEqual([])
  })

  it('removing one person from shared mode leaves the other and removes "Shared" badge', () => {
    renderInProvider(<AssignItemsStep />)
    const { items, people } = useBillStore.getState()
    const coke = items.find((i) => i.name === 'Coke')!
    const alice = people.find((p) => p.name === 'Alice')!
    fireEvent.click(screen.getByLabelText('Assign Coke to Alice'))
    fireEvent.click(screen.getByLabelText('Assign Coke to Bob'))
    // Remove Bob
    fireEvent.click(screen.getByLabelText('Assign Coke to Bob'))
    const assignments = useBillStore.getState().assignments
    expect(assignments[coke.id]).toEqual([alice.id])
    expect(screen.queryByText('Shared')).toBeNull()
  })

  it('"See results" CTA is always enabled (no disabled attribute)', () => {
    renderInProvider(<AssignItemsStep />)
    const cta = screen.getByRole('button', { name: /see results/i })
    expect(cta.hasAttribute('disabled')).toBe(false)
  })

  it('clicking "See results" CTA sets step to 5', () => {
    renderInProvider(<AssignItemsStep />)
    fireEvent.click(screen.getByRole('button', { name: /see results/i }))
    expect(useBillStore.getState().step).toBe(5)
  })

  it('removing a person cleans orphaned PersonIds from assignments', () => {
    const state = useBillStore.getState()
    const { items, people } = state
    const coke = items.find((i) => i.name === 'Coke')!
    const bob = people.find((p) => p.name === 'Bob')!
    // Assign Bob to Coke
    state.setAssignment(coke.id, [bob.id])
    // Remove Bob
    state.removePerson(bob.id)
    const assignments = useBillStore.getState().assignments
    expect((assignments[coke.id] ?? []).includes(bob.id)).toBe(false)
  })
})
