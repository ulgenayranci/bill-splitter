---
phase: 9
slug: bill-view-redesign-identity-modal
status: draft
nyquist_compliant: false
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
| — | — | — | IDENT-01..04, CLAIM-02, CLAIM-04..06 | — | — | unit/component | `npx vitest run` | ⬜ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Equal-share math tests (`lib/billMath` — `computeEqualShareCents` largest-remainder, shares sum exactly)
- [ ] Share-claim contract test (tap-to-join/leave on qty-1 items via claim route)
