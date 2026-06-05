---
status: complete
phase: 07-app-shell-setup-screen
source: [07-04-SUMMARY.md]
round: 2
note: "Re-verification of the 7 gap closures from plan 07-04 (round 1 archived as 07-UAT-round1.md)"
started: 2026-06-05T18:07:48Z
updated: 2026-06-05T18:13:30Z
---

## Current Test

[testing complete]

## Tests

### 1. Progress Strip Now Visible (GAP 1)
expected: Under the header on the Setup screen, a thin 3-segment progress strip is visibly rendered (was invisible in round 1). First segment amber/filled, other two grey. Stays visible across screens.
result: pass

### 2. Camera AND Photo Library Capture (GAP 2)
expected: Tapping the "Scan your receipt" hero tile now opens the OS picker offering BOTH the live camera AND your photo library (previously camera-only). You can pick an already-taken photo of a bill without being forced to re-shoot it.
result: pass

### 3. Setup Layout Polish — Spacing, Count Chip, Cleaner Copy (GAPs 3, 4, 5)
expected: |
  On the Setup screen: (a) there is noticeably more vertical breathing room
  between the scan hero tile and the "Who's involved in the split?" section;
  (b) a small count chip sits at the end of the "Who's involved in the split?"
  heading showing the number of people added, updating as you add/remove people;
  (c) the "Add people now or after scanning." helper line is gone, and the
  Continue button reads "Continue to Assign" with no trailing arrow.
result: issue
reported: "a - ok. b - move chip to the end of the line, right constrained. c - ok. d - button label ok but the placement should be bottom constrained."
severity: cosmetic
note: "All three round-1 gaps confirmed closed (extra spacing present, chip exists & bound to people.length, helper text removed, arrow removed). Two NEW placement refinements requested: (1) right-align the count chip to the far end of the heading row; (2) anchor the Continue button to the bottom of the screen."

### 4. Failed Re-Scan Recovery — Stale Count Cleared + Inline Error (GAPs 6, 7)
expected: |
  Scan a readable receipt first (you get the thumbnail + "N items found" badge).
  Then Retake and feed it a blank/unreadable photo. Now: (a) the "N items found"
  badge disappears (no stale count) and Continue re-disables; (b) the failure
  message appears inline right near the scan tile — where you're looking — not as
  a toast pinned to the bottom of the screen.
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The people count chip is right-constrained to the far end of the 'Who's involved in the split?' heading row (pushed to the right edge), not sitting immediately after the heading text"
  status: failed
  reason: "User reported during Test 3 (round 2): chip exists but should move to the end of the line, right-constrained"
  severity: cosmetic
  test: 3
  root_cause: ""     # Filled by diagnosis
  artifacts:
    - path: "components/wizard/SetupStep.tsx"
      issue: "count chip renders inline right after the heading label instead of being pushed to the right edge of the heading row"
  missing:
    - "Right-align the people-count-chip to the far end of the heading row (e.g. justify-between on the heading flex row, or ml-auto on the chip)"
  debug_session: ""

- truth: "The 'Continue to Assign' button is bottom-constrained — anchored to the bottom of the Setup screen rather than sitting directly below the people section"
  status: failed
  reason: "User reported during Test 3 (round 2): button label is fine but its placement should be bottom constrained"
  severity: cosmetic
  test: 3
  root_cause: ""     # Filled by diagnosis
  artifacts:
    - path: "components/wizard/SetupStep.tsx"
      issue: "Continue button flows inline after the people section instead of being anchored to the bottom of the screen"
  missing:
    - "Anchor the Continue button to the bottom of the Setup viewport (e.g. mt-auto in a min-h-screen/flex-col column, or a sticky bottom container) while preserving the existing disabled-gating logic"
  debug_session: ""
