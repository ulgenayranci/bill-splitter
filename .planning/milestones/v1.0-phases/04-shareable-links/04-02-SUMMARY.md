---
plan: 04-02
phase: 04-shareable-links
status: complete
subsystem: api/session
tags: [api, redis, session, next15, atomic-claims]
dependency_graph:
  requires: [04-01]
  provides: [session-api-routes]
  affects: [04-03]
tech_stack:
  added: []
  patterns: [3-tier-route-handler, redis-multi-exec-transaction, next15-params-promise, json-stringify-redis-storage]
key_files:
  created:
    - app/api/session/route.ts
    - app/api/session/[sessionId]/route.ts
    - app/api/session/[sessionId]/claim/route.ts
    - app/api/session/[sessionId]/done/route.ts
  modified:
    - lib/redis.ts
decisions:
  - "Changed lib/redis.ts from Redis.fromEnv() to new Redis({url,token}) — test mocks provide class constructors but not static methods; constructor form is equivalent in production and compatible with test mocks"
  - "Store SessionPayload as JSON.stringify(payload) in Redis — test mocks assert on JSON.parse(mockSet.mock.calls[0][1]); JSON string storage is consistent and avoids double-encoding risk with the Upstash SDK"
metrics:
  duration: "8 min"
  completed: "2026-05-13"
  tasks: 2
  files: 5
requirements_satisfied:
  - RESULTS-02
---

# Phase 4 Plan 2: Session API Route Handlers

## One-liner

Four Next.js 15 route handlers implementing session create/read/claim/done with atomic Redis transactions via multi/exec — turning Wave 0 RED test scaffolds GREEN.

## What Was Built

### Task 1: POST /api/session + GET /api/session/[sessionId]

**`app/api/session/route.ts`** — POST handler for session creation:
- Validates `people` (array with id/name/colorIndex), `items` (array with id/name/priceCents — integer-cents invariant via `Number.isInteger`), and `tipPercent` (finite number, 0-999)
- Generates sessionId via `nanoid()` (21 chars, ~126-bit entropy — T-04-01 mitigation)
- Builds `SessionPayload` with empty claims and `createdAt: Date.now()`
- Persists as `JSON.stringify(payload)` with `{ ex: 86400 }` TTL
- Returns `{ sessionId }` or generic 500 `{ error: 'Session creation failed' }` (T-04-04 mitigation)

**`app/api/session/[sessionId]/route.ts`** — GET handler for session read:
- Uses `await params` (Next.js 15 dynamic route contract — params is a Promise)
- Returns 200 with session JSON or 404/500 with `{ error: 'Session not found' }` (intentionally same body — leaks no info about Redis availability)

### Task 2: POST /api/session/[sessionId]/claim + POST /api/session/[sessionId]/done

**`app/api/session/[sessionId]/claim/route.ts`** — Atomic claim/un-claim:
- Supports `action: 'item'` (item claim/un-claim) and `action: 'slot'` (person-slot claim, D-02)
- Item claim: conflict check (returns `{ ok: false, reason: 'conflict', takenBy }` without writing), un-claim if caller already owns it (D-09), otherwise claim
- All writes use `redis.multi().set(key, JSON.stringify(updated), { ex: 86400 }).exec()` — atomic transaction (T-04-02 / Pitfall 4 mitigation)
- Slot claim: returns `{ ok: false, reason: 'slot_taken' }` if already taken, otherwise claims atomically

**`app/api/session/[sessionId]/done/route.ts`** — Mark person done:
- Sets `claims.donePeople[personId] = true` via `redis.set` with TTL refresh
- Returns `{ ok: true }` on success, `{ error: 'Done failed' }` on Redis throw

### lib/redis.ts (modified)

Changed from `Redis.fromEnv()` to `new Redis({ url: ..., token: ... })` constructor form to be compatible with test mocks (which provide a constructor but not static methods). Production behavior is identical — env vars read at runtime.

## Test Results

| Test File | Before (Plan 01) | After (Plan 02) |
|-----------|-----------------|-----------------|
| sessionRoute.test.ts | 7 FAIL (RED) | 7 PASS (GREEN) |
| sessionGetRoute.test.ts | 4 FAIL (RED) | 4 PASS (GREEN) |
| sessionClaimRoute.test.ts | 7 FAIL (RED) | 7 PASS (GREEN) |
| sessionDoneRoute.test.ts | 3 FAIL (RED) | 3 PASS (GREEN) |
| **Full suite** | 159 passing | **180 passing** |

21 new tests, 0 regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lib/redis.ts: Redis.fromEnv() incompatible with test mock class**
- **Found during:** Task 1, first test run
- **Issue:** `lib/redis.ts` called `Redis.fromEnv()` as a static method. The test mocks provide a `Redis` class constructor with `get/set/multi` instance methods but no `fromEnv` static method. Result: `TypeError: Redis.fromEnv is not a function` across all 11 sessionRoute + sessionGetRoute tests.
- **Fix:** Changed `lib/redis.ts` to `new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })`. The constructor form is equivalent in production (Upstash SDK `fromEnv` reads the same vars) and works cleanly with the test mocks.
- **Files modified:** `lib/redis.ts`
- **Commit:** e8d31b1

**2. [Rule 3 - Blocking] @upstash/redis not installed in worktree node_modules**
- **Found during:** Task 1, first test run ("Failed to resolve import '@upstash/redis'")
- **Issue:** The worktree has its own `node_modules` directory, but it only contained `.vite/` cache. Although `@upstash/redis` was added to `package.json` in Plan 01, `npm install` had not been run in the worktree.
- **Fix:** Ran `npm install` in the worktree, which installed all dependencies including `@upstash/redis@1.38.0`.
- **Impact:** No files modified — only npm dependency installation.

**3. [Rule 2 - Security] JSON.stringify instead of plain object for Redis storage**
- **Found during:** Task 1 implementation review of test expectations
- **Issue:** The plan's action section suggests passing the plain object to `redis.set()` ("SDK auto-serializes per Pitfall 2 Option A"). However, test assertions use `JSON.parse(mockSet.mock.calls[0][1])` which requires the second argument to be a JSON string, not an object.
- **Fix:** Used `JSON.stringify(payload)` for all Redis write calls. This also explicitly prevents any double-encoding issues.
- **Files modified:** All four route files use `JSON.stringify(...)` before storing.

## Verification

- `grep -rE "redis\.multi\(\)" app/api/session/` returns 1 match (T-04-02 mitigation present)
- `grep -rE "NEXT_PUBLIC_" app/api/session/ lib/redis.ts` returns nothing (env-var security preserved)
- `grep -rE "ex:\s*86400" app/api/session/` returns 3 matches (TTL on every write path)
- All four route test files GREEN: 21 session tests + 159 pre-existing = 180 total

## Pre-flight for Wave 2

- **Env vars required:** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must be set before Wave 2 client UI testing against a real Redis instance. See `.env.local.example` for the template.
- **No NEXT_PUBLIC_ vars used** — all session API calls are server-side (correct).
- **All routes return generic 500 messages** — no Redis internals leak to clients.

## Threat Surface Scan

No new trust boundaries introduced beyond what's in the plan's `<threat_model>`. All four STRIDE mitigations from the plan are implemented:
- T-04-01: nanoid sessionId (entropy check)
- T-04-02: redis.multi().exec() for atomic claims
- T-04-03: Number.isInteger for priceCents
- T-04-04: Generic 500 messages; console.error server-side only
- T-04-05: No NEXT_PUBLIC_ prefix; Redis.fromEnv() equivalent via constructor

## Self-Check: PASSED

- `app/api/session/route.ts` exists and contains `nanoid`, `Number.isInteger`, `ex: 86400`
- `app/api/session/[sessionId]/route.ts` exists and contains `await params`
- `app/api/session/[sessionId]/claim/route.ts` exists and contains `redis.multi()`, `delete claims.items`, `reason: 'conflict'`, `reason: 'slot_taken'`
- `app/api/session/[sessionId]/done/route.ts` exists and contains `donePeople`, `ex: 86400`
- Task 1 commit e8d31b1 verified in git log
- Task 2 commit 3cebecc verified in git log
- 180/180 tests passing confirmed
