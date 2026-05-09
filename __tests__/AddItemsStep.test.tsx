import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Toast } from '@base-ui/react/toast'
import { AddItemsStep } from '@/components/wizard/AddItemsStep'
import { useBillStore } from '@/stores/useBillStore'

// ESM-compatible mock for browser-image-compression default export
vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}))

function renderInProvider(ui: React.ReactElement) {
  return render(<Toast.Provider>{ui}</Toast.Provider>)
}

describe('AddItemsStep', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty-state heading when items.length === 0', () => {
    renderInProvider(<AddItemsStep />)
    expect(screen.getByText(/what did everyone order/i)).toBeDefined()
  })

  it('renders an "Add item" trigger button or row when no items', () => {
    renderInProvider(<AddItemsStep />)
    expect(screen.getByRole('button', { name: /add item/i })).toBeDefined()
  })

  it('user adds Coke $2.50 and store contains {name: "Coke", priceCents: 250}', () => {
    renderInProvider(<AddItemsStep />)
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
    renderInProvider(<AddItemsStep />)
    expect(screen.getByText('$2.50')).toBeDefined()
  })

  it('submitting empty price field shows "Enter a price" error and does not add item', () => {
    renderInProvider(<AddItemsStep />)
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))
    const nameField = screen.getByPlaceholderText(/item name/i)
    fireEvent.change(nameField, { target: { value: 'Coke' } })
    // Leave price empty, click confirm
    fireEvent.click(screen.getByRole('button', { name: /confirm|check|add|save/i }))
    expect(screen.getByText(/enter a price/i)).toBeDefined()
    expect(useBillStore.getState().items.length).toBe(0)
  })

  it('typing "abc" in price field shows "Numbers only" error and does not add item', () => {
    renderInProvider(<AddItemsStep />)
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
    renderInProvider(<AddItemsStep />)
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
    renderInProvider(<AddItemsStep />)
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
    renderInProvider(<AddItemsStep />)
    const cta = screen.getByRole('button', { name: /assign items/i })
    expect(cta.hasAttribute('disabled')).toBe(true)
  })

  it('"Assign items" CTA is enabled with ≥1 item', () => {
    useBillStore.getState().addItem('Coke', 250)
    renderInProvider(<AddItemsStep />)
    const cta = screen.getByRole('button', { name: /assign items/i })
    expect(cta.hasAttribute('disabled')).toBe(false)
  })

  it('tapping "Assign items" with ≥1 item calls setStep(3)', () => {
    useBillStore.getState().addItem('Coke', 250)
    renderInProvider(<AddItemsStep />)
    const cta = screen.getByRole('button', { name: /assign items/i })
    fireEvent.click(cta)
    expect(useBillStore.getState().step).toBe(3)
  })

  it('clicking item row enters edit mode and updating name calls updateItem', () => {
    useBillStore.getState().addItem('Coke', 250)
    renderInProvider(<AddItemsStep />)
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

  // ----- Phase 2: OCR pipeline integration -----

  it('shows the "Scan bill" button when ocrStatus is idle', () => {
    renderInProvider(<AddItemsStep />)
    expect(screen.getByRole('button', { name: /scan bill/i })).toBeDefined()
  })

  it('hides the "Scan bill" button when ocrStatus is "done"', () => {
    useBillStore.getState().setOcrStatus('done')
    renderInProvider(<AddItemsStep />)
    expect(screen.queryByRole('button', { name: /scan bill/i })).toBeNull()
  })

  it('shows the "Scan bill" button again when ocrStatus is "error" (retry path)', () => {
    useBillStore.getState().setOcrStatus('error')
    renderInProvider(<AddItemsStep />)
    expect(screen.getByRole('button', { name: /scan bill/i })).toBeDefined()
  })

  it('renders the loading overlay (role="status") when ocrStatus is "loading"', () => {
    useBillStore.getState().setOcrStatus('loading')
    renderInProvider(<AddItemsStep />)
    const overlay = document.body.querySelector('[role="status"]')
    expect(overlay).not.toBeNull()
    expect(overlay?.textContent).toMatch(/scanning your bill/i)
  })

  it('renders the bill thumbnail when billImageUrl is set', () => {
    useBillStore.getState().setBillImage('blob:abc123')
    renderInProvider(<AddItemsStep />)
    const img = screen.getByAltText(/captured bill photo/i) as HTMLImageElement
    expect(img).toBeDefined()
    expect(img.src).toContain('blob:abc123')
  })

  it('does NOT render the bill thumbnail when billImageUrl is null', () => {
    renderInProvider(<AddItemsStep />)
    expect(screen.queryByAltText(/captured bill photo/i)).toBeNull()
  })

  it('on successful OCR fetch, batch-inserts returned items into the store', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { name: 'Burger', priceCents: 1299 },
            { name: 'Fries', priceCents: 499 },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    renderInProvider(<AddItemsStep />)
    const fileInput = screen.getByTestId('ocr-file-input') as HTMLInputElement
    const fakeFile = new File(['fake-bytes'], 'receipt.jpg', { type: 'image/jpeg' })

    // Stub FileReader.readAsDataURL synchronously
    const origFR = global.FileReader
    class StubFR {
      onloadend: (() => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      result: string | ArrayBuffer | null = null
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,FAKEBASE64'
        queueMicrotask(() => this.onloadend?.())
      }
    }
    ;(global as unknown as { FileReader: typeof StubFR }).FileReader = StubFR

    fireEvent.change(fileInput, { target: { files: [fakeFile] } })
    // Allow the async chain to resolve
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    const items = useBillStore.getState().items
    expect(items.length).toBe(2)
    expect(items[0].name).toBe('Burger')
    expect(items[0].priceCents).toBe(1299)
    expect(items[1].name).toBe('Fries')
    expect(items[1].priceCents).toBe(499)
    expect(useBillStore.getState().ocrStatus).toBe('done')

    fetchMock.mockRestore()
    ;(global as unknown as { FileReader: typeof origFR }).FileReader = origFR
  })

  it('on failed OCR fetch, sets ocrStatus to "error" and does not add items', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'OCR failed' }), { status: 500 }),
    )
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const origFR = global.FileReader
    class StubFR {
      onloadend: (() => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      result: string | ArrayBuffer | null = null
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,FAKE'
        queueMicrotask(() => this.onloadend?.())
      }
    }
    ;(global as unknown as { FileReader: typeof StubFR }).FileReader = StubFR

    renderInProvider(<AddItemsStep />)
    const fileInput = screen.getByTestId('ocr-file-input') as HTMLInputElement
    const fakeFile = new File(['fake'], 'r.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [fakeFile] } })
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    expect(useBillStore.getState().items.length).toBe(0)
    expect(useBillStore.getState().ocrStatus).toBe('error')

    fetchMock.mockRestore()
    consoleSpy.mockRestore()
    ;(global as unknown as { FileReader: typeof origFR }).FileReader = origFR
  })
})
