'use client'

import { useEffect } from 'react'
import { useBillStore } from '@/stores/useBillStore'

interface WizardShellProps {
  children: React.ReactNode
}

const STEP_LABELS = ['Add People', 'Add Items', 'Assign / Share', 'Results']

export function WizardShell({ children }: WizardShellProps) {
  const step = useBillStore((s) => s.step)
  const setStep = useBillStore((s) => s.setStep)

  // Sync step → URL hash on step change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#step-${step}`)
    }
  }, [step])

  // Sync URL hash → step on browser back/forward
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleHashChange = () => {
      const match = window.location.hash.match(/#step-([1-4])/)
      if (match) {
        const num = Number(match[1])
        if (num >= 1 && num <= 4) {
          setStep(num as 1 | 2 | 3 | 4)
        }
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [setStep])

  return (
    <div
      className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-background"
      style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
    >
      {/* Progress strip — 4px tall, 4 segments */}
      <div className="flex h-1 w-full px-5">
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
