---
phase: quick-260623-plo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
requirements: [QUICK-260623-plo]
must_haves:
  truths:
    - "Every <Button> variant renders without any hover-state styling (mobile/touch has no hover)"
    - "No hover: utility class remains anywhere in app/ or components/ outside components/ui/"
    - "The borderless ghost icon buttons (-/+ steppers, pencil-edit, confirm/cancel icons) show a visible border at rest"
    - "npm run build passes with no new errors"
  artifacts:
    - path: "components/ui/button.tsx"
      provides: "shadcn Button cva variants with all hover: utilities stripped"
      contains: "buttonVariants"
    - path: "app/split/[sessionId]/CollaborativeClaimingView.tsx"
      provides: "Outline-styled icon buttons, no hover classes"
  key_links:
    - from: "components/ui/button.tsx"
      to: "all <Button> usages app-wide"
      via: "cva variant strings"
      pattern: "buttonVariants"
---

<objective>
Mobile button polish for the "easy billsy" app. Two mechanical styling changes:

1. **Remove ALL `hover:` utility classes** from buttons and tappable controls app-wide. This is a touch app — hover never fires, and hover-only styling is exactly why some controls look empty at rest.
2. **Convert borderless "ghost" icon buttons to a permanent OUTLINE resting style** so the −/+ steppers, pencil-edit, and confirm/cancel icon buttons are visible without hover, matching the existing `variant="outline"` steppers in `components/split/ClaimableItemCard.tsx`.

Purpose: Make interactive controls visible and correct on mobile/touch where hover does not exist.
Output: 14 component files + `components/ui/button.tsx` with hover removed; ghost icon buttons given a visible border at rest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<interfaces>
<!-- Visual target: the OUTLINE steppers in ClaimableItemCard already render correctly at rest. -->
<!-- Match their resting style: border + background, no hover fill. -->

From components/split/ClaimableItemCard.tsx (the reference design, DO NOT modify it):
- Uses `<Button variant="outline" ...>` for the −/+ steppers → resolves to `border-border bg-background` at rest (per components/ui/button.tsx outline variant).

From components/ui/button.tsx — current hover usage to strip (line numbers approximate):
- default: `[a]:hover:bg-primary/80`
- outline: `hover:bg-muted hover:text-foreground ... dark:hover:bg-input/50`
- secondary: `hover:bg-secondary/80`
- ghost: `hover:bg-muted hover:text-foreground dark:hover:bg-muted/50`
- destructive: `hover:bg-destructive/20 ... dark:hover:bg-destructive/30`
- link: `hover:underline`
- KEEP all `focus-visible:`, `active:`, `aria-`, `dark:` (non-hover), `disabled:` utilities.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Strip all hover: utilities from Button cva and all non-ui controls</name>
  <files>components/ui/button.tsx, app/split/[sessionId]/CollaborativeClaimingView.tsx, components/split/InvitePeopleStep.tsx, components/split/PersonResultsScreen.tsx, components/split/TipScreen.tsx, components/split/BillViewHeader.tsx, components/split/PersonSlotPicker.tsx, components/wizard/AddPeopleStep.tsx, components/wizard/AddItemsStep.tsx, components/wizard/SetupStep.tsx, components/wizard/AssignItemsStep.tsx, components/wizard/AppHeader.tsx, components/wizard/DisambiguationDialog.tsx, components/wizard/ShareLinkButton.tsx, components/wizard/BillPhotoLightbox.tsx</files>
  <action>
Remove EVERY `hover:` utility class from the listed files. Rules:

(a) In `components/ui/button.tsx`: from EACH cva variant string (default, outline, secondary, ghost, destructive, link) delete only the `hover:`-prefixed tokens, including dark-mode hover variants like `dark:hover:bg-input/50` and `dark:hover:bg-muted/50` and `dark:hover:bg-destructive/30`. Note `[a]:hover:bg-primary/80` on the default variant is a single hover token — remove it whole. After edits, the `ghost` variant will have no hover-derived visibility — that is intended (icon buttons get explicit borders in Task 2). Preserve all `focus-visible:`, `active:`, `aria-`, non-hover `dark:`, and `disabled:` utilities. Collapse any resulting double spaces.

(b) In the 14 app/ and components/ (NON-ui) files: remove each `hover:`-prefixed class token wherever it appears (e.g. `hover:bg-zinc-100`, `hover:bg-zinc-50`, `hover:text-zinc-700`, `hover:text-zinc-800`, `hover:bg-coral-600`, `hover:bg-red-50`, `hover:underline`, etc.). This includes hover on the coral primary CTAs (drop the `hover:bg-coral-600` shift but KEEP the resting `bg-coral-500`), and incidental list-row / dashed-control hovers (acceptable to strip on mobile). Keep `active:`, `focus:`, `focus-visible:` states untouched.

(c) DO NOT touch hover anywhere in `components/ui/` OTHER than `button.tsx` — specifically leave `components/ui/badge.tsx` and `components/ui/dialog.tsx` unchanged.

(d) DO NOT change button sizes, layout, the coral resting color identity, the dashed border style of "Add item" / scan controls (e.g. AddItemsStep lines ~264/~502, SetupStep ~512, CollaborativeClaimingView ~803 keep `border-dashed`), settled/paid green states, or dark-mode theming. Only `hover:` tokens are removed in this task.

Use grep to drive completeness: after editing, `grep -rn "hover:" app components | grep -v components/ui/` must return nothing, and `grep -n "hover:" components/ui/button.tsx` must return nothing.
  </action>
  <verify>
    <automated>test -z "$(grep -rn 'hover:' /Users/ulgenayranci/playground/gsd-course/app /Users/ulgenayranci/playground/gsd-course/components | grep -v components/ui/)" && test -z "$(grep -n 'hover:' /Users/ulgenayranci/playground/gsd-course/components/ui/button.tsx)" && echo PASS</automated>
  </verify>
  <done>`grep -rn "hover:" app components | grep -v components/ui/` returns nothing; `button.tsx` has no `hover:`; badge.tsx and dialog.tsx unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Give borderless ghost icon buttons a visible OUTLINE at rest</name>
  <files>app/split/[sessionId]/CollaborativeClaimingView.tsx, components/wizard/AddItemsStep.tsx, components/wizard/SetupStep.tsx, components/wizard/AddPeopleStep.tsx, components/split/PersonSlotPicker.tsx</files>
  <action>
For the icon `<button>` controls that were `rounded-md text-zinc-... ` with NO border/fill (they previously relied on the now-removed `hover:bg-zinc-100` for visibility), add a permanent resting outline so they look like the `variant="outline"` steppers in ClaimableItemCard.tsx. To each target button's className, ADD `border border-border bg-background`. Preserve each button's EXISTING text color (some are `text-zinc-700`, some `text-zinc-400`, some `text-zinc-500`) and its existing sizing/rounded classes. Do NOT re-add any hover fill.

Target buttons (these are the formerly-ghost icon buttons; line numbers approximate, identify by the `flex ... items-center justify-center rounded-md text-zinc-...` icon-button shape that had `hover:bg-zinc-100`):
- CollaborativeClaimingView.tsx: the confirm/cancel edit icons (~694, ~698), the add-form confirm/cancel icons (~784, ~788). The pencil-edit button (~736) ALREADY has `border border-border` — leave its border as-is (just confirm hover was removed in Task 1). The "Add item" control (~803) STAYS a DASHED-border control — do NOT give it a solid border.
- AddItemsStep.tsx: the −/+ stepper and pencil icon buttons at ~378, ~386, ~424, ~478, ~486.
- SetupStep.tsx: the icon buttons at ~433 and ~602.
- AddPeopleStep.tsx: the icon button at ~101.
- PersonSlotPicker.tsx: the icon button at ~112 (note it uses `rounded` not `rounded-md` — keep that).

Only convert buttons that had NO border before. Any button that already carries `border` (e.g. the ~736 pencil) or `border-dashed` (dashed add/scan controls) must keep its existing border treatment — do not double up or convert dashed → solid.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && grep -c "border border-border bg-background" app/split/\[sessionId\]/CollaborativeClaimingView.tsx components/wizard/AddItemsStep.tsx components/wizard/SetupStep.tsx components/wizard/AddPeopleStep.tsx components/split/PersonSlotPicker.tsx | grep -vq ':0' && echo PASS</automated>
  </verify>
  <done>Each formerly-ghost −/+, pencil, and confirm/cancel icon button has `border border-border bg-background` at rest; dashed controls and the already-bordered pencil (~736) are untouched; text colors preserved.</done>
</task>

</tasks>

<verification>
- `npm run build` passes (no new TypeScript or build errors).
- `grep -rn "hover:" app components | grep -v components/ui/` returns nothing.
- `grep -n "hover:" components/ui/button.tsx` returns nothing.
- `components/ui/badge.tsx` and `components/ui/dialog.tsx` are unchanged (no diff).
- Visual: the −/+ steppers, pencil-edit, and confirm/cancel icon buttons render a visible border at rest (matching ClaimableItemCard's outline steppers).
- Dashed "Add item" / scan controls still render their dashed border; coral CTAs keep `bg-coral-500` resting color.
</verification>

<success_criteria>
- All `hover:` utilities removed from `components/ui/button.tsx` and all 14 non-ui component files.
- No `hover:` remains in app/ or components/ outside components/ui/ (badge.tsx and dialog.tsx intentionally untouched).
- Formerly-borderless ghost icon buttons now have a visible outline at rest.
- `npm run build` passes.
</success_criteria>

<output>
Create `.planning/quick/260623-plo-mobile-button-polish-remove-all-hover-st/260623-plo-SUMMARY.md` when done.
</output>
