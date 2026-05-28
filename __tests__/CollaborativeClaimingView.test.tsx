import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { CollaborativeClaimingView } from '@/app/split/[sessionId]/CollaborativeClaimingView'
import type { PublicSessionPayload } from '@/lib/sessionSchema'

const mutateMock = vi.fn()
const useSWRMock = vi.fn()
vi.mock('swr', () => ({
  default: (...args: unknown[]) => useSWRMock(...args),
  mutate: (...args: unknown[]) => mutateMock(...args),
}))

// CR-01: SESSION_FIXTURE uses PublicSessionPayload — no hostToken.
// CR-05: host identity is derived from hostPersonId, not from comparing hostToken to URL param.
const SESSION_FIXTURE: PublicSessionPayload = {
  people: [
    { id: 'p1', name: 'Alice', colorIndex: 0 },
    { id: 'p2', name: 'Bob', colorIndex: 1 },
  ],
  items: [
    { id: 'i1', name: 'Pizza', priceCents: 1000, quantity: 1 },
    { id: 'i2', name: 'Pitcher', priceCents: 2400, quantity: 4 },
  ],
  claims: { items: {}, personSlots: {}, donePeople: {} },
  hostPersonId: undefined,
  tips: {},
  editRequests: {},
  disputes: {},
  createdAt: Date.now(),
}

// HOST_SESSION_FIXTURE: has Alice (p1) as the identified host.
// Used in tests that expect the host badge, FAB, and HostPanel to be visible.
const HOST_SESSION_FIXTURE: PublicSessionPayload = {
  ...SESSION_FIXTURE,
  hostPersonId: 'p1',
}

describe('CollaborativeClaimingView', () => {
  beforeEach(() => {
    useSWRMock.mockReturnValue({ data: SESSION_FIXTURE, error: undefined, mutate: mutateMock })
    mutateMock.mockResolvedValue(SESSION_FIXTURE)
  })

  afterEach(() => {
    // Reset hash so host-token state doesn't leak between tests
    window.location.hash = ''
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  /**
   * selectAlice — renders the component and reaches Alice's claiming view.
   *
   * @param opts.asHost   - if true, sets window.location.hash to a valid hostToken
   *                        and mocks SWR to return HOST_SESSION_FIXTURE (hostPersonId='p1').
   *                        The auto-restore useEffect in CollaborativeClaimingView will fire
   *                        and call setSelectedPersonId('p1') without any slot-claim fetch,
   *                        so NO click is performed here.
   * @param opts.session  - optional session override (merged with the appropriate base fixture).
   */
  async function selectAlice(opts: { asHost?: boolean; session?: Partial<PublicSessionPayload> } = {}) {
    const slotFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', slotFetch)

    if (opts.asHost) {
      // CR-05: token is now in URL fragment, not query param.
      // HOST_SESSION_FIXTURE.hostPersonId='p1' — triggers the auto-restore useEffect which
      // calls setSelectedPersonId(session.hostPersonId) and skips the PersonSlotPicker.
      window.location.hash = '#hostToken=host-token-abc'
      const sessionData = opts.session ? { ...HOST_SESSION_FIXTURE, ...opts.session } : HOST_SESSION_FIXTURE
      useSWRMock.mockReturnValue({ data: sessionData, error: undefined, mutate: mutateMock })
      mutateMock.mockResolvedValue(sessionData)
      // CR-05: no hostTokenParam prop — component reads from window.location.hash
      render(<CollaborativeClaimingView sessionId="s1" />)
      // No slot click needed — auto-restore handles selection
      await waitFor(() => expect(screen.getByText(/hi, alice/i)).toBeDefined())
    } else if (opts.session) {
      useSWRMock.mockReturnValue({
        data: { ...SESSION_FIXTURE, ...opts.session },
        error: undefined,
        mutate: mutateMock,
      })
      mutateMock.mockResolvedValue({ ...SESSION_FIXTURE, ...opts.session })
      render(<CollaborativeClaimingView sessionId="s1" />)
      fireEvent.click(screen.getByRole('button', { name: /claim slot alice/i }))
      await waitFor(() => expect(screen.getByText(/hi, alice/i)).toBeDefined())
    } else {
      render(<CollaborativeClaimingView sessionId="s1" />)
      fireEvent.click(screen.getByRole('button', { name: /claim slot alice/i }))
      await waitFor(() => expect(screen.getByText(/hi, alice/i)).toBeDefined())
    }
    return slotFetch
  }

  it('Test 1: shows host badge when hash contains hostToken and session.hostPersonId matches', async () => {
    // CR-01/CR-05: isHost now derived from hostPersonId, not from session.hostToken comparison
    await selectAlice({ asHost: true })
    expect(screen.getByTestId('host-badge')).toBeDefined()
  })

  it('Test 2: hides host badge when no hash token (guest)', async () => {
    await selectAlice()
    expect(screen.queryByTestId('host-badge')).toBeNull()
  })

  it('Test 3: hides host badge when hash has token but session.hostPersonId is not set', async () => {
    // Even with hostToken in the URL, isHost=false if session.hostPersonId is not yet set.
    // (Using SESSION_FIXTURE with hostPersonId=undefined so the PersonSlotPicker renders —
    //  a session with hostPersonId:'p2' would auto-restore Bob and skip Alice's slot entirely.)
    window.location.hash = '#hostToken=host-token-abc'
    useSWRMock.mockReturnValue({ data: SESSION_FIXTURE, error: undefined, mutate: mutateMock })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    render(<CollaborativeClaimingView sessionId="s1" />)
    // Picker shows because SESSION_FIXTURE.hostPersonId=undefined (no auto-restore)
    fireEvent.click(screen.getByRole('button', { name: /claim slot alice/i }))
    await waitFor(() => expect(screen.getByText(/hi, alice/i)).toBeDefined())
    // isHost = hostTokenParam(set) && selectedPersonId('p1') && (undefined === 'p1') = false
    expect(screen.queryByTestId('host-badge')).toBeNull()
  })

  it('Test 4: slot claim posts hostToken in body when hash contains hostToken', async () => {
    // Simulate the FIRST visit: hash has hostToken but hostPersonId is not yet set in the
    // session (the host hasn't claimed their slot yet). This prevents auto-restore from
    // firing so the PersonSlotPicker renders and a real slot-claim fetch is made.
    window.location.hash = '#hostToken=host-token-abc'
    useSWRMock.mockReturnValue({ data: SESSION_FIXTURE, error: undefined, mutate: mutateMock })
    const slotFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', slotFetch)
    render(<CollaborativeClaimingView sessionId="s1" />)
    // Picker shows — SESSION_FIXTURE.hostPersonId=undefined, no auto-restore
    fireEvent.click(screen.getByRole('button', { name: /claim slot alice/i }))
    await waitFor(() => expect(slotFetch).toHaveBeenCalled())
    const call = slotFetch.mock.calls[0]
    const init = call[1] as RequestInit
    const parsed = JSON.parse(init.body as string)
    expect(parsed.hostToken).toBe('host-token-abc')
    expect(parsed.action).toBe('slot')
  })

  it('Test 5: handleQtyChange calls mutate with optimisticData (qty path)', async () => {
    await selectAlice()
    const qtyFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', qtyFetch)
    fireEvent.click(screen.getByRole('button', { name: /claim pizza/i }))
    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalled()
    })
    // Last mutate call should have options containing optimisticData and rollbackOnError
    const callArgs = mutateMock.mock.calls[mutateMock.mock.calls.length - 1]
    const options = callArgs[1] as Record<string, unknown>
    expect(options.rollbackOnError).toBe(true)
    expect(options.optimisticData).toBeDefined()
  })

  // Updated Test 6: no host-assigned items → straight to TipScreen
  it("Test 6 (no host-assigned items): I'm done jumps to Tip screen", async () => {
    await selectAlice()
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => {
      expect(screen.getByText('Add a tip?')).toBeDefined()
    })
  })

  // CR-04: was POSTs undone:true, now POSTs done:false
  it('Test 7 (back from Tip without host items): POSTs done:false and returns to claiming', async () => {
    await selectAlice()
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => expect(screen.getByText('Add a tip?')).toBeDefined())

    const backFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', backFetch)
    fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))
    await waitFor(() => {
      const calls = backFetch.mock.calls
      const lastCall = calls[calls.length - 1]
      const init = lastCall[1] as RequestInit
      const parsed = JSON.parse(init.body as string)
      // CR-04: must send done:false, not undone:true
      expect(parsed.done).toBe(false)
      expect(parsed.undone).toBeUndefined()
    })
  })

  it("Test 8 (D-08): on /claim fetch rejection, the affected item shows \"Couldn't save — tap to retry\"", async () => {
    await selectAlice()
    // Make mutate actually invoke its async callback so rejection propagates
    mutateMock.mockImplementation(async (fn: () => Promise<unknown>) => {
      if (typeof fn === 'function') return fn()
      return undefined
    })
    const errFetch = vi.fn().mockRejectedValue(new Error('network'))
    vi.stubGlobal('fetch', errFetch)
    fireEvent.click(screen.getByRole('button', { name: /claim pizza/i }))
    await waitFor(() => {
      expect(screen.getByText(/couldn.*t save.*tap to retry/i)).toBeDefined()
    })
  })

  it('Test 9 (FAB host-only): when hash has hostToken and hostPersonId matches, FAB renders', async () => {
    await selectAlice({ asHost: true })
    expect(screen.getByTestId('host-panel-fab')).toBeDefined()
  })

  it('Test 10 (FAB hidden for guests): when no hash token, no FAB renders', async () => {
    await selectAlice()
    expect(screen.queryByTestId('host-panel-fab')).toBeNull()
  })

  it('Test 11 (FAB badge): pendingCount reflects pending editRequests + unclaimed + disputes', async () => {
    const sessionWithPending: PublicSessionPayload = {
      // HOST_SESSION_FIXTURE.hostPersonId='p1' — auto-restore fires, no slot click needed
      ...HOST_SESSION_FIXTURE,
      editRequests: {
        r1: { personId: 'p1', type: 'remove', payload: { itemId: 'i1' }, status: 'pending', createdAt: 1 },
      },
      disputes: {
        d1: { itemId: 'i1', personId: 'p1', status: 'pending', createdAt: 2 },
      },
    }
    useSWRMock.mockReturnValue({ data: sessionWithPending, error: undefined, mutate: mutateMock })
    mutateMock.mockResolvedValue(sessionWithPending)
    window.location.hash = '#hostToken=host-token-abc'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    render(<CollaborativeClaimingView sessionId="s1" />)
    // No slot click — auto-restore selects Alice via hostPersonId='p1'
    await waitFor(() => expect(screen.getByText(/hi, alice/i)).toBeDefined())
    // i1 (qty 1, claimed 0) + i2 (qty 4, claimed 0) = 2 unclaimed; + 1 edit + 1 dispute = 4
    expect(screen.getByTestId('host-panel-fab-badge').textContent?.trim()).toBe('4')
  })

  it('Test 12 (FAB opens HostPanel): tapping FAB shows host-panel', async () => {
    await selectAlice({ asHost: true })
    fireEvent.click(screen.getByTestId('host-panel-fab'))
    expect(screen.getByTestId('host-panel')).toBeDefined()
  })

  it('Test 13 (per-item pencil opens EditRequestForm in edit_price mode)', async () => {
    await selectAlice()
    fireEvent.click(screen.getByTestId('edit-pencil-i1'))
    expect(screen.getByTestId('edit-request-form')).toBeDefined()
    // edit_price field set — newPriceCents input visible
    expect(screen.getByLabelText('New price')).toBeDefined()
  })

  it('Test 14 (Add item button opens EditRequestForm in add mode)', async () => {
    await selectAlice()
    fireEvent.click(screen.getByTestId('add-item-button'))
    expect(screen.getByTestId('edit-request-form')).toBeDefined()
    // add field set — item name input visible
    expect(screen.getByLabelText('Item name')).toBeDefined()
  })

  // WR-07: mutate() return value drives the host-assigned routing — not stale session closure.
  it("Test 15 (host-assigned items → Review): I'm done routes to ReviewHostAssignedScreen", async () => {
    const sessionWithHost: PublicSessionPayload = {
      ...SESSION_FIXTURE,
      claims: {
        ...SESSION_FIXTURE.claims,
        items: {
          i1: { p1: { qty: 1, assignedBy: 'host' as const } },
        },
      },
    }
    // WR-07: mutateMock must return the updated session so handleDone sees host-assigned items
    mutateMock.mockResolvedValue(sessionWithHost)
    useSWRMock.mockReturnValue({ data: sessionWithHost, error: undefined, mutate: mutateMock })
    await selectAlice({ session: sessionWithHost })
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => {
      expect(screen.getByText('Review assigned items')).toBeDefined()
    })
  })

  it('Test 16 (Accept all → Tip): clicking Accept all transitions to TipScreen', async () => {
    const sessionWithHost: PublicSessionPayload = {
      ...SESSION_FIXTURE,
      claims: {
        ...SESSION_FIXTURE.claims,
        items: { i1: { p1: { qty: 1, assignedBy: 'host' as const } } },
      },
    }
    mutateMock.mockResolvedValue(sessionWithHost)
    useSWRMock.mockReturnValue({ data: sessionWithHost, error: undefined, mutate: mutateMock })
    await selectAlice({ session: sessionWithHost })
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => expect(screen.getByText('Review assigned items')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: /Accept all and continue/i }))
    await waitFor(() => {
      expect(screen.getByText('Add a tip?')).toBeDefined()
    })
  })

  // CR-04: was checking undone:true, now checks done:false
  it('Test 17 (Back from Review → claiming with done:false)', async () => {
    const sessionWithHost: PublicSessionPayload = {
      ...SESSION_FIXTURE,
      claims: {
        ...SESSION_FIXTURE.claims,
        items: { i1: { p1: { qty: 1, assignedBy: 'host' as const } } },
      },
    }
    mutateMock.mockResolvedValue(sessionWithHost)
    useSWRMock.mockReturnValue({ data: sessionWithHost, error: undefined, mutate: mutateMock })
    await selectAlice({ session: sessionWithHost })
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => expect(screen.getByText('Review assigned items')).toBeDefined())
    const backFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', backFetch)
    fireEvent.click(screen.getByRole('button', { name: /Back to claiming/i }))
    await waitFor(() => {
      const lastCall = backFetch.mock.calls[backFetch.mock.calls.length - 1]
      const body = JSON.parse((lastCall[1] as RequestInit).body as string)
      // CR-04: must send done:false, not undone:true
      expect(body.done).toBe(false)
      expect(body.undone).toBeUndefined()
    })
  })

  it('Test 18 (Confirm tip → Results): clicking Confirm tip transitions to PersonResultsScreen', async () => {
    await selectAlice()
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => expect(screen.getByText('Add a tip?')).toBeDefined())
    const tipFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', tipFetch)
    fireEvent.click(screen.getByRole('button', { name: /Confirm tip/i }))
    await waitFor(() => {
      expect(screen.getByText(/You.?re all set/)).toBeDefined()
    })
  })

  it('Test 19 (Back from Tip with host items → Review, no /done POST)', async () => {
    const sessionWithHost: PublicSessionPayload = {
      ...SESSION_FIXTURE,
      claims: {
        ...SESSION_FIXTURE.claims,
        items: { i1: { p1: { qty: 1, assignedBy: 'host' as const } } },
      },
    }
    mutateMock.mockResolvedValue(sessionWithHost)
    useSWRMock.mockReturnValue({ data: sessionWithHost, error: undefined, mutate: mutateMock })
    await selectAlice({ session: sessionWithHost })
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => expect(screen.getByText('Review assigned items')).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: /Accept all and continue/i }))
    await waitFor(() => expect(screen.getByText('Add a tip?')).toBeDefined())
    const backFetch = vi.fn()
    vi.stubGlobal('fetch', backFetch)
    fireEvent.click(screen.getByRole('button', { name: /^Back$/i }))
    await waitFor(() => expect(screen.getByText('Review assigned items')).toBeDefined())
    // No fetch should have been made — going from Tip back to Review is local-only
    expect(backFetch).not.toHaveBeenCalled()
  })
})
