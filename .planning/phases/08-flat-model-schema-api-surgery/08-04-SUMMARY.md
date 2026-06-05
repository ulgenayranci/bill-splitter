---
phase: 08-flat-model-schema-api-surgery
plan: 04
subsystem: client
tags: [typescript, react, next.js, swr, flat-model, claim, edit]

# Dependency graph
requires:
  - phase: 08-01
    provides: flat SessionPayload schema (no host fields)
  - phase: 08-02
    provides: POST /api/session/[id]/edit route with op-discriminated body
  - phase: 08-03
    provides: HostPanel/ReviewHostAssignedScreen/EditRequestForm deleted; hostToken stripped from store

provides:
  - "Host-free CollaborativeClaimingView wired to /edit route (CLAIM-01, CLAIM-03)"
  - "D-02 client-side delete confirm naming claimant count when >0"
  - "Simplified phase machine: claiming → tip → results/waiting (no review branch)"

affects:
  - 08-05 (test migration — CollaborativeClaimingView.test.tsx fixtures need updating for flat model)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "window.confirm for D-02 delete guard (client-side UI guard, not server-enforced)"
    - "handleDeleteItem: claimantCount = Object.keys(session.claims?.items?.[itemId] ?? {}).length"
    - "handleDone: always setPhase('tip') — no host-branch detection"
    - "derivePhase: donePeople → 'tip', tips → 'results' (no review branch)"

key-files:
  created: []
  modified:
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
  deleted: []

key-decisions:
  - "Both tasks (host deletion + /edit rewire) committed in a single atomic pass — they operate on the same file and the combined change is the minimal correct state"
  - "Delete button (X icon) added to each item row as the UI trigger for handleDeleteItem + confirm gate"
  - "Optimistic claim uses flat ClaimEntry { qty } (no assignedBy field) matching Plan 01 schema"

# Metrics
duration: ~3min
completed: 2026-06-06
---

# Phase 08 Plan 04: CollaborativeClaimingView Flat Model Refactor Summary

**Deleted all host state, memos, and UI from CollaborativeClaimingView; rewired add/edit/remove to the new /edit route; added D-02 client-side delete confirmation that names the claimant count; simplified the phase machine to donePeople → tip → results.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-05T21:26:55Z
- **Completed:** 2026-06-06T21:30:00Z
- **Tasks:** 2 (executed in one combined pass)
- **Files:** 1 modified

## Accomplishments

- `app/split/[sessionId]/CollaborativeClaimingView.tsx`:
  - Removed `hostTokenParam` state + hash-reading useEffect
  - Removed host auto-restore useEffect (was checking `session.hostPersonId`)
  - Removed `isHost` memo
  - Removed `pendingCount` memo (referenced `session.editRequests` and `session.disputes`)
  - Removed `hostPanelOpen` state
  - Removed HostPanel render block and HostPanel import
  - Removed ReviewHostAssignedScreen render block + `phase === 'review'` branch + import
  - Removed EditRequestForm import
  - Removed `hasHostAssignedItems()` and `hasUnacceptedHostItems()` helper functions
  - Removed host-badge `<span data-testid="host-badge">` from header
  - Removed host FAB `<button data-testid="host-panel-fab">` + pending badge
  - Removed "Pending approval" and pending-edit-request UI blocks from item list
  - Removed host branch from handleDone (`hasHostAssigned` detection gone — always → 'tip')
  - Removed `handleBackFromTip()` review-branch logic; onBack from TipScreen now calls `handleBackToClaiming` directly
  - Simplified `derivePhase()`: `donePeople → 'tip'`, `tips confirmed → 'results'` (no review branch)
  - Rewired all add/edit fetches from `/edit-request` to `/edit` with op-discriminated bodies: `op: 'add'`, `op: 'edit_name'`, `op: 'edit_price'`, `op: 'edit_quantity'`
  - Added `handleDeleteItem()` with D-02 `window.confirm`: derives `claimantCount` from `Object.keys(session.claims?.items?.[itemId] ?? {}).length`; when >0 shows "N people have claimed X — delete anyway?"; when 0 shows "Delete X?"; only POSTs `{ op: 'remove', itemId }` on confirmation
  - Added delete button (X icon) next to each item row
  - Changed `PublicSessionPayload` import to `SessionPayload` (host-omit alias removed in Plan 01)
  - Removed `ClipboardList`, `Clock` imports (no longer used); kept `X`, `Plus`, `Check`, `Pencil`
  - Optimistic claim updated to flat `ClaimEntry { qty }` (no `assignedBy` field)

## Task Commits

Both tasks committed in a single atomic pass (both operate on the same file):

1. **Task 1 + Task 2 combined: CollaborativeClaimingView flat model + /edit route + D-02** — `3d06b06` (refactor)

## Files Created/Modified

- `app/split/[sessionId]/CollaborativeClaimingView.tsx` — Host-free, wired to /edit, D-02 delete confirm, simplified phase machine

## Decisions Made

- Tasks 1 and 2 were written together in a single file write since they operate on the same file — committing the combined minimal-correct state is cleaner than an intermediate state that would have TypeScript import errors (referencing deleted components while also removing host state).
- `handleBackFromTip` removed; TipScreen `onBack` now calls `handleBackToClaiming` directly — the review-branch logic in `handleBackFromTip` was the only reason it existed.

## Deviations from Plan

None — plan executed exactly as written. Both tasks applied to the same file in a combined pass; the plan's two-task structure was for clarity, not for requiring two separate commits.

## Issues Encountered

None. TypeScript in the source file is clean. All test failures are pre-existing residuals from Plans 01-03 (deleted host routes, deleted components, host fixture fields in test files) — Plan 05 will clean those.

## User Setup Required

None.

## Next Phase Readiness

- Plan 05 (test migration): CollaborativeClaimingView.test.tsx needs fixture updates (remove hostPersonId/editRequests/assignedBy) and host-specific tests removed; host route test files need deletion; claim route test fixtures need flat-model ClaimEntry

## Known Stubs

None — all changes are removals and rewiring of existing behavior. No placeholder values introduced.

## Threat Flags

No new security-relevant surface introduced. Changes strictly reduce attack surface:
- T-08-13: host badge, HostPanel, pending-approval blocks all removed — no host-capability UI leaks to participants
- T-08-11: D-02 delete confirm implemented — every delete is confirm-gated; claimant count surfaces stakes

---

## Self-Check: PASSED

- `app/split/[sessionId]/CollaborativeClaimingView.tsx` exists: FOUND
- No host patterns (hostToken/hostPersonId/isHost/HostPanel/ReviewHostAssignedScreen/EditRequestForm/editRequests/disputes/Pending approval/review): CONFIRMED
- `/api/session/${sessionId}/edit` referenced in file: CONFIRMED
- No `/edit-request` reference: CONFIRMED
- `window.confirm` before `op: 'remove'`: CONFIRMED
- `claimantCount = Object.keys(session.claims?.items?.[itemId] ?? {}).length`: CONFIRMED
- `npx tsc --noEmit` clean for CollaborativeClaimingView.tsx source: CONFIRMED
- Commit `3d06b06` exists: VERIFIED

---
*Phase: 08-flat-model-schema-api-surgery*
*Completed: 2026-06-06*
