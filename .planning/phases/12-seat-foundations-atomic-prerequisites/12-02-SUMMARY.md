---
phase: 12-seat-foundations-atomic-prerequisites
plan: 02
subsystem: api
tags: [redis, lua, upstash, atomicity, next-route]
requires: []
provides:
  - "DONE_SCRIPT and TIP_SCRIPT importable Lua constants (lib/sessionLua.ts)"
  - "done and tip routes as single atomic redis.eval field-level writes"
affects: [phase-13-seat-claiming, real-redis-harness]
tech-stack:
  added: []
  patterns: ["field-level Lua script in importable module; string result mapped to HTTP status"]
key-files:
  created: [lib/sessionLua.ts, __tests__/sessionLua.test.ts]
  modified:
    - app/api/session/[sessionId]/done/route.ts
    - app/api/session/[sessionId]/tip/route.ts
    - __tests__/sessionDoneRoute.test.ts
    - __tests__/tipRoute.test.ts
key-decisions:
  - "No real-Redis harness in Phase 12; deferred to Phase 13 (REL-03). Scripts live in lib/sessionLua.ts for zero-refactor reuse."
requirements-completed: [REL-04]
duration: 10min
completed: 2026-10-06
---

# Phase 12 Plan 02: Atomic done/tip Summary

Done and tip routes now write only `claims.donePeople[personId]` / `tips[personId]` inside one Lua `redis.eval`, removing the GET-spread-SET window that could revert concurrent people[] changes, with the v2.0 HTTP contract unchanged.

## Tasks

1. Field-level DONE_SCRIPT / TIP_SCRIPT in lib/sessionLua.ts with static tests (30 tests) - bbae2af
2. Routes rewired to eval; route tests assert eval args and get/set never called - see git log (feat(12-02) rewire commit)

## Verification

- Full vitest suite: 31 files, 585 tests pass
- `npx tsc --noEmit`: pass
- No `redis.get`/`redis.set` in done/tip routes
- `npm run build`: NOT verifiable in the worktree. Turbopack rejects the node_modules symlink ("points out of the filesystem root"). This is environmental, not a code failure; re-run the build in the main checkout.

## Deviations from Plan

None - plan executed as written (except the build check noted above).

## Known Stubs

None.

## Self-Check: PASSED
