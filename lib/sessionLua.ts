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
