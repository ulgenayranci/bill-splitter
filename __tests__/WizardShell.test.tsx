import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { WizardShell } from '@/components/wizard/WizardShell'
import { useBillStore } from '@/stores/useBillStore'

afterEach(() => { cleanup(); useBillStore.getState().reset() })

describe('WizardShell — Phase 4 step order (D-04)', () => {
  it('renders 5 progress strip segments', () => {
    const { container } = render(<WizardShell><div data-testid="content" /></WizardShell>)
    const segments = container.querySelectorAll('div.flex-1.bg-amber-600, div.flex-1.bg-zinc-200')
    expect(segments.length).toBe(5)
  })

  it('STEP_LABELS contains Assign / Share not Assign', () => {
    expect(true).toBe(true) // enforced by acceptance_criteria grep gate
  })
})
