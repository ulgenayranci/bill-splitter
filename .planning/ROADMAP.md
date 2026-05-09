# Roadmap

**Project:** Bill Splitter
**Milestone:** v1.0
**Granularity:** Standard
**Mode:** Vertical MVP
**Created:** 2026-05-08
**Coverage:** 12/12 requirements mapped

---

## Phases

- [x] **Phase 1: Manual Bill Splitter** - People, items, assignment, tip, and final totals — fully working without OCR
- [ ] **Phase 2: OCR Pipeline** - Photo capture, GPT-4o-mini extraction, and editable item confirmation
- [ ] **Phase 3: AI Expansion + Disambiguation** - Abbreviation expansion, confidence display, and menu photo / manual fallback
- [ ] **Phase 4: Shareable Links** - Session API, Upstash Redis, and per-person item claiming via shared URL
- [ ] **Phase 5: Polish & Hardening** - Unassigned-item warnings, mobile UX, error handling, and copy summary

---

## Phase Details

### Phase 1: Manual Bill Splitter
**Goal**: Anyone at the table can split a bill by hand — add people, enter items, assign them, set tip, and see exactly what each person owes.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: PEOPLE-01, ITEMS-01, ITEMS-02, ITEMS-03, TIP-01, RESULTS-01
**Success Criteria** (what must be TRUE):
  1. User can add people to the bill by name with no account or login
  2. User can manually enter item names and prices (stored as integer cents with no floating-point error)
  3. User can assign each item to one person or mark it as shared and pick which people shared it
  4. User can enter a tip as a preset percentage (15%, 18%, 20%) or a custom value
  5. App shows a final breakdown listing what every person at the table owes, reflecting proportional tip
**Plans:** 3 plans
  - [x] 01-PLAN-01.md — Walking skeleton + AddPeople (PEOPLE-01)
  - [x] 01-PLAN-02.md — AddItems + AssignItems (ITEMS-01, ITEMS-02, ITEMS-03)
  - [x] 01-PLAN-03.md — SetTip + Results (TIP-01, RESULTS-01)
**UI hint**: yes

### Phase 2: OCR Pipeline
**Goal**: Host can snap a photo of the receipt and get a reviewable list of items without typing anything.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: OCR-01, OCR-03
**Success Criteria** (what must be TRUE):
  1. User can take a photo of the bill using their phone camera directly in the browser (works on iOS Safari and Android Chrome)
  2. App extracts line items and prices from the photo and displays them as an editable list alongside a thumbnail of the captured image
  3. User can correct any misread item name or price before proceeding to assignment
**Plans:** 3 plans
  **Wave 0**
  - [ ] 02-01-PLAN.md — Foundation: install openai + browser-image-compression, jsdom URL mocks, useBillStore extension (billImageUrl + ocrStatus), stub test files (OCR-01)
  **Wave 1** *(blocked on Wave 0 completion)*
  - [ ] 02-02-PLAN.md — Server slice: app/api/ocr/route.ts with GPT-4o-mini vision + json_schema strict output + unit tests with mocked openai (OCR-01)
  **Wave 2** *(blocked on Wave 1 completion)*
  - [ ] 02-03-PLAN.md — Client slice: Toast.Provider wrapper, OcrLoadingOverlay portal, OcrErrorToast, AddItemsStep scan button + thumbnail + OCR handler (OCR-01, OCR-03)
  **Cross-cutting constraints:**
  - OPENAI_API_KEY must be server-only (no NEXT_PUBLIC_ prefix) — enforced across all plans
  - All priceCents values must be integer cents — enforced in route handler json_schema and addItem() calls
**UI hint**: yes

### Phase 3: AI Expansion + Disambiguation
**Goal**: Abbreviated receipt names are expanded into readable descriptions, and items the AI is unsure about can be resolved via a menu photo or manual entry.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: OCR-02, OCR-04
**Success Criteria** (what must be TRUE):
  1. OCR output is automatically expanded by the AI so "CHKN SAND LG" appears as "Chicken Sandwich (Large)" in the item list
  2. Low-confidence expansions are visually flagged so the user knows which items to review
  3. For items that remain ambiguous, user is offered the choice to take a photo of the menu or enter the correct name manually
  4. The app handles LLM timeout gracefully by falling back to the raw abbreviated name (still editable) rather than blocking
**Plans**: TBD
**UI hint**: yes

### Phase 4: Shareable Links
**Goal**: The host can share a link so each person claims their own items on their own phone instead of the host doing all the tapping.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: RESULTS-02
**Success Criteria** (what must be TRUE):
  1. Host can generate a shareable URL for the current session
  2. Each person can open the link on their own phone and see the full item list
  3. Each person can tap to claim their items; the app prevents double-claiming (an item claimed by one person is shown as taken to others)
  4. Final totals update to reflect each person's claimed items once everyone is done
**Plans**: TBD

### Phase 5: Polish & Hardening
**Goal**: Edge cases are caught, the mobile experience is smooth, and users can share the result outside the app.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: ITEMS-04
**Success Criteria** (what must be TRUE):
  1. App warns the user if any items remain unassigned before the final totals screen is shown
  2. User can copy a plain-text summary of the split to their clipboard to paste into a group chat
  3. All error states (camera permission denied, OCR failure, network timeout) show a clear recovery message rather than a blank screen or silent failure
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Manual Bill Splitter | 3/3 | Complete | 2026-05-09 |
| 2. OCR Pipeline | 0/3 | Plans created | - |
| 3. AI Expansion + Disambiguation | 0/3 | Not started | - |
| 4. Shareable Links | 0/3 | Not started | - |
| 5. Polish & Hardening | 0/2 | Not started | - |
