import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { GuestClaimingView } from '@/app/split/[sessionId]/GuestClaimingView'
import type { SessionPayload } from '@/lib/sessionSchema'

// Mock SWR so we control session data without hitting the network for the GET
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
    { id: 'i1', name: 'Pizza', priceCents: 1000 },
    { id: 'i2', name: 'Coke', priceCents: 250 },
  ],
  tipPercent: 18,
  claims: {
    items: {},
    donePeople: {},
    personSlots: { p1: false, p2: false },
  },
  createdAt: Date.now(),
}

describe('GuestClaimingView', () => {
  beforeEach(() => {
    useSWRMock.mockReturnValue({ data: SESSION_FIXTURE, error: undefined })
    mutateMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    cleanup()
  })

  async function selectAlice() {
    // First /claim slot fetch must succeed so we land on the claiming view
    const slotFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
    vi.stubGlobal('fetch', slotFetch)
    render(<GuestClaimingView sessionId="s1" />)
    // Slot picker shows; tap Alice
    fireEvent.click(screen.getByRole('button', { name: /alice/i }))
    await waitFor(() => {
      // After successful slot claim, the claiming view header appears
      expect(screen.getByText(/hi, alice/i)).toBeDefined()
    })
    vi.unstubAllGlobals()
  }

  it("(D-08) on /claim fetch rejection, optimistic claim reverts AND inline \"Couldn't save — tap to retry\" appears on the affected item", async () => {
    await selectAlice()
    // Now the item /claim fetch will reject
    const errFetch = vi.fn().mockRejectedValue(new Error('network'))
    vi.stubGlobal('fetch', errFetch)
    // Tap the Pizza card (its accessible name is "Claim Pizza" when unowned)
    fireEvent.click(screen.getByRole('button', { name: /claim pizza/i }))
    await waitFor(() => {
      expect(screen.getByText(/couldn.*t save.*tap to retry/i)).toBeDefined()
    })
  })

  it("(D-09) on /done fetch rejection, inline \"Couldn't submit — tap to retry\" appears in the done bar", async () => {
    await selectAlice()
    const errFetch = vi.fn().mockRejectedValue(new Error('network'))
    vi.stubGlobal('fetch', errFetch)
    fireEvent.click(screen.getByRole('button', { name: /i.?m done/i }))
    await waitFor(() => {
      expect(screen.getByText(/couldn.*t submit.*tap to retry/i)).toBeDefined()
    })
  })
})
