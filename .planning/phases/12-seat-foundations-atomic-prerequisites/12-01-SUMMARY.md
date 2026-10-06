---
phase: 12-seat-foundations-atomic-prerequisites
plan: 01
subsystem: seats
tags: [seats, session-api, billMath, vitest]
requires: []
provides:
  - lib/seats.ts seat helpers (isEmptySeat, seatLabel, seatInitial, nextGuestNumber, isValidGuestNumber, MAX_GUEST_NUMBER)
  - MAX_PEOPLE=20 / MIN_PEOPLE=2 shared bounds
  - Optional Person.guestNumber
  - POST /api/session 20-person cap, guestNumber validation, people key whitelist
affects: [seat Lua ops, Setup headcount, picker, Results]
tech-stack:
  added: []
  patterns: [seat = Person with name '']
key-files:
  created: [lib/seats.ts, __tests__/seats.test.ts, __tests__/billMathSeats.test.ts]
  modified: [stores/useBillStore.ts, lib/sessionSchema.ts, app/api/session/route.ts, __tests__/sessionRoute.test.ts]
key-decisions:
  - "Server minimum stays 1 person for v2.0 client compatibility; floor of 2 enforced elsewhere"
  - "billMath unchanged; RESULTS-06 proven by tests"
requirements-completed: [RESULTS-06]
duration: 10min
completed: 2026-10-06
---

# Phase 12 Plan 01: Seat Foundations Summary

Seat helper module, shared 20-person cap enforced at bill creation, optional stable guestNumber on Person, and a test suite proving tax/service split equally and exactly across empty-named seats for 1..20 people.

## Commits
- 0dd4762 feat: seat helpers, Person.guestNumber, MAX_PEOPLE/MIN_PEOPLE
- ab1ddd5 feat: cap people at 20 and sanitise people on POST /api/session
- Task 3 test commit: billMathSeats suite (see git log)

## Deviations from Plan
None - plan executed exactly as written. lib/billMath.ts and the share call sites are unchanged (grep confirms 4 canonical call sites).

## Verification
Full vitest suite: 32 files, 571 tests pass. `npx tsc --noEmit` clean.

## Known Stubs
None.

## Threat Flags
None.

## Self-Check: PASSED
