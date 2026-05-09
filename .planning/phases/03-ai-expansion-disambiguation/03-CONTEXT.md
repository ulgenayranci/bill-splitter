# Phase 3: AI Expansion + Disambiguation - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the OCR pipeline so abbreviated receipt names become readable descriptions, uncertain expansions are surfaced for user review, and ambiguous items can be resolved by taking a menu photo or typing manually. The 5-step wizard flow is unchanged — all new UI lives in AddItemsStep (step 2).

Requirements: OCR-02 (abbreviation expansion + confidence display), OCR-04 (disambiguation via menu photo or manual entry).

</domain>

<decisions>
## Implementation Decisions

### Expansion Architecture

- **D-01:** Two-step architecture — OCR and expansion are separate API calls.
  - Step 1: Existing `/api/ocr` route extracts raw item names and prices from the receipt photo (unchanged from Phase 2).
  - Step 2: New `/api/expand` route takes the list of raw items and returns expanded names with confidence scores. This is a second AI call, separate from the OCR step.
  - The user sees two loading phases: "Scanning bill…" (OCR), then "Expanding names…" (expansion). Both use the existing `OcrLoadingOverlay` pattern or a similar overlay.

- **D-02:** The `/api/expand` route accepts `{ items: [{ name: string, priceCents: number }] }` and returns `{ items: [{ rawName: string, displayName: string, priceCents: number, confidence: 'high' | 'low' | 'ambiguous' }] }`.
  - `high` — AI is confident in the expanded name (no badge shown)
  - `low` — AI made an educated guess (orange "Review" badge)
  - `ambiguous` — AI cannot determine what the item is (orange "Review" badge, same treatment as low)
  - Both `low` and `ambiguous` items get the same "Review" badge UX from the user's perspective.

- **D-03:** On expansion timeout or API failure, the raw abbreviated names from OCR are kept as-is and inserted into the store (still editable). No dead end — user can manually correct any name.

### Confidence Display

- **D-04:** Items with `confidence: 'low' | 'ambiguous'` show an orange "Review" badge on their item row in the list.
- **D-05:** No forced modal — the item list appears immediately after expansion. Users fix items on their own schedule.

### Disambiguation (OCR-04)

- **D-06:** Tapping a "Review" item opens a dialog with two options:
  1. **Type name** — opens the existing inline edit field pre-filled with the AI's best guess
  2. **Take menu photo** — opens camera capture for a menu photo (see menu photo flow below)
- **D-07:** The "Review" badge is dismissed when the user saves any edit on that item — even if the name is unchanged. This respects that the AI's expanded name might actually be correct.

### Menu Photo Flow (OCR-04)

- **D-08:** When user taps "Take menu photo" for an ambiguous item:
  1. Camera opens (same `<input type="file" capture="environment">` pattern)
  2. Menu photo is sent to a new `/api/clarify` route with the ambiguous item's raw name as context
  3. The AI returns its best guess for the item's full name
  4. The result auto-populates the edit field in the dialog — user reviews and taps Save
- **D-09:** If the `/api/clarify` route cannot determine the name from the menu photo, it returns whatever it found (empty string or partial match). The edit field is populated with this result and the user edits manually — no error screen.
- **D-10:** Menu photos are NOT stored in state (no `menuImageUrl` in Zustand). They are used once for name resolution and discarded.

### Claude's Discretion

- Exact prompt design for `/api/expand` and `/api/clarify`
- Loading state label for the expansion phase ("Expanding names…" or similar)
- Exact visual styling of the "Review" badge (orange, consistent with the existing design system)
- Whether to reuse `OcrLoadingOverlay` for the expansion loading phase or show a lighter inline spinner
- Dialog design for the disambiguation choices (reuse existing `Dialog` primitive from shadcn/ui)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision and core value
- `.planning/REQUIREMENTS.md` — OCR-02 and OCR-04 are Phase 3

### Phase 1 + 2 Decisions (carry forward)
- `.planning/phases/01-manual-bill-splitter/01-CONTEXT.md` — Integer-cents arithmetic, Zustand store shape
- `.planning/phases/02-ocr-pipeline/02-CONTEXT.md` — OCR architecture, loading overlay pattern, Toast pattern, two-step flow decisions

### Integration Points (read before planning)
- `app/api/ocr/route.ts` — Existing OCR route (Phase 2, unchanged in Phase 3). Source of raw item names.
- `stores/useBillStore.ts` — `addItem()`, `ocrStatus`, `setBillImage`. Phase 3 adds `expandStatus` or extends `ocrStatus`.
- `components/wizard/AddItemsStep.tsx` — The component to extend with expansion loading, Review badges, and disambiguation dialog.
- `components/wizard/OcrLoadingOverlay.tsx` — Portal-based loading overlay. Reuse or adapt for expansion loading phase.
- `app/providers.tsx` — `Toast.Provider` wrapper. Phase 3 adds no new providers.

### Stack Reference
- `CLAUDE.md` — Recommended stack (Next.js 15, GPT-4o-mini, shadcn/ui Dialog, Zustand)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/wizard/OcrLoadingOverlay.tsx` — Portal overlay with mounted-flag pattern (avoids hydration mismatch). Reuse for expansion loading.
- `components/wizard/OcrErrorToast.tsx` — Toast component. Reuse for expansion failure toast.
- `components/ui/dialog.tsx` — Available for the disambiguation choices dialog.
- `components/ui/badge.tsx` — Available for the "Review" confidence badge on item rows.
- `app/api/ocr/route.ts` — Pattern for GPT-4o-mini json_schema strict output + runtime item validation. Follow same pattern in `/api/expand` and `/api/clarify`.

### Established Patterns
- Integer-cents: `priceCents` is always an integer — expansion must preserve it unchanged.
- AbortController on fetch calls tied to component lifecycle (`abortRef` pattern in `AddItemsStep.tsx`).
- `vi.mock` at module level for ESM default exports (browser-image-compression pattern).
- `vi.resetModules()` + dummy API key in `beforeEach` for route handler tests.
- All `AddItemsStep` tests wrapped in `renderInProvider()` (Toast.Provider required).

### New Routes to Create
- `app/api/expand/route.ts` — POST: accepts `{ items: [{ name, priceCents }] }`, returns `{ items: [{ rawName, displayName, priceCents, confidence }] }`
- `app/api/clarify/route.ts` — POST: accepts `{ rawName: string, image: string (data URI) }`, returns `{ displayName: string }`

</code_context>

<specifics>
## Specific Ideas

User is a product designer. UX clarity is a priority:
- The "Review" badge must be visually distinct but not alarming. Orange, not red.
- Two loading phases (scan → expand) should feel like a single coherent flow, not two separate waits.
- The disambiguation dialog should be minimal — two large tap targets, not a form.
- No dead ends: every error state has a manual fallback.

</specifics>

<deferred>
## Deferred Ideas

None surfaced during discussion.

</deferred>

---

*Phase: 3-AI-Expansion-Disambiguation*
*Context gathered: 2026-05-10*
