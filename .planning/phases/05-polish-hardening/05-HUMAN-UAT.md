---
status: complete
phase: 05-polish-hardening
source: [05-VERIFICATION.md]
started: 2026-05-14T08:52:00.000Z
updated: 2026-05-31T00:00:00.000Z
---

## Current Test

[testing complete — all 6 tests pass]

## Tests

### 1. iOS safe-area inset
expected: On a notched iPhone in Safari, `env(safe-area-inset-bottom)` is non-zero — sticky footers clear the home indicator
result: pass

### 2. Camera guidance text appearance
expected: Below the "Scan bill" button, the text "Allow camera access if prompted." is visible in gray (text-zinc-500)
result: pass

### 3. Copy summary end-to-end
expected: Tapping "Copy summary" on ResultsStep writes one-line-per-person totals + Total line to clipboard; button shows "Copied!" for ~2s then reverts
result: pass

### 4. Unassigned-item dialog full flow
expected: Tapping "See results" with unassigned items shows the dialog listing item names; "Go back" closes without navigating; "Continue anyway" proceeds to step 5
result: pass

### 5. Guest claim error (offline)
expected: On /split/{id} with airplane mode on, tapping a claim item card shows an inline error on that card only; going back online and tapping again clears the error and saves
result: pass
note: Tested on mobile (iPhone, Safari). Two fixes required before pass — (1) offline triggered SessionExpiredScreen instead of keeping the claiming screen (84dcaba — SWR error now only shows expired screen for real 404s via SessionNotFoundError, not network failures); (2) error message updated to "You're offline — reconnect and tap to retry" when offline, "Couldn't save — tap to retry" for server errors (466362e).

### 6. Guest done error (offline)
expected: With airplane mode on, tapping "I'm done" shows "Couldn't submit — tap to retry" in the bottom bar above the button; going back online and tapping again proceeds normally
result: pass
note: Same fixes as UAT 5 applied. Offline now shows "You're offline — reconnect and tap to retry" above the button.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
blocked: 0
skipped: 0

## Gaps

- truth: "Going offline shows SessionExpiredScreen instead of keeping the claiming screen visible"
  status: fixed
  fix: 84dcaba — introduced SessionNotFoundError; only actual 404s trigger SessionExpiredScreen, network failures keep last known state
  severity: major
  test: 5

- truth: "Offline error message is generic — user doesn't know why the action failed or what to do"
  status: fixed
  fix: 466362e — offline errors show 'You're offline — reconnect and tap to retry'; server errors keep generic message
  severity: minor
  test: 5, 6
