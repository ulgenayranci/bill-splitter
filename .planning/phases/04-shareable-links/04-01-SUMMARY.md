---
plan: 04-01
phase: 04-shareable-links
status: complete
---

# Phase 4 Plan 1: Foundation — Deps, Schema, Store, Wizard Reorder

## What Was Built

Task 1 (committed prior to this continuation): Installed @upstash/redis, nanoid, and swr dependencies. Created `lib/redis.ts` (Redis client singleton) and `lib/sessionSchema.ts` (Zod session schema). Added four RED test scaffolds for the session API routes that will be implemented in Plan 04-02.

Task 2: Extended `stores/useBillStore.ts` with `syncStatus` (`'idle' | 'waiting' | 'results'`) and `sessionId` (`string | null`) fields, their INITIAL_STATE values, and `setSyncStatus`/`setSessionId` action implementations. Added 6 Phase 4 tests covering initial state, transitions, and reset behavior — all passing GREEN.

Task 3: Reordered the wizard steps per design decision D-04. The new order is AddPeople(1) → AddItems(2) → SetTip(3) → AssignItems(4) → Results(5). Updated STEP_LABELS in WizardShell, nav button targets and labels in SetTipStep and AssignItemsStep, step routing in app/page.tsx, and all affected tests. Added WizardShell.test.tsx with D-04 compliance tests.

## key-files.created
- lib/redis.ts
- lib/sessionSchema.ts
- __tests__/sessionRoute.test.ts
- __tests__/sessionGetRoute.test.ts
- __tests__/sessionClaimRoute.test.ts
- __tests__/sessionDoneRoute.test.ts
- __tests__/WizardShell.test.tsx

## key-files.modified
- package.json (@upstash/redis, nanoid, swr added)
- stores/useBillStore.ts (syncStatus + sessionId fields, INITIAL_STATE, setters)
- components/wizard/WizardShell.tsx (STEP_LABELS updated for D-04)
- components/wizard/SetTipStep.tsx (Back → step 2, Forward → step 4 "Assign items")
- components/wizard/AssignItemsStep.tsx (Back → step 3, Forward → step 5 "See results")
- app/page.tsx (step 3 → SetTipStep, step 4 → AssignItemsStep)
- __tests__/AssignItemsStep.test.tsx (updated button labels and step assertions)
- __tests__/SetTipStep.test.tsx (updated button labels and step assertions)
- __tests__/useBillStore.test.ts (added 6 Phase 4 syncStatus/sessionId tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated AssignItemsStep and SetTipStep tests to match new step order**
- **Found during:** Task 3
- **Issue:** Existing tests for AssignItemsStep ("Set tip" button label, step 4 assertion) and SetTipStep ("See results" → step 5, Back → step 3) referenced the old step order and would fail after the wizard reorder.
- **Fix:** Updated test assertions and button name queries in both test files to match the new step labels and navigation targets.
- **Files modified:** `__tests__/AssignItemsStep.test.tsx`, `__tests__/SetTipStep.test.tsx`
- **Commit:** 0e899ae

## Self-Check: PASSED

- All 159 tests pass (30 store tests + 12 AssignItemsStep + 12 SetTipStep + 2 WizardShell + others)
- 4 session route test scaffolds intentionally fail (RED tests for routes not yet built — per plan design)
- All committed files verified in git log: 6bf7eea (Task 1), 99fdedb (Task 2), 0e899ae (Task 3)
- INITIAL_STATE in useBillStore includes syncStatus and sessionId
- reset() spreads INITIAL_STATE so both fields reset correctly
- STEP_LABELS confirmed as ['Add People', 'Add Items', 'Tip', 'Assign / Share', 'Results']
