# Project Research Summary

**Project:** Bill Splitter (easy-billsy) — milestone v2.1 "Faster people setup"
**Domain:** Headcount + empty-seat claiming on a flat, anonymous, real-time, receipt-scanning bill splitter
**Researched:** 2026-10-06
**Confidence:** HIGH (stack/architecture — read from real code), MEDIUM (features, OCR guest-count behaviour)

## Executive Summary

v2.1 is a small, surgical change to a shipped app: the scanner types only her own name, a −/+ counter (prefilled from the receipt's printed Pax/Covers/Guests) creates N−1 anonymous seats, and friends open the share link, pick any empty seat, and type their own name. Empty seats pay an equal share of tax and service. Tax and service are already live as auto-shared locked bill items split equally (quick tasks 260929-lxp, 261001-ld5) — no new money input needed. No competitor does exactly this; design from first principles and the existing code.

All four researchers converge on one model: **a seat is just a `Person` whose `name` is `''`.** No new entity, no `seats[]`, no flag, no schema migration, no `billMath` change, no new npm package. `computeEqualChargeShares` already divides by `people.length`, so "empty seats pay equally" is free; `POST /api/session` already accepts empty names. Real work: three atomic Lua ops (`claim_seat`, `add_seat`, `remove_seat`) in the existing `/edit` route, one nullable `guestCount` in the existing OCR call, and a UI pass (every renderer of `person.name` assumes non-empty).

The main risk is concurrency correctness — the same area descoped in v2.0 (live remove with untested Lua). Mitigations: `remove_seat` refuses anything not provably empty and never purges; `claim_seat` is compare-and-set; every person-keyed script gets a person-exists guard; `done`/`tip` move to field-level Lua before the seat-claim stampede; a real Lua execution test is a hard ship gate.

## Key Findings

### Recommended Stack
**No new dependencies.** Changes to existing pieces:
- `app/api/ocr/route.ts`: nullable `guestCount` in prompt, strict schema (`properties` + `required`, null union), `OcrParsed`, parse clamp (integer 1..20 else null); carried through the two-pass retry merge (verify in code).
- `stores/useBillStore.ts`: `headcount` + `setHeadcount` (clamped), persisted via `partialize`; no persist `version` bump; build `[owner, ...empty seats]` at submit in a pure helper.
- `lib/sessionSchema.ts`: shape unchanged; add `MAX_PEOPLE = 20` (shared by OCR parser, counter, `POST /api/session` cap, Lua ARGV) and `isEmptySeat`.
- `/edit` route: `claim_seat`, `add_seat`, `remove_seat` via the proven inline-Lua `redis.eval` pattern (Upstash `multi()` is not atomic). No WATCH, Redis JSON, zod, or realtime layer — existing 3s polling propagates seat changes.

### Expected Features
**Must have:** headcount counter (default 2 when OCR finds nothing, plausibility-guarded prefill, editable, max 20); scanner types only her name and is auto-identified (skips "Who are you?"); picker lists seats, joiner picks ANY empty seat and types a name; "+ I'm not listed" adds a named seat atomically; empty seats in the equal tax/service split and shown in Results/Copy as labelled rows; live add seat (anyone); live remove seat (anyone, only while empty: no name/claims/tips/done); name validation (trimmed, non-empty, capped); duplicate names allowed.
**Differentiators:** OCR-prefilled headcount; zero typing for N−1 friends; empty seats sorted first in the picker.
**Anti-features / defer:** "seats still empty" nudge, host role, name locking, removing named/claiming people live, blocking duplicates, renumbering seats on removal, payments.

### Architecture Approach
`session.people` is the single source of truth; emptiness is derived, never stored; all mutations are atomic Lua returning status codes mapped to HTTP.
1. `lib/seats.ts` (new) — `isEmptySeat`, `seatLabel`/`displayName`, `seatInitial`.
2. `/edit` Lua ops — `claim_seat` (CAS on empty name, else `seat_taken` 409), `add_seat` (reuses `ADD_PERSON_SCRIPT`, 20 cap), `remove_seat` (verify empty, no claims/slots/done/tips, floor, then remove).
3. `PersonSlotPicker` + `IdentityModal` — empty-seat cards with inline name entry, `onClaimSeat`, rename pencil hidden on empty seats.
4. `SeatManager` (new) + `BillViewHeader` — add/remove empty seats live; neutral circles for empty seats.
5. `SetupStep` — counter, own-name input, Continue gate (scanned AND own name AND valid headcount), OCR prefill, scanner's personId pre-stored in localStorage.
6. `PersonResultsScreen`, `ClaimableItemCard` — label helper, Copy text.
Unchanged: `billMath`, `createSession`, `GET /api/session/[id]`.

### Critical Pitfalls
1. **Double-claim merges identities** — `rename_person` overwrites unconditionally → dedicated `claim_seat` CAS; on `seat_taken` refetch + "Someone just took that seat".
2. **Orphan claims after live removal** — claim/tip/done scripts never check the person exists → `person_not_found` guard on every person-keyed script, same phase as `remove_seat`; client reopens identity modal.
3. **New Lua with no execution test** (the v2.0 failure) — mocked-redis tests miss cjson traps (empty table → `[]`, mutate-while-iterating, nil truncation) → real Lua execution test is a ship gate.
4. **`done`/`tip` clobber `people[]`** — whole-session GET-spread-SET can revert a seat claim → convert to field-level Lua first.
5. **Blank names leaking** into Copy text, Results, chips, avatar initials → one label helper, grep every `.name`, snapshot tests with an empty seat.
Also: stale localStorage identity pointing at a removed seat (needs continuous validity check, not one-shot `restoreAttempted`); OCR reading a table number as pax (clamp, editable, never into items); old 24h sessions must keep working (additive only).

## Implications for Roadmap (suggested 5 phases)

1. **Seat foundations + atomic prerequisites** — `lib/seats.ts`, `MAX_PEOPLE` + create cap, `done`/`tip` → field-level Lua, billMath tests with `name: ''`, v2.0-shaped session fixture, `[]`-vs-`{}` normalisation.
2. **Seat server ops + Lua execution gate** — `claim_seat`, `add_seat`, `remove_seat`, `person_not_found` guards; real Lua tests (concurrent double-claim, remove after claim, remove with claims, `claims.items == []`, floor, orphan-claim invariant).
3. **OCR guestCount** (parallel with 2) — schema/prompt/clamp/merge/response, fixtures incl. "Table 12 Pax 4", "Covers: 0", "Coperti 4 x 2.00", none, Turkish "Kişi"; item-checksum regression.
4. **Setup headcount UI + scanner identity** — counter, own-name input, gate, "from receipt" hint, persisted headcount, scanner personId pre-stored (verify invite step still shows).
5. **Identity picker, live seat management, Results display** — empty-seat cards + inline claim, 409 handling, continuous identity check, `SeatManager`, Results/Copy rows for empty seats, "tax split across N people", empty seats excluded from done/tip completion, 375px multi-device verification.

**Research flags:** Phase 2 (Lua harness) and Phase 3 (real receipts) need phase research; Phases 1, 4, 5 standard (design review at 375px for 5).

## Open Decisions for the User
1. **Lua test harness** (gate before `remove_seat` ships): local `redis-server` dev test vs dedicated Upstash test DB. Real Redis favoured; a local server may need a dev-only dependency. Manual smoke checklist is a minimum, not a substitute.
2. **Minimum seat floor:** recommend 2 for counter and `remove_seat`.

## Gaps to Address
- **Seat labelling:** approved mockups show "Seat N" numbers in the picker; if kept, store a monotonic seat number at creation (fall back to index for old sessions) so removals don't renumber.
- **Setup state shape:** derive-at-submit recommended; settle in Phase 4 planning.
- **colorIndex duplicates after remove+add:** cosmetic; max+1 in Lua if trivial.
- **Other whole-session GET/SET writers** (`/edit` item ops): pre-existing tiny window; fix only if testing shows trouble.
- **Inflation visibility:** show the headcount used for the tax split on Results.

## Sources
- Primary (HIGH): the code (session routes edit/claim/done/tip, OCR route, billMath, sessionSchema, createSession, store, SetupStep, identity/picker components, PersonResultsScreen, CollaborativeClaimingView); PROJECT.md; v2.0 milestone audit.
- Secondary (MEDIUM): Tab, SplitMyExpenses, split-calculator patterns; Upstash `multi()` non-atomicity from code comments.
- Tertiary (LOW): seat-label/bounds UX judgment, OCR label variants, fengari/cjson.

*Research completed: 2026-10-06 | Ready for roadmap: yes*
