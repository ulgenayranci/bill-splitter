---
phase: 02-ocr-pipeline
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - .env.local.example
  - __tests__/ocrRoute.test.ts
  - __tests__/OcrLoadingOverlay.test.tsx
  - package.json
  - vitest.setup.ts
  - stores/useBillStore.ts
  - __tests__/useBillStore.test.ts
  - app/api/ocr/route.ts
  - app/providers.tsx
  - components/wizard/OcrLoadingOverlay.tsx
  - components/wizard/OcrErrorToast.tsx
  - app/layout.tsx
  - components/wizard/AddItemsStep.tsx
  - __tests__/AddItemsStep.test.tsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This phase introduces the OCR pipeline: a Next.js Route Handler calling gpt-4o-mini vision, a Zustand store extended with `billImageUrl` and `ocrStatus`, and the `AddItemsStep` component wiring them together. The overall structure is sound — API key handling is server-only, error messages do not leak internal detail to the client, and the loading overlay correctly uses a portal with accessible ARIA attributes.

Three blockers were found: the OCR route passes arbitrary user-supplied image strings directly to the OpenAI API with no validation (SSRF/prompt injection vector), `OcrLoadingOverlay` will throw a hydration error in Next.js App Router because it reads `document` during render rather than in an effect, and the `reset()` action silently overwrites `ocrStatus` with `'idle'` but leaves `billImageUrl` as the revoked (now-invalid) URL for one render cycle before the spread resets it — the spread does reset it, but the `revokeObjectURL` call happens inside the state updater function whose side-effect timing is untested outside the store unit test.

Four warnings cover: the OCR route accepting a zero-length `image` string bypassing the empty check, a missing `aria-describedby` link between the price input and its inline error message, an un-cancelled `FileReader` when the component unmounts mid-scan, and the `OcrErrorToast` silently rendering nothing when `cn` or `@/lib/utils` is absent (missing import safety).

---

## Critical Issues

### CR-01: Arbitrary URL passed to OpenAI API — SSRF / prompt-injection risk

**File:** `app/api/ocr/route.ts:34`

**Issue:** The route validates only that `image` is a non-empty string, then passes it verbatim as an `image_url` to the OpenAI vision API. An attacker can supply any URL — including internal network addresses (`http://169.254.169.254/...`, `http://localhost/...`, internal services) — and OpenAI will attempt to fetch it from its servers. Depending on network topology this can probe internal endpoints. Additionally a very long or crafted string is forwarded without length or format checks.

The check on line 34 (`typeof image !== 'string' || image.length === 0`) does not verify that the value is a data URI or an allowlisted HTTPS URL.

**Fix:**
```typescript
// Accept only base64 data URIs (the only format the client sends)
const DATA_URI_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/

if (typeof image !== 'string' || !DATA_URI_RE.test(image)) {
  return NextResponse.json({ error: 'No image provided' }, { status: 400 })
}
```
If the payload is too large for a regex, cap it first:
```typescript
if (typeof image !== 'string' || image.length > 10_000_000 || !DATA_URI_RE.test(image)) {
  return NextResponse.json({ error: 'No image provided' }, { status: 400 })
}
```

---

### CR-02: `OcrLoadingOverlay` reads `document` during render — server crash / hydration mismatch

**File:** `components/wizard/OcrLoadingOverlay.tsx:11`

**Issue:** The guard `typeof document === 'undefined'` short-circuits server-side rendering, but `createPortal(…, document.body)` on line 24 still executes on the client's first render pass before hydration. In Next.js App Router with React 19, this pattern causes a hydration mismatch: the server renders `null`, the client tries to render a portal into `document.body`, and React throws a hydration error in development (and silently corrupts the tree in production).

The correct pattern is to defer portal rendering until after mount using `useState` / `useEffect`.

**Fix:**
```typescript
'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle } from 'lucide-react'

export function OcrLoadingOverlay({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted || !visible) return null
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-label="Scanning your bill"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 transition-opacity duration-150"
    >
      <div className="flex flex-col items-center gap-4">
        <LoaderCircle size={40} className="text-white animate-spin" aria-hidden="true" />
        <p className="text-[16px] text-white">Scanning your bill…</p>
      </div>
    </div>,
    document.body,
  )
}
```

---

### CR-03: Parsed OCR response is trusted without validation — malformed data written to store

**File:** `app/api/ocr/route.ts:84-88`

**Issue:** After `JSON.parse(content)`, the result is cast directly to `{ items: { name: string; priceCents: number }[] }` with no runtime validation. If gpt-4o-mini returns structurally valid JSON that deviates from the schema (negative `priceCents`, non-integer float, missing `name`, empty `items` array with extra keys, etc.), those values are returned to the client and inserted into the Zustand store as-is.

The strict JSON schema in `response_format` mitigates this at the model level, but OpenAI does not guarantee schema enforcement for vision calls in all cases, and the schema itself has no constraint on value ranges.

**Fix:** Add a lightweight runtime check before returning:
```typescript
const parsed = JSON.parse(content) as unknown
if (
  !parsed ||
  typeof parsed !== 'object' ||
  !Array.isArray((parsed as Record<string, unknown>).items)
) {
  console.error('OCR error: response did not match expected schema')
  return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
}
// Sanitize each item
const items = ((parsed as { items: unknown[] }).items)
  .filter(
    (i): i is { name: string; priceCents: number } =>
      typeof (i as Record<string, unknown>).name === 'string' &&
      Number.isInteger((i as Record<string, unknown>).priceCents) &&
      (i as { priceCents: number }).priceCents > 0,
  )
return NextResponse.json({ items })
```

---

## Warnings

### WR-01: Zero-length string slips past image validation

**File:** `app/api/ocr/route.ts:34`

**Issue:** The guard is `image.length === 0`. A string of only whitespace (`"   "`) passes this check and is forwarded to OpenAI. The image should be rejected if it is blank after trimming, and this also relates to CR-01 above (the fix there subsumes this, but if CR-01 is not addressed immediately this is an independent correctness bug).

**Fix:**
```typescript
if (typeof image !== 'string' || image.trim().length === 0) {
  return NextResponse.json({ error: 'No image provided' }, { status: 400 })
}
```

---

### WR-02: `FileReader` is not cancelled on unmount — error logged after component is gone

**File:** `components/wizard/AddItemsStep.tsx:117-122`

**Issue:** The `FileReader` created inside `handleFileChange` has no cancellation mechanism. If the component unmounts (e.g., user navigates away) while `readAsDataURL` is in progress, `onloadend` fires on the unmounted component, calling `setBillImage`, `setOcrStatus`, and potentially `addItem`. With Zustand this does not cause a React "can't update state on unmounted component" warning (that warning was removed in React 18), but it does silently corrupt the store. The `fetch` call that follows has the same problem — there is no `AbortController` tied to the component lifecycle.

**Fix:**
```typescript
const abortRef = useRef<AbortController | null>(null)

useEffect(() => {
  return () => { abortRef.current?.abort() }
}, [])

// Inside handleFileChange, after compression:
abortRef.current?.abort()
abortRef.current = new AbortController()
const res = await fetch('/api/ocr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: base64 }),
  signal: abortRef.current.signal,
})
```
For `FileReader`, wrap in a helper that checks a cancelled flag or use `reader.abort()` via a ref.

---

### WR-03: Price input has no accessible error association (`aria-describedby` missing)

**File:** `components/wizard/AddItemsStep.tsx:221-225` and `286-290`

**Issue:** When `priceError` is set, the error message renders in a `<span>` below the input, but the `<Input>` element has only `aria-invalid` and no `aria-describedby` pointing at the error span. Screen readers announce "invalid" but do not read the error text unless the user explicitly navigates to it.

The same pattern is duplicated in both the inline edit block (line 221) and the add-item block (line 286).

**Fix:** Give the error span a stable `id` and add `aria-describedby` on the input:
```tsx
const priceErrorId = `price-error-${editState?.id ?? 'new'}`

<Input
  aria-invalid={editState!.priceError ? true : undefined}
  aria-describedby={editState!.priceError ? priceErrorId : undefined}
  ...
/>
{editState!.priceError && (
  <span id={priceErrorId} className="text-red-600 text-sm">
    {editState!.priceError}
  </span>
)}
```

---

### WR-04: `ocrRoute.test.ts` does not isolate module between tests — `POST` is cached after first import

**File:** `__tests__/ocrRoute.test.ts:23`

**Issue:** `callPOST` does `await import('@/app/api/ocr/route')` on every call. Node/Vitest caches modules, so after the first test all subsequent calls share the same `openai` singleton. If `process.env.OPENAI_API_KEY` is undefined (typical in CI), the `new OpenAI({ apiKey: undefined })` call throws on module init. The tests happen to pass because the mock replaces the `openai` module before any import, but the pattern is fragile: any test that imports the route first (before the mock is applied) will get the real OpenAI client.

More concretely: the `beforeEach` calls `createMock.mockReset()` but does not call `vi.resetModules()`, so the route module is never re-evaluated between tests. This means the `openai` client object instantiated at module scope (line 6 of `route.ts`) is shared across all tests — if one test mutates global state through the mock it may bleed into the next.

**Fix:**
```typescript
beforeEach(async () => {
  vi.resetModules()        // force fresh module evaluation per test
  createMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
```
Also set `process.env.OPENAI_API_KEY = 'test-key'` in the setup file or this `beforeEach` to avoid the undefined key reaching the OpenAI constructor in environments where the env var is absent.

---

## Info

### IN-01: `vitest.setup.ts` has a TODO for `@testing-library/jest-dom` that is unresolved

**File:** `vitest.setup.ts:13-16`

**Issue:** A TODO comment instructs adding `@testing-library/jest-dom` for custom DOM matchers, but it has not been done. Tests currently use `.toBeDefined()` / `.toBeTruthy()` instead of `.toBeInTheDocument()`, making failures less informative. The comment also advises running `npm install` without specifying `--save-dev`, which would put it in production dependencies.

**Fix:** Install the package and add the import:
```
npm install --save-dev @testing-library/jest-dom
```
In `vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```
Add to `vitest.config.ts` (or equivalent):
```typescript
setupFiles: ['./vitest.setup.ts']
```

---

### IN-02: `AddItemsStep.test.tsx` contains dead code in the item-add test

**File:** `__tests__/AddItemsStep.test.tsx:38-40`

**Issue:** Lines 38-40 assign `inputs` and `nameInput` but neither variable is ever used. The test immediately re-queries with `getByPlaceholderText` on lines 41-42. This is leftover scaffolding.

**Fix:** Remove the unused lines:
```typescript
// Delete these three lines:
const inputs = screen.getAllByRole('textbox')
const nameInput = inputs.find(...)
```

---

### IN-03: `app/layout.tsx` has no `<meta name="viewport">` tag — mobile layout may be broken

**File:** `app/layout.tsx:19-23`

**Issue:** The layout renders without a viewport meta tag. Next.js 15 injects a default viewport meta automatically via the `metadata` export, but only if the `viewport` export is present or if the default is explicitly not overridden. The current `metadata` object (lines 9-12) does not include a `viewport` key, and the `<html>` element does not carry it either. On mobile browsers without the viewport tag, the page renders at desktop width and the mobile-first layout breaks.

**Fix:** Add a viewport export to `layout.tsx`:
```typescript
import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}
```

---

_Reviewed: 2026-05-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
