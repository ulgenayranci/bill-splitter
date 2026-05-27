import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { EditRequestForm } from '@/components/split/EditRequestForm'
import type { Item } from '@/stores/useBillStore'

const items: Item[] = [
  { id: 'i1', name: 'Pizza', priceCents: 1000, quantity: 1 },
  { id: 'i2', name: 'Beer', priceCents: 500, quantity: 4 },
]

const mutateMock = vi.fn()

function renderForm(overrides: Partial<Parameters<typeof EditRequestForm>[0]> = {}) {
  return render(
    <EditRequestForm
      sessionId="s1"
      personId="p1"
      items={items}
      open
      onClose={overrides.onClose ?? (() => {})}
      mutate={mutateMock}
      {...overrides}
    />
  )
}

describe('EditRequestForm', () => {
  beforeEach(() => {
    mutateMock.mockReset()
    mutateMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  it('Test 1 (rendering): renders heading and 4-type tab list', () => {
    renderForm()
    expect(screen.getByText('Request edit')).toBeDefined()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Add', 'Remove', 'Rename', 'Reprice'])
  })

  it('Test 2 (add default): type=add shows name + price + quantity fields', () => {
    renderForm()
    expect(screen.getByTestId('add-fields')).toBeDefined()
    expect(screen.getByLabelText('Item name')).toBeDefined()
    expect(screen.getByLabelText('Item price')).toBeDefined()
    expect(screen.getByTestId('add-qty-count').textContent?.trim()).toBe('1')
  })

  it('Test 3 (add submit): valid add fields POST correct payload', async () => {
    const onClose = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, requestId: 'r1' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderForm({ onClose })
    fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Coffee' } })
    fireEvent.change(screen.getByLabelText('Item price'), { target: { value: '3.50' } })
    fireEvent.click(screen.getByLabelText('Increase quantity'))
    fireEvent.click(screen.getByRole('button', { name: /Submit request/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/session/s1/edit-request')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({
      personId: 'p1',
      type: 'add',
      payload: { name: 'Coffee', priceCents: 350, quantity: 2 },
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(mutateMock).toHaveBeenCalled()
  })

  it('Test 4 (remove with preselected itemId): POSTs remove + itemId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, requestId: 'r2' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderForm({ initialType: 'remove', initialItemId: 'i1' })
    fireEvent.click(screen.getByRole('button', { name: /Submit request/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ personId: 'p1', type: 'remove', payload: { itemId: 'i1' } })
  })

  it('Test 5 (edit_price): POSTs newPriceCents', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, requestId: 'r3' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderForm({ initialType: 'edit_price', initialItemId: 'i1' })
    fireEvent.change(screen.getByLabelText('New price'), { target: { value: '12.99' } })
    fireEvent.click(screen.getByRole('button', { name: /Submit request/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.payload).toEqual({ itemId: 'i1', newPriceCents: 1299 })
  })

  it('Test 6 (edit_name): POSTs newName', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, requestId: 'r4' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderForm({ initialType: 'edit_name', initialItemId: 'i1' })
    fireEvent.change(screen.getByLabelText('New name'), { target: { value: 'Espresso' } })
    fireEvent.click(screen.getByRole('button', { name: /Submit request/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.payload).toEqual({ itemId: 'i1', newName: 'Espresso' })
  })

  it('Test 7 (validation — add: empty name): submit disabled', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Item price'), { target: { value: '3.50' } })
    const btn = screen.getByRole('button', { name: /Submit request/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Test 8 (validation — add: zero price): submit disabled', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('Item price'), { target: { value: '0' } })
    const btn = screen.getByRole('button', { name: /Submit request/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Test 9 (validation — add: qty zero): qty cannot go below 1 via UI', () => {
    renderForm()
    const dec = screen.getByLabelText('Decrease quantity') as HTMLButtonElement
    expect(dec.disabled).toBe(true)
  })

  it('Test 10 (error handling): fetch 400 shows "Couldn\'t send request — try again"', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'invalid' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Coffee' } })
    fireEvent.change(screen.getByLabelText('Item price'), { target: { value: '1.00' } })
    fireEvent.click(screen.getByRole('button', { name: /Submit request/i }))
    await waitFor(() => {
      expect(screen.getByText(/Couldn.t send request.*try again/i)).toBeDefined()
    })
  })

  it('Test 11 (cancel): tapping Cancel calls onClose without fetch', () => {
    const onClose = vi.fn()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderForm({ onClose })
    fireEvent.click(screen.getByLabelText('Cancel request'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
