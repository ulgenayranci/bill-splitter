import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { normalizeSession } from '@/lib/normalizeSession'

export const maxDuration = 10

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  try {
    const raw = await redis.get<unknown>(`session:${sessionId}`)
    if (!raw) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    // Single client-facing boundary: undo cjson []-vs-{} shape drift from Lua writes.
    const session = normalizeSession(raw)
    if (!session) {
      console.error('Session GET error: stored value is not a session object')
      return NextResponse.json({ error: 'Session not found' }, { status: 500 })
    }
    // Flat model: every field is safe to return (no host-only secrets in schema).
    // currencyCode and all other SessionPayload fields flow to the client automatically.
    return NextResponse.json(session)
  } catch (err) {
    console.error('Session GET error:', err)
    return NextResponse.json({ error: 'Session not found' }, { status: 500 })
  }
}
