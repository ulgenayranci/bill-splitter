---
status: complete
phase: 10-results-screen-tip-modal-currency-display
source: [10-VERIFICATION.md]
started: 2026-06-08T18:21:55Z
updated: 2026-06-08T18:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cross-device currency propagation
expected: Open the split URL on two devices (or two tabs on the same session). Change currency from USD to EUR on one device via the Results-screen Currency select. The other device shows the € symbol on all amounts within ~3s (next SWR poll).
result: issue
reported: "it works but I am not sure the placement on the flow. I think it should be on the first screen as well. since the bill I scanned was turkish liras it was saying dollar, but at the result screen it corrected the currency. this is unnecessary trust issue."
severity: major
note: Cross-device propagation itself PASSED (both screens updated). Issue is upstream — the OCR-detected currency (TRY, detected in Phase 7 / CURR-01) is not displayed on the Setup/scan and claiming/Bill View screens; they default to USD ($) until the Results screen. Phase goal was "currency threaded through ALL amount displays."

### 2. Copy summary clipboard behavior
expected: Tap "Copy summary" on Results. Clipboard contains a line `{Name} owes {amount}` for every participant followed by `Total: {amount}`. Button shows "Copied!" for 2s then reverts. Verify on real mobile hardware (exercises the execCommand fallback the unit-test navigator mock does not cover).
result: [pending]

### 3. Tip Dialog round-trip
expected: From Results, tap "Add a tip?" → Tip Dialog opens. Pick a preset or custom tip, confirm. Dialog closes, totals refresh (mutate) with the tip reflected in your total. Requires a live /tip route + SWR mutate round-trip.
result: issue
reported: "it works but result card is a little bit vague. this order feels like 4 items sum is 124.58 ... we should add a subtotal and tip section to breakdown view"
severity: minor
note: Tip round-trip itself PASSED (dialog opens, confirm updates total). Issue is the per-person breakdown layout. Screenshot Screenshot 2026-06-08 at 22.14.10.png shows items (830.50 implied) then a 'Your tip' line directly under them, with no Subtotal line; the 'Your share' headline (955.08) silently includes tip. Math is correct (338+189+219+84.50=830.50; +124.58 tip=955.08) but unreadable. Need: explicit Subtotal (items-only) row + a clearly separated tip section so breakdown reads items → Subtotal → Your tip → Total.

### 4. New Split does not delete the shared session
expected: Tap "New Split" and confirm. The initiating device navigates to `/`. The original split session is STILL accessible at its URL for other participants — it is NOT deleted from Redis (only this device's localStorage `split:{sessionId}:personId` is cleared).
result: issue
reported: "on mobile, new split button did not worked. it led me to the who are you modal and then the same bill. on laptop browser it also happened that way" + follow-up: "first attempt to new split does not work but second attempt brings back to the start new split screen"
severity: major
note: New Split does not land on the home page on the FIRST tap (reproduced on BOTH mobile and laptop). KEY CLUE — first tap fails (clears identity → 'Who are you?' modal → same bill), but a SECOND tap then succeeds and reaches the start/new-split screen. This is a state/ordering/timing bug, not a dead handler. Hypothesis: handleNewSplit clears localStorage split:{sessionId}:personId then router.push('/'), but on first invocation the still-mounted session view (or its identity-restore / SWR effect) re-redirects back to the active session before navigation settles; on the second invocation identity is already cleared so '/' sticks. The 'does not delete shared session for others' aspect could NOT be verified because first-tap navigation is broken. Likely files: components/split/PersonResultsScreen.tsx (handleNewSplit ordering — navigate before/without clearing, or await), app/split/[sessionId]/CollaborativeClaimingView.tsx (identity modal auto-trigger / restore effect that may re-capture the session), app home route '/'.

## Summary

total: 4
passed: 1
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The OCR-detected currency is shown on every amount display from the first screen onward (Setup/scan, claiming/Bill View), not only on the Results screen."
  status: failed
  reason: "User reported: scanned a Turkish Lira bill but the app showed USD ($) through the whole flow; only the Results screen corrected it to the right currency. Wrong currency shown for the entire flow then 'corrected' at the end reads as a trust issue. User suggests surfacing/controlling currency starting on the first screen."
  severity: major
  test: 1
  root_cause: "ClaimableItemCard.tsx (Phase 9 live component) has NO currencyCode prop; its formatCents calls at :126 (item price) and :207 (your share) hit the legacy $ default. It is rendered at CollaborativeClaimingView.tsx:658-666 without currencyCode, even though session.currencyCode is in scope (and already passed to PersonResultsScreen:558 and TipScreen:570). Available-but-not-passed. Currency data flow from Phase 7 (OCR→store→createSession→Redis→SessionPayload) is intact."
  artifacts: ["components/split/ClaimableItemCard.tsx:11-19,126,207", "app/split/[sessionId]/CollaborativeClaimingView.tsx:658-666"]
  missing: ["currencyCode prop on ClaimableItemCardProps", "currencyCode passed at the ClaimableItemCard render site"]

- truth: "Each person's breakdown clearly shows an items-only Subtotal row and a separated tip section, so the total reads as items → Subtotal → Your tip → Total."
  status: failed
  reason: "User reported the Results card is vague: items are listed then a 'Your tip' row sits directly under them with no Subtotal anchor, so it looks like the items themselves sum to the tip. The 'Your share' headline includes tip without showing the breakdown. Screenshot 2026-06-08 at 22.14.10.png. Math is correct but not legible."
  severity: minor
  test: 3
  root_cause: "PersonResultsScreen.tsx current-user card renders items (lines 192-208) then a Your tip row (211-225) with no Subtotal and no in-card Total; the only total shown is the 28px 'Your share' headline (line 177) which = share.total (items+tip). share.itemSubtotal, share.tip, share.total are ALL already available from computePersonShareFromClaims (billMath.ts:164-169). No math change needed."
  artifacts: ["components/split/PersonResultsScreen.tsx:177,192-225", "lib/billMath.ts:164-169"]
  missing: ["Subtotal (items-only) row inserted between lines 209-211", "in-card Total row", "optional headline relabel 'Your share'->'Your total'"]

- truth: "Tapping 'New Split' (and confirming) navigates the user to the home page to start a fresh split, and leaves the shared session intact for other participants."
  status: failed
  reason: "User reported on both mobile and laptop: New Split did not land on home on the FIRST tap; it cleared identity, showed the 'Who are you?' modal, and returned to the SAME bill. A SECOND tap then reaches the start/new-split screen. State/ordering bug — first-tap navigation to '/' is intercepted/re-redirected back to the active session before it settles; second tap works because identity is already cleared. Broken on all platforms."
  severity: major
  test: 4
  root_cause: "handleNewSplit (PersonResultsScreen.tsx:113-120) removes only localStorage split:{sessionId}:personId (identity) then router.push('/'). It does NOT clear the persisted Zustand sessionId (store key easy-billsy-bill, persisted via partialize at useBillStore.ts:169). The home page app/page.tsx:22-26 unconditionally router.replace's back to /split/{sessionId} whenever the rehydrated store still has sessionId — so the user bounces back to the same bill, and CollaborativeClaimingView.tsx:141 re-opens the 'Who are you?' modal because identity was just cleared. Single deterministic root cause; the 'second tap works' was an incidental redirect-race artifact."
  artifacts: ["components/split/PersonResultsScreen.tsx:113-120", "app/page.tsx:22-26", "stores/useBillStore.ts:141,169", "app/split/[sessionId]/CollaborativeClaimingView.tsx:122-143"]
  missing: ["clear persisted store sessionId (setSessionId(null) or a reset() action) before router.push('/') in handleNewSplit"]
