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
  const itemId = b.itemId
  if (typeof personId !== 'string' || personId.length === 0) {
    return NextResponse.json({ error: 'Invalid personId' }, { status: 400 })
  }
  if (typeof itemId !== 'string' || itemId.length === 0) {
    return NextResponse.json({ error: 'Invalid itemId' }, { status: 400 })
  }

  try {
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }
    if (!session.people.some((p) => p.id === personId)) {
      return NextResponse.json({ error: 'Invalid personId: not in session' }, { status: 400 })
    }
    if (!session.claims?.personSlots?.[personId]) {
      return NextResponse.json({ error: 'Forbidden: slot not claimed' }, { status: 403 })
    }
    const claim = session.claims?.items?.[itemId]?.[personId]
    if (!claim || claim.assignedBy !== 'host' || claim.qty <= 0) {
      return NextResponse.json({ error: 'No host-assigned claim to accept' }, { status: 400 })
    }

    const updated: SessionPayload = {
      ...session,
      claims: {
        ...session.claims,
        items: {
          ...session.claims.items,
          [itemId]: {
            ...session.claims.items[itemId],
            [personId]: { ...claim, accepted: true },
          },
        },
      },
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Accept error:', err)
    return NextResponse.json({ error: 'Accept failed' }, { status: 500 })
  }
}
