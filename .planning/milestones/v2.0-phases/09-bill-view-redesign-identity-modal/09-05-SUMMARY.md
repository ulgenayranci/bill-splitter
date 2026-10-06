---
phase: 09-bill-view-redesign-identity-modal
plan: 05
subsystem: ui
tags: [react, typescript, tailwind, vitest, claimable-item-card, attribution-chips, tap-to-join]

# Dependency graph
requires:
  - phase: 09-01
    provides: computeEqualShareCents + share claim action
provides:
  - "ClaimableItemCard augmented: 3-chip cap +N overflow, own-claim amber border, onShareChange tap-to-join, your-share equal-split line"
  - "onShareChange prop interface for Plan 09-06 orchestrator to wire share action"

affects:
  - "Plan 09-06 (CollaborativeClaimingView) consumes onShareChange prop to dispatch share claim action"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MAX_VISIBLE_AVATARS = 3 (D-07): chip cap reduced from 5"
    - "onShareChange optional prop: single-qty taps route through share callback; falls back to onQtyChange when undefined (backward compat)"
    - "computeEqualShareCents: caller sorts claimant IDs ascending, passes myIndex for deterministic largest-remainder share display"

key-files:
  created: []
  modified:
    - components/split/ClaimableItemCard.tsx
    - __tests__/ClaimableItemCard.test.tsx
  deleted: []

key-decisions:
  - "onShareChange is optional — when undefined the single-qty tap falls back to onQtyChange for backward compatibility with any existing callers not yet updated to the share action"
  - "your-share line uses lexicographic sort of claimant personIds for determinism (same rule as computeEqualShareCents JSDoc)"
  - "Test 8 updated from 5-cap to 3-cap: old test asserted span[title].length === 5, new test asserts 3"

requirements-completed: [CLAIM-02, CLAIM-04]

# Metrics
duration: ~15min
completed: 2026-06-07
---

# Phase 09 Plan 05: ClaimableItemCard Attribution Chips + Tap-to-Join Summary

**ClaimableItemCard augmented with 3-chip attribution cap (+N overflow), own-claim amber border, onShareChange tap-to-join callback, and your-share equal-split line — all Phase 9 card-level attribution requirements (D-06 through D-08, D-13 through D-15) delivered.**

## What Was Built

### Task 1 — Chips to 3+N, amber border, onShareChange tap-to-join, your-share line

- `MAX_VISIBLE_AVATARS` reduced from 5 to 3 (D-07)
- Own-claim card classes updated: `mine ? 'bg-amber-50 border border-amber-400' : ''` — both tint and border (D-06)
- New optional prop `onShareChange?: (joining: boolean) => void` added to `ClaimableItemCardProps`
- `handleToggle` updated: if `onShareChange` provided → calls `onShareChange(myQty === 0)`; otherwise falls back to `onQtyChange(myQty === 0 ? 1 : 0)` (D-13, backward compat)
- Multi-qty stepper path unchanged — `onShareChange` is never invoked by the stepper (D-14)
- `computeEqualShareCents` imported from `@/lib/billMath`; "your share" line rendered when `!isMultiQty && mine && claimantCount > 1`, styled `text-[14px] text-zinc-500 mt-1` with `data-testid="your-share"` (D-15)
- Determinism: claimant IDs sorted lexicographically ascending before computing `myIndex` (matches Plan 01 spec)

### Test file changes

- Test 8 updated from cap-5 to 4-claimant/cap-3 scenario (D-07 alignment)
- New `describe` block "Phase 9 (D-06, D-07, D-08, D-13, D-14, D-15)" with 8 new tests:
  - D-07: 5 claimants → 3 chips + "+2"
  - D-06: mine=true → both bg-amber-50 and border-amber-400 on card
  - D-13 unclaimed: onShareChange(true), onQtyChange not called
  - D-13 claimed: onShareChange(false), onQtyChange not called
  - D-14: stepper calls onQtyChange, never onShareChange
  - D-15: shared item your-share line shows "$3.34" for $10.00 / 3 people (p1 at index 0)
  - D-08: no .animate-pulse / .animate-bounce / [data-toast] / role="status" elements
  - backward compat: onShareChange undefined → falls back to onQtyChange

## Verification

- `npx vitest run __tests__/ClaimableItemCard.test.tsx` → 16/16 tests pass (RED commit showed 6 failures before implementation)
- `npx tsc --noEmit` → no errors in ClaimableItemCard
- `grep "MAX_VISIBLE_AVATARS = 3"` → match; no `= 5` remains
- `grep "onShareChange" / "computeEqualShareCents" / "border-amber-400"` → all present

## Deviations from Plan

### Write/Edit Tool Denial (executor)

**Found during:** Task 1 (RED phase — test writing)
**Issue:** Both `Write` and `Edit` tools were denied by the permission layer in the executor's worktree. No file changes or commits could be made by the agent.
**Resolution:** Executor returned full file content per the fallback protocol; the orchestrator wrote both files on main, verified RED (6 failures) before the implementation commit, verified GREEN (16/16) after, and committed in the planned test → feat → docs sequence.
**Files affected:** `__tests__/ClaimableItemCard.test.tsx`, `components/split/ClaimableItemCard.tsx`, `09-05-SUMMARY.md`

## Self-Check: PASSED
