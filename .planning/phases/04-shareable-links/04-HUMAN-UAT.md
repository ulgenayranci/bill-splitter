---
status: partial
phase: 04-shareable-links
source: [04-VERIFICATION.md]
started: 2026-05-13T21:08:30Z
updated: 2026-05-13T21:08:30Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Host share flow
expected: POST to Redis succeeds, share URL appears in HostWaitingScreen, clipboard copy button copies URL to clipboard
result: [pending]

### 2. Guest claiming flow
expected: PersonSlotPicker shows taken slots dimmed, ClaimableItemCard cycles through 3 states, GuestDoneScreen shows only the guest's own total (not full bill)
result: [pending]

### 3. Host polling update
expected: HostWaitingScreen spinner turns to checkmark within 3 seconds after guest taps "I'm done", "View results" button appears
result: [pending]

### 4. SessionExpiredScreen on 404
expected: Opening /split/[nonexistent-id] renders SessionExpiredScreen (not a blank page or error boundary)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
