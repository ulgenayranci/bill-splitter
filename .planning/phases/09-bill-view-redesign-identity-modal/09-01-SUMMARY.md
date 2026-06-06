---
phase: 09-bill-view-redesign-identity-modal
plan: 01
subsystem: api
tags: [typescript, redis, lua, vitest, bill-math, claims]

# Dependency graph
requires:
  - phase: 08-02
    provides: /edit route + flat session create/get + host-free Lua claim scripts
provides:
  - "computeEqualShareCents largest-remainder helper in lib/billMath.ts"
  - "share claim action with SHARE_CLAIM_SCRIPT (bounds-check-free tap-to-join/leave) on the claim route"
  - "Equal splits conserve cents exactly — sum of shares always equals priceCents"

affects:
  - "Plan 09-05 (ClaimableItemCard) consumes computeEqualShareCents + share action"
  - "Plan 09-06 (CollaborativeClaimingView orchestrator) dispatches share claims"
  - "Phase 10 results math imports computeEqualShareCents"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Largest-remainder cent distribution: caller sorts claimants by personId ascending, earliest indexes get the extra cent"
    - "SHARE_CLAIM_SCRIPT Lua: ARGV [itemId, personId, joining('true'|'false')] — no qty bounds check, multiple holders of qty:1 allowed (D-13)"
    - "ClaimBody discriminated by action: 'qty' | 'slot' | 'share'; 'share' requires boolean joining"

key-files:
  created: []
  modified:
    - lib/billMath.ts
    - __tests__/billMath.test.ts
    - app/api/session/[sessionId]/claim/route.ts
    - __tests__/sessionClaimRoute.test.ts
  deleted: []

key-decisions:
  - "Determinism rule documented in JSDoc rather than enforced in the helper: caller sorts claimants by personId ascending so the same person always absorbs the extra cent"
  - "share is a third action on the existing claim route (not a new route) — same session_not_found → 404 / invalid_session → 500 error mapping as qty and slot"
  - "numSharers <= 0 guard returns 0 instead of throwing — defensive for transient empty-claimant renders"

patterns-established:
  - "Bounds-check-free share semantics: joining=true adds personId at qty:1, joining=false removes it; no 409 qty_exceeded possible for shared items"

requirements-completed: [CLAIM-02]

# Metrics
duration: ~7min
completed: 2026-06-06
---

# Phase 09 Plan 01: Equal-Split Math + Share Claim Action Summary

**computeEqualShareCents largest-remainder helper plus a bounds-check-free `share` Lua action on the claim route — multiple people can now tap-to-join one single-quantity item with exact cent conservation.**

## What Was Built

### Task 1 — computeEqualShareCents (commit fa229c3)
- `computeEqualShareCents(priceCents, numSharers, myIndex)` exported from `lib/billMath.ts`
- Largest-remainder method: every sharer gets `floor(priceCents / numSharers)`; the first `priceCents % numSharers` sharers (by index) get one extra cent
- Guarantee: sum of all shares equals `priceCents` exactly — no lost cents (Pitfall 3)
- Guard: `numSharers <= 0` returns 0
- JSDoc determinism rule: caller sorts claimants by personId ascending before computing indexes
- New `describe('computeEqualShareCents')` block: 2-way, 3-way, sum-conservation, and guard cases; pre-existing `computePersonShareFromClaims` 3-way test (333) remains green

### Task 2 — share action on claim route (commit 0933b00)
- `SHARE_CLAIM_SCRIPT` Lua const: tap-to-join/leave with NO qty bounds check — multiple people may each hold `qty: 1` on a single-qty item (D-13, CLAIM-02), fixing Pitfall 1 (`qty_exceeded` 409 on second claimant)
- `ClaimBody` extended to `action: 'qty' | 'slot' | 'share'` with required `joining?: boolean` for share
- `validateBody`: share requires boolean `joining` + present `itemId`
- POST dispatch branch for `action === 'share'` with `session_not_found` → 404 and `invalid_session` → 500 (same pattern as existing branches)
- 5 new tests: share join, share leave, validation, session not found, invalid session
- No stale host fields (hostToken/assignedBy) in the new Lua — flat schema only

## Verification

- `npx vitest run __tests__/billMath.test.ts __tests__/sessionClaimRoute.test.ts` → 2 files, 46/46 tests pass
- Both must_have artifacts present: `export function computeEqualShareCents` in lib/billMath.ts, `SHARE_CLAIM_SCRIPT` in claim route
- Existing qty and slot action tests remain green

## Deviations

- SUMMARY.md was written by the orchestrator after the executor's Write tool was denied for `.planning/` paths — implementation commits were unaffected.

## Self-Check: PASSED
