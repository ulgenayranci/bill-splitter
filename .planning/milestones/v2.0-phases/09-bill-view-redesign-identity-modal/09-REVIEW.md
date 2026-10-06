---
phase: 09-bill-view-redesign-identity-modal
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - __tests__/BillViewHeader.test.tsx
  - __tests__/ClaimableItemCard.test.tsx
  - __tests__/CollaborativeClaimingView.test.tsx
  - __tests__/IdentityModal.test.tsx
  - __tests__/PersonSlotPicker.test.tsx
  - __tests__/UnclaimedBanner.test.tsx
  - __tests__/billMath.test.ts
  - __tests__/editRoute.test.ts
  - __tests__/sessionClaimRoute.test.ts
  - app/api/session/[sessionId]/claim/route.ts
  - app/api/session/[sessionId]/edit/route.ts
  - app/split/[sessionId]/CollaborativeClaimingView.tsx
  - components/split/BillViewHeader.tsx
  - components/split/ClaimableItemCard.tsx
  - components/split/IdentityModal.tsx
  - components/split/PersonSlotPicker.tsx
  - components/split/UnclaimedBanner.tsx
  - lib/billMath.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: fixed
fixed_at: 2026-06-07T00:00:00Z
fixes:
  CR-01: fixed
  CR-02: fixed
  WR-01: fixed
  WR-02: fixed
  WR-03: fixed
  WR-04: fixed
  WR-05: fixed
  WR-06: fixed
  IN-01: not_fixed (out of scope — info severity)
  IN-02: not_fixed (out of scope — info severity)
  IN-03: not_fixed (out of scope — info severity)
  IN-04: not_fixed (out of scope — info severity)
  IN-05: not_fixed (out of scope — info severity)
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-07
**Depth:** standard
**Files Reviewed:** 18
**Status:** fixed (all Critical + Warning findings fixed 2026-06-07; Info findings out of scope)

## Summary

Reviewed the Phase 9 bill-view redesign and identity-modal work: two API route handlers
(`/claim`, `/edit`), the orchestrating `CollaborativeClaimingView`, five split components,
`lib/billMath.ts`, and their test suites.

The Lua-based atomic claim/add-person paths are well constructed and the bounds-check race
fix (CR-03) is correct. However two correctness/security issues should block: (1) a
penny-conservation and display/billing mismatch on shared single-qty items — the card shows
one number while the user is actually billed a different one, and the billed shares for a
shared item do not sum to the item price; (2) an authorization inconsistency where the
`/claim` `qty` and `share` actions (and all `/edit` item ops) accept any `personId` with no
slot-ownership check, even though the `/done` route explicitly defends that exact threat
(CR-02). Several robustness warnings follow, the most user-visible being the multi-step inline
edit that can persist a partial edit and leave the item in a half-saved state.

## Critical Issues

### CR-01: Shared single-qty item — displayed share ≠ billed share, and billed shares lose a cent  [FIXED 0209ae1]

**File:** `lib/billMath.ts:89-126`, `components/split/ClaimableItemCard.tsx:71-79`, `app/split/[sessionId]/CollaborativeClaimingView.tsx:511-516`

**Issue:** For a single-qty item shared by N people, two different formulas are in play:

- The card's "your share" line (`ClaimableItemCard.tsx:74-78`) uses
  `computeEqualShareCents(price, N, myIndex)` — the largest-remainder method. For a $10 item
  shared 3 ways this yields 334 / 333 / 333, summing to exactly 1000.
- The actual per-person total (`CollaborativeClaimingView.tsx:511`) is computed for **all**
  items via `computePersonShareFromClaims`, which uses proportional rounding
  `Math.round(priceCents * myQty / totalQty)` (`billMath.ts:115`). For the same $10 / 3-way
  case each person has `myQty=1, totalQty=3` → `round(1000 * 1 / 3) = 333` for **all three**.

Consequences:
1. The number shown on the card ("your share: $3.34" for the index-0 user — asserted in
   `ClaimableItemCard.test.tsx:265-286`) does not match what that user is actually billed
   ($3.33) on the results/tip screens.
2. The billed shares sum to 333 × 3 = 999 cents, not 1000 — one cent of the bill is
   unaccounted for. `computeEqualShareCents` was written specifically to guarantee
   conservation (`billMath.ts:131`), but it is not the function used to bill these items.

**Fix:** Use one method for both display and billing on single-qty shared items. Either route
single-qty shared items through largest-remainder in `computePersonShareFromClaims`, or have
the card display the same proportional value it will be billed. Concretely, make the billing
function conservation-safe for the equal-share case, e.g. detect `qty == 1 && all entries qty == 1`
and apply largest-remainder keyed on sorted personIds:

```ts
// in computePersonShareFromClaims, for a single-unit-each shared item:
const sharerIds = Object.keys(claimsForItem).filter((p) => claimsForItem[p]?.qty > 0).sort()
const allSingle = sharerIds.every((p) => claimsForItem[p].qty === 1) && item.quantity <= 1
if (allSingle) {
  const myIndex = sharerIds.indexOf(personId)
  shareCents = computeEqualShareCents(item.priceCents, sharerIds.length, myIndex)
} else {
  shareCents = Math.round((item.priceCents * myQty) / totalQty)
}
```

This makes the card line and the bill agree and restores cent conservation.

### CR-02: `/claim` qty + share actions and `/edit` item ops accept any personId with no slot-ownership check  [FIXED 0ac2b02 — /claim guarded; /edit item ops intentionally left open per flat model, see note below]

**File:** `app/api/session/[sessionId]/claim/route.ts:137-244`, `app/api/session/[sessionId]/edit/route.ts:123-240`

**Issue:** The `/done` route was explicitly hardened (its own comment, CR-02) to reject callers
who have not claimed the `personId` slot:
`if (!session.claims?.personSlots?.[personId]) return 403`. The `/claim` route applies **no**
such check for the `qty` and `share` actions — `validateBody` only checks that `personId` is a
non-empty string (`claim/route.ts:140-142`). Anyone holding the public sessionId can therefore
POST `{ personId: '<any other person>', action: 'qty'|'share', ... }` and add, change, or
remove claims on another participant's behalf. Because `qty` can be `0` and `share` can be
`joining:false`, an attacker can also silently **un-claim** items other people selected,
corrupting everyone's totals. The same gap exists in `/edit`: any caller can `remove`,
`edit_price`, `edit_name`, or `edit_quantity` any item without proving an identity.

This is a real authorization bypass relative to the project's own established threat model —
`/done` defends it, `/claim` and `/edit` do not, so the protection is trivially sidestepped by
mutating claims directly instead of via `/done`.

**Fix:** Apply the same slot-ownership guard inside the Lua scripts (so it is atomic) for the
`qty` and `share` actions, returning a `forbidden` sentinel when
`session.claims.personSlots[personId] ~= true`:

```lua
-- near the top of QTY_CLAIM_SCRIPT and SHARE_CLAIM_SCRIPT, after decoding session:
if not (session.claims and session.claims.personSlots
        and session.claims.personSlots[personId] == true) then
  return 'forbidden'
end
```

and map `'forbidden'` → HTTP 403 in the route. For `/edit` item ops, gate destructive ops on a
claimed identity as well (or document explicitly that anonymous edits are an intentional
product decision — but the current asymmetry with `/done` looks like an oversight, not a
decision).

**Fix applied (2026-06-07):** The slot-ownership guard was added inside `QTY_CLAIM_SCRIPT` and
`SHARE_CLAIM_SCRIPT` (atomic with the write); the route maps the `forbidden` sentinel to HTTP
403. The `slot` action stays unguarded (unclaimed slots must remain claimable) and `add_person`
creates its own slot. **`/edit` item ops were deliberately left open**: per the Phase 9 flat
collaborative model, any participant may add/edit/remove items on the shared bill — this is an
intentional product decision, not the same threat as impersonating another person's *claims*.
Only the `/claim` asymmetry with `/done` was a genuine bypass and is now closed. Regression
tests cover the Lua guard presence and the 403 mapping for both `qty` and `share`.

## Warnings

### WR-01: Multi-step inline edit can persist a partial edit on failure  [FIXED f61ef81]

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:421-456`

**Issue:** `handleInlineSubmit` (edit branch) fires up to three independent POSTs in sequence:
`edit_name`, then `edit_price`, then `edit_quantity`, each `return`-ing on a non-ok response.
If `edit_name` succeeds but `edit_price` fails, the name change is already committed
server-side while the form shows "Couldn't save — try again" and the price/quantity are not
applied. The user sees an error implying nothing saved, but the rename is persisted. Retrying
re-sends the (now unchanged) name plus the price, leaving state hard to reason about.

**Fix:** Either (a) add a single `/edit` op that updates name+price+quantity atomically in one
request, or (b) compute all three intended values up front and send them as one combined op so
the server applies them transactionally. At minimum, on partial failure refresh via `mutate()`
and surface which fields did/didn't save rather than a blanket "nothing saved" message.

### WR-02: `UnclaimedBanner` dereferences `e.qty` without null-guard; inconsistent with the rest of the codebase  [FIXED 738c2a8]

**File:** `components/split/UnclaimedBanner.tsx:14`

**Issue:** `getUnclaimedCounts` does `entries.reduce((sum, e) => sum + e.qty, 0)`. Every other
copy of this reducer guards the entry: `CollaborativeClaimingView.tsx:59` and `:316` use
`e?.qty ?? 0`, and `billMath.ts:110` uses `entry?.qty ?? 0`. If a claims map ever contains a
`null`/`undefined` entry (e.g. from a malformed session payload or a future schema change),
the banner throws a TypeError and crashes the whole claiming view, while the identical logic
elsewhere degrades gracefully.

**Fix:** Match the defensive pattern used everywhere else:

```ts
const totalClaimed = Object.values(entries).reduce((sum, e) => sum + (e?.qty ?? 0), 0)
```

### WR-03: `ClaimableItemCard` reads `entry.qty` unguarded in three reducers/filters  [FIXED 59b7a54]

**File:** `components/split/ClaimableItemCard.tsx:39-49,46-49`

**Issue:** Same class of issue as WR-02. `allClaimantEntries` filters on `entry.qty > 0`
(lines 39-40) and `totalClaimedQty` reduces with `sum + entry.qty` (lines 46-49) with no
optional chaining. A null entry in `claimsForItem` produces a crash. The component is rendered
once per item in a list, so a single bad entry blanks the entire bill view.

**Fix:** Use `entry?.qty ?? 0` consistently in the filters and the reducer.

### WR-04: `remainingForMe` can be negative, producing a misleading disabled state  [FIXED 1386916]

**File:** `components/split/ClaimableItemCard.tsx:61-69`

**Issue:** `remainingForMe = (item.quantity ?? 1) - (totalClaimedQty - myQty)`. If the server
state is ever over-claimed (totalClaimedQty > quantity — reachable transiently via the
optimistic-update + concurrent-claimant path, since the qty bounds check lives only on the
server and the optimistic snapshot does not re-validate), `remainingForMe` goes negative. The
increment guard `myQty < remainingForMe` then disables the "+" button even when the user has
legitimately claimed fewer than the (stale) maximum, and the "X of N claimed" label can show
N+ claimed. The user is silently blocked with no explanation.

**Fix:** Clamp and surface the state explicitly:
`const remainingForMe = Math.max(0, (item.quantity ?? 1) - (totalClaimedQty - myQty))`, and
consider showing an "over-claimed" hint when `totalClaimedQty > (item.quantity ?? 1)` so the
disabled "+" is understandable.

### WR-05: `add_person` validation is run twice and re-derives the name independently  [FIXED cb2026b]

**File:** `app/api/session/[sessionId]/edit/route.ts:144-156`

**Issue:** The `add_person` branch trims `b.name` into `trimmedName` (line 146) and **also**
calls `validateOp('add_person', b, ...)` (line 149) which trims `b.name` again internally
(`:61`). The two trims must stay in lockstep; if `validateOp`'s normalization ever diverges
from the inline `nameRaw.trim()`, the value validated and the value sent to Lua (`trimmedName`,
line 156) could differ — e.g. validation passes on a normalized form while a different raw
form is persisted. The single source of truth is split across two code paths.

**Fix:** Have `validateOp` return the normalized name (or have the branch use the same trimmed
value it validates) so the validated value and the persisted value are guaranteed identical.

### WR-06: Identity-restore effect omits `selectedPersonId` from deps and relies on an eslint-disable  [FIXED f61ef81]

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:112-131`

**Issue:** The restore effect reads `selectedPersonId` (line 114, early-return) but excludes it
from the dependency array with an `eslint-disable react-hooks/exhaustive-deps`. The intent
("only fire on session load while unset") is reasonable, but the current form will also re-run
whenever `session` changes via the 3s `refreshInterval` poll. On every poll while
`selectedPersonId` is still null (modal open, user hasn't picked yet) it re-reads localStorage
and may call `setIdentityModalOpen(true)` again. This is mostly idempotent but couples modal
state to the polling cadence and is fragile to future edits.

**Fix:** Gate on a ref that records "restore already attempted" instead of suppressing the lint
rule, or split the one-shot restore into an effect keyed only on the session's first arrival.

## Info

### IN-01: Duplicated `getUnclaimedCounts` implementation

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:55-63` and `components/split/UnclaimedBanner.tsx:10-18`

**Issue:** The unclaimed-count logic is copy-pasted into two files with a subtle divergence
(one guards `e?.qty`, the other does not — see WR-02). Duplicated logic with drift is a
maintenance hazard.

**Fix:** Extract a single `getUnclaimedCounts(session)` helper (e.g. into `lib/billMath.ts`)
and import it in both places.

### IN-02: Duplicated share-link handler (`handleShare` vs `handleWarningShare`)

**File:** `components/split/BillViewHeader.tsx:63-105` and `app/split/[sessionId]/CollaborativeClaimingView.tsx:356-382`

**Issue:** Two near-identical Web-Share/clipboard handlers exist. `BillViewHeader.handleShare`
additionally has the `execCommand` fallback that `handleWarningShare` lacks, so the two share
buttons behave differently on browsers without `navigator.share`/`clipboard`.

**Fix:** Extract a shared `shareSessionLink(sessionId)` utility and use it in both buttons so
behavior is consistent.

### IN-03: Magic numbers for limits and TTL

**File:** `app/api/session/[sessionId]/edit/route.ts:37,43,233`, `app/api/session/[sessionId]/claim/route.ts:61,99,125`

**Issue:** `20` (max people), `6` (color count modulo), and `86400` (TTL seconds) are
hard-coded inline in both Lua scripts and TypeScript. The color modulo `6` is also duplicated
in `useBillStore` and components (`% AVATAR_COLORS.length`), so the magic `6` and the array
length can drift apart.

**Fix:** Define named constants (`MAX_PEOPLE = 20`, `SESSION_TTL_SECONDS = 86400`) and derive
the color modulo from `AVATAR_COLORS.length` everywhere rather than literal `6`.

### IN-04: `'invalid_session'` returns HTTP 500 — arguably a 4xx/410 condition

**File:** `app/api/session/[sessionId]/claim/route.ts:195-197,213-215,232-234`, `app/api/session/[sessionId]/edit/route.ts:163-165`

**Issue:** When the stored session JSON fails to decode, the routes return 500. A corrupt or
unparseable session is not a transient server fault the client can retry; treating it as 500
will trigger generic "try again" retry loops in the UI for a permanently broken session.

**Fix:** Consider mapping `invalid_session` to 410 Gone (or 404) so the client routes to
`SessionExpiredScreen` instead of an infinite retry.

### IN-05: `parseInt(inlineForm.qty, 10) || 1` masks invalid quantity input silently

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:418,429`

**Issue:** Quantity is coerced with `Math.max(1, parseInt(qty, 10) || 1)` (add) and
`Math.max(1, Math.min(99, parseInt(qty, 10) || 1))` (edit). Non-numeric or empty qty silently
becomes 1 with no validation feedback, unlike name and price which surface errors. A user who
fat-fingers the qty field gets a silently different value than intended.

**Fix:** Validate qty explicitly and show an inline error when it is non-numeric or out of the
1–99 range, consistent with the name/price validation already present.

---

_Reviewed: 2026-06-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
