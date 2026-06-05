---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: easy-billsy Redesign
status: planning
last_updated: "2026-06-04T13:34:14.310Z"
last_activity: 2026-06-04 — Roadmap created for v2.0 (Phases 7–10)
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

**Project:** Bill Splitter
**Milestone:** v2.0 — easy-billsy Redesign
**Last updated:** 2026-06-04

---

## Project Reference

**Core value:** Photo → items → each person picks what they had → everyone knows what they owe.
**Current focus:** v2.0 — easy-billsy redesign (roadmap defined; ready to plan Phase 7)

---

## Current Position

Phase: 7 (shipped — retroactively documented)
Plan: 07-01, 07-02, 07-03 (3/3)
Status: Phase 7 code already shipped (commits cb10468, 430b02f); plans written retroactively + plan-check PASSED — ready to verify
Last activity: 2026-06-05 — Retroactive plans for Phase 7 (shell, setup, currency); plan-check passed

```
Progress: [░░░░░░░░░░░░░░░░░░░░] 0% (0/4 phases)
```

## Performance Metrics (v1.0 final)

**Phases complete:** 6/6
**Plans complete:** 21/21
**Requirements done:** 12/12
**LOC:** ~6,270 TS/TSX · **Commits:** 232 · **Timeline:** 2026-05-08 → 2026-06-04

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
| D-09 fallback: soft GPT failures return 200 + empty displayName | Client falls back to AI's best guess pre-filling edit field — no dead-end error screen | Phase 3 |
| act() required for harness state swap in jsdom tests | React 19 throws if state updates triggering re-renders are not wrapped in act(); the plan template omitted this — fixed in DisambiguationDialog tests | Phase 3 |
| Menu photos discarded after /api/clarify call | Data URI created in handleMenuFileChange, sent once, never stored in Zustand (D-10 + T-03-CL-06) | Phase 3 |
| redis.eval() Lua for atomic claim writes (not redis.multi) | multi() is NOT atomic on Upstash REST (RESEARCH Pitfall 1); Lua eval is required for concurrent claim safety | Phase 6 |
| done route uses done: boolean (not undone: true) | Wave 0 test contract sends done:boolean; tests are ground truth over plan prose | Phase 6 |
| Claim action defaults to 'qty' when itemId present | Wave 0 tests send { personId, itemId, qty } without action field; inference avoids 400 on valid bodies | Phase 6 |
| currency stored as ISO 4217 code + Intl.NumberFormat | Disambiguates $ (USD/CAD/AUD) and handles zero-decimal currencies (JPY); decided in Phase 7 discussion, supersedes the earlier raw-symbol lean | Phase 7 |
| migrateSession normalizer must be first commit in Phase 8 | Live Redis sessions written by v1 code coexist for 24h after deploy; normalizer on read protects against null-access on new fields | Phase 8 (pending) |
| Lua script strings audited separately from TypeScript | TypeScript type errors cascade on schema removal, but Lua strings are opaque — must grep separately | Phase 8 (pending) |
| formatCents gains optional currencyCode param (backward-compatible) | All existing call sites omit the param and continue to get "$"; new call sites pass session.currencyCode | Phase 10 (pending) |

### Architecture Commitments

- All prices stored as integer cents throughout — never floats in calculation paths
- Derived totals (per-person) computed on demand, never stored
- Single Zustand store owns all wizard state: people, items, assignments, tip/tax, wizard step, ocrStatus, syncStatus
- OCR + AI expansion is a single GPT-4o-mini vision call (not two separate calls per item)
- Session state persists in Upstash Redis keyed by nanoid session ID
- v2.0: Session boundary unchanged (Setup = Zustand local, /split/ = Redis-backed); only schema contents change
- v2.0: No new npm dependencies required — all v2 features delivered through changes to existing code
- v2.0: currencyCode data flow: OCR prompt → Zustand store → POST /api/session body → SessionPayload → SWR → formatCents call sites

### Todos

- [ ] Validate GPT-4o-mini vision pricing per receipt scan before launch
- [ ] Test OCR on real thermal receipts (faded ink, curled paper, dim light) during Phase 2
- [ ] Prototype LLM prompt for structured output (type, confidence, raw_name, display_name) early in Phase 2
- [ ] Validate that "claimed by [name]" display prevents double-claiming without real-time sync (Phase 4)
- [ ] Design menu photo fallback prompt during Phase 3 planning
- [x] Resolve currency ISO code vs raw symbol — RESOLVED in Phase 7 discussion: ISO 4217 code + Intl.NumberFormat
- [ ] Confirm unclaimed-items UX decision (warn + "split evenly" CTA recommended) before Phase 9 planning

### Blockers

None.

---

## Deferred Items

Acknowledged and deferred at v1.0 milestone close (2026-06-04):

| Category | Item | Status | Note |
|----------|------|--------|------|
| quick_task | p2-waiting-state | missing summary | Work shipped inline (commit 7386d9e + review-routing fix); SUMMARY never written |
| todo | add-user-facing-privacy-disclosure | pending | Intentionally parked for v2 |
| uat | phase 04 | partial (0 open) | Effectively clear |
| verification | phase 02 | human_needed | On-device UAT |
| verification | phase 03 | human_needed | On-device UAT |
| verification | phase 04 | human_needed | On-device UAT |
| verification | phase 05 | human_needed | On-device UAT |

All assessed in `milestones/v1.0-MILESTONE-AUDIT.md` (PASSED). The v2 easy-billsy redesign supersedes much of this surface.

## Session Continuity

**Last session:** 2026-06-05 — Retroactive Phase 7 plans written + plan-check passed
**Next action:** `/gsd:verify-work 7` to verify the shipped Phase 7 code against the plan must_haves, then close the phase.

## Operator Next Steps

- Run `/gsd:verify-work 7` to verify shipped Phase 7 code against SHELL/SETUP/CURR requirements
- Optional `/gsd-quick`: fix stale JSDoc at `components/wizard/SetupStep.tsx:18` (says ≥1 person; gate is ≥2)
- After verification passes, honor the ROADMAP reassess gate before planning Phase 8
