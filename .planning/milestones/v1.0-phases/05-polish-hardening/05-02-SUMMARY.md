---
phase: 05-polish-hardening
plan: "02"
subsystem: ui
tags: [react, zustand, clipboard, testing, vitest, tailwind]

# Dependency graph
requires:
  - phase: 04-shareable-links
    provides: ShareLinkButton component and session creation flow
  - phase: 01-manual-bill-splitter
    provides: ResultsStep component, Zustand store with reset(), computePersonTotals, formatCents
provides:
  - Copy summary button in ResultsStep bottom strip with 2s label-swap confirmation
  - Start over button in ResultsStep bottom strip calling useBillStore.reset()
  - navigator.clipboard.writeText mock in vitest.setup.ts for all Phase 5 tests
  - ShareLinkButton inline error "Couldn't create session. Try again." replacing toast
affects:
  - 05-polish-hardening (other plans benefit from clipboard mock in vitest.setup.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clipboard API label-swap confirmation: setCopied(true) + 2s setTimeout revert (no toast)"
    - "Inline error state pattern: useState<string | null> + clear on retry + show on catch"
    - "useBillStore.getState() in async event handlers (not reactive subscription) per Pitfall 6"

key-files:
  created: []
  modified:
    - vitest.setup.ts
    - components/wizard/ResultsStep.tsx
    - components/wizard/ShareLinkButton.tsx
    - __tests__/ResultsStep.test.tsx
    - __tests__/ShareLinkButton.test.tsx

key-decisions:
  - "D-03/D-04/D-05: Copy summary uses totals-only format (name owes $X.XX lines + Total), label-swap confirmation for 2s, no toast"
  - "D-07: ShareLinkButton inline error under button replaces toast; Toast.Provider in app/providers.tsx untouched"
  - "useBillStore.getState() in handleCopy (not reactive selector) to read snapshot at click time"

patterns-established:
  - "Label-swap clipboard confirmation: copied state + setTimeout revert at 2000ms (matches HostWaitingScreen)"
  - "Inline error state: useState<string | null>, clear at try-start, set in catch, render conditionally below button"

requirements-completed: []

# Metrics
duration: 4min
completed: "2026-05-14"
---

# Phase 05 Plan 02: Copy Summary + ShareLink Inline Error Summary

**Copy-to-clipboard totals summary with 2s label-swap confirmation and inline ShareLinkButton error replacing ephemeral toast — 205 tests passing, 0 regressions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-14T05:20:24Z
- **Completed:** 2026-05-14T05:24:21Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 5

## Accomplishments

- ResultsStep bottom strip now has "Copy summary" and "Start over" buttons; copy builds a totals-only multi-line text and writes to clipboard with a 2s "Copied!" label swap
- ShareLinkButton replaced ephemeral toast with persistent inline "Couldn't create session. Try again." error that clears on retry
- navigator.clipboard.writeText mock added to vitest.setup.ts so all Phase 5 tests can run without crashing on clipboard calls
- 6 new tests added across ResultsStep and ShareLinkButton (4 + 2); all 205 existing tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — clipboard mock + Copy summary + Start over (D-03/D-04/D-05)** - `b3e9623` (feat)
2. **Task 2: Replace ShareLinkButton toast with inline error (D-07)** - `944e25e` (feat)

_Note: Both tasks were TDD (RED then GREEN in single commits, tests + implementation together)_

## Files Created/Modified

- `vitest.setup.ts` - Added navigator.clipboard.writeText mock via cast-through-unknown pattern (matching URL.createObjectURL pattern)
- `components/wizard/ResultsStep.tsx` - Extended lucide import (Copy, Check), added reset selector, copied/setCopied state, handleCopy async function, replaced bottom strip with flex-col containing total + two buttons
- `components/wizard/ShareLinkButton.tsx` - Removed Toast import and useToastManager hook, added sessionError state, clear on retry, set on catch, wrapped Button in div with conditional error span
- `__tests__/ResultsStep.test.tsx` - Added vi/act imports, mockClear in beforeEach, 4 new tests (D-03/D-04 clipboard text, D-05 label swap, D-03 start over, D-05 anti-toast)
- `__tests__/ShareLinkButton.test.tsx` - Extended Test 4 with inline error assertion, added retry-clears test and Pitfall 5 guard test

## Decisions Made

- Used `useBillStore.getState()` (not reactive selector) inside `handleCopy` to read a consistent snapshot at click time — per RESEARCH.md Pitfall 6 guidance
- The `flex-1` class moved from Button to the wrapping div in ShareLinkButton to preserve parent layout while allowing error span to stack below
- `app/providers.tsx` Toast.Provider intentionally untouched — AddItemsStep and AssignItemsStep still rely on it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - tests passed on first GREEN run for both tasks.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all implemented features are fully wired. The pre-existing TODO comment in vitest.setup.ts about `@testing-library/jest-dom` is out of scope for this plan.

## Next Phase Readiness

- D-03, D-04, D-05, D-07 fully implemented per CONTEXT.md
- ROADMAP Phase 5 success criterion #2 (copy to clipboard) and #3 partial (ShareLinkButton portion) satisfied
- Other Phase 5 plans (D-01/D-02 unassigned warning, D-06 camera guidance, D-08/D-09 GuestClaimingView errors) can run in parallel using the clipboard mock now in vitest.setup.ts

---
*Phase: 05-polish-hardening*
*Completed: 2026-05-14*
