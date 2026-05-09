---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Phase 2 planned — 3 plans ready to execute
last_updated: "2026-05-09T15:00:00.000Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 6
  completed_plans: 3
  percent: 20
---

# Project State

**Project:** Bill Splitter
**Milestone:** v1.0
**Last updated:** 2026-05-09

---

## Project Reference

**Core value:** Photo → items → each person picks what they had → everyone knows what they owe.
**Current focus:** Phase 02 — ocr-pipeline — Ready to execute

---

## Current Position

Phase: 02 (ocr-pipeline) — Ready to execute
Plan: 0 of 3 (plans created, not yet executed)
**Status:** Ready to execute

```
Progress: [██        ] 20%
Phase 1 █████ Phase 2 ░░░░░ Phase 3 ░░░░░ Phase 4 ░░░░░ Phase 5
```

---

## Performance Metrics

**Phases complete:** 1/5
**Plans complete:** 3/14
**Requirements done:** 6/12 (PEOPLE-01, ITEMS-01, ITEMS-02, ITEMS-03, TIP-01, RESULTS-01)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 12 min | 3 | 29 |
| 01 | 02 | 45 min | 2 | 4 |
| 01 | 03 | 7 min | 2 | 4 |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|
| Integer-cents arithmetic | Prevents floating-point rounding errors in split math — expensive to retrofit | Phase 1 |
| GPT-4o-mini vision for OCR | Single API call for OCR + abbreviation expansion; accuracy ~92-97% vs ~70-80% for Tesseract.js | Phase 2 |
| `<input type="file" capture>` for camera | Primary camera path — avoids iOS Safari one-strike getUserMedia permission model | Phase 2 |
| Upstash Redis for session store | Vercel KV deprecated Dec 2024; Upstash Redis is the replacement; 24h TTL covers use case | Phase 4 |
| Debounced polling (not WebSockets) | Assignment flow is non-concurrent (per-person isolation); polling avoids stateful server requirements that break Vercel serverless | Phase 4 |
| Zustand for client state | Single store for all interconnected state (tip depends on subtotals, etc.); no Provider issues with RSC | Phase 1 |
| personItemShare helper in ResultsStep.tsx (not lib/billMath) | UI display helper with same largest-remainder math; no need to expose in shared library | Phase 1 |
| Split DOM text node pattern for tests | When paragraph has child span for emphasis, query parent via label prefix then assert .textContent | Phase 1 |

### Architecture Commitments

- All prices stored as integer cents throughout — never floats in calculation paths
- Derived totals (per-person) computed on demand, never stored
- Single Zustand store owns all wizard state: people, items, assignments, tip/tax, wizard step, ocrStatus, syncStatus
- OCR + AI expansion is a single GPT-4o-mini vision call (not two separate calls per item)
- Session state persists in Upstash Redis keyed by nanoid session ID

### Todos

- [ ] Validate GPT-4o-mini vision pricing per receipt scan before launch
- [ ] Test OCR on real thermal receipts (faded ink, curled paper, dim light) during Phase 2
- [ ] Prototype LLM prompt for structured output (type, confidence, raw_name, display_name) early in Phase 2
- [ ] Validate that "claimed by [name]" display prevents double-claiming without real-time sync (Phase 4)
- [ ] Design menu photo fallback prompt during Phase 3 planning

### Blockers

None.

---

## Session Continuity

**Last session:** 2026-05-09T15:00:00Z
**Stopped at:** Phase 2 planned — 3 PLAN.md files created (02-01, 02-02, 02-03), verification passed
**Next action:** Run `/gsd-execute-phase 2` to execute all 3 plans.
**Context notes:** Phase 2 has 3 plans across 3 waves: Wave 0 (foundation: deps, store, test stubs), Wave 1 (OCR Route Handler), Wave 2 (UI integration: scan button, overlay, toast, AddItemsStep). Install needed: `npm install openai browser-image-compression`. Env needed: `.env.local` with `OPENAI_API_KEY`.
