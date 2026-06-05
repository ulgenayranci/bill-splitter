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

- [x] **Phase 7: App Shell + Setup Screen** — easy-billsy branding on all screens; wizard replaced by scan-first single-screen setup; OCR returns ISO 4217 currency code ✅ 2026-06-05
- [x] **Phase 8: Flat Model — Schema + API Surgery** — host role removed from schema, Lua scripts, and routes; direct edit route live; currencyCode added to the shared-bill payload; test suite migrated (completed 2026-06-05)
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
  5. OCR returns an ISO 4217 currency code alongside item data; the value is stored in Zustand (display deferred to Phase 10)
**Plans**: 4 plans (3 retroactively documented — work shipped in commits cb10468 / 430b02f; 07-04 gap closure from UAT)
- [x] 07-01-PLAN.md — App Shell: easy-billsy header on every screen, hamburger menu (New Split / disabled History + About Us), 3-segment progress strip (SHELL-01..04)
- [x] 07-02-PLAN.md — Setup Screen: scan-first single screen, inline people add, post-scan thumbnail + "N items found" + Retake, Continue gated on scan + ≥2 people, bridge to Assign (SETUP-01..04)
- [x] 07-03-PLAN.md — Currency Detection: OCR returns ISO 4217 currencyCode (strict schema), stored on useBillStore; detection + store only, display threading deferred to Phase 10 (CURR-01)
- [x] 07-04-PLAN.md — UAT Gap Closure: visible progress strip; gallery+camera capture (revises D-09); spacing, people count chip, copy cleanup; clear items on failed scan; inline scan-error (SHELL-04, SETUP-01..03)
**UI hint**: yes

---

> **Reassess gate**: After Phase 7 ships, explicitly review scope and sequencing of Phases 8–10 before continuing.
>
> **✅ Reassessed 2026-06-05** — Sequencing 8→9→10 confirmed (strict dependency chain holds); requirement coverage complete (no orphans). Decisions:
> 1. **Keep the ≥2-people Setup gate (SETUP-04).** IDENT-02's single-person auto-skip is unreachable under it and was revised — its "don't re-prompt" intent folds into IDENT-04 (persisted identity).
> 2. **Move the currencyCode shared-bill (SessionPayload) field + v1 migration default up into Phase 8** (done while the schema/normalizer are already open). Phase 10 keeps only the visible currency-display work.
> 3. Doc drift fixed: Phase 7 "currency symbol" → "ISO 4217 code"; SETUP-04 "≥1" → "≥2".
> 4. Open for Phase 9 discuss: unclaimed-items UX (recommended: warn + share-join-link CTA).

---

### Phase 8: Flat Model — Schema + API Surgery
**Goal**: The session data model is clean of all host-role concepts; the direct-edit route is live; the shared-bill payload carries the detected currencyCode; test suite reflects the new model
**Depends on**: Phase 7
**Requirements**: CLAIM-01, CLAIM-03 (+ currencyCode payload plumbing toward CURR-02, moved up from Phase 10 per 2026-06-05 reassessment)
**Success Criteria** (what must be TRUE):
  1. A participant can claim an item without a host token — no host approval step exists anywhere in the API
  2. Any participant can edit or remove an item directly via the new /edit route; edits apply immediately with no queue (deletes always show a confirm — D-02)
  3. The five deleted host routes return 404; no TypeScript type errors remain related to hostToken, editRequests, or disputes
  4. Editing a claimed item's price/quantity keeps existing claims and recalculates their shares (D-01)
  5. The shared-bill payload includes the detected currencyCode (default 'USD' at creation if absent); no migration normalizer needed
  6. Every deleted test file has a replacement with equivalent behavior coverage; CI is green
**Plans**: 5 plans (5 waves — schema/test → backend → small consumers → view refactor → test migration)
- [x] 08-01-PLAN.md — Schema flatten (remove host symbols, add currencyCode) + Wave-0 failing editRoute contract test (CLAIM-01, CLAIM-03, D-01, D-03, D-04)
- [x] 08-02-PLAN.md — Backend surgery: delete 5 host routes, create /edit route (turns editRoute test green), currencyCode in create+get, Lua host-audit in claim route (CLAIM-01, CLAIM-03, D-01, D-04)
- [x] 08-03-PLAN.md — Small consumers: strip hostToken from store, currencyCode in ShareLinkButton + fragment-free redirect, host UI off ClaimableItemCard/PersonSlotPicker, delete 3 host components (CLAIM-01, CLAIM-03, D-04)
- [x] 08-04-PLAN.md — CollaborativeClaimingView refactor: delete host state/UI, wire add/edit/remove to /edit, D-02 delete confirm, simplify phase machine (CLAIM-01, CLAIM-03, D-01, D-02)
- [x] 08-05-PLAN.md — Test migration: delete 7 obsolete tests, flatten surviving fixtures, currencyCode assertions, CI green modulo 4 known pre-existing failures (CLAIM-01, CLAIM-03, D-04)
**Discuss note (2026-06-05, see 08-CONTEXT.md)**: No existing users → v1/old-session migration is a NULL EVENT (D-03) — the original "migrate v1 sessions" criterion was dropped; do NOT build a migrateSession normalizer. currencyCode is added to the payload here; Phase 10 owns currency display only. Deletes always confirm (D-02); claimed-item edits auto-recalculate (D-01).

### Phase 9: Bill View Redesign + Identity Modal
**Goal**: The collaborative Bill View is fully flat; any participant can claim and edit; the "Who are you?" identity modal replaces the blocking slot-picker; live attribution shows who claimed each item
**Depends on**: Phase 8
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04, CLAIM-02, CLAIM-04, CLAIM-05, CLAIM-06
**Success Criteria** (what must be TRUE):
  1. On navigating to a shared bill, a "Who are you?" modal prompts name selection; "I'm not listed" allows adding a name inline without leaving the modal _(IDENT-02 revised 2026-06-05: the single-person auto-skip is unreachable under the ≥2-people Setup gate; the no-re-prompt intent is covered by IDENT-04 persisted identity)_
  2. The chosen identity survives a page reload (persisted to localStorage keyed by session)
  3. Any participant can claim any item by tapping; multiple people can share one item with a quantity stepper that splits cost proportionally
  4. Every item shows live attribution ("claimed by Alice") that updates across devices within the polling interval
  5. Unclaimed items are surfaced with a prominent warning before results; user can share a join link so others claim on their own phones
**Plans**: TBD
**UI hint**: yes

### Phase 10: Results Screen + Tip Modal + Currency Display
**Goal**: The Results screen shows a locked per-person breakdown with Copy/Edit/New bill actions; tip is added via a modal; the currency code from OCR (already carried in the shared-bill payload since Phase 8) is rendered correctly on every amount display throughout the app
**Depends on**: Phase 9
**Reassess note (2026-06-05)**: the currencyCode payload field now lands in Phase 8; Phase 10's currency work is display-only (formatCents threading + correct symbol/decimals incl. zero-decimal currencies like JPY).
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
| 7. App Shell + Setup Screen | v2.0 | 4/4 | Complete | 2026-06-05 |
| 8. Flat Model — Schema + API Surgery | v2.0 | 5/5 | Complete   | 2026-06-05 |
| 9. Bill View Redesign + Identity Modal | v2.0 | 0/? | Not started | - |
| 10. Results Screen + Tip Modal + Currency Display | v2.0 | 0/? | Not started | - |
