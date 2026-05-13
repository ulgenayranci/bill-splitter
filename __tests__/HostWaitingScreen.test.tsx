import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { HostWaitingScreen } from '@/components/wizard/HostWaitingScreen'
import { useBillStore } from '@/stores/useBillStore'
import type { SessionPayload } from '@/lib/sessionSchema'

// Mock useSWR to avoid actual HTTP calls / intervals in tests
vi.mock('swr', () => ({ default: vi.fn() }))

// Mock SessionExpiredScreen to keep test focus on HostWaitingScreen
vi.mock('@/components/split/SessionExpiredScreen', () => ({
  SessionExpiredScreen: () => <div data-testid="session-expired">Session expired</div>,
}))

import useSWR from 'swr'

const mockSession: SessionPayload = {
  people: [
    { id: 'p1', name: 'Alice', colorIndex: 0 },
    { id: 'p2', name: 'Bob', colorIndex: 1 },
  ],
  items: [
    { id: 'i1', name: 'Pizza', priceCents: 1500 },
    { id: 'i2', name: 'Coke', priceCents: 250 },
  ],
  tipPercent: 18,
  claims: {
    items: { i1: 'p1', i2: 'p2' },
    personSlots: { p1: true, p2: true },
    donePeople: { p1: false },
  },
  createdAt: Date.now(),
}

describe('HostWaitingScreen', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
    // Default SWR mock returns data
    ;(useSWR as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockSession,
      error: undefined,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('Test 1: Renders the share URL containing /split/{sessionId} for the given prop', () => {
    render(<HostWaitingScreen sessionId="session-abc" />)
    expect(screen.getByText(/\/split\/session-abc/)).toBeDefined()
  })

  it('Test 2: Renders one row per session.people', () => {
    render(<HostWaitingScreen sessionId="session-abc" />)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
  })

  it('Test 3: For a person with donePeople[id] = true, the row contains a check icon with aria-label "Done"', () => {
    const sessionWithDone: SessionPayload = {
      ...mockSession,
      claims: {
        ...mockSession.claims,
        donePeople: { p1: true, p2: false },
      },
    }
    ;(useSWR as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: sessionWithDone,
      error: undefined,
    })
    render(<HostWaitingScreen sessionId="session-abc" />)
    // The done person's row should have a check icon
    const checkIcons = screen.getAllByTestId('check-icon')
    expect(checkIcons.length).toBeGreaterThan(0)
  })

  it('Test 4: When all people are done, the "All done!" banner is present', () => {
    const allDoneSession: SessionPayload = {
      ...mockSession,
      claims: {
        ...mockSession.claims,
        donePeople: { p1: true, p2: true },
      },
    }
    ;(useSWR as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: allDoneSession,
      error: undefined,
    })
    render(<HostWaitingScreen sessionId="session-abc" />)
    expect(screen.getByText(/Everyone has claimed their items/)).toBeDefined()
  })

  it('Test 5: Clicking "View results" hydrates the store assignments and sets syncStatus to "results"', () => {
    const sessionWithClaims: SessionPayload = {
      ...mockSession,
      claims: {
        items: { i1: 'p1', i2: 'p2' },
        personSlots: { p1: true, p2: true },
        donePeople: { p1: true, p2: true },
      },
    }
    ;(useSWR as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: sessionWithClaims,
      error: undefined,
    })
    render(<HostWaitingScreen sessionId="session-abc" />)
    fireEvent.click(screen.getByRole('button', { name: /view results/i }))
    const state = useBillStore.getState()
    expect(state.assignments['i1']).toEqual(['p1'])
    expect(state.assignments['i2']).toEqual(['p2'])
    expect(state.syncStatus).toBe('results')
  })
})
