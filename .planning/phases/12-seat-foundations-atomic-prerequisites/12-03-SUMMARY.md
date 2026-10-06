---
phase: 12-seat-foundations-atomic-prerequisites
plan: 03
subsystem: api
tags: [redis, cjson, normalization, back-compat, vitest]
requires:
  - phase: 12-01
    provides: seats helpers (isEmptySeat, seatLabel)
  - phase: 12-02
    provides: DONE_SCRIPT / TIP_SCRIPT atomic routes
provides:
  - normalizeSession at the GET /api/session/[sessionId] boundary
  - Frozen v2.0 session fixture and REL-04 back-compat regression suite
affects: [phase-13, phase-16]
key-files:
  created:
    - lib/normalizeSession.ts
    - __tests__/normalizeSession.test.ts
    - __tests__/fixtures/v2-session.json
    - __tests__/v2SessionCompat.test.ts
  modified:
    - app/api/session/[sessionId]/route.ts
    - __tests__/sessionGetRoute.test.ts
requirements-completed: [REL-04, RESULTS-06]
completed: 2026-10-06
---

# Phase 12 Plan 03: Session normalization and v2.0 back-compat Summary

normalizeSession coerces cjson []/{} drift (tips, claims.items/personSlots/donePeople, per-item claim maps, people/items) at the single GET fetch boundary, and a frozen v2.0 fixture proves old bills still open, record done/tip, total identically and render Results.

## Tasks

1. normalizeSession + GET wiring (commit db73a25): pure, non-mutating, idempotent; preserves legacy keys; adds no absent keys; non-object stored value gives generic 500.
2. Fixture + compat suite (see git log, test(12-03) commit): 8 cases covering GET, seat helpers, totals without tax/fee (1900/1400/400), totals with tax 1001 + fee 250 (2318/1817/816, sum 4951), done and tip routes via eval, Results render (stable ids `results-total` / `results-card-total`), and the legacy-shape variant.

## Verification

Full vitest: 35 files, 637 tests pass. `npx tsc --noEmit` clean. `npm run build` not run (worktree restriction; orchestrator runs it after merge).

## Deviations from Plan

None. Hand-derived expected cents matched billMath on first run. No production files changed in Task 2.

## Known Stubs

None.

## Self-Check: PASSED
