import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ResultsStep } from '@/components/wizard/ResultsStep'
import { useBillStore } from '@/stores/useBillStore'
import { computePersonTotals, computeSubtotalCents, computeTipCents } from '@/lib/billMath'

// Scenario A:
// Alice and Bob share Pizza ($10.00 = 1000 cents)
// Carol solo Coke ($2.50 = 250 cents)
// Tip 20% on subtotal $12.50 = $2.50 (250 cents)
//   Tip split 3 ways: 84 + 83 + 83 = 250 (Alice gets largest-remainder cent)
// Expected:
//   Alice: 500 (half Pizza) + 84 (tip) = 584 → $5.84
//   Bob:   500 (half Pizza) + 83 (tip) = 583 → $5.83
//   Carol: 250 (solo Coke) + 83 (tip) = 333 → $3.33
//   Total: 584 + 583 + 333 = 1500 → $15.00 (subtotal 1250 + tip 250)

describe('ResultsStep', () => {
  let aliceId: string
  let bobId: string
  let carolId: string
  let pizzaId: string
  let cokeId: string

  beforeEach(() => {
    useBillStore.getState().reset()
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    useBillStore.getState().addPerson('Carol')
    useBillStore.getState().addItem('Pizza', 1000)
    useBillStore.getState().addItem('Coke', 250)

    const state = useBillStore.getState()
    aliceId = state.people.find((p) => p.name === 'Alice')!.id
    bobId = state.people.find((p) => p.name === 'Bob')!.id
    carolId = state.people.find((p) => p.name === 'Carol')!.id
    pizzaId = state.items.find((i) => i.name === 'Pizza')!.id
    cokeId = state.items.find((i) => i.name === 'Coke')!.id

    // Assign Pizza to Alice and Bob (shared)
    state.setAssignment(pizzaId, [aliceId, bobId])
    // Assign Coke to Carol (solo)
    state.setAssignment(cokeId, [carolId])
    // Set tip to 20%
    state.setTipPercent(20)
  })

  afterEach(() => {
    cleanup()
  })

  it('Test 1: renders one Card per person (3 cards for Alice, Bob, Carol)', () => {
    render(<ResultsStep />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('Carol')).toBeDefined()
  })

  it('Test 2: each card shows the person total formatted via formatCents — Alice $5.84, Bob $5.83, Carol $3.33', () => {
    render(<ResultsStep />)
    expect(screen.getByText('$5.84')).toBeDefined()
    expect(screen.getByText('$5.83')).toBeDefined()
    expect(screen.getByText('$3.33')).toBeDefined()
  })

  it('Test 3 (cents conservation): sum of computePersonTotals === subtotal + tip === 1500 cents', () => {
    const { people, items, assignments, tipPercent } = useBillStore.getState()
    const totals = computePersonTotals(people, items, assignments, tipPercent)
    const subtotalCents = computeSubtotalCents(items)
    const tipCents = computeTipCents(subtotalCents, tipPercent)
    const sum = Object.values(totals).reduce((s, c) => s + c, 0)
    expect(sum).toBe(subtotalCents + tipCents)
    expect(sum).toBe(1500)
  })

  it('Test 4: bottom strip shows "Total bill: $15.00" (subtotal $12.50 + 20% tip $2.50)', () => {
    render(<ResultsStep />)
    const strip = screen.getByText(/Total bill:/)
    expect(strip.textContent).toContain('$15.00')
  })

  it("Test 5: tapping Alice's card expands it showing item details and tip share", () => {
    render(<ResultsStep />)
    // Find Alice's card and tap it
    const aliceCard = screen.getByText('Alice').closest('[data-testid="person-card"]') as HTMLElement
      || screen.getByText('Alice').closest('div[role="button"]') as HTMLElement
      || screen.getByText('Alice').parentElement?.closest('[class*="rounded"]') as HTMLElement

    // Click on Alice's card region
    fireEvent.click(screen.getByText('Alice'))

    // After expansion, should show Pizza and Alice's share
    expect(screen.getByText('Pizza')).toBeDefined()
    // Alice's share of pizza: $5.00
    expect(screen.getByText('$5.00')).toBeDefined()
    // Tip share line
    expect(screen.getByText('Tip')).toBeDefined()
  })

  it('Test 6 (single-expand rule): tapping Alice then Bob collapses Alice and expands Bob', () => {
    render(<ResultsStep />)
    // Tap Alice to expand
    fireEvent.click(screen.getByText('Alice'))
    // Alice's items should be visible — Pizza and share
    expect(screen.getByText('Pizza')).toBeDefined()

    // Tap Bob to expand — Alice should collapse
    fireEvent.click(screen.getByText('Bob'))
    // Bob's expanded content should be visible
    // Pizza should still be visible since Bob also has Pizza
    expect(screen.getByText('Pizza')).toBeDefined()

    // After Bob expands, Alice's unique expansion marker (expanded with tip total) should show Bob's total
    // Verify only one "Total" line is visible in the expanded section
    const totalLines = screen.getAllByText('Total')
    expect(totalLines.length).toBe(1)
  })

  it('Test 7: tapping an already-expanded card collapses it', () => {
    render(<ResultsStep />)
    // Tap Alice to expand
    fireEvent.click(screen.getByText('Alice'))
    // Verify expanded (Total line visible)
    expect(screen.getAllByText('Total').length).toBeGreaterThan(0)
    // Tap Alice again to collapse
    fireEvent.click(screen.getByText('Alice'))
    // Total line should no longer be visible (no expanded card)
    expect(screen.queryAllByText('Total').length).toBe(0)
  })

  it('Test 8: per-person total displayed with text-[28px] and text-amber-600 class', () => {
    render(<ResultsStep />)
    // Find the $5.84 element (Alice's total)
    const totalEl = screen.getByText('$5.84')
    expect(totalEl.className).toMatch(/text-\[28px\]/)
    expect(totalEl.className).toMatch(/text-amber-600/)
  })

  it('Test 9: card expansion shows tip share line with "Tip:" text', () => {
    render(<ResultsStep />)
    fireEvent.click(screen.getByText('Alice'))
    // Should show "Tip" in the expanded section
    expect(screen.getByText('Tip')).toBeDefined()
  })

  it('Test 10: Back button calls setStep(4)', () => {
    render(<ResultsStep />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(useBillStore.getState().step).toBe(4)
  })

  it('Test 11: person with no items assigned still renders, total shows tip share only', () => {
    // Add a 4th person with no assignments
    useBillStore.getState().addPerson('Dave')
    render(<ResultsStep />)
    // Dave should appear
    expect(screen.getByText('Dave')).toBeDefined()
    // Dave's total should be his tip share (tipCents / 4 people)
    // subtotal=1250, tip=250 at 20%, 4 people: 62+63+63+63 ... let's just assert Dave card renders with a dollar amount
    // Dave's total = Math.floor(250/4) = 62 cents = $0.62 (first person after Alice, Bob, Carol gets the remainder)
    const { people, items, assignments, tipPercent } = useBillStore.getState()
    const totals = computePersonTotals(people, items, assignments, tipPercent)
    const dave = people.find((p) => p.name === 'Dave')!
    const daveTotalCents = totals[dave.id]
    // Dave has no items, so his total is just his tip share
    const subtotalCents = computeSubtotalCents(items)
    const tipCents = computeTipCents(subtotalCents, tipPercent)
    const tipBase = Math.floor(tipCents / 4)
    // Dave is index 3 (4th person); tipRemainder = 250 % 4 = 2; indices 0 and 1 get extra cent
    const daveIdx = 3
    const tipRemainder = tipCents % 4
    const daveTip = tipBase + (daveIdx < tipRemainder ? 1 : 0)
    expect(daveTotalCents).toBe(daveTip)
    // Dave's card is present in the rendered output
    const daveEl = screen.getByText('Dave')
    expect(daveEl).toBeDefined()
  })
})
