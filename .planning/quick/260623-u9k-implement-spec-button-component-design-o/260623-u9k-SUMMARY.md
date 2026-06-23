---
phase: quick-260623-u9k
plan: 01
subsystem: ui
tags: [buttons, design-spec, tailwind]
key-files:
  modified:
    - components/ui/button.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - components/wizard/AddItemsStep.tsx
    - components/wizard/SetupStep.tsx
    - components/wizard/AddPeopleStep.tsx
    - components/split/PersonSlotPicker.tsx
metrics:
  tasks: 2
  files: 6
  completed: 2026-06-23
---

# Quick Task 260623-u9k: Button Component Design (Real Fills) Summary

Implemented easy billsy spec §06 button fills so outline/icon buttons read as filled instead of blending into the paper page: outline = white fill + ink + border, primary = coral + coral drop-shadow, ghost = n100 fill + n500 text.

## What Changed

### Task 1 — button.tsx variant fills (commit 795947f)
- **default (primary):** added coral drop-shadow `shadow-[0_4px_14px_rgba(241,96,63,0.28)]` (spec `--eb-sh-btn`); resting coral, no hover.
- **outline:** `bg-background` → `bg-white`, added `text-foreground`; kept `border-border`, dark overrides (`dark:bg-input/30 dark:border-input`), and `aria-expanded:` states.
- **ghost:** added spec fill `bg-muted text-muted-foreground` (was transparent); kept `aria-expanded:` states.
- **secondary / others:** untouched.
- No `hover:` utilities introduced; `active:`/`focus-visible:` preserved.

### Task 2 — custom icon buttons white fill (commit 646df95)
- 13 icon buttons styled `border border-border bg-background text-zinc-*` → `bg-white`, across 5 files (CollaborativeClaimingView ×4, AddItemsStep ×5, SetupStep ×2, AddPeopleStep ×1, PersonSlotPicker ×1).
- Kept `border border-border` and existing text colors. No size changes.
- Did NOT touch dashed Add-item/scan controls, ClaimableItemCard (uses `variant="outline"`), badge.tsx, dialog.tsx, or input fields.

## Verification

- Task 1 verify: `PASS` (bg-white + coral rgba + ghost fill present; no hover).
- Task 2 verify: `border border-border bg-background` empty; `npm run build` passed.
- Final gates:
  - `grep "bg-white" components/ui/button.tsx` → non-empty ✓
  - `grep -rn "border border-border bg-background" app components` → empty ✓
  - `grep "hover:" components/ui/button.tsx` → empty ✓

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `795947f` fix(260623-u9k): button variant real fills (spec §06) — pushed to main
- `646df95` fix(260623-u9k): custom icon buttons white fill (spec §06) — pushed to main

## Self-Check: PASSED
- components/ui/button.tsx: FOUND
- Commit 795947f: FOUND
- Commit 646df95: FOUND
