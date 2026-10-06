# Phase 11: Bug Fixes & Polish — Bill/Results Screens + Participant Management - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix post-v2 UAT bugs and usability issues on the bill (claiming) and results screens, and add participant management (remove + rename), so the collaborative split flow is clear and correctable end-to-end.

This phase is **polish + small features on existing screens**. It does NOT introduce new server-side storage subsystems (e.g. receipt-image hosting) — that is explicitly deferred.

Five source items (post-v2.0 UAT bug list, reported 2026-06-08):
1. Receipt button non-functional
2. Share/Receipt buttons too small
3. Unclaimed-items section + revised "all set" copy on Results
4. Remove/rename participants
5. Tip prominence + currency control placement

</domain>

<decisions>
## Implementation Decisions

### Receipt button (item 1)
- **D-01:** **Remove the Receipt button entirely** from the bill view header (`components/split/BillViewHeader.tsx:121-127`). It is currently a no-op, AND the scanned receipt image is never persisted to the shared session — it lives only in the scanner's local Zustand/localStorage (`stores/useBillStore.ts` `billImageUrl`), so it cannot be shown to other participants. A proper "view receipt for everyone" feature requires server-side image storage (upload + payload field + blob/Redis) and is **deferred to its own future phase** (see Deferred Ideas).

### Share / Receipt buttons (item 2)
- **D-02:** Since the Receipt button is removed (D-01), this reduces to: **enlarge the Share button** so it is easy to identify and tap on mobile. Current state is a bare 22px icon with no padding (`BillViewHeader.tsx:128-139`, classes `text-zinc-500 hover:text-zinc-700 transition-colors`). Give it a proper tap target (e.g. larger icon + padded hit area, min ~44px touch target) consistent with the app's button styling.

### Unclaimed items + Results message (item 3)
- **D-03:** On the Results screen, when the bill is **not fully claimed**, show an **"Unclaimed items" section at the top** listing the items still needing an owner. Reuse the existing unclaimed detection — `getUnclaimedCounts()` (`app/split/[sessionId]/CollaborativeClaimingView.tsx:56-64`, also in `components/split/UnclaimedBanner.tsx:10-21`); "fully claimed" = no items where `totalClaimed < item.quantity`.
- **D-04:** Replace the unconditional "You're all set!" headline (`components/split/PersonResultsScreen.tsx:134`) with a **playful** message when items remain unclaimed — tone like *"Hold up — {N} item(s) are still up for grabs!"*. Keep "You're all set!" (or equivalent positive copy) for the fully-claimed case. Final wording is Claude's discretion within the playful tone.

### Participant management — remove + rename (item 4)
- **D-05:** Add the ability to **remove** a participant and **rename** a participant. No such operations exist today — the `/edit` route (`app/api/session/[sessionId]/edit/route.ts`) has `add_person` but no `remove_person` / `rename_person`. New atomic Lua-script ops + UI affordances are required.
- **D-06:** **Removing a person frees their claimed items back to unclaimed.** Claims are keyed by personId (`lib/sessionSchema.ts:10` — `items: Record<ItemId, Record<PersonId, ClaimEntry>>`), so removal deletes that person's claim entries, returning affected items to the unclaimed pool (which then surfaces via D-03). Do NOT block removal when a person has claims.
- **D-07:** **Anyone can remove or rename anyone** (not just themselves) — consistent with the project's flat, no-name-locking model ([[project_no_name_locking]]). Removal/rename is a **shared write** to the Redis session, so it updates the bill for **all participants** live (same shared-session semantics as `add_person`). Renaming is a simple inline name edit.

### Tip + currency placement (item 5)
- **D-08:** Make **"Add a tip"** a **prominent button** on the Results screen. It is currently a faint underlined text link (`components/split/PersonResultsScreen.tsx:276-283`, classes `text-[14px] text-amber-600 underline self-start`). Promote it to a clear, tappable button.
- **D-09:** **Remove the currency-change control** from the Results screen (`PersonResultsScreen.tsx:259-274`, the `Currency: [select]` dropdown) for now. Rationale (user): a currency dropdown reads like a money *converter*, not "correct the scanned currency" — it confuses intent. The OCR-**detected** currency symbol is still **displayed** everywhere (unchanged from Phase 10); only the manual override UI is removed. Revisit if users request it. Tradeoff accepted: no in-app fix if OCR detects the wrong currency until a control is re-added.
  - Note: the `update_currency` op on the `/edit` route (Phase 10, plan 10-02) becomes unused by the UI but can remain in place for a future re-introduction — do not necessarily delete the server op; just remove the client control.

### Claude's Discretion
- Exact playful copy for the unclaimed-state message (within tone from D-04).
- Visual styling/exact placement of the enlarged Share button, the tip button, and the remove/rename affordances — follow existing app patterns and the brand UI reference.
- Where the remove/rename controls live in the UI (e.g. on the people list / identity area) — implementation detail for UI design + planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-local
- `.planning/phases/11-bug-fixes-polish-bill-results-screens-participant-management/11-CONTEXT.md` — this file (decisions)
- `.planning/phases/10-results-screen-tip-modal-currency-display/10-UAT.md` — re-verification that closed the earlier 3 gaps (this phase's items are NEW issues beyond it)

### Prior-phase decisions that constrain this phase
- `.planning/phases/09-bill-view-redesign-identity-modal/` — flat collaborative model, identity modal, unassigned-items warning (the unclaimed infrastructure reused in D-03)
- `.planning/phases/10-results-screen-tip-modal-currency-display/10-03-SUMMARY.md` — Results screen structure (accordion, totals, currency override being removed in D-09)
- `.planning/PROJECT.md` — core value + evolution rules

No external ADRs/specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getUnclaimedCounts()` (`CollaborativeClaimingView.tsx:56-64`, `UnclaimedBanner.tsx:10-21`) — unclaimed detection logic to reuse on Results (D-03).
- `UnclaimedBanner` component (`components/split/UnclaimedBanner.tsx`) — existing unclaimed UI pattern; the unclaimed warning dialog at `CollaborativeClaimingView.tsx:787-825` is the Phase 9 precedent for copy/CTA.
- `add_person` op + `ADD_PERSON_SCRIPT` Lua (`app/api/session/[sessionId]/edit/route.ts:47-68, 208-236`) — the atomic-write pattern to mirror for new `remove_person` / `rename_person` ops (D-05).
- `formatCents(cents, currencyCode)` (`lib/billMath.ts`) — currency still displayed (D-09); unchanged.

### Established Patterns
- Claims keyed by personId in `SessionClaims` (`lib/sessionSchema.ts:8-15`) — removal must clean up `items[*][personId]`, `personSlots[personId]`, `donePeople[personId]` (D-06).
- Shared-session writes go through the `/edit` route → Redis → SWR poll picks up for all devices (D-07).
- Person model: `{ id, name, colorIndex }` (`stores/useBillStore.ts:23-27`, `lib/sessionSchema.ts:18`); max 20 people enforced in Lua.

### Integration Points
- `components/split/BillViewHeader.tsx` — remove Receipt button (D-01), enlarge Share button (D-02), people strip is where remove/rename affordances may live.
- `components/split/PersonResultsScreen.tsx` — unclaimed section + message (D-03/D-04), tip button promote (D-08), currency control removal (D-09).
- `components/split/PersonSlotPicker.tsx` — people list (candidate location for remove/rename UI).
- `app/api/session/[sessionId]/edit/route.ts` — new `remove_person` / `rename_person` ops.

</code_context>

<specifics>
## Specific Ideas

- Unclaimed message tone: playful, e.g. *"Hold up — N items are still up for grabs!"*
- Currency control concern (user's words): wherever placed, a currency selector "makes me feel like it will exchange the currency, not correct the scan" — hence removal (D-09).
- Share button: should not feel like a tiny afterthought icon — give it real presence.

</specifics>

<deferred>
## Deferred Ideas

- **Receipt viewing for all participants** — requires persisting the scanned receipt image server-side (upload + storage + `SessionPayload` field). This is the biggest single piece of work touched here and is its own phase. Removed the dead button now (D-01); build the real feature later if validated by user feedback.
- **Currency correction control** — re-introduce a way to fix a mis-detected scan currency IF users ask for it. Removed for now (D-09). When revisited, frame it explicitly as "fix the scanned currency," not a converter, to avoid the confusion the user flagged.

</deferred>

---

*Phase: 11-bug-fixes-polish-bill-results-screens-participant-management*
*Context gathered: 2026-06-09*
