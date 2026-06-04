# Phase 4: Shareable Links - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 04-shareable-links
**Areas discussed:** Guest identity, Host flow pivot, Claiming sync, Final results hand-off

---

## Guest Identity

| Option | Description | Selected |
|--------|-------------|----------|
| Pick from host's list | Guest sees names the host entered and taps their own | ✓ |
| Type their name fresh | Guest enters any name; app creates new PersonId | |
| Link is per-person | Host generates a separate link per person | |

**User's choice:** Pick from host's list
**Notes:** PersonIds carry straight from Redis. No free-text entry needed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| First to claim wins | Person slot locked atomically in Redis once claimed | ✓ |
| Allow multiple claimers per person | Two phones can both say "I'm Sarah" | |

**User's choice:** First to claim wins

---

| Option | Description | Selected |
|--------|-------------|----------|
| Host claims via the link too | Host opens same /split/[id] page as guests | ✓ |
| Host assigns their items first | Host uses AssignItems wizard step, shares remaining | |

**User's choice:** Host claims via the link too

---

## Host Flow Pivot

| Option | Description | Selected |
|--------|-------------|----------|
| AssignItems gains a 'Share link' button | Manual path kept; Share button added | ✓ |
| New dedicated 'Share' step replaces AssignItems | Step 3 becomes full Share page; manual path removed | |

**User's choice:** AssignItems gains a 'Share link' button

---

| Option | Description | Selected |
|--------|-------------|----------|
| Before sharing (tip first) | Flow: AddPeople → AddItems → SetTip → AssignItems/Share | ✓ |
| After all guests claim | Host shares first, sets tip at the end | |

**User's choice:** Before sharing — wizard step order changes: SetTip moves to step 3, AssignItems/Share to step 4.
**Notes:** Tip is baked into the Redis session so every guest sees the same tip when claiming.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Waiting screen with link + live claim progress | Host sees URL + Sarah ✓, Mike … | ✓ |
| Host goes straight to claiming page | Host redirected to /split/[id] immediately | |

**User's choice:** Waiting screen with link + live progress list

---

## Claiming Sync

| Option | Description | Selected |
|--------|-------------|----------|
| Polling every 3 seconds | Page polls Redis; 3s lag acceptable at a restaurant table | ✓ |
| Real-time SSE | Server pushes claim events instantly | |
| On page load only | No live refresh | |

**User's choice:** Polling every 3 seconds

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dimmed + "Taken by Mike" label | Item grayed out with claimer's name | ✓ |
| Hidden from the list | Claimed items disappear | |
| Dimmed, no label | Grayed out but no name shown | |

**User's choice:** Dimmed + "Taken by [Name]" label

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, tap again to un-claim | Item released back to unclaimed in Redis | ✓ |
| No — once claimed, it's locked | Immutable after claim | |

**User's choice:** Un-claim allowed (tap again to release)

---

## Final Results Hand-off

| Option | Description | Selected |
|--------|-------------|----------|
| Host presses 'View results' | Host decides when table is done | |
| Auto when all items claimed | Results show automatically on full coverage | |
| Each guest has 'I'm done' button | Each person marks themselves done | ✓ |

**User's choice:** Each guest has their own "I'm done" button

---

| Option | Description | Selected |
|--------|-------------|----------|
| Each guest sees only their own total | Private: "You owe $28.20" | ✓ |
| Everyone sees the full breakdown | /split/[id] transitions to full ResultsStep view | |

**User's choice:** Guests see only their own total (private view)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full breakdown + "All done" banner | Host sees all people, totals, unclaimed items | ✓ |
| Host gets same private view as guests | Host sees only their own total | |

**User's choice:** Host sees full breakdown when all guests done

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show as unclaimed on host's results | Flagged but not blocking | ✓ |
| Block 'I'm done' until all items claimed | Forces coverage; risk of deadlock | |

**User's choice:** Show unclaimed items on host's results screen; no blocking

---

## Claude's Discretion

- Redis key format and TTL
- `sessionId` format (short UUID or nanoid)
- Polling implementation (SWR, `useEffect` + `setInterval`, or React Query)
- Session payload schema (which Zustand fields to serialize)
- `/split/[sessionId]` page layout and component structure
- Host waiting screen polling implementation

## Deferred Ideas

None — discussion stayed within phase scope.
