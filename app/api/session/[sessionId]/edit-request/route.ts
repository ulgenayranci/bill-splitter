import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload, EditRequest, EditPayload } from '@/lib/sessionSchema'

export const maxDuration = 10

const VALID_TYPES = ['add', 'remove', 'edit_price', 'edit_name'] as const
type EditType = (typeof VALID_TYPES)[number]

// EditRequestPayload is an alias for the discriminated EditPayload union with type tag
export type EditRequestPayload =
  | { type: 'add'; name: string; priceCents: number; quantity: number }
  | { type: 'remove'; itemId: string }
  | { type: 'edit_price'; itemId: string; newPriceCents: number }
  | { type: 'edit_name'; itemId: string; newName: string }

function validatePayload(
  type: EditType,
  payload: unknown,
  session: SessionPayload
): { ok: true; payload: EditPayload } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid payload' }
  const p = payload as Record<string, unknown>

  if (type === 'add') {
    if (typeof p.name !== 'string' || p.name.length === 0) return { ok: false, error: 'Invalid add payload: name' }
    if (!Number.isInteger(p.priceCents) || (p.priceCents as number) <= 0) return { ok: false, error: 'Invalid add payload: priceCents' }
    if (!Number.isInteger(p.quantity) || (p.quantity as number) <= 0) return { ok: false, error: 'Invalid add payload: quantity' }
    return { ok: true, payload: { name: p.name, priceCents: p.priceCents as number, quantity: p.quantity as number } }
  }

  // remove / edit_price / edit_name all require itemId that exists in session.items
  if (typeof p.itemId !== 'string' || p.itemId.length === 0) return { ok: false, error: 'Invalid payload: itemId' }
  if (!session.items.some((it) => it.id === p.itemId)) return { ok: false, error: 'Invalid payload: itemId not in session' }

  if (type === 'remove') return { ok: true, payload: { itemId: p.itemId as string } }
  if (type === 'edit_price') {
    if (!Number.isInteger(p.newPriceCents) || (p.newPriceCents as number) <= 0) return { ok: false, error: 'Invalid edit_price payload' }
    return { ok: true, payload: { itemId: p.itemId as string, newPriceCents: p.newPriceCents as number } }
  }
  // edit_name
  if (typeof p.newName !== 'string' || p.newName.length === 0) return { ok: false, error: 'Invalid edit_name payload' }
  return { ok: true, payload: { itemId: p.itemId as string, newName: p.newName } }
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
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const personId = b.personId
  const type = b.type

  if (typeof personId !== 'string' || personId.length === 0) {
    return NextResponse.json({ error: 'Invalid personId' }, { status: 400 })
  }
  if (typeof type !== 'string' || !(VALID_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  try {
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }
    if (!session.people.some((p) => p.id === personId)) {
      return NextResponse.json({ error: 'Invalid personId: not in session' }, { status: 400 })
    }
    const payloadResult = validatePayload(type as EditType, b.payload, session)
    if (!payloadResult.ok) {
      return NextResponse.json({ error: payloadResult.error }, { status: 400 })
    }

    const requestId = nanoid()
    const editRequest: EditRequest = {
      personId,
      type: type as EditType,
      payload: payloadResult.payload,
      status: 'pending',
      createdAt: Date.now(),
    }
    const updated: SessionPayload = {
      ...session,
      editRequests: { ...(session.editRequests ?? {}), [requestId]: editRequest },
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    return NextResponse.json({ ok: true, requestId })
  } catch (err) {
    console.error('Edit request error:', err)
    return NextResponse.json({ error: 'Edit request failed' }, { status: 500 })
  }
}
