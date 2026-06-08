import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { CollaborativeClaimingView } from '@/app/split/[sessionId]/CollaborativeClaimingView'
import type { SessionPayload } from '@/lib/sessionSchema'

// Mock next/navigation so AppHeader's useRouter() doesn't throw in jsdom
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

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

/** All items fully claimed by p1 — slots left free so selectAlice can still pick. */
const FULLY_CLAIMED_CLAIMS: SessionPayload['claims'] = {
  items: {
    i1: { p1: { qty: 1 } },
    i2: { p1: { qty: 4 } },
  },
  personSlots: {},
  donePeople: {},
}

describe('CollaborativeClaimingView', () => {
  beforeEach(() => {
    localStorage.clear()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    useSWRMock.mockReturnValue({ data: SESSION_FIXTURE, error: undefined, mutate: mutateMock })
    mutateMock.mockResolvedValue(SESSION_FIXTURE)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  /**
   * selectAlice — renders the component and reaches Alice's claiming view by
   * clicking her slot inside the identity modal.
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
    await waitFor(() => expect(screen.getByRole('button', { name: /i.?m done/i })).toBeDefined())
    return slotFetch
  }

  it('Test 1 (IDENT-01): with no stored identity, the Who-are-you modal shows with slot buttons', () => {
    render(<CollaborativeClaimingView sessionId="s1" />)
    expect(screen.getByText('Who are you?')).toBeDefined()
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

  it('Test 4: Selecting slot closes the modal and shows the claiming view', async () => {
    await selectAlice()
    expect(screen.queryByText('Who are you?')).toBeNull()
    expect(screen.getByRole('button', { name: /i.?m done/i })).toBeDefined()
  })

  it('Test 5: handleShareChange calls mutate with optimisticData (single-qty tap)', async () => {
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

  it("Test 6 (D-09 all-claimed): I'm done with zero unclaimed advances directly to TipScreen", async () => {
    await selectAlice({ session: { claims: FULLY_CLAIMED_CLAIMS } })
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => {
      expect(screen.getByText('Add a tip?')).toBeDefined()
    })
    // No warning dialog appeared
    expect(screen.queryByText(/still unclaimed$/)).toBeNull()
  })

  // CR-04: POSTs done:false, not undone:true
  it('Test 7 (back from Tip): POSTs done:false and returns to claiming', async () => {
    await selectAlice({ session: { claims: FULLY_CLAIMED_CLAIMS } })
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

  // D-12: previously this path could land on a blocking 'waiting' screen when items were
  // unclaimed. Now: done (through the warning) → tip → Confirm tip → results, always.
  it('Test 18 (D-12, Confirm tip → Results): with unclaimed items, Continue anyway → tip → Confirm tip lands on results (no waiting screen)', async () => {
    await selectAlice()
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    // Unclaimed items exist → warning dialog appears (D-09)
    const warnDialog = await screen.findByRole('dialog')
    expect(within(warnDialog).getByText(/items still unclaimed/i)).toBeDefined()
    fireEvent.click(within(warnDialog).getByRole('button', { name: /continue anyway/i }))
    await waitFor(() => expect(screen.getByText('Add a tip?')).toBeDefined())
    useSWRMock.mockReturnValue({
      data: {
        ...SESSION_FIXTURE,
        claims: {
          items: {
            i1: { p1: { qty: 1 } },
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

  // ——— Phase 9 identity modal tests (IDENT-01..04) ———

  it('Test 19 (IDENT-02/04 restore-by-existence): stored personId present in session.people restores identity (no slot marker needed), modal NOT shown', async () => {
    localStorage.setItem('split:s1:personId', 'p2')
    // personSlots:{} — membership in session.people (not the slot marker) drives restore
    useSWRMock.mockReturnValue({
      data: {
        ...SESSION_FIXTURE,
        claims: { items: {}, personSlots: {}, donePeople: {} },
      },
      error: undefined,
      mutate: mutateMock,
    })
    render(<CollaborativeClaimingView sessionId="s1" />)
    await waitFor(() => expect(screen.getByRole('button', { name: /i.?m done/i })).toBeDefined())
    expect(screen.queryByText('Who are you?')).toBeNull()
  })

  it('Test 20 (IDENT-02/04 restore-by-existence): stored personId present in session.people restores identity (no slot marker needed), modal NOT shown', async () => {
    localStorage.setItem('split:s1:personId', 'p2')
    // personSlots:{} — no slot marker at all; restore is driven purely by membership in people
    useSWRMock.mockReturnValue({
      data: {
        ...SESSION_FIXTURE,
        claims: { items: {}, personSlots: {}, donePeople: {} },
      },
      error: undefined,
      mutate: mutateMock,
    })
    render(<CollaborativeClaimingView sessionId="s1" />)
    await waitFor(() => expect(screen.getByRole('button', { name: /i.?m done/i })).toBeDefined())
    expect(screen.queryByText('Who are you?')).toBeNull()
  })

  it('Test 20b (IDENT-04 miss): stored personId not in session.people opens modal', () => {
    localStorage.setItem('split:s1:personId', 'p999')
    // p999 is NOT present in SESSION_FIXTURE.people (only p1/p2) — must show modal
    render(<CollaborativeClaimingView sessionId="s1" />)
    expect(screen.getByText('Who are you?')).toBeDefined()
  })

  it('Test 21 (IDENT-04): chosen identity persists to localStorage', async () => {
    await selectAlice()
    expect(localStorage.getItem('split:s1:personId')).toBe('p1')
  })

  it("Test 22 (IDENT-03 add): I'm not listed → add_person POST, sets identity + localStorage, closes modal", async () => {
    const addPersonFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, personId: 'p9' }),
    })
    vi.stubGlobal('fetch', addPersonFetch)
    // Session including the soon-to-be-added person so the claiming view can render Charlie
    useSWRMock.mockReturnValue({
      data: {
        ...SESSION_FIXTURE,
        people: [...SESSION_FIXTURE.people, { id: 'p9', name: 'Charlie', colorIndex: 2 }],
      },
      error: undefined,
      mutate: mutateMock,
    })
    mutateMock.mockResolvedValue({
      ...SESSION_FIXTURE,
      people: [...SESSION_FIXTURE.people, { id: 'p9', name: 'Charlie', colorIndex: 2 }],
    })
    render(<CollaborativeClaimingView sessionId="s1" />)
    fireEvent.click(screen.getByText(/i.?m not listed/i))
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Charlie' } })
    fireEvent.click(screen.getByRole('button', { name: /add me/i }))
    await waitFor(() => expect(addPersonFetch).toHaveBeenCalled())
    const [url] = addPersonFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/session\/s1\/edit$/)
    const body = JSON.parse((addPersonFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.op).toBe('add_person')
    expect(body.name).toBe('Charlie')
    await waitFor(() => expect(screen.queryByText('Who are you?')).toBeNull())
    expect(localStorage.getItem('split:s1:personId')).toBe('p9')
  })

  it('Test 23 (IDENT-03 change): tapping the people strip reopens the modal (dismissible)', async () => {
    await selectAlice()
    fireEvent.click(screen.getByRole('button', { name: /people — tap to change identity/i }))
    await waitFor(() => expect(screen.getByText('Who are you?')).toBeDefined())
    // Change-identity mode is dismissible — a Close button is present
    expect(screen.getByRole('button', { name: /close/i })).toBeDefined()
  })

  // ——— Phase 9 share / header / banner / done-warning tests ———

  it('Test 24 (CLAIM-02): single-qty card tap POSTs action:share with joining boolean', async () => {
    await selectAlice()
    mutateMock.mockImplementation(async (fn: () => Promise<unknown>) => {
      if (typeof fn === 'function') return fn()
      return undefined
    })
    const shareFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', shareFetch)
    fireEvent.click(screen.getByRole('button', { name: /claim pizza/i }))
    await waitFor(() => expect(shareFetch).toHaveBeenCalled())
    const [url] = shareFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/session\/s1\/claim$/)
    const body = JSON.parse((shareFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.action).toBe('share')
    expect(body.joining).toBe(true)
    expect(body.itemId).toBe('i1')
  })

  it('Test 25 (CLAIM-05): UnclaimedBanner renders above the item list when unclaimed > 0', async () => {
    await selectAlice()
    expect(screen.getByTestId('unclaimed-banner')).toBeDefined()
    expect(screen.getByText(/2 of 2 items still unclaimed — tap to find them/)).toBeDefined()
  })

  it('Test 26 (CLAIM-06): BillViewHeader renders with a share affordance', async () => {
    await selectAlice()
    expect(screen.getByRole('button', { name: /share bill link/i })).toBeDefined()
  })

  it('Test 27 (D-10): tapping the banner scrolls to the first unclaimed item', async () => {
    await selectAlice()
    const scrollSpy = window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    fireEvent.click(screen.getByTestId('unclaimed-banner'))
    expect(scrollSpy).toHaveBeenCalled()
  })

  it("Test 28 (D-09 warn): I'm done with unclaimed items opens the warning dialog, does NOT advance", async () => {
    await selectAlice()
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    const warnDialog = await screen.findByRole('dialog')
    expect(within(warnDialog).getByText(/2 items still unclaimed/i)).toBeDefined()
    // Phase did NOT advance to tip
    expect(screen.queryByText('Add a tip?')).toBeNull()
    // No done POST yet
    expect(doneFetch).not.toHaveBeenCalled()
  })

  it('Test 29 (D-11): the warning dialog contains a share-link affordance', async () => {
    await selectAlice()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined())
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /share bill link/i })).toBeDefined()
  })

  it('Test 30 (D-09 go back): "Go back" closes the dialog and stays in claiming', async () => {
    await selectAlice()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    const warnDialog = await screen.findByRole('dialog')
    expect(within(warnDialog).getByText(/2 items still unclaimed/i)).toBeDefined()
    fireEvent.click(within(warnDialog).getByRole('button', { name: /go back/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: /i.?m done/i })).toBeDefined()
    expect(screen.queryByText('Add a tip?')).toBeNull()
  })

  it('Test 31 (D-12 continue): "Continue anyway" runs the done path and advances to tip', async () => {
    await selectAlice()
    const doneFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', doneFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    const warnDialog = await screen.findByRole('dialog')
    expect(within(warnDialog).getByText(/2 items still unclaimed/i)).toBeDefined()
    fireEvent.click(within(warnDialog).getByRole('button', { name: /continue anyway/i }))
    await waitFor(() => expect(screen.getByText('Add a tip?')).toBeDefined())
    expect(doneFetch).toHaveBeenCalled()
  })
})
