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
passed: 1
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

UAT round 1 (2026-06-09) — user tested the live app; everything not listed below is good. Round-2 polish punch-list (restaurant name deferred to a follow-up):

- [ ] **G1 — Results order:** pin the current user's results to the top; keep the unclaimed section always at the very top, above the individual's results.
- [ ] **G2 — Sticky menu:** remove the stacked Copy/Edit/New-Split buttons.
- [ ] **G3 — Add a tip:** remove the border (clickable text, not a button), append "?", and move it inside the current user's result container.
- [ ] **G4 — Sticky menu rebuild:** "Share summary" as a primary half-width button (renamed from Copy summary) with a secondary half-width "Edit bill" button to its left; no New Split.
- [ ] **G5 — Unclaimed container tappable:** tapping it routes to the bill-editing (claiming) screen, with a confirmation prompt first.
- [ ] **G6 — Unclaimed list collapse:** list all unclaimed items when ≤2; collapse to a count when >2.
- [ ] **G7 — Progress bar:** restore the progress strip on the claiming screen and results screen (it currently only renders in the setup wizard).
- [ ] **G8 — Share button:** nudge down to align with the avatar row and slightly reduce width.
- [ ] **G9 — Claimed items:** dim fully-claimed items in the bill UI; show the claimant avatar + "claimed" at the bottom-right of each.
- [ ] **G10 (DEFERRED, follow-up):** use the scanned restaurant name as the bill title when detected; needs OCR + schema work; affects new scans only.
