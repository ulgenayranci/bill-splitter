---
phase: 2
slug: ocr-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds (85 baseline + Phase 2 additions) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green (85 existing + Phase 2 additions)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | — | — | N/A (setup) | unit | `npx vitest run __tests__/useBillStore.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | OCR-01 | T-2-01 | OPENAI_API_KEY stays server-side | unit | `npx vitest run __tests__/ocrRoute.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | OCR-01 | — | N/A | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | Partial | ⬜ pending |
| 2-02-02 | 02 | 1 | OCR-03 | — | N/A | unit | `npx vitest run __tests__/OcrLoadingOverlay.test.tsx` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 1 | OCR-03 | — | N/A | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | Partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.setup.ts` — add `URL.createObjectURL = vi.fn(() => 'blob:mock-url')` and `URL.revokeObjectURL = vi.fn()` mocks (required for file-selection tests in jsdom 29)
- [ ] `__tests__/useBillStore.test.ts` — new cases for `billImageUrl`, `ocrStatus`, `setBillImage`, `setOcrStatus` actions
- [ ] `__tests__/AddItemsStep.test.tsx` — new cases for scan button visibility, OCR item population, overlay rendering, error toast trigger
- [ ] `__tests__/ocrRoute.test.ts` — new file; unit tests for Route Handler parsing logic (mock `openai` module with `vi.mock('openai', ...)`)
- [ ] `__tests__/OcrLoadingOverlay.test.tsx` — new file; renders when `visible=true`, absent when `visible=false`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS HEIC→JPEG conversion works | OCR-01 | Requires physical iPhone; jsdom cannot simulate camera MIME types | On iOS Safari: tap "Scan bill", take photo, confirm thumbnail appears and OCR returns items (not error) |
| OCR accuracy on real thermal receipts | OCR-01 | Requires real restaurant receipt; accuracy is probabilistic | Scan 3 receipts in varying lighting; verify items and prices match within 1 error each |
| Loading overlay blocks all interaction | OCR-03 | Browser interaction test; hard to automate reliably | Slow network (DevTools throttle to Slow 3G), tap "Scan bill", try tapping other elements during load |
| Error toast auto-dismisses at 4 seconds | OCR-03 | Timer-based; vitest fake timers adequate but manual confirmation preferred | Simulate OCR failure; watch toast appear and self-dismiss without user action |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
