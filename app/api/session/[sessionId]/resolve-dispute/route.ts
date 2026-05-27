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
  const hostToken = b.hostToken
  const disputeId = b.disputeId
  const decision = b.decision
  const reassignTo = b.reassignTo

  if (typeof hostToken !== 'string' || hostToken.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (typeof disputeId !== 'string' || disputeId.length === 0) {
    return NextResponse.json({ error: 'Invalid disputeId' }, { status: 400 })
  }
  if (decision !== 'resolved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }
  if (reassignTo !== undefined && (typeof reassignTo !== 'string' || reassignTo.length === 0)) {
    return NextResponse.json({ error: 'Invalid reassignTo' }, { status: 400 })
  }

  try {
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }
    // Two-step hostToken guard: presence check above, then DB comparison (T-06-03-01)
    if (session.hostToken !== hostToken) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!session.disputes?.[disputeId]) {
      return NextResponse.json({ error: 'dispute_not_found' }, { status: 400 })
    }

    const dispute = session.disputes[disputeId]
    if (dispute.status !== 'pending') {
      return NextResponse.json({ error: 'dispute already resolved' }, { status: 409 })
    }

    // Validate reassignTo references a real person if supplied
    if (reassignTo && !session.people.some((p) => p.id === reassignTo)) {
      return NextResponse.json({ error: 'Invalid reassignTo: not in session' }, { status: 400 })
    }

    let updatedClaims = session.claims

    if (decision === 'resolved' && reassignTo) {
      // Atomically reassign: remove original person's claim, add reassigned claim (T-06-03-05)
      const itemClaims = { ...(session.claims?.items ?? {}) }
      const itemEntry = { ...(itemClaims[dispute.itemId] ?? {}) }
      delete itemEntry[dispute.personId]
      itemEntry[reassignTo] = { qty: 1, assignedBy: 'host' as const }
      updatedClaims = {
        ...session.claims,
        items: {
          ...itemClaims,
          [dispute.itemId]: itemEntry,
        },
      }
    }

    const updated: SessionPayload = {
      ...session,
      claims: updatedClaims,
      disputes: {
        ...session.disputes,
        [disputeId]: { ...dispute, status: decision },
      },
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Resolve dispute error:', err)
    return NextResponse.json({ error: 'Resolve dispute failed' }, { status: 500 })
  }
}
