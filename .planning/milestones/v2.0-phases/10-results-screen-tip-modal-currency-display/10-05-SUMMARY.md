---
phase: 10-results-screen-tip-modal-currency-display
plan: "05"
subsystem: split-ui
tags: [currency, results-screen, new-split, uat-gap-closure, tdd]
requires:
  - formatCents(currencyCode) — lib/billMath.ts
  - computePersonShareFromClaims (itemSubtotal/tip/total) — lib/billMath.ts
  - useBillStore.reset() — stores/useBillStore.ts
provides:
  - ClaimableItemCard renders OCR-detected currency from first claiming screen
  - Results current-user card reads items -> Subtotal -> Your tip -> Total
  - New Split clears persisted store sessionId (lands on / first tap)
affects:
  - components/split/ClaimableItemCard.tsx
  - app/split/[sessionId]/CollaborativeClaimingView.tsx
  - components/split/PersonResultsScreen.tsx
tech-stack:
  added: []
  patterns:
    - "Optional prop with `?? 'USD'` default mirrors existing currency call-site pattern — zero existing test call-site edits"
    - "reset() reused (not a new action) for full clear on New Split"
key-files:
  created: []
  modified:
    - components/split/ClaimableItemCard.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - components/split/PersonResultsScreen.tsx
    - __tests__/ClaimableItemCard.test.tsx
    - __tests__/PersonResultsScreen.test.tsx
decisions:
  - "Subtotal row placed inside the isCurrentUser block (renders right after the line-items <ul>) to keep items -> Subtotal -> Your tip -> Total reading order without restructuring the empty-state branch"
metrics:
  duration: ~6 minutes
  completed: 2026-06-08
  tasks: 3
  files: 5
---

# Phase 10 Plan 05: UAT Gap Closure (currency display, Results breakdown, New Split) Summary

Closed three Phase 10 UAT gaps with surgical TDD fixes: the OCR-detected currency symbol now shows on every amount in the claiming / Bill View (not only on Results); each person's Results breakdown gained an explicit items-only Subtotal row and an in-card Total row (items -> Subtotal -> Your tip -> Total); and New Split now clears the persisted Zustand store so the app lands on the home page on the first tap instead of bouncing back to the same bill.

## What Was Built

### Task 1 — Thread currencyCode through ClaimableItemCard (Gap 1, major)
- Added optional `currencyCode?: string` to `ClaimableItemCardProps`; both `formatCents` calls now pass `currencyCode ?? 'USD'` (line price + "your share:" line).
- `CollaborativeClaimingView` passes `currencyCode={session.currencyCode ?? 'USD'}` at the sole `ClaimableItemCard` render site (verified only one render site exists).
- Optional prop + `?? 'USD'` default means the ~13 existing `<ClaimableItemCard>` test renders that omit the prop keep compiling — zero test call-site edits.

### Task 2 — Subtotal + in-card Total rows in Results breakdown (Gap 2, minor)
- Current-user expanded card now renders an items-only Subtotal row (`data-testid="results-subtotal"` = `share.itemSubtotal`) and an in-card Total row (`data-testid="results-card-total"` = `share.total` = items + tip).
- Reading order is items -> Subtotal -> Your tip -> Total; existing `results-tip` row preserved unchanged. No math changes — all three values already come from `computePersonShareFromClaims`.

### Task 3 — Clear persisted store sessionId on New Split (Gap 3, major)
- `handleNewSplit` now calls `useBillStore.getState().reset()` (existing action) before `router.push('/')`, after the localStorage cleanup. This clears the persisted `sessionId` so `app/page.tsx` no longer redirects back to `/split/{sessionId}`.

## Deviations from Plan

None — plan executed exactly as written. All three tasks followed the prescribed RED -> GREEN TDD cycle; no REFACTOR step was needed.

## TDD Gate Compliance

Each task has a `test(...)` RED commit followed by a `feat(...)` GREEN commit:
- Gap 1: `332581c` (test) -> `9003656` (feat)
- Gap 2: `f06f9b1` (test) -> `55ec14b` (feat)
- Gap 3: `84ab57c` (test) -> `4619a38` (feat)
Each RED commit was confirmed failing before implementation; each GREEN commit confirmed passing.

## Verification

- `npx vitest run __tests__/ClaimableItemCard.test.tsx __tests__/PersonResultsScreen.test.tsx` — 32/32 pass.
- `npx vitest run` full suite — 344 passed, 3 failed. The 3 failures are pre-existing stale v1 wizard tests in `AddPeopleStep.test.tsx` (2) and `AddItemsStep.test.tsx` (1), documented as out of scope in 10-04-SUMMARY. None touch the files changed in this plan; no NEW failures introduced.
- `npx tsc --noEmit` — Exit 0 (clean).
- Grep gates:
  - `grep -c currencyCode components/split/ClaimableItemCard.tsx` = 4 (>= 3) ✓
  - `grep 'currencyCode={session.currencyCode' app/split/[sessionId]/CollaborativeClaimingView.tsx` — matches ✓
  - `grep -c results-subtotal components/split/PersonResultsScreen.tsx` = 1 (>= 1) ✓
  - `grep -c 'useBillStore.getState().reset()' components/split/PersonResultsScreen.tsx` = 1 (== 1) ✓

## Requirements

- CURR-01, CURR-02 — currency display threading completed (claiming/Bill View now renders the session currency from the first screen).

## Commits

| Task | RED | GREEN |
| ---- | --- | ----- |
| Gap 1 (currency) | 332581c | 9003656 |
| Gap 2 (Subtotal/Total) | f06f9b1 | 55ec14b |
| Gap 3 (New Split reset) | 84ab57c | 4619a38 |

## Self-Check: PASSED
- components/split/ClaimableItemCard.tsx — modified, FOUND
- app/split/[sessionId]/CollaborativeClaimingView.tsx — modified, FOUND
- components/split/PersonResultsScreen.tsx — modified, FOUND
- __tests__/ClaimableItemCard.test.tsx — modified, FOUND
- __tests__/PersonResultsScreen.test.tsx — modified, FOUND
- All 6 task commits present in git log.
