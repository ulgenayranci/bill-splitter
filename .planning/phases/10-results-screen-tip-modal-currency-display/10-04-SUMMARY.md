---
phase: 10-results-screen-tip-modal-currency-display
plan: "04"
subsystem: components/split
tags: [tip-modal, dialog, phase-machine, currency, tdd]
dependency_graph:
  requires: [10-01-formatCents-currency-aware, 10-03-PersonResultsScreen-all-people-accordion]
  provides: [TipScreen-dialog-content, CollaborativeClaimingView-two-phase-machine, tip-dialog-mount]
  affects:
    - components/split/TipScreen.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - __tests__/TipScreen.test.tsx
    - __tests__/CollaborativeClaimingView.test.tsx
tech_stack:
  added: []
  patterns:
    - Dialog-content component (no page chrome)
    - Two-phase machine (claiming|results), tip as optional Dialog
    - tipDialogOpen state at component top level (Pitfall 4 guard)
    - currencyCode threading through formatCents(cents, currencyCode)
key_files:
  created: []
  modified:
    - components/split/TipScreen.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - __tests__/TipScreen.test.tsx
    - __tests__/CollaborativeClaimingView.test.tsx
decisions:
  - "tipDialogOpen declared at component top level (not inside phase branch) — Dialog state persists across renders (Pitfall 4, T-10-11)"
  - "derivePhase maps donePeople -> 'results' directly; tips?.[personId] check removed — all done users land on Results (D-01, Pitfall 3, T-10-10)"
  - "handleCurrencyChange defined in CollaborativeClaimingView (owns SWR session + mutate); PersonResultsScreen delegates via onCurrencyChange prop — no direct fetch in leaf component"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-08"
  tasks: 3
  files: 4
---

# Phase 10 Plan 04: Tip Dialog + Phase Machine Rewire Summary

**One-liner:** `TipScreen` converted from full-page screen to Dialog content with `currencyCode` prop; `CollaborativeClaimingView` phase machine reduced to `claiming | results` with the tip as an optional Dialog opened from Results (D-01, TIP-02, CURR-02).

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update TipScreen tests for Dialog content + EUR currency (RED) | 128b88d | `__tests__/TipScreen.test.tsx` |
| 2 | Convert TipScreen to Dialog content with currencyCode (GREEN) | c45682c | `components/split/TipScreen.tsx` |
| 3 | Rewire CollaborativeClaimingView phase machine + mount Tip Dialog | b2ba57a | `app/split/[sessionId]/CollaborativeClaimingView.tsx`, `__tests__/CollaborativeClaimingView.test.tsx` |

---

## What Was Built

### `components/split/TipScreen.tsx` (converted)

**Old interface (removed):**
- `onBack: () => void` — Dialog's close button owns dismiss now
- `<main className="...min-h-screen...">` wrapper, `<AppHeader />`, sticky Back header, fixed bottom bar

**New interface:**
```typescript
export interface TipScreenProps {
  sessionId: string
  personId: string
  itemSubtotalCents: number
  currencyCode?: string       // new: threaded to both formatCents calls
  onTipConfirmed: () => void
  mutate: () => Promise<unknown>
}
```

**Preserved verbatim:** `applyPreset`, `applyCustom`, `MAX_TIP_PERCENT=100`, `handleConfirm` (POST /tip, mutate, onTipConfirmed, error "Couldn't save tip — try again"), `$0-confirm always enabled`.

**New return shape:** `<div className="flex flex-col gap-6 px-6 py-4">` with heading, tip amount (`data-testid="tip-amount-display"`), preset buttons, custom `%` input, separator, total row (`data-testid="tip-total-display"`), inline error, and "Confirm tip" Button (`h-12 w-full bg-amber-600`, aria-label swaps to "Confirming tip…" while submitting).

### `app/split/[sessionId]/CollaborativeClaimingView.tsx` (rewired)

**Phase union:** `'claiming' | 'tip' | 'results'` → `'claiming' | 'results'`

**`derivePhase`:** Returns `'results'` when `session.claims?.donePeople?.[personId]` is truthy; `'claiming'` otherwise. Removed the `tips?.[personId]` branch — a done user with or without a tip now always lands on Results (D-01, Pitfall 3).

**`submitDone`:** `setPhase('tip')` → `setPhase('results')` (Done goes straight to Results; D-01).

**New top-level state:** `const [tipDialogOpen, setTipDialogOpen] = useState(false)` — declared alongside `showUnclaimedWarning` at component top level (Pitfall 4 — NOT inside a phase branch).

**Removed:** The entire `if (phase === 'tip') { return <TipScreen .../> }` block.

**Results branch:** Fragment with `PersonResultsScreen` (onAddTip opens dialog, onCurrencyChange wired) + sibling `Dialog open={tipDialogOpen}` containing `TipScreen` (currencyCode threaded, onTipConfirmed closes dialog).

**New `handleCurrencyChange`:** `POST /api/session/${sessionId}/edit { op: 'update_currency', currencyCode }` then `mutate()` — CollaborativeClaimingView is the single tier that owns the SWR session data and write path.

### `__tests__/TipScreen.test.tsx`

- `renderTip` helper: removed `onBack`, added `currencyCode` (default `'USD'`)
- Test 6: repurposed — asserts `queryByRole('button', { name: /^Back$/i })` is null (Dialog content owns no Back button)
- Test 9 (new): `currencyCode='EUR'` — both `tip-amount-display` and `tip-total-display` contain `€`
- Tests 1-5, 7, 8: unchanged behavior, minor prop signature update only
- All 9 tests green

### `__tests__/CollaborativeClaimingView.test.tsx` (auto-fixed)

- Test 7: updated from "Back from Tip" to "Edit bill from Results" — matches D-01 arch (Edit bill → `handleBackToClaiming` → `done:false` POST)
- Test 18: updated from "Continue anyway → tip → Confirm tip" to "Continue anyway → Results always" — verifies D-01 (no linear tip phase, no waiting screen)

---

## TDD Gate Compliance

- RED gate: commit `128b88d` — `test(10-04): update TipScreen tests for Dialog content + EUR currency (RED)` — Tests 6 (no Back) and 9 (EUR) failing against old full-page TipScreen
- GREEN gate: commit `c45682c` — `feat(10-04): convert TipScreen to Dialog content with currencyCode (GREEN)` — all 9 tests passing
- REFACTOR: not needed — implementation was clean first pass

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CollaborativeClaimingView tests 7 and 18 tested the removed linear `tip` phase**
- **Found during:** Task 3 — `npx vitest run` returned 2 failures in `CollaborativeClaimingView.test.tsx`
- **Issue:** Test 7 clicked a "Back" button that TipScreen no longer renders (now Dialog content); Test 18 tried to click "Confirm tip" directly after "Continue anyway" without opening the Tip Dialog first
- **Fix:** Test 7 updated to click "Edit bill" from Results and verify `done:false` POST (matches D-01); Test 18 updated to verify Results is shown directly after "Continue anyway" (no waiting screen per D-12, D-01)
- **Files modified:** `__tests__/CollaborativeClaimingView.test.tsx`
- **Commit:** b2ba57a (inline with Task 3)

**2. [Rule 1 - Bug] `getByText("You're all set!")` failed due to `&rsquo;` HTML entity**
- **Found during:** Task 3 test fix — `getByText` with straight apostrophe didn't match `You’re all set!` in DOM
- **Fix:** Changed to regex `/You.?re all set!/` (consistent with existing `You.?re all set` pattern in Test 18)
- **Files modified:** `__tests__/CollaborativeClaimingView.test.tsx`
- **Commit:** b2ba57a (inline with Task 3)

### Out-of-Scope Pre-existing Failures (not fixed)

3 tests in `AddPeopleStep.test.tsx` and `AddItemsStep.test.tsx` were failing before this plan's changes (verified by running tests before any edits). These are v1 wizard tests referencing button labels that changed in earlier phases. Logged to deferred items.

---

## Verification Results

```
npx vitest run __tests__/TipScreen.test.tsx           → 9/9 PASS
npx vitest run __tests__/CollaborativeClaimingView.test.tsx → 32/32 PASS
npx vitest run (full suite)                           → 340/343 PASS (3 pre-existing failures)
npx tsc --noEmit                                      → Exit 0 (no errors)

Grep gates:
  grep -c tipDialogOpen CollaborativeClaimingView.tsx → 2 (≥2 required) ✓
  grep "'tip'" CollaborativeClaimingView.tsx          → no matches ✓
  grep onCurrencyChange={handleCurrencyChange}        → found ✓
```

---

## Known Stubs

None — all functionality is fully implemented:
- TipScreen: Dialog content with live tip calculation, POST /tip, EUR formatting
- CollaborativeClaimingView: two-phase machine with Tip Dialog mounted; currency write wired

---

## Threat Flags

None — all threat mitigations from the plan's `<threat_model>` applied as designed:
- T-10-09 (tip tampering): existing server-side `MAX_TIP_CENTS=100_000` cap unchanged; client `MAX_TIP_PERCENT=100` preserved verbatim
- T-10-10 (blank screen): `derivePhase` maps `donePeople -> 'results'`; no code path returns removed `'tip'` literal
- T-10-11 (Dialog state reset): `tipDialogOpen` declared at component top level, not inside phase branch

---

## Self-Check: PASSED

- `components/split/TipScreen.tsx` exists; does not contain `min-h-screen`; contains `currencyCode`
- `app/split/[sessionId]/CollaborativeClaimingView.tsx` exists; contains `tipDialogOpen` (2 occurrences); no `'tip'` phase literal
- `__tests__/TipScreen.test.tsx` exists; contains `currencyCode`; does not contain `onBack`
- Commits `128b88d` (RED), `c45682c` (GREEN), `b2ba57a` (Task 3) exist in git log
