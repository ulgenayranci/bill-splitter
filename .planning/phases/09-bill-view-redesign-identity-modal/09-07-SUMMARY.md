---
phase: 09-bill-view-redesign-identity-modal
plan: 07
subsystem: ui
tags: [next.js, zustand, react, routing, collaborative-flow]

requires:
  - phase: 09-bill-view-redesign-identity-modal plan 06
    provides: collaborative Bill View with identity modal, BillViewHeader, UnclaimedBanner

provides:
  - "lib/createSession.ts — shared POST /api/session helper used by SetupStep and ShareLinkButton"
  - "SetupStep Continue now creates a session and navigates to /split/[sessionId]"
  - "app/page.tsx no longer routes through AssignItemsStep/ResultsStep; resumes into /split when sessionId stored"

affects: [phase 10, UAT tests 2–6]

tech-stack:
  added: []
  patterns:
    - "Shared createSession() helper: all session-create logic lives in lib/createSession.ts; components call it, never inline-fetch /api/session"
    - "Resume redirect pattern: useEffect keyed on _hasHydrated+sessionId uses router.replace to re-enter the collaborative bill"

key-files:
  created:
    - lib/createSession.ts
  modified:
    - components/wizard/ShareLinkButton.tsx
    - components/wizard/SetupStep.tsx
    - app/page.tsx
    - __tests__/SetupStep.test.tsx

key-decisions:
  - "AssignItemsStep.tsx and ResultsStep.tsx kept dormant (not deleted): files remain on disk so their test suites continue to pass; only removed from app/page.tsx router"
  - "sessionId resume-redirect uses router.replace (not push) to prevent back-button loops between / and /split"
  - "Continue button label changed to 'Start splitting' to reflect the new flow (wizard Assign step retired)"
  - "SetupStep renders nothing (not SetupStep) while redirect is pending when sessionId is found — avoids Setup flash"

requirements-completed: [IDENT-01, IDENT-02, IDENT-03, IDENT-04, CLAIM-02, CLAIM-04, CLAIM-05, CLAIM-06]

duration: 25min
completed: 2026-06-08
---

# Phase 09 Plan 07: GAP-09-FLOW Unified Main Flow Summary

**Shared createSession() helper wires SetupStep Continue directly to /split/[sessionId], retiring the AssignItemsStep/ResultsStep wizard path from app/page.tsx**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-08T13:10:00Z
- **Completed:** 2026-06-08T13:14:00Z
- **Tasks:** 3 (Task 2 was TDD — RED + GREEN commits)
- **Files modified:** 5

## Accomplishments

- Created `lib/createSession.ts` as the single source of truth for POST /api/session — eliminates duplication between SetupStep and ShareLinkButton
- Rewired SetupStep's Continue button: async `handleContinue` calls `createSession()`, persists `sessionId`, then `router.push('/split/[sessionId]')`
- Removed `AssignItemsStep` and `ResultsStep` render branches from `app/page.tsx`; added a resume-redirect effect so reopening `/` with a stored `sessionId` sends the user back to their collaborative bill via `router.replace`
- Full test suite: 327 tests, 3 failures — exactly the pre-existing AddItemsStep/AddPeopleStep baseline (unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract createSession() helper + refactor ShareLinkButton** - `f07eed5` (feat)
2. **Task 2: Rewire SetupStep Continue — RED phase** - `dcdc8e4` (test)
3. **Task 2: Rewire SetupStep Continue — GREEN phase** - `9642708` (feat)
4. **Task 3: Retire AssignItemsStep/ResultsStep from app/page.tsx** - `e6895b5` (feat)

_Note: Task 2 was TDD (tdd="true") — separate RED (test) and GREEN (feat) commits._

## Files Created/Modified

- `lib/createSession.ts` — New shared helper: POSTs `/api/session` with `{people, items, currencyCode}` (no assignments), returns `{sessionId, guestUrl}`
- `components/wizard/ShareLinkButton.tsx` — Refactored `handleShare()` to call `createSession()` instead of inline fetch; all existing behavior preserved
- `components/wizard/SetupStep.tsx` — Replace `setStep(3)` with async `handleContinue`; add `useRouter`, `createSession`, `LoaderCircle`, `isCreating` state, inline session error; label changed to "Start splitting"
- `app/page.tsx` — Remove `AssignItemsStep`/`ResultsStep` imports and render branches; add `sessionId` resume-redirect via `useEffect` + `router.replace`
- `__tests__/SetupStep.test.tsx` — Added `next/navigation` + `createSession` mocks; new describe block asserting Continue → createSession → router.push, D-11 gate, error path; updated stale "Continue to Assign" label assertion

## Task 3 Decision: AssignItemsStep/ResultsStep — KEPT DORMANT (not deleted)

**Decision:** The component files `components/wizard/AssignItemsStep.tsx` and `components/wizard/ResultsStep.tsx` were **kept on disk** but removed only from the `app/page.tsx` router. They are not imported anywhere in the main application flow.

**Rationale:** Deleting the files would break the test suites `__tests__/AssignItemsStep.test.tsx` and `__tests__/ResultsStep.test.tsx`, which target the dormant components directly and currently pass. The plan explicitly instructs to avoid touching their existing tests in this gap plan.

**Remaining references to the dormant components:**

| File | Type | Reference |
|------|------|-----------|
| `components/wizard/AssignItemsStep.tsx` | Source file | The dormant component itself |
| `components/wizard/ResultsStep.tsx` | Source file | The dormant component itself |
| `__tests__/AssignItemsStep.test.tsx` | Test file | Imports and renders `AssignItemsStep` directly — all 28 tests pass |
| `__tests__/ResultsStep.test.tsx` | Test file | Imports and renders `ResultsStep` directly — all 7 tests pass |
| `vitest.setup.ts` | Config | Comment only: `// jsdom does not implement the Clipboard API. Phase 5 ResultsStep copy` |

None of these references are in the normal application render path. `app/page.tsx` no longer imports either component.

## Decisions Made

- **createSession() reads inputs at call site (not inside helper):** `people`, `items`, and `currencyCode` are read from `useBillStore.getState()` at the call site in the component and passed in as arguments. The helper itself is pure of React and Zustand — easier to test and reuse.
- **Resume redirect renders nothing during pending redirect:** `hasHydrated && !sessionId && <SetupStep />` means the page renders an empty `<WizardShell>` while the `router.replace` fires. This prevents a "Setup screen flash" before the redirect completes.
- **Button label "Start splitting":** Chosen as clear, action-oriented copy that doesn't reference the retired Assign wizard step.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The POST /api/session route is unchanged. The session-create logic was extracted (not added) — T-09-FLOW-01 mitigation (server-side validation) remains in place unchanged.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GAP-09-FLOW closed: the main scan → Continue flow now reaches the identity modal and collaborative Bill View
- UAT tests 2–6 are unblocked: the "Who are you?" modal opens automatically because the creator has no stored `personId` for the new session
- Phase 10 (Results Screen + Tip Modal + Currency Display) is unblocked
- The dormant AssignItemsStep/ResultsStep files and their tests are candidates for cleanup in a future phase

---
*Phase: 09-bill-view-redesign-identity-modal*
*Completed: 2026-06-08*
