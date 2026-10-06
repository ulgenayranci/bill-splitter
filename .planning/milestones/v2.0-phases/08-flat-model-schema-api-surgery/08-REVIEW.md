---
phase: 08-flat-model-schema-api-surgery
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - app/api/session/[sessionId]/edit/route.ts
  - app/api/session/[sessionId]/claim/route.ts
  - app/api/session/[sessionId]/route.ts
  - app/api/session/route.ts
  - app/split/[sessionId]/CollaborativeClaimingView.tsx
  - components/split/ClaimableItemCard.tsx
  - components/wizard/ShareLinkButton.tsx
  - lib/sessionSchema.ts
  - stores/useBillStore.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-06-06
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 8 removed host-role concepts, added a flat `/edit` route, threaded `currencyCode`, and
hand-audited the claim Lua. The headline guarantees hold up: the CR-03 atomic bounds check is
preserved correctly inside `QTY_CLAIM_SCRIPT` (net-change math is right), the slot script is
race-safe, `GET` no longer needs to strip secrets, and the `/edit` op discrimination is sound.

However the surgery left a real authorization hole and several dangling host artifacts. The most
serious finding is that **neither claim script nor the slot/qty path validates `personId` against
`session.people`** — any caller with the link can write claims/slots/tips for arbitrary, even
non-existent, person IDs, poisoning every other guest's view and the final math. There are also
stale host comments in adjacent files that now describe logic that no longer exists, which will
mislead the next maintainer.

## Critical Issues

### CR-01: Claim route accepts arbitrary `personId` — no membership check against `session.people`

**File:** `app/api/session/[sessionId]/claim/route.ts:71-89` (slot) and `:12-63` (qty)
**Issue:** `validateBody` only checks that `personId` is a non-empty string. Neither
`SLOT_CLAIM_SCRIPT` nor `QTY_CLAIM_SCRIPT` verifies that `personId` exists in `session.people`.
Any client holding the share link can:
- Claim `personSlots[<arbitrary id>] = true`, occupying or fabricating identity slots that no
  real person can ever reconcile.
- Write `claims.items[itemId][<arbitrary id>] = {qty}` for a person who is not on the bill.
  This inflates `totalClaimedQty` in `ClaimableItemCard` and `allItemsFullyClaimed`, blocking
  legitimate guests from claiming (the bounds check `(totalClaimed - myExisting + qty) > itemQuantity`
  counts the phantom claim) and corrupting `computePersonShareFromClaims`.

In the flat model the share link is the only gate, so this is the trust boundary — and it is
currently open to writing state for principals that are not part of the bill. This is a data-integrity
/ authorization defect, not a theoretical one: a single malformed request permanently wedges a
session until TTL expiry.
**Fix:** Validate `personId` membership inside both Lua scripts so the check is atomic with the write:
```lua
-- after decoding session, before any mutation:
local personId = ARGV[1]   -- (ARGV[2] for the qty script)
local isMember = false
for _, p in ipairs(session.people or {}) do
  if p.id == personId then isMember = true; break end
end
if not isMember then return 'unknown_person' end
```
Then map `'unknown_person'` to a 400 in both branches of the POST handler. (A pre-Lua TS check
against the GET'd session would also close the hole but reintroduces a TOCTOU window for the qty
path the CR-03 audit specifically removed — keep it in Lua.)

## Warnings

### WR-01: `add` op has no server-side upper bounds on `name`, `priceCents`, or `quantity`

**File:** `app/api/session/[sessionId]/edit/route.ts:21-28`
**Issue:** The `add` op accepts any positive integer `priceCents`/`quantity` and any non-empty
`name`. The client add path (`CollaborativeClaimingView.tsx:262`) caps quantity with
`Math.max(1, ...)` but applies **no upper bound** (the edit path caps at 99 via
`Math.min(99, ...)` — inconsistent). A direct API caller can inject `quantity: 1e9` or a
multi-megabyte `name`, bloating the <5KB session blob the architecture assumes and breaking the
Lua `for` loops / Upstash value-size limits.
**Fix:** Add server-side caps mirroring the client, e.g.:
```ts
if ((b.quantity as number) > 99) return { ok:false, error:'Invalid add: quantity too large' }
if ((b.name as string).length > 100) return { ok:false, error:'Invalid add: name too long' }
if ((b.priceCents as number) > 100_000_00) return { ok:false, error:'Invalid add: price too large' }
```
Apply the same caps to `edit_name` (`newName`), `edit_price` (`newPriceCents`), and
`edit_quantity` (`newQuantity`).

### WR-02: `add` / `edit_name` accept whitespace-only names

**File:** `app/api/session/[sessionId]/edit/route.ts:22-23, 46-47`
**Issue:** Validation uses `b.name.length === 0` / `b.newName.length === 0`, which passes a
`"   "` (whitespace-only) string. The client trims before sending (`.trim()` at line 254/267),
but the server is the trust boundary and a direct caller can persist a blank-looking item.
**Fix:** Trim before the length check and store the trimmed value:
```ts
const name = typeof b.name === 'string' ? b.name.trim() : ''
if (name.length === 0) return { ok:false, error:'Invalid add: name must be a non-empty string' }
// ...later: name: name  (not b.name as string)
```

### WR-03: Stale host-token comments describe logic that no longer exists

**File:** `app/split/[sessionId]/page.tsx:3-4`, `components/split/PersonSlotPicker.tsx:3-5`
**Issue:** Phase 8 removed all host concepts, but these comments still claim "hostToken moved to
URL fragment (#hostToken=...) ... The CollaborativeClaimingView client component reads it from
window.location.hash" and "host identity derives from URL hostToken match in
CollaborativeClaimingView." The reviewed `CollaborativeClaimingView.tsx` reads no hash and has no
host logic. These comments are now actively false and will send the next maintainer hunting for
hash-parsing code that does not exist.
**Fix:** Delete the host/hostToken comment blocks in both files. (Both files are outside the
phase-8 changed set but are directly contradicted by the flat-model surgery; flagging per
cross-reference.)

### WR-04: `useEffect` auto-advance omits `phase`-stable deps and risks stale `selectedPersonId`

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:115-119`
**Issue:** The effect reads `selectedPersonId` inside the guard but it is also a dep, which is
fine; however `allItemsFullyClaimed(session)` is recomputed every render the deps change — the
real concern is the missing exhaustive-deps coverage will be flagged by lint and the effect can
fire `setPhase('results')` even when the user has navigated to `tip`/`results` and back, because
the guard only checks `phase === 'waiting'`. This is benign today but fragile. Lower-severity than
a logic bug, but it is a correctness smell around the polling state machine.
**Fix:** No behavior change strictly required, but make the dependency intent explicit and gate on
a single derived boolean to avoid re-entry:
```ts
const fullyClaimed = useMemo(() => session ? allItemsFullyClaimed(session) : false, [session])
useEffect(() => {
  if (phase === 'waiting' && selectedPersonId && fullyClaimed) setPhase('results')
}, [phase, selectedPersonId, fullyClaimed])
```

### WR-05: Server's specific `edit_quantity` rejection reason is discarded by the client

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:292-298`
**Issue:** The server returns a precise 400 message
(`Cannot reduce quantity to N: M units are already claimed`, edit route line 65-69), but the
client maps every non-OK response to a generic `"Couldn't save — try again"`. A host trying to
reduce quantity below the claimed count gets a misleading "try again" that will never succeed,
with no indication of why.
**Fix:** Parse the error body on `!r.ok` and surface `error` when present:
```ts
if (!r.ok) {
  const msg = await r.json().catch(() => null)
  setInlineForm({ ...inlineForm, error: msg?.error ?? "Couldn't save — try again" })
  return
}
```

### WR-06: `redis.eval` result compared against string literals without typing the return

**File:** `app/api/session/[sessionId]/claim/route.ts:142-156, 161-175`
**Issue:** `redis.eval(...)` returns `unknown`/`Promise<unknown>`; the code compares `result ===
'session_not_found'` etc. If the Upstash client ever returns the Lua reply boxed (e.g. as
`{ result: 'OK' }` or a different wire shape across SDK versions), every comparison silently
falls through to the success branch `NextResponse.json({ ok: true })`, masking `qty_exceeded` /
`slot_taken` / `invalid_session`. There is no `default`/else that treats an unrecognized reply as
an error.
**Fix:** Coerce and add an explicit unknown-reply guard:
```ts
const result = String(await redis.eval(QTY_CLAIM_SCRIPT, [...], [...]))
// ...after the known-status checks:
if (result !== 'OK') {
  console.error('Unexpected claim reply:', result)
  return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
}
return NextResponse.json({ ok: true })
```

## Info

### IN-01: `edit_quantity` claim-sum loop duplicates Lua logic with no shared helper

**File:** `app/api/session/[sessionId]/edit/route.ts:58-64` vs `claim/route.ts:38-46`
**Issue:** `totalClaimed` is computed by hand-rolled `Object.values(...)` reduction in TS and again
in Lua. Two implementations of the same invariant will drift. Documentation only — not a bug today.
**Fix:** Extract a `sumClaimedQty(claimsForItem)` TS helper and reuse it in the edit route and any
future TS-side bounds checks; keep the Lua copy but reference the helper in a comment.

### IN-02: `add` op does not enforce `quantity >= claimed` symmetry that `edit_quantity` enforces

**File:** `app/api/session/[sessionId]/edit/route.ts:21-28`
**Issue:** Not reachable today (a freshly added item has no claims), but the asymmetry between
`add` (no claim check) and `edit_quantity` (claim check) is worth a comment so a future refactor
that reuses `add` for upserts doesn't silently skip the bounds check.
**Fix:** Add a one-line comment noting `add` is claim-free by construction.

### IN-03: `ClaimableItemCard` reads `entry.qty` without null guard in two reducers

**File:** `components/split/ClaimableItemCard.tsx:37-38, 44-46`
**Issue:** `claimsForItem[...]` entries are typed `ClaimEntry` (`{ qty: number }`), but the server
Lua can leave a stale shape if a `{qty:0}` slips through (the qty script deletes 0-claims, so this
is currently safe). The reducer at line 44-46 uses `entry.qty` directly while
`CollaborativeClaimingView.allItemsFullyClaimed` defensively uses `e?.qty ?? 0`. Inconsistent
defensiveness.
**Fix:** Use `entry?.qty ?? 0` in `ClaimableItemCard` reducers for consistency with the view.

### IN-04: Inconsistent quantity clamping between add and edit client paths

**File:** `app/split/[sessionId]/CollaborativeClaimingView.tsx:262` vs `:273`
**Issue:** Add uses `Math.max(1, parseInt(...) || 1)` (no upper bound); edit uses
`Math.max(1, Math.min(99, ...))`. A user can add an item with qty 500 but cannot edit one to 500.
Confusing UX; the real fix is server-side (WR-01).
**Fix:** Apply `Math.min(99, ...)` to the add path too.

### IN-05: `PublicSessionPayload` alias is now a no-op type but still re-exported

**File:** `lib/sessionSchema.ts:28-33`
**Issue:** `PublicSessionPayload = SessionPayload` is kept only so existing imports compile. This is
intentional and documented, but it is dead indirection — callers importing `PublicSessionPayload`
now get the full payload and a reader may assume a real "safe subset" still exists.
**Fix:** Optional — migrate importers to `SessionPayload` and remove the alias in a cleanup pass,
or keep the comment as-is. No action required this phase.

---

_Reviewed: 2026-06-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
