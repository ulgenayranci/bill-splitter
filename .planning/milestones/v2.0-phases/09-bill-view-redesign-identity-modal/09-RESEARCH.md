# Phase 9: Bill View Redesign + Identity Modal — Research

**Researched:** 2026-06-06
**Domain:** React/Next.js UI redesign — identity modal, live attribution, equal-split math, SWR polling, Redis Lua atomicity
**Confidence:** HIGH (codebase fully read; all critical paths verified in source)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Identity modal (IDENT-01–04)**
- D-01: Taken names are greyed out — once a name is claimed on a device, no other phone can pick it. Keeps existing slot-locking behavior (`claims.personSlots`); no takeover/override flow this phase.
- D-02: "I'm not listed" adds the person for everyone instantly — new name joins shared session and appears on all phones within the polling interval; can claim right away.
- D-03: Change identity = tap anywhere on the people strip in the Bill View header. Tapping reopens the Who-are-you modal.
- D-04: Claims stay with the old name on identity switch. If Sarah switches to Mike, items claimed as Sarah remain Sarah's; user un-claims/re-claims manually.

**Live attribution (CLAIM-04)**
- D-05: Each claimed item shows small colored avatar chips (initial circles) matching the header people strip — no name text on cards.
- D-06: Own claims get highlighted card treatment (amber border/tint) plus own chip alongside others.
- D-07: Chip overflow: show up to 3 chips, then "+N". Tapping may expand to show everyone.
- D-08: Remote updates are subtle — chips just appear on next poll refresh. No flashes, pulses, or toasts.

**Unclaimed-items warning (CLAIM-05, CLAIM-06)**
- D-09: Warn but allow. Tapping "I'm done" with unclaimed items shows a warning with a "Continue anyway" escape. No hard block.
- D-10: Persistent counter banner near the header ("4 of 12 items still unclaimed"), updating live. Tapping scrolls to first unclaimed item. List order stays stable.
- D-11: Share-join-link in both: header share icon AND inside the unclaimed warning dialog.
- D-12: "Continue anyway" goes straight to own results. The current hard waiting-screen gate (`allItemsFullyClaimed` blocking results) is REMOVED.

**Sharing & quantity stepper (CLAIM-02)**
- D-13: Single items split by tap-to-join: anyone tapping a claimed single item joins its sharers; cost divides equally. Tap again to leave.
- D-14: Multi-quantity items keep existing Phase 6 stepper as-is: tap claims 1 unit, +/− adjusts count.
- D-15: Shared item cards show full price plus "your share: $X.XX" once you've joined.

### Claude's Discretion
- Odd-cent rounding on equal splits: pick a deterministic rule such that sum ALWAYS equals item price exactly. Integer-cents arithmetic is the house rule.
- Identity modal visual design (within shadcn/ui dialog + current app styling).
- Exact banner/warning copy.

### Deferred Ideas (OUT OF SCOPE)
- Identity takeover flow ("that's me on another device")
- Claim-activity animations/toasts
- Edit attribution ("edited by X")
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDENT-01 | On continuing from Setup, a "Who are you?" modal prompts name selection | `PersonSlotPicker` content + `dialog.tsx` wrapping; `handleSelect` flow |
| IDENT-02 | Identity prompt skipped when device already has a chosen identity for this session | `localStorage` restore-on-load already exists; survives refactor with no changes |
| IDENT-03 | User can pick "I'm not listed" to add themselves and change identity later | New `add_person` op in `/edit` route + change-identity via people strip |
| IDENT-04 | Chosen identity persists on device so page reload doesn't re-prompt | `localStorage.setItem('split:${sessionId}:personId', ...)` already implemented |
| CLAIM-02 | Multiple people can share one item; quantity stepper sets each person's portion | D-13 tap-to-join (new Lua action) + D-14 existing stepper unchanged |
| CLAIM-04 | Live attribution shows who claimed each item, near-real-time across devices | `ClaimableItemCard` chip row already exists; extend for D-05–D-08 |
| CLAIM-05 | Unclaimed items surfaced before results so nothing is missed | New banner + unclaimed warning dialog; `allItemsFullyClaimed` gate removed |
| CLAIM-06 | User can share a join link so others claim on their own phones | `ShareLinkButton` reused in header + warning dialog |
</phase_requirements>

---

## Summary

Phase 9 rebuilds the collaborative Bill View's identity and claiming surface. The codebase entering this phase is already in good shape from Phase 8: the flat model schema is live, the `/edit` route handles all item mutations, and `ClaimableItemCard` already renders a chip row showing other claimants. The identity flow currently shows a full-page `PersonSlotPicker`; this phase wraps that content in a `Dialog` primitive and adds "I'm not listed" inline-add. The `localStorage` identity persistence (IDENT-04) is already fully implemented and survives the refactor unchanged.

Three technically non-obvious problems require precise planning: (1) tap-to-join on single-qty items breaks the existing Lua bounds check and requires a new `share` action in the claim route; (2) the "I'm not listed" add-person operation must be atomic (create person + lock slot in one write) to prevent a race where someone else claims the new slot before the creator can; (3) equal-split math in `computePersonShareFromClaims` uses `Math.round` per-person which does not guarantee cents conservation on 3-way splits — a largest-remainder helper must be added to `lib/billMath.ts` for the results display.

The phase-machine simplification (removing `waiting`) is straightforward: `allItemsFullyClaimed` gate is dropped from `derivePhase`, `handleDone` goes directly to `tip`, and `onTipConfirmed` always goes to `results`. The `WaitingForClaimsScreen` component is no longer reachable; whether to delete it or leave it is a planner decision (deleting is cleaner, but 19 existing tests mock SWR around it — none directly test the `waiting` phase, so deletion is safe).

**Primary recommendation:** Plan in five waves — (1) math helper + schema types, (2) new API actions (add_person, share/leave), (3) identity modal refactor, (4) Bill View header + banner, (5) card attribution + phase-machine rewire. Each wave is independently testable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Identity modal (who are you) | Browser/Client | — | Reads `localStorage`, calls `/claim` slot action, owned entirely in `CollaborativeClaimingView` + `Dialog` |
| Slot locking (taken names) | API/Backend (Lua) | Browser/Client | `SLOT_CLAIM_SCRIPT` atomically sets `personSlots[personId]`; UI greys out taken slots from SWR data |
| Add-person ("I'm not listed") | API/Backend | Browser/Client | Must be atomic (person create + slot lock in one Redis write); client calls new `/edit` op |
| Live attribution chips | Browser/Client | — | Reads `claimsForItem` from SWR-polled `session.claims.items`; no server change needed |
| Unclaimed-items banner | Browser/Client | — | Computes unclaimed count from `session.items` vs `claims.items`; updates every SWR poll |
| "Continue anyway" / results gate | Browser/Client | — | `derivePhase` and `handleDone` logic; removes `waiting` branch |
| Tap-to-join share | API/Backend (Lua) | Browser/Client | New Lua `SHARE_CLAIM_SCRIPT` without bounds check; share computation happens client-side at render |
| Equal-split math | Browser/Client (lib) | — | `lib/billMath.ts` largest-remainder helper; no server storage of share amounts |
| People strip / header | Browser/Client | — | New `BillViewHeader` component; reads `session.people` + `session.claims.personSlots` from SWR |

---

## Standard Stack

This phase introduces no new npm dependencies. All work is in existing code. [VERIFIED: codebase grep; architecture commitment in STATE.md "no new npm dependencies required"]

### Core Libraries in Use
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Next.js | ^16.2.6 | Full-stack framework | App Router; route handlers |
| React | ^19.2.0 | UI | Server + client components |
| SWR | ^2.4.1 | Polling + optimistic updates | `refreshInterval: 3000`, `mutate` |
| @base-ui/react | ^1.4.1 | Dialog primitive | `Dialog.Root`, `Dialog.Popup`, `Dialog.Backdrop` |
| Tailwind CSS | ^4.2.4 | Styling | Utility classes |
| Zustand | ^5.0.13 | Client state | Not used in `/split/` route (SWR owns server state) |
| Upstash Redis | — | Session store | Lua eval for atomicity |
| lucide-react | — | Icons | `Share2`, `Receipt`, `Link` for header icons |

### Package Legitimacy Audit

No new packages are introduced in this phase. All libraries are pre-existing project dependencies. [VERIFIED: package.json read; STATE.md architecture commitment]

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User on Device A                     Redis (Upstash)
     │                                     │
     │  GET /api/session/:id (SWR 3s)     │
     │◄────────────────────────────────────│
     │  session.people, .items, .claims   │
     │                                     │
     ├─ Identity Modal (on load)           │
     │   └─ localStorage restore          │
     │       └─ if no stored id → show    │
     │                                     │
     ├─ POST /claim { action:'slot' }      │
     │   └─ SLOT_CLAIM_SCRIPT (Lua)   ────►│ personSlots[id]=true
     │                                     │
     ├─ POST /edit { op:'add_person' }     │
     │   └─ ADD_PERSON_SCRIPT (Lua)   ────►│ people[]+= new; personSlots[newId]=true
     │   └─ response: { personId }        │
     │                                     │
     ├─ Tap item (qty:1, sharing)          │
     │   └─ POST /claim { action:'share' }│
     │       └─ SHARE_CLAIM_SCRIPT (Lua) ►│ claims.items[itemId][personId]={qty:1}
     │                                     │
     ├─ Tap item (multi-qty stepper)       │
     │   └─ POST /claim { action:'qty' }  │
     │       └─ QTY_CLAIM_SCRIPT (Lua) ──►│ claims.items[itemId][personId]={qty:N}
     │                                     │
     │  SWR poll (3s interval)            │
     │◄────────────────────────────────────│ All claimants now visible
     │  ClaimableItemCard shows chips     │
     │                                     │
     └─ "I'm done" → TipScreen → Results  │
         (no waiting gate)               │

Device B polls same session (3s) → sees Device A's chips appear
```

### Recommended Project Structure (changes only)

```
lib/
└── billMath.ts              # + computeEqualShareCents() helper

app/api/session/[sessionId]/
└── claim/route.ts           # + 'share' action (SHARE_CLAIM_SCRIPT Lua)
└── edit/route.ts            # + 'add_person' op (ADD_PERSON_SCRIPT Lua)

components/split/
├── PersonSlotPicker.tsx     # Refactored: modal content only (no outer page layout)
├── IdentityModal.tsx        # NEW: Dialog wrapper + PersonSlotPicker + "I'm not listed" form
├── BillViewHeader.tsx       # NEW: title+date, people strip, receipt+share icons
├── UnclaimedBanner.tsx      # NEW: "N of M items unclaimed" counter + scroll-to-first
└── ClaimableItemCard.tsx    # + attribution chips (D-05/06/07), "your share" line (D-15),
                             #   tap-to-join for qty:1 items (D-13)

app/split/[sessionId]/
└── CollaborativeClaimingView.tsx  # Major rewrite: phase machine, modal orchestration
```

### Pattern 1: Identity Modal with Auto-Show and Change-Identity

**What:** Dialog opens automatically when `selectedPersonId === null` and has no close-without-selection escape hatch. Re-opens when user taps the people strip.
**When to use:** On initial load (no localStorage), or on explicit identity change trigger.

```tsx
// Source: dialog.tsx (@base-ui/react Dialog.Root)
// controlled open state; onOpenChange must not allow dismissal if no identity chosen yet
const [identityModalOpen, setIdentityModalOpen] = useState(false)
const [changingIdentity, setChangingIdentity] = useState(false)

// Show on load if no stored identity
useEffect(() => {
  if (!session) return
  const stored = localStorage.getItem(`split:${sessionId}:personId`)
  if (!stored || !session.claims?.personSlots?.[stored]) {
    setIdentityModalOpen(true)
  } else {
    setSelectedPersonId(stored as PersonId)
  }
}, [session, sessionId])

<Dialog
  open={identityModalOpen}
  onOpenChange={(open) => {
    // Block dismiss if user has no identity yet (not changingIdentity)
    if (!open && selectedPersonId === null) return
    setIdentityModalOpen(open)
  }}
>
  <IdentityModal
    session={session}
    onSelect={handleSelect}
    onAddPerson={handleAddPerson}
  />
</Dialog>
```

### Pattern 2: Tap-to-Join (Share Action) vs. Qty Claim

**What:** Single-qty items use a new `share` action that bypasses item-quantity bounds. Multi-qty items continue using the existing `qty` action.
**When to use:** `isMultiQty = (item.quantity ?? 1) > 1` determines which path to take.

```tsx
// In ClaimableItemCard — D-13 tap-to-join for qty:1 items
const handleTapToJoin = () => {
  // onShareChange(personId, joining: boolean)
  onShareChange(myPersonId, myQty === 0)
}

// In CollaborativeClaimingView
async function handleShareChange(itemId: ItemId, joining: boolean) {
  const res = await fetch(`/api/session/${sessionId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personId: selectedPersonId,
      itemId,
      action: 'share',          // new action — bypasses bounds check
      joining,                   // true = join, false = leave
    }),
  })
  // ... optimistic update + rollback
}
```

### Pattern 3: Add-Person (Atomic Lua)

**What:** "I'm not listed" creates the person AND locks their slot in a single Lua write. Response includes the new `personId` so the client can immediately set `selectedPersonId`.
**When to use:** Only from the IdentityModal "I'm not listed" path.

```tsx
// In CollaborativeClaimingView
async function handleAddPerson(name: string) {
  const res = await fetch(`/api/session/${sessionId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'add_person', name }),
  })
  const data = await res.json()
  if (data.ok) {
    setSelectedPersonId(data.personId)
    localStorage.setItem(`split:${sessionId}:personId`, data.personId)
    setIdentityModalOpen(false)
    await mutate()
  }
}
```

### Pattern 4: Equal-Split Math (Largest-Remainder)

**What:** `computeEqualShareCents(priceCents, numSharers, myIndex)` returns this person's share in cents, using largest-remainder to guarantee sum conservation.
**When to use:** Only for single-qty shared items (D-13 path). Multi-qty uses existing `Math.round` proportional formula.

```typescript
// Source: derived from existing computePersonTotals pattern in lib/billMath.ts
// New function to add alongside existing helpers
export function computeEqualShareCents(
  priceCents: number,
  numSharers: number,
  myIndex: number   // 0-based index of this person in sorted claimant list
): number {
  if (numSharers <= 0) return 0
  const base = Math.floor(priceCents / numSharers)
  const remainder = priceCents % numSharers
  return base + (myIndex < remainder ? 1 : 0)
}
```

**Why**: Current `computePersonShareFromClaims` uses `Math.round((priceCents * myQty) / totalQty)`. For 3 people on a $10.00 item: `Math.round(1000/3) = 333` per person = 999 total (off by $0.01). With largest-remainder: `[334, 333, 333]`, sum = 1000. The existing test at `billMath.test.ts:201` expects 333 — the new helper is additive (not a replacement), so the existing test is unaffected. [VERIFIED: billMath.ts read; billMath.test.ts read; manual calculation]

**Determinism rule:** Sort claimants by their personId (lexicographic) before assigning indices. This ensures the first sharer in alphabetical ID order gets the extra cent, which is stable across renders and devices. [ASSUMED: no prior rule in codebase; this is the recommended approach]

### Pattern 5: Phase-Machine Rewire (D-12)

**What:** `derivePhase` no longer routes to `waiting`; the `waiting` phase is removed from the type union. `handleDone` always advances to `tip`; `onTipConfirmed` always advances to `results`.
**When to use:** Replace the existing `waiting` paths.

```typescript
// BEFORE (current):
type Phase = 'claiming' | 'tip' | 'waiting' | 'results'
function derivePhase(personId, session): Phase {
  if (session.tips?.[personId] !== undefined) {
    if (!allItemsFullyClaimed(session)) return 'waiting'  // ← REMOVE
    return 'results'
  }
  if (session.claims?.donePeople?.[personId]) return 'tip'
  return 'claiming'
}

// AFTER (Phase 9):
type Phase = 'claiming' | 'tip' | 'results'
function derivePhase(personId, session): Phase {
  if (session.tips?.[personId] !== undefined) return 'results'
  if (session.claims?.donePeople?.[personId]) return 'tip'
  return 'claiming'
}
// onTipConfirmed: always setPhase('results'), no allItemsFullyClaimed check
```

`allItemsFullyClaimed()` still needed for: the unclaimed banner count (D-10) and the unclaimed warning dialog (D-09). It is NOT removed — just removed from the phase gate.

### Anti-Patterns to Avoid

- **Releasing slots on identity switch:** Do NOT clear `personSlots[oldId]` when a user picks a new identity. Slot release would allow another phone to claim "Sarah" while Sarah's items are still attributed to her (D-01, D-04). Recommendation: slots are one-way locks for the duration of the session.
- **Using `qty` claim action for tap-to-join:** The existing `QTY_CLAIM_SCRIPT` Lua bounds check rejects `qty > 0` if `totalClaimed ≥ item.quantity`. Two people both claiming qty:1 on a qty:1 item fails this check. The new `share` action must have its own Lua script without this constraint.
- **Generating personId client-side for add-person:** Client-generated IDs for new people create a window where two devices could generate the same ID (nanoid collision risk is very low but non-zero), and more importantly, the client cannot atomically lock the slot. The server must generate the ID.
- **Non-Lua add_person:** The `/edit` route currently uses GET+mutate+SET (last-write-wins). For item edits this is acceptable (last price wins). For `add_person` it is risky: two "I'm not listed" requests 50ms apart could both read the same people array and both write conflicting entries. The `add_person` operation should use a Lua script or at minimum append-only semantics.
- **Floating-point equal splits:** Never compute `priceCents / numSharers` and store the result. Always use integer cents with largest-remainder at display time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog with focus trap | Custom div + portal | `dialog.tsx` (already present, @base-ui/react) | Focus trap, escape key, backdrop, ARIA `role=dialog` already handled |
| Share link copy/share | Custom clipboard code | `ShareLinkButton.tsx` (already present) | Already handles navigator.share, clipboard API, execCommand fallback |
| Avatar color assignment | New color logic | `AVATAR_COLORS` + `person.colorIndex` (already in store) | Colors are stable per-person, consistent between header strip and cards |
| Largest-remainder rounding | Math on the fly in components | New `computeEqualShareCents` helper in `lib/billMath.ts` | Centralizes the determinism rule; testable in isolation |
| Redis atomic operations | `redis.get()` + logic + `redis.set()` | `redis.eval()` Lua script | `redis.multi()` is NOT atomic on Upstash REST (Phase 6 key decision) |

---

## Runtime State Inventory

Not applicable — this is a UI/API redesign phase, not a rename/refactor. No stored data migrations required. The `SessionPayload` schema is unchanged; only client logic and one new API operation are added.

---

## Common Pitfalls

### Pitfall 1: tap-to-join breaks the Lua bounds check
**What goes wrong:** A second person taps a single-qty item that is already claimed by one person. The existing `QTY_CLAIM_SCRIPT` computes `totalClaimed - myExisting + qty = 1 - 0 + 1 = 2 > item.quantity (1)` and returns `qty_exceeded`. The tap silently fails.
**Why it happens:** The `qty` action semantics assume qty represents whole inventory units, and that total claimed must not exceed item quantity.
**How to avoid:** Add a new `share` action with `SHARE_CLAIM_SCRIPT` that writes `claims.items[itemId][personId] = {qty: 1}` without a bounds check. The `joining: boolean` payload distinguishes join from leave.
**Warning signs:** A `409 qty_exceeded` response from `/claim` when `action: 'qty'` is used for a single-item tap.
[VERIFIED: claim/route.ts Lua script read; manual analysis of bounds check logic]

### Pitfall 2: add_person race creates duplicate or conflicting people
**What goes wrong:** Two users both tap "I'm not listed" within 50–200ms of each other (the non-Lua window between GET and SET in `/edit`). Both read the same `people[]`, both append their new person, and the second write overwrites the first person's addition.
**Why it happens:** The current `/edit` route is intentionally last-write-wins (fine for item price/name edits). Adding a person is an append operation, not a replacement — it has a different atomicity requirement.
**How to avoid:** Implement `add_person` as a Lua script (`ADD_PERSON_SCRIPT`) that appends to `session.people` and atomically locks `personSlots[newId]` in one `redis.eval` call.
**Warning signs:** A person appears on the `/edit` response but does not appear in the SWR-fetched session for other devices.
[VERIFIED: edit/route.ts architecture read; Phase 6 KEY DECISION in STATE.md about Lua eval]

### Pitfall 3: Math.round on 3-way equal split loses a cent
**What goes wrong:** Person's share displayed in results is off by $0.01 vs. the stated item price. Three people share a $10.00 item; each sees $3.33 in results; total = $9.99 (one cent missing).
**Why it happens:** `computePersonShareFromClaims` uses `Math.round((priceCents * myQty) / totalQty)`. For `1000 * 1 / 3 = 333.33`, round → 333, sum = 999.
**How to avoid:** For equal-share items (D-13 tap-to-join), call the new `computeEqualShareCents` helper that uses largest-remainder. The existing `computePersonShareFromClaims` handles multi-qty proportional splits; equal-share items go through the new path.
**Warning signs:** Test that `sum(computeEqualShareCents(1000, 3, 0..2)) === 1000` fails.
[VERIFIED: billMath.ts read; billMath.test.ts proportional rounding test verified at 333 (not 334)]

### Pitfall 4: Lua strings are opaque to TypeScript — audit separately
**What goes wrong:** TypeScript type checks pass, but the Lua string contains a stale field reference (e.g., `session.claims.hostToken` or `session.claims.assignedBy`) from before Phase 8 cleanup, causing silent Lua errors on Redis eval.
**Why it happens:** Lua strings inside TypeScript template literals are not analyzed by the TypeScript compiler. Phase 8 STATE.md records: "Lua script strings audited separately from TypeScript."
**How to avoid:** When writing new Lua scripts (`SHARE_CLAIM_SCRIPT`, `ADD_PERSON_SCRIPT`), use only field paths confirmed in the current `lib/sessionSchema.ts`. When editing existing scripts, re-read the full Lua string before modifying.
**Warning signs:** `redis.eval()` returns `'invalid_session'` or nil for sessions that are confirmed-valid via GET.
[VERIFIED: STATE.md key decision "Lua script strings audited separately from TypeScript"; claim/route.ts Lua read]

### Pitfall 5: Identity modal blocking the render when session hasn't loaded
**What goes wrong:** `session` is undefined on first render (SWR loading). Rendering `IdentityModal` that reads `session.people` before data arrives throws a TypeError. Alternatively, showing the modal before we know whether `localStorage` has a stored identity causes a flicker ("Who are you?" modal appears then immediately closes).
**Why it happens:** SWR is async; the effect that reads localStorage and restores identity runs after the first render.
**How to avoid:** Gate the modal open state: only compute `shouldShowModal` after `session` is defined AND the localStorage check has run. Show `<div role="status">Loading…</div>` until then. The existing `if (!session) return <div role="status">Loading…</div>` guard is the right pattern.
[VERIFIED: CollaborativeClaimingView.tsx lines 130–131 — existing loading guard]

### Pitfall 6: PersonSlotPicker opacity class mismatch with tests
**What goes wrong:** `PersonSlotPicker.test.tsx` Test 2 already fails because the component uses `opacity-40` but the test queries for `[class*="opacity-50"]`. This is a pre-existing test failure. When refactoring `PersonSlotPicker` into modal content, the opacity class must be fixed to `opacity-50` to make the test pass.
**Why it happens:** The class was changed in the component without updating the test.
**How to avoid:** Change `opacity-40` to `opacity-50` in `PersonSlotPicker.tsx` as part of the refactor. The test is ground truth.
[VERIFIED: PersonSlotPicker.tsx grep ("opacity-40"); PersonSlotPicker.test.tsx Test 2 read; vitest run confirmed failure]

### Pitfall 7: Bill title — merchant name is not in the OCR schema
**What goes wrong:** The Bill View header design shows "JW MARRIOTT ESSEX HOUSE" as the bill title. No `merchantName` or equivalent field exists in `SessionPayload`, `Item`, or the OCR JSON schema. Assuming the field exists and accessing `session.merchantName` produces `undefined`.
**Why it happens:** The OCR prompt (`RECEIPT_PROMPT`) and `json_schema` only extract `items` (name/priceCents/quantity) and `currencyCode`. Merchant name extraction is NOT implemented.
**How to avoid:** Use a fallback: display "Bill" + formatted date from `session.createdAt`. Example: `"Bill — Jun 26"`. Do NOT add a `merchantName` field to OCR or `SessionPayload` in this phase (scope creep; CONTEXT.md says "do NOT scope-creep OCR changes"). The fallback is the correct in-scope solution.
[VERIFIED: app/api/ocr/route.ts JSON schema read — no merchantName field; lib/sessionSchema.ts read — createdAt: number exists]

### Pitfall 8: `WaitingForClaimsScreen` — test implications before deletion
**What goes wrong:** `WaitingForClaimsScreen` is imported and rendered in `CollaborativeClaimingView.tsx`. Removing the `waiting` phase branch also removes all import and rendering paths. If the component file is deleted without updating the import, TypeScript build breaks.
**Why it happens:** The component exists as a named import. Removing the render without removing the import leaves a dead import (harmless but noisy) or a TypeScript error if the file is deleted.
**How to avoid:** Either (a) delete the file and remove the import, or (b) keep the file and just stop rendering it. Option (a) is cleaner. No test directly tests `WaitingForClaimsScreen` rendering — the 19 tests in `CollaborativeClaimingView.test.tsx` mock SWR and none reach the waiting state. Safe to delete.
[VERIFIED: WaitingForClaimsScreen.tsx read; CollaborativeClaimingView.test.tsx grep — no test covers `WaitingForClaimsScreen` by name]

---

## Critical Technical Decisions (Researcher Recommendations)

These decisions are in "Claude's Discretion" scope and affect planning directly.

### A. Data representation for D-13 tap-to-join

**Recommendation:** Keep `ClaimEntry = { qty: number }` unchanged. For a `quantity: 1` item with multiple sharers, each sharer has `claims.items[itemId][personId] = { qty: 1 }`. The `totalQty` will be `numSharers` (e.g., 3 people each with `qty: 1` → totalQty = 3). At results time, `computePersonShareFromClaims` already handles this: `myQty / totalQty = 1/3`. The existing formula works correctly — the only addition is `computeEqualShareCents` for the "your share" display on the card (D-15) and for the results screen to show exact cents.

This keeps the schema change-free and makes the math derive purely from claimant count at compute time. [VERIFIED: ClaimableItemCard.tsx and billMath.ts confirm this model already works for multi-person on single items — the bounds-check Lua is the only blocker]

### B. Slot release on identity switch

**Recommendation: No slot release.** When user A switches from "Sarah" to "Mike", Sarah's `personSlots[sarahId] = true` stays set. Rationale: (1) Sarah's claims remain attributed to Sarah (D-04); allowing someone else to claim "Sarah" while Sarah's items are still under that name creates confusing attribution. (2) The slot system's purpose is identity ownership, not inventory. (3) Releasing slots opens a denial-of-service vector (keep switching to free up "desirable" names). The only cost of no-release is that a slot remains locked even after the claimer abandons it — acceptable given the 24h TTL on sessions. [ASSUMED: reasoning from design principles; no prior decision in CONTEXT.md]

### C. Odd-cent rounding rule

**Recommendation: Largest-remainder, sort claimants by personId ascending.** The first claimer (lowest personId lexicographically) gets the extra cent when the price doesn't divide evenly. This is deterministic, requires no stored state, and produces stable results across all devices because personId order is consistent. Example: `$10.00 ÷ 3` → person with lexicographically smallest personId gets `$3.34`; others get `$3.33`. Sum = `$10.00`. [ASSUMED: algorithm choice; the rule itself is delegated to Claude per CONTEXT.md]

### D. add_person route decision: extend /edit or new route

**Recommendation: Extend the `/edit` route with `op: 'add_person'`** using a new `ADD_PERSON_SCRIPT` Lua script. This keeps all session mutation behind a single endpoint, consistent with the Phase 8 pattern. The Lua approach is required for atomicity (create person + lock slot together). Response shape: `{ ok: true, personId: string }` — the client needs the generated ID immediately to set identity. [VERIFIED: edit/route.ts architecture; SLOT_CLAIM_SCRIPT pattern from claim/route.ts]

### E. "I'm done" with unclaimed items warning — dialog vs window.confirm

**Recommendation: Use `Dialog` component, not `window.confirm`.** The warning dialog must contain a share link CTA (D-11: "Share the link so others can claim" with the actual session URL). `window.confirm` cannot render clickable links. Use `DialogContent` with a `ShareLinkButton`-style copy-link action. This is consistent with the Phase 8 decision to move toward proper dialogs for important interactions. [VERIFIED: dialog.tsx read — all primitives available; ShareLinkButton.tsx read — reusable copy-link logic]

---

## Code Examples

### Lua Script: SHARE_CLAIM_SCRIPT (new — no bounds check)

```lua
-- Source: derived from QTY_CLAIM_SCRIPT pattern in app/api/session/[sessionId]/claim/route.ts
-- Handles tap-to-join / tap-to-leave on single-qty shared items (D-13)
-- No bounds check: multiple people may claim qty:1 on the same qty:1 item

local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

local itemId = ARGV[1]
local personId = ARGV[2]
local joining = ARGV[3]  -- 'true' or 'false'

if not session.claims then session.claims = {} end
if not session.claims.items then session.claims.items = {} end
if not session.claims.items[itemId] then session.claims.items[itemId] = {} end

if joining == 'true' then
  session.claims.items[itemId][personId] = { qty = 1 }
else
  session.claims.items[itemId][personId] = nil
end

-- Clean up empty item entry
local hasAny = false
for _ in pairs(session.claims.items[itemId]) do hasAny = true; break end
if not hasAny then session.claims.items[itemId] = nil end

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
```

### Lua Script: ADD_PERSON_SCRIPT (new — atomic person+slot)

```lua
-- Source: derived from SLOT_CLAIM_SCRIPT + edit/route.ts add pattern
-- Creates new person, assigns colorIndex, locks their slot atomically

local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok then return 'invalid_session' end

local name = ARGV[1]
local newPersonId = ARGV[2]  -- caller passes nanoid() generated in TS (before eval)

if not session.people then session.people = {} end
if not session.claims then session.claims = {} end
if not session.claims.personSlots then session.claims.personSlots = {} end

local colorIndex = #session.people % 6
table.insert(session.people, { id = newPersonId, name = name, colorIndex = colorIndex })
session.claims.personSlots[newPersonId] = true

redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
```

Note: `nanoid()` is called in TypeScript before `redis.eval()` and passed as `ARGV[2]`. Lua does not have a UUID/nanoid equivalent, so the ID generation stays in TypeScript — this is not a race condition because the ID is freshly generated per request and collision probability is negligible (nanoid 21-char = ~10^30 unique values). [VERIFIED: nanoid import in edit/route.ts; Lua eval pattern in claim/route.ts]

### SWR Optimistic Update Pattern for Share Action

```typescript
// Source: handleQtyChange in CollaborativeClaimingView.tsx (existing pattern, adapted)
async function handleShareChange(itemId: ItemId, joining: boolean) {
  if (!selectedPersonId || !session) return
  const personId = selectedPersonId

  // Build optimistic snapshot
  const claimsForItem = { ...(session.claims?.items?.[itemId] ?? {}) }
  if (joining) {
    claimsForItem[personId] = { qty: 1 }
  } else {
    delete claimsForItem[personId]
  }
  const nextItems = { ...session.claims?.items }
  if (Object.keys(claimsForItem).length === 0) {
    delete nextItems[itemId]
  } else {
    nextItems[itemId] = claimsForItem
  }
  const optimistic: SessionPayload = {
    ...session,
    claims: { ...session.claims, items: nextItems },
  }

  try {
    await mutate(
      async () => {
        const res = await fetch(`/api/session/${sessionId}/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId, itemId, action: 'share', joining }),
        })
        if (!res.ok) throw new Error('share_failed')
        return fetcher(swrKey)
      },
      { optimisticData: optimistic, rollbackOnError: true, revalidate: true }
    )
  } catch (err) {
    setItemErrors((prev) => ({ ...prev, [itemId]: claimErrorMessage(err, 'save') }))
  }
}
```

### Bill View Header Component

```tsx
// Source: 09-design-bill-view-header.png analysis + existing AVATAR_COLORS pattern
// Bill title: "Bill — Jun 26" (fallback — no merchantName in session)
// People strip: own identity as expanded pill, others as compact circles, overflow "+N"

interface BillViewHeaderProps {
  session: SessionPayload
  myPersonId: PersonId | null
  onStripTap: () => void  // Opens change-identity modal (D-03)
  sessionId: string
}

// Date format from session.createdAt (Unix ms timestamp)
function formatBillDate(createdAt: number): string {
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// The design shows own identity as an expanded pill with name text + initial circle
// Others are compact initial circles; overflow "+N" for > 3 total
const MAX_STRIP_AVATARS = 3  // others shown before +N (own identity is always shown)
```

### Unclaimed Counter Computation

```typescript
// Source: allItemsFullyClaimed pattern in CollaborativeClaimingView.tsx (adapted)
// Returns { unclaimed: number, total: number } for the banner
function getUnclaimedCounts(session: SessionPayload): { unclaimed: number; total: number } {
  let unclaimed = 0
  for (const item of session.items) {
    const total = Object.values(session.claims?.items?.[item.id] ?? {})
      .reduce((sum, e) => sum + (e?.qty ?? 0), 0)
    if (total < (item.quantity ?? 1)) unclaimed++
  }
  return { unclaimed, total: session.items.length }
}
// Used in: banner ("4 of 12 items still unclaimed"), and the done warning dialog
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full-page PersonSlotPicker | Dialog modal (this phase) | Phase 9 | Identity flow no longer blocks access to the Bill View header/list |
| `waiting` hard gate before results | Warn-but-allow (D-09, D-12) | Phase 9 | Nobody is held hostage; unclaimed items show a warning, not a lock |
| Single-person item claiming | Tap-to-join equal split (D-13) | Phase 9 | Multiple people can share one item |
| No bill title/date in header | "Bill — Jun X" fallback (this phase) | Phase 9 | Merchant name absent from OCR — fallback is in-scope; OCR extension is not |

**Deprecated/outdated:**
- `waiting` phase branch in `CollaborativeClaimingView.tsx`: replaced by warn-but-allow in Phase 9.
- `allItemsFullyClaimed()` as a gate: still used for banner count, but no longer gates phase transitions.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Slots are one-way locks; no slot release on identity switch | Architecture Patterns / Critical Decision B | If wrong, some users could retake another's slot mid-session; fixable with a new release API if needed |
| A2 | Deterministic odd-cent rule: sort claimants by personId ascending, first gets extra cent | Critical Decision C | If wrong, individual users may see different share amounts on different renders; fixable by establishing rule before first user hits results |
| A3 | `ADD_PERSON_SCRIPT` passes nanoid from TypeScript as ARGV[2] to Lua (no server-side ID gen in Lua) | Code Examples | If Lua environment ever changes or nanoid changes format, the pattern still works (ID is just a string) |
| A4 | Deleting `WaitingForClaimsScreen.tsx` is safe (no tests directly test it) | Common Pitfalls 8 | If wrong, a deletion breaks a test — easily recovered by restoring the file |

---

## Open Questions (RESOLVED)

1. **Should WaitingForClaimsScreen be deleted or kept as dead code?**
   - What we know: Component is 19 lines; removing its only render site is a Phase 9 change; no tests directly exercise it
   - What's unclear: Whether a future phase might repurpose it (e.g., "waiting for others to finish before final results lock" in a future social results screen)
   - Recommendation: Delete it. The file name implies "blocking" behavior which is explicitly removed. If needed, it can be re-created in minutes.

2. **Should the "your share" (D-15) display use `computeEqualShareCents` or show the server-authoritative total?**
   - What we know: The share is computed client-side from claimant count; there is no server-stored "your share" field
   - What's unclear: If two devices see different SWR snapshots (one poll behind), they might show slightly different share amounts for a brief moment
   - Recommendation: Show the derived share in real-time from current SWR data. The 3s poll window is acceptable; the final answer is always the same once both devices converge.

3. **When should the unclaimed warning dialog appear — pre-emptively or only on "I'm done" tap?**
   - What we know: D-09 says "tapping I'm done with unclaimed items shows a warning"
   - What's unclear: Whether the banner (D-10) itself should be tappable to open a more detailed dialog, or just scroll to the first unclaimed item
   - Recommendation: Banner tap → scroll to first unclaimed item (D-10 literal). "I'm done" tap → dialog (D-09). Two separate behaviors.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | ✓ | v24.15.0 | — |
| npm | Dependencies | ✓ | 11.12.1 | — |
| Upstash Redis | `/claim`, `/edit` Lua | ✓ (env var) | serverless | — |
| vitest | Test suite | ✓ | ^3.x (via package.json) | — |
| @testing-library/react | Tests | ✓ | in devDependencies | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run __tests__/billMath.test.ts __tests__/CollaborativeClaimingView.test.tsx` |
| Full suite command | `npx vitest run` |

### Baseline: Pre-existing Failures (NOT caused by Phase 9)
The test suite enters Phase 9 with 4 pre-existing failures:
- `AddItemsStep.test.tsx` — v1 wizard test (stale)
- `AddPeopleStep.test.tsx` (2 failures) — v1 wizard test (stale)
- `PersonSlotPicker.test.tsx` Test 2 — `opacity-40` vs `opacity-50` class mismatch (fix in Wave 1 of this phase)

Phase 9 must not introduce any NEW failures beyond these 4.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDENT-01 | Identity modal shows on load when no localStorage identity | unit | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ (update Test 1) |
| IDENT-02 | Modal skipped when localStorage has valid identity for session | unit | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ (new test) |
| IDENT-03 | "I'm not listed" calls `/edit` with `op: add_person` + sets personId | unit | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ (new test) |
| IDENT-04 | localStorage persists and restores identity on reload simulation | unit | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ (existing effect — verify still works post-refactor) |
| CLAIM-02 | Tap on single-qty shared item calls `/claim` with `action: 'share'` | unit | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ (new test) |
| CLAIM-04 | Attribution chips visible on ClaimableItemCard when others have claimed | unit | `npx vitest run __tests__/ClaimableItemCard.test.tsx` | ✅ (existing chip row tests — verify D-05/06/07 compliance) |
| CLAIM-05 | Unclaimed banner shows correct count | unit | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ (new test) |
| CLAIM-05 | "I'm done" with unclaimed shows dialog (not window.confirm) | unit | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ (new test) |
| CLAIM-06 | Share icon present in Bill View header | unit | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ (new test) |
| math | `computeEqualShareCents` sum always equals priceCents | unit | `npx vitest run __tests__/billMath.test.ts` | ✅ (new test in existing file) |
| D-12 | "Continue anyway" goes to results, not waiting | unit | `npx vitest run __tests__/CollaborativeClaimingView.test.tsx` | ✅ (update Test 18) |

### Sampling Rate
- **Per task commit:** `npx vitest run __tests__/billMath.test.ts __tests__/CollaborativeClaimingView.test.tsx __tests__/ClaimableItemCard.test.tsx __tests__/PersonSlotPicker.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (with pre-existing 3 failures resolved by this phase's refactor, leaving 0 or max 3 stale v1 wizard failures that are already logged as deferred)

### Wave 0 Gaps
- [ ] New test cases in `__tests__/CollaborativeClaimingView.test.tsx` — IDENT-01/02/03, CLAIM-02/05/06, D-12
- [ ] New test cases in `__tests__/billMath.test.ts` — `computeEqualShareCents` (3 test cases: 2-way, 3-way, sum conservation)
- [ ] Fix `PersonSlotPicker.test.tsx` Test 2 — change expected class from `opacity-50` to match component, or fix component from `opacity-40` to `opacity-50` (test is ground truth: fix the component)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Anonymous sessions — no auth credentials involved |
| V3 Session Management | No | 24h TTL Redis sessions; no server-side session tokens beyond sessionId in URL |
| V4 Access Control | Yes | Slot locking (personSlots) prevents identity takeover; all participants equal in flat model |
| V5 Input Validation | Yes | `add_person` op: validate name length (1–50 chars), sanitize; new Lua script handles atomic write |
| V6 Cryptography | No | No cryptographic operations added this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Name injection in add_person | Tampering | Server-side name validation: non-empty string, max 50 chars, trim whitespace — same as existing `/edit` name validation |
| Slot exhaustion (too many add_person calls) | Denial of Service | Lua script can gate on `#session.people < MAX_PEOPLE` (suggest 20 max); reject if exceeded |
| Join-spam on a single item | Denial of Service | The `share` action writes `{qty:1}` idempotently — multiple joins by same person have no effect beyond the first (Lua: `session.claims.items[itemId][personId] = {qty=1}` is idempotent) |
| CSRF on claim/edit endpoints | Tampering | Same-site cookies not used; endpoints are REST with JSON body — no CSRF surface in the current architecture |

---

## Sources

### Primary (HIGH confidence)
- `lib/sessionSchema.ts` — schema types, `ClaimEntry`, `SessionPayload`
- `app/api/session/[sessionId]/claim/route.ts` — Lua scripts, atomicity patterns
- `app/api/session/[sessionId]/edit/route.ts` — edit route ops, validation patterns
- `lib/billMath.ts` — `computePersonShareFromClaims`, largest-remainder pattern in `computePersonTotals`
- `app/split/[sessionId]/CollaborativeClaimingView.tsx` — phase machine, SWR pattern, localStorage persistence
- `components/split/PersonSlotPicker.tsx` — slot picker to be refactored
- `components/split/ClaimableItemCard.tsx` — chip row already present
- `components/ui/dialog.tsx` — @base-ui/react Dialog primitives
- `components/wizard/ShareLinkButton.tsx` — share link logic to reuse
- `__tests__/billMath.test.ts` — confirmed test accepts 333 (not 334) for 3-way split
- `__tests__/CollaborativeClaimingView.test.tsx` — 18 existing tests, baseline confirmed
- `__tests__/PersonSlotPicker.test.tsx` — opacity-50 vs opacity-40 mismatch confirmed
- `.planning/phases/09-bill-view-redesign-identity-modal/09-design-bill-view-header.png` — header design confirmed: merchant name shown; no merchantName in session schema → fallback required
- `.planning/phases/09-bill-view-redesign-identity-modal/09-CONTEXT.md` — D-01 through D-15 locked decisions
- `app/api/ocr/route.ts` — confirmed: no merchantName in JSON schema or RECEIPT_PROMPT
- `package.json` — confirmed: no new dependencies needed; swr@2.4.1, @base-ui/react@1.4.1

### Secondary (MEDIUM confidence)
- STATE.md "Lua script strings audited separately from TypeScript" — key decision from Phase 8
- STATE.md "v2.0: No new npm dependencies required" — architecture commitment

### Tertiary (LOW confidence)
- None in this research

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and source
- Architecture: HIGH — full codebase read; all critical paths traced
- Pitfalls: HIGH — all sourced from direct code inspection
- Math recommendations: HIGH (for largest-remainder algorithm) / ASSUMED (for determinism rule detail)
- Slot-release recommendation: ASSUMED (reasoned from design principles; no prior decision)

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable stack; no fast-moving dependencies)
