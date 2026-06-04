---
phase: 06-collaborative-bill-claiming
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - app/api/session/route.ts
  - app/api/session/[sessionId]/route.ts
  - app/api/session/[sessionId]/claim/route.ts
  - app/api/session/[sessionId]/done/route.ts
  - app/api/session/[sessionId]/tip/route.ts
  - app/api/session/[sessionId]/edit-request/route.ts
  - app/api/session/[sessionId]/resolve-edit/route.ts
  - app/api/session/[sessionId]/dispute/route.ts
  - app/api/session/[sessionId]/resolve-dispute/route.ts
  - app/split/[sessionId]/CollaborativeClaimingView.tsx
  - app/split/[sessionId]/page.tsx
  - components/split/HostPanel.tsx
  - components/split/EditRequestForm.tsx
  - components/split/ClaimableItemCard.tsx
  - components/split/PersonSlotPicker.tsx
  - components/split/ReviewHostAssignedScreen.tsx
  - components/split/TipScreen.tsx
  - components/split/PersonResultsScreen.tsx
  - components/wizard/ShareLinkButton.tsx
  - components/wizard/WizardShell.tsx
  - components/wizard/ResultsStep.tsx
  - components/wizard/AddItemsStep.tsx
  - lib/sessionSchema.ts
  - lib/billMath.ts
  - stores/useBillStore.ts
  - app/page.tsx
findings:
  critical: 5
  warning: 9
  info: 3
  total: 17
status: fixes_applied
fixed_at: 2026-05-27T00:00:00Z
fixes_applied:
  - CR-01
  - CR-02
  - CR-03
  - CR-04
  - CR-05
  - WR-01
  - WR-02
  - WR-03
  - WR-04
  - WR-05
  - WR-06
  - WR-07
  - WR-08
  - WR-09
fixes_not_applied:
  - IN-01
  - IN-02
  - IN-03
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

This phase implements the collaborative bill-claiming feature: a shareable session where guests pick their identity, claim items, request edits, dispute assignments, and confirm a tip. The API layer uses Upstash Redis with Lua scripts for atomic writes on the hot path.

Overall the architecture is well-structured and the Lua atomicity concern is addressed correctly. However, five blocking issues were found — four are security problems (authorization bypass, secret exposure, input abuse, host-token timing attack) and one is a data-correctness bug (qty-overflow race condition). Nine warnings cover non-atomic writes that can corrupt state under concurrent access, logic errors in the back-navigation flow, and missing guards. Three informational items cover dead code and minor quality gaps.

---

## Critical Issues

### CR-01: `hostToken` is returned in every GET /api/session response — full secret exposure to all guests

**File:** `app/api/session/[sessionId]/route.ts:20`
**Issue:** The GET handler returns the raw `SessionPayload` to any caller — including every guest who opens the share link. `SessionPayload` contains `hostToken`, the capability secret that authorises all host-only mutations (`resolve-edit`, `resolve-dispute`). Any guest can read this token from the JSON response and impersonate the host indefinitely. The route has no filtering at all.

**Fix:**
```typescript
// In GET handler, strip hostToken before returning:
const { hostToken: _hostToken, ...safeSession } = session
return NextResponse.json(safeSession)
```
Also update `SessionPayload` type used on the client to a separate `PublicSessionPayload` that omits `hostToken`, so TypeScript catches accidental re-additions.

---

### CR-02: No authorization check on `/api/session/[sessionId]/dispute` — anyone can file disputes for any person

**File:** `app/api/session/[sessionId]/dispute/route.ts:36-41`
**Issue:** The route verifies that `personId` exists in `session.people`, but does not verify that the caller is the person they claim to be. There is no per-person capability token or session cookie. Any anonymous caller who knows a `sessionId` (which is in every guest URL) and a valid `personId` (also returned by GET) can file disputes on behalf of any other participant, including the host's `personId`. The same applies to `/done` and `/tip` — those routes also bind to an arbitrary `personId` without authenticating the caller.

**Fix:** Because the app is currently token-based rather than cookie-based, the minimum viable mitigation is to validate that the submitting person has claimed their slot (`session.claims.personSlots[personId] === true`) before accepting the action. This prevents a caller who hasn't taken a slot from acting as someone else. Full per-person tokens would be stronger but are an architecture change.

```typescript
// dispute/route.ts, done/route.ts, tip/route.ts — add after personId membership check:
if (!session.claims?.personSlots?.[personId]) {
  return NextResponse.json({ error: 'Forbidden: slot not claimed' }, { status: 403 })
}
```

---

### CR-03: Qty-overflow race: separate GET + Lua write allows a claimant to claim more units than the item has

**File:** `app/api/session/[sessionId]/claim/route.ts:133-143`
**Issue:** The bounds check (`qty > targetItem.quantity`) reads the session in a plain `redis.get` before the Lua `eval`. Between the GET and the SET inside Lua, another claimant can also pass the bounds check with the same remaining quantity. Both writes then succeed; the total claimed qty across all claimants can exceed `item.quantity`. The comment in the code acknowledges this as an accepted trade-off, but "slightly above" is wrong — if item.quantity = 1 and two guests both claim 1 simultaneously, both succeed, yielding totalClaimedQty = 2 for a qty-1 item, which will over-charge both guests.

**Fix:** Move the bounds check inside the Lua script so it is atomic with the write:

```lua
-- Inside QTY_CLAIM_SCRIPT, before the SET:
local totalClaimed = 0
if session.claims.items[itemId] then
  for _, entry in pairs(session.claims.items[itemId]) do
    totalClaimed = totalClaimed + (entry.qty or 0)
  end
end
-- subtract what this person currently holds and add the new qty
local myCurrentQty = 0
if session.claims.items[itemId] and session.claims.items[itemId][personId] then
  myCurrentQty = session.claims.items[itemId][personId].qty or 0
end
-- look up item.quantity from session.items
local itemQuantity = 0
for _, item in ipairs(session.items) do
  if item.id == itemId then itemQuantity = item.quantity break end
end
local newTotal = totalClaimed - myCurrentQty + qty
if newTotal > itemQuantity then return 'qty_exceeded' end
```
Then handle `qty_exceeded` in the TypeScript caller with a 409 response.

---

### CR-04: `handleBackToClaiming` sends `{ done: false, undone: true }` — the `done` field is missing, causing a 400 error silently swallowed

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:197-209`
**Issue:** `handleBackToClaiming` POSTs `{ personId, undone: true }` to `/api/session/[sessionId]/done`. But the route at `done/route.ts:25-27` requires `done` to be a boolean and returns 400 if it is absent. The `catch {}` block in `handleBackToClaiming` swallows the error and flips the UI to `'claiming'` phase anyway — but the server-side `donePeople[personId]` remains `true`. On the next poll the stale server state re-surfaces and will cause the UI to behave as if the person is still done. This is a data-correctness / UX regression.

**Fix:**
```typescript
// CollaborativeClaimingView.tsx handleBackToClaiming
body: JSON.stringify({ personId: selectedPersonId, done: false }) // was undone:true
```
Remove the `undone` field entirely; the route interprets `done: false` as un-done per line 45 of `done/route.ts`.

---

### CR-05: `hostToken` exposed in browser URL and stored in Zustand without TTL — token persists in browser history and localStorage indefinitely

**File:** `components/wizard/ShareLinkButton.tsx:48`
**Issue:** The host token is appended as a plain query parameter: `router.push(\`/split/${sessionId}?hostToken=${hostToken}\`)`. Query parameters appear in browser history, server access logs, referrer headers, and any analytics tool. If the host navigates away and returns via browser history, or shares the URL by accident (e.g., sending the full URL rather than the guest URL), the token is compromised. Additionally, `setHostToken` stores it in Zustand state but Zustand state is not persisted here, so this specific leak is limited to the URL itself. The URL-based token is the primary concern.

**Fix:** Persist the host token server-side and use a short-lived `HttpOnly` cookie for host identification rather than a URL parameter. As a minimum mitigation without an architecture change, use a URL fragment (`#hostToken=...`) so the token is not sent to the server in request logs and not included in referrer headers:
```typescript
router.push(`/split/${sessionId}#hostToken=${hostToken}`)
```
Then read it on the split page via `window.location.hash`. This prevents server-log exposure and referrer leakage while staying consistent with the current architecture.

---

## Warnings

### WR-01: Non-atomic read-modify-write in `/done`, `/tip`, and `/edit-request` routes opens lost-update window

**File:** `app/api/session/[sessionId]/done/route.ts:31-48`, `app/api/session/[sessionId]/tip/route.ts:31-43`, `app/api/session/[sessionId]/edit-request/route.ts:71-95`
**Issue:** All three routes do a `redis.get` → mutate in JS → `redis.set`, with no optimistic lock or Lua script. Two concurrent writes (e.g., two people submitting their tip simultaneously) will result in one write silently clobbering the other. The `/claim` route correctly uses Lua for this reason; the other mutation routes do not.

**Fix:** Wrap each of these routes in a Lua script similar to `QTY_CLAIM_SCRIPT`, or use an optimistic-lock pattern (GET + conditional SET with a version field). At minimum, document this as a known limitation and explain why it is acceptable for these specific operations (e.g., tip is per-person keyed so concurrent different-person writes are safe, but same-person concurrent writes can still race).

---

### WR-02: Non-atomic read-modify-write in `resolve-edit` and `resolve-dispute` — concurrent host actions can corrupt item list

**File:** `app/api/session/[sessionId]/resolve-edit/route.ts:65-112`, `app/api/session/[sessionId]/resolve-dispute/route.ts:61-76`
**Issue:** Both routes are host-only but still do a non-atomic GET → mutate → SET. If the host resolves two edit requests in rapid succession (e.g., by clicking Approve twice quickly), the second write will overwrite the first because both reads see the same Redis state before either write completes. An approved `add` item inserted by the first resolution can be silently dropped by the second.

**Fix:** Use a Lua script or a Redis watch/multi for these mutations. At minimum, add an idempotency check so a second concurrent approval of the same request returns 409 rather than applying the mutation twice.

---

### WR-03: `computePersonShareFromClaims` uses `item.priceCents` as the total item price regardless of quantity — multi-qty items are under-charged

**File:** `lib/billMath.ts:101`
**Issue:** The formula is `shareCents = round(item.priceCents * myQty / totalQty)`. `item.priceCents` is the price for **all** units (the total line price), not the per-unit price. For a single-qty item this is correct: `round(totalPrice * 1/1) = totalPrice`. For a multi-qty item where `item.priceCents` stores the full line price (e.g., 3 beers × $5 = $1500 cents), the formula gives the right result too — `round(1500 * 2/3) = 1000` for 2-of-3. However, if `item.priceCents` is stored as the **per-unit** price (as `addItem` stores it: `priceCents` per item, not multiplied by quantity), then the formula under-charges proportionally. The `Item` interface and `addItem` store `priceCents` as per-unit price, but the session-creation route validates `priceCents > 0` without multiplying by quantity either, making the semantics ambiguous. If the OCR pipeline provides per-unit prices, multi-qty items will be systematically under-charged.

**Fix:** Make the price semantics explicit: document in `Item` and `SessionPayload` whether `priceCents` is per-unit or total. If it is per-unit, the formula should be:
```typescript
const totalItemPrice = item.priceCents * item.quantity
const shareCents = Math.round((totalItemPrice * myQty) / totalQty)
```

---

### WR-04: `HostPanel.assignUnclaimed` uses stale pre-loop quantity — concurrent guest claims between sequential host writes can over-assign

**File:** `components/split/HostPanel.tsx:157-172`
**Issue:** `assignUnclaimed` reads `session.claims?.items?.[itemId]?.[pid]?.qty ?? 0` from the React state snapshot (`session`) captured at render time, before the loop starts. After the first `/claim` write completes, the item's actual claimed qty on the server has changed, but the loop continues using the stale `existingQty` for subsequent assignees. The result is that the total assigned can exceed `item.quantity`. This compounds CR-03.

**Fix:** After each successful `/claim` in the loop, re-fetch the session state before computing the next assignment, or perform the entire multi-person assignment atomically via a single Lua script.

---

### WR-05: `ReviewHostAssignedScreen` — "Accept all and continue" advances phase even when disputes are pending

**File:** `components/split/ReviewHostAssignedScreen.tsx:204-211`
**Issue:** The "Accept all and continue" button calls `onAcceptAll()` unconditionally. If the user has clicked "Dispute" on some items (which sets them to pending state), the button still allows advancing to the tip screen. The person will have pending disputes that will never be resolved from their perspective, and their results will include items they actively contested. The per-item `isDisputePending` state is tracked but not used to gate the "Accept all" button.

**Fix:**
```typescript
const hasPendingDisputes = Object.keys(pendingDisputeByItem).length > 0
// ...
<Button
  disabled={hasPendingDisputes}
  onClick={onAcceptAll}
  ...
>
  {hasPendingDisputes ? 'Waiting for host…' : 'Accept all and continue'}
</Button>
```

---

### WR-06: `PersonSlotPicker` passes `AVATAR_COLORS[person.colorIndex]` without bounds-checking

**File:** `components/split/PersonSlotPicker.tsx:41`
**Issue:** `AVATAR_COLORS[person.colorIndex]` can be `undefined` if `colorIndex` is out of range (e.g., if the store or a future code path generates an index >= 6). There is no fallback here. The same pattern is guarded in `CollaborativeClaimingView.tsx:275` with `?? AVATAR_COLORS[0]`, but `PersonSlotPicker` omits the fallback.

**Fix:**
```typescript
className={`... ${AVATAR_COLORS[person.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
```

---

### WR-07: `handleDone` in `CollaborativeClaimingView` checks `hasHostAssigned` on stale pre-`mutate()` session state

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:185-189`
**Issue:** `handleDone` calls `await mutate()` to refetch the session, then immediately checks `session.items` to compute `hasHostAssigned`. However, `mutate()` updates the SWR cache but the local `session` variable in scope is the value captured at the start of the render, not the freshly-fetched value. The host-assigned check therefore runs against the pre-mutate snapshot and may mis-route the user to `'tip'` when they should go to `'review'`.

**Fix:** Read from the resolved value of `mutate()`, which returns the updated data, rather than the stale closure variable:
```typescript
const updated = await mutate()
const hasHostAssigned = updated?.items.some((item) => {
  const claim = updated.claims?.items?.[item.id]?.[selectedPersonId]
  return claim?.assignedBy === 'host' && claim.qty > 0
}) ?? false
setPhase(hasHostAssigned ? 'review' : 'tip')
```

---

### WR-08: `TipScreen.applyCustom` accepts arbitrarily large tip percentages with no upper-bound validation

**File:** `components/split/TipScreen.tsx:46-53`
**Issue:** `applyCustom` accepts any non-negative finite number. A user can type `9999999` and the tip will be serialised to the server as a legitimate integer-cents value. The server at `tip/route.ts:26` only validates `tipCents >= 0` — there is no upper bound. While this is unlikely to be exploited maliciously (users hurt only themselves), it will cause nonsensical display values and could overflow on 32-bit integer systems if downstream code does arithmetic.

**Fix:** Add a reasonable cap (e.g., 100% or a fixed maximum like $999):
```typescript
// TipScreen.tsx
const MAX_TIP_PERCENT = 100
if (Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_TIP_PERCENT) {
```
And mirror the cap server-side:
```typescript
// tip/route.ts — add after current validation:
const MAX_TIP_CENTS = itemSubtotalCents * 2 // or a fixed cap like 100_000
if (tipCents > MAX_TIP_CENTS) {
  return NextResponse.json({ error: 'tipCents exceeds maximum' }, { status: 400 })
}
```
(Note: the server doesn't receive `itemSubtotalCents`, so a fixed cap like 1,000,000 cents is more practical.)

---

### WR-09: `EditRequestForm` submits `parseCents(priceText) ?? 0` — can send `priceCents: 0` if `parseCents` returns null at submit time

**File:** `components/split/EditRequestForm.tsx:76-77`, `82-83`
**Issue:** `submitDisabled` correctly gates on `parseCents(priceText) !== null`, so in theory the submit button should be disabled when price is invalid. However, the `handleSubmit` function still uses `parseCents(priceText) ?? 0` as a fallback. If the validation guard logic diverges from `parseCents` in a future change, or if the form is submitted programmatically, `priceCents: 0` will be sent. The server at `edit-request/route.ts:28` rejects `priceCents <= 0`, so this will produce an error response, but the root issue is the defensive fallback to `0` rather than throwing or asserting.

**Fix:**
```typescript
const priceCents = parseCents(priceText)
if (priceCents === null) {
  setError('Invalid price') // should not reach here but fail loudly
  return
}
payload = { name: name.trim(), priceCents, quantity }
```

---

## Info

### IN-01: `handleBackToClaiming` result is discarded via `void` — async errors are silently dropped

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:247`
**Issue:** `onBack={() => void handleBackToClaiming()}` suppresses the promise return. Combined with WR-04 / CR-04 this means the back-navigation error path is entirely invisible. Once CR-04 is fixed, the error should at least be surfaced to the user.

**Fix:** Either await the call (inside an async event handler) or add error display to `handleBackToClaiming` rather than swallowing in a `void`.

---

### IN-02: `computeSubtotalCents` in `billMath.ts` does not account for item `quantity`

**File:** `lib/billMath.ts:18-20`
**Issue:** `computeSubtotalCents` sums `item.priceCents` without multiplying by `item.quantity`. This is consistent only if `priceCents` is already the total line price (not per-unit). If the semantics change to per-unit (see WR-03), this function silently under-computes the subtotal. This is more of a documentation gap than a current bug if the semantics are total-price, but the ambiguity should be resolved.

**Fix:** Add a JSDoc comment clarifying the assumed semantics:
```typescript
/** Sum of all item total prices (item.priceCents is the full line price, not per-unit). */
export function computeSubtotalCents(items: Item[]): number {
```

---

### IN-03: `AddItemsStep` `setItems` from OCR does not set `quantity` on items — items default to `undefined` for `quantity`

**File:** `components/wizard/AddItemsStep.tsx:213-219`
**Issue:** The `setItems` call from the expand API maps `ei` to `{ id, name, rawName, priceCents, confidence }` — `quantity` is missing. The `Item` interface requires `quantity: number`. TypeScript may not flag this if the expand response type is loose. Items created this way will have `quantity: undefined` at runtime, which will produce `NaN` in quantity-based calculations. The `addItem` store action defaults `quantity = 1` when called directly, but `setItems` bypasses that default.

**Fix:**
```typescript
setItems(
  expandData.items.map((ei) => ({
    id: randomId(),
    name: ei.displayName,
    rawName: ei.rawName,
    priceCents: ei.priceCents,
    confidence: ei.confidence,
    quantity: 1, // add this
  })),
)
```

---

_Reviewed: 2026-05-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
