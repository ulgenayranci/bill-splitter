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
    // Validate personId is a known participant
    if (!session.people.some((p) => p.id === personId)) {
      return NextResponse.json({ error: 'Invalid personId: not in session' }, { status: 400 })
    }
    // CR-02: Verify caller has claimed their slot — prevents anonymous callers from
    // marking someone else as done (or un-done) without having picked that identity.
    if (!session.claims?.personSlots?.[personId]) {
      return NextResponse.json({ error: 'Forbidden: slot not claimed' }, { status: 403 })
    }

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
