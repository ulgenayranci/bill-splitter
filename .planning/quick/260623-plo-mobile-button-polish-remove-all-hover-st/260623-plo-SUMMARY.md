---
phase: quick-260623-plo
plan: 01
subsystem: ui-buttons
tags: [mobile, touch, tailwind, buttons, polish]
requires: []
provides: ["hover-free button styling", "outline-at-rest ghost icon buttons"]
affects:
  - components/ui/button.tsx
  - app/split/[sessionId]/CollaborativeClaimingView.tsx
  - components/split/*
  - components/wizard/*
tech-stack:
  added: []
  patterns: ["resting outline (border border-border bg-background) for icon buttons instead of hover-only fill"]
key-files:
  created: []
  modified:
    - components/ui/button.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - components/split/InvitePeopleStep.tsx
    - components/split/PersonResultsScreen.tsx
    - components/split/TipScreen.tsx
    - components/split/BillViewHeader.tsx
    - components/split/PersonSlotPicker.tsx
    - components/wizard/AddPeopleStep.tsx
    - components/wizard/AddItemsStep.tsx
    - components/wizard/SetupStep.tsx
    - components/wizard/AssignItemsStep.tsx
    - components/wizard/AppHeader.tsx
    - components/wizard/DisambiguationDialog.tsx
    - components/wizard/ShareLinkButton.tsx
    - components/wizard/BillPhotoLightbox.tsx
decisions:
  - "Ghost icon buttons get a permanent resting outline (border border-border bg-background) instead of hover fill — hover never fires on touch, which is why they looked empty at rest"
metrics:
  duration: ~8 minutes
  completed: 2026-06-23
---

# Quick Task 260623-plo: Mobile Button Polish (Remove Hover + Outline Ghost Buttons) Summary

Stripped every `hover:` utility from the Button cva and all 14 non-ui tappable controls, then gave the formerly-borderless ghost icon buttons (−/+ steppers, pencil-edit, confirm/cancel icons) a permanent outline at rest so they're visible on touch where hover never fires.

## What Was Done

### Task 1 — Strip all `hover:` utilities (commit 058978d)
- `components/ui/button.tsx`: removed every `hover:`-prefixed token (including `dark:hover:*`) from the `default`, `outline`, `secondary`, `ghost`, `destructive`, and `link` cva variants. Preserved all `focus-visible:`, `active:`, `aria-`, non-hover `dark:`, and `disabled:` utilities. The `ghost` variant now has no resting visibility by design — icon buttons get explicit borders in Task 2.
- 14 app/ and components/ (non-ui) files: removed each `hover:` class token, including `hover:bg-coral-600` on the coral CTAs (resting `bg-coral-500` preserved), incidental list-row / dashed-control hovers, and `hover:underline`. Kept `active:`/`focus:`/`focus-visible:` states.
- Left `components/ui/badge.tsx` and `components/ui/dialog.tsx` untouched (verified via `git diff` — no changes).

### Task 2 — Outline the formerly-ghost icon buttons (commit 41e829a)
Added `border border-border bg-background` to 13 icon buttons that previously relied on the now-removed `hover:bg-zinc-100` for visibility, matching the `variant="outline"` steppers in `ClaimableItemCard.tsx`. Existing text colors (zinc-400/500/700), sizing, and rounded classes preserved.
- CollaborativeClaimingView.tsx: 4 (edit-form + add-form confirm/cancel icons)
- AddItemsStep.tsx: 5 (two confirm/cancel pairs + remove button)
- SetupStep.tsx: 2 (item-remove + person-remove icons)
- AddPeopleStep.tsx: 1 (person-remove icon)
- PersonSlotPicker.tsx: 1 (rename pencil — kept `rounded` not `rounded-md`)

Untouched per plan: the already-bordered pencil-edit (~736 in CollaborativeClaimingView), and all dashed "Add item" / scan controls (kept `border-dashed`, did not convert to solid).

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npm run build` → `✓ Compiled successfully`, TypeScript clean, all 7 static pages generated.
- `grep -rn "hover:" app components | grep -v components/ui/` → empty (PASS).
- `grep -n "hover:" components/ui/button.tsx` → empty (PASS).
- `components/ui/badge.tsx` and `components/ui/dialog.tsx` → unchanged (no diff).
- Border-addition counts: CollaborativeClaimingView 4, AddItemsStep 5, SetupStep 2, AddPeopleStep 1, PersonSlotPicker 1.

## Commits

| Task | Commit | Pushed |
|------|--------|--------|
| 1 — strip hover | 058978d | ✓ |
| 2 — outline ghost buttons | 41e829a | ✓ |

## Self-Check: PASSED
- components/ui/button.tsx — FOUND, no `hover:`
- All 15 modified files committed across 058978d + 41e829a
- Both commits present in `git log` and pushed to origin/main (branch up to date)
