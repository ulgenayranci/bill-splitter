---
status: partial
phase: 10-results-screen-tip-modal-currency-display
source: [10-VERIFICATION.md]
started: 2026-06-08T18:21:55Z
updated: 2026-06-08T18:21:55Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-device currency propagation
expected: Open the split URL on two devices (or two tabs on the same session). Change currency from USD to EUR on one device via the Results-screen Currency select. The other device shows the € symbol on all amounts within ~3s (next SWR poll).
result: [pending]

### 2. Copy summary clipboard behavior
expected: Tap "Copy summary" on Results. Clipboard contains a line `{Name} owes {amount}` for every participant followed by `Total: {amount}`. Button shows "Copied!" for 2s then reverts. Verify on real mobile hardware (exercises the execCommand fallback the unit-test navigator mock does not cover).
result: [pending]

### 3. Tip Dialog round-trip
expected: From Results, tap "Add a tip?" → Tip Dialog opens. Pick a preset or custom tip, confirm. Dialog closes, totals refresh (mutate) with the tip reflected in your total. Requires a live /tip route + SWR mutate round-trip.
result: [pending]

### 4. New Split does not delete the shared session
expected: Tap "New Split" and confirm. The initiating device navigates to `/`. The original split session is STILL accessible at its URL for other participants — it is NOT deleted from Redis (only this device's localStorage `split:{sessionId}:personId` is cleared).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
