import type { Item, ItemId, Person, PersonId } from '@/stores/useBillStore'

/** Parse user-typed dollar string → integer cents. Returns null if invalid or zero. */
export function parseCents(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const cents = Math.round(parseFloat(trimmed) * 100)
  if (cents === 0) return null // reject zero-price items
  return cents
}

/**
 * Format integer cents → display string.
 *
 * Backward-compatible: calling with no `currencyCode` (or undefined) returns the
 * legacy `"$X.XX"` format, preserving all existing call sites unchanged.
 *
 * When `currencyCode` is provided, uses `Intl.NumberFormat` to render the correct
 * symbol and decimal places for the given ISO 4217 currency code:
 *   - Standard (2-decimal) currencies: `formatCents(1250, 'EUR')` → `"€12.50"`
 *   - Zero-decimal currencies (JPY, KRW): `formatCents(1250, 'JPY')` → `"¥1,250"`
 *     (NOT divided by 100 — `minimumFractionDigits=0` gives divisor=1)
 *   - Invalid/empty `currencyCode` falls back to legacy `"$X.XX"` without throwing
 *     (CURR-03, T-10-01)
 */
export function formatCents(cents: number, currencyCode?: string): string {
  if (!currencyCode) {
    // Legacy path: preserves exact '$X.XX' output for all existing call sites
    return `$${(cents / 100).toFixed(2)}`
  }
  try {
    const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode })
    const decimals = fmt.resolvedOptions().minimumFractionDigits ?? 2
    const divisor = Math.pow(10, decimals)
    return fmt.format(cents / divisor)
  } catch {
    // Fallback for invalid/empty currency codes (empty string throws in Intl)
    return `$${(cents / 100).toFixed(2)}`
  }
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
 * Quantity-weighted largest-remainder split of a line price across claimants.
 *
 * CR-02 (multi-qty cent-conservation): given the full line `priceCents`, the total
 * units on the bill (`itemQty`), and the qty each claimant holds, this returns every
 * claimant's exact integer-cents share such that the shares sum to the CLAIMED portion
 * of the line price — `priceCents * totalClaimedQty / itemQty` — with no cent lost or
 * gained across claimants. Unclaimed units contribute 0 to everyone (user decision
 * 2026-06-24: leftover units stay unbilled, not redistributed to claimants).
 *
 * Previously the divisor was `totalClaimedQty` (sum of claimed quantities), which caused
 * partial claimants to absorb the unclaimed units' cost. For example, Carlsberg ×13 @ 2197
 * with one person claiming 1 unit: old divisor = 1 → billed 2197; new divisor = 13 →
 * billed 169 (= unitPrice × claimed).
 *
 * Over-claim guard: if `totalClaimedQty > itemQty` (reachable via concurrent optimistic
 * updates), the divisor is clamped to `max(itemQty, totalClaimedQty)` so no claimant is
 * billed more than the full line price.
 *
 * Algorithm (integer-cents only, no floats in the calculation path):
 *   divisor   = max(itemQty, totalClaimedQty)   — over-claim guard
 *   base[i]   = floor(priceCents * qty[i] / divisor)
 *   remainder = priceCents * totalClaimedQty / divisor - Σ base[i]  (distribute via LRM)
 *   Distribute remainder cents one each to claimants with the largest fractional parts
 *   (priceCents * qty[i]) mod divisor, tie-broken by sorted index (deterministic).
 *
 * Determinism rule: `sortedSharerIds` MUST be the qty>0 claimant personIds sorted
 * lexicographically ascending. The card and the billed Results screen both call this with
 * the same sorted list and the same `itemQty`, so display === billed for every claimant.
 *
 * @param priceCents      Full line price in integer cents.
 * @param sortedSharerIds Claimant personIds (qty > 0) sorted ascending.
 * @param qtyById         Map personId → claimed qty (only ids in sortedSharerIds are read).
 * @param itemQty         Total units on the bill (item.quantity). Defaults to
 *                        totalClaimedQty for backward-compatibility with call sites that
 *                        don't pass it (all-units-claimed case is unchanged).
 * @returns               Map personId → exact integer-cents share. Shares sum to the
 *                        claimed portion of priceCents (< priceCents when units are unclaimed).
 */
export function computeQtyWeightedShares(
  priceCents: number,
  sortedSharerIds: PersonId[],
  qtyById: Record<PersonId, number>,
  itemQty?: number
): Record<PersonId, number> {
  const shares: Record<PersonId, number> = {}
  const n = sortedSharerIds.length
  if (n === 0) return shares

  const totalClaimedQty = sortedSharerIds.reduce((s, id) => s + (qtyById[id] ?? 0), 0)
  if (totalClaimedQty === 0) {
    // No claimed units — every listed sharer gets 0 (caller skips these items anyway).
    for (const id of sortedSharerIds) shares[id] = 0
    return shares
  }

  // Divisor: use itemQty (total bill units) when provided; fall back to totalClaimedQty
  // (all-units-claimed case, backward-compatible). Over-claim guard: if more units are
  // claimed than the item has (concurrent optimistic updates), clamp divisor upward so no
  // one is billed more than the full line price.
  const divisor = itemQty != null
    ? Math.max(itemQty, totalClaimedQty)
    : totalClaimedQty

  // The total cents to distribute across claimants = priceCents × totalClaimedQty / divisor.
  // Use integer arithmetic: compute as floor(priceCents * totalClaimedQty / divisor) and then
  // distribute any 1-cent remainder via the LRM fractional sort below.
  const claimedPriceCents = Math.floor(priceCents * totalClaimedQty / divisor)

  // Step 1 & 2: integer base per claimant + track fractional remainders for LRM.
  let distributed = 0
  const fracs: Array<{ id: PersonId; idx: number; frac: number }> = []
  sortedSharerIds.forEach((id, idx) => {
    const weighted = priceCents * (qtyById[id] ?? 0)
    const base = Math.floor(weighted / divisor)
    shares[id] = base
    distributed += base
    fracs.push({ id, idx, frac: weighted % divisor })
  })

  // Step 3: hand out any leftover cents (claimedPriceCents - distributed) to the claimants
  // with the largest fractional parts, tie-broken by sorted index for determinism.
  const remainder = claimedPriceCents - distributed
  fracs.sort((a, b) => b.frac - a.frac || a.idx - b.idx)
  for (let k = 0; k < remainder && k < fracs.length; k++) {
    shares[fracs[k].id] += 1
  }

  return shares
}

/**
 * Per-person share derived from the multi-claimant claims model.
 *
 * CR-02: for EVERY shared item (single- or multi-qty) the billed share uses the
 * quantity-weighted largest-remainder method (`computeQtyWeightedShares`). This guarantees:
 *   (a) per-person shares sum to the CLAIMED portion of the line price exactly (cent
 *       conservation across claimants), and
 *   (b) the billed share equals the value the card displays (the card calls the same helper
 *       with the same sorted claimant list and the same itemQty).
 *
 * Partial-claim contract (2026-06-24): when fewer units are claimed than `item.quantity`,
 * each claimant pays only `priceCents × claimedQty / item.quantity`. Unclaimed units are
 * NOT redistributed to claimants — they stay unbilled.
 *
 * WR-03: `item.priceCents` is the **full line price** (not per-unit). For a 3-qty item
 * worth $15 total, priceCents=1500. The weighting uses `item.quantity` as the divisor.
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

    const sharerIds = Object.keys(claimsForItem)
      .filter((p) => (claimsForItem[p]?.qty ?? 0) > 0)
      .sort()

    const qtyById: Record<PersonId, number> = {}
    for (const id of sharerIds) qtyById[id] = claimsForItem[id]?.qty ?? 0

    const totalQty = sharerIds.reduce((s, id) => s + qtyById[id], 0)
    if (totalQty === 0) continue // defense-in-depth (Pitfall 2)

    const shares = computeQtyWeightedShares(item.priceCents, sharerIds, qtyById, item.quantity ?? 1)
    const shareCents = shares[personId] ?? 0

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
 * Equivalent to `computeQtyWeightedShares` when every sharer holds qty 1; retained as a
 * thin convenience for single-unit equal splits where only one index is needed.
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
