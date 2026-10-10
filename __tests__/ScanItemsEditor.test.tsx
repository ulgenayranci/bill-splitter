import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ScanItemsEditor } from '@/components/wizard/ScanItemsEditor'
import { useBillStore } from '@/stores/useBillStore'
import { SCAN_FLAG_REASONS } from '@/lib/scanSanityChecks'

type CheckOverride = { mismatch: boolean; targetCents: number; hasSubtotal: boolean }

function seed(check: Partial<CheckOverride> | false = {}) {
  const s = useBillStore.getState()
  s.setItems([
    { id: 'i1', name: 'Widget', priceCents: 1000, quantity: 1, confidence: 'high' },
    { id: 'i2', name: 'Fries', priceCents: 400, quantity: 1, confidence: 'high' },
  ])
  if (check !== false) {
    s.setScanCheck({
      correctedCount: 0,
      mismatch: true,
      targetCents: 1500,
      hasSubtotal: true,
      ...check,
    })
  }
  s.setStep(2)
}

describe('ScanItemsEditor', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
  })
  afterEach(() => cleanup())

  it('renders edit controls and the problem heading with summary', () => {
    seed()
    render(<ScanItemsEditor />)
    expect(screen.getAllByLabelText('Item name')).toHaveLength(2)
    expect(screen.getAllByLabelText('Price')).toHaveLength(2)
    expect(screen.getAllByLabelText('Quantity')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /remove widget/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDefined()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      "Your items don't match the receipt",
    )
    const gap = screen.getByTestId('scan-review-gap')
    expect(gap.textContent).toContain('Off by $1.00')
    expect(gap.textContent).toContain('Receipt subtotal $15.00')
    expect(gap.textContent).toContain('Your items $14.00')
    expect(screen.getByTestId('scan-review-gap-primary').className).toContain('text-warn')
  })

  it('summary sits after the heading and before the item list', () => {
    seed()
    render(<ScanItemsEditor />)
    const h1 = screen.getByRole('heading', { level: 1 })
    const gap = screen.getByTestId('scan-review-gap')
    const firstName = screen.getAllByLabelText('Item name')[0]
    expect(h1.compareDocumentPosition(gap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(gap.compareDocumentPosition(firstName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('editing a price updates the store, summary and heading', async () => {
    seed()
    render(<ScanItemsEditor />)
    const price = screen.getAllByLabelText('Price')[0]
    fireEvent.change(price, { target: { value: '11.00' } })
    fireEvent.blur(price)
    await waitFor(() => expect(useBillStore.getState().items[0].priceCents).toBe(1100))
    const gap = screen.getByTestId('scan-review-gap')
    expect(gap.textContent).toContain('Matches the receipt')
    expect(gap.textContent).not.toContain('Off by')
    expect(screen.getByTestId('scan-review-gap-primary').className).not.toContain('text-warn')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit scanned items')
  })

  it('says "total" when the receipt had no subtotal; heading follows the live gap', () => {
    seed({ hasSubtotal: false, mismatch: false })
    render(<ScanItemsEditor />)
    expect(screen.getByTestId('scan-review-gap-detail').textContent).toContain('Receipt total $15.00')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      "Your items don't match the receipt",
    )
  })

  it('clean scan shows Edit scanned items and Matches the receipt', () => {
    seed({ targetCents: 1400, mismatch: false })
    render(<ScanItemsEditor />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit scanned items')
    expect(screen.getByTestId('scan-review-gap').textContent).toContain('Matches the receipt')
  })

  it('each item sits in its own card', () => {
    seed()
    const { container } = render(<ScanItemsEditor />)
    const cards = container.querySelectorAll('[data-slot="card"]')
    expect(cards).toHaveLength(2)
    const names = screen.getAllByLabelText('Item name')
    const prices = screen.getAllByLabelText('Price')
    const qtys = screen.getAllByLabelText('Quantity')
    const removes = [
      screen.getByRole('button', { name: /remove widget/i }),
      screen.getByRole('button', { name: /remove fries/i }),
    ]
    for (let i = 0; i < 2; i++) {
      expect(names[i].closest('[data-slot="card"]')).toBe(cards[i])
      expect(prices[i].closest('[data-slot="card"]')).toBe(cards[i])
      expect(qtys[i].closest('[data-slot="card"]')).toBe(cards[i])
      expect(removes[i].closest('[data-slot="card"]')).toBe(cards[i])
    }
    const gap = screen.getByTestId('scan-review-gap')
    expect(gap.closest('[data-slot="card"]')).toBeNull()
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
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit scanned items')
  })

  it('shows a read-only tax note when the store has taxCents', () => {
    seed()
    useBillStore.getState().setTaxCents(800)
    render(<ScanItemsEditor />)
    const note = screen.getByTestId('editor-tax')
    expect(note.textContent).toMatch(/Tax .*8\.00, split equally and not part of the items total/)
    expect(note.textContent).not.toContain('\u2014')
    expect(screen.getAllByLabelText('Item name')).toHaveLength(2)
  })

  it('no tax note when taxCents is null', () => {
    seed()
    render(<ScanItemsEditor />)
    expect(screen.queryByTestId('editor-tax')).toBeNull()
  })

  it('no printed total: shows the no-total message, no Off by / Matches text', () => {
    seed()
    useBillStore.getState().setScanCheck({
      correctedCount: 0,
      mismatch: false,
      targetCents: null,
      hasSubtotal: false,
    })
    render(<ScanItemsEditor />)
    expect(screen.getByTestId('scan-review-no-total').textContent).toBe(
      'No total found on the receipt \u2014 please check the items',
    )
    expect(screen.queryByTestId('scan-review-gap')).toBeNull()
    expect(document.body.textContent).not.toContain('Off by')
    expect(document.body.textContent).not.toContain('Matches the receipt')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Please check these items')
  })

  it('flagged line shows its reason and the flag disappears after the user edits that line', async () => {
    seed({ mismatch: false, targetCents: 1400 })
    const st = useBillStore.getState()
    st.setItems(st.items.map((i) => (i.id === 'i1' ? { ...i, scanFlag: 'Unusual price' as const } : i)))
    render(<ScanItemsEditor />)
    expect(screen.getByTestId('scan-line-flag').textContent).toContain('Unusual price')
    const price = screen.getAllByLabelText('Price')[0]
    fireEvent.change(price, { target: { value: '10.50' } })
    fireEvent.blur(price)
    await waitFor(() => expect(screen.queryByTestId('scan-line-flag')).toBeNull())
  })

  it('shows an auto-fixed chip on flagged lines', () => {
    seed()
    useBillStore.setState((s) => ({
      items: s.items.map((i) => (i.id === 'i1' ? { ...i, scanFlag: SCAN_FLAG_REASONS.autoFixed } : i)),
    }))
    render(<ScanItemsEditor />)
    expect(screen.getByTestId('scan-line-flag').textContent).toContain('Auto-fixed — please check')
  })

  it('opens and closes the receipt photo from the review screen', () => {
    seed()
    useBillStore.getState().setBillImage('data:image/jpeg;base64,abc')
    render(<ScanItemsEditor />)
    const btn = screen.getByTestId('scan-review-photo')
    expect(btn.getAttribute('aria-label')).toBe('View receipt photo')
    expect(btn.textContent).toContain('View receipt')
    expect(btn.querySelector('img')).not.toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Bill photo' })).toBeNull()
    fireEvent.click(btn)
    expect(screen.getByRole('dialog', { name: 'Bill photo' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Bill photo' })).toBeNull()
  })

  it('renders no receipt control without a photo', () => {
    seed()
    render(<ScanItemsEditor />)
    expect(screen.queryByTestId('scan-review-photo')).toBeNull()
  })
})

describe('ScanItemsEditor — Retake photo', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
    useBillStore.getState().setItems([
      { id: 'i1', name: 'Burger', priceCents: 1299, quantity: 1, confidence: 'high' },
    ])
    useBillStore.getState().setBillImage('data:image/jpeg;base64,PRIOR')
    useBillStore.getState().setStep(2)
  })
  afterEach(() => cleanup())

  it('shows a Retake button on the receipt card', () => {
    render(<ScanItemsEditor />)
    expect(screen.getByRole('button', { name: 'Retake photo' })).toBeDefined()
  })

  it('without edits, Retake opens the photo picker straight away (no confirm)', () => {
    render(<ScanItemsEditor />)
    const input = screen.getByTestId('retake-file-input') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'Retake photo' }))
    expect(clickSpy).toHaveBeenCalled()
    expect(screen.queryByTestId('scan-review-retake-confirm')).toBeNull()
  })

  it('after an edit, Retake asks first; Cancel keeps the items', () => {
    render(<ScanItemsEditor />)
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Retake photo' }))
    expect(screen.getByText('Retake photo?')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('scan-review-retake-confirm')).toBeNull()
    expect(useBillStore.getState().items).toHaveLength(2)
  })

  it('choosing a photo hands it to setup (step 1) for scanning', async () => {
    render(<ScanItemsEditor />)
    const file = new File(['x'], 'new.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByTestId('retake-file-input'), { target: { files: [file] } })
    expect(useBillStore.getState().step).toBe(1)
    const { takePendingScanFile } = await import('@/lib/pendingScan')
    expect(takePendingScanFile()).toBe(file)
  })
})
