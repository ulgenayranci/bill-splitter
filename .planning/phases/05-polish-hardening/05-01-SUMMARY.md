---
phase: 05-polish-hardening
plan: "01"
status: complete
duration: inline execution (retry after agent stream timeout)
tasks_completed: 2
files_created: 0
files_modified: 3
tests_added: 5
---

# Plan 05-01: Unassigned-Item Warning + Viewport + Camera Guidance

## Objective

Ship the unassigned-item warning vertical slice plus mobile prerequisites. After this plan, a user reaching AssignItemsStep cannot accidentally land on results with unassigned items. The viewport enables safe-area insets on iOS and a static camera hint is visible on the items step.

## What Was Built

### Task 1: Viewport export + camera guidance text (D-06 / D-10)

- **app/layout.tsx**: Added `import type { Viewport } from 'next'` and exported `viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }` — enables `env(safe-area-inset-bottom)` on iOS devices with notch/Dynamic Island
- **components/wizard/AddItemsStep.tsx**: Wrapped the Scan bill Button in a Fragment and added `<p className="text-sm text-zinc-500">Allow camera access if prompted.</p>` immediately below it, inside the same `ocrStatus` gate

### Task 2: Unassigned-item warning dialog (ITEMS-04 / D-01 / D-02)

- **components/wizard/AssignItemsStep.tsx**: Added `handleContinue` which reads fresh store state (via `useBillStore.getState()`) to check for unassigned items before navigating. If any exist, opens a blocking Dialog listing them by name. Dialog has "Go back to assign them" (closes, stays on step) and "Continue anyway" (navigates to step 5, destructive variant). `showCloseButton={false}` per D-02.
- **\_\_tests\_\_/AssignItemsStep.test.tsx**: Added 5 new tests for ITEMS-04/D-01/D-02. Updated existing "sets step to 5" test to assign all items first (happy path). Total: 17 tests.

## Key Decisions

- Used `useBillStore.getState()` in `handleContinue` instead of the closure `assignments` selector to avoid stale reads when tests call `setAssignment` directly outside the React render cycle.

## Test Results

- `npm test -- --run AssignItemsStep`: 17 tests, all passing (12 pre-existing + 5 new)

## Self-Check: PASSED

### key-files.created
*(none — all files modified)*

### key-files.modified
- app/layout.tsx — exports `viewport` with `viewportFit: 'cover'`
- components/wizard/AssignItemsStep.tsx — `handleContinue` guard + dialog
- __tests__/AssignItemsStep.test.tsx — 5 new ITEMS-04/D-01/D-02 tests
