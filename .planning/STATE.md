---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: easy-billsy Redesign
status: Awaiting next milestone
last_updated: "2026-06-23T23:22:53.839Z"
last_activity: 2026-06-23 — Milestone v2.0 completed and archived
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 26
  completed_plans: 26
  percent: 100
---

# Project State

**Project:** Bill Splitter
**Milestone:** v2.0 — easy-billsy Redesign (✅ shipped 2026-06-24)
**Last updated:** 2026-06-24

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-24)

**Core value:** Photo → items → each person picks what they had → everyone knows what they owe.
**Current focus:** Planning next milestone (v2.1) — run `/gsd:new-milestone`

---

## Current Position

Phase: Milestone v2.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-06-23 — Milestone v2.0 completed and archived

## Performance Metrics (v1.0 final)

**Phases complete:** 6/6
**Plans complete:** 21/21
**Requirements done:** 12/12
**LOC:** ~6,270 TS/TSX · **Commits:** 232 · **Timeline:** 2026-05-08 → 2026-06-04

## Accumulated Context

### Roadmap Evolution

- 2026-06-09 — v2.0 milestone reopened (was marked complete after Phase 10 execution, before UAT). Phase 11 added: "Bug Fixes & Polish — Bill/Results Screens + Participant Management" — post-v2 UAT bug list (receipt button non-functional; share/receipt buttons too small; unclaimed-items section + revised "all set" copy on Results; participant remove/edit; tip prominence + currency menu relocation). Not yet planned; needs discussion (open decisions on receipt-button intent, unclaimed phrasing, participant-removal handling of claimed items).

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
| D-09 softened to scan-FIRST (camera hero + photo-library picker) | UAT gap: forced re-capture when the physical bill is gone; dropped capture=environment so the native picker offers gallery too. Manual item entry still out of scope | Phase 7 (07-04) |
| Scan failure feedback inline (role=alert) near the scan tile, not bottom toast | UAT: bottom base-ui toast was too low to notice; surface error where the user is looking | Phase 7 (07-04) |
| Clear items[] on every OCR failure path | billScanned = items.length>0 gates the count chip; failure paths cleared billImageUrl but not items, leaving a stale "N items found" chip | Phase 7 (07-04) |
| ~~migrateSession normalizer must be first commit in Phase 8~~ **SUPERSEDED** by 08-CONTEXT D-03 | No existing users → v1/old-session migration is a null event; do NOT build a migrateSession normalizer | Phase 8 (2026-06-05 discuss) |
| Lua script strings audited separately from TypeScript | TypeScript type errors cascade on schema removal, but Lua strings are opaque — must grep separately | Phase 8 (pending) |
| formatCents gains optional currencyCode param (backward-compatible) | All existing call sites omit the param and continue to get "$"; new call sites pass session.currencyCode | Phase 10 (pending) |
| Keep ≥2-people Setup gate; revise IDENT-02 | Splitting needs 2+ people, so ≥2 is correct; that makes IDENT-02's single-person auto-skip unreachable — folded into IDENT-04 (persisted identity, no re-prompt) | Phase 7→9 (2026-06-05 reassess) |
| currencyCode SessionPayload field moves to Phase 8 (was Phase 10) | Schema surgery + migrateSession normalizer are already open in Phase 8 — add the field + USD default there once, not twice; Phase 10 keeps display only | Phase 8 (2026-06-05 reassess) |
| Phase 08-flat-model-schema-api-surgery P01 | 2 | 2 tasks | 2 files |
| Phase 08-flat-model-schema-api-surgery P02 | 278 | 3 tasks | 10 files |
| Phase 10 P02 | 10 minutes | 2 tasks | 2 files |
| Phase 10 P03 | 4 minutes | 3 tasks | 3 files |
| Phase 10 P04 | 5 | 3 tasks | 4 files |
| Phase 11-bug-fixes-polish-bill-results-screens-participant-management P01 | 10 | 2 tasks | 2 files |

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

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260605-v0g | Right-align people count chip and bottom-anchor Continue button on Setup screen | 2026-06-05 | 109f6a6 | | [260605-v0g-right-align-people-count-chip-and-bottom](./quick/260605-v0g-right-align-people-count-chip-and-bottom/) |
| 260608-qzy | Phase 9 bill view UI polish: mount AppHeader on all /split screens + overlapping facepile people chips | 2026-06-08 | 86452f4 | | [260608-qzy-phase-9-bill-view-ui-polish-mount-apphea](./quick/260608-qzy-phase-9-bill-view-ui-polish-mount-apphea/) |
| 260619-i48 | Fix expired-session dead-end: host gets a "Start over" button that clears the stale saved bill and returns to a fresh homepage; guest message unchanged | 2026-06-19 | b45ea0f | | [260619-i48-fix-expired-session-dead-end-when-the-ho](./quick/260619-i48-fix-expired-session-dead-end-when-the-ho/) |
| 260620-2h0 | Scan-time bill guardrail: reconcile OCR figures before claiming — fix per-unit-vs-line-total quantity bug (priceCents = line total), auto-correct arithmetic, detect completeness gaps | 2026-06-20 | 7087166 | Verified | [260620-2h0-scan-time-bill-guardrail-validate-and-re](./quick/260620-2h0-scan-time-bill-guardrail-validate-and-re/) |
| 260622-hjb | Phase 11 UAT round-6 follow-ups: OCR auto-retry on checksum mismatch (G2), scan edge-case catalogue (G2.3), invite-screen redesign (G4), drop redundant claimed badge (G7), finish-dialog redesign (G8) | 2026-06-22 | 124acff | Complete | [260622-hjb-phase-11-uat-round-6-followups](./quick/260622-hjb-phase-11-uat-round-6-followups/) |
| 260622-q3m | OCR reconciliation guardrail + editable scan-review/confirm screen: capture subtotal vs grand total (reconcile to pre-tax truth, fall back to grand total), show an editable item review on a failed reconciliation after the server retry (soft gate — "Confirm & continue" proceeds even if off) | 2026-06-22 | f52dc33 | Complete | [260622-q3m-ocr-reconciliation-scan-review](./quick/260622-q3m-ocr-reconciliation-scan-review/) |
| 260623-olg | Apply the "easy billsy" Brand & UI Spec — rebrand amber/Geist → Friendly Coral (#f1603f) + warm cream paper + Archivo/Caveat fonts; remap shadcn tokens in both HSL & OKLch blocks, register coral/person/semantic Tailwind utilities, 6-color avatar palette, drop the minus from the wordmark ("easy billsy"), title → "easy billsy". 15 files de-ambered (one-coral-per-screen; settled/paid stays green). build passes | 2026-06-23 | ef83d2b | | [260623-olg-apply-the-easy-billsy-brand-ui-spec-rebr](./quick/260623-olg-apply-the-easy-billsy-brand-ui-spec-rebr/) |
| 260623-plo | Mobile button polish: stripped all `hover:` utilities app-wide (button.tsx cva variants + 14 components) since touch has no hover; converted 13 borderless "ghost" icon buttons (−/+ steppers, pencil-edit, inline confirm/cancel) to the spec outline style (`border border-border bg-background`) so they're visible at rest. Kept active/focus states, coral CTA color, green settled states, dashed add controls. build passes | 2026-06-23 | 41e829a | | [260623-plo-mobile-button-polish-remove-all-hover-st](./quick/260623-plo-mobile-button-polish-remove-all-hover-st/) |
| 260623-u9k | Implement spec §06 button fills (prior pass left buttons fill-less on paper): button.tsx outline `bg-background`→`bg-white`+ink text+n200 border; primary gained coral drop-shadow; ghost gained n100 fill (`bg-muted`). 13 custom icon buttons `bg-background`→`bg-white`. No hover reintroduced; sizes/dashed controls/inputs untouched. build passes | 2026-06-23 | 646df95 | | [260623-u9k-implement-spec-button-component-design-o](./quick/260623-u9k-implement-spec-button-component-design-o/) |

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

---

Acknowledged and deferred at v2.0 milestone close (2026-06-24):

| Category | Item | Status | Note |
|----------|------|--------|------|
| requirement | PART-01 / PART-02 / PART-06 | deferred | Live remove-person descoped (2 Critical Lua findings, no execution test). Setup-screen remove retained. |
| verification | phase 07 | missing | No VERIFICATION.md/VALIDATION.md — functionally working + integration-confirmed; never formally verified. |
| verification | phase 09 / 10 / 11 | human_needed | Automated truths verified (19/19, 13/13, 8/8); human UAT covered per Phase 11 UAT (fully green). |
| traceability | phase 9 reqs | stale `[ ]` | IDENT-01..04, CLAIM-02/04/05/06 are verified + summary-complete; checkboxes never flipped (archived as-is in v2.0-REQUIREMENTS.md). |
| dead_code | retired wizard + /api/clarify + UnclaimedBanner + empty OcrErrorToast | unused | No runtime route reaches them; only tests import. Safe to delete in a cleanup. |
| todo | add-user-facing-privacy-disclosure | pending | Carried from v1.0; candidate for v2.1. |

Full assessment in `milestones/v2.0-MILESTONE-AUDIT.md` (status `tech_debt`, 0 blockers).

## Session Continuity

**Last session:** 2026-06-24 — v2.0 milestone audited (0 blockers) and closed; tagged v2.0.
**Next action:** Start v2.1 with `/gsd:new-milestone`. Optional cleanup first: delete the retired wizard files + `/api/clarify` and flip the stale Phase-9 traceability checkboxes.

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
