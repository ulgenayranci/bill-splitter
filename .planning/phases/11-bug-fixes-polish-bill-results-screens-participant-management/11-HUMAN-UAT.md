---
status: partial
phase: 11-bug-fixes-polish-bill-results-screens-participant-management
source: [11-VERIFICATION.md]
started: 2026-06-09T00:00:00Z
updated: 2026-06-09T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Rename propagates live across two devices
expected: On device A, open the people modal and rename a participant. On device B (same `/split/{id}` link), the new name appears within ~3 seconds without a manual refresh.
result: [pending]

### 2. Unclaimed-items section appears/disappears correctly on a real device
expected: With items unclaimed, the Results screen shows an "Unclaimed items" section at the top and a playful "still up for grabs" headline. Once everything is claimed, the section disappears and the headline reads "You're all set!".
result: [pending]

### 3. "Add a tip" button is prominent on mobile
expected: On a phone, the "Add a tip" control on the Results screen reads as a clear, tappable button (not a faint link) and opens the tip dialog.
result: [pending]

### 4. Share button tap ergonomics in the bill header
expected: On a phone, the Share button in the bill header is easy to spot and tap (≥44px), copies/shares the link, and the header looks clean now that the Receipt button is gone.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
