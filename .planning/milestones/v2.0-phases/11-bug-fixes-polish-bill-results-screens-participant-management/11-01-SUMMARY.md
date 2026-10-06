---
phase: 11-bug-fixes-polish-bill-results-screens-participant-management
plan: "01"
subsystem: api-session-edit
tags: [redis-lua, participant-management, atomic-ops, input-validation]
dependency_graph:
  requires: []
  provides: [remove_person-op, rename_person-op]
  affects: [app/api/session/[sessionId]/edit/route.ts, __tests__/editRoute.test.ts]
tech_stack:
  added: []
  patterns: [redis-lua-eval, validateOp-branch, last-person-guard, cjson-empty-table-cleanup]
key_files:
  created: []
  modified:
    - app/api/session/[sessionId]/edit/route.ts
    - __tests__/editRoute.test.ts
decisions:
  - "Block remove_person when session.people.length <= 1 (last_person → 409) to prevent 0-person sessions"
  - "Do NOT recompute colorIndex on remaining people after removal (modulo-safe lookup)"
  - "D-09: update_currency op preserved on server; only client UI removed (future phases)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-09"
  tasks_completed: 2
  files_modified: 2
---

# Phase 11 Plan 01: Participant Management Backend (remove_person + rename_person) Summary

**One-liner:** Atomic Lua `remove_person` (full footprint purge with cjson cleanup) and `rename_person` ops added to `/edit` route, with last-person guard and 9 new route tests covering validation, Lua delegation, and D-06 claim-freeing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add remove_person + rename_person ops to /edit route | 9f2cea8 | app/api/session/[sessionId]/edit/route.ts |
| 2 | Add editRoute tests for remove_person, rename_person, claim-freeing, and validation | 0cbb757 | __tests__/editRoute.test.ts |

## What Was Built

### REMOVE_PERSON_SCRIPT (Lua)
Atomically purges a person's entire session footprint in a single `redis.eval` call:
1. Removes person from `session.people[]`
2. Deletes `claims.items[*][personId]` for all items, applying cjson empty-table cleanup (delete item key when no claimants remain; reset `claims.items` to `{}` if fully empty)
3. Nils `claims.personSlots[personId]`
4. Nils `claims.donePeople[personId]`
5. Nils `tips[personId]`

Returns `'last_person'` if `people.length <= 1` (guard prevents 0-person sessions).

### RENAME_PERSON_SCRIPT (Lua)
Atomically updates a person's `name` field in `session.people[]` via `redis.eval`. Iterates with `ipairs`, sets `p.name = newName` on match, returns `'person_not_found'` if no match.

### validateOp branches
- `remove_person`: requires `b.personId` non-empty string → `{ ok: true }`
- `rename_person`: requires `b.personId` non-empty string; `b.newName` string; trimmed non-empty; trimmed ≤ 50 chars → `{ ok: true, normalizedName: trimmed }`

### POST dispatch
Both new ops dispatch BEFORE the `try { const session = await redis.get(...) }` block, mirroring `add_person` and `update_currency` — ensuring no GET→mutate→SET race window.

### Tests (9 new, Tests 21–29)
All 30 editRoute tests pass. New tests cover:
- remove_person ok (eval once, GET not called — D-06 atomic purge verified)
- remove_person person_not_found → 404
- remove_person last_person → 409
- remove_person missing personId → 400 (eval not called)
- rename_person ok (ARGV = ['p1', 'Alicia'])
- rename_person name trimmed (ARGV[1] = 'Alicia' from '  Alicia  ')
- rename_person empty name → 400 (eval not called)
- rename_person too long → 400 (eval not called)
- rename_person missing personId → 400 (eval not called)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both ops are fully implemented. No client-side callers exist yet (Wave 2, plan 11-04 will wire UI).

## Threat Flags

No new threat surface beyond what the plan's threat model covers. All T-11-0x threats are mitigated as specified:
- T-11-01: validateOp rejects malformed inputs before eval
- T-11-02: KEYS[1] = `session:${sessionId}` (server-built) prevents cross-session access
- T-11-04: last_person guard blocks 0-person sessions (409)

## Self-Check: PASSED

- [x] `app/api/session/[sessionId]/edit/route.ts` contains `REMOVE_PERSON_SCRIPT` and `RENAME_PERSON_SCRIPT`
- [x] `__tests__/editRoute.test.ts` contains Tests 21-29
- [x] Commits 9f2cea8 and 0cbb757 exist in git log
- [x] `npx tsc --noEmit` exits 0
- [x] `npx vitest run __tests__/editRoute.test.ts` → 30 passed
- [x] `update_currency` op untouched (D-09)
