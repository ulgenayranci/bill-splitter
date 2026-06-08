---
status: partial
phase: 09-bill-view-redesign-identity-modal
source: [09-VERIFICATION.md]
started: 2026-06-07T00:30:00Z
updated: 2026-06-08T13:45:00Z
---

## Current Test

[testing complete — all 7 tests passed; 1 new design gap raised (GAP-09-NOLOCK) routed to gap closure]

## Tests

### 0. Full create-flow reaches the identity modal (GAP-09-FLOW regression check)
expected: On your own device, scan a bill + add ≥2 names → tap Continue → you land on /split/[sessionId] and the "Who are you?" modal appears immediately (no "Share link" tap needed). Re-opening / after creating a session resumes you back into /split/[sessionId].
result: pass
verified: 2026-06-08 — user confirmed on live Vercel app; GAP-09-FLOW closed in production conditions.

### 1. First-load modal blocking
expected: Opening a shared bill link with no stored identity shows the "Who are you?" modal; Escape, backdrop tap, and swipe do NOT dismiss it until a name is picked
result: pass
verified: 2026-06-08 — user confirmed the modal blocks dismissal until a name is picked. (Previously 'issue' — root cause was GAP-09-FLOW, now closed by 09-07.)

### 2. Identity persistence across reload
expected: After picking a name, closing and reopening the tab does NOT re-prompt — you land straight in the bill view as yourself
result: pass
verified: 2026-06-08 — user confirmed reload lands straight in the bill view as the same person, no re-prompt. (IDENT-04 localStorage restore confirmed in real browser.)

### 3. Near-real-time attribution across devices
expected: When Device A taps an item, Device B sees A's claim chip appear on that item within ~3 seconds
result: pass
verified: 2026-06-08 — user confirmed across two devices: Device A's claim chip appears on Device B within the SWR poll cycle, no reload. (CLAIM-04 confirmed against live Redis.)

### 4. "I'm not listed" round-trip
expected: Tapping "I'm not listed", entering a name, and tapping "Add me" creates the person, closes the modal, and you proceed as that new person; the new name appears on other devices
result: pass
verified: 2026-06-08 — user confirmed: "Add me" creates the new person, closes the modal, proceeds as that person, and the name propagates to other devices. (IDENT-03 round-trip confirmed against live /edit add_person + Redis.)

### 5. Change-identity close button
expected: Tapping the people strip reopens the "Who are you?" modal WITH a visible close (X) button; closing it keeps your current identity
result: pass
verified: 2026-06-08 — user confirmed the modal reopens with a working close (X) button and closing keeps current identity.
remark: "User raised a NEW design change while testing this — names should NOT be locked/greyed-out at all (no host role). Logged as gap GAP-09-NOLOCK below. Does not fail this test."

### 6. Warn-but-allow done flow
expected: Tapping "I'm done" with unclaimed items opens a styled dialog (not a browser confirm) showing the unclaimed count, a "Share bill link" button, "Continue anyway" (proceeds to tip/results), and "Go back" (returns to claiming)
result: pass
verified: 2026-06-08 — user confirmed the styled warning dialog shows unclaimed count + Share bill link + Continue anyway + Go back, and behaves correctly. (CLAIM-05/06 confirmed.)

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0
open_gaps: 1  # GAP-09-NOLOCK (new design change raised during Test 5)

## Gaps

- id: GAP-09-FLOW
  truth: "Every participant, including the bill creator on their own device, reaches the new collaborative Bill View through: scan + add names → 'Who are you?' identity modal → assign items on the collaborative bill view."
  status: resolved
  resolved_by: 09-07
  resolved_at: 2026-06-08T13:20:00Z
  resolution: |
    Closed by gap-closure plan 09-07 (commits f07eed5..bc70acd, merged d5f1312). SetupStep
    'Continue' now calls the shared createSession() helper and router.push(`/split/[sessionId]`);
    app/page.tsx no longer renders AssignItemsStep/ResultsStep and resume-redirects to /split when
    a sessionId is stored. Verifier confirmed 19/19 must-haves at the code level (09-VERIFICATION.md).
    The 7 UAT items remain pending human re-test in real browser + live Redis (item 0 is the
    production regression check for this gap).
  severity: blocker
  test: 1
  reason: |
    Phase 9 built the identity modal, attribution chips, share/warn flow, and the collaborative
    Bill View correctly — but ONLY on the shared `/split/[sessionId]` route, reachable solely by
    tapping "Share link". The main create flow (app/page.tsx) still routes
    SetupStep → AssignItemsStep (the old grey-chip local wizard from Phase 7's D-12 "stopgap
    bridge") → ResultsStep. Phase 9's CONTEXT states this phase was meant to REPLACE that
    Assign-flow bridge, but the rewiring was never done. Result: in normal single-device use the
    user never sees the "Who are you?" modal or the new bill view.
  decision: "Unify the main flow on the collaborative bill view; retire the old AssignItemsStep wizard from the normal path (user-confirmed 2026-06-08)."
  artifacts:
    - app/page.tsx
    - components/wizard/SetupStep.tsx
    - components/wizard/ShareLinkButton.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - app/api/session/route.ts
  missing:
    - "SetupStep 'Continue' creates the session (POST /api/session with people+items+currencyCode, empty claims) and navigates to /split/[sessionId] instead of advancing to local wizard step 3."
    - "app/page.tsx no longer routes the normal flow through AssignItemsStep/ResultsStep (retire as main path; the collaborative view owns assign → done → tip → results)."
    - "Identity modal + collaborative bill view become the creator's assign surface (already built; just needs to be the destination)."
    - "Share-link affordance remains available from the bill view header (already built) for inviting others."

- id: GAP-09-NOLOCK
  truth: "Because there is no host role in the flat collaborative model, every name in the 'Who are you?' identity modal is always re-selectable by anyone — names are NEVER locked or greyed-out, even if another device is currently active as that name. Two devices may be the same person at once; both stay active and both edit that person's share/claims."
  status: failed
  severity: major
  test: 5
  reported: |
    User (product owner) during Test 5/6: "all the names should be re-selectable since we removed
    the host role. Someone still can assign all the names just by changing the current active person
    name, so do not lock the names. In case someone selects a name who is active on another device,
    just keep them all actively editing that name's share."
  reason: |
    Current behavior greys-out / locks names that are already taken or active on another device
    (originally decision D-01: "taken names greyed out", and the server personSlot-lock model that
    backs it). The product owner is OVERRIDING D-01: the host concept is gone, so name selection must
    be unconstrained. Selecting an already-active name must NOT be blocked — concurrent same-identity
    editing is allowed (both sessions act as that person and edit the same share).
  decision: "Remove name-locking entirely from the identity modal and its server-side personSlot lock. Any name is always selectable; concurrent same-name sessions co-edit that person's share. (user-confirmed 2026-06-08, overrides D-01.)"
  artifacts:
    - components/split/IdentityModal.tsx
    - components/split/PersonSlotPicker.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - app/api/session/[sessionId]/claim/route.ts
  missing:
    - "Identity modal renders every name as selectable (no disabled/greyed state for taken/active names)."
    - "Selecting a name already active on another device succeeds and does NOT block; both sessions remain active as that person."
    - "Server personSlot locking that previously rejected/claimed exclusive ownership of a name is removed or made non-exclusive so concurrent same-name selection co-edits the same share."
    - "Identity restore logic no longer drops/forces the modal because a slot is 'locked' elsewhere."
