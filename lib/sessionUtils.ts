import type { Item } from '@/stores/useBillStore'
import type { SessionPayload } from '@/lib/sessionSchema'

/**
 * Count items whose total claimed quantity is below their quantity (unclaimed).
 * Shared helper used by CollaborativeClaimingView, UnclaimedBanner, and PersonResultsScreen.
 *
 * WR-02: guard the entry (e?.qty ?? 0) to match the defensive pattern used elsewhere
 * (CollaborativeClaimingView, billMath). A null entry from a malformed payload would
 * otherwise throw and crash the whole claiming view.
 */
export function getUnclaimedCounts(session: SessionPayload): { unclaimed: number; total: number } {
  let unclaimed = 0
  for (const item of session.items) {
    const entries = session.claims?.items?.[item.id] ?? {}
    const totalClaimed = Object.values(entries).reduce((sum, e) => sum + (e?.qty ?? 0), 0)
    if (totalClaimed < (item.quantity ?? 1)) unclaimed++
  }
  return { unclaimed, total: session.items.length }
}

/**
 * Count claimed vs total *units* (R3-1). Unlike getUnclaimedCounts (which counts rows),
 * this respects item quantity: a single row with quantity 5 contributes 5 to the total,
 * not 1. claimedUnits is capped at the item's quantity so over-claims can't push the
 * chip above N. Used by the claiming-screen "items claimed" x/N chip.
 */
export function getClaimedUnitCounts(session: SessionPayload): { claimedUnits: number; totalUnits: number } {
  let claimedUnits = 0
  let totalUnits = 0
  for (const item of session.items) {
    const qty = item.quantity ?? 1
    totalUnits += qty
    const entries = session.claims?.items?.[item.id] ?? {}
    const totalClaimed = Object.values(entries).reduce((sum, e) => sum + (e?.qty ?? 0), 0)
    claimedUnits += Math.min(totalClaimed, qty)
  }
  return { claimedUnits, totalUnits }
}

/**
 * Return items where totalClaimed < quantity (same traversal as getUnclaimedCounts,
 * filtered to the Item objects instead of a count).
 * Used by PersonResultsScreen to render the "Unclaimed items" section (D-03).
 */
export function getUnclaimedItems(session: SessionPayload): Item[] {
  return session.items.filter((item) => {
    const entries = session.claims?.items?.[item.id] ?? {}
    const totalClaimed = Object.values(entries).reduce((sum, e) => sum + (e?.qty ?? 0), 0)
    return totalClaimed < (item.quantity ?? 1)
  })
}
