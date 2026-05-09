# Phase 2: OCR Pipeline - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Add photo capture and OCR extraction to the bill splitter. Host taps a "Scan bill" button in step 2, selects a photo (or takes one with the camera), and the app calls GPT-4o-mini vision to extract line items and prices. The extracted items appear inline as an editable list in AddItems (step 2) alongside a persistent thumbnail. User can edit any item or add more items manually, then continues normally to step 3. No new wizard step — the 5-step flow is unchanged.

Requirements: OCR-01 (photo capture → extracted items), OCR-03 (review and edit before assigning).

</domain>

<decisions>
## Implementation Decisions

### Wizard Integration

- **D-01:** Photo capture is embedded in AddItems (step 2) via a "Scan bill" button — no new wizard step added. WizardShell and step count (1–5) remain unchanged.
- **D-02:** OCR results replace the empty items list inline using the same editable rows as manual entry. There is no separate "confirm" gate — items appear directly in the list and are immediately editable.
- **D-03:** The captured bill thumbnail is stored in Zustand state (as a blob/data URL) and persists throughout the session. It is displayed at the top of step 2 once captured.

### Manual Fallback

- **D-04:** Scan is optional. Step 2 shows both the "Scan bill" button and the manual entry form simultaneously. Phase 1 manual flow must remain fully intact.
- **D-05:** After scanning, the manual entry form stays visible below the OCR-populated list. User can add more items manually to supplement the scan result (additive, not replace-only).

### Loading & Error UX

- **D-06:** A full-screen loading overlay is shown during OCR processing, with a "Scanning your bill…" message and spinner. All interaction is blocked until the call completes or fails.
- **D-07:** On OCR failure (timeout, bad image, API error): dismiss the overlay and show a brief error toast ("Couldn't read the bill — try again or enter manually"). User stays in step 2 with manual entry available. No dead end.

### Claude's Discretion

- OCR API route structure (`app/api/ocr/route.ts`) — standard Next.js App Router Route Handler
- GPT-4o-mini prompt design for structured JSON extraction (`{ items: [{ name: string, priceCents: number }] }`)
- Image compression before upload (browser-image-compression 2.x, targeting ~500KB JPEG)
- Blob URL vs data URL for thumbnail storage in Zustand state
- Error toast implementation (shadcn/ui Toast or simple inline message)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision, core value, and how the app works
- `.planning/REQUIREMENTS.md` — v1 requirements with REQ-IDs (OCR-01, OCR-03 are Phase 2)

### Phase 1 Decisions (carry forward)
- `.planning/phases/01-manual-bill-splitter/01-CONTEXT.md` — Integer-cents arithmetic, Zustand store shape, wizard design decisions
- `.planning/phases/01-manual-bill-splitter/01-RESEARCH.md` — Tech stack research (GPT-4o-mini vision, camera input, browser-image-compression)

### Integration Points (read before planning)
- `stores/useBillStore.ts` — `addItem(name, priceCents)` is the OCR integration point; Phase 2 adds `billImageUrl: string | null` to state
- `components/wizard/AddItemsStep.tsx` — The step to augment with scan button and thumbnail
- `components/wizard/WizardShell.tsx` — Step count stays at 5; no changes expected

### Stack Reference (from CLAUDE.md)
- `CLAUDE.md` — Recommended stack (Next.js 15, GPT-4o-mini vision for OCR, `<input capture="environment">`, browser-image-compression)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/button.tsx` — Use for the "Scan bill" button and overlay dismiss
- `components/ui/input.tsx` — Used by existing editable item rows (reuse unchanged)
- `components/ui/card.tsx` — Available for thumbnail container or OCR results wrapper
- `components/ui/dialog.tsx` — Available if full-screen overlay needs a Dialog primitive
- `components/ui/badge.tsx` — Available for status indicators if needed

### Established Patterns
- Integer-cents arithmetic: all prices stored as `priceCents: number` (integer) — OCR response must be parsed to cents before calling `addItem()`
- Zustand single store: Phase 2 adds `billImageUrl: string | null` and `ocrStatus: 'idle' | 'loading' | 'done' | 'error'` to the existing store in `stores/useBillStore.ts`
- `addItem(name, priceCents)` is already stable — OCR batch-calls it once per extracted item
- Derived totals: no changes to calculation logic

### Integration Points
- `app/api/ocr/route.ts` — New Route Handler (POST); accepts `multipart/form-data` or `application/json` with base64 image; returns `{ items: [{ name: string, priceCents: number }] }`
- `stores/useBillStore.ts` — Add `billImageUrl`, `ocrStatus`, `setOcrStatus()`, `setBillImage()` actions
- `components/wizard/AddItemsStep.tsx` — Add scan button, thumbnail display, and loading overlay; OCR items populate via existing `addItem()` loop
- `components/wizard/WizardShell.tsx` — No changes needed (step count stays at 5)

</code_context>

<specifics>
## Specific Ideas

No specific visual references — follow the mobile-first, restaurant-table UX established in Phase 1 (large touch targets, readable on phone screen in varying light).

Full-screen overlay for loading was explicitly chosen over inline spinner for OCR — keep it blocking and clear.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

Phase 3 items that came up implicitly but are not Phase 2 scope:
- Abbreviation expansion and confidence display → Phase 3 (OCR-02, OCR-04)
- Menu photo fallback for ambiguous items → Phase 3

</deferred>

---

*Phase: 2-OCR-Pipeline*
*Context gathered: 2026-05-09*
