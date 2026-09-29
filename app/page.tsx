'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBillStore } from '@/stores/useBillStore'
import { WizardShell } from '@/components/wizard/WizardShell'
import { SetupStep } from '@/components/wizard/SetupStep'
import { ScanItemsEditor } from '@/components/wizard/ScanItemsEditor'

export default function Page() {
  const router = useRouter()
  const sessionId = useBillStore((s) => s.sessionId)
  const hasHydrated = useBillStore((s) => s._hasHydrated)
  const step = useBillStore((s) => s.step)
  const itemCount = useBillStore((s) => s.items.length)
  const setStep = useBillStore((s) => s.setStep)

  // Rehydrate the persisted bill session after mount (skipHydration avoids SSR mismatch).
  useEffect(() => {
    useBillStore.persist.rehydrate()
  }, [])

  // Resume redirect: once the store has rehydrated, if we already have a sessionId the
  // user has an in-progress collaborative bill — send them back to it so they don't land
  // on an empty Setup screen. Use replace (not push) so back-button doesn't loop.
  useEffect(() => {
    if (hasHydrated && sessionId) {
      router.replace(`/split/${sessionId}`)
    }
  }, [hasHydrated, sessionId, router])

  // Stale step 2 with no items (e.g. items cleared) -> fall back to setup.
  useEffect(() => {
    if (hasHydrated && step === 2 && itemCount === 0) setStep(1)
  }, [hasHydrated, step, itemCount, setStep])

  return (
    <WizardShell>
      {/* Hold until localStorage rehydrates. If a sessionId is found, the effect above
          will redirect — render nothing to avoid a Setup flash during the redirect. */}
      {hasHydrated && !sessionId &&
        (step === 2 && itemCount > 0 ? <ScanItemsEditor /> : <SetupStep />)}
    </WizardShell>
  )
}
