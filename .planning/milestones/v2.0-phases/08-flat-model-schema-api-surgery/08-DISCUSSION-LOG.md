# Phase 8: Flat Model — Schema + API Surgery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 08-flat-model-schema-api-surgery
**Areas discussed:** Claimed-item edits, Old bills after update (migration), Delete friction

---

## Claimed-item edits (price/quantity change on an already-claimed item)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep & auto-recalculate | Same people stay on the item; shares recompute to the new price/qty | ✓ |
| Clear that item's claims | Editing wipes claims on that item; people re-tap to re-claim | |
| Block editing claimed items | Price/qty locked once an item has any claim | |

**User's choice:** Keep & auto-recalculate (D-01)
**Notes:** A claim is about WHO had the item, not the dollar amount — editing must not drop claimants.

---

## Old bills after update (v1 session migration)

| Option | Description | Selected |
|--------|-------------|----------|
| Just works, no message | App silently reads old-format bills as new flat bills | |
| Small 'previous version' notice | One-time heads-up, then continue | |
| Read-only | Old bills viewable but not editable | |
| (User override) | "We do not have any users yet. Just ignore previous bills. This is a null event." | ✓ |

**User's choice:** Null event — no existing users, so no migration handling needed (D-03)
**Notes:** Supersedes the earlier STATE decision "migrateSession normalizer must be first commit in Phase 8." Dropped ROADMAP Success Criterion #4. Stray test sessions expire within 24h TTL and are disposable. Meaningfully shrinks Phase 8 scope.

---

## Delete friction

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm only if claimed | Unclaimed delete instantly; claimed deletes prompt | |
| Always confirm | Every delete asks "are you sure?" first | ✓ |
| Fully frictionless | No confirms ever | |

**User's choice:** Always confirm (D-02)
**Notes:** Applies to deletes only — price/name/quantity edits still apply immediately (live). When the item is claimed, the confirm should name the stakes ("N people claimed this — delete anyway?").

---

## Claude's Discretion

- Edit attribution ("edited by X") not required this phase — kept minimal (CLAIM-04 covers claim attribution in Phase 9).
- Concurrent-edit conflict resolution defaults to last-write-wins; researcher/planner confirm existing Lua atomicity covers the new edit path.

## Deferred Ideas

- Edit attribution ("edited by Bob") — possible future polish.
- Todo `2026-06-02-add-user-facing-privacy-disclosure.md` — reviewed (weak api/route keyword match), left deferred; it's a privacy-notice UI concern, not this schema/API surgery.
