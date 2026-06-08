import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { TipScreen } from '@/components/split/TipScreen'

// Mock next/navigation so any imported component's useRouter() doesn't throw in jsdom
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

const mutateMock = vi.fn()

function renderTip(over: Partial<Parameters<typeof TipScreen>[0]> = {}) {
  const props = {
    sessionId: 's1',
    personId: 'p1',
    itemSubtotalCents: 2000,
    currencyCode: 'USD',
    onTipConfirmed: vi.fn(),
    mutate: mutateMock,
    ...over,
  }
  return { ...render(<TipScreen {...props} />), props }
}

describe('TipScreen', () => {
  beforeEach(() => {
    mutateMock.mockReset()
    mutateMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  it('Test 1 (default tip is $0.00)', () => {
    renderTip()
    expect(screen.getByTestId('tip-amount-display').textContent?.trim()).toBe('$0.00')
  })

  it('Test 2 (preset 15% on $20 subtotal sets tip to $3.00)', () => {
    renderTip()
    fireEvent.click(screen.getByRole('button', { name: /Set tip to 15%/i }))
    expect(screen.getByTestId('tip-amount-display').textContent?.trim()).toBe('$3.00')
  })

  it('Test 3 (custom percent updates tip in real time)', () => {
    renderTip()
    const input = screen.getByLabelText('Custom tip percent')
    fireEvent.change(input, { target: { value: '12' } })
    // 12% of $20 = $2.40
    expect(screen.getByTestId('tip-amount-display').textContent?.trim()).toBe('$2.40')
  })

  it('Test 4 (total preview includes tip)', () => {
    renderTip()
    fireEvent.click(screen.getByRole('button', { name: /Set tip to 10%/i }))
    // 10% of $20 = $2.00; total = $22.00
    expect(screen.getByTestId('tip-total-display').textContent?.trim()).toBe('$22.00')
  })

  it('Test 5 (Confirm tip POSTs and calls onTipConfirmed)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const { props } = renderTip()
    fireEvent.click(screen.getByRole('button', { name: /Set tip to 20%/i }))
    fireEvent.click(screen.getByRole('button', { name: /Confirm tip/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/session/s1/tip')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ personId: 'p1', tipCents: 400 })
    await waitFor(() => expect(props.onTipConfirmed).toHaveBeenCalled())
  })

  it('Test 6 (TipScreen renders as Dialog content — no Back button)', () => {
    renderTip()
    // TipScreen is now Dialog content: it does NOT own a Back button (Dialog close is the parent's concern)
    expect(screen.queryByRole('button', { name: /^Back$/i })).toBeNull()
  })

  it('Test 7 (zero tip is valid — Confirm enabled)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    renderTip()
    const btn = screen.getByRole('button', { name: /Confirm tip/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.tipCents).toBe(0)
  })

  it('Test 8 (error path shows inline error)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'oops' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderTip()
    fireEvent.click(screen.getByRole('button', { name: /Confirm tip/i }))
    await waitFor(() => {
      expect(screen.getByText(/Couldn.t save tip/i)).toBeDefined()
    })
  })

  it('Test 9 (EUR currencyCode formats tip-amount-display and tip-total-display with euro symbol)', () => {
    renderTip({ currencyCode: 'EUR', itemSubtotalCents: 2000 })
    fireEvent.click(screen.getByRole('button', { name: /Set tip to 10%/i }))
    // 10% of €20 = €2.00 tip; total = €22.00
    const tipDisplay = screen.getByTestId('tip-amount-display').textContent?.trim() ?? ''
    const totalDisplay = screen.getByTestId('tip-total-display').textContent?.trim() ?? ''
    expect(tipDisplay).toContain('€')
    expect(totalDisplay).toContain('€')
  })
})
