---
phase: 03
slug: ai-expansion-disambiguation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run __tests__/expandRoute.test.ts __tests__/clarifyRoute.test.ts __tests__/AddItemsStep.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | OCR-02 | T-03-01 | Item count mismatch triggers D-03 fallback | unit | `npx vitest run __tests__/expandRoute.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | OCR-02 | T-03-02 | Returns 400 for missing/invalid items | unit | `npx vitest run __tests__/expandRoute.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | OCR-02 | T-03-03 | Returns 500 with generic error (no OpenAI details leaked) | unit | `npx vitest run __tests__/expandRoute.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 0 | OCR-04 | T-03-04 | /api/clarify returns displayName for valid image + rawName | unit | `npx vitest run __tests__/clarifyRoute.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 0 | OCR-04 | — | /api/clarify returns empty displayName on failure (not 500) | unit | `npx vitest run __tests__/clarifyRoute.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | OCR-02 | — | N/A | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | ❌ W0 additions | ⬜ pending |
| 03-02-02 | 02 | 1 | OCR-02 | — | N/A | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | ❌ W0 additions | ⬜ pending |
| 03-02-03 | 02 | 1 | OCR-02 | T-03-03 | Expansion error falls back to raw names (no dead end) | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | ❌ W0 additions | ⬜ pending |
| 03-03-01 | 03 | 1 | OCR-04 | — | N/A | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | ❌ W0 additions | ⬜ pending |
| 03-03-02 | 03 | 1 | OCR-04 | — | N/A | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | ❌ W0 additions | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/expandRoute.test.ts` — stubs for OCR-02 API contract (expand route)
- [ ] `__tests__/clarifyRoute.test.ts` — stubs for OCR-04 API contract (clarify route)
- [ ] New test cases in `__tests__/AddItemsStep.test.tsx` — expansion flow, Review badges, disambiguation dialog
- [ ] New test case in `__tests__/OcrLoadingOverlay.test.tsx` — `message` prop rendering

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two loading phases feel like a single coherent flow | OCR-02 | Visual/UX judgment | Scan a receipt; confirm "Scanning bill…" transitions smoothly to "Expanding names…" without jarring pause |
| Orange "Review" badge is visually distinct but not alarming | OCR-02 | Visual/UX judgment | Verify badge uses amber color (not red), appears on row, doesn't feel alarming |
| Disambiguation dialog has two large tap targets | OCR-04 | Visual/UX judgment | On mobile, tap a "Review" item; verify "Type name" and "Take menu photo" are large enough to tap |
| Menu photo camera opens rear camera on mobile | OCR-04 | Device-specific | On iOS/Android, tap "Take menu photo"; confirm rear camera opens |
| LLM timeout fallback — raw names remain editable | OCR-02 | Requires slow network | Simulate timeout; verify raw OCR names appear in list, each still editable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
