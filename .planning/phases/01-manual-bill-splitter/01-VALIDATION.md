---
phase: 1
slug: manual-bill-splitter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.mts` — Wave 0 creates this |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run --coverage` |
| **Estimated runtime** | ~5-10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run __tests__/billMath.test.ts`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | ITEMS-01 | — | Price input validated with regex before parse | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | ITEMS-01 | — | `parsePriceCents("12.50")` returns 1250 | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 0 | ITEMS-01 | — | `parsePriceCents("0.1")` returns 10 (no float error) | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 0 | ITEMS-02 | — | `setAssignment` replaces previous assignment | unit | `npx vitest run __tests__/useBillStore.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 0 | ITEMS-03 | — | Shared 3-person split distributes remainder correctly | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 0 | TIP-01 | — | 18% of 1000 cents = 180 cents (no float drift) | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 0 | RESULTS-01 | — | `computePersonTotals` sum equals items total + tip | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-08 | 01 | 0 | PEOPLE-01 | — | `removePerson` cleans assignments map | unit | `npx vitest run __tests__/useBillStore.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-09 | 01 | 0 | PEOPLE-01 | — | Add people render + interaction (Step 1 renders ≥1 person) | component | `npx vitest run __tests__/AddPeopleStep.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.mts` — Vitest configuration file
- [ ] `__tests__/billMath.test.ts` — covers ITEMS-01, ITEMS-03, TIP-01, RESULTS-01
- [ ] `__tests__/useBillStore.test.ts` — covers PEOPLE-01, ITEMS-02
- [ ] `__tests__/AddPeopleStep.test.tsx` — covers PEOPLE-01 rendering
- [ ] Dev dependencies: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`
- [ ] `package.json` test script: `"test": "vitest"`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera/photo input visible on mobile | Phase 2 concern | UI interaction requires real device | — |
| iOS soft keyboard doesn't obscure input fields | ITEMS-01 | Requires real iOS device | Tap price field, verify keyboard doesn't hide it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
