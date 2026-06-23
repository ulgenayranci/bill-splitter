---
slug: per-unit-split-overcharge
status: resolved
trigger: "the per-unit split is wrong: when someone claims fewer units than the item's quantity, computeQtyWeightedShares in lib/billMath.ts charges them the full line total instead of unit-price × claimed-qty. Divisor should be item.quantity (total units on the bill), not total claimed qty. Decision: unclaimed leftover units stay unbilled. Update billMath.test.ts accordingly"
created: 2026-06-24
updated: 2026-06-24
---

# Debug Session: Per-Unit Split Overcharges When Units Are Partially Claimed

## Symptoms

DATA_START
- **Expected behavior:** When an item has quantity N (e.g. Carlsberg ×13 @ 169 = 2197 total) and a person claims only some of the units, they should be billed `unit-price × claimed-qty` (claim 1 → 169; claim 6 → 1014). Units that nobody claims stay UNBILLED — no one absorbs the leftover cost (user decision 2026-06-24).
- **Actual behavior:** Claiming fewer units than the item quantity bills the claimant the FULL line total. Real example: Carlsberg ×13, total 2197. Mehmet claims 1 unit → billed TRY 2,197.00 (should be 169). When a second person claims 6 of the same item the totals get even more wrong. The app simultaneously and correctly shows the item as still "up for grabs" / unclaimed, contradicting the billing.
- **Error messages:** None — silent arithmetic error (user-visible wrong totals, not a crash).
- **Timeline:** Surfaced 2026-06-24 during testing. Distinct from the earlier resolved session `multi-qty-split-calc-errors` (2026-06-19), which fixed cent-conservation rounding but assumed all units are always claimed.
- **Reproduction:** Scan/create a bill with a multi-unit line item (quantity > 1). Have a person claim FEWER units than the total quantity. Check their billed total on the Results screen — it equals the whole line price instead of unit-price × their claimed qty.
DATA_END

## Investigator's Suspected Area (hypothesis seed)

DATA_START
- `lib/billMath.ts` → `computeQtyWeightedShares(priceCents, sortedSharerIds, qtyById)` (line ~128) and its
  caller `computePersonShareFromClaims` (line ~182). The weighting divisor is `totalQty = sum of CLAIMED
  qty across claimants`, NOT `item.quantity` (total units on the bill). So when only some units are
  claimed, the claimants split the FULL `priceCents` among themselves — e.g. 1 of 13 claimed →
  `2197 × 1/1 = 2197`. The function's stated contract ("shares sum to priceCents exactly") is itself wrong
  for partial claims: it should sum to `priceCents × totalClaimedQty / item.quantity`, leaving the
  unclaimed remainder unbilled.
- Intended fix shape: weight each claimant's share by `claimedQty / item.quantity` (the bill's total units),
  so a claimant owes `priceCents × claimedQty / item.quantity` ≈ `unitPrice × claimedQty`. Leftover
  (unclaimed) units contribute 0 to everyone. Keep integer-cents largest-remainder, but apply leftover-cent
  distribution only across the CLAIMED portion, not the unclaimed units.
- The UI already models partial claiming correctly: `components/split/ClaimableItemCard.tsx:56`
  (`fullyClaimed = totalClaimedQty >= item.quantity`) and `:72` (`remainingForMe`). Billing must be made
  consistent with this — display === billed.
- Cross-check: `ClaimableItemCard` "your share" line and `PersonResultsScreen` billed share both call
  `computeQtyWeightedShares`; both must reflect the new per-unit-of-item-quantity weighting so the card and
  Results agree, including when units are unclaimed.
- Guard the over-claim case: if `totalClaimedQty > item.quantity` (transient over-claim), do not divide by a
  smaller-than-claimed number and under/over-bill — decide whether divisor is `item.quantity` or
  `max(item.quantity, totalClaimedQty)`. Check existing clamp behavior at `ClaimableItemCard.tsx:68-73`.
- Tests: `__tests__/billMath.test.ts` currently ENCODES the all-units-claimed contract (shares sum to full
  priceCents). Those assertions must be revised for partial claims (sum = claimed portion; unclaimed = 0).
DATA_END

## Related (do not reopen)
- `.planning/debug/multi-qty-split-calc-errors.md` (resolved 2026-06-19): introduced
  `computeQtyWeightedShares` to fix cent-conservation. That fix is correct for the fully-claimed case; this
  session extends the model to partially-claimed items where leftover units stay unbilled.

## Current Focus

hypothesis: CONFIRMED — `computeQtyWeightedShares` used `totalClaimedQty` as divisor, not `item.quantity`.
test: Carlsberg priceCents=2197, quantity=13, claim {mehmet:1} → now correctly returns 169.
expecting: FIXED — claimant share = priceCents × claimedQty / item.quantity; unclaimed units billed to no one.
next_action: COMPLETE

## Evidence

- `lib/billMath.ts` line 137 (pre-fix): `const totalQty = sortedSharerIds.reduce(...)` used as divisor at line 149 — confirmed the bug.
- `computePersonShareFromClaims` (line 212) called `computeQtyWeightedShares` without passing `item.quantity` — confirmed partial claims got the wrong divisor.
- `ClaimableItemCard.tsx` line 95 (pre-fix): also called `computeQtyWeightedShares` without `item.quantity`.
- All 60 `billMath.test.ts` tests pass post-fix. Pre-existing test failures in other files (5 tests across ClaimableItemCard and PersonResultsScreen, related to amber color classes and unclaimed item DOM structure) confirmed pre-existing before this session.

## Eliminated

- `PersonResultsScreen.tsx` — no math in component; delegates entirely to `computePersonShareFromClaims`. Not the bug site.
- Over-claim path — handled with `Math.max(itemQty, totalClaimedQty)` guard in new code.

## Resolution

root_cause: `computeQtyWeightedShares` used `totalClaimedQty` (sum of claimed units) as the division denominator instead of `item.quantity` (total units on the bill). When only some units were claimed, the claimed total equalled the claimed subset (e.g. 1), so the single claimant absorbed the full line price.

fix: Added optional `itemQty` parameter to `computeQtyWeightedShares`. When provided, `divisor = max(itemQty, totalClaimedQty)` (over-claim guard included). Updated `computePersonShareFromClaims` to always pass `item.quantity ?? 1`. Updated `ClaimableItemCard` "your share" display call to also pass `item.quantity ?? 1`. Updated `__tests__/billMath.test.ts` with new partial-claim test cases and revised the `computeQtyWeightedShares` scan-guardrail test to pass `itemQty`. All 60 tests pass; `tsc --noEmit` clean.

files_changed:
  - lib/billMath.ts
  - components/split/ClaimableItemCard.tsx
  - __tests__/billMath.test.ts
