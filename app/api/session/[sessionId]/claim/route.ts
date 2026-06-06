import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

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

if not session.claims then session.claims = {} end
if not session.claims.items then session.claims.items = {} end
if not session.claims.items[itemId] then session.claims.items[itemId] = {} end

-- CR-03: Atomic bounds check — compute totalClaimed for this item inside Lua so the
-- check and the write are a single atomic operation. A pre-Lua GET check would allow
-- two concurrent callers to both pass the bounds check before either write completes.
if qty > 0 then
  -- Find item.quantity from the live session state
  local itemQuantity = 0
  for _, item in ipairs(session.items or {}) do
    if item.id == itemId then itemQuantity = item.quantity or 1; break end
  end
  -- Sum all current claims for this item across all people.
  -- Subtract this person's existing claim before adding the new qty so we compute
  -- the net change correctly (replacing, not stacking).
  local totalClaimed = 0
  for _, claim in pairs(session.claims.items[itemId] or {}) do
    if type(claim) == 'table' then totalClaimed = totalClaimed + (claim.qty or 0) end
  end
  local myExisting = 0
  if type(session.claims.items[itemId][personId]) == 'table' then
    myExisting = session.claims.items[itemId][personId].qty or 0
  end
  if (totalClaimed - myExisting + qty) > itemQuantity then return 'qty_exceeded' end
end

if qty == 0 then
  session.claims.items[itemId][personId] = nil
else
  session.claims.items[itemId][personId] = { qty = qty }
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
 * Phase 9 atomic tap-to-join/leave for single-qty shared items (D-13, CLAIM-02).
 * Unlike QTY_CLAIM_SCRIPT there is NO bounds check — multiple people may each hold
 * qty:1 on the same qty:1 item (that is the point of tap-to-join sharing).
 * ARGV: [itemId, personId, joining] where joining is 'true' or 'false'.
 * Returns 'OK', 'session_not_found', or 'invalid_session'.
 * Per RESEARCH Pitfall 1 and Pitfall 4: Lua is required for atomicity; Lua strings
 * are audited separately from TypeScript — only flat schema fields used here.
 */
const SHARE_CLAIM_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

local itemId = ARGV[1]
local personId = ARGV[2]
local joining = ARGV[3]

if not session.claims then session.claims = {} end
if not session.claims.items then session.claims.items = {} end
if not session.claims.items[itemId] then session.claims.items[itemId] = {} end

if joining == 'true' then
  session.claims.items[itemId][personId] = { qty = 1 }
else
  session.claims.items[itemId][personId] = nil
end

-- Clean up empty item entry (cjson encodes empty Lua table as [] not {})
local hasAny = false
for _ in pairs(session.claims.items[itemId]) do hasAny = true; break end
if not hasAny then session.claims.items[itemId] = nil end

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

/**
 * Phase 8 atomic slot claim (flat model).
 * Sets claims.personSlots[personId] = true.
 * Returns 'OK', 'slot_taken', 'session_not_found', or 'invalid_session'.
 * ARGV is now [personId] only — no host token (CLAIM-01).
 */
const SLOT_CLAIM_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

local personId = ARGV[1]

if not session.claims then session.claims = {} end
if not session.claims.personSlots then session.claims.personSlots = {} end

if session.claims.personSlots[personId] == true then
  return 'slot_taken'
end
session.claims.personSlots[personId] = true

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

type ClaimBody = {
  personId: string
  action: 'qty' | 'slot' | 'share'
  itemId?: string
  qty?: number
  joining?: boolean
}

function validateBody(b: unknown): { ok: true; body: ClaimBody } | { ok: false; error: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'Invalid body' }
  const r = b as Record<string, unknown>
  if (typeof r.personId !== 'string' || r.personId.length === 0) {
    return { ok: false, error: 'Invalid personId' }
  }
  // Infer action: if action is omitted but itemId+qty present, default to 'qty'
  const action = r.action ?? (r.itemId !== undefined ? 'qty' : undefined)
  if (action !== 'qty' && action !== 'slot' && action !== 'share') {
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
  if (action === 'share') {
    if (typeof r.itemId !== 'string' || r.itemId.length === 0) {
      return { ok: false, error: 'Invalid itemId for share action' }
    }
    if (typeof r.joining !== 'boolean') {
      return { ok: false, error: 'Invalid joining: must be boolean for share action' }
    }
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
  const { personId, action, itemId, qty, joining } = v.body

  try {
    if (action === 'share') {
      // D-13 tap-to-join: bounds-check-free Lua write. Multiple people may each hold
      // qty:1 on a single-qty item. ARGV: [itemId, personId, String(joining)].
      const result = await redis.eval(
        SHARE_CLAIM_SCRIPT,
        [`session:${sessionId}`],
        [itemId as string, personId, String(joining)]
      )
      if (result === 'session_not_found') {
        return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
      }
      if (result === 'invalid_session') {
        return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'qty') {
      // CR-03: bounds check now lives inside QTY_CLAIM_SCRIPT (atomic with the write).
      // A pre-Lua GET + TS bounds check had a race window — two callers could both pass
      // the check before either write completed, yielding totalClaimed > item.quantity.
      // ARGV: [itemId, personId, String(qty)] — no host fields (CLAIM-01 flat model).
      const result = await redis.eval(
        QTY_CLAIM_SCRIPT,
        [`session:${sessionId}`],
        [itemId as string, personId, String(qty)]
      )
      if (result === 'session_not_found') {
        return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
      }
      if (result === 'invalid_session') {
        return NextResponse.json({ error: 'invalid_session' }, { status: 500 })
      }
      if (result === 'qty_exceeded') {
        return NextResponse.json({ error: 'qty exceeds available quantity' }, { status: 409 })
      }
      return NextResponse.json({ ok: true })
    }

    // action === 'slot'
    // ARGV: [personId] only — no host token in flat model (CLAIM-01).
    const result = await redis.eval(
      SLOT_CLAIM_SCRIPT,
      [`session:${sessionId}`],
      [personId]
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
