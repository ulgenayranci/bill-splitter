# Requirements

**Project:** Bill Splitter
**Version:** v1.0
**Last updated:** 2026-05-08

---

## v1 Requirements

### People & Items

- [ ] **PEOPLE-01**: User can add people to the bill by name (no account required)
- [ ] **ITEMS-01**: User can manually enter items with prices
- [ ] **ITEMS-02**: User can assign items to one or more people
- [ ] **ITEMS-03**: User can mark an item as shared and select which people shared it
- [ ] **ITEMS-04**: App warns user if items remain unassigned before finalizing

### OCR & AI

- [x] **OCR-01**: User can take a photo of the bill to extract items automatically
- [ ] **OCR-02**: AI expands abbreviated item names into readable names (e.g. "CHKN SAND" → "Chicken Sandwich")
- [ ] **OCR-03**: User can review and edit extracted items before assigning
- [ ] **OCR-04**: When items are ambiguous, user can take a menu photo OR enter the name manually

### Tip

- [x] **TIP-01**: User can select tip percentage (15%, 18%, 20%, or custom) to be added to the bill

### Results

- [x] **RESULTS-01**: App shows final breakdown of what each person owes
- [ ] **RESULTS-02**: User can share a link so each person claims their own items on their own phone

---

## v2 Requirements

- Proportional tip/tax split (bigger order = bigger share)
- Tax input (percent or flat amount)
- Copy-to-clipboard summary
- Venmo/CashApp payment deep-links
- PWA installable manifest
- Bill history / saved splits

---

## Out of Scope

- **User accounts / login** — anonymous use keeps friction low; accounts add complexity with no v1 benefit
- **Native iOS/Android app** — mobile-friendly web app covers the use case without App Store overhead
- **Payment processing** — out of scope; deep-links (v2) are sufficient
- **Currency conversion** — single-currency only for v1
- **Social features** — not aligned with core value

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PEOPLE-01 | Phase 1 | pending |
| ITEMS-01 | Phase 1 | pending |
| ITEMS-02 | Phase 1 | pending |
| ITEMS-03 | Phase 1 | pending |
| TIP-01 | Phase 1 | Complete |
| RESULTS-01 | Phase 1 | Complete |
| OCR-01 | Phase 2 | Complete |
| OCR-03 | Phase 2 | pending |
| OCR-02 | Phase 3 | pending |
| OCR-04 | Phase 3 | pending |
| RESULTS-02 | Phase 4 | pending |
| ITEMS-04 | Phase 5 | pending |
