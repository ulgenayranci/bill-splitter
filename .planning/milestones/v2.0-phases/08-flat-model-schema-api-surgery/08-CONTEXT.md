# Phase 8: Flat Model — Schema + API Surgery - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove every host/organizer concept from the session data model and API so all
participants are equal: anyone can claim, add, edit, or remove items instantly
with no approval step. Delete the five host-flow routes, add a direct `/edit`
route, thread the detected `currencyCode` into the shared-bill payload (pulled
forward from Phase 10 per the 2026-06-05 reassessment), and migrate the test
suite to the flat model.

**In scope:** schema flattening (`lib/sessionSchema.ts`), deleting host routes,
the direct-edit route, currencyCode in `SessionPayload`, test migration.
**Out of scope:** the Bill View UI rebuild + identity modal (Phase 9), the
Results screen + currency *display* (Phase 10), any new capability.
</domain>

<decisions>
## Implementation Decisions

### Editing items that are already claimed
- **D-01:** When an item's price or quantity is edited and it already has
  claims, **the claims are kept and shares auto-recalculate** to the new
  price/quantity. A claim is about WHO had the item, not the exact dollar
  amount, so editing must not drop existing claimants. (Confirmed by user.)

### Delete guard rail
- **D-02:** **Every delete shows a confirmation prompt** — claimed or not.
  Generic confirm for unclaimed items; when the item has claims, the prompt
  surfaces that ("N people claimed this — delete anyway?"). NOTE: this confirm
  applies to **deletes only** — price/name/quantity **edits apply immediately**
  (live, no confirm), per CLAIM-03. (User chose "Always confirm" for deletes.)

### Old / v1 sessions (migration)
- **D-03:** **NULL EVENT — there are no existing users.** Do NOT build a
  `migrateSession` normalizer or any v1-compatibility/old-format handling.
  Drop ROADMAP Success Criterion #4 ("v1 sessions normalised on read"). Any
  stray test sessions in Redis expire within the 24h TTL and are disposable.
  **This supersedes** the earlier STATE decision "migrateSession normalizer must
  be first commit in Phase 8" — that concern no longer exists.

### currencyCode in the shared-bill payload (from 2026-06-05 reassessment)
- **D-04:** Add `currencyCode` to `SessionPayload` in **this phase** (the schema
  is already open). Because there are no old sessions (D-03), no migration
  default is needed — new sessions always carry it; default to `'USD'` at
  creation if the store didn't supply one. Phase 10 owns *display* only
  (formatCents threading), not the field.

### Claude's Discretion
- **Edit attribution** ("edited by Bob") is NOT required this phase — keep it
  minimal. CLAIM-04 (Phase 9) covers *claim* attribution; edit attribution is a
  possible later polish, not in scope here.
- **Concurrent-edit conflict resolution** — default to last-write-wins;
  researcher/planner confirm the existing Lua atomicity in the claim path still
  holds for the new edit path. (Implementation detail, not a user decision.)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & decisions
- `.planning/ROADMAP.md` — Phase 8 details + the **Reassess gate (2026-06-05)** block (keep ≥2 gate, currencyCode→Phase 8, doc drift fixes).
- `.planning/REQUIREMENTS.md` — CLAIM-01 (claim without host) and CLAIM-03 (anyone add/edit/remove directly) are this phase's requirements.
- `.planning/STATE.md` — Key Decisions table: "Lua script strings audited separately from TypeScript"; "currencyCode SessionPayload field moves to Phase 8". (NOTE: the "migrateSession first commit" row is superseded by D-03.)

### Code being operated on
- `lib/sessionSchema.ts` — the central schema to flatten (see Existing Code Insights).

</canonical_refs>

<code_context>
## Existing Code Insights

### The schema to flatten — `lib/sessionSchema.ts`
Host-role surface to REMOVE:
- `SessionPayload.hostToken`, `hostPersonId`, `editRequests`, `disputes`
- `ClaimEntry.assignedBy: 'self' | 'host'` and `ClaimEntry.accepted?` (host-assignment) → collapse to self-claim only
- `EditRequest`, `EditPayload`, `Dispute` interfaces (whole approval/dispute model)
- `PublicSessionPayload = Omit<SessionPayload,'hostToken'>` becomes moot once hostToken is gone
ADD: `currencyCode: string` to `SessionPayload` (D-04).

### Routes — `app/api/session/[sessionId]/`
- **DELETE (the 5 host routes):** `accept/`, `dispute/`, `edit-request/`, `resolve-dispute/`, `resolve-edit/` — must 404 after removal.
- **ADD:** a direct `edit/` route (add / edit price-name-quantity / remove), changes apply immediately, no queue.
- **KEEP:** `claim/`, `done/`, `tip/`, `route.ts` (GET/PUT session), and `app/api/session/route.ts` (POST create — also where `currencyCode` lands in the payload).

### Lua / atomicity
- `app/api/session/[sessionId]/claim/route.ts` uses `redis.eval` Lua for atomic claim writes (Phase 6 decision). Audit Lua strings SEPARATELY from TypeScript — type errors won't surface inside opaque Lua strings.

### Consumers that will need updating
- `stores/useBillStore.ts`, `app/split/[sessionId]/page.tsx`, `app/split/[sessionId]/CollaborativeClaimingView.tsx` — all reference `SessionPayload`/session types; removing host fields will ripple here (TypeScript will flag).

### Test migration
- Tests referencing deleted routes/host concepts must be replaced with flat-model equivalents (Success Criterion #6). Separately, 5 pre-existing v1 wizard test failures (AddItemsStep, AddPeopleStep, CollaborativeClaimingView, PersonSlotPicker) are already logged in `07-.../deferred-items.md` — related cleanup but track distinctly.
</code_context>

<specifics>
## Specific Ideas

- The flat model is the whole point of v2 — no host, no approval, no disputes. Lean into deletion; don't preserve host concepts "just in case."
- Delete confirm copy when claimed should name the stakes ("N people claimed this — delete anyway?") so a tap doesn't silently erase someone's claim.
</specifics>

<deferred>
## Deferred Ideas

- **Edit attribution ("edited by X")** — possible future polish; not this phase.

### Reviewed Todos (not folded)
- `2026-06-02-add-user-facing-privacy-disclosure.md` — weak keyword match only ("api/route"); it's a privacy-notice UI concern, its own future item, not part of this schema/API surgery. Left deferred.
</deferred>

---

*Phase: 08-flat-model-schema-api-surgery*
*Context gathered: 2026-06-05*
