---
phase: 08-flat-model-schema-api-surgery
plan: 02
subsystem: api
tags: [typescript, redis, lua, next.js, routes, claim, session]

# Dependency graph
requires:
  - phase: 08-01
    provides: flat SessionPayload schema with currencyCode, Wave-0 RED editRoute contract test

provides:
  - "Direct /edit route (CLAIM-03): add/edit_name/edit_price/edit_quantity/remove apply immediately, no queue"
  - "Session create with currencyCode (default USD) and no host fields"
  - "Session GET returns full flat payload including currencyCode"
  - "Claim Lua scripts host-free: QTY_CLAIM_SCRIPT and SLOT_CLAIM_SCRIPT stripped of host concepts"
  - "Wave-0 editRoute contract test GREEN (10/10)"

affects:
  - 08-03 (component surgery — ShareLinkButton co-dependent on { sessionId } only response)
  - 08-04 (test migration — old host-specific test files for deleted routes)
  - 08-05 (CollaborativeClaimingView — no hostToken in claim calls)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GET→mutate-in-JS→SET for /edit (no Lua, last-write-wins acceptable — no concurrent-write invariant)"
    - "Lua audit as separate concern from TypeScript (Pitfall 1: host concepts live inside opaque Lua strings)"
    - "ARGV shrinkage: QTY [itemId, personId, qty]; SLOT [personId] — host tokens removed"

key-files:
  created:
    - app/api/session/[sessionId]/edit/route.ts
  modified:
    - app/api/session/route.ts
    - app/api/session/[sessionId]/route.ts
    - app/api/session/[sessionId]/claim/route.ts
  deleted:
    - app/api/session/[sessionId]/accept/route.ts
    - app/api/session/[sessionId]/dispute/route.ts
    - app/api/session/[sessionId]/edit-request/route.ts
    - app/api/session/[sessionId]/resolve-dispute/route.ts
    - app/api/session/[sessionId]/resolve-edit/route.ts

key-decisions:
  - "GET→mutate-in-JS→SET for /edit (not Lua): /edit mutates session.items[] not the concurrent claims map — no atomic invariant needed"
  - "op discriminator (not type) used in /edit route per Wave-0 contract test"
  - "Claim write simplified to { qty } only in QTY_CLAIM_SCRIPT — no assignedBy field"
  - "SLOT_CLAIM_SCRIPT ARGV reduced to [personId] — no maybeHostToken"

# Metrics
duration: ~5min
completed: 2026-06-05
---

# Phase 08 Plan 02: Backend API Surgery Summary

**Deleted five host routes (404 by removal), created the direct /edit route (turning the Wave-0 test GREEN), threaded currencyCode through session create/get, and stripped all host concepts from both Lua scripts and the TypeScript claim handler.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-05T21:14:28Z
- **Completed:** 2026-06-05T21:19:06Z
- **Tasks:** 3
- **Files:** 5 modified, 1 created, 5 deleted

## Accomplishments

- Deleted five host route directories (`accept`, `dispute`, `edit-request`, `resolve-dispute`, `resolve-edit`) — Next.js now returns 404 for all of them
- Created `app/api/session/[sessionId]/edit/route.ts` exporting POST; discriminates on `op` field; all 5 ops (add, edit_name, edit_price, edit_quantity, remove) apply immediately with no approval queue (CLAIM-03)
- Ports V5 input validation from edit-request verbatim; edit_quantity rejects 400 when newQuantity < totalClaimed (Pitfall 4 / T-08-06)
- remove purges `claims.items[itemId]`; edit_price and edit_name preserve claims (D-01)
- 500 path returns generic `{ error: 'Edit failed' }` — no provider internals leaked (T-08-04)
- Wave-0 editRoute contract test: 10/10 GREEN
- `app/api/session/route.ts`: removed hostToken generation, prePopulatedClaims block, hostPersonId, editRequests, disputes; added currencyCode with `/^[A-Z]{3}$/` validation and USD default (D-04, T-08-08); POST response is `{ sessionId }` only (Pitfall 6)
- `app/api/session/[sessionId]/route.ts`: removed hostToken destructure; GET returns full flat session directly (currencyCode flows to client)
- `app/api/session/[sessionId]/claim/route.ts`: hand-audited and stripped host concepts from both Lua script strings and TypeScript; QTY_CLAIM_SCRIPT ARGV shrunk to [itemId, personId, qty]; SLOT_CLAIM_SCRIPT ARGV shrunk to [personId]; CR-03 atomic bounds check (totalClaimed loop + qty_exceeded) preserved exactly

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete 5 host routes and create direct /edit route** — `223b758` (feat)
2. **Task 2: Thread currencyCode and drop host fields from session create + get** — `2b8179c` (feat)
3. **Task 3: Hand-audit and strip host concepts from claim route Lua strings** — `bff2b2c` (refactor)

## Files Created/Modified

- `app/api/session/[sessionId]/edit/route.ts` — Direct immediate item add/edit/remove (CLAIM-03), Wave-0 contract test GREEN
- `app/api/session/route.ts` — currencyCode with USD default, no host fields, `{ sessionId }` response
- `app/api/session/[sessionId]/route.ts` — Full flat session returned, no hostToken destructure
- `app/api/session/[sessionId]/claim/route.ts` — Host-free Lua (QTY + SLOT), CR-03 bounds check intact

## Decisions Made

- GET→mutate-in-JS→SET pattern for /edit (not Lua): the /edit route mutates `session.items[]` which has no concurrent-write invariant — only the `claims` map requires Lua atomicity (CR-03). Last-write-wins is acceptable per research.
- `op` discriminator field (not `type`) used in the /edit route — driven by Wave-0 contract test which encodes this as the interface
- Claim write in Lua simplified from `{ qty = qty, assignedBy = assignedBy }` to `{ qty = qty }` — all claims are self-claims in the flat model

## Deviations from Plan

None — plan executed exactly as written. Residual test failures in `__tests__/sessionClaimRoute.test.ts` (4 of 10 failing) are expected host-case tests that Plan 04 will remove, as noted in the plan's verify instruction.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03 (component/route surgery): TypeScript cascade from schema changes will enumerate all callsites — run `npx tsc --noEmit` to see them. Co-dependent change: `ShareLinkButton` must stop reading `hostToken` from the POST response (Pitfall 6)
- Plan 04 (test migration): `__tests__/disputeRoute.test.ts`, `editRequestRoute.test.ts`, `resolveDisputeRoute.test.ts`, `resolveEditRoute.test.ts` reference deleted routes and will fail — Plan 04 deletes/replaces them
- Plan 05 (CollaborativeClaimingView): claim calls no longer need hostToken — client-side update

## Threat Flags

No new security-relevant surface introduced. The removal of host-gating (T-08-05) is intentional per CLAIM-01/03. All threat mitigations from the threat register were applied:
- T-08-03: V5 input validation ported to /edit
- T-08-04: Generic `{ error: 'Edit failed' }` on 500 paths
- T-08-06: edit_quantity rejects 400 when newQuantity < totalClaimed
- T-08-07: CR-03 atomic bounds check preserved in Lua
- T-08-08: currencyCode validated `/^[A-Z]{3}$/`, default USD

---

## Self-Check: PASSED

- `app/api/session/[sessionId]/edit/route.ts` exists: FOUND
- `app/api/session/[sessionId]/accept/` does not exist: CONFIRMED
- `app/api/session/[sessionId]/dispute/` does not exist: CONFIRMED
- `app/api/session/[sessionId]/edit-request/` does not exist: CONFIRMED
- `app/api/session/[sessionId]/resolve-dispute/` does not exist: CONFIRMED
- `app/api/session/[sessionId]/resolve-edit/` does not exist: CONFIRMED
- `npx vitest run __tests__/editRoute.test.ts` exits 0 (10/10 GREEN): CONFIRMED
- No host concepts in app/api/session/**/ source files: CONFIRMED
- `totalClaimed` and `qty_exceeded` in claim Lua: CONFIRMED
- `currencyCode` in session/route.ts with USD default: CONFIRMED
- No hostToken destructure in GET handler: CONFIRMED
- Commit `223b758` exists: VERIFIED
- Commit `2b8179c` exists: VERIFIED
- Commit `bff2b2c` exists: VERIFIED

---
*Phase: 08-flat-model-schema-api-surgery*
*Completed: 2026-06-05*
