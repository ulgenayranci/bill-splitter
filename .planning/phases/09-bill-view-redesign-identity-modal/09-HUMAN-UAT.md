---
status: partial
phase: 09-bill-view-redesign-identity-modal
source: [09-VERIFICATION.md]
started: 2026-06-07T00:30:00Z
updated: 2026-06-08T13:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 0. Full create-flow reaches the identity modal (GAP-09-FLOW regression check)
expected: On your own device, scan a bill + add ≥2 names → tap Continue → you land on /split/[sessionId] and the "Who are you?" modal appears immediately (no "Share link" tap needed). Re-opening / after creating a session resumes you back into /split/[sessionId].
result: pending
note: "Unblocked by gap-closure plan 09-07 (code verified 19/19 must-haves). Run this FIRST — it confirms GAP-09-FLOW is closed in real browser + live Redis conditions."

### 1. First-load modal blocking
expected: Opening a shared bill link with no stored identity shows the "Who are you?" modal; Escape, backdrop tap, and swipe do NOT dismiss it until a name is picked
result: pending
note: "Previously 'issue' (modal never showed) — root cause was GAP-09-FLOW, now closed by 09-07. Re-test."

### 2. Identity persistence across reload
expected: After picking a name, closing and reopening the tab does NOT re-prompt — you land straight in the bill view as yourself
result: pending
note: "Previously 'issue' — untestable until the new identity gate appeared (GAP-09-FLOW). Now reachable; re-test with a NEW Phase-9 session."

### 3. Near-real-time attribution across devices
expected: When Device A taps an item, Device B sees A's claim chip appear on that item within ~3 seconds
result: pending
note: "Unblocked by GAP-09-FLOW closure (09-07)."

### 4. "I'm not listed" round-trip
expected: Tapping "I'm not listed", entering a name, and tapping "Add me" creates the person, closes the modal, and you proceed as that new person; the new name appears on other devices
result: pending
note: "Unblocked by GAP-09-FLOW closure (09-07)."

### 5. Change-identity close button
expected: Tapping the people strip reopens the "Who are you?" modal WITH a visible close (X) button; closing it keeps your current identity
result: pending
note: "Unblocked by GAP-09-FLOW closure (09-07)."

### 6. Warn-but-allow done flow
expected: Tapping "I'm done" with unclaimed items opens a styled dialog (not a browser confirm) showing the unclaimed count, a "Share bill link" button, "Continue anyway" (proceeds to tip/results), and "Go back" (returns to claiming)
result: pending
note: "Unblocked by GAP-09-FLOW closure (09-07)."

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

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
