import type { Item, ItemId, Person, PersonId } from '@/stores/useBillStore'

/** A single person's claim on an item — quantity owned and who assigned it. */
export interface ClaimEntry {
  qty: number
  assignedBy: 'self' | 'host'
}

/** Payload shape varies by EditRequest.type — kept as a flat union for storage simplicity. */
export type EditPayload =
  | { name: string; priceCents: number; quantity: number }
  | { itemId: ItemId }
  | { itemId: ItemId; newPriceCents: number }
  | { itemId: ItemId; newName: string }

export interface EditRequest {
  personId: PersonId
  type: 'add' | 'remove' | 'edit_price' | 'edit_name'
  payload: EditPayload
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

export interface Dispute {
  itemId: ItemId
  personId: PersonId
  status: 'pending' | 'resolved' | 'rejected'
  createdAt: number
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
  /** Durable host capability token (D-02). Generated server-side at POST /api/session. */
  hostToken: string
  /** Set when the host picks their identity slot (D-13). */
  hostPersonId?: PersonId
  /** Per-person tip in cents (D-07). Absent personId means tip not yet confirmed. */
  tips: Record<PersonId, number>
  /** Keyed by nanoid request id. */
  editRequests: Record<string, EditRequest>
  /** Keyed by nanoid dispute id. */
  disputes: Record<string, Dispute>
  createdAt: number
  // NOTE: tipPercent intentionally removed (D-17). Phase 4 sessions are incompatible.
}
