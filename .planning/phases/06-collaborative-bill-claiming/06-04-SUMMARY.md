---
phase: "06-collaborative-bill-claiming"
plan: "04"
subsystem: "client-ui/claiming-view"
tags: [swr, optimistic-update, collaborative, client-components, wave-3]
dependency_graph:
  requires:
    - phase: "06-collaborative-bill-claiming" plan: "01"
      provides: "SessionPayload Phase 6 shape, ClaimEntry, Item.quantity"
    - phase: "06-collaborative-bill-claiming" plan: "02"
      provides: "POST /api/session/[id]/claim, POST /api/session/[id]/done (done:boolean contract)"
    - phase: "06-collaborative-bill-claiming" plan: "03"
      provides: "POST /api/session/[id]/tip, editRequest, dispute routes"
  provides:
    - "app/split/[sessionId]/page.tsx: Server Component extracting hostToken from searchParams"
    - "CollaborativeClaimingView: SWR bound mutate + optimisticData for qty claims"
    - "CollaborativeClaimingView: isHost flag derived from URL hostToken vs session.hostToken"
    - "PersonSlotPicker: Phase 6 hygiene comment (D-13 — no host pre-lock)"
    - "ClaimableItemCard: multi-claimant avatar stack + qty stepper + host-assigned label"
  affects:
    - "Plan 05: HostPanel composes on isHost + same swrKey + mutate pattern"
    - "Plan 06: Post-done flow replaces done-placeholder div with real Review/Tip/Results UI"
tech_stack:
  added: []
  patterns:
    - "SWR bound mutate with optimisticData + rollbackOnError for optimistic qty claims"
    - "isHost derived from URL param vs session value (client-side UI gate only)"
    - "Server Component async searchParams extraction (Next.js 15 Promise<SearchParams>)"
    - "Multi-claimant avatar stack with MAX_VISIBLE_AVATARS=3 overflow pattern"
    - "Quantity stepper: card is NOT role=button in multi-qty mode — only stepper buttons are interactive"
key_files:
  created:
    - "app/split/[sessionId]/CollaborativeClaimingView.tsx"
    - "__tests__/CollaborativeClaimingView.test.tsx"
  modified:
    - "app/split/[sessionId]/page.tsx"
    - "components/split/PersonSlotPicker.tsx"
    - "components/split/ClaimableItemCard.tsx"
    - "__tests__/PersonSlotPicker.test.tsx"
    - "__tests__/ClaimableItemCard.test.tsx"
  deleted:
    - "app/split/[sessionId]/GuestClaimingView.tsx"
    - "__tests__/GuestClaimingView.test.tsx"
decisions:
  - "done route uses done:boolean not undone:true — server contract established in Plan 02 Wave 0 tests is ground truth; handleDone sends done:true, handleBackFromDone sends done:false"
  - "Test 7 and 8 in CollaborativeClaimingView adapted to match done:boolean contract (not plan's undone:true)"
  - "mutateMock.mockImplementation for Test 8 — needed to propagate rejection from the async mutate callback; mockResolvedValue swallows callback errors"
  - "done-placeholder is intentional — Plan 06 replaces with real Review/Tip/Results flow per plan objective"
  - "Card role=button removed in multi-qty mode — prevents ambiguous whole-card tap; only stepper buttons are interactive"
  - "Avatar overflow cutoff at 3 (MAX_VISIBLE_AVATARS=3) — UI-SPEC specifies 'up to 3 + overflow'; value matches"
metrics:
  duration: "303 seconds (~5 minutes)"
  completed_date: "2026-05-27"
  tasks: 2
  files: 9
---

# Phase 6 Plan 04: Client Core — CollaborativeClaimingView + ClaimableItemCard Summary

Rewrote the share/split client core for Phase 6: Server Component page extracts hostToken from searchParams, CollaborativeClaimingView uses SWR bound mutate + optimisticData, ClaimableItemCard gains multi-claimant avatar stack and quantity stepper, PersonSlotPicker gets Phase 6 D-13 hygiene comment. GuestClaimingView deleted.

## What Was Built

### Task 1 — page.tsx + CollaborativeClaimingView (new) + GuestClaimingView (deleted)

**`app/split/[sessionId]/page.tsx` (rewrite)**
Server Component. Reads `hostToken` from `searchParams` (Promise-based in Next.js 15) and passes it as `hostTokenParam` prop to `CollaborativeClaimingView`. Single responsibility: route params → client boundary.

**`app/split/[sessionId]/CollaborativeClaimingView.tsx` (new)**
Phase 6 claiming view, replacing GuestClaimingView entirely:
- `useSWR` with 3s polling, bound `mutate` (not global `mutate`)
- `handleQtyChange`: SWR optimisticData pattern — builds full SessionPayload snapshot, calls `mutate(asyncFn, { optimisticData, rollbackOnError: true, revalidate: true })`
- `isHost = useMemo(...)`: derives from `hostTokenParam !== null && session.hostToken === hostTokenParam`. Client-side UI gate only; server routes re-validate on every request (T-06-04-01).
- `handleDone`: POSTs `{ personId, done: true }` to `/api/session/[id]/done`, transitions to `done-placeholder` phase
- `handleBackFromDone`: POSTs `{ personId, done: false }`, returns to claiming (D-08 soft checkpoint)
- Slot picker phase: renders PersonSlotPicker until identity selected
- Done-placeholder: intentional stub — Plan 06 replaces with Review/Tip/Results flow
- `data-testid="host-badge"` amber pill in header when isHost is true

**`app/split/[sessionId]/GuestClaimingView.tsx` (deleted)**
Replaced entirely. Phase 4 `optimisticClaims` local state map retired.

**`__tests__/GuestClaimingView.test.tsx` (deleted)**

**`__tests__/CollaborativeClaimingView.test.tsx` (new, 8 tests)**
- Tests 1-3: host badge visibility (match / null / wrong token)
- Test 4: slot claim body includes hostToken
- Test 5: mutate called with optimisticData + rollbackOnError
- Test 6: done button POSTs done:true, transitions to placeholder
- Test 7: back button POSTs done:false
- Test 8: fetch rejection → "Couldn't save — tap to retry" inline error

### Task 2 — PersonSlotPicker + ClaimableItemCard

**`components/split/PersonSlotPicker.tsx` (hygiene comment added)**
Added Phase 6 D-13 comment block at top: "Identity-only picker. Host is NOT pre-locked — host identity derives from URL hostToken match in CollaborativeClaimingView, not from being the first person in session.people."

No structural changes needed — the existing component was already correct for D-13; it was Phase 4's HostWaitingScreen that pre-populated personSlots, creating the host-lock illusion.

**`components/split/ClaimableItemCard.tsx` (full rewrite)**
Props changed: `claimedBy: PersonId | undefined` + `onTap: () => void` → `claimsForItem: Record<PersonId, ClaimEntry>` + `onQtyChange: (newQty: number) => void`

New behaviors:
- Single-qty items (`quantity === 1`): toggle semantics preserved (tap→1, tap again→0)
- Multi-qty items (`quantity > 1`): inline [-] N [+] stepper; card is NOT role=button (prevents accidental whole-card tap)
- Multi-claimant avatar stack: shows up to `MAX_VISIBLE_AVATARS=3` other claimants as 16px colored dots, then "+N" overflow count
- Host-assigned: when `claimsForItem[myPersonId].assignedBy === 'host'`, shows "Assigned by host" label + `border-amber-200` border
- `hasError` prop: inline "Couldn't save — tap to retry" text (red-600)
- `bg-amber-50` tint when `myQty > 0`

**`__tests__/PersonSlotPicker.test.tsx` (updated + Test 5 added)**
Fixture updated to Phase 6 shape: `hostToken: 'host-token-abc'`, `quantity: 1`, `tips: {}`, `editRequests: {}`, `disputes: {}`, removed `tipPercent`. Test 5 (D-13) asserts first person in `session.people` is NOT pre-locked.

**`__tests__/ClaimableItemCard.test.tsx` (full rewrite, 9 tests)**
- Tests 1-2: single-qty claim/unclaim
- Test 3: other-claimant avatar stack aria-label
- Tests 4-6: multi-qty stepper (shows stepper, +1 increment, max disabled)
- Test 7: "X of N claimed" aggregate label
- Test 8: host-assigned label + amber-200 border
- Test 9: 4+ other claimants → 3 visible + "+1" overflow

## Test Counts

| File | Tests | Status |
|------|-------|--------|
| `__tests__/CollaborativeClaimingView.test.tsx` | 8 | All pass |
| `__tests__/PersonSlotPicker.test.tsx` | 5 (4 existing + 1 new) | All pass |
| `__tests__/ClaimableItemCard.test.tsx` | 9 | All pass |
| All 9 server route tests (Plans 02-03) | 53 | No regressions |
| **Total** | **75** | **All pass** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Specification conflict] done route uses `done: boolean` not `undone: true`**
- **Found during:** Task 1 implementation review
- **Issue:** Plan action section specified `undone: true` in `handleBackFromDone` body. But the done route (Plan 02) requires `done: boolean` as mandatory field — `undone: true` would cause a 400 error (missing `done` field). Plan 02 Summary explicitly documents this as "done route uses `done: boolean` field, not `undone: boolean`" with wave-0 tests as ground truth.
- **Fix:** `handleDone` sends `{ personId, done: true }`. `handleBackFromDone` sends `{ personId, done: false }`. Test 7 adapted to assert `parsed.done === false` instead of `parsed.undone === true`.
- **Files modified:** `app/split/[sessionId]/CollaborativeClaimingView.tsx`, `__tests__/CollaborativeClaimingView.test.tsx`
- **Commits:** cfa09f9

**2. [Rule 2 - Missing functionality] Test 8 mock updated to propagate async callback rejection**
- **Found during:** Task 1 test run
- **Issue:** `mutateMock.mockResolvedValue(undefined)` swallows the async callback argument — when `mutate(asyncFn, options)` is called, the mock resolves immediately without invoking `asyncFn`. When `errFetch` rejects, the catch block in `handleQtyChange` never fires.
- **Fix:** Test 8 overrides `mutateMock.mockImplementation(async (fn) => { if (typeof fn === 'function') return fn() })` so rejection propagates to the catch block.
- **Files modified:** `__tests__/CollaborativeClaimingView.test.tsx`
- **Commits:** cfa09f9

## Placeholder for Plan 06

The `done-placeholder` div in `CollaborativeClaimingView` (phase `'done-placeholder'`) is an intentional stub:

```tsx
<h1>Done — Review/Tip/Results UI lands in Plan 06</h1>
```

Plan 06 replaces this with the full post-done flow: host-assigned review screen (D-09), per-person tip screen (D-07), and PersonResultsScreen (D-14).

## What Plan 05 Builds On

Plan 05 (HostPanel) adds to `CollaborativeClaimingView`:
1. `isHost` prop already derived — conditionally render HostPanel below the item list
2. Same `mutate` and `swrKey` — HostPanel mutations (resolve-edit, resolve-dispute) call `mutate()` to refresh
3. Same `session` from SWR — HostPanel reads `session.editRequests`, `session.disputes`, `session.claims.items` for unclaimed unit detection

## Known Stubs

**`done-placeholder` in `CollaborativeClaimingView`** — intentional per plan objective:
- File: `app/split/[sessionId]/CollaborativeClaimingView.tsx`
- Condition: `phase === 'done-placeholder'`
- Reason: Plan 06 deliverable — Review/Tip/Results flow not yet implemented
- Future plan: Plan 06

## Threat Flags

None — the `isHost` flag is client-side UI only. T-06-04-01 (hostToken spoofing) is mitigated: server routes re-validate `hostToken` on every request. No new network endpoints beyond what was in the plan's threat model.

## Self-Check: PASSED
