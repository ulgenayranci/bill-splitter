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

/**
 * Guest number for every empty seat without a valid stored number: the smallest numbers not
 * already stored on anyone, assigned in people order. Keeps labels unique when stored and
 * unnumbered seats mix (v2.0 sessions, ADD_PERSON_SCRIPT seats).
 */
function fallbackGuestNumbers(people: readonly Person[]): Map<string, number> {
  const taken = new Set<number>()
  for (const p of people) if (isValidGuestNumber(p.guestNumber)) taken.add(p.guestNumber)
  const assigned = new Map<string, number>()
  let n = 0
  for (const p of people) {
    if (!isEmptySeat(p) || isValidGuestNumber(p.guestNumber)) continue
    do n++
    while (taken.has(n))
    assigned.set(p.id, n)
  }
  return assigned
}

/** Display label: name if claimed, else "Guest N" (stored number, then first unused number among empty seats), else "Guest". Never blank. */
export function seatLabel(person: Person, people?: readonly Person[]): string {
  if (!isEmptySeat(person)) return person.name
  if (isValidGuestNumber(person.guestNumber)) return `Guest ${person.guestNumber}`
  const n = people ? fallbackGuestNumbers(people).get(person.id) : undefined
  return n !== undefined ? `Guest ${n}` : 'Guest'
}

/**
 * Avatar initial: first code point of the trimmed name upper-cased, or "?" for an empty seat.
 * Locale-independent toUpperCase() so server and every phone agree (a tr-TR phone would turn
 * "i" into "İ"); re-split so a multi-character upper case ("ß" -> "SS") stays one character.
 */
export function seatInitial(person: Pick<Person, 'name'>): string {
  if (isEmptySeat(person)) return '?'
  const first = Array.from(person.name.trim())[0]
  return Array.from(first.toUpperCase())[0]
}

/** Next stable guest number: 1 + the highest number in use, stored or fallback-assigned (1 when none). */
export function nextGuestNumber(people: readonly Person[]): number {
  let max = 0
  for (const person of people) {
    if (isValidGuestNumber(person.guestNumber) && person.guestNumber > max) max = person.guestNumber
  }
  for (const n of fallbackGuestNumbers(people).values()) if (n > max) max = n
  return max + 1
}

/**
 * People for a new bill: the scanner (named, seat 1) plus headcount − 1 empty seats
 * "Guest 1".."Guest N-1" with stable stored guest numbers. Pure: ids come from makeId.
 */
export function buildSeatPeople(hostName: string, headcount: number, makeId: () => string): Person[] {
  const guests = Math.max(0, Math.floor(headcount) - 1)
  return [
    { id: makeId(), name: hostName.trim(), colorIndex: 0 },
    ...Array.from({ length: guests }, (_, i) => ({
      id: makeId(),
      name: '',
      colorIndex: (i + 1) % 6,
      guestNumber: i + 1,
    })),
  ]
}
