'use client'

import { BillChargeCard } from '@/components/split/BillChargeCard'

interface ServiceFeeCardProps {
  feeCents: number
  myShareCents: number
  peopleCount: number
  myColorIndex: number
  currencyCode?: string
}

/** Locked service fee card: thin wrapper over BillChargeCard. */
export function ServiceFeeCard({ feeCents, ...rest }: ServiceFeeCardProps) {
  return <BillChargeCard label="Service fee" testId="service-fee-card" chargeCents={feeCents} {...rest} />
}
