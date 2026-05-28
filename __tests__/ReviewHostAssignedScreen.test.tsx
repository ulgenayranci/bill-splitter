import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ReviewHostAssignedScreen } from '@/components/split/ReviewHostAssignedScreen'
import type { SessionPayload } from '@/lib/sessionSchema'

const mutateMock = vi.fn()

function makeSession(over: Partial<SessionPayload> = {}): SessionPayload {
  return {
    people: [
      { id: 'p1', name: 'Alice', colorIndex: 0 },
      { id: 'p2', name: 'Bob', colorIndex: 1 },
    ],
    items: [
      { id: 'i1', name: 'Pizza', priceCents: 1000, quantity: 1 },
      { id: 'i2', name: 'Beer', priceCents: 500, quantity: 1 },
    ],
    claims: {
      items: {
        i1: { p1: { qty: 1, assignedBy: 'host' } },
        i2: { p2: { qty: 1, assignedBy: 'self' } },
      },
      personSlots: { p1: true, p2: true },
      donePeople: { p1: true },
    },
    hostToken: 'host-token-abc',
    hostPersonId: 'p1',
    tips: {},
    editRequests: {},
    disputes: {},
    createdAt: Date.now(),
    ...over,
  }
}

function renderScreen(over: Partial<Parameters<typeof ReviewHostAssignedScreen>[0]> = {}) {
  const props = {
    session: makeSession(),
    sessionId: 's1',
    personId: 'p1' as const,
    onAcceptAll: vi.fn(),
    onBack: vi.fn(),
    mutate: mutateMock,
    ...over,
  }
  return { ...render(<ReviewHostAssignedScreen {...props} />), props }
}

describe('ReviewHostAssignedScreen', () => {
  beforeEach(() => {
    mutateMock.mockReset()
    mutateMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  it('Test 1 (rendering): renders heading and one host-assigned row', () => {
    renderScreen()
    expect(screen.getByText('Review assigned items')).toBeDefined()
    expect(screen.getByTestId('review-row-i1')).toBeDefined()
    expect(screen.queryByTestId('review-row-i2')).toBeNull()
  })

  it('Test 2 (row content): row shows item name, price, Accept + Dispute', () => {
    renderScreen()
    expect(screen.getByText('Pizza')).toBeDefined()
    expect(screen.getByText('$10.00')).toBeDefined()
    expect(screen.getByRole('button', { name: /Accept Pizza/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Dispute Pizza/i })).toBeDefined()
  })

  it('Test 3 (accept one): tapping Accept POSTs /accept and calls mutate', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /Accept Pizza/i }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/session/s1/accept')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ personId: 'p1', itemId: 'i1' })
    expect(mutateMock).toHaveBeenCalled()
  })

  it('Test 3b (accept persistence): accepted items (accepted:true in session) are excluded from the list', () => {
    const session = makeSession({
      claims: {
        items: {
          i1: { p1: { qty: 1, assignedBy: 'host', accepted: true } },
          i2: { p2: { qty: 1, assignedBy: 'self' } },
        },
        personSlots: { p1: true, p2: true },
        donePeople: { p1: true },
      },
    })
    renderScreen({ session })
    expect(screen.queryByTestId('review-row-i1')).toBeNull()
  })

  it('Test 4 (dispute): POSTs /dispute and shows Waiting for host… state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, disputeId: 'd1' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /Dispute Pizza/i }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/session/s1/dispute')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ personId: 'p1', itemId: 'i1' })
    await waitFor(() => {
      expect(screen.getByTestId('review-pending-i1')).toBeDefined()
      const waitingEls = screen.getAllByText(/Waiting for host/i); expect(waitingEls.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('Test 5 (accept all): clicking Accept all and continue calls onAcceptAll', () => {
    const { props } = renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /Accept all and continue/i }))
    expect(props.onAcceptAll).toHaveBeenCalledTimes(1)
  })

  it('Test 6 (back): Back to claiming calls onBack', () => {
    const { props } = renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /Back to claiming/i }))
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('Test 7 (dispute fetch failure): inline error shown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'oops' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /Dispute Pizza/i }))
    await waitFor(() => {
      expect(screen.getByText(/Couldn.t submit dispute/i)).toBeDefined()
    })
  })
})
