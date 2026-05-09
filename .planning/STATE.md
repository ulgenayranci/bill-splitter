---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-03-PLAN.md — OCR UI integration (OcrLoadingOverlay, OcrErrorToast, AddItemsStep scan button + OCR handler) + 111 tests passing
last_updated: "2026-05-09T19:30:00.000Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
  percent: 100
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

Phase: 02 (ocr-pipeline) — Complete
Plan: 3 of 3 (02-03 complete)
**Status:** Phase 2 complete — Ready for Phase 3

```
Progress: [████████  ] 60%
Phase 1 █████ Phase 2 █████ Phase 3 ░░░░░ Phase 4 ░░░░░ Phase 5
```

---

## Performance Metrics

**Phases complete:** 1/5
**Plans complete:** 6/14
**Requirements done:** 8/12 (PEOPLE-01, ITEMS-01, ITEMS-02, ITEMS-03, TIP-01, RESULTS-01, OCR-01, OCR-03)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 12 min | 3 | 29 |
| 01 | 02 | 45 min | 2 | 4 |
| 01 | 03 | 7 min | 2 | 4 |
| 02 | 01 | 135s | 3 | 7 |
| 02 | 02 | 8 min | 2 | 2 |
| 02 | 03 | 5 min | 3 | 7 |

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
| All AddItemsStep tests wrapped in Toast.Provider | @base-ui/react useToastManager throws (not no-op) outside Provider — all renders require provider context | Phase 2 |
| vi.mock at module level for browser-image-compression | ESM default exports are non-configurable; vi.spyOn fails with "Cannot redefine property: default" | Phase 2 |
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

**Last session:** 2026-05-09T19:30:00.000Z
**Stopped at:** Completed 02-03-PLAN.md — OCR UI integration complete. 111 tests passing.
**Next action:** Phase 3 — AI Expansion + Disambiguation (abbreviation expansion, confidence display, menu photo fallback)
**Context notes:** Phase 2 complete. Full OCR vertical slice working end-to-end. Scan button → camera → overlay → GPT-4o-mini vision → addItem batch insert → thumbnail. Error path triggers 4s toast. Toast.Provider in app/providers.tsx. app/layout.tsx stays a Server Component. OPENAI_API_KEY server-side only. Known limitation: re-scan requires session reset (Pitfall 7 — Phase 5 polish task).
