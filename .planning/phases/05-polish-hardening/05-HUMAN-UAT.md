---
status: partial
phase: 05-polish-hardening
source: [05-VERIFICATION.md]
started: 2026-05-14T08:52:00.000Z
updated: 2026-05-14T08:52:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. iOS safe-area inset
expected: On a notched iPhone in Safari, `env(safe-area-inset-bottom)` is non-zero — sticky footers clear the home indicator
result: [pending]

### 2. Camera guidance text appearance
expected: Below the "Scan bill" button, the text "Allow camera access if prompted." is visible in gray (text-zinc-500)
result: [pending]

### 3. Copy summary end-to-end
expected: Tapping "Copy summary" on ResultsStep writes one-line-per-person totals + Total line to clipboard; button shows "Copied!" for ~2s then reverts
result: [pending]

### 4. Unassigned-item dialog full flow
expected: Tapping "See results" with unassigned items shows the dialog listing item names; "Go back" closes without navigating; "Continue anyway" proceeds to step 5
result: [pending]

### 5. Guest claim error (offline)
expected: On /split/{id} with devtools network offline, tapping a claim item card shows "Couldn't save — tap to retry" inline on that card only; going back online and tapping again clears the error
result: [pending]

### 6. Guest done error (offline)
expected: With devtools network offline, tapping "I'm done" shows "Couldn't submit — tap to retry" in the bottom bar above the button
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
