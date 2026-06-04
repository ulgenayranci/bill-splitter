---
phase: 01-manual-bill-splitter
verified: 2026-05-09T12:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 1: Manual Bill Splitter Verification Report

**Phase Goal:** Build a fully functional manual bill splitter wizard — 5 steps that let a group add people, add items, assign items to people, set a tip, and see a per-person breakdown of what they owe.
**Verified:** 2026-05-09T12:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can add people to the bill by name with no account or login | VERIFIED | `AddPeopleStep.tsx`: Input with `placeholder="Enter name"`, `addPerson` action, avatar list rendered, CTA `disabled={people.length === 0}` — gating enforced. 6 component tests covering the full flow pass. |
| 2 | User can manually enter item names and prices (stored as integer cents with no floating-point error) | VERIFIED | `AddItemsStep.tsx`: `parsePriceWithError` → `parseCents` converts to integer cents via `Math.round(parseFloat * 100)`. `formatCents` used for display only. `parseCents` regex `/^\d+(\.\d{1,2})?$/` rejects 3+ decimals, negatives, empty. 12 component tests pass including error-path assertions. |
| 3 | User can assign each item to one person or mark it as shared and pick which people shared it | VERIFIED | `AssignItemsStep.tsx`: `toggleAssignment` adds/removes personId from array. `isShared = assignedIds.length >= 2` triggers `<Badge variant="secondary">Shared</Badge>` and "Split equally — $X.XX each" line. 12 component tests pass covering single, shared, and deselect scenarios. |
| 4 | User can enter a tip as a preset percentage (15%, 18%, 20%) or a custom value | VERIFIED | `SetTipStep.tsx`: `PRESETS = [15, 18, 20]` rendered as buttons. Custom mode reveals `<Input inputMode="decimal">` with validation. Live "Tip: $X.XX" line computed via `computeTipCents`. Default `tipPercent: 18` from store. 12 tests pass. |
| 5 | App shows a final breakdown listing what every person at the table owes, reflecting proportional tip | VERIFIED | `ResultsStep.tsx`: `computePersonTotals` called once per render; each person gets a `Card` with total in `text-[28px] font-semibold text-amber-600`. Expandable breakdown shows item shares via `personItemShare` (largest-remainder) + tip share + separator + line total. Fixed bottom strip shows "Total bill: $X.XX". Cents-conservation invariant tested: 85 total tests pass including the conservation test (Test 3 in ResultsStep). |

**Score: 5/5 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/billMath.ts` | Pure integer-cents arithmetic | VERIFIED | Exports `parseCents`, `formatCents`, `computeSubtotalCents`, `computeTipCents`, `computePersonTotals`. Largest-remainder method implemented. No float arithmetic in results. |
| `stores/useBillStore.ts` | Zustand store with people/items/assignments/tipPercent/step + actions | VERIFIED | Exports `useBillStore`, `AVATAR_COLORS`, `Person`, `Item`, `PersonId`, `ItemId`. All CRUD actions implemented. `crypto.randomUUID()` for IDs. `tipPercent: 18` default. `removePerson` cleans assignments. |
| `components/wizard/WizardShell.tsx` | Step routing shell + URL hash sync | VERIFIED | `window.history.pushState` on step change + `hashchange` listener for browser back/forward. Progress strip renders 5 segments. |
| `app/page.tsx` | `'use client'` wizard entry rendering active step from store | VERIFIED | `'use client'` on line 1. Imports all 5 steps and `WizardShell`. Renders `{step === N && <StepComponent />}` for all 5 steps. |
| `components/wizard/AddPeopleStep.tsx` | Step 1: add/remove people, advance gating | VERIFIED | 136 lines. Shadcn `Input`, `Button`, `Dialog` for remove confirm. `aria-label={`Remove ${person.name}`}` template literal. `disabled={people.length === 0}`. Calls `setStep(2)`. |
| `components/wizard/AddItemsStep.tsx` | Step 2: inline-editable item rows with price validation | VERIFIED | 262 lines. `parsePriceWithError` helper. Inline edit + add flow. `disabled={items.length === 0}`. Calls `setStep(3)`. Dialog for remove. |
| `components/wizard/AssignItemsStep.tsx` | Step 3: per-item person-chip assignment with shared-mode toggle | VERIFIED | 120 lines. `toggleAssignment` logic. `Badge` "Shared". "Split equally" display. Calls `setStep(4)`. |
| `components/wizard/SetTipStep.tsx` | Step 4: preset/custom tip selector with live tip amount | VERIFIED | 154 lines. `PRESETS = [15, 18, 20]`. Custom input with `inputMode="decimal"`. Live "Tip:" line. `setStep(5)` and back `setStep(3)`. |
| `components/wizard/ResultsStep.tsx` | Step 5: collapsible per-person result cards + total bill strip | VERIFIED | 169 lines. `computePersonTotals` consumed. `expandedPersonId` accordion. `text-[28px] font-semibold text-amber-600`. Fixed "Total bill:" strip. Back `setStep(4)`. |
| `vitest.config.mts` | Vitest config with jsdom + tsconfigPaths + react plugin | VERIFIED | Contains `environment: 'jsdom'`, imports `@vitejs/plugin-react` and `vite-tsconfig-paths`. |
| `__tests__/billMath.test.ts` | Unit tests for parseCents, computePersonTotals, computeTipCents | VERIFIED | Exists and passes. |
| `__tests__/useBillStore.test.ts` | Store mutation tests | VERIFIED | Exists and passes. |
| `__tests__/AddPeopleStep.test.tsx` | Component tests for Step 1 | VERIFIED | 6 `it()` calls, all passing. |
| `__tests__/AddItemsStep.test.tsx` | Component tests for ITEMS-01 | VERIFIED | 12 `it()` calls, all passing. |
| `__tests__/AssignItemsStep.test.tsx` | Component tests for ITEMS-02/03 | VERIFIED | 12 `it()` calls, all passing. |
| `__tests__/SetTipStep.test.tsx` | Component tests for TIP-01 | VERIFIED | 12 `it()` calls, all passing. |
| `__tests__/ResultsStep.test.tsx` | Component tests for RESULTS-01 | VERIFIED | 11 `it()` calls, all passing. |
| `package.json` | `"test": "vitest"` script, zustand, vitest deps | VERIFIED | `"test": "vitest"` confirmed. `zustand@^5.0.13`, `vitest@^4.1.5`, `@testing-library/react@^16.3.2` present. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/page.tsx` | `stores/useBillStore.ts` | `useBillStore((s) => s.step)` selector | WIRED | Line 12: `const step = useBillStore((s) => s.step)` — drives step-based conditional rendering. |
| `components/wizard/AddPeopleStep.tsx` | `stores/useBillStore.ts` | `addPerson` action call | WIRED | Line 21: `const addPerson = useBillStore((s) => s.addPerson)` — called in `handleAdd`. |
| `components/wizard/WizardShell.tsx` | `window.history` | `pushState` on step change | WIRED | Line 19: `window.history.pushState(null, '', \`#step-${step}\`)` in `useEffect([step])`. |
| `components/wizard/AddItemsStep.tsx` | `lib/billMath.ts` | `parseCents` on commit, `formatCents` on display | WIRED | Line 17: `import { parseCents, formatCents } from '@/lib/billMath'`. Both used in component logic. |
| `components/wizard/AddItemsStep.tsx` | `stores/useBillStore.ts` | `addItem`, `updateItem`, `removeItem`, `setStep` | WIRED | Lines 39-43: all four selectors present and called in handlers. |
| `components/wizard/AssignItemsStep.tsx` | `stores/useBillStore.ts` | `setAssignment` for chip toggles | WIRED | Line 14: `const setAssignment = useBillStore((s) => s.setAssignment)` — called in `toggleAssignment`. |
| `components/wizard/AssignItemsStep.tsx` | `lib/billMath.ts` | `formatCents` for shared-split display | WIRED | Line 7: `import { formatCents } from '@/lib/billMath'` — used at line 91 in "Split equally" display. |
| `components/wizard/SetTipStep.tsx` | `stores/useBillStore.ts` | `setTipPercent` + `setStep(5)` | WIRED | Lines 18, 21: both selectors present. `setTipPercent` called in preset handler and custom `onChange`. |
| `components/wizard/SetTipStep.tsx` | `lib/billMath.ts` | `computeSubtotalCents` + `computeTipCents` + `formatCents` | WIRED | Lines 8-10: all three imported. Lines 28-29: both compute calls drive the live tip display. |
| `components/wizard/ResultsStep.tsx` | `lib/billMath.ts` | `computePersonTotals` + `formatCents` | WIRED | Lines 11-15: all four math functions imported. Line 44: `computePersonTotals` called each render producing real per-person totals. |
| `components/wizard/ResultsStep.tsx` | `stores/useBillStore.ts` | `people`, `items`, `assignments`, `tipPercent` — read-only consumers | WIRED | Lines 35-39: four store selectors read real store state passed into `computePersonTotals`. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `ResultsStep.tsx` | `totals` (per-person cents map) | `computePersonTotals(people, items, assignments, tipPercent)` — four live store slices | Yes — pure function operating on actual Zustand state populated by user interactions through Steps 1-4 | FLOWING |
| `SetTipStep.tsx` | `tipCents` (live tip display) | `computeTipCents(computeSubtotalCents(items), tipPercent)` — both from live store | Yes — recomputed every render from actual items and tipPercent | FLOWING |
| `AssignItemsStep.tsx` | `assignedIds` per item | `assignments[item.id] ?? []` from Zustand store | Yes — populated by `setAssignment` calls via `toggleAssignment` | FLOWING |
| `AddItemsStep.tsx` | `items[]` | `useBillStore((s) => s.items)` | Yes — populated by `addItem`/`updateItem`/`removeItem` store actions | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 85 tests pass | `npm run test -- --run` | `Tests 85 passed (85)` — 0 failing | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Production build succeeds | `npm run build` | `✓ Compiled successfully`, static pages generated | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PEOPLE-01 | 01-01-PLAN.md | User can add people to the bill by name (no account required) | SATISFIED | `AddPeopleStep.tsx` fully functional. 6 passing tests. CTA gating enforced. |
| ITEMS-01 | 01-02-PLAN.md | User can manually enter items with prices | SATISFIED | `AddItemsStep.tsx` fully functional. 12 passing tests. Price validation covers empty, non-numeric, 3+ decimals. |
| ITEMS-02 | 01-02-PLAN.md | User can assign items to one or more people | SATISFIED | `AssignItemsStep.tsx` chip-tap toggle. 12 passing tests. Single-person assign verified. |
| ITEMS-03 | 01-02-PLAN.md | User can mark an item as shared and select which people shared it | SATISFIED | `AssignItemsStep.tsx` shared mode (≥2 assignees): `Shared` badge + "Split equally" display. 12 passing tests include shared-mode assertions. |
| TIP-01 | 01-03-PLAN.md | User can select tip percentage (15%, 18%, 20%, or custom) | SATISFIED | `SetTipStep.tsx` preset buttons + custom input. 12 passing tests including live amount update and navigation. |
| RESULTS-01 | 01-03-PLAN.md | App shows final breakdown of what each person owes | SATISFIED | `ResultsStep.tsx`: 28px amber totals, expandable cards, bottom strip. 11 passing tests including cents-conservation invariant. |

**Orphaned requirements check:** `ITEMS-04` is mapped to Phase 5 in REQUIREMENTS.md — correctly excluded from Phase 1. No orphaned requirements for this phase.

**Note:** REQUIREMENTS.md checkboxes for PEOPLE-01, ITEMS-01, ITEMS-02, ITEMS-03 still show `[ ]` (pending) and the traceability table shows "pending" for those four. The ROADMAP.md correctly marks all plans as `[x]` complete. The REQUIREMENTS.md is a documentation staleness issue only — it does not affect the implementation. TIP-01 and RESULTS-01 are correctly marked `[x]` and "Complete" in REQUIREMENTS.md.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/wizard/AddItemsStep.tsx` | 71 | `const nameVal = editState.name.trim() \|\| 'Item'` — falls back to generic "Item" if name left empty | Info | Cosmetic: user can leave name blank; stored as "Item". Not a stub — price validation gates commit. Low impact. |

No blocker anti-patterns found. No TODO/FIXME/placeholder comments remain in wizard components (the Plan 01 placeholder shells have been fully replaced).

---

### Human Verification Required

The following behaviors cannot be verified by grep/test alone:

#### 1. Mobile Camera + Touch Target Feel

**Test:** Open `http://localhost:3000` on a phone. Add two people, add two items, assign them (tap avatar chips), set tip to 20%, view results. Tap a result card to expand.
**Expected:** All touch targets feel >= 48px, avatar chips are 40px with 48px tap zone, expanded card shows item/tip breakdown. URL hash updates as steps change.
**Why human:** Touch target sizing, safe-area inset spacing, and physical feel cannot be verified programmatically.

#### 2. URL Hash Back-Button Navigation

**Test:** Walk through to Step 3. Press the browser back button.
**Expected:** Returns to Step 2 (hash changes from `#step-3` to `#step-2`, store step updates).
**Why human:** `hashchange` event requires real browser navigation — cannot fire in jsdom test environment.

#### 3. Dialog Accessibility on Mobile

**Test:** Add a person, tap the trash icon, interact with the confirmation dialog.
**Expected:** Dialog traps focus, "Remove" and "Cancel" buttons are reachable, dialog dismisses on Cancel and removes person on Remove.
**Why human:** @base-ui/react dialog portal rendering and focus-trap behavior require a real browser with accessibility tools to validate fully.

---

## Summary

**All 5 roadmap success criteria are VERIFIED.** All 6 phase requirements (PEOPLE-01, ITEMS-01, ITEMS-02, ITEMS-03, TIP-01, RESULTS-01) have implementation evidence and passing tests.

Key findings:
- 85 tests pass across 7 test files — 0 failures
- Production build (`npm run build`) succeeds with no type errors
- All 5 wizard steps are fully implemented — no placeholder content remains
- Integer-cents conservation invariant is proven by both unit test (billMath.test.ts Test 19) and ResultsStep component tests
- All key wiring links are active — store → components, components → billMath, billMath → UI display
- 3 human verification items remain for mobile UX validation (non-blocking; automated checks all pass)

The phase goal is achieved in the codebase.

---

_Verified: 2026-05-09T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
