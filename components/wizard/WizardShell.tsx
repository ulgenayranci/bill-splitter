'use client'

import { useEffect } from 'react'
import { useBillStore } from '@/stores/useBillStore'

interface WizardShellProps {
  children: React.ReactNode
}

const STEP_LABELS = ['Add People', 'Add Items', 'Assign', 'Tip', 'Results']

export function WizardShell({ children }: WizardShellProps) {
  const step = useBillStore((s) => s.step)
  const setStep = useBillStore((s) => s.setStep)

  // Sync step → URL hash on step change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `#step-${step}`)
    }
  }, [step])

  // Sync URL hash → step on browser back/forward
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleHashChange = () => {
      const match = window.location.hash.match(/#step-([1-5])/)
      if (match) setStep(Number(match[1]) as 1 | 2 | 3 | 4 | 5)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [setStep])

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-background">
      {/* Progress strip — 4px tall per UI-SPEC */}
      <div className="flex h-1 w-full">
        {STEP_LABELS.map((_, idx) => (
          <div
            key={idx}
            className={`flex-1 ${idx + 1 <= step ? 'bg-amber-600' : 'bg-zinc-200'}`}
          />
        ))}
      </div>
      <main className="flex-1 px-6 py-8 pb-24">{children}</main>
    </div>
  )
}
