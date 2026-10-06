# Phase 10: Results Screen + Tip Modal + Currency Display - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

The final screen of the flow. Delivers:
- A **locked Results screen** showing every participant's breakdown — current user expanded by default, others tap-to-expand — plus a grand total (RESULTS-03)
- **Copy / Edit / New Split** actions from Results (RESULTS-04)
- A **tip added via a modal** launched from Results; totals update to include it (TIP-02)
- **Currency display** — every monetary amount rendered in the receipt's detected currency with correct symbol and decimals incl. zero-decimal currencies (CURR-02), with a graceful fallback + user override when detection fails (CURR-03)

This phase is **display + tip-entry only**. The `currencyCode` already rides in the SessionPayload (added Phase 8); the per-person tip data model (`tips: Record<PersonId, number>`) already exists. No schema surgery, no new claiming logic.

**Out of scope:** payment rails, saved history, tax input, proportional tax/tip split, anything touching the claiming/identity logic (Phases 8–9).

</domain>

<decisions>
## Implementation Decisions

### Tip flow & entry point
- **D-01:** After claiming, "Done" goes **straight to the Results screen** — no mandatory tip step. The tip is an **optional "Add a tip" button** on Results that opens the tip modal. Remove the linear `tip` phase from the flow machine (claiming → results, with tip as a Dialog overlay). This matches the UI-SPEC's tip-as-modal conversion and TIP-02 ("launched from the Results screen").
- **D-02:** Tip is **optional** — Confirm is always enabled, even at $0.00; tapping Confirm at 0% simply records no tip. (Preset/custom mechanics, 100% cap = existing TipScreen logic, reused verbatim.)

### What the grand "Total" means
- **D-03:** The grand **"Total"** row = **the bill, items only** (sum of all item prices). It anchors to the printed receipt and does **not** fluctuate as people add tips on their own phones.
- **D-04:** Reconciliation rule (important — avoid a "parts don't add up" screen): each person's **item share** sums to the grand Total. **Tips are a private per-person add-on layered on top**, shown only on the **current user's own card** as "Your tip" / "Your total" (items + their tip). Other people's cards show their **item share only** (not their tip), so the per-person item shares always reconcile to the grand bill Total. The current user's "Your total" is the one number that includes a tip.

### Tip visibility
- **D-05:** Tips are **personal & quiet**. A person's tip affects only their own "Your total" and is **not** surfaced as a separate "{Name} tipped $X" line to other participants. Combined with D-04 this keeps the shared view consistent (everyone sees the same item-share breakdown; each person sees their own tip privately on their device).

### Currency override (CURR-03)
- **D-06:** When currency is detected wrong or absent, show the detected code (or **USD fallback**) with a small inline **"change"** affordance near the total that opens a **picker of common currencies** (e.g. USD, EUR, GBP, JPY, AUD, CAD, CHF, CNY, INR). Include the detected code in the list even if it's not a "common" one. No blocking UI — the session proceeds on the fallback until the user changes it.
- **D-07:** Currency is a **session-level** property (it's `currencyCode` on the shared SessionPayload), so a change should apply to the **whole bill / all devices**, not just locally. *(How to persist the change — extend the existing `/edit` route vs. a small dedicated update — is an implementation question for research/planning; the requirement is that the override is shared, not per-device.)*

### Claude's Discretion
- Exact currency list contents/order, and whether the picker is a shadcn `select` vs. a small dialog list.
- Visual treatment of the current user's "Your total (incl. tip)" vs. the grand bill Total so the distinction reads clearly (labels, sublines).
- Whether the "Edit" path reuses the existing `done:false` → back-to-claiming pattern exactly (expected: yes).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (locked — MUST follow)
- `.planning/phases/10-results-screen-tip-modal-currency-display/10-UI-SPEC.md` — full visual + interaction contract: spacing/type/color, Results accordion behavior, Tip-modal conversion, copywriting table, currency-fallback display, accessibility contracts. Verified 6/6 by gsd-ui-checker. Note one non-blocking recommendation: add `aria-label="Back to tip"` (now back-to-results) to the header back chevron.

### Requirements
- `.planning/REQUIREMENTS.md` §Results & Tip / §Currency — RESULTS-03, RESULTS-04, TIP-02, CURR-02, CURR-03 (the five requirements this phase closes)
- `.planning/ROADMAP.md` → Phase 10 entry — goal + success criteria + the 2026-06-05 reassess note (currencyCode payload landed in Phase 8; Phase 10 is display-only)

### Code the phase modifies (paths the planner will touch)
- `components/split/PersonResultsScreen.tsx` — extend single-person view → all-people accordion + CTA bar
- `components/split/TipScreen.tsx` — convert full-page screen → Dialog content; keep tip logic
- `app/split/[sessionId]/CollaborativeClaimingView.tsx` — mount tip as Dialog, drop the linear tip phase, thread `currencyCode`
- `lib/billMath.ts` — `formatCents(cents, currencyCode?)` (backward-compatible)
- `lib/sessionSchema.ts` — `tips: Record<PersonId, number>` and `currencyCode` (both already present)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`formatCents` (`lib/billMath.ts`)** — gains an optional `currencyCode` param using `Intl.NumberFormat`; omitting it preserves today's "$" behavior so all wizard call sites keep working (CURR-02).
- **TipScreen tip logic** — presets (10/15/20%), `MAX_TIP_PERCENT = 100` clamp, `POST /api/session/[sessionId]/tip` with `{ personId, tipCents }`. Reuse wholesale; just re-host inside a `<Dialog>`.
- **`PersonResultsScreen`** — current single-person breakdown is the seed for the per-person card; extend to render every participant as an accordion.
- **`tips: Record<PersonId, number>`** — per-person tip model already exists; D-04/D-05 ride on it directly (no schema change).
- **`currencyCode` on SessionPayload** — already added in Phase 8; thread it from `session` into both screens.
- **`BillViewHeader.handleShare`** — clipboard + `execCommand` fallback pattern to reuse for "Copy summary".
- **`AppHeader`** — now mounted on all `/split` screens (quick task 260608-qzy); Results/Tip already inherit it.
- **`/api/session/[sessionId]/done` (`done: boolean`)** — the `done:false` round-trip behind the "Edit bill" action (existing `handleBackToClaiming`).

### Established Patterns
- Integer-cents arithmetic everywhere; derived totals computed on demand, never stored.
- `/split/` view is Redis-backed via SWR; tip confirm + currency change should `mutate()` so totals refresh.
- Inline errors use `role="alert"`; amber-600 reserved for monetary totals + primary CTAs (UI-SPEC color contract).

### Integration Points
- Currency override (D-07) needs a **shared** write path for `session.currencyCode` — extend `/api/session/[sessionId]/edit` or add a minimal update route (research decision).
- Removing the linear `tip` phase changes `CollaborativeClaimingView`'s phase machine — Results becomes the terminal screen with the tip Dialog mounted on it.

</code_context>

<specifics>
## Specific Ideas

- Tip modal copy and Results copy are fixed by the UI-SPEC Copywriting Contract ("You're all set!", "Add a tip?", "Your share", "Total", "Copy summary", "Edit bill", "New Split", etc.).
- Copy-summary clipboard format (plain text, "{Name} owes {amount}" lines + "Total: {amount}") is specified in the UI-SPEC Interaction Contracts.

</specifics>

<deferred>
## Deferred Ideas

- **Tip nudge / reminder** if someone reaches Results without tipping — not requested; tip stays purely optional (D-02). Revisit only if UAT shows people miss it.

### Reviewed Todos (not folded)
- **"Add user-facing privacy disclosure"** (`.planning/todos/2026-06-02-add-user-facing-privacy-disclosure.md`) — weakly matched on OCR/photo keywords. It concerns scan/photo data handling, not results/tip/currency. **Out of Phase 10 scope** — left for a dedicated privacy/polish pass.

</deferred>

---

*Phase: 10-results-screen-tip-modal-currency-display*
*Context gathered: 2026-06-08*
