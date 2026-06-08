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
    // Flat ClaimEntry: { qty } only — no assignedBy
    const claims: Record<PersonId, ClaimEntry> = { p1: { qty: 1 } }
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
    const claims: Record<PersonId, ClaimEntry> = { p2: { qty: 1 } }
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
      />
    )
    expect(screen.getByTestId('claimant-stack')).toBeDefined()
    expect(screen.getByTestId('claimant-names').textContent).toMatch(/Bob/)
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
    const claims: Record<PersonId, ClaimEntry> = { p1: { qty: 4 } }
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
      p1: { qty: 1 },
      p2: { qty: 2 },
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

  it('Test 8 (overflow): 4+ other claimants — shows 3 avatars + "+N" overflow (D-07)', () => {
    const claims: Record<PersonId, ClaimEntry> = {
      p2: { qty: 1 },
      p3: { qty: 1 },
      p4: { qty: 1 },
      eve: { qty: 1 },
    }
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={{
          ...peopleById,
          eve: { id: 'eve', name: 'Eve', colorIndex: 4 },
        }}
        onQtyChange={vi.fn()}
      />
    )
    // 4 others, cap is 3 → overflow count = 1
    const stack = screen.getByTestId('claimant-stack')
    expect(stack.querySelectorAll('span[title]').length).toBe(3)
    expect(stack.textContent).toMatch(/\+1/)
  })
})

describe('ClaimableItemCard — Phase 9 (D-06, D-07, D-08, D-13, D-14, D-15)', () => {
  afterEach(() => cleanup())

  // D-07: chip cap is 3 (not 5)
  it('D-07: with >3 claimants, exactly 3 chips render plus "+N" overflow badge with correct N', () => {
    const claims: Record<PersonId, ClaimEntry> = {
      p2: { qty: 1 },
      p3: { qty: 1 },
      p4: { qty: 1 },
      eve: { qty: 1 },
      frank: { qty: 1 },
    }
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={{
          ...peopleById,
          eve: { id: 'eve', name: 'Eve', colorIndex: 4 },
          frank: { id: 'frank', name: 'Frank', colorIndex: 5 },
        }}
        onQtyChange={vi.fn()}
      />
    )
    const stack = screen.getByTestId('claimant-stack')
    expect(stack.querySelectorAll('span[title]').length).toBe(3)
    expect(stack.textContent).toMatch(/\+2/)
  })

  // D-06: own-claim card has BOTH bg-amber-50 AND border-amber-400
  it('D-06: when mine is true, the card root has both bg-amber-50 and border-amber-400', () => {
    const claims: Record<PersonId, ClaimEntry> = { p1: { qty: 1 } }
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={vi.fn()}
      />
    )
    const card = screen.getByRole('button')
    expect(card.className).toMatch(/bg-amber-50/)
    expect(card.className).toMatch(/border-amber-400/)
  })

  // D-13: single-qty unclaimed — onShareChange(true) called; onQtyChange NOT called
  it('D-13 (single-qty, unclaimed): tap calls onShareChange(true) and does NOT call onQtyChange', () => {
    const onQtyChange = vi.fn()
    const onShareChange = vi.fn()
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={{}}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
        onShareChange={onShareChange}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onShareChange).toHaveBeenCalledWith(true)
    expect(onQtyChange).not.toHaveBeenCalled()
  })

  // D-13: single-qty, already mine — onShareChange(false) called
  it('D-13 (single-qty, already mine): tap calls onShareChange(false)', () => {
    const onQtyChange = vi.fn()
    const onShareChange = vi.fn()
    const claims: Record<PersonId, ClaimEntry> = { p1: { qty: 1 } }
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
        onShareChange={onShareChange}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onShareChange).toHaveBeenCalledWith(false)
    expect(onQtyChange).not.toHaveBeenCalled()
  })

  // D-14: multi-qty card uses stepper only; onShareChange not called by stepper
  it('D-14 (multi-qty unaffected): stepper uses onQtyChange; onShareChange never invoked by stepper', () => {
    const onQtyChange = vi.fn()
    const onShareChange = vi.fn()
    render(
      <ClaimableItemCard
        item={multiQtyItem}
        claimsForItem={{}}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
        onShareChange={onShareChange}
      />
    )
    fireEvent.click(screen.getByLabelText(/Increase Pitcher quantity/i))
    expect(onQtyChange).toHaveBeenCalledWith(1)
    expect(onShareChange).not.toHaveBeenCalled()
  })

  // D-15: your-share line for shared single-qty item where mine && claimants > 1
  it('D-15: shared single-qty item mine+claimants>1 shows "your share:" using computeEqualShareCents', () => {
    // $10.00 item shared by 3 people (p1 = "p1", p2 = "p2", p3 = "p3")
    // sorted ascending: p1, p2, p3 → p1 is index 0
    // floor(1000/3)=333, remainder=1 → p1 gets 334 cents → $3.34
    const item: Item = { id: 'share-item', name: 'Shared Pizza', priceCents: 1000, quantity: 1 }
    const claims: Record<PersonId, ClaimEntry> = {
      p1: { qty: 1 },
      p2: { qty: 1 },
      p3: { qty: 1 },
    }
    render(
      <ClaimableItemCard
        item={item}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={vi.fn()}
      />
    )
    const shareLine = screen.getByTestId('your-share')
    expect(shareLine.textContent).toMatch(/your share: \$3\.34/)
  })

  // D-08: no toast/flash/pulse element added on update — just chip render from SWR data
  it('D-08: no toast/flash/pulse element is present in the rendered card', () => {
    const claims: Record<PersonId, ClaimEntry> = {
      p1: { qty: 1 },
      p2: { qty: 1 },
    }
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={claims}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={vi.fn()}
      />
    )
    // No toast, pulse, or flash element should exist
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.querySelector('[data-toast]')).toBeNull()
    expect(document.querySelector('.animate-pulse')).toBeNull()
    expect(document.querySelector('.animate-bounce')).toBeNull()
  })

  // Gap 1: currencyCode threads through to the price amount (EUR → €, not $)
  it('Gap 1 (currency): price shows the passed currencyCode symbol (EUR → €, not $)', () => {
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={{}}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={vi.fn()}
        currencyCode="EUR"
      />
    )
    // The line price (item.priceCents = 1500) must render with the € symbol
    expect(screen.getByText(/€/)).toBeDefined()
    expect(screen.queryByText('$15.00')).toBeNull()
  })

  // Backward compat: when onShareChange is undefined, single-qty tap falls back to onQtyChange
  it('backward compat: when onShareChange is undefined, single-qty tap falls back to onQtyChange', () => {
    const onQtyChange = vi.fn()
    render(
      <ClaimableItemCard
        item={singleQtyItem}
        claimsForItem={{}}
        myPersonId="p1"
        peopleById={peopleById}
        onQtyChange={onQtyChange}
        // onShareChange not provided
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onQtyChange).toHaveBeenCalledWith(1)
  })
})
