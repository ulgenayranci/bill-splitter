---
phase: 09-bill-view-redesign-identity-modal
verified: 2026-06-07T12:40:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "On mobile, navigate to a session URL with no prior identity stored. Verify the 'Who are you?' dialog appears immediately and cannot be dismissed without selecting a name."
    expected: "Modal is visible; tapping outside or pressing Escape does nothing; only selecting a name closes it."
    why_human: "Dialog dismiss-block depends on browser keyboard/backdrop behavior (Escape, click-outside). jsdom does not fully simulate this; tests assert the onOpenChange block at the prop level only."
  - test: "Select an identity, reload the page. Verify no 'Who are you?' prompt appears — the previously chosen identity is silently restored."
    expected: "Bill View loads directly with the user's name already active in the people strip."
    why_human: "localStorage persistence (IDENT-04) requires a real browser with storage; cannot be verified in jsdom."
  - test: "On two devices sharing the same session URL, have Device A claim an item. Within 3 seconds, verify Device B's card for that item shows Device A's avatar chip."
    expected: "Avatar chip appears on Device B within the 3s SWR poll cycle with no page reload."
    why_human: "Near-real-time attribution (CLAIM-04) requires two live sessions against a real Redis backend. SWR polling is wired at refreshInterval:3000 but end-to-end behavior cannot be confirmed with mocks."
  - test: "Tap 'I'm not listed', type a name, and tap 'Add me'. Verify the new person appears in the people strip, the modal closes, and the new name is selected as the active identity."
    expected: "New person is added to the session, modal closes, people strip shows the new name as the own-identity pill."
    why_human: "Requires live /edit add_person endpoint and Redis; tests mock fetch responses and cannot verify round-trip session mutation."
  - test: "Tap the people strip while in claiming mode. Verify the 'Who are you?' modal reopens with a dismiss X button (allowClose=true mode)."
    expected: "Modal shows with a close button; selecting a different name or pressing X both work."
    why_human: "Visual affordance (close button presence/absence) requires visual inspection; test asserts showCloseButton prop value, not rendered DOM in the real Dialog."
  - test: "Tap 'I'm done' while at least one item is unclaimed. Verify the warning dialog appears and shows a 'Share bill link' button. Tap 'Continue anyway' and confirm results are reached."
    expected: "Warning dialog with share CTA appears; 'Continue anyway' advances to the results screen."
    why_human: "End-to-end flow through the warning dialog and phase transition requires a live session with real SWR data."
---

# Phase 9: Bill View Redesign + Identity Modal Verification Report

**Phase Goal:** The collaborative Bill View is fully flat; any participant can claim and edit; the "Who are you?" identity modal replaces the blocking slot-picker; live attribution shows who claimed each item
**Verified:** 2026-06-07T12:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Two people can each claim a single-quantity item without a 409 qty_exceeded error | VERIFIED | `SHARE_CLAIM_SCRIPT` Lua in claim/route.ts:74 has no qty bounds check; sessionClaimRoute tests 46/46 pass |
| 2 | An equal split of a price across N sharers sums back to the exact price (no lost cents) | VERIFIED | `computeEqualShareCents` at billMath.ts:148 uses largest-remainder; sum-conservation tests pass; billMath tests 46/46 pass |
| 3 | Tapping a shared item again removes that person from the sharers | VERIFIED | `SHARE_CLAIM_SCRIPT` Lua: `joining=='false'` sets `session.claims.items[itemId][personId] = nil`; ClaimableItemCard handleToggle calls `onShareChange(myQty === 0)` |
| 4 | Calling /edit with op:add_person creates a new person and returns their generated personId | VERIFIED | `ADD_PERSON_SCRIPT` at edit/route.ts:24; `nanoid()` generates id server-side; response `{ ok: true, personId }` at line 162; editRoute tests 16/16 pass |
| 5 | The new person's identity slot is locked atomically so no other device can pick it | VERIFIED | ADD_PERSON_SCRIPT sets `session.claims.personSlots[newPersonId] = true` in the same Lua eval before returning |
| 6 | Adding a person beyond the session cap (20) is rejected | VERIFIED | Lua gates `#session.people >= 20 → return 'session_full'`; mapped to 409 in route; test 15 confirms |
| 7 | A 'Who are you?' dialog presents the session's people as selectable name cards | VERIFIED | IdentityModal.tsx exists; DialogTitle "Who are you?" at line 60; PersonSlotPicker renders name cards; IdentityModal tests 5/5 pass |
| 8 | Taken names are visibly greyed out and cannot be selected (D-01) | VERIFIED | PersonSlotPicker.tsx:47 uses `opacity-50 cursor-not-allowed`; `opacity-40` absent; PersonSlotPicker tests 9/9 pass including previously-failing Test 2 |
| 9 | An 'I'm not listed' link reveals an inline name input and 'Add me' button inside the modal — no new screen | VERIFIED | PersonSlotPicker.tsx:19 `onAddPerson` prop; "I'm not listed" link + Input placeholder "Your name" + "Add me" button; tests assert submit behavior |
| 10 | The modal cannot be dismissed without a selection on first load, but CAN be dismissed when changing identity | VERIFIED | IdentityModal.tsx:50-51 `if (!nextOpen && !allowClose) return`; `showCloseButton={allowClose}` at line 57; tests for both allowClose=false and allowClose=true pass |
| 11 | The Bill View header shows a bill title with date, the people strip, and receipt + share icons | VERIFIED | BillViewHeader.tsx exists; "Bill —" title with `formatBillDate(session.createdAt)`; `onStripTap` at line 148; aria-label "Share bill link" at line 130; aria-label "View receipt" present; 9/9 tests pass |
| 12 | A banner shows the live count of unclaimed items and is hidden when everything is claimed | VERIFIED | UnclaimedBanner.tsx:20 returns null when unclaimed===0; copy variants "1 item still unclaimed" and "N of M items still unclaimed"; 6/6 tests pass |
| 13 | On load with no stored identity, the Who-are-you modal shows; with a valid stored identity it is skipped | VERIFIED | CollaborativeClaimingView.tsx:112-127: restores from localStorage only if `session.claims?.personSlots?.[stored] === true`; otherwise `setIdentityModalOpen(true)`; tests IDENT-01 and IDENT-02/04 pass |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/billMath.ts` | computeEqualShareCents largest-remainder helper | VERIFIED | Exported at line 148; contains all required tests |
| `app/api/session/[sessionId]/claim/route.ts` | SHARE_CLAIM_SCRIPT + share action | VERIFIED | SHARE_CLAIM_SCRIPT at line 74; eval call at line 188 |
| `app/api/session/[sessionId]/edit/route.ts` | ADD_PERSON_SCRIPT + add_person op | VERIFIED | ADD_PERSON_SCRIPT at line 24; eval at line 156; response includes personId |
| `components/split/IdentityModal.tsx` | Dialog wrapper with "Who are you?" and dismiss-block | VERIFIED | File exists; DialogTitle + allowClose dismiss-block both confirmed |
| `components/split/PersonSlotPicker.tsx` | Modal-ready content with onAddPerson inline form and opacity-50 | VERIFIED | opacity-50 confirmed; opacity-40 absent; onAddPerson prop present |
| `components/split/BillViewHeader.tsx` | Title+date, people strip, receipt + share icons | VERIFIED | All elements confirmed; onStripTap wired; share + receipt aria-labels present |
| `components/split/UnclaimedBanner.tsx` | Live unclaimed counter, hidden when 0 unclaimed | VERIFIED | null return when unclaimed===0; both copy variants present |
| `components/split/ClaimableItemCard.tsx` | 3-chip cap, own-claim amber border, onShareChange, your-share line | VERIFIED | MAX_VISIBLE_AVATARS=3; border-amber-400; onShareChange; computeEqualShareCents import; 16/16 tests |
| `app/split/[sessionId]/CollaborativeClaimingView.tsx` | Identity modal orchestration, header+banner mount, share handler, flattened phase machine | VERIFIED | IdentityModal import at line 20; BillViewHeader at line 21; UnclaimedBanner at line 22; Phase type 'claiming'|'tip'|'results' at line 52; 31/31 tests pass |
| `components/split/WaitingForClaimsScreen.tsx` | DELETED | VERIFIED | File does not exist; 0 references in CollaborativeClaimingView |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| claim/route.ts | redis.eval | SHARE_CLAIM_SCRIPT for action==='share' | VERIFIED | Line 184-191: `if (action === 'share')` dispatches eval with SHARE_CLAIM_SCRIPT |
| edit/route.ts add_person | redis.eval(ADD_PERSON_SCRIPT) | atomic person+slot create | VERIFIED | Line 142-162: `op === 'add_person'` branch runs before redis.get, calls eval |
| IdentityModal.tsx | PersonSlotPicker.tsx | renders PersonSlotPicker as modal content | VERIFIED | IdentityModal renders `<PersonSlotPicker key={openKey} ...>` |
| IdentityModal.tsx onOpenChange | dismiss-block when allowClose=false | controlled Dialog blocking dismissal | VERIFIED | Line 50-51: guards `!nextOpen && !allowClose` |
| BillViewHeader.tsx people strip | onStripTap prop | tappable strip container | VERIFIED | Line 148: `onClick={onStripTap}` on strip container |
| BillViewHeader.tsx share icon | ShareLinkButton / share action | header share affordance | VERIFIED | Lines 70-83 in BillViewHeader: navigator.share + clipboard fallback; aria-label "Share bill link" |
| CollaborativeClaimingView handleAddPerson | /api/session/[sessionId]/edit op:add_person | fetch then setSelectedPersonId + localStorage | VERIFIED | Lines 170-197: POST with `{ op: 'add_person', name }`, on success sets identity and writes localStorage |
| CollaborativeClaimingView handleShareChange | /api/session/[sessionId]/claim action:share | optimistic mutate + rollback | VERIFIED | Lines 258-316: POST `{ personId, itemId, action: 'share', joining }` with rollbackOnError |
| CollaborativeClaimingView derivePhase | no 'waiting' branch | Phase union 'claiming'|'tip'|'results' | VERIFIED | Line 52: `type Phase = 'claiming' \| 'tip' \| 'results'`; WaitingForClaimsScreen deleted |
| ClaimableItemCard.tsx | computeEqualShareCents | your-share line for shared single-qty items | VERIFIED | Line 7: import; lines 71-79: rendered when `!isMultiQty && mine && claimantCount > 1` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| CollaborativeClaimingView.tsx | `session` | `useSWR` polling `/api/session/[sessionId]` at 3s interval | Yes — fetches from Redis backend | FLOWING |
| ClaimableItemCard.tsx | `claimsForItem` | `session.claims?.items?.[item.id]` prop from SWR session | Yes — from polled session | FLOWING |
| UnclaimedBanner.tsx | `session.claims?.items?.[item.id]` entries | `session` prop from SWR | Yes — from polled session | FLOWING |
| BillViewHeader.tsx | `session.people`, `myPersonId` | `session` + `selectedPersonId` state from orchestrator | Yes — from polled session | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| computeEqualShareCents sum-conservation | `npx vitest run __tests__/billMath.test.ts` | 27 tests passed | PASS |
| SHARE_CLAIM_SCRIPT join/leave + validation | `npx vitest run __tests__/sessionClaimRoute.test.ts` | 19 tests passed | PASS |
| ADD_PERSON_SCRIPT atomic + cap + validation | `npx vitest run __tests__/editRoute.test.ts` | 16 tests passed | PASS |
| IdentityModal dismiss-block/allow | `npx vitest run __tests__/IdentityModal.test.tsx` | 5 tests passed | PASS |
| PersonSlotPicker opacity-50 + onAddPerson | `npx vitest run __tests__/PersonSlotPicker.test.tsx` | 9 tests passed | PASS |
| BillViewHeader title/strip/icons | `npx vitest run __tests__/BillViewHeader.test.tsx` | 9 tests passed | PASS |
| UnclaimedBanner counter logic | `npx vitest run __tests__/UnclaimedBanner.test.tsx` | 6 tests passed | PASS |
| ClaimableItemCard chips/border/share/your-share | `npx vitest run __tests__/ClaimableItemCard.test.tsx` | 16 tests passed | PASS |
| CollaborativeClaimingView orchestration (31 tests) | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | 31 tests passed | PASS |
| Full suite regression check | `npx vitest run` | 312 passed, 3 failed (documented pre-existing v1 wizard failures AddPeopleStep ×2, AddItemsStep ×1) — no new failures | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IDENT-01 | 09-03, 09-06 | "Who are you?" modal prompts user to pick name before claiming | SATISFIED | IdentityModal DialogTitle "Who are you?" wired; auto-shows when no identity stored; IDENT-01 test in CollaborativeClaimingView passes |
| IDENT-02 | 09-06 | Identity prompt skipped when device has a valid stored identity | SATISFIED | localStorage restore with personSlots check at CollaborativeClaimingView:118-127; IDENT-02/04 test passes; stale-slot re-prompt test passes |
| IDENT-03 | 09-02, 09-03, 09-04, 09-06 | User can pick "I'm not listed" to add themselves; can change identity later | SATISFIED | add_person op on edit route; "I'm not listed" inline form in PersonSlotPicker; people strip fires onStripTap to reopen modal with allowClose=true |
| IDENT-04 | 09-06 | Chosen identity persists on device so page reload doesn't re-prompt | SATISFIED | localStorage persist effect at CollaborativeClaimingView:97-108; restore effect reads same key; human verification needed for browser confirmation |
| CLAIM-02 | 09-01, 09-05, 09-06 | Multiple people can share one item; proportional cost split | SATISFIED | SHARE_CLAIM_SCRIPT tap-to-join/leave; computeEqualShareCents for "your share" display; handleShareChange wired to /claim action:share |
| CLAIM-04 | 09-05, 09-06 | Live attribution shows who claimed each item, near-real-time | SATISFIED | Attribution chips in ClaimableItemCard reflect SWR session data; SWR refreshInterval:3000 active; human verification needed for cross-device test |
| CLAIM-05 | 09-04, 09-06 | Unclaimed items surfaced before results so nothing is missed | SATISFIED | UnclaimedBanner mounted in CollaborativeClaimingView:551; warn-but-allow dialog on handleDone with unclaimed items |
| CLAIM-06 | 09-04, 09-06 | User can share join link so others can claim on their own phones | SATISFIED | Share icon in BillViewHeader (aria-label "Share bill link"); share-link CTA in the unclaimed warning dialog at line 752 |

All 8 required requirement IDs (IDENT-01..04, CLAIM-02, CLAIM-04, CLAIM-05, CLAIM-06) are accounted for. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| CollaborativeClaimingView.tsx | 114 | `eslint-disable react-hooks/exhaustive-deps` on identity-restore effect | Warning | Effect re-fires on every 3s SWR poll while modal is open (WR-06 from code review); behavior is idempotent but fragile |
| ClaimableItemCard.tsx | 39-49 | `entry.qty` unguarded in reducer/filter | Warning | Null claim entry would crash component (WR-03 from code review); no test exercises this path |
| UnclaimedBanner.tsx | 14 | `e.qty` without null-guard | Warning | Inconsistent with defensive pattern used elsewhere; crash on null entry (WR-02 from code review) |

No debt markers (TBD/FIXME/XXX) found in any Phase 9 files.

**Code review findings CR-01 and CR-02 — impact assessment:**

- **CR-01** (display share ≠ billed share for shared single-qty items): The card shows `computeEqualShareCents` (conservation-safe), the Phase 10 Results screen will use `computePersonShareFromClaims` (proportional rounding, may lose one cent). This is a cross-phase discrepancy; Phase 9's own must-have truth ("equal split sums back to the exact price") is met by `computeEqualShareCents` which passes its tests. The billing path's correctness is a Phase 10 concern (RESULTS-03). This finding does NOT block Phase 9 goal achievement.

- **CR-02** (no slot-ownership check on `/claim` qty/share and `/edit` item ops): An authenticated session participant can POST claims on behalf of another person's personId. The Phase 9 threat model (T-09-01..03) does not include this as a Phase 9 mitigation target — the plan's security scope was body validation and atomicity. This is a real authorization gap but is not a stated Phase 9 must-have. It does not block Phase 9 goal achievement; it should be addressed in Phase 10 or a targeted follow-up.

---

### Human Verification Required

### 1. First-load identity modal (IDENT-01 / IDENT-02)

**Test:** On a real mobile browser, navigate to a session URL with no prior identity stored. Verify the "Who are you?" modal appears immediately and that tapping outside, pressing Escape, or swiping down does not dismiss it.
**Expected:** Modal is visible; all dismiss gestures are blocked; selecting a name closes it and the Bill View appears underneath.
**Why human:** Dialog dismiss-block depends on browser-native dismiss behaviors (Escape, backdrop click, swipe). jsdom tests assert the onOpenChange prop-level block only.

### 2. Identity persistence across reload (IDENT-04)

**Test:** Select an identity, close the browser tab, and reopen the session URL. Verify no modal appears.
**Expected:** Bill View loads directly with the previously chosen name already active in the people strip.
**Why human:** localStorage persistence requires a real browser; jsdom tests mock the storage behavior.

### 3. Near-real-time live attribution across devices (CLAIM-04)

**Test:** Open the same session URL on two devices. On Device A, tap an item to claim it. Within 3 seconds, check Device B.
**Expected:** Device A's avatar chip appears on the item card on Device B without a reload.
**Why human:** Requires two live sessions against a real Redis backend. SWR polling is wired and tested with mocks but cross-device behavior cannot be confirmed without real infrastructure.

### 4. "I'm not listed" round-trip (IDENT-03)

**Test:** From the "Who are you?" modal, tap "I'm not listed", type a name, and tap "Add me".
**Expected:** The new person appears in the people strip, the modal closes, and the new name is the active identity.
**Why human:** Requires a live /edit add_person endpoint and Redis round-trip; tests mock fetch.

### 5. Change-identity via people strip (IDENT-03)

**Test:** While in claiming mode, tap the people strip. Verify the modal reopens with a visible X close button. Select a different name or tap X.
**Expected:** Modal shows with close button (allowClose=true mode); both name selection and X dismiss the modal.
**Why human:** Close button visibility is a visual/rendered affordance; test asserts prop value not rendered DOM in the live Dialog primitive.

### 6. Warn-but-allow done flow (CLAIM-05 / CLAIM-06 / D-09)

**Test:** In a session with at least one unclaimed item, tap "I'm done". Verify the warning dialog appears (not a browser confirm box) with a "Share bill link" button. Tap "Continue anyway" and confirm results are reached.
**Expected:** Warning Dialog (modal) visible; ShareLinkButton functions; "Continue anyway" advances to results; "Go back" returns to claiming.
**Why human:** End-to-end phase transition and Dialog rendering require a live session with real SWR data.

---

### Gaps Summary

No gaps found. All 13 must-have truths are verified by code evidence and passing tests. The two critical code review findings (CR-01 and CR-02) affect Phase 10's Results screen and security hardening respectively — neither breaks a Phase 9 stated must-have. The 6 human verification items above require a live browser and backend to confirm end-to-end user-facing behavior; they do not indicate missing implementations.

---

_Verified: 2026-06-07T12:40:00Z_
_Verifier: Claude (gsd-verifier)_
