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
    // CR-01: Strip hostToken before returning — guests must never see the host secret.
    // hostToken is a write-capability secret; returning it would allow any guest to
    // impersonate the host and approve/reject all edits and disputes.
    const { hostToken: _hostToken, ...safeSession } = session
    return NextResponse.json(safeSession)
  } catch (err) {
    console.error('Session GET error:', err)
    return NextResponse.json({ error: 'Session not found' }, { status: 500 })
  }
}
