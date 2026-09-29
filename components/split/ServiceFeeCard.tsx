'use client'

import { Check, Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import { formatCents } from '@/lib/billMath'

interface ServiceFeeCardProps {
  feeCents: number
  myShareCents: number
  peopleCount: number
  myColorIndex: number
  currencyCode?: string
}

/**
 * Locked, always-selected, non-interactive service fee card. Visually matches a selected
 * ClaimableItemCard but has no role/onClick/stepper: the fee is split equally among
 * everyone and cannot be un-claimed.
 */
export function ServiceFeeCard({
  feeCents,
  myShareCents,
  peopleCount,
  myColorIndex,
  currencyCode,
}: ServiceFeeCardProps) {
  const hex = (AVATAR_COLORS[myColorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0])
    .replace('bg-[', '')
    .replace(']', '')

  return (
    <Card
      data-testid="service-fee-card"
      aria-label="Service fee, shared equally by everyone"
      className="flex min-h-[44px] flex-col gap-2 rounded-lg border px-4 py-3 shadow-none ring-0"
      style={{
        borderColor: hex,
        backgroundColor: '#ffffff',
        backgroundImage: `linear-gradient(${hex}14, ${hex}14)`,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: hex }}
          aria-hidden="true"
        >
          <Check size={16} className="text-white" />
        </span>
        <span className="flex flex-1 items-center gap-1.5 text-[16px] font-semibold">
          Service fee
          <Lock size={14} className="text-zinc-400" aria-hidden="true" />
        </span>
        <span className="text-[14px] text-zinc-500">{formatCents(feeCents, currencyCode ?? 'USD')}</span>
      </div>
      <p className="text-[14px] text-zinc-500" data-testid="service-fee-share">
        Shared by everyone · your share {formatCents(myShareCents, currencyCode ?? 'USD')}
        {peopleCount > 1 ? ` (${peopleCount} people)` : ''}
      </p>
    </Card>
  )
}
