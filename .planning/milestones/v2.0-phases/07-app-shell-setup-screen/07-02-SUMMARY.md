---
phase: 07-app-shell-setup-screen
plan: 02
subsystem: ui
tags: [react, nextjs, zustand, ocr, camera, wizard]
requires:
  - phase: 07-01
    provides: WizardShell + AppHeader the Setup screen mounts inside
provides:
  - single scan-first Setup screen (scan tile is the hero + only capture path)
  - inline people add (name input + Add + removable list) on the same screen
  - post-scan thumbnail + "N items found" badge + Retake (not an editable list)
  - gated Continue bridging steps 1/2 into AssignItemsStep
affects: [07-03, 07-04, phase-09]
tech-stack:
  added: []
  patterns: ["Steps 1+2 folded into one SetupStep component in app/page.tsx"]
key-files:
  created: [components/wizard/SetupStep.tsx, components/wizard/BillPhotoLightbox.tsx]
  modified: [components/wizard/AssignItemsStep.tsx, app/page.tsx]
key-decisions:
  - "Scan-first: single <input type=file accept=image/*> is the only capture path (D-08, D-09; gallery later softened in 07-04)"
  - "Continue gated on billScanned AND people.length >= 2 (SETUP-04 deviation + D-11/D-12)"
patterns-established:
  - "Empty/failed scan resets to the scan tile — never a dead end (D-10)"
requirements-completed: [SETUP-01, SETUP-02, SETUP-03, SETUP-04]
duration: retroactive
completed: 2026-06-05
note: "Retroactive summary. Code shipped in commit cb10468; plan documented retroactively (commit dbb64c3). SETUP layout/behavior refinements (gallery, spacing, count chip, failed-scan clear, inline error) landed in 07-04; placement polish in quick task 260605-v0g."
---

# Phase 7 / Plan 02: Scan-First Setup Screen Summary

**The multi-step wizard setup collapsed into one scan-first screen: a hero scan tile, inline people add, post-scan thumbnail + item count, and a gated Continue.**

## Accomplishments

- **SetupStep** (`components/wizard/SetupStep.tsx`): single scan-first screen; the scan tile (camera) is the hero and only capture path (SETUP-01, D-08/D-09).
- **Inline people** (SETUP-02, D-08): name Input + Add button + removable list on the same screen.
- **Post-scan UI** (SETUP-03, D-10): bill thumbnail, "N items found" badge, Retake button — not an editable item list. BillPhotoLightbox gives a full-screen photo view.
- **Continue gating** (SETUP-04): disabled until `billScanned && people.length >= 2`; clicking calls `setStep(3)` to bridge to AssignItemsStep. `app/page.tsx` folds steps 1 & 2 into SetupStep.

## Verification

- UAT round 1: Test 6 (scan-first layout) ✓, Test 7 (scan → thumbnail + count + retake) ✓, Test 9 (Continue gating → bridge to Assign) ✓.
- UAT round 2: failed re-scan recovery ✓ (Test 4), layout polish ✓ (Test 3, after 260605-v0g).
- Security: T-7-02-01 (image-upload DoS), T-7-02-02 (billImageUrl persistence), T-7-02-03 (Continue gate bypass) verified closed in 07-SECURITY.md.

## Commits

- `cb10468` feat(07): app shell, scan-first Setup screen, session + photo persistence
- `8b77c3e` feat(07-04): close Setup screen UAT gaps 2-7
- `19f1c3d` / `109f6a6` style(260605-v0g): count-chip + Continue-button placement
