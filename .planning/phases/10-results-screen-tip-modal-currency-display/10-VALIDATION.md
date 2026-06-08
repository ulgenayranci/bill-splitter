---
phase: 10
slug: results-screen-tip-modal-currency-display
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-08
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (jsdom) + React Testing Library; `tsc` for type checking |
| **Config file** | `vitest.config.mts` (+ `vitest.setup.ts`) |
| **Quick run command** | `npx vitest run <test-file>` (single file, no watch) |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~15–30 seconds (full suite + tsc) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <task-test-file>`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite + tsc must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | CURR-02, CURR-03 | T-10-01 | Invalid/empty currencyCode falls back to legacy `$X.XX` without throwing | unit (TDD RED) | `npx vitest run __tests__/billMath.test.ts` | ✅ existing | ⬜ pending |
| 10-01-02 | 01 | 1 | CURR-02, CURR-03 | T-10-01 | try/catch around Intl.NumberFormat; zero-decimal currencies not divided by 100 | unit (TDD GREEN) | `npx vitest run __tests__/billMath.test.ts && npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 10-02-01 | 02 | 1 | CURR-02, CURR-03 | T-10-03 | update_currency body rejected when non-string/empty/>10-char (RED expects 400s) | unit (TDD RED) | `npx vitest run __tests__/editRoute.test.ts` | ✅ existing | ⬜ pending |
| 10-02-02 | 02 | 1 | CURR-02, CURR-03 | T-10-03, T-10-05, T-10-SC | validateOp guards before SET; last-write-wins session singleton (no Lua) | unit (TDD GREEN) | `npx vitest run __tests__/editRoute.test.ts && npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 10-03-01 | 03 | 2 | RESULTS-03, RESULTS-04, CURR-02, CURR-03 | T-10-06 | clipboard text assembled as plain string (no HTML sink) | component (TDD RED) | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ existing | ⬜ pending |
| 10-03-02 | 03 | 2 | RESULTS-03, CURR-02 | T-10-06 | per-person reconciliation; grand total items-only (D-03) | component (TDD GREEN) | `npx vitest run __tests__/PersonResultsScreen.test.tsx -t "accordion\|tip\|total\|currency"` | ✅ existing | ⬜ pending |
| 10-03-03 | 03 | 2 | RESULTS-04, CURR-03 | T-10-06, T-10-07, T-10-08 | New Split clears only local identity (not Redis); currency change delegated via required onCurrencyChange | component (TDD GREEN) | `npx vitest run __tests__/PersonResultsScreen.test.tsx && npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 10-04-01 | 04 | 3 | TIP-02, CURR-02 | T-10-09 | tip logic preserved verbatim; Dialog-content shape (no page chrome) | component (TDD RED) | `npx vitest run __tests__/TipScreen.test.tsx` | ✅ existing | ⬜ pending |
| 10-04-02 | 04 | 3 | TIP-02, CURR-02 | T-10-09 | client clamps custom % to MAX_TIP_PERCENT=100; currencyCode threaded into both formatCents | component (TDD GREEN) | `npx vitest run __tests__/TipScreen.test.tsx && npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 10-04-03 | 04 | 3 | TIP-02, CURR-02 | T-10-10, T-10-11 | derivePhase maps donePeople→'results' (no removed phase literal); Tip Dialog at top level; currency write owned by this tier | integration (full suite) | `! grep -q "'tip'" 'app/split/[sessionId]/CollaborativeClaimingView.tsx' && npx tsc --noEmit && npx vitest run` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test infrastructure already exists (vitest 4.x + RTL configured via `vitest.config.mts` / `vitest.setup.ts`). No framework install or stub scaffolding is needed — every test target file already exists and is extended in-place by the TDD RED task of each plan:

- [x] `__tests__/billMath.test.ts` — extended by 10-01-01 (RED): EUR/JPY/GBP/empty-string fallback cases for `formatCents(cents, currencyCode)`
- [x] `__tests__/editRoute.test.ts` — extended by 10-02-01 (RED): `update_currency` op block (valid + 3 rejection cases)
- [x] `__tests__/PersonResultsScreen.test.tsx` — extended by 10-03-01 (RED): multi-person accordion, no-tip-on-others, grand total, copy summary, edit bill, currency cases; render helper updated to new props (incl. required `onCurrencyChange`)
- [x] `__tests__/TipScreen.test.tsx` — extended by 10-04-01 (RED): Dialog-content shape (no `onBack`), `currencyCode` EUR formatting case

*All Wave-0 test-extension work is covered by the RED tasks above. No additional Wave 0 stubs required — existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Currency override propagates to other devices on next SWR poll | CURR-03 | Cross-device shared-state propagation cannot be asserted in a single jsdom unit test | Open the same session on two phones; change currency on device A; confirm device B shows the new symbol after the next poll (~poll interval) |
| Fixed bottom CTA bar respects iOS safe-area inset and does not cover the grand total | RESULTS-04 | Visual layout / safe-area-inset rendering is device-specific | On an iOS device, open Results; confirm the Copy/Edit/New Split bar sits above the home indicator and the grand total is fully visible |

*Per-task automated coverage is otherwise complete; the two rows above are inherently device/visual.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — all test files pre-exist; RED tasks extend them)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-08
