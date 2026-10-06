---
phase: 11-bug-fixes-polish-bill-results-screens-participant-management
plan: "02"
subsystem: results-screen
tags: [results, unclaimed, ui-polish, shared-utils]
dependency_graph:
  requires: []
  provides: [lib/sessionUtils.ts, PersonResultsScreen-D03-D04-D08-D09]
  affects: [CollaborativeClaimingView.tsx, UnclaimedBanner.tsx, PersonResultsScreen.tsx]
tech_stack:
  added: []
  patterns: [getUnclaimedCounts shared helper, conditional headline, shadcn Button outline+amber]
key_files:
  created:
    - lib/sessionUtils.ts
  modified:
    - components/split/PersonResultsScreen.tsx
    - __tests__/PersonResultsScreen.test.tsx
    - components/split/UnclaimedBanner.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
decisions:
  - key: "D-09 fix applied to CollaborativeClaimingView JSX"
    rationale: "Removing onCurrencyChange from PersonResultsScreenProps caused a TS2322 error in CollaborativeClaimingView's JSX render. Removed the prop from the JSX call site (Rule 1 auto-fix). The handleCurrencyChange function itself remains in CollaborativeClaimingView for 11-04 to dispose."
metrics:
  duration: "~10 minutes"
  completed: "2026-06-09"
  tasks: 2
  files: 5
---

# Phase 11 Plan 02: Results Screen Polish (D-03, D-04, D-08, D-09) Summary

Polish the Results screen: surface unclaimed items, fix the false "You're all set!" headline, promote tip affordance to a Button, and remove the confusing currency select.

## What Was Built

**lib/sessionUtils.ts** — New shared helper module exporting `getUnclaimedCounts` and `getUnclaimedItems`. Extracts the duplicated 7-line traversal from CollaborativeClaimingView.tsx and UnclaimedBanner.tsx so all three consumers (including the new PersonResultsScreen) share one implementation.

**PersonResultsScreen.tsx** — Four targeted changes:
- D-03: Amber callout section listing unclaimed item names, rendered only when `unclaimedCount > 0`, positioned directly after the headline.
- D-04: Conditional headline — `Hold up — N item(s) still up for grabs!` when unclaimed; `You're all set!` when fully claimed.
- D-08: Faint `<button className="underline">Add a tip?</button>` replaced with shadcn `<Button variant="outline" className="border-amber-600 text-amber-600 hover:bg-amber-50">Add a tip</Button>`.
- D-09: Currency `<select>`, `COMMON_CURRENCIES`, `currencyOptions`, `handleCurrencyChange`, and `onCurrencyChange` prop entirely removed. All `formatCents(amount, currencyCode)` call sites unchanged — detected currency still displays on every amount.

**__tests__/PersonResultsScreen.test.tsx** — Updated:
- Removed `onCurrencyChange` from `defaultProps`.
- Added 5 new tests: D-03 unclaimed section present/absent, D-04 headline branches, D-08 tip Button role, D-09 no combobox.
- All 22 tests pass.

## Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extract getUnclaimedCounts + getUnclaimedItems into lib/sessionUtils.ts | 2a0f13e | lib/sessionUtils.ts, UnclaimedBanner.tsx, CollaborativeClaimingView.tsx |
| 2 | Restructure PersonResultsScreen — unclaimed section, headline, tip Button, remove currency select | 2eca8b5 | PersonResultsScreen.tsx, PersonResultsScreen.test.tsx, CollaborativeClaimingView.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Remove onCurrencyChange from CollaborativeClaimingView JSX call site**
- **Found during:** Task 2 — `npx tsc --noEmit`
- **Issue:** After removing `onCurrencyChange` from `PersonResultsScreenProps`, CollaborativeClaimingView.tsx line 551 still passed `onCurrencyChange={handleCurrencyChange}`, causing TS2322.
- **Fix:** Removed the prop from the JSX `<PersonResultsScreen ... />` call in CollaborativeClaimingView.tsx. The `handleCurrencyChange` function body was left intact in CollaborativeClaimingView for 11-04 to dispose of or repurpose.
- **Files modified:** app/split/[sessionId]/CollaborativeClaimingView.tsx
- **Commit:** 2eca8b5

## Verification Results

- `npx tsc --noEmit`: clean (0 errors)
- `npx vitest run __tests__/PersonResultsScreen.test.tsx`: 22 passed, 0 failed

## Known Stubs

None. All data flows are wired — `getUnclaimedItems(session)` returns live session items.

## Threat Flags

None. UI-only change. No new server surface introduced. Item names rendered as React text nodes (JSX escaping — T-11-06 mitigated structurally).

## Self-Check: PASSED
- lib/sessionUtils.ts: FOUND
- components/split/PersonResultsScreen.tsx: FOUND
- __tests__/PersonResultsScreen.test.tsx: FOUND
- Task 1 commit 2a0f13e: FOUND
- Task 2 commit 2eca8b5: FOUND
