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

  // D-04: read currencyCode, validate ISO 4217 three-letter code, default to 'USD'
  // T-08-08: validate /^[A-Z]{3}$/ so arbitrary client strings can't poison display logic
  const rawCurrencyCode = b.currencyCode
  const currencyCode =
    typeof rawCurrencyCode === 'string' && /^[A-Z]{3}$/.test(rawCurrencyCode)
      ? rawCurrencyCode
      : 'USD'

  try {
    const sessionId = nanoid()
    // Flat model: claims start empty — no host pre-assignment, no approval queue (CLAIM-01/03)
    const payload: SessionPayload = {
      people: b.people,
      items: b.items,
      claims: { items: {}, personSlots: {}, donePeople: {} },
      tips: {},
      currencyCode,
      createdAt: Date.now(),
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(payload), { ex: 86400 })
    // Pitfall 6: response is { sessionId } only — flat model has no host secret
    return NextResponse.json({ sessionId })
  } catch (err) {
    console.error('Session create error:', err)
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }
}
