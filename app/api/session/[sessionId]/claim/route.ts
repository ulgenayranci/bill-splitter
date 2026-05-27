import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'

export const maxDuration = 10

/**
 * Phase 6 atomic qty claim.
 * Reads session, mutates claims.items[itemId][personId], writes back — all atomically server-side.
 * Returns 'OK' on success, 'session_not_found' if GET returns nil, 'invalid_session' if JSON decode fails.
 * Per RESEARCH Pitfall 1: `redis.multi()` is NOT atomic on Upstash REST. Lua is required.
 */
const QTY_CLAIM_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

local itemId = ARGV[1]
local personId = ARGV[2]
local qty = tonumber(ARGV[3])
local assignedBy = ARGV[4]

if not session.claims then session.claims = {} end
if not session.claims.items then session.claims.items = {} end
if not session.claims.items[itemId] then session.claims.items[itemId] = {} end

if qty == 0 then
  session.claims.items[itemId][personId] = nil
else
  session.claims.items[itemId][personId] = { qty = qty, assignedBy = assignedBy }
end

-- cjson encodes empty Lua tables as []. For an empty per-item object we want {}.
-- Strategy: if no claimants remain for this item, remove the item key entirely.
local hasAny = false
for _ in pairs(session.claims.items[itemId]) do hasAny = true; break end
if not hasAny then session.claims.items[itemId] = nil end

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

/**
 * Phase 6 atomic slot claim.
 * Sets claims.personSlots[personId] = true. If a valid hostToken is supplied AND
 * session.hostPersonId is currently nil, also sets hostPersonId = personId (D-13).
 * Returns 'OK', 'slot_taken', 'session_not_found', or 'invalid_session'.
 */
const SLOT_CLAIM_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

local personId = ARGV[1]
local maybeHostToken = ARGV[2]  -- empty string if not host

if not session.claims then session.claims = {} end
if not session.claims.personSlots then session.claims.personSlots = {} end

if session.claims.personSlots[personId] == true then
  return 'slot_taken'
end
session.claims.personSlots[personId] = true

if maybeHostToken ~= '' and session.hostToken == maybeHostToken then
  if session.hostPersonId == nil or session.hostPersonId == cjson.null then
    session.hostPersonId = personId
  end
end

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

type ClaimBody = {
  personId: string
  action: 'qty' | 'slot'
  itemId?: string
  qty?: number
  hostToken?: string
}

function validateBody(b: unknown): { ok: true; body: ClaimBody } | { ok: false; error: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'Invalid body' }
  const r = b as Record<string, unknown>
  if (typeof r.personId !== 'string' || r.personId.length === 0) {
    return { ok: false, error: 'Invalid personId' }
  }
  // Infer action: if action is omitted but itemId+qty present, default to 'qty'
  const action = r.action ?? (r.itemId !== undefined ? 'qty' : undefined)
  if (action !== 'qty' && action !== 'slot') {
    return { ok: false, error: 'Invalid action' }
  }
  if (action === 'qty') {
    if (typeof r.itemId !== 'string' || r.itemId.length === 0) {
      return { ok: false, error: 'Invalid itemId' }
    }
    if (!Number.isInteger(r.qty) || (r.qty as number) < 0) {
      return { ok: false, error: 'Invalid qty: must be integer >= 0' }
    }
  }
  if (r.hostToken !== undefined && typeof r.hostToken !== 'string') {
    return { ok: false, error: 'Invalid hostToken' }
  }
  return { ok: true, body: { ...r, action } as unknown as ClaimBody }
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
  const { personId, action, itemId, qty, hostToken } = v.body

  try {
    if (action === 'qty') {
      // Bounds check: qty must be <= item.quantity. Requires reading session first.
      // This is a separate GET (not inside Lua) — acceptable because the bound check
      // is informational and the Lua write is still atomic. If a race causes a stale
      // bound read, the worst case is the qty is allowed slightly above; the UI also
      // clamps. See RESEARCH Open Question 2.
      const session = await redis.get<SessionPayload>(`session:${sessionId}`)
      if (!session) {
        return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
      }
      const targetItem = session.items.find((it) => it.id === itemId)
      if (!targetItem) {
        return NextResponse.json({ error: 'Invalid itemId' }, { status: 400 })
      }
      if ((qty as number) > targetItem.quantity) {
        return NextResponse.json({ error: 'qty exceeds item.quantity' }, { status: 400 })
      }

      const assignedBy = 'self' // Host-assigned writes use resolve-dispute or resolve-edit, not /claim
      const result = await redis.eval(
        QTY_CLAIM_SCRIPT,
        [`session:${sessionId}`],
        [itemId as string, personId, String(qty), assignedBy]
      )
      if (result === 'session_not_found') {
        return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
      }
      if (result === 'invalid_session') {
        return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    // action === 'slot'
    const result = await redis.eval(
      SLOT_CLAIM_SCRIPT,
      [`session:${sessionId}`],
      [personId, hostToken ?? '']
    )
    if (result === 'session_not_found') {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    }
    if (result === 'invalid_session') {
      return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
    }
    if (result === 'slot_taken') {
      return NextResponse.json({ ok: false, reason: 'slot_taken' })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Claim error:', err)
    return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  }
}
