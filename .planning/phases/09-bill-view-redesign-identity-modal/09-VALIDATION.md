---
phase: 9
slug: bill-view-redesign-identity-modal
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-06
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --changed` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --changed`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled by the planner — one row per task with its requirement, test type, and command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01 T1 | 01 | 1 | CLAIM-02 (math) | — | Equal-split sum conservation (integer cents, no lost/extra cents) | unit | `npx vitest run __tests__/billMath.test.ts` | ✅ | ⬜ pending |
| 09-01 T2 | 01 | 1 | CLAIM-02 | T-09-01, T-09-02, T-09-03 | Atomic Lua share write; idempotent join; validateBody rejects bad action/joining | unit/route | `npx vitest run __tests__/sessionClaimRoute.test.ts` | ✅ | ⬜ pending |
| 09-02 T1 | 02 | 1 | IDENT-03 | T-09-04, T-09-05, T-09-06, T-09-07 | Server-side name validation; 20-person cap; atomic person+slot; server-generated personId | unit/route | `npx vitest run __tests__/editRoute.test.ts` | ✅ | ⬜ pending |
| 09-03 T1 | 03 | 1 | IDENT-01, IDENT-03 | T-09-08, T-09-09 | Taken names greyed (opacity-50) + non-selectable; inline-add trims/gates empty name | component | `npx vitest run __tests__/PersonSlotPicker.test.tsx` | ✅ | ⬜ pending |
| 09-03 T2 | 03 | 1 | IDENT-01 | T-09-08, T-09-09 | Dismiss blocked when allowClose=false (no identity yet); allowed when allowClose=true | component | `npx vitest run __tests__/IdentityModal.test.tsx` | ⬜ | ⬜ pending |
| 09-04 T1 | 04 | 1 | IDENT-03, CLAIM-06 | T-09-10 | Share affordance exposes join link by intent (anonymous session, no PII); read-only header | component | `npx vitest run __tests__/BillViewHeader.test.tsx` | ⬜ | ⬜ pending |
| 09-04 T2 | 04 | 1 | CLAIM-05 | T-09-11 | Read-only banner over polled data; no execution of session content | component | `npx vitest run __tests__/UnclaimedBanner.test.tsx` | ⬜ | ⬜ pending |
| 09-05 T1 | 05 | 2 | CLAIM-02, CLAIM-04 | T-09-12, T-09-13 | Card only emits onShareChange(boolean); share write is server-authoritative; your-share derived from public data | component | `npx vitest run __tests__/ClaimableItemCard.test.tsx` | ✅ | ⬜ pending |
| 09-06 T1 | 06 | 3 | IDENT-01, IDENT-02, IDENT-03, IDENT-04, CLAIM-02 (D-12) | T-09-14, T-09-15, T-09-16 | Identity restore honors only server-locked slots; optimistic writes rollbackOnError; add_person capped + share idempotent | component | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ | ⬜ pending |
| 09-06 T2 | 06 | 3 | CLAIM-05, CLAIM-06 (D-09, D-11) | T-09-17 | Warn-but-allow done dialog (no hard block); share-link CTA is intended capability | component | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*File Exists column reflects whether the test file already exists at plan time (✅) or is created during this phase / Wave 0 (⬜).*

---

## Wave 0 Requirements

- [ ] Equal-share math tests (`lib/billMath` — `computeEqualShareCents` largest-remainder, shares sum exactly) — `__tests__/billMath.test.ts` (09-01 T1)
- [ ] Share-claim contract test (tap-to-join/leave on qty-1 items via claim route) — `__tests__/sessionClaimRoute.test.ts` (09-01 T2)
- [ ] add_person route contract test (atomic create + slot lock, validation, 20-cap) — `__tests__/editRoute.test.ts` (09-02 T1)
- [ ] IdentityModal behavioral test (heading render, dismiss-block/allow) — `__tests__/IdentityModal.test.tsx` (09-03 T2, NEW file)
- [ ] BillViewHeader + UnclaimedBanner component tests — `__tests__/BillViewHeader.test.tsx`, `__tests__/UnclaimedBanner.test.tsx` (09-04, NEW files)
