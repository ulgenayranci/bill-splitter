'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBillStore } from '@/stores/useBillStore'
import {
  computeSubtotalCents,
  computeTipCents,
  formatCents,
} from '@/lib/billMath'

const PRESETS = [15, 18, 20] as const
type Preset = (typeof PRESETS)[number]

export function SetTipStep() {
  const tipPercent = useBillStore((s) => s.tipPercent)
  const setTipPercent = useBillStore((s) => s.setTipPercent)
  const items = useBillStore((s) => s.items)
  const people = useBillStore((s) => s.people)
  const setStep = useBillStore((s) => s.setStep)

  // Determine initial mode: if current tipPercent matches a preset, start in preset mode
  const [mode, setMode] = useState<'preset' | 'custom'>(() =>
    PRESETS.includes(tipPercent as Preset) ? 'preset' : 'custom'
  )

  // Controlled value for the custom input
  const [customValue, setCustomValue] = useState(String(tipPercent))

  // When switching to custom mode, reset the displayed value to match the store
  useEffect(() => {
    if (mode === 'custom') {
      setCustomValue(String(tipPercent))
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const subtotalCents = computeSubtotalCents(items)
  const tipCents = computeTipCents(subtotalCents, tipPercent)

  const isPresetSelected = (preset: number) =>
    mode === 'preset' && tipPercent === preset

  const handlePresetClick = (preset: Preset) => {
    setTipPercent(preset)
    setMode('preset')
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setCustomValue(raw)
    if (/^\d+(\.\d{1,2})?$/.test(raw) && parseFloat(raw) <= 999) {
      setTipPercent(parseFloat(raw))
    }
    // If invalid (non-numeric, empty, etc.), do not update store
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Heading */}
      <div>
        <h1 className="text-[20px] font-semibold leading-[1.2]">Set tip</h1>
        <p className="mt-1 text-[14px] leading-[1.4] text-zinc-500">
          Pick a preset or enter a custom percent.
        </p>
      </div>

      {/* Subtotal line */}
      <p className="text-[16px]">
        Subtotal:{' '}
        <span className="font-semibold">{formatCents(subtotalCents)}</span>
      </p>

      {/* Preset button row */}
      <div className="flex gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset}
            onClick={() => handlePresetClick(preset)}
            className={[
              'h-12 flex-1',
              isPresetSelected(preset)
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            variant={isPresetSelected(preset) ? 'default' : 'outline'}
          >
            {preset}%
          </Button>
        ))}
        <Button
          onClick={() => setMode('custom')}
          className={[
            'h-12 flex-1',
            mode === 'custom'
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          variant={mode === 'custom' ? 'default' : 'outline'}
        >
          Custom
        </Button>
      </div>

      {/* Custom input (revealed when mode === 'custom') */}
      {mode === 'custom' && (
        <div className="relative flex items-center">
          <Input
            inputMode="decimal"
            placeholder="Enter percent"
            value={customValue}
            onChange={handleCustomChange}
            maxLength={6}
            className="h-12 pr-8 text-base"
          />
          <span className="absolute right-3 text-[16px] text-zinc-500 pointer-events-none">
            %
          </span>
        </div>
      )}

      {/* Live tip amount line */}
      <p className="text-[16px]">
        Tip: <span className="font-semibold">{formatCents(tipCents)}</span>
      </p>

      {/* Equal-split note (D-02) */}
      <p className="text-[14px] text-zinc-500">
        {people.length === 0
          ? 'Tip splits equally'
          : `Tip splits equally among ${people.length} people — ${formatCents(
              Math.floor(tipCents / people.length)
            )} each (display only)`}
      </p>

      {/* Bottom CTA row */}
      <div
        className="mt-auto flex gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <Button
          variant="outline"
          onClick={() => setStep(3)}
          className="h-12 flex-1"
        >
          Back
        </Button>
        <Button
          onClick={() => setStep(5)}
          className="h-12 flex-1 bg-amber-600 hover:bg-amber-700"
        >
          See results
        </Button>
      </div>
    </div>
  )
}
