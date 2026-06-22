# Scan Failure Modes & Warning Copy Catalogue (G2.3)

Reference for how the app detects and handles imperfect receipt scans. Detection
happens in `lib/reconcileScannedBill.ts` (pure reconciliation) and the OCR route
`app/api/ocr/route.ts` (auto-retry). User-facing copy lives in
`components/wizard/SetupStep.tsx` (scan guardrail + scan-review screen) and
`components/split/ClaimableItemCard.tsx` (claim-time over-claim). All cents math is
integer-only; `TOLERANCE_CENTS = 2` is the completeness slack.

### Truth figure: subtotal vs grand total (260622-q3m)

The OCR route captures **two** printed figures, each nullable:

- `subtotalCents` — the printed **PRE-TAX items subtotal** (the figure the line items
  themselves should sum to, before tax/service/tip).
- `grandTotalCents` — the **final printed total** the customer pays, after tax/service/tip.

Line items are reconciled against the **truth figure**:
`reconcileTarget(pass) = pass.subtotalCents ?? pass.grandTotalCents` — the pre-tax
subtotal when printed, falling back to the grand total otherwise. `reconcileScannedBill`
itself is agnostic: it just receives the chosen target as its `subtotalCents` option.
`SetupStep` computes the same `targetCents = subtotalCents ?? grandTotalCents` client-side.
`grandTotalCents` is **scan-time-only** — it is NOT stored in the session payload
(`lib/sessionSchema.ts` unchanged); the app tracks no tax/tip/service.

### Soft-gate scan-review screen (260622-q3m)

When a scan still does not reconcile to the truth figure **after the server's retry**,
`SetupStep` replaces the old passive amber banner with an **editable review block**
(`data-testid="scan-review"`): one row per item (name / price / qty inputs + delete),
an **Add item** button, and a live gap line. All edits go through the existing store
actions `addItem` / `updateItem` / `removeItem` — no silent price-fudging; a gap is
only ever closed by re-read (retry) then human confirmation.

The gate is **soft**: the user must see and confirm, but can proceed even if still off.
In review mode the Continue CTA relabels to **"Confirm & continue"** and stays enabled;
a subtle hint shows while a gap remains. Clean scans skip the review block entirely.

| # | Scenario | Trigger | Detection (field / flag) | Behavior | Exact user-facing copy |
|---|----------|---------|--------------------------|----------|------------------------|
| 1 | Missing line / dropped line | OCR omits a printed line; reconciled sum < truth figure | `completeness.mismatch === true` (`\|deltaCents\| > TOLERANCE_CENTS`), `hasSubtotal === true` (target = `subtotalCents ?? grandTotalCents`) | OCR route auto-retries once (see #2); if STILL mismatched after retry, show the editable **scan-review screen** at setup (soft gate). Never invents items. | Heading: `Please confirm or edit these detected items` (`data-testid="scan-review"`). Live gap: `Items add up to {sum} · Receipt {subtotal\|total} {target} · off by {delta}` (`data-testid="scan-review-gap"`). |
| 2 | Miscounted repeated identical lines (known weak spot — now mitigated) | Model collapses/under-counts duplicate lines; pass-1 sum ≠ truth figure | Pass-1 `completeness.mismatch === true` AND `reconcileTarget(pass1) != null` (subtotal else grand total) | **Auto-retry exactly once** with a corrective instruction; keep whichever pass reconciles closer (cap 2 passes). Identical client contract. | Retry prompt (server-side, not shown to user): `Your previous reading summed to {reconciledSum} but the printed total is {subtotal} (off by {delta}). You likely missed or miscounted a repeated line. Re-read every line — including identical duplicates — and return the corrected full list.` |
| 3 | Unit-price-vs-line-total confusion | Receipt prints both unit price and line total but `unit × qty ≠ total` | `reconcileLine`: conflict branch sets `corrected = true`; printed total wins | Auto-corrected silently (printed total trusted); count surfaced as a status note. | 1 line: `1 price was adjusted to match the receipt total.` / N lines: `{N} prices were adjusted to match the receipt totals.` (`data-testid="guardrail-corrected"`) |
| 4 | No printed total on receipt | Receipt prints neither subtotal NOR grand total | `reconcileTarget(pass) === null` → `completeness.hasSubtotal === false` | Checksum can't run → **no retry, no review**. Items pass through as read. | (none) |
| 5 | Tax / tip / subtotal misread as an item | A total/tax/tip row is captured as a line item | Not directly flagged; inflates `reconciledSumCents` → may trip `completeness.mismatch` if a truth figure exists | If it pushes sum past the truth figure, the scan-review screen (#1) fires; user edits or deletes the bogus row, or confirms anyway. Prompt explicitly excludes subtotal/tax/tip/total lines. | Same as #1 (`data-testid="scan-review"`). |
| 6 | Currency misread | Model returns wrong/garbled/missing currency code | `parseOcrResponse`: `rawCode` fails `/^[A-Za-z]{3}$/` | Falls back to app default `USD` (CURR-01 / D-01). Silent. | (none — display uses the resolved code) |
| 7 | Float price returned | Model emits a non-integer cents value (e.g. `12.99`) | `toIntCentsOrNull`: `Number.isInteger(v)` fails → null | Field coerced to null. If both unit and line total become null, line is dropped (#8). | (none — silent coercion) |
| 8 | Zero / negative price dropped | A line has no usable positive-integer price | `toIntCentsOrNull` returns null for both fields; route `.filter` drops lines where name is null OR both prices null | Line silently dropped. May shrink `reconciledSumCents` and trip #1 if a subtotal exists. | (none directly; #1 may follow) |
| 9 | Over-claim at claim time | Two+ people claim more units than exist | `ClaimableItemCard`: `totalClaimedQty > item.quantity` → `isOverClaimed`; increment disabled at `myQty >= remainingForMe` | Increment button disabled at the per-person remaining cap; over-claimed count shown in red. WR-04 clamps remaining at 0. | `{totalClaimedQty} of {N} claimed — over-claimed` (red, `data-testid="claimed-count"`) |

## Notes

- **Single-pass clean scan** (sum reconciles within tolerance, or no truth figure):
  exactly one OpenAI call, no review screen, no retry. Clean scans show the thumbnail +
  "N items found" chip and Continue ("Start splitting") unchanged.
- **Auto-retry** only fires for scenario #2's trigger condition (truth figure present
  — `subtotalCents ?? grandTotalCents` — AND mismatch). It is capped at 2 total passes;
  a thrown/empty retry falls back to pass 1 (the usable result is never lost).
- **Scan-review screen** appears ONLY when items still don't reconcile after that
  retry (locked decision 1). It is a **soft gate** (decision 2): "Confirm & continue"
  proceeds even while a gap remains. Edits use the existing store actions; there is
  **no silent price-fudging** — alignment is re-read (retry) then human confirm.
- The `corrected` auto-fix (#3) and the scan-review screen (#1) are independent —
  a scan can show both (some prices adjusted AND still short of the truth figure).
  The "{N} prices were adjusted" note (`data-testid="guardrail-corrected"`) is shown
  only for clean scans (not while the review block is up).
- All gates are advisory. The user can always Confirm & continue, Retake, or edit
  items inline in the review screen / bill view.
