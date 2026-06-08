---
phase: 10-results-screen-tip-modal-currency-display
plan: "01"
subsystem: lib/billMath
tags: [currency, formatting, tdd, intl]
dependency_graph:
  requires: []
  provides: [formatCents-currency-aware]
  affects: [lib/billMath.ts, __tests__/billMath.test.ts]
tech_stack:
  added: []
  patterns: [Intl.NumberFormat resolvedOptions, zero-decimal currency divisor]
key_files:
  created: []
  modified:
    - lib/billMath.ts
    - __tests__/billMath.test.ts
decisions:
  - "formatCents legacy no-arg path preserved verbatim (backward compatibility for ~10 call sites)"
  - "minimumFractionDigits ?? 2 null-coalescing for TypeScript strict mode compatibility"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-08"
  tasks: 2
  files: 2
---

# Phase 10 Plan 01: Currency-Aware formatCents Summary

**One-liner:** `formatCents` upgraded with optional `currencyCode` param using `Intl.NumberFormat` zero-decimal handling (JPY/KRW divisor=1 vs USD/EUR/GBP divisor=100), fully backward-compatible.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add failing formatCents currency tests (RED) | 0250eb6 | `__tests__/billMath.test.ts` |
| 2 | Implement currency-aware formatCents (GREEN) | 221d9e8 | `lib/billMath.ts` |

---

## What Was Built

Updated `formatCents` in `lib/billMath.ts` to accept an optional `currencyCode` parameter:

```typescript
export function formatCents(cents: number, currencyCode?: string): string
```

**Behavior:**
- No `currencyCode`: legacy `"$X.XX"` path, all existing call sites unchanged
- With `currencyCode`: uses `Intl.NumberFormat` with `resolvedOptions().minimumFractionDigits` to derive the correct divisor (`Math.pow(10, decimals)`)
- Zero-decimal currencies (JPY, KRW): `minimumFractionDigits=0` → divisor=1 → `formatCents(1250, 'JPY')` returns `"¥1,250"` (not divided by 100)
- Invalid/empty codes: `try/catch` falls back to legacy `"$X.XX"` (CURR-03, T-10-01 mitigated)

**Tests:** 4 new cases added (EUR, JPY, GBP, empty-string fallback) + 3 legacy cases preserved = 41 total tests, all green.

---

## TDD Gate Compliance

- RED gate: commit `0250eb6` — `test(10-01): add failing formatCents currency tests`
- GREEN gate: commit `221d9e8` — `feat(10-01): implement currency-aware formatCents`
- REFACTOR: not needed — implementation was clean first pass

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict: `minimumFractionDigits` typed as `number | undefined`**
- **Found during:** Task 2 (GREEN) — `npx tsc --noEmit` returned error TS2345
- **Issue:** `Intl.NumberFormatOptions.minimumFractionDigits` has type `number | undefined` in this TypeScript version; passing it directly to `Math.pow` triggers TS2345
- **Fix:** Added `?? 2` null-coalescing fallback: `const decimals = fmt.resolvedOptions().minimumFractionDigits ?? 2`
- **Files modified:** `lib/billMath.ts` line 33
- **Commit:** 221d9e8 (inline with GREEN implementation)

---

## Verification Results

```
npx vitest run __tests__/billMath.test.ts  → 41/41 PASS
npx tsc --noEmit                           → Exit 0 (no errors)
grep gate: minimumFractionDigits count     → 2 (≥1 required)
```

---

## Known Stubs

None — the implementation is fully functional. All call sites with no second arg continue to receive `"$X.XX"`. New call sites can pass `session.currencyCode` to get the correct symbol.

---

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. The `currencyCode` input path through `formatCents` is mitigated by the `try/catch` block as documented in T-10-01.

---

## Self-Check: PASSED

- `lib/billMath.ts` exists and contains `minimumFractionDigits`
- `__tests__/billMath.test.ts` exists and contains `JPY`, `EUR`, `GBP`
- Commits `0250eb6` (RED) and `221d9e8` (GREEN) exist in git log
