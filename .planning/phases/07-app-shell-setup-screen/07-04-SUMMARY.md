---
phase: 07-app-shell-setup-screen
plan: 04
subsystem: ui
tags: [react, zustand, tailwind, ocr, setup-screen, uat-gap-closure]

# Dependency graph
requires:
  - phase: 07-app-shell-setup-screen
    provides: WizardShell 3-segment strip, scan-first SetupStep, OCR/expand pipeline
provides:
  - Visible 3-segment progress strip (h-[3px] bars, not a collapsed wrapper)
  - Gallery-or-camera capture on the Setup scan input (capture attr dropped)
  - People-count chip bound to people.length on the "Who's involved" heading
  - Correct failed/empty-scan recovery — items cleared so the stale count chip disappears
  - Inline scan-error feedback near the scan tile, replacing the bottom toast
affects: [Phase 8 session schema, Phase 9 Bill View, Phase 10 currency display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline role=alert error surface near the action, replacing base-ui bottom Toast for scan feedback"
    - "Clear items[] alongside billImageUrl on every OCR failure path so billScanned (items.length>0) re-gates correctly"

key-files:
  created:
    - __tests__/SetupStep.test.tsx
    - .planning/phases/07-app-shell-setup-screen/deferred-items.md
  modified:
    - components/wizard/WizardShell.tsx
    - components/wizard/SetupStep.tsx
    - __tests__/WizardShell.test.tsx
    - .planning/phases/07-app-shell-setup-screen/07-CONTEXT.md

key-decisions:
  - "D-09 softened from scan-only to scan-first: camera stays the hero action but the native picker now also offers the photo library (capture=environment dropped). Manual item entry stays out of scope."
  - "Scan failure feedback moved from base-ui bottom Toast to an inline role=alert near the scan tile (where the in-progress overlay is) so it is not missed."
  - "Empty/error scan now calls setItems([]) on both the empty-result branch and the catch block — the single source of the stale 'N items found' chip."

patterns-established:
  - "Per-bar height on flex progress segments: put h-[3px] on each flex-1 bar, never clamp the flex wrapper to the bar height (the padded wrapper collapses the bars to 0)."
  - "Local scanError useState cleared at handleFileChange start and on successful scan; set on each failure path."

requirements-completed: [SHELL-04, SETUP-01, SETUP-02, SETUP-03]

# Metrics
duration: ~20min
completed: 2026-06-05
---

# Phase 7 Plan 04: Setup Screen UAT Gap Closure Summary

**Closed all 7 UAT gaps for the App Shell + Setup screen — a visible progress strip, gallery-or-camera capture, a people-count chip, cleaner copy/spacing, correct failed-scan recovery (no stale item count), and inline error feedback where the user is looking.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-05T20:34Z
- **Completed:** 2026-06-05T20:39Z
- **Tasks:** 2 (Task 1 auto; Task 2 TDD auto)
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments

### Task 1 — Visible 3-segment progress strip (GAP 1 / SHELL-04, D-07)
- Root cause was a wrapper clamped to `h-[3px]` *plus* `pt-2.5` padding, collapsing the unsized `flex-1` bars to ~0 visible height. Moved `h-[3px]` from the wrapper onto each bar; wrapper now sizes to its 3px-tall children plus padding.
- Added a regression test asserting every segment bar carries `h-[3px]`. WizardShell: 4/4 tests green.
- Commit: `eae4aea`

### Task 2 — Setup screen gaps 2-7 (TDD) (SETUP-01/02/03)
- **GAP 2:** Dropped `capture="environment"` so the native picker offers camera AND photo library; amended **D-09** in 07-CONTEXT.md with a dated revision (scan-only → scan-first).
- **GAP 3:** Added `mt-1.5` to the people wrapper for ≥5px extra separation above the existing `gap-5`.
- **GAP 4:** Added a `data-testid="people-count-chip"` pill bound to `people.length` on the heading row.
- **GAP 5:** Removed the "Add people now or after scanning." helper; Continue label is now "Continue to Assign" (no arrow).
- **GAP 6:** Added `setItems([])` on both the empty-result branch and the catch block so `billScanned` re-gates and the stale "N items found" chip clears.
- **GAP 7:** Replaced the base-ui bottom `toastManager` with an inline `role="alert"` `scanError` message near the scan tile; removed the now-dead `Toast` import/binding.
- TDD: wrote 6 failing tests (RED commit `b700926`), implemented (GREEN commit `8b77c3e`). SetupStep: 6/6 tests green.

## Verification

All plan `<verification>` grep checks pass:
- `h-[3px]` is on the `flex-1` bars in WizardShell.
- `capture="environment"` → 0 · `setItems([])` → 2 · `Continue to Assign →` → 0 · helper text → 0 · `people-count-chip` → 1 · `scan-error` → 1 · `Revised 2026-06-05` in 07-CONTEXT → 1.
- WizardShell + SetupStep test files: 10/10 green.
- `tsc --noEmit`: clean.
- Full suite: 297 passed, 5 failed — all 5 failures are pre-existing and unrelated to the changed files (see Deferred Issues).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Refreshed stale JSDoc in SetupStep.tsx**
- **Found during:** Task 2
- **Issue:** The component doc block still claimed "Scan-only entry, no gallery (D-09)" and "≥1 person (D-11)" — both contradicted by this plan's D-09 softening and the already-shipped ≥2 gate (also flagged in STATE.md operator next steps).
- **Fix:** Updated the JSDoc to scan-first + photo-library and ≥2 people.
- **Files modified:** components/wizard/SetupStep.tsx
- **Commit:** 8b77c3e

## Deferred Issues

Five pre-existing test failures surfaced in the full-suite run, none caused by this plan's changes (verified failing in isolation; the failing files do not import WizardShell or SetupStep). Logged to `.planning/phases/07-app-shell-setup-screen/deferred-items.md`:
- `AddItemsStep.test.tsx` — "Continue calls setStep(3)"
- `AddPeopleStep.test.tsx` — "disables CTA when no people" / "enables CTA after adding"
- `CollaborativeClaimingView.test.tsx` — "Test 18 Confirm tip → Results"
- `PersonSlotPicker.test.tsx` — "Test 2 opacity-50 + (taken)"

Also: `npm run lint` fails because the repo lacks an ESLint 9 flat config (`eslint.config.js`) — pre-existing tooling gap, out of scope.

## Known Stubs

None — all changes wire real data (people.length, items[], scanError state). No placeholder/empty-value stubs introduced.

## Self-Check: PASSED
