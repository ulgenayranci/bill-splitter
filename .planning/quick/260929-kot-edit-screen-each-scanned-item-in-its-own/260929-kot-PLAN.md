---
phase: quick-260929-kot
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/wizard/ScanItemsEditor.tsx
  - __tests__/ScanItemsEditor.test.tsx
autonomous: true
requirements: [QUICK-260929-kot]

must_haves:
  truths:
    - "On the edit-scanned-items screen, each scanned item renders inside its own Card (data-slot=\"card\"): white surface, ring border, rounded-xl, same look as the inline item-edit card on the /split screen"
    - "Each card contains exactly that item's name input (full content width, top row) and its price/qty/delete row (below)"
    - "Cards are visually separated by the list's gap-3; one card per item"
    - "At 375px there is no horizontal scroll; the name input spans the card's content width"
    - "Heading, summary card, Add item, Done, all handlers, aria-labels and test ids are unchanged"
  artifacts:
    - path: "components/wizard/ScanItemsEditor.tsx"
      provides: "Per-item Card wrapper inside each <li>"
      contains: "@/components/ui/card"
    - path: "__tests__/ScanItemsEditor.test.tsx"
      provides: "Test asserting one card per item containing that item's inputs"
      contains: "data-slot=\"card\""
  key_links:
    - from: "components/wizard/ScanItemsEditor.tsx"
      to: "components/ui/card.tsx"
      via: "import { Card } from '@/components/ui/card'"
      pattern: "import \\{ Card \\} from '@/components/ui/card'"
---

<objective>
Wrap each scanned item on the edit screen (ScanItemsEditor) in its own Card so every item reads as a separate group, styled like the inline item-edit card on the split ("assigning") screen.

Purpose: User request (Design Steward review-20260929-editscreen2, note dictated_001): "each editable menu item should be in a group like this. style is the same with the edit on the assigning screen."
Output: Updated ScanItemsEditor.tsx plus one new test. The BRIEF's acceptance criteria are binding.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/quick/260929-kot-edit-screen-each-scanned-item-in-its-own/260929-kot-BRIEF.md
@components/wizard/ScanItemsEditor.tsx
@__tests__/ScanItemsEditor.test.tsx

<interfaces>
From components/ui/card.tsx:
- `Card({ className, size = "default", ...props }: React.ComponentProps<"div"> & { size?: "default" | "sm" })` renders a div with `data-slot="card"` and base classes including `flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10`. className is merged via cn() (tailwind-merge), so `gap-2` and `py-3` override `gap-4`/`py-4`.

Reference styling on the split screen (app/split/[sessionId]/CollaborativeClaimingView.tsx ~:662):
`<Card className="flex flex-row items-start gap-2 px-4 py-3">` wrapping a `flex flex-1 flex-col gap-2` column of name input, then the price row.

Current ScanItemsEditor structure (~:126-179):
`<ul className="flex flex-col gap-3">` -> per item `<li key={item.id} className="flex flex-col gap-2">` containing the "Item name" Input (className `h-10 w-full bg-white text-base`), then a `<div className="flex items-center gap-2">` with Price Input (w-20), Quantity Input (w-12) and the Remove button (h-10 w-10).

Test seed helper in __tests__/ScanItemsEditor.test.tsx: `seed()` loads 2 items (i1 "Widget" 1000c, i2 "Fries" 400c) and sets step 2. Tests use `render(<ScanItemsEditor />)`, `screen.getAllByLabelText(...)`, `cleanup` in afterEach.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: One Card per scanned item (test first, then wrap)</name>
  <files>__tests__/ScanItemsEditor.test.tsx, components/wizard/ScanItemsEditor.tsx</files>
  <behavior>
    - New test "each item sits in its own card": after seed() + render, `container.querySelectorAll('[data-slot="card"]')` has length equal to the item count (2). For each index i, the i-th "Item name", "Price" and "Quantity" inputs (getAllByLabelText) all have `closest('[data-slot="card"]')` equal to the i-th card, and the Remove button for that item (e.g. /remove widget/i for i=0, /remove fries/i for i=1) is inside the same card. The summary element (scan-review-gap) is NOT inside any `[data-slot="card"]` (guards against wrapping the wrong thing).
    - All existing ScanItemsEditor tests still pass unchanged.
  </behavior>
  <action>
RED: Add the test above to __tests__/ScanItemsEditor.test.tsx inside the existing describe block (use the `container` returned by render). Run it; it must fail (no cards today). Commit as test(quick-260929-kot).

GREEN: In components/wizard/ScanItemsEditor.tsx add `import { Card } from '@/components/ui/card'`. Keep the `<ul className="flex flex-col gap-3">` exactly as is (gap between cards per BRIEF). Keep the `<li key={item.id}>` but drop its flex classes (it becomes a plain wrapper; leave className off or empty). Inside the li, render `<Card className="flex flex-col gap-2 px-4 py-3">` and move the existing two children (the "Item name" Input and the price/qty/delete `div`) into it unchanged. Rationale: this matches the split-screen card's padding (px-4 py-3) and inner gap-2; we use flex-col directly on the Card instead of the split screen's flex-row + inner flex-1 column because there is no side action column here, so the name input spans the full card content width as the BRIEF requires. Do NOT touch the heading, the scan-review-gap summary, Add item, Done, handlers, aria-labels, maxLength or test ids. Leave the inputs' `bg-white` classes as they are. The Card's built-in overflow-hidden is fine: px-4/py-3 padding leaves room for input focus rings. Width check at 375px: price w-20 + qty w-12 + trash w-10 + gaps fits well inside the card, so no horizontal scroll. Update the component JSDoc comment with one short clause noting each item is shown in its own card. Run the tests; commit as feat(quick-260929-kot).
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx vitest run __tests__/ScanItemsEditor.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>New card test passes along with all prior ScanItemsEditor tests; tsc reports no errors; each item's name input and price/qty/delete row are inside a single Card, one card per item.</done>
</task>

<task type="auto">
  <name>Task 2: Full-suite regression check</name>
  <files>(none modified; verification only)</files>
  <action>Run the full vitest suite. The only acceptable failures are the 15 pre-existing failures on main in AppHeader, BillViewHeader, ClaimableItemCard, CollaborativeClaimingView (Test 26), InvitePeopleStep, PersonResultsScreen and WizardShell test files. If any failure appears in a different file, or the failing count in those files grows beyond 15, investigate and fix it before finishing (it would be a regression from Task 1). Record the pass/fail counts in the SUMMARY.</action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx vitest run 2>&1 | tail -40</automated>
  </verify>
  <done>Full suite shows no failures outside the 15 known pre-existing ones; ScanItemsEditor tests all green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Pure presentational change inside a client component; no new input paths, network calls or data handling |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260929-kot-01 | Tampering | ScanItemsEditor item inputs | accept | Existing validation (maxLength, parseCents, qty integer check in commitRow) is unchanged; wrapper markup only |
</threat_model>

<verification>
- `npx vitest run __tests__/ScanItemsEditor.test.tsx` all green, including the new card test
- `npx tsc --noEmit` clean
- Full `npx vitest run`: only the 15 known pre-existing failures
- `grep -n "@/components/ui/card" components/wizard/ScanItemsEditor.tsx` returns the import
</verification>

<success_criteria>
- Each scanned item renders in its own Card (data-slot="card", rounded, ring border, card surface) with px-4 py-3 padding, matching the split screen's edit card
- Name input full width on top; price/qty/delete row below, inside the same card
- Cards separated by gap-3; heading, summary, Add item, Done, handlers, aria-labels, test ids unchanged
- No new test failures
</success_criteria>

<output>
Create `.planning/quick/260929-kot-edit-screen-each-scanned-item-in-its-own/260929-kot-SUMMARY.md` when done
</output>
