---
phase: 11-bug-fixes-polish-bill-results-screens-participant-management
verified: 2026-06-09T11:40:00Z
status: human_needed
score: 8/8 must-haves verified (reduced scope)
overrides_applied: 0
deferred:
  - truth: "A remove_person op deletes a person from session.people atomically via Lua (PART-01)"
    addressed_in: "Phase 11 — descoped by user decision (commit 107c88e)"
    evidence: "REQUIREMENTS.md: PART-01 marked Deferred — live remove-person Lua purge carried 2 Critical code-review findings (CR-01/CR-02) with no execution-level test. Remove remains on setup screen (no claims to purge)."
  - truth: "Removing a participant frees their claimed items and purges personSlots/donePeople/tips (PART-02)"
    addressed_in: "Phase 11 — descoped with PART-01"
    evidence: "REQUIREMENTS.md: PART-02 marked Deferred — belongs to live remove-person (see PART-01). Not applicable to setup-screen remove."
  - truth: "When a viewer's own identity is removed by anyone, the identity modal re-opens (PART-06)"
    addressed_in: "Phase 11 — descoped with PART-01"
    evidence: "REQUIREMENTS.md: PART-06 marked Deferred — self-removal edge case only existed to support live remove-person. With live remove gone, no one can remove a viewer mid-session."
human_verification:
  - test: "Tap 'Rename Alice' in the people modal, type a new name, tap Save, observe the name updates across all connected devices"
    expected: "Name updates on all participants' screens within the 3s SWR poll interval"
    why_human: "Cross-device SWR propagation requires a live Redis session and two devices; cannot be verified by grep or test mocks"
  - test: "Open the Results screen when one item is unclaimed; verify the amber 'Unclaimed items' callout is visible and lists the item name; then claim the item and re-open Results"
    expected: "Unclaimed callout disappears and headline reads 'You're all set!'"
    why_human: "End-to-end screen transition with live claim state; test fixtures cover the logic but real UI rendering on mobile is not verifiable by automated tests"
  - test: "Tap 'Add a tip' on the Results screen; verify the Tip modal opens and the button was visually prominent (amber outlined Button, not faint underlined text)"
    expected: "Amber outlined Button labeled 'Add a tip' opens the tip modal"
    why_human: "Visual prominence and mobile tap target feel require human inspection on a real device"
  - test: "Open the bill view header on mobile; confirm the Share button is easy to identify and tap without accidentally triggering other controls"
    expected: "Share button is large (≥44px), has visible icon + 'Share' label, and does not conflict with adjacent tap targets"
    why_human: "Tap target ergonomics and visual presence require human assessment on a real device"
---

# Phase 11: Bug Fixes & Polish — Verification Report

**Phase Goal:** Fix post-v2 UAT bugs and usability issues on the bill and results screens, and add participant management, so the collaborative split flow is clear and correctable end-to-end.
**Verified:** 2026-06-09T11:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification
**Scope note:** Live remove-person was descoped post-plan (commit 107c88e) due to 2 Critical Lua code-review findings (CR-01/CR-02). PART-01, PART-02, PART-06 are deferred per REQUIREMENTS.md. This verification applies the reduced scope.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Receipt button is gone from BillViewHeader (HEADER-01) | VERIFIED | No `Receipt` import or `View receipt` aria-label in `BillViewHeader.tsx`; Test 7 asserts `queryByLabelText('View receipt')` is null |
| 2 | Share button is a ≥44px tap target with icon + label (HEADER-02) | VERIFIED | `BillViewHeader.tsx:125`: `min-h-[44px] min-w-[44px]` classes + `<span>Share</span>` label; Test 10 asserts className contains `min-h-[44px]` |
| 3 | Results screen shows "Unclaimed items" section when items remain, playful headline when unclaimed, "all set" when fully claimed (RESULTS-05) | VERIFIED | `PersonResultsScreen.tsx:128-141`: conditional `unclaimedCount > 0` branches; "up for grabs" and "all set" both present; Tests D-03/D-04 pass |
| 4 | `rename_person` op on /edit route with trim/non-empty/≤50 validation (PART-03) | VERIFIED | `edit/route.ts:79-101` RENAME_PERSON_SCRIPT; `validateOp` at lines 147-161 enforces all constraints; Tests 25-29 pass |
| 5 | PersonSlotPicker exposes rename affordance per person card; remove affordance is absent (PART-04) | VERIFIED | `PersonSlotPicker.tsx:102-116`: Pencil button with `aria-label="Rename {name}"`, guarded by `onRenamePerson` prop; no remove/X button present; Test 10 asserts no `Remove Alice` button |
| 6 | Rename is a shared Redis write propagating to all via SWR poll (PART-05) | VERIFIED | `CollaborativeClaimingView.tsx:204-220`: `handleRenamePerson` calls `fetch /edit { op: 'rename_person' }` then `await mutate()`; SWR `refreshInterval: 3000` at line 86 |
| 7 | "Add a tip" is a prominent Button, not a faint link (TIP-03) | VERIFIED | `PersonResultsScreen.tsx:268-275`: `<Button variant="outline" className="border-amber-600 ...">Add a tip</Button>` |
| 8 | Currency `<select>` removed from Results; detected currency symbol still displays everywhere; server update_currency op retained (CURR-04) | VERIFIED | No `COMMON_CURRENCIES`, `handleCurrencyChange`, `onCurrencyChange`, or `<select>` in `PersonResultsScreen.tsx`; all `formatCents(amount, currencyCode)` call sites intact; `update_currency` in `VALID_OPS` at `edit/route.ts:8` |

**Score: 8/8 truths verified**

### Deferred Items

Items descoped by user decision after plans were written — intentionally absent from codebase.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | `remove_person` Lua op (PART-01) | Phase 11 — descoped | commit 107c88e; REQUIREMENTS.md: "DEFERRED — Lua purge carried 2 Critical findings (CR-01/CR-02), no execution test. Remove retained on setup screen." |
| 2 | Removing participant frees claims/purges slots/tips (PART-02) | Phase 11 — descoped | REQUIREMENTS.md: "Deferred — belongs to live remove-person." |
| 3 | Self-removal re-opens identity modal (PART-06) | Phase 11 — descoped | REQUIREMENTS.md: "Deferred — only existed to support live remove-person." |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/session/[sessionId]/edit/route.ts` | RENAME_PERSON_SCRIPT, validateOp rename branch, POST dispatch | VERIFIED | Lines 79-101 (script), 147-161 (validation), 255-284 (dispatch). No REMOVE_PERSON_SCRIPT (correctly absent). |
| `lib/sessionUtils.ts` | Exports `getUnclaimedCounts` and `getUnclaimedItems` | VERIFIED | Lines 12 and 27; both exported; used by PersonResultsScreen, UnclaimedBanner, CollaborativeClaimingView |
| `components/split/PersonResultsScreen.tsx` | Unclaimed section, conditional headline, tip Button, no currency select | VERIFIED | All four changes confirmed at lines 126-141 (headline+section), 268-275 (tip Button); zero currency select references |
| `components/split/BillViewHeader.tsx` | Receipt button removed, Share button ≥44px | VERIFIED | No `Receipt` import (line 4 only has `Share2, Check`); Share button with `min-h-[44px]` at line 125 |
| `components/split/PersonSlotPicker.tsx` | Rename affordance per card (no remove) | VERIFIED | `onRenamePerson` prop at line 24; Pencil button at lines 102-116; no X/remove button |
| `components/split/IdentityModal.tsx` | `onRenamePerson` prop threaded to PersonSlotPicker | VERIFIED | Prop declared at line 28, destructured at line 38, forwarded at line 73 |
| `app/split/[sessionId]/CollaborativeClaimingView.tsx` | `handleRenamePerson`, no `onCurrencyChange`, no `handleRemovePerson` | VERIFIED | `handleRenamePerson` at line 205; grep for `onCurrencyChange`/`handleCurrencyChange`/`handleRemovePerson`/`remove_person` returns 0 in production code |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PersonSlotPicker` Pencil button | `onRenamePerson` prop | `e.stopPropagation()` + `setEditingPersonId` | WIRED | Pencil click sets `editingPersonId`; Save button calls `onRenamePerson(personId, trimmed)` at line 50 |
| `IdentityModal` | `PersonSlotPicker.onRenamePerson` | prop forwarding | WIRED | `IdentityModal.tsx:73`: `onRenamePerson={onRenamePerson}` |
| `CollaborativeClaimingView` `handleRenamePerson` | `POST /api/session/{sessionId}/edit` | `fetch { op: 'rename_person' }` | WIRED | Lines 207-211 |
| `POST /edit { op: 'rename_person' }` | `RENAME_PERSON_SCRIPT via redis.eval` | `[b.personId, trimmedName]` | WIRED | `edit/route.ts:268`: `redis.eval(RENAME_PERSON_SCRIPT, [...], [...])` |
| `PersonResultsScreen` | `lib/sessionUtils.ts` | `import { getUnclaimedCounts, getUnclaimedItems }` | WIRED | Line 25 import; `getUnclaimedCounts(session)` at line 59; `getUnclaimedItems(session)` at line 137 |
| `update_currency` op | retained server-side | `VALID_OPS` in edit route | WIRED | `edit/route.ts:8` includes `'update_currency'`; dispatch block at lines 229-253 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PersonResultsScreen.tsx` | `unclaimedCount` | `getUnclaimedCounts(session)` from `lib/sessionUtils.ts` | Yes — iterates `session.items` + `session.claims.items` live | FLOWING |
| `PersonResultsScreen.tsx` | `getUnclaimedItems(session)` list | `lib/sessionUtils.ts` filter over `session.items` | Yes — filters live items | FLOWING |
| `BillViewHeader.tsx` | `session.people`, `session.createdAt` | SWR-fetched `SessionPayload` from parent | Yes — live Redis data | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for server API (requires live Redis connection). TypeScript checks and test suite used instead.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `rename_person` validation rejects empty name | `npx vitest run __tests__/editRoute.test.ts` | 26 passed | PASS |
| `rename_person` validation rejects >50 char name | `npx vitest run __tests__/editRoute.test.ts` | 26 passed | PASS |
| PersonResultsScreen renders unclaimed section | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | 22 passed | PASS |
| PersonResultsScreen tip is Button role | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | 22 passed | PASS |
| BillViewHeader Share button has 44px class | `npx vitest run __tests__/BillViewHeader.test.tsx` | 10 passed | PASS |
| PersonSlotPicker rename affordance + no remove | `npx vitest run __tests__/PersonSlotPicker.test.tsx` | 15 passed | PASS |
| Full suite regression | `npx vitest run` | 363 passed, 3 pre-existing failures | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PART-01 | 11-01 | `remove_person` Lua op | DEFERRED | Descoped — CR-01/CR-02; REQUIREMENTS.md marked Deferred |
| PART-02 | 11-01 | Removal frees claims/slots/tips | DEFERRED | Descoped with PART-01 |
| PART-03 | 11-01 | `rename_person` op with trim/non-empty/≤50 | SATISFIED | `edit/route.ts:79-284`; Tests 25-29 pass |
| PART-04 | 11-04 | PersonSlotPicker exposes rename affordance (remove gone) | SATISFIED | Pencil button present; no X/remove button; Tests 10-16 (Test 15 removed with descope) |
| PART-05 | 11-04 | Rename is shared Redis write propagating via SWR | SATISFIED | `handleRenamePerson` calls `await mutate()` after fetch |
| PART-06 | 11-04 | Self-removal re-opens identity modal | DEFERRED | Descoped — only existed for live remove |
| RESULTS-05 | 11-02 | Unclaimed section + conditional headline | SATISFIED | `PersonResultsScreen.tsx:126-141`; Tests D-03/D-04 pass |
| TIP-03 | 11-02 | "Add a tip" is prominent Button | SATISFIED | `<Button variant="outline">` at line 268 |
| CURR-04 | 11-02 | Currency select removed; symbol retained; server op kept | SATISFIED | Zero currency select references; `formatCents` call sites intact; `update_currency` in VALID_OPS |
| HEADER-01 | 11-03 | Receipt button removed | SATISFIED | No `Receipt` import; no `View receipt` aria-label |
| HEADER-02 | 11-03 | Share button ≥44px tap target | SATISFIED | `min-h-[44px] min-w-[44px]` + label; Test 10 asserts class |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TBD/FIXME/XXX markers found in any phase-11-modified file |

**Note on non-blocking review findings (from 11-REVIEW.md):** Six warnings/info items (WR-01 through WR-06, IN-01 through IN-04) remain as documented non-blocking follow-ups. WR-01/WR-03 relate to item name validation asymmetry (existing behavior, pre-phase), WR-04 to silent qty coercion, WR-05 to defensive date handling, WR-06 to tap-target overlap UX in the people grid, IN-04 to the absence of a real Lua execution test. None prevent the phase goal from being achieved. All are noted for future phases.

### Human Verification Required

Four items need human verification on a real device:

### 1. Rename propagation to all participants

**Test:** In a shared session with two devices, open the people modal on one device, tap the Pencil icon on Alice, type "Alicia", tap Save. Observe the second device within 5 seconds.
**Expected:** Alice's name updates to "Alicia" on the second device's bill view without a page reload.
**Why human:** Cross-device SWR propagation requires a live Redis session and two browsers/devices; test mocks simulate but cannot verify real network timing.

### 2. Results screen unclaimed section end-to-end

**Test:** With one item unclaimed, navigate to the Results screen and observe the amber callout. Then claim the item, return to Results.
**Expected:** Callout shows "Unclaimed items" with the item name and headline "Hold up — 1 item still up for grabs!"; after claiming, callout is gone and headline reads "You're all set!".
**Why human:** State transition and real rendering on mobile screen sizes.

### 3. "Add a tip" Button prominence on mobile

**Test:** Open the Results screen on a mobile device. Visually confirm the "Add a tip" element is a styled amber outlined button (not a faint underlined link). Tap it.
**Expected:** Amber outlined Button labeled "Add a tip" is immediately visible and opens the Tip modal on tap.
**Why human:** Visual weight and tap feel require human judgement on a real device.

### 4. Share button tap target feel on mobile

**Test:** Open the bill view on a mobile device. Locate the Share button in the header. Tap it without accidentally hitting the people strip below.
**Expected:** Button is easy to identify (amber background, icon + "Share" label) and taps cleanly without accidentally triggering the people strip.
**Why human:** Tap target ergonomics require real-device assessment; also validates that removing the adjacent Receipt button improved the experience.

---

## Gaps Summary

No actionable gaps. All 8 must-haves for the reduced scope are verified. The three items from the original PLAN scope (PART-01, PART-02, PART-06 — live remove-person and its self-removal effect) are correctly absent from the codebase per the user-directed descope decision (commit 107c88e), and are recorded in REQUIREMENTS.md as Deferred with rationale.

The ROADMAP Success Criterion 4 still references "removed...participants" but this is stale wording; REQUIREMENTS.md is the authoritative record of the descope decision. The ROADMAP entry was not updated after the descope.

---

_Verified: 2026-06-09T11:40:00Z_
_Verifier: Claude (gsd-verifier)_
