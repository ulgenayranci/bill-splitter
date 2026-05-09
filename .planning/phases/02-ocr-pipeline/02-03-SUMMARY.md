---
phase: "02"
plan: "03"
subsystem: "ocr-ui-integration"
tags: [react-portal, toast, providers, client-components, ocr-handler, file-input, image-compression, vitest]
dependency_graph:
  requires: [ocr-post-handler, billImageUrl-state, ocrStatus-state, openai-dependency, browser-image-compression-dependency]
  provides: [scan-bill-ux, loading-overlay, error-toast, bill-thumbnail, ocr-full-vertical-slice]
  affects: [app/providers.tsx, app/layout.tsx, components/wizard/OcrLoadingOverlay.tsx, components/wizard/OcrErrorToast.tsx, components/wizard/AddItemsStep.tsx, __tests__/OcrLoadingOverlay.test.tsx, __tests__/AddItemsStep.test.tsx]
tech_stack:
  added: []
  patterns: [react-createPortal, base-ui-toast-composition, client-server-component-boundary, esm-vi-mock, renderInProvider-test-pattern]
key_files:
  created:
    - app/providers.tsx
    - components/wizard/OcrLoadingOverlay.tsx
    - components/wizard/OcrErrorToast.tsx
  modified:
    - app/layout.tsx
    - components/wizard/AddItemsStep.tsx
    - __tests__/OcrLoadingOverlay.test.tsx
    - __tests__/AddItemsStep.test.tsx
decisions:
  - "All 12 existing AddItemsStep tests converted to renderInProvider because @base-ui/react throws when useToastManager called outside Toast.Provider (not a no-op as plan expected)"
  - "vi.mock('browser-image-compression') at module level instead of vi.spyOn (ESM default exports are not reconfigurable — Cannot redefine property: default)"
  - "Toast.Provider wraps OcrErrorToast as sibling of children in providers.tsx so both the OcrErrorToast viewport and any descendant using toastManager.add() share the same Provider context"
metrics:
  duration: "5 min"
  completed_date: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 2 Plan 03: OCR UI Integration Summary

**One-liner:** Wired the full OCR vertical slice: scan button triggers camera, loading overlay portal-blocks viewport, successful scan batch-inserts items + shows thumbnail, and failed scan dismisses overlay + shows 4s error toast via @base-ui/react Toast.Provider in app/providers.tsx.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire Toast.Provider via app/providers.tsx and update app/layout.tsx | f0b904a | app/providers.tsx, app/layout.tsx, components/wizard/OcrErrorToast.tsx |
| 2 | Build OcrLoadingOverlay (createPortal) and replace test stub | 2413272 | components/wizard/OcrLoadingOverlay.tsx, __tests__/OcrLoadingOverlay.test.tsx |
| 3 | Augment AddItemsStep with scan button, thumbnail, OCR handler, and 8 new tests | 3d007c0 | components/wizard/AddItemsStep.tsx, __tests__/AddItemsStep.test.tsx |

---

## Test Suite Results

| Test file | Before | After | Status |
|-----------|--------|-------|--------|
| AddItemsStep.test.tsx | 12 tests | 20 tests | All pass |
| OcrLoadingOverlay.test.tsx | 1 skipped (stub) | 3 tests | All pass |
| Full suite | 100 active + 1 skipped | 111 active | All pass |

**Final count:** 111 tests passing, 0 skipped.

---

## Existing AddItemsStep Tests That Needed `renderInProvider`

All 12 existing AddItemsStep tests were converted from `render(<AddItemsStep />)` to `renderInProvider(<AddItemsStep />)`.

**Why:** The plan anticipated that `Toast.useToastManager()` would return a no-op outside a Provider. However, the actual `@base-ui/react` 1.x implementation throws at runtime: `"Base UI: useToastManager must be used within <Toast.Provider>."` Since `AddItemsStep` now calls `Toast.useToastManager()` unconditionally at the top of the component, every test that renders `<AddItemsStep />` requires the Provider in scope.

This is the correct behavior — it's a safety guard that prevents silent toast failures. All 12 tests continue to validate the same assertions; only the render helper changed.

---

## Security Verification

```
grep -rn "OPENAI" components/ → 0 matches (confirmed)
```

No `OPENAI_API_KEY` or `process.env.OPENAI*` references exist in any client component. All OpenAI calls remain server-side in `app/api/ocr/route.ts`.

---

## Known Limitation: Pitfall 7 (Re-scan after ocrStatus='done')

After a successful scan, `ocrStatus` is set to `'done'` and the "Scan bill" button hides. The button does not reappear until `useBillStore.reset()` is called (session reset). There is currently no "re-scan" affordance for the user to replace extracted items with a new scan.

**Impact:** If the host selects the wrong image, they cannot re-scan without resetting the entire session and losing all added items/people.

**Planned resolution:** Phase 5 (Polish) — add a "Re-scan" affordance (e.g., clicking the thumbnail or a secondary "Rescan" button) that calls `reset()` on just the OCR state (clearing items, billImageUrl, ocrStatus back to 'idle') while preserving people.

This is a known Phase 2 limitation per Pitfall 7 in `02-RESEARCH.md`.

---

## Toast API Usage Note

`Toast.useToastManager().add(...)` is the supported way to surface user-facing toasts from any component descendant of `<Providers>`. The Provider lives in `app/providers.tsx`.

**Usage pattern:**
```typescript
const toastManager = Toast.useToastManager()
toastManager.add({
  description: "Your message here",
  timeout: 4000,
})
```

The `OcrErrorToast` component at `components/wizard/OcrErrorToast.tsx` renders the toast viewport via `Toast.Portal > Toast.Viewport`. Toasts appear in the bottom-center of the viewport (`max-w-[480px]`, `fixed bottom-4`).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] All existing AddItemsStep tests needed renderInProvider**
- **Found during:** Task 3 — first test run showed all 12 existing tests throwing "Base UI: useToastManager must be used within Toast.Provider"
- **Issue:** The plan stated: "Existing tests that call `render(<AddItemsStep />)` will continue to work because `Toast.useToastManager()` returns a no-op manager when used outside a Provider in current `@base-ui/react`." This was incorrect — @base-ui/react 1.x throws, it does not return a no-op.
- **Fix:** Applied `renderInProvider` to all 12 existing tests (plan's own contingency: "if any existing test fails because of 'no ToastContext', switch THAT test's render call to renderInProvider"). All 12 failed, so all 12 were converted.
- **Files modified:** `__tests__/AddItemsStep.test.tsx`
- **Commit:** 3d007c0

**2. [Rule 1 - Bug] vi.spyOn fails on ESM default export (browser-image-compression)**
- **Found during:** Task 3 — OCR fetch tests threw: "Cannot spy on export 'default'. Module namespace is not configurable in ESM."
- **Issue:** The plan's test code used `vi.spyOn(compressionMod, 'default').mockImplementation(...)` which fails in ESM module environments (Vitest/Node ESM). ESM module namespace objects have non-configurable descriptors.
- **Fix:** Added `vi.mock('browser-image-compression', () => ({ default: vi.fn(async (file) => file) }))` at module level. Removed `vi.spyOn` calls and per-test `compressionSpy.mockRestore()` from both OCR tests. The module-level mock provides a pass-through by default for all tests that do not override it.
- **Files modified:** `__tests__/AddItemsStep.test.tsx`
- **Commit:** 3d007c0

---

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond the plan's threat model.

Verification of T-2-08 (OPENAI_API_KEY exposure via client): `grep -rn "OPENAI" components/` returns 0 matches.

---

## Self-Check: PASSED

- `app/providers.tsx` exists: FOUND
- `app/layout.tsx` has `<Providers>`: FOUND
- `components/wizard/OcrErrorToast.tsx` exists: FOUND
- `components/wizard/OcrLoadingOverlay.tsx` exists: FOUND
- `grep 'use client' app/layout.tsx` returns 0: CONFIRMED
- `grep 'Toast.Provider' app/providers.tsx` returns 1: CONFIRMED
- `grep 'useToastManager' components/wizard/OcrErrorToast.tsx` returns 1: CONFIRMED
- `grep 'createPortal' components/wizard/OcrLoadingOverlay.tsx` returns 1: CONFIRMED
- `grep 'it.skip' __tests__/OcrLoadingOverlay.test.tsx` returns 0: CONFIRMED
- `grep 'OPENAI' components/` returns 0: CONFIRMED
- Commit f0b904a (Task 1): FOUND
- Commit 2413272 (Task 2): FOUND
- Commit 3d007c0 (Task 3): FOUND
- Full test suite: 111 passing, 0 skipped
