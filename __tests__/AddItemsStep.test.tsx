import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AddItemsStep } from '@/components/wizard/AddItemsStep'
import { useBillStore } from '@/stores/useBillStore'

describe('AddItemsStep', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty-state heading when items.length === 0', () => {
    render(<AddItemsStep />)
    expect(screen.getByText(/what did everyone order/i)).toBeDefined()
  })

  it('renders an "Add item" trigger button or row when no items', () => {
    render(<AddItemsStep />)
    expect(screen.getByRole('button', { name: /add item/i })).toBeDefined()
  })

  it('user adds Coke $2.50 and store contains {name: "Coke", priceCents: 250}', () => {
    render(<AddItemsStep />)
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))
    const inputs = screen.getAllByRole('textbox')
    const nameInput = inputs.find((el) => (el as HTMLInputElement).placeholder?.match(/name/i) || el.closest('[data-slot]'))
    // Find name and price inputs
    const nameField = screen.getByPlaceholderText(/item name/i)
    const priceField = screen.getByPlaceholderText(/price/i)
    fireEvent.change(nameField, { target: { value: 'Coke' } })
    fireEvent.change(priceField, { target: { value: '2.50' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm|check|add|save/i }))
    const items = useBillStore.getState().items
    expect(items.length).toBe(1)
    expect(items[0].name).toBe('Coke')
    expect(items[0].priceCents).toBe(250)
  })

  it('after adding Coke $2.50, displayed price text is "$2.50"', () => {
    useBillStore.getState().addItem('Coke', 250)
    render(<AddItemsStep />)
    expect(screen.getByText('$2.50')).toBeDefined()
  })

  it('submitting empty price field shows "Enter a price" error and does not add item', () => {
    render(<AddItemsStep />)
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))
    const nameField = screen.getByPlaceholderText(/item name/i)
    fireEvent.change(nameField, { target: { value: 'Coke' } })
    // Leave price empty, click confirm
    fireEvent.click(screen.getByRole('button', { name: /confirm|check|add|save/i }))
    expect(screen.getByText(/enter a price/i)).toBeDefined()
    expect(useBillStore.getState().items.length).toBe(0)
  })

  it('typing "abc" in price field shows "Numbers only" error and does not add item', () => {
    render(<AddItemsStep />)
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))
    const nameField = screen.getByPlaceholderText(/item name/i)
    const priceField = screen.getByPlaceholderText(/price/i)
    fireEvent.change(nameField, { target: { value: 'Coke' } })
    fireEvent.change(priceField, { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm|check|add|save/i }))
    expect(screen.getByText(/numbers only/i)).toBeDefined()
    expect(useBillStore.getState().items.length).toBe(0)
  })

  it('typing "12.345" in price field shows "Numbers only" error and does not add item', () => {
    render(<AddItemsStep />)
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))
    const nameField = screen.getByPlaceholderText(/item name/i)
    const priceField = screen.getByPlaceholderText(/price/i)
    fireEvent.change(nameField, { target: { value: 'Coke' } })
    fireEvent.change(priceField, { target: { value: '12.345' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm|check|add|save/i }))
    expect(screen.getByText(/numbers only/i)).toBeDefined()
    expect(useBillStore.getState().items.length).toBe(0)
  })

  it('tapping trash opens a Dialog with item name and clicking Remove deletes item', () => {
    useBillStore.getState().addItem('Coke', 250)
    render(<AddItemsStep />)
    const trashBtn = screen.getByLabelText('Remove Coke')
    fireEvent.click(trashBtn)
    // Dialog should appear with item name in title
    expect(screen.getByText(/remove coke/i)).toBeDefined()
    // Click the Remove button in the dialog
    const removeBtn = screen.getByRole('button', { name: /^remove$/i })
    fireEvent.click(removeBtn)
    expect(useBillStore.getState().items.length).toBe(0)
  })

  it('"Assign items" CTA is disabled when items.length === 0', () => {
    render(<AddItemsStep />)
    const cta = screen.getByRole('button', { name: /assign items/i })
    expect(cta.hasAttribute('disabled')).toBe(true)
  })

  it('"Assign items" CTA is enabled with ≥1 item', () => {
    useBillStore.getState().addItem('Coke', 250)
    render(<AddItemsStep />)
    const cta = screen.getByRole('button', { name: /assign items/i })
    expect(cta.hasAttribute('disabled')).toBe(false)
  })

  it('tapping "Assign items" with ≥1 item calls setStep(3)', () => {
    useBillStore.getState().addItem('Coke', 250)
    render(<AddItemsStep />)
    const cta = screen.getByRole('button', { name: /assign items/i })
    fireEvent.click(cta)
    expect(useBillStore.getState().step).toBe(3)
  })

  it('clicking item row enters edit mode and updating name calls updateItem', () => {
    useBillStore.getState().addItem('Coke', 250)
    render(<AddItemsStep />)
    // Click the item row to enter edit mode
    const itemRow = screen.getByText('Coke').closest('[data-testid="item-row"]') ||
      screen.getByTestId?.('item-row-0') ||
      screen.getByText('Coke').closest('li') ||
      screen.getByText('Coke').parentElement!
    fireEvent.click(itemRow!)
    // Now in edit mode, change name
    const nameField = screen.getByDisplayValue('Coke')
    fireEvent.change(nameField, { target: { value: 'Diet Coke' } })
    // Click confirm to commit
    fireEvent.click(screen.getByRole('button', { name: /confirm|check|save/i }))
    expect(useBillStore.getState().items[0].name).toBe('Diet Coke')
  })
})
