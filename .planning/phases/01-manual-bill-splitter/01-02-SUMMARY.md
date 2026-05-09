---
phase: 01-manual-bill-splitter
plan: 02
subsystem: ui
tags: [react, zustand, tailwind, shadcn, vitest, wizard]

requires:
  - phase: 01-manual-bill-splitter/01-01
    provides: WizardShell, AddPeopleStep, useBillStore (addItem/updateItem/removeItem/setAssignment/setStep), billMath (parseCents/formatCents), placeholder step components

provides:
  - AddItemsStep: inline item entry with price validation (ITEMS-01)
  - AssignItemsStep: chip-based person assignment with shared-mode toggle (ITEMS-02, ITEMS-03)
  - 23 new passing tests (11 AddItems + 12 AssignItems)

affects:
  - 01-03 (SetTipStep/ResultsStep build on items+assignments in store)

tech-stack:
  added: []
  patterns:
    - TDD RED→GREEN for each step component
    - parsePriceWithError helper (UI-only validation, separate from billMath)
    - toggleAssignment pattern using array includes/filter/spread
    - AVATAR_COLORS chip pattern with ring-amber-600 filled state

key-files:
  created:
    - components/wizard/AddItemsStep.tsx
    - components/wizard/AssignItemsStep.tsx
    - __tests__/AddItemsStep.test.tsx
    - __tests__/AssignItemsStep.test.tsx
  modified: []

key-decisions:
  - "Shared-split display uses Math.floor for per-person amount (largest-remainder reconciliation deferred to ResultsStep computePersonTotals)"
  - "parsePriceWithError is a file-local helper, not added to billMath.ts — it owns UI error strings"
  - "Chip tap zone is 48×48px button wrapping 40×40px avatar circle for accessibility"

patterns-established:
  - "Price validation: parsePriceWithError returns {cents} | {error}; error shown inline beneath field in text-red-600 text-sm"
  - "Store subscription: selectors per field (useBillStore((s) => s.items)), never full state destructure"
  - "Shared mode: Badge variant=secondary + 'Split equally — $X.XX each' secondary line when assignedIds.length >= 2"

requirements-completed:
  - ITEMS-01
  - ITEMS-02
  - ITEMS-03

duration: 45min
completed: 2026-05-09
---

# Plan 02: Items + Assignment Steps Summary

**AddItemsStep and AssignItemsStep fully implemented — item entry with price validation, chip-based assignment, and shared-mode split display replacing Plan 01 placeholder shells**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-05-09
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- AddItemsStep: inline item rows with name + price entry, formatCents display, parsePriceWithError validation, Dialog trash confirm, "Assign items" CTA gated on ≥1 item
- AssignItemsStep: per-item person chips (40px avatar, 48px tap zone, AVATAR_COLORS filled state + amber ring), toggleAssignment logic, "Shared" badge + "Split equally" line for ≥2 assignees, "Set tip" CTA always enabled
- 23 new tests: 11 for AddItemsStep (ITEMS-01) + 12 for AssignItemsStep (ITEMS-02/03), zero regressions in Plan 01's 38 tests

## Task Commits

1. **Task 1: AddItemsStep RED** — `d0d2d3b` (test)
2. **Task 1: AddItemsStep GREEN** — `0734c99` (feat)
3. **Task 2: AssignItemsStep RED** — `b93835b` (test)
4. **Task 2: AssignItemsStep GREEN** — `f8c2ede` (feat)

## Files Created/Modified
- `components/wizard/AddItemsStep.tsx` — Step 2: inline editable item list with price validation
- `components/wizard/AssignItemsStep.tsx` — Step 3: chip-based assignment with shared-mode
- `__tests__/AddItemsStep.test.tsx` — 11 tests covering ITEMS-01
- `__tests__/AssignItemsStep.test.tsx` — 12 tests covering ITEMS-02/ITEMS-03

## Decisions Made
- Shared-split display uses `Math.floor(priceCents / sharers.length)` — approximate per-person figure; ResultsStep's `computePersonTotals` handles penny reconciliation via largest-remainder
- `parsePriceWithError` kept file-local (owns UI error strings "Enter a price" / "Numbers only") rather than added to `lib/billMath.ts`

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
- Agent hit usage quota mid-execution after writing AssignItemsStep but before committing; the implementation was already complete and tests passing (62/62). Orchestrator committed the GREEN implementation directly.

## Next Phase Readiness
- Steps 2 and 3 fully functional; Steps 4 (SetTip) and 5 (Results) remain as Plan 01 placeholders
- Plan 03 can read `items[]` and `assignments{}` from the store to implement tip selection and the results breakdown

## Self-Check: PASSED
- `npm test -- --run`: 62/62 passing (38 Plan 01 + 11 AddItems + 12 AssignItems + 1 billMath rescue)
- `npx tsc --noEmit`: exit 0

---
*Phase: 01-manual-bill-splitter*
*Completed: 2026-05-09*
