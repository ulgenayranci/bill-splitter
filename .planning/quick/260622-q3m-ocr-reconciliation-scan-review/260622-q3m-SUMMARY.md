---
quick_id: 260622-q3m
slug: ocr-reconciliation-scan-review
date: 2026-06-22
status: complete
tasks: 3
commits:
  - task: 1
    hash: cdf4cba
    message: "feat(11): OCR captures subtotal vs grand total; reconcile to pre-tax truth"
  - task: 2
    hash: e425b26
    message: "feat(11): scan-review screen — confirm/edit items when scan can't reconcile"
  - task: 3
    hash: f52dc33
    message: "docs(11): update scan edge-case catalogue for subtotal truth + review gate"
key-files:
  modified:
    - app/api/ocr/route.ts
    - components/wizard/SetupStep.tsx
    - .planning/phases/11-bug-fixes-polish-bill-results-screens-participant-management/SCAN-EDGE-CASES.md
    - __tests__/ocrRoute.test.ts
    - __tests__/SetupStep.test.tsx
---

# Quick Task 260622-q3m: OCR reconciliation guardrail + scan-review screen Summary

Treat the receipt's printed total as the source of truth: the OCR route now captures the
pre-tax **subtotal** vs the **grand total** and reconciles line items against
`subtotalCents ?? grandTotalCents`; when a scan still can't reconcile after the existing
server retry, Setup shows an **editable, soft-gated review screen** so the user can
confirm/fix items before continuing.

## What shipped

### Task 1 — OCR: subtotal vs grand total truth figure (`cdf4cba`)
- json_schema: added `grandTotalCents: ['integer','null']` to properties + `required`; kept `subtotalCents`.
- Prompt redefined: `subtotalCents` = printed PRE-TAX items subtotal (what line items should sum to; null if not printed); `grandTotalCents` = final printed total after tax/service/tip (null if not printed). Self-check wording now targets `sum(items) == subtotalCents`.
- `parseOcrResponse` extracts `grandTotalCents` via existing `toIntCentsOrNull`; `OcrParsed` type extended.
- New helper `reconcileTarget(pass) = pass.subtotalCents ?? pass.grandTotalCents`; every retry-path use of `pass.subtotalCents` (retry trigger, `passMismatchMagnitude`, best-pass selection, extraInstruction inputs) now uses the target. `reconcileScannedBill` UNCHANGED.
- Response now returns `{ items, currencyCode, subtotalCents, grandTotalCents }`.
- **Verify:** `npx tsc --noEmit` clean; `ocrRoute.test.ts` 19/19 pass (added grandTotalCents parse/coerce, subtotal-as-truth no-retry, grand-total-fallback retry, no-figure no-retry).

### Task 2 — Editable scan-review/confirm screen (`e425b26`)
- Reads `grandTotalCents` from the OCR response; computes `targetCents = subtotalCents ?? grandTotalCents`; stored alongside `completeness` in the existing `guardrail` state.
- On `completeness.mismatch` with a truth figure present: replaced the passive amber banner with an editable review block (`data-testid="scan-review"`): heading "Please confirm or edit these detected items", one row per item (name / price `inputMode="decimal"` validated via `parseCents` / qty inputs + delete via `removeItem`), "Add item" button via `addItem`, and a live gap line (`data-testid="scan-review-gap"`) recomputed from store items via `computeSubtotalCents`.
- Edits wired to EXISTING store actions `addItem`/`updateItem`/`removeItem` — no new store actions, no silent price-fudging (invalid price keeps the draft, never writes a fudged value).
- Soft gate: CTA relabels to "Confirm & continue" in review mode and stays enabled; subtle "still off by {delta}" hint (`data-testid="scan-review-still-off"`) while a gap remains. Clean scans unchanged (thumbnail + chip + "Start splitting"; the "{n} prices were adjusted" note still shows for clean scans only).
- **Verify:** `npx tsc --noEmit` clean; `SetupStep.test.tsx` 20/20 pass (mismatch → editable review + gap; editing price to match clears the hint + writes 1500; clean scan → no review; "Confirm & continue" enabled while a gap remains).

### Task 3 — Docs (`f52dc33`)
- `SCAN-EDGE-CASES.md` updated: new "Truth figure: subtotal vs grand total" + "Soft-gate scan-review screen" sections; table rows #1/#2/#4/#5 and Notes rewritten for the truth figure + review trigger (mismatch after retry) + soft gate.
- All quoted copy strings (heading, gap line fragments, "Confirm & continue", testids, `reconcileTarget`, retry prompt) grep-verified against source.

## Locked decisions honored
1. Review screen appears ONLY on a failed reconciliation after the existing server retry — clean scans flow straight through. ✓
2. Soft gate — "Confirm & continue" proceeds even if still off. ✓
3. Reconcile against pre-tax subtotal, fall back to grand total. ✓

## Constraints honored
- `lib/reconcileScannedBill.ts` UNCHANGED (callers pass the target as its `subtotalCents` option). ✓
- `lib/sessionSchema.ts` UNCHANGED — `grandTotalCents` is scan-time-only, not stored in the session. ✓
- Used existing store actions only; no new actions added. ✓
- No silent price-fudging anywhere. ✓
- Tailwind amber + Geist retained. ✓

## Deviations from plan
None — plan executed exactly as written.

## Verification
- `npx tsc --noEmit`: clean after each task.
- Full `npm test` (vitest): **442 passed, 3 failed (445 total)**. The 3 failures are the
  known pre-existing retired-wizard failures only — AddPeopleStep ×2 ("disables CTA when
  no people added", "enables CTA after adding a person") and AddItemsStep ×1 ("tapping
  Continue with ≥1 item calls setStep(3)"). No new failures introduced.

## Self-Check: PASSED
- Commits cdf4cba, e425b26, f52dc33 exist on main (pushed).
- Modified files all present on disk.
