import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'

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
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    // Flat model: every field is safe to return (no host-only secrets in schema).
    // currencyCode and all other SessionPayload fields flow to the client automatically.
    return NextResponse.json(session)
  } catch (err) {
    console.error('Session GET error:', err)
    return NextResponse.json({ error: 'Session not found' }, { status: 500 })
  }
}
