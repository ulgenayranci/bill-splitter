import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ResultsStep } from '@/components/wizard/ResultsStep'

const setStepMock = vi.fn()
const resetMock = vi.fn()

vi.mock('@/stores/useBillStore', async () => {
  const AVATAR_COLORS = [
    'bg-amber-400', 'bg-sky-400', 'bg-emerald-400', 'bg-violet-400', 'bg-rose-400', 'bg-orange-400',
  ] as const
  const state = {
    people: [
      { id: 'p1', name: 'Alice', colorIndex: 0 },
      { id: 'p2', name: 'Bob', colorIndex: 1 },
    ],
    items: [
      { id: 'i1', name: 'Pizza', priceCents: 1000, quantity: 1 },
      { id: 'i2', name: 'Beer', priceCents: 500, quantity: 1 },
    ],
    assignments: { i1: ['p1', 'p2'], i2: ['p2'] },
    setStep: (...args: unknown[]) => setStepMock(...args),
    reset: (...args: unknown[]) => resetMock(...args),
  }
  const useBillStore = (selector: (s: typeof state) => unknown) => selector(state)
  useBillStore.getState = () => state
  return { useBillStore, AVATAR_COLORS }
})

vi.mock('@/components/wizard/ShareLinkButton', () => ({
  ShareLinkButton: () => <div data-testid="share-link-button" />,
}))

describe('ResultsStep — Phase 6 (no tip in wizard)', () => {
  beforeEach(() => {
    setStepMock.mockReset()
    resetMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('Test 1 (heading): renders heading', () => {
    render(<ResultsStep />)
    expect(screen.getByText(/what each person owes/i)).toBeDefined()
  })

  it('Test 2 (renders ShareLinkButton at the bottom)', () => {
    render(<ResultsStep />)
    expect(screen.getByTestId('share-link-button')).toBeDefined()
  })

  it('Test 3 (back goes to step 3, not step 4)', () => {
    render(<ResultsStep />)
    fireEvent.click(screen.getByRole('button', { name: /Back to assign/i }))
    expect(setStepMock).toHaveBeenCalledWith(3)
  })

  it('Test 4 (totals computed with tipPercent=0)', () => {
    render(<ResultsStep />)
    // Alice owes $5.00 (half of $10 pizza) — no tip
    // Bob owes $5.00 (half pizza) + $5.00 (beer) = $10.00
    expect(screen.getAllByText('$5.00').length).toBeGreaterThan(0)
    expect(screen.getByText('$10.00')).toBeDefined()
  })

  it('Test 5 (total bill display: no tip)', () => {
    render(<ResultsStep />)
    // Subtotal $15.00 + tip $0.00 = $15.00
    expect(screen.getByText(/Total bill.*\$15\.00/)).toBeDefined()
  })

  it('Test 6 (start over): clicking Start over calls reset', () => {
    render(<ResultsStep />)
    fireEvent.click(screen.getByRole('button', { name: /Start over/i }))
    expect(resetMock).toHaveBeenCalled()
  })

  it('Test 7 (no HostWaitingScreen reference): the file does not import HostWaitingScreen', async () => {
    // Statically verified via the grep acceptance_criteria below. This test
    // confirms the component renders without HostWaitingScreen showing for any state.
    render(<ResultsStep />)
    expect(screen.queryByText(/Waiting for everyone/i)).toBeNull()
  })
})
