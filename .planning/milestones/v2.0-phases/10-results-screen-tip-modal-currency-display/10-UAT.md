---
status: complete
phase: 10-results-screen-tip-modal-currency-display
source: [10-05-SUMMARY.md, 10-HUMAN-UAT.md]
started: 2026-06-08T20:48:49Z
updated: 2026-06-09T00:00:00Z
note: Re-verification after 10-05 gap closure. Tests 1-3 re-check the three fixed UAT gaps; Test 4 is the Copy-summary check that was never run.
---

## Current Test

[testing complete]

## Tests

### 1. Currency shown from the first screen
expected: Scan a non-USD bill (e.g. Turkish Lira). The detected currency symbol (₺) appears on every amount from the first claiming/Bill View screen onward, not just on Results. No screen shows $ for a Lira bill.
result: pass

### 2. Results breakdown reads cleanly
expected: On the Results screen, your card reads in order — line items → a Subtotal row (items only) → Your tip row → a Total row (items + tip). The Subtotal and Total rows are clearly labelled and distinct, so it no longer looks like the items sum to the tip.
result: pass

### 3. New Split works on the first tap
expected: From Results, tap New Split and confirm. The app lands on the home page (/) on the FIRST tap — it does NOT bounce back to the same bill or re-open the "Who are you?" modal. (The shared session stays accessible at its URL for other participants.)
result: pass

### 4. Copy summary on a real phone
expected: On a real mobile device, tap "Copy summary" on Results. The clipboard contains a "{Name} owes {amount}" line for every participant followed by "Total: {amount}". The button shows "Copied!" for ~2s then reverts. Paste somewhere to confirm the text.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
