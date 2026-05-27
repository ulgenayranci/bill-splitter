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
  const tipCents = b.tipCents

  if (typeof personId !== 'string' || personId.length === 0) {
    return NextResponse.json({ error: 'Invalid personId' }, { status: 400 })
  }
  if (typeof tipCents !== 'number' || !Number.isInteger(tipCents) || tipCents < 0) {
    return NextResponse.json({ error: 'Invalid tipCents: must be integer >= 0' }, { status: 400 })
  }

  try {
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }
    if (!session.people.some((p) => p.id === personId)) {
      return NextResponse.json({ error: 'Invalid personId: not in session' }, { status: 400 })
    }

    const updated: SessionPayload = {
      ...session,
      tips: { ...(session.tips ?? {}), [personId]: tipCents },
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Tip error:', err)
    return NextResponse.json({ error: 'Tip failed' }, { status: 500 })
  }
}
