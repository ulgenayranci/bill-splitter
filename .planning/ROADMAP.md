# Roadmap: Bill Splitter

## Milestones

- ✅ **v1.0 MVP** — Phases 1–6 (shipped 2026-06-04) → [archive](milestones/v1.0-ROADMAP.md)
- 📋 **v2.0 easy-billsy Redesign** — Phases 7–10 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–6) — SHIPPED 2026-06-04</summary>

- [x] Phase 1: Manual Bill Splitter (3/3 plans) — 2026-05-09
- [x] Phase 2: OCR Pipeline (3/3 plans) — 2026-05-09
- [x] Phase 3: AI Expansion + Disambiguation (3/3 plans) — 2026-05-10
- [x] Phase 4: Shareable Links (3/3 plans) — 2026-05-13
- [x] Phase 5: Polish & Hardening (3/3 plans) — 2026-05-14
- [x] Phase 6: Collaborative Bill Claiming (6/6 plans) — 2026-05-27

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 📋 v2.0 — easy-billsy Redesign

- [ ] **Phase 7: App Shell + Setup Screen** — easy-billsy branding on all screens; wizard replaced by scan-first single-screen setup; OCR returns currency symbol
- [ ] **Phase 8: Flat Model — Schema + API Surgery** — host role removed from schema, Lua scripts, and routes; direct edit route live; test suite migrated
- [ ] **Phase 9: Bill View Redesign + Identity Modal** — flat collaborative claiming; "Who are you?" identity modal; live attribution; unassigned-items warning
- [ ] **Phase 10: Results Screen + Tip Modal + Currency Display** — locked per-person results; tip-as-modal; currency symbol threaded through all amount displays

## Phase Details

### Phase 7: App Shell + Setup Screen
**Goal**: Users experience easy-billsy branding on every screen and can scan a receipt + add people on a single Setup screen (wizard gone)
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SETUP-01, SETUP-02, SETUP-03, SETUP-04, CURR-01
**Success Criteria** (what must be TRUE):
  1. User sees the "easy-billsy" wordmark header on every screen of the app
  2. User can open a hamburger menu and tap New Split, History (stub), or About Us
  3. User lands on a single Setup screen where the camera/scan action is the primary call to action; the old multi-step wizard is gone
  4. After scanning, Setup shows a bill thumbnail with item count and a Retake option; "Continue" is enabled only when a bill is scanned and at least two people are added
  5. OCR returns a currency symbol alongside item data; the value is stored in Zustand
**Plans**: TBD
**UI hint**: yes

---

> **Reassess gate**: After Phase 7 ships, explicitly review scope and sequencing of Phases 8–10 before continuing.

---

### Phase 8: Flat Model — Schema + API Surgery
**Goal**: The session data model is clean of all host-role concepts; the direct-edit route is live; live Redis sessions are protected by a migration normalizer; test suite reflects the new model
**Depends on**: Phase 7
**Requirements**: CLAIM-01, CLAIM-03
**Success Criteria** (what must be TRUE):
  1. A participant can claim an item without a host token — no host approval step exists anywhere in the API
  2. Any participant can edit or remove an item directly via the new /edit route; changes apply immediately with no queue
  3. The five deleted host routes return 404; no TypeScript type errors remain related to hostToken, editRequests, or disputes
  4. Sessions created by v1 code that are still live in Redis (within 24h TTL) are normalised on read and do not crash
  5. Every deleted test file has a replacement with equivalent behavior coverage; CI is green
**Plans**: TBD

### Phase 9: Bill View Redesign + Identity Modal
**Goal**: The collaborative Bill View is fully flat; any participant can claim and edit; the "Who are you?" identity modal replaces the blocking slot-picker; live attribution shows who claimed each item
**Depends on**: Phase 8
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04, CLAIM-02, CLAIM-04, CLAIM-05, CLAIM-06
**Success Criteria** (what must be TRUE):
  1. On navigating to a shared bill, a "Who are you?" modal prompts name selection; it auto-skips when only one person is in the party; "I'm not listed" allows adding a name inline without leaving the modal
  2. The chosen identity survives a page reload (persisted to localStorage keyed by session)
  3. Any participant can claim any item by tapping; multiple people can share one item with a quantity stepper that splits cost proportionally
  4. Every item shows live attribution ("claimed by Alice") that updates across devices within the polling interval
  5. Unclaimed items are surfaced with a prominent warning before results; user can share a join link so others claim on their own phones
**Plans**: TBD
**UI hint**: yes

### Phase 10: Results Screen + Tip Modal + Currency Display
**Goal**: The Results screen shows a locked per-person breakdown with Copy/Edit/New bill actions; tip is added via a modal; currency symbol from OCR is rendered correctly on every amount display throughout the app
**Depends on**: Phase 9
**Requirements**: RESULTS-03, RESULTS-04, TIP-02, CURR-02, CURR-03
**Success Criteria** (what must be TRUE):
  1. The Results screen shows each person's itemized breakdown; the current user's section is expanded by default; others tap to expand; a grand total is visible
  2. User can add a tip via a modal launched from the Results screen; totals update immediately to include it
  3. User can Copy a plain-text per-person summary, tap Edit to return to the Bill View, or start a New bill that resets the flow
  4. All monetary amounts render in the currency detected from the receipt (correct symbol and decimal places); amounts are correct for the session's currency
  5. When currency cannot be detected, the app falls back gracefully (sensible default displayed; user can override it without blocking the flow)
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Manual Bill Splitter | v1.0 | 3/3 | Complete | 2026-05-09 |
| 2. OCR Pipeline | v1.0 | 3/3 | Complete | 2026-05-09 |
| 3. AI Expansion + Disambiguation | v1.0 | 3/3 | Complete | 2026-05-10 |
| 4. Shareable Links | v1.0 | 3/3 | Complete | 2026-05-13 |
| 5. Polish & Hardening | v1.0 | 3/3 | Complete | 2026-05-14 |
| 6. Collaborative Bill Claiming | v1.0 | 6/6 | Complete | 2026-05-27 |
| 7. App Shell + Setup Screen | v2.0 | 0/? | Not started | - |
| 8. Flat Model — Schema + API Surgery | v2.0 | 0/? | Not started | - |
| 9. Bill View Redesign + Identity Modal | v2.0 | 0/? | Not started | - |
| 10. Results Screen + Tip Modal + Currency Display | v2.0 | 0/? | Not started | - |
