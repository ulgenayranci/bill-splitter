import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { DONE_SCRIPT } from '@/lib/sessionLua'

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
    // Field-level atomic write (Pitfall 4 / CR-01): one Lua eval, no GET-spread-SET window.
    // Real-Redis concurrency verification happens in Phase 13 (REL-03).
    const result = await redis.eval(DONE_SCRIPT, [`session:${sessionId}`], [personId, String(done)])
    if (result === 'OK') {
      return NextResponse.json({ ok: true })
    }
    if (result === 'session_not_found') {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }
    if (result === 'person_not_found') {
      return NextResponse.json({ error: 'Invalid personId: not in session' }, { status: 400 })
    }
    console.error('Done unexpected script result:', result)
    return NextResponse.json({ error: 'Done failed' }, { status: 500 })
  } catch (err) {
    console.error('Done error:', err)
    return NextResponse.json({ error: 'Done failed' }, { status: 500 })
  }
}
