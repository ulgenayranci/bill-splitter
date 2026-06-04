---
phase: 06-collaborative-bill-claiming
plan: 06
subsystem: ui
tags: [react, typescript, vitest, lucide-react, swr, zustand, next-navigation]

# Dependency graph
requires:
  - phase: 06-collaborative-bill-claiming
    provides: CollaborativeClaimingView, HostPanel, EditRequestForm (Plans 01-05)
provides:
  - ReviewHostAssignedScreen (per-item Accept/Dispute with pending dispute state)
  - TipScreen (per-person tip entry with presets + custom input)
  - PersonResultsScreen (final per-person breakdown via computePersonShareFromClaims)
  - ShareLinkButton redirecting host to /split/[id]?hostToken=...
  - CollaborativeClaimingView with full Review→Tip→Results phase machine
  - WizardShell reduced to 4 steps (Tip step removed, D-17)
  - ResultsStep cleaned of HostWaitingScreen/syncStatus/tipPercent
affects: [full Phase 6 E2E flow]

# Tech tracking
tech-stack:
  added:
    - "useRouter from next/navigation (ShareLinkButton redirect)"
  patterns:
    - "Phase state machine: 'claiming' | 'review' | 'tip' | 'results' in CollaborativeClaimingView"
    - "hasHostAssignedItems() helper reads from SWR session to decide post-done routing"
    - "TipScreen uses integer cents storage via Math.round(subtotal * percent / 100)"
    - "ReviewHostAssignedScreen computes proportional share locally (avoids circular dep)"
    - "0-tip is valid: Confirm tip enabled with tipCents=0 by default (D-07)"

key-files:
  created:
    - components/split/ReviewHostAssignedScreen.tsx
    - components/split/TipScreen.tsx
    - components/split/PersonResultsScreen.tsx
    - __tests__/ReviewHostAssignedScreen.test.tsx
    - __tests__/TipScreen.test.tsx
    - __tests__/PersonResultsScreen.test.tsx
  modified:
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - __tests__/CollaborativeClaimingView.test.tsx
    - components/wizard/ShareLinkButton.tsx
    - __tests__/ShareLinkButton.test.tsx
    - components/wizard/WizardShell.tsx
    - components/wizard/ResultsStep.tsx
    - app/page.tsx
    - __tests__/ResultsStep.test.tsx
    - __tests__/WizardShell.test.tsx
    - __tests__/useBillStore.test.ts
  deleted:
    - components/split/GuestDoneScreen.tsx
    - __tests__/GuestDoneScreen.test.tsx
    - components/wizard/SetTipStep.tsx
    - __tests__/SetTipStep.test.tsx
    - components/wizard/HostWaitingScreen.tsx
    - __tests__/HostWaitingScreen.test.tsx

key-decisions:
  - "Tip stored as integer cents from percent presets via Math.round(subtotal * percent / 100) — integer-safe"
  - "0-tip is valid: Confirm button enabled with tipCents=0 by default (D-07 intent)"
  - "ResultsStep retains offline-split path (computePersonTotals with tipPercent=0) for users who skip Share"
  - "hasHostAssignedItems() reads from SWR session state (not stale local copy) to determine post-done routing"
  - "Back from Tip with host-assigned items returns to Review (local phase change, no /done POST)"
  - "Back from Tip without host items OR back from Review calls handleBackToClaiming (POSTs undone:true)"
  - "ReviewHostAssignedScreen computes per-row share locally (same formula as computePersonShareFromClaims) to avoid circular dep"

patterns-established:
  - "Pattern: Phase state machine in CollaborativeClaimingView: 'claiming' → 'review'|'tip' → 'results'"
  - "Pattern: Dispute pending state via local pendingDisputeByItem Map; cleared by useEffect watching session.disputes"
  - "Pattern: Accept row is purely local UI; 'Accept all and continue' is the actual commit boundary"

requirements-completed:
  - RESULTS-02

# Metrics
duration: 618s
completed: 2026-05-27
---

# Phase 06 Plan 06: Post-Done Flow (Review→Tip→Results) + Wizard Cleanup Summary

**Three new split-page screens (ReviewHostAssigned / Tip / PersonResults), CollaborativeClaimingView full phase machine, ShareLinkButton host redirect, wizard reduced to 4 steps — 52 tests passing, Phase 6 full E2E flow complete**

## Performance

- **Duration:** 618s (~10 min)
- **Started:** 2026-05-27T16:40:37Z
- **Completed:** 2026-05-27T16:50:55Z
- **Tasks:** 4
- **Files created:** 6
- **Files modified:** 10
- **Files deleted:** 6

## Accomplishments

### Task 1: Three New Screens + GuestDoneScreen Deletion
- **ReviewHostAssignedScreen**: Renders only host-assigned claims for current person. Per-item Accept (local state) + Dispute (POSTs /dispute, shows pending spinner). "Accept all and continue" CTA transitions to TipScreen. "Back to claiming" calls onBack. Dispute fetch failure shows inline error.
- **TipScreen**: Per-person tip entry starting at $0.00 (D-07). Preset buttons (10/15/20%) + custom percent input with real-time tip display. Total preview = subtotal + tip. "Confirm tip" POSTs /tip then calls onTipConfirmed. Zero-tip valid.
- **PersonResultsScreen**: Final per-person breakdown using `computePersonShareFromClaims` (proportional share, no tax per D-06). Avatar + total in amber-600. Line items list + tip line + total.
- **GuestDoneScreen + test deleted** — replaced by PersonResultsScreen

### Task 2: CollaborativeClaimingView Phase Machine
- Replaced `done-placeholder` phase with `'claiming' | 'review' | 'tip' | 'results'` type
- `handleDone` routes to 'review' when `hasHostAssigned`, else 'tip'
- `handleBackToClaiming`: POSTs undone:true to /done, flips to 'claiming'
- `handleBackFromTip`: returns to 'review' if host items exist, else `handleBackToClaiming`
- Updated Tests 6+7 (placeholder → new semantics), added Tests 15-19

### Task 3: ShareLinkButton Host Redirect
- Removed `setSyncStatus('waiting')` and `setStep(5)` entirely
- Added `useRouter` from `next/navigation`; `router.push('/split/${sessionId}?hostToken=${hostToken}')`
- Added `setHostToken` call after session creation (D-02)
- Removed `tipPercent` from POST body (per D-07: tip is per-person, set after claiming)
- Rewrote ShareLinkButton tests with Phase 6 mock pattern

### Task 4: Wizard to 4 Steps
- WizardShell: STEP_LABELS = ['Add People', 'Add Items', 'Assign / Share', 'Results'] (4 entries); hash regex `/#step-([1-4])/`
- app/page.tsx: drop SetTipStep + `step === 5`; only 4 conditional renders
- ResultsStep: remove HostWaitingScreen import + syncStatus + tipPercent; pass `0` to computePersonTotals; back button → setStep(3) "Back to assign"; added ShareLinkButton
- Delete: SetTipStep.tsx + test, HostWaitingScreen.tsx + test
- Fix useBillStore.test.ts: remove setTipPercent/tipPercent refs, fix setSyncStatus('waiting') tests
- Update WizardShell test: assert 4 segments

## Task Commits

Each task was committed atomically:

1. **Task 1: ReviewHostAssignedScreen + TipScreen + PersonResultsScreen** — `5bfd066`
2. **Task 2: CollaborativeClaimingView Phase Machine** — `0532812`
3. **Task 3: ShareLinkButton host redirect** — `5ca6e60`
4. **Task 4: Wizard 4 steps cleanup** — `3e071af`

## Final Test Counts

| Test File | Tests | Status |
|-----------|-------|--------|
| ReviewHostAssignedScreen.test.tsx | 7 | ✓ |
| TipScreen.test.tsx | 8 | ✓ |
| PersonResultsScreen.test.tsx | 5 | ✓ |
| CollaborativeClaimingView.test.tsx | 19 | ✓ |
| ShareLinkButton.test.tsx | 6 | ✓ |
| ResultsStep.test.tsx | 7 | ✓ |
| **Plan 06 Total** | **52** | **all pass** |

## Decisions Made

- **Tip stored as cents via Math.round**: All tip arithmetic uses `Math.round(subtotal * percent / 100)` — integer-safe, no float drift.
- **0-tip is valid**: Confirm tip button is enabled with tipCents=0. Per D-07, tip is per-person and optional.
- **ResultsStep retains offline path**: The wizard's Results step still shows `computePersonTotals(people, items, assignments, 0)` for users who don't use the Share flow. tipPercent=0 is passed explicitly.
- **hasHostAssignedItems() reads SWR session**: The routing decision in handleDone checks the live SWR session, not stale local state. If host assigns between tapping "I'm done" and the SWR poll, the person may see Review on second try.
- **Back from Tip → Review is local-only**: No /done POST when navigating Tip→Review. The user remains "done" from the server's perspective — they just haven't confirmed their tip yet.
- **ReviewHostAssignedScreen share formula**: Per-row share computed locally as `round(item.priceCents * claim.qty / totalQty)` — same formula as `computePersonShareFromClaims` but per-row for display purposes. Avoids importing the util which would create a minor circular dep concern.

## Deviations from Plan

None — all 4 tasks executed exactly as specified. The plan anticipated all edge cases (vi.mock hoisting issue with setSessionIdMock required a factory function pattern instead of direct mock reference, but this is standard vitest behavior, not a plan error).

## Resolved Transient Issues

Both issues mentioned in the Plan 06 objective are resolved:
1. **Plan 04 done-placeholder stub**: Replaced with full Review→Tip→Results state machine
2. **Plan 01 TypeScript transient errors** (setTipPercent removed from store, downstream callers broken): All callers updated — ShareLinkButton, ResultsStep, useBillStore tests

## Phase 6 Final State

All Phase 6 components are now wired end-to-end:

| Layer | Components | Status |
|-------|-----------|--------|
| Server routes | POST /api/session, /claim, /done, /dispute, /tip, /edit-request, GET /api/session, POST /resolve-edit, /resolve-dispute | ✓ Plans 01-03 |
| Split page | CollaborativeClaimingView (full state machine), PersonSlotPicker, ClaimableItemCard, HostPanel (3-tab), EditRequestForm (4-type), ReviewHostAssignedScreen, TipScreen, PersonResultsScreen | ✓ Plans 04-06 |
| Wizard | AddPeopleStep, AddItemsStep, AssignItemsStep, ResultsStep (with ShareLinkButton) | ✓ Plans 01+06 |
| Utility/Store | useBillStore (4-step, hostToken, no tipPercent), billMath.ts (computePersonShareFromClaims), sessionSchema.ts | ✓ Plan 01 |

**E2E flow shippable:** Host fills wizard → taps Share → redirected to /split/[id]?hostToken=xxx → picks identity slot → sees host FAB → manages edit requests/disputes via HostPanel → taps I'm done → sees Review (if host-assigned items) → TipScreen (per-person tip, 0 valid) → PersonResultsScreen (final share). Guests follow the same path minus the host FAB.

## Known Stubs

None — all critical data paths are wired.

## Threat Surface Scan

No new security-relevant surfaces introduced beyond what was already in the plan's `<threat_model>`. All T-06-06-xx threats are mitigated as specified.

---
*Phase: 06-collaborative-bill-claiming*
*Completed: 2026-05-27*

## Self-Check: PASSED

- components/split/ReviewHostAssignedScreen.tsx: FOUND
- components/split/TipScreen.tsx: FOUND
- components/split/PersonResultsScreen.tsx: FOUND
- .planning/phases/06-collaborative-bill-claiming/06-06-SUMMARY.md: FOUND
- Commit 5bfd066 (Task 1): FOUND
- Commit 0532812 (Task 2): FOUND
- Commit 5ca6e60 (Task 3): FOUND
- Commit 3e071af (Task 4): FOUND
- All 52 Plan 06 tests: PASSED
