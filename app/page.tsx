'use client'

import { useBillStore } from '@/stores/useBillStore'
import { WizardShell } from '@/components/wizard/WizardShell'
import { AddPeopleStep } from '@/components/wizard/AddPeopleStep'
import { AddItemsStep } from '@/components/wizard/AddItemsStep'
import { AssignItemsStep } from '@/components/wizard/AssignItemsStep'
import { ResultsStep } from '@/components/wizard/ResultsStep'

export default function Page() {
  const step = useBillStore((s) => s.step)
  return (
    <WizardShell>
      {step === 1 && <AddItemsStep />}
      {step === 2 && <AddPeopleStep />}
      {step === 3 && <AssignItemsStep />}
      {step === 4 && <ResultsStep />}
    </WizardShell>
  )
}
