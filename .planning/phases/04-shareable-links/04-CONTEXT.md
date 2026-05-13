# Phase 4: Shareable Links - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a session-sharing layer so each guest can claim their own items from their own phone. The host serializes the bill to Upstash Redis, generates a `/split/[sessionId]` URL, and shares it at the table. Guests open the link, pick their name from the host's list, and tap to claim items. The host sees a live waiting screen; each guest sees only their own total after marking done.

Requirements: RESULTS-02 (shareable link for per-person item claiming).

</domain>

<decisions>
## Implementation Decisions

### Guest Identity

- **D-01:** Guests identify themselves by picking their name from the host's person list (the names entered in AddPeople step). No free-text entry — the host-created `PersonId`s carry directly from Redis into the claiming session.
- **D-02:** Person slots are first-come-first-served. Once a guest claims a slot ("I'm Sarah"), that slot is locked atomically in Redis — no other phone can claim the same person.
- **D-03:** The host also claims their own items via the shared link — same `/split/[sessionId]` flow as every other guest. The host is not special in the claiming phase.

### Host Wizard Flow

- **D-04:** The wizard step order changes to put SetTip before AssignItems: **AddPeople(1) → AddItems(2) → SetTip(3) → AssignItems/Share(4)**. Tip is set before sharing so it is baked into the Redis session and every guest sees the same tip.
- **D-05:** The AssignItems step (now step 4) gains a prominent **"Share link"** button alongside the existing manual assignment UI. Both paths remain available — the host can still assign manually (→ Results step 5) or share (→ Waiting screen step 5).
- **D-06:** After tapping "Share link," the host lands on a **waiting screen** showing: the shareable URL (copyable), and a live claim-progress list (e.g., Sarah ✓, Mike …, John …). The host stays here until they choose to view results or all guests are done.

### Claiming Sync

- **D-07:** The `/split/[sessionId]` page polls Redis every **3 seconds** and updates item availability. No WebSockets or SSE — polling is sufficient for a restaurant table scenario.
- **D-08:** Items claimed by another person appear **dimmed with a "Taken by [Name]" label** on every other guest's phone. Items are not hidden.
- **D-09:** Guests can **un-claim** an item they already claimed by tapping it again. The item is released back to unclaimed in Redis atomically.

### Final Results Hand-off

- **D-10:** Each guest has an **"I'm done"** button on their claiming page. There is no automatic trigger — each person decides when they have finished claiming.
- **D-11:** After a guest taps "I'm done," they see **only their own total** — their claimed items + proportional tip share. No full-table breakdown is shown to guests.
- **D-12:** The host's waiting screen transitions to a **full breakdown** (all people + totals + unclaimed items) with an "All done" banner once every person slot has marked done.
- **D-13:** **Unclaimed items are flagged** on the host's results screen but do not block anyone from marking done. The host sees which items were never claimed and can handle them manually.

### Claude's Discretion

- Redis key format and TTL (24 hours recommended per CLAUDE.md stack decisions)
- `sessionId` format (short UUID or nanoid)
- Exact polling implementation (SWR, `useEffect` + `setInterval`, or React Query)
- Session payload schema (what subset of Zustand state to serialize)
- `/split/[sessionId]` page layout and component structure
- How to display the "waiting" progress on the host screen (live polling same endpoint)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision; shareable link is part of the "multi-user" path
- `.planning/REQUIREMENTS.md` — RESULTS-02 is the sole requirement for Phase 4

### Prior Phase Decisions (carry forward)
- `.planning/phases/01-manual-bill-splitter/01-CONTEXT.md` — Integer-cents arithmetic, Zustand store shape, wizard step structure
- `.planning/phases/03-ai-expansion-disambiguation/03-CONTEXT.md` — Most recent phase decisions; UX clarity priority, no dead ends rule

### Integration Points (read before planning)
- `stores/useBillStore.ts` — Full Zustand store: `people[]`, `items[]`, `assignments{}`, `tipPercent`. Session serialization targets these fields.
- `components/wizard/WizardShell.tsx` — Wizard step routing; step order changes in this phase (SetTip moves to step 3, AssignItems to step 4).
- `components/wizard/AssignItemsStep.tsx` — Gains "Share link" button; existing manual assignment path must remain intact.
- `components/wizard/SetTipStep.tsx` — Moves from step 4 to step 3; no logic change, only position change.
- `components/wizard/ResultsStep.tsx` — Remains as the manual-path terminus (step 5 when host assigns manually).
- `app/api/ocr/route.ts` — Pattern for Next.js Route Handler structure (POST, error handling, json_schema). Follow same pattern for new session API routes.

### Stack Reference
- `CLAUDE.md` — Upstash Redis (via Vercel Marketplace) for session KV storage; 24h TTL; Next.js 15 App Router for `/split/[sessionId]` dynamic route

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `stores/useBillStore.ts` — `people[]`, `items[]`, `assignments{}`, `tipPercent` are the fields to serialize to Redis for the session payload.
- `components/ui/badge.tsx` — Available for "Taken by [Name]" labels on claimed items.
- `components/ui/card.tsx` — Used in AssignItemsStep and ResultsStep; reuse for the claiming UI item rows.
- `components/wizard/OcrLoadingOverlay.tsx` — Portal overlay pattern; useful reference for any full-screen waiting states.
- `AVATAR_COLORS` from `stores/useBillStore.ts` — Color array for person avatars; reuse on the claiming page for visual consistency.

### Established Patterns
- Integer-cents: `priceCents` is always an integer — session serialization and tip calculations must preserve this.
- Route Handler pattern: POST endpoint in `app/api/*/route.ts` with `NextResponse.json()`, input validation, and structured error responses (see `app/api/ocr/route.ts`).
- `AbortController` on fetch calls tied to component lifecycle (used in `AddItemsStep.tsx`).
- `vi.resetModules()` + dummy API key in `beforeEach` for route handler tests.

### Integration Points
- New dynamic route needed: `app/split/[sessionId]/page.tsx` — the guest claiming page.
- New API routes needed:
  - `app/api/session/route.ts` — POST: serialize bill state → Redis, return `{ sessionId }`.
  - `app/api/session/[sessionId]/route.ts` — GET: return full session state (people, items, claims, tipPercent).
  - `app/api/session/[sessionId]/claim/route.ts` — POST: atomic claim/un-claim of an item by a PersonId. Prevents double-claiming.
  - `app/api/session/[sessionId]/done/route.ts` — POST: mark a PersonId as done. Updates session state in Redis.

</code_context>

<specifics>
## Specific Ideas

- UX clarity is the priority (user is a product designer). The claiming page should be scannable at a glance: your name at the top, item list below, "I'm done" CTA prominent at the bottom.
- The "Taken by [Name]" label should use the same avatar color system as the rest of the app for visual consistency — not just a text label.
- The host's waiting screen claim-progress list should feel collaborative, not transactional. Show names with a checkmark or spinner, not a table.
- No dead ends: if the Redis session expires or is not found, the `/split/[sessionId]` page should show a clear "This session has expired" message, not a blank screen.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Shareable-Links*
*Context gathered: 2026-05-13*
