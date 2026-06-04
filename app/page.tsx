'use client'

import { useEffect } from 'react'
import { useBillStore } from '@/stores/useBillStore'
import { WizardShell } from '@/components/wizard/WizardShell'
import { SetupStep } from '@/components/wizard/SetupStep'
import { AssignItemsStep } from '@/components/wizard/AssignItemsStep'
import { ResultsStep } from '@/components/wizard/ResultsStep'

export default function Page() {
  const step = useBillStore((s) => s.step)
  const hasHydrated = useBillStore((s) => s._hasHydrated)

  // Rehydrate the persisted bill session after mount (skipHydration avoids SSR mismatch).
  useEffect(() => {
    useBillStore.persist.rehydrate()
  }, [])

  return (
    <WizardShell>
      {/* Hold the step content until localStorage rehydrates so a refresh restores
          the in-progress split instead of flashing the empty Setup screen. */}
      {hasHydrated && (
        <>
          {/* Steps 1 & 2 are folded into the single scan-first Setup screen (D-08). */}
          {(step === 1 || step === 2) && <SetupStep />}
          {step === 3 && <AssignItemsStep />}
          {step === 4 && <ResultsStep />}
        </>
      )}
    </WizardShell>
  )
}
