---
phase: 06-collaborative-bill-claiming
plan: "02"
subsystem: api
tags: [redis, lua, session, claims, upstash, atomic-writes, wave-1]

requires:
  - phase: 06-collaborative-bill-claiming plan 01
    provides: "lib/sessionSchema.ts Phase 6 multi-claimant shape; failing Wave 0 route test scaffolds"

provides:
  - "POST /api/session: hostToken generation, quantity-aware item validation, Phase 6 payload shape"
  - "POST /api/session/[sessionId]/claim: redis.eval Lua for atomic qty+slot writes; no redis.multi()"
  - "POST /api/session/[sessionId]/done: boolean done field for soft checkpoint with undo support"
  - "GET /api/session/[sessionId]: typed as SessionPayload"

affects:
  - "Plan 03: new tip/editRequest/dispute routes can mirror the Lua eval pattern"
  - "Plan 05-06: UI components consuming the claim/done/session GET routes"

tech-stack:
  added: []
  patterns:
    - "redis.eval() Lua for atomic claim writes — never redis.multi() on Upstash REST"
    - "Action inference: omitting action field defaults to 'qty' when itemId+qty present"
    - "Bounds check outside Lua (GET first) + atomic Lua write — acceptable race trade-off"
    - "Empty-table cleanup: remove item key when last claimant unclaims (prevents cjson [] issue)"

key-files:
  created: []
  modified:
    - "app/api/session/route.ts"
    - "app/api/session/[sessionId]/claim/route.ts"
    - "app/api/session/[sessionId]/done/route.ts"
    - "app/api/session/[sessionId]/route.ts"

key-decisions:
  - "Used done: boolean field in done route (not undone: true) to match Wave 0 test expectations"
  - "Action defaults to 'qty' when itemId present but action omitted — tests don't send action for qty claims"
  - "assignedBy hard-coded to 'self' in /claim — host-assigned writes flow via resolve routes in Plan 03"
  - "Qty bounds check via separate GET before Lua write — acceptable because Lua handles the atomic WRITE"
  - "donePeople[personId] = false (not delete) when done: false — soft undone preserves the key in Redis"

requirements-completed:
  - RESULTS-02

duration: 3min
completed: "2026-05-27"
---

# Phase 6 Plan 02: Session Routes Wave 1 Summary

**Four session API routes rewritten for Phase 6: hostToken minting, atomic redis.eval Lua claim writes (replacing unsafe redis.multi), and soft-checkpoint done with boolean toggle**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-27T15:25:07Z
- **Completed:** 2026-05-27T15:28:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Replaced Phase 4 `redis.multi()` claim pattern with `redis.eval()` Lua (RESEARCH Pitfall 1 — multi() is NOT atomic on Upstash REST)
- POST /api/session now mints `hostToken` server-side via nanoid and returns `{ sessionId, hostToken }`
- POST /api/session/[id]/claim uses two Lua scripts: `QTY_CLAIM_SCRIPT` for atomic qty writes, `SLOT_CLAIM_SCRIPT` for slot reservation + hostPersonId assignment
- POST /api/session/[id]/done supports `done: boolean` for soft checkpoint with back-button toggle (D-08)
- All 23 Wave-0 target tests pass across 4 route test files

## Test State After Plan 02

```
sessionRoute.test.ts:      7/7 PASS  (was 3/7 — 4 newly fixed)
sessionGetRoute.test.ts:   4/4 PASS  (was 4/4 — no change, already passing)
sessionDoneRoute.test.ts:  5/5 PASS  (was 3/5 — 2 newly fixed)
sessionClaimRoute.test.ts: 7/7 PASS  (was 3/7 — 4 newly fixed)
tipRoute.test.ts:          ALL FAIL  (Wave 0 — route doesn't exist yet — Plan 03)
editRequestRoute.test.ts:  ALL FAIL  (Wave 0 — route doesn't exist yet — Plan 03)
resolveEditRoute.test.ts:  ALL FAIL  (Wave 0 — route doesn't exist yet — Plan 04)
disputeRoute.test.ts:      ALL FAIL  (Wave 0 — route doesn't exist yet — Plan 03)
resolveDisputeRoute.test.ts: ALL FAIL  (Wave 0 — route doesn't exist yet — Plan 04)
```

**Total Wave 0 route tests now passing: 23/23**

## Lua Scripts Used

### QTY_CLAIM_SCRIPT (for `action: 'qty'`)

Handles atomic read-modify-write of `claims.items[itemId][personId]`:
- Reads session via `redis.call('GET', KEYS[1])` and decodes with `cjson.decode`
- Sets `claims.items[itemId][personId] = { qty, assignedBy }` (or nil for qty=0 unclaim)
- Empty-table cleanup: removes item key entirely when no claimants remain (Pitfall 6)
- Writes back with `redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)`
- ARGV: `[itemId, personId, String(qty), assignedBy]`

### SLOT_CLAIM_SCRIPT (for `action: 'slot'`)

Handles atomic slot reservation + optional hostPersonId assignment:
- Returns `'slot_taken'` if `claims.personSlots[personId]` already true
- Sets `claims.personSlots[personId] = true`
- If `maybeHostToken != ''` and matches `session.hostToken`, sets `session.hostPersonId = personId` (D-13)
- ARGV: `[personId, hostToken ?? '']`

## Task Commits

1. **Task 1: Rewrite POST /api/session** - `dc5ba59` (feat)
2. **Task 2: Rewrite claim route with redis.eval Lua** - `e34309a` (feat)
3. **Task 3: Extend done route + type GET route** - `c3cb270` (feat)

## Files Created/Modified

- `app/api/session/route.ts` — hostToken generation, quantity validation, Phase 6 payload shape
- `app/api/session/[sessionId]/claim/route.ts` — QTY_CLAIM_SCRIPT + SLOT_CLAIM_SCRIPT Lua atomic writes
- `app/api/session/[sessionId]/done/route.ts` — boolean done field, soft checkpoint, personId membership check
- `app/api/session/[sessionId]/route.ts` — typed as `redis.get<SessionPayload>`

## Decisions Made

**1. done route uses `done: boolean` field, not `undone: boolean`**
- Plan description said "undone: true" flip but Wave 0 tests use `done: true/false`
- Tests are the ground truth for Plan 02 contract
- `done: false` sets `donePeople[personId] = false` (not delete) — key preserved for explicit audit

**2. Action defaults to 'qty' when `itemId` is present without explicit `action` field**
- Wave 0 claim tests send `{ personId, itemId, qty }` with no `action` field for qty claims
- Plan's strict `action !== 'qty' && action !== 'slot'` check would reject these
- Fix: infer `action = 'qty'` when `itemId !== undefined` and no explicit action

**3. assignedBy = 'self' hard-coded in /claim**
- Host-assigned writes (D-05 unclaimed unit assignment) flow via /resolve-dispute and /resolve-edit
- These routes are created in Plan 03; the claim route is self-only

**4. Bounds check outside Lua, write inside Lua**
- qty ≤ item.quantity check happens via a separate GET before the Lua eval
- Acceptable: if a race produces stale bound read, worst case is one cycle slightly over; UI also clamps
- Atomic guarantee lives in the Lua write, not the bounds check

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Specification conflict] done route uses `done: boolean` instead of `undone: true`**
- **Found during:** Task 3 (before writing implementation)
- **Issue:** Plan action section specified `undone: true` flag and `delete nextDonePeople[personId]`. But Wave 0 test (Test 2) sends `{ personId, done: false }` and asserts `donePeople['p1'] === false`. These are incompatible — tests don't send `undone`, they send `done: boolean`. Test 5 also requires `done` field to be mandatory (returns 400 when missing).
- **Fix:** Implemented `done: boolean` required field; sets `donePeople[personId] = done` for both true and false.
- **Files modified:** `app/api/session/[sessionId]/done/route.ts`
- **Committed in:** c3cb270 (Task 3 commit)

**2. [Rule 1 - Specification conflict] Claim validation infers action='qty' when itemId present**
- **Found during:** Task 2 (before writing implementation)
- **Issue:** Plan's `validateBody` rejects any body where `action !== 'qty' && action !== 'slot'`. But Wave 0 tests 1-3 send `{ personId, itemId, qty }` with no `action` field — these would all return 400.
- **Fix:** Added inference: `const action = r.action ?? (r.itemId !== undefined ? 'qty' : undefined)`. Test 4 still sends explicit `action: 'slot'`.
- **Files modified:** `app/api/session/[sessionId]/claim/route.ts`
- **Committed in:** e34309a (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 x Rule 1 specification conflicts — tests are ground truth)
**Impact on plan:** Both fixes align implementation to Wave 0 tests. No scope creep. All plan objectives met.

## Issues Encountered

None — test failures were expected Wave 0 scaffolds and pre-existing Phase 7-8 targets (SetTipStep, ResultsStep, etc.). Zero regressions introduced.

## Next Phase Readiness

- Plan 03: New routes (tip, editRequest, dispute) can mirror the Lua eval pattern from QTY_CLAIM_SCRIPT
- Plan 03: The `baseSession` fixture shape (with hostToken, tips, editRequests, disputes) is now live in production routes
- All 4 Wave-1 route test files are green — foundation is solid for Plan 03 new routes

## Known Stubs

None — all route implementations are fully functional with no placeholder returns.

## Threat Flags

None — no new network endpoints or auth paths beyond what the plan specified.

## Self-Check: PASSED
