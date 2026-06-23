# Milestones

## v2.0 easy-billsy Redesign (Shipped: 2026-06-24)

**Phases completed:** 5 phases (7–11), 26 plans, 29 tasks
**Timeline:** 2026-06-04 → 2026-06-24 (~20 days)
**Tag:** v2.0
**Audit:** [v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) — status `tech_debt`, 0 blockers, 32/35 requirements (3 deferred), 5/5 E2E flows connect.

**Delivered:** A clarity-driven rebuild of the split flow — one scan-first Setup screen, a flat collaborative model with no host role, and a clean 3-screen flow (Setup → Bill View → Results) with currency recognition and a Results-launched tip.

**Key accomplishments:**

- **Phase 7 — App Shell + Setup:** easy-billsy branding on every screen via a shared AppHeader (hamburger menu, guarded New Split, 3-segment progress strip); the multi-step wizard collapsed into one scan-first Setup screen (hero scan tile, inline people add, post-scan thumbnail + item count, gated Continue); OCR detects the receipt currency as an ISO 4217 code.
- **Phase 8 — Flat Model (Schema + API Surgery):** removed every host-role concept from the schema, Lua scripts, and routes; deleted five host routes; added the direct `/edit` mutation route; threaded `currencyCode` through session create/get — every participant now shares one secret-free link.
- **Phase 9 — Bill View + Identity Modal:** flat collaborative claiming with a "Who are you?" identity modal (auto-show / restore / change / "I'm not listed"), live attribution chips, tap-to-join shared items with cent-exact splits, and a warn-but-allow "I'm done" dialog; SetupStep now routes straight to `/split/[sessionId]`, retiring the old wizard path.
- **Phase 10 — Results + Tip + Currency Display:** locked per-person itemized results with Copy/Edit/New actions; tip-as-modal launched from Results; `formatCents` threads the detected currency (correct symbol + decimals, incl. zero-decimal currencies like JPY) through every amount.
- **Phase 11 — Bug Fixes & Polish + Participant Management:** removed the dead Receipt button, enlarged Share to a ≥44px labeled target, added the unclaimed-items callout + playful/positive headlines, made "Add a tip" a prominent button, removed the confusing currency `<select>`, and added live rename-person (flat no-lock). Live remove-person was descoped (2 Critical Lua findings, no execution test).

**Known deferred items at close:** PART-01/02/06 (live remove-person, descoped by decision) + housekeeping debt — Phase 7 has no VERIFICATION/VALIDATION, Phases 9–11 verification reports sit at `human_needed`, plus dead wizard code. See STATE.md → Deferred Items and the milestone audit.

**Post-ship note:** A latent partial-claim billing bug (CLAIM-02: a sole claimant of 1-of-N units was billed the whole line) was found and fixed 2026-06-24 (debug session `per-unit-split-overcharge`); the integration check confirmed the fix is consistently applied across card display and billing.

---

## v1.0 MVP (Shipped: 2026-06-04)

**Phases completed:** 6 phases, 21 plans, 34 tasks
**Stats:** ~6,270 LOC TS/TSX · 232 commits · ~26 days (2026-05-08 → 2026-06-04)
**Tag:** v1.0

**Delivered:** A mobile web app that splits restaurant bills end-to-end — photo → OCR → AI-cleaned items → collaborative per-person claiming → per-person tips → final totals. Live on Vercel.

**Key accomplishments:**

- **Phase 1 — Manual Bill Splitter:** wizard (people / items / assign / tip / results) on a Zustand integer-cents store with largest-remainder tip distribution.
- **Phase 2 — OCR Pipeline:** in-browser camera capture + GPT-4o-mini vision extraction into an editable item list with a receipt thumbnail.
- **Phase 3 — AI Expansion + Disambiguation:** abbreviation expansion ("CHKN SAND LG" → "Chicken Sandwich (Large)"), confidence badges, and menu-photo / manual fallback.
- **Phase 4 — Shareable Links:** Upstash Redis session API (atomic Lua claim writes) + per-person claiming via a shared URL.
- **Phase 6 — Collaborative Bill Claiming:** real-time multi-claim sessions with quantity steppers, shared items, host approval/dispute flow, and per-person tips.
- **Phase 5 — Polish & Hardening:** unassigned-item warnings, copy-summary to clipboard, and offline/error recovery states.

**Known deferred items at close:** 7 (see STATE.md → Deferred Items). All either shipped-but-untracked or intentionally parked for v2; milestone audit (2026-05-28) PASSED.

**Deferred to v2:** proportional tip/tax split, tax input, bill history, payment deep-links, PWA manifest — plus the easy-billsy redesign (flat model, scan-first 3-screen flow).

---
