import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { WizardShell } from '@/components/wizard/WizardShell'
import { useBillStore } from '@/stores/useBillStore'

afterEach(() => { cleanup(); useBillStore.getState().reset() })

describe('WizardShell — Phase 7 (3 segments)', () => {
  it('renders 3 progress strip segments (Setup / Bill View / Results, D-07)', () => {
    const { container } = render(<WizardShell><div data-testid="content" /></WizardShell>)
    const segments = container.querySelectorAll('div.flex-1.bg-amber-600, div.flex-1.bg-zinc-200')
    expect(segments.length).toBe(3)
  })

  it('renders the easy-billsy app shell header (SHELL-01)', () => {
    const { getByLabelText } = render(<WizardShell><div data-testid="content" /></WizardShell>)
    expect(getByLabelText('easy-billsy')).not.toBeNull()
    expect(getByLabelText('Menu')).not.toBeNull()
  })

  it('only the first segment is filled on the Setup step', () => {
    useBillStore.getState().setStep(1)
    const { container } = render(<WizardShell><div data-testid="content" /></WizardShell>)
    expect(container.querySelectorAll('div.flex-1.bg-amber-600').length).toBe(1)
  })

  it('each segment bar carries a non-collapsed h-[3px] height (GAP 1 / D-07)', () => {
    const { container } = render(<WizardShell><div data-testid="content" /></WizardShell>)
    const bars = container.querySelectorAll('div.flex-1.rounded-sm')
    expect(bars.length).toBe(3)
    bars.forEach((bar) => {
      expect(bar.className).toContain('h-[3px]')
    })
  })
})
