# Phase 2: OCR Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 2-OCR-Pipeline
**Areas discussed:** Wizard placement, Skip / manual path, Loading & error UX

---

## Wizard Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Augment AddItems (step 2) | Add a "Scan bill" button at the top of step 2. No new step, no step count change — Phase 1 code changes are minimal. | ✓ |
| New step before AddItems | Insert a "Scan" step between Add People and Add Items, making it 6 steps. Dedicated scan+confirm screen. | |

**User's choice:** Augment AddItems (step 2)
**Notes:** —

---

### OCR confirmation within step 2

| Option | Description | Selected |
|--------|-------------|----------|
| Replace the empty list | Scanned items appear directly in the items list — same editable rows as manual entry. Thumbnail shown above. No separate confirm gate. | ✓ |
| Separate confirm mode | Step 2 switches to a review mode with checkboxes. User approves/edits, then clicks "Confirm Items" to commit. | |

**User's choice:** Replace the empty list

---

### Thumbnail persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned above items list during step 2 only | Thumbnail visible while editing OCR items, disappears after advancing to step 3. Not stored in state. | |
| Persistent in state, shown throughout | Thumbnail stored in Zustand store and visible in AddItems and beyond — user can always reference the original bill. | ✓ |

**User's choice:** Persistent in state, shown throughout

---

## Skip / Manual Path

### Can users skip scanning?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — scan is optional | Step 2 shows scan button AND manual entry form. Phase 1 manual flow stays intact. | ✓ |
| Scan-first, manual fallback | Step 2 prompts to scan by default; manual entry is explicitly a fallback. | |

**User's choice:** Yes — scan is optional

---

### Manual entry after scanning

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — additive | Scanned items appear in list; manual entry form stays visible below. User can add missed items. | ✓ |
| No — scan result is final | After scanning, no new rows can be added (edit/delete only). | |

**User's choice:** Yes — additive (recommended)

---

## Loading & Error UX

### Loading state during OCR

| Option | Description | Selected |
|--------|-------------|----------|
| Thumbnail appears + inline spinner | Photo thumbnail shows immediately; spinner replaces items area with "Reading your bill…" text. | |
| Full-screen loading overlay | Modal overlay covers the screen with spinner and "Scanning your bill…". Blocks all interaction until complete. | ✓ |

**User's choice:** Full-screen loading overlay

---

### OCR failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Dismiss overlay + error toast, stay in step 2 | Overlay closes, brief toast appears ("Couldn't read the bill — try again or enter manually"). User is back in step 2. | ✓ |
| Error screen with retry option | Persistent error banner with "Try again" and "Enter manually" buttons. | |

**User's choice:** Dismiss overlay + error toast, stay in step 2

---

## Claude's Discretion

- OCR API route structure (`app/api/ocr/route.ts`)
- GPT-4o-mini prompt design for structured JSON extraction
- Image compression strategy (browser-image-compression 2.x, ~500KB JPEG target)
- Blob URL vs data URL for thumbnail storage in Zustand
- Error toast implementation (shadcn/ui Toast or simple inline message)

## Deferred Ideas

- Abbreviation expansion and confidence display → Phase 3 (OCR-02)
- Menu photo fallback for ambiguous items → Phase 3 (OCR-04)
