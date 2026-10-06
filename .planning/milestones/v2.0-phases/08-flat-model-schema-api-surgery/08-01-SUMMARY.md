---
phase: 08-flat-model-schema-api-surgery
plan: 01
subsystem: api
tags: [typescript, schema, redis, vitest, session]

# Dependency graph
requires:
  - phase: 07-scan-first-and-currency-detection
    provides: currencyCode in useBillStore and OCR pipeline; existing SessionPayload with host concepts to remove
provides:
  - "Flat SessionPayload with currencyCode and no host symbols (hostToken, hostPersonId, editRequests, disputes)"
  - "ClaimEntry collapsed to { qty: number } (self-claim only)"
  - "PublicSessionPayload = SessionPayload alias (zero-break path)"
  - "Wave-0 failing editRoute contract test pinning /edit route behavior (RED by design)"
affects:
  - 08-02 (edit route implementation — goes GREEN here)
  - 08-03 (route surgery — TypeScript cascade from schema change drives callsite fixes)
  - 08-04 (component surgery — same cascade)
  - 08-05 (test migration — flat baseSession fixtures)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat session model: all participants equal, no host/approval queue"
    - "PublicSessionPayload alias kept as type alias to SessionPayload for zero-break imports"
    - "Wave-0 RED test: contract test written before route exists, goes GREEN in Plan 02"

key-files:
  created:
    - __tests__/editRoute.test.ts
  modified:
    - lib/sessionSchema.ts

key-decisions:
  - "PublicSessionPayload kept as alias (= SessionPayload) to avoid phantom-consumer breakage at all import sites"
  - "ClaimEntry reduced to { qty } only — all claims are self-claims in the flat model"
  - "currencyCode placed after createdAt with JSDoc noting Phase 10 handles display only"

patterns-established:
  - "Schema-first surgery: change lib/sessionSchema.ts first so TypeScript cascade enumerates every broken callsite automatically"
  - "Wave-0 RED contract test: write the test before the route exists so the contract is locked before implementation"

requirements-completed: [CLAIM-01, CLAIM-03]

# Metrics
duration: 2min
completed: 2026-06-05
---

# Phase 08 Plan 01: Flat SessionSchema + Wave-0 Contract Test Summary

**Collapsed SessionPayload to a flat model (no host symbols) with currencyCode, and authored a RED-by-design Wave-0 test pinning the /edit route contract for plans 02-04.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-05T21:10:15Z
- **Completed:** 2026-06-05T21:12:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Removed all host-role symbols from `lib/sessionSchema.ts`: `EditPayload`, `EditRequest`, `Dispute` types deleted; `hostToken`, `hostPersonId`, `editRequests`, `disputes` fields removed from `SessionPayload`; `ClaimEntry` collapsed to `{ qty: number }` only
- Added `currencyCode: string` to `SessionPayload` (ISO 4217, defaults to 'USD' at creation; display threading deferred to Phase 10 per D-04)
- Kept `PublicSessionPayload = SessionPayload` alias so all existing imports compile without changes (Pitfall 2 avoided)
- Authored `__tests__/editRoute.test.ts` with 10 tests covering all 5 ops (add, edit_name, edit_price, edit_quantity, remove), D-01 claim preservation, Pitfall 4 rejection, 404/400 paths — RED by design because the route doesn't exist yet

## Task Commits

Each task was committed atomically:

1. **Task 1: Flatten sessionSchema.ts and add currencyCode** - `bceee5a` (feat)
2. **Task 2: Author Wave-0 failing editRoute contract test** - `8b5bbce` (test)

## Files Created/Modified

- `lib/sessionSchema.ts` — Flat SessionPayload + ClaimEntry + SessionClaims with currencyCode; host approval/dispute model removed
- `__tests__/editRoute.test.ts` — Wave-0 behavior contract for POST /api/session/[sessionId]/edit (RED, goes GREEN in Plan 02)

## Decisions Made

- `PublicSessionPayload` kept as a type alias equal to `SessionPayload` (not deleted) so all existing consumers continue to compile without changes — this is the zero-break path described in Pitfall 2 of 08-RESEARCH.md
- No `migrateSession` normalizer added per D-03 (null event — no existing users; stale Redis sessions expire in 24h TTL)
- `currencyCode` field placed after `createdAt` with JSDoc cross-referencing Phase 10 for display threading

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `lib/sessionSchema.ts` is the surgical guide: TypeScript will now cascade errors to every broken callsite across routes, components, and tests
- Plan 02 (edit route) can proceed — Wave-0 test will go GREEN once the route is implemented
- Plan 03 (route surgery) is unlocked: TypeScript cascade from this schema change will enumerate all callsites to fix

## Threat Flags

No new security-relevant surface introduced. The removal of `hostToken` from `SessionPayload` shrinks the attack surface (T-08-01: accepted). The `currencyCode` field is a plain string declared here; its validation (`/^[A-Z]{3}$/`) will be enforced in Plan 03's POST /api/session handler (T-08-02: mitigated in Plan 03).

---

## Self-Check: PASSED

- `lib/sessionSchema.ts` exists and contains `currencyCode: string`: FOUND (line 25)
- Host symbols absent from non-comment lines: CONFIRMED
- `export type PublicSessionPayload = SessionPayload` present: FOUND (line 33)
- `__tests__/editRoute.test.ts` exists: FOUND
- `npx vitest run __tests__/editRoute.test.ts` exits non-zero (RED): CONFIRMED
- No new packages added (`git diff --stat package.json` empty): CONFIRMED
- Commit `bceee5a` exists: VERIFIED
- Commit `8b5bbce` exists: VERIFIED

---
*Phase: 08-flat-model-schema-api-surgery*
*Completed: 2026-06-05*
