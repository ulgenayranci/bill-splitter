---
status: diagnosed
phase: 09-bill-view-redesign-identity-modal
source: [09-VERIFICATION.md]
started: 2026-06-07T00:30:00Z
updated: 2026-06-08T12:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. First-load modal blocking
expected: Opening a shared bill link with no stored identity shows the "Who are you?" modal; Escape, backdrop tap, and swipe do NOT dismiss it until a name is picked
result: issue
reported: "even incognito window the modal does not show up (no stored identity, brand-new session)"
severity: blocker

### 2. Identity persistence across reload
expected: After picking a name, closing and reopening the tab does NOT re-prompt — you land straight in the bill view as yourself
result: issue
reported: "cannot be credited — the only 'straight to items' observation was a bill claimed under the OLD pre-Phase-9 flow; the new identity gate (Test 1) never appears, so persistence of a NEW claim is untested"
severity: blocker

### 3. Near-real-time attribution across devices
expected: When Device A taps an item, Device B sees A's claim chip appear on that item within ~3 seconds
result: blocked
blocked_by: prior-gap
reason: "Unreachable until the main flow routes into the collaborative /split bill view (see Gap GAP-09-FLOW)."

### 4. "I'm not listed" round-trip
expected: Tapping "I'm not listed", entering a name, and tapping "Add me" creates the person, closes the modal, and you proceed as that new person; the new name appears on other devices
result: blocked
blocked_by: prior-gap
reason: "Unreachable until the identity modal appears in the main flow (see Gap GAP-09-FLOW)."

### 5. Change-identity close button
expected: Tapping the people strip reopens the "Who are you?" modal WITH a visible close (X) button; closing it keeps your current identity
result: blocked
blocked_by: prior-gap
reason: "Unreachable until the collaborative bill view is the main assign surface (see Gap GAP-09-FLOW)."

### 6. Warn-but-allow done flow
expected: Tapping "I'm done" with unclaimed items opens a styled dialog (not a browser confirm) showing the unclaimed count, a "Share bill link" button, "Continue anyway" (proceeds to tip/results), and "Go back" (returns to claiming)
result: blocked
blocked_by: prior-gap
reason: "Unreachable until the collaborative bill view is the main assign surface (see Gap GAP-09-FLOW)."

## Summary

total: 6
passed: 0
issues: 2
pending: 0
skipped: 0
blocked: 4

## Gaps

- id: GAP-09-FLOW
  truth: "Every participant, including the bill creator on their own device, reaches the new collaborative Bill View through: scan + add names → 'Who are you?' identity modal → assign items on the collaborative bill view."
  status: failed
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
