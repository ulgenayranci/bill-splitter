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

- [x] **G1 — Results order:** current user's card pinned first; unclaimed section stays above it. _(238133d)_
- [x] **G2 — Sticky menu:** stacked Copy/Edit/New-Split buttons removed. _(238133d)_
- [x] **G3 — Add a tip:** now borderless clickable text "Add a tip?" inside the current user's result card. _(238133d)_
- [x] **G4 — Sticky menu rebuild:** [Edit bill (secondary, half) | Share summary (primary, half)]; New Split removed. _(238133d)_
- [x] **G5 — Unclaimed container tappable:** tap → confirm dialog → back to editing. _(238133d)_
- [x] **G6 — Unclaimed list collapse:** lists names when ≤2; shows "{N} items need an owner" when >2. _(238133d)_
- [x] **G7 — Progress bar:** reusable ProgressStrip; renders on claiming (2/3) and results (3/3). _(aa00d90, 668a464)_
- [x] **G8 — Share button:** moved to the avatar row, slightly narrower, ≥44px tap target. _(668a464)_
- [x] **G9 — Claimed items:** fully-claimed cards dimmed; claimant avatar + "claimed" bottom-right. _(59e393f)_
- [ ] **G10 (DEFERRED, follow-up):** use the scanned restaurant name as the bill title when detected; needs OCR + schema work; affects new scans only.

**Round-2 status:** G1–G9 implemented (tsc clean; 376 tests pass, only 3 pre-existing unrelated wizard failures). Awaiting UAT round 2 on the live app.
