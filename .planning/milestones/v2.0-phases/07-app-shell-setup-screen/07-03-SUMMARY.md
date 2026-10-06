---
phase: 07-app-shell-setup-screen
plan: 03
subsystem: api
tags: [openai, ocr, currency, zustand, iso-4217]
requires:
  - phase: 07-02
    provides: SetupStep scan flow that calls /api/ocr and stores the result
provides:
  - OCR currency detection — model returns currencyCode as ISO 4217, normalized server-side
  - currencyCode state + setCurrencyCode setter in useBillStore (persisted)
  - SetupStep wiring to store the detected code
affects: [phase-10]
tech-stack:
  added: []
  patterns: ["Untrusted model field regex-validated + defaulted server-side before reaching the client"]
key-files:
  created: [__tests__/ocrRoute.test.ts]
  modified: [app/api/ocr/route.ts, stores/useBillStore.ts, components/wizard/SetupStep.tsx]
key-decisions:
  - "currencyCode is detection + store ONLY this phase; threading through formatCents/displays deferred to Phase 10 (D-02)"
  - "Non-conforming model currencyCode falls back to 'USD' (D-01/D-02 default)"
patterns-established:
  - "Strict json_schema requires currencyCode; route normalizes [A-Za-z]{3} → upper-case else USD"
requirements-completed: [CURR-01]
duration: retroactive
completed: 2026-06-05
note: "Retroactive summary. Code shipped in commit 430b02f (feat(07): detect receipt currency as ISO 4217 code (CURR-01)); plan documented retroactively (commit dbb64c3). CURR-02/CURR-03 (display + graceful fallback UX) remain scoped to Phase 10."
---

# Phase 7 / Plan 03: OCR Currency Detection Summary

**The OCR route now detects the receipt's currency as a normalized ISO 4217 code and persists it in the store — detection + storage only, with display deferred to Phase 10.**

## Accomplishments

- **OCR prompt + schema** (`app/api/ocr/route.ts`): RECEIPT_PROMPT instructs the model to return `currencyCode` as a 3-letter ISO 4217 code (inferred from symbol/wording/locale, default USD); strict json_schema lists it in `required` with `additionalProperties:false` (CURR-01, D-01).
- **Server normalization**: a 3-letter `[A-Za-z]{3}` value is upper-cased, anything else falls back to `'USD'`; response is `{ items, currencyCode }` (D-01, D-02 default).
- **Store** (`stores/useBillStore.ts`): `currencyCode` field (default `DEFAULT_CURRENCY_CODE = 'USD'`) + `setCurrencyCode` setter, persisted via `partialize`.
- **Wiring** (`components/wizard/SetupStep.tsx`): stores `data.currencyCode` when present. Scope is detection + store only — NOT yet threaded through displays (Phase 10, D-02).

## Verification

- UAT round 1: Test 10 (currency detection + stored) ✓ — verified via `__tests__/ocrRoute.test.ts` (9/9: schema requires currencyCode, gbp→GBP normalization, garbled→USD fallback).
- Security: T-7-03-01 (currencyCode tampering) and T-7-03-02 (OCR error path info disclosure) verified closed in 07-SECURITY.md.

## Commits

- `430b02f` feat(07): detect receipt currency as ISO 4217 code (CURR-01)
