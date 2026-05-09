---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-02-PLAN.md — OCR route handler (app/api/ocr/route.ts) + 7 unit tests passing
last_updated: "2026-05-09T19:20:00.000Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 6
  completed_plans: 5
  percent: 83
---

# Project State

**Project:** Bill Splitter
**Milestone:** v1.0
**Last updated:** 2026-05-09

---

## Project Reference

**Core value:** Photo → items → each person picks what they had → everyone knows what they owe.
**Current focus:** Phase 02 — ocr-pipeline — Plan 02 complete, Plan 03 next

---

## Current Position

Phase: 02 (ocr-pipeline) — Executing
Plan: 2 of 3 (02-02 complete)
**Status:** Ready to execute 02-03

```
Progress: [████      ] 40%
Phase 1 █████ Phase 2 ███░░ Phase 3 ░░░░░ Phase 4 ░░░░░ Phase 5
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
| 02 | 01 | 135s | 3 | 7 |
| 02 | 02 | 8 min | 2 | 2 |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|
| Integer-cents arithmetic | Prevents floating-point rounding errors in split math — expensive to retrofit | Phase 1 |
| revokeObjectURL in reset() before INITIAL_STATE spread | Prevents memory leaks from orphaned blob URLs when user resets session that had a photo | Phase 2 |
| vi.spyOn with mockClear() for jsdom URL spy isolation | Global vi.fn() mock in vitest.setup.ts accumulates calls across tests; mockClear() isolates spy window | Phase 2 |
| GPT-4o-mini vision for OCR | Single API call for OCR + abbreviation expansion; accuracy ~92-97% vs ~70-80% for Tesseract.js | Phase 2 |
| Dual priceCents integer constraint (prompt + json_schema) | Model returns floats without both prompt-level and schema-level integer enforcement (Pitfall 1 in 02-RESEARCH.md) | Phase 2 |
| Generic { error: 'OCR failed' } on all 500 paths | OpenAI internals never reflected to client; T-2-04 mitigation | Phase 2 |
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

**Last session:** 2026-05-09T19:20:00.000Z
**Stopped at:** Completed 02-02-PLAN.md — OCR route handler (app/api/ocr/route.ts) + 7 unit tests, 100 tests passing
**Next action:** Execute 02-03-PLAN.md (Client slice: OcrLoadingOverlay, OcrErrorToast, scan button + thumbnail + OCR handler in AddItemsStep).
**Context notes:** POST /api/ocr accepts { image: base64DataUrl } and returns { items: [{ name, priceCents }] }. API contract locked: 400 on missing/non-string image, 500 with { error: 'OCR failed' } on any OpenAI failure (no internals leaked). 7 unit tests covering all paths via vi.mock('openai'). 100 active tests passing, 1 skipped (OcrLoadingOverlay stub for Plan 03).
