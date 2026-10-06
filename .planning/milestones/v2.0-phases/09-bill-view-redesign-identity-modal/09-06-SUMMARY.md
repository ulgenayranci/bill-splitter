---
phase: 09-bill-view-redesign-identity-modal
plan: 06
subsystem: ui
tags: [react, typescript, swr, vitest, orchestrator, identity-modal, share, warn-but-allow]

# Dependency graph
requires:
  - phase: 09-01
    provides: share claim action (SHARE_CLAIM_SCRIPT) + computeEqualShareCents
  - phase: 09-02
    provides: /edit op add_person (atomic Lua, server-generated personId)
  - phase: 09-03
    provides: IdentityModal + modal-ready PersonSlotPicker with onAddPerson
  - phase: 09-04
    provides: BillViewHeader + UnclaimedBanner presentational chrome
  - phase: 09-05
    provides: ClaimableItemCard onShareChange prop + 3-chip attribution
provides:
  - "Fully flat collaborative Bill View: identity modal orchestration, live attribution, tap-to-join"
  - "Warn-but-allow done flow (D-09) with share-link CTA (D-11); blocking waiting screen removed (D-12)"
  - "Phase machine flattened to 'claiming' | 'tip' | 'results'"

affects:
  - "Phase 10 (Results Screen) builds on the flattened phase machine — results always reachable"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Identity modal trigger effect: restore from localStorage only when server personSlots confirms the slot; otherwise open the Who-are-you modal"
    - "handleShareChange mirrors handleQtyChange: optimistic SWR mutate + rollbackOnError, POST action:'share'"
    - "Warn-but-allow Dialog: showCloseButton=false, primary 'Continue anyway' runs the original done path, secondary 'Go back' dismisses"
    - "scrollToFirstUnclaimed: li id=`item-${id}` + scrollIntoView({behavior:'smooth'}) (D-10)"

key-files:
  created: []
  modified:
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - __tests__/CollaborativeClaimingView.test.tsx
  deleted:
    - components/split/WaitingForClaimsScreen.tsx

key-decisions:
  - "handleAddPerson awaits mutate() BEFORE setSelectedPersonId so the new person exists in local session data — prevents a SessionExpiredScreen flash between identity adoption and revalidation"
  - "Warning-dialog share CTA implemented inline (navigator.share → clipboard fallback) instead of reusing ShareLinkButton — that component creates a NEW session (wizard semantics), which would be wrong inside an existing bill"
  - "onShareChange passed only to single-qty cards; multi-qty cards keep the stepper/qty path (D-14)"
  - "Old 'Hi, {name}' sticky header replaced by BillViewHeader — the people strip is now the identity affordance (D-03)"

requirements-completed: [IDENT-01, IDENT-02, IDENT-03, IDENT-04, CLAIM-02, CLAIM-04, CLAIM-05, CLAIM-06]

# Metrics
duration: ~35min
completed: 2026-06-07
---

# Phase 09 Plan 06: Bill View Orchestrator Rewire Summary

**CollaborativeClaimingView assembled into the Phase 9 surface: Who-are-you identity modal (auto-show / restore / change / I'm-not-listed), BillViewHeader + UnclaimedBanner mounted, tap-to-join share handler, warn-but-allow done dialog, and the blocking waiting screen deleted.**

## What Was Built

### Task 1 — Identity orchestration + share handler + phase flatten
- `Phase` union flattened to `'claiming' | 'tip' | 'results'` — `'waiting'` removed; `derivePhase` returns `'results'` whenever a tip exists (no allItemsFullyClaimed gate); `onTipConfirmed` always advances to results (D-12)
- `WaitingForClaimsScreen` import, render branch, and component file deleted; waiting auto-advance effect removed
- Identity modal trigger effect: on session load with no selection, restores `split:{sessionId}:personId` from localStorage only if `personSlots[stored] === true` on the server (T-09-14 spoof guard); otherwise opens IdentityModal (IDENT-01/02)
- localStorage persist effect preserved (IDENT-04); `if (!session) return Loading` guard preserved (Pitfall 5)
- `handleSelect` claims the slot then closes the modal; old-name claims stay put on change-identity (D-04)
- `handleAddPerson(name)`: POST `/edit { op:'add_person', name }` → mutate → adopt returned personId → localStorage → close modal (IDENT-03)
- `handleShareChange(itemId, joining)`: optimistic mutate + rollbackOnError POSTing `{ personId, itemId, action:'share', joining }` (CLAIM-02 / D-13); same error-retry copy as qty path
- Full-page PersonSlotPicker gate replaced by IdentityModal overlay; modal also mounted in the claiming view for change-identity (allowClose=true via `changingIdentity`)

### Task 2 — Chrome mount + warn-but-allow done
- `BillViewHeader` mounted above the list; people-strip tap reopens the modal dismissibly (D-03/IDENT-03); header share icon = CLAIM-06
- `UnclaimedBanner` mounted under the header; tap scrolls to the first unclaimed item via `scrollIntoView` (CLAIM-05 / D-10)
- Single-qty cards get `onShareChange`; multi-qty cards stay on the stepper (D-14)
- `handleDone` refactored: unclaimed > 0 → warning Dialog (`showCloseButton=false`) with heading "{N} items still unclaimed", body copy per UI-SPEC, inline share-link CTA (D-11), amber "Continue anyway" running the original done path (D-12), and outline "Go back" (D-09); zero unclaimed → direct submit

## Verification

- `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` → 31/31 (13 were RED before implementation)
- Full suite: 312 passed, 3 failed — exactly the documented pre-existing wizard failures (AddItemsStep, AddPeopleStep); no new failures
- `npx tsc --noEmit` → clean
- Acceptance greps: WaitingForClaimsScreen 0 refs + file deleted; flattened union present; `add_person`, `action: 'share'`, `showUnclaimedWarning`, "Continue anyway", "Go back", BillViewHeader, UnclaimedBanner all present

## Deviations from Plan

- **Executed inline by the orchestrator** (not a subagent): executor agents were repeatedly denied Write/Edit permission in waves 1–2, so the final plan ran inline per the workflow's sequential fallback. TDD discipline preserved (RED commit → GREEN commit → docs).
- **ShareLinkButton not reused in the warning dialog**: it creates a new session (wizard semantics). An inline share button with identical link semantics was used instead — same deviation Plan 04 made for the header.
- **Test queries scoped with `within(dialog)`**: banner copy ("2 of 2 items still unclaimed") substring-matches the dialog heading regex, so dialog assertions were scoped to `role="dialog"` to avoid ambiguous matches.

## Self-Check: PASSED
