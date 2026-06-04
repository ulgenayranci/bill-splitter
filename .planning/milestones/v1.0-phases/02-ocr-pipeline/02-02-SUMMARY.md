---
phase: "02"
plan: "02"
subsystem: "ocr-route-handler"
tags: [api-route, openai, gpt-4o-mini, vision, json-schema, unit-tests, vi-mock]
dependency_graph:
  requires: [openai-dependency, env-var-documentation]
  provides: [ocr-post-handler, ocr-api-contract, ocr-unit-tests]
  affects: [app/api/ocr/route.ts, __tests__/ocrRoute.test.ts]
tech_stack:
  added: []
  patterns: [next-app-router-route-handler, openai-vision-json-schema, vi-mock-module-replacement]
key_files:
  created: [app/api/ocr/route.ts]
  modified: [__tests__/ocrRoute.test.ts]
decisions:
  - "Both prompt-level and json_schema-level priceCents integer constraints required per Pitfall 1 in 02-RESEARCH.md — model returns floats without dual reinforcement"
  - "Generic { error: 'OCR failed' } response body on all failure paths — OpenAI internals never reflected to client (T-2-04 mitigation)"
  - "maxDuration = 30 chosen as safe Vercel Hobby ceiling well under 60s limit"
metrics:
  duration: "8min"
  completed_date: "2026-05-09"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 2 Plan 02: OCR Route Handler Summary

**One-liner:** Implemented POST /api/ocr with GPT-4o-mini vision and strict JSON schema (priceCents: integer), plus 7 unit tests using vi.mock to cover success, three 400 paths, OpenAI throw with no-leak assertion, malformed JSON, and null content.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement app/api/ocr/route.ts (POST handler) | 90e1d6d | app/api/ocr/route.ts |
| 2 | Replace ocrRoute test stub with unit tests | c82e2fb | __tests__/ocrRoute.test.ts |

---

## API Contract (for Plan 03)

```typescript
// Request shape (client → POST /api/ocr):
// { image: string }   image is a base64 data URL: "data:image/jpeg;base64,..."

// Success response shape (200):
// { items: { name: string; priceCents: number }[] }
// priceCents is always an integer (e.g. $12.99 → 1299)

// Error response shapes:
// 400 — missing or non-string image field: { error: 'No image provided' }
// 400 — unparseable JSON body:             { error: 'Invalid JSON body' }
// 500 — OpenAI failure or parse error:     { error: 'OCR failed' }
//        (OpenAI internals NEVER in response body)
```

**Plan 03 usage pattern:**
```typescript
const res = await fetch('/api/ocr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: base64DataUrl }),
})
if (res.ok) {
  const { items } = await res.json()
  items.forEach(({ name, priceCents }) => addItem({ name, priceCents }))
} else {
  // trigger error toast
  setOcrStatus('error')
}
```

---

## Test Coverage

| Test | Expected Status | Assertion |
|------|----------------|-----------|
| Successful gpt-4o-mini call | 200 | Returns parsed items, verifies model + json_schema strict |
| Missing image field | 400 | `{ error: 'No image provided' }` |
| Non-string image field | 400 | `{ error: 'No image provided' }` |
| Invalid JSON body | 400 | Status 400 |
| OpenAI throws | 500 | `{ error: 'OCR failed' }`, "rate-limited xyz123" NOT in body |
| Malformed JSON content | 500 | `{ error: 'OCR failed' }` |
| Null content from OpenAI | 500 | `{ error: 'OCR failed' }` |

**Live API calls in tests:** Zero — `vi.mock('openai', ...)` replaces the entire SDK module before route module initialization.

**console.error:** Silenced in all tests via `vi.spyOn(console, 'error').mockImplementation(() => {})` in `beforeEach`.

---

## Test Suite Results

| Test file | Tests | Status |
|-----------|-------|--------|
| ocrRoute.test.ts | 7 active | All pass |
| Full suite | 100 active + 1 skipped | All pass |

The 1 skipped test is the OcrLoadingOverlay stub created in Plan 01, to be filled in Plan 03.

---

## Security Mitigations Applied

| Threat ID | Mitigation |
|-----------|-----------|
| T-2-01 | `process.env.OPENAI_API_KEY` at module scope; no NEXT_PUBLIC_ prefix anywhere |
| T-2-02 | Body parsed in try/catch; image type-checked as non-empty string; 400 before any OpenAI call |
| T-2-03 | JSON.parse in try/catch; null/empty content handled separately; both return 500 |
| T-2-04 | Catch block logs `err` to console.error only; response body is literal `{ error: 'OCR failed' }` |
| T-2-06 | `response_format` json_schema with `strict: true` and `additionalProperties: false` constrains output |

---

## Deviations from Plan

None — plan executed exactly as written. The exact route.ts content specified in the `<action>` block was used verbatim. No openai SDK type changes required casts beyond those already in the plan.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the plan's threat model already covers.

---

## Self-Check: PASSED

- `app/api/ocr/route.ts` exists: FOUND
- `grep "gpt-4o-mini" app/api/ocr/route.ts` returns at least 1: FOUND (3 matches)
- `grep "OPENAI_API_KEY" app/api/ocr/route.ts` returns at least 1: FOUND
- `grep "json_schema" app/api/ocr/route.ts` returns at least 1: FOUND (2 matches)
- `grep "strict: true" app/api/ocr/route.ts` returns at least 1: FOUND
- `grep "OCR failed" app/api/ocr/route.ts` returns at least 2: FOUND (2 matches)
- `grep "NEXT_PUBLIC_OPENAI" app/api/ocr/route.ts` returns 0: CONFIRMED
- `__tests__/ocrRoute.test.ts` has 7 it() calls: FOUND
- `grep "it.skip" __tests__/ocrRoute.test.ts` returns 0: CONFIRMED
- `vi.mock('openai')` present in test file: FOUND
- Commit 90e1d6d (Task 1): FOUND
- Commit c82e2fb (Task 2): FOUND
- Full test suite: 100 passing + 1 skipped
