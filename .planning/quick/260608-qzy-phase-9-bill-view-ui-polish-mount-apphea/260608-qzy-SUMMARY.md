---
phase: quick-260608-qzy
plan: 01
subsystem: split-ui
tags: [ui-polish, app-header, facepile, navigation, collaborative-flow]
dependency_graph:
  requires: []
  provides: [AppHeader on all /split screens, New Split navigation to /, overlapping facepile people strip]
  affects: [CollaborativeClaimingView, TipScreen, PersonResultsScreen, BillViewHeader, AppHeader]
tech_stack:
  added: []
  patterns: [useRouter for navigation, inline zIndex for facepile ordering]
key_files:
  created: []
  modified:
    - components/wizard/AppHeader.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - components/split/TipScreen.tsx
    - components/split/PersonResultsScreen.tsx
    - components/split/BillViewHeader.tsx
    - __tests__/CollaborativeClaimingView.test.tsx
    - __tests__/PersonResultsScreen.test.tsx
    - __tests__/TipScreen.test.tsx
    - __tests__/WizardShell.test.tsx
decisions:
  - "Inline style zIndex used (not Tailwind dynamic z-*) because Tailwind dynamic classes are not safelisted in this project"
  - "next/navigation mock added to 4 test files that render AppHeader — same pattern already used in SetupStep, AssignItemsStep, ShareLinkButton tests"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-08T16:34:02Z"
  tasks_completed: 2
  files_changed: 9
---

# Quick Task 260608-qzy: Phase 9 Bill View UI Polish — Mount AppHeader + Facepile

**One-liner:** AppHeader mounted on all four /split screens with router.push('/') New Split navigation, and the BillViewHeader people strip converted to an overlapping facepile with negative margins and descending z-index via inline style.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Mount AppHeader on all /split screens + fix New Split navigation | 765f417 | AppHeader.tsx, CollaborativeClaimingView.tsx, TipScreen.tsx, PersonResultsScreen.tsx + 3 test files |
| 2 | Convert people strip to overlapping facepile in BillViewHeader | 58fae08 | BillViewHeader.tsx |
| Rule 1 fix | Add next/navigation mock to WizardShell test | 81e12c4 | __tests__/WizardShell.test.tsx |

## What Was Built

### Task 1: AppHeader mount + New Split navigation
- Added `import { useRouter } from 'next/navigation'` to AppHeader and `const router = useRouter()` inside the component.
- `startNewSplit()` now calls `reset()`, `setStep(1)`, and `router.push('/')` — returns user to the setup screen from any /split URL.
- `<AppHeader />` mounted as first child of root `<main>` in:
  - `CollaborativeClaimingView` — both the identity-gate return (above `<IdentityModal />`) and the main bill-view return (above `<BillViewHeader />`)
  - `TipScreen` — above the existing sticky back `<header>`
  - `PersonResultsScreen` — above the inner content `<div>`

### Task 2: Overlapping facepile in BillViewHeader
- Removed `gap-2` from the strip container (spacing now from negative margins).
- Amber pill: `position: relative`, `zIndex: otherPeople.length + 2` — leftmost and on top.
- Other circles: added `ring-2 ring-white -ml-3` classes plus `position: relative` and descending `zIndex: otherPeople.length + 1 - i`.
- Overflow badge: added `ring-2 ring-white -ml-3` plus `zIndex: 0` — behind all colored circles.
- Text output (names, initials, "+N" badge) unchanged — all BillViewHeader text assertions still pass.

## Verification

- `npx tsc --noEmit`: PASS
- `npm run lint`: Non-functional (no eslint.config.js — pre-existing deferred item, STATE.md)
- `npx vitest run` (all tests): 646 passed / 6 pre-existing failures in AddItemsStep + AddPeopleStep (stale v1 wizard tests, confirmed failing before this task)
- Tests explicitly passing after changes: CollaborativeClaimingView (37), PersonResultsScreen (5), TipScreen (5), BillViewHeader (18), WizardShell (4)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AppHeader useRouter throws in jsdom without next/navigation mock**
- **Found during:** Task 1 verification (test run)
- **Issue:** `useRouter` from `next/navigation` throws "invariant expected app router to be mounted" in jsdom test environments. All tests rendering components that include `<AppHeader />` started failing.
- **Fix:** Added `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }))` to 4 test files: CollaborativeClaimingView, PersonResultsScreen, TipScreen, WizardShell. Same pattern already established in SetupStep, AssignItemsStep, ShareLinkButton tests.
- **Files modified:** `__tests__/CollaborativeClaimingView.test.tsx`, `__tests__/PersonResultsScreen.test.tsx`, `__tests__/TipScreen.test.tsx`, `__tests__/WizardShell.test.tsx`
- **Commits:** 765f417 (first three), 81e12c4 (WizardShell)

## Known Stubs

None. All changes are wired to real behavior (router navigation, live session data, actual z-index positioning).

## Threat Flags

None. This is a presentational UI change with no new network endpoints, auth paths, or schema changes.

## Human Verification Pending (Task 3 Checkpoint)

Task 3 is a `checkpoint:human-verify`. The following visual checks are outstanding:

1. Run `npm run dev` and open a `/split/[sessionId]` link at mobile width.
2. Confirm the easy-billsy header appears at the top of: the "Who are you?" identity gate, the main bill view, the tip screen, and the results screen.
3. Open the hamburger menu → tap "New Split" → confirm navigation back to `/` (after confirm dialog if a bill is in progress).
4. On the bill view, confirm the people strip renders as an overlapping facepile: amber active-person pill leftmost and on top, colored circles partially behind it with thin white rings, then a grey +N badge if more than 3 others.
5. Tap anywhere on the people strip → confirm the change-identity modal still opens.

## Self-Check: PASSED

- components/wizard/AppHeader.tsx: FOUND (contains `router.push('/')`)
- app/split/[sessionId]/CollaborativeClaimingView.tsx: FOUND (contains `<AppHeader />` twice)
- components/split/TipScreen.tsx: FOUND (contains `<AppHeader />`)
- components/split/PersonResultsScreen.tsx: FOUND (contains `<AppHeader />`)
- components/split/BillViewHeader.tsx: FOUND (contains `ring-2 ring-white`)
- Commit 765f417: FOUND
- Commit 58fae08: FOUND
- Commit 81e12c4: FOUND
