# Phase 9: Bill View Redesign + Identity Modal - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild the shared Bill View as the fully flat claiming screen: a "Who are you?"
**modal** (replacing the full-page `PersonSlotPicker`) with "I'm not listed"
inline add and change-identity-later; **live attribution** (avatar chips showing
who claimed each item); an **unclaimed-items warning** with a share-join-link
CTA; and **single-item sharing** (multiple people split one item) alongside the
existing multi-quantity stepper. Covers IDENT-01–04, CLAIM-02, CLAIM-04–06.

**In scope:** identity modal + persistence UX, Bill View header (title/date,
people strip, receipt + share icons), item-card attribution chips, unclaimed
counter banner + warn-but-allow done flow, tap-to-share equal split.
**Out of scope:** Results screen redesign, tip modal, currency display
threading (all Phase 10); bill history (v2.1+); any new capability.
</domain>

<decisions>
## Implementation Decisions

### Identity modal (IDENT-01–04)
- **D-01:** **Taken names are greyed out** — once a name is claimed on a
  device, no other phone can pick it. Keeps the existing slot-locking
  behavior (`claims.personSlots`); no takeover/override flow this phase.
- **D-02:** **"I'm not listed" adds the person for everyone instantly** — the
  new name joins the shared session immediately and appears on all phones
  within the polling interval; they can claim right away. Matches the flat
  everyone-is-equal model.
- **D-03:** **Change identity = tap anywhere on the people strip** in the Bill
  View header. Tapping the strip reopens the Who-are-you modal. (See
  `09-design-bill-view-header.png` for the strip design.)
- **D-04:** **Claims stay with the old name on identity switch.** If Sarah
  switches to Mike, items claimed as Sarah remain Sarah's; the user
  un-claims/re-claims manually. No automatic claim migration.

### Live attribution (CLAIM-04)
- **D-05:** Each claimed item shows **small colored avatar chips**
  (initial circles) matching the header people strip — no name text on cards.
- **D-06:** **Your own claims get a highlighted card treatment** (amber
  border/tint, echoing the highlighted "you" pill in the design screenshot)
  plus your chip alongside the others.
- **D-07:** Chip overflow: **show up to 3 chips, then "+N"** (same pattern as
  the header strip). Tapping may expand to show everyone.
- **D-08:** Remote updates are **subtle** — chips just appear on the next
  poll refresh. No flashes, pulses, or toasts.

### Unclaimed-items warning (CLAIM-05, CLAIM-06)
- **D-09:** **Warn but allow.** Tapping "I'm done" with unclaimed items shows
  a warning ("N items unclaimed — totals will be off") with a "Continue
  anyway" escape. No hard block.
- **D-10:** On the Bill View itself: a **persistent counter banner near the
  header** ("4 of 12 items still unclaimed"), updating live. Tapping it
  scrolls to the first unclaimed item. Do NOT re-group/pin unclaimed items —
  the list order stays stable while people tap.
- **D-11:** Share-join-link lives in **both** places: a persistent **share
  icon in the Bill View header** (per the design screenshot) AND a "Share the
  link so others can claim" CTA inside the unclaimed warning dialog.
- **D-12:** **"Continue anyway" goes straight to your own results** based on
  claims so far, with a "some items unclaimed" note. The current hard
  waiting-screen gate (`allItemsFullyClaimed` blocking results) is REMOVED —
  nobody is held hostage by the table. (WaitingForClaimsScreen's blocking role
  ends; planner decides whether the component is repurposed or deleted.)

### Sharing & quantity stepper (CLAIM-02)
- **D-13:** **Single items split by tap-to-join:** anyone tapping a claimed
  single item joins its sharers; cost divides **equally** among all sharers
  (2 = 50/50, 3 = thirds). Tap again to leave. No "share this" picker — no
  claiming on others' behalf.
- **D-14:** **Multi-quantity items keep the existing Phase 6 stepper as-is:**
  tap claims 1 unit, +/− adjusts your count, cost = your qty × unit price.
  No per-unit fractional splitting on multi-qty items.
- **D-15:** Shared item cards show the full price plus **"your share: $X.XX"**
  once you've joined. Others' shares are visible in their own results, not on
  the card.

### Claude's Discretion
- **Odd-cent rounding on equal splits** (e.g. $10.00 ÷ 3): user delegated.
  Pick a deterministic rule (e.g. distribute leftover cents to the first N
  sharers) such that the sum of shares ALWAYS equals the item price exactly.
  Integer-cents arithmetic is already the house rule (Phase 1 decision).
- Identity modal visual design (within the existing shadcn/ui `dialog` +
  current app styling — no visual reskin this milestone, per Phase 7).
- Exact banner/warning copy.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 9 goal, requirements, success criteria; the reassess-gate note ("Open for Phase 9 discuss: unclaimed-items UX") is resolved by D-09–D-12.
- `.planning/REQUIREMENTS.md` — IDENT-01–04 (incl. the 2026-06-05 IDENT-02 revision), CLAIM-02, CLAIM-04–06 wording.

### Design intent
- `.planning/phases/09-bill-view-redesign-identity-modal/09-design-bill-view-header.png` — user-provided Bill View header design: bill title + date, people strip (own identity as expanded highlighted pill, others as compact colored avatar circles with +N overflow), receipt icon + share icon on the right. This drives D-03, D-05–D-07, D-11.

### Prior phase decisions that constrain this one
- `.planning/phases/08-flat-model-schema-api-surgery/08-CONTEXT.md` — D-01 (edits keep claims + recalc), D-02 (deletes always confirm, edits instant), flat schema decisions.
- `.planning/phases/07-app-shell-setup-screen/07-CONTEXT.md` — D-11 (≥2 people gate), D-12 (the Assign-flow bridge this phase replaces), "keep current codebase styling".

### Code being operated on
- `lib/sessionSchema.ts` — flat schema: `claims.items` (itemId→personId→{qty}), `personSlots`, `donePeople`, `tips`, `currencyCode`.
- `app/split/[sessionId]/CollaborativeClaimingView.tsx` — the 560-line view being redesigned (SWR 3s polling, phase machine, claim/edit/done handlers).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/split/PersonSlotPicker.tsx` — current full-page "Who are you?" picker with taken-slot greying; becomes the modal's content (needs "I'm not listed" inline add + modal chrome).
- `components/ui/dialog.tsx` — shadcn/ui dialog primitive for the identity modal.
- `components/split/ClaimableItemCard.tsx` — item card with the multi-qty stepper (keep per D-14); gains attribution chips, own-claim highlight, "your share" line, and tap-to-join for single items.
- `stores/useBillStore.ts` — `AVATAR_COLORS` for the chips; person colors must stay consistent between header strip and card chips.
- `components/wizard/ShareLinkButton.tsx` — existing share/session path; reuse for the header share icon + warning CTA.
- `app/api/session/[sessionId]/edit/route.ts` — Phase 8 direct-edit route; "I'm not listed" needs an add-person operation (planner decides: extend `/edit` or a small new route — must be atomic like the claim path).
- Identity persistence already exists: `localStorage` key `split:${sessionId}:personId` with restore-on-load (IDENT-04 is mostly done; verify it survives the modal refactor).

### Established Patterns
- SWR polling at `refreshInterval: 3000` is the live-update mechanism — attribution (CLAIM-04) rides on it; no websockets.
- Integer-cents arithmetic everywhere (`lib/billMath.ts` `computePersonShareFromClaims`); equal-split share math extends this.
- Claim writes go through Redis Lua (`claim/route.ts`) for atomicity — tap-to-join/leave shares must stay atomic; audit Lua strings separately from TypeScript (Phase 8 lesson).
- `window.confirm` used for delete confirms (Phase 8 D-02) — the unclaimed warning should likely be a proper dialog since it carries a share CTA.

### Integration Points
- `CollaborativeClaimingView.tsx` phase machine (`claiming|tip|waiting|results`) — D-12 removes the `waiting` hard gate; `deriveLandingPhase` and the done-flow change.
- Bill View header mounts the people strip + receipt/share icons; the easy-billsy `AppHeader` (Phase 7) stays above it.
- `ClaimEntry` is currently `{qty: number}` (whole units). Equal fractional sharing of a single item needs a representation decision (e.g. claims without qty semantics on qty-1 items = equal split among claimants) — planner/researcher resolve; avoid floats, derive shares from claimant count at compute time.
</code_context>

<specifics>
## Specific Ideas

- The Bill View header should match the provided screenshot: bill title (e.g. restaurant name from the receipt) + date, people strip below, receipt + share icons right-aligned. Own identity = expanded pill with name and highlight; others = compact initial circles; overflow = "+N".
- Warning copy should name the stakes, mirroring Phase 8's delete-confirm style ("3 items unclaimed — totals will be off").
</specifics>

<deferred>
## Deferred Ideas

- **Identity takeover flow** ("that's me on another device") — rejected for now in favor of simple greyed-out taken names; revisit if real tables hit the switched-phone case.
- **Claim-activity animations/toasts** — explicitly chosen against (D-08); revisit only as later polish.
- **Edit attribution ("edited by X")** — carried deferred from Phase 8.

### Reviewed Todos (not folded)
- `2026-06-02-add-user-facing-privacy-disclosure.md` — weak keyword match (0.4); already reviewed and deferred in Phases 7 and 8 as its own future item. Not re-litigated.
</deferred>

---

*Phase: 9-Bill View Redesign + Identity Modal*
*Context gathered: 2026-06-06*
