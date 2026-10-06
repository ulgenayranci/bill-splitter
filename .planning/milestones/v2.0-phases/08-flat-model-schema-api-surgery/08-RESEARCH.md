# Phase 8: Flat Model — Schema + API Surgery - Research

**Researched:** 2026-06-05
**Domain:** TypeScript schema surgery, Next.js App Router route deletion, Upstash Redis/Lua atomicity, test migration
**Confidence:** HIGH — all findings are codebase-grounded (direct file reads). No external library research needed; this is an internal refactor with no new npm dependencies.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** When an item's price or quantity is edited and it already has claims, **the claims are kept and shares auto-recalculate** to the new price/quantity. A claim is about WHO had the item, not the exact dollar amount.
- **D-02:** **Every delete shows a confirmation prompt** — claimed or not. Generic confirm for unclaimed; when item has claims, the prompt surfaces that ("N people claimed this — delete anyway?"). **Edits apply immediately** (live, no confirm), per CLAIM-03.
- **D-03:** **NULL EVENT — there are no existing users.** Do NOT build a `migrateSession` normalizer or any v1-compatibility handling. Stale Redis sessions expire within 24h TTL.
- **D-04:** Add `currencyCode` to `SessionPayload` in this phase (schema is already open). Default to `'USD'` at creation if the store didn't supply one. Phase 10 owns display only.

### Claude's Discretion
- **Edit attribution** ("edited by Bob") is NOT required this phase — keep minimal.
- **Concurrent-edit conflict resolution** — default to last-write-wins; confirm existing Lua atomicity in claim path still holds for new edit path.

### Deferred Ideas (OUT OF SCOPE)
- Edit attribution to a named person.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLAIM-01 | Any participant can claim items by tapping — no host, no approval queue | Remove hostToken/assignedBy:'host' guards from claim route; simplify Lua scripts |
| CLAIM-03 | Anyone can add, edit, or remove an item directly (changes apply immediately, no moderation) | New /edit route applies mutations immediately; no editRequests queue |
| D-04 | currencyCode in SessionPayload, default 'USD' | Add field to schema, thread through POST /api/session |
</phase_requirements>

---

## Summary

Phase 8 is a precision deletion + addition phase against a well-understood codebase. The work divides cleanly into four sequential operations: (1) flatten `lib/sessionSchema.ts` by removing six host-concept symbols and adding `currencyCode`, (2) delete five route directories and create one new `/edit` route, (3) update every TypeScript consumer that references the removed types — TypeScript will enumerate these automatically once the schema is changed, and (4) delete six obsolete test files and write flat-model replacements for each.

The existing Lua atomic paths in `claim/route.ts` are the most sensitive code in the codebase. Two scripts exist — `QTY_CLAIM_SCRIPT` and `SLOT_CLAIM_SCRIPT` — and both embed host concepts in Lua strings that TypeScript cannot typecheck. They must be audited and modified as a separate concern from the TS surgery: specifically, the `assignedBy`/`hostToken` guards in `QTY_CLAIM_SCRIPT` and the `hostPersonId` assignment in `SLOT_CLAIM_SCRIPT` must be stripped from the Lua source. The new `/edit` route does NOT need a Lua atomic pattern because edits mutate `session.items[]` (not the concurrent multi-writer `claims` map) and the existing read-modify-write pattern used in `resolve-edit/route.ts` is appropriate there.

`currencyCode` already flows from OCR → Zustand store (`useBillStore.currencyCode`). What's missing is the bridge: `ShareLinkButton` must read `currencyCode` from the store and send it in the POST `/api/session` body, and `SessionPayload` must declare the field. No display work is needed in this phase.

**Primary recommendation:** Change the schema first, let TypeScript enumerate all broken callsites, fix them in dependency order (routes → components → tests), then audit Lua strings independently as a final checklist step.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session schema definition | API / Backend | — | `lib/sessionSchema.ts` is shared but server-authoritative; it defines what is stored in Redis |
| Direct item edit (add/edit/remove) | API / Backend | — | Mutations must be atomic at the server; client just fires-and-refreshes via SWR |
| Delete confirmation UI prompt | Browser / Client | — | D-02 confirm is a UI guard; the server just executes the delete |
| currencyCode plumbing | API / Backend + Client | — | Client sends it on POST; server stores it; Phase 10 reads it for display |
| Host-route 404s | API / Backend | — | Route directories simply stop existing; Next.js returns 404 automatically |
| Lua script cleanup | API / Backend | — | Embedded in `claim/route.ts` server code; opaque to TypeScript |

---

## Standard Stack

No new npm packages are installed in this phase. All v2 features are delivered through changes to existing code (Architecture Commitment confirmed in `STATE.md`).

**Existing packages in use:**
- `@upstash/redis` — Redis client with `eval()` for Lua atomicity
- `nanoid` — item ID generation in the new /edit add path
- `next/server` / `NextResponse` — route handler pattern
- `vitest` — test runner (existing, no changes needed)

---

## Package Legitimacy Audit

> Not applicable — no new packages are installed in this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
Client (CollaborativeClaimingView)
  │  SWR polling → GET /api/session/[id]        (KEEP — returns flat SessionPayload)
  │  claim toggle  → POST /api/session/[id]/claim (KEEP — Lua atomic)
  │  done button   → POST /api/session/[id]/done  (KEEP — unchanged)
  │  tip confirm   → POST /api/session/[id]/tip   (KEEP — unchanged)
  │  add/edit/del  → POST /api/session/[id]/edit  (NEW — immediate, no queue)
  │
  ↓ DELETE (return 404 by removing route directories):
    /api/session/[id]/accept
    /api/session/[id]/dispute
    /api/session/[id]/edit-request
    /api/session/[id]/resolve-dispute
    /api/session/[id]/resolve-edit

Redis key: session:{id}
  SessionPayload (flat, after Phase 8):
    people[], items[], claims{items,personSlots,donePeople},
    tips{}, currencyCode, createdAt
    (hostToken, hostPersonId, editRequests, disputes: GONE)
```

### Recommended Project Structure (after Phase 8)

```
app/api/session/
├── route.ts                  # POST create — add currencyCode field
└── [sessionId]/
    ├── route.ts              # GET session — remove hostToken destructure
    ├── claim/route.ts        # KEEP — strip host guards from Lua strings
    ├── done/route.ts         # KEEP — unchanged
    ├── tip/route.ts          # KEEP — unchanged
    └── edit/route.ts         # NEW — add/edit/remove, immediate apply

lib/sessionSchema.ts          # FLATTEN — see removal map below
components/split/
    ├── ClaimableItemCard.tsx  # Remove isHostAssigned / "Assigned by host" label
    ├── PersonSlotPicker.tsx   # Switch to PublicSessionPayload (loses hostToken)
    ├── HostPanel.tsx          # DELETE ENTIRELY (whole component)
    ├── ReviewHostAssignedScreen.tsx # DELETE ENTIRELY
    └── EditRequestForm.tsx    # DELETE ENTIRELY
components/wizard/
    └── ShareLinkButton.tsx    # Remove hostToken from local state + redirect; add currencyCode to POST body
stores/useBillStore.ts         # Remove hostToken field + setHostToken action (or keep as dead code — TS will flag)
```

---

## Removal Map

### 1. `lib/sessionSchema.ts` — exact symbols to remove / add

**REMOVE (interfaces/types):**
- `EditPayload` type (entire export) — lines 12–16
- `EditRequest` interface (entire export) — lines 18–25
- `Dispute` interface (entire export) — lines 27–32

**REMOVE (fields from `ClaimEntry`):**
- `assignedBy: 'self' | 'host'` — collapse to the field being absent or to a simpler form. Since `assignedBy` is only used to check `=== 'host'`, the simplest flat-model approach is to remove the field entirely — all claims are self-claims.
- `accepted?: boolean` — only used by `ReviewHostAssignedScreen` (which is deleted) and `hasUnacceptedHostItems()` (which is deleted)

**REMOVE (fields from `SessionPayload`):**
- `hostToken: string` — lines 47–50 (with JSDoc comment block)
- `hostPersonId?: PersonId` — line 51
- `editRequests: Record<string, EditRequest>` — line 55
- `disputes: Record<string, Dispute>` — line 57

**ADD (to `SessionPayload`):**
- `currencyCode: string` — after `createdAt`, with JSDoc: "ISO 4217 currency code. Defaults to 'USD' at creation. Display-only threading is Phase 10."

**MODIFY:**
- `PublicSessionPayload = Omit<SessionPayload, 'hostToken'>` — once `hostToken` is removed from `SessionPayload`, this type alias becomes `SessionPayload` itself. Either delete the alias and replace all uses with `SessionPayload`, or redefine as `type PublicSessionPayload = SessionPayload`. **Simplest path: delete the alias and do a global find/replace of `PublicSessionPayload` → `SessionPayload`.**

### 2. Routes to DELETE (entire directories)

| Directory | File | Test to Delete |
|-----------|------|----------------|
| `app/api/session/[sessionId]/accept/` | `route.ts` | No dedicated test file (tested implicitly via HostPanel/ReviewHostAssigned) |
| `app/api/session/[sessionId]/dispute/` | `route.ts` | `__tests__/disputeRoute.test.ts` |
| `app/api/session/[sessionId]/edit-request/` | `route.ts` | `__tests__/editRequestRoute.test.ts` |
| `app/api/session/[sessionId]/resolve-dispute/` | `route.ts` | `__tests__/resolveDisputeRoute.test.ts` |
| `app/api/session/[sessionId]/resolve-edit/` | `route.ts` | `__tests__/resolveEditRoute.test.ts` |

### 3. Components to DELETE (entire files)

- `components/split/HostPanel.tsx` — entire host control panel
- `components/split/ReviewHostAssignedScreen.tsx` — host-assignment acceptance screen
- `components/split/EditRequestForm.tsx` — edit-request form (if it exists as its own file; also referenced from HostPanel)

### 4. Consumer sites with TypeScript breakage after schema removal

**`app/api/session/[sessionId]/route.ts` (GET handler, line 23):**
- `const { hostToken: _hostToken, ...safeSession } = session` — this destructure will error once `hostToken` is gone from `SessionPayload`. Replace with `return NextResponse.json(session)` directly (no stripping needed; all fields are safe in the flat model).

**`app/api/session/route.ts` (POST create):**
- Remove `hostToken = nanoid()` generation and the `hostToken` field in the `payload` object
- Remove `hostPersonId: undefined` from the payload
- Remove `editRequests: {}` and `disputes: {}` from the payload
- Remove the `prePopulatedClaims` block (lines 57–69) — the entire `assignments` → `host`-assigned-claims conversion logic goes away
- Add `currencyCode: b.currencyCode ?? 'USD'` (validate it's a string, fallback to 'USD')
- Change response from `return NextResponse.json({ sessionId, hostToken })` to `return NextResponse.json({ sessionId })`

**`app/api/session/[sessionId]/claim/route.ts` (Lua strings — NOT TypeScript errors):**
- `QTY_CLAIM_SCRIPT`: lines 24–30 check `assignedBy === 'host'` and `claimerHostToken`; line 61 writes `{ qty = qty, assignedBy = assignedBy }` — simplify to write `{ qty = qty }` (no `assignedBy` field in flat model)
- `SLOT_CLAIM_SCRIPT`: lines 97–101 conditionally set `session.hostPersonId` — remove entirely
- `ClaimBody` type: remove `hostToken?` and `assignedBy?` fields
- `validateBody()`: remove `hostToken` and `assignedBy` validation branches
- `POST handler`: remove `hostToken`, `assignedBy` from destructure; pass simpler ARGV to eval

**`app/split/[sessionId]/CollaborativeClaimingView.tsx` (large file — multiple sites):**
- Remove `hostTokenParam` state + `useEffect` that reads from hash (lines 84–89)
- Remove `useEffect` for host auto-restore (lines 104–108, uses `session.hostPersonId`)
- Remove `isHost` memo (lines 158–162, depends on `hostTokenParam` + `session.hostPersonId`)
- Remove `pendingCount` memo references to `session.editRequests` and `session.disputes` (lines 169–185)
- Remove `hostPanelOpen` state and HostPanel render (lines 187, 692–703)
- Remove `ReviewHostAssignedScreen` render + `phase === 'review'` branch (lines 422–433)
- Remove `hasHostAssignedItems()` helper (lines 195–200)
- Remove `handleBackFromTip()` review-branch logic (lines 329–337)
- `handleInlineSubmit()`: replace all `/api/session/${sessionId}/edit-request` fetches with `/api/session/${sessionId}/edit` calls (the new direct route)
- `handleDone()`: remove `hasHostAssigned` detection (lines 297–302) — on done, always go to 'tip'
- `derivePhase()`: remove `hasUnacceptedHostItems` branch — simplify to: donePeople → 'tip', tips confirmed → 'results'
- Remove `hasUnacceptedHostItems()` function (line 56)
- Remove the "Pending approval" UI blocks (lines 561–569 for items, lines 571–589 for pending add requests)
- Remove the host FAB `<button>` (lines 670–689)

**`components/split/ClaimableItemCard.tsx`:**
- Line 34: `const isHostAssigned = myEntry?.assignedBy === 'host'` — remove
- Lines 109–111: the "Assigned by host" label — remove
- Lines 69: `isHostAssigned ? 'border-amber-200' : ''` from cardClasses — remove
- `ClaimEntry` import still needed for the `Record<PersonId, ClaimEntry>` prop type, but `ClaimEntry` interface will have simplified shape

**`components/split/PersonSlotPicker.tsx`:**
- Uses `PublicSessionPayload` type — update import to `SessionPayload` if the alias is deleted

**`components/wizard/ShareLinkButton.tsx`:**
- Remove `hostToken` from `PendingSession` interface (line 20)
- Remove `setHostToken` selector and `setHostToken(hostToken)` call (lines 25, 61)
- Remove `hostToken` from `res.json()` destructure (line 56)
- Remove `hostToken` from `pendingSession` (line 65)
- Remove `#hostToken=${hostToken}` from `router.push()` (line 80)
- The guest URL (no fragment) becomes the only URL — host now redirects to the same URL as guests
- Add `currencyCode` to the POST body: read `useBillStore.getState().currencyCode` alongside `people`, `items`, `assignments`

**`stores/useBillStore.ts`:**
- Remove `hostToken: string | null` from `BillState` interface (line 55)
- Remove `hostToken: null` from `INITIAL_STATE` (line 89)
- Remove `setHostToken: (token) => set({ hostToken: token })` action (line 145)
- Remove `hostToken: s.hostToken` from `partialize` (line 174)

**`__tests__/sessionGetRoute.test.ts`:**
- `baseSession` fixture includes `hostToken`, `editRequests`, `disputes` — update to flat shape
- Test 1 currently asserts `editRequests: {}` in response — update to not assert on removed fields
- The CR-01 `hostToken` stripping test (`expect(json.hostToken).toBeUndefined()`) becomes irrelevant — update or remove

---

## Safe Removal Order

TypeScript enforces this order: change the schema first, then the compiler cascade tells you exactly what else to fix.

```
Wave A — Schema (TypeScript cascade starts here)
  1. lib/sessionSchema.ts — remove host types, add currencyCode

Wave B — Route deletions (no TS cascade, just filesystem)
  2. rm -rf app/api/session/[sessionId]/accept/
  3. rm -rf app/api/session/[sessionId]/dispute/
  4. rm -rf app/api/session/[sessionId]/edit-request/
  5. rm -rf app/api/session/[sessionId]/resolve-dispute/
  6. rm -rf app/api/session/[sessionId]/resolve-edit/

Wave C — Route updates (TS errors drive order)
  7. app/api/session/route.ts (POST create) — remove host fields, add currencyCode
  8. app/api/session/[sessionId]/route.ts (GET) — remove hostToken destructure
  9. app/api/session/[sessionId]/claim/route.ts — update Lua strings + TS types
 10. app/api/session/[sessionId]/edit/route.ts — CREATE new direct-edit route

Wave D — Component deletions
 11. rm components/split/HostPanel.tsx
 12. rm components/split/ReviewHostAssignedScreen.tsx
 13. rm components/split/EditRequestForm.tsx (if standalone file)

Wave E — Component updates (TS errors drive order)
 14. stores/useBillStore.ts — remove hostToken field + action
 15. components/wizard/ShareLinkButton.tsx — remove host redirect, add currencyCode
 16. components/split/ClaimableItemCard.tsx — remove isHostAssigned
 17. components/split/PersonSlotPicker.tsx — update type import
 18. app/split/[sessionId]/CollaborativeClaimingView.tsx — large refactor

Wave F — Test migration
 19. Delete 6 host-concept test files
 20. Write flat-model replacement tests
 21. Update baseSession fixtures in remaining tests
```

**Why this order is safe:**
- Working routes (`claim/`, `done/`, `tip/`) are touched only to simplify, never to break their core path.
- `CollaborativeClaimingView` is last because it depends on the component deletions in Wave D being complete (no more `HostPanel`/`ReviewHostAssignedScreen` imports).
- The new `/edit` route is created in Wave C so its test can be written alongside it in Wave F.

---

## Lua / Redis Atomicity

### Current Lua usage — claim/route.ts

Two Lua scripts run via `redis.eval()`:

**`QTY_CLAIM_SCRIPT`** (atomic qty claim):
- Does: GET session → decode JSON → bounds-check total claimed vs item.quantity → write new claim → re-encode → SET
- Host concepts embedded in Lua strings (NOT visible to TypeScript):
  - `ARGV[4] = assignedBy` ("self" or "host")
  - `ARGV[5] = claimerHostToken`
  - Lines 24–30: if `assignedBy == 'host'` validate against `session.hostToken`
  - Line 61: writes `{ qty = qty, assignedBy = assignedBy }` — in flat model, write `{ qty = qty }` only

**`SLOT_CLAIM_SCRIPT`** (atomic identity-slot claim):
- Does: GET session → set `personSlots[personId] = true` → conditionally set `session.hostPersonId` → SET
- Host concepts:
  - `ARGV[2] = maybeHostToken`
  - Lines 97–101: if token matches, set `session.hostPersonId = personId` — remove entirely

**After Phase 8, both scripts become simpler:**
- `QTY_CLAIM_SCRIPT`: drop ARGV[4] and ARGV[5]; always write `{ qty = qty }` with no `assignedBy`; remove the host validation block
- `SLOT_CLAIM_SCRIPT`: drop ARGV[2]; remove the `hostPersonId` set block; ARGV becomes just `[personId]`

**Critical:** The bounds-check loop in `QTY_CLAIM_SCRIPT` (lines 38–56) must be PRESERVED. It provides the concurrent-claim safety guarantee (CR-03) — two users can't both claim the last unit of a multi-qty item. This logic is independent of host concepts.

### Does the new /edit route need Lua?

**No, and here's why:**

The claim route needs Lua because it has a concurrent write race: two people can simultaneously claim the last unit, so the bounds check and the write must be atomic. The `/edit` route mutates `session.items[]` (name, price, qty). Two concurrent edits to different fields could overwrite each other (last-write-wins per D-01 discretion), but there is no correctness invariant to enforce across concurrent writers — an edit can't "overflow" the way claims can. The existing read-modify-write pattern from `resolve-edit/route.ts` (GET → mutate in JS → SET) is appropriate and matches what was already used for the approval path.

**Upstash atomicity reminder:** `redis.multi()` is NOT atomic on Upstash REST (confirmed pitfall from Phase 6, STATE.md). For the /edit route, a simple GET → mutate → SET is acceptable (last-write-wins). If a future phase requires atomic edit guarantees, Lua is the correct tool then — but not now.

---

## Direct /edit Route Shape

**Path:** `POST /api/session/[sessionId]/edit`

**Operations it must cover** (ported from `edit-request/route.ts` and `resolve-edit/route.ts`):

| Operation | Body | Behavior | D-01 impact |
|-----------|------|----------|-------------|
| add | `{ op: 'add', name: string, priceCents: number, quantity: number }` | Append new item with nanoid ID | No existing claims |
| edit_name | `{ op: 'edit_name', itemId: string, newName: string }` | Update item.name in place | Claims unaffected |
| edit_price | `{ op: 'edit_price', itemId: string, newPriceCents: number }` | Update item.priceCents in place | Claims kept; shares auto-recalculate because `computePersonShareFromClaims` derives shares from `priceCents` at render time |
| edit_quantity | `{ op: 'edit_quantity', itemId: string, newQuantity: number }` | Update item.quantity in place | Claims kept but may become inconsistent if totalClaimed > newQuantity — see Pitfall 4 |
| remove | `{ op: 'remove', itemId: string }` | Remove item from items[]; delete claims.items[itemId] | Claims for deleted item are purged |

**D-01 recalculation mechanism:** The share calculation is already implemented correctly — `computePersonShareFromClaims` in `lib/billMath.ts` derives each person's share from `item.priceCents * (myQty / totalClaimed)`. No stored derived value exists; recalculation is automatic at render time when the updated `SessionPayload` is returned by SWR. Editing price does nothing special to claims — the new price is just used in the next render cycle.

**Request/Response contract:**
```typescript
// Request
{ op: 'add' | 'edit_name' | 'edit_price' | 'edit_quantity' | 'remove', ...payload }

// Response (success)
{ ok: true }

// Response (not found)
404: { error: 'session_not_found' }

// Response (bad input)
400: { error: string }

// Response (server error)
500: { error: 'Edit failed' }
```

**Client-side pattern:** `CollaborativeClaimingView.handleInlineSubmit()` currently fires separate sequential fetches for `edit_name`, `edit_price`, `edit_quantity` when multiple fields change. In the flat model, this can be simplified: the /edit route handles one operation at a time, so the client fires them in sequence (name changed → one fetch, price changed → one fetch). Alternatively, a single compound edit endpoint could accept all fields — keep separate operations for simplicity, matching the existing code structure.

**D-02 confirm for remove:** The confirm dialog is a client-side concern. `CollaborativeClaimingView` must show a confirmation before calling POST /edit with `op: 'remove'`. The number of claimants can be derived from `Object.keys(session.claims.items[itemId] ?? {}).length`. The server-side /edit route does NOT enforce a confirmation step.

---

## currencyCode Plumbing

### Current state (verified by file reads)
- `currencyCode` is already detected by OCR (`app/api/ocr/route.ts`, returned in response)
- `currencyCode` is already stored in `useBillStore` (`stores/useBillStore.ts`, line 39, 48, 84)
- `currencyCode` is already read by `SetupStep.tsx` from the OCR response and saved to the store
- **Gap:** `currencyCode` is NOT included in the POST `/api/session` body by `ShareLinkButton.tsx`
- **Gap:** `currencyCode` is NOT a field in `SessionPayload` in `lib/sessionSchema.ts`

### Changes required

**`lib/sessionSchema.ts`:** Add `currencyCode: string` to `SessionPayload`.

**`app/api/session/route.ts` (POST create):**
```typescript
// Read and validate currencyCode from body
const rawCode = b.currencyCode
const currencyCode =
  typeof rawCode === 'string' && /^[A-Z]{3}$/.test(rawCode) ? rawCode : 'USD'
// Add to payload
const payload: SessionPayload = {
  people: b.people,
  items: b.items,
  claims: { items: {}, personSlots: {}, donePeople: {} },
  currencyCode,
  tips: {},
  createdAt: Date.now(),
}
```

**`components/wizard/ShareLinkButton.tsx`:**
```typescript
const { people, items, assignments, currencyCode } = useBillStore.getState()
// ...
body: JSON.stringify({ people, items, assignments, currencyCode })
```

**Default fallback logic:** If the store's `currencyCode` is missing or empty (device that cleared localStorage), the server defaults to 'USD'. This satisfies D-03 (no migration needed) and D-04 (default 'USD').

**Phase 10 is unaffected:** `formatCents` and all display callsites are untouched this phase. The field exists in the payload; Phase 10 threads it into `formatCents`.

---

## Test Migration

### Tests to DELETE (routes no longer exist)

| File | Reason |
|------|--------|
| `__tests__/disputeRoute.test.ts` | Tests `POST /dispute` — route deleted |
| `__tests__/editRequestRoute.test.ts` | Tests `POST /edit-request` — route deleted |
| `__tests__/resolveDisputeRoute.test.ts` | Tests `POST /resolve-dispute` — route deleted |
| `__tests__/resolveEditRoute.test.ts` | Tests `POST /resolve-edit` — route deleted |
| `__tests__/HostPanel.test.tsx` | Component deleted |
| `__tests__/ReviewHostAssignedScreen.test.tsx` | Component deleted |

### Tests to CREATE

| New File | Coverage |
|----------|----------|
| `__tests__/editRoute.test.ts` | Tests `POST /api/session/[sessionId]/edit` — all 5 ops: add, edit_name, edit_price, edit_quantity, remove; D-01 (claims preserved on edit_price); remove purges claims.items[itemId]; 404/400/500 paths |

### Tests to UPDATE (fixture and assertion changes)

| File | What Changes |
|------|-------------|
| `__tests__/sessionRoute.test.ts` | `baseSession` fixture: remove `hostToken`, `editRequests`, `disputes`; Test 1: response no longer has `hostToken` field; Test 3: payload should not contain `hostToken`/`editRequests`/`disputes`, should contain `currencyCode`; add test for `currencyCode` in payload |
| `__tests__/sessionGetRoute.test.ts` | `baseSession` fixture: remove `hostToken`, `editRequests`, `disputes`; Test 1: no longer need to assert `hostToken` is stripped (it's not stored); add assertion for `currencyCode` in response |
| `__tests__/sessionClaimRoute.test.ts` | `baseSession` fixture: remove `hostToken`, `editRequests`, `disputes`; Tests 8 and 9 (host-assigned `assignedBy:'host'`) become invalid — remove or rewrite to flat-model self-claim; Test 10 (`assignedBy: 'admin'`) — no longer valid if `assignedBy` field is removed from the route |
| `__tests__/CollaborativeClaimingView.test.tsx` | Fixtures: remove `hostToken`, `editRequests`, `disputes`, `hostPersonId`; host badge/FAB/HostPanel tests go away; `handleInlineSubmit` tests should verify calls to `/edit` not `/edit-request` |
| `__tests__/PersonSlotPicker.test.tsx` | `mockSession` fixture uses `SessionPayload` with `hostToken` — update to flat shape |
| `__tests__/PersonResultsScreen.test.tsx` | `makeSession()` fixture includes `hostToken`, `editRequests`, `disputes` — remove |
| `__tests__/ShareLinkButton.test.tsx` | Remove `hostToken` from mock response; verify POST body includes `currencyCode`; remove test that `setHostToken` was called; remove test for `#hostToken=` redirect |
| `__tests__/ClaimableItemCard.test.tsx` | Any fixture with `assignedBy: 'host'` claims; remove "Assigned by host" label assertions |

### Pre-existing failures (track separately)

These 5 failures exist NOW before Phase 8 begins. Do NOT let Phase 8 accidentally fix or worsen them — track them distinctly:

| Test | File | Failure |
|------|------|---------|
| PersonSlotPicker Test 2 | `PersonSlotPicker.test.tsx` | `opacity-50` class not found (class is `opacity-40` in component) |
| AddPeopleStep "disables CTA" | `AddPeopleStep.test.tsx` | Button text mismatch ("continue to items" vs actual) |
| AddPeopleStep "enables CTA" | `AddPeopleStep.test.tsx` | Same button text mismatch |
| AddItemsStep "tapping Continue" | `AddItemsStep.test.tsx` | setStep called with 2, expected 3 |
| CollaborativeClaimingView Test 18 | `CollaborativeClaimingView.test.tsx` | "You're all set" text not found on results transition |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Atomic concurrent claim safety | Custom JS read-modify-write for claims | Existing `redis.eval()` Lua (already in claim/route.ts) |
| Share calculation on edit | Re-implement math | Existing `computePersonShareFromClaims` in lib/billMath.ts — shares auto-recalculate at render time |
| Item ID generation for new items | Custom ID function | Existing `nanoid()` — already imported by other routes |
| Upstash atomicity for edit mutations | `redis.multi()` | Simple GET → mutate → SET (last-write-wins is acceptable for item edits per D-01 discretion) |

---

## Common Pitfalls

### Pitfall 1: Lua strings are invisible to TypeScript
**What goes wrong:** After removing `assignedBy`/`hostToken` from `ClaimEntry` and `SessionPayload`, TypeScript reports zero errors in `claim/route.ts` — but the Lua strings still reference `assignedBy`, `hostToken`, and `hostPersonId`. The Lua runs against whatever JSON is in Redis; stale references don't crash, they silently write the old structure.
**How to avoid:** Audit Lua strings as a separate final checklist step AFTER TS is clean. Search for `ARGV`, `assignedBy`, `hostToken`, `hostPersonId` inside the Lua string literals. This is the only part of the codebase that TypeScript cannot protect.
**Warning signs:** Tests pass (they mock `redis.eval` return value), but live Redis sessions still contain `{ qty, assignedBy }` objects.

### Pitfall 2: `PublicSessionPayload` alias creates phantom consumers
**What goes wrong:** Deleting the `PublicSessionPayload = Omit<SessionPayload, 'hostToken'>` alias causes compile errors at every import site. If you miss updating an import, you get a "module has no export" error rather than a type error, which is harder to trace.
**How to avoid:** Either keep the alias as `type PublicSessionPayload = SessionPayload` (zero-cost change, all imports continue to work) or do a global find-replace before removing. `PersonResultsScreen.tsx`, `PersonSlotPicker.tsx`, `CollaborativeClaimingView.tsx`, and tests all import `PublicSessionPayload`.

### Pitfall 3: ShareLinkButton redirects host to fragment URL
**What goes wrong:** Currently `ShareLinkButton` redirects the host to `/split/${sessionId}#hostToken=${hostToken}`. If this code is not removed, the flat model still redirects the host to a URL fragment that no longer does anything, and `CollaborativeClaimingView` will never set `hostTokenParam` (because the useEffect reading the hash is also removed), leading to a silent no-op instead of a clean redirect.
**How to avoid:** Remove the fragment redirect entirely. In the flat model, all participants — including the original bill creator — go to `/split/${sessionId}` (no fragment). The creator is just another participant.

### Pitfall 4: edit_quantity with newQuantity < totalClaimed
**What goes wrong:** If Alice and Bob have both claimed 1 unit of a qty=2 item (totalClaimed=2) and someone edits quantity down to 1, the claim structure becomes invalid (totalClaimed > quantity). The Lua bounds check in QTY_CLAIM_SCRIPT would reject future claims, but existing over-claims would just persist.
**How to avoid:** The `/edit` route for `edit_quantity` should check if `newQuantity < totalAlreadyClaimed` and if so, either reject (400) or accept but clip — the simplest defensible choice is to reject with a clear error ("Can't reduce quantity below current claims"). The client can then prompt the user to unclaim first.

### Pitfall 5: DELETE test files simultaneously with updating surviving tests
**What goes wrong:** If you delete `editRequestRoute.test.ts` in the same commit as updating `sessionClaimRoute.test.ts`, vitest may surface the surviving test's fixture errors more prominently and vice versa, making it hard to track which failures are "new" vs pre-existing.
**How to avoid:** Delete the 6 obsolete test files in one commit, then update surviving test fixtures in a second commit, then write new `editRoute.test.ts` in a third. CI stays green at each step except the final verification commit.

### Pitfall 6: POST /api/session response still returning `hostToken`
**What goes wrong:** `ShareLinkButton` destructures `{ sessionId, hostToken }` from the response and calls `setHostToken(hostToken)`. If the response is changed but the client code is not updated, it silently stores `undefined` as the hostToken.
**How to avoid:** Update `ShareLinkButton` in the same wave as `POST /api/session` — they are co-dependent.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (version from package.json) |
| Config file | `vite.config.ts` |
| Quick run command | `npx vitest run __tests__/editRoute.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLAIM-01 | Claim without host token — no approval step | unit | `npx vitest run __tests__/sessionClaimRoute.test.ts` | ✅ (needs fixture update) |
| CLAIM-03 | add/edit/remove via /edit route, immediate | unit | `npx vitest run __tests__/editRoute.test.ts` | ❌ Wave 0 |
| CLAIM-03 | edit keeps claims (D-01) | unit | `npx vitest run __tests__/editRoute.test.ts` | ❌ Wave 0 |
| CLAIM-03 | remove purges claims for that item | unit | `npx vitest run __tests__/editRoute.test.ts` | ❌ Wave 0 |
| D-04 | currencyCode in POST body, stored in Redis | unit | `npx vitest run __tests__/sessionRoute.test.ts` | ✅ (needs assertion) |
| D-04 | currencyCode returned by GET session | unit | `npx vitest run __tests__/sessionGetRoute.test.ts` | ✅ (needs assertion) |
| Success #3 | 5 host routes return 404 | smoke (manual) | curl or manual browser verify | N/A |
| Success #6 | CI green with flat-model test replacements | CI gate | `npx vitest run` | Partial |

### Sampling Rate
- **Per task commit:** `npx vitest run` (full suite — it runs in ~10s, no reason to sample)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/editRoute.test.ts` — covers CLAIM-03 (add/edit_name/edit_price/edit_quantity/remove), D-01 (claims preserved on edit), remove-purges-claims

---

## Security Domain

No new authentication, authorization, or cryptographic concerns are introduced. The removal of `hostToken` eliminates the only auth surface in the session model. The new `/edit` route has no auth check by design (CLAIM-03: anyone can edit). Input validation (priceCents > 0, quantity > 0, itemId exists in session) must be preserved in the new route — this was already validated in the old `edit-request/route.ts` and `resolve-edit/route.ts` and should be ported verbatim.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Port validation from `edit-request/route.ts`: priceCents integer > 0, quantity integer > 0, itemId must exist in session.items |
| V2 Authentication | no | Host auth concept is removed; flat model has no auth |
| V4 Access Control | no | No access control in flat model by design |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `EditRequestForm.tsx` is a standalone component file under `components/split/` | Removal Map | If it's inlined in HostPanel only, no separate deletion needed — but HostPanel deletion covers it anyway |
| A2 | No other file imports from `accept/route.ts` or `dispute/route.ts` directly | Removal Map | If another file imports from these routes, deletion will cause TS errors in unexpected places |

> All other claims in this research are VERIFIED by direct file reads.

---

## Sources

### Primary (HIGH confidence — direct file reads)
- `/Users/ulgenayranci/playground/gsd-course/lib/sessionSchema.ts` — complete schema
- `/Users/ulgenayranci/playground/gsd-course/app/api/session/[sessionId]/claim/route.ts` — Lua scripts verbatim
- `/Users/ulgenayranci/playground/gsd-course/app/api/session/[sessionId]/route.ts` — GET handler
- `/Users/ulgenayranci/playground/gsd-course/app/api/session/route.ts` — POST create
- `/Users/ulgenayranci/playground/gsd-course/app/api/session/[sessionId]/edit-request/route.ts` — operations to port
- `/Users/ulgenayranci/playground/gsd-course/app/api/session/[sessionId]/resolve-edit/route.ts` — item mutation patterns
- `/Users/ulgenayranci/playground/gsd-course/app/api/session/[sessionId]/accept/route.ts` — accept route content
- `/Users/ulgenayranci/playground/gsd-course/app/split/[sessionId]/CollaborativeClaimingView.tsx` — consumer surface
- `/Users/ulgenayranci/playground/gsd-course/stores/useBillStore.ts` — client-side host state
- `/Users/ulgenayranci/playground/gsd-course/components/split/ClaimableItemCard.tsx` — assignedBy usage
- `/Users/ulgenayranci/playground/gsd-course/components/split/PersonSlotPicker.tsx` — PublicSessionPayload usage
- `/Users/ulgenayranci/playground/gsd-course/components/wizard/ShareLinkButton.tsx` — hostToken client flow
- All 31 test files — fixture shapes and assertion targets
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `08-CONTEXT.md` — decisions + requirements
- `npx vitest run` — 5 pre-existing failures confirmed

---

## Metadata

**Confidence breakdown:**
- Removal map: HIGH — every field and callsite confirmed by direct read
- Safe removal order: HIGH — derived from TypeScript dependency graph
- Lua analysis: HIGH — Lua strings read verbatim from source
- /edit route shape: HIGH — ported from existing routes + D-01/D-02 decisions
- Test migration: HIGH — every test file read and categorized
- currencyCode plumbing: HIGH — existing flow confirmed in OCR route, store, SetupStep

**Research date:** 2026-06-05
**Valid until:** This research is codebase-pinned; valid until any of the source files change. No time expiry.
