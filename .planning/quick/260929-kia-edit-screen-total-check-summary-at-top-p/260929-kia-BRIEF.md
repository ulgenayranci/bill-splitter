# UX/UI Change Brief — easy billsy: edit scanned items screen

## Site
http://localhost:3000/#step-2 (`components/wizard/ScanItemsEditor.tsx`) · reviewed 2026-09-29 · mobile (375px) only
Capture: `.design-steward/review-20260929-editscreen/capture.json`, plus `dictated-notes.json` (chat clarification)

## Priority summary
1. Total check moves to the top as a summary; heading states the problem — user

## Issue 1: Total check first, clearer heading
Severity: high · Effort: S · Category: hierarchy · Location: `ScanItemsEditor.tsx` heading (:98–101) and `scan-review-gap` line (:168–179)
Viewport: mobile · Author: user · Source: `e5dafd15-d5e6-4742-85fd-c40788ac60a7:note_001` + `clarify_001`

### Problem
Pinned note on the total line: *"move to the top and correct the hierarcy of the UI"*. User reply: *"leave the item lists below. change the heading"*. User confirmed the proposed wording ("yes ok").
Today the "off by" check is a small 13px line at the very bottom, below 6 items and Add item, so the reason the screen opened is only visible after scrolling. The heading "Please confirm or edit these detected items" doesn't say what's wrong.

### Direction (confirmed)
- **Heading** — when the items don't match the receipt: **"Your items don't match the receipt"**. When opened via Edit on a scan that matches, or with no receipt total: **"Edit scanned items"**.
- **Total check moves directly under the heading**, above the item list, as a small summary card:
  - Primary: **"Off by €6.60"**, larger, in the warning colour (`text-warn`).
  - Secondary, smaller and muted: **"Receipt subtotal €65.00 · Your items €58.40"**. Say "total" instead of "subtotal" when the receipt had no subtotal, as today.
- **Item list stays below**, followed by Add item and Done, unchanged.

### Agent detail (not raised by the user, needed for completeness)
- The screen updates live as items are edited. When the gap falls within tolerance (the existing `TOLERANCE_CENTS`), the summary's primary line reads **"Matches the receipt"** in neutral styling, not the warning colour, and the heading switches to "Edit scanned items". Base the heading on the live gap, not the one-off scan flag, so it doesn't keep saying "don't match" after the user fixes the items.
- With no receipt total (`targetCents == null`), show no summary card, as today.

### Acceptance check
At 375px after the €58.40 vs €65.00 simulated scan:
- The first thing below the progress strip is the heading "Your items don't match the receipt". Directly under it is the summary card, with "Off by €6.60" in the warning colour and "Receipt subtotal €65.00 · Your items €58.40" underneath, all visible without scrolling.
- The item list follows, then Add item and Done.
- Editing a price so the items total €65.00 changes the card to "Matches the receipt" (not warning-coloured) and the heading to "Edit scanned items".
- Opening Edit on a clean scan shows "Edit scanned items".
- `data-testid="scan-review-gap"` stays on the summary element so existing tests and verification keep working.
