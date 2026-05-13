import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'

export const maxDuration = 10

type ClaimBody = {
  personId: string
  action: 'item' | 'slot'
  itemId?: string
}

function validateBody(b: unknown): { ok: true; body: ClaimBody } | { ok: false; error: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'Invalid body' }
  const r = b as Record<string, unknown>
  if (typeof r.personId !== 'string' || r.personId.length === 0) {
    return { ok: false, error: 'Invalid personId' }
  }
  if (r.action !== 'item' && r.action !== 'slot') {
    return { ok: false, error: 'Invalid action' }
  }
  if (r.action === 'item' && (typeof r.itemId !== 'string' || r.itemId.length === 0)) {
    return { ok: false, error: 'Invalid itemId' }
  }
  return { ok: true, body: r as unknown as ClaimBody }
}

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
  const v = validateBody(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { personId, action, itemId } = v.body

  try {
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }

    // Defensive copy — tolerate sessions written without claims.* defaults
    const claims = {
      items: { ...(session.claims?.items ?? {}) },
      personSlots: { ...(session.claims?.personSlots ?? {}) },
      donePeople: { ...(session.claims?.donePeople ?? {}) },
    }

    if (action === 'slot') {
      if (claims.personSlots[personId] === true) {
        return NextResponse.json({ ok: false, reason: 'slot_taken' })
      }
      claims.personSlots[personId] = true
    } else {
      const id = itemId as string
      const currentOwner = claims.items[id]
      if (currentOwner && currentOwner !== personId) {
        return NextResponse.json({ ok: false, reason: 'conflict', takenBy: currentOwner })
      }
      if (currentOwner === personId) {
        // D-09: un-claim by tapping again
        delete claims.items[id]
      } else {
        claims.items[id] = personId
      }
    }

    const updated: SessionPayload = { ...session, claims }
    const tx = redis.multi()
    tx.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    await tx.exec()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Claim error:', err)
    return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  }
}
