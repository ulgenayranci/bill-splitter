# Retrospective

A living record of what worked, what didn't, and lessons carried forward across milestones.

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-06-04
**Phases:** 6 | **Plans:** 21 | **Tasks:** 34 | **~6,270 LOC TS/TSX | 232 commits**

### What Was Built
Photo → OCR (GPT-4o-mini vision) → AI-cleaned items → collaborative per-person claiming (quantity steppers, shared items) → per-person tips → results. Upstash Redis sessions with atomic Lua claim writes. Live on Vercel.

### What Worked
- **Integer-cents from day one** — eliminated a whole class of rounding bugs in split math; never had to retrofit.
- **Single GPT-4o-mini vision call** for OCR + expansion kept the pipeline simple and accurate vs a Tesseract + separate-LLM approach.
- **Vertical slices per plan** (foundation → server → client) kept each plan independently testable; test suites stayed green across phases.
- **Lua eval for atomic claims** — caught early that `redis.multi()` isn't atomic on Upstash REST; the Lua approach held up under concurrent claiming.

### What Was Inefficient
- **Phase ordering churn** — Phase 6 (collaborative) landed before Phase 5 (polish), and the wizard step order was reworked twice (P3+P4 this session). Signals the flow wasn't settled before building.
- **Host role over-built** — the approval/dispute/assign machinery (~180 refs across 21 files) became the app's biggest complexity sink and is being removed wholesale in v2. Built moderation before validating it was needed.
- **UAT tracking drift** — on-device UAT items (Phases 2–5) stayed `human_needed` through close; a quick task (P2) shipped without its SUMMARY. Tracking lagged the actual work.

### Patterns Established
- Integer-cents everywhere; derived totals computed on demand, never stored.
- Single Zustand store owns all wizard state.
- Server-only `OPENAI_API_KEY`; generic error envelopes (never leak provider internals).
- Atomic mutations via Lua on Upstash.

### Key Lessons
- **Settle the flow before building the flow.** The biggest rework (wizard reorder, host-role removal) traces to UX decisions made during/after implementation rather than before.
- **Don't build moderation before you've felt the chaos.** The host role solved a problem the trusted-dinner-group use case rarely has.
- **Keep tracking artifacts honest at close** — write the SUMMARY even for inline/quick work, or the audit surfaces phantom gaps.

### Cost Observations
- Model mix: balanced profile (Opus for planning/discussion, Sonnet for execution).
- v1 spanned ~26 days across many sessions.

---

## Milestone: v2.0 — easy-billsy Redesign

**Shipped:** 2026-06-24
**Phases:** 5 (7–11) | **Plans:** 26 | **Tasks:** 29 | ~20 days

### What Was Built
A clarity-driven rebuild: easy-billsy app shell, scan-first single Setup screen, "Who are you?" identity modal, a fully flat collaborative Bill View (no host role), locked per-person Results with a Results-launched tip modal, and currency recognition rendered throughout. The big structural move was deleting the entire host/approval/dispute machinery and replacing it with a flat model where anyone claims/edits via one secret-free link.

### What Worked
- **Removing the host role paid off exactly as predicted.** v1's biggest complexity sink (~180 refs) came out cleanly because Phase 8 led with a schema flatten + a RED-by-design Wave-0 contract test, so the API surgery had a green target to hit.
- **Reuse of the largest-remainder pattern** for splits kept cent-conservation consistent across single- and multi-qty paths.
- **The audit-before-close gate caught real drift** — stale traceability checkboxes, an unverified Phase 7, and dead wizard code surfaced before tagging rather than after.

### What Was Inefficient
- **The milestone "completed" once already (after Phase 10) and had to be reopened** for Phase 11 UAT bugs — verification ran before UAT, so "done" was premature. Same "settle before declaring done" theme as v1.
- **Verification reports never flipped from `human_needed`** even after UAT passed; the status drifted from reality and the close audit had to reconcile it by hand.
- **Two billing bugs in the split math reached "complete."** A cent-conservation rounding bug (fixed 2026-06-19) and a partial-claim over-charge bug (fixed 2026-06-24, the day of close) both slipped past verification — the multi-qty/partial-claim cases weren't in the test matrix until they bit.

### Patterns Established
- Lead schema/API surgery with a RED Wave-0 contract test that defines "done."
- One source of truth for split math (`computeQtyWeightedShares`) shared by card display and billing, so display === billed by construction.
- Currency as ISO 4217 + `Intl.NumberFormat`, threaded OCR → store → session → every `formatCents` site.

### Key Lessons
- **Run UAT before declaring a milestone done, and flip the verification status when it passes.** Premature completion + stale `human_needed` reports caused the reopen and the close-time reconciliation.
- **Money math needs an adversarial test matrix up front.** Both split bugs lived in the partial/multi-quantity corners that weren't enumerated — exactly where a "find the cases that break cent-conservation" pass would have caught them.
- **Tracking artifacts still drift at close** (recurring from v1) — stale checkboxes and dead code accumulate; budget a cleanup pass.

### Cost Observations
- Model mix: balanced profile (Opus planning/discussion, Sonnet execution + audit subagents).
- Heavy quick-task usage (9 quick tasks) for UI polish and UAT follow-ups alongside the 5 planned phases.

---

## Cross-Milestone Trends

| Metric | v1.0 | v2.0 |
|--------|------|------|
| Phases | 6 | 5 |
| Plans | 21 | 26 |
| LOC (TS/TSX) | ~6,270 | (rebuild — net change modest; host code removed, flat code added) |
| Recurring theme | Flow not settled before build → rework | Premature "done" + tracking drift; money-math edge cases slip past verification |

**Carried-forward lesson (both milestones):** declare "done" only after the real-world pass (UAT / adversarial math), and keep verification/tracking artifacts honest at close — gaps that look like phantoms in the audit are usually just un-updated status.
