import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { ShareLinkButton } from '@/components/wizard/ShareLinkButton'

// Mocks must not reference variables before initialization in vi.mock factories.
// Use module-level spies that are reset in beforeEach instead.
const setSessionIdMock = vi.fn()
const setHostTokenMock = vi.fn()
const routerPushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

vi.mock('@/stores/useBillStore', () => {
  const state = {
    people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
    items: [{ id: 'i1', name: 'Pizza', priceCents: 1000, quantity: 1 }],
    setSessionId: (...args: unknown[]) => setSessionIdMock(...args),
    setHostToken: (...args: unknown[]) => setHostTokenMock(...args),
  }
  const useBillStore = (selector: (s: typeof state) => unknown) => selector(state)
  useBillStore.getState = () => state
  return { useBillStore }
})

describe('ShareLinkButton — Phase 6', () => {
  beforeEach(() => {
    setSessionIdMock.mockReset()
    setHostTokenMock.mockReset()
    routerPushMock.mockReset()
    // Fake timers so we can fast-forward the 1200ms copy→redirect delay.
    // shouldAdvanceTime:true keeps real-time advancing so waitFor still works.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // jsdom doesn't provide navigator.clipboard — mock it so handleCopyLink succeeds
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    })
    // Ensure navigator.share is absent so the clipboard path is taken
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    cleanup()
  })

  it('Test 1 (label): renders "Share link" by default', () => {
    render(<ShareLinkButton />)
    expect(screen.getByRole('button', { name: /Share link/i })).toBeDefined()
  })

  it('Test 2 (POST body): POSTs /api/session with people + items (no tipPercent)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 's1', hostToken: 'host-token-abc' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ShareLinkButton />)
    fireEvent.click(screen.getByRole('button', { name: /Share link/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/session')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.people).toBeDefined()
    expect(body.items).toBeDefined()
    expect(body.tipPercent).toBeUndefined()
  })

  it('Test 3 (response handling): calls setSessionId + setHostToken + router.push', async () => {
    // The component now shows a Dialog after API success; router.push fires 1200ms
    // after the user clicks "Copy link". Trigger the full flow here.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 's1', hostToken: 'host-token-abc' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ShareLinkButton />)
    fireEvent.click(screen.getByRole('button', { name: /Share link/i }))
    // Wait for API to resolve and store state (setSessionId/setHostToken called here)
    await waitFor(() => expect(setSessionIdMock).toHaveBeenCalledWith('s1'))
    expect(setHostTokenMock).toHaveBeenCalledWith('host-token-abc')
    // Dialog should now be open with the guest URL
    expect(screen.getByRole('dialog')).toBeDefined()
    // Click "Copy link" — triggers clipboard write + schedules router.push after 1200ms
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy link/i }))
    })
    // Fast-forward the 1200ms setTimeout to fire the redirect
    await act(async () => { vi.advanceTimersByTime(1200) })
    expect(routerPushMock).toHaveBeenCalledWith('/split/s1#hostToken=host-token-abc')
  })

  it('Test 4 (no setStep / setSyncStatus): router.push is used, not step/syncStatus', async () => {
    // Same Dialog flow as Test 3 — verify router.push eventually fires (not setStep/setSyncStatus)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 's1', hostToken: 'host-token-abc' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ShareLinkButton />)
    fireEvent.click(screen.getByRole('button', { name: /Share link/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined())
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy link/i }))
    })
    await act(async () => { vi.advanceTimersByTime(1200) })
    // Only router.push was called; no setStep/setSyncStatus since they aren't in the mock state
    expect(routerPushMock).toHaveBeenCalled()
  })

  it('Test 5 (error path): non-OK response shows error, no redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', fetchMock)
    render(<ShareLinkButton />)
    fireEvent.click(screen.getByRole('button', { name: /Share link/i }))
    await waitFor(() => {
      expect(screen.getByText(/Couldn.t create session/i)).toBeDefined()
    })
    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('Test 6 (loading state): button disabled during request', async () => {
    let resolveFetch!: (v: { ok: boolean; json: () => Promise<unknown> }) => void
    const fetchPromise = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((res) => {
      resolveFetch = res
    })
    const fetchMock = vi.fn().mockReturnValue(fetchPromise)
    vi.stubGlobal('fetch', fetchMock)
    render(<ShareLinkButton />)
    const btn = screen.getByRole('button', { name: /Share link/i }) as HTMLButtonElement
    fireEvent.click(btn)
    // Button should be disabled while the fetch is in-flight
    await waitFor(() => expect(btn.disabled).toBe(true))
    // Resolve the fetch — component opens the Dialog (not an immediate redirect)
    resolveFetch({ ok: true, json: async () => ({ sessionId: 's1', hostToken: 'host-token-abc' }) })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined())
    // Complete the copy→redirect flow
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy link/i }))
    })
    await act(async () => { vi.advanceTimersByTime(1200) })
    expect(routerPushMock).toHaveBeenCalled()
  })
})
