'use client'

const PROGRESS_SEGMENTS = 3

interface ProgressStripProps {
  /** Number of filled segments (1–3). */
  filled: number
}

/**
 * Reusable 3-segment progress strip (Setup / Bill View / Results).
 * Extracted from WizardShell for use on any screen that needs a progress indicator.
 * 3px tall bars, amber-600 filled, zinc-200 empty.
 */
export function ProgressStrip({ filled }: ProgressStripProps) {
  return (
    <div className="flex w-full gap-1 px-5 pt-2.5">
      {Array.from({ length: PROGRESS_SEGMENTS }, (_, idx) => (
        <div
          key={idx}
          className={`h-[3px] flex-1 rounded-sm ${idx + 1 <= filled ? 'bg-amber-600' : 'bg-zinc-200'}`}
        />
      ))}
    </div>
  )
}
