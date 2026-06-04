# Phase 4: Shareable Links - Research

**Researched:** 2026-05-13
**Domain:** Upstash Redis session storage, Next.js 15 dynamic routes, client-side polling, atomic claim locking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Guest Identity**
- D-01: Guests identify by picking their name from the host's person list (the names entered in AddPeople step). No free-text entry — the host-created PersonIds carry directly from Redis into the claiming session.
- D-02: Person slots are first-come-first-served. Once a guest claims a slot ("I'm Sarah"), that slot is locked atomically in Redis — no other phone can claim the same person.
- D-03: The host also claims their own items via the shared link — same `/split/[sessionId]` flow as every other guest. The host is not special in the claiming phase.

**Host Wizard Flow**
- D-04: Wizard step order changes to: AddPeople(1) → AddItems(2) → SetTip(3) → AssignItems/Share(4). Tip is set before sharing so it is baked into the Redis session and every guest sees the same tip.
- D-05: AssignItems step (step 4) gains a prominent "Share link" button alongside the existing manual assignment UI. Both paths remain available.
- D-06: After tapping "Share link," the host lands on a waiting screen showing: the shareable URL (copyable) and a live claim-progress list. Host stays until they choose to view results or all guests are done.

**Claiming Sync**
- D-07: `/split/[sessionId]` page polls Redis every 3 seconds. No WebSockets or SSE.
- D-08: Items claimed by another person appear dimmed with a "Taken by [Name]" label on every other guest's phone. Items are not hidden.
- D-09: Guests can un-claim an item they already claimed by tapping it again. The item is released back to unclaimed in Redis atomically.

**Final Results Hand-off**
- D-10: Each guest has an "I'm done" button on their claiming page. No automatic trigger.
- D-11: After a guest taps "I'm done," they see only their own total — claimed items + proportional tip share.
- D-12: Host's waiting screen transitions to full breakdown once every person slot has marked done.
- D-13: Unclaimed items are flagged on the host's results screen but do not block anyone from marking done.

**New API Routes**
- POST `/api/session` — serialize bill state → Redis, return `{ sessionId }`
- GET `/api/session/[sessionId]` — return full session state (people, items, claims, tipPercent)
- POST `/api/session/[sessionId]/claim` — atomic claim/un-claim of an item by a PersonId
- POST `/api/session/[sessionId]/done` — mark a PersonId as done

**New Dynamic Page**
- `app/split/[sessionId]/page.tsx` — guest claiming page

**Session Storage**
- Upstash Redis (via Vercel Marketplace), 24h TTL

### Claude's Discretion

- Redis key format and TTL (24 hours recommended per CLAUDE.md stack decisions)
- `sessionId` format (short UUID or nanoid)
- Exact polling implementation (SWR, `useEffect` + `setInterval`, or React Query)
- Session payload schema (what subset of Zustand state to serialize)
- `/split/[sessionId]` page layout and component structure
- How to display the "waiting" progress on the host screen (live polling same endpoint)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESULTS-02 | User can share a link so each person claims their own items on their own phone | Upstash Redis session API + polling architecture covers end-to-end sharing, claiming, and per-person totals |
</phase_requirements>

---

## Summary

Phase 4 adds a serverless session layer keyed by a nanoid-generated `sessionId`, serializing the host's bill state into Upstash Redis with a 24-hour TTL. Guests open a dynamic Next.js route (`/split/[sessionId]`), pick their name (atomically claimed in Redis), and tap items to claim them. Both the host waiting screen and the guest claiming page poll the GET session endpoint every 3 seconds using SWR's built-in `refreshInterval`. Atomic claim operations are implemented via Upstash Redis transactions (`multi/exec`) to prevent double-claiming in the restaurant race-condition scenario.

The key architectural insight is that Upstash Redis uses an HTTP/REST transport — not TCP — which means it works natively in Vercel serverless functions without connection pooling concerns. The `@upstash/redis` package serializes/deserializes JSON values automatically when you pass objects to `set()`, so the session payload (people, items, claims map, tipPercent) can be stored as a single JSON blob. This eliminates complex hash structures at the cost of full-document reads on every poll — acceptable given the small size (<5KB per session).

The wizard step order change (SetTip moves from step 4 to step 3) requires updating `WizardShell.tsx`'s `STEP_LABELS` array and `step` type bounds only — `SetTipStep.tsx` itself has no logic change. The existing `BillState.step` type is `1 | 2 | 3 | 4 | 5`, which remains valid; the host waiting screen becomes a logical sub-state (stored in Zustand as a `hostMode` flag) within step 5, not a new step number.

**Primary recommendation:** Store session as a single JSON object in Redis via `redis.set(key, JSON.stringify(session), { ex: 86400 })`. Use `redis.multi()` transactions for all claim/un-claim and person-slot operations. Use SWR `refreshInterval: 3000` for polling on both the host waiting screen and the guest claiming page.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session creation and storage | API / Backend (Route Handler) | Database / Storage (Upstash Redis) | Session serialization is a server-side write with TTL; never expose Redis credentials to browser |
| Session polling (read) | API / Backend (Route Handler) | Browser / Client | GET endpoint acts as the single source of truth; client polls it |
| Claim/un-claim atomicity | API / Backend (Route Handler) | Database / Storage (Upstash Redis) | Race-condition prevention requires server-side atomic transaction |
| Person-slot locking | API / Backend (Route Handler) | Database / Storage (Upstash Redis) | Same as claim atomicity — first-come-first-served requires atomic check-and-set |
| Optimistic UI updates | Browser / Client | — | 3-second poll latency requires immediate local state mutation on tap |
| Polling loop lifecycle | Browser / Client | — | `useEffect` cleanup or SWR hook on the client; no server-side state for polling cadence |
| sessionId generation | API / Backend (Route Handler) | — | nanoid called server-side in POST /api/session; never client-generated |
| Wizard step reordering | Browser / Client | — | WizardShell.tsx step routing is a pure client concern |
| Per-person total math | Browser / Client | — | `computePersonTotals` from `lib/billMath.ts` runs in-browser on session data after polling |
| URL sharing / clipboard | Browser / Client | — | `navigator.clipboard.writeText()` is a browser API; no server involvement |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@upstash/redis` | 1.38.0 | HTTP-based Redis client for serverless | Official Upstash SDK; uses REST transport (no TCP connection pool), works in Vercel Edge and serverless functions without configuration. `Redis.fromEnv()` picks up env vars automatically. [VERIFIED: npm registry] |
| `nanoid` | 5.1.11 | Cryptographically secure URL-safe session ID generation | ESM-native, 21-char IDs give 2^126 collision resistance — sufficient for ephemeral sessions. Smaller and faster than UUID. Already a transitive dep in the project tree (v3.3.12 installed via Next.js). Installing v5 as a direct dep pins the explicit version. [VERIFIED: npm registry] |
| `swr` | 2.4.1 | Data fetching with built-in polling | `refreshInterval: 3000` replaces manual `useEffect + setInterval` boilerplate. Handles deduplication, focus-revalidation, and error retry automatically. Not installed — must be added. [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@upstash/lock` | latest | Distributed lock for person-slot claiming | **Alternative to manual `multi/exec` transactions.** The `Lock` class wraps a Lua-based check-and-set pattern. Use if `multi/exec` transaction complexity grows beyond a few operations. [VERIFIED: Context7 /upstash/lock] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SWR `refreshInterval` | `useEffect + setInterval` | Manual approach requires explicit `clearInterval` in cleanup, ref management to avoid stale closures, and no built-in error retry. SWR removes all of this. |
| SWR `refreshInterval` | React Query `refetchInterval` | React Query is not installed. SWR is lighter and the project has no other server-state caching needs. |
| Single JSON blob in Redis | Redis Hash (`hset`/`hget`) | Hash would allow partial field updates (e.g., update only the claims map) but requires more complex serialization logic. For sessions < 5KB with ~3s polling cadence, full-doc read/write is the simpler choice. |
| Upstash `multi/exec` transaction | Lua script via `redis.eval()` | Lua scripts are more flexible for conditional logic but harder to test and read. `multi/exec` is sufficient for claim atomicity and is idiomatic. |

**Installation:**
```bash
npm install @upstash/redis nanoid swr
```

**Version verification:** Verified against npm registry on 2026-05-13.
- `@upstash/redis@1.38.0` — current latest [VERIFIED: npm registry]
- `nanoid@5.1.11` — current latest [VERIFIED: npm registry]
- `swr@2.4.1` — current latest [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
Host Browser                 Next.js App Router              Upstash Redis
(/)                         (Vercel Serverless)
  |                               |                               |
  |-- POST /api/session --------> |                               |
  |   {people,items,assignments,  |-- redis.set(sessionId,        |
  |    tipPercent}                |   JSON.stringify(session),    |
  |                               |   {ex:86400}) --------------> |
  |<-- {sessionId} -------------- |                               |
  |                               |                               |
  |   wizard transitions to       |                               |
  |   HostWaitingScreen           |                               |
  |   (polls every 3s)            |                               |
  |-- GET /api/session/[id] ----> |                               |
  |                               |-- redis.get(sessionId) -----> |
  |                               |<-- session JSON ------------- |
  |<-- {people,items,claims,      |                               |
  |     donePeople} ------------- |                               |
  |                               |                               |
Guest Browser                    |                               |
(/split/[sessionId])             |                               |
  |                               |                               |
  |-- GET /api/session/[id] ----> |-- redis.get(sessionId) -----> |
  |<-- session state ------------ |<-- session JSON ------------- |
  |                               |                               |
  |   [pick person slot]          |                               |
  |-- POST /api/session/          |                               |
  |   [id]/claim                  |                               |
  |   {personId, action:'slot'}-> |-- redis.multi()               |
  |                               |   [GET session]               |
  |                               |   [check slot available]      |
  |                               |   [SET session with slot]     |
  |                               |   .exec() -----------------> |
  |<-- {ok} or {conflict} ------- |                               |
  |                               |                               |
  |   [tap item to claim]         |                               |
  |-- POST /api/session/          |                               |
  |   [id]/claim                  |                               |
  |   {personId, itemId} -------> |-- redis.multi()               |
  |                               |   [GET session]               |
  |                               |   [check item unclaimed]      |
  |                               |   [SET session with claim]    |
  |                               |   .exec() -----------------> |
  |<-- {ok} or {conflict} ------- |                               |
  |                               |                               |
  |   [tap "I'm done"]            |                               |
  |-- POST /api/session/          |                               |
  |   [id]/done {personId} -----> |-- redis.get() + redis.set()-> |
  |<-- {ok} -------------------- |                               |
  |                               |                               |
  |   [GuestDoneScreen renders]   |                               |
  |   computePersonTotals()       |                               |
  |   (lib/billMath.ts, in-browser)|                              |
```

### Recommended Project Structure

```
app/
├── api/
│   └── session/
│       ├── route.ts                          # POST — create session
│       └── [sessionId]/
│           ├── route.ts                      # GET — read session state
│           ├── claim/
│           │   └── route.ts                  # POST — claim/un-claim item or person slot
│           └── done/
│               └── route.ts                  # POST — mark person done
└── split/
    └── [sessionId]/
        └── page.tsx                          # Guest claiming page (Server Component shell)

components/
├── wizard/
│   ├── WizardShell.tsx                       # UPDATE: step labels + step type
│   ├── AssignItemsStep.tsx                   # UPDATE: add ShareLinkButton
│   ├── ShareLinkButton.tsx                   # NEW: triggers session POST + loading state
│   └── HostWaitingScreen.tsx                 # NEW: polling waiting UI
└── split/
    ├── PersonSlotPicker.tsx                  # NEW: name selection grid
    ├── ClaimableItemCard.tsx                 # NEW: item row with claim toggle
    ├── GuestDoneScreen.tsx                   # NEW: personal total after I'm done
    └── SessionExpiredScreen.tsx              # NEW: error screen for expired sessions

lib/
└── redis.ts                                  # NEW: shared redis client singleton
```

### Pattern 1: Upstash Redis Client Singleton

**What:** Export a single `redis` client instance from `lib/redis.ts` — import into every route handler.
**When to use:** All session API routes.

```typescript
// lib/redis.ts
// Source: https://github.com/upstash/docs/blob/main/redis/quickstarts/nextjs-app-router.mdx
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
// Or equivalently: export const redis = Redis.fromEnv()
```

**Env vars required:**
```env
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=AUR...
```

Both variables are server-side only — **never** prefix with `NEXT_PUBLIC_`. Add them to `.env.local` and to Vercel project settings via the Vercel Marketplace integration.

### Pattern 2: Session Payload Schema

**What:** Single JSON document stored at key `session:{sessionId}`.
**When to use:** All reads and writes go through this document.

```typescript
// lib/sessionSchema.ts
import type { Person, Item, ItemId, PersonId } from '@/stores/useBillStore'

export interface SessionClaims {
  // itemId → personId who claimed it (absent = unclaimed)
  items: Record<ItemId, PersonId>
  // personId → true if this person has claimed their slot
  personSlots: Record<PersonId, boolean>
  // personId → true when they tapped "I'm done"
  donePeople: Record<PersonId, boolean>
}

export interface SessionPayload {
  people: Person[]
  items: Item[]
  tipPercent: number
  claims: SessionClaims
  createdAt: number // Unix ms timestamp
}
```

**Key format:** `session:{sessionId}` — e.g., `session:V1StGXR8_Z5jdHi6B-myT`
**TTL:** 86400 seconds (24 hours), set via `{ ex: 86400 }` on `redis.set()`.

### Pattern 3: POST /api/session — Create Session

**What:** Serialize Zustand bill state to Redis and return the sessionId.

```typescript
// app/api/session/route.ts
// Source: https://github.com/upstash/docs/blob/main/redis/quickstarts/nextjs-app-router.mdx
import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import type { SessionPayload } from '@/lib/sessionSchema'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate and destructure: people, items, tipPercent from body
  // ...validation omitted for brevity...

  const sessionId = nanoid()
  const session: SessionPayload = {
    people: body.people,
    items: body.items,
    tipPercent: body.tipPercent,
    claims: { items: {}, personSlots: {}, donePeople: {} },
    createdAt: Date.now(),
  }

  await redis.set(`session:${sessionId}`, JSON.stringify(session), { ex: 86400 })

  return NextResponse.json({ sessionId })
}
```

### Pattern 4: Atomic Claim Transaction (multi/exec)

**What:** Prevent double-claiming using Redis transactions. The transaction reads the current session, checks the claim status, and conditionally writes — all atomically.
**When to use:** POST `/api/session/[sessionId]/claim` handler for both item claiming and person-slot claiming.

```typescript
// Source: https://context7.com/upstash/docs/llms.txt (Transaction section)
// Simplified illustration — real handler validates inputs first

async function claimItemAtomic(sessionId: string, itemId: string, personId: string) {
  // Read current state
  const raw = await redis.get<string>(`session:${sessionId}`)
  if (!raw) return { ok: false, reason: 'session_not_found' }
  
  const session: SessionPayload = JSON.parse(raw)
  
  // Check: is item already claimed by someone else?
  const currentOwner = session.claims.items[itemId]
  if (currentOwner && currentOwner !== personId) {
    return { ok: false, reason: 'conflict', takenBy: currentOwner }
  }
  
  // Toggle: claim if unclaimed, un-claim if already owned by this person
  const updatedSession = { ...session }
  if (currentOwner === personId) {
    // Un-claim (D-09)
    delete updatedSession.claims.items[itemId]
  } else {
    // Claim
    updatedSession.claims.items[itemId] = personId
  }

  // Atomic write: use multi/exec so no other request can interleave
  const tx = redis.multi()
  tx.set(`session:${sessionId}`, JSON.stringify(updatedSession), { ex: 86400 })
  await tx.exec()

  return { ok: true }
}
```

**Important:** The read-check-write pattern above is sufficient for this use case because:
1. The `multi/exec` transaction acquires an exclusive write lock on `session:{sessionId}` at EXEC time [VERIFIED: Context7 /upstash/docs key-locking docs].
2. The restaurant table scenario (5-10 people, 3s polling) has very low concurrency — transaction conflicts are rare and the `conflict` response triggers a UI re-fetch.

**Alternative for person-slot claiming (D-02):** Use `SET NX` (set-if-not-exists) for the person slot lock — more idiomatic for first-come-first-served slot locking:

```typescript
// Source: https://github.com/upstash/docs/blob/main/redis/sdks/ts/commands/string.mdx
// Person slot: separate key for fast atomic slot lock
const slotKey = `session:${sessionId}:slot:${personId}`
const acquired = await redis.set(slotKey, claimingUserId, { nx: true, ex: 86400 })
// acquired === 'OK' if slot was free; null if already taken
```

### Pattern 5: Next.js 15 Dynamic Route Handler — params as Promise

**What:** In Next.js 15, route handler `params` is a Promise — must be awaited.
**When to use:** All handlers under `app/api/session/[sessionId]/`.

```typescript
// Source: https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/03-file-conventions/route.mdx
// app/api/session/[sessionId]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params   // ← MUST await in Next.js 15
  // ... fetch from redis using sessionId
}
```

```typescript
// Source: https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.mdx
// app/split/[sessionId]/page.tsx (Server Component)
export default async function SplitPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params   // ← MUST await in Next.js 15
  // fetch initial session, render client shell with it
}
```

### Pattern 6: SWR Polling for Guest Claiming Page

**What:** `refreshInterval: 3000` on SWR hook replaces manual `setInterval`.
**When to use:** `HostWaitingScreen` and guest claiming page.

```typescript
// Source: https://context7.com/vercel/swr/llms.txt
'use client'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function GuestClaimingView({ sessionId }: { sessionId: string }) {
  const { data: session, error } = useSWR(
    `/api/session/${sessionId}`,
    fetcher,
    {
      refreshInterval: 3000,      // Poll every 3 seconds (D-07)
      revalidateOnFocus: false,   // Don't refetch on tab-focus (mobile UX)
    }
  )

  if (error) return <SessionExpiredScreen />
  if (!session) return <div>Loading…</div>
  // render ClaimableItemCards from session.items + session.claims
}
```

**Why `revalidateOnFocus: false`:** On mobile, switching between apps (e.g., opening the link in Messages, then back to Safari) triggers focus events. Disabling focus-revalidation prevents unexpected request bursts that could momentarily disrupt the optimistic UI.

### Pattern 7: Optimistic UI for Claim Toggle

**What:** Update local state immediately on tap; let the next SWR poll confirm the server state.
**When to use:** `ClaimableItemCard` tap handler.

```typescript
// Pattern: local override map, cleared on successful poll confirmation
const [optimisticClaims, setOptimisticClaims] = useState<Record<string, string | null>>({})

async function handleItemTap(itemId: string) {
  const currentOwner = session.claims.items[itemId]
  const isMyItem = currentOwner === myPersonId

  // Optimistic: immediately flip the visual state
  setOptimisticClaims(prev => ({
    ...prev,
    [itemId]: isMyItem ? null : myPersonId  // null = un-claim
  }))

  await fetch(`/api/session/${sessionId}/claim`, {
    method: 'POST',
    body: JSON.stringify({ personId: myPersonId, itemId }),
  })
  // SWR's next poll will reconcile; optimistic state cleared on data change
}
```

### Anti-Patterns to Avoid

- **Storing session in Zustand for the guest page:** The guest's browser is a new tab with no existing Zustand state. Always fetch from Redis via the API.
- **Using `setInterval` directly in the guest page component:** SWR's `refreshInterval` handles cleanup, deduplication, and error retry. Manual `setInterval` leaks if the component unmounts before cleanup fires.
- **Prefixing env vars with `NEXT_PUBLIC_`:** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must NEVER be exposed to the browser. Route handlers only.
- **Parsing params without `await` in Next.js 15:** Route handlers receive `params` as a `Promise` in Next.js 15. Accessing `params.sessionId` without `await` returns `undefined` silently.
- **Storing session as a Redis Hash:** `hset`/`hget` for partial updates seems efficient but complicates transaction semantics. Use a single JSON blob; at <5KB it's negligible.
- **Setting TTL only at creation:** Upstash Redis does not auto-extend TTL on read/write. If you want the 24h window to reset on activity, call `redis.expire(key, 86400)` at the end of each successful write. For this use case (single dinner), not extending is fine.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polling loop | Custom `useEffect + setInterval + clearInterval + ref` | SWR `refreshInterval: 3000` | SWR handles deduplication across mounts, tab visibility, error retry, and cleanup automatically |
| Session ID collision safety | Custom UUID or random string | `nanoid()` | nanoid uses `crypto.getRandomValues()` — cryptographically secure, URL-safe alphabet, 21 chars |
| Redis connection management | Manual `fetch` to Upstash REST API | `@upstash/redis` SDK | SDK handles serialization, error parsing, and retry; REST transport already TCP-free |
| Distributed locking | Read-check-write with no atomicity | Redis `multi/exec` transactions | Transactions acquire exclusive write lock on key at EXEC time — prevents race conditions |
| Bill math on the guest done screen | Re-implementing share calculation | `computePersonTotals()` from `lib/billMath.ts` | Already implemented and tested; receives the session's people/items/assignments/tipPercent and returns per-person cents |

**Key insight:** The session layer is entirely thin — serialize, store, poll, deserialize. The complexity is in the atomic claim operations and the `computePersonTotals` math, both of which are handled by existing patterns.

---

## Common Pitfalls

### Pitfall 1: params is a Promise in Next.js 15 — the most common upgrade mistake

**What goes wrong:** Handler accesses `params.sessionId` instead of `(await params).sessionId`. Returns `undefined` for the session ID, Redis call returns null, response is 404 for all requests.

**Why it happens:** Next.js 14 made `params` a synchronous prop. Next.js 15 changed it to a `Promise` for consistency with `searchParams`. Existing patterns, blog posts, and LLM training data use the synchronous form.

**How to avoid:** Always destructure with `await`:
```typescript
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params  // ← required
}
```

**Warning signs:** All session API calls return 404 despite the key existing in Redis.

[VERIFIED: https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/upgrading/version-15.mdx]

### Pitfall 2: JSON.stringify / JSON.parse coupling with @upstash/redis automatic deserialization

**What goes wrong:** `redis.set(key, JSON.stringify(session))` stores a JSON string. `redis.get<SessionPayload>(key)` with a generic type hint tells the SDK to auto-parse — but if the value was manually stringified, the SDK returns a string, not the object.

**Why it happens:** `@upstash/redis` automatically calls `JSON.stringify` on objects and `JSON.parse` on retrieval when you use the typed generic. Manually stringifying before passing to `set()` results in double-encoding.

**How to avoid:** Choose one approach and be consistent:
- **Option A (recommended):** Pass the object directly — `redis.set(key, session)`. The SDK serializes it. Retrieve with `redis.get<SessionPayload>(key)` — SDK deserializes it. No manual JSON calls.
- **Option B:** Always manually `JSON.stringify` on write and `JSON.parse` on read, type the get as `redis.get<string>(key)`.

**Warning signs:** `JSON.parse` throws "Unexpected token" or the retrieved value is a string like `'{"people":[]}'` when you expected an object.

[VERIFIED: Context7 /upstash/docs — "Set Key with Expiration" example shows object passed directly]

### Pitfall 3: Missing UPSTASH env vars cause silent runtime failures

**What goes wrong:** The Redis client initializes successfully (no constructor error), but all `redis.*` calls throw `Error: UPSTASH_REDIS_REST_URL is not defined` at runtime. If the error is swallowed in a try/catch, the route silently returns 500 with no useful log.

**Why it happens:** The SDK reads env vars lazily on first call. Without the vars, `Redis.fromEnv()` will throw at call time, not at module load time.

**How to avoid:**
- Add both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.local` locally.
- Add them to Vercel project environment variables via the Vercel Dashboard or Marketplace integration.
- In tests, mock `@upstash/redis` entirely (see Testing section) — do not rely on real env vars in unit tests.

**Warning signs:** `redis.get` always throws in production; session creation returns 500; all polling returns 500.

### Pitfall 4: Race condition between read and write in claim operation

**What goes wrong:** Two guests claim the same item in the same 3-second polling window. Both guests' claim requests read the session (item unclaimed), both write (item claimed by them), second write wins — first guest's UI shows "claimed" but poll reveals it's taken by someone else.

**Why it happens:** Read-modify-write without atomicity.

**How to avoid:** All claim writes must use `redis.multi().set(...).exec()`. The `multi/exec` transaction acquires an exclusive write lock at EXEC time. The loser of the race gets an `exec()` result but finds the state has changed — the route handler re-reads and returns `{ conflict: true }`.

**Implementation note:** The `multi/exec` for claim in this app looks like:
```typescript
const tx = redis.multi()
tx.set(`session:${sessionId}`, JSON.stringify(updatedSession), { ex: 86400 })
const [setResult] = await tx.exec()
```
The atomicity guarantee is that no other `multi/exec` touching the same key runs concurrently. [VERIFIED: Context7 /upstash/docs — Key-Based Locking > Transactions section]

### Pitfall 5: SWR polling accumulates stale optimistic state

**What goes wrong:** Guest taps to claim an item, optimistic state shows "Claimed by me." Next poll arrives and correctly confirms. But if the user has already un-claimed before the poll resolves, the stale optimistic state re-claims it visually.

**How to avoid:** Clear optimistic overrides when the SWR data updates. Use a `useEffect` that resets `optimisticClaims` to `{}` whenever `session.claims` changes:
```typescript
useEffect(() => {
  setOptimisticClaims({})
}, [session?.claims])
```

### Pitfall 6: WizardShell step labels are wrong after reordering

**What goes wrong:** After moving SetTip from step 4 to step 3 and AssignItems to step 4, the progress strip still shows "Assign | Tip | Results" in the old order, causing a confusing visual mismatch.

**Why it happens:** `STEP_LABELS` in `WizardShell.tsx` is a static array defined at module level — it does not auto-update when step logic changes.

**How to avoid:** Update `STEP_LABELS` in `WizardShell.tsx` to: `['Add People', 'Add Items', 'Tip', 'Assign/Share', 'Results']` as part of the step-reorder task.

---

## Code Examples

### Create Session (POST /api/session)

```typescript
// Source: Context7 /upstash/docs — Create Upstash Redis Client Instance
// app/api/session/route.ts
import { nanoid } from 'nanoid'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  // ... input validation ...
  const sessionId = nanoid()
  const session = {
    people: body.people,
    items: body.items,
    tipPercent: body.tipPercent,
    claims: { items: {}, personSlots: {}, donePeople: {} },
    createdAt: Date.now(),
  }
  await redis.set(`session:${sessionId}`, session, { ex: 86400 })
  return NextResponse.json({ sessionId })
}
```

### Read Session (GET /api/session/[sessionId])

```typescript
// Source: https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/03-file-conventions/route.mdx
// app/api/session/[sessionId]/route.ts
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const session = await redis.get(`session:${sessionId}`)
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  return NextResponse.json(session)
}
```

### SWR Polling on Guest Page

```typescript
// Source: https://context7.com/vercel/swr/llms.txt
'use client'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('session_not_found')
  return r.json()
})

export function GuestClaimingView({ sessionId }: { sessionId: string }) {
  const { data: session, error } = useSWR(
    `/api/session/${sessionId}`,
    fetcher,
    { refreshInterval: 3000, revalidateOnFocus: false }
  )
  if (error) return <SessionExpiredScreen />
  if (!session) return null  // initial load — handled by server component skeleton
  // render claiming UI from session data
}
```

### Mock @upstash/redis in Vitest

```typescript
// Source: Established project pattern from __tests__/ocrRoute.test.ts
// Pattern: vi.mock the module, expose mock fns, reset in beforeEach

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockMulti = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: class {
    get = mockGet
    set = mockSet
    multi = mockMulti
  }
}))

beforeEach(() => {
  vi.resetModules()
  mockGet.mockReset()
  mockSet.mockReset()
  mockMulti.mockReset()
})

// In tests:
mockGet.mockResolvedValue(mockSession)  // session exists
mockSet.mockResolvedValue('OK')
mockMulti.mockReturnValue({
  set: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue(['OK']),
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel KV for serverless Redis | Upstash Redis (via Vercel Marketplace) | December 2024 | Vercel KV is discontinued — Upstash Redis is the direct replacement; same env var names, similar SDK API |
| Next.js 14 synchronous `params` | Next.js 15 `params` is a `Promise` | October 2024 (Next.js 15 stable) | All route handlers and page components must `await params` before accessing segments |
| Manual `useEffect + setInterval` for polling | SWR `refreshInterval` | — | SWR handles deduplication, visibility, and cleanup; reduces boilerplate from ~20 lines to 3 |

**Deprecated/outdated:**
- `Vercel KV`: Discontinued December 2024. Do not use `@vercel/kv`. Use `@upstash/redis` with the Upstash integration.
- `nanoid v3` (installed as transitive dep `3.3.12`): v5 is the current major. v3 is CommonJS with ESM interop shims. v5 is pure ESM. Install v5 as a direct dep to pin the right version. Both work in Node v24.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SWR's `revalidateOnFocus: false` prevents unwanted request bursts on mobile tab-switch | Pattern 6 | If wrong: extra polls hit Redis on mobile app-switch; cost impact is negligible on free tier |
| A2 | `redis.set(key, session)` where `session` is a plain object auto-serializes to JSON via the @upstash/redis SDK; `redis.get(key)` auto-deserializes | Pitfall 2 | If wrong: must manually JSON.stringify/parse; prefer Option A confirmed via testing |
| A3 | nanoid v5 ESM import works in Next.js 15 App Router route handlers without additional configuration | Standard Stack | If wrong: use nanoid v3 (already installed as transitive dep) which has CJS support |

---

## Open Questions

1. **Upstash account provisioned?**
   - What we know: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars are not yet in `.env.local.example` or Vercel.
   - What's unclear: Whether the developer has an Upstash account and Redis instance ready, or needs to create one.
   - Recommendation: Wave 0 plan should include explicit step: "Create Upstash Redis instance, add env vars to `.env.local` and Vercel project settings."

2. **Wizard `step` type extension for host waiting state**
   - What we know: `BillState.step` is typed as `1 | 2 | 3 | 4 | 5`. The host waiting screen is conceptually "step 5 in waiting mode" per the UI-SPEC.
   - What's unclear: Whether to add `hostMode: 'waiting' | 'done'` to the Zustand store or to re-use `step: 5` with a separate flag, or use step 6.
   - Recommendation: Add `syncStatus: 'idle' | 'waiting' | 'results'` to `useBillStore` (following the pattern of `ocrStatus` and `expandStatus`). Step stays at 5 when waiting. `ResultsStep` reads `syncStatus` to decide whether to render the standard results or the waiting screen.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@upstash/redis` npm package | All session API routes | Not installed | — | Must install: `npm install @upstash/redis` |
| `nanoid` npm package (direct dep) | POST /api/session | v3.3.12 (transitive) | 5.1.11 latest | v3 works; prefer v5 for ESM clarity |
| `swr` npm package | Guest page + host waiting screen polling | Not installed | — | Must install: `npm install swr` |
| Upstash Redis instance (cloud) | All session API routes at runtime | Unknown | — | No fallback — must provision before development |
| `UPSTASH_REDIS_REST_URL` env var | lib/redis.ts | Not present in `.env.local` | — | Add after provisioning Upstash instance |
| `UPSTASH_REDIS_REST_TOKEN` env var | lib/redis.ts | Not present in `.env.local` | — | Add after provisioning Upstash instance |
| Node.js | Build + test runtime | v24.15.0 | v24.15.0 | — |

**Missing dependencies with no fallback:**
- Upstash Redis cloud instance — all session features are blocked without it. Wave 0 plan must include provisioning step.
- `@upstash/redis` and `swr` npm packages — must be installed before any session route can be written.

**Missing dependencies with fallback:**
- `nanoid` v5 — v3 (already transitive dep) works; install v5 as direct dep for ESM clarity.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESULTS-02 | POST /api/session creates session in Redis, returns sessionId | unit | `npx vitest run __tests__/sessionRoute.test.ts` | ❌ Wave 0 |
| RESULTS-02 | GET /api/session/[sessionId] returns 404 for unknown sessionId | unit | `npx vitest run __tests__/sessionRoute.test.ts` | ❌ Wave 0 |
| RESULTS-02 | POST /api/session/[sessionId]/claim claims item atomically | unit | `npx vitest run __tests__/sessionClaimRoute.test.ts` | ❌ Wave 0 |
| RESULTS-02 | POST /api/session/[sessionId]/claim returns conflict when item already taken | unit | `npx vitest run __tests__/sessionClaimRoute.test.ts` | ❌ Wave 0 |
| RESULTS-02 | POST /api/session/[sessionId]/claim un-claims when caller is current owner (D-09) | unit | `npx vitest run __tests__/sessionClaimRoute.test.ts` | ❌ Wave 0 |
| RESULTS-02 | POST /api/session/[sessionId]/done marks person done, updates session | unit | `npx vitest run __tests__/sessionDoneRoute.test.ts` | ❌ Wave 0 |
| RESULTS-02 | WizardShell step labels reflect new order (Tip at 3, Assign at 4) | unit | `npx vitest run __tests__/WizardShell.test.tsx` | ❌ Wave 0 |
| RESULTS-02 | ShareLinkButton shows loading state and calls POST /api/session | unit | `npx vitest run __tests__/ShareLinkButton.test.tsx` | ❌ Wave 0 |
| RESULTS-02 | PersonSlotPicker renders taken slots as disabled | unit | `npx vitest run __tests__/PersonSlotPicker.test.tsx` | ❌ Wave 0 |
| RESULTS-02 | GuestDoneScreen shows correct personal total using computePersonTotals | unit | `npx vitest run __tests__/GuestDoneScreen.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green (all 151 existing + all Phase 4 tests) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `__tests__/sessionRoute.test.ts` — POST + GET handlers, mocks `@upstash/redis`
- [ ] `__tests__/sessionClaimRoute.test.ts` — claim/un-claim, conflict detection, person-slot locking
- [ ] `__tests__/sessionDoneRoute.test.ts` — mark done, full-table done detection
- [ ] `__tests__/ShareLinkButton.test.tsx` — loading state, session creation trigger, error toast
- [ ] `__tests__/PersonSlotPicker.test.tsx` — available/taken/race-conflict slot rendering
- [ ] `__tests__/GuestDoneScreen.test.tsx` — personal total computation display
- [ ] `__tests__/WizardShell.test.tsx` — step label order verification (update existing tests if WizardShell already has test coverage, or create new)
- [ ] `lib/redis.ts` — shared Redis client (no test file; validated by route handler tests mocking the module)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user accounts; anonymous session claiming |
| V3 Session Management | Yes | 24h TTL on Redis keys; nanoid sessionId (21-char, 126-bit entropy); no session fixation risk because sessionId is server-generated |
| V4 Access Control | Partial | No auth — any bearer of the sessionId URL can read the session. Acceptable: the URL is shared intentionally at a dinner table. No sensitive PII stored in session (only names the host typed). |
| V5 Input Validation | Yes | All route handlers validate body shape before Redis writes; priceCents integer constraint enforced on session creation |
| V6 Cryptography | No | nanoid uses `crypto.getRandomValues()` — no custom crypto needed |

### Known Threat Patterns for Upstash Redis / Next.js Session API

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Redis env var exposure | Information Disclosure | Server-side only env vars — never `NEXT_PUBLIC_`; follow existing `OPENAI_API_KEY` pattern |
| Session ID enumeration | Information Disclosure | nanoid 21-char alphabet provides 2^126 ID space — brute force not feasible |
| Race condition double-claim | Tampering | Redis `multi/exec` transaction atomicity on all claim writes |
| Stale session after dinner | Denial of Service (self-inflicted) | 24h TTL auto-expires sessions; no manual cleanup needed |
| Malicious session payload (XSS via stored name) | Tampering | Names are stored as-is (user-typed) and rendered via React JSX — React escapes by default; no `dangerouslySetInnerHTML` |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/upstash/docs` — Redis client setup, `set`/`get` with TTL, `multi/exec` transactions, key-based locking
- Context7 `/upstash/lock` — distributed lock pattern (reference, not used directly)
- Context7 `/vercel/next.js` — Next.js 15 dynamic route params as Promise, route handler signatures
- Context7 `/vercel/swr` — `refreshInterval` polling, conditional fetching, `revalidateOnFocus`
- Context7 `/ai/nanoid` — nanoid ESM import, default 21-char ID generation

### Secondary (MEDIUM confidence)
- `npm view @upstash/redis version` — verified 1.38.0 is current [VERIFIED: npm registry]
- `npm view nanoid version` — verified 5.1.11 is current [VERIFIED: npm registry]
- `npm view swr version` — verified 2.4.1 is current [VERIFIED: npm registry]
- Codebase inspection: `stores/useBillStore.ts`, `app/api/ocr/route.ts`, `app/api/expand/route.ts`, `lib/billMath.ts`, `vitest.config.mts`, `vitest.setup.ts` — established patterns confirmed by direct file read

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified against npm registry; SDK patterns verified via Context7
- Architecture: HIGH — Next.js 15 params-as-Promise and Upstash `multi/exec` verified via Context7 official docs
- Pitfalls: HIGH — params Promise pitfall and JSON double-encoding are documented in official Next.js 15 upgrade guide and Upstash SDK; transaction atomicity is in key-locking docs
- Testing patterns: HIGH — directly modeled on existing `ocrRoute.test.ts` and `expandRoute.test.ts` patterns in the codebase

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable stack; Upstash Redis and Next.js 15 unlikely to break these patterns within 30 days)
