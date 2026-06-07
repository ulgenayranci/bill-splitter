'use client'

import type { SessionPayload } from '@/lib/sessionSchema'

interface UnclaimedBannerProps {
  session: SessionPayload
  onTap: () => void
}

function getUnclaimedCounts(session: SessionPayload): { unclaimed: number; total: number } {
  let unclaimed = 0
  for (const item of session.items) {
    const entries = session.claims?.items?.[item.id] ?? {}
    // WR-02: guard the entry (e?.qty ?? 0) to match the defensive pattern used everywhere
    // else (CollaborativeClaimingView, billMath). A null entry from a malformed payload would
    // otherwise throw and crash the whole claiming view.
    const totalClaimed = Object.values(entries).reduce((sum, e) => sum + (e?.qty ?? 0), 0)
    if (totalClaimed < (item.quantity ?? 1)) unclaimed++
  }
  return { unclaimed, total: session.items.length }
}

export function UnclaimedBanner({ session, onTap }: UnclaimedBannerProps) {
  const { unclaimed, total } = getUnclaimedCounts(session)

  if (unclaimed === 0) return null

  const copy =
    unclaimed === 1
      ? '1 item still unclaimed — tap to find it'
      : `${unclaimed} of ${total} items still unclaimed — tap to find them`

  return (
    <div
      data-testid="unclaimed-banner"
      onClick={onTap}
      className="flex items-center justify-between gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-[14px] text-amber-800 cursor-pointer"
    >
      <span>{copy}</span>
    </div>
  )
}
