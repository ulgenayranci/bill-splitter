import type { Item, ItemId, Person, PersonId } from '@/stores/useBillStore'

/** Parse user-typed dollar string → integer cents. Returns null if invalid. */
export function parseCents(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  return Math.round(parseFloat(trimmed) * 100)
}

/** Format integer cents → display string ("$12.50"). */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/** Sum of all item priceCents. */
export function computeSubtotalCents(items: Item[]): number {
  return items.reduce((s, i) => s + i.priceCents, 0)
}

/** Tip in cents = round(subtotal * tipPercent / 100). */
export function computeTipCents(subtotalCents: number, tipPercent: number): number {
  return Math.round((subtotalCents * tipPercent) / 100)
}

/**
 * Compute per-person totals in cents.
 * Tip split equally among all people (D-02).
 * Shared items split equally using largest-remainder method.
 */
export function computePersonTotals(
  people: Person[],
  items: Item[],
  assignments: Record<ItemId, PersonId[]>,
  tipPercent: number
): Record<PersonId, number> {
  const totals: Record<PersonId, number> = Object.fromEntries(
    people.map((p) => [p.id, 0])
  )

  // Item shares (largest-remainder method)
  for (const item of items) {
    const sharers = assignments[item.id] ?? []
    if (sharers.length === 0) continue
    const base = Math.floor(item.priceCents / sharers.length)
    const remainder = item.priceCents % sharers.length
    sharers.forEach((pid, idx) => {
      if (totals[pid] === undefined) return // orphan defense
      totals[pid] += base + (idx < remainder ? 1 : 0)
    })
  }

  // Tip: equal split across all people (D-02)
  const subtotalCents = computeSubtotalCents(items)
  const totalTipCents = computeTipCents(subtotalCents, tipPercent)
  if (people.length > 0) {
    const tipBase = Math.floor(totalTipCents / people.length)
    const tipRemainder = totalTipCents % people.length
    people.forEach((p, idx) => {
      totals[p.id] += tipBase + (idx < tipRemainder ? 1 : 0)
    })
  }

  return totals
}
