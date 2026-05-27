import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { HostPanel } from '@/components/split/HostPanel'
import type { SessionPayload } from '@/lib/sessionSchema'
import type { Person, PersonId } from '@/stores/useBillStore'

const mutateMock = vi.fn()

const p1: Person = { id: 'p1', name: 'Alice', colorIndex: 0 }
const p2: Person = { id: 'p2', name: 'Bob', colorIndex: 1 }
const p3: Person = { id: 'p3', name: 'Carol', colorIndex: 2 }
const peopleById: Record<PersonId, Person> = { p1, p2, p3 }

function makeSession(over: Partial<SessionPayload> = {}): SessionPayload {
  return {
    people: [p1, p2, p3],
    items: [
      { id: 'i1', name: 'Pizza', priceCents: 1000, quantity: 1 },
      { id: 'i2', name: 'Pitcher', priceCents: 2400, quantity: 4 },
    ],
    claims: { items: {}, personSlots: {}, donePeople: {} },
    hostToken: 'host-token-abc',
    hostPersonId: undefined,
    tips: {},
    editRequests: {},
    disputes: {},
    createdAt: Date.now(),
    ...over,
  }
}

function renderPanel(session: SessionPayload, open = true) {
  return render(
    <HostPanel
      session={session}
      sessionId="s1"
      hostToken="host-token-abc"
      peopleById={peopleById}
      mutate={mutateMock}
      open={open}
      onOpenChange={() => {}}
    />
  )
}

describe('HostPanel', () => {
  beforeEach(() => {
    mutateMock.mockReset()
    mutateMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  it('Test 1 (rendering): renders heading + 3 tabs', () => {
    renderPanel(makeSession())
    expect(screen.getByText('Host controls')).toBeDefined()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs[0].textContent).toMatch(/Edit Requests/)
    expect(tabs[1].textContent).toMatch(/Unclaimed/)
    expect(tabs[2].textContent).toMatch(/Disputes/)
  })

  it('Test 2 (badge counts): tab badges reflect pending counts', () => {
    const session = makeSession({
      editRequests: {
        r1: { personId: 'p1', type: 'add', payload: { name: 'X', priceCents: 100, quantity: 1 }, status: 'pending', createdAt: 1 },
        r2: { personId: 'p2', type: 'remove', payload: { itemId: 'i1' }, status: 'pending', createdAt: 2 },
      },
      disputes: {
        d1: { itemId: 'i1', personId: 'p1', status: 'pending', createdAt: 3 },
        d2: { itemId: 'i2', personId: 'p2', status: 'pending', createdAt: 4 },
        d3: { itemId: 'i1', personId: 'p3', status: 'pending', createdAt: 5 },
      },
      // i1 unclaimed (qty 1, claims none), i2 unclaimed (qty 4, claims none) → 2 unclaimed rows
    })
    renderPanel(session)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].textContent).toMatch(/2/)
    expect(tabs[1].textContent).toMatch(/2/)
    expect(tabs[2].textContent).toMatch(/3/)
  })

  it('Test 3 (default tab): Edit Requests tab is selected by default', () => {
    renderPanel(makeSession())
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
  })

  it('Test 4 (approve): clicking Approve POSTs decision: approved + hostToken and calls mutate', async () => {
    const session = makeSession({
      editRequests: {
        r1: { personId: 'p1', type: 'edit_price', payload: { itemId: 'i1', newPriceCents: 1200 }, status: 'pending', createdAt: 1 },
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel(session)
    fireEvent.click(screen.getByRole('button', { name: /Approve edit request r1/i }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/session/s1/resolve-edit')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ requestId: 'r1', decision: 'approved', hostToken: 'host-token-abc' })
    await waitFor(() => expect(mutateMock).toHaveBeenCalled())
  })

  it('Test 5 (reject two-tap): first Reject reveals Confirm reject?, second posts decision: rejected', async () => {
    const session = makeSession({
      editRequests: {
        r1: { personId: 'p1', type: 'remove', payload: { itemId: 'i1' }, status: 'pending', createdAt: 1 },
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel(session)
    fireEvent.click(screen.getByRole('button', { name: /Reject edit request r1/i }))
    expect(screen.getByRole('button', { name: /Confirm reject edit request r1/i })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Confirm reject edit request r1/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.decision).toBe('rejected')
  })

  it('Test 6 (unclaimed assignment with proportional split): assigning 2 people to a 3-remaining item POSTs qty 2 and qty 1', async () => {
    const session = makeSession({
      items: [{ id: 'i2', name: 'Pitcher', priceCents: 2400, quantity: 3 }],
      claims: { items: {}, personSlots: {}, donePeople: {} },
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel(session)
    fireEvent.click(screen.getAllByRole('tab')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }))
    fireEvent.click(screen.getByLabelText(/Assign to Alice/i))
    fireEvent.click(screen.getByLabelText(/Assign to Bob/i))
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const body1 = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    const body2 = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)
    expect(body1.action).toBe('qty')
    expect(body1.qty + body2.qty).toBe(3)
    // Largest-remainder: Alice (index 0) gets ceil, Bob (index 1) gets floor
    expect(body1.qty).toBe(2)
    expect(body2.qty).toBe(1)
  })

  it('Test 7 (dispute reassign): POSTs decision: resolved + reassignTo', async () => {
    const session = makeSession({
      disputes: {
        d1: { itemId: 'i1', personId: 'p1', status: 'pending', createdAt: 1 },
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel(session)
    fireEvent.click(screen.getAllByRole('tab')[2])
    fireEvent.click(screen.getByRole('button', { name: /Reassign dispute d1/i }))
    fireEvent.click(screen.getByLabelText(/Reassign to Bob/i))
    fireEvent.click(screen.getByRole('button', { name: 'Reassign' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({
      disputeId: 'd1',
      decision: 'resolved',
      reassignTo: 'p2',
      hostToken: 'host-token-abc',
    })
  })

  it('Test 8 (dispute confirm original): POSTs decision: rejected, no reassignTo', async () => {
    const session = makeSession({
      disputes: {
        d1: { itemId: 'i1', personId: 'p1', status: 'pending', createdAt: 1 },
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel(session)
    fireEvent.click(screen.getAllByRole('tab')[2])
    fireEvent.click(screen.getByRole('button', { name: /Confirm original assignment for dispute d1/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.decision).toBe('rejected')
    expect(body.reassignTo).toBeUndefined()
  })

  it('Test 9 (empty state): no pending edit requests shows empty copy', () => {
    renderPanel(makeSession())
    expect(screen.getByText('No edit requests')).toBeDefined()
    expect(screen.getByText(/Requests from participants will appear here\./)).toBeDefined()
  })

  it('Test 10 (error display): fetch 500 shows inline error, no mutate', async () => {
    const session = makeSession({
      editRequests: {
        r1: { personId: 'p1', type: 'remove', payload: { itemId: 'i1' }, status: 'pending', createdAt: 1 },
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'oops' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel(session)
    fireEvent.click(screen.getByRole('button', { name: /Approve edit request r1/i }))
    await waitFor(() => {
      expect(screen.getByText(/Couldn.t save.*tap to retry/i)).toBeDefined()
    })
    expect(mutateMock).not.toHaveBeenCalled()
  })

  it('Test 11 (409 idempotency): shows "Already resolved" and calls mutate', async () => {
    const session = makeSession({
      editRequests: {
        r1: { personId: 'p1', type: 'remove', payload: { itemId: 'i1' }, status: 'pending', createdAt: 1 },
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'already' }) })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel(session)
    fireEvent.click(screen.getByRole('button', { name: /Approve edit request r1/i }))
    await waitFor(() => {
      expect(screen.getByText(/Already resolved/i)).toBeDefined()
    })
    expect(mutateMock).toHaveBeenCalled()
  })
})
