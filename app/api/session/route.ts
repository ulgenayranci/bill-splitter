import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'
import type { Person, Item } from '@/stores/useBillStore'

export const maxDuration = 10

function isValidPeople(v: unknown): v is Person[] {
  if (!Array.isArray(v) || v.length === 0) return false
  return v.every((p) => {
    if (!p || typeof p !== 'object') return false
    const r = p as Record<string, unknown>
    return (
      typeof r.id === 'string' &&
      typeof r.name === 'string' &&
      typeof r.colorIndex === 'number'
    )
  })
}

function isValidItems(v: unknown): v is Item[] {
  if (!Array.isArray(v) || v.length === 0) return false
  return v.every((i) => {
    if (!i || typeof i !== 'object') return false
    const r = i as Record<string, unknown>
    return (
      typeof r.id === 'string' &&
      typeof r.name === 'string' &&
      Number.isInteger(r.priceCents) &&
      (r.priceCents as number) > 0 &&
      Number.isInteger(r.quantity) &&     // Phase 6: quantity required
      (r.quantity as number) > 0
    )
  })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}

  if (!isValidPeople(b.people)) {
    return NextResponse.json({ error: 'Invalid people' }, { status: 400 })
  }
  if (!isValidItems(b.items)) {
    return NextResponse.json({ error: 'Invalid items' }, { status: 400 })
  }
  // tipPercent intentionally not validated/stored — Phase 6 per-person tips (D-07)

  // Convert wizard assignments (Record<ItemId, PersonId[]>) into session claims so
  // host pre-assignments are visible to guests when they join.
  const rawAssignments = b.assignments
  const prePopulatedClaims: Record<string, Record<string, { qty: number; assignedBy: 'host'; accepted: boolean }>> = {}
  if (rawAssignments && typeof rawAssignments === 'object' && !Array.isArray(rawAssignments)) {
    for (const [itemId, personIds] of Object.entries(rawAssignments as Record<string, unknown>)) {
      if (!Array.isArray(personIds) || personIds.length === 0) continue
      prePopulatedClaims[itemId] = {}
      for (const personId of personIds) {
        if (typeof personId === 'string') {
          prePopulatedClaims[itemId][personId] = { qty: 1, assignedBy: 'host', accepted: true }
        }
      }
    }
  }

  try {
    const sessionId = nanoid()
    const hostToken = nanoid()                          // D-02: server-generated, 21-char URL-safe
    const payload: SessionPayload = {
      people: b.people,
      items: b.items,
      claims: { items: prePopulatedClaims, personSlots: {}, donePeople: {} },
      hostToken,
      hostPersonId: undefined,
      tips: {},
      editRequests: {},
      disputes: {},
      createdAt: Date.now(),
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(payload), { ex: 86400 })
    return NextResponse.json({ sessionId, hostToken })
  } catch (err) {
    console.error('Session create error:', err)
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }
}
