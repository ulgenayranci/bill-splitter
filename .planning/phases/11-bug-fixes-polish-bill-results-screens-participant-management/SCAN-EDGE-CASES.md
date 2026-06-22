# Scan Failure Modes & Warning Copy Catalogue (G2.3)

Reference for how the app detects and handles imperfect receipt scans. Detection
happens in `lib/reconcileScannedBill.ts` (pure reconciliation) and the OCR route
`app/api/ocr/route.ts` (auto-retry). User-facing copy lives in
`components/wizard/SetupStep.tsx` (scan guardrail) and
`components/split/ClaimableItemCard.tsx` (claim-time over-claim). All cents math is
integer-only; `TOLERANCE_CENTS = 2` is the completeness slack.

The scan guardrail is **non-blocking** — Continue is never gated on it. Manual edit
already exists in the bill view; no new editing UI is added.

| # | Scenario | Trigger | Detection (field / flag) | Behavior | Exact user-facing copy |
|---|----------|---------|--------------------------|----------|------------------------|
| 1 | Missing line / dropped line | OCR omits a printed line; reconciled sum < printed total | `completeness.mismatch === true` (`\|deltaCents\| > TOLERANCE_CENTS`), `hasSubtotal === true` | OCR route auto-retries once (see #2); if still mismatched, warn at setup. Never invents items. | `Your items add up to {sum}, but the receipt total is {total}. An item may be missing or misread — Retake, or add it manually.` (`data-testid="guardrail-completeness"`) |
| 2 | Miscounted repeated identical lines (known weak spot — now mitigated) | Model collapses/under-counts duplicate lines; pass-1 sum ≠ printed total | Pass-1 `completeness.mismatch === true` AND `subtotalCents != null` | **Auto-retry exactly once** with a corrective instruction; keep whichever pass reconciles closer (cap 2 passes). Identical client contract. | Retry prompt (server-side, not shown to user): `Your previous reading summed to {reconciledSum} but the printed total is {subtotal} (off by {delta}). You likely missed or miscounted a repeated line. Re-read every line — including identical duplicates — and return the corrected full list.` |
| 3 | Unit-price-vs-line-total confusion | Receipt prints both unit price and line total but `unit × qty ≠ total` | `reconcileLine`: conflict branch sets `corrected = true`; printed total wins | Auto-corrected silently (printed total trusted); count surfaced as a status note. | 1 line: `1 price was adjusted to match the receipt total.` / N lines: `{N} prices were adjusted to match the receipt totals.` (`data-testid="guardrail-corrected"`) |
| 4 | No printed total on receipt | Receipt prints no subtotal/grand total | `completeness.hasSubtotal === false` (`subtotalCents` null) | Checksum can't run → **no retry, no warning**. Items pass through as read. | (none) |
| 5 | Tax / tip / subtotal misread as an item | A total/tax/tip row is captured as a line item | Not directly flagged; inflates `reconciledSumCents` → may trip `completeness.mismatch` if a subtotal exists | If it pushes sum past the printed total, the completeness warning (#1) fires; user retakes or edits. Prompt explicitly excludes subtotal/tax/tip/total lines. | Same as #1 (`data-testid="guardrail-completeness"`). |
| 6 | Currency misread | Model returns wrong/garbled/missing currency code | `parseOcrResponse`: `rawCode` fails `/^[A-Za-z]{3}$/` | Falls back to app default `USD` (CURR-01 / D-01). Silent. | (none — display uses the resolved code) |
| 7 | Float price returned | Model emits a non-integer cents value (e.g. `12.99`) | `toIntCentsOrNull`: `Number.isInteger(v)` fails → null | Field coerced to null. If both unit and line total become null, line is dropped (#8). | (none — silent coercion) |
| 8 | Zero / negative price dropped | A line has no usable positive-integer price | `toIntCentsOrNull` returns null for both fields; route `.filter` drops lines where name is null OR both prices null | Line silently dropped. May shrink `reconciledSumCents` and trip #1 if a subtotal exists. | (none directly; #1 may follow) |
| 9 | Over-claim at claim time | Two+ people claim more units than exist | `ClaimableItemCard`: `totalClaimedQty > item.quantity` → `isOverClaimed`; increment disabled at `myQty >= remainingForMe` | Increment button disabled at the per-person remaining cap; over-claimed count shown in red. WR-04 clamps remaining at 0. | `{totalClaimedQty} of {N} claimed — over-claimed` (red, `data-testid="claimed-count"`) |

## Notes

- **Single-pass clean scan** (sum reconciles within tolerance, or no subtotal):
  exactly one OpenAI call, no warning, no retry.
- **Auto-retry** only fires for scenario #2's trigger condition (printed total present
  AND mismatch). It is capped at 2 total passes; a thrown/empty retry falls back to
  pass 1 (the usable result is never lost).
- The `corrected` auto-fix (#3) and the completeness warning (#1) are independent —
  a scan can show both (some prices adjusted AND still short of the total).
- All warnings are advisory. The user can always Continue, Retake, or manually edit
  items in the bill view.
