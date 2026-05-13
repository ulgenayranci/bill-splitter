import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

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
    const session = await redis.get(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return NextResponse.json(session)
  } catch (err) {
    console.error('Session GET error:', err)
    return NextResponse.json({ error: 'Session not found' }, { status: 500 })
  }
}
