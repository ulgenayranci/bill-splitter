import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { Toast } from '@base-ui/react/toast'
import { ShareLinkButton } from '@/components/wizard/ShareLinkButton'
import { useBillStore } from '@/stores/useBillStore'

function renderInProvider(ui: React.ReactElement) {
  return render(<Toast.Provider>{ui}</Toast.Provider>)
}

describe('ShareLinkButton', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
    useBillStore.getState().addPerson('Alice')
    useBillStore.getState().addPerson('Bob')
    useBillStore.getState().addItem('Pizza', 1500)
    useBillStore.getState().setTipPercent(18)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('Test 1: Renders with label "Share link"', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: 'abc123' }) }))
    renderInProvider(<ShareLinkButton />)
    expect(screen.getByRole('button', { name: /share link/i })).toBeDefined()
    vi.unstubAllGlobals()
  })

  it('Test 2: On click, calls global fetch with /api/session POST and body containing people, items, tipPercent from the store', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: 'abc123' }) })
    vi.stubGlobal('fetch', mockFetch)
    renderInProvider(<ShareLinkButton />)
    fireEvent.click(screen.getByRole('button', { name: /share link/i }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/session',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      )
      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.people).toBeDefined()
      expect(body.items).toBeDefined()
      expect(body.tipPercent).toBeDefined()
    })
    vi.unstubAllGlobals()
  })

  it('Test 3: On fetch resolving with { sessionId: "abc123" }, store ends with sessionId === "abc123", syncStatus === "waiting", step === 5', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: 'abc123' }) })
    vi.stubGlobal('fetch', mockFetch)
    renderInProvider(<ShareLinkButton />)
    fireEvent.click(screen.getByRole('button', { name: /share link/i }))
    await waitFor(() => {
      const state = useBillStore.getState()
      expect(state.sessionId).toBe('abc123')
      expect(state.syncStatus).toBe('waiting')
      expect(state.step).toBe(5)
    })
    vi.unstubAllGlobals()
  })

  it('Test 4: On fetch returning 500, store remains syncStatus === "idle" and button is re-enabled', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', mockFetch)
    renderInProvider(<ShareLinkButton />)
    fireEvent.click(screen.getByRole('button', { name: /share link/i }))
    await waitFor(() => {
      const state = useBillStore.getState()
      expect(state.syncStatus).toBe('idle')
      // Button should be re-enabled
      const btn = screen.getByRole('button', { name: /share link/i })
      expect(btn.hasAttribute('disabled')).toBe(false)
    })
    vi.unstubAllGlobals()
  })

  it('Test 5: While the POST is in-flight, the button is disabled', async () => {
    let resolve: (value: unknown) => void
    const pendingPromise = new Promise((res) => { resolve = res })
    const mockFetch = vi.fn().mockReturnValue(pendingPromise)
    vi.stubGlobal('fetch', mockFetch)
    renderInProvider(<ShareLinkButton />)
    fireEvent.click(screen.getByRole('button', { name: /share link/i }))
    // After click, button should be disabled during the in-flight POST
    await waitFor(() => {
      const btn = screen.getByRole('button')
      expect(btn.hasAttribute('disabled')).toBe(true)
    })
    // Resolve so cleanup doesn't hang
    resolve!({ ok: true, json: async () => ({ sessionId: 'abc123' }) })
    vi.unstubAllGlobals()
  })
})
