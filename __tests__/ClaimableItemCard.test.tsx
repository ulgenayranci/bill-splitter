import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ClaimableItemCard } from '@/components/split/ClaimableItemCard'
import type { Item, Person, PersonId } from '@/stores/useBillStore'
import type { ClaimEntry } from '@/lib/sessionSchema'

const singleQtyItem: Item = { id: 'i1', name: 'Pizza', priceCents: 1500, quantity: 1 }
const multiQtyItem: Item = { id: 'i2', name: 'Pitcher', priceCents: 2400, quantity: 4 }
const p1: Person = { id: 'p1', name: 'Alice', colorIndex: 0 }
const p2: Person = { id: 'p2', name: 'Bob', colorIndex: 1 }
const p3: Person = { id: 'p3', name: 'Carol', colorIndex: 2 }
const p4: Person = { id: 'p4', name: 'Dave', colorIndex: 3 }
const peopleById: Record<PersonId, Person> = { p1, p2, p3, p4 }

describe('ClaimableItemCard — Phase 6', () => {
  afterEach(() => cleanup())

  it('Test 1 (qty=1, unclaimed): renders name + price; tap calls onQtyChange(1)', () => {
    const onQtyChange = vi.fn()
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={{}}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
      />
    )
    expect(screen.getByText('Pizza')).toBeDefined()
    expect(screen.getByText('$15.00')).toBeDefined()
    fireEvent.click(screen.getByRole('button'))
    expect(onQtyChange).toHaveBeenCalledWith(1)
  })

  it('Test 2 (qty=1, mine): tap calls onQtyChange(0) (un-claim)', () => {
    const onQtyChange = vi.fn()
    const claims: Record<PersonId, ClaimEntry> = { p1: { qty: 1, assignedBy: 'self' } }
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
      />
    )
    expect(screen.getByRole('button').className).toMatch(/bg-amber-50/)
    fireEvent.click(screen.getByRole('button'))
    expect(onQtyChange).toHaveBeenCalledWith(0)
  })

  it('Test 3 (qty=1, claimed by others, not me): shows claimant avatar stack', () => {
    const onQtyChange = vi.fn()
    const claims: Record<PersonId, ClaimEntry> = { p2: { qty: 1, assignedBy: 'self' } }
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
      />
    )
    const stack = screen.getByTestId('claimant-stack')
    expect(stack).toBeDefined()
    expect(stack.getAttribute('aria-label')).toMatch(/Bob/)
  })

  it('Test 4 (qty>1): shows qty stepper, not toggle', () => {
    const onQtyChange = vi.fn()
    render(
      <ClaimableItemCard
        item={multiQtyItem}
        claimsForItem={{}}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
      />
    )
    expect(screen.getByTestId('qty-stepper')).toBeDefined()
    expect(screen.getByTestId('qty-count').textContent?.trim()).toBe('0')
    expect(screen.queryByRole('button', { name: /claim pitcher/i })).toBeNull()
  })

  it('Test 5 (qty>1): + button calls onQtyChange(1)', () => {
    const onQtyChange = vi.fn()
    render(
      <ClaimableItemCard
        item={multiQtyItem}
        claimsForItem={{}}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
      />
    )
    fireEvent.click(screen.getByLabelText(/Increase Pitcher quantity/i))
    expect(onQtyChange).toHaveBeenCalledWith(1)
  })

  it('Test 6 (qty>1): + button is disabled when myQty === item.quantity', () => {
    const onQtyChange = vi.fn()
    const claims: Record<PersonId, ClaimEntry> = { p1: { qty: 4, assignedBy: 'self' } }
    render(
      <ClaimableItemCard
        item={multiQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
      />
    )
    const inc = screen.getByLabelText(/Increase Pitcher quantity/i)
    expect((inc as HTMLButtonElement).disabled).toBe(true)
  })

  it('Test 7 (qty>1): "X of N claimed" label', () => {
    const claims: Record<PersonId, ClaimEntry> = {
      p1: { qty: 1, assignedBy: 'self' },
      p2: { qty: 2, assignedBy: 'self' },
    }
    render(
      <ClaimableItemCard
        item={multiQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={vi.fn()}
      />
    )
    expect(screen.getByTestId('claimed-count').textContent).toMatch(/3 of 4 claimed/)
  })

  it('Test 8 (host-assigned): renders "Assigned by host" label + amber-200 border', () => {
    const claims: Record<PersonId, ClaimEntry> = { p1: { qty: 1, assignedBy: 'host' } }
    const { container } = render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={vi.fn()}
      />
    )
    expect(screen.getByText(/Assigned by host/i)).toBeDefined()
    const card = container.querySelector('[class*="border-amber-200"]')
    expect(card).not.toBeNull()
  })

  it('Test 9 (overflow): 4+ other claimants — shows 3 avatars + "+N"', () => {
    const claims: Record<PersonId, ClaimEntry> = {
      p2: { qty: 1, assignedBy: 'self' },
      p3: { qty: 1, assignedBy: 'self' },
      p4: { qty: 1, assignedBy: 'self' },
      // and Eve below
      eve: { qty: 1, assignedBy: 'self' },
    }
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={{ ...peopleById, eve: { id: 'eve', name: 'Eve', colorIndex: 4 } }}
        onQtyChange={vi.fn()}
      />
    )
    expect(screen.getByText(/^\+1$/)).toBeDefined()
  })
})
