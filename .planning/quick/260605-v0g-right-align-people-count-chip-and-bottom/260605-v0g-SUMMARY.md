---
quick_id: 260605-v0g
slug: right-align-people-count-chip-and-bottom
type: quick
completed: "2026-06-05T19:22:33Z"
duration_minutes: 2
tasks_completed: 2
tasks_total: 2
files_modified:
  - components/wizard/SetupStep.tsx
  - components/wizard/WizardShell.tsx
commits:
  - hash: 19f1c3d
    message: "style(260605-v0g): right-align people-count chip in heading row"
  - hash: 109f6a6
    message: "style(260605-v0g): bottom-anchor Continue button via sticky-footer pattern"
tags: [layout, cosmetic, setup-screen]
---

# Quick Task 260605-v0g: Right-align people count chip and bottom-anchor Continue button

**One-liner:** Moved the people-count chip to the right edge of the heading row and anchored the Continue button to the bottom of the Setup screen using the flex sticky-footer pattern.

## What Was Done

### Task 1 — Right-constrain the people-count chip (commit 19f1c3d)

In `SetupStep.tsx` heading row, swapped the order of the `people-count-chip` span and the `h-px flex-1 bg-zinc-200` divider. Order is now: label → flex-1 divider → chip. The divider consumes all remaining space, pushing the chip to the far right edge. No class changes to the chip or divider.

### Task 2 — Bottom-anchor the Continue button (commit 109f6a6)

Applied sticky-footer pattern across three small edits:

1. `WizardShell.tsx` `<main>`: added `flex flex-col` → now `flex flex-1 flex-col px-6 py-8 pb-24`.
2. `SetupStep.tsx` root `<div>`: added `flex-1` → now `flex flex-1 flex-col gap-5`, filling the full `<main>` height.
3. `SetupStep.tsx` Continue wrapper: changed `mt-2` to `mt-auto`, pushing the button to the bottom of the filled column. Safe-area paddingBottom and gating logic (`disabled={!canContinue}`) unchanged.

## Verification

- `npx tsc --noEmit`: clean
- `npx vitest run __tests__/SetupStep.test.tsx __tests__/WizardShell.test.tsx`: 10/10 passed (2 test files)
- Grep checks confirm chip is last child in heading row, SetupStep root is `flex-1`, Continue uses `mt-auto`, `<main>` is `flex flex-col`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — pure layout change, no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- `components/wizard/SetupStep.tsx`: modified and committed (19f1c3d, 109f6a6)
- `components/wizard/WizardShell.tsx`: modified and committed (109f6a6)
- Commits 19f1c3d and 109f6a6 confirmed in git log
