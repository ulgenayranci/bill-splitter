'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBillStore } from '@/stores/useBillStore'
import { WizardShell } from '@/components/wizard/WizardShell'
import { SetupStep } from '@/components/wizard/SetupStep'

export default function Page() {
  const router = useRouter()
  const sessionId = useBillStore((s) => s.sessionId)
  const hasHydrated = useBillStore((s) => s._hasHydrated)

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

  return (
    <WizardShell>
      {/* Hold until localStorage rehydrates. If a sessionId is found, the effect above
          will redirect — render nothing to avoid a Setup flash during the redirect. */}
      {hasHydrated && !sessionId && <SetupStep />}
    </WizardShell>
  )
}
