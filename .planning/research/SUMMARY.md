# Project Research Summary

**Project:** Bill Splitter
**Domain:** Mobile-first web app — receipt OCR + AI abbreviation expansion + collaborative bill splitting
**Researched:** 2026-05-08
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a photo-first restaurant bill-splitting web app. The central thesis — snap the receipt, AI reads it, everyone taps what they had — is technically achievable with a lean stack (Next.js + GPT-4o-mini vision + Zustand + Upstash Redis) and has been partially validated by Tab (tab.money), the closest direct competitor. The key differentiator is pairing receipt OCR with LLM-powered abbreviation expansion as a first-class feature; no competitor does both together at production quality.

The recommended build approach is a layered, inside-out sequence: nail the split math first (pure functions, integer-cents, no UI), then build the manual-entry flow to validate the UX, then bolt on the OCR pipeline, then layer in AI expansion and shareable links. This order is dictated by hard architecture dependencies: server-side session state must exist before shareable links work, and the OCR pipeline must be server-side because client-side Tesseract.js is insufficiently accurate for thermal receipts. Building in this sequence means you have a working, shippable product after Phase 2 and progressively unlock the differentiating features.

The top risks are: (1) floating-point rounding producing splits that don't match the receipt total — destroying trust before anyone tries the OCR; (2) OCR accuracy on real-world thermal receipts under dim restaurant lighting — the editable confirmation step is non-negotiable; (3) iOS Safari's one-strike camera permission model — the `<input type="file" capture>` approach must be the primary path, not `getUserMedia`. All three are architectural commitments that are expensive to retrofit; they must be addressed in their respective founding phases.

---

## Key Findings

### Recommended Stack

The full stack is Next.js 15 (App Router) + React 19 + TypeScript, deployed on Vercel. Styling is Tailwind CSS v4 + shadcn/ui. State is managed client-side with Zustand 5. The OCR + AI expansion pipeline is a single GPT-4o-mini vision call — one API credential, one round trip — with Google Cloud Vision as a documented cost-optimization fallback at scale. Shareable links persist session state in Upstash Redis (Vercel KV is deprecated as of December 2024; do not use it). Camera capture is `<input type="file" accept="image/*" capture="environment">` on mobile — no react-webcam dependency. Images are compressed client-side to ~500KB with browser-image-compression before upload.

**Core technologies:**
- **Next.js 15 (App Router):** Full-stack framework — collocated Route Handlers for OCR/AI API calls, zero-config Vercel deployment, React Server Components reduce mobile bundle size
- **GPT-4o-mini (vision):** OCR + abbreviation expansion in one call — eliminates Google Vision dependency, handles thermal receipt quality, returns structured JSON
- **Zustand 5:** Client-side bill state — minimal boilerplate, no Provider wrapping issues with RSC, single store for interconnected state (tip depends on subtotals, etc.)
- **Upstash Redis:** Ephemeral session store for shareable links — serverless KV, 24h TTL, free tier covers MVP scale
- **Tailwind CSS v4 + shadcn/ui:** Mobile-first styling — container queries for item assignment layout, accessible Radix UI primitives for dialogs/checkboxes
- **Native `<input capture>`:** Camera access — no MediaStream complexity, universally works on iOS Safari and Android Chrome
- **Integer-cents arithmetic:** All prices stored in cents throughout — prevents floating-point rounding errors in split math

### Expected Features

**Must have (table stakes) — ship in v1:**
- Add people to session (name only, no account)
- Manual item entry (fallback for when OCR fails)
- Assign items to people, including shared-item splitting
- Tip input with preset buttons (15/18/20%) and custom
- Tax input (percent or flat amount)
- Proportional tip + tax distribution by subtotal
- Edit/correct OCR output before assigning
- Final per-person total with itemized expandable breakdown
- Unassigned items warning before locking totals

**Should have — also ship in v1 per PROJECT.md:**
- Receipt photo to OCR to AI name expansion (the core differentiator)
- Menu photo fallback for still-ambiguous items
- Shareable link so each person claims their own items
- Copy-to-clipboard summary

**Defer to v2+:**
- Venmo/CashApp deep-links (useful but not blocking)
- PWA installable manifest (one-day effort, add after core ships)
- Rounding reconciliation display (implement but low visibility)
- Item-level discounts (needed but adds complexity; handle manually in v1)

**Explicitly out of scope:**
User accounts, bill history, payment processing, currency conversion, social features, native app.

### Architecture Approach

The app is a single-page application with a server-side OCR+AI pipeline. The client owns all interactive state (people, items, assignments, tip/tax, wizard step) via a single Zustand store. The server handles only: (1) the OCR+AI call (requires secret API key and is CPU-heavy), (2) session persistence for shareable links. All calculation math runs as pure functions on the client — no server round-trips for totals. Synchronization uses debounced HTTP polling (every 2-3 seconds during assignment), not WebSockets — the assignment flow is non-concurrent (each person owns their own assignments), so polling is sufficient and avoids stateful server requirements that would break Vercel serverless deployment.

**Major components:**
1. **Camera Capture Module** — `<input type="file">` primary + compress before upload; client-side
2. **Wizard State Store (Zustand)** — owns all session state and async statuses (ocrStatus, syncStatus); client-side
3. **Calculation Engine** — pure functions: per-person subtotal, proportional tip/tax, final totals; client-side; never stored, always computed
4. **Session API** — Route Handlers for CRUD on session state + OCR+AI orchestration; server-side
5. **OCR + AI Expansion Service** — single GPT-4o-mini vision call; returns LineItem[] with type, display_name, confidence; server-side
6. **Session Store (Upstash Redis)** — ephemeral KV, 24h TTL, keyed by nanoid session ID; server-side

**Key data model decisions:**
- All prices stored as integer cents — no floats in calculation paths
- Assignment normalized as `{ item_id, person_ids[] }` — not per-item booleans per person
- LineItem carries both `raw_name` (OCR output) and `display_name` (AI expanded) and `type` (item/subtotal/tax/tip/fee/discount)
- Derived values (totals per person) are computed on demand, never stored

### Critical Pitfalls

1. **Floating-point rounding corrupts the split** — Use integer cents end-to-end from Phase 1. Never use `.toFixed()` for calculation. Assign remainder cents explicitly. Write unit tests for 3-way and 7-way splits at tricky amounts. Cannot be retrofitted.

2. **OCR misreads thermal receipts under dim light** — The editable item confirmation step is mandatory and must ship alongside OCR in the same phase. Show the captured image thumbnail next to the extracted list. Use GPT-4o-mini vision (not Tesseract.js) — the accuracy gap is decisive (~92-97% vs ~70-80%).

3. **iOS Safari one-strike camera permission** — Use `<input type="file" accept="image/*" capture="environment">` as the primary camera mechanism, not `getUserMedia`. Add a clear `NotAllowedError` handler with Settings recovery instructions. Show a pre-prompt screen to reduce accidental denials. Test on physical iOS device.

4. **LLM latency freezes the table experience** — Batch all items into a single LLM call (not one call per item). Set a hard 10-15 second timeout with graceful fallback to raw abbreviated names (still editable). Show a loading state with the receipt image visible while processing.

5. **State shape complexity explosion** — Define the canonical state shape and the single calculation module before writing any UI component. Tip, tax, items, and assignments must all live in one Zustand store from day one. Derived totals are never stored.

---

## Implications for Roadmap

The ARCHITECTURE.md build-order layers map cleanly to 5 phases. The sequence is dictated by hard dependencies: calculation math before UI, UI before server, server before sharing, sharing before OCR, OCR before AI expansion.

### Phase 1: Foundation + Core Math
**Rationale:** Integer-cents arithmetic and the canonical state shape are the most expensive things to retrofit. Get them right before any UI exists. This is also the best point to establish routing and TypeScript interfaces.
**Delivers:** Project scaffold, data type definitions, money utility functions (cents conversion, proportional split, remainder assignment), Zustand store skeleton, routing (/ for new session, /:sessionId for shared).
**Addresses:** Pitfall 1 (floating-point), Pitfall 7 (state shape complexity)
**Avoids:** Retrofitting integer math across every calculation path mid-project

### Phase 2: Manual Entry Flow (Working Bill Splitter, No OCR)
**Rationale:** Validates the entire UX and calculation model before any server code. Produces a shippable product. Proves the state store works. De-risks the most complex interaction (item assignment + shared items + proportional tip/tax).
**Delivers:** Add people, manual item entry, single-driver item assignment, shared item marking, tip/tax entry, final per-person breakdown with expandable detail, unassigned items warning, copy-to-clipboard summary.
**Addresses:** All table stakes features except OCR. Pitfall 10 (confusing summary screen — expandable breakdown required).
**Research flag:** Standard patterns, skip deep research — conventional React form/wizard UI.

### Phase 3: Server Foundation + Shareable Links
**Rationale:** Session API must exist before OCR (OCR runs server-side and needs a session to attach results to) and before shareable links. Build the server layer once and get both. Start with in-memory session store, swap to Upstash Redis before shipping shareable links.
**Delivers:** Session API (POST/GET/PATCH), Upstash Redis session store with 24h TTL, nanoid session ID in URL, session sync from client (debounced), shareable link generation, polling during assignment phase, per-person assignment isolation.
**Uses:** Upstash Redis, Next.js Route Handlers, nanoid
**Addresses:** Pitfall 5 (concurrent claim conflicts — per-person isolation prevents double-claiming)
**Research flag:** Standard patterns — Upstash Redis on Vercel is well-documented. Skip deep research unless real-time sync becomes a requirement.

### Phase 4: OCR Pipeline
**Rationale:** OCR requires the server (Phase 3). The editable confirmation step must ship in the same phase as OCR — never allow OCR output to flow directly into assignment without user review.
**Delivers:** Camera capture component (`<input type="file">` primary), client-side image compression, `POST /sessions/:id/ocr` Route Handler, GPT-4o-mini vision call, line item parser (extracts LineItem[] with type classification), review/edit OCR results step with thumbnail.
**Uses:** OpenAI API (gpt-4o-mini vision), browser-image-compression
**Addresses:** Pitfall 2 (OCR accuracy — vision model + mandatory edit step), Pitfall 3 (iOS Safari — `<input>` primary), Pitfall 8 (subtotal/total rows — type classification in LLM prompt), Pitfall 9 (image size — client-side compression)
**Research flag:** Needs phase research. LLM prompt engineering for structured receipt parsing (type, confidence, raw_name, display_name fields) is not boilerplate — prompt iteration required. Validate GPT-4o-mini vision pricing before capacity planning.

### Phase 5: AI Expansion Polish + UX Hardening
**Rationale:** Layered on top of OCR once the pipeline is stable. Addresses remaining LLM-specific pitfalls and adds the menu photo fallback path for ambiguous items.
**Delivers:** Confidence-based visual indicators on expanded names, menu photo fallback flow (second OCR call on menu image), LLM timeout handling with graceful fallback to raw names, tip-split-mode toggle (proportional vs equal), rounding reconciliation display, PWA manifest, loading states throughout.
**Addresses:** Pitfall 4 (LLM latency — timeout + fallback), Pitfall 6 (hallucination — confidence field + editable names + menu fallback), Pitfall 11 (zero-subtotal person — tip-split-mode toggle)
**Research flag:** Menu photo fallback prompt design needs iteration. Structured JSON output for OpenAI is well-documented — standard patterns apply there.

### Phase Ordering Rationale

- Phase 1 before everything: integer-cents math is the one thing that breaks every downstream component if wrong. Must be correct before UI exists.
- Phase 2 before Phase 3: client-only bill splitter can ship independently. Validates UX assumptions with zero server risk. Single-driver mode is a complete product.
- Phase 3 before Phase 4: OCR runs server-side and returns results into a session. Session API must exist first.
- Phase 4 before Phase 5: AI expansion is layered on OCR output. Can't refine what doesn't exist yet.
- Shareable links in Phase 3 (not Phase 5): they depend only on session persistence, not OCR. Shipping them early means the sharing UX gets more validation time before the photo feature lands.

### Research Flags

**Needs deeper research during planning:**
- **Phase 4 (OCR Pipeline):** LLM prompt engineering for structured receipt parsing. Validate GPT-4o-mini vision pricing and token costs per receipt before capacity planning.
- **Phase 5 (AI Polish):** Menu photo fallback prompt design — how to represent "here is menu context, re-resolve these ambiguous items" in a single structured call.

**Standard patterns — skip deep research:**
- **Phase 1 (Foundation):** Next.js scaffold, TypeScript interfaces, Zustand setup — all well-documented.
- **Phase 2 (Manual Flow):** React wizard/form patterns, shadcn/ui components — established community patterns.
- **Phase 3 (Server + Sharing):** Upstash Redis on Vercel, Next.js Route Handlers, polling — official docs are comprehensive.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core framework choices (Next.js, Vercel, Tailwind v4) confirmed via official docs. GPT-4o-mini vision pricing not confirmed via live API docs. Upstash Redis replacement for Vercel KV confirmed. |
| Features | HIGH | Table stakes consistent across all bill-splitter apps; scope confirmed against PROJECT.md. Competitor feature lists from training data — MEDIUM confidence on parity. |
| Architecture | HIGH | Integer-cents is standard in financial systems. WebSocket vs polling tradeoff well-reasoned for non-concurrent flow. OCR accuracy estimates (70-80% Tesseract vs 92-97% Vision/LLM) are estimates, not benchmarks. |
| Pitfalls | HIGH | Floating-point, iOS Safari permissions, and image sizing are well-documented browser/API behaviors. LLM latency and hallucination risks are domain consensus. Confidence MEDIUM on specific latency numbers and cost projections. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **GPT-4o-mini vision pricing:** Exact cost per receipt scan not confirmed via live API docs. Validate before launch to set cost ceiling and determine when Vision API + text LLM split becomes cheaper.
- **OCR accuracy on real receipts:** Confidence numbers (~92-97%) are estimates. Validate with actual thermal receipt photos during Phase 4 — specifically faded ink, curled paper, dim-light conditions.
- **Prompt reliability for structured output:** LLM prompt engineering for the type + confidence + display_name structured response has not been prototyped. This is the highest technical uncertainty. Budget for iteration.
- **Shareable link conflict resolution:** Per-person isolation in Phase 3 defers the concurrent assignment problem. Validate that "claimed by [name]" display is sufficient to prevent double-claiming without real-time sync.

---

## Sources

### Primary (HIGH confidence)
- Next.js 15 release blog: https://nextjs.org/blog/next-15
- Vercel + Next.js deployment docs: https://vercel.com/docs/frameworks/nextjs (last updated 2026-03-02)
- Vercel KV deprecation / Upstash migration: https://vercel.com/docs/redis (confirmed December 2024)
- Tailwind CSS v4: https://tailwindcss.com/blog/tailwindcss-v4 (production stable January 2025)
- Google Cloud Vision pricing: https://cloud.google.com/vision/pricing
- MDN: getUserMedia(), input type="file" capture, Number.prototype.toFixed()

### Secondary (MEDIUM confidence)
- OpenAI gpt-4o-mini vision capabilities and pricing — training knowledge, not confirmed via live API docs
- Zustand v5 — training knowledge
- browser-image-compression v2 — training knowledge
- Tab (tab.money), Kite, Splitwise, Tricount, Settle Up feature analysis — training knowledge through Aug 2025

### Tertiary (LOW confidence)
- Google Gemini 1.5 Flash pricing — not confirmed; mentioned as alternative only
- AWS Textract AnalyzeExpense pricing — pricing page unreachable during research; from training data

---
*Research completed: 2026-05-08*
*Ready for roadmap: yes*
