---
phase: 8
slug: flat-model-schema-api-surgery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 08-RESEARCH.md "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npx vitest run __tests__/editRoute.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant file (`npx vitest run __tests__/<file>`) — suite is fast, prefer full `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| edit route | 0 | CLAIM-03 (add/edit/remove via /edit, immediate) | — | Any participant mutates items; no host/approval gate | unit | `npx vitest run __tests__/editRoute.test.ts` | ❌ W0 | ⬜ pending |
| edit route | 0 | CLAIM-03 / D-01 (edit keeps claims, recalc shares) | — | Editing price/qty preserves claimants | unit | `npx vitest run __tests__/editRoute.test.ts` | ❌ W0 | ⬜ pending |
| edit route | 0 | CLAIM-03 (remove purges that item's claims) | — | Deleting an item clears its claim entries | unit | `npx vitest run __tests__/editRoute.test.ts` | ❌ W0 | ⬜ pending |
| claim route | 1 | CLAIM-01 (claim without host token) | T-6-* (Lua atomicity preserved) | No host/approval path; bounds-check loop intact | unit | `npx vitest run __tests__/sessionClaimRoute.test.ts` | ✅ (fixture update) | ⬜ pending |
| session create | 1 | D-04 (currencyCode in POST body → Redis) | — | currencyCode persisted, default 'USD' | unit | `npx vitest run __tests__/sessionRoute.test.ts` | ✅ (assertion) | ⬜ pending |
| session get | 1 | D-04 (currencyCode returned by GET) | — | currencyCode surfaced to client | unit | `npx vitest run __tests__/sessionGetRoute.test.ts` | ✅ (assertion) | ⬜ pending |
| host removal | 1 | Success #3 (5 host routes 404) | T-8-* (no host capability) | accept/dispute/edit-request/resolve-* removed | smoke (manual) | manual verify / route-absence test | N/A | ⬜ pending |
| test migration | 2 | Success #6 (CI green, flat-model replacements) | — | No host-concept fixtures remain | CI gate | `npx vitest run` | Partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/editRoute.test.ts` — stubs for CLAIM-03: add, edit_name, edit_price, edit_quantity, remove; D-01 (claims preserved + shares recalculated on price/qty edit); remove-purges-claims-for-that-item.

---

## Known Pre-Existing Failures (track distinctly — NOT Phase 8 regressions)

These 5 fail independently of Phase 8 and must not be masked or accidentally "fixed":
`__tests__/PersonSlotPicker.test.tsx`, `__tests__/AddPeopleStep.test.tsx` (×2), `__tests__/AddItemsStep.test.tsx`, `__tests__/CollaborativeClaimingView.test.tsx`. Logged in `07-.../deferred-items.md`. NOTE: `CollaborativeClaimingView.test.tsx` will itself be rewritten in this phase's test migration — its replacement must pass.
