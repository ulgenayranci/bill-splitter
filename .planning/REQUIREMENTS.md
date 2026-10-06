# Requirements: Bill Splitter (easy-billsy)

**Defined:** 2026-10-06
**Milestone:** v2.1 Faster people setup
**Core Value:** Photo → items → each person picks what they had → everyone knows what they owe.

## v2.1 Requirements

### Setup — headcount

- [ ] **SETUP-05**: After a scan, the user sets "How many people?" with a −/+ counter (minimum 2, maximum 20)
- [ ] **SETUP-06**: The counter is pre-filled from the receipt's printed guest count (Pax / Covers / Guests) when the scan finds a plausible one, shows that it came from the receipt, and stays editable; otherwise it defaults to 2
- [ ] **SETUP-07**: The person scanning types only her own name; "Start splitting" requires a scanned bill, her name, and a headcount of at least 2
- [ ] **SETUP-08**: Starting the split creates the bill with her as a named person plus (headcount − 1) empty seats labelled "Guest 1", "Guest 2", …
- [ ] **SETUP-09**: The person who scanned lands on the live bill already identified (no "Who are you?" prompt for her)

### Joining — seats

- [ ] **IDENT-05**: A friend opening the link sees "Who are you?" listing every seat — empty "Guest N" seats and named people
- [ ] **IDENT-06**: A friend can pick ANY empty seat, type their name, and becomes that person
- [ ] **IDENT-07**: If two friends pick the same empty seat at the same moment, only the first gets it; the second sees "Someone just took that seat" and picks again
- [ ] **IDENT-08**: Named seats stay selectable (rejoin from another phone — no name locking); "+ I'm not listed" adds a new seat with the friend's name
- [ ] **IDENT-09**: If the seat a phone remembers no longer exists, that phone is asked "Who are you?" again instead of breaking

### Live seat management

- [ ] **SEAT-01**: Anyone on the live bill can add an empty seat (up to 20 people)
- [ ] **SEAT-02**: Anyone can remove a seat only while it is empty (no name, no picked items, no tip, not done); named or active people cannot be removed
- [ ] **SEAT-03**: The bill never drops below 2 people
- [ ] **SEAT-04**: Guest numbers never shift — removing "Guest 2" does not rename "Guest 3"
- [ ] **SEAT-05**: The live bill shows "N of M joined" and empty seats distinctly from named people

### Money and results

- [ ] **RESULTS-06**: Tax and service are split equally across all seats, empty ones included, and the shares always add up to the exact total
- [ ] **RESULTS-07**: Results and the copied summary show empty seats as "Guest N" rows with their tax/service share; no blank names appear anywhere in the app

### Scan

- [ ] **OCR-05**: The scanner reads the receipt's printed guest count (Pax / Covers / Guests / Kişi) when present, ignoring table numbers and cover-charge lines, without changing item reading

### Reliability (ship gates)

- [ ] **REL-01**: Seat actions (claim, add, remove) and the existing "I'm done" and tip actions cannot overwrite each other when several friends act at the same moment
- [ ] **REL-02**: Picks, tips, and "done" for a person who no longer exists are rejected, never stored
- [ ] **REL-03**: All new and changed database scripts are tested against a real local Redis (including simultaneous seat claims and remove-vs-claim) before release
- [ ] **REL-04**: Bills created before v2.1 (still open within their 24h life) keep working unchanged

## Future Requirements

- Bill history / saved splits
- Removing people who have already joined or picked items on the live bill
- User-facing privacy disclosure (open TODO)

## Out of Scope

| Feature | Reason |
|---------|--------|
| "Seats still empty" reminder | User decision: the group is trusted to count themselves |
| Host role / only the scanner can manage seats | Flat model (v2.0 decision): everyone with the link is equal |
| Name locking / blocking duplicate names | Flat no-lock model; people can rejoin from another phone |
| Removing named or active people live | Previously descoped (risky); only empty seats can be removed |
| Avatars/photos for seats | Not needed to shorten setup |
| Payments | Not targeting the US market; out of scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| (filled by roadmap) | | |

---
*Requirements defined: 2026-10-06*
