/**
 * Duplicate names get a random emoji so people can tell them apart ("Mert", "Mert 🦊").
 * The emoji is only a tie-breaker — it carries no meaning.
 *
 * The same rule runs in two places: here (bill creation) and in Lua (UNIQUE_NAME_LUA,
 * used by claim_seat / rename_person / add_person) so every phone sees the same name.
 * Lua can't make good random numbers inside Redis scripts, so the caller passes a
 * shuffled emoji list and both sides take the first emoji that makes the name unique.
 */
export const NAME_EMOJIS = ['🦊', '🐼', '🐸', '🦁', '🐙', '🦉', '🐢', '🐝', '🦄', '🐬', '🌵', '🍋', '🌻', '🍉', '⭐', '🌈'] as const

/** A freshly shuffled copy of NAME_EMOJIS. */
export function shuffledEmojis(random: () => number = Math.random): string[] {
  const list = [...NAME_EMOJIS] as string[]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Returns `name` (trimmed) if no other name matches it (case-insensitive), else
 * `name + ' ' + emoji` using the first emoji in `emojiOrder` that makes it unique.
 * Blank names (empty seats) are returned unchanged.
 */
export function uniqueName(name: string, otherNames: readonly string[], emojiOrder: readonly string[]): string {
  const base = name.trim()
  if (!base) return base
  const taken = otherNames.filter((n) => typeof n === 'string' && n.trim() !== '')
  if (!taken.some((n) => same(n, base))) return base
  for (const e of emojiOrder) {
    const candidate = `${base} ${e}`
    if (!taken.some((n) => same(n, candidate))) return candidate
  }
  let k = 2
  while (taken.some((n) => same(n, `${base} ${k}`))) k++
  return `${base} ${k}`
}

/** Dedupe a whole people list in order (earlier names keep theirs). */
export function dedupePeopleNames<P extends { name: string }>(people: readonly P[], emojiOrder: readonly string[]): P[] {
  const out: P[] = []
  for (const p of people) {
    out.push({ ...p, name: uniqueName(p.name, out.map((o) => o.name), emojiOrder) })
  }
  return out
}
