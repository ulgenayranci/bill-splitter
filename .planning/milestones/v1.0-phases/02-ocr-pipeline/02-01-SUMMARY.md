---
phase: "02"
plan: "01"
subsystem: "ocr-foundation"
tags: [dependencies, zustand, testing, jsdom, openai]
dependency_graph:
  requires: []
  provides: [openai-dependency, browser-image-compression-dependency, env-var-documentation, jsdom-url-mocks, billImageUrl-state, ocrStatus-state]
  affects: [stores/useBillStore.ts, vitest.setup.ts, package.json]
tech_stack:
  added: [openai@6.37.0, browser-image-compression@2.0.2]
  patterns: [zustand-store-extension, jsdom-global-mocks, blob-url-revocation-on-reset]
key_files:
  created: [.env.local.example, __tests__/ocrRoute.test.ts, __tests__/OcrLoadingOverlay.test.tsx]
  modified: [package.json, package-lock.json, vitest.setup.ts, stores/useBillStore.ts, __tests__/useBillStore.test.ts]
decisions:
  - "revokeObjectURL in reset() called before INITIAL_STATE spread to prevent memory leak from orphaned blob URLs"
  - "vi.spyOn with mockClear() pattern to isolate spy from the global vi.fn() mock already in place from vitest.setup.ts"
metrics:
  duration: "135s"
  completed_date: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 2 Plan 01: OCR Foundation Summary

**One-liner:** Installed openai@6.37.0 + browser-image-compression@2.0.2, documented OPENAI_API_KEY, added jsdom URL mocks, and extended Zustand store with billImageUrl/ocrStatus state and blob-URL revocation on reset.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install OCR dependencies and document OpenAI env var | 48ffaf8 | package.json, package-lock.json, .env.local.example |
| 2 | Add jsdom URL mocks to vitest.setup.ts | 1e769f1 | vitest.setup.ts |
| 3 | Extend useBillStore with billImageUrl + ocrStatus + test stubs | 6b677fa | stores/useBillStore.ts, __tests__/useBillStore.test.ts, __tests__/ocrRoute.test.ts, __tests__/OcrLoadingOverlay.test.tsx |

---

## Dependency Versions Installed

| Package | Resolved Version | Declared in package.json |
|---------|-----------------|--------------------------|
| openai | 6.37.0 | ^6.37.0 |
| browser-image-compression | 2.0.2 | ^2.0.2 |

Both installed under `dependencies` (not devDependencies) — required at runtime for the OCR route handler and client-side image compression.

---

## Environment Variable Documentation

- `.env.local.example` created at repo root with empty `OPENAI_API_KEY=` placeholder
- `.env.local` (the real secrets file) was NOT created — developer fills it locally
- No `NEXT_PUBLIC_` prefix anywhere — the key stays server-side only
- Security verification: `grep NEXT_PUBLIC_OPENAI .env.local.example` returns 0 matches; `grep 'OPENAI_API_KEY=sk-' .env.local.example` returns 0 matches

---

## Test Results

| Test file | Before | After | Status |
|-----------|--------|-------|--------|
| useBillStore.test.ts | 11 tests | 19 tests | All pass |
| ocrRoute.test.ts | (new stub) | 1 skipped | Pass (skip) |
| OcrLoadingOverlay.test.tsx | (new stub) | 1 skipped | Pass (skip) |
| Full suite | 85 active | 93 active + 2 skipped | All pass |

---

## Notes for Downstream Plans

### For Plan 02 (OCR Route Handler):
- `openai` package importable from `app/api/ocr/route.ts` as a server-side dependency
- Env var name: `OPENAI_API_KEY` (server-only, never `NEXT_PUBLIC_OPENAI_API_KEY`)
- Test stub at `__tests__/ocrRoute.test.ts` ready to be filled with real assertions

### For Plan 03 (UI Integration):
- `setBillImage(url: string | null)` — sets billImageUrl in store
- `setOcrStatus(status: 'idle' | 'loading' | 'done' | 'error')` — sets ocrStatus in store
- `reset()` handles blob-URL cleanup automatically (no manual revoke needed in components)
- Test stub at `__tests__/OcrLoadingOverlay.test.tsx` ready to be filled with real assertions
- `URL.createObjectURL` returns `'blob:mock-url'` in all test environments (jsdom mock in vitest.setup.ts)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.spyOn accumulation in blob URL revocation tests**
- **Found during:** Task 3 — first test run showed 2 calls instead of 1
- **Issue:** `vi.spyOn(URL, 'revokeObjectURL')` wraps the global `vi.fn()` mock from vitest.setup.ts. Prior tests in the same suite that call `reset()` (specifically the `setBillImage(null)` and `setBillImage('blob:abc')` tests that trigger reset via `beforeEach`) had accumulated calls visible to the spy.
- **Fix:** Added `revokeSpy.mockClear()` immediately after `vi.spyOn()` in both spy tests to zero the call count before the assertion window.
- **Files modified:** `__tests__/useBillStore.test.ts`
- **Commit:** 6b677fa

---

## Self-Check: PASSED

- `.env.local.example` exists: FOUND
- `node_modules/openai/package.json` exists: FOUND
- `node_modules/browser-image-compression/package.json` exists: FOUND
- `__tests__/ocrRoute.test.ts` exists: FOUND
- `__tests__/OcrLoadingOverlay.test.tsx` exists: FOUND
- Commit 48ffaf8: FOUND (Task 1)
- Commit 1e769f1: FOUND (Task 2)
- Commit 6b677fa: FOUND (Task 3)
- Full test suite: 93 active passing + 2 skipped
