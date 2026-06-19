---
status: testing
phase: 11-bug-fixes-polish-bill-results-screens-participant-management
source: [11-VERIFICATION.md]
started: 2026-06-09T00:00:00Z
updated: 2026-06-19T15:38:29Z
---

## Current Test

[testing complete — round 4]

## Tests

### 1. Items-claimed chip on the bill screen (R3-1)
expected: On the bill/claiming screen, a non-tappable "x/N items claimed" chip shows progress. It counts by units, not rows — a qty-5 line counts as 5.
result: pass

### 2. Results cards default expand/collapse (R3-2)
expected: On the Results screen, YOUR own card is expanded by default and everyone else's cards are collapsed. Tapping a collapsed card expands it.
result: pass

### 3. Swipe-to-mark-paid on result cards (R3-4)
expected: Swiping a result card to the right shows an "I have paid" toast and a green "Paid" chip in the top-right of that card. Swiping left reverses it. The horizontal swipe does NOT accidentally open/close the card.
result: pass

### 4. Unclaimed-items section appears/disappears (orig #2 + R3-5)
expected: With items unclaimed, the Results screen shows an "Unclaimed items" section listing every unclaimed item by name. Once everything is claimed, the section disappears and the headline reads "You're all set!".
result: pass

### 5. "Add a tip" control opens the tip dialog (orig #3)
expected: On a phone, the "Add a tip?" control on the Results screen is clearly tappable and opens the tip dialog.
result: pass

### 6. Share button in the bill header (orig #4)
expected: On a phone, the Share button (top-right of the bill header) is easy to spot and tap (≥44px), copies/shares the `/split/{id}` link, and the header looks clean with the old Receipt button gone.
result: issue
reported: "Share functionality is currently difficult to locate. Wants a dedicated sharing step, potentially via a modal, to increase visibility."
severity: major
type: enhancement

### 7. Rename propagates live across two devices (orig #1)
expected: On device A, open the people modal and rename a participant. On device B (same `/split/{id}` link), the new name appears within ~3 seconds without a manual refresh.
result: pass
note: "User confirmed live sync works. Raised a separate enhancement on the same modal (see Gap R4-2: Save/Cancel button order)."

## Summary

total: 7
passed: 5
issues: 1
pending: 1
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

### UAT round 4 (2026-06-19) — results
Tests 1–5 PASS (items-claimed chip, results default expand/collapse, swipe-to-mark-paid, unclaimed-items appears/disappears, "Add a tip" opens dialog). Test 6 raised an enhancement; Test 7 pending (needs two devices).

```yaml
- truth: "Share is easy to find — the user can locate and use sharing without hunting for it"
  status: failed
  reason: "User reported: Share functionality is currently difficult to locate. Wants a dedicated sharing step, potentially via a modal, to increase visibility."
  severity: major
  type: enhancement
  test: 6
  id: R4-1
  artifacts: []  # Filled by diagnosis/design
  missing: []    # Filled by diagnosis/design

- truth: "The identity-edit row uses conventional button order (Cancel left, primary Save right)"
  status: failed
  reason: "User reported: on the 'Who are you?' edit row, Save (orange/primary) is on the LEFT and Cancel on the RIGHT. Should swap — Cancel left, Save right — per standard convention."
  severity: minor
  type: enhancement
  test: 7
  id: R4-2
  artifacts:
    - "app/split/[sessionId]/CollaborativeClaimingView.tsx or the PersonSlotPicker/IdentityModal edit-row markup"
  missing: []
```

**Round-4 status:** Tests 1–5, 7 PASS. Two enhancements raised (R4-1 share prominence, R4-2 Save/Cancel order). Awaiting fix planning + execution.
