# Project Research Summary

**Project:** easy-billsy v2.0
**Domain:** Collaborative bill-splitter web app — flat model, scan-first, multi-currency
**Researched:** 2026-06-04
**Confidence:** HIGH

## Executive Summary

easy-billsy v2.0 is a live-app milestone, not a greenfield build. The core work is three interlocking refactors on top of a validated stack: (1) remove the host role entirely and replace it with a flat collaborative model where anyone can claim and edit, (2) collapse the four-step wizard into a scan-first single Setup screen, and (3) add currency detection so non-US receipts display correctly. None of these require new npm dependencies — the existing stack (Next.js 16, React 19, Zustand 5, Upstash Redis, GPT-4o-mini, SWR polling) handles everything. The only code changes are schema surgery, OCR prompt extension, a formatCents signature update, and UI restructuring.

The recommended approach is to sequence work by strict data-layer dependency rather than feature visibility. The schema migration (removing hostToken, editRequests, disputes, ClaimEntry.assignedBy) must happen atomically and include a migrateSession normalizer before any UI code is touched — the app is live and Redis sessions written by v1 code will coexist with v2 code for up to 24 hours after deploy. The currency data flow (OCR prompt -> Zustand -> SessionPayload -> formatCents) must be threaded end-to-end in a single phase to avoid a broken intermediate state where the symbol field exists in some layers but not others. Test-suite migration is a first-class deliverable: 923 lines of host-specific tests and 59 shared-test host assertions will either go stale or become false-green if not explicitly ported or retired.

The critical risks are all execution risks, not design risks: Lua script strings are opaque to TypeScript and will not surface host-concept references as type errors; stale SWR cache on Results-screen entry can show wrong totals; and slot_taken enforcement left over from v1 will block the flat identity modal. All three are pre-identified with concrete prevention steps. The open product questions (what to do with unclaimed items, last-write-wins attribution, currency fallback display, identity-modal empty-list path) are well-scoped decisions that requirements must answer before coding begins, but none of them add architectural uncertainty.

---

## Key Findings

### Recommended Stack

The existing stack requires no new dependencies for v2.0. Every v2 feature is delivered through changes to existing code. The only additions are one new field (currencyCode) in the OCR response, Zustand store, and SessionPayload; one new API route (/edit) replacing five deleted host routes; and two new UI components (AppShell, IdentityModal).

**Core technologies (unchanged):**
- **Next.js 16 + React 19:** Full-stack framework — App Router collocates OCR/session API routes; no separate backend needed
- **Zustand 5:** Client bill state — pre-session staging area; currencyCode field added; hostToken/assignments removed
- **Upstash Redis:** Serverless session KV — atomic Lua eval scripts for claim writes preserved intact; host-gating logic removed
- **GPT-4o-mini vision:** OCR + AI expansion — prompt extended to return currency_symbol; single API call unchanged
- **SWR 3s polling:** Real-time claim sync — unchanged; force mutate() on Results entry to avoid stale totals
- **Tailwind CSS v4 + shadcn/ui:** Styling and component primitives — Sheet for hamburger menu, Dialog for IdentityModal
- **Intl.NumberFormat (native browser API):** Currency display — replaces hardcoded dollar sign; handles JPY zero-decimal, symbol placement, locale separators

**Open decision — currency representation (ISO code vs symbol string):** STACK.md and ARCHITECTURE.md give different recommendations. STACK.md argues for asking GPT-4o-mini to return an ISO 4217 code (e.g., "USD", "JPY") and using Intl.NumberFormat(undefined, { style: "currency", currency: code }) — this handles zero-decimal currencies and locale formatting correctly. ARCHITECTURE.md recommends returning the raw symbol string ("pound", "euro") for v2 and deferring full Intl support to v2.1 to avoid the symbol-to-ISO-code ambiguity problem (e.g., dollar sign maps to USD, CAD, AUD, SGD). **This decision must be resolved in requirements before Phase 7 work begins.** PITFALLS.md warns that if the ISO code route is taken, currency detection must be scoped to an explicit allowlist (USD, EUR, GBP, JPY, INR, AUD, CAD) and the parseCents arithmetic must be updated for zero-decimal currencies in the same atomic commit.

**What NOT to add:** currency-symbol-map (reverse lookup removed in v5.x, unmaintained since 2022), dinero.js/money.js (overkill — all math stays as integer cents), socket.io/Pusher (SWR polling is validated; WebSocket doubles ops surface for no meaningful UX gain), any i18n library (Intl.NumberFormat covers all display needs natively).

---

### Expected Features

**Must have — table stakes for v2.0 launch:**
- Scan-first Setup screen (scan as hero action, inline people-add below)
- "Who are you?" identity modal (name picker; auto-skip when people.length === 1; inline add-name path when list is empty)
- Flat Bill View (anyone claims and edits; live claim attribution per item; no approval queue)
- Currency recognition threaded through all amount displays
- Unassigned-items warning as primary safety net (was advisory in v1; now the only protection in flat model)
- Results screen: locked per-person breakdown, tip-as-modal launched from Results, Copy/Edit/New bill actions
- easy-billsy app shell (header wordmark + hamburger menu with History stub and About Us)

**Should have — differentiators shipped in v2.0:**
- Currency fallback: bare numbers + inline "tap to set" prompt when OCR returns no symbol
- Currency override picker (small component; allows user to correct detection errors)
- "Split unclaimed items evenly" one-tap CTA on unassigned-items warning
- AI abbreviation expansion (already shipped; must survive refactor intact)
- Auto-skip identity modal for solo use
- WhatsApp/iMessage-ready copy message (extend existing copy-summary with formatted per-person lines)

**Defer to v2.1+:**
- Bill history (History nav item ships as stub in v2.0; full implementation in v2.1)
- Full Intl.NumberFormat locale formatting (symbol-prefix approach acceptable for v2.0 if ISO code route is not chosen)
- PWA manifest + install prompt
- Proportional tax distribution
- Currency conversion (out of scope entirely — different app category)

**Anti-features (explicitly rejected):**
- Host approval / dispute queue — the flat model is the product decision; do not add back any form of approval gating
- User accounts / login — breaks zero-friction promise
- In-app payment / settlement — out of scope; copy-summary message is the payment bridge

**Open product decisions that requirements must answer before coding:**
1. **Unclaimed leftovers:** Block Results (strict gate) vs. warn + "split evenly" CTA (recommended: warn + CTA)
2. **Concurrent edit conflicts:** Last-write-wins is accepted; attribution label ("edited by Alice") is mandatory accompaniment — not optional
3. **Claiming for others:** Allow it; attribution shows who claimed what
4. **Editing others claims:** Yes, full flat model — anyone can un-claim anything
5. **Identity modal with empty people list:** Inline "Add my name" path inside the modal, not a redirect to Setup
6. **Currency detection failure fallback:** Bare numbers + "tap to set" prompt; do not block the flow

---

### Architecture Approach

The v1 architectural boundary (local Zustand on / -> single Redis session handoff at "Share" -> collaborative view at /split/[sessionId]) is correct and must not move. The Setup screen change replaces the 4-step wizard entirely but keeps the same handoff point: session is still created once, at the moment the user taps "Start splitting." The POST /api/session body gains currencyCode and drops assignments and hostToken. Five host-specific API routes are deleted; one new direct-edit route replaces them. The CollaborativeClaimingView.tsx (700 lines) undergoes significant internal refactor but its role and mount point are unchanged.

**Major components:**

New:
1. AppShell.tsx + HamburgerMenu.tsx — persistent branding shell via app/layout.tsx
2. IdentityModal.tsx — replaces PersonSlotPicker with modal UX; auto-skip; inline add-person
3. app/api/session/[sessionId]/edit/route.ts — direct item mutation, no token, no queue

Modified (core changes):
4. app/page.tsx — new SetupScreen replaces WizardShell + 4 step components
5. lib/sessionSchema.ts — remove host fields; add currencyCode; simplify ClaimEntry
6. lib/billMath.ts — formatCents gains currencyCode parameter
7. app/api/ocr/route.ts — extend prompt + JSON schema to return currency_symbol
8. CollaborativeClaimingView.tsx — full flat-model refactor; Phase union simplifies to claiming -> tip -> results

Deleted (host workflow removed):
- 5 API routes: resolve-edit, resolve-dispute, dispute, accept, edit-request
- 4 UI components: HostPanel, EditRequestForm, ReviewHostAssignedScreen, WaitingForClaimsScreen
- 5 wizard components: WizardShell, AddPeopleStep, AddItemsStep, AssignItemsStep, ResultsStep

**currencyCode data flow (full chain):**
OCR prompt -> API response { items, currencyCode } -> Zustand setCurrencyCode -> POST /api/session body -> SessionPayload.currencyCode -> SWR GET propagates -> formatCents(cents, currencyCode) at all display sites.

---

### Critical Pitfalls

1. **Host-removal blast radius** — Lua script strings in claim/route.ts are opaque to TypeScript; 17+ host references in CollaborativeClaimingView.tsx including URL fragment parsing; 59 host assertions in shared test files will produce false-green if fixtures still contain hostToken. Prevention: generate reference map with grep before any deletion; remove fields from SessionPayload first to cascade type errors; audit Lua strings separately; run npx tsc --noEmit after every file deletion.

2. **Live Redis backward-compatibility** — Sessions written by v1 code coexist with v2 code for up to 24 hours after deploy. New fields (currencyCode) accessed without null-guards crash on old sessions. Prevention: write a migrateSession(raw: unknown): SessionPayload normalizer as the very first act of schema migration; make new fields optional with defaults at the API GET layer.

3. **Currency formatting — zero-decimal currencies and parseCents contract** — parseCents uses float multiplication that gives wrong results for edge cases and silently drops 3-decimal prices. formatCents hardcodes .toFixed(2) which shows wrong decimal places for JPY. Prevention: if ISO code route is taken, add currencyScale parameter; replace float multiply with string-split arithmetic. The formatCents signature change must be an atomic commit covering the function + all 20+ call sites + the test suite.

4. **Test-suite migration as first-class deliverable** — 923 lines in 6 host-specific test files will fail immediately; wizard collapse kills 5 more component test files. Deleting failing tests to make CI green rather than porting them is the failure mode. Prevention: coverage map before collapse; each deleted test file requires a replacement test with equivalent behavior coverage.

5. **slot_taken blocking + stale SWR cache on Results entry** — slot_taken currently blocks a second device from identifying as the same person (legitimate flat-model scenario). SWR returns cached data first on Results entry. Prevention: remove slot_taken exclusivity enforcement in Phase 8; add synchronous mutate() call on Results phase entry in Phase 10.

---

## Implications for Roadmap

The sequencing tension in the research is real: PITFALLS demands that host-removal and schema migration be done atomically and early (live-session safety), while the product preference is "Setup screen first." ARCHITECTURE resolves this: the Setup screen (Phase 7) adds currencyCode as a purely additive field that does not conflict with existing host fields. Schema surgery (Phase 8) follows as a focused backend-only phase. This sequencing respects both constraints.

### Phase 7: App Shell + Setup Screen

**Rationale:** User-stated priority; foundational restructure that every subsequent phase plugs into. Doing shell + setup together avoids touching app/layout.tsx twice. This phase adds currencyCode to the OCR response and Zustand store but does NOT touch the session schema — old and new code coexist safely.

**Delivers:** easy-billsy branding on all screens; scan-first single-screen setup; wizard deleted; OCR returns currencyCode. Session creation at /split is untouched.

**Addresses:** Scan-first setup (P1), App shell (P1), OCR currency extraction (prerequisite for Phase 8+)

**Avoids:** Pitfall 4 (wizard test suite) — test migration is a deliverable of this phase

**Reassess gate here** — explicit checkpoint before committing to Phases 8+

**Research flag:** Standard patterns — no deeper research needed.

---

### Phase 8: Flat Model — Schema + API Surgery

**Rationale:** Purely backend work with no UI surface. Must complete before Phase 9 can build flat UI against clean types. Highest-risk phase technically: Lua strings, live session backward-compat, cascading type errors all live here.

**Delivers:** SessionPayload schema clean (no host fields); migrateSession normalizer protects live sessions; five host API routes deleted; direct /edit route live; Lua scripts updated; slot_taken blocking removed.

**Addresses:** Host removal (P1), migrateSession normalizer, direct edit route

**Avoids:** Pitfall 1 (host-removal blast radius) and Pitfall 2 (live Redis backward-compat)

**Must include:** migrateSession normalizer as first commit; Lua script audit separate from TypeScript; npx tsc --noEmit after every file deletion

**Research flag:** No additional research needed — PITFALLS.md provides complete prevention checklist with specific file locations and line numbers.

---

### Phase 9: Bill View Redesign + Identity Modal

**Rationale:** Depends on Phase 8 clean schema and Phase 7 currencyCode in session creation. Cannot be built before both predecessors complete.

**Delivers:** Flat collaborative Bill View; IdentityModal replacing PersonSlotPicker; direct /edit route wired from UI; live claim attribution; host UI components deleted; unassigned-items warning elevated with "split evenly" CTA.

**Addresses:** Flat model (P1), Identity modal (P1), Claim attribution (P2), Inline add-person in modal (P2)

**Open decisions to resolve before coding:** Unclaimed leftovers approach, claiming-for-others, editing-others-claims, identity-modal empty-list path

**Research flag:** Standard patterns — identity modal, flat claiming, and attribution display are fully defined in ARCHITECTURE.md with specific component names and code locations.

---

### Phase 10: Results Screen + Tip Modal + Currency Display

**Rationale:** Depends on Phase 9 simplified session (no waiting state) and Phase 8 currencyCode field in SessionPayload. Currency threading covers 20+ formatCents call sites — doing it last means all call sites are stable and the atomic commit covers the correct final set.

**Delivers:** Locked per-person Results screen; TipModal as overlay from Results; formatCents signature updated; currencyCode threaded to all display sites; currency fallback; currency override picker; mutate() forced on Results entry.

**Addresses:** Results screen redesign (P1), Tip modal (P1), Currency display (P1), Currency fallback (P2), Currency override (P2)

**Avoids:** Pitfall 3 (currency formatting atomicity); Pitfall 5 (stale SWR cache on Results entry)

**Research flag:** ISO code vs symbol string decision (see Gaps) must be resolved before planning this phase.

---

### Phase Ordering Rationale

- Phase 7 before 8: currencyCode is purely additive in Phase 7 and does not conflict with schema surgery in Phase 8; respects user-stated priority
- Phase 8 before 9: Phase 9 UI is built against the clean flat schema; building UI with host types still present requires defensive code that Phase 8 removes
- Phase 9 before 10: Results screen depends on the simplified Phase union (claiming -> tip -> results) that Phase 9 produces
- Schema + Lua atomically in Phase 8: splitting them creates a window where TypeScript types and Lua behavior are inconsistent — a silent failure mode
- Test migration co-located with deletion: wizard tests die in Phase 7; host tests die in Phase 8; each phase owns its test migration

### Research Flags

Phases needing deeper research during planning:
- **None:** All four phases have complete implementation detail in research files (specific file paths, line numbers, code snippets). Standard planning research flag is not needed.

Phases with standard patterns (skip research-phase):
- **Phase 7:** Well-established — OCR prompt extension and wizard-to-screen UI restructure are both standard patterns
- **Phase 8:** Well-documented — PITFALLS.md provides a complete line-by-line deletion checklist
- **Phase 9:** Well-defined — ARCHITECTURE.md specifies every component change with exact file names
- **Phase 10:** Well-specified — display site table in ARCHITECTURE.md lists every formatCents call site with its currencyCode source

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations from direct codebase inspection + verified browser API standards. Zero new dependencies — no uncertainty from third-party library evaluation. |
| Features | HIGH | Grounded in v1.0 shipped codebase + competitor analysis. Open product decisions are enumerated explicitly, not hidden. |
| Architecture | HIGH | Full codebase read across all session routes, schema, Zustand store, and UI components. Component inventory is complete with specific file paths. |
| Pitfalls | HIGH | Derived from direct codebase inspection with specific line numbers. Lua strings, test file line counts, and grep hit counts all verified. |

**Overall confidence:** HIGH

### Gaps to Address

- **ISO code vs symbol string (MUST resolve in requirements):** STACK.md prefers ISO 4217 + Intl.NumberFormat (handles JPY, locale separators). ARCHITECTURE.md prefers raw symbol string for v2 simplicity, deferring full Intl to v2.1. This is a product/engineering tradeoff: correctness vs. simplicity. Recommended resolution: ask GPT-4o-mini for ISO code but restrict to 7-currency allowlist (USD/EUR/GBP/JPY/INR/AUD/CAD); use Intl.NumberFormat for display; override picker for unrecognized codes.

- **Unclaimed leftovers UX (MUST resolve in requirements):** FEATURES.md recommends Option B (warn prominently + "split evenly" CTA). Confirm before Phase 9 coding begins. If Option A (blocking gate) is chosen, Phase 9 scope changes.

- **migrateSession normalizer deployment strategy:** If Phase 8 deploy cannot be split into two Vercel deployments (normalizer first, schema changes second), ensure the normalizer is the first commit in the Phase 8 changeset. The 24h Redis TTL means old sessions exist for up to one full day post-deploy.

- **parseCents zero-decimal fix scope:** If JPY/KRW support is in v2.0 scope, the parseCents arithmetic update must be in Phase 10 atomic commit. If zero-decimal currencies are deferred to v2.1, document as a known limitation.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — lib/sessionSchema.ts, lib/billMath.ts, app/api/session/[sessionId]/claim/route.ts, CollaborativeClaimingView.tsx, 29-file test suite
- MDN: Intl.NumberFormat — currency style, resolvedOptions, subunit handling
- OpenAI Structured Outputs docs — gpt-4o-mini JSON schema + vision compatibility confirmed
- Tailwind CSS v4 blog — production stable January 2025
- Vercel + Next.js deployment docs — last updated 2026-03-02

### Secondary (MEDIUM confidence)
- .planning/competitors/ directory — LilySplit, Tab, EasyCheckSplitter, Reddit r/restaurant-bill-splitting
- .planning/PROJECT.md — v2.0 requirements and out-of-scope decisions
- GitHub: bengourley/currency-symbol-map — reverse lookup removed in v5.x, unmaintained since 2022

### Tertiary (LOW confidence — training knowledge)
- Upstash Redis redis.multi() non-atomicity on REST API — confirmed via existing codebase comments but not re-verified against Upstash docs
- Vercel rolling deploy window behavior — inferred from general serverless deploy patterns; verify before Phase 8 deploy

---
*Research completed: 2026-06-04*
*Ready for roadmap: yes*
