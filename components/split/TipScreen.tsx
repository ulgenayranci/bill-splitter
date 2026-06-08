'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { formatCents } from '@/lib/billMath'
import { AppHeader } from '@/components/wizard/AppHeader'

export interface TipScreenProps {
  sessionId: string
  personId: string
  itemSubtotalCents: number
  onTipConfirmed: () => void
  onBack: () => void
  mutate: () => Promise<unknown>
}

const PRESETS: Array<{ label: string; percent: number }> = [
  { label: '10%', percent: 10 },
  { label: '15%', percent: 15 },
  { label: '20%', percent: 20 },
]

export function TipScreen({
  sessionId,
  personId,
  itemSubtotalCents,
  onTipConfirmed,
  onBack,
  mutate,
}: TipScreenProps) {
  // Tip stored as integer cents. Starts at 0 per D-07.
  const [tipCents, setTipCents] = useState(0)
  const [customPercentText, setCustomPercentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function applyPreset(percent: number) {
    const cents = Math.round((itemSubtotalCents * percent) / 100)
    setTipCents(cents)
    setCustomPercentText(String(percent))
  }

  // WR-08: cap custom tip at 100% to prevent nonsensical values being sent to the server.
  const MAX_TIP_PERCENT = 100

  function applyCustom(text: string) {
    setCustomPercentText(text)
    const parsed = Number(text)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_TIP_PERCENT) {
      const cents = Math.round((itemSubtotalCents * parsed) / 100)
      setTipCents(cents)
    } else if (text === '') {
      setTipCents(0)
    }
  }

  async function handleConfirm() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/session/${sessionId}/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, tipCents }),
      })
      if (!res.ok) {
        setError("Couldn't save tip — try again")
        return
      }
      await mutate()
      onTipConfirmed()
    } catch {
      setError("Couldn't save tip — try again")
    } finally {
      setSubmitting(false)
    }
  }

  const personalTotal = itemSubtotalCents + tipCents

  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-background">
      <AppHeader />
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          type="button"
          variant="ghost"
          className="h-10 px-3"
          onClick={onBack}
          aria-label="Back"
        >
          Back
        </Button>
      </header>

      <div className="flex flex-col gap-6 px-6 py-12">
        <h1 className="text-[20px] font-semibold leading-[1.2]">Add a tip?</h1>

        <div className="flex flex-col gap-1">
          <span
            className="text-[28px] font-semibold text-amber-600"
            data-testid="tip-amount-display"
          >
            {formatCents(tipCents)}
          </span>
          <span className="text-[14px] text-zinc-500">Your tip</span>
        </div>

        <div className="flex gap-2" data-testid="tip-presets">
          {PRESETS.map((p) => (
            <Button
              key={p.percent}
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={() => applyPreset(p.percent)}
              aria-label={`Set tip to ${p.label}`}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[14px] text-zinc-600">Custom %</span>
          <Input
            value={customPercentText}
            onChange={(e) => applyCustom(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            aria-label="Custom tip percent"
          />
        </label>

        <Separator />

        <div className="flex justify-between text-[16px] font-semibold">
          <span>Your total</span>
          <span data-testid="tip-total-display">{formatCents(personalTotal)}</span>
        </div>

        {error && (
          <p role="alert" className="text-[14px] text-red-600">
            {error}
          </p>
        )}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] border-t border-border bg-background px-6 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <Button
          type="button"
          className="h-12 w-full bg-amber-600 hover:bg-amber-700"
          onClick={handleConfirm}
          disabled={submitting}
          aria-label="Confirm tip"
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            'Confirm tip'
          )}
        </Button>
      </div>
    </main>
  )
}
