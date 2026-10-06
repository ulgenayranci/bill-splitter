# Roadmap: Bill Splitter

## Milestones

- ✅ **v1.0 MVP** — Phases 1–6 (shipped 2026-06-04) → [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 easy-billsy Redesign** — Phases 7–11 (shipped 2026-06-24) → [archive](milestones/v2.0-ROADMAP.md)
- 🚧 **v2.1 Faster people setup** — Phases 12–16 (in progress)

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

<details>
<summary>✅ v2.0 easy-billsy Redesign (Phases 7–11) — SHIPPED 2026-06-24</summary>

- [x] Phase 7: App Shell + Setup Screen (4/4 plans) — 2026-06-05
- [x] Phase 8: Flat Model — Schema + API Surgery (5/5 plans) — 2026-06-05
- [x] Phase 9: Bill View Redesign + Identity Modal (8/8 plans) — 2026-06-08
- [x] Phase 10: Results Screen + Tip Modal + Currency Display (5/5 plans) — 2026-06-08
- [x] Phase 11: Bug Fixes & Polish — Bill/Results + Participant Mgmt (4/4 plans) — 2026-06-09

Audit: [milestones/v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) — status `tech_debt` (0 blockers; 32/35 reqs, 3 deferred)
Full details: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

### 🚧 v2.1 Faster people setup (Phases 12–16)

**Milestone Goal:** Replace typing every name with a headcount, so a group gets from scan to splitting in a few taps. A seat is just a person whose name is empty; no new entity, no new dependencies.

- [ ] **Phase 12: Seat Foundations + Atomic Prerequisites** - Shared seat helpers, 20-person cap, done/tip made race-safe, old bills and equal tax/service math proven with empty seats
- [ ] **Phase 13: Seat Server Operations + Real-Redis Gate** - Atomic claim/add/remove seat operations, orphan guards, all tested against a real local Redis
- [ ] **Phase 14: OCR Guest Count** - Scanner reads the printed Pax/Covers/Guests number without disturbing item reading (can run in parallel with Phase 13)
- [ ] **Phase 15: Setup Headcount + Scanner Identity** - "How many people?" counter, only-my-name input, and landing on the live bill already identified
- [ ] **Phase 16: Identity Picker, Live Seat Management + Results** - Friends claim seats, anyone adds/removes empty seats, Results and Copy show Guest rows

## Phase Details

### Phase 12: Seat Foundations + Atomic Prerequisites
**Goal**: The existing bill is safe to build seats on: an empty-named person is handled everywhere, bills in flight keep working, and concurrent done/tip actions can no longer overwrite each other
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: RESULTS-06, REL-04
**Success Criteria** (what must be TRUE):
  1. A bill created before v2.1 (still within its 24h life) opens, claims, tips, and shows Results exactly as before
  2. With empty-named seats in a bill, tax and service split equally across all seats and each person's shares add up to the exact total (no cent lost or gained)
  3. Two friends pressing "I'm done" or saving a tip at the same moment both keep their change (neither overwrites the other or any person list change)
  4. A bill can never be created with more than 20 people
**Plans**: 3 plans
Plans:
- [ ] 12-01-PLAN.md — Seat helpers (lib/seats.ts), Person.guestNumber, MAX_PEOPLE cap on POST /api/session, billMath empty-seat proof (RESULTS-06)
- [ ] 12-02-PLAN.md — done + tip routes converted to field-level atomic Lua (lib/sessionLua.ts), contract unchanged (REL-04)
- [ ] 12-03-PLAN.md — []-vs-{} normalizeSession at GET boundary + frozen v2.0 session back-compat suite (REL-04)

### Phase 13: Seat Server Operations + Real-Redis Gate
**Goal**: The server can safely claim, add, and remove seats under simultaneous use, and this is proven by running the database scripts against a real local Redis, not mocks
**Depends on**: Phase 12
**Requirements**: REL-01, REL-02, REL-03, SEAT-03, SEAT-04
**Success Criteria** (what must be TRUE):
  1. When two phones claim the same empty seat at once, exactly one succeeds and the other gets a clear "seat taken" answer (verified against real local Redis)
  2. Claiming, adding, removing, "I'm done" and tip actions fired simultaneously never overwrite each other
  3. Picks, tips, and "done" for a person who no longer exists are rejected and never stored
  4. A seat with a name, picked items, a tip, or done status cannot be removed, and the bill never drops below 2 people
  5. Removing "Guest 2" leaves "Guest 3" still named "Guest 3" (guest numbers are stable, never renumbered)
**Plans**: TBD

### Phase 14: OCR Guest Count
**Goal**: A scan reports the receipt's printed number of guests when there is a believable one, with no change to how items are read
**Depends on**: Phase 12 (shared 20-person limit); independent of Phase 13
**Requirements**: OCR-05
**Success Criteria** (what must be TRUE):
  1. Scanning a receipt that prints Pax / Covers / Guests / Kişi returns that number as the guest count
  2. Table numbers, cover-charge lines, zero, and absurd values (over 20) are ignored and return no guest count
  3. A receipt with no guest count scans exactly as before, and item names, prices, and totals match the pre-change results on the existing receipt fixtures
**Plans**: TBD

### Phase 15: Setup Headcount + Scanner Identity
**Goal**: After a scan, the person types only her own name, sets how many people, and lands on the live bill already identified
**Depends on**: Phase 13, Phase 14
**Requirements**: SETUP-05, SETUP-06, SETUP-07, SETUP-08, SETUP-09
**Success Criteria** (what must be TRUE):
  1. After a scan, "How many people?" shows a −/+ counter that cannot go below 2 or above 20
  2. When the receipt printed a guest count the counter starts at it and says it came from the receipt; otherwise it starts at 2; either way she can change it
  3. "Start splitting" stays disabled until a bill is scanned, her name is typed, and the headcount is at least 2
  4. Starting creates a bill with her as a named person plus (headcount − 1) empty seats labelled "Guest 1", "Guest 2", …
  5. She lands on the live bill already identified, with no "Who are you?" prompt, and still sees the invite step
**Plans**: TBD
**UI hint**: yes — requires UI design contract review at 375px (`/gsd:ui-phase`)

### Phase 16: Identity Picker, Live Seat Management + Results
**Goal**: Friends open the link, claim any empty seat by typing their name, anyone can add or remove empty seats live, and Results show every seat
**Depends on**: Phase 13, Phase 15
**Requirements**: IDENT-05, IDENT-06, IDENT-07, IDENT-08, IDENT-09, SEAT-01, SEAT-02, SEAT-05, RESULTS-07
**Success Criteria** (what must be TRUE):
  1. A friend opening the link sees "Who are you?" listing every seat (empty "Guest N" seats and named people), picks any empty seat, types a name, and becomes that person
  2. If two friends pick the same empty seat at the same time, the second sees "Someone just took that seat" and picks again; named seats stay selectable for rejoining, and "+ I'm not listed" adds a new seat with their name
  3. A phone whose remembered seat has been removed is asked "Who are you?" again instead of breaking
  4. Anyone can add an empty seat (up to 20) and remove a seat only while it is empty; the bill shows "N of M joined" with empty seats looking distinct from named people
  5. Results and the copied summary show empty seats as "Guest N" rows with their tax/service share, and no blank name appears anywhere in the app
**Plans**: TBD
**UI hint**: yes — requires UI design contract review at 375px (`/gsd:ui-phase`)

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
| 8. Flat Model — Schema + API Surgery | v2.0 | 5/5 | Complete | 2026-06-05 |
| 9. Bill View Redesign + Identity Modal | v2.0 | 8/8 | Complete | 2026-06-08 |
| 10. Results Screen + Tip Modal + Currency Display | v2.0 | 5/5 | Complete | 2026-06-08 |
| 11. Bug Fixes & Polish — Bill/Results + Participant Mgmt | v2.0 | 4/4 | Complete | 2026-06-09 |
| 12. Seat Foundations + Atomic Prerequisites | v2.1 | 0/0 | Not started | - |
| 13. Seat Server Operations + Real-Redis Gate | v2.1 | 0/0 | Not started | - |
| 14. OCR Guest Count | v2.1 | 0/0 | Not started | - |
| 15. Setup Headcount + Scanner Identity | v2.1 | 0/0 | Not started | - |
| 16. Identity Picker, Live Seat Management + Results | v2.1 | 0/0 | Not started | - |
