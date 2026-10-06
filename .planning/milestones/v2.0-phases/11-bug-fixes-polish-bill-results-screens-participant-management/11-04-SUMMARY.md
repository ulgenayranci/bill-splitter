---
phase: 11-bug-fixes-polish-bill-results-screens-participant-management
plan: "04"
subsystem: participant-management-ui
tags: [participant-management, identity-modal, person-slot-picker, self-removal, swr]
dependency_graph:
  requires: [11-01, 11-02]
  provides: [remove-person-ui, rename-person-ui, self-removal-effect, onCurrencyChange-cleanup]
  affects:
    - components/split/PersonSlotPicker.tsx
    - components/split/IdentityModal.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - __tests__/PersonSlotPicker.test.tsx
    - __tests__/CollaborativeClaimingView.test.tsx
tech_stack:
  added: []
  patterns: [optional-prop-threading, useEffect-swr-poll-watcher, advisory-confirm-pattern, soft-404-success, stopPropagation-icon-buttons]
key_files:
  created: []
  modified:
    - components/split/PersonSlotPicker.tsx
    - components/split/IdentityModal.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - __tests__/PersonSlotPicker.test.tsx
    - __tests__/CollaborativeClaimingView.test.tsx
decisions:
  - "Self-removal useEffect has no restoreAttempted gate so it fires on every SWR poll after identity is set"
  - "handleRemovePerson treats 404 person_not_found as soft success (Pitfall 5 — desired end-state already achieved)"
  - "Advisory window.confirm for remove-with-claims (D-06 do NOT block); removal always proceeds on confirm"
  - "Deleted orphaned handleCurrencyChange function (11-02 dropped the prop from PersonResultsScreen; only comment + function remained)"
  - "Test 32 uses rerender + act to simulate SWR poll tick; avoids selectAlice() helper to get rerender reference"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-09"
  tasks_completed: 2
  files_modified: 5
---

# Phase 11 Plan 04: Participant Management UI (remove/rename affordances + self-removal) Summary

**One-liner:** Per-card Pencil/X affordances in PersonSlotPicker wire to remove_person/rename_person ops via CollaborativeClaimingView handlers, with a SWR-poll useEffect that re-opens the identity modal instead of showing SessionExpiredScreen when the viewer's own personId is removed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add remove/rename affordances to PersonSlotPicker and thread props through IdentityModal | c73902c | components/split/PersonSlotPicker.tsx, components/split/IdentityModal.tsx, __tests__/PersonSlotPicker.test.tsx |
| 2 | Wire handleRemovePerson/handleRenamePerson + self-removal effect in CollaborativeClaimingView; remove onCurrencyChange pass-through | 99b57ab | app/split/[sessionId]/CollaborativeClaimingView.tsx, __tests__/CollaborativeClaimingView.test.tsx |

## What Was Built

### PersonSlotPicker.tsx — remove/rename affordances
Extended `PersonSlotPickerProps` with two optional callbacks: `onRemovePerson?(personId)` and `onRenamePerson?(personId, newName)`. When provided:
- Each person card renders a Pencil icon button (aria-label: "Rename {name}") and an X icon button (aria-label: "Remove {name}"), both with `min-h-[44px] min-w-[44px]` touch targets.
- Both icon buttons call `e.stopPropagation()` so tapping them does NOT trigger the card's `onSelect`.
- Tapping Pencil switches the card to an inline rename form: `Input` pre-filled with the current name + Save/Cancel buttons (mirroring the "I'm not listed" add form pattern).
- Save calls `onRenamePerson(personId, trimmedName)` and clears `editingPersonId`. Empty/whitespace names are rejected.
- Tapping X calls `onRemovePerson(personId)` directly.
- A `useEffect` guards Pitfall 4: if `editingPersonId` is set but the person leaves `session.people` (concurrent removal by another client), it resets `editingPersonId` to null.

### IdentityModal.tsx — prop threading
Extended `IdentityModalProps` with `onRemovePerson?` and `onRenamePerson?`, both forwarded to `<PersonSlotPicker>`. No other changes.

### CollaborativeClaimingView.tsx — handlers + self-removal effect

**handleRemovePerson:** Mirrors `handleAddPerson` try/catch skeleton. Optionally shows a `window.confirm` advisory when the person has existing claims (D-06: advisory only, never blocks). Treats 404 `person_not_found` as soft success (Pitfall 5). Always calls `await mutate()`. Does NOT set selectedPersonId — the self-removal useEffect handles that.

**handleRenamePerson:** Same try/catch skeleton. Calls `/edit` with `{ op: 'rename_person', personId, newName }`, then `await mutate()`.

**Self-removal useEffect:** Added directly after the identity-restore useEffect. No `restoreAttempted.current` gate (must fire on every SWR poll after identity is set). On each poll: if `selectedPersonId` is set but no longer in `session.people`, clears `selectedPersonId`, removes the localStorage key, sets `changingIdentity(false)`, and opens the identity modal. This means the viewer is re-prompted with "Who are you?" rather than reaching `SessionExpiredScreen`.

**onCurrencyChange cleanup (Pitfall 7):** Deleted the orphaned `handleCurrencyChange` function and its JSDoc comment — 11-02 already removed `onCurrencyChange` from `PersonResultsScreen`'s props, leaving `handleCurrencyChange` unreferenced.

**IdentityModal threading:** Both new props threaded into both `<IdentityModal>` render sites (null-identity branch and change-identity branch in the claiming view).

### Tests

**PersonSlotPicker.test.tsx (7 new tests, Tests 10-16):**
- Test 10: rename and remove affordances present when callbacks passed (getByLabelText)
- Test 11: affordances absent when callbacks not passed
- Test 12: tapping rename reveals inline input pre-filled with person name + Save/Cancel
- Test 13: confirming rename calls onRenamePerson with personId and trimmed name
- Test 14: confirming rename with empty/whitespace name does NOT call onRenamePerson
- Test 15: tapping remove calls onRemovePerson with personId
- Test 16: clicking rename or remove does NOT trigger onSelect (stopPropagation)

**CollaborativeClaimingView.test.tsx (1 new test, Test 32):**
- Test 32: when viewer's personId removed from session (SWR poll tick via rerender + act), "Who are you?" modal re-opens and SessionExpiredScreen is NOT shown

## Deviations from Plan

### Auto-fixed Issues

None.

### Structural Adjustments

**1. Test 32 uses rerender + act (not useSWRMock direct)**
- **Found during:** Task 2 test implementation
- **Issue:** Changing `useSWRMock.mockReturnValue` alone does not cause React to re-render in jsdom. The component must be re-rendered to pick up the new SWR data (simulating a real poll tick).
- **Fix:** Test 32 calls `render(...)` directly (not via `selectAlice()`) to obtain the `rerender` reference, then uses `rerender(<CollaborativeClaimingView />)` wrapped in `act(async () => {...})` to simulate the SWR poll.
- **No impact** on production code — test-only change.

## Known Stubs

None — both handlers call real API routes; all data flows are wired end-to-end.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-rendering | components/split/PersonSlotPicker.tsx | Rename input value is rendered as a React text node (JSX escape); no dangerouslySetInnerHTML — T-11-09 mitigated |

## Self-Check: PASSED

- [x] `components/split/PersonSlotPicker.tsx` contains `onRemovePerson` and `onRenamePerson`
- [x] `components/split/IdentityModal.tsx` contains `onRemovePerson` and `onRenamePerson`
- [x] `app/split/[sessionId]/CollaborativeClaimingView.tsx` contains `handleRemovePerson` and `handleRenamePerson`
- [x] `onCurrencyChange` count in CollaborativeClaimingView = 0
- [x] Commits c73902c and 99b57ab exist in git log
- [x] `npx tsc --noEmit` exits 0
- [x] `npx vitest run __tests__/PersonSlotPicker.test.tsx` → 16 passed
- [x] `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` → 33 passed
- [x] Full suite: 3 pre-existing failures only (AddPeopleStep x2, AddItemsStep x1) — no new failures
