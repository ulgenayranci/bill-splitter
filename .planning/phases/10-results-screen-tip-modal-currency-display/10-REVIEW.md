---
phase: 10-results-screen-tip-modal-currency-display
reviewed: 2026-06-08T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - lib/billMath.ts
  - app/api/session/[sessionId]/edit/route.ts
  - components/split/PersonResultsScreen.tsx
  - components/split/TipScreen.tsx
  - app/split/[sessionId]/CollaborativeClaimingView.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
cr01_status: resolved
cr01_resolved_at: 2026-06-08T00:00:00Z
cr01_fix_commit: fix(10): make update_currency atomic via Lua (CR-01)
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-08
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the five source files changed in Phase 10 (currency-aware money formatting, the
`update_currency` edit op, the rewritten all-people Results screen, the Tip Dialog, and the
two-phase collaborative claiming machine).

The money math is largely correct: the largest-remainder split conserves cents, the legacy
no-arg `formatCents` path is byte-identical, and display === billed is preserved because the
Results screen and Copy-summary both route through the same `computePersonShareFromClaims`.

The most serious issue is in the `update_currency` server op: its non-atomic
GET→mutate→SET writes the **entire** session back, so any concurrent claim, tip, or
add-person write that lands between this op's read and write is silently clobbered. This is a
genuine data-loss window that goes beyond the documented "currency last-write-wins"
acceptance (T-10-05), because it loses *other* fields, not just the currency. The rest of the
findings are robustness and correctness-edge concerns (non-ISO / 3-decimal currency codes,
in-flight currency double-submit, copy-fallback feedback gaps).

No structural findings block was provided.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `update_currency` clobbers concurrent claim/tip/person writes (data loss) — RESOLVED

**File:** `app/api/session/[sessionId]/edit/route.ts:238-243`
**Issue:** The `update_currency` branch does a non-atomic read-modify-write that serializes the
**whole** session object back to Redis:
```ts
const updated: SessionPayload = { ...session, currencyCode: b.currencyCode as string }
await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
```
`session` was read at line 187 (`redis.get`). The `claim` route (see `claim/route.ts`)
deliberately uses a Lua script *specifically because* concurrent writes to `claims.items` are
expected and a plain GET→SET would lose them. The same exposure applies here: if person B taps
an item (claim write) or confirms a tip (tip write) in the window between this route's
`redis.get` and `redis.set`, that change is overwritten by the stale `session` snapshot held
here. The accepted T-10-05 risk is "two people set currency, last write wins" — that is benign.
This is different: changing currency can erase another person's claims/tips. Currency changes
happen on the Results screen while other people are still actively claiming, so the window is
realistically hit.
**Fix:** Move the currency mutation into a Lua script (mirror `ADD_PERSON_SCRIPT` /
`QTY_CLAIM_SCRIPT`) that decodes, sets `session.currencyCode`, and re-encodes atomically:
```lua
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end
session.currencyCode = ARGV[1]
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
```
This makes the field-level update atomic and eliminates the cross-field clobber. (The same
latent issue exists for the other `/edit` ops, but those were out of this phase's scope; the
new `update_currency` op adds a fresh write path that fires during active claiming, so it
warrants the atomic treatment now.)

## Warnings

### WR-01: 3-decimal currencies misformat amounts (divisor mismatch with stored cents)

**File:** `lib/billMath.ts:32-35`
**Issue:** `formatCents` derives the divisor from `Intl.NumberFormat(...).resolvedOptions().minimumFractionDigits`.
For 3-decimal ISO currencies (BHD, KWD, OMR, TND) this returns `3`, giving `divisor = 1000`.
But every amount in this app is stored as integer 1/100 units ("cents"). Dividing a
1/100-unit value by 1000 renders it 10x too small (e.g., `formatCents(1250, 'KWD')` →
`1.250` instead of the intended `12.50`). The `update_currency` op accepts any ≤10-char string
(WR-04), and the Results `<select>` will include `session.currencyCode` even if it is a
3-decimal code, so this is reachable. None of the 9 `COMMON_CURRENCIES` are 3-decimal, which
masks it today.
**Fix:** The storage model is 2-decimal-fixed, so the display divisor should be too. Clamp the
decimals used for the divisor to 2, or always divide by 100 and only let `Intl` control the
*rendered* fraction digits:
```ts
const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode })
return fmt.format(cents / 100) // amounts are always stored in 1/100 units
```
Note this also affects zero-decimal currencies: `formatCents(1250, 'JPY')` with `/100` yields
`¥13` (rounded) rather than `¥1,250`. Decide deliberately whether stored "cents" for a
JPY-denominated bill mean whole yen or 1/100 yen, and make the divisor logic match that
contract instead of inferring it from `Intl`.

### WR-02: Rapid currency changes race; no in-flight guard on the select

**File:** `components/split/PersonResultsScreen.tsx:244-255` and `app/split/[sessionId]/CollaborativeClaimingView.tsx:420-427`
**Issue:** The currency `<select>` calls `void handleCurrencyChange(e.target.value)` on every
change with no disabled/pending state. `handleCurrencyChange` in the parent fires a POST then
`mutate()` with no abort or sequencing. Two quick changes (USD→EUR→GBP) issue two overlapping
POSTs; combined with CR-01's whole-session write and SWR revalidation timing, the persisted
currency can settle on the earlier selection. The controlled `value={currencyCode}` also won't
reflect the pending choice until the round-trip completes, so the UI can appear to "snap back."
**Fix:** Track a pending state, disable the select while a change is in flight, and/or
optimistically update via `mutate(optimistic, false)` so the UI reflects the new code
immediately and the last user action wins deterministically.

### WR-03: `handleCurrencyChange` ignores POST failures

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:420-427`
**Issue:** The function does not check `res.ok` and has no `catch`:
```ts
async function handleCurrencyChange(newCode: string) {
  await fetch(`/api/session/${sessionId}/edit`, { ... })
  await mutate()
}
```
If the server returns 400 (e.g., a rejected `currencyCode`) or the network throws, the user gets
no feedback; `mutate()` then refetches and the select silently reverts to the old value with no
explanation. Every other write path in this file (`submitDone`, `handleDeleteItem`,
`handleInlineSubmit`) checks `res.ok` and surfaces an error.
**Fix:** Check `res.ok`, and wrap in try/catch; surface a user-visible error (consistent with the
`copyError`/`doneError` patterns already in the codebase) when the currency change fails.

### WR-04: `update_currency` accepts arbitrary non-ISO codes (no allow-list)

**File:** `app/api/session/[sessionId]/edit/route.ts:81-89`
**Issue:** Validation only checks `typeof === 'string'`, non-empty, and `length <= 10`. Any
junk value ("evil", "ABCDEFGHIJ", "<b>") is persisted as the session currency. On render,
`formatCents` catches the `Intl` throw and falls back to `$X.XX`, so there is no crash and no
XSS (React escapes the `<option>` text), but the bad code is durably stored, shows up verbatim
as a dropdown option, and silently degrades every amount to a dollar-sign fallback for all
participants until someone resets it. This is a shared-state abuse vector for any participant who
knows the sessionId.
**Fix:** Validate against an allow-list of supported ISO 4217 codes (the app already maintains
`COMMON_CURRENCIES`), or at minimum verify the code is accepted by `Intl.NumberFormat` server-side
before persisting:
```ts
try { new Intl.NumberFormat('en', { style: 'currency', currency: b.currencyCode }) }
catch { return { ok: false, error: 'Invalid update_currency: unsupported currency code' } }
```

### WR-05: Copy-summary success via `execCommand` fallback shows feedback but `aria-label` correctness only covers clipboard path; error state not reset on later success

**File:** `components/split/PersonResultsScreen.tsx:71-111`
**Issue:** Two sub-issues in `handleCopySummary`:
1. `setCopyError(null)` is called at the top, which is correct, but the success branches do not
   clear a stale error in all interleavings — once `copyError` is set and then a later copy
   succeeds via the clipboard branch, the early `setCopyError(null)` handles it, so this is OK;
   however the `execCommand` success path (line 105-107) sets `copied` but the inline error alert
   relies solely on the top-of-function reset. This is fine functionally but fragile.
2. The bigger issue: `document.execCommand('copy')` is deprecated and returns `true` on some
   browsers even when the copy did not actually occur (e.g., due to permissions), producing a
   false "Copied!" confirmation. There is no verification that the clipboard actually received the
   text.
**Fix:** Prefer the async clipboard API and treat `execCommand` strictly as a best-effort
fallback; consider not claiming success ("Copied!") on the `execCommand` path, or gate the
fallback behind a feature/permission check. At minimum, keep the early `setCopyError(null)` and
ensure the success branches are the only ones that set `copied`.

### WR-06: Largest-remainder `allSingle` path silently diverges when quantities are mixed

**File:** `lib/billMath.ts:147-159`
**Issue:** `computePersonShareFromClaims` switches between two split algorithms based on
`allSingle = (item.quantity ?? 1) <= 1 && sharerIds.every(p => claimsForItem[p]?.qty === 1)`.
When `allSingle` is false (any claimant holds qty > 1, or `item.quantity > 1`), it falls back to
`Math.round(price * myQty / totalQty)` per claimant. That rounding does **not** conserve cents:
for a $10.00 item split 3 ways at qty 1-1-1 but with `item.quantity = 3` (so `allSingle` is
false), each share is `round(1000 * 1 / 3) = 333`, summing to 999 — one lost cent, and it will
not match the grand total (which is items-only `computeSubtotalCents`). The Copy summary sums
these per-person `itemSubtotal`s and can therefore print a per-person total that is a cent short
of "Total:". The comment at lines 140-146 explicitly calls out this exact failure mode for the
`allSingle` case but the non-single multi-claimant case still has it.
**Fix:** Apply the largest-remainder method to the multi-claimant proportional case as well
(distribute the rounding remainder deterministically by sorted personId), so summed shares always
equal `item.priceCents` and the per-person figures reconcile with the grand total.

## Info

### IN-01: `update_currency` resets the 24h TTL rather than preserving remaining TTL

**File:** `app/api/session/[sessionId]/edit/route.ts:242`
**Issue:** The summary describes "TTL preservation," but `redis.set(..., { ex: 86400 })` resets
the session's TTL to a fresh 24h on every currency change. This matches every other op in the
file and the `tip` route, so it is consistent, not a regression — but it is not "preservation."
A bill could be kept alive indefinitely by repeatedly touching the currency.
**Fix:** If true preservation is intended, read the remaining TTL (`redis.ttl`) and re-apply it,
or use `KEEPTTL` semantics. Otherwise update the summary wording to "TTL refreshed to 24h."

### IN-02: Unused import `Share2`? (verified used) — and unused legacy `TipScreen` page chrome removed cleanly

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:16,26`
**Issue:** Confirmed `Share2` is used (line 802) and `TipScreen` is used (line 566); no dead
imports here. Noting for completeness since the file was heavily rewired. No action needed.
**Fix:** None.

### IN-03: `handleCurrencyChange` wrapper in PersonResultsScreen is a redundant pass-through

**File:** `components/split/PersonResultsScreen.tsx:122-124`
**Issue:** `async function handleCurrencyChange(newCode) { await onCurrencyChange(newCode) }` adds
nothing over calling `onCurrencyChange` directly in the `onChange` handler. Harmless, but it is
indirection that obscures the data flow.
**Fix:** Call `void onCurrencyChange(e.target.value)` directly in the select's `onChange`, or
keep the wrapper only if you add the pending/error handling from WR-02/WR-03 inside it.

### IN-04: Magic numbers for TTL and tip caps duplicated across routes

**File:** `app/api/session/[sessionId]/edit/route.ts:43,242,251` and `tip/route.ts:31`
**Issue:** `86400` (TTL seconds), `MAX_TIP_CENTS = 100_000`, and `MAX_TIP_PERCENT = 100` appear as
inline literals across multiple files. Drift between them (e.g., changing TTL in one place) would
be easy to miss.
**Fix:** Extract shared constants (`SESSION_TTL_SECONDS`, `MAX_TIP_CENTS`) into a shared module so
all routes reference one source of truth.

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
