---
slug: multi-qty-split-calc-errors
status: resolved
trigger: "UAT round 4 (G1): calculation errors in the bill split, particularly with multi-quantity items shared between people"
created: 2026-06-19
updated: 2026-06-19
---

# Debug Session: Multi-Quantity Split Calculation Errors

## Symptoms

DATA_START
- **Expected behavior:** When a line item with quantity > 1 is shared between people, each person's share should add back up to the exact line total (no cents lost or gained), and the share shown on the item card should match the amount the person is actually billed on the Results screen.
- **Actual behavior:** Per-person shares of a multi-unit shared item don't reconcile to the line total (stray cents lost/gained). The share amount shown on the item card can disagree with the amount billed on the Results screen.
- **Error messages:** None — silent arithmetic discrepancy (user-visible wrong totals, not a crash).
- **Timeline:** Surfaced during v2.0 UAT round 4 (2026-06-19). Not previously isolated.
- **Reproduction:** Create/scan a bill containing at least one line item with quantity > 1 (e.g. "Beer ×3"). Have multiple people claim units of that item. Compare each person's per-item share on the item card vs. their billed total on the Results screen, and check whether the per-person shares sum to the item's line price.
DATA_END

## Investigator's Suspected Area (hypothesis seed)

DATA_START
- `lib/billMath.ts` → `computePersonShareFromClaims`: the proportional path uses independent
  `Math.round((item.priceCents * myQty) / totalQty)` per claimant, which does NOT conserve cents
  for multi-qty items (each round is independent → sum can be ±cents off the line total).
  The single-unit path uses largest-remainder via `computeEqualShareCents` (which IS exact),
  so the two paths can disagree → card (one method) vs billed (other method) mismatch.
- Also verify `item.priceCents` is consistently the FULL LINE price (not per-unit) end-to-end:
  OCR (app/api/ocr/route.ts) → store (stores/useBillStore.ts addItem) → claim route → results.
  A per-unit vs line-total mismatch anywhere would cause quantity-proportional errors.
- Cross-check the card display helper (computeEqualShareCents / ClaimableItemCard) against the
  billed helper (computePersonShareFromClaims / PersonResultsScreen) for the SAME item to confirm
  the display-vs-billed divergence.
DATA_END

## Current Focus

hypothesis: CONFIRMED — multi-qty proportional split used independent Math.round per claimant, losing cent-conservation and diverging from the largest-remainder method used for display.
test: reproduced via integer-cents arithmetic on multiple price/qty distributions.
expecting: shares to sum to line price; they did not.
next_action: (resolved) — quantity-weighted largest-remainder applied; tests added; suite green.

## Evidence

- timestamp: 2026-06-19 — `lib/billMath.ts:147-159` confirmed the dual-path bug. The
  `allSingle` branch (`item.quantity <= 1 && every claimant qty === 1`) used exact
  largest-remainder `computeEqualShareCents`; EVERY other case (any multi-qty item, OR any
  claimant holding qty > 1) fell to the `else` branch `Math.round(priceCents * myQty / totalQty)`,
  which rounds each claimant independently and does not conserve cents.

- timestamp: 2026-06-19 — Reproduced cent-loss with integer-cents arithmetic (no floats):
  - 3-qty $10.00 item, 1 unit each (3 people): 333 + 333 + 333 = **999** → 1¢ LOST.
  - 6-qty $10.00 item, 1 unit each: 167 × 6 = **1002** → 2¢ GAINED.
  - 7-qty $13.49, qtys [2,2,3]: 385 + 385 + 578 = **1348** → 1¢ LOST.
  - $5.05, 4 ×1: 126 × 4 = **504** → 1¢ LOST.
  The proportional path drifts ±1..±2¢ off the line total whenever the price doesn't divide cleanly.

- timestamp: 2026-06-19 — Display-vs-billed divergence confirmed.
  `components/split/ClaimableItemCard.tsx:86` rendered the per-person "your share" line ONLY when
  `!isMultiQty` (single-qty items), via exact `computeEqualShareCents`. Multi-qty items showed NO
  per-person share on the card at all, while `components/split/PersonResultsScreen.tsx:296-308`
  billed each `shareCents` from the unconserved proportional path → card and Results could disagree,
  and for single-qty multi-claimant items the two methods produced different cents (e.g. card $3.34
  vs proportional 333).

- timestamp: 2026-06-19 — `priceCents = full-line-price` invariant VERIFIED end-to-end (NOT the bug):
  - OCR `app/api/ocr/route.ts:19` prompt: "For items with quantity > 1, priceCents is the TOTAL price for all units."
  - Store `stores/useBillStore.ts:114-116` `addItem` stores priceCents unchanged.
  - `computeSubtotalCents` (billMath.ts:50) sums priceCents WITHOUT multiplying by quantity.
  - The proportional formula correctly weights by claimed-qty / total-claimed-qty, NOT by item.quantity.
  Conclusion: no per-unit/line-total mismatch anywhere; the bug was purely the rounding method.

- timestamp: 2026-06-19 — Existing test `__tests__/billMath.test.ts` (the "CR-01: multi-qty items
  still use proportional rounding" case) actively ENCODED the bug, asserting `r.itemSubtotal === 333`
  for a 3-qty $10 / 1-each split (the lost-cent result). Updated to assert the conserved 334/333/333.

## Eliminated

- Per-unit vs full-line `priceCents` mismatch in the OCR → store → claim → results chain
  (invariant verified consistent; subtotal and share formulas both treat priceCents as the line total).
- Float contamination in the calculation path (all paths use integer-cents `Math.floor`/`%`/`Math.round`;
  the fix keeps integer-cents arithmetic only — no floats introduced).

## Resolution

DATA_START
- **root_cause:** `computePersonShareFromClaims` billed multi-qty (and any qty>1) shared items with
  independent per-claimant `Math.round(priceCents * myQty / totalQty)`. Independent rounding does not
  conserve cents — per-person shares summed to ±1..±2¢ off the line price — and diverged from the
  exact largest-remainder method used elsewhere, so the card-displayed share could disagree with the
  billed share. The `priceCents = full-line-price` invariant was sound; the defect was purely the
  rounding method on the multi-qty path.

- **fix:** Replaced the dual single-vs-multi rounding paths with one deterministic, quantity-weighted
  largest-remainder helper, `computeQtyWeightedShares(priceCents, sortedSharerIds, qtyById)` in
  `lib/billMath.ts`. It computes each claimant's floor share by claimed-qty weight, then distributes
  the exact leftover cents to the largest fractional parts (tie-broken by ascending personId index),
  guaranteeing the shares sum to `priceCents` exactly. Both the billed path
  (`computePersonShareFromClaims`) and the card display (`ClaimableItemCard`, now showing a per-person
  share for multi-qty items too) call this same helper with the same sorted claimant list, so
  display === billed for every claimant. All arithmetic stays in integer cents — no floats.
  - `lib/billMath.ts`: added `computeQtyWeightedShares`; rewrote `computePersonShareFromClaims` to use it;
    removed the `allSingle`/proportional `Math.round` branch.
  - `components/split/ClaimableItemCard.tsx`: import switched to `computeQtyWeightedShares`; "your share"
    now renders for any shared item (single- AND multi-qty) using the same helper.
  - `__tests__/billMath.test.ts`: corrected the bug-encoding test; added CR-02 tests asserting
    (a) multi-qty per-person shares sum exactly to the line price, (b) card-displayed share equals
    billed share for the same item, plus a `computeQtyWeightedShares` unit suite (conservation,
    leftover-cent placement, qty weighting, empty/zero-qty guards).

- **verification:** `npx vitest run __tests__/billMath.test.ts __tests__/ClaimableItemCard.test.tsx
  __tests__/CollaborativeClaimingView.test.tsx __tests__/sessionClaimRoute.test.ts` → 119 passed.
  `npx tsc --noEmit` → clean. (3 unrelated pre-existing failures in AddPeopleStep/AddItemsStep wizard
  tests confirmed failing on the clean baseline before any change.)
DATA_END


## Specialist Review

DATA_START
**Skill:** typescript-expert (specialist_hint: typescript)
**Result:** LOOKS_GOOD

The quantity-weighted largest-remainder fix is idiomatic for this codebase:
- Reuses the established largest-remainder pattern already proven in `computePersonTotals`
  and `computeEqualShareCents` rather than inventing a new approach.
- Maintains strict integer-cents arithmetic with no floats in the calculation path — honoring
  the project invariant. The only `/` and `%` operate on integers via `Math.floor`.
- Unifies display and billing on a single source of truth (`computeQtyWeightedShares`),
  eliminating the class of "two methods disagree" bugs structurally rather than patching one case.
- Deterministic tie-break (ascending personId index) matches the existing Phase 9 determinism rule,
  so results are stable across devices/renders.

TypeScript note (non-blocking): the helper returns `Record<PersonId, number>`; callers correctly
guard missing keys with `?? 0` / `?? null`. Safe under the project's current tsconfig.
DATA_END
