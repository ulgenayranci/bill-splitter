---
phase: 01-manual-bill-splitter
plan: 03
subsystem: ui
tags: [react, zustand, tailwind, shadcn, vitest, wizard, tip, results, tdd]

# Dependency graph
requires:
  - phase: 01-manual-bill-splitter/01-01
    provides: WizardShell, billMath (computeSubtotalCents, computeTipCents, computePersonTotals, formatCents), useBillStore (tipPercent, setTipPercent, people, items, assignments, setStep), placeholder step shells
  - phase: 01-manual-bill-splitter/01-02
    provides: AddItemsStep, AssignItemsStep (items + assignments populated for Steps 4 and 5)

provides:
  - SetTipStep: Step 4 UI — 4 preset/custom tip buttons with live dollar display (TIP-01)
  - ResultsStep: Step 5 UI — collapsible per-person result cards with expandable breakdown (RESULTS-01)
  - 23 new passing tests (12 SetTipStep + 11 ResultsStep)
  - Phase 1 wizard fully functional end-to-end (Steps 1–5)

affects:
  - Phase 2 (OCR populates items via addItem; no schema changes needed)
  - Phase 4 (sharing will revisit disclosure model; read-only ResultsStep DOM is acceptable for Phase 1)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED→GREEN for each step component
    - Preset/custom mode state (local React state) alongside Zustand store state
    - personItemShare helper in ResultsStep: largest-remainder math per item (UI display helper, not in lib/billMath)
    - Single-expand accordion: expandedPersonId local state, toggle on card click
    - Fixed bottom strip with env(safe-area-inset-bottom) for iOS home indicator clearance

key-files:
  created:
    - components/wizard/SetTipStep.tsx
    - components/wizard/ResultsStep.tsx
    - __tests__/SetTipStep.test.tsx
    - __tests__/ResultsStep.test.tsx
  modified: []

key-decisions:
  - "personItemShare helper placed inside ResultsStep.tsx (not lib/billMath.ts) — it is a UI display helper with same math as computePersonTotals; no need to expose in the shared library"
  - "Custom tip input uses uncontrolled defaultValue on reveal; silently rejects invalid input via regex + parseFloat <= 999 (T-01-16 mitigated)"
  - "Bottom strip is position:fixed with pb-[env(safe-area-inset-bottom,16px)] to clear iOS home indicator"
  - "Tests use textContent on parent 'Tip:' paragraph instead of getByText on dollar amount (dollar appears in multiple DOM nodes: tip line + equal-split note)"

patterns-established:
  - "Split DOM text node pattern: when a paragraph has a child <span> for emphasis, query the parent via getByText on the label prefix, then assert .textContent includes the value"
  - "Local mode state alongside store state: SetTipStep holds mode ('preset'|'custom') locally while tipPercent lives in Zustand"
  - "Single-expand accordion: null = all collapsed, personId = that person expanded; toggle same ID back to null"

requirements-completed:
  - TIP-01
  - RESULTS-01

# Metrics
duration: 7min
completed: 2026-05-09
---

# Phase 01, Plan 03: Tip Selection and Results Summary

**SetTipStep (15%/18%/20%/Custom with live tip display) and ResultsStep (collapsible per-person cards with cents-conservation invariant) closing Phase 1 end-to-end**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-09T11:23:00Z
- **Completed:** 2026-05-09T11:28:00Z
- **Tasks:** 2
- **Files created:** 4 (2 components + 2 test files)

## Accomplishments

- SetTipStep fully functional: 15%/18%/20% preset buttons + Custom input, amber-600 selected state, live "Tip: $X.XX" line driven by computeTipCents, equal-split note (D-02), Back → Step 3, See results → Step 5
- ResultsStep fully functional: one Card per person with 28px amber-600 total (D-03), expandable breakdown (item shares + tip share + total), single-expand accordion, fixed bottom strip "Total bill: $X.XX", Back to tip button
- Cents conservation invariant (computePersonTotals) flows through to the UI — no DIY arithmetic in ResultsStep
- 85 total tests passing (38 Plan 01 + 11 AddItems + 12 AssignItems + 1 billMath rescue + 12 SetTipStep + 11 ResultsStep)
- npx tsc --noEmit clean; npm run build succeeds

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| Task 1 RED | test | `a2ebc5e` | Failing tests for SetTipStep (12 tests) |
| Task 1 GREEN | feat | `8fbfb13` | SetTipStep implementation |
| Task 2 RED | test | `5f6fb1e` | Failing tests for ResultsStep (11 tests) |
| Task 2 GREEN | feat | `c527363` | ResultsStep implementation |

## Design Constraint Enforcement

### D-01: Tip enters at end, before results
SetTipStep is Step 4 — after all items are assigned (Step 3). Users cannot set tip before seeing what was ordered. Enforced by wizard step ordering: AssignItemsStep → SetTipStep → ResultsStep.

### D-02: Tip splits equally among all people
SetTipStep shows: "Tip splits equally among N people — $X.XX each (display only)". ResultsStep's tipShare computation: `Math.floor(tipCents / people.length) + (personIndex < tipRemainder ? 1 : 0)`. Largest-remainder guarantees exact cents conservation.

### D-03: Total visible by default, breakdown on tap
ResultsStep default view: avatar + name + 28px amber-600 total. Tap card → expands inline to show item shares, tip share, separator, line total. Only one card expanded at a time (single-expand accordion). Chevron rotates 180° as affordance.

## Phase 1 Closing Checklist

All 6 Phase 1 requirements satisfied:

| Requirement | Description | Status |
|-------------|-------------|--------|
| PEOPLE-01 | Add people with colored avatars, trash → dialog confirm, CTA gates | ✓ Plan 01 |
| ITEMS-01 | Add items with price validation, inline edit, trash → dialog confirm, CTA gates | ✓ Plan 02 |
| ITEMS-02 | Assign items to people via chip tap, toggle on/off | ✓ Plan 02 |
| ITEMS-03 | Shared mode: ≥2 assignees shows "Shared" badge + per-person split display | ✓ Plan 02 |
| TIP-01 | 15%/18%/20%/Custom preset with live tip amount; See results always enabled | ✓ Plan 03 |
| RESULTS-01 | Per-person totals (28px amber), expandable breakdown, total bill strip, back to tip | ✓ Plan 03 |

## Test Counts

| Component | Tests | Covers |
|-----------|-------|--------|
| SetTipStep (12 new) | 12 | Preset selection, custom input, live amount, back/forward navigation |
| ResultsStep (11 new) | 11 | Per-person cards, cents conservation, expand/collapse, total bill strip, no-items person |
| **Phase 1 total** | **85** | All 6 requirements end-to-end |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertions used getByText on dollar amounts that appeared in multiple DOM nodes**
- **Found during:** Task 1 (SetTipStep GREEN phase)
- **Issue:** The "Tip: $1.80" paragraph has a `<span>` for the dollar amount. The equal-split note also contains "$1.80". `screen.getByText(/\$1\.80/)` threw "Found multiple elements" error.
- **Fix:** Changed tests to use `screen.getByText(/^Tip:/)` on the paragraph label, then assert `.textContent` contains the dollar amount. This matches the parent `<p>` element whose combined textContent starts with "Tip:".
- **Files modified:** `__tests__/SetTipStep.test.tsx`
- **Commit:** `8fbfb13` (included in Task 1 GREEN commit alongside implementation)

### No other deviations — plan executed as written.

## Known Stubs

None. All 5 wizard steps are fully implemented. No placeholder content remains.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All processing is client-side in-browser. T-01-16 mitigated as planned (custom tip input validated via regex + parseFloat ≤ 999 cap + maxLength=6 before calling setTipPercent).

## Hand-off Notes for Phase 2

- `stores/useBillStore.ts` exports `addItem(name, priceCents)` — OCR output can call this directly to pre-populate items from a receipt scan
- No schema changes needed: `Item` type already has `name: string` and `priceCents: number`
- The wizard will navigate to Step 2 (AddItemsStep) after OCR completes, where the user can see, edit, and confirm scanned items before assigning
- All math library functions in `lib/billMath.ts` are pure and ready for Phase 2+ consumption

## Self-Check: PASSED

- `__tests__/SetTipStep.test.tsx` — FOUND: 12 tests
- `__tests__/ResultsStep.test.tsx` — FOUND: 11 tests
- `components/wizard/SetTipStep.tsx` — FOUND: starts with 'use client'
- `components/wizard/ResultsStep.tsx` — FOUND: starts with 'use client'
- `npm run test -- --run` — 85 passing tests (0 failing)
- `npx tsc --noEmit` — exit 0
- `npm run build` — succeeds (production build)
- Commit `a2ebc5e` (test RED SetTipStep) — FOUND
- Commit `8fbfb13` (feat GREEN SetTipStep) — FOUND
- Commit `5f6fb1e` (test RED ResultsStep) — FOUND
- Commit `c527363` (feat GREEN ResultsStep) — FOUND

---
*Phase: 01-manual-bill-splitter*
*Completed: 2026-05-09*
