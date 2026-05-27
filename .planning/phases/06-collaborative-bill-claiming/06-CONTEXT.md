# Phase 6: Collaborative Bill Claiming — Context

**Gathered:** 2026-05-26
**Status:** Ready for planning
**Source:** Discuss-phase (inline conversation)

<domain>
## Phase Boundary

Full redesign of the share/split flow from Phase 4. Replaces the one-way host→guest model with a real-time collaborative claiming experience. All participants — including the host — join the same live `/split/[sessionId]` page and simultaneously claim what they ordered.

Phase 4's code (HostWaitingScreen, single-owner claims, pre-assignment to Redis) is replaced. Session API routes are extended or rewritten. The wizard loses the shared tip step; tip becomes per-person.

</domain>

<decisions>
## Implementation Decisions

### D-01: Host flow post-share
After tapping "Share", the host is redirected to `/split/[sessionId]?hostToken=xxx` — the same page guests use. There is no HostWaitingScreen. The host is a participant like everyone else, with an additional host panel for approvals.

### D-02: Durable host token
A `hostToken` (nanoid) is generated at session creation and returned alongside `sessionId`. The host's link includes `?hostToken=xxx` as a query param — this survives browser close/reopen (bookmarkable). The guest share link has no token. The token is stored in `session.hostToken` in Redis and validated on page load.

### D-03: Shared item claiming (proportional split)
Multiple people can claim the same item. Cost split: `(your_qty / total_claimed_qty) × item.priceCents`. This handles both shared dishes (everyone claims qty=1, splits equally) and quantity items (each person claims their actual count).

### D-04: Quantity items
Items have a `quantity: number` field (default 1). On the claiming view, items with quantity > 1 show a stepper: "How many did you have? [0..N]". The user sets their claimed quantity. Price per unit = `priceCents / quantity`. Person's cost = `claimed_qty × price_per_unit` (equivalent to proportional formula).

### D-05: Unclaimed units
If `sum(claims for itemId) < item.quantity`, the item is partially/fully unclaimed. These are flagged in the host panel. Host manually assigns unclaimed units by picking one or more people — same proportional split mechanic applies to the assigned people.

### D-06: No tax
Target market is Europe and Turkey where VAT is already included in displayed prices. No tax field, no tax calculation anywhere in the app.

### D-07: Per-person tip
Tip is set individually by each person after tapping "I'm done". It starts at 0%. Each person freely sets their own tip amount. There is no shared tip % in the wizard. `tips: { [personId]: number }` (cents) stored in Redis.

### D-08: "I'm done" is a soft checkpoint
After tapping "I'm done", a back button is available. Going back returns to the full claiming view with full edit rights (add/remove own claims freely). No permanent commit until tip is confirmed.

### D-09: Host-assigned item review
If any of a person's items were assigned by the host (`assignedBy: 'host'`), a review screen is shown between "I'm done" and the tip screen. Host-assigned items are visually flagged. Person can accept all → go to tip screen. Or dispute specific items → dispute bounces to host panel.

### D-10: Dispute resolution
Disputed items appear in the host panel. Host can reassign to a different person or confirm the original assignment. After host resolves, the person re-enters the claiming view (no re-review of the same item). If accepted (no host-assigned items or all accepted), person goes straight to claiming if they go back.

### D-11: Edit requests
Anyone can request to add, remove, rename, or reprice an item. The request goes into `editRequests` in Redis. Host sees a badge on their panel. Host approves (item is updated in session, all clients pick it up on next poll) or rejects (requester sees rejection). All four types (add / remove / edit_price / edit_name) are in scope.

### D-12: Real-time sync via polling
All participants poll `GET /api/session/[sessionId]` every 3 seconds (existing SWR pattern). No websockets. State changes (claims, edit requests, disputes) are visible to all within one poll cycle.

### D-13: PersonSlotPicker — identity only, no hard locking
PersonSlotPicker identifies "who am I" — uniqueness is enforced (one person per slot) but there is no concept of "taken by host" with special treatment. The first person (host) is not pre-locked. `hostPersonId` is set in Redis when the host picks their name.

### D-14: Results are immediate and per-person
After each person confirms their tip, they see their own breakdown: items + tip = total. No waiting for others. Results are final per-person, not a shared results screen.

### D-15: Claims data model
```typescript
claims.items: { [itemId]: { [personId]: { qty: number, assignedBy: 'self' | 'host' } } }
claims.personSlots: { [personId]: boolean }
claims.donePeople: { [personId]: boolean }  // "I'm done" tapped (soft)
```

### D-16: New session fields
```typescript
hostToken: string
hostPersonId: string  // set when host picks name
tips: { [personId]: number }  // cents
editRequests: { [requestId]: { personId, type, payload, status } }
disputes: { [disputeId]: { itemId, personId, status } }
```

### D-17: Wizard tip step removed
The tip step in the wizard (currently step 3 or 4) is removed. Tip is post-claiming, per-person.

### D-18: What gets removed from Phase 4
- `HostWaitingScreen` component — gone
- Pre-assignment concept (wizard assignments written to Redis) — gone
- Single-owner claims (`{ [itemId]: personId }`) — replaced by D-15 model
- Shared tip % in wizard — replaced by D-07

### Claude's Discretion
- Exact UI layout for HostPanel (edit requests / unclaimed / disputes sections)
- Whether to use tabs or accordion in HostPanel
- Exact stepper UI for quantity items (inline +/- vs modal)
- Animation/transition details
- Error message copy
- How disputes are displayed to the disputing person while pending (spinner? message?)
- Whether to add a "reassign" shortcut in the host panel vs always going through a picker
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing session infrastructure (Phase 4)
- `app/api/session/route.ts` — POST session creation (to be rewritten)
- `app/api/session/[sessionId]/route.ts` — GET session (to be extended)
- `app/api/session/[sessionId]/claim/route.ts` — POST claim (to be rewritten for new model)
- `app/api/session/[sessionId]/done/route.ts` — POST done (to be extended)
- `lib/sessionSchema.ts` — Session types (to be extended)
- `lib/redis.ts` — Redis client (unchanged)

### Existing client components (Phase 4 — some to be rewritten)
- `app/split/[sessionId]/page.tsx` — Split page (to be rewritten)
- `app/split/[sessionId]/GuestClaimingView.tsx` — Claiming view (to be rewritten)
- `components/split/PersonSlotPicker.tsx` — Identity picker (to be simplified)
- `components/split/ClaimableItemCard.tsx` — Item card (to be extended for qty + multi-claimant)
- `components/split/GuestDoneScreen.tsx` — Done screen (to be updated for proportional math)
- `components/wizard/HostWaitingScreen.tsx` — DELETE
- `components/wizard/ShareLinkButton.tsx` — Update to redirect host to split page with token

### Math
- `lib/billMath.ts` — Update for proportional splitting, remove tax

### State
- `stores/useBillStore.ts` — Remove tip step, remove assignment-to-Redis flow

### Patterns
- `.planning/phases/06-collaborative-bill-claiming/06-PATTERNS.md` (to be created by pattern mapper)

</canonical_refs>

<specifics>
## Specific Design Details

### Proportional split formula
```
person_share_of_item = (person_claimed_qty / sum_all_claimed_qty_for_item) × item.priceCents
```
If nobody claims an item (total claimed = 0), the item is flagged as unclaimed — no division by zero.

### Host token validation
```
GET /split/[sessionId]?hostToken=xxx
→ fetch session → if session.hostToken === hostToken → isHost = true
```
`isHost` is local component state derived from URL param + server validation. No separate auth.

### Unclaimed unit flag condition
```
flagged = sum(claims.items[itemId].values().map(c => c.qty)) < item.quantity
```

### Edit request payload shapes
- `add`: `{ name: string, priceCents: number, quantity: number }`
- `remove`: `{ itemId: string }`
- `edit_price`: `{ itemId: string, newPriceCents: number }`
- `edit_name`: `{ itemId: string, newName: string }`

### Dispute lifecycle
1. Person disputes item → `disputes[id] = { itemId, personId, status: 'pending' }`
2. Host sees dispute in panel → can reassign or confirm
3. `status` → `'resolved'` or `'rejected'`
4. Person polls → sees resolved/rejected → re-enters claiming

</specifics>

<deferred>
## Deferred Ideas

- WebSocket / Server-Sent Events for true real-time (v2 — polling is sufficient for MVP)
- "Reassign" shortcut in host panel (use edit flow for now)
- Group tip suggestion based on total bill (v2)
- Split a specific item unequally (e.g. 70/30) — quantity stepper covers most cases
- Multiple rounds of drinks (adding quantity after initial scan)

</deferred>

---

*Phase: 06-collaborative-bill-claiming*
*Context gathered: 2026-05-26 via inline discuss-phase*
