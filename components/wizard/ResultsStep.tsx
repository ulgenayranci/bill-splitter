'use client'

import { Button } from '@/components/ui/button'
import { useBillStore } from '@/stores/useBillStore'

export function ResultsStep() {
  const setStep = useBillStore((s) => s.setStep)
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[20px] font-semibold">Results (Plan 03)</h1>
      <p className="text-zinc-500">Placeholder — implemented in Plan 03.</p>
      <div className="mt-auto flex gap-3">
        <Button variant="outline" onClick={() => setStep(4)} className="h-12 flex-1">Back</Button>
      </div>
    </div>
  )
}
