# Milestones

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
