import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OcrLoadingOverlay } from '@/components/wizard/OcrLoadingOverlay'

describe('OcrLoadingOverlay', () => {
  afterEach(() => {
    cleanup()
    // Belt-and-suspenders: portal renders to document.body, so cleanup
    // should remove the node — but assert it does to catch regressions.
    document.body
      .querySelectorAll('[data-testid="ocr-loading-overlay-orphan"]')
      .forEach((n) => n.remove())
  })

  it('renders nothing when visible is false', () => {
    render(<OcrLoadingOverlay visible={false} />)
    expect(screen.queryByText('Scanning your bill…')).toBeNull()
    expect(document.body.querySelector('[role="status"]')).toBeNull()
  })

  it('renders the spinner and message when visible is true', () => {
    render(<OcrLoadingOverlay visible={true} />)
    expect(screen.getByText('Scanning your bill…')).toBeTruthy()
    const region = document.body.querySelector('[role="status"]')
    expect(region).not.toBeNull()
    expect(region?.getAttribute('aria-live')).toBe('polite')
  })

  it('uses fixed positioning and z-50 so the overlay covers the viewport', () => {
    render(<OcrLoadingOverlay visible={true} />)
    const region = document.body.querySelector('[role="status"]') as HTMLElement | null
    expect(region).not.toBeNull()
    const cls = region!.className
    expect(cls).toContain('fixed')
    expect(cls).toContain('inset-0')
    expect(cls).toContain('z-50')
    expect(cls).toContain('bg-zinc-950/80')
  })

  it('renders the supplied message prop in place of the default copy', () => {
    render(<OcrLoadingOverlay visible={true} message="Expanding names…" />)
    expect(screen.getByText('Expanding names…')).toBeTruthy()
    expect(screen.queryByText('Scanning your bill…')).toBeNull()
  })

  it('sets aria-label to the supplied message', () => {
    render(<OcrLoadingOverlay visible={true} message="Expanding names…" />)
    const region = document.body.querySelector('[role="status"]') as HTMLElement | null
    expect(region).not.toBeNull()
    expect(region!.getAttribute('aria-label')).toBe('Expanding names…')
  })
})
