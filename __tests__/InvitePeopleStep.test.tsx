import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { InvitePeopleStep } from '@/components/split/InvitePeopleStep'

// AppHeader (mounted at the top of the redesigned invite screen) pulls in
// next/navigation + the bill store — mock both so jsdom render doesn't throw.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

vi.mock('@/stores/useBillStore', () => ({
  useBillStore: (selector: (s: unknown) => unknown) => {
    const store = {
      reset: vi.fn(),
      setStep: vi.fn(),
      people: [],
      items: [],
      billImageUrl: null,
    }
    return selector(store)
  },
}))

describe('InvitePeopleStep (G4)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the heading, Users icon, header and progress strip', () => {
    const { container } = render(<InvitePeopleStep sessionId="sess-1" onContinue={vi.fn()} />)
    expect(screen.getByText('Invite your group')).toBeDefined()
    // App header present (wordmark banner).
    expect(screen.getByRole('banner')).toBeDefined()
    // ProgressStrip: 3 segments, the first filled (amber-600).
    const segments = container.querySelectorAll('.h-\\[3px\\]')
    expect(segments.length).toBe(3)
    expect(segments[0].className).toMatch(/amber-600/)
    expect(segments[1].className).toMatch(/zinc-200/)
  })

  it('shows exactly two action buttons: Skip and Share link', () => {
    render(<InvitePeopleStep sessionId="sess-1" onContinue={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^skip$/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /share link/i })).toBeDefined()
    // No Copy link button, no separate URL preview.
    expect(screen.queryByRole('button', { name: /copy link/i })).toBeNull()
    expect(screen.queryByText(/\/split\/sess-1$/)).toBeNull()
  })

  it('Share link uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    render(<InvitePeopleStep sessionId="sess-1" onContinue={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share link/i }))
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('/split/sess-1') }),
      ),
    )
  })

  it('Share link copies the URL when the native share sheet is absent', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<InvitePeopleStep sessionId="sess-1" onContinue={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share link/i }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/split/sess-1')),
    )
  })

  it('Skip calls onContinue', () => {
    const onContinue = vi.fn()
    render(<InvitePeopleStep sessionId="sess-1" onContinue={onContinue} />)
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
