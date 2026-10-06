---
phase: 07-app-shell-setup-screen
plan: 01
subsystem: ui
tags: [react, nextjs, zustand, wizard, branding]
requires:
  - phase: v1.0 wizard
    provides: WizardShell + step-based flow this rebrands and restructures
provides:
  - easy-billsy branded AppHeader on every wizard screen
  - hamburger menu (New Split active; History + About Us inert stubs)
  - New Split reset with confirm-reset Dialog when a split is in progress
  - 3-segment progress strip (Setup / Bill View / Results)
affects: [07-02, 07-04, phase-09, phase-10]
tech-stack:
  added: []
  patterns: ["App-shell header mounted in WizardShell so it renders on all steps"]
key-files:
  created: [components/wizard/AppHeader.tsx]
  modified: [components/wizard/WizardShell.tsx, app/page.tsx]
key-decisions:
  - "History/About Us are inert greyed stubs (aria-disabled), no coming-soon state (D-06)"
  - "New Split confirm-reset Dialog only appears when a split is in progress (D-05)"
patterns-established:
  - "Branded header (Style A): white bg, dark wordmark, amber hamburger"
requirements-completed: [SHELL-01, SHELL-02, SHELL-03, SHELL-04]
duration: retroactive
completed: 2026-06-05
note: "Retroactive summary. Code shipped in commit cb10468 (feat(07): app shell, scan-first Setup screen, session + photo persistence); plan documented retroactively (commit dbb64c3). The SHELL-04 progress-strip visibility fix landed later in 07-04 (commit eae4aea)."
---

# Phase 7 / Plan 01: App Shell + Branded Header Summary

**easy-billsy branding now wraps every wizard screen via a shared AppHeader, with a hamburger menu, guarded New Split reset, and a 3-segment progress strip.**

## Accomplishments

- **AppHeader** (`components/wizard/AppHeader.tsx`): renders the `easy-billsy` wordmark (aria-label="easy-billsy") + amber hamburger; mounted in WizardShell so it appears on all steps (SHELL-01).
- **Hamburger menu**: exactly three rows — New Split (button), History (disabled div), About Us (disabled div), both inert greyed stubs with `aria-disabled` (SHELL-02, D-04, D-06).
- **New Split** (SHELL-03, D-05): calls `reset()` then `setStep(1)`; a confirm-reset Dialog appears first when a split is already in progress.
- **3-segment progress strip** (SHELL-04, D-07): WizardShell renders `PROGRESS_SEGMENTS = 3`, first segment filled on Setup. (Strip *visibility* fix shipped later in 07-04.)

## Verification

- UAT round 1 (07-UAT-round1.md): Test 2 (branded header every screen) ✓, Test 3 (hamburger menu rows) ✓, Test 4 (New Split reset + confirm) ✓.
- UAT round 2: progress strip visibly renders ✓ (Test 1).
- Security: T-7-01-01 (reset tampering) and T-7-01-02 (hashchange DoS) verified closed in 07-SECURITY.md.

## Commits

- `cb10468` feat(07): app shell, scan-first Setup screen, session + photo persistence
- `eae4aea` fix(07-04): make 3-segment progress strip visibly render
