---
phase: 05-polish-hardening
plan: "03"
subsystem: guest-claiming-resilience
tags: [error-handling, optimistic-ui, touch-target, tdd, guest-flow]
dependency_graph:
  requires:
    - "04-shareable-links (GuestClaimingView, ClaimableItemCard components)"
  provides:
    - "Per-item inline error state on /claim fetch failure (D-08)"
    - "Done-bar inline error state on /done fetch failure (D-09)"
    - "Apple HIG 44px touch target on ClaimableItemCard (D-12)"
    - "GuestClaimingView test coverage (Wave-0 VALIDATION.md gap)"
  affects:
    - "app/split/[sessionId]/GuestClaimingView.tsx"
    - "components/split/ClaimableItemCard.tsx"
    - "__tests__/GuestClaimingView.test.tsx"
tech_stack:
  added: []
  patterns:
    - "Optimistic UI with per-item error state (useState<Record<ItemId, boolean>>)"
    - "try/catch around fetch with inline error feedback (no toast, no modal)"
    - "TDD RED/GREEN cycle: failing test stub committed, then production code to pass"
key_files:
  created:
    - "__tests__/GuestClaimingView.test.tsx"
  modified:
    - "app/split/[sessionId]/GuestClaimingView.tsx"
    - "components/split/ClaimableItemCard.tsx"
decisions:
  - "Static copy only for error labels — no server error details surfaced (T-05-03-01, T-05-03-02 accepted)"
  - "flex-col Card layout wraps existing row in a div to add error label as second row without breaking accessibility"
  - "Session fixture uses createdAt and boolean personSlots to satisfy SessionPayload type constraints"
metrics:
  duration: "8 min"
  completed: "2026-05-14"
  tasks: 2
  files: 3
---

# Phase 5 Plan 03: Guest-Side Resilience (D-08/D-09/D-12) Summary

**One-liner:** Per-item inline "Couldn't save — tap to retry" on /claim errors and done-bar "Couldn't submit — tap to retry" on /done errors, with 44px touch-target minimum on ClaimableItemCard.

## What Was Built

Closed the last guest-side network-failure paths identified in RESEARCH.md and VALIDATION.md. A guest who loses connectivity mid-session now sees clear inline recovery prompts instead of silent failures.

### Changes

**`app/split/[sessionId]/GuestClaimingView.tsx`**
- Added `itemErrors: Record<ItemId, boolean>` state alongside `optimisticClaims`
- `handleItemTap` catch block now sets `itemErrors[itemId] = true` in addition to reverting the optimistic claim; the try branch clears it on success
- `handleDone` now wrapped in try/catch with `setDoneError("Couldn't submit — tap to retry")` on failure; `setDoneError(null)` called at start of each tap
- `ClaimableItemCard` rendered with `hasError={!!itemErrors[item.id]}`
- Done bar renders `<p className="mb-2 text-center text-sm text-red-600">{doneError}</p>` above the button when `doneError` is set

**`components/split/ClaimableItemCard.tsx`**
- Added `hasError?: boolean` to props interface and destructuring
- Card className changed from `flex items-center` to `flex min-h-[44px] flex-col gap-1` to support the error label row
- Existing row content wrapped in `<div className="flex items-center gap-3">` (no visual change without error)
- Conditionally renders `<span className="text-sm text-red-600">Couldn&apos;t save — tap to retry</span>` when `hasError` is true

**`__tests__/GuestClaimingView.test.tsx`** (new file)
- Mocks SWR with `vi.mock('swr', ...)` pattern consistent with HostWaitingScreen tests
- `selectAlice()` helper: stubs fetch to succeed for slot claim, fires click, awaits "Hi, Alice!" header
- D-08 test: after selectAlice(), stubs fetch to reject, taps Pizza, asserts "Couldn't save — tap to retry"
- D-09 test: after selectAlice(), stubs fetch to reject, taps "I'm done", asserts "Couldn't submit — tap to retry"

## Test Results

- `npm test -- --run GuestClaimingView`: 2 tests pass (D-08 + D-09 GREEN)
- `npm test -- --run ClaimableItemCard`: 3 tests pass (no regressions)
- `npm test -- --run`: 201 tests pass across 23 test files (0 failures)

## TDD Gate Compliance

- RED commit (`935dba7`): `test(05-03)` — 2 failing tests committed before production changes
- GREEN commit (`b847ee5`): `feat(05-03)` — production code makes both tests pass
- No REFACTOR step needed — implementation was clean on first pass

## Deviations from Plan

### Minor: Acceptance Criteria Grep Counts

**Issue:** The plan's acceptance criteria stated `grep -c "itemErrors" GuestClaimingView.tsx` returns 4 or more and `grep -c "doneError" GuestClaimingView.tsx` returns 4 or more. Actual counts: `itemErrors` = 2, `doneError` = 3.

**Reason:** The grep pattern is case-sensitive and `setItemErrors`/`setDoneError` use camelCase (capital I/D), so they don't match the lowercase grep pattern `itemErrors`/`doneError`. The actual occurrences (`setItemErrors` called on 2 lines, `setDoneError` called on 2 lines) are present and correct.

**Impact:** None — the behavior is fully correct. All tests pass. The grep criteria were written incorrectly (expected camelCase variant to match when it doesn't due to case sensitivity). Functionality satisfies D-08, D-09, D-12.

### Minor: SESSION_FIXTURE Adaptation

**Issue:** The plan's SESSION_FIXTURE used `personSlots: { p1: null, p2: null }` which does not match `Record<PersonId, boolean>` type in sessionSchema.ts, and omitted `createdAt`.

**Fix:** Changed `null` to `false` (matching the boolean type) and added `createdAt: Date.now()`. Tests compile and pass correctly.

## Known Stubs

None — all behavior is fully wired. Error labels appear from live state, not hardcoded values.

## Threat Flags

No new trust boundary surface introduced. All changes are client-side state and UI only. Threat model accepted per T-05-03-01 through T-05-03-04 (static copy, no server error propagation).

## Self-Check: PASSED

- FOUND: `__tests__/GuestClaimingView.test.tsx`
- FOUND: `app/split/[sessionId]/GuestClaimingView.tsx`
- FOUND: `components/split/ClaimableItemCard.tsx`
- FOUND: `.planning/phases/05-polish-hardening/05-03-SUMMARY.md`
- FOUND: commit `935dba7` (RED test stub)
- FOUND: commit `b847ee5` (GREEN implementation)
- Full test suite: 201 tests, 23 files, 0 failures
