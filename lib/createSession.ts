import type { Person, Item } from '@/stores/useBillStore'

export interface CreateSessionInput {
  people: Person[]
  items: Item[]
  currencyCode: string
}

export interface CreateSessionResult {
  sessionId: string
  guestUrl: string
}

/**
 * Shared helper that POSTs /api/session with {people, items, currencyCode}
 * and returns {sessionId, guestUrl}. Used by both SetupStep and ShareLinkButton
 * so the session-create logic lives in one place.
 *
 * Assignments are NOT sent — claims start empty per the flat model (CLAIM-01/03).
 * Throws with "Session creation failed: {status}" on non-OK responses.
 */
export async function createSession(
  { people, items, currencyCode }: CreateSessionInput,
  signal?: AbortSignal,
): Promise<CreateSessionResult> {
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ people, items, currencyCode }),
    signal,
  })
  if (!res.ok) throw new Error(`Session creation failed: ${res.status}`)
  const { sessionId } = (await res.json()) as { sessionId: string }
  const origin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
  const guestUrl = `${origin}/split/${sessionId}`
  return { sessionId, guestUrl }
}
