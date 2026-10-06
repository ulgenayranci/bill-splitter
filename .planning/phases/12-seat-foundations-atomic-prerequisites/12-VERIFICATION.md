---
phase: 12-seat-foundations-atomic-prerequisites
verified: 2026-10-06T16:10:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run DONE_SCRIPT / TIP_SCRIPT against a real Redis (including Upstash) with concurrent calls and empty-table shapes"
    expected: "Both writes persist; people/items untouched; empty tables encode as expected"
    why_human: "No redis-server available; Lua only string-tested. Deliberately deferred to Phase 13 (REL-03)."
---

# Phase 12 Verification

**Goal:** Existing bill safe to build seats on (empty-named person handled, in-flight bills keep working, done/tip no longer overwrite each other).

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pre-v2.1 bill opens/claims/tips/Results as before | VERIFIED | `lib/normalizeSession.ts` wired in GET route; `__tests__/v2SessionCompat.test.ts` (8 cases, frozen v2.0 fixture) covers GET, labels, totals, done/tip, Results render, legacy shape |
| 2 | Empty-named seats: tax/service split equally, shares sum exactly | VERIFIED | `computeEqualChargeShares` splits by people.length, name-independent, largest-remainder; `__tests__/billMathSeats.test.ts` (n=1..20 sums, name-agnostic, full-bill conservation) |
| 3 | Concurrent done / tip saves do not overwrite each other or people changes | VERIFIED (scope as worded) | `done/route.ts` and `tip/route.ts` use `redis.eval` with `DONE_SCRIPT`/`TIP_SCRIPT` in `lib/sessionLua.ts`: single GET+field write+SET inside one Lua script, args via ARGV only; they no longer GET-spread-SET people. See WR-01 note below. |
| 4 | Bill can never be created with >20 people | VERIFIED | `MAX_PEOPLE = 20` in `lib/sessionSchema.ts`; POST `app/api/session/route.ts` returns 400 before validation/Redis write; `sessionRoute.test.ts` |

**Requirements:** REL-04 (plans 12-02, 12-03) and RESULTS-06 (plans 12-01, 12-03) both declared in PLAN frontmatter and mapped to Phase 12 in REQUIREMENTS.md; both SATISFIED. No orphaned IDs (REL-01, REL-03 are mapped to Phase 13).

## SC3 and review WR-01 judgment
SC3 as worded: two friends pressing "I'm done" or saving a tip at the same moment both keep their change, neither overwriting the other or any person-list change. This is met: done and tip each write only their own field atomically, so two concurrent done/tip writes cannot clobber each other, and neither touches people. WR-01 (the `/edit` item ops still doing whole-session GET/SET and able to roll back a done/tip written in between) is an item-edit-vs-done/tip race, which is outside SC3's wording. It is the territory of Phase 13 REL-01 ("seat actions and existing done/tip cannot overwrite each other") and Phase 13 SC2 (all actions fired simultaneously). Classified as correctly deferred, not a Phase 12 gap. Recommend tracking it explicitly in Phase 13 planning and softening the `lib/sessionLua.ts` header comment, which overclaims that the window is closed.

## Other review findings (non-blocking, WARNING, carry to Phase 13/16)
- WR-02: `/edit` reads raw session; `items: {}` after cjson flip could crash it (needs real-Redis encoding check, REL-03).
- WR-03: duplicate "Guest N" labels in mixed sessions (seats consumed in Phases 15/16; fix before then).
- WR-04: Lua errors on `people: null`; WR-05: locale-dependent `toLocaleUpperCase`.
- IN-01..05 informational.
No TBD/FIXME/XXX debt markers were the subject of review findings.

## Spot checks
- `npx vitest run`: 35 files, 637 tests passed.
- `npx tsc --noEmit`: clean (no output).

## Human / deferred verification
Lua scripts are only string-tested; real-Redis execution is by design in Phase 13 (REL-03). Because executable behavior of the new scripts is unproven here, status is human_needed rather than passed.

## Gaps
None blocking Phase 12.
