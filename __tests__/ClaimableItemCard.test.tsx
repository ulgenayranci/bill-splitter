import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ClaimableItemCard } from '@/components/split/ClaimableItemCard'
import type { Item, Person, PersonId } from '@/stores/useBillStore'

const item: Item = { id: 'i1', name: 'Pizza', priceCents: 1500 }
const p1: Person = { id: 'p1', name: 'Alice', colorIndex: 0 }
const p2: Person = { id: 'p2', name: 'Bob', colorIndex: 1 }
const peopleById: Record<PersonId, Person> = { p1, p2 }

describe('ClaimableItemCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('Test 1: Unclaimed — renders item name + formatted price; calls onTap on click', () => {
    const onTap = vi.fn()
    render(
      <ClaimableItemCard
        item={item}
        claimedBy={undefined}
        myPersonId="p1"
        peopleById={peopleById}
        onTap={onTap}
      />
    )
    expect(screen.getByText('Pizza')).toBeDefined()
    expect(screen.getByText('$15.00')).toBeDefined()
    fireEvent.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('Test 2: Claimed by me — renders with bg-amber-50 class', () => {
    const onTap = vi.fn()
    render(
      <ClaimableItemCard
        item={item}
        claimedBy="p1"
        myPersonId="p1"
        peopleById={peopleById}
        onTap={onTap}
      />
    )
    const card = screen.getByRole('button')
    expect(card.className).toMatch(/bg-amber-50/)
  })

  it('Test 3: Taken by other — renders "Taken by {name}" badge, opacity-50 class, does NOT call onTap when clicked', () => {
    const onTap = vi.fn()
    render(
      <ClaimableItemCard
        item={item}
        claimedBy="p2"
        myPersonId="p1"
        peopleById={peopleById}
        onTap={onTap}
      />
    )
    // Should show "Taken by Bob"
    expect(screen.getByText(/Taken by Bob/)).toBeDefined()
    // Card should have opacity-50
    const card = screen.getByRole('button')
    expect(card.className).toMatch(/opacity-50/)
    // onTap should NOT be called because of pointer-events-none + onClick guard
    fireEvent.click(card)
    expect(onTap).not.toHaveBeenCalled()
  })
})
