---
phase: quick-261001-j4c
plan: 01
status: complete
completed: 2026-10-01
commits: [d0e220e, cdcedac, 5618ca0]
---

# Quick 261001-j4c: Primary buttons stone, coral only for warnings and Invite

Primary buttons are now Stone #6b6157 with white text and a soft neutral shadow. Coral is kept only for three warning-confirm buttons (via the new `variant="warning"`) and the Invite button on the split header.

## Tasks
1. Stone token (`--eb-stone`, `--color-stone`, `--primary` in both light blocks, `--eb-primary`), neutral `--eb-sh-btn`, Button `warning` variant, default variant uses the token shadow (d0e220e).
2. Removed `bg-coral-500` from 7 ordinary primaries; "Show my result", "Go back" and "New Split" use `variant="warning"`; header "+" and SetupStep add-person "+" use `bg-stone` (cdcedac).
3. Dev gallery and UI-SPEC.md updated (5618ca0).

## Decisions
- `--ring` left coral in both light blocks: focus rings are invisible on touch-only mobile, and other inputs use coral focus per UI-SPEC rule 5.
- Variant named `warning` (coral). It is distinct from the amber `warn` used for banners.

## Deviations
None. Gallery got two extra sample ids (A1w, B4w) for the warning variant.

## Verification
- `npx tsc --noEmit`: pass
- `npx vitest run`: 26 files, 423 tests pass
- Remaining `bg-coral-500` outside app/dev: BillViewHeader Invite, SetupStep badge, ProgressStrip, plus the Button `warning` variant definition.

## Self-Check: PASSED
