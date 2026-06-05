---
status: complete
phase: 07-app-shell-setup-screen
source: [07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md]
started: 2026-06-05T15:10:25Z
updated: 2026-06-05T15:15:30Z
---

## Current Test

[testing complete]

## Tests

### 1. App Loads (Cold Start)
expected: Open the live app fresh (hard refresh / new tab). Page loads with no errors, the easy-billsy header shows at top, and you land on the Setup screen.
result: pass

### 2. Branded Header on Every Screen
expected: The header shows the "easy-billsy" wordmark on a white background with an amber hamburger (three-bar) icon. The header stays visible as you move between screens.
result: pass

### 3. Hamburger Menu Rows
expected: Tapping the hamburger opens a small dropdown with three rows — "New Split" (active/tappable), "History" (greyed out, not tappable), "About Us" (greyed out, not tappable). No "coming soon" text on the disabled rows.
result: pass

### 4. New Split Reset + Confirm
expected: With a split in progress (people added and/or a bill scanned), tapping "New Split" shows a "Start a new split?" confirm dialog. Confirming clears everything and returns to the empty Setup screen. With nothing in progress, New Split resets immediately with no dialog.
result: pass

### 5. 3-Segment Progress Strip
expected: A progress strip with exactly 3 segments (Setup / Bill View / Results) sits under the header. On the Setup screen only the first segment is filled (amber); the other two are grey.
result: issue
reported: "progress strip is not visible on any screen"
severity: major

### 6. Scan-First Setup Layout
expected: The Setup screen shows the tagline "Split any bill in seconds.", a hero "Scan your receipt" tile as the primary action, and an inline "Who's involved in the split?" section with a name input + Add button.
result: issue
reported: "all there but I want you to put more padding between scan your receipt action hero and inline section. at least 5 pixels"
severity: cosmetic
note: "Core layout elements all present and correct (pass). Two follow-ups captured as gaps: (1) gallery capture path [pre-logged], (2) extra vertical padding between scan hero and the people section (≥5px)."

### 7. Scan a Receipt → Thumbnail + Count + Retake
expected: Tapping the scan tile opens the camera. After capturing a readable receipt, the tile is replaced by the captured-bill thumbnail, an amber "N items found" badge, and a Retake button. Tapping the thumbnail opens a full-screen photo view. No editable item list appears.
result: pass

### 8. Failed / Empty Scan → Retry (No Dead End)
expected: Scanning a blank/unreadable photo (or one with no items) shows a retry toast ("No items found…" or "Couldn't read the bill…"), the scan tile returns (red-bordered), and you can immediately re-scan. You are never stuck — Retake/re-scan is always available.
result: issue
reported: "the error toast appears but it appears too low, easy to miss — it should be at the same level as the progress messages. Also, on a failed retake of an already-successfully-scanned bill, the item-count chip remains ('4 items found' in screenshot IMG_1421.PNG) — it should be cleared."
severity: major
evidence: /Users/ulgenayranci/Downloads/IMG_1421.PNG

### 9. Continue Gating → Bridge to Assign
expected: The "Continue to Assign →" button stays disabled with a hint until BOTH a bill is scanned AND at least 2 people are added. Once both are satisfied it enables; tapping it moves you into the existing item-assignment screen.
result: pass

### 10. Currency Detection (Detected + Stored)
expected: Scanning a non-USD receipt (e.g. one priced in € or £) detects the currency. Note: per the phase scope this is detection + storage only — it is NOT yet shown in the displayed amounts (that lands in Phase 10). Verifiable via the OCR test suite / persisted state rather than visible UI. Skip if you can't test a non-USD receipt.
result: pass
note: "Not visually observable by design (D-02: detection + store only; display threading + $-sign replacement deferred to Phase 10). Verified via automated suite: `npx vitest run __tests__/ocrRoute.test.ts` → 9/9 passed (schema requires currencyCode, gbp→GBP normalization, garbled→USD fallback). The hardcoded $ on the Assign page is the expected Phase 10 gap, not a Phase 7 defect."

## Summary

total: 10
passed: 7
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "WizardShell renders a visible 3-segment progress strip (Setup / Bill View / Results) under the header on every wizard screen, with the first segment filled on Setup (SHELL-04, D-07)"
  status: failed
  reason: "User reported: progress strip is not visible on any screen"
  severity: major
  test: 5
  root_cause: ""     # Filled by diagnosis
  artifacts: []      # Filled by diagnosis
  missing: []        # Filled by diagnosis
  debug_session: ""  # Filled by diagnosis

- truth: "User can supply the bill image from their existing photo library, not only the live camera — so a user who already photographed the bill (now cleared/gone) is not forced to re-capture (revises D-09 scan-only)"
  status: failed
  reason: "User reported during Test 5: no gallery/photo-library option in the scan wizard; if the physical bill is gone the user is forced to re-capture. Decision: drop capture=\"environment\" so the OS picker offers camera AND gallery (Case B / manual entry explicitly out of scope)."
  severity: major
  test: 6
  root_cause: 'capture="environment" on the file input in SetupStep.tsx forces the live camera and suppresses the photo-library option (enforces D-09 scan-only)'
  artifacts:
    - path: "components/wizard/SetupStep.tsx"
      issue: 'file input carries capture="environment", blocking gallery selection'
  missing:
    - 'Remove the capture="environment" attribute from the SetupStep file input so the native picker offers both camera and photo library'
    - "Update D-09 in 07-CONTEXT.md to record the scan-only → scan-first softening"
  debug_session: ""

- truth: "There is clear vertical separation (≥5px additional padding) between the 'Scan your receipt' hero tile and the inline 'Who's involved in the split?' section on the Setup screen"
  status: failed
  reason: "User reported during Test 6: layout is all present, but wants more padding (at least 5px) between the scan hero and the inline people section"
  severity: cosmetic
  test: 6
  root_cause: ""     # Filled by diagnosis
  artifacts:
    - path: "components/wizard/SetupStep.tsx"
      issue: "insufficient vertical spacing between the scan tile block and the people-add section"
  missing:
    - "Increase the vertical gap/margin between the scan hero tile and the inline people section by at least 5px"
  debug_session: ""

- truth: "A count chip at the end of the 'Who's involved in the split?' heading shows how many people have been added to the split, updating as people are added/removed"
  status: failed
  reason: "User requested during Test 6/7: add a number chip at the end of the 'Who's involved in the split?' line showing how many people are in the split"
  severity: minor
  test: 6
  root_cause: ""     # Filled by diagnosis
  artifacts:
    - path: "components/wizard/SetupStep.tsx"
      issue: "people heading has no count indicator"
  missing:
    - "Render a count chip/badge at the end of the 'Who's involved in the split?' heading bound to people.length"
  debug_session: ""

- truth: "The Setup screen is free of redundant explanatory text — the 'Add people now or after scanning.' helper line is removed, and the Continue button reads 'Continue to Assign' without a trailing arrow"
  status: failed
  reason: "User requested during Test 6: too many explanatory texts on screen — remove the 'Add people now or after scanning.' line, and remove the → arrow from the 'Continue to Assign →' button"
  severity: cosmetic
  test: 6
  root_cause: ""     # Filled by diagnosis
  artifacts:
    - path: "components/wizard/SetupStep.tsx"
      issue: "redundant 'Add people now or after scanning.' helper text; Continue button label includes a trailing arrow"
  missing:
    - "Remove the 'Add people now or after scanning.' helper text from SetupStep"
    - "Change the Continue button label from 'Continue to Assign →' to 'Continue to Assign' (drop the arrow)"
  debug_session: ""

- truth: "A failed/empty re-scan of an already-successfully-scanned bill clears the prior scan state — the 'N items found' count chip disappears (not just the thumbnail), so no stale item count remains and Continue is re-gated"
  status: failed
  reason: "User reported during Test 8 (evidence IMG_1421.PNG): after a failed retake, billImageUrl is cleared (thumbnail gone) but the prior '4 items found' chip persists because items[] is not cleared on empty/error scan"
  severity: major
  test: 8
  root_cause: "On empty/error scan the handler sets setBillImage(null)+setOcrStatus('error') but does not clear items[]; billScanned (items.length>0) stays true so the count badge persists"
  artifacts:
    - path: "components/wizard/SetupStep.tsx"
      issue: "empty/error scan paths do not reset items, leaving a stale 'N items found' badge"
  missing:
    - "On empty-scan and error-scan paths, clear items (e.g. setItems([])) alongside setBillImage(null) so the count chip disappears and billScanned returns false"
  debug_session: ""

- truth: "The OCR error/empty-scan toast appears near the scan tile / at the same vertical level as the in-progress 'reading bill' status messages, where the user is looking — not pinned to the bottom of the screen"
  status: failed
  reason: "User reported during Test 8 (evidence IMG_1421.PNG): the error toast appears too low (bottom of screen) and is easy to miss; it should appear at the same level as the progress messages"
  severity: minor
  test: 8
  root_cause: ""     # Filled by diagnosis
  artifacts:
    - path: "components/wizard/SetupStep.tsx"
      issue: "scan error/empty feedback surfaces as a bottom-anchored toast far from the scan area"
  missing:
    - "Surface the empty/error scan feedback inline near the scan tile (same placement as the in-progress status messages) instead of a bottom-anchored toast"
  debug_session: ""
