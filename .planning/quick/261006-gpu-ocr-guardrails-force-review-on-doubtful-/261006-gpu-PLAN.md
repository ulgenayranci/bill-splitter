---
phase: quick-261006-gpu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/scanSanityChecks.ts
  - __tests__/scanSanityChecks.test.ts
  - app/api/ocr/route.ts
  - __tests__/ocrRoute.test.ts
  - stores/useBillStore.ts
  - components/wizard/SetupStep.tsx
  - components/wizard/ScanItemsEditor.tsx
  - __tests__/SetupStep.test.tsx
  - __tests__/ScanItemsEditor.test.tsx
  - __tests__/useBillStore.test.ts
autonomous: true
requirements: [QUICK-261006-gpu]

must_haves:
  truths:
    - "A scan whose items don't add up to the printed total opens the review screen (unchanged behaviour)"
    - "A scan with no printed subtotal/total opens the review screen, which says 'No total found on the receipt — please check the items' instead of an 'Off by' line"
    - "A scan with any doubtful line (AI unsure, quantity > 10, price > 10x the bill's median, or a line that looks like a total/tax/tip) opens the review screen"
    - "Doubtful lines are highlighted on the review screen with a short reason: 'Hard to read', 'Unusual quantity', 'Unusual price', or 'Looks like a total/tax line'"
    - "A line's highlight disappears once the user edits that line"
    - "A clean scan (totals match, no doubtful lines) goes straight through on step 1 as today"
  artifacts:
    - path: "lib/scanSanityChecks.ts"
      provides: "Pure flagScannedLines + shouldForceScanReview functions"
      exports: ["flagScannedLines", "shouldForceScanReview", "SCAN_FLAG_REASONS", "ScanFlagReason"]
    - path: "__tests__/scanSanityChecks.test.ts"
      provides: "Unit tests for sanity checks and the routing decision"
    - path: "app/api/ocr/route.ts"
      provides: "Per-line confidence in strict schema, prompt, parser and response"
      contains: "confidence"
    - path: "stores/useBillStore.ts"
      provides: "Item.scanFlag field, cleared by updateItem"
      contains: "scanFlag"
  key_links:
    - from: "components/wizard/SetupStep.tsx"
      to: "lib/scanSanityChecks.ts"
      via: "flagScannedLines + shouldForceScanReview called after reconcileScannedBill in BOTH the expand-success and expand-fallback paths"
      pattern: "shouldForceScanReview\\("
    - from: "components/wizard/ScanItemsEditor.tsx"
      to: "Item.scanFlag"
      via: "renders reason chip + coral ring on flagged rows"
      pattern: "scanFlag"
    - from: "app/api/ocr/route.ts"
      to: "SetupStep reconcile input"
      via: "items[].confidence ('high'|'low') passed into reconcileScannedBill's existing confidence passthrough"
      pattern: "confidence"
---

<objective>
OCR guardrails: when a receipt scan is doubtful, FORCE the user through the review screen (ScanItemsEditor, store step 2) instead of silently continuing.

Purpose: The product owner has seen scans with missing/extra items and wrong prices/quantities. Today only a checksum mismatch WITH a printed total forces review. This plan adds (1) the AI's own per-line "I'm unsure" signal, (2) deterministic sanity checks, and (3) a single tested routing decision, with flagged lines highlighted on the review screen.

Output: new pure lib + tests, OCR route confidence field, store flag field, SetupStep routing, ScanItemsEditor highlighting and no-total copy.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@app/api/ocr/route.ts
@lib/reconcileScannedBill.ts
@components/wizard/SetupStep.tsx
@components/wizard/ScanItemsEditor.tsx

<interfaces>
Existing contracts the executor builds on (extracted, do not re-explore):

lib/reconcileScannedBill.ts
- `ReconcileInputLine` already has optional passthrough `confidence?: 'high' | 'low' | 'ambiguous'`; `ReconciledItem` copies it unchanged (lines ~30, ~44, ~122, ~132). ReconciledItem has `name`, `quantity`, `priceCents` (LINE TOTAL), `unitPriceCents`, `corrected`.
- `reconcileScannedBill(lines, { subtotalCents })` returns `{ items, completeness: { mismatch, subtotalCents, ... } }`; `TOLERANCE_CENTS = 2`; `itemsReconcileTarget(subtotal, grandTotal, serviceFee, tax)`.

stores/useBillStore.ts
- `interface Item { id; name; priceCents /* LINE TOTAL */; quantity; unitPriceCents?; rawName?; confidence?: 'high'|'low'|'ambiguous' }`
  NOTE: `Item.confidence` is OWNED BY /api/expand (name-expansion confidence) and `updateItem` sets it to 'high'. Do NOT reuse it for OCR doubt — add a separate field.
- `updateItem(id, name, priceCents, quantity?)` (line ~179) maps the item and returns `{ ...i, name, priceCents, quantity, unitPriceCents, confidence: 'high' }`.
- `interface ScanCheck { correctedCount; mismatch; targetCents: number | null; hasSubtotal }`.

app/api/ocr/route.ts
- `RECEIPT_PROMPT` string (rules list), `interface OcrItem { name; quantity; unitPriceCents: number|null; lineTotalCents: number|null }`, `parseOcrResponse(content)` maps raw items then filters; strict `json_schema` named `receipt_items` with item `properties` + `required: ['name','quantity','unitPriceCents','lineTotalCents']`, `additionalProperties: false`. Response: `NextResponse.json({ items: best.items, ... })`.

components/wizard/SetupStep.tsx
- OCR response type at line ~179 (`items: { name; quantity; unitPriceCents; lineTotalCents }[]`); empty items -> scan error branch (unchanged).
- `const reconciled = reconcileScannedBill(ocrItems, { subtotalCents: targetCents })` (~238).
- Expand-success path builds items by index from `expandData.items` + `reconciled.items[idx]` (~266-276), then `setScanCheck(...)` and `if (reconciled.completeness.mismatch && targetCents != null) setStep(2)` (~287).
- Expand-failure fallback builds items from `reconciled.items` (~294-301), same setScanCheck + same setStep(2) condition (~311).
- `reviewMode` (~96) = mismatch && target != null drives the "Still off by" footer copy — leave as is.

components/wizard/ScanItemsEditor.tsx
- `targetCents`, `isOff`, header `{isOff ? "Your items don't match the receipt" : "Edit scanned items"}`; gap block `{targetCents != null && (<div data-testid="scan-review-gap">...)}`; rows rendered as `<li><Card className="flex flex-col gap-2 px-4 py-3">` with name/price/qty Inputs; `commitRow` only writes (via updateItem) when a draft exists, i.e. the user typed in that row.

Design tokens (app/globals.css): warnings use `border-warn`, `ring-warn-soft`, `text-warn-strong` (coral family). Existing warning pattern in SetupStep ~340: `border border-warn ring-[3px] ring-warn-soft text-warn-strong`. Coral chip pattern: `rounded-full bg-coral-50` / `bg-coral-500 text-white`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure sanity-check + routing-decision lib (TDD)</name>
  <files>lib/scanSanityChecks.ts, __tests__/scanSanityChecks.test.ts</files>
  <behavior>
    flagScannedLines(lines) where each line is { name: string; quantity: number; priceCents: number /* line total */; unitPriceCents?: number; confidence?: 'high'|'low'|'ambiguous' }; returns { lineFlags: (ScanFlagReason | null)[] (same length/order as input), flaggedCount: number, emptyList: boolean }.
    - [] -> { lineFlags: [], flaggedCount: 0, emptyList: true }
    - clean 3-line bill (Burger 1200, Fries 450, Beer 2x500 line 1000) -> all null
    - confidence 'low' -> 'Hard to read'; 'ambiguous' also -> 'Hard to read'; 'high'/undefined -> null
    - quantity 11 -> 'Unusual quantity'; quantity 10 -> null
    - unit price > 10x median unit price with >= 3 items -> 'Unusual price' (e.g. 500, 600, 700, 80000); exactly 10x median -> null; only 2 items with a 100x gap -> null (rule needs >= 3 items)
    - unit price uses unitPriceCents when present, else round(priceCents / quantity) (so qty 4 line of 2000 is unit 500, not an outlier)
    - non-item names (case-insensitive, whole word): "TOTAL", "Sub Total", "Subtotal", "Tax", "VAT 8%", "KDV", "Tip", "Service charge", "Discount", "Change", "Cash", "Card", "Balance", "Toplam", "Ara Toplam", "MwSt", "IVA", "TVA", "Servis", "Indirim", "Nakit", "Kredi Karti" -> 'Looks like a total/tax line'
    - false positives NOT flagged: "Tipsy cocktail", "Taxi burger", "Totally vegan bowl", "Cardamom tea", "Cashew salad", "Changua soup", "Servisi" (Turkish suffixed form; only the whole word "Servis" is flagged)
    - one reason per line, priority: 'Looks like a total/tax line' > 'Unusual quantity' > 'Unusual price' > 'Hard to read'
    shouldForceScanReview({ itemCount, mismatch, targetCents, flaggedCount }) -> { forceReview: boolean; reasons: ('no-items'|'mismatch'|'no-total'|'flagged-lines')[] }
    - itemCount 0 -> forceReview true, reasons include 'no-items'
    - mismatch true + target 5000 -> true, ['mismatch']
    - target null (any mismatch value) -> true, includes 'no-total'
    - flaggedCount 2 with target present and no mismatch -> true, ['flagged-lines']
    - target present, no mismatch, flaggedCount 0, itemCount 3 -> { forceReview: false, reasons: [] }
    - multiple causes -> all listed in fixed order no-items, mismatch, no-total, flagged-lines
  </behavior>
  <action>
    RED: write __tests__/scanSanityChecks.test.ts (vitest, `import { describe, it, expect } from 'vitest'`, matching the style of __tests__/reconcileScannedBill.test.ts) covering every behavior bullet above; run it and confirm it fails.

    GREEN: create lib/scanSanityChecks.ts exporting:
    - `SCAN_FLAG_REASONS` as a const object { hardToRead: 'Hard to read', quantity: 'Unusual quantity', price: 'Unusual price', nonItem: 'Looks like a total/tax line' } and `type ScanFlagReason` = its value union. These exact strings are user-facing copy.
    - `ScanSanityLine` input interface (shape in behavior), `flagScannedLines`, `ScanReviewCause` type, `shouldForceScanReview`.
    - Constants `MAX_PLAUSIBLE_QUANTITY = 10`, `PRICE_OUTLIER_FACTOR = 10`, `MIN_ITEMS_FOR_PRICE_CHECK = 3` (strictly greater-than comparisons, per spec "quantity > 10", ">10x median").
    - Median: sort a copy of unit prices; even count -> average of the two middle values. Skip outlier check if median <= 0.
    - Non-item detection: a keyword list covering English + Turkish + common European receipt words: total, subtotal, sub total, sub-total, grand total, tax, taxes, vat, kdv, tip, tips, gratuity, service, service charge, servis, discount, indirim, change, cash, nakit, card, kart, kredi, credit, debit, balance, amount due, toplam, ara toplam, tutar, mwst, ust, tva, iva, rabatt, sconto, trinkgeld, mancia, propina, pourboire, coperto. Build ONE case-insensitive Unicode regex where each keyword is wrapped in letter/digit lookarounds — `(?<![\p{L}\p{N}])` before and `(?![\p{L}\p{N}])` after, flags `iu` — so "Tipsy", "Taxi", "Totally", "Cardamom", "Cashew", "Servisi" do NOT match. Escape keywords; allow multi-word keywords to match on whitespace or hyphen between words. Comment the list as intentionally conservative (whole words only) so it errs toward not flagging real dishes.
    - shouldForceScanReview: pure, builds reasons in the fixed order; forceReview = reasons.length > 0.
    No React, no store imports — pure functions only. Run tests until green; refactor if needed.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx vitest run __tests__/scanSanityChecks.test.ts</automated>
  </verify>
  <done>All behavior cases pass; lib has no imports from React/stores; exported reason strings exactly match the four required labels.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: AI per-line confidence in the OCR route</name>
  <files>app/api/ocr/route.ts, __tests__/ocrRoute.test.ts</files>
  <behavior>
    - Model item with confidence "low" -> response item has confidence 'low'
    - Model item with confidence "high" -> 'high'
    - Missing / garbage confidence (e.g. "maybe", 3, absent) -> defaults to 'high' (never drops the line, never fails the request)
    - Existing tests (retry, subtotal, currency, drop-when-both-prices-null) still pass; update their expected item objects to include confidence where they use toEqual on items
  </behavior>
  <action>
    In app/api/ocr/route.ts:
    - Add to the strict json_schema item `properties`: `confidence: { type: 'string', enum: ['high', 'low'] }`, and add 'confidence' to that item's `required` array (strict mode requires every property in required).
    - Add `confidence: string` to the JSON shape line at the top of RECEIPT_PROMPT and a new rule bullet: confidence is "high" when the line's name, quantity and price were clearly printed and read; "low" when the line was hard to read (faded, cut off, blurry, overlapping), or when the quantity or price was guessed/inferred rather than read. Place it next to the existing "If you cannot read an item clearly, include your best guess." rule and extend that rule with "and mark it confidence \"low\"".
    - Extend `interface OcrItem` with `confidence: 'high' | 'low'`. In `parseOcrResponse`'s item map, set `confidence = i.confidence === 'low' ? 'low' : 'high'` and include it in the returned object; extend the filter's type guard accordingly. The retry pass reuses the same schema/parser so it gets confidence automatically — verify nothing else constructs OcrItem literals (grep).
    - Response contract: items now carry `confidence`; everything else unchanged.
    In __tests__/ocrRoute.test.ts: add the three behavior tests (reuse the file's existing OpenAI mock helper) and update any existing exact-equality item expectations to include `confidence: 'high'` (mocks without the field default to 'high').
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx vitest run __tests__/ocrRoute.test.ts</automated>
  </verify>
  <done>Strict schema and prompt request per-line confidence; parser coerces to 'high'|'low' with 'high' default; route tests green including new confidence tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Force review on doubtful scans + highlight flagged lines</name>
  <files>stores/useBillStore.ts, components/wizard/SetupStep.tsx, components/wizard/ScanItemsEditor.tsx, __tests__/SetupStep.test.tsx, __tests__/ScanItemsEditor.test.tsx, __tests__/useBillStore.test.ts</files>
  <behavior>
    - SetupStep: OCR returns items whose sum matches the printed subtotal, all confidence 'high', no outliers -> stays on step 1 (existing clean-scan test still passes)
    - SetupStep: totals match but one item has confidence 'low' -> step becomes 2 and that store item has scanFlag 'Hard to read'
    - SetupStep: no subtotal and no grand total printed -> step becomes 2, scanCheck.targetCents null
    - SetupStep: a line named "TOTAL" -> step 2, that item scanFlag 'Looks like a total/tax line'
    - SetupStep: the expand-failure fallback path applies the same flags + routing
    - ScanItemsEditor: scanCheck with targetCents null -> shows "No total found on the receipt — please check the items" and no "Off by"/"Matches the receipt" text
    - ScanItemsEditor: item with scanFlag 'Unusual price' -> row shows that text (data-testid "scan-line-flag"); after typing in that row's price and blurring, the flag text is gone
    - useBillStore: updateItem clears scanFlag
  </behavior>
  <action>
    stores/useBillStore.ts: add optional `scanFlag?: ScanFlagReason` to `Item` (import the type from '@/lib/scanSanityChecks'), with a doc comment: set at scan time from OCR guardrails, shown on the review screen, cleared when the user edits the line. In `updateItem`, set `scanFlag: undefined` in the returned item (alongside the existing `confidence: 'high'`). Do not touch `confidence` semantics (it belongs to /api/expand). Add a useBillStore test that updateItem clears scanFlag.

    components/wizard/SetupStep.tsx:
    - Extend the OCR response type's item shape with `confidence?: 'high' | 'low'`; ocrItems flow into reconcileScannedBill unchanged so `reconciled.items[idx].confidence` carries the OCR confidence via the existing passthrough.
    - Right after `reconciled` is computed, call `flagScannedLines(reconciled.items)` once (ReconciledItem fields satisfy ScanSanityLine) and `shouldForceScanReview({ itemCount: reconciled.items.length, mismatch: reconciled.completeness.mismatch, targetCents, flaggedCount })`.
    - In BOTH the expand-success mapping and the expand-failure fallback mapping, add `scanFlag: lineFlags[idx] ?? undefined` to each item (index-aligned with reconciled.items, as unitPriceCents already is). In the success path do NOT copy OCR confidence into Item.confidence — that field keeps the expand value.
    - Replace both `if (reconciled.completeness.mismatch && targetCents != null) setStep(2)` with `if (decision.forceReview) setStep(2)`, still AFTER setItems and setScanCheck (page.tsx falls back to step 1 when step 2 has empty items). The empty-OCR branch stays as is (scan error, no routing).
    - Leave `reviewMode` and the footer copy alone. Update the stale header comment (~line 24) to say the editor auto-opens after a doubtful scan (mismatch, no printed total, or flagged lines).
    - Tests in __tests__/SetupStep.test.tsx: reuse the existing scan mock helper; add the behavior cases above. If existing tests mock OCR with no subtotal/total and expect step 1, update them to include a matching subtotal (they now intentionally force review) and note it in the SUMMARY.

    components/wizard/ScanItemsEditor.tsx (375px mobile; stone primary, white outline, coral only for warnings/chips):
    - When `scanCheck` exists and `targetCents == null`, render a block in the same slot/styling as `scan-review-gap` (rounded-md border bg-white px-3 py-2) with data-testid "scan-review-no-total" and text exactly "No total found on the receipt — please check the items" (text-[15px] font-semibold text-warn-strong). No "Off by" line in this case (existing gap block is already gated on targetCents != null).
    - Header: keep `isOff` copy; otherwise if any item has scanFlag or targetCents is null, show "Please check these items"; else "Edit scanned items".
    - Flagged rows: when `item.scanFlag` is set, give the Card `border-warn ring-[3px] ring-warn-soft` (same warning pattern as SetupStep), and render above the name Input a chip `<span data-testid="scan-line-flag">` with lucide `AlertTriangle` size 12 aria-hidden + the reason text, classes `inline-flex items-center gap-1 self-start rounded-full bg-coral-50 px-2 py-0.5 text-[12px] font-semibold text-warn-strong`. Give the Card `aria-describedby` pointing at the chip id for screen readers.
    - Clearing: no extra logic needed — commitRow already calls updateItem only when the user edited the row, and updateItem now clears scanFlag. Removing a flagged line removes its flag with it.
    - Tests in __tests__/ScanItemsEditor.test.tsx for the no-total copy and the flag show/clear behavior.

    Finally run the full suite and typecheck.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx vitest run && npx tsc --noEmit</automated>
  </verify>
  <done>Doubtful scans (mismatch, no total, or any flagged line) open step 2; clean scans stay on step 1; flagged rows show reason chips that disappear on edit; no-total copy shows when target is null; full vitest suite and tsc pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| OpenAI response -> OCR route | Model output is untrusted JSON; new `confidence` field enters here |
| OCR route -> client store | Parsed items (incl. confidence) drive routing and UI copy |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-gpu-01 | Tampering | parseOcrResponse confidence | mitigate | Coerce to the closed set 'high'/'low' (default 'high'); never render the raw model string |
| T-gpu-02 | Denial of Service | flagScannedLines regex | mitigate | Single precompiled regex over short names (OCR names are 3-6 words; editor maxLength 100); no nested quantifiers |
| T-gpu-03 | Information disclosure | Item.scanFlag persisted into shared session | accept | Value is one of four fixed UI labels, no PII |
</threat_model>

<verification>
- `npx vitest run` passes (existing + new tests)
- `npx tsc --noEmit` passes
- grep confirms `shouldForceScanReview(` in SetupStep.tsx and no remaining `mismatch && targetCents != null) setStep(2)`
</verification>

<success_criteria>
- New pure lib with unit tests for sanity checks and routing decision
- OCR strict schema + prompt + parser + response carry per-line confidence
- SetupStep forces the review screen on mismatch, missing printed total, or any flagged line; clean scans unchanged
- ScanItemsEditor highlights flagged lines with the four exact reason labels, clears on edit, and shows the no-total message when there is no target
</success_criteria>

<output>
Create `.planning/quick/261006-gpu-ocr-guardrails-force-review-on-doubtful-/261006-gpu-SUMMARY.md` when done
</output>
