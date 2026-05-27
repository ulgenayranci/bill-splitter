import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { CollaborativeClaimingView } from '@/app/split/[sessionId]/CollaborativeClaimingView'
import type { SessionPayload } from '@/lib/sessionSchema'

const mutateMock = vi.fn()
const useSWRMock = vi.fn()
vi.mock('swr', () => ({
  default: (...args: unknown[]) => useSWRMock(...args),
  mutate: (...args: unknown[]) => mutateMock(...args),
}))

const SESSION_FIXTURE: SessionPayload = {
  people: [
    { id: 'p1', name: 'Alice', colorIndex: 0 },
    { id: 'p2', name: 'Bob', colorIndex: 1 },
  ],
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
}

describe('CollaborativeClaimingView', () => {
  beforeEach(() => {
    useSWRMock.mockReturnValue({ data: SESSION_FIXTURE, error: undefined, mutate: mutateMock })
    mutateMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  async function selectAlice(hostTokenParam: string | null = null) {
    const slotFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', slotFetch)
    render(<CollaborativeClaimingView sessionId="s1" hostTokenParam={hostTokenParam} />)
    fireEvent.click(screen.getByRole('button', { name: /alice/i }))
    await waitFor(() => expect(screen.getByText(/hi, alice/i)).toBeDefined())
    return slotFetch
  }

  it('Test 1: shows host badge when hostTokenParam matches session.hostToken', async () => {
    await selectAlice('host-token-abc')
    expect(screen.getByTestId('host-badge')).toBeDefined()
  })

  it('Test 2: hides host badge when hostTokenParam is null', async () => {
    await selectAlice(null)
    expect(screen.queryByTestId('host-badge')).toBeNull()
  })

  it('Test 3: hides host badge when hostTokenParam does not match', async () => {
    await selectAlice('wrong-token')
    expect(screen.queryByTestId('host-badge')).toBeNull()
  })

  it('Test 4: slot claim posts hostToken in body when hostTokenParam present', async () => {
    const slotFetch = await selectAlice('host-token-abc')
    // The /claim call was the first fetch — inspect body
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

  it("Test 6: I'm done posts done:true to /done then shows the placeholder", async () => {
    await selectAlice()
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => {
      expect(screen.getByText(/done.*review.*tip.*results/i)).toBeDefined()
    })
    // Verify the done request body included done:true
    const calls = doneFetch.mock.calls
    const lastCall = calls[calls.length - 1]
    const init = lastCall[1] as RequestInit
    const parsed = JSON.parse(init.body as string)
    expect(parsed.done).toBe(true)
  })

  it('Test 7: Back to claiming posts done:false to /done', async () => {
    await selectAlice()
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => expect(screen.getByText(/done.*review/i)).toBeDefined())

    const backFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', backFetch)
    fireEvent.click(screen.getByRole('button', { name: /back to claiming/i }))
    await waitFor(() => {
      const calls = backFetch.mock.calls
      const lastCall = calls[calls.length - 1]
      const init = lastCall[1] as RequestInit
      const parsed = JSON.parse(init.body as string)
      expect(parsed.done).toBe(false)
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

  it('Test 9 (FAB host-only): when hostTokenParam matches session.hostToken, FAB renders', async () => {
    await selectAlice('host-token-abc')
    expect(screen.getByTestId('host-panel-fab')).toBeDefined()
  })

  it('Test 10 (FAB hidden for guests): when hostTokenParam is null, no FAB renders', async () => {
    await selectAlice(null)
    expect(screen.queryByTestId('host-panel-fab')).toBeNull()
  })

  it('Test 11 (FAB badge): pendingCount reflects pending editRequests + unclaimed + disputes', async () => {
    // Override the SWR mock to return a session with pending entries.
    const sessionWithPending = {
      ...SESSION_FIXTURE,
      editRequests: {
        r1: { personId: 'p1', type: 'remove', payload: { itemId: 'i1' }, status: 'pending', createdAt: 1 },
      },
      disputes: {
        d1: { itemId: 'i1', personId: 'p1', status: 'pending', createdAt: 2 },
      },
    }
    useSWRMock.mockReturnValue({ data: sessionWithPending, error: undefined, mutate: mutateMock })
    await selectAlice('host-token-abc')
    // i1 (qty 1, claimed 0) + i2 (qty 4, claimed 0) = 2 unclaimed; + 1 edit + 1 dispute = 4
    expect(screen.getByTestId('host-panel-fab-badge').textContent?.trim()).toBe('4')
  })

  it('Test 12 (FAB opens HostPanel): tapping FAB shows host-panel', async () => {
    await selectAlice('host-token-abc')
    fireEvent.click(screen.getByTestId('host-panel-fab'))
    expect(screen.getByTestId('host-panel')).toBeDefined()
  })

  it('Test 13 (per-item pencil opens EditRequestForm in edit_price mode)', async () => {
    await selectAlice(null)
    fireEvent.click(screen.getByTestId('edit-pencil-i1'))
    expect(screen.getByTestId('edit-request-form')).toBeDefined()
    // edit_price field set — newPriceCents input visible
    expect(screen.getByLabelText('New price')).toBeDefined()
  })

  it('Test 14 (Add item button opens EditRequestForm in add mode)', async () => {
    await selectAlice(null)
    fireEvent.click(screen.getByTestId('add-item-button'))
    expect(screen.getByTestId('edit-request-form')).toBeDefined()
    // add field set — item name input visible
    expect(screen.getByLabelText('Item name')).toBeDefined()
  })
})
