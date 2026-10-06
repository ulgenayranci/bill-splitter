import type { Person } from '@/stores/useBillStore'

/** Upper bound for a stored guest number (monotonic, so may exceed 20 after add/remove cycles). */
export const MAX_GUEST_NUMBER = 999

/** True when v is an integer in 1..MAX_GUEST_NUMBER. */
export function isValidGuestNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_GUEST_NUMBER
}

/** An empty seat is a Person whose name is blank. */
export function isEmptySeat(person: Pick<Person, 'name'>): boolean {
  return typeof person.name !== 'string' || person.name.trim() === ''
}

/** Display label: name if claimed, else "Guest N" (stored number, then ordinal among empty seats), else "Guest". Never blank. */
export function seatLabel(person: Person, people?: readonly Person[]): string {
  if (!isEmptySeat(person)) return person.name
  if (isValidGuestNumber(person.guestNumber)) return `Guest ${person.guestNumber}`
  if (people) {
    const empties = people.filter(isEmptySeat)
    const idx = empties.findIndex((e) => e.id === person.id)
    if (idx >= 0) return `Guest ${idx + 1}`
  }
  return 'Guest'
}

/** Avatar initial: first code point of the trimmed name upper-cased, or "?" for an empty seat. */
export function seatInitial(person: Pick<Person, 'name'>): string {
  if (isEmptySeat(person)) return '?'
  const first = Array.from(person.name.trim())[0]
  return first.toLocaleUpperCase()
}

/** Next stable guest number: 1 + max valid guestNumber across all people (1 when none). */
export function nextGuestNumber(people: readonly Person[]): number {
  let max = 0
  for (const person of people) {
    if (isValidGuestNumber(person.guestNumber) && person.guestNumber > max) max = person.guestNumber
  }
  return max + 1
}
