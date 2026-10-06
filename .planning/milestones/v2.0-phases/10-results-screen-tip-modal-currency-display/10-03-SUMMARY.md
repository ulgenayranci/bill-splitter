---
phase: 10-results-screen-tip-modal-currency-display
plan: "03"
subsystem: components/split
tags: [results-screen, accordion, currency, copy-summary, tdd]
dependency_graph:
  requires: [10-01-formatCents-currency-aware, 10-02-update_currency-op-in-edit-route]
  provides: [PersonResultsScreen-all-people-accordion, copy-summary, currency-override-ui]
  affects:
    - components/split/PersonResultsScreen.tsx
    - __tests__/PersonResultsScreen.test.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
tech_stack:
  added: []
  patterns:
    - single-expand accordion (local React state, no Radix Accordion)
    - clipboard + execCommand fallback (BillViewHeader pattern)
    - fixed bottom CTA bar (TipScreen pattern)
    - New Split confirm Dialog (AppHeader pattern)
    - inline currency select calling onCurrencyChange prop
key_files:
  created: []
  modified:
    - components/split/PersonResultsScreen.tsx
    - __tests__/PersonResultsScreen.test.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
decisions:
  - "Current user's card always shows expanded content (isCurrentUser || expandedId === id) — prevents accidental collapse when another card is tapped"
  - "onCurrencyChange is a required prop delegated to parent — PersonResultsScreen does not fetch directly (parent owns SWR mutate)"
  - "CollaborativeClaimingView passes handleBackToClaiming for onEditBill to preserve done:false server round-trip"
  - "onAddTip wired as no-op in CollaborativeClaimingView results branch — Plan 04 will replace with Dialog open state"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-08"
  tasks: 3
  files: 3
---

# Phase 10 Plan 03: All-People Results Screen Summary

**One-liner:** `PersonResultsScreen` rewritten as an all-participants accordion with single-expand state, items-only grand total (D-03), fixed CTA bar (Copy summary / Edit bill / New Split), and inline currency override calling `onCurrencyChange` prop — all amounts threaded through `formatCents(cents, currencyCode)`.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add failing all-people accordion Results tests (RED) | 415abb9 | `__tests__/PersonResultsScreen.test.tsx` |
| 2+3 | Build accordion + grand total + CTA bar + currency override (GREEN) | 004831f | `components/split/PersonResultsScreen.tsx` |
| fix | Update CollaborativeClaimingView to new PersonResultsScreen interface | f53efe9 | `app/split/[sessionId]/CollaborativeClaimingView.tsx` |

---

## What Was Built

### `components/split/PersonResultsScreen.tsx` (full rewrite)

**New props interface:**
```typescript
export interface PersonResultsScreenProps {
  session: PublicSessionPayload
  personId: PersonId            // current user — always expanded
  currencyCode: string          // from session.currencyCode ?? 'USD'
  onAddTip: () => void          // opens Tip Dialog in parent (Plan 04 wires this)
  onEditBill: () => void        // parent calls handleBackToClaiming (done:false)
  onCurrencyChange: (code: string) => Promise<void>
  sessionId: string             // for localStorage clear on New Split
}
```

**Accordion behavior:**
- `useState<string | null>(personId)` for `expandedId`
- Current user: `isExpanded = isCurrentUser || expandedId === person.id` (always expanded)
- Other people: single-expand, tap toggles `expandedId`
- Each card has `aria-expanded` and `aria-label="{name}'s breakdown"`

**Per-person cards:**
- Current user: line items + `results-tip` (Your tip row) + `results-total` (items + tip, amber-600 28px)
- Other people: header shows item-share only (no tip row, D-04/D-05); expand shows their line items
- Empty person: "Nothing claimed yet"

**Grand total row:** `computeSubtotalCents(session.items)` — items only, never tips (D-03), `data-testid="results-grand-total"`

**Fixed bottom CTA bar:**
- Copy summary: `navigator.clipboard.writeText` + `execCommand` fallback; 2s "Copied!" feedback; `aria-label` swaps to "Summary copied"
- Edit bill: invokes `onEditBill`
- New Split: confirm Dialog → `localStorage.removeItem(split:${sessionId}:personId)` → `router.push('/')` (Redis session NOT deleted)

**Inline currency override:** `<select>` with 9 common currencies + session code if not in list; onChange calls `onCurrencyChange(newCode)` — no direct fetch

**Add a tip? button:** calls `onAddTip`

### `__tests__/PersonResultsScreen.test.tsx`

Updated render helper passes all new props; removed `onBack`. Added Tests 6-13:
- Test 6: both names visible
- Test 7: Bob's card expands on tap
- Test 8: Bob's expanded card has no results-tip element; Alice's does
- Test 9: grand total = $16.00 (items only, tips excluded)
- Test 10: Copy summary writes "Alice owes", "Bob owes", "Total:" to clipboard
- Test 11: Copy feedback shows "Copied!" (aria-label swap)
- Test 12: Edit bill calls onEditBill
- Test 13: EUR currencyCode shows € in grand total

Total: 13 tests, all green.

### `app/split/[sessionId]/CollaborativeClaimingView.tsx` (Rule 3 fix)

Updated results phase branch to pass the new interface:
- `currencyCode={session.currencyCode ?? 'USD'}`
- `onEditBill={() => void handleBackToClaiming()}`
- `onCurrencyChange` posts `update_currency` to `/edit` then `mutate()`
- `onAddTip` as no-op (Plan 04 will replace with `setTipDialogOpen(true)`)

---

## TDD Gate Compliance

- RED gate: commit `415abb9` — `test(10-03): add failing all-people accordion Results tests (RED)` — 8 tests failing against old single-person component
- GREEN gate: commit `004831f` — `feat(10-03): build all-people accordion Results screen (GREEN)` — all 13 tests passing
- REFACTOR: not needed — implementation was clean first pass

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript TS2322: CollaborativeClaimingView.tsx still passed onBack to PersonResultsScreen**
- **Found during:** Task 2/3 GREEN — `npx tsc --noEmit` returned error TS2322
- **Issue:** `CollaborativeClaimingView.tsx` line 553 used `onBack={() => setPhase('tip')}` which no longer exists in the new `PersonResultsScreenProps` interface
- **Fix:** Replaced the results phase branch in `CollaborativeClaimingView.tsx` with the full new prop set (`currencyCode`, `onEditBill`, `onCurrencyChange`, `sessionId`, `onAddTip`)
- **Files modified:** `app/split/[sessionId]/CollaborativeClaimingView.tsx`
- **Commit:** f53efe9

**2. [Rule 1 - Bug] Current user's card collapsed when another card was tapped**
- **Found during:** Task 2/3 GREEN — Test 8 failed because `isExpanded = expandedId === person.id` would set expandedId to Bob's id, hiding Alice's (current user) expanded content
- **Issue:** The accordion `handleCardTap` correctly returned early for the current user (preventing manual collapse), but `isExpanded` was purely computed from `expandedId`. When Bob's card was tapped, `expandedId` became Bob's id, and Alice's content was no longer rendered.
- **Fix:** Changed `isExpanded = expandedId === person.id` to `isExpanded = isCurrentUser || expandedId === person.id` — current user is always expanded regardless of accordion state
- **Files modified:** `components/split/PersonResultsScreen.tsx`
- **Commit:** 004831f (inline with GREEN implementation)

---

## Verification Results

```
npx vitest run __tests__/PersonResultsScreen.test.tsx  → 13/13 PASS
npx tsc --noEmit                                       → Exit 0 (no errors)
grep -c computeSubtotalCents PersonResultsScreen.tsx   → 2 (≥1 required)
grep -c "Copy summary" PersonResultsScreen.tsx         → 4 (≥1 required)
```

---

## Known Stubs

**`onAddTip` in CollaborativeClaimingView:** Currently wired as a no-op (`() => {}`). Plan 04 will replace this with `() => setTipDialogOpen(true)` when the Tip Dialog is mounted in the parent. The Results screen itself is complete; the tip entry point is functional but the Dialog it opens is not yet mounted. This is intentional per the plan sequencing.

---

## Threat Flags

None — all new surface was already in the plan's `<threat_model>` (T-10-06, T-10-07, T-10-08 mitigated as designed):
- Copy summary text assembled as plain string, written via clipboard API / textarea value — never rendered as HTML
- New Split removes only `split:${sessionId}:personId` from localStorage, not the Redis session
- Currency override delegates to the `/edit` `update_currency` op (Plan 02) whose server-side validation is the authoritative guard

---

## Self-Check: PASSED

- `components/split/PersonResultsScreen.tsx` exists and contains `computeSubtotalCents` (≥1)
- `components/split/PersonResultsScreen.tsx` exists and contains `Copy summary` (≥1)
- `__tests__/PersonResultsScreen.test.tsx` exists and contains `Copy summary`
- Commit `415abb9` (RED) exists in git log
- Commit `004831f` (GREEN) exists in git log
- Commit `f53efe9` (CollaborativeClaimingView fix) exists in git log
