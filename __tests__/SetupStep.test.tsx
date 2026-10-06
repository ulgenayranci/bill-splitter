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
describe('SetupStep — scanned bill review container + auto-open edit screen', () => {
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

  const scanOnce = (subtotal: number, itemCents: number) => {
    const fetchMock = mockScan(
      {
        items: [{ name: 'Widget', quantity: 1, unitPriceCents: itemCents, lineTotalCents: null }],
        currencyCode: 'USD',
        subtotalCents: subtotal,
        grandTotalCents: subtotal,
      },
      [{ rawName: 'Widget', displayName: 'Widget', priceCents: itemCents, confidence: 'high', quantity: 1 }],
    )
    renderInProvider(<SetupStep />)
    fireEvent.change(screen.getByTestId('ocr-file-input'), {
      target: { files: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })] },
    })
    return fetchMock
  }

  it('mismatch → persists scanCheck, opens the edit screen (step 2), no in-page review list', async () => {
    const fetchMock = scanOnce(1500, 1000)

    await waitFor(() => expect(useBillStore.getState().step).toBe(2))
    // Items were written before the step flipped (page.tsx falls back to step 1 on empty items).
    expect(useBillStore.getState().items.length).toBe(1)
    expect(useBillStore.getState().scanCheck).toMatchObject({
      mismatch: true,
      targetCents: 1500,
      hasSubtotal: true,
    })
    expect(screen.queryByTestId('scan-review')).toBeNull()

    fetchMock.mockRestore()
  })

  it('clean scan → stays on step 1 with the scanned bill review container + Retake/Edit', async () => {
    const fetchMock = scanOnce(1500, 1500)

    await waitFor(() => expect(useBillStore.getState().items.length).toBe(1))
    await screen.findByTestId('scanned-bill-review')
    expect(useBillStore.getState().step).toBe(1)
    expect(useBillStore.getState().scanCheck?.mismatch).toBe(false)
    expect(screen.queryByTestId('scan-review')).toBeNull()
    expect(screen.getByRole('button', { name: /retake/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeDefined()

    fetchMock.mockRestore()
  })

  /** Scan with custom OCR lines (all line totals) + expand passthrough. */
  function scanLines(
    lines: { name: string; cents: number; confidence?: 'high' | 'low' }[],
    totals: { subtotalCents: number | null; grandTotalCents: number | null },
    expandOk = true,
  ) {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.includes('/api/ocr')) {
        return new Response(
          JSON.stringify({
            items: lines.map((l) => ({
              name: l.name,
              quantity: 1,
              unitPriceCents: null,
              lineTotalCents: l.cents,
              confidence: l.confidence,
            })),
            currencyCode: 'USD',
            ...totals,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/api/expand')) {
        if (!expandOk) return new Response('', { status: 500 })
        return new Response(
          JSON.stringify({
            items: lines.map((l) => ({
              rawName: l.name,
              displayName: l.name,
              priceCents: l.cents,
              confidence: 'high',
              quantity: 1,
            })),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('', { status: 404 })
    })
    renderInProvider(<SetupStep />)
    fireEvent.change(screen.getByTestId('ocr-file-input'), {
      target: { files: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })] },
    })
    return fetchMock
  }

  it('OCR guardrails: totals match but a low-confidence line forces review with a flag', async () => {
    const fetchMock = scanLines(
      [
        { name: 'Burger', cents: 1000 },
        { name: 'Fries', cents: 500, confidence: 'low' },
      ],
      { subtotalCents: 1500, grandTotalCents: 1500 },
    )
    await waitFor(() => expect(useBillStore.getState().step).toBe(2))
    const [burger, fries] = useBillStore.getState().items
    expect(burger.scanFlag).toBeUndefined()
    expect(fries.scanFlag).toBe('Hard to read')
    fetchMock.mockRestore()
  })

  it('OCR guardrails: no printed subtotal or total forces review (targetCents null)', async () => {
    const fetchMock = scanLines([{ name: 'Burger', cents: 1000 }], {
      subtotalCents: null,
      grandTotalCents: null,
    })
    await waitFor(() => expect(useBillStore.getState().step).toBe(2))
    expect(useBillStore.getState().scanCheck?.targetCents).toBeNull()
    fetchMock.mockRestore()
  })

  it('OCR guardrails: a line named TOTAL is flagged as a total/tax line', async () => {
    const fetchMock = scanLines(
      [
        { name: 'Burger', cents: 1000 },
        { name: 'TOTAL', cents: 500 },
      ],
      { subtotalCents: 1500, grandTotalCents: 1500 },
    )
    await waitFor(() => expect(useBillStore.getState().step).toBe(2))
    expect(useBillStore.getState().items[1].scanFlag).toBe('Looks like a total/tax line')
    fetchMock.mockRestore()
  })

  it('OCR guardrails: the expand-failure fallback applies the same flags and routing', async () => {
    const fetchMock = scanLines(
      [
        { name: 'Burger', cents: 1000 },
        { name: 'Fries', cents: 500, confidence: 'low' },
      ],
      { subtotalCents: 1500, grandTotalCents: 1500 },
      false,
    )
    await waitFor(() => expect(useBillStore.getState().step).toBe(2))
    expect(useBillStore.getState().items[1].scanFlag).toBe('Hard to read')
    fetchMock.mockRestore()
  })

  it('service fee: grand-total-minus-fee reconciles (no mismatch), fee stored, status shown, cleared on retake', async () => {
    const fetchMock = mockScan(
      {
        items: [{ name: 'Steak', quantity: 1, unitPriceCents: 2000, lineTotalCents: null }],
        currencyCode: 'EUR',
        subtotalCents: null,
        grandTotalCents: 2500,
        serviceFeeCents: 500,
      },
      [{ rawName: 'Steak', displayName: 'Steak', priceCents: 2000, confidence: 'high', quantity: 1 }],
    )
    renderInProvider(<SetupStep />)
    fireEvent.change(screen.getByTestId('ocr-file-input'), {
      target: { files: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => expect(useBillStore.getState().items.length).toBe(1))
    await screen.findByTestId('scanned-bill-review')
    expect(useBillStore.getState().scanCheck?.mismatch).toBe(false)
    expect(useBillStore.getState().scanCheck?.targetCents).toBe(2000)
    expect(useBillStore.getState().step).toBe(1)
    expect(useBillStore.getState().serviceFeeCents).toBe(500)
    expect(screen.getByTestId('service-fee-status').textContent).toMatch(/5\.00/)

    fireEvent.click(screen.getByRole('button', { name: /retake/i }))
    expect(useBillStore.getState().serviceFeeCents).toBeNull()
    fetchMock.mockRestore()
  })

  it('tax: grand-total-minus-tax reconciles (no mismatch), tax stored, status shown, cleared on retake', async () => {
    const fetchMock = mockScan(
      {
        items: [{ name: 'Steak', quantity: 1, unitPriceCents: 10000, lineTotalCents: null }],
        currencyCode: 'USD',
        subtotalCents: null,
        grandTotalCents: 10800,
        taxCents: 800,
      },
      [{ rawName: 'Steak', displayName: 'Steak', priceCents: 10000, confidence: 'high', quantity: 1 }],
    )
    renderInProvider(<SetupStep />)
    fireEvent.change(screen.getByTestId('ocr-file-input'), {
      target: { files: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => expect(useBillStore.getState().items.length).toBe(1))
    await screen.findByTestId('scanned-bill-review')
    expect(useBillStore.getState().scanCheck?.mismatch).toBe(false)
    expect(useBillStore.getState().scanCheck?.targetCents).toBe(10000)
    expect(useBillStore.getState().taxCents).toBe(800)
    expect(screen.getByTestId('tax-status').textContent).toBe(
      'Tax $8.00 found, split equally between everyone.',
    )

    fireEvent.click(screen.getByRole('button', { name: /retake/i }))
    expect(useBillStore.getState().taxCents).toBeNull()
    fetchMock.mockRestore()
  })

  it('tax: null / absent / zero / float from OCR leave taxCents null and no status line', async () => {
    for (const v of [null, undefined, 0, 12.5]) {
      useBillStore.getState().reset()
      const fetchMock = mockScan(
        {
          items: [{ name: 'Steak', quantity: 1, unitPriceCents: 2000, lineTotalCents: null }],
          currencyCode: 'USD',
          subtotalCents: 2000,
          grandTotalCents: 2000,
          taxCents: v,
        },
        [{ rawName: 'Steak', displayName: 'Steak', priceCents: 2000, confidence: 'high', quantity: 1 }],
      )
      renderInProvider(<SetupStep />)
      fireEvent.change(screen.getByTestId('ocr-file-input'), {
        target: { files: [new File(['x'], 'r.jpg', { type: 'image/jpeg' })] },
      })
      await waitFor(() => expect(useBillStore.getState().items.length).toBe(1))
      await screen.findByTestId('scanned-bill-review')
      expect(useBillStore.getState().taxCents).toBeNull()
      expect(screen.queryByTestId('tax-status')).toBeNull()
      fetchMock.mockRestore()
      cleanup()
    }
  })

  it('Edit button opens the edit screen (step 2)', () => {
    seedPriorScan()
    renderInProvider(<SetupStep />)
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(useBillStore.getState().step).toBe(2)
  })

  it('Retake clears scanCheck and opens the file picker', () => {
    seedPriorScan()
    useBillStore.getState().setScanCheck({
      correctedCount: 0,
      mismatch: true,
      targetCents: 5000,
      hasSubtotal: true,
    })
    renderInProvider(<SetupStep />)
    const clickSpy = vi.spyOn(screen.getByTestId('ocr-file-input') as HTMLInputElement, 'click')
    fireEvent.click(screen.getByRole('button', { name: /retake/i }))
    expect(useBillStore.getState().scanCheck).toBeNull()
    expect(clickSpy).toHaveBeenCalled()
  })

  it('shows a compact thumbnail, the item count and the items total', () => {
    seedPriorScan()
    renderInProvider(<SetupStep />)
    const photo = screen.getByRole('button', { name: /view bill photo/i })
    expect(photo.className).toContain('h-14')
    expect(screen.getByText('2 items found')).toBeTruthy()
    expect(screen.getByTestId('scanned-items-total').textContent).toContain('17.98')
    expect(screen.getByRole('button', { name: 'Retake' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('previews the first 3 items with a "Show all" toggle when there are more', () => {
    const store = useBillStore.getState()
    store.setItems(
      ['A', 'B', 'C', 'D', 'E'].map((n, i) => ({
        id: `i${i}`, name: `Dish ${n}`, priceCents: 1000, quantity: 1, confidence: 'high' as const,
      })),
    )
    store.setBillImage('data:image/jpeg;base64,PRIOR')
    renderInProvider(<SetupStep />)
    const preview = screen.getByTestId('scanned-items-preview')
    expect(preview.querySelectorAll('li')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 5' }))
    expect(preview.querySelectorAll('li')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(preview.querySelectorAll('li')).toHaveLength(3)
  })

  it('has no "Show all" toggle when every item already fits', () => {
    seedPriorScan()
    renderInProvider(<SetupStep />)
    expect(screen.getByTestId('scanned-items-preview').querySelectorAll('li')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /show all/i })).toBeNull()
  })

  it('says "matches receipt" when items equal the receipt target, else "off by"', () => {
    seedPriorScan()
    const store = useBillStore.getState()
    store.setScanCheck({ correctedCount: 0, mismatch: false, targetCents: 1798, hasSubtotal: true })
    const { unmount } = renderInProvider(<SetupStep />)
    expect(screen.getByTestId('scanned-items-total').textContent).toContain('matches receipt')
    unmount()
    store.setScanCheck({ correctedCount: 0, mismatch: true, targetCents: 2000, hasSubtotal: true })
    renderInProvider(<SetupStep />)
    expect(screen.getByTestId('scanned-items-total').textContent).toContain('off by')
  })

  it('"Confirm & continue" proceeds while a gap remains (soft gate, from persisted scanCheck)', () => {
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    seedPriorScan()
    useBillStore.getState().setScanCheck({
      correctedCount: 0,
      mismatch: true,
      targetCents: 5000,
      hasSubtotal: true,
    })

    renderInProvider(<SetupStep />)
    const cta = screen.getByRole('button', { name: /confirm & continue/i }) as HTMLButtonElement
    expect(cta.disabled).toBe(false)
    expect(screen.getByTestId('scan-review-still-off')).toBeDefined()
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

  it('Continue passes serviceFeeCents to createSession', async () => {
    seedPriorScan()
    useBillStore.getState().setServiceFeeCents(500)
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    createSession.mockResolvedValue({
      sessionId: 'sess-fee',
      guestUrl: 'http://localhost/split/sess-fee',
    })
    renderInProvider(<SetupStep />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start splitting/i }))
    })
    await waitFor(() => expect(createSession).toHaveBeenCalled())
    expect(createSession.mock.calls[0][0]).toMatchObject({ serviceFeeCents: 500 })
  })

  it('Continue passes taxCents to createSession', async () => {
    seedPriorScan()
    useBillStore.getState().setTaxCents(800)
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    createSession.mockResolvedValue({
      sessionId: 'sess-tax',
      guestUrl: 'http://localhost/split/sess-tax',
    })
    renderInProvider(<SetupStep />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start splitting/i }))
    })
    await waitFor(() => expect(createSession).toHaveBeenCalled())
    expect(createSession.mock.calls[0][0]).toMatchObject({ taxCents: 800 })
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
