import { nanoid } from 'nanoid'
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
  const requestId = b.requestId
  const decision = b.decision

  if (typeof hostToken !== 'string' || hostToken.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (typeof requestId !== 'string' || requestId.length === 0) {
    return NextResponse.json({ error: 'Invalid requestId' }, { status: 400 })
  }
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
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
    if (!session.editRequests?.[requestId]) {
      return NextResponse.json({ error: 'request_not_found' }, { status: 400 })
    }

    const editReq = session.editRequests[requestId]
    if (editReq.status !== 'pending') {
      return NextResponse.json({ error: 'request already resolved' }, { status: 409 })
    }

    if (decision === 'rejected') {
      const updated: SessionPayload = {
        ...session,
        editRequests: {
          ...session.editRequests,
          [requestId]: { ...editReq, status: 'rejected' },
        },
      }
      await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
      return NextResponse.json({ ok: true })
    }

    // Approved path: apply item mutation atomically in JS then write once
    const p = editReq.payload as Record<string, unknown>
    let updatedItems = [...session.items]
    let updatedClaims = session.claims

    if (editReq.type === 'add') {
      const newItemId = nanoid()
      updatedItems = [
        ...updatedItems,
        {
          id: newItemId,
          name: p.name as string,
          priceCents: p.priceCents as number,
          quantity: p.quantity as number,
        },
      ]
    } else if (editReq.type === 'remove') {
      const removedItemId = p.itemId as string
      updatedItems = updatedItems.filter((it) => it.id !== removedItemId)
      // Atomically delete claims for this item (RESEARCH Open Question 3)
      const existingClaimItems = { ...(session.claims?.items ?? {}) }
      delete existingClaimItems[removedItemId]
      updatedClaims = {
        ...session.claims,
        items: existingClaimItems,
      }
    } else if (editReq.type === 'edit_price') {
      const targetId = p.itemId as string
      updatedItems = updatedItems.map((it) =>
        it.id === targetId ? { ...it, priceCents: p.newPriceCents as number } : it
      )
    } else if (editReq.type === 'edit_name') {
      const targetId = p.itemId as string
      updatedItems = updatedItems.map((it) =>
        it.id === targetId ? { ...it, name: p.newName as string } : it
      )
    } else if (editReq.type === 'edit_quantity') {
      const targetId = p.itemId as string
      updatedItems = updatedItems.map((it) =>
        it.id === targetId ? { ...it, quantity: p.newQuantity as number } : it
      )
    }

    const updated: SessionPayload = {
      ...session,
      items: updatedItems,
      claims: updatedClaims,
      editRequests: {
        ...session.editRequests,
        [requestId]: { ...editReq, status: 'approved' },
      },
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Resolve edit error:', err)
    return NextResponse.json({ error: 'Resolve edit failed' }, { status: 500 })
  }
}
