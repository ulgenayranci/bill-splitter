---
phase: 09-bill-view-redesign-identity-modal
plan: "02"
subsystem: api
tags: [redis-lua, atomicity, add-person, identity, tdd]
dependency_graph:
  requires: []
  provides: [add_person-op, ADD_PERSON_SCRIPT]
  affects: [app/api/session/[sessionId]/edit/route.ts]
tech_stack:
  added: []
  patterns: [redis-eval-lua-atomicity, server-generated-id]
key_files:
  created: []
  modified:
    - app/api/session/[sessionId]/edit/route.ts
    - __tests__/editRoute.test.ts
decisions:
  - "add_person branch runs before redis.get to prevent append race (Pitfall 2 / T-09-06)"
  - "personId generated server-side via nanoid() before redis.eval (T-09-07: client cannot pre-claim arbitrary slot)"
  - "20-person cap enforced in Lua (session_full → 409) to bound session growth (T-09-05)"
  - "Name validated in validateOp with 1-50 char trimmed constraint (T-09-04 / V5 input validation)"
metrics:
  duration: "2 min 28s"
  completed: "2026-06-06"
  tasks_completed: 1
  files_changed: 2
---

# Phase 9 Plan 02: add_person Op with ADD_PERSON_SCRIPT Atomic Lua Summary

**One-liner:** `add_person` op added to /edit route with atomic Lua script creating person + locking identity slot in one Redis write, server-generated personId returned for immediate client identity set.

## What Was Built

Implemented the `add_person` operation on `POST /api/session/[sessionId]/edit` to support the "I'm not listed" path (IDENT-03). The op atomically creates a new participant and locks their identity slot using a single `redis.eval` Lua call (`ADD_PERSON_SCRIPT`), eliminating the append race that would occur with the existing GET→mutate→SET pattern.

### Key Components

**`ADD_PERSON_SCRIPT` Lua** — reads the session, guards session not found / invalid, enforces 20-person cap, computes `colorIndex = #session.people % 6`, appends the new person to `session.people`, sets `session.claims.personSlots[newPersonId] = true`, and writes the updated session back with 24h TTL. All in a single atomic eval.

**`validateOp` add_person branch** — validates name as a non-empty trimmed string ≤ 50 chars before the Lua call. Returns 400 early; eval is never called on invalid input.

**POST handler add_person branch** — runs BEFORE the `redis.get` call so no session fetch is wasted. Generates `newPersonId` via `nanoid()` in TypeScript, calls `redis.eval(ADD_PERSON_SCRIPT, keys, [trimmedName, newPersonId])`, maps Lua return values to HTTP status codes, returns `{ ok: true, personId }`.

## TDD Gate Compliance

- RED gate: commit `369e5f6` — failing tests for Tests 11–16 (add_person ok, empty name, too long, trimming, session_full, session_not_found)
- GREEN gate: commit `e7f029f` — implementation; all 16 tests pass

## Tests

**New tests added (Tests 11–16):**
- Test 11: `add_person` with valid name → 200 `{ ok:true, personId: string }`, eval called once, `mockGet` not called
- Test 12: empty name → 400, eval not called
- Test 13: 51-char name → 400, eval not called
- Test 14: whitespace-padded name trimmed before eval (`ARGV[0] === 'Carol'`)
- Test 15: eval returns `session_full` → 409
- Test 16: eval returns `session_not_found` → 404

**Existing tests:** All 10 original tests (item add/edit/remove/validation/404/400) remain green.

**Final result:** 16/16 tests pass.

## Verification

- `npx vitest run __tests__/editRoute.test.ts` — 16/16 passed
- `npx tsc --noEmit` — no new errors
- `grep -n "ADD_PERSON_SCRIPT" route.ts` — const at line 24, eval call at line 156
- `grep -vE '^\s*--' route.ts | grep -cE "hostToken|assignedBy|editRequests"` → 0 (no stale v1 fields)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints introduced. The `add_person` op is added to the existing `/edit` endpoint. All four threats from the plan's threat register are mitigated:
- T-09-04: name injection — mitigated by server-side trim + length validation
- T-09-05: slot exhaustion — mitigated by 20-person cap in Lua
- T-09-06: append race — mitigated by single redis.eval Lua (atomic)
- T-09-07: client-supplied personId — mitigated by server-generated nanoid before eval

## Self-Check: PASSED

- `app/api/session/[sessionId]/edit/route.ts` — exists and modified
- `__tests__/editRoute.test.ts` — exists and modified
- commit `369e5f6` — confirmed in git log (RED)
- commit `e7f029f` — confirmed in git log (GREEN)
