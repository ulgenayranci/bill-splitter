import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload, Dispute } from '@/lib/sessionSchema'

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
    // CR-02: Verify the caller has claimed their slot before acting on behalf of personId.
    // Without this, any anonymous caller who knows a sessionId + personId can file disputes.
    if (!session.claims?.personSlots?.[personId]) {
      return NextResponse.json({ error: 'Forbidden: slot not claimed' }, { status: 403 })
    }
    if (!session.items.some((it) => it.id === itemId)) {
      return NextResponse.json({ error: 'Invalid itemId: not in session' }, { status: 400 })
    }

    const disputeId = nanoid()
    const dispute: Dispute = {
      itemId,
      personId,
      status: 'pending',
      createdAt: Date.now(),
    }
    const updated: SessionPayload = {
      ...session,
      disputes: { ...(session.disputes ?? {}), [disputeId]: dispute },
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    return NextResponse.json({ ok: true, disputeId })
  } catch (err) {
    console.error('Dispute error:', err)
    return NextResponse.json({ error: 'Dispute failed' }, { status: 500 })
  }
}
