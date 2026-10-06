---
phase: 08-flat-model-schema-api-surgery
plan: 05
subsystem: tests
tags: [vitest, typescript, flat-model, test-migration, session, claim, currency]

# Dependency graph
requires:
  - phase: 08-01
    provides: flat SessionPayload schema with currencyCode and no host symbols
  - phase: 08-02
    provides: /edit route + flat session create/get + host-free Lua claim scripts
  - phase: 08-03
    provides: ShareLinkButton/ClaimableItemCard/PersonSlotPicker updated (host fields removed)
  - phase: 08-04
    provides: CollaborativeClaimingView refactored flat with /edit + D-02 confirm
provides:
  - "7 obsolete host test files deleted"
  - "Route test fixtures flat (no hostToken/editRequests/disputes/hostPersonId)"
  - "currencyCode persistence + default + GET return asserted (D-04)"
  - "CollaborativeClaimingView replacement test green including Test 18 (You're all set)"
  - "Suite green modulo exactly 4 documented pre-existing failures (Success Criterion #6)"

affects:
  - "Phase 08 Success Criterion #6 fulfilled — CI green modulo documented pre-existing failures"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat baseSession fixture: { people, items, claims, tips, currencyCode, createdAt } — no host fields"
    - "ClaimEntry: { qty } only — no assignedBy in any test fixture"
    - "CollaborativeClaimingView test: delete confirm tested via vi.stubGlobal('confirm', ...) pattern"
    - "D-02 confirm message verified per-case: unclaimed vs claimed-by-N"

key-files:
  created: []
  modified:
    - __tests__/sessionRoute.test.ts
    - __tests__/sessionGetRoute.test.ts
    - __tests__/sessionClaimRoute.test.ts
    - __tests__/CollaborativeClaimingView.test.tsx
    - __tests__/PersonSlotPicker.test.tsx
    - __tests__/PersonResultsScreen.test.tsx
    - __tests__/ShareLinkButton.test.tsx
    - __tests__/ClaimableItemCard.test.tsx
  deleted:
    - __tests__/disputeRoute.test.ts
    - __tests__/editRequestRoute.test.ts
    - __tests__/resolveDisputeRoute.test.ts
    - __tests__/resolveEditRoute.test.ts
    - __tests__/HostPanel.test.tsx
    - __tests__/ReviewHostAssignedScreen.test.tsx
    - __tests__/EditRequestForm.test.tsx

key-decisions:
  - "CollaborativeClaimingView test rewritten from scratch (18 tests) rather than patched — the old test was deeply host-coupled and the component shape changed too much to patch in place"
  - "ClaimEntry assignedBy field removed from all test fixtures — flat ClaimEntry is { qty } only"
  - "PersonSlotPicker Test 2 preserved identically — the opacity-50 vs opacity-40 mismatch is a known pre-existing failure, not to be fixed here"
  - "CollaborativeClaimingView Test 18 (previously failing) now passes — the flat derivePhase/TipScreen/PersonResultsScreen flow works correctly"

requirements-completed: [CLAIM-01, CLAIM-03]

# Metrics
duration: ~8min
completed: 2026-06-05
---

# Phase 08 Plan 05: Test Suite Migration to Flat Model Summary

**Deleted 7 obsolete host-concept test files; updated all surviving route and component test fixtures to the flat schema; added currencyCode assertions (D-04); rewrote CollaborativeClaimingView tests for flat model; confirmed suite green modulo exactly the 4 documented pre-existing failures.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-05T21:30:00Z
- **Completed:** 2026-06-05T21:38:31Z
- **Tasks:** 2
- **Files modified:** 8 (modified) + 7 (deleted)

## Accomplishments

### Task 1: Delete obsolete test files + update route fixtures

- Deleted 7 obsolete test files whose routes/components were removed in Plans 02-03:
  `disputeRoute.test.ts`, `editRequestRoute.test.ts`, `resolveDisputeRoute.test.ts`,
  `resolveEditRoute.test.ts`, `HostPanel.test.tsx`, `ReviewHostAssignedScreen.test.tsx`,
  `EditRequestForm.test.tsx`
- `sessionRoute.test.ts`:
  - Flat fixture (no hostToken/editRequests/disputes)
  - Test 1-2: assert response is `{ sessionId }` only — no `hostToken` field
  - Test 3: payload assertions flip — no host fields, `currencyCode` must be present
  - Test 8 (NEW, D-04): POST body with `currencyCode:'EUR'` → persisted; missing → defaults to `'USD'`
- `sessionGetRoute.test.ts`:
  - Flat fixture with `currencyCode: 'USD'`
  - Test 1: asserts `currencyCode` returned + no host fields; removed old "hostToken stripped" assertion
- `sessionClaimRoute.test.ts`:
  - Flat fixture (no hostToken/editRequests/disputes)
  - Tests 8-10 (host-assigned `assignedBy:'host'`, `assignedBy:'admin'`) removed
  - Test 1 ARGV assertion updated: flat `[itemId, personId, qty]` — no assignedBy/hostToken positions

### Task 2: Update component/view fixtures + full suite verification

- `CollaborativeClaimingView.test.tsx`: Complete rewrite (18 tests for flat model):
  - SESSION_FIXTURE flat (no hostToken/editRequests/disputes/hostPersonId)
  - Tests for host badge/FAB/HostPanel/review — replaced with tests verifying those elements are ABSENT
  - `handleInlineSubmit` tests verify `/api/session/s1/edit` called, not `/edit-request`
  - D-02 delete confirm coverage: Test 13 (no-claims → "Delete X?"), Test 14 (2-claims → "2 people have claimed X"), Test 15 (cancel → no POST)
  - Test 18 ("You're all set") passes: flat `claiming → done → TipScreen → confirmTip → PersonResultsScreen` flow
- `PersonSlotPicker.test.tsx`: Removed hostToken/editRequests/disputes from `mockSession`; Test 2 opacity-50 failure preserved as-is (known pre-existing)
- `PersonResultsScreen.test.tsx`: Flat fixture; ClaimEntry uses `{ qty }` only
- `ShareLinkButton.test.tsx`:
  - Removed `setHostTokenMock` and assertion
  - Removed `#hostToken=` redirect assertion — Test 3 asserts `router.push('/split/s1')` (no fragment)
  - Test 2 asserts `body.currencyCode === 'EUR'` (D-04) and `body.hostToken === undefined`
  - Mock store includes `currencyCode: 'EUR'` and no `setHostToken`
- `ClaimableItemCard.test.tsx`: Removed Test 8 (host-assigned label + amber-200 border); all ClaimEntry fixtures use flat `{ qty }` only; renumbered Test 9 (overflow) to Test 8

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete obsolete host test files + flat route fixtures + currencyCode assertions** — `4e03f68` (chore)
2. **Task 2: Update component test fixtures to flat model + CollaborativeClaimingView rewrite** — `bf0f02d` (feat)

## Files Created/Modified

### Deleted
- `__tests__/disputeRoute.test.ts` — route deleted (Plan 02)
- `__tests__/editRequestRoute.test.ts` — route deleted (Plan 02)
- `__tests__/resolveDisputeRoute.test.ts` — route deleted (Plan 02)
- `__tests__/resolveEditRoute.test.ts` — route deleted (Plan 02)
- `__tests__/HostPanel.test.tsx` — component deleted (Plan 03)
- `__tests__/ReviewHostAssignedScreen.test.tsx` — component deleted (Plan 03)
- `__tests__/EditRequestForm.test.tsx` — component deleted (Plan 03)

### Modified
- `__tests__/sessionRoute.test.ts` — flat fixture, { sessionId } response, currencyCode D-04 test
- `__tests__/sessionGetRoute.test.ts` — flat fixture, currencyCode returned assertion
- `__tests__/sessionClaimRoute.test.ts` — flat fixture, host-assigned tests removed
- `__tests__/CollaborativeClaimingView.test.tsx` — complete rewrite for flat model (18 tests)
- `__tests__/PersonSlotPicker.test.tsx` — flat fixture
- `__tests__/PersonResultsScreen.test.tsx` — flat fixture, flat ClaimEntry
- `__tests__/ShareLinkButton.test.tsx` — flat model, currencyCode assertion, no hostToken
- `__tests__/ClaimableItemCard.test.tsx` — flat ClaimEntry, host-assigned test removed

## Suite Results

```
Test Files  3 failed | 22 passed (25)
Tests       4 failed | 250 passed (254)
```

The 4 failing tests are exactly the 4 documented pre-existing failures:
1. `PersonSlotPicker.test.tsx` Test 2: `opacity-50` class not found (component uses `opacity-40`)
2. `AddPeopleStep.test.tsx` "disables CTA when no people added": button text mismatch
3. `AddPeopleStep.test.tsx` "enables CTA after adding a person": button text mismatch
4. `AddItemsStep.test.tsx` "tapping Continue with ≥1 item calls setStep(3)": setStep(2) vs expected 3

No new failures introduced. CollaborativeClaimingView is green (was previously failing — now fixed).

## Decisions Made

- CollaborativeClaimingView test fully rewritten rather than patched. The old test was deeply coupled to the host model (4 explicit host fixtures, 8 host-only tests). A clean rewrite for the flat model was clearer and safer than patching.
- `window.confirm` stubbed via `vi.stubGlobal('confirm', vi.fn().mockReturnValue(true/false))` — standard vitest approach for D-02 delete confirm testing.
- Test 18 fix: the previous failure was because `handleDone` previously had a host-items branch; the flat component always sets phase='tip' on done, so the "You're all set" path now works straight through without any special fixture setup.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

No new security-relevant surface introduced. This plan only modifies test files.

---

## Self-Check: PASSED

- `__tests__/sessionRoute.test.ts` exists and contains `currencyCode`: FOUND
- `__tests__/sessionGetRoute.test.ts` exists and contains `currencyCode`: FOUND
- `__tests__/disputeRoute.test.ts` does not exist: CONFIRMED DELETED
- `__tests__/HostPanel.test.tsx` does not exist: CONFIRMED DELETED
- `__tests__/EditRequestForm.test.tsx` does not exist: CONFIRMED DELETED
- `npx vitest run` — 4 failures == exactly the 4 documented pre-existing failures: CONFIRMED
- `CollaborativeClaimingView.test.tsx` Test 18 passes: CONFIRMED
- No host concepts (hostToken/editRequests/disputes/hostPersonId) in actual fixture code: CONFIRMED
- Commit `4e03f68` exists: VERIFIED
- Commit `bf0f02d` exists: VERIFIED

---
*Phase: 08-flat-model-schema-api-surgery*
*Completed: 2026-06-05*
