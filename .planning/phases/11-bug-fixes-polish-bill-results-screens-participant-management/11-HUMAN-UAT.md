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

**Round-2 status:** G1–G9 implemented and tested by user on the live app (round 2). Round-2 feedback below.

### UAT round 2 (2026-06-09) — follow-up actions
- [x] **R1** Revert Share button to top-right (keep size). _(e94dbb8)_
- [x] **R2** Progress bar — confirmed OK (no change).
- [x] **R3** Fully-claimed items: stronger dim + strikethrough on the name. _(e94dbb8)_
- [x] **R4** Remove avatar from the "claimed" tag (text + check only). _(e94dbb8)_
- [x] **R5** Move item delete into the edit lightbox; remove the card-row X. _(57eaa2b)_
- [x] **R6** Remove the broken "N items unclaimed — tap to find" banner (revisit V3). _(57eaa2b)_
- [x] **R7** Unclaimed "I'm done" dialog: remove divider line; half-width Go back (left) + Continue anyway (primary, right). _(57eaa2b)_
- [x] **R8** Result cards collapsible — all expanded by default, tap to collapse. _(17d53cf)_
- [x] **R9** "Add a tip" — confirmed perfect (no change).
- [x] **R10** Sticky header that fades on scroll (menu → New Split stays reachable). _(503385d)_

**Status:** R1–R10 implemented (tsc clean; 380 tests pass, only the 3 pre-existing unrelated wizard failures). Awaiting UAT round 3.
**Still deferred:** G10 restaurant-name title (separate OCR/schema follow-up).

### UAT round 3 (2026-06-09) — follow-up actions
- [x] **R3-1** Bring back an items indicator (the old "tap to find" banner is gone): a non-interactive **x/N "Items claimed" chip** on the bill/claiming screen. Counts by **units, not rows** — a qty-5 line counts as 5. _(getClaimedUnitCounts helper)_
- [x] **R3-2** Results cards default: **current user's card expanded, everyone else's collapsed** (was: all expanded).
- [x] **R3-3** App header wordmark typeface slightly bigger (15px → 17px).
- [x] **R3-4** **Swipe-to-mark-paid:** swipe a result card right → "I have paid" toast + green **Paid** chip top-right; swipe left reverses. Horizontal swipe is suppressed from toggling the accordion.
- [x] **R3-5** Results "Unclaimed items" box now **lists every unclaimed item** (removed the >2 count-collapse "{N} items need an owner").

**Status:** R3-1–R3-5 implemented (tsc clean; PersonResultsScreen/sessionUtils/CollaborativeClaimingView/AppHeader suites green — 72 tests; full suite 388 pass with only the 3 pre-existing wizard failures). Awaiting UAT round 4.
