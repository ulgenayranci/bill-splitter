import type { Item, ItemId, Person, PersonId } from '@/stores/useBillStore'

/** Parse user-typed dollar string → integer cents. Returns null if invalid or zero. */
export function parseCents(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const cents = Math.round(parseFloat(trimmed) * 100)
  if (cents === 0) return null // reject zero-price items
  return cents
}

/** Format integer cents → display string ("$12.50"). */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Sum of all item total prices.
 *
 * WR-03 / IN-02: `item.priceCents` is the **full line price** for the item (not per-unit).
 * For a single-qty item this equals the unit price. For multi-qty items, the OCR pipeline
 * and `addItem` store both store the total line price (e.g., 3 beers × $5 → priceCents=1500).
 * This function intentionally does NOT multiply by `item.quantity` — that would double-count.
 */
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

/**
 * Phase 6 proportional share for a single person, derived from the multi-claimant
 * claims model. Formula (D-03):
 *   share = round(item.priceCents * myQty / totalClaimedQty)
 *
 * WR-03: `item.priceCents` is the **full line price** (not per-unit). For a 3-qty item
 * worth $15 total, priceCents=1500. If 2 of 3 units are claimed by this person:
 *   share = round(1500 * 2 / 3) = 1000 ✓
 * This is correct because priceCents already represents the total, not a unit price.
 * Do NOT multiply by item.quantity here — that would over-charge proportionally.
 *
 * If totalClaimedQty is 0, the item contributes nothing (no division by zero).
 * Per-person tip is added by the caller via the tipCents arg (D-07).
 */
export function computePersonShareFromClaims(
  personId: PersonId,
  items: Item[],
  claimsItems: Record<ItemId, Record<PersonId, { qty: number }>>,
  tipCents: number
): {
  itemSubtotal: number
  tip: number
  total: number
  lineItems: Array<{ item: Item; shareCents: number; claimedQty: number }>
} {
  const lineItems: Array<{ item: Item; shareCents: number; claimedQty: number }> = []
  let itemSubtotal = 0

  for (const item of items) {
    const claimsForItem = claimsItems[item.id] ?? {}
    const myEntry = claimsForItem[personId]
    const myQty = myEntry?.qty ?? 0
    if (myQty === 0) continue

    const totalQty = Object.values(claimsForItem).reduce(
      (sum, entry) => sum + (entry?.qty ?? 0),
      0
    )
    if (totalQty === 0) continue // defense-in-depth (Pitfall 2)

    const shareCents = Math.round((item.priceCents * myQty) / totalQty)
    itemSubtotal += shareCents
    lineItems.push({ item, shareCents, claimedQty: myQty })
  }

  return {
    itemSubtotal,
    tip: tipCents,
    total: itemSubtotal + tipCents,
    lineItems,
  }
}

/**
 * Equal share in cents for one sharer, using largest-remainder.
 *
 * Guarantees: sum of computeEqualShareCents(p, n, 0..n-1) === priceCents exactly.
 * No floating-point splits: integer division + remainder distribution avoids any
 * rounding loss that Math.round would introduce on 3-way or other uneven splits.
 *
 * Determinism rule: the CALLER must sort claimant personIds lexicographically
 * ascending before assigning myIndex. The lowest personId (index 0) gets the extra
 * cent when the price doesn't divide evenly — this is stable across all devices and
 * renders because personId order is consistent (Phase 9, Critical Decision C).
 *
 * Only for single-qty tap-to-join items (D-13). Multi-qty proportional splits use
 * computePersonShareFromClaims instead.
 *
 * @param priceCents  Full line price in integer cents.
 * @param numSharers  Total number of people sharing this item (>= 1).
 * @param myIndex     0-based index of this sharer in sorted claimant list.
 * @returns           This person's share in integer cents.
 */
export function computeEqualShareCents(
  priceCents: number,
  numSharers: number,
  myIndex: number
): number {
  if (numSharers <= 0) return 0
  const base = Math.floor(priceCents / numSharers)
  const remainder = priceCents % numSharers
  return base + (myIndex < remainder ? 1 : 0)
}
