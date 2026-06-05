'use client'

import { useEffect } from 'react'
import { useBillStore } from '@/stores/useBillStore'
import { AppHeader } from './AppHeader'

interface WizardShellProps {
  children: React.ReactNode
}

// D-07: 3-segment progress strip (Setup / Bill View / Results), replacing the v1
// 4-segment strip. Internal store steps map onto these segments:
//   step 1 (Setup) → 1 filled · step 3 (Assign/Bill View) → 2 · step 4 (Results) → 3
const PROGRESS_SEGMENTS = 3
function filledSegments(step: number): number {
  if (step >= 4) return 3
  if (step >= 3) return 2
  return 1
}

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

  const filled = filledSegments(step)

  return (
    <div
      className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* App shell header — present on every screen (SHELL-01/02) */}
      <AppHeader />

      {/* Progress strip — 3px tall bars, 3 segments (Setup / Bill View / Results) */}
      <div className="flex w-full gap-1 px-5 pt-2.5">
        {Array.from({ length: PROGRESS_SEGMENTS }, (_, idx) => (
          <div
            key={idx}
            className={`h-[3px] flex-1 rounded-sm ${idx + 1 <= filled ? 'bg-amber-600' : 'bg-zinc-200'}`}
          />
        ))}
      </div>
      <main className="flex-1 px-6 py-8 pb-24">{children}</main>
    </div>
  )
}
