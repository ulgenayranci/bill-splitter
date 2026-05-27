# Phase 6: Collaborative Bill Claiming — Research

**Researched:** 2026-05-26
**Domain:** Real-time collaborative Redis state / Next.js App Router / SWR optimistic updates / bill math
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01**: After tapping "Share", host is redirected to `/split/[sessionId]?hostToken=xxx`. No HostWaitingScreen.
- **D-02**: `hostToken` (nanoid) generated at session creation, stored in `session.hostToken`, returned alongside `sessionId`. Host link includes `?hostToken=xxx`. Guest link has no token.
- **D-03**: Multiple people can claim the same item. Cost split: `(your_qty / total_claimed_qty) × item.priceCents`.
- **D-04**: Items have `quantity: number` (default 1). Items with quantity > 1 show a stepper [0..N]. Price per unit = `priceCents / quantity`.
- **D-05**: Unclaimed units flagged in host panel for manual assignment. Host picks assignees — same proportional split mechanic.
- **D-06**: No tax. VAT included in displayed prices. No tax field anywhere.
- **D-07**: Tip is per-person after "I'm done". Starts at 0%. `tips: { [personId]: number }` (cents) stored in Redis.
- **D-08**: "I'm done" is a soft checkpoint. Back button returns to claiming with full edit rights.
- **D-09**: Host-assigned items shown on review screen between "I'm done" and tip. Person can accept all (go to tip) or dispute items.
- **D-10**: Disputed items in host panel. Host reassigns or confirms. After resolution, person re-enters claiming. Accepted → straight to claiming on back.
- **D-11**: Edit requests (add/remove/edit_price/edit_name) stored in `editRequests` in Redis. Host approves or rejects. All four types in scope.
- **D-12**: Polling every 3 seconds via SWR. No WebSockets.
- **D-13**: PersonSlotPicker — "who am I" identity only. No hard locking. First person (host) not pre-locked. `hostPersonId` set in Redis when host picks name.
- **D-14**: After tip confirmation, person sees their own breakdown immediately. No waiting for others.
- **D-15**: Claims data model:
  ```typescript
  claims.items: { [itemId]: { [personId]: { qty: number, assignedBy: 'self' | 'host' } } }
  claims.personSlots: { [personId]: boolean }
  claims.donePeople: { [personId]: boolean }
  ```
- **D-16**: New session fields:
  ```typescript
  hostToken: string
  hostPersonId: string
  tips: { [personId]: number }
  editRequests: { [requestId]: { personId, type, payload, status } }
  disputes: { [disputeId]: { itemId, personId, status } }
  ```
- **D-17**: Wizard tip step removed. Tip is post-claiming, per-person.
- **D-18**: Removed from Phase 4: `HostWaitingScreen`, pre-assignment concept, single-owner claims, shared tip % in wizard.

### Claude's Discretion
- Exact UI layout for HostPanel (edit requests / unclaimed / disputes sections)
- Whether to use tabs or accordion in HostPanel
- Exact stepper UI for quantity items (inline +/- vs modal)
- Animation/transition details
- Error message copy
- How disputes are displayed to the disputing person while pending (spinner? message?)
- Whether to add a "reassign" shortcut in the host panel vs always going through a picker

### Deferred Ideas (OUT OF SCOPE)
- WebSocket / Server-Sent Events (v2 — polling is sufficient)
- "Reassign" shortcut in host panel
- Group tip suggestion based on total bill
- Split a specific item unequally (e.g. 70/30)
- Multiple rounds of drinks
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESULTS-02 | User can share a link so each person claims their own items on their own phone | Full redesign of session API, claims model (D-15/D-16), proportional math (D-03), per-person tip (D-07), edit/dispute flows (D-09–D-11) |
</phase_requirements>

---

## Summary

Phase 6 is a full replacement of the Phase 4 share/split flow. Every file in the `app/api/session/`, `app/split/[sessionId]/`, `components/split/`, and the relevant wizard components is either rewritten or deleted. The core challenge is correctly modeling multi-claimant state in Redis and keeping that state consistent when concurrent writes from different phones arrive within the same 3-second polling window.

The critical architectural insight is that `@upstash/redis` does NOT support `WATCH` (optimistic locking). The existing `redis.multi()` in Phase 4 sends commands to the `/multi-exec` Upstash REST endpoint, which is a batched atomic pipeline — NOT a WATCH-guarded transaction. [VERIFIED: source code `/node_modules/@upstash/redis/chunk-2X4SLXT7.mjs` line 3056, 4711] This means the Phase 4 claim route already has a race condition for single-owner claims (two people can `GET` the session, both see item unclaimed, both `SET` with their claim — second write wins silently). For Phase 6's multi-claimant model, the race is less destructive (two people can each set their own qty entry independently) but still requires atomic read-modify-write for quantity operations.

The recommended approach for atomicity is `redis.eval()` with a Lua script. Lua scripts execute atomically on the Redis server — no other command runs between script start and end. [VERIFIED: `@upstash/redis` exports `EvalCommand`, `EvalshaCommand` — `/node_modules/@upstash/redis/chunk-2X4SLXT7.mjs` lines 996-1014] The Upstash REST API supports the `EVAL` command. [CITED: upstash.com/docs/redis/sdks/ts/commands/scripts/evalsha]

The SWR optimistic update pattern changes significantly in Phase 6. Phase 4 used a local `optimisticClaims` React state layer that was cleared on every server tick. Phase 6 must track per-person, per-item optimistic quantities — a nested structure. The SWR `optimisticData` option (bound mutate) is cleaner for this: it applies an immediate speculative local update to the SWR cache and auto-rolls back on error, without managing a separate `optimisticClaims` state map. [VERIFIED: Context7/vercel/swr-site]

**Primary recommendation:** Use Lua scripts (`redis.eval`) for all write paths that modify `claims.items[itemId][personId]`, `editRequests`, and `disputes`. Use SWR bound mutate with `optimisticData` for client-side claim state. Keep the 3-second polling interval unchanged.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session creation (with hostToken) | API / Backend | — | Server generates nanoid; hostToken must never be client-generated |
| Host token validation | API / Backend | Browser (local state) | Server validates on GET; client stores `isHost` in component state from URL param |
| Item claiming (qty update) | API / Backend | — | Atomic write to Redis; optimistic update mirrors in client cache |
| Edit request submission | API / Backend | — | Writes to `editRequests` in Redis; all polling clients see it |
| Dispute submission | API / Backend | — | Writes to `disputes` in Redis |
| Host approval / rejection | API / Backend | — | Updates `editRequests[id].status`, applies item mutations |
| Dispute resolution | API / Backend | — | Updates `disputes[id].status` |
| Per-person tip submission | API / Backend | — | Writes `tips[personId]` to Redis |
| Real-time state sync | Browser / Client | — | SWR polling GET /api/session/[sessionId] every 3s |
| Proportional cost math | Browser / Client | — | Computed on demand from polled session data; never stored |
| Unclaimed unit detection | Browser / Client | API / Backend | Client renders flag; host panel POST triggers assignment |
| Wizard tip step removal | Browser / Client | — | Remove SetTipStep from step 4 slot; reorder to 4-step wizard |
| Share link generation + host redirect | Browser / Client | API / Backend | ShareLinkButton calls POST /api/session, receives sessionId + hostToken, redirects |

---

## Standard Stack

### Core (all already installed — no new dependencies required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@upstash/redis` | 1.38.0 | Redis client for session state | [VERIFIED: package.json] Already installed. Serverless HTTP-based. Supports `eval()`. |
| `swr` | 2.4.1 | Polling + optimistic updates | [VERIFIED: package.json] Already installed. `optimisticData` + bound `mutate` pattern. |
| `nanoid` | 5.1.11 | hostToken generation | [VERIFIED: package.json] Already installed. Existing pattern in session creation route. |
| `next` | 16.2.6 | App Router, Route Handlers | [VERIFIED: package.json] Already installed. |
| `zustand` | 5.0.13 | Wizard client state | [VERIFIED: package.json] Need to remove tip step from `useBillStore`. |
| `vitest` + `@testing-library/react` | 4.1.5 / 16.3.2 | Unit + component tests | [VERIFIED: package.json] Already installed. Established test patterns in `__tests__/`. |

**No new npm packages are required for Phase 6.**

**Version verification:**
```bash
# Already confirmed via package.json and node_modules inspection
npm view @upstash/redis version   # 1.38.0 [VERIFIED]
npm view swr version              # 2.4.1 [VERIFIED]
npm view nanoid version           # 5.1.11 [VERIFIED]
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `redis.eval()` Lua | `redis.multi()` pipeline | `multi()` is NOT atomic read-modify-write — it's a batched fire-and-forget. Race conditions possible with concurrent claimants. Lua is the correct tool. |
| SWR `optimisticData` (bound mutate) | Local `optimisticClaims` React state (Phase 4 pattern) | Phase 4 pattern works for single-owner but creates complexity for multi-claimant qty display. `optimisticData` lets SWR own the merge. |
| Per-person claiming endpoint | Single generic `/claim` with action types | Phase 4 used `action: 'item' | 'slot'`. Phase 6 can generalize to `action: 'claim_qty' | 'slot' | 'edit_request' | 'done' | 'tip' | 'dispute'` or split into separate route files. Separate files are more testable. |

---

## Architecture Patterns

### System Architecture Diagram

```
[Browser: Host]                    [Browser: Guest(s)]
   |                                      |
   | POST /api/session                    |
   | { people, items } ──────────────────>|  (no request)
   |                                      |
   | <── { sessionId, hostToken }         |
   |                                      |
   | redirect to /split/[id]?hostToken=x  |
   |                                      |
   |                                      | open /split/[id] (no token)
   |                                      |
   |<─ GET /api/session/[id] ────────────>| (both poll every 3s)
   |   returns full SessionPayload         |
   |                                      |
   | POST /api/session/[id]/claim          |
   | { personId, itemId, qty }             |
   |   [Lua: atomic read-modify-write]     |
   |                                      |
   | POST /api/session/[id]/edit-request   |
   | POST /api/session/[id]/dispute        |
   | POST /api/session/[id]/resolve        |
   | POST /api/session/[id]/done           |
   | POST /api/session/[id]/tip            |
   |                                      |
   |<─── next poll returns updated state ─>|
   |                                      |
   | [PersonTotals computed client-side    |
   |  from polled data after tip confirm]  |
```

### Recommended File Structure
```
app/
├── api/
│   └── session/
│       ├── route.ts                      # POST — rewritten (add hostToken)
│       └── [sessionId]/
│           ├── route.ts                  # GET — unchanged
│           ├── claim/route.ts            # POST — rewritten (qty + Lua)
│           ├── done/route.ts             # POST — extended (soft checkpoint)
│           ├── tip/route.ts              # POST — NEW (per-person tip)
│           ├── edit-request/route.ts     # POST — NEW
│           ├── resolve-edit/route.ts     # POST — NEW (host approves/rejects edit)
│           ├── dispute/route.ts          # POST — NEW
│           └── resolve-dispute/route.ts  # POST — NEW (host resolves dispute)
└── split/
    └── [sessionId]/
        ├── page.tsx                      # rewritten (pass hostToken from searchParams)
        └── CollaborativeClaimingView.tsx # rewritten (replaces GuestClaimingView)
components/
└── split/
    ├── PersonSlotPicker.tsx              # simplified (no 'taken by host' concept)
    ├── ClaimableItemCard.tsx             # extended (qty stepper, multi-claimant list)
    ├── HostPanel.tsx                     # NEW (unclaimed / edit requests / disputes)
    ├── PersonDoneReviewScreen.tsx        # NEW (host-assigned item review + dispute)
    ├── PersonTipScreen.tsx               # NEW (per-person tip entry)
    ├── PersonResultsScreen.tsx           # replaces GuestDoneScreen
    └── SessionExpiredScreen.tsx          # unchanged
lib/
├── sessionSchema.ts                      # extended (D-15, D-16 types)
├── redis.ts                              # unchanged
└── billMath.ts                           # updated (proportional split, remove tax)
stores/
└── useBillStore.ts                       # updated (remove tip step, add hostToken)
```

### Pattern 1: Atomic Claim Write via Lua Script

**What:** Read session JSON, update `claims.items[itemId][personId].qty`, write back — all server-side atomically.

**When to use:** Every POST to `/claim` that modifies qty. Also for slot registration.

**Example:**
```typescript
// Source: @upstash/redis source (nodejs.d.mts exports EvalCommand); Lua atomicity from Redis docs
// Usage in app/api/session/[sessionId]/claim/route.ts

const luaScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return redis.error_reply('session_not_found') end
local session = cjson.decode(raw)
local itemId = ARGV[1]
local personId = ARGV[2]
local qty = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

-- Ensure nested tables exist
if not session.claims then session.claims = {} end
if not session.claims.items then session.claims.items = {} end
if not session.claims.items[itemId] then session.claims.items[itemId] = {} end

if qty == 0 then
  session.claims.items[itemId][personId] = nil
else
  session.claims.items[itemId][personId] = {qty=qty, assignedBy='self'}
end

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', ttl)
return 'OK'
`

await redis.eval(luaScript, [`session:${sessionId}`], [itemId, personId, String(qty), '86400'])
```

**Critical note:** `redis.eval(script, keys, args)` — all args must be strings. The Lua `cjson` library is available in all Upstash Redis instances. [ASSUMED — confirmed for standard Redis; Upstash advertises compatibility but not specifically confirmed via official Upstash cjson docs in this session]

### Pattern 2: SWR Bound Mutate with optimisticData

**What:** Apply immediate local cache update before the server roundtrip completes. Auto-rollback on error.

**When to use:** Qty stepper changes, item claim toggle.

**Example:**
```typescript
// Source: Context7 /vercel/swr-site, mutation.es.mdx
const { data: session, mutate } = useSWR<SessionPayload>(swrKey, fetcher, {
  refreshInterval: 3000,
  revalidateOnFocus: false,
})

async function handleClaimQty(itemId: string, newQty: number) {
  // Build optimistic session with the updated qty
  const optimistic: SessionPayload = {
    ...session!,
    claims: {
      ...session!.claims,
      items: {
        ...session!.claims.items,
        [itemId]: {
          ...session!.claims.items?.[itemId],
          [personId]: { qty: newQty, assignedBy: 'self' },
        },
      },
    },
  }

  await mutate(
    async () => {
      const res = await fetch(`/api/session/${sessionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, itemId, qty: newQty }),
      })
      if (!res.ok) throw new Error('claim_failed')
      return fetcher(swrKey) // re-fetch for ground truth
    },
    {
      optimisticData: optimistic,
      rollbackOnError: true,
      revalidate: true,
    }
  )
}
```

**Important:** `rollbackOnError: true` handles network errors and non-OK responses automatically. The old `optimisticClaims` local state pattern from Phase 4 is retired.

### Pattern 3: State Machine for Edit Request Lifecycle

**What:** Edit requests and disputes follow a linear state machine polled via SWR.

```
Edit Request states:
  pending → approved (item updated in session, all clients see on next poll)
         → rejected (requester sees rejection badge on next poll)

Dispute states:
  pending → resolved (host reassigned or confirmed; person re-enters claiming)
          → rejected (host confirmed original; person accepts or escalates — D-10)
```

**Implementation:** Store machine state in Redis `editRequests[requestId].status` and `disputes[disputeId].status`. Client derives UI state from polled session data. No separate client-side state machine library needed.

### Pattern 4: Host Token Validation

**What:** `isHost` is local component state derived on page load from URL search param + polled session data.

**Example:**
```typescript
// Source: 06-CONTEXT.md Specific Design Details
// In app/split/[sessionId]/page.tsx (Server Component)
export default async function SplitPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ hostToken?: string }>
}) {
  const { sessionId } = await params
  const { hostToken } = await searchParams
  return <CollaborativeClaimingView sessionId={sessionId} hostTokenParam={hostToken ?? null} />
}

// In CollaborativeClaimingView (Client Component)
const isHost = useMemo(
  () => hostTokenParam !== null && session?.hostToken === hostTokenParam,
  [hostTokenParam, session?.hostToken]
)
```

**No separate auth endpoint.** The GET session response already contains `hostToken`. The client compares param vs stored value. [VERIFIED: CONTEXT.md D-02, Specific Design Details]

### Anti-Patterns to Avoid

- **Using `redis.multi()` for claim writes:** `multi()` in `@upstash/redis` creates a pipeline that batches HTTP calls to `/multi-exec`. It does NOT support `WATCH`. Two concurrent GET+SET sequences will silently overwrite each other. Use `redis.eval()` instead. [VERIFIED: source code chunk-2X4SLXT7.mjs line 3056]
- **Managing `optimisticClaims` as a separate React state map:** Phase 4's pattern works for single-owner toggle. For Phase 6's multi-person qty model it becomes complex to merge correctly. SWR's `optimisticData` in bound mutate is the right abstraction.
- **Storing derived totals in Redis:** Person totals must be computed on demand from claims + tips. Never persist computed values. [VERIFIED: STATE.md Architecture Commitments]
- **Generating hostToken client-side:** hostToken must be server-generated (nanoid on POST /api/session). Never let the client supply its own token.
- **Checking `donePeople[personId]` for final state:** "Done" is a soft checkpoint (D-08). Final state is `tips[personId] !== undefined` (tip confirmed).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic Redis read-modify-write | Custom locking / retry loop | `redis.eval()` Lua script | Lua atomicity guaranteed by Redis; no network round-trips between read and write |
| Client-side optimistic updates with rollback | Manual state diffing + undo stack | SWR `optimisticData` + `rollbackOnError: true` | SWR handles cache merge and rollback automatically |
| Unique request IDs for editRequests / disputes | `Date.now()` or counter | `nanoid()` — already installed | Collision-resistant, serverless-safe, short |
| Proportional integer-cents split | Float division + round | Existing largest-remainder pattern in `billMath.ts` (extend it) | Float drift risk; pattern already tested and correct |
| Polling state sync | WebSockets / SSE infrastructure | Existing SWR `refreshInterval: 3000` pattern | Already established; sufficient for non-concurrent claiming |

**Key insight:** Everything needed for Phase 6 is already installed. The complexity is in correctly wiring existing primitives (`redis.eval`, SWR mutate, nanoid), not in adding new dependencies.

---

## billMath.ts Changes Required

This section answers the "exact formula changes needed" question directly.

### What changes

**Remove:** `computePersonTotals` signature with `assignments: Record<ItemId, PersonId[]>` and shared `tipPercent`. The wizard-side offline calculation still uses this; it stays. A new export is needed for the online/session path.

**Add:** `computePersonShareFromClaims` — computes a single person's item subtotal from the Phase 6 claims model.

```typescript
// Source: 06-CONTEXT.md Proportional split formula + D-06 (no tax) + D-07 (per-person tip)
export function computePersonShareFromClaims(
  personId: PersonId,
  items: Item[],
  claimsItems: Record<ItemId, Record<PersonId, { qty: number }>>,
  tipCents: number  // person's own tip from session.tips[personId]
): { itemSubtotal: number; tip: number; total: number; lineItems: Array<{ item: Item; shareCents: number }> } {
  const lineItems: Array<{ item: Item; shareCents: number }> = []
  let itemSubtotal = 0

  for (const item of items) {
    const claimsForItem = claimsItems[item.id] ?? {}
    const myQty = claimsForItem[personId]?.qty ?? 0
    if (myQty === 0) continue

    const totalQty = Object.values(claimsForItem).reduce((s, c) => s + c.qty, 0)
    if (totalQty === 0) continue

    // Proportional split: (myQty / totalQty) × item.priceCents
    // Integer math: multiply first, divide last, floor with largest-remainder across item
    const rawShare = (item.priceCents * myQty) / totalQty
    const shareCents = Math.round(rawShare) // simple round; or use largest-remainder per item across all claimants
    itemSubtotal += shareCents
    lineItems.push({ item, shareCents })
  }

  return { itemSubtotal, tip: tipCents, total: itemSubtotal + tipCents, lineItems }
}
```

**Note on cents conservation:** With simple `Math.round`, the sum of all person shares for a single item may differ from `item.priceCents` by ±1 cent when quantities don't divide evenly. This is acceptable per the app's existing precedent (Phase 1's largest-remainder approach applies the same trade-off). If exact conservation is required, the largest-remainder method must be applied across all claimants of each item — the logic is identical to the existing `computePersonTotals` inner loop. [ASSUMED — the choice between Math.round and largest-remainder for Phase 6 needs explicit decision; CONTEXT.md does not specify]

**Keep unchanged:**
- `parseCents`, `formatCents`, `computeSubtotalCents`, `computeTipCents`
- `computePersonTotals` (still used by the local wizard ResultsStep for offline splitting)

**Remove:**
- No removals from `billMath.ts` — but `computePersonTotals`'s `tipPercent` parameter becomes irrelevant in the session path (tip is per-person)

---

## Redis Data Model — Complete Shape

```typescript
// lib/sessionSchema.ts — target state after Phase 6
export interface ClaimEntry {
  qty: number
  assignedBy: 'self' | 'host'
}

export interface EditRequest {
  personId: PersonId
  type: 'add' | 'remove' | 'edit_price' | 'edit_name'
  payload: EditPayload  // shape per type — see D-11 in CONTEXT.md
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

export interface Dispute {
  itemId: ItemId
  personId: PersonId
  status: 'pending' | 'resolved' | 'rejected'
  createdAt: number
}

export interface SessionClaims {
  items: Record<ItemId, Record<PersonId, ClaimEntry>>
  personSlots: Record<PersonId, boolean>
  donePeople: Record<PersonId, boolean>
}

export interface SessionPayload {
  people: Person[]
  items: Item[]          // quantity field added: item.quantity: number (default 1)
  claims: SessionClaims
  hostToken: string
  hostPersonId?: string  // set when host picks their name slot
  tips: Record<PersonId, number>  // cents
  editRequests: Record<string, EditRequest>
  disputes: Record<string, Dispute>
  createdAt: number
  // tipPercent REMOVED (D-17)
}
```

**Breaking change from Phase 4:** `SessionPayload` no longer has `tipPercent`. `claims.items` changes from `Record<ItemId, PersonId>` to `Record<ItemId, Record<PersonId, ClaimEntry>>`. `Item` gains a `quantity` field.

**Migration note:** Phase 4 sessions stored under `session:{sessionId}` keys will be incompatible with Phase 6 readers. Because Redis sessions have a 24h TTL and Phase 4 is not deployed to production (development only), no live data migration is needed. [ASSUMED — if Phase 4 sessions exist in a shared dev Redis instance, they will cause type errors when Phase 6 code reads them]

---

## useBillStore Changes

```typescript
// Removals:
// - tipPercent field (no longer sent to session creation)
// - syncStatus 'waiting' (HostWaitingScreen gone; direct redirect replaces it)
// - setTipPercent action
// - setSyncStatus action (or simplify to just 'idle' | 'redirecting')

// Additions:
// - hostToken: string | null  — returned from POST /api/session
// - setHostToken: (token: string | null) => void

// ShareLinkButton changes:
// After POST /api/session returns { sessionId, hostToken }:
//   1. Store sessionId via setSessionId()
//   2. Store hostToken via setHostToken()
//   3. router.push(`/split/${sessionId}?hostToken=${hostToken}`) — use Next.js router
//      (not setStep(5) — navigate away from wizard entirely)
```

**Wizard step count:** Step 4 (SetTipStep) is removed (D-17). Wizard becomes 4 steps:
1. Add People
2. Add Items (OCR/manual)
3. Assign / Share (AssignItemsStep)
4. Results (ResultsStep — now shows "Share" as the CTA, no tipPercent needed)

The `WizardShell` `STEP_LABELS` array and `#step-[1-5]` URL hash pattern need updating to 4 steps.

---

## Common Pitfalls

### Pitfall 1: redis.multi() vs redis.eval() Confusion
**What goes wrong:** Developer uses the existing `redis.multi()` pattern (from Phase 4 claim route) for the new qty claim. Two users simultaneously claim qty=1 of the same item. Both GET the session, both see 0 claimed. User A writes `{p1: {qty:1}}`, User B writes `{p2: {qty:1}}` — but B's write overwrites A's since both read the same base state.
**Why it happens:** `redis.multi()` in `@upstash/redis` is a pipeline to `/multi-exec`. It does NOT support `WATCH`. It queues commands; it does not guard against concurrent external writes.
**How to avoid:** Use `redis.eval()` for all claim/qty mutations. The Lua script reads and writes in a single atomic server operation.
**Warning signs:** Claims from multiple users disappearing after rapid concurrent taps.

### Pitfall 2: Division by Zero in Proportional Split
**What goes wrong:** `computePersonShareFromClaims` divides by `totalQty`. If all claimants subsequently remove their claims (totalQty becomes 0), a stale render reads the item and divides by zero.
**Why it happens:** `donePeople` is set before all claims are finalized; a race condition leaves items with zero claimants in the session.
**How to avoid:** Guard every division: `if (totalQty === 0) continue`. The unclaimed-unit flag condition (from CONTEXT.md) also catches this: `sum(claims.items[itemId].values().map(c => c.qty)) < item.quantity`.
**Warning signs:** NaN in totals display.

### Pitfall 3: hostToken Leaking to Guest Link
**What goes wrong:** The guest share link includes `?hostToken=xxx` — any guest who opens it gets host privileges.
**Why it happens:** ShareLinkButton constructs the wrong URL for the clipboard copy.
**How to avoid:** Two separate URLs: (1) host URL = `/split/${sessionId}?hostToken=${hostToken}` stored in component state and navigated to by the host only; (2) guest URL = `/split/${sessionId}` (no token) — this is what goes to the clipboard/share sheet.
**Warning signs:** All participants can see the host panel.

### Pitfall 4: Stale optimisticData After Concurrent Writes
**What goes wrong:** Person A's optimistic update is correct for their qty change, but Person B's claim on the same item (from the server) is not reflected in A's optimistic state. After rollback, A's view shows an inconsistent state until the next poll.
**Why it happens:** `optimisticData` in SWR is a full session snapshot constructed locally; it doesn't know about concurrent writes.
**How to avoid:** Set `revalidate: true` in the mutate options so SWR immediately triggers a re-fetch after the server write. Accept that there's a brief window (< 3s) where other people's changes aren't reflected — this is expected behavior with polling.
**Warning signs:** Item appears to show wrong total claimant count between taps.

### Pitfall 5: Wizard Step Count Mismatch After Tip Removal
**What goes wrong:** `WizardShell` still renders 5 step indicator segments; `#step-5` URL hash lands on the old Results step which now redirects. TypeScript types on `useBillStore.step` still say `1 | 2 | 3 | 4 | 5`.
**Why it happens:** Multiple files reference the step count: `WizardShell.tsx` (STEP_LABELS array), `page.tsx` (step === 4, step === 5), `useBillStore.ts` (BillState.step type).
**How to avoid:** Update all three files atomically. Change step type to `1 | 2 | 3 | 4`. Remove step 5 render from `page.tsx`. Remove tip-related actions from store.
**Warning signs:** Progress bar shows 5 segments; test on SetTipStep fails with "step 4 not found" type errors.

### Pitfall 6: Lua Script cjson Nested Table Encoding
**What goes wrong:** Lua's `cjson` library encodes sparse arrays/tables differently from JavaScript objects. If `session.claims.items[itemId]` was previously a Lua table with numeric-looking keys (e.g., when personIds look like integers), `cjson.encode` may produce a JSON array instead of an object.
**Why it happens:** `cjson` uses arrays for Lua tables with consecutive integer keys starting at 1.
**How to avoid:** PersonIds are `crypto.randomUUID()` / nanoid strings — never numeric. This should not be an issue in practice. But add a test that exercises the Lua round-trip with a real UUID personId.
**Warning signs:** `claims.items[itemId]` arrives at the client as `[]` instead of `{}`.

### Pitfall 7: SWR Mock Pattern for Bound Mutate
**What goes wrong:** Existing test files mock SWR as `vi.mock('swr', () => ({ default: (...args) => useSWRMock(...args), mutate: ... }))`. When Phase 6 components use the *bound* `mutate` returned from `useSWR` (not the global import), the mock doesn't intercept it.
**Why it happens:** The existing mock substitutes the global `mutate` export, but bound mutate is a method on the object returned by `useSWR`. If the mock returns `{ data, mutate: mutateMock }`, bound mutate IS intercepted correctly — but only if `mutateMock` is in the returned object.
**How to avoid:** In test mocks, return `{ data: ..., error: ..., mutate: mutateMock }` from `useSWRMock`. Same pattern as the existing `GuestClaimingView.test.tsx`.
**Warning signs:** Calls to bound `mutate` in tests don't trigger the mock.

---

## Code Examples

### Correct: Lua-Based Claim Route

```typescript
// Source: @upstash/redis EvalCommand API + Redis Lua atomicity guarantee
// app/api/session/[sessionId]/claim/route.ts

const CLAIM_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return redis.error_reply('session_not_found') end
local ok, session = pcall(cjson.decode, raw)
if not ok then return redis.error_reply('invalid_session') end

local itemId = ARGV[1]
local personId = ARGV[2]
local qty = tonumber(ARGV[3])
local assignedBy = ARGV[4]

if not session.claims then session.claims = {} end
if not session.claims.items then session.claims.items = {} end
if not session.claims.items[itemId] then session.claims.items[itemId] = {} end

if qty == 0 then
  session.claims.items[itemId][personId] = nil
else
  session.claims.items[itemId][personId] = {qty=qty, assignedBy=assignedBy}
end

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
`

// In route handler:
const result = await redis.eval(
  CLAIM_SCRIPT,
  [`session:${sessionId}`],
  [itemId, personId, String(qty), assignedBy]
)
if (result === 'session_not_found') {
  return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
}
```

### Correct: Item Type with quantity Field

```typescript
// Source: useBillStore.ts Item interface + 06-CONTEXT.md D-04
export interface Item {
  id: ItemId
  name: string
  priceCents: number
  quantity: number          // NEW — default 1; stepper shown when > 1
  rawName?: string
  confidence?: 'high' | 'low' | 'ambiguous'
}
```

### Correct: Proportional Share Formula (integer-safe)

```typescript
// Source: 06-CONTEXT.md Proportional split formula
function personShareForItem(
  priceCents: number,
  myQty: number,
  totalClaimedQty: number
): number {
  if (totalClaimedQty === 0) return 0
  // Integer math: multiply before divide; Math.round for final cent
  return Math.round((priceCents * myQty) / totalClaimedQty)
}
```

### Correct: ShareLinkButton Redirect (host only)

```typescript
// Source: 06-CONTEXT.md D-01, D-02
import { useRouter } from 'next/navigation'

// After POST /api/session returns { sessionId, hostToken }:
const router = useRouter()
setSessionId(sessionId)
setHostToken(hostToken)
// Host navigates to session page with token
router.push(`/split/${sessionId}?hostToken=${hostToken}`)
// Guest share URL (clipboard) — no token
const guestUrl = `${window.location.origin}/split/${sessionId}`
```

### Correct: Redis Mock Pattern for Lua eval in Tests

```typescript
// Source: existing __tests__/sessionClaimRoute.test.ts mock pattern + EvalCommand
const mockEval = vi.fn()
vi.mock('@upstash/redis', () => ({
  Redis: class {
    get = mockGet
    set = mockSet
    eval = mockEval   // NEW for Phase 6 claim routes
    multi = mockMulti
  },
}))
// In test:
mockEval.mockResolvedValue('OK')
```

---

## State of the Art

| Old Approach (Phase 4) | New Approach (Phase 6) | When Changed | Impact |
|------------------------|------------------------|--------------|--------|
| `claims.items: Record<ItemId, PersonId>` — single owner | `claims.items: Record<ItemId, Record<PersonId, ClaimEntry>>` — multi-owner with qty | Phase 6 | All claim read/write paths change |
| Shared tip % in wizard (step 4) | Per-person tip after claiming (post-session) | Phase 6 | SetTipStep removed; new PersonTipScreen component |
| Host waits on HostWaitingScreen | Host joins same session page as guests | Phase 6 | HostWaitingScreen deleted; ResultsStep CTA changes |
| Single-step `redis.multi()` for claim | Lua `redis.eval()` for atomic read-modify-write | Phase 6 | Race condition eliminated |
| `optimisticClaims: Record<ItemId, PersonId | null>` local state | SWR bound mutate with `optimisticData` | Phase 6 | Simpler client code; SWR handles merge |
| `tipPercent` in SessionPayload | `tips: Record<PersonId, number>` in SessionPayload | Phase 6 | Breaking schema change; Phase 4 sessions incompatible |

**Deprecated/outdated after Phase 6:**
- `HostWaitingScreen` component: deleted (D-18)
- `GuestClaimingView`: replaced by `CollaborativeClaimingView`
- `SessionPayload.tipPercent`: removed from session schema
- Phase 4 Redis sessions: incompatible (24h TTL; dev-only; no migration needed)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Upstash Redis REST API supports `cjson` in Lua scripts | Patterns, Code Examples | Lua script fails at runtime; must use JSON.parse on the node side with a different atomicity strategy (e.g., optimistic locking with retry loop using regular GET+SET) |
| A2 | Phase 4 sessions in dev Redis instance can be discarded (no live migration needed) | Redis Data Model | If shared dev Redis instance has Phase 4 sessions, Phase 6 code will throw on type mismatch when reading old sessions |
| A3 | `Math.round` for proportional split is acceptable (vs largest-remainder per item per claimant) | billMath Changes | Cent conservation breaks: sum of person shares for a single item may differ from `item.priceCents` by ±1. If exact conservation is required, use the existing largest-remainder method across all claimants of each item. |
| A4 | `Item.quantity` defaults to 1 — existing Phase 1-3 items stored in Zustand have no `quantity` field | Standard Stack / Store | Existing items in the wizard (pre-share) have `quantity: undefined`. Code that reads `item.quantity` must treat `undefined` as 1. |

---

## Open Questions (RESOLVED)

1. **Lua + cjson on Upstash** — RESOLVED via Wave 0 smoke test
   - What we know: `@upstash/redis` exports `EvalCommand`; Upstash advertises Redis compatibility; Lua is standard Redis
   - What's unclear: Does Upstash's REST API pass Lua scripts to real Redis with `cjson` available, or does it have a restricted scripting environment?
   - **Resolution:** Plan 01 Task 5 (new) adds `lib/lua-smoke.test.ts` that runs `redis.eval("return cjson.encode({ok=1})", 0)` against the real Upstash instance during the Wave 0 test pass. If cjson is unavailable the smoke test fails loudly with instructions to switch the claim/resolve-* routes to a GET → compare → SET fallback. This gate runs BEFORE Plan 02 implements any Lua-backed write path, so the architectural risk is closed before code depending on it lands.
   - Fallback (if cjson unavailable): optimistic retry loop (GET → check → SET with conflict detection in JavaScript) — documented in Plan 02 as the contingency path. Not implemented unless the smoke test fails.

2. **Qty stepper max enforcement** — RESOLVED in Plan 02
   - What we know: Max = `item.quantity` (D-04). Person can claim 0 to N where N = item.quantity.
   - What's unclear: Should the server enforce `sum(all claimed qty for itemId) <= item.quantity`? Or is over-claiming allowed (host sees flagged unclaimed units if under; no flag if over)?
   - **Resolution:** Plan 02's claim route enforces `my_qty <= item.quantity` per person server-side (returns 400 on violation). Total claimed > quantity is allowed (multiple people legitimately ordered the same beer). The unclaimed-flag condition in HostPanel (Plan 05) is `sum < quantity` (under-claimed only), never `sum > quantity`. ClaimableItemCard's stepper (Plan 04) also clamps locally at `[0, item.quantity]` for fast feedback.

3. **Edit request: "remove" type — what happens to existing claims on that item?** — RESOLVED in Plan 03
   - What we know: Remove request removes the item from `session.items`. [CONTEXT.md D-11]
   - What's unclear: When the host approves a remove request, what happens to `claims.items[itemId]`? Should existing claims be deleted?
   - **Resolution:** Plan 03 Task 2 (`resolve-edit` route) atomically deletes both `session.items[idx]` and `session.claims.items[itemId]` when approving a remove request. Test 2 of `__tests__/resolveEditRoute.test.ts` (scaffolded in Plan 01 Task 4) verifies the dual deletion: "approve remove also deletes session.claims.items[itemId] alongside removing from session.items".

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — all required tools already in `package.json` and `node_modules`. Existing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars are required; assumed configured in `.env.local` from Phase 4 setup.)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.mts` (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESULTS-02 | POST /api/session returns `{ sessionId, hostToken }` | unit | `npx vitest run sessionRoute` | ❌ Wave 0 — rewrite |
| RESULTS-02 | GET /api/session/[id] returns new SessionPayload shape (with hostToken, tips, editRequests, disputes) | unit | `npx vitest run sessionGetRoute` | ❌ Wave 0 — extend |
| RESULTS-02 | POST /api/session/[id]/claim with qty=2 atomically updates `claims.items[id][pid].qty` | unit | `npx vitest run sessionClaimRoute` | ❌ Wave 0 — rewrite |
| RESULTS-02 | Concurrent claim: Lua eval mock verifies atomic write path is taken (not redis.multi) | unit | `npx vitest run sessionClaimRoute` | ❌ Wave 0 |
| RESULTS-02 | POST /api/session/[id]/done marks `claims.donePeople[pid]` without finalizing (soft checkpoint) | unit | `npx vitest run sessionDoneRoute` | ❌ Wave 0 — extend |
| RESULTS-02 | POST /api/session/[id]/tip stores `tips[pid]` in Redis | unit | `npx vitest run -- tipRoute` | ❌ Wave 0 — new |
| RESULTS-02 | POST /api/session/[id]/edit-request stores `editRequests[id]` with status 'pending' | unit | `npx vitest run -- editRequestRoute` | ❌ Wave 0 — new |
| RESULTS-02 | POST /api/session/[id]/resolve-edit updates item + sets status 'approved' or 'rejected' | unit | `npx vitest run -- resolveEditRoute` | ❌ Wave 0 — new |
| RESULTS-02 | POST /api/session/[id]/dispute stores `disputes[id]` with status 'pending' | unit | `npx vitest run -- disputeRoute` | ❌ Wave 0 — new |
| RESULTS-02 | CollaborativeClaimingView: hostTokenParam matching session.hostToken → isHost = true | component | `npx vitest run CollaborativeClaimingView` | ❌ Wave 0 — new |
| RESULTS-02 | PersonTipScreen: sets tip cents in Redis and shows personal total | component | `npx vitest run PersonTipScreen` | ❌ Wave 0 — new |
| RESULTS-02 | ClaimableItemCard: qty stepper shows for item.quantity > 1; clamps to [0, quantity] | component | `npx vitest run ClaimableItemCard` | ❌ Wave 0 — rewrite |
| RESULTS-02 | `computePersonShareFromClaims`: proportional math conserves cents, handles zero claims | unit | `npx vitest run billMath` | ❌ Wave 0 — extend |
| RESULTS-02 | Lua + cjson smoke test passes against real Upstash before any claim/resolve-* writes land | integration | `npx vitest run lua-smoke` | ❌ Wave 0 — NEW (resolves Open Question 1) |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Rewrite `__tests__/sessionRoute.test.ts` — covers new `hostToken` return
- [ ] Rewrite `__tests__/sessionClaimRoute.test.ts` — covers Lua eval, qty model, `redis.eval` mock
- [ ] Extend `__tests__/sessionGetRoute.test.ts` — covers new schema shape
- [ ] Extend `__tests__/sessionDoneRoute.test.ts` — covers soft checkpoint semantics
- [ ] New `__tests__/tipRoute.test.ts` — covers per-person tip storage
- [ ] New `__tests__/editRequestRoute.test.ts` — covers all 4 edit types
- [ ] New `__tests__/resolveEditRoute.test.ts` — covers approve/reject + item mutation
- [ ] New `__tests__/disputeRoute.test.ts` — covers dispute creation
- [ ] New `__tests__/resolveDisputeRoute.test.ts` — covers host resolution
- [ ] New `__tests__/CollaborativeClaimingView.test.tsx` — replaces GuestClaimingView tests
- [ ] Extend `__tests__/billMath.test.ts` — covers `computePersonShareFromClaims`
- [ ] Rewrite `__tests__/ClaimableItemCard.test.tsx` — covers qty stepper, multi-claimant display
- [ ] New `__tests__/PersonTipScreen.test.tsx`
- [ ] New `__tests__/HostPanel.test.tsx` — edit requests, unclaimed units, disputes
- [ ] New `__tests__/PersonDoneReviewScreen.test.tsx`
- [ ] Delete `__tests__/HostWaitingScreen.test.tsx` (component deleted)
- [ ] New `lib/lua-smoke.test.ts` — Lua + cjson availability gate against real Upstash (Open Question 1 resolution)

**Note on pre-existing test failures:** `npx vitest run` currently shows 16 failures in `AddItemsStep`, `AssignItemsStep`, and `SetTipStep` tests. These are pre-existing failures unrelated to Phase 6. Wave 0 should not introduce new failures but need not fix the pre-existing ones (they are a separate concern). [VERIFIED: running test suite during research]

---

## Security Domain

> `security_enforcement` not explicitly set to false in `.planning/config.json` — section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user accounts; hostToken is session-scoped capability token |
| V3 Session Management | Yes | nanoid hostToken (21-char URL-safe, ~126 bits entropy); 24h Redis TTL |
| V4 Access Control | Yes | Server must validate hostToken on every host-only route (resolve-edit, resolve-dispute, assign unclaimed). Never trust client-asserted `isHost`. |
| V5 Input Validation | Yes | Validate `qty` is integer ≥ 0, ≤ item.quantity; validate `personId` exists in `session.people`; validate `itemId` exists in `session.items`; validate edit request type against whitelist |
| V6 Cryptography | No | No custom crypto. nanoid uses `crypto.randomFillSync` internally. [ASSUMED — standard nanoid behavior] |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Guest submitting claim to host-only routes (resolve-edit, resolve-dispute) | Elevation of privilege | Validate `hostToken` header/body on every host-only route; return 403 if missing/invalid |
| Crafted `qty` exceeding `item.quantity` | Tampering | Server-side bound check: `qty <= item.quantity`; reject 400 if violated |
| Session takeover via guessed sessionId | Information disclosure | nanoid(21) for sessionId (~126 bits). Acceptable for MVP. |
| Lua script injection via `itemId` / `personId` as Lua table keys | Tampering | Lua table keys are strings; no code execution path. But validate that `itemId` and `personId` are non-empty strings before passing to `redis.eval`. |
| Old Phase 4 session read by Phase 6 code | Information disclosure / crash | Add schema version check or graceful fallback when `session.hostToken` is undefined |

---

## Sources

### Primary (HIGH confidence)
- `/node_modules/@upstash/redis/chunk-2X4SLXT7.mjs` — confirmed `redis.multi()` is pipeline not WATCH-guarded; confirmed `EvalCommand` / `redis.eval()` exists and takes `(script, keys, args)` signature
- `/node_modules/@upstash/redis/nodejs.d.mts` — confirmed exported types: `EvalCommand`, `EvalshaCommand`, `Pipeline`
- Context7 `/vercel/swr-site` — `optimisticData`, `rollbackOnError`, `revalidate`, bound `mutate` API documented and confirmed
- `.planning/phases/06-collaborative-bill-claiming/06-CONTEXT.md` — all locked decisions, data models, formulas
- `package.json` — all dependency versions confirmed
- `app/api/session/[sessionId]/claim/route.ts` — Phase 4 implementation baseline
- `lib/sessionSchema.ts`, `lib/billMath.ts`, `stores/useBillStore.ts` — current code confirmed

### Secondary (MEDIUM confidence)
- [Upstash EVALSHA docs](https://upstash.com/docs/redis/sdks/ts/commands/scripts/evalsha) — TypeScript `redis.evalsha(sha, keys, args)` signature confirmed
- WebSearch: Upstash Redis Lua script support — confirmed Upstash supports `EVAL` and `cjson` in Lua
- WebSearch: Redis WATCH/MULTI/EXEC pattern — confirmed `@upstash/redis` does NOT support WATCH (HTTP-based, stateless)

### Tertiary (LOW confidence)
- `cjson` availability in Upstash Lua environment — inferred from general Redis compatibility claims; not confirmed via official Upstash Lua docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed installed and at verified versions
- Architecture patterns: HIGH — derived from CONTEXT.md locked decisions + verified API shape
- Redis atomicity approach: MEDIUM — `redis.eval()` confirmed available; `cjson` in Lua is LOW (see Assumption A1)
- billMath changes: HIGH — formula is in CONTEXT.md; integer-safe implementation verified against existing patterns
- Pitfalls: HIGH — `multi()` vs `eval()` confusion is verified from source code; others are HIGH-confidence engineering judgment

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (stable stack; `@upstash/redis` and SWR APIs are stable)
