'use client'

const PROGRESS_SEGMENTS = 3

interface ProgressStripProps {
  /** Number of filled segments (1–3). */
  filled: number
}

/**
 * Reusable 3-segment progress strip (Setup / Bill View / Results).
 * Extracted from WizardShell for use on any screen that needs a progress indicator.
 * 3px tall bars, coral-500 filled, zinc-200 empty.
 */
export function ProgressStrip({ filled }: ProgressStripProps) {
  return (
    <div className="flex w-full gap-1 px-5 pt-6 pb-4">
      {Array.from({ length: PROGRESS_SEGMENTS }, (_, idx) => (
        <div
          key={idx}
          className={`h-[3px] flex-1 rounded-sm ${idx + 1 <= filled ? 'bg-coral-500' : 'bg-zinc-200'}`}
        />
      ))}
    </div>
  )
}
