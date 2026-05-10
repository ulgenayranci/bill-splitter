---
phase: 03-ai-expansion-disambiguation
reviewed: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - __tests__/AddItemsStep.test.tsx
  - __tests__/DisambiguationDialog.test.tsx
  - __tests__/OcrLoadingOverlay.test.tsx
  - __tests__/clarifyRoute.test.ts
  - __tests__/expandRoute.test.ts
  - __tests__/useBillStore.test.ts
  - app/api/clarify/route.ts
  - app/api/expand/route.ts
  - components/wizard/AddItemsStep.tsx
  - components/wizard/DisambiguationDialog.tsx
  - components/wizard/OcrLoadingOverlay.tsx
  - stores/useBillStore.ts
findings:
  critical: 4
  warning: 4
  info: 2
  total: 10
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-10
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This phase adds OCR expansion (via `/api/expand`) and a disambiguation dialog (`DisambiguationDialog`) backed by `/api/clarify`. The store grows `expandStatus`, `setItems`, and optional `confidence`/`rawName` fields on `Item`. The approach is sound and the happy path is well-tested, but four blocker-level defects exist: an `AbortError` is mis-classified as a user-visible error, a menu photo can silently exceed the clarify API's real size limit due to missing compression, the expand failure fallback appends items instead of replacing them (causing duplicates), and the expand route accepts unbounded item names that enable cost amplification.

---

## Critical Issues

### CR-01: AbortError treated as a real error — shows toast and bad state on intentional cancel

**File:** `components/wizard/AddItemsStep.tsx:160-167` and `195-206`

**Issue:** When the user picks a second file before the first OCR fetch completes, `abortRef.current?.abort()` cancels the in-flight request. The cancelled fetch throws an `AbortError`. Both the OCR catch block (line 160) and the expand catch block (line 195) are generic; they do not check `err instanceof DOMException && err.name === 'AbortError'`. As a result, the aborted first upload sets `ocrStatus = 'error'` and fires the "Couldn't read the bill" toast — even though the cancellation was intentional and the second upload is proceeding normally. This leaves the UI in a broken `error` state while the second scan is loading.

**Fix:**
```typescript
// In both catch blocks, guard against intentional cancellation:
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') return
  console.error(err)
  setOcrStatus('error')
  toastManager.add({
    description: "Couldn't read the bill — try again or enter manually",
    timeout: 4000,
  })
  return
}
```
Apply the same guard in the expand catch block before calling `setExpandStatus('error')` and the fallback `addItem` loop.

---

### CR-02: No image compression before `/api/clarify` — menu photos larger than ~7.15 MB silently fail

**File:** `components/wizard/DisambiguationDialog.tsx:61-66`

**Issue:** `handleMenuFileChange` reads the file with `FileReader` and sends the raw base64 to `/api/clarify` with no compression step. The clarify route enforces `image.length > 10_000_000` on the full data-URI string, which corresponds to roughly 7.15 MB of decoded image data (not 10 MB as the variable name implies — see WR-01). A typical phone camera JPEG taken of a menu is 5–12 MB. Any photo over ~7 MB will receive a 400 response from the route, and because the catch block only calls `setEditedName(item.name)` without showing an error toast, the user silently lands on an edit field with no indication that the photo was rejected.

**Fix:**
```typescript
import imageCompression from 'browser-image-compression'

// In handleMenuFileChange, after getting `file`, compress before reading:
const compressed = await imageCompression(file, {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/jpeg',
})
const base64 = await new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onloadend = () => resolve(reader.result as string)
  reader.onerror = () => reject(new Error('FileReader failed'))
  reader.readAsDataURL(compressed)
})
```

---

### CR-03: Expand failure fallback appends items instead of replacing them — causes duplicates on re-scan

**File:** `components/wizard/AddItemsStep.tsx:195-206`

**Issue:** On a successful expand, `setItems()` is called (line 185), which replaces the entire items array. On an expand failure, the catch block calls `addItem()` in a loop (lines 199-201), which appends to the existing array. If the user has already scanned or added items (e.g. OCR returned items, expand succeeded, they re-scan), the fallback path will append the new OCR items on top of the existing ones. The success path and failure path have inconsistent semantics, making a re-scan after an expand error produce doubled items.

**Fix:**
```typescript
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') return
  console.error(err)
  setExpandStatus('error')
  // Use setItems to REPLACE (consistent with success path) rather than appending:
  setItems(
    ocrItems.map((item) => ({
      id: crypto.randomUUID(),
      name: item.name,
      priceCents: item.priceCents,
    })),
  )
  toastManager.add({
    description: "Couldn't expand item names — you can edit them manually",
    timeout: 4000,
  })
}
```

---

### CR-04: No `name` length validation in `/api/expand` — cost amplification attack

**File:** `app/api/expand/route.ts:40-45`

**Issue:** The item validation only checks `typeof name === 'string'` with no maximum length constraint. An unauthenticated caller can send 100 items each with a name string of 1 MB, producing a ~100 MB prompt sent to OpenAI. The OpenAI SDK may accept this (context window limits vary by model), and each such request incurs real API cost. This is an unbounded cost amplification attack vector against the OpenAI API key.

**Fix:**
```typescript
// Add a name length check to the validation predicate:
!items.every(
  (i) =>
    i && typeof i === 'object' &&
    typeof (i as { name?: unknown }).name === 'string' &&
    ((i as { name: string }).name.length > 0) &&
    ((i as { name: string }).name.length <= 200) &&   // add this line
    Number.isInteger((i as { priceCents?: unknown }).priceCents)
)
```
200 characters matches the `rawName` limit used in `/api/clarify`.

---

## Warnings

### WR-01: Image size limit in `/api/clarify` is actually ~7.15 MB, not 10 MB

**File:** `app/api/clarify/route.ts:48`

**Issue:** The guard `image.length > 10_000_000` checks the character count of the full data-URI string (`data:image/jpeg;base64,...`). The base64 prefix adds 23 characters, and base64 encoding expands binary data by 4/3. So 10,000,000 total characters corresponds to approximately 7.15 MB of decoded binary data, not 10 MB. The test in `clarifyRoute.test.ts:65` is named "returns 400 when image exceeds 10MB" but constructs a test input of just over 10,000,000 characters — it tests the character limit, not a true 10 MB binary boundary. This matters for the companion issue CR-02: the effective limit is lower than developers expect.

**Fix:** Either rename the constant and test to accurately describe the limit:
```typescript
const MAX_IMAGE_DATA_URI_CHARS = 10_000_000 // ~7.15 MB decoded; use imageCompression to stay under
```
Or change the check to operate on the decoded byte count after stripping the data-URI prefix:
```typescript
const base64Data = image.slice(image.indexOf(',') + 1)
const decodedBytes = Math.ceil(base64Data.length * 0.75)
if (decodedBytes > 10 * 1024 * 1024) {
  return NextResponse.json({ error: 'Image too large' }, { status: 400 })
}
```

---

### WR-02: Expand route accepts zero and negative `priceCents` in input but rejects them in the response — causes 500 on zero-priced items from OCR

**File:** `app/api/expand/route.ts:44` and `116`

**Issue:** Input validation uses `Number.isInteger(priceCents)`, which accepts 0 and negative integers. The LLM prompt instructs the model to copy `priceCents` exactly. The response filter at line 116 requires `(obj.priceCents as number) > 0`. If the OCR pipeline returns an item with `priceCents: 0` (e.g. a complimentary item or a rounding artifact), the LLM copies it faithfully, the response filter drops it, and the count mismatch check at line 125 triggers a 500. A receipt with a free item causes the entire expand operation to fail.

**Fix:**
```typescript
// Add a > 0 check to the input validation to reject zero and negative values early:
Number.isInteger((i as { priceCents?: unknown }).priceCents) &&
((i as { priceCents: number }).priceCents > 0)
```
This makes input validation consistent with the response filter and returns a clear 400 instead of a surprising 500.

---

### WR-03: `DisambiguationDialog` shows "AI suggested a name" hint text in manual-editing state

**File:** `components/wizard/DisambiguationDialog.tsx:151`

**Issue:** The static paragraph `<p>AI suggested a name — edit if needed</p>` is rendered for both `editing` and `clarify-done` dialog states (line 131–159). When the user reaches the editing state via the "Type name" button (not via the AI clarification path), there is no AI suggestion — the text is factually incorrect and may confuse the user.

**Fix:**
```typescript
{dialogState === 'clarify-done' && (
  <p className="text-xs text-zinc-400">AI suggested a name — edit if needed</p>
)}
```
Remove the hint entirely for the `editing` state (reached via "Type name").

---

### WR-04: `FileReader` global is not restored in `try/finally` in async tests — pollution on assertion failure

**File:** `__tests__/AddItemsStep.test.tsx:227-245` and `254-279` and `337-363`

**Issue:** The tests stub `global.FileReader` with a synchronous `StubFR` class and restore the original after assertions. The restoration happens on lines 245, 279, and 363 — after `expect()` calls. If any assertion throws (test failure), the restore line is never reached, and subsequent tests run with the stub still in place. This causes false failures or false passes in later tests in the same suite.

**Fix:** Wrap the stub + assertion body in `try/finally`:
```typescript
;(global as unknown as { FileReader: typeof StubFR }).FileReader = StubFR
try {
  fireEvent.change(fileInput, ...)
  await new Promise((r) => setTimeout(r, 0))
  // ... assertions ...
} finally {
  ;(global as unknown as { FileReader: typeof origFR }).FileReader = origFR
  fetchMock.mockRestore()
}
```

---

## Info

### IN-01: Dead code — `nameInput` declared and immediately abandoned in test

**File:** `__tests__/AddItemsStep.test.tsx:38-40`

**Issue:** Lines 38–40 query all textboxes and attempt to find a name input via `.find()`, assigning the result to `nameInput`. The variable is never read. Line 41 immediately uses `screen.getByPlaceholderText` to get the same field, superseding the earlier attempt entirely.

**Fix:** Delete lines 38–40.

---

### IN-02: Fragile `setTimeout(r, 0)` chains in async integration tests

**File:** `__tests__/AddItemsStep.test.tsx:231-233`, `270-271`, `351-353`

**Issue:** The async tests manually pump the event loop with 2–3 sequential `await new Promise((r) => setTimeout(r, 0))` calls to let the OCR+expand fetch chain resolve. This is brittle — adding any additional async step in the component (e.g. a third API call) would silently break the test without a clear failure signal.

**Fix:** Replace the timer chain with `waitFor` from `@testing-library/react`:
```typescript
import { waitFor } from '@testing-library/react'

// Instead of:
await new Promise((r) => setTimeout(r, 0))
await new Promise((r) => setTimeout(r, 0))
await new Promise((r) => setTimeout(r, 0))

// Use:
await waitFor(() => {
  expect(useBillStore.getState().ocrStatus).toBe('done')
  expect(useBillStore.getState().expandStatus).toBe('done')
})
```

---

_Reviewed: 2026-05-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
