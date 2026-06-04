---
phase: 04
slug: shareable-links
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | RESULTS-02 | — | N/A | unit | `npx vitest run src/app/api/session/` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | RESULTS-02 | — | N/A | unit | `npx vitest run src/app/api/session/` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | RESULTS-02 | T-04-01 | sessionId not guessable (nanoid) | unit | `npx vitest run src/app/api/session/` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | RESULTS-02 | T-04-02 | atomic claim prevents double-claim | unit | `npx vitest run src/app/api/session/` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | RESULTS-02 | — | N/A | unit | `npx vitest run src/components/` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | RESULTS-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/api/session/route.test.ts` — stubs for POST /api/session (RESULTS-02)
- [ ] `src/app/api/session/[sessionId]/route.test.ts` — stubs for GET session state
- [ ] `src/app/api/session/[sessionId]/claim/route.test.ts` — stubs for atomic claim
- [ ] `src/app/api/session/[sessionId]/done/route.test.ts` — stubs for done marking
- [ ] `@upstash/redis`, `nanoid`, `swr` installed (npm install)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-device claiming (host + 2 guests on separate phones) | RESULTS-02 | Requires physical devices or multi-browser orchestration not feasible in jsdom | Open 3 browser tabs: host tab creates session, 2 guest tabs open split URL, each picks different name, claims items, taps done. Verify host sees all done. |
| 3-second polling updates across devices | RESULTS-02 | Real-time coordination across processes not feasible in unit tests | Guest A claims item; verify Guest B sees "Taken by [A]" within 3 seconds without refresh. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
