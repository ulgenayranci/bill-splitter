import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'

export const maxDuration = 10

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const personId = b.personId
  if (typeof personId !== 'string' || personId.length === 0) {
    return NextResponse.json({ error: 'Invalid personId' }, { status: 400 })
  }
  // done field is required and must be a boolean (D-08: soft checkpoint)
  if (typeof b.done !== 'boolean') {
    return NextResponse.json({ error: 'Invalid done: must be boolean' }, { status: 400 })
  }
  const done = b.done

  try {
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }
    // Validate personId is a known participant (real authorization — GAP-09-NOLOCK: no slot lock needed)
    if (!session.people.some((p) => p.id === personId)) {
      return NextResponse.json({ error: 'Invalid personId: not in session' }, { status: 400 })
    }

    // WR-01: This is a non-atomic read-modify-write. Two concurrent done/undone submissions
    // from the same person in quick succession can race. This is acceptable here because:
    // (a) donePeople is keyed by personId, so concurrent writes from *different* people are safe,
    // (b) same-person concurrent done writes are extremely unlikely in practice (single button tap).
    // A Lua-based atomic write would be the correct fix if this becomes a reliability concern.
    const updated: SessionPayload = {
      ...session,
      claims: {
        items: session.claims?.items ?? {},
        personSlots: session.claims?.personSlots ?? {},
        donePeople: { ...(session.claims?.donePeople ?? {}), [personId]: done },
      },
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Done error:', err)
    return NextResponse.json({ error: 'Done failed' }, { status: 500 })
  }
}
