---
phase: 09-bill-view-redesign-identity-modal
verified: 2026-06-08T13:25:00Z
status: human_needed
score: 19/19 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 13/13
  gaps_closed:
    - "GAP-09-FLOW: SetupStep Continue now creates a session and routes to /split/[sessionId]"
    - "app/page.tsx no longer routes through AssignItemsStep/ResultsStep"
    - "createSession() is single-sourced in lib/createSession.ts, reused by both SetupStep and ShareLinkButton"
    - "Resume redirect (router.replace) added to app/page.tsx keyed on _hasHydrated + sessionId"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "On a real mobile browser, navigate to a session URL with no prior identity stored. Verify the 'Who are you?' modal appears immediately and that tapping outside, pressing Escape, or swiping down does not dismiss it."
    expected: "Modal is visible; all dismiss gestures are blocked; selecting a name closes it and the Bill View appears underneath."
    why_human: "Dialog dismiss-block depends on browser-native dismiss behaviors (Escape, backdrop click, swipe). jsdom tests assert the onOpenChange prop-level block only."
  - test: "Select an identity, close the browser tab, and reopen the session URL. Verify no modal appears."
    expected: "Bill View loads directly with the previously chosen name already active in the people strip."
    why_human: "localStorage persistence requires a real browser; jsdom tests mock the storage behavior."
  - test: "Complete the full create flow: scan bill, add 2+ people, tap 'Start splitting'. Verify the 'Who are you?' modal opens on /split/[sessionId] because the creator has no stored personId for the new session."
    expected: "After tapping 'Start splitting', browser navigates to /split/[sessionId] and the identity modal appears. (This is the GAP-09-FLOW test that was blocked before plan 09-07.)"
    why_human: "End-to-end navigation through SetupStep → /split requires a real browser with Next.js routing; tests mock router.push."
  - test: "Open the same session URL on two devices. On Device A, tap an item to claim it. Within 3 seconds, check Device B."
    expected: "Device A's avatar chip appears on the item card on Device B without a reload."
    why_human: "Requires two live sessions against a real Redis backend. SWR polling is wired and tested with mocks but cross-device behavior cannot be confirmed without real infrastructure."
  - test: "From the 'Who are you?' modal, tap 'I'm not listed', type a name, and tap 'Add me'."
    expected: "The new person appears in the people strip, the modal closes, and the new name is the active identity."
    why_human: "Requires a live /edit add_person endpoint and Redis round-trip; tests mock fetch."
  - test: "While in claiming mode, tap the people strip. Verify the modal reopens with a visible X close button. Select a different name or tap X."
    expected: "Modal shows with close button (allowClose=true mode); both name selection and X dismiss the modal."
    why_human: "Close button visibility is a visual/rendered affordance; test asserts prop value not rendered DOM in the live Dialog primitive."
  - test: "In a session with at least one unclaimed item, tap 'I'm done'. Verify the warning dialog appears with a 'Share bill link' button. Tap 'Continue anyway' and confirm results are reached."
    expected: "Warning Dialog visible; ShareLinkButton functions; 'Continue anyway' advances to results; 'Go back' returns to claiming."
    why_human: "End-to-end phase transition and Dialog rendering require a live session with real SWR data."
---

# Phase 9: Bill View Redesign + Identity Modal Verification Report

**Phase Goal:** The collaborative Bill View is fully flat; any participant can claim and edit; the "Who are you?" identity modal replaces the blocking slot-picker; live attribution shows who claimed each item.
**Verified:** 2026-06-08T13:25:00Z
**Status:** human_needed
**Re-verification:** Yes — after GAP-09-FLOW closure (plan 09-07)

---

## Re-Verification Summary

Previous verification (2026-06-07): **13/13 must-haves verified, status: human_needed**.

GAP-09-FLOW was then discovered during human UAT: the main create flow (app/page.tsx) still routed through the old AssignItemsStep/ResultsStep wizard, so the creator never reached the identity modal or collaborative Bill View in normal single-device use. Tests 1–2 had issues and tests 3–6 were blocked.

Plan 09-07 closed this gap. This re-verification adds 6 new must-haves from the 09-07-PLAN.md frontmatter and confirms all previous 13 still hold.

**Result: 19/19 must-haves verified. All code gaps closed. 7 human-UAT items remain (6 original + 1 new flow test).**

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Two people can each claim a single-quantity item without a 409 qty_exceeded error | VERIFIED | SHARE_CLAIM_SCRIPT Lua in claim/route.ts; sessionClaimRoute tests pass |
| 2 | An equal split of a price across N sharers sums back to the exact price (no lost cents) | VERIFIED | computeEqualShareCents at billMath.ts uses largest-remainder; billMath tests pass |
| 3 | Tapping a shared item again removes that person from the sharers | VERIFIED | SHARE_CLAIM_SCRIPT: joining=='false' sets claims[itemId][personId]=nil; handleToggle wired |
| 4 | Calling /edit with op:add_person creates a new person and returns their generated personId | VERIFIED | ADD_PERSON_SCRIPT; nanoid() server-side; response {ok:true, personId}; editRoute tests pass |
| 5 | The new person's identity slot is locked atomically so no other device can pick it | VERIFIED | ADD_PERSON_SCRIPT sets personSlots[newPersonId]=true in same Lua eval |
| 6 | Adding a person beyond the session cap (20) is rejected | VERIFIED | Lua gates #session.people >= 20 → 'session_full' → 409; test 15 confirms |
| 7 | A 'Who are you?' dialog presents the session's people as selectable name cards | VERIFIED | IdentityModal.tsx DialogTitle "Who are you?" at line 60; IdentityModal tests 5/5 pass |
| 8 | Taken names are visibly greyed out and cannot be selected (D-01) | VERIFIED | PersonSlotPicker.tsx:47 opacity-50 cursor-not-allowed; PersonSlotPicker tests 9/9 pass |
| 9 | An 'I'm not listed' link reveals an inline name input and 'Add me' button inside the modal | VERIFIED | PersonSlotPicker.tsx onAddPerson prop; "I'm not listed" link + Input + "Add me" button present |
| 10 | The modal cannot be dismissed without a selection on first load, but CAN be dismissed when changing identity | VERIFIED | IdentityModal.tsx:50-51 if (!nextOpen && !allowClose) return; showCloseButton={allowClose} |
| 11 | The Bill View header shows a bill title with date, the people strip, and receipt + share icons | VERIFIED | BillViewHeader.tsx; title + formatBillDate; onStripTap; aria-label "Share bill link"; 9/9 tests |
| 12 | A banner shows the live count of unclaimed items and is hidden when everything is claimed | VERIFIED | UnclaimedBanner.tsx:20 returns null when unclaimed===0; 6/6 tests pass |
| 13 | On load with no stored identity, the Who-are-you modal shows; with a valid stored identity it is skipped | VERIFIED | CollaborativeClaimingView.tsx:112-127 localStorage restore + personSlots check; setIdentityModalOpen(true) on miss; tests pass |
| 14 | Tapping 'Continue'/'Start splitting' on the Setup screen (with scanned bill AND ≥2 people) creates a session and navigates the creator to /split/[sessionId] — NOT to the old AssignItemsStep wizard | VERIFIED | SetupStep.tsx:67-87 handleContinue calls createSession() then router.push(`/split/${sessionId}`); no setStep(3) anywhere; test "Continue calls createSession and router.push to /split/[sessionId]" passes |
| 15 | The main flow (app/page.tsx) never renders AssignItemsStep or ResultsStep | VERIFIED | app/page.tsx: grep for AssignItemsStep\|ResultsStep returns 0; only `<SetupStep />` rendered (gated on hasHydrated && !sessionId) |
| 16 | Re-opening / after a session was created routes the user to their existing /split/[sessionId] instead of stranding them on Setup | VERIFIED | app/page.tsx:22-26 useEffect keyed on [hasHydrated, sessionId, router]; router.replace(`/split/${sessionId}`) when hasHydrated && sessionId |
| 17 | The ≥2-people + scanned-bill Continue gate (D-11) is preserved | VERIFIED | SetupStep.tsx:58 canContinue = billScanned && people.length >= 2; disabled={!canContinue \|\| isCreating}; D-11 gate tests pass (disabled when 0 items, disabled when 1 person) |
| 18 | Session-create POST logic is defined once and reused by both SetupStep and ShareLinkButton — not duplicated | VERIFIED | lib/createSession.ts exports createSession(); SetupStep.tsx imports and calls createSession(); ShareLinkButton.tsx imports and calls createSession(); grep for inline fetch('/api/session') in both components returns 0 |
| 19 | The identity modal / collaborative Bill View internals (CollaborativeClaimingView, IdentityModal) were NOT modified by plan 09-07 and still open the modal when no personId is stored | VERIFIED | CollaborativeClaimingView.tsx not in 09-07 files_modified list; modal-open logic at lines 112-127 unchanged; 31/31 CollaborativeClaimingView tests pass |

**Score:** 19/19 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/createSession.ts` | Shared POST /api/session helper returning {sessionId, guestUrl} | VERIFIED | 37 lines; exports createSession; POSTs {people,items,currencyCode} (no assignments); throws on !res.ok; returns {sessionId, guestUrl} |
| `components/wizard/SetupStep.tsx` | Continue handler calls createSession(), setSessionId(), router.push(`/split/${sessionId}`) | VERIFIED | handleContinue at line 67; createSession import at line 10; router.push at line 80; setSessionId at line 79 |
| `components/wizard/ShareLinkButton.tsx` | handleShare refactored to use shared createSession() | VERIFIED | createSession import at line 16; called at line 49; no inline fetch('/api/session') |
| `app/page.tsx` | AssignItemsStep/ResultsStep removed; SetupStep only; sessionId resume redirect | VERIFIED | 35 lines total; only SetupStep rendered; router.replace at line 24; effect keyed on [hasHydrated, sessionId, router] |
| `__tests__/SetupStep.test.tsx` | Tests asserting Continue → createSession → router.push, D-11 gate, error path | VERIFIED | 3 new tests in "Continue creates session and navigates" describe block; mocks next/navigation and @/lib/createSession; all pass |
| `lib/billMath.ts` | computeEqualShareCents largest-remainder helper | VERIFIED | Existing; unchanged by plan 09-07 |
| `app/api/session/[sessionId]/claim/route.ts` | SHARE_CLAIM_SCRIPT + share action | VERIFIED | Existing; unchanged by plan 09-07 |
| `app/api/session/[sessionId]/edit/route.ts` | ADD_PERSON_SCRIPT + add_person op | VERIFIED | Existing; unchanged by plan 09-07 |
| `components/split/IdentityModal.tsx` | Dialog wrapper with "Who are you?" and dismiss-block | VERIFIED | Existing; unchanged by plan 09-07 |
| `components/split/CollaborativeClaimingView.tsx` | Identity modal orchestration, header+banner, flattened phase machine | VERIFIED | Not in 09-07 modified files; 31/31 tests still pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| components/wizard/SetupStep.tsx | lib/createSession.ts | import createSession + call in handleContinue | VERIFIED | Line 10: import; line 75: createSession({people, items, currencyCode}, signal) |
| components/wizard/SetupStep.tsx | /split/[sessionId] | router.push after session create | VERIFIED | Line 80: router.push(`/split/${sessionId}`) |
| components/wizard/ShareLinkButton.tsx | lib/createSession.ts | import createSession + call in handleShare | VERIFIED | Line 16: import; line 49: createSession({people, items, currencyCode}, signal) |
| app/page.tsx | /split/[sessionId] | router.replace in useEffect when hasHydrated && sessionId | VERIFIED | Lines 22-26: effect; line 24: router.replace(`/split/${sessionId}`) |
| app/page.tsx | SetupStep | conditional render | VERIFIED | Line 32: {hasHydrated && !sessionId && <SetupStep />} |
| claim/route.ts | redis.eval | SHARE_CLAIM_SCRIPT for action==='share' | VERIFIED | Unchanged; 19 tests pass |
| edit/route.ts add_person | redis.eval(ADD_PERSON_SCRIPT) | atomic person+slot create | VERIFIED | Unchanged; 16 tests pass |
| IdentityModal.tsx | PersonSlotPicker.tsx | renders PersonSlotPicker as modal content | VERIFIED | Unchanged |
| CollaborativeClaimingView handleAddPerson | /api/session/[sessionId]/edit op:add_person | fetch then setSelectedPersonId + localStorage | VERIFIED | Unchanged; tests pass |
| CollaborativeClaimingView handleShareChange | /api/session/[sessionId]/claim action:share | optimistic mutate + rollback | VERIFIED | Unchanged; tests pass |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| CollaborativeClaimingView.tsx | session | useSWR polling /api/session/[sessionId] at 3s interval | Yes — fetches from Redis backend | FLOWING |
| ClaimableItemCard.tsx | claimsForItem | session.claims?.items?.[item.id] prop from SWR session | Yes — from polled session | FLOWING |
| UnclaimedBanner.tsx | session.claims entries | session prop from SWR | Yes — from polled session | FLOWING |
| BillViewHeader.tsx | session.people, myPersonId | session + selectedPersonId state from orchestrator | Yes — from polled session | FLOWING |
| SetupStep.tsx handleContinue | people, items, currencyCode | useBillStore.getState() at call-site (plan 09-07 pattern) | Yes — reads actual Zustand store state | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SetupStep Continue creates session + navigates to /split | npx vitest run __tests__/SetupStep.test.tsx | 16 passed | PASS |
| ShareLinkButton uses shared createSession helper | npx vitest run __tests__/ShareLinkButton.test.tsx | 0 failures (all tests pass) | PASS |
| D-11 gate: Continue disabled when billScanned=false or people<2 | SetupStep.test.tsx D-11 gate tests | 2 tests pass | PASS |
| Failed createSession shows inline error, no navigation | SetupStep.test.tsx error path test | 1 test passes | PASS |
| computeEqualShareCents sum-conservation | npx vitest run __tests__/billMath.test.ts | 27 tests passed | PASS |
| CollaborativeClaimingView orchestration (31 tests) | npx vitest run __tests__/CollaborativeClaimingView.test.tsx | 31 tests passed | PASS |
| Full suite regression check | npx vitest run | 324 passed, 3 failed — exactly the documented pre-existing AddPeopleStep x2, AddItemsStep x1 baseline; no new failures | PASS |
| TypeScript | npx tsc --noEmit | clean (no output) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IDENT-01 | 09-03, 09-06, 09-07 | "Who are you?" modal prompts user to pick name before claiming; reachable from the main create flow | SATISFIED | IdentityModal wired + auto-shows when no identity stored; main flow now routes through /split via 09-07 |
| IDENT-02 | 09-06 | Identity prompt skipped when device has a valid stored identity | SATISFIED | localStorage restore with personSlots check in CollaborativeClaimingView; stale-slot re-prompt test passes |
| IDENT-03 | 09-02, 09-03, 09-04, 09-06 | User can pick "I'm not listed" to add themselves; can change identity later | SATISFIED | add_person op on edit route; "I'm not listed" form in PersonSlotPicker; onStripTap reopens modal |
| IDENT-04 | 09-06 | Chosen identity persists on device so page reload doesn't re-prompt | SATISFIED | localStorage persist effect in CollaborativeClaimingView; human verification needed for browser confirmation |
| CLAIM-02 | 09-01, 09-05, 09-06 | Multiple people can share one item; proportional cost split | SATISFIED | SHARE_CLAIM_SCRIPT tap-to-join/leave; computeEqualShareCents for "your share" display |
| CLAIM-04 | 09-05, 09-06 | Live attribution shows who claimed each item, near-real-time | SATISFIED | Attribution chips in ClaimableItemCard from SWR session; refreshInterval:3000 active; human verification needed for cross-device test |
| CLAIM-05 | 09-04, 09-06 | Unclaimed items surfaced before results so nothing is missed | SATISFIED | UnclaimedBanner mounted; warn-but-allow dialog on handleDone with unclaimed items |
| CLAIM-06 | 09-04, 09-06 | User can share join link so others can claim on their own phones | SATISFIED | Share icon in BillViewHeader; share-link CTA in unclaimed warning dialog |

All 8 required requirement IDs (IDENT-01..04, CLAIM-02, CLAIM-04, CLAIM-05, CLAIM-06) are mapped to Phase 9 in REQUIREMENTS.md. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| CollaborativeClaimingView.tsx | 114 | eslint-disable react-hooks/exhaustive-deps on identity-restore effect | Warning | Effect re-fires on every 3s SWR poll while modal is open (WR-06 from code review); behavior is idempotent but fragile |
| ClaimableItemCard.tsx | 39-49 | entry.qty unguarded in reducer/filter | Warning | Null claim entry would crash component (WR-03); no test exercises this path |
| UnclaimedBanner.tsx | 14 | e.qty without null-guard | Warning | Inconsistent with defensive pattern used elsewhere (WR-02) |

No debt markers (TBD/FIXME/XXX) found in Phase 9 files. Plan 09-07 introduced no new anti-patterns.

**New files from plan 09-07:** lib/createSession.ts (37 lines, no stubs, no TODOs), SetupStep.tsx handleContinue (clean implementation), app/page.tsx (35 lines total, no stubs).

---

### Human Verification Required

### 1. First-load identity modal blocking (IDENT-01 / IDENT-02)

**Test:** On a real mobile browser, navigate to a session URL with no prior identity stored. Verify the "Who are you?" modal appears immediately and that tapping outside, pressing Escape, or swiping down does not dismiss it.
**Expected:** Modal is visible; all dismiss gestures are blocked; selecting a name closes it and the Bill View appears underneath.
**Why human:** Dialog dismiss-block depends on browser-native dismiss behaviors (Escape, backdrop click, swipe). jsdom tests assert the onOpenChange prop-level block only.

### 2. Identity persistence across reload (IDENT-04)

**Test:** Select an identity, close the browser tab, and reopen the session URL. Verify no modal appears.
**Expected:** Bill View loads directly with the previously chosen name already active in the people strip.
**Why human:** localStorage persistence requires a real browser; jsdom tests mock the storage behavior.

### 3. Full create-flow reaches the identity modal (GAP-09-FLOW regression check)

**Test:** Complete the full create flow: scan a bill, add 2+ people, tap "Start splitting". Verify the browser navigates to /split/[sessionId] and the "Who are you?" identity modal opens automatically (creator has no stored personId for the new session).
**Expected:** After tapping "Start splitting" the user sees /split/[sessionId] in the URL bar and the identity modal is present. (This tests that GAP-09-FLOW is closed in real browser conditions.)
**Why human:** End-to-end navigation through SetupStep → POST /api/session → router.push → /split requires a real browser with Next.js routing and a live Redis-backed session endpoint; tests mock router.push and createSession.

### 4. Near-real-time live attribution across devices (CLAIM-04)

**Test:** Open the same session URL on two devices. On Device A, tap an item to claim it. Within 3 seconds, check Device B.
**Expected:** Device A's avatar chip appears on the item card on Device B without a reload.
**Why human:** Requires two live sessions against a real Redis backend. SWR polling is wired and tested with mocks but cross-device behavior cannot be confirmed without real infrastructure.

### 5. "I'm not listed" round-trip (IDENT-03)

**Test:** From the "Who are you?" modal, tap "I'm not listed", type a name, and tap "Add me".
**Expected:** The new person appears in the people strip, the modal closes, and the new name is the active identity.
**Why human:** Requires a live /edit add_person endpoint and Redis round-trip; tests mock fetch.

### 6. Change-identity via people strip (IDENT-03)

**Test:** While in claiming mode, tap the people strip. Verify the modal reopens with a visible X close button. Select a different name or tap X.
**Expected:** Modal shows with close button (allowClose=true mode); both name selection and X dismiss the modal.
**Why human:** Close button visibility is a visual/rendered affordance; test asserts prop value not rendered DOM in the live Dialog primitive.

### 7. Warn-but-allow done flow (CLAIM-05 / CLAIM-06 / D-09)

**Test:** In a session with at least one unclaimed item, tap "I'm done". Verify the warning dialog appears with a "Share bill link" button. Tap "Continue anyway" and confirm results are reached.
**Expected:** Warning Dialog visible; ShareLinkButton functions; "Continue anyway" advances to results; "Go back" returns to claiming.
**Why human:** End-to-end phase transition and Dialog rendering require a live session with real SWR data.

---

### Gaps Summary

No gaps found. All 19 must-have truths are verified by code evidence and passing tests.

**GAP-09-FLOW is closed:** lib/createSession.ts exists as a pure shared helper; SetupStep's Continue now calls createSession() and routes to /split/[sessionId] via router.push; app/page.tsx renders only SetupStep and adds a resume-redirect via router.replace; ShareLinkButton uses the shared helper with no duplication; the D-11 gate (billScanned && people.length >= 2) is preserved; CollaborativeClaimingView/IdentityModal internals are unchanged. SetupStep tests prove the new behavior. Full test suite: 324 passed, 3 pre-existing failures (AddPeopleStep x2, AddItemsStep x1) — no regressions. tsc --noEmit clean.

The 7 human verification items above require a live browser and backend to confirm end-to-end user-facing behavior; they do not indicate missing implementations.

---

_Verified: 2026-06-08T13:25:00Z_
_Verifier: Claude (gsd-verifier)_
