import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { InvitePeopleStep } from '@/components/split/InvitePeopleStep'

describe('InvitePeopleStep (G4)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the heading and the shareable link', () => {
    render(<InvitePeopleStep sessionId="sess-1" onContinue={vi.fn()} />)
    expect(screen.getByText('Invite your group')).toBeDefined()
    // URL preview ends with /split/<sessionId>
    expect(screen.getByText(/\/split\/sess-1$/)).toBeDefined()
  })

  it('Copy link copies the URL and shows "Copied!"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<InvitePeopleStep sessionId="sess-1" onContinue={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))
    await waitFor(() => expect(screen.getByText('Copied!')).toBeDefined())
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/split/sess-1'))
  })

  it('Share link uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    render(<InvitePeopleStep sessionId="sess-1" onContinue={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /share link/i }))
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('/split/sess-1') })
      )
    )
  })

  it('"Skip → claim items" calls onContinue', () => {
    const onContinue = vi.fn()
    render(<InvitePeopleStep sessionId="sess-1" onContinue={onContinue} />)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
