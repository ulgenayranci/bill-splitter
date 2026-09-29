---
phase: quick-260929-hll
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/split/[sessionId]/CollaborativeClaimingView.tsx
  - components/wizard/SetupStep.tsx
  - __tests__/CollaborativeClaimingView.test.tsx
  - __tests__/SetupStep.test.tsx
autonomous: true
requirements: [DS-20260929-01, DS-20260929-02, DS-20260929-03, DS-20260929-OQ1]

must_haves:
  truths:
    - "At 375px, tapping the pencil on any item on /split/[sessionId] shows the item's full current name in a full-width text box (row 1), with price, qty, confirm and cancel on row 2 and no horizontal scroll"
    - "The Add item form on /split/[sessionId] uses the same two-row layout"
    - "Save (Confirm edit / Confirm) and Cancel still work; error message still shows below the rows; Delete still shows in the edit form"
    - "The home scan card reads exactly: Take a photo of the receipt and I will capture all the items for you. The error branch text is unchanged"
    - "The fixed I'm done bar uses bg-card (white in light mode, card colour in dark mode) and keeps border-t"
    - "The SetupStep scan-review list rows (name estimated ~111px wide at 375px) use the same two-row layout: name full width, then price, qty, remove"
  artifacts:
    - path: "app/split/[sessionId]/CollaborativeClaimingView.tsx"
      provides: "Two-row edit + add forms, bg-card done bar"
      contains: "bg-card px-6 py-4"
    - path: "components/wizard/SetupStep.tsx"
      provides: "New scan-card copy, two-row scan-review item rows"
      contains: "Take a photo of the receipt and I will capture all the items for you."
  key_links:
    - from: "CollaborativeClaimingView edit/add row 2"
      to: "handleInlineSubmit / setInlineForm(null)"
      via: "unchanged onClick/onKeyDown handlers"
      pattern: "handleInlineSubmit"
---

<objective>
Implement the three Design Steward brief tasks (.design-steward/brief-20260929/implementation_prompt.md) exactly, plus the user-approved check of the SetupStep scan-review list row (brief Open Question 1).

Purpose: item names are unreadable (35px wide) while editing on mobile; user-requested copy and colour tweaks.
Output: edited CollaborativeClaimingView.tsx and SetupStep.tsx; tests green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.design-steward/brief-20260929/implementation_prompt.md
@.design-steward/brief-20260929/brief.md
@app/split/[sessionId]/CollaborativeClaimingView.tsx
@components/wizard/SetupStep.tsx

<interfaces>
Current structure (verified by reading the code):

CollaborativeClaimingView.tsx edit form (~lines 662-713): `Card className="flex flex-row items-start gap-2 px-4 py-3"` > `div.flex.flex-1.flex-col.gap-1` > `div className="flex gap-2"` containing, in order: name Input (aria-label "Item name", className "flex-1 h-10 text-base", maxLength 100, autoFocus), price Input (aria-label "New price", w-24, maxLength 9, Enter submits), qty Input (type number, aria-label "Quantity", w-14, min 1 max 99, Enter submits), Confirm button (aria-label "Confirm edit", w-10 shrink-0, disabled={inlineSubmitting}), Cancel button (aria-label "Cancel edit", w-10 shrink-0). After the row: `{inlineForm.error && <p ...>}` then the Delete button (data-testid delete-item-{id}).

Add form (~lines 751-796): same shape, name Input (aria-label "Item name", autoFocus, maxLength 100), price Input (no aria-label, w-24), qty Input (aria-label "Quantity", w-14), Confirm (aria-label "Confirm"), Cancel (aria-label "Cancel"), then error <p>.

Done bar (~line 817): `className="fixed bottom-0 left-0 right-0 border-t border-border bg-background px-6 py-4"`.

SetupStep.tsx scan-review list (~lines 389-436), inside region data-testid "scan-review" (px-3), page padding px-6 from WizardShell main:
`<li key={item.id} className="flex items-center gap-2">` containing name Input (aria-label "Item name", h-10 flex-1 bg-white text-base, maxLength 100, onBlur/Enter commitRow), price Input (aria-label "Price", w-20), qty Input (aria-label "Quantity", w-12, maxLength 2), remove button (aria-label `Remove ${item.name}`, w-10 shrink-0).

SetupStep.tsx line 526 non-error string: "Point at the bill — we'll pick up every item" (JSX string in double quotes because of the apostrophe).

Width estimates at 375px:
- Split edit/add card content: 375 - 48 (ul px-6) - 32 (Card px-4) = 295px. Row 2 = 96 + 56 + 40 + 40 + 3*8 gaps = 256px -> fits, keep widths.
- SetupStep review row: 375 - 48 (main px-6) - 24 (region px-3) = 303px. Current name width = 303 - (80 + 48 + 40 + 3*8) = ~111px -> UNDER 120px threshold, so the two-row fix IS applied (per user decision). Row 2 = 80 + 48 + 40 + 16 = 184px -> fits.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Two-row edit/add forms and white done bar on /split</name>
  <files>app/split/[sessionId]/CollaborativeClaimingView.tsx, __tests__/CollaborativeClaimingView.test.tsx</files>
  <action>
Brief task 1 (edit row ~line 664 and Add item form ~line 755): in BOTH forms, replace the single `div className="flex gap-2"` wrapper with two sibling rows inside the existing `flex flex-1 flex-col gap-1` column (change that column's gap to gap-2 so the rows breathe; the error <p> and Delete button remain after the rows in the same column, in the same order).
- Row 1: the name Input alone. Change its className from "flex-1 h-10 text-base" to "h-10 w-full text-base". Keep placeholder, aria-label "Item name", value, onChange, maxLength={100}, autoFocus exactly as they are.
- Row 2: `div className="flex items-center gap-2"` containing price Input, qty Input, confirm button, cancel button, in the existing order with their existing classNames (w-24, w-14, w-10 shrink-0), aria-labels, handlers, disabled={inlineSubmitting}, onKeyDown Enter-submit, min/max/maxLength/inputMode all unchanged. Do not change widths (row 2 is 256px vs 295px available at 375px, so no overflow).
- Do not touch the outer Card classes or anything else in the file except the done bar below.

Brief task 3 (~line 817): on the fixed "I'm done" bar div, change `bg-background` to `bg-card` only. Keep `border-t border-border` and all other classes/styles. Do not change the page background or any other bar.

Tests: existing tests query by aria-label (Item name, Confirm edit, Quantity, etc.) so they should keep passing. If any test asserts the old single-row DOM structure or `bg-background` on the done bar, update it to the new structure/class. Optionally add one assertion that the edit-form name Input and the "New price" Input do not share the same parentElement (proves the two-row split) — use `screen.getByLabelText('Item name').parentElement !== screen.getByLabelText('New price').parentElement`.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx vitest run __tests__/CollaborativeClaimingView.test.tsx && grep -c 'bg-card px-6 py-4' "app/split/[sessionId]/CollaborativeClaimingView.tsx" && grep -c 'h-10 w-full text-base' "app/split/[sessionId]/CollaborativeClaimingView.tsx"</automated>
  </verify>
  <done>Edit and Add forms render name on its own full-width row and price/qty/confirm/cancel on a second row; done bar uses bg-card; grep counts are 1 and 2 respectively; CollaborativeClaimingView tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Scan-card copy and two-row scan-review rows in SetupStep</name>
  <files>components/wizard/SetupStep.tsx, __tests__/SetupStep.test.tsx</files>
  <action>
Brief task 2 (line 526): replace the non-error branch string "Point at the bill — we'll pick up every item" with exactly "Take a photo of the receipt and I will capture all the items for you." (locked user decision; this line only; do not change the "I/we" voice anywhere else). Leave the error branch "Something went wrong — tap to try again" unchanged. The span stays text-[13px] text-zinc-400 so it wraps inside the card.

Open question 1 (user decision): the scan-review list row (~line 393) name Input is estimated at ~111px wide at 375px (303px content minus price w-20, qty w-12, remove w-10 and three 8px gaps), which is under the ~120px threshold, so apply the same two-row fix:
- Change the `<li key={item.id} className="flex items-center gap-2">` to `className="flex flex-col gap-2"`.
- Row 1: name Input alone; change its className "h-10 flex-1 bg-white text-base" to "h-10 w-full bg-white text-base". Keep aria-label, value, onChange, onBlur commitRow, Enter commitRow, maxLength={100}.
- Row 2: `div className="flex items-center gap-2"` containing the price Input, qty Input and remove button unchanged (classes w-20, w-12, w-10 shrink-0, aria-labels, handlers, maxLength all kept).
Touch nothing else in SetupStep.

Tests: grep showed no test asserting "Point at the bill"; if __tests__/SetupStep.test.tsx asserts the old copy or the li's flex-row structure, update it to the new string/structure. Add one assertion that the idle scan card renders "Take a photo of the receipt and I will capture all the items for you." if a suitable render test already exists for the scan card.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx vitest run __tests__/SetupStep.test.tsx && grep -c 'Take a photo of the receipt and I will capture all the items for you.' components/wizard/SetupStep.tsx && ! grep -q 'Point at the bill' components/wizard/SetupStep.tsx</automated>
  </verify>
  <done>New copy present once, old copy gone, error copy unchanged; scan-review rows are two-row; SetupStep tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Full suite and typecheck</name>
  <files>(none unless fixes needed)</files>
  <action>Run the full test suite and TypeScript check. Fix any failures caused by Tasks 1-2 (only in the files already listed in files_modified). Do not act on the brief's voice open question beyond the single locked copy line.</action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx vitest run && npx tsc --noEmit</automated>
  </verify>
  <done>npx vitest run passes with 0 failures and npx tsc --noEmit exits 0.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Pure layout/copy/class changes; no new inputs, endpoints or data flows |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260929-01 | Tampering | Item name/price/qty inputs | accept | Existing maxLength and server-side validation in handleInlineSubmit/commitRow are kept unchanged |
</threat_model>

<verification>
- npx vitest run and npx tsc --noEmit both pass.
- Manual (optional, at 375px): pencil on "Margherita Pizza" shows full name; Add item form matches; bottom bar white with top border; home scan card shows new sentence.
</verification>

<success_criteria>
All three brief tasks implemented as specified, SetupStep scan-review row fixed (name was ~111px < 120px), no other copy/token/layout changed, suite and typecheck green.
</success_criteria>

<output>
Create `.planning/quick/260929-hll-design-steward-fixes-item-name-row-scan-/260929-hll-SUMMARY.md` when done. Note in the summary the ~111px width estimate that triggered the SetupStep fix and that the "I vs we" voice question remains open for the user.
</output>
