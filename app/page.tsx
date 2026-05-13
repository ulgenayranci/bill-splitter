'use client'

import { useBillStore } from '@/stores/useBillStore'
import { WizardShell } from '@/components/wizard/WizardShell'
import { AddPeopleStep } from '@/components/wizard/AddPeopleStep'
import { AddItemsStep } from '@/components/wizard/AddItemsStep'
import { AssignItemsStep } from '@/components/wizard/AssignItemsStep'
import { SetTipStep } from '@/components/wizard/SetTipStep'
import { ResultsStep } from '@/components/wizard/ResultsStep'

export default function Page() {
  const step = useBillStore((s) => s.step)
  return (
    <WizardShell>
      {step === 1 && <AddPeopleStep />}
      {step === 2 && <AddItemsStep />}
      {step === 3 && <SetTipStep />}
      {step === 4 && <AssignItemsStep />}
      {step === 5 && <ResultsStep />}
    </WizardShell>
  )
}
