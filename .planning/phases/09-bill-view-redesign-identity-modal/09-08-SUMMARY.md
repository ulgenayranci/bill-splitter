---
phase: 09
plan: 08
subsystem: identity-modal / claim-routes
tags: [gap-closure, GAP-09-NOLOCK, no-lock, collaborative, identity]
dependency_graph:
  requires: []
  provides: [no-lock-identity-picker, membership-based-restore, no-lock-claim-server]
  affects: [PersonSlotPicker, CollaborativeClaimingView, claim-route, edit-route, done-route, tip-route]
tech_stack:
  added: []
  patterns: [membership-based-restore, no-exclusive-slot-lock]
key_files:
  modified:
    - components/split/PersonSlotPicker.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
    - app/api/session/[sessionId]/claim/route.ts
    - app/api/session/[sessionId]/edit/route.ts
    - app/api/session/[sessionId]/done/route.ts
    - app/api/session/[sessionId]/tip/route.ts
    - __tests__/PersonSlotPicker.test.tsx
    - __tests__/CollaborativeClaimingView.test.tsx
    - __tests__/sessionClaimRoute.test.ts
    - .planning/REQUIREMENTS.md
decisions:
  - "personSlots kept in schema as a harmless presence marker (written-but-never-gated); exclusive lock semantics removed from all 6 call sites"
  - "Identity restore keyed on session.people.some membership, not personSlots[stored]===true"
metrics:
  duration: ~20 minutes
  completed: 2026-06-08
  tasks_completed: 2
  files_modified: 10
---

# Phase 09 Plan 08: GAP-09-NOLOCK — Remove Name-Locking Summary

**One-liner:** Removed exclusive personSlot locking from all 6 call sites (UI picker, identity restore, claim route, edit add_person, done route, tip route) so every name is always selectable and concurrent same-name co-editing works with no server rejection.

## What Was Built

### Task 1: UI name-locking removed + tests inverted

**PersonSlotPicker.tsx:**
- Removed `const slots = session.claims?.personSlots ?? {}` and `const taken = slots[person.id] === true`
- Every card unconditionally renders `role="button"`, `aria-label={\`Claim slot ${person.name}\`}`, `onClick={() => onSelect(person.id)}`
- Removed `opacity-50 cursor-not-allowed`, `aria-disabled`, and `(taken)` span
- "I'm not listed" add form preserved verbatim

**CollaborativeClaimingView.tsx:**
- Restore effect gate changed from `session.claims?.personSlots?.[stored] === true` to `session.people.some((p) => p.id === stored)` (membership-based, GAP-09-NOLOCK)
- `handleSelect` defensive `else { await mutate() }` branch: comment updated to reflect no-lock model ("defensive fallback — slot route always returns ok:true under the no-lock model")

**Tests inverted:**
- PersonSlotPicker Test 2: now asserts NO `(taken)` text and NO `opacity-50`/`aria-disabled` on Bob's card
- PersonSlotPicker Test 4: now asserts tapping Bob (formerly taken) DOES call `onSelect('p2')`
- CollaborativeClaimingView Test 19: fixture changed from `personSlots: { p2: true }` to `personSlots: {}` to self-document that membership (not slot marker) drives restore; test still passes
- CollaborativeClaimingView Test 20: rewritten as restore-by-existence success (p2 in people, personSlots:{} → modal NOT shown)
- CollaborativeClaimingView Test 20b: new `it()` block for true-miss (p999 not in people → modal IS shown)

### Task 2: Server-side guards removed + tests updated

**personSlots decision actually applied:**
`personSlots` is KEPT in the schema and still WRITTEN as a harmless presence marker (`SLOT_CLAIM_SCRIPT` still sets `personSlots[personId] = true`; `ADD_PERSON_SCRIPT` keeps the `personSlots = {}` table-init). The single rule applied everywhere: **stop treating `personSlots[id]===true` as an EXCLUSIVE lock.** No code path anywhere gates on it.

**Guards/lines removed:**

| File | What removed |
|------|-------------|
| `claim/route.ts` QTY_CLAIM_SCRIPT | CR-02 `if not (...personSlots[personId] == true) then return 'forbidden' end` block (~lines 22-30 before edit) |
| `claim/route.ts` SHARE_CLAIM_SCRIPT | Same CR-02 forbidden guard block (~lines 94-99 before edit) |
| `claim/route.ts` SLOT_CLAIM_SCRIPT | `if session.claims.personSlots[personId] == true then return 'slot_taken' end` (~lines 137-139 before edit) |
| `claim/route.ts` HTTP handlers | share `if (result === 'forbidden') → 403` and qty `if (result === 'forbidden') → 403` and slot `if (result === 'slot_taken') → {ok:false}` branches |
| `edit/route.ts` ADD_PERSON_SCRIPT | `session.claims.personSlots[newPersonId] = true` line 41; person creation and personSlots table-init preserved |
| `done/route.ts` | `if (!session.claims?.personSlots?.[personId]) return 403 'Forbidden: slot not claimed'` block |
| `tip/route.ts` | Same `Forbidden: slot not claimed` guard |

**Tests updated:**

- `sessionClaimRoute.test.ts` CR-02 block (4 tests → 3 tests):
  - "QTY_CLAIM_SCRIPT enforces slot-ownership guard" → inverted to assert script does NOT contain `return 'forbidden'`
  - "SHARE_CLAIM_SCRIPT enforces slot-ownership guard" → inverted to assert no `return 'forbidden'`
  - "qty action maps forbidden → 403" → REMOVED (route no longer emits that branch)
  - "share action maps forbidden → 403" → REMOVED
  - "slot action is NOT guarded" → updated to assert no `return 'slot_taken'` AND no `return 'forbidden'`, slot returns `ok:true`

- `editRoute.test.ts` Test 11/14: No assertion checked the personSlots lock set — no change needed to test assertions; only the Lua script behavior changed.

- `sessionDoneRoute.test.ts` / `tipRoute.test.ts`: No changes needed (no test asserted the 403 personSlots path). Stale fixture fields (`hostToken`, `hostPersonId`, `editRequests`, `disputes`, `personSlots: { p1: true }`) were pre-existing and did not introduce new typecheck failures — these test files use untyped object literals and compile cleanly.

**REQUIREMENTS.md:** Appended `_(override 2026-06-08, GAP-09-NOLOCK)_` note to IDENT-02 entry retiring the "greyed-out taken names" / D-01 interpretation.

## Deviations from Plan

None — plan executed exactly as written.

## Pre-existing Typecheck Situation

`npx tsc --noEmit` was clean before and after both tasks. The stale fields in `__tests__/sessionDoneRoute.test.ts` and `__tests__/tipRoute.test.ts` (hostToken, hostPersonId, editRequests, disputes, personSlots: {p1:true}) do not surface a typecheck error because the test fixtures are typed as plain object literals without an explicit `SessionPayload` annotation — they compile as-is. No fix applied; documented as out-of-scope.

## Test Results

**Full `npx vitest run` after both tasks:**
- 326 total tests (28 test files)
- 323 passed
- 3 failed — the documented pre-existing baseline: AddItemsStep ("tapping Continue... calls setStep(3)") + AddPeopleStep ("disables CTA when no people added", "enables CTA after adding a person")
- No new failures introduced by this plan

**Targeted test runs:**
- Task 1: `npx vitest run __tests__/PersonSlotPicker.test.tsx __tests__/CollaborativeClaimingView.test.tsx` → 41/41 pass
- Task 2: `npx vitest run __tests__/sessionClaimRoute.test.ts __tests__/editRoute.test.ts __tests__/sessionDoneRoute.test.ts __tests__/tipRoute.test.ts` → 42/42 pass

**TypeScript:** `npx tsc --noEmit` clean after both tasks.

## Known Stubs

None — no stubs introduced.

## Threat Flags

None — this plan only removes guards (accepted by threat model T-09-NOLOCK-01 and T-09-NOLOCK-02 per the plan's STRIDE register). No new network endpoints, auth paths, or schema changes at trust boundaries.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| components/split/PersonSlotPicker.tsx | FOUND |
| app/split/[sessionId]/CollaborativeClaimingView.tsx | FOUND |
| app/api/session/[sessionId]/claim/route.ts | FOUND |
| app/api/session/[sessionId]/done/route.ts | FOUND |
| .planning/phases/09-bill-view-redesign-identity-modal/09-08-SUMMARY.md | FOUND |
| commit b7ec953 (Task 2) | FOUND |
| commit 4d53983 (Task 1) | FOUND |
