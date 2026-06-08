# Requirements — v2.0 easy-billsy Redesign

**Milestone:** v2.0
**Created:** 2026-06-04
**Source:** claude.ai/design hi-fi handoff + competitor/user research (`.planning/research/SUMMARY.md`)

A clarity-driven rebuild: scan-first single Setup screen, flat collaborative model (no host role), 3-screen flow (Setup → Bill View → Results), tip from Results, currency recognition. Keep current codebase styling for now.

---

## v2.0 Requirements

### App Shell (SHELL)

- [x] **SHELL-01**: User sees the "easy-billsy" wordmark header on every screen
- [x] **SHELL-02**: User can open a hamburger menu with New Split, History, and About Us (History is an inert stub this milestone)
- [x] **SHELL-03**: User can start a fresh split from the menu (resets the current bill)
- [x] **SHELL-04**: Progress indicator reflects the 3-step flow (Setup → Bill View → Results)

### Setup (SETUP)

- [x] **SETUP-01**: User lands on a single scan-first Setup screen where scanning the bill is the primary action
- [x] **SETUP-02**: User can add people inline on the Setup screen (no separate step)
- [x] **SETUP-03**: After a scan, Setup shows the captured bill (thumbnail + item-found count) with a Retake option, not a re-scan-many affordance
- [x] **SETUP-04**: "Continue" is disabled until the bill is scanned and at least two people are added _(shipped as ≥2 — splitting needs 2+ people; supersedes the earlier "at least one" wording)_

### Identity (IDENT)

- [ ] **IDENT-01**: On continuing from Setup, a "Who are you?" modal prompts the user to pick their name before claiming
- [ ] **IDENT-02** _(revised 2026-06-05)_: The identity prompt does not nag — it is skipped whenever the device already has a chosen identity for this session (see IDENT-04). The original "auto-skip when only one person is in the party" is unreachable under the ≥2-people Setup gate (SETUP-04) and is folded into this no-re-prompt behavior. _(override 2026-06-08, GAP-09-NOLOCK)_: the "greyed-out taken names" interpretation (D-01) is retired — the flat model has no host, so every name is always re-selectable and concurrent same-name co-editing is allowed.
- [ ] **IDENT-03**: User can pick "I'm not listed" to add themselves, and can change identity later
- [ ] **IDENT-04**: The chosen identity persists on the device so a page reload doesn't re-prompt

### Flat Collaborative Claiming (CLAIM)

- [x] **CLAIM-01**: Any participant can claim items by tapping — no host, no approval queue
- [ ] **CLAIM-02**: Multiple people can share one item; a quantity stepper sets each person's portion with proportional cost split
- [x] **CLAIM-03**: Anyone can add, edit, or remove an item directly (changes apply immediately, no moderation)
- [ ] **CLAIM-04**: Live attribution shows who has claimed each item, updating in near-real-time across devices
- [ ] **CLAIM-05**: Unclaimed items are surfaced before results so nothing is missed
- [ ] **CLAIM-06**: User can share a join link so others claim on their own phones (no app install, no login)

### Currency (CURR)

- [x] **CURR-01**: The OCR step detects the receipt's currency
- [x] **CURR-02**: All monetary amounts render in the detected currency with correct symbol and decimal places (including zero-decimal currencies like JPY)
- [x] **CURR-03**: If currency can't be detected, the app falls back gracefully (sensible default; user can set it)

### Results & Tip (RESULTS / TIP)

- [ ] **RESULTS-03**: Locked Results screen shows each person's itemized breakdown — the current user expanded by default, others tap-to-expand — plus a grand total
- [ ] **RESULTS-04**: From Results, user can Copy a plain-text summary, Edit the bill, or start a New bill
- [ ] **TIP-02**: User can add a tip via a modal launched from the Results screen; totals update to include it

---

## Future Requirements (deferred)

- **HIST-01**: Saved bill history — list and reopen past splits (→ v2.1+; History menu is an inert stub in v2.0)
- Proportional tax / tip split, tax input (dropped from the v2 flow)

## Out of Scope

- Payment-rail integration (Venmo/CashApp/etc.) — not targeting the US market
- Native iOS/Android app — web app covers the use case
- User accounts / login — anonymous, link-based use keeps friction low
- Host/moderator role, edit-request approval, disputes — **removed** in v2 (the flat model is the point)

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SHELL-01 | Phase 7 | Complete |
| SHELL-02 | Phase 7 | Complete |
| SHELL-03 | Phase 7 | Complete |
| SHELL-04 | Phase 7 | Complete |
| SETUP-01 | Phase 7 | Complete |
| SETUP-02 | Phase 7 | Complete |
| SETUP-03 | Phase 7 | Complete |
| SETUP-04 | Phase 7 | Complete |
| CURR-01 | Phase 7 | Complete |
| CLAIM-01 | Phase 8 | Complete |
| CLAIM-03 | Phase 8 | Complete |
| IDENT-01 | Phase 9 | Pending |
| IDENT-02 | Phase 9 | Pending |
| IDENT-03 | Phase 9 | Pending |
| IDENT-04 | Phase 9 | Pending |
| CLAIM-02 | Phase 9 | Pending |
| CLAIM-04 | Phase 9 | Pending |
| CLAIM-05 | Phase 9 | Pending |
| CLAIM-06 | Phase 9 | Pending |
| RESULTS-03 | Phase 10 | Pending |
| RESULTS-04 | Phase 10 | Pending |
| TIP-02 | Phase 10 | Pending |
| CURR-02 | Phase 10 | Complete |
| CURR-03 | Phase 10 | Complete |
