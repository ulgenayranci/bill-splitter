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
  const personId =
    body && typeof body === 'object' && 'personId' in body
      ? (body as { personId: unknown }).personId
      : undefined
  if (typeof personId !== 'string' || personId.length === 0) {
    return NextResponse.json({ error: 'Invalid personId' }, { status: 400 })
  }

  try {
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }
    const updated: SessionPayload = {
      ...session,
      claims: {
        items: { ...(session.claims?.items ?? {}) },
        personSlots: { ...(session.claims?.personSlots ?? {}) },
        donePeople: { ...(session.claims?.donePeople ?? {}), [personId]: true },
      },
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Done error:', err)
    return NextResponse.json({ error: 'Done failed' }, { status: 500 })
  }
}
