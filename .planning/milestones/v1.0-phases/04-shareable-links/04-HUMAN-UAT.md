---
status: partial
phase: 04-shareable-links
source: [04-VERIFICATION.md]
started: 2026-05-13T21:08:30Z
updated: 2026-05-23T16:30:00Z
---

## Current Test

[testing deferred — requires Vercel deployment + Upstash Redis]

## Tests

### 1. Host share flow
expected: POST to Redis succeeds, share URL appears in HostWaitingScreen, clipboard copy button copies URL to clipboard
result: pass
tested: 2026-05-26

### 2. Guest claiming flow
expected: PersonSlotPicker shows taken slots dimmed, ClaimableItemCard cycles through 3 states, GuestDoneScreen shows only the guest's own total (not full bill)
result: blocked
blocked_by: third-party
reason: "Requires Vercel deployment with Upstash Redis configured. Will test on live URL."

### 3. Host polling update
expected: HostWaitingScreen spinner turns to checkmark within 3 seconds after guest taps "I'm done", "View results" button appears
result: blocked
blocked_by: third-party
reason: "Requires Vercel deployment with Upstash Redis configured. Will test on live URL."

### 4. SessionExpiredScreen on 404
expected: Opening /split/[nonexistent-id] renders SessionExpiredScreen (not a blank page or error boundary)
result: blocked
blocked_by: third-party
reason: "Requires Vercel deployment with Upstash Redis configured. Will test on live URL."

## Summary

total: 4
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 3

## Gaps
