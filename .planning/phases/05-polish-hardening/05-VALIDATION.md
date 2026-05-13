---
phase: 5
slug: polish-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green (199+ tests)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01 | 01 | 0 | ITEMS-04 | — | N/A | unit | `npm test -- --run AssignItemsStep` | ✅ extend | ⬜ pending |
| 05-02 | 01 | 0 | D-02 | — | N/A | unit | `npm test -- --run AssignItemsStep` | ✅ extend | ⬜ pending |
| 05-03 | 01 | 1 | D-03/D-05 | — | N/A | unit | `npm test -- --run ResultsStep` | ✅ extend | ⬜ pending |
| 05-04 | 01 | 1 | D-07 | — | N/A | unit | `npm test -- --run ShareLinkButton` | ✅ extend | ⬜ pending |
| 05-05 | 01 | 1 | D-08 | — | N/A | unit | `npm test -- --run GuestClaimingView` | ❌ W0 | ⬜ pending |
| 05-06 | 01 | 1 | D-09 | — | N/A | unit | `npm test -- --run GuestClaimingView` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/GuestClaimingView.test.tsx` — stub tests for D-08 (optimistic revert + inline error) and D-09 (done bar try/catch + inline error)
- [ ] `vitest.setup.ts` — add `navigator.clipboard` mock (covers D-03/D-05 copy test)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Safe area insets on iPhone notch/Dynamic Island | D-10 | Requires real iOS device or Xcode simulator | Open app on iPhone, navigate to wizard footer and results bottom bar, verify no clipping |
| Touch target 44×44px — person chips, claim rows | D-12 | Visual measurement | In Safari dev tools, inspect element sizing on `AssignItemsStep` person chips and `GuestClaimingView` claim rows |
| Camera permission hint visible below scan button | D-06 | Camera access flow | On mobile, open AddItemsStep, verify "Allow camera access if prompted." text appears below scan button |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
