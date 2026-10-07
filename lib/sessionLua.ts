/**
 * Field-level atomic Lua scripts for the per-person session writes.
 *
 * Why: the old done/tip routes did GET -> spread -> SET in JavaScript and could
 * silently revert a concurrent people[] change (PITFALLS Pitfall 4 / CR-01).
 * Each script below reads and writes the session inside one Redis script and
 * mutates exactly one per-person field, so done/tip can no longer clobber other
 * writers. NOTE: the /edit route's item ops still GET -> spread -> SET in JS and
 * can still revert a concurrent done/tip write (review WR-01) — Phase 13 (REL-01). redis.multi() is NOT atomic on Upstash
 * REST, so Lua eval is required.
 *
 * Kept in an importable module (not route-local) because Next.js route files
 * may only export route fields, and the Phase 13 real-Redis harness reuses them.
 */

/**
 * DONE_SCRIPT - sets claims.donePeople[personId] = true|false.
 *
 * KEYS[1] = session key (`session:<id>`)
 * ARGV[1] = personId
 * ARGV[2] = 'true' or 'false'
 *
 * Returns:
 *   'OK'                - written
 *   'session_not_found' - key missing
 *   'invalid_session'   - stored value is not valid JSON, or people is not a list
 *   'invalid_args'      - ARGV[2] is neither 'true' nor 'false'
 *   'person_not_found'  - personId is not in session.people
 */
export const DONE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok or type(session) ~= 'table' then return 'invalid_session' end
local personId = ARGV[1]
if ARGV[2] ~= 'true' and ARGV[2] ~= 'false' then return 'invalid_args' end
if type(session.people) ~= 'table' then return 'invalid_session' end
local found = false
for _, p in ipairs(session.people) do
  if type(p) == 'table' and p.id == personId then found = true break end
end
if not found then return 'person_not_found' end
-- Empty tables decoded from [] become objects on assignment of a string key; other fields' shape is normalised at the fetch boundary, not here.
if type(session.claims) ~= 'table' then session.claims = {} end
if type(session.claims.donePeople) ~= 'table' then session.claims.donePeople = {} end
session.claims.donePeople[personId] = (ARGV[2] == 'true')
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

/**
 * TIP_SCRIPT - sets tips[personId] = tipCents.
 *
 * KEYS[1] = session key (`session:<id>`)
 * ARGV[1] = personId
 * ARGV[2] = tipCents as a decimal integer string
 *
 * Returns:
 *   'OK'                - written
 *   'session_not_found' - key missing
 *   'invalid_session'   - stored value is not valid JSON, or people is not a list
 *   'invalid_args'      - ARGV[2] is not a non-negative integer
 *   'person_not_found'  - personId is not in session.people
 */
export const TIP_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok or type(session) ~= 'table' then return 'invalid_session' end
local personId = ARGV[1]
local tip = tonumber(ARGV[2])
if tip == nil or tip < 0 or tip % 1 ~= 0 then return 'invalid_args' end
if type(session.people) ~= 'table' then return 'invalid_session' end
local found = false
for _, p in ipairs(session.people) do
  if type(p) == 'table' and p.id == personId then found = true break end
end
if not found then return 'person_not_found' end
-- Empty tables decoded from [] become objects on assignment of a string key; other fields' shape is normalised at the fetch boundary, not here.
if type(session.tips) ~= 'table' then session.tips = {} end
session.tips[personId] = tip
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

/**
 * UNIQUE_NAME_LUA - Lua twin of lib/nameDedupe.ts uniqueName(). Defines a local
 * function uniqueName(name, people, selfId, emojiCsv): returns the trimmed name, or
 * name + ' ' + the first emoji from the comma-separated (caller-shuffled) list that makes
 * it unique among the OTHER people (case-insensitive). Prepended to scripts that set names.
 */
export const UNIQUE_NAME_LUA = `
local function trimName(s) return (string.gsub(s, '^%s*(.-)%s*$', '%1')) end
local function uniqueName(name, people, selfId, emojiCsv)
  local base = trimName(name)
  local taken = {}
  for _, p in ipairs(people) do
    if type(p) == 'table' and p.id ~= selfId and type(p.name) == 'string' and string.match(p.name, '%S') then
      taken[string.lower(trimName(p.name))] = true
    end
  end
  if not taken[string.lower(base)] then return base end
  for e in string.gmatch(emojiCsv or '', '[^,]+') do
    local candidate = base .. ' ' .. e
    if not taken[string.lower(candidate)] then return candidate end
  end
  local k = 2
  while taken[string.lower(base .. ' ' .. k)] do k = k + 1 end
  return base .. ' ' .. k
end
`

/**
 * CLAIM_SEAT_SCRIPT - names an EMPTY seat (compare-and-set on the blank name).
 * Two phones tapping the same seat: the first wins, the second gets 'seat_taken'.
 *
 * KEYS[1] = session key
 * ARGV[1] = personId of the seat
 * ARGV[2] = name (trimmed + length-checked in TypeScript)
 * ARGV[3] = comma-separated shuffled emoji list for duplicate names (see UNIQUE_NAME_LUA)
 *
 * Returns: 'OK' | 'session_not_found' | 'invalid_session' | 'invalid_args'
 *          | 'person_not_found' | 'seat_taken'
 */
export const CLAIM_SEAT_SCRIPT = `${UNIQUE_NAME_LUA}
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok or type(session) ~= 'table' then return 'invalid_session' end
if type(session.people) ~= 'table' then return 'invalid_session' end
local name = ARGV[2]
if type(name) ~= 'string' or not string.match(name, '%S') then return 'invalid_args' end
for _, p in ipairs(session.people) do
  if type(p) == 'table' and p.id == ARGV[1] then
    if type(p.name) == 'string' and string.match(p.name, '%S') then return 'seat_taken' end
    p.name = uniqueName(name, session.people, ARGV[1], ARGV[3])
    redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
    return 'OK'
  end
end
return 'person_not_found'
`

/**
 * ITEM_ADD_SCRIPT - appends one item. Field-level so it cannot revert a concurrent
 * seat claim, done or tip (replaces the old /edit GET -> spread -> SET).
 * ARGV[1] = new itemId, ARGV[2] = name, ARGV[3] = priceCents, ARGV[4] = quantity
 * Returns: 'OK' | 'session_not_found' | 'invalid_session'
 */
export const ITEM_ADD_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok or type(session) ~= 'table' then return 'invalid_session' end
if type(session.items) ~= 'table' then session.items = {} end
table.insert(session.items, { id = ARGV[1], name = ARGV[2], priceCents = tonumber(ARGV[3]), quantity = tonumber(ARGV[4]) })
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

/**
 * ITEM_REMOVE_SCRIPT - removes one item and the claims on it.
 * ARGV[1] = itemId
 * Returns: 'OK' | 'session_not_found' | 'invalid_session' | 'item_not_found'
 */
export const ITEM_REMOVE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok or type(session) ~= 'table' then return 'invalid_session' end
if type(session.items) ~= 'table' then return 'item_not_found' end
local idx = nil
for i, it in ipairs(session.items) do
  if type(it) == 'table' and it.id == ARGV[1] then idx = i break end
end
if not idx then return 'item_not_found' end
table.remove(session.items, idx)
if type(session.claims) == 'table' and type(session.claims.items) == 'table' then
  session.claims.items[ARGV[1]] = nil
end
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

/**
 * ITEM_EDIT_SCRIPT - changes one field of one item; claims are preserved.
 * ARGV[1] = itemId, ARGV[2] = 'name' | 'priceCents' | 'quantity', ARGV[3] = value
 * A quantity below the units already claimed is refused (checked atomically here).
 * Returns: 'OK' | 'session_not_found' | 'invalid_session' | 'invalid_args'
 *          | 'item_not_found' | 'qty_below_claimed:<claimed>'
 */
export const ITEM_EDIT_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok or type(session) ~= 'table' then return 'invalid_session' end
local field = ARGV[2]
if field ~= 'name' and field ~= 'priceCents' and field ~= 'quantity' then return 'invalid_args' end
if type(session.items) ~= 'table' then return 'item_not_found' end
local target = nil
for _, it in ipairs(session.items) do
  if type(it) == 'table' and it.id == ARGV[1] then target = it break end
end
if not target then return 'item_not_found' end
if field == 'name' then
  target.name = ARGV[3]
else
  local n = tonumber(ARGV[3])
  if n == nil or n <= 0 or n % 1 ~= 0 then return 'invalid_args' end
  if field == 'quantity' then
    local claimed = 0
    if type(session.claims) == 'table' and type(session.claims.items) == 'table' and type(session.claims.items[ARGV[1]]) == 'table' then
      for _, c in pairs(session.claims.items[ARGV[1]]) do
        if type(c) == 'table' and type(c.qty) == 'number' then claimed = claimed + c.qty end
      end
    end
    if n < claimed then return 'qty_below_claimed:' .. claimed end
  end
  target[field] = n
end
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

/**
 * REMOVE_PERSON_SCRIPT - removes a card (named or empty) ONLY when nobody has picked
 * items for it, and never below the minimum headcount. Their presence/done/tip entries
 * go too (nothing else references them). A pick arriving afterwards for this person is
 * rejected by the person_not_found guards in the claim scripts.
 *
 * ARGV[1] = personId, ARGV[2] = minimum people (MIN_PEOPLE)
 * Returns: 'OK' | 'session_not_found' | 'invalid_session' | 'person_not_found'
 *          | 'has_items' | 'too_few_people'
 */
export const REMOVE_PERSON_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok or type(session) ~= 'table' then return 'invalid_session' end
if type(session.people) ~= 'table' then return 'invalid_session' end
local personId = ARGV[1]
local idx = nil
for i, p in ipairs(session.people) do
  if type(p) == 'table' and p.id == personId then idx = i break end
end
if not idx then return 'person_not_found' end
local minPeople = tonumber(ARGV[2]) or 2
if #session.people <= minPeople then return 'too_few_people' end
if type(session.claims) == 'table' and type(session.claims.items) == 'table' then
  for _, perItem in pairs(session.claims.items) do
    if type(perItem) == 'table' and type(perItem[personId]) == 'table' then return 'has_items' end
  end
end
table.remove(session.people, idx)
if type(session.claims) == 'table' then
  if type(session.claims.personSlots) == 'table' then session.claims.personSlots[personId] = nil end
  if type(session.claims.donePeople) == 'table' then session.claims.donePeople[personId] = nil end
end
if type(session.tips) == 'table' then session.tips[personId] = nil end
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`
