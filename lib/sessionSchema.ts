import type { Item, ItemId, Person, PersonId } from '@/stores/useBillStore'

export interface SessionClaims {
  /** itemId -> personId who claimed it (absent = unclaimed) */
  items: Record<ItemId, PersonId>
  /** personId -> true if this person has claimed their slot */
  personSlots: Record<PersonId, boolean>
  /** personId -> true when they tapped "I'm done" */
  donePeople: Record<PersonId, boolean>
}

export interface SessionPayload {
  people: Person[]
  items: Item[]
  tipPercent: number
  claims: SessionClaims
  createdAt: number
}
