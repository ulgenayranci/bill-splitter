import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import {
  CLAIM_SEAT_SCRIPT,
  ITEM_ADD_SCRIPT,
  ITEM_REMOVE_SCRIPT,
  ITEM_EDIT_SCRIPT,
} from '@/lib/sessionLua'

export const maxDuration = 10

const VALID_OPS = ['add', 'remove', 'edit_price', 'edit_name', 'edit_quantity', 'add_person', 'update_currency', 'rename_person', 'claim_seat'] as const
type EditOp = (typeof VALID_OPS)[number]

/**
 * UPDATE_CURRENCY_SCRIPT: Atomically sets session.currencyCode in a single redis.eval call.
 * Fixes CR-01: the previous GET→mutate→SET wrote the entire session back, so any concurrent
 * claim/tip/add-person write landing between the GET and SET was silently clobbered.
 * This field-level Lua update eliminates that cross-field data-loss window.
 *
 * ARGV[1] = new currencyCode (already validated by TypeScript before eval)
 * Returns: 'OK' | 'session_not_found' | 'invalid_session'
 *
 * Mirrors ADD_PERSON_SCRIPT pattern. EX 86400 matches all other scripts in this file.
 */
const UPDATE_CURRENCY_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

session.currencyCode = ARGV[1]

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

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
 * RENAME_PERSON_SCRIPT: Atomically updates a person's name in session.people.
 *
 * ARGV[1] = personId to rename
 * ARGV[2] = new name (already trimmed and validated in TypeScript before eval)
 * Returns: 'OK' | 'session_not_found' | 'invalid_session' | 'person_not_found' | 'seat_empty'
 *
 * Mirrors ADD_PERSON_SCRIPT pattern. EX 86400 matches all other scripts in this file.
 */
const RENAME_PERSON_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

local personId = ARGV[1]
local newName = ARGV[2]

if type(session.people) ~= 'table' then return 'person_not_found' end
local found = false
for _, p in ipairs(session.people) do
  if type(p) == 'table' and p.id == personId then
    -- An empty seat must be claimed via claim_seat (compare-and-set), not renamed.
    if type(p.name) ~= 'string' or not string.match(p.name, '%S') then return 'seat_empty' end
    p.name = newName
    found = true
    break
  end
end
if not found then return 'person_not_found' end

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

  if (op === 'update_currency') {
    // V5 input validation (T-10-03): currencyCode must be a non-empty string, max 10 chars
    // ISO 4217 codes are 3 chars; 10 is a generous safe cap
    if (typeof b.currencyCode !== 'string' || b.currencyCode.length === 0)
      return { ok: false, error: 'Invalid update_currency: currencyCode must be a non-empty string' }
    if (b.currencyCode.length > 10)
      return { ok: false, error: 'Invalid update_currency: currencyCode too long' }
    return { ok: true }
  }

  if (op === 'rename_person') {
    // V5 input validation (T-11-01): personId must be a non-empty string
    if (typeof b.personId !== 'string' || b.personId.length === 0)
      return { ok: false, error: 'Invalid rename_person: personId must be a non-empty string' }
    if (typeof b.newName !== 'string')
      return { ok: false, error: 'Invalid rename_person: newName must be a string' }
    const trimmed = b.newName.trim()
    if (trimmed.length === 0)
      return { ok: false, error: 'Invalid rename_person: newName must be a non-empty string' }
    if (trimmed.length > 50)
      return { ok: false, error: 'Invalid rename_person: newName must be 50 characters or fewer' }
    // WR-05: return the normalized name so the caller persists the exact value that was
    // validated — avoids a second independent trim that could drift out of lockstep.
    return { ok: true, normalizedName: trimmed }
  }

  // Item ops other than 'add' require an itemId (its existence is checked inside Lua).
  if (typeof b.itemId !== 'string' || b.itemId.length === 0)
    return { ok: false, error: 'Invalid payload: itemId must be a non-empty string' }

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

  // Pitfall 4 (T-08-06): newQuantity < units already claimed is refused inside ITEM_EDIT_SCRIPT.
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

  // update_currency: validate code, then run UPDATE_CURRENCY_SCRIPT atomically via Lua.
  // CR-01: runs BEFORE the GET→mutate→SET path so the field-level write cannot clobber
  // concurrent claim/tip/add-person writes that land between a GET and SET on the full session.
  if (op === 'update_currency') {
    const validation = validateOp('update_currency', b)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    try {
      const result = await redis.eval(
        UPDATE_CURRENCY_SCRIPT,
        [`session:${sessionId}`],
        [b.currencyCode as string]
      )
      if (result === 'session_not_found') {
        return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
      }
      if (result === 'invalid_session') {
        return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
      }
      // result === 'OK'
      return NextResponse.json({ ok: true })
    } catch (err) {
      console.error('Edit error:', err)
      return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
    }
  }

  // rename_person: validate personId + newName, then run RENAME_PERSON_SCRIPT atomically via Lua.
  // D-05: runs BEFORE the GET→mutate→SET path to avoid races with concurrent writes.
  if (op === 'rename_person') {
    // WR-05: validateOp is the single source of truth for both the check AND the normalized
    // name. We persist validation.normalizedName (not a separate inline trim) so the value
    // validated is guaranteed identical to the value sent to Lua.
    const validation = validateOp('rename_person', b)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const trimmedName = validation.normalizedName ?? ''

    try {
      const result = await redis.eval(RENAME_PERSON_SCRIPT, [`session:${sessionId}`], [b.personId as string, trimmedName])
      if (result === 'session_not_found') {
        return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
      }
      if (result === 'person_not_found') {
        return NextResponse.json({ error: 'person_not_found' }, { status: 404 })
      }
      if (result === 'seat_empty') {
        return NextResponse.json({ error: 'seat_empty' }, { status: 409 })
      }
      if (result === 'invalid_session') {
        return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
      }
      // result === 'OK'
      return NextResponse.json({ ok: true })
    } catch (err) {
      console.error('Edit error:', err)
      return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
    }
  }

  // claim_seat: a friend names an EMPTY seat. CLAIM_SEAT_SCRIPT is a compare-and-set on
  // the blank name, so when two phones tap the same seat exactly one wins (409 seat_taken).
  if (op === 'claim_seat') {
    if (typeof b.personId !== 'string' || b.personId.length === 0) {
      return NextResponse.json({ error: 'Invalid claim_seat: personId must be a non-empty string' }, { status: 400 })
    }
    if (typeof b.name !== 'string') {
      return NextResponse.json({ error: 'Invalid claim_seat: name must be a string' }, { status: 400 })
    }
    const trimmedName = b.name.trim()
    if (trimmedName.length === 0 || trimmedName.length > 50) {
      return NextResponse.json({ error: 'Invalid claim_seat: name must be 1-50 characters' }, { status: 400 })
    }
    try {
      const result = await redis.eval(CLAIM_SEAT_SCRIPT, [`session:${sessionId}`], [b.personId, trimmedName])
      if (result === 'OK') return NextResponse.json({ ok: true })
      if (result === 'session_not_found') return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
      if (result === 'person_not_found') return NextResponse.json({ error: 'person_not_found' }, { status: 404 })
      if (result === 'seat_taken') return NextResponse.json({ error: 'seat_taken' }, { status: 409 })
      if (result === 'invalid_args') return NextResponse.json({ error: 'Invalid claim_seat: name must be 1-50 characters' }, { status: 400 })
      return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
    } catch (err) {
      console.error('Edit error:', err)
      return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
    }
  }

  // add_person: validate name, then run ADD_PERSON_SCRIPT atomically via Lua.
  // This branch runs BEFORE the GET→mutate→SET path to avoid the append race (Pitfall 2 / T-09-06).
  if (op === 'add_person') {
    // WR-05: validateOp is the single source of truth for both the check AND the normalized
    // name. We persist validation.normalizedName (not a separate inline trim) so the value
    // validated is guaranteed identical to the value sent to Lua.
    const validation = validateOp('add_person', b)
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

  // Item ops (add / remove / edit_*): each is ONE field-level Lua script, so an item edit
  // can no longer revert a concurrent seat claim, done or tip (the old GET -> spread -> SET
  // here rewrote the whole session). Item existence and the claimed-quantity floor are
  // checked inside Lua, atomically with the write.
  const validation = validateOp(op as EditOp, b)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const key = `session:${sessionId}`
    let result: unknown
    if (op === 'add') {
      result = await redis.eval(ITEM_ADD_SCRIPT, [key], [nanoid(), b.name as string, String(b.priceCents), String(b.quantity)])
    } else if (op === 'remove') {
      result = await redis.eval(ITEM_REMOVE_SCRIPT, [key], [b.itemId as string])
    } else {
      const field = op === 'edit_price' ? 'priceCents' : op === 'edit_name' ? 'name' : 'quantity'
      const value = op === 'edit_price' ? String(b.newPriceCents) : op === 'edit_name' ? (b.newName as string) : String(b.newQuantity)
      result = await redis.eval(ITEM_EDIT_SCRIPT, [key], [b.itemId as string, field, value])
    }

    if (result === 'OK') return NextResponse.json({ ok: true })
    if (result === 'session_not_found') return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    if (result === 'item_not_found') {
      return NextResponse.json({ error: 'Invalid payload: itemId not found in session' }, { status: 400 })
    }
    if (typeof result === 'string' && result.startsWith('qty_below_claimed:')) {
      const claimed = result.slice('qty_below_claimed:'.length)
      return NextResponse.json(
        { error: `Cannot reduce quantity to ${b.newQuantity as number}: ${claimed} units are already claimed` },
        { status: 400 },
      )
    }
    if (result === 'invalid_args') return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
  } catch (err) {
    console.error('Edit error:', err)
    // T-08-04: generic error — never leak provider internals
    return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
  }
}
