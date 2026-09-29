import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ScanItemsEditor } from '@/components/wizard/ScanItemsEditor'
import { useBillStore } from '@/stores/useBillStore'

function seed(withCheck = true) {
  const s = useBillStore.getState()
  s.setItems([
    { id: 'i1', name: 'Widget', priceCents: 1000, quantity: 1, confidence: 'high' },
    { id: 'i2', name: 'Fries', priceCents: 400, quantity: 1, confidence: 'high' },
  ])
  if (withCheck) {
    s.setScanCheck({ correctedCount: 0, mismatch: true, targetCents: 1500, hasSubtotal: true })
  }
  s.setStep(2)
}

describe('ScanItemsEditor', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
  })
  afterEach(() => cleanup())

  it('renders edit controls and the live gap line', () => {
    seed()
    render(<ScanItemsEditor />)
    expect(screen.getAllByLabelText('Item name')).toHaveLength(2)
    expect(screen.getAllByLabelText('Price')).toHaveLength(2)
    expect(screen.getAllByLabelText('Quantity')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /remove widget/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDefined()
    const gap = screen.getByTestId('scan-review-gap')
    expect(gap.textContent).toContain('$14.00')
    expect(gap.textContent).toContain('$15.00')
    expect(gap.textContent).toContain('subtotal')
    expect(gap.textContent).toContain('$1.00')
  })

  it('editing a price updates the store and the gap', async () => {
    seed()
    render(<ScanItemsEditor />)
    const price = screen.getAllByLabelText('Price')[0]
    fireEvent.change(price, { target: { value: '11.00' } })
    fireEvent.blur(price)
    await waitFor(() => expect(useBillStore.getState().items[0].priceCents).toBe(1100))
    expect(screen.getByTestId('scan-review-gap').textContent).toContain('off by $0.00')
  })

  it('Add item and Remove work on the store', () => {
    seed()
    render(<ScanItemsEditor />)
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))
    expect(useBillStore.getState().items.some((i) => i.name === 'New item')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /remove fries/i }))
    expect(useBillStore.getState().items.some((i) => i.name === 'Fries')).toBe(false)
  })

  it('Done commits pending drafts and returns to step 1', () => {
    seed()
    render(<ScanItemsEditor />)
    fireEvent.change(screen.getAllByLabelText('Item name')[0], { target: { value: 'Gadget' } })
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(useBillStore.getState().items[0].name).toBe('Gadget')
    expect(useBillStore.getState().step).toBe(1)
  })

  it('without a scanCheck there is no gap line', () => {
    seed(false)
    render(<ScanItemsEditor />)
    expect(screen.getAllByLabelText('Item name')).toHaveLength(2)
    expect(screen.queryByTestId('scan-review-gap')).toBeNull()
  })
})
