---
phase: 12-seat-foundations-atomic-prerequisites
reviewed: 2026-10-06T13:05:25Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - lib/seats.ts
  - lib/sessionLua.ts
  - lib/normalizeSession.ts
  - lib/sessionSchema.ts
  - stores/useBillStore.ts
  - app/api/session/route.ts
  - app/api/session/[sessionId]/route.ts
  - app/api/session/[sessionId]/done/route.ts
  - app/api/session/[sessionId]/tip/route.ts
  - __tests__/seats.test.ts
  - __tests__/sessionLua.test.ts
  - __tests__/normalizeSession.test.ts
  - __tests__/sessionRoute.test.ts
  - __tests__/sessionGetRoute.test.ts
  - __tests__/sessionDoneRoute.test.ts
  - __tests__/tipRoute.test.ts
  - __tests__/billMathSeats.test.ts
  - __tests__/v2SessionCompat.test.ts
  - __tests__/fixtures/v2-session.json
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-10-06T13:05:25Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the seat helpers, the new DONE/TIP Lua scripts, the GET-boundary normaliser, the POST cap/whitelist changes, and the accompanying tests. Diff base: `789071d`.

The Lua scripts do what the plan asked for. Each one reads, checks membership and writes one field inside a single script, and user input reaches Lua only through ARGV. KEYS/ARGV use is correct, and nothing is interpolated into the script text. I could not trace any path where done/tip now overwrite people or items. No Lua runtime or redis-server was available, so the scripts are still only string-tested (see IN-04).

The main risks are next to the new code rather than inside it:
1. The `/edit` route still does a whole-session GET → spread → SET in JavaScript. It can roll back done/tip values that the new Lua scripts just wrote.
2. `normalizeSession` fixes cjson's `[]`/`{}` shape drift only for GET. The `/edit` route reads the raw session and will crash if `items` comes back as `{}`.
3. The seat-label fallback can show two seats with the same "Guest N" label.

None of these is a proven ship-stopper inside the phase's stated scope, so I have classified them as WARNING.

## Warnings

### WR-01: `/edit` item ops still GET-spread-SET the whole session, rolling back concurrent atomic done/tip writes

**File:** `app/api/session/[sessionId]/edit/route.ts:319-377` (interacts with `lib/sessionLua.ts:4-8`, `done/route.ts:33`, `tip/route.ts:39`)
**Issue:** The header of `lib/sessionLua.ts` says the Lua move removes the "silently revert" window (Pitfall 4 / CR-01). That only holds while every writer is atomic. The `/edit` route's `add`/`remove`/`edit_price`/`edit_name`/`edit_quantity` branches still do `redis.get` → `{...session, items, claims}` → `redis.set`. Example: A edits an item price (GET), B taps "I'm done" or confirms a tip (Lua SET), then A's SET runs. A writes back the stale `claims.donePeople` and `tips`, so B's done flag or tip disappears without any error. The new atomic scripts cannot stop this, because the clobber comes from the other writer.
**Fix:** Move the item ops to field-level Lua as well (one script per op, touching only `session.items` and `session.claims.items[itemId]`). At minimum, track this explicitly under REL-01 in Phase 13 and soften the sessionLua.ts header comment so it does not claim the window is closed. Sketch:
```lua
-- EDIT_ITEM_PRICE_SCRIPT: KEYS[1]=session, ARGV[1]=itemId, ARGV[2]=newPriceCents
local raw = redis.call('GET', KEYS[1]); if not raw then return 'session_not_found' end
local ok, s = pcall(cjson.decode, raw); if not ok or type(s) ~= 'table' then return 'invalid_session' end
for _, it in ipairs(type(s.items)=='table' and s.items or {}) do
  if it.id == ARGV[1] then it.priceCents = tonumber(ARGV[2]); redis.call('SET', KEYS[1], cjson.encode(s), 'EX', 86400); return 'OK' end
end
return 'item_not_found'
```

### WR-02: Shape normalisation covers GET only; `/edit` reads the raw session and can crash on `items: {}`

**File:** `lib/normalizeSession.ts:3-8`, `app/api/session/[sessionId]/edit/route.ts:319,333`
**Issue:** The normaliser's doc says Lua writes can flip `[]` to `{}`, and calls GET "the single client-facing boundary". But `/edit` reads `redis.get<SessionPayload>` directly and runs `[...session.items]`. `remove` has no last-item guard (`validateOp` line 169 returns ok unconditionally), so `items` can become `[]`. If the Redis cjson in use encodes an empty table as `{}`, the next DONE/TIP/RENAME/CURRENCY Lua write stores `"items":{}`. Stock Redis lua-cjson 2.1 does this; Upstash's behaviour is assumed in the research docs, not verified. From then on every item edit throws `TypeError: session.items is not iterable`, which returns 500, so the user can never add items back. Before this phase, done/tip used `JSON.stringify` and kept `[]`. This phase adds two more frequently-called writers that can trigger the flip.
**Fix:** Run every server-side reader through the same normaliser, not just GET:
```ts
// edit/route.ts
const raw = await redis.get<unknown>(`session:${sessionId}`)
const session = normalizeSession(raw)
if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
```
Also have Phase 13's real-Redis harness pin down the actual empty-table encoding of the target Redis (Upstash, not just local redis-server, since they may differ).

### WR-03: `seatLabel` ordinal fallback and `nextGuestNumber` can produce duplicate "Guest N" labels

**File:** `lib/seats.ts:19-24, 36-42`
**Issue:** The ordinal fallback counts all empty seats, including those that already have a stored `guestNumber`. With empties `[A{guestNumber:2}, B{no guestNumber}]`, B gets ordinal index 1 and is labelled "Guest 2", the same as A. `nextGuestNumber` has the matching problem: it ignores ordinal-labelled seats. In a session whose empties have no guestNumber (labelled "Guest 1", "Guest 2" by ordinal), it returns `1`, so the new seat is stored as "Guest 1" and duplicates an existing label. Mixed sessions are realistic. `ADD_PERSON_SCRIPT` (edit/route.ts:47-68) never sets `guestNumber`, and v2.0 sessions have none. The point of a stable seat label is that it is unique, so this undermines it.
**Fix:** Make the fallback skip numbers that are already taken, and seed `nextGuestNumber` past the ordinal labels:
```ts
const taken = new Set(people.filter(isEmptySeat).map(p => p.guestNumber).filter(isValidGuestNumber))
let n = 0
for (const e of people.filter(isEmptySeat)) {
  if (isValidGuestNumber(e.guestNumber)) continue
  do { n++ } while (taken.has(n))
  if (e.id === person.id) return `Guest ${n}`
}
```
and in `nextGuestNumber` use `max(maxStored, countOfEmptySeatsWithoutNumber + ...)`, or a shared allocator built on the same logic. Add a mixed-session test.

### WR-04: Lua scripts error (500) instead of returning `invalid_session` when `people` or its elements are JSON `null`

**File:** `lib/sessionLua.ts:36-38, 71-73`
**Issue:** `session.people or {}` does not guard against `cjson.null`, which is a truthy lightuserdata. `"people": null` makes `ipairs(userdata)` raise a script error. A `null` element inside `people` makes `p.id` raise "attempt to index a userdata value". Either way the error surfaces as a thrown Upstash error and a generic 500, which bypasses the script's documented return contract. The same problem applies to `session.claims` (handled correctly by the `type(...) ~= 'table'` check) but not to `people`.
**Fix:**
```lua
if type(session.people) ~= 'table' then return 'invalid_session' end
for _, p in ipairs(session.people) do
  if type(p) == 'table' and p.id == personId then found = true break end
end
```

### WR-05: `seatInitial` uses the host-default locale for upper-casing

**File:** `lib/seats.ts:31-32`
**Issue:** `toLocaleUpperCase()` with no argument uses the runtime's default locale. Vercel's server runs in en-US, but a phone may be set to tr-TR. A name like "irem" then gives "I" on the server and "İ" on the client, which causes a React hydration mismatch and inconsistent avatars across phones. Characters like "ß" also upper-case to two characters ("SS").
**Fix:** Pass an explicit, fixed locale (or use `toUpperCase()`) and keep only the first code point:
```ts
return Array.from(first.toUpperCase())[0]
```
If Turkish-correct casing is wanted, pass `'tr'` explicitly and use it the same way everywhere.

## Info

### IN-01: TTL is sliding, not preserved; `86400` is a duplicated magic number

**File:** `lib/sessionLua.ts:44, 78`; `app/api/session/route.ts:102`
**Issue:** Every done/tip write runs `SET ... EX 86400`, so a session lives 24h after its *last* write, not 24h after creation. This matches the v2.0 JS behaviour, so it is not a regression. But it means an active bill can live indefinitely, and the "24h life" wording in REL-04 is not strictly accurate. The literal is repeated across at least six scripts and routes.
**Fix:** Export a `SESSION_TTL_SECONDS` constant and pass it as an ARGV to scripts. If a fixed lifetime is wanted, use `SET ... KEEPTTL` in the scripts (Upstash supports it).

### IN-02: GET returns HTTP 500 with the body `"Session not found"`

**File:** `app/api/session/[sessionId]/route.ts:24, 31`
**Issue:** The status and the message disagree, which makes client-side handling and log triage harder.
**Fix:** Use `{ error: 'Session unavailable' }` (or similar) for the 500 paths.

### IN-03: POST accepts duplicate `guestNumber` values and does not whitelist or cap `items`

**File:** `app/api/session/route.ts:10-22, 24-38, 94`
**Issue:** Person keys are now whitelisted (T-12-02), but two seats can both claim `guestNumber: 1`, which defeats the label uniqueness. `items` is still persisted verbatim, so unknown keys are stored, and the item count has no cap, unlike the new `MAX_PEOPLE` cap. Both item behaviours pre-date this phase.
**Fix:** Reject duplicate guestNumbers in `isValidPeople`. Whitelist item keys the same way as people, and add a `MAX_ITEMS` bound.

### IN-04: Lua tests are string-content only and give no execution guarantee

**File:** `__tests__/sessionLua.test.ts:1-48`
**Issue:** The tests check substrings such as `'EX', 86400` and the absence of `session.people =`. They would still pass if the script had a runtime error, a wrong nil check, or the cjson shape trap. The plan acknowledges this and defers execution testing to Phase 13 (REL-03). This note records that WR-02 and WR-04 must be covered there, including `items: []`, `people: null`, and the empty-table encoding of the actual Upstash runtime.
**Fix:** Add these cases to the Phase 13 real-Redis harness.

### IN-05: `normalizeSession` does not validate element shapes

**File:** `lib/normalizeSession.ts:27-28`
**Issue:** `people` and `items` are forced to be arrays, but their elements are passed through untyped, and the result is cast with `as unknown as SessionPayload`. A malformed element (null, or a missing `id`) reaches the client typed as a valid `Person` or `Item`.
**Fix:** Filter the elements with type guards (`people.filter(isPersonLike)`), or document that element validity is trusted.

---

_Reviewed: 2026-10-06T13:05:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
