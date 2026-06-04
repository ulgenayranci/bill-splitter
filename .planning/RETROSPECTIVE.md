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

## Cross-Milestone Trends

_(Populated as more milestones complete.)_

| Metric | v1.0 |
|--------|------|
| Phases | 6 |
| Plans | 21 |
| LOC (TS/TSX) | ~6,270 |
| Recurring theme | Flow not settled before build → rework |
