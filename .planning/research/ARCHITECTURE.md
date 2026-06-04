# Architecture Research

**Domain:** Collaborative bill-splitter web app — v2.0 easy-billsy redesign
**Researched:** 2026-06-04
**Confidence:** HIGH (full codebase read: all session routes, schema, Zustand store, and UI components)

---

## Context: What Was Built vs What Changes

v1.0 shipped a two-route architecture: a local wizard at `app/page.tsx` (Zustand, no server) and a
collaborative claiming view at `app/split/[sessionId]` (Redis-backed). The session was created at a
deliberate handoff point when the host tapped "Share with group". v2.0 keeps that boundary intact
but restructures what happens on each side of it, removes the host role entirely, and adds
currencyCode as a first-class field through the full data path.

---

## System Overview

```
BROWSER — Route: /  (app/page.tsx)

  SetupScreen (NEW — replaces 4-step wizard)
  +-------------------+  +------------------------------------------+
  |  ScanStep          |  |  PeopleStep (inline, same screen)        |
  |  camera input      |  |  add names; no minimum required          |
  |  POST /api/ocr     |  |  stored in useBillStore (Zustand)        |
  +-------------------+  +------------------------------------------+

  useBillStore (Zustand) — pre-share local state
    people[], items[], currencyCode (NEW), ocrStatus, sessionId
    assignments[] REMOVED — no pre-assigning in flat model

                         |
                         | POST /api/session
                         | { people, items, currencyCode }
                         | (NO hostToken, NO assignments in v2)
                         v

UPSTASH REDIS  key: session:{sessionId}

  SessionPayload (v2 — trimmed schema):
    people[], items[], currencyCode (NEW)
    claims: { items, personSlots, donePeople }
    tips: Record<PersonId, number>
    createdAt, TTL 86400s

  REMOVED from schema:
    hostToken, hostPersonId, editRequests, disputes
    ClaimEntry.assignedBy, ClaimEntry.accepted

                         |
                         | GET /api/session/{id}  (SWR 3s poll)
                         | POST /api/session/{id}/claim
                         | POST /api/session/{id}/edit  (NEW direct route)
                         | POST /api/session/{id}/done
                         | POST /api/session/{id}/tip
                         v

BROWSER — Route: /split/[sessionId]  (CollaborativeClaimingView)

  IdentityModal (NEW — replaces PersonSlotPicker with modal UX)
    reads session.people; auto-skip if length===1
    inline "Add my name" if no match found
    persists chosen personId to localStorage (existing pattern kept)

  BillView (MODIFIED — flat claiming)
    ClaimableItemCard — unchanged core; gains attribution + currencyCode
    InlineEditForm — fires POST /edit directly (no queue)
    UnassignedWarning — elevated; + "split evenly" CTA
    LiveClaimAttribution — "claimed by Alice" per item

  ResultsScreen (MODIFIED — was PersonResultsScreen)
    locked per-person breakdown
    TipModal (moved here from mid-flow)
    Copy / Edit bill / New bill actions

  AppShell (NEW — wraps all routes via layout.tsx)
    easy-billsy header wordmark + HamburgerMenu
    HamburgerMenu: New Split / History stub / About Us
```

---

## Question A: Setup + Bill View — Local Zustand vs Session Model

**Decision: Keep the existing boundary. Setup stays Zustand-local. Session is created once, at the
"Share" transition point.**

Rationale:

1. The existing `POST /api/session` creates a session from `{ people, items }` that are already in
   Zustand. This handoff is clean and proven. There is no benefit to creating the session earlier.

2. The Setup screen is a local-only, single-device operation: scan, review items, add names. No
   other device needs to see this state until the user is ready to share.

3. The session is cheap (one Redis write). Creating it eagerly (e.g. on first OCR result) would
   consume Redis commands for sessions that are abandoned. Creating it at the handoff is correct.

4. For the single-device case (one person, no sharing), the transition is:
   Setup → (session created) → IdentityModal (auto-select self) → BillView. No architectural
   difference — the session still gets created; the identity modal is satisfied by auto-select.

**What changes at the Setup → BillView transition:**

- `POST /api/session` body gains `currencyCode` (new field, see Question D).
- The body drops `assignments` — pre-populated host assignments no longer exist in the flat model.
- `useBillStore` adds a `currencyCode` field set by the OCR response.
- After session creation, the device navigates to `/split/{sessionId}` without a `#hostToken`
  fragment — there is no hostToken in v2.

The Zustand store remains the pre-share staging area. The Redis session remains the shared
collaborative state. The boundary does not move.

---

## Question B: Removing the Host Role — Flat Model Migration Path

The host role spans three layers: schema, Lua claim scripts, and UI. The removal is surgical
and preserves atomic-claim safety in full.

### Layer 1: Schema (lib/sessionSchema.ts)

**Remove from `SessionPayload`:**
- `hostToken: string`
- `hostPersonId?: PersonId`
- `editRequests: Record<string, EditRequest>`
- `disputes: Record<string, Dispute>`

**Remove types entirely:**
- `EditRequest` interface
- `Dispute` interface
- `EditPayload` union (replace with a simpler inline type for the direct-edit route)
- `ClaimEntry.assignedBy` — all claims are self-claims in v2; the field is meaningless
- `ClaimEntry.accepted` — host-assigned item acceptance flow is removed

**Simplified ClaimEntry:**
```typescript
export interface ClaimEntry {
  qty: number
  // assignedBy and accepted removed
}
```

**`PublicSessionPayload` simplifies:**
In v1 it was `Omit<SessionPayload, 'hostToken'>`. In v2 nothing is sensitive, so:
```typescript
export type PublicSessionPayload = SessionPayload
```
Keep the type alias so all imports continue to work without a rename.

**Add to `SessionPayload`:**
```typescript
currencyCode: string | null  // currency symbol detected from OCR ("£", "€", etc.)
```

### Layer 2: Lua Scripts (app/api/session/[sessionId]/claim/route.ts)

**QTY_CLAIM_SCRIPT changes:**

Remove the `claimerHostToken` / `assignedBy` / host-check block. The ARGV list shrinks from
`[itemId, personId, qty, assignedBy, hostToken]` to `[itemId, personId, qty]`.

The atomic bounds check (CR-03) that prevents `totalClaimed > item.quantity` is entirely
independent of host logic and must be preserved unchanged. The critical property — that the
check and write are a single atomic Lua operation — is unaffected by removing the host block.
Two concurrent users claiming the same item still cannot exceed `item.quantity`.

**SLOT_CLAIM_SCRIPT changes:**

Remove the `maybeHostToken` parameter and the `hostPersonId` set block. The script becomes:
set `claims.personSlots[personId] = true` and write back. Remove the `slot_taken` guard entirely
— in v2, two devices claiming the same name is explicitly allowed (per FEATURES open decision #2).
`personSlots` is repurposed as "who is connected" for live attribution display, not a lock.

The `ClaimBody` type in the route loses `hostToken` and `assignedBy`. `validateBody` simplifies.

### Layer 3: Routes to Delete

These routes exist solely to support the host workflow:

| Route | Reason for deletion |
|-------|-------------------|
| `app/api/session/[sessionId]/resolve-edit/route.ts` | Host approves/rejects edit requests |
| `app/api/session/[sessionId]/resolve-dispute/route.ts` | Host resolves disputes |
| `app/api/session/[sessionId]/dispute/route.ts` | Guest files a dispute |
| `app/api/session/[sessionId]/accept/route.ts` | Guest accepts host-assigned items |
| `app/api/session/[sessionId]/edit-request/route.ts` | Guest submits edit for host approval |

**New route to create:**
`app/api/session/[sessionId]/edit/route.ts` — direct item mutation, no token, no queue.

The item-mutation logic already exists in `resolve-edit/route.ts` lines 66–116 (the
approved-path branch). Copy that logic into the new route and remove the hostToken check and
the pending/approved/rejected state machine. The result is: read session → apply mutation →
write session → return `{ ok: true }`.

This is a direct read-modify-write without Lua, meaning there is a narrow race window if two
users edit the same item in the same ~millisecond window. For v2 the specified behavior is
last-write-wins (FEATURES open decision #2). If this becomes a concern in v2.1, the mutation
can be moved into a Lua script following the same pattern as QTY_CLAIM_SCRIPT.

### Layer 4: UI Components to Delete

| Component | Why |
|-----------|-----|
| `components/split/HostPanel.tsx` | Host management UI |
| `components/split/EditRequestForm.tsx` | Request-edit form inside HostPanel |
| `components/split/ReviewHostAssignedScreen.tsx` | Host-assigned item acceptance screen |
| `components/split/WaitingForClaimsScreen.tsx` | Waiting-for-host state screen |

### Layer 5: CollaborativeClaimingView.tsx Changes

The host removal touches multiple sections of this 700-line component:

**Remove:**
- `hostTokenParam` state and the `useEffect` that reads `#hostToken` from URL hash
- `hostPersonId` from session shape references
- `isHost` derived state and all JSX gated on it
- `HostPanel` import, FAB render, `hostPanelOpen` state
- `pendingCount` computation (was counting edit requests + disputes + unclaimed)
- `ReviewHostAssignedScreen` phase render and `hasUnacceptedHostItems` helper
- `review` from the `Phase` union type: `type Phase = 'claiming' | 'tip' | 'results'`
- `hostToken` from `handleSelect` body
- The `handleDone` branch that checked for host-assigned items post-done
- The `handleBackFromTip` branch that routed back through `review`

**Change:**
- `handleInlineSubmit` (edit path): POST to `/edit` directly instead of `/edit-request`
- `derivePhase`: remove the `hasUnacceptedHostItems` check
- `PersonSlotPicker` → `IdentityModal` (see Question C)
- Phase flow simplifies to: `claiming → tip → results`

**Add:**
- Live claim attribution in the ClaimableItemCard render path

---

## Question C: Identity Storage — Where "Who Are You?" Lives

**Decision: localStorage for persistence (existing pattern), Redis personSlots for attribution
(existing structure). Zustand is NOT used for identity.**

The identity choice (which personId "I am on this device") is session-scoped and device-scoped.
Zustand is app-global and resets on `store.reset()`. localStorage keyed by sessionId is the
correct scope — it survives page refresh, survives Zustand reset, and does not leak across sessions.

The existing pattern already does this:
```typescript
localStorage.setItem(`split:${sessionId}:personId`, selectedPersonId)
```
This pattern is kept unchanged in v2.

**What changes in v2:**

1. `PersonSlotPicker` is replaced by `IdentityModal` — a dialog component that presents the same
   name-picker grid but is rendered as a modal overlay on the Bill View rather than as a full
   blocking screen. The state storage remains the same localStorage key.

2. **Auto-skip:** if `session.people.length === 1`, write the single person's id to localStorage
   and proceed directly to BillView. No modal shown.

3. **Inline add:** if `session.people` is empty or the user taps "My name isn't here", show a
   single text-input inside the modal. On submit, call `POST /api/session/{id}/edit` with an
   `add_person` action (new action type on the direct-edit route), or create a dedicated
   `POST /api/session/{id}/add-person` route. The new person appears in `session.people` on the
   next SWR poll; the new personId goes to localStorage.

4. **Slot "taken" semantics removed:** `personSlots[personId] = true` becomes informational only —
   it indicates "a device has identified as this person." The modal renders all names as
   selectable regardless of slot state. Remove the `aria-disabled` + `opacity-40` treatment.

**Summary of identity state locations:**

| Data | Where Stored | Scope | Reason |
|------|-------------|-------|--------|
| `session.people[]` (the names list) | Redis | Session | All devices need it |
| `selectedPersonId` (my identity this device) | localStorage + React state | Device+Session | Survives refresh |
| `session.claims.personSlots` | Redis | Session | Attribution: who is connected |
| Auto-skip condition | Derived at mount: `people.length === 1` | None (derived) | No storage needed |

---

## Question D: currencyCode Data Flow — OCR to All Display Sites

**The full chain: OCR prompt → API response → Zustand → session create → Redis → SWR → formatCents.**

### Step 1: OCR Prompt Extension (app/api/ocr/route.ts)

Extend the GPT-4o-mini `RECEIPT_PROMPT` and `json_schema` to extract `currency_symbol`:

```
Return ONLY valid JSON matching this schema exactly:
{
  "currency_symbol": string | null,
  "items": [{ "name": string, "priceCents": number, "quantity": number }]
}
Rules:
... (existing rules unchanged)
- currency_symbol: find the symbol on the total line or first priced item.
  Return the symbol character (e.g. "£", "€", "¥", "₹", "$"). Return null if not visible.
```

The json_schema `properties` block gains:
```json
"currency_symbol": { "type": ["string", "null"] }
```

The route returns `{ items, currencyCode }` — one new field in the response.

### Step 2: Zustand Store (stores/useBillStore.ts)

Add to `BillState` interface:
```typescript
currencyCode: string | null
setCurrencyCode: (code: string | null) => void
```
Add to `INITIAL_STATE`: `currencyCode: null`.

The OCR result handler (in whatever component replaces `AddItemsStep`) calls
`store.setCurrencyCode(currencyCode)` after a successful OCR response.

### Step 3: Session Create Payload (app/api/session/route.ts)

`POST /api/session` body validation accepts `currencyCode: string | null`. Validator: any string
of 1–4 characters (covers all currency symbols) or null. The persisted `SessionPayload` gains
the field.

### Step 4: Schema (lib/sessionSchema.ts)

```typescript
export interface SessionPayload {
  people: Person[]
  items: Item[]
  currencyCode: string | null  // NEW
  claims: SessionClaims
  tips: Record<PersonId, number>
  createdAt: number
}
```

### Step 5: GET /api/session returns it, SWR propagates it

`PublicSessionPayload = SessionPayload` in v2 (nothing stripped). `currencyCode` is present in
every SWR poll result on the client.

### Step 6: formatCents updated (lib/billMath.ts)

Current implementation hardcodes `$`:
```typescript
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
```

v2 change — optional parameter, backward-compatible:
```typescript
export function formatCents(cents: number, currencyCode?: string | null): string {
  const symbol = currencyCode ?? '$'
  return `${symbol}${(cents / 100).toFixed(2)}`
}
```

All existing call sites that omit `currencyCode` continue to work unchanged. Call sites that
display user-facing prices pass `session.currencyCode` (or `store.currencyCode` pre-session).

A full `Intl.NumberFormat` approach (handles JPY zero-decimal, CHF rounding, etc.) is a v2.1
enhancement. Symbol-prefix is sufficient for v2.

### Step 7: Display Sites That Need currencyCode

| File | Call site | Source of currencyCode |
|------|-----------|----------------------|
| `CollaborativeClaimingView.tsx` | item prices, pending-add card | `session.currencyCode` |
| `components/split/ClaimableItemCard.tsx` | item price display | prop from parent |
| `components/split/TipScreen.tsx` | subtotal, tip amount | `session.currencyCode` via prop |
| `components/split/PersonResultsScreen.tsx` | per-line and total | `session.currencyCode` via prop |
| Pre-session results (SetupScreen local preview) | item prices | `useBillStore(s => s.currencyCode)` |
| Copy-summary string | totals per person | pass `currencyCode` into the formatter |

Pattern: components receiving a `session` prop read `session.currencyCode` directly; components
operating pre-session read from the Zustand store. No prop-drilling beyond one level.

---

## Component Inventory: New / Modified / Deleted

### NEW files

| File | Purpose |
|------|---------|
| `app/components/AppShell.tsx` | easy-billsy header wordmark + hamburger nav wrapper |
| `app/components/HamburgerMenu.tsx` | New Split / History stub / About Us nav |
| `components/split/IdentityModal.tsx` | Modal name picker; auto-skip; inline add-person |
| `app/api/session/[sessionId]/edit/route.ts` | Direct item mutation (no queue, no token) |
| `app/about/page.tsx` | Static About Us page |
| `app/history/page.tsx` | Inert History stub ("coming in v2.1") |

### MODIFIED files

| File | What Changes |
|------|-------------|
| `app/page.tsx` | Replace WizardShell + 4 step components with single SetupScreen |
| `app/layout.tsx` | Wrap children in AppShell; update metadata title to "easy-billsy" |
| `lib/sessionSchema.ts` | Remove host fields; add currencyCode; simplify ClaimEntry |
| `lib/billMath.ts` | `formatCents` gains optional `currencyCode` param |
| `stores/useBillStore.ts` | Add `currencyCode` + `setCurrencyCode`; drop `hostToken`; drop `assignments` |
| `app/api/ocr/route.ts` | Extend prompt + json_schema to return `currency_symbol`; return `currencyCode` |
| `app/api/session/route.ts` | Accept `currencyCode` in body; drop assignments pre-population; drop hostToken generation |
| `app/api/session/[sessionId]/claim/route.ts` | Remove host checks from Lua; simplify ClaimBody; relax slot_taken |
| `app/split/[sessionId]/CollaborativeClaimingView.tsx` | Full flat-model refactor; IdentityModal; direct /edit route; attribution; simplified Phase |
| `components/split/ClaimableItemCard.tsx` | Add `currencyCode` prop; add claim attribution display |
| `components/split/TipScreen.tsx` | Add `currencyCode` prop; thread to `formatCents` |
| `components/split/PersonResultsScreen.tsx` | Add `currencyCode` prop; add Copy/Edit/New bill actions |
| `components/split/SessionExpiredScreen.tsx` | Update branding to easy-billsy |
| `components/split/PersonSlotPicker.tsx` | Either deleted or refactored into IdentityModal |

### DELETED files

| File | Why |
|------|-----|
| `app/api/session/[sessionId]/resolve-edit/route.ts` | Host approval workflow removed |
| `app/api/session/[sessionId]/resolve-dispute/route.ts` | Dispute workflow removed |
| `app/api/session/[sessionId]/dispute/route.ts` | Dispute filing removed |
| `app/api/session/[sessionId]/accept/route.ts` | Host-assigned item acceptance removed |
| `app/api/session/[sessionId]/edit-request/route.ts` | Edit request queue removed |
| `components/split/HostPanel.tsx` | Host management UI removed |
| `components/split/EditRequestForm.tsx` | Host panel subcomponent removed |
| `components/split/ReviewHostAssignedScreen.tsx` | Host-assigned item review removed |
| `components/split/WaitingForClaimsScreen.tsx` | Waiting-for-host state removed |
| `components/wizard/WizardShell.tsx` | Replaced by SetupScreen |
| `components/wizard/AddPeopleStep.tsx` | Inline in SetupScreen |
| `components/wizard/AddItemsStep.tsx` | Inline in SetupScreen |
| `components/wizard/AssignItemsStep.tsx` | Flat model removes pre-assignment entirely |
| `components/wizard/ResultsStep.tsx` | Replaced by PersonResultsScreen in session flow |

---

## Recommended Phase Build Order (Phase 7+)

The constraint is "Setup screen first, then reassess." The ordering below respects that constraint
and sequences remaining phases by strict dependency order.

### Phase 7: App Shell + Setup Screen

**Goal:** Replace the wizard with a scan-first single-screen setup. App shell visible from day one.

Build first because every subsequent phase plugs into this new entry point. The SetupScreen change
to `app/page.tsx` is the foundational restructure. Doing shell + setup together avoids touching
`app/layout.tsx` twice.

Scope:
- `app/layout.tsx` — AppShell wrapper, "easy-billsy" title
- `app/components/AppShell.tsx` + `HamburgerMenu.tsx` (New Split navigates to `/`; History/About are stubs)
- `app/page.tsx` — new SetupScreen replacing WizardShell
- `app/about/page.tsx` + `app/history/page.tsx` — stubs
- `stores/useBillStore.ts` — add `currencyCode` + `setCurrencyCode`
- `app/api/ocr/route.ts` — extend prompt + schema to return `currency_symbol`

At end of Phase 7: the app loads with easy-billsy branding; users can scan a receipt and add people
on a single screen; the OCR response includes `currencyCode`. The wizard is gone. Session creation
and everything at `/split/[sessionId]` is untouched.

**Reassess gate here** — "Setup screen first, then reassess." This is the natural pause point
before committing to phases 8+.

### Phase 8: Flat Model — Schema + API Surgery

**Goal:** Remove host role from data model, Lua scripts, and routes. Add the direct-edit route.

Build second because this is purely backend/schema work with no UI surface. The SetupScreen
(Phase 7) can still create sessions using the pre-v2 schema as an interim state — the new
`currencyCode` field coexists with the host fields until Phase 8 removes them.

Scope:
- `lib/sessionSchema.ts` — remove host fields, add `currencyCode`, simplify `ClaimEntry`
- `app/api/session/route.ts` — accept `currencyCode`, drop `assignments` + `hostToken` generation
- `app/api/session/[sessionId]/claim/route.ts` — simplify Lua scripts
- `app/api/session/[sessionId]/edit/route.ts` — new direct mutation route (NEW)
- DELETE: resolve-edit, resolve-dispute, dispute, accept, edit-request routes

At end of Phase 8: the session model is clean. The old host routes return 404. The direct edit
route is live but not yet wired from the UI.

### Phase 9: Bill View Redesign + Identity Modal

**Goal:** Replace PersonSlotPicker with IdentityModal; refactor CollaborativeClaimingView to the
flat model; wire inline edit to the direct `/edit` route; add live claim attribution.

Build third because:
- Depends on Phase 8's simplified schema (no editRequests, no disputes, no hostToken)
- Depends on Phase 7's session creation passing currencyCode

Scope:
- `components/split/IdentityModal.tsx` — new component
- `app/split/[sessionId]/CollaborativeClaimingView.tsx` — full flat-model refactor
- DELETE: HostPanel, EditRequestForm, ReviewHostAssignedScreen, WaitingForClaimsScreen
- `components/split/ClaimableItemCard.tsx` — add attribution display + `currencyCode` prop
- Wire InlineEditForm to `POST /api/session/{id}/edit` directly

At end of Phase 9: the collaborative Bill View is flat. Anyone can claim and edit. Identity modal
works. The "I'm done" flow goes directly to results without a waiting state.

### Phase 10: Results Screen + Tip Modal + Currency Display

**Goal:** Locked results screen with tip-as-modal; thread `currencyCode` to all display sites.

Build fourth because:
- The tip flow depends on Phase 9's simplified session (no waiting, flat done flow)
- currencyCode threading requires Phase 7's OCR change and Phase 8's schema field to both exist

Scope:
- `components/split/PersonResultsScreen.tsx` — redesign: locked breakdown + Copy/Edit/New bill
- `components/split/TipScreen.tsx` — convert to modal launched from Results; thread currencyCode
- `lib/billMath.ts` — `formatCents` optional `currencyCode` param
- Thread `session.currencyCode` through all `formatCents` call sites (see display site table above)
- Copy-summary: use `currencyCode` and format per-person lines

At end of Phase 10: the full v2.0 flow is complete end-to-end.

---

## Data Flow: Setup to Results

```
User opens /
  SetupScreen mounts (app/page.tsx)
  User takes photo
    POST /api/ocr
    OCR returns { items, currencyCode }
    store.setItems(items)
    store.setCurrencyCode(currencyCode)              [NEW]
  User adds people inline
    store.addPerson(name)
  User taps "Start splitting"
    POST /api/session { people, items, currencyCode }  [currencyCode NEW; assignments REMOVED]
    returns { sessionId }                              [no hostToken in v2]
    store.setSessionId(sessionId)
    navigate to /split/{sessionId}

/split/[sessionId] loads CollaborativeClaimingView
  SWR GET /api/session/{id} → PublicSessionPayload
  IdentityModal shown (unless people.length === 1 → auto-skip)
    user picks name
    POST /api/session/{id}/claim { personId, action: 'slot' }
    localStorage.setItem(split:{id}:personId, selectedPersonId)
  BillView: user claims items
    POST /api/session/{id}/claim { personId, itemId, qty, action: 'qty' }
    Lua atomic bounds check + write                  [unchanged]
    SWR mutate + optimistic update                   [unchanged]
  User edits item
    POST /api/session/{id}/edit { personId, type, payload }  [NEW DIRECT ROUTE]
    read-modify-write (last-write-wins)
  User taps "I'm done"
    POST /api/session/{id}/done { personId, done: true }
    navigate to ResultsScreen directly               [no review phase, no waiting]
  ResultsScreen: locked per-person breakdown
    tap "Add tip" — TipModal opens
    POST /api/session/{id}/tip { personId, tipCents }
    modal closes, totals update
  Copy / Edit bill / New bill actions
    "New bill": store.reset() + navigate to /
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Creating the Session Before Setup Is Complete

**What people do:** Create the Redis session on first OCR result, before people are added.
**Why it is wrong:** Wastes Redis commands on abandoned sessions; people and items are still being
edited; the pre-session Zustand state is the correct place for mutable in-progress setup.
**Do this instead:** Create the session at the single handoff point when the user signals readiness.

### Anti-Pattern 2: Adding Lua Atomicity to the Direct Edit Route

**What people do:** Port the direct-edit route into a Lua script to make simultaneous edits atomic.
**Why it is wrong:** Premature optimization. The at-table context makes concurrent conflicting edits
rare. Last-write-wins is the specified behavior. Lua adds complexity without changing the UX.
**Do this instead:** Simple read-modify-write in TypeScript. Revisit in v2.1 if conflicts arise.

### Anti-Pattern 3: Keeping assignedBy on ClaimEntry "for attribution"

**What people do:** Keep `assignedBy` in ClaimEntry to track who assigned an item to whom.
**Why it is wrong:** In v2, attribution ("who claimed this") is derived from the claims map itself.
`claimsForItem` maps `personId → ClaimEntry` — the claimer is the key, not a stored field.
**Do this instead:** Drop `assignedBy` and `accepted` from ClaimEntry. Render the claimer's name
by looking up the personId key in claimsForItem against `session.people`.

### Anti-Pattern 4: Prop-drilling currencyCode Through Every Level

**What people do:** Thread `currencyCode` as a prop through every component that renders a price.
**Why it is wrong:** Creates unnecessary coupling. The currency does not change within a session.
**Do this instead:** A thin helper `formatSessionCents(cents, session)` at the top of each screen
component, or pass `session.currencyCode` explicitly only to the three direct consumers
(ClaimableItemCard, TipScreen, PersonResultsScreen) — all three already receive session or its
properties as props.

---

## Scaling Considerations

The bill-splitter use case is bounded (table groups of 2–10, sessions lasting 10–30 minutes):

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–10k sessions/day | Current architecture correct; Upstash free tier (10k commands/day) may need upgrading to Pro; no structural changes |
| 10k–100k sessions/day | Upstash Pro tier; consider caching GET /api/session at the edge (1s TTL) to reduce commands from 3s SWR polling |
| 100k+ sessions/day | Edge caching layer for reads; evaluate SSE over polling to reduce request volume; Upstash scale plan |

**Concurrency note:** At 3s polling, 5 people in one session generates ~100 Redis GETs/minute.
At 10 concurrent sessions that is 1,000 commands/minute (~1.4M/day) — above the free tier.
Upstash Pay-as-you-go or Pro tier is required for any meaningful production traffic.

---

## Sources

- Full codebase read (all files listed in the Component Inventory above)
- `.planning/PROJECT.md` — v2.0 requirements and scope
- `.planning/research/FEATURES.md` — flat model open decisions (#1 unclaimed items, #2 edit
  conflicts, #3 claiming for others, #4 editing others' claims, #5 empty setup, #6 currency fallback)

---

*Architecture research for: easy-billsy v2.0 bill splitter redesign*
*Researched: 2026-06-04*
