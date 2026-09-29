# Brief: edit screen, each scanned item in its own card

Source: Design Steward review `review-20260929-editscreen2`. User note `dictated_001`: *"each editable menu item should be in a group like this. style is the same with the edit on the assigning screen."* The user drew 6 rectangles, each boxing one item (name row + price/qty/delete row), then said "build it".

## Change
- In `components/wizard/ScanItemsEditor.tsx` (the item `<ul>` at ~:126, each `<li>` at ~:130), wrap each item's two rows in its own card.
- Use the same styling as the inline item-edit card on the split ("assigning") screen: `app/split/[sessionId]/CollaborativeClaimingView.tsx` ~:662 uses `<Card className="flex flex-row items-start gap-2 px-4 py-3">` from `@/components/ui/card`. Reuse the `Card` component with equivalent padding (`px-4 py-3`). Inside the card, the name row (full width) sits above the price/qty/delete row, as today.
- Keep the gap between cards (`gap-3` on the list), so items read as separate groups.
- Do not change the heading, the summary card, Add item, Done, handlers, aria-labels or test ids.

## Acceptance (mobile 375px)
- Each of the scanned items renders inside its own Card (white surface, border, rounded), containing its name input and its price/qty/delete row.
- The name input still spans the card's content width, and there is no horizontal scroll.
- Existing ScanItemsEditor tests still pass. Add one test asserting each item's inputs are inside a `[data-slot="card"]` element, one card per item.
