import type { SessionPayload } from '@/lib/sessionSchema'

/**
 * Redis Lua's cjson cannot tell an empty JSON object from an empty array, so any Lua
 * write can flip `{}` fields to `[]` (or `[]` to `{}`). This is the single client-facing
 * boundary (GET /api/session/[sessionId]) that restores the expected shapes. Lua scripts
 * deliberately do not rewrite other fields' shapes. Pure, non-mutating and idempotent.
 */
function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

export function normalizeSession(raw: unknown): SessionPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const src = raw as Record<string, unknown>
  const claims = asRecord(src.claims)
  const rawItems = asRecord(claims.items)
  const items: Record<string, unknown> = {}
  for (const key of Object.keys(rawItems)) items[key] = asRecord(rawItems[key])

  return {
    ...src,
    people: asArray(src.people),
    items: asArray(src.items),
    tips: asRecord(src.tips),
    currencyCode: typeof src.currencyCode === 'string' ? src.currencyCode : 'USD',
    claims: {
      ...claims,
      items,
      personSlots: asRecord(claims.personSlots),
      donePeople: asRecord(claims.donePeople),
    },
  } as unknown as SessionPayload
}
