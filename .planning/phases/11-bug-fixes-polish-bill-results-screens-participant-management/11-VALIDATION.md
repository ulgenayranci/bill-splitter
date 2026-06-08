---
phase: 11
slug: bug-fixes-polish-bill-results-screens-participant-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run __tests__/<file>.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds (existing suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run __tests__/<modified-file>.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

> Requirement IDs (REQ-XX) are assigned during planning; the decision IDs (D-01..D-09) from
> 11-CONTEXT.md are listed here as the stable behavior anchors and will be mapped to REQ IDs in PLAN.md.

| Decision | Behavior | Wave | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|------|------------|-----------------|-----------|-------------------|-------------|--------|
| D-05 `remove_person` | Lua eval called; `people[]` purged; claims/personSlots/donePeople/tips freed | 1 | T-11-01 | Op accepts any personId (flat model); name/id validated server-side | unit (route) | `npx vitest run __tests__/editRoute.test.ts` | ✅ add tests | ⬜ pending |
| D-05 `rename_person` | Lua eval called; name updated atomically | 1 | T-11-01 | newName trimmed, non-empty, ≤50 chars enforced server-side | unit (route) | `npx vitest run __tests__/editRoute.test.ts` | ✅ add tests | ⬜ pending |
| D-05 validation | Empty/too-long name → 400; missing/invalid personId → 400 | 1 | T-11-01 | Reject malformed input before eval | unit (route) | `npx vitest run __tests__/editRoute.test.ts` | ✅ add tests | ⬜ pending |
| D-06 | Removing person with claims frees those items back to unclaimed | 1 | — | N/A | unit (route) | `npx vitest run __tests__/editRoute.test.ts` | ✅ add test | ⬜ pending |
| `person_not_found` | `remove_person`/`rename_person` for absent personId returns 404/409 | 1 | — | N/A | unit (route) | `npx vitest run __tests__/editRoute.test.ts` | ✅ add test | ⬜ pending |
| D-01 | Receipt button absent from DOM | 2 | — | N/A | unit (component) | `npx vitest run __tests__/BillViewHeader.test.tsx` | ✅ update Test 7 | ⬜ pending |
| D-02 | Share button has ≥44px tap target | 2 | — | N/A | unit (component) | `npx vitest run __tests__/BillViewHeader.test.tsx` | ✅ add test | ⬜ pending |
| D-07 | Remove/rename affordances present in PersonSlotPicker when callbacks passed | 2 | — | N/A | unit (component) | `npx vitest run __tests__/PersonSlotPicker.test.tsx` | ✅ add tests | ⬜ pending |
| Self-removal | Viewer's personId removed → identity modal opens (not SessionExpiredScreen) | 2 | — | N/A | unit (component) | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ add test | ⬜ pending |
| D-03 | Unclaimed section shows when items unclaimed | 2 | — | N/A | unit (component) | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ add test | ⬜ pending |
| D-04 | Playful headline when unclaimed; positive when fully claimed | 2 | — | N/A | unit (component) | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ add test | ⬜ pending |
| D-08 | "Add a tip" is a Button element (not anchor/underline) | 2 | — | N/A | unit (component) | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ add test | ⬜ pending |
| D-09 | Currency `<select>` absent from DOM | 2 | — | N/A | unit (component) | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ add test | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No new test files need to be created;
all tests extend existing files (`editRoute.test.ts`, `BillViewHeader.test.tsx`,
`PersonResultsScreen.test.tsx`, `PersonSlotPicker.test.tsx`, `CollaborativeClaimingView.test.tsx`).

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Cross-device live propagation of rename/remove via SWR 3s poll | D-07 | Requires two real clients on the same session; SWR polling not exercised in unit tests | Open the same `/split/{id}` on two devices; rename/remove on one; confirm the other updates within ~3s |
| Share button is comfortably tappable on a real phone | D-02 | Touch-target ergonomics are physical, not assertable in jsdom beyond size | On mobile, tap the Share button; confirm it triggers share/copy without mis-taps |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none required)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
