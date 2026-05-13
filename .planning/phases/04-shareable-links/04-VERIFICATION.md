---
phase: 04-shareable-links
verified: 2026-05-13T21:08:30Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Host creates a bill, taps 'Share link' in Assign/Share step, receives a shareable URL, and can copy it to clipboard"
    expected: "Wizard advances to step 5, HostWaitingScreen renders with a URL in the form /split/{sessionId}, 'Copied!' confirmation appears on tap"
    why_human: "Requires real Upstash credentials and a running Next.js dev server to exercise the full POST /api/session → sessionId → clipboard flow"
  - test: "Guest opens /split/{sessionId} on a phone browser, picks their name, sees the item list, claims items (observing optimistic UI), and taps 'I'm done'"
    expected: "PersonSlotPicker shows people list, taken slots show opacity-50 + '(taken)', item claiming renders 3 states correctly (unclaimed / mine / taken by other), GuestDoneScreen shows only the guest's own total"
    why_human: "Requires real Redis data and a second device/tab; visual rendering of 3-state ClaimableItemCard and polling behavior (3-second refresh interval) cannot be verified programmatically"
  - test: "Host waiting screen updates within 3 seconds when a guest claims an item or taps 'I'm done'"
    expected: "Spinner → checkmark transition on the person's row; 'All done!' banner appears when all donePeople are true; 'View results' hydrates assignments and transitions to ResultsStep"
    why_human: "Real-time SWR polling behavior with live Redis data requires a running server; test mocks freeze SWR state and cannot test timing"
  - test: "Opening a URL with a non-existent or expired sessionId renders SessionExpiredScreen"
    expected: "Link2Off icon, 'This session has expired' heading, 'no longer active' body text — no blank screen, no dead end"
    why_human: "Requires a live server to trigger the SWR error path that activates SessionExpiredScreen"
---

# Phase 4: Shareable Links Verification Report

**Phase Goal:** As a dinner host, I want to share a link so each person claims their own items on their own phone, so that I don't have to tap through everyone else's orders myself.
**Verified:** 2026-05-13T21:08:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Host can generate a shareable URL for the current session | VERIFIED | `ShareLinkButton.tsx` POSTs to `/api/session`, receives `sessionId`, stores it in Zustand, advances wizard to step 5 where `HostWaitingScreen` renders the URL as `${origin}/split/${sessionId}` |
| 2 | Each person can open the link on their own phone and see the full item list | VERIFIED | `app/split/[sessionId]/page.tsx` (Server Component, `await params`) renders `GuestClaimingView` which fetches `GET /api/session/{id}` via SWR and renders `session.items` through `ClaimableItemCard` components |
| 3 | Each person can tap to claim their items; double-claiming is prevented (item claimed by one person shown as taken to others) | VERIFIED | `ClaimableItemCard` has 3 explicit states (unclaimed / mine / taken-by-other with `opacity-50` + "Taken by [Name]"); `POST /api/session/{id}/claim` uses `redis.multi().exec()` atomic transaction and returns `{ ok: false, reason: 'conflict', takenBy }` on double-claim |
| 4 | Final totals update to reflect each person's claimed items once everyone is done | VERIFIED | `HostWaitingScreen` "View results" button iterates `session.claims.items` and calls `setAssignment(itemId, [personId])` to hydrate Zustand before setting `syncStatus='results'`, enabling `ResultsStep` to compute per-person totals from actual claims |
| SC1 | RESULTS-02 requirement: user can share a link so each person claims their own items | VERIFIED | Full end-to-end implementation exists: session creation API, sharing URL generation, guest claiming flow, personal total screen |

**Score:** 13/13 must-haves verified (all plan-level truths + roadmap success criteria)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/redis.ts` | Upstash Redis singleton | VERIFIED | `new Redis({ url, token })` — uses constructor form (compatible with test mocks); no `NEXT_PUBLIC_` |
| `lib/sessionSchema.ts` | `SessionPayload` + `SessionClaims` interfaces | VERIFIED | Both interfaces present; imports `Item`, `ItemId`, `Person`, `PersonId` from `useBillStore` |
| `stores/useBillStore.ts` | `syncStatus` + `sessionId` fields + setters | VERIFIED | Interface, `INITIAL_STATE`, and implementation all present; `reset()` spreads `INITIAL_STATE` |
| `components/wizard/WizardShell.tsx` | New step order D-04 | VERIFIED | `STEP_LABELS = ['Add People', 'Add Items', 'Tip', 'Assign / Share', 'Results']` |
| `app/page.tsx` | step 3 → SetTipStep, step 4 → AssignItemsStep | VERIFIED | Lines 17-18 confirm the inverted routing |
| `app/api/session/route.ts` | POST session create | VERIFIED | `nanoid`, `Number.isInteger`, `ex: 86400`, generic 500 messages |
| `app/api/session/[sessionId]/route.ts` | GET session read | VERIFIED | `await params`, 404 on null, 500 with same body as 404 (no info leak) |
| `app/api/session/[sessionId]/claim/route.ts` | Atomic claim/un-claim | VERIFIED | `redis.multi()`, `delete claims.items` (D-09), `reason: 'conflict'`, `reason: 'slot_taken'` |
| `app/api/session/[sessionId]/done/route.ts` | Mark person done | VERIFIED | `donePeople[personId] = true`, `ex: 86400` TTL refresh |
| `components/wizard/ShareLinkButton.tsx` | Share link trigger | VERIFIED | POSTs `/api/session`, sets `sessionId` + `syncStatus='waiting'` + `setStep(5)`, AbortController cleanup |
| `components/wizard/HostWaitingScreen.tsx` | Polling waiting UI | VERIFIED | `useSWR` with `refreshInterval: 3000, revalidateOnFocus: false`; "Everyone has claimed their items." banner; `setAssignment` hydration in "View results" |
| `components/wizard/AssignItemsStep.tsx` | Contains ShareLinkButton | VERIFIED | `<ShareLinkButton />` rendered in bottom CTA row (line 119) |
| `components/wizard/ResultsStep.tsx` | Early-return to HostWaitingScreen | VERIFIED | `if (syncStatus === 'waiting' && sessionId)` early return; "Unclaimed items" section (D-13) |
| `app/split/[sessionId]/page.tsx` | Server Component shell | VERIFIED | No `'use client'`; `await params`; delegates to `GuestClaimingView` |
| `app/split/[sessionId]/GuestClaimingView.tsx` | Guest orchestration | VERIFIED | SWR polling, `optimisticClaims` with clear-on-update effect, `action: 'slot'` + `action: 'item'`, `handleDone` POSTs `/done` |
| `components/split/PersonSlotPicker.tsx` | Slot selection grid | VERIFIED | `opacity-50 cursor-not-allowed` + `(taken)` label for claimed slots; `onSelect` gated |
| `components/split/ClaimableItemCard.tsx` | 3-state item row | VERIFIED | `opacity-50 pointer-events-none`, `line-through`, "Taken by {name}" badge |
| `components/split/GuestDoneScreen.tsx` | Personal total only (D-11) | VERIFIED | `computePersonTotals` called; renders only `totals[personId]`; item list filtered to `claims.items?.[i.id] === personId` |
| `components/split/SessionExpiredScreen.tsx` | Expired session UI | VERIFIED | `Link2Off` icon, "This session has expired" heading, "no longer active" body |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ShareLinkButton.tsx` | `POST /api/session` | `fetch('/api/session', { method: 'POST', ... })` | WIRED | Confirmed in file |
| `ResultsStep.tsx` | `HostWaitingScreen` | `syncStatus === 'waiting'` early return + import | WIRED | Confirmed lines 16, 41-48 |
| `HostWaitingScreen.tsx` | `GET /api/session/{id}` | `useSWR` with `refreshInterval: 3000` | WIRED | Confirmed in file |
| `GuestClaimingView.tsx` | `GET /api/session/{id}` | `useSWR` with `refreshInterval: 3000` | WIRED | Confirmed at line 28 |
| `ClaimableItemCard.tsx` | `POST /api/session/{id}/claim` | `fetch(..claim..)` in `handleItemTap` (GuestClaimingView) | WIRED | `onTap` callback wired in GuestClaimingView line 76 |
| `GuestDoneScreen.tsx` | `computePersonTotals` | `claimsToAssignments()` + `computePersonTotals(...)` | WIRED | Direct import and call confirmed |
| `HostWaitingScreen.tsx` | `setAssignment` (Zustand hydration) | `for ([itemId, personId]) setAssignment(itemId, [personId])` | WIRED | Confirmed in "View results" onClick |
| `AssignItemsStep.tsx` | `ShareLinkButton` | `import` + `<ShareLinkButton />` in JSX | WIRED | Confirmed lines 9, 119 |
| All session routes | `lib/redis.ts` | `import { redis } from '@/lib/redis'` | WIRED | Confirmed in all 4 route files |
| All session routes | `lib/sessionSchema.ts` | `import type { SessionPayload }` | WIRED | Confirmed in claim, done, and create routes |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `HostWaitingScreen` | `session` (SessionPayload) | `useSWR → GET /api/session/{id} → redis.get(key)` | Yes (Redis query, not static) | FLOWING |
| `GuestClaimingView` | `session` (SessionPayload) | `useSWR → GET /api/session/{id} → redis.get(key)` | Yes (Redis query, not static) | FLOWING |
| `GuestDoneScreen` | `totals[personId]` | `computePersonTotals(session.people, session.items, assignments, session.tipPercent)` | Yes (math over real session data from SWR) | FLOWING |
| `PersonSlotPicker` | `slots` (personSlots) | `session.claims.personSlots` passed from parent | Yes (comes from Redis via SWR in GuestClaimingView) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 199 tests pass | `npx vitest run` | 22 test files, 199 tests passed | PASS |
| TypeScript type-checks cleanly | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Session POST route exists with nanoid | `grep nanoid app/api/session/route.ts` | Found | PASS |
| Atomic claim route uses multi/exec | `grep -c "redis.multi()" claim/route.ts` | Returns 1 | PASS |
| TTL applied on all writes | `grep -rn "ex: 86400" app/api/session/` | 3 matches (create, claim, done) | PASS |
| No NEXT_PUBLIC_ in server files | `grep -rn "NEXT_PUBLIC_" lib/redis.ts app/api/session/` | Returns 0 | PASS |
| No dangerouslySetInnerHTML in split components | `grep -rn dangerouslySetInnerHTML components/split/ app/split/` | Returns 0 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RESULTS-02 | 04-01, 04-02, 04-03 | User can share a link so each person claims their own items on their own phone | SATISFIED | Full stack implementation: Redis session API (4 routes), ShareLinkButton, HostWaitingScreen (SWR polling), GuestClaimingView, PersonSlotPicker, ClaimableItemCard, GuestDoneScreen, SessionExpiredScreen — 199/199 tests GREEN |

No orphaned requirements. The REQUIREMENTS.md traceability table confirms only RESULTS-02 is assigned to Phase 4.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/split/GuestDoneScreen.tsx` | 31 | `return null` | Info | Guard for `person === undefined` (personId not in session.people). Not a stub — real data computation follows. Not user-visible in the happy path. |

No blockers, no warnings. The single `return null` is a defensive guard, not a placeholder.

---

### Human Verification Required

#### 1. End-to-End Host Share Flow

**Test:** Run `npm run dev` with real Upstash credentials in `.env.local`. Add 2 people and 2 items to a bill, set tip, navigate to Assign/Share step (step 4), tap "Share link".
**Expected:** The wizard advances to step 5 showing HostWaitingScreen with a copyable URL (`http://localhost:3000/split/{nanoid}`), two person rows each with a spinner, and a "View results" button at the bottom.
**Why human:** Requires real Upstash `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars, a running Next.js dev server, and a browser to exercise the clipboard API. SWR and fetch mocks in tests cannot exercise the real POST→Redis→sessionId round-trip.

#### 2. Guest Claiming Flow (Two Browsers)

**Test:** Open the shareable URL from test 1 in a second browser tab (or a second device). Pick a name, tap an item to claim it, then tap "I'm done".
**Expected:**
- PersonSlotPicker shows all people; tap a name → transitions to claiming view.
- Claiming view shows unclaimed items (circle outline), items claimed by you (amber check + bg-amber-50), and items claimed by others (opacity-50, line-through, "Taken by [Name]" badge).
- After tapping "I'm done" → GuestDoneScreen shows only your own items + tip share + total. No other person's name or total is visible.
**Why human:** Real polling (3s interval), optimistic UI state transitions, and the visual rendering of the 3-state ClaimableItemCard require live session data and a real browser.

#### 3. Host Polling Update

**Test:** While the guest tab from test 2 has claimed items, return to the host tab (HostWaitingScreen) and wait up to 3 seconds.
**Expected:** After the guest taps "I'm done", the host's person row transitions from LoaderCircle (spinner) to Check (green checkmark) within 3 seconds. When all people are done, the "All done! Everyone has claimed their items." banner appears. Tapping "View results" transitions to ResultsStep showing per-person totals reflecting claims.
**Why human:** Real-time SWR polling behavior and the `donePeople` flag transition cannot be verified without live Redis state changing under the component.

#### 4. Session Expired Screen

**Test:** Navigate to `/split/nonexistent-session-id-abc123` in the browser.
**Expected:** `SessionExpiredScreen` renders with the Link2Off icon, heading "This session has expired", and body "The link you opened is no longer active." — no blank screen, no console errors.
**Why human:** Requires a running server to trigger the SWR error handler that renders `SessionExpiredScreen`. The 404 from `GET /api/session/nonexistent-id-abc123` must be confirmed to flow through to the UI component.

---

### Gaps Summary

No gaps found. All 13 roadmap success criteria and plan must-haves are verified against the codebase.

The 4 items requiring human testing are behavioral/runtime verifications (real-time polling, clipboard API, multi-device flow) that cannot be asserted programmatically. All automated evidence (199/199 tests, TypeScript clean, artifact existence, wiring checks) is fully verified.

---

_Verified: 2026-05-13T21:08:30Z_
_Verifier: Claude (gsd-verifier)_
