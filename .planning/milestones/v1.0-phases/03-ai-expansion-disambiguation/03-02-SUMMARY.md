---
phase: 03-ai-expansion-disambiguation
plan: "02"
subsystem: api-expand + AddItemsStep
tags: [openai, gpt-4o-mini, json_schema, receipt-expansion, confidence-badge, two-step-ocr]
dependency_graph:
  requires: [03-01]
  provides: [expand-api-route, AddItemsStep-two-step-flow, review-badge]
  affects: [components/wizard/AddItemsStep.tsx, app/api/expand/route.ts]
tech_stack:
  added: []
  patterns:
    - "POST /api/expand: json_schema strict mode with confidence enum (high|low|ambiguous)"
    - "Two-phase OCR→expand loading with sequential OcrLoadingOverlay instances"
    - "Inline orange Review badge on item rows with confidence low|ambiguous"
    - "D-03 fallback: expand failure falls back to raw OCR names via addItem + toast"
key_files:
  created:
    - app/api/expand/route.ts
  modified:
    - components/wizard/AddItemsStep.tsx
    - __tests__/AddItemsStep.test.tsx
decisions:
  - "NEXT_PUBLIC_ reference in comment only — actual key access via process.env.OPENAI_API_KEY (T-03-EXP-01)"
  - "Count mismatch guard: if LLM returns different item count than input, return 500 (D-03 / Pitfall 2)"
  - "D-03 expand fallback: addItem() per raw OCR item rather than setItems() — preserves items even if expansion fails"
  - "Dialog tests intentionally RED: Plan 03 wires item-row click to disambiguation dialog"
metrics:
  duration: "4 min"
  completed: "2026-05-10T06:17:26Z"
  tasks: 3
  files: 3
---

# Phase 03 Plan 02: AI Expansion Route + AddItemsStep Two-Step Flow Summary

Delivered OCR-02 end-to-end as a vertical slice. Users scanning a receipt now see two loading phases ("Scanning your bill…" then "Expanding names…"), and the resulting item list shows orange "Review" badges on rows where the AI had low or ambiguous confidence. Expansion failure falls back gracefully to raw OCR names — no dead end.

## What Was Built

### /api/expand Contract (app/api/expand/route.ts)

**Request:**
```json
POST /api/expand
{ "items": [{ "name": string, "priceCents": integer }] }
```

**Success response (200):**
```json
{ "items": [{ "rawName": string, "displayName": string, "priceCents": integer, "confidence": "high" | "low" | "ambiguous" }] }
```

**Error responses:**
- 400: missing/empty items, items.length > 100, malformed JSON body
- 500 `{ "error": "Expand failed" }`: OpenAI throw, empty content, count mismatch

**Implementation highlights:**
- GPT-4o-mini with `response_format: { type: 'json_schema', json_schema: { name: 'expanded_items', strict: true, ... } }`
- `confidence` field uses OpenAI enum constraint in json_schema to force the three-value enum
- Count mismatch guard: `responseItems.length !== items.length` → 500 (D-03 / Pitfall 2 mitigation)
- All OpenAI errors logged server-side only; client receives generic `{ error: 'Expand failed' }`
- `export const maxDuration = 30` for Vercel serverless boundary

### Two-Step handleFileChange in AddItemsStep (components/wizard/AddItemsStep.tsx)

The early-return on OCR failure means expansion is never attempted if OCR fails:

```
setOcrStatus('loading')
→ fetch /api/ocr → if fails: setOcrStatus('error') + toast + return
→ setOcrStatus('done'), ocrItems = data.items
→ setExpandStatus('loading')
→ fetch /api/expand → if succeeds: setItems(expanded) + setExpandStatus('done')
                    → if fails: addItem(rawName) per item + setExpandStatus('error') + toast
```

Two `OcrLoadingOverlay` instances are rendered with separate visibility gates:
- `<OcrLoadingOverlay visible={ocrStatus === 'loading'} />` (default message "Scanning your bill…")
- `<OcrLoadingOverlay visible={expandStatus === 'loading'} message="Expanding names…" />`

### Review Badge Rendering

Items with `confidence === 'low' || confidence === 'ambiguous'` show an inline orange badge:
```tsx
<Badge className="bg-amber-100 text-amber-700 border border-amber-300 text-xs font-medium">
  Review
</Badge>
```
Items with `confidence === 'high'` show no badge.

## Test Count Delta

**Tests turned GREEN this plan:**
- expandRoute.test.ts: 8/8 (all new — were RED scaffolds from Plan 01)
- AddItemsStep Phase 3 expansion + badge tests: 5 turned GREEN
  - "shows the expansion overlay when expandStatus is 'loading'"
  - "renders a 'Review' badge for items with confidence 'low'"
  - "renders a 'Review' badge for items with confidence 'ambiguous'"
  - "does NOT render a 'Review' badge for items with confidence 'high'"
  - "on /api/expand failure, falls back to raw OCR names and sets expandStatus to 'error'"

**Tests updated (Phase 2 baseline):**
- "on successful OCR fetch, batch-inserts returned items into the store" — updated to dual-endpoint mock, added third await, added `expandStatus === 'done'` assertion
- "on failed OCR fetch" — added `expandStatus === 'idle'` assertion

**Tests remaining RED (intentional — Plan 03 territory):**
- 4 dialog tests: "tapping a Review item row opens the disambiguation dialog", "disambiguation dialog presents both...", "Type name reveals an editable input...", "saving an edited name in the dialog..."
- clarifyRoute.test.ts: references not-yet-created /api/clarify/route (Plan 03)

**Total suite:** 131 passing, 4 failing (dialog), 1 test file failing (clarifyRoute — pre-existing)

## Dependencies Passed Forward to Plan 03

1. `handleEditItemClick` is still the click handler for item rows. Plan 03 must intercept clicks on Review items (where `item.confidence === 'low' || 'ambiguous'`) to open the disambiguation dialog instead of the inline edit mode. The existing `onClick={() => handleEditItemClick(item)}` on the display-mode `<Card>` is where this change goes.
2. `/api/clarify` route: Test scaffold created in Plan 01 is still RED — Plan 03 implements the route.
3. `updateItem(id, name, priceCents)` already clears `confidence` to `'high'` (from Plan 01) — Plan 03's "save name" dialog action uses this to dismiss the Review badge.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all wired data flows to real state.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond those documented in the plan's threat model.

## Self-Check: PASSED

- app/api/expand/route.ts: FOUND
- components/wizard/AddItemsStep.tsx: FOUND
- 03-02-SUMMARY.md: FOUND
- Commit 534ec10 (Task 1 — /api/expand route): FOUND
- Commit 8d191ff (Task 2 — AddItemsStep wiring): FOUND
- Commit 0f67cb7 (Task 3 — Phase 2 test update): FOUND
