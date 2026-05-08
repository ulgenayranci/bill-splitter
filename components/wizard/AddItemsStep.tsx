'use client'

import { Button } from '@/components/ui/button'
import { useBillStore } from '@/stores/useBillStore'

export function AddItemsStep() {
  const setStep = useBillStore((s) => s.setStep)
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[20px] font-semibold">Add items (Plan 02)</h1>
      <p className="text-zinc-500">Placeholder — implemented in Plan 02.</p>
      <div className="mt-auto flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)} className="h-12 flex-1">Back</Button>
        <Button onClick={() => setStep(3)} className="h-12 flex-1 bg-amber-600 hover:bg-amber-700">Assign items</Button>
      </div>
    </div>
  )
}
