---
phase: 10-results-screen-tip-modal-currency-display
plan: "02"
subsystem: api
tags: [currency, edit-route, validation, tdd, redis]
dependency_graph:
  requires: []
  provides: [update_currency-op-in-edit-route]
  affects: [app/api/session/[sessionId]/edit/route.ts, __tests__/editRoute.test.ts]
tech_stack:
  added: []
  patterns: [GET-mutate-SET, V5-input-validation, TDD-RED-GREEN]
key_files:
  created: []
  modified:
    - app/api/session/[sessionId]/edit/route.ts
    - __tests__/editRoute.test.ts
decisions:
  - update_currency uses standard GET→mutate→SET (not Lua) because currencyCode is a session-level singleton — last-write-wins is correct (T-10-05 accepted)
  - update_currency validation placed before itemId check in validateOp since it does not require an itemId
metrics:
  duration: "~10 minutes"
  completed: "2026-06-08"
  tasks_completed: 2
  files_modified: 2
---

# Phase 10 Plan 02: Update Currency Edit Route Summary

**One-liner:** Added `update_currency` op to `/api/session/[sessionId]/edit` with V5 input validation and shared GET→mutate→SET Redis write path (D-07/CURR-02/CURR-03).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add failing update_currency route tests (RED) | 3c1b985 | `__tests__/editRoute.test.ts` |
| 2 | Implement update_currency op on edit route (GREEN) | e74323c | `app/api/session/[sessionId]/edit/route.ts` |

## What Was Built

Extended the existing `/api/session/[sessionId]/edit` route with an `update_currency` operation. Any participant who knows the sessionId can POST `{ op: 'update_currency', currencyCode: 'EUR' }` to change the shared currency for the entire bill. The change persists to Redis (TTL 24h) and propagates to all devices on the next SWR poll.

**Route changes (`app/api/session/[sessionId]/edit/route.ts`):**
- Added `'update_currency'` to the `VALID_OPS` tuple (line 8)
- Added `update_currency` branch in `validateOp`: rejects non-string, empty, and >10-char `currencyCode` values with 400 (V5 input validation, T-10-03 mitigated)
- Added `update_currency` dispatch in the POST handler: GET→mutate→SET, returns `{ ok: true }` on success

**Test changes (`__tests__/editRoute.test.ts`):**
- Added `describe('update_currency op')` block with 4 test cases:
  - Test 17: valid 'EUR' code → 200 + persisted `currencyCode === 'EUR'` in redis.set mock
  - Test 18: empty string → 400
  - Test 19: missing field → 400
  - Test 20: 11-char string → 400

## Verification Results

- `npx vitest run __tests__/editRoute.test.ts` — 20/20 tests pass (all pre-existing + 4 new)
- `npx tsc --noEmit` — exits 0, no type errors
- `grep -c update_currency 'app/api/session/[sessionId]/edit/route.ts'` — returns 6 (≥3 required)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Validation branch placement**
- **Found during:** Task 2 (GREEN)
- **Issue:** The plan suggested adding `update_currency` validation at the bottom of `validateOp` (after the edit_quantity block), but `update_currency` does not require an `itemId`. The existing code has a guard that requires `itemId` for all ops that reach that point (after `add` and `add_person` return early). Placing `update_currency` after the itemId check would cause 400 on the valid case even with a proper `currencyCode`.
- **Fix:** Added the `update_currency` branch immediately after the `add` branch (before the itemId guard), alongside the other no-itemId ops.
- **Files modified:** `app/api/session/[sessionId]/edit/route.ts`
- **Commit:** e74323c

## Known Stubs

None.

## Threat Flags

None — all new surface was already in the plan's `<threat_model>` (T-10-03 mitigated, T-10-04 and T-10-05 accepted).

## Self-Check: PASSED

- `app/api/session/[sessionId]/edit/route.ts` — exists and contains ≥3 occurrences of `update_currency`
- `__tests__/editRoute.test.ts` — exists and contains `describe('update_currency op'`
- Commit `3c1b985` — exists (RED)
- Commit `e74323c` — exists (GREEN)
