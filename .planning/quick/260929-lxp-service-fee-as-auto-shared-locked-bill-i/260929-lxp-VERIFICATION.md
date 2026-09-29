---
status: human_needed
score: 8/8 must-haves verified in code; visual pass pending
---

# Quick 260929-lxp Verification: Service fee as auto-shared locked item

status: human_needed

## Automated
- `npx vitest run`: 26 files, 423/423 passed.
- `npx tsc --noEmit`: clean (no output).

## Truths
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OCR yields serviceFeeCents, never in items | VERIFIED | ocr/route.ts: prompt rule, strict schema property and `required`, toIntCentsOrNull parse, response `best.serviceFeeCents ?? undefined` |
| 2 | Fee neither causes nor hides "Off by" | VERIFIED | `itemsReconcileTarget` (subtotal wins; else grand minus fee; else null) used by both OCR retry target and SetupStep |
| 3 | Locked card on /split | VERIFIED (code) | ServiceFeeCard: no role/onClick/aria-pressed, check badge, Lock icon, "Shared by everyone"; rendered when session.serviceFeeCents > 0 |
| 4 | Equal split, exact cents | VERIFIED | `computeServiceFeeShares`: floor plus remainder to earlier people in array order (167/167/166) |
| 5 | Late joiners recalculate | VERIFIED | Shares derived from live `session.people` every render in the claiming view and results; no claim writes |
| 6 | Not unclaimed, never blocks done | VERIFIED | Fee is a scalar, not an item; `lib/sessionUtils.ts` has no serviceFee references |
| 7 | Results/totals include fee | VERIFIED | PersonResultsScreen passes the fee share into computePersonShareFromClaims; per-person row; grand total = items + fee; summary "owes" = items + fee; TipScreen total includes share |
| 8 | No-fee back-compat | VERIFIED | Optional field; session route omits key unless integer in (0, 10M]; store default null with no version bump; Lua scripts re-encode the whole session so the field round-trips |

## Money correctness
- Fee shares sum exactly to the fee for any non-empty people list. Person total = itemSubtotal + feeShare + tip. Grand total adds the whole fee once. No double counting: the fee is excluded from items, tip base (items only) and reconciliation.
- Grand-total-only receipts: target = grand - fee. Subtotal-printed receipts: target = subtotal, unchanged.
- The results grand total omits tips and unclaimed items, as before this change.

## Human verification needed (visual, 375px)
1. Scan or seed a bill with a 5.00 fee and 2 people: the claiming card looks selected and locked, does not wrap awkwardly, and tapping it does nothing.
2. Results screen: the service-fee row layout, the lock icon and the "shared by everyone" caption.
3. Setup status line and the editor read-only fee row layout.
4. Live late-join (I'm not listed) visually updates the share.

## Gaps
None found.
