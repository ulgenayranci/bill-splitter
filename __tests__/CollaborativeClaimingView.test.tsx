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

/**
 * Flat SESSION_FIXTURE — no hostToken, editRequests, disputes, hostPersonId.
 * All claims are self-claims; no host concept.
 */
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
  tips: {},
  currencyCode: 'USD',
  createdAt: Date.now(),
}

describe('CollaborativeClaimingView', () => {
  beforeEach(() => {
    useSWRMock.mockReturnValue({ data: SESSION_FIXTURE, error: undefined, mutate: mutateMock })
    mutateMock.mockResolvedValue(SESSION_FIXTURE)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  /**
   * selectAlice — renders the component and reaches Alice's claiming view by clicking her slot.
   */
  async function selectAlice(opts: { session?: Partial<SessionPayload> } = {}) {
    const slotFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', slotFetch)

    if (opts.session) {
      useSWRMock.mockReturnValue({
        data: { ...SESSION_FIXTURE, ...opts.session },
        error: undefined,
        mutate: mutateMock,
      })
      mutateMock.mockResolvedValue({ ...SESSION_FIXTURE, ...opts.session })
    }

    render(<CollaborativeClaimingView sessionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: /claim slot alice/i }))
    await waitFor(() => expect(screen.getByText(/hi, alice/i)).toBeDefined())
    return slotFetch
  }

  it('Test 1: Shows PersonSlotPicker when no slot is selected', () => {
    render(<CollaborativeClaimingView sessionId="s1" />)
    // PersonSlotPicker should render slot buttons
    expect(screen.getByRole('button', { name: /claim slot alice/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /claim slot bob/i })).toBeDefined()
  })

  it('Test 2: No host badge in header (flat model — no host concept)', async () => {
    await selectAlice()
    expect(screen.queryByTestId('host-badge')).toBeNull()
  })

  it('Test 3: No host FAB rendered for any participant', async () => {
    await selectAlice()
    expect(screen.queryByTestId('host-panel-fab')).toBeNull()
  })

  it('Test 4: Selecting slot shows claiming view with Hi, Alice!', async () => {
    await selectAlice()
    expect(screen.getByText(/hi, alice/i)).toBeDefined()
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

  it("Test 6 (flat model): I'm done jumps directly to TipScreen (no review branch)", async () => {
    await selectAlice()
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => {
      expect(screen.getByText('Add a tip?')).toBeDefined()
    })
  })

  // CR-04: POSTs done:false, not undone:true
  it('Test 7 (back from Tip): POSTs done:false and returns to claiming', async () => {
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

  it('Test 9 (per-item pencil opens inline edit form with name + price)', async () => {
    await selectAlice()
    fireEvent.click(screen.getByTestId('edit-pencil-i1'))
    // inline edit form shows name and price inputs pre-filled
    expect(screen.getByLabelText('Item name')).toBeDefined()
    expect(screen.getByLabelText('New price')).toBeDefined()
    // cancel closes it, item card returns
    fireEvent.click(screen.getByLabelText('Cancel edit'))
    expect(screen.queryByLabelText('Item name')).toBeNull()
  })

  it('Test 10 (Add item button opens inline add form)', async () => {
    await selectAlice()
    fireEvent.click(screen.getByTestId('add-item-button'))
    // inline add form appears with name + confirm + cancel
    expect(screen.getByLabelText('Item name')).toBeDefined()
    expect(screen.getByLabelText('Confirm')).toBeDefined()
    // cancel closes it
    fireEvent.click(screen.getByLabelText('Cancel'))
    expect(screen.queryByLabelText('Item name')).toBeNull()
  })

  it('Test 11 (handleInlineSubmit — edit): calls /api/session/[id]/edit (not /edit-request)', async () => {
    await selectAlice()
    fireEvent.click(screen.getByTestId('edit-pencil-i1'))
    const editInput = screen.getByLabelText('Item name')
    fireEvent.change(editInput, { target: { value: 'Margherita' } })
    const editFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', editFetch)
    fireEvent.click(screen.getByLabelText('Confirm edit'))
    await waitFor(() => expect(editFetch).toHaveBeenCalled())
    const [url] = editFetch.mock.calls[0]
    // Must call /edit, NOT /edit-request
    expect(url).toMatch(/\/api\/session\/s1\/edit$/)
    expect(url).not.toContain('edit-request')
    const body = JSON.parse((editFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.op).toBe('edit_name')
  })

  it('Test 12 (handleInlineSubmit — add): calls /api/session/[id]/edit with op:add', async () => {
    await selectAlice()
    fireEvent.click(screen.getByTestId('add-item-button'))
    fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'Garlic Bread' } })
    fireEvent.change(screen.getByPlaceholderText('Price'), { target: { value: '5.00' } })
    const addFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', addFetch)
    fireEvent.click(screen.getByLabelText('Confirm'))
    await waitFor(() => expect(addFetch).toHaveBeenCalled())
    const [url] = addFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/session\/s1\/edit$/)
    const body = JSON.parse((addFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.op).toBe('add')
    expect(body.name).toBe('Garlic Bread')
  })

  it('Test 13 (D-02 delete confirm — no claims): shows confirm dialog "Delete X?" before remove POST', async () => {
    await selectAlice()
    const confirmMock = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirmMock)
    const deleteFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', deleteFetch)
    fireEvent.click(screen.getByTestId('delete-item-i1'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalled())
    // Confirm message for unclaimed item is "Delete X?"
    expect(confirmMock.mock.calls[0][0]).toMatch(/Delete Pizza/i)
    await waitFor(() => expect(deleteFetch).toHaveBeenCalled())
    const [url] = deleteFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/session\/s1\/edit$/)
    const body = JSON.parse((deleteFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.op).toBe('remove')
    expect(body.itemId).toBe('i1')
  })

  it('Test 14 (D-02 delete confirm — with claims): confirm message names claimant count', async () => {
    // Session with 2 claimants on i1
    const sessionWithClaims: Partial<SessionPayload> = {
      claims: {
        items: {
          i1: { p1: { qty: 1 }, p2: { qty: 1 } },
        },
        personSlots: {},
        donePeople: {},
      },
    }
    await selectAlice({ session: sessionWithClaims })
    const confirmMock = vi.fn().mockReturnValue(false) // cancel delete
    vi.stubGlobal('confirm', confirmMock)
    vi.stubGlobal('fetch', vi.fn())
    fireEvent.click(screen.getByTestId('delete-item-i1'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalled())
    // With 2 claimants: "2 people have claimed Pizza — delete anyway?"
    expect(confirmMock.mock.calls[0][0]).toMatch(/2 people have claimed Pizza/i)
  })

  it('Test 15 (D-02 cancel delete): when user cancels confirm, no /edit POST is made', async () => {
    await selectAlice()
    const confirmMock = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirmMock)
    const deleteFetch = vi.fn()
    vi.stubGlobal('fetch', deleteFetch)
    fireEvent.click(screen.getByTestId('delete-item-i1'))
    await waitFor(() => expect(confirmMock).toHaveBeenCalled())
    // No fetch should have been made
    expect(deleteFetch).not.toHaveBeenCalled()
  })

  it('Test 16: delete button is present for each item', async () => {
    await selectAlice()
    // Both items should have a delete button
    expect(screen.getByTestId('delete-item-i1')).toBeDefined()
    expect(screen.getByTestId('delete-item-i2')).toBeDefined()
  })

  it('Test 17: No "Assigned by host" label anywhere in the claiming view (flat model)', async () => {
    await selectAlice()
    expect(screen.queryByText(/assigned by host/i)).toBeNull()
  })

  // Previously the historically-failing Test 18 ("You're all set" path).
  // The flat component should now pass this: claiming → done → TipScreen → confirmTip → PersonResultsScreen.
  it('Test 18 (Confirm tip → Results): clicking Confirm tip transitions to PersonResultsScreen (You\'re all set)', async () => {
    await selectAlice()
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => expect(screen.getByText('Add a tip?')).toBeDefined())
    // Update mock so all items are claimed (allItemsFullyClaimed = true) so onTipConfirmed → 'results'
    useSWRMock.mockReturnValue({
      data: {
        ...SESSION_FIXTURE,
        claims: {
          items: {
            i1: { p1: { qty: 1 } },
            i2: { p1: { qty: 4 } },
          },
          personSlots: { p1: true },
          donePeople: { p1: true },
        },
        tips: { p1: 0 },
      },
      error: undefined,
      mutate: mutateMock,
    })
    const tipFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', tipFetch)
    fireEvent.click(screen.getByRole('button', { name: /Confirm tip/i }))
    await waitFor(() => {
      expect(screen.getByText(/You.?re all set/)).toBeDefined()
    })
  })
})
