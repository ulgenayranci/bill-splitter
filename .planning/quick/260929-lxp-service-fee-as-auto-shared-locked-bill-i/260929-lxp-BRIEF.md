# Brief: service fee as an automatically shared bill item

User request (2026-09-29), verbatim: *"ok we need to ad service fee as an item if there is any at the receipt. so that the people can itemize and share that as well. if there is a service fee, automatically split it to eash persons items,an it is selected on their itemization secreen as well"*

## Locked user decisions (asked 2026-09-29)
1. **Split:** equally among all people in the bill (not proportional to what they ordered).
2. **Always included:** shown as selected on every person's itemization (claiming) screen and **cannot be un-selected**.
3. **Late joiners:** anyone who joins later (e.g. via "I'm not listed") automatically gets an equal share; shares recalculate.

## Current behaviour (facts)
- `app/api/ocr/route.ts` prompt line ~26: "Exclude subtotals, tax, tip, and total lines from items". Service charge is never captured. `subtotalCents` is the pre-tax ITEMS subtotal and `grandTotalCents` includes service/tax/tip.
- The setup step reconciles scanned items against `subtotalCents` (else `grandTotalCents`) via `reconcileScannedBill`. A mismatch opens the ScanItemsEditor (step 2) with an "Off by" summary.
- Claiming happens on `/split/[sessionId]` (CollaborativeClaimingView + ClaimableItemCard). Single-qty items can be shared by several claimants (equal split). Claims are stored per item → person in Upstash (`SessionClaims`).
- Results: PersonResultsScreen (per-person totals, "Unclaimed items" section, tip).
- Money math lives in `lib/billMath.ts` (cents, integer). A June 2026 billing fix divides partial claims by item.quantity (see computeQtyWeightedShares).

## Required behaviour
- **OCR:** capture a printed service charge / service fee / "coperto" / cover charge amount as a separate top-level field (e.g. `serviceFeeCents`, null if none). Do NOT put it in `items`. Keep the items-vs-subtotal self-check unchanged.
- **Bill:** if a service fee exists, the bill gets a dedicated service-fee line item (clearly labelled, e.g. "Service fee") that:
  - is excluded from the scan reconciliation (it must not cause or hide an "Off by" mismatch on the items subtotal),
  - appears on the claiming screen for every person as **selected and locked** (no tap to un-claim, no qty stepper; visually consistent with a claimed card but clearly non-interactive, e.g. a lock or "Shared by everyone" line),
  - is split **equally among all current people**, recomputed when people join, with integer-cent rounding that sums exactly to the fee (distribute leftover cents deterministically),
  - is NOT counted as "unclaimed" and never blocks "I'm done",
  - appears in each person's results breakdown and totals, and in the grand total.
- The service fee must not be editable into a normal item by accident. Whether it appears in the ScanItemsEditor list is the planner's call. If shown, it should be read-only or clearly separate, and must never count toward the items subtotal gap.
- Existing sessions without a service fee must behave exactly as today (backward compatible persisted state / session payload).

## Out of scope
- Tax handling, tip changes, proportional splitting.

## Acceptance (mobile 375px)
- Scan a receipt with a €5.00 service fee and 2 people: bill shows a "Service fee" line; each person's claiming screen shows it selected and locked; results show €2.50 each, included in totals and the grand total.
- 3 people and €5.00: shares €1.67 / €1.67 / €1.66 (sums to €5.00).
- A person joining later: all shares recalculate equally.
- Tapping the service-fee card does nothing (no un-claim). The unclaimed count ignores it.
- A receipt without a service fee: no service-fee line anywhere, and everything as before.
- Unit tests for the OCR field parsing, the equal-split rounding, the locked card, results totals and late-join recalculation. Full `npx vitest run` green (currently 387/387) and `npx tsc --noEmit` clean.
