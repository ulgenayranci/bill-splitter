import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { Toast } from '@base-ui/react/toast'
import { SetupStep } from '@/components/wizard/SetupStep'
import { useBillStore } from '@/stores/useBillStore'

// ESM-compatible mock for browser-image-compression default export
vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}))

const routerPushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

// Mock createSession so tests don't hit a real network
vi.mock('@/lib/createSession', () => ({
  createSession: vi.fn(),
}))

function renderInProvider(ui: React.ReactElement) {
  return render(<Toast.Provider>{ui}</Toast.Provider>)
}

// Synchronous FileReader stub so handleFileChange reaches the OCR fetch.
class StubFR {
  onloadend: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  result: string | ArrayBuffer | null = null
  readAsDataURL() {
    this.result = 'data:image/jpeg;base64,FAKEBASE64'
    queueMicrotask(() => this.onloadend?.())
  }
}

/** Seed the store as if a prior successful scan landed items + a photo. */
function seedPriorScan() {
  const store = useBillStore.getState()
  store.setItems([
    { id: 'i1', name: 'Burger', priceCents: 1299, quantity: 1, confidence: 'high' },
    { id: 'i2', name: 'Fries', priceCents: 499, quantity: 1, confidence: 'high' },
  ])
  store.setBillImage('data:image/jpeg;base64,PRIOR')
}

describe('SetupStep — GAP 6 failed/empty re-scan clears items', () => {
  let origFR: typeof FileReader

  beforeEach(() => {
    useBillStore.getState().reset()
    origFR = global.FileReader
    ;(global as unknown as { FileReader: typeof StubFR }).FileReader = StubFR
  })

  afterEach(() => {
    cleanup()
    ;(global as unknown as { FileReader: typeof origFR }).FileReader = origFR
    vi.restoreAllMocks()
  })

  it('empty scan ({ items: [] }) clears prior items so billScanned becomes false', async () => {
    seedPriorScan()
    expect(useBillStore.getState().items.length).toBe(2)

    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.includes('/api/ocr')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('', { status: 404 })
    })

    renderInProvider(<SetupStep />)
    const fileInput = screen.getByTestId('ocr-file-input') as HTMLInputElement
    const file = new File(['x'], 'r.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    expect(useBillStore.getState().items.length).toBe(0)
    expect(useBillStore.getState().ocrStatus).toBe('error')

    fetchMock.mockRestore()
  })

  it('error scan (rejected fetch) clears prior items via the catch path', async () => {
    seedPriorScan()
    expect(useBillStore.getState().items.length).toBe(2)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'OCR failed' }), { status: 500 }),
    )

    renderInProvider(<SetupStep />)
    const fileInput = screen.getByTestId('ocr-file-input') as HTMLInputElement
    const file = new File(['x'], 'r.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    expect(useBillStore.getState().items.length).toBe(0)
    expect(useBillStore.getState().ocrStatus).toBe('error')

    fetchMock.mockRestore()
    consoleSpy.mockRestore()
  })

})

// ── Scan-review/confirm screen (260622-q3m) ──────────────────────────────────
describe('SetupStep — scan-review screen on a failed reconciliation', () => {
  let origFR: typeof FileReader

  beforeEach(() => {
    useBillStore.getState().reset()
    origFR = global.FileReader
    ;(global as unknown as { FileReader: typeof StubFR }).FileReader = StubFR
  })

  afterEach(() => {
    cleanup()
    ;(global as unknown as { FileReader: typeof origFR }).FileReader = origFR
    vi.restoreAllMocks()
  })

  /** Mock OCR (mismatch by default) + expand passthrough, then trigger a scan. */
  function mockScan(
    ocrPayload: Record<string, unknown>,
    expandItems: { rawName: string; displayName: string; priceCents: number; confidence: string; quantity: number }[],
  ) {
    return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.includes('/api/ocr')) {
        return new Response(JSON.stringify(ocrPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/expand')) {
        return new Response(JSON.stringify({ items: expandItems }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('', { status: 404 })
    })
  }

  it('mismatch → renders the editable review block with the live gap', async () => {
    const fetchMock = mockScan(
      {
        items: [{ name: 'Widget', quantity: 1, unitPriceCents: 1000, lineTotalCents: null }],
        currencyCode: 'USD',
        subtotalCents: 1500,
        grandTotalCents: 1500,
      },
      [{ rawName: 'Widget', displayName: 'Widget', priceCents: 1000, confidence: 'high', quantity: 1 }],
    )

    renderInProvider(<SetupStep />)
    fireEvent.change(screen.getByTestId('ocr-file-input'), {
      target: { files: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })] },
    })

    const review = await screen.findByTestId('scan-review')
    expect(review.textContent).toContain('Please confirm or edit these detected items')
    // Editable controls present.
    expect(screen.getByLabelText('Item name')).toBeDefined()
    expect(screen.getByLabelText('Price')).toBeDefined()
    expect(screen.getByLabelText('Quantity')).toBeDefined()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDefined()
    // Live gap line.
    const gap = screen.getByTestId('scan-review-gap')
    expect(gap.textContent).toContain('$10.00')
    expect(gap.textContent).toContain('$15.00')
    expect(gap.textContent).toContain('$5.00')

    fetchMock.mockRestore()
  })

  it('editing the price to match the receipt clears the gap and removes review mode', async () => {
    const fetchMock = mockScan(
      {
        items: [{ name: 'Widget', quantity: 1, unitPriceCents: 1000, lineTotalCents: null }],
        currencyCode: 'USD',
        subtotalCents: 1500,
        grandTotalCents: 1500,
      },
      [{ rawName: 'Widget', displayName: 'Widget', priceCents: 1000, confidence: 'high', quantity: 1 }],
    )

    renderInProvider(<SetupStep />)
    fireEvent.change(screen.getByTestId('ocr-file-input'), {
      target: { files: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })] },
    })

    await screen.findByTestId('scan-review')
    const priceInput = screen.getByLabelText('Price') as HTMLInputElement
    // Edit the single item up to 15.00 so items sum == receipt 15.00.
    fireEvent.change(priceInput, { target: { value: '15.00' } })
    fireEvent.blur(priceInput)

    await waitFor(() => expect(useBillStore.getState().items[0].priceCents).toBe(1500))
    // Gap now within tolerance → the "still off" hint is gone.
    expect(screen.queryByTestId('scan-review-still-off')).toBeNull()

    fetchMock.mockRestore()
  })

  it('clean scan → no review block', async () => {
    const fetchMock = mockScan(
      {
        items: [{ name: 'Widget', quantity: 1, unitPriceCents: 1500, lineTotalCents: null }],
        currencyCode: 'USD',
        subtotalCents: 1500,
        grandTotalCents: 1500,
      },
      [{ rawName: 'Widget', displayName: 'Widget', priceCents: 1500, confidence: 'high', quantity: 1 }],
    )

    renderInProvider(<SetupStep />)
    fireEvent.change(screen.getByTestId('ocr-file-input'), {
      target: { files: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })] },
    })

    // Wait for the scan to land (item count chip appears) then assert no review.
    await waitFor(() => expect(useBillStore.getState().items.length).toBe(1))
    expect(screen.queryByTestId('scan-review')).toBeNull()

    fetchMock.mockRestore()
  })

  it('"Confirm & continue" proceeds while a gap remains (soft gate)', async () => {
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')

    const fetchMock = mockScan(
      {
        items: [{ name: 'Widget', quantity: 1, unitPriceCents: 1000, lineTotalCents: null }],
        currencyCode: 'USD',
        subtotalCents: 1500,
        grandTotalCents: 1500,
      },
      [{ rawName: 'Widget', displayName: 'Widget', priceCents: 1000, confidence: 'high', quantity: 1 }],
    )

    renderInProvider(<SetupStep />)
    fireEvent.change(screen.getByTestId('ocr-file-input'), {
      target: { files: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })] },
    })

    await screen.findByTestId('scan-review')
    // CTA relabeled in review mode, enabled, and the soft-gate hint is visible.
    const cta = screen.getByRole('button', { name: /confirm & continue/i }) as HTMLButtonElement
    expect(cta.disabled).toBe(false)
    expect(screen.getByTestId('scan-review-still-off')).toBeDefined()

    fetchMock.mockRestore()
  })
})

describe('SetupStep — GAPs 4/5/7 copy + chip + inline error', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
    routerPushMock.mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it('renders a people-count chip bound to people.length', () => {
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    renderInProvider(<SetupStep />)
    const chip = screen.getByTestId('people-count-chip')
    expect(chip.textContent).toBe('2')
  })

  it('the people-count chip renders 0 with no people', () => {
    renderInProvider(<SetupStep />)
    expect(screen.getByTestId('people-count-chip').textContent).toBe('0')
  })

  it('the Continue button label is "Start splitting" (retired "Continue to Assign")', () => {
    renderInProvider(<SetupStep />)
    const cta = screen.getByRole('button', { name: /start splitting/i })
    expect(cta.textContent?.trim()).toBe('Start splitting')
  })

  it('does not render the removed "Add people now or after scanning." helper text', () => {
    renderInProvider(<SetupStep />)
    expect(screen.queryByText(/add people now or after scanning/i)).toBeNull()
  })
})

describe('SetupStep — Continue creates session and navigates to /split/[sessionId]', () => {
  let createSession: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    useBillStore.getState().reset()
    routerPushMock.mockReset()
    // Get reference to the mocked createSession
    const mod = await import('@/lib/createSession')
    createSession = mod.createSession as ReturnType<typeof vi.fn>
    createSession.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('Continue is disabled when billScanned is false (D-11 gate)', () => {
    // No items seeded → billScanned false
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    renderInProvider(<SetupStep />)
    const btn = screen.getByRole('button', { name: /start splitting/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Continue is disabled when people.length < 2 (D-11 gate)', () => {
    seedPriorScan()
    useBillStore.getState().addPerson('Alice')
    renderInProvider(<SetupStep />)
    const btn = screen.getByRole('button', { name: /start splitting/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Continue calls createSession and router.push to /split/[sessionId]', async () => {
    seedPriorScan()
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    createSession.mockResolvedValue({
      sessionId: 'sess-abc',
      guestUrl: 'http://localhost/split/sess-abc',
    })

    renderInProvider(<SetupStep />)
    const btn = screen.getByRole('button', { name: /start splitting/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)

    await act(async () => {
      fireEvent.click(btn)
    })

    await waitFor(() => expect(createSession).toHaveBeenCalled())
    await waitFor(() => expect(routerPushMock).toHaveBeenCalledWith('/split/sess-abc'))
    expect(useBillStore.getState().sessionId).toBe('sess-abc')
  })

  it('failed createSession shows inline error and does NOT navigate', async () => {
    seedPriorScan()
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    createSession.mockRejectedValue(new Error('Session creation failed: 500'))

    renderInProvider(<SetupStep />)
    const btn = screen.getByRole('button', { name: /start splitting/i }) as HTMLButtonElement

    await act(async () => {
      fireEvent.click(btn)
    })

    await waitFor(() =>
      expect(screen.getByText(/Couldn.t create session/i)).toBeDefined()
    )
    expect(routerPushMock).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('SetupStep — G5 name entry (inline + button + Enter)', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows an always-visible "Add person" button next to the name input', () => {
    renderInProvider(<SetupStep />)
    expect(screen.getByPlaceholderText('Add a name…')).toBeDefined()
    expect(screen.getByRole('button', { name: /add person/i })).toBeDefined()
  })

  it('tapping the + button adds the person', () => {
    renderInProvider(<SetupStep />)
    fireEvent.change(screen.getByPlaceholderText('Add a name…'), { target: { value: 'Dave' } })
    fireEvent.click(screen.getByRole('button', { name: /add person/i }))
    expect(useBillStore.getState().people.some((p) => p.name === 'Dave')).toBe(true)
  })

  it('pressing Enter in the name input also adds the person', () => {
    renderInProvider(<SetupStep />)
    const input = screen.getByPlaceholderText('Add a name…')
    fireEvent.change(input, { target: { value: 'Carol' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useBillStore.getState().people.some((p) => p.name === 'Carol')).toBe(true)
  })
})

describe('SetupStep — G3 expired-link landing notice', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
    window.history.replaceState(null, '', '/')
  })
  afterEach(() => {
    cleanup()
    window.history.replaceState(null, '', '/')
    vi.restoreAllMocks()
  })

  it('shows the expired notice when arriving with ?expired=1 and strips the param', () => {
    window.history.replaceState(null, '', '/?expired=1')
    renderInProvider(<SetupStep />)
    expect(screen.getByTestId('expired-notice')).toBeDefined()
    // param stripped so a refresh won't re-show the notice
    expect(window.location.search).toBe('')
  })

  it('does NOT show the expired notice on a normal visit', () => {
    renderInProvider(<SetupStep />)
    expect(screen.queryByTestId('expired-notice')).toBeNull()
  })

  it('the expired notice is dismissible', () => {
    window.history.replaceState(null, '', '/?expired=1')
    renderInProvider(<SetupStep />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByTestId('expired-notice')).toBeNull()
  })
})
