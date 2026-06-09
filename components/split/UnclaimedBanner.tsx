'use client'

import type { SessionPayload } from '@/lib/sessionSchema'
import { getUnclaimedCounts } from '@/lib/sessionUtils'

interface UnclaimedBannerProps {
  session: SessionPayload
  onTap: () => void
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
