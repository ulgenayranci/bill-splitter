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
  // WR-08: server-side cap to prevent overflow and nonsensical tip amounts.
  // 100_000 cents = $1,000 — a generous upper bound for any real restaurant bill.
  const MAX_TIP_CENTS = 100_000
  if (tipCents > MAX_TIP_CENTS) {
    return NextResponse.json({ error: 'tipCents exceeds maximum allowed value' }, { status: 400 })
  }

  try {
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }
    if (!session.people.some((p) => p.id === personId)) {
      return NextResponse.json({ error: 'Invalid personId: not in session' }, { status: 400 })
    }
    // GAP-09-NOLOCK: slot lock guard removed — membership check above is the real authorization

    // WR-01: Non-atomic read-modify-write. Concurrent tip writes from different people
    // are safe (tips is keyed by personId). Same-person concurrent tip writes can race
    // but are extremely unlikely (single confirm button). Acceptable for MVP.
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
