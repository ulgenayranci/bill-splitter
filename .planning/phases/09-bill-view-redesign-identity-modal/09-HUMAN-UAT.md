---
status: partial
phase: 09-bill-view-redesign-identity-modal
source: [09-VERIFICATION.md]
started: 2026-06-07T00:30:00Z
updated: 2026-06-07T00:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. First-load modal blocking
expected: Opening a shared bill link with no stored identity shows the "Who are you?" modal; Escape, backdrop tap, and swipe do NOT dismiss it until a name is picked
result: [pending]

### 2. Identity persistence across reload
expected: After picking a name, closing and reopening the tab does NOT re-prompt — you land straight in the bill view as yourself
result: [pending]

### 3. Near-real-time attribution across devices
expected: When Device A taps an item, Device B sees A's claim chip appear on that item within ~3 seconds
result: [pending]

### 4. "I'm not listed" round-trip
expected: Tapping "I'm not listed", entering a name, and tapping "Add me" creates the person, closes the modal, and you proceed as that new person; the new name appears on other devices
result: [pending]

### 5. Change-identity close button
expected: Tapping the people strip reopens the "Who are you?" modal WITH a visible close (X) button; closing it keeps your current identity
result: [pending]

### 6. Warn-but-allow done flow
expected: Tapping "I'm done" with unclaimed items opens a styled dialog (not a browser confirm) showing the unclaimed count, a "Share bill link" button, "Continue anyway" (proceeds to tip/results), and "Go back" (returns to claiming)
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
