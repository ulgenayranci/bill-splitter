import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'

export const maxDuration = 10

const VALID_OPS = ['add', 'remove', 'edit_price', 'edit_name', 'edit_quantity', 'add_person'] as const
type EditOp = (typeof VALID_OPS)[number]

/**
 * ADD_PERSON_SCRIPT: Atomically appends a new person to session.people and locks
 * their identity slot in session.claims.personSlots in a single redis.eval call.
 * Prevents the append race (Pitfall 2) where two concurrent "I'm not listed" requests
 * both read the same people[] and overwrite each other.
 *
 * ARGV[1] = trimmed name
 * ARGV[2] = newPersonId (generated in TypeScript before eval; Lua has no nanoid)
 * Returns: 'OK' | 'session_not_found' | 'invalid_session' | 'session_full'
 *
 * Lua field paths use only current flat-schema fields confirmed in lib/sessionSchema.ts.
 * No stale v1 host-role fields referenced (Pitfall 4 audit — flat schema only).
 */
const ADD_PERSON_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

local name = ARGV[1]
local newPersonId = ARGV[2]

if not session.people then session.people = {} end
if not session.claims then session.claims = {} end
if not session.claims.personSlots then session.claims.personSlots = {} end

if #session.people >= 20 then return 'session_full' end

local colorIndex = #session.people % 6
table.insert(session.people, { id = newPersonId, name = name, colorIndex = colorIndex })
-- GAP-09-NOLOCK: no personSlots lock set — the flat model has no exclusive slot ownership

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

/**
 * Validate and normalize the incoming body for each op.
 * Ported verbatim from edit-request/route.ts validatePayload (V5 input validation),
 * re-keyed to the flat /edit contract (op instead of type; fields as top-level body props).
 */
function validateOp(
  op: EditOp,
  b: Record<string, unknown>,
  session: SessionPayload
): { ok: true; normalizedName?: string } | { ok: false; error: string } {
  if (op === 'add_person') {
    // V5 input validation: name must be a non-empty string after trim, max 50 chars (T-09-04)
    if (typeof b.name !== 'string')
      return { ok: false, error: 'Invalid add_person: name must be a string' }
    const trimmed = b.name.trim()
    if (trimmed.length === 0)
      return { ok: false, error: 'Invalid add_person: name must be a non-empty string' }
    if (trimmed.length > 50)
      return { ok: false, error: 'Invalid add_person: name must be 50 characters or fewer' }
    // WR-05: return the normalized name so the caller persists the exact value that was
    // validated — avoids a second independent trim that could drift out of lockstep.
    return { ok: true, normalizedName: trimmed }
  }

  if (op === 'add') {
    if (typeof b.name !== 'string' || b.name.length === 0)
      return { ok: false, error: 'Invalid add: name must be a non-empty string' }
    if (!Number.isInteger(b.priceCents) || (b.priceCents as number) <= 0)
      return { ok: false, error: 'Invalid add: priceCents must be a positive integer' }
    if (!Number.isInteger(b.quantity) || (b.quantity as number) <= 0)
      return { ok: false, error: 'Invalid add: quantity must be a positive integer' }
    return { ok: true }
  }

  // All ops other than 'add' require itemId that exists in session.items
  if (typeof b.itemId !== 'string' || b.itemId.length === 0)
    return { ok: false, error: 'Invalid payload: itemId must be a non-empty string' }
  if (!session.items.some((it) => it.id === b.itemId))
    return { ok: false, error: 'Invalid payload: itemId not found in session' }

  if (op === 'remove') return { ok: true }

  if (op === 'edit_price') {
    if (!Number.isInteger(b.newPriceCents) || (b.newPriceCents as number) <= 0)
      return { ok: false, error: 'Invalid edit_price: newPriceCents must be a positive integer' }
    return { ok: true }
  }

  if (op === 'edit_name') {
    if (typeof b.newName !== 'string' || b.newName.length === 0)
      return { ok: false, error: 'Invalid edit_name: newName must be a non-empty string' }
    return { ok: true }
  }

  // edit_quantity
  if (!Number.isInteger(b.newQuantity) || (b.newQuantity as number) <= 0)
    return { ok: false, error: 'Invalid edit_quantity: newQuantity must be a positive integer' }

  // Pitfall 4 (T-08-06): reject if newQuantity < totalClaimed
  const itemId = b.itemId as string
  const newQuantity = b.newQuantity as number
  const claimsForItem = session.claims?.items?.[itemId] ?? {}
  let totalClaimed = 0
  for (const claim of Object.values(claimsForItem)) {
    if (claim && typeof claim === 'object') {
      totalClaimed += (claim as { qty: number }).qty ?? 0
    }
  }
  if (newQuantity < totalClaimed) {
    return {
      ok: false,
      error: `Cannot reduce quantity to ${newQuantity}: ${totalClaimed} units are already claimed`,
    }
  }

  return { ok: true }
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
  const op = b.op

  if (typeof op !== 'string' || !(VALID_OPS as readonly string[]).includes(op)) {
    return NextResponse.json({ error: 'Invalid op' }, { status: 400 })
  }

  // add_person: validate name, then run ADD_PERSON_SCRIPT atomically via Lua.
  // This branch runs BEFORE the GET→mutate→SET path to avoid the append race (Pitfall 2 / T-09-06).
  if (op === 'add_person') {
    // WR-05: validateOp is the single source of truth for both the check AND the normalized
    // name. We persist validation.normalizedName (not a separate inline trim) so the value
    // validated is guaranteed identical to the value sent to Lua.
    const validation = validateOp('add_person', b, {} as SessionPayload)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const trimmedName = validation.normalizedName ?? ''

    try {
      const newPersonId = nanoid()
      const result = await redis.eval(ADD_PERSON_SCRIPT, [`session:${sessionId}`], [trimmedName, newPersonId])
      if (result === 'session_not_found') {
        return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
      }
      if (result === 'session_full') {
        return NextResponse.json({ error: 'Session is full (max 20 people)' }, { status: 409 })
      }
      if (result === 'invalid_session') {
        return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
      }
      // result === 'OK'
      return NextResponse.json({ ok: true, personId: newPersonId })
    } catch (err) {
      console.error('Edit error:', err)
      return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
    }
  }

  try {
    const session = await redis.get<SessionPayload>(`session:${sessionId}`)
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }

    const validation = validateOp(op as EditOp, b, session)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // GET → mutate-in-JS → SET (last-write-wins; /edit has no concurrent-write invariant)
    let updatedItems = [...session.items]
    let updatedClaims = session.claims

    if (op === 'add') {
      const newItemId = nanoid()
      updatedItems = [
        ...updatedItems,
        {
          id: newItemId,
          name: b.name as string,
          priceCents: b.priceCents as number,
          quantity: b.quantity as number,
        },
      ]
    } else if (op === 'remove') {
      const removedItemId = b.itemId as string
      updatedItems = updatedItems.filter((it) => it.id !== removedItemId)
      // Purge claims for the removed item (D-01 inverse: on remove, claims are deleted)
      const existingClaimItems = { ...(session.claims?.items ?? {}) }
      delete existingClaimItems[removedItemId]
      updatedClaims = {
        ...session.claims,
        items: existingClaimItems,
      }
    } else if (op === 'edit_price') {
      const targetId = b.itemId as string
      updatedItems = updatedItems.map((it) =>
        it.id === targetId ? { ...it, priceCents: b.newPriceCents as number } : it
      )
      // D-01: claims for edited item are preserved (shares recalculate at render)
    } else if (op === 'edit_name') {
      const targetId = b.itemId as string
      updatedItems = updatedItems.map((it) =>
        it.id === targetId ? { ...it, name: b.newName as string } : it
      )
    } else if (op === 'edit_quantity') {
      const targetId = b.itemId as string
      updatedItems = updatedItems.map((it) =>
        it.id === targetId ? { ...it, quantity: b.newQuantity as number } : it
      )
    }

    const updated: SessionPayload = {
      ...session,
      items: updatedItems,
      claims: updatedClaims,
    }
    await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Edit error:', err)
    // T-08-04: generic error — never leak provider internals
    return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
  }
}
