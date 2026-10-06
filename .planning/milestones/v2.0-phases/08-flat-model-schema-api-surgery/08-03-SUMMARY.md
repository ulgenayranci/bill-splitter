---
phase: 08-flat-model-schema-api-surgery
plan: 03
subsystem: client
tags: [typescript, zustand, react, components, store, shareable-link]

# Dependency graph
requires:
  - phase: 08-01
    provides: flat SessionPayload schema, ClaimEntry collapsed to { qty }
  - phase: 08-02
    provides: POST /api/session returns { sessionId } only, currencyCode in body

provides:
  - "Host-free useBillStore (no hostToken field, setHostToken action, or partialize entry)"
  - "currencyCode in ShareLinkButton POST body (D-04), fragment-free redirect (T-08-09)"
  - "HostPanel, ReviewHostAssignedScreen, EditRequestForm components deleted"
  - "ClaimableItemCard host-assignment UI removed (no isHostAssigned, no 'Assigned by host' label)"
  - "PersonSlotPicker PublicSessionPayload import resolves via alias"

affects:
  - 08-04 (test migration — test files for deleted components will be cleaned up)
  - 08-05 (CollaborativeClaimingView — still imports deleted components, host logic remaining)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "currencyCode data flow: OCR → Zustand store → POST /api/session body (D-04)"
    - "Fragment-free redirect: all participants get /split/${sessionId} with no host secret in URL"
    - "PublicSessionPayload = SessionPayload alias zero-break: PersonSlotPicker import unchanged"

key-files:
  created: []
  modified:
    - stores/useBillStore.ts
    - components/wizard/ShareLinkButton.tsx
    - components/split/ClaimableItemCard.tsx
  deleted:
    - components/split/HostPanel.tsx
    - components/split/ReviewHostAssignedScreen.tsx
    - components/split/EditRequestForm.tsx

key-decisions:
  - "PersonSlotPicker import left as PublicSessionPayload — alias resolves, no change needed (Pitfall 2)"
  - "Only source files modified in this plan are verified clean for TypeScript; pre-existing test-file errors (HostPanel.test.tsx, disputeRoute.test.ts, etc.) are out-of-scope for Plan 03 and will be cleaned in Plans 04/05"

# Metrics
duration: ~5min
completed: 2026-06-05
---

# Phase 08 Plan 03: Component Surgery Summary

**Stripped hostToken from the Zustand store, deleted the three host-only components, wired currencyCode into the session-create body, and removed the host-fragment URL redirect — every participant now shares one secret-free link.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-05T21:22:02Z
- **Completed:** 2026-06-05T21:27:00Z
- **Tasks:** 3
- **Files:** 3 modified, 3 deleted

## Accomplishments

- `stores/useBillStore.ts`: removed `hostToken: string | null` from BillState interface, `hostToken: null` from INITIAL_STATE, `setHostToken` action, and `hostToken: s.hostToken` from partialize. `currencyCode` field and action untouched.
- Deleted `components/split/HostPanel.tsx`, `components/split/ReviewHostAssignedScreen.tsx`, `components/split/EditRequestForm.tsx` — all three were purely host-workflow components with no shared functionality.
- `components/wizard/ShareLinkButton.tsx`: reads `currencyCode` from store alongside people/items/assignments (D-04); includes `currencyCode` in POST body; removed `hostToken` from `PendingSession` interface and `res.json()` destructure (Pitfall 6); removed `setHostToken` selector; `router.push` now targets `/split/${sessionId}` with no `#hostToken=` fragment (Pitfall 3 / T-08-09).
- `components/split/ClaimableItemCard.tsx`: removed `const isHostAssigned = myEntry?.assignedBy === 'host'` line; removed "Assigned by host" label block; removed `isHostAssigned ? 'border-amber-200' : ''` branch from `cardClasses`. `ClaimEntry` import retained — prop type still uses `Record<PersonId, ClaimEntry>` with the flat `{ qty }` shape.
- `components/split/PersonSlotPicker.tsx`: no changes needed — `PublicSessionPayload` import resolves via Plan 01 alias.

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip hostToken from store and delete three host components** — `f5e027a` (refactor)
2. **Task 2: Wire currencyCode into ShareLinkButton and remove host redirect** — `fa31309` (feat)
3. **Task 3: Remove host-assignment UI from ClaimableItemCard** — `b2e073c` (refactor)

## Files Created/Modified

- `stores/useBillStore.ts` — Host-free store: no hostToken field/action/partialize entry
- `components/wizard/ShareLinkButton.tsx` — currencyCode in POST body, fragment-free redirect
- `components/split/ClaimableItemCard.tsx` — No host-assignment label or border branch

## Decisions Made

- `PersonSlotPicker` import left as `PublicSessionPayload` — the alias added in Plan 01 makes this a zero-change path; switching to `SessionPayload` would be purely cosmetic and risks a phantom consumer (Pitfall 2).
- TypeScript errors in *test files* for deleted components (HostPanel.test.tsx, EditRequestForm.test.tsx, etc.) and deleted routes (disputeRoute.test.ts, etc.) are expected residuals — not in scope for Plan 03. The plan's verify instruction explicitly limits the tsc gate to source files touched here.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The TypeScript cascade from Plans 01/02 surfaced expected errors in test files and `CollaborativeClaimingView.tsx` (which still imports deleted components) — both are Plan 04/05 responsibility as documented in the plan.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04 (test migration): test files for deleted routes and deleted components will fail — delete/replace them
- Plan 05 (CollaborativeClaimingView refactor): component still imports deleted HostPanel/ReviewHostAssignedScreen and uses removed host fields — the main refactor task

## Known Stubs

None — all changes are removals or wiring of existing data. No placeholder values introduced.

## Threat Flags

No new security-relevant surface introduced. Changes strictly reduce attack surface:
- T-08-09: `#hostToken=` fragment removed from redirect URL — host capability token no longer travels in URL/history (CLAIM-01 satisfied)
- T-08-10: currencyCode now flows client → server; server validates `/^[A-Z]{3}$/` and defaults USD (Plan 02 T-08-08 — accepted as-is)

---

## Self-Check: PASSED

- `stores/useBillStore.ts` exists and has no hostToken: CONFIRMED
- `components/wizard/ShareLinkButton.tsx` contains currencyCode and no hostToken: CONFIRMED
- `components/split/ClaimableItemCard.tsx` has no isHostAssigned/assignedBy/Assigned-by-host: CONFIRMED
- `components/split/HostPanel.tsx` does not exist: CONFIRMED
- `components/split/ReviewHostAssignedScreen.tsx` does not exist: CONFIRMED
- `components/split/EditRequestForm.tsx` does not exist: CONFIRMED
- `npx tsc --noEmit` reports no errors in ClaimableItemCard or PersonSlotPicker source: CONFIRMED
- Commit `f5e027a` exists: VERIFIED
- Commit `fa31309` exists: VERIFIED
- Commit `b2e073c` exists: VERIFIED

---
*Phase: 08-flat-model-schema-api-surgery*
*Completed: 2026-06-05*
