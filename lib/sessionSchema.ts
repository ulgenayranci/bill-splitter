import type { Item, ItemId, Person, PersonId } from '@/stores/useBillStore'

/** A single person's claim on an item — quantity owned. Every claim is a self-claim in the flat model. */
export interface ClaimEntry {
  qty: number
}

export interface SessionClaims {
  /** itemId -> personId -> ClaimEntry (multi-claimant per D-15) */
  items: Record<ItemId, Record<PersonId, ClaimEntry>>
  /** personId -> true if this person has claimed their identity slot */
  personSlots: Record<PersonId, boolean>
  /** personId -> true when they tapped "I'm done" (soft checkpoint per D-08) */
  donePeople: Record<PersonId, boolean>
}

export interface SessionPayload {
  people: Person[]
  items: Item[]
  claims: SessionClaims
  /** Per-person tip in cents (D-07). Absent personId means tip not yet confirmed. */
  tips: Record<PersonId, number>
  createdAt: number
  /** ISO 4217 currency code. Defaults to 'USD' at creation. Display threading is Phase 10. */
  currencyCode: string
}

/**
 * The safe subset of SessionPayload returned by GET /api/session/[sessionId].
 * In the flat model there are no secrets to strip — PublicSessionPayload equals SessionPayload.
 * Kept as an alias so existing imports continue to compile without changes.
 */
export type PublicSessionPayload = SessionPayload
