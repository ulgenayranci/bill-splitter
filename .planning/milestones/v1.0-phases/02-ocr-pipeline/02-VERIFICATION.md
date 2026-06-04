---
phase: 02-ocr-pipeline
verified: 2026-05-09T23:40:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Snap a photo of a real receipt on a mobile device"
    expected: "Native camera opens, loading overlay appears during OCR, extracted items appear in the list as editable rows, thumbnail visible at top of step 2"
    why_human: "End-to-end photo-to-items flow requires a real device, real camera, and a live OPENAI_API_KEY — cannot be verified programmatically without external services"
  - test: "Disconnect network during a scan"
    expected: "Overlay dismisses, error toast 'Couldn't read the bill — try again or enter manually' appears for ~4 seconds at bottom of viewport, 'Scan bill' button reappears"
    why_human: "Error toast appearance and 4-second auto-dismiss are visual/timing behaviors not testable in jsdom"
  - test: "Edit an OCR-extracted item name or price inline"
    expected: "Tapping the item row opens inline edit, updating name/price and tapping checkmark saves the change"
    why_human: "UI interaction fidelity on mobile requires human observation"
---

# Phase 2: OCR Pipeline Verification Report

**Phase Goal:** Host can snap a photo of the receipt and get a reviewable list of items without typing anything.
**Verified:** 2026-05-09T23:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/ocr accepts `{ image }` base64 data URL and returns `{ items: [{ name, priceCents }] }` on success | VERIFIED | `app/api/ocr/route.ts` lines 21-106: parses body, validates image, calls `openai.chat.completions.create` with `gpt-4o-mini`, returns `NextResponse.json({ items })` |
| 2 | POST /api/ocr returns 400 when image is missing or not a string | VERIFIED | Route lines 35-37: DATA_URI_RE validation + length check; returns `{ error: 'No image provided' }` with status 400 |
| 3 | POST /api/ocr returns 500 with generic error when OpenAI throws or returns malformed content; OpenAI error message is NOT leaked | VERIFIED | Route lines 101-105: catch block logs `err` server-side only; response is literal `{ error: 'OCR failed' }`. Test `ocrRoute.test.ts` line 374 asserts "rate-limited" not in response body |
| 4 | Route uses `gpt-4o-mini`, `json_schema` response format with `strict: true`, and reads `OPENAI_API_KEY` from `process.env` — never `NEXT_PUBLIC_*` | VERIFIED | `route.ts` line 6: `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`. Lines 41, 52-55: `model: 'gpt-4o-mini'`, `type: 'json_schema'`, `strict: true`. `grep NEXT_PUBLIC_OPENAI route.ts` returns 0 |
| 5 | User can tap a 'Scan bill' button (hidden file input, `capture="environment"`) that triggers the native camera | VERIFIED | `AddItemsStep.tsx` lines 181-204: Button with `aria-label="Scan bill"` clicks `fileInputRef.current`, hidden `<input type="file" accept="image/*" capture="environment">` with `data-testid="ocr-file-input"` |
| 6 | During OCR, a full-screen portal overlay blocks the viewport; on success, items appear in the list and a thumbnail is shown; on failure, an error toast appears and 'Scan bill' reappears | VERIFIED | `OcrLoadingOverlay.tsx` lines 16-29: `createPortal` to `document.body` when `visible=true`; `AddItemsStep.tsx` lines 140-151: `addItem` loop + `setOcrStatus('done')`; error path lines 144-151: `setOcrStatus('error')` + `toastManager.add`; thumbnail lines 170-179: Card with `<img>` when `billImageUrl !== null`; Scan button conditional line 181 hides only when `loading` or `done` |
| 7 | Toast.Provider lives in `app/providers.tsx` ('use client'); `app/layout.tsx` remains a Server Component | VERIFIED | `providers.tsx` line 1: `'use client'`, lines 7-12: `<Toast.Provider>` wraps children + `<OcrErrorToast />`; `app/layout.tsx`: no `'use client'` directive (grep returns 0), line 21: `<Providers>{children}</Providers>` |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/ocr/route.ts` | POST handler calling GPT-4o-mini vision | VERIFIED | 107 lines, exports `POST` and `maxDuration=30`, full implementation |
| `app/providers.tsx` | 'use client' wrapper with Toast.Provider | VERIFIED | 13 lines, `'use client'`, `Toast.Provider` wraps children and `OcrErrorToast` |
| `app/layout.tsx` | Server Component wrapping children in Providers | VERIFIED | No `'use client'`, imports and renders `<Providers>` |
| `components/wizard/OcrLoadingOverlay.tsx` | Portal overlay with spinner | VERIFIED | 30 lines, `createPortal` to `document.body`, `role="status"`, `aria-live="polite"`, `Scanning your bill…` |
| `components/wizard/OcrErrorToast.tsx` | Toast viewport renderer | VERIFIED | 27 lines, `useToastManager`, `Toast.Portal > Toast.Viewport > Toast.Root` |
| `components/wizard/AddItemsStep.tsx` | Augmented with scan button, thumbnail, OCR handler | VERIFIED | 366 lines, `Scan bill` button, hidden file input, `handleFileChange`, thumbnail `Card`, `OcrLoadingOverlay` at bottom |
| `stores/useBillStore.ts` | billImageUrl + ocrStatus + setBillImage + setOcrStatus + blob-URL revocation | VERIFIED | Lines 34-37: new fields in interface; lines 56-57: INITIAL_STATE; lines 99-105: actions + reset revokes blob URL |
| `.env.local.example` | OPENAI_API_KEY env var documented | VERIFIED | File exists, `OPENAI_API_KEY=` with empty value, no real key, no `NEXT_PUBLIC_` prefix |
| `__tests__/ocrRoute.test.ts` | 7 unit tests with vi.mock | VERIFIED | 7 `it(` calls, 0 `it.skip`, `vi.mock('openai'...)` present, all 7 pass |
| `__tests__/OcrLoadingOverlay.test.tsx` | 3 tests for portal behavior | VERIFIED | 3 tests covering visible/not-visible/classes, all pass |
| `__tests__/AddItemsStep.test.tsx` | 20 tests (12 existing + 8 new) | VERIFIED | 20 tests pass: scan-button visibility, thumbnail, overlay, OCR success path, OCR error path |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AddItemsStep.tsx` | `/api/ocr` | `fetch('/api/ocr', { method: 'POST', body: JSON.stringify({ image: base64 }) })` | WIRED | Line 130: confirmed pattern present |
| `AddItemsStep.tsx` | `imageCompression` | `imageCompression(file, { maxSizeMB: 0.5, fileType: 'image/jpeg' })` | WIRED | Lines 116-121: compression called with correct options before fetch |
| `AddItemsStep.tsx` | `useBillStore` (billImageUrl, ocrStatus, setBillImage, setOcrStatus) | `useBillStore((s) => s.X)` selectors | WIRED | Lines 46-49: all four selectors present and used in handler + JSX |
| `AddItemsStep.tsx` | `OcrLoadingOverlay` | `<OcrLoadingOverlay visible={ocrStatus === 'loading'} />` | WIRED | Line 363: confirmed in JSX |
| `app/providers.tsx` | `app/layout.tsx` | `import { Providers } from './providers'` + `<Providers>{children}</Providers>` | WIRED | `layout.tsx` lines 5 and 21: confirmed |
| `app/providers.tsx` | `OcrErrorToast` | `OcrErrorToast` rendered inside `Toast.Provider` | WIRED | `providers.tsx` line 10: `<OcrErrorToast />` sibling to `{children}` within `Toast.Provider` |
| `stores/useBillStore.ts` | `window.URL.revokeObjectURL` | `reset()` checks `s.billImageUrl` and calls `URL.revokeObjectURL` before `INITIAL_STATE` spread | WIRED | Lines 101-105: confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AddItemsStep.tsx` | `items` (from store) | `useBillStore((s) => s.items)` → populated by `addItem(item.name, item.priceCents)` in OCR success path | Yes — calls `addItem` for each parsed receipt item | FLOWING |
| `AddItemsStep.tsx` | `billImageUrl` | `setBillImage(URL.createObjectURL(file))` in `handleFileChange` | Yes — real blob URL from user-selected file | FLOWING |
| `app/api/ocr/route.ts` | `items` returned | `openai.chat.completions.create` → `JSON.parse(content)` → filtered items array | Yes — real OpenAI response parsed and validated before return | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (111 tests) | `npx vitest run` | 9 test files, 111 tests passed, 0 failed, 0 skipped | PASS |
| Route file has no NEXT_PUBLIC_ key | `grep NEXT_PUBLIC_OPENAI app/api/ocr/route.ts` | 0 matches | PASS |
| No OPENAI references in components | `grep -rn "OPENAI" components/` | 0 matches | PASS |
| layout.tsx is a Server Component | `grep "'use client'" app/layout.tsx` | 0 matches | PASS |
| .env.local.example empty key | `grep "OPENAI_API_KEY=" .env.local.example` | `OPENAI_API_KEY=` (empty value) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| OCR-01 | 02-01, 02-02, 02-03 | User can take a photo of the bill to extract items automatically | SATISFIED | Camera input wired in `AddItemsStep.tsx`; `/api/ocr` route calls GPT-4o-mini; items inserted into store via `addItem` loop |
| OCR-03 | 02-03 | User can review and edit extracted items before assigning | SATISFIED | Extracted items appear in the existing inline-edit list; user can tap any item row to edit name/price; trash button + Dialog flow preserved |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/api/ocr/route.ts` | 35 | `DATA_URI_RE` validation is stricter than the plan specified — only `jpeg|png|webp|gif` data URIs accepted | Info | Not a bug; defense-in-depth addition. However, tests send `data:image/jpeg;base64,abc` which passes the regex, so tests remain valid |
| `components/wizard/OcrLoadingOverlay.tsx` | 12-15 | Uses `useState(false)` + `useEffect(() => setMounted(true))` hydration guard instead of the plan's `typeof document === 'undefined'` check | Info | Valid alternative pattern to avoid SSR hydration mismatch; does not affect behavior in browser or jsdom tests |

No blockers found. No TODO/FIXME/placeholder patterns detected in phase artifacts.

### Human Verification Required

**The automated checks all pass (7/7 truths, 111/111 tests). The following items require a human with a real device and OPENAI_API_KEY configured in `.env.local` to confirm the end-to-end user experience.**

#### 1. Real Receipt Scan (Happy Path)

**Test:** Run `npm run dev`, navigate to step 2 on a mobile device or DevTools mobile emulation. Tap "Scan bill", select a receipt photo (or use camera).
**Expected:** Native camera/file picker opens. Loading overlay with spinner and "Scanning your bill…" appears while OCR runs. After success: extracted items appear as editable rows in the list, a thumbnail of the captured photo appears at the top of step 2.
**Why human:** Requires live OPENAI_API_KEY, real image, and visual confirmation of overlay timing and item rendering.

#### 2. OCR Error Toast (Failure Path)

**Test:** Disconnect network or use a corrupted image, then tap "Scan bill" and attempt a scan.
**Expected:** Loading overlay appears then dismisses. A dark rounded toast reading "Couldn't read the bill — try again or enter manually" appears at the bottom of the viewport and auto-dismisses after approximately 4 seconds. "Scan bill" button reappears.
**Why human:** Toast visual appearance, positioning, and 4-second auto-dismiss timing require visual confirmation on a real viewport.

#### 3. Extracted Item Edit Flow

**Test:** After a successful OCR scan, tap one of the extracted items. Edit the name or price. Tap the checkmark.
**Expected:** Inline edit mode opens, changes are saved and reflected in the list immediately.
**Why human:** UI interaction fidelity and response feel on mobile require human observation.

### Gaps Summary

No gaps were found. All 7 observable truths are verified by code evidence. The 3 human verification items are standard visual/real-time behaviors that cannot be checked without an external service (OpenAI) and a real device. They do not indicate missing implementation — the implementation is complete and proven by 111 passing unit tests.

**Known limitation (Pitfall 7):** After a successful scan, `ocrStatus` stays `'done'` and the "Scan bill" button remains hidden until session reset. There is no re-scan affordance. This is intentional per the phase plan and documented for Phase 5 (Polish).

---

_Verified: 2026-05-09T23:40:00Z_
_Verifier: Claude (gsd-verifier)_
