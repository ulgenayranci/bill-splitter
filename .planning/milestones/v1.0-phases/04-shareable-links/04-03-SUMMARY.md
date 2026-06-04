---
plan: 04-03
phase: 04-shareable-links
status: complete
subsystem: ui/sharing
tags: [ui, swr, guest-flow, host-flow, optimistic-ui, polling, sharing]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [shareable-link-ui, guest-claiming-flow, host-waiting-screen]
  affects: []
tech_stack:
  added: []
  patterns: [swr-polling, optimistic-ui, lazy-api-init, tdd-red-green, next15-server-component-params]
key_files:
  created:
    - components/wizard/ShareLinkButton.tsx
    - components/wizard/HostWaitingScreen.tsx
    - components/split/PersonSlotPicker.tsx
    - components/split/ClaimableItemCard.tsx
    - components/split/GuestDoneScreen.tsx
    - components/split/SessionExpiredScreen.tsx
    - app/split/[sessionId]/page.tsx
    - app/split/[sessionId]/GuestClaimingView.tsx
    - __tests__/ShareLinkButton.test.tsx
    - __tests__/HostWaitingScreen.test.tsx
    - __tests__/PersonSlotPicker.test.tsx
    - __tests__/ClaimableItemCard.test.tsx
    - __tests__/GuestDoneScreen.test.tsx
  modified:
    - components/wizard/AssignItemsStep.tsx
    - components/wizard/ResultsStep.tsx
    - __tests__/AssignItemsStep.test.tsx
    - app/api/clarify/route.ts
    - app/api/ocr/route.ts
    - app/api/expand/route.ts
decisions:
  - "Used Link2Off icon instead of Unlink — Unlink not exported in installed lucide-react version"
  - "Lazy OpenAI init in api/ocr, api/expand, api/clarify — module-level new OpenAI() throws at build time when OPENAI_API_KEY absent"
  - "AssignItemsStep tests wrapped in Toast.Provider — ShareLinkButton uses useToastManager which requires provider context"
  - "GuestDoneScreen tip calculation uses all items for subtotal (not just claimed ones) per computePersonTotals contract"
metrics:
  duration: "16 min"
  completed: "2026-05-13"
  tasks: 3
  files: 19
requirements_satisfied:
  - RESULTS-02
---

# Phase 4 Plan 3: Client UI — Shareable Link End-to-End Flow

## One-liner

Host-side ShareLinkButton + HostWaitingScreen with SWR polling and guest-side PersonSlotPicker + ClaimableItemCard + GuestDoneScreen delivering the complete shareable-link experience with optimistic UI, taken-slot dimming, and personal-total-only done screen.

## What Was Built

### Task 1: Host Slice

**`components/wizard/ShareLinkButton.tsx`** — "Share link" button in AssignItemsStep CTA row:
- POSTs to `/api/session` with people/items/tipPercent from Zustand store
- On success: stores sessionId, sets syncStatus='waiting', advances to step 5
- On error: toast "Couldn't create sharing link — try again"
- Uses AbortController cleanup on unmount (mirrors AddItemsStep pattern)
- Loading state: spinner (LoaderCircle) + disabled button

**`components/wizard/HostWaitingScreen.tsx`** — Polling waiting screen shown when syncStatus='waiting':
- SWR polling every 3 seconds with revalidateOnFocus: false (D-07)
- Copyable share URL with clipboard API + "Copied!" feedback (2s)
- Person progress list with check/spinner indicators per donePeople state
- "All done!" banner when all people marked done (D-03)
- "View results" CTA: hydrates Zustand assignments from claims.items (D-13) then sets syncStatus='results'

**`components/wizard/AssignItemsStep.tsx`** (modified):
- Added ShareLinkButton import and rendered in two-row mobile layout (Back on top, See results + Share link side-by-side)

**`components/wizard/ResultsStep.tsx`** (modified):
- Early-return to HostWaitingScreen when syncStatus='waiting' && sessionId
- Added "Unclaimed items" informational section (D-13)

### Task 2: Guest Claiming Page

**`app/split/[sessionId]/page.tsx`** — Server Component shell (no 'use client'):
- `await params` for Next.js 15 dynamic route contract
- Passes sessionId to GuestClaimingView

**`app/split/[sessionId]/GuestClaimingView.tsx`** — Client Component:
- SWR polling (3s, revalidateOnFocus: false)
- Local state: selectedPersonId + optimisticClaims (cleared on every session.claims change per T-04-CL-02)
- Routes to PersonSlotPicker → claiming view → GuestDoneScreen based on state
- handleItemTap: optimistic UI, then mutate to reconcile
- handleDone: POST /api/session/{id}/done, awaits SWR refetch

**`components/split/PersonSlotPicker.tsx`** — Identity selection grid:
- 2-column grid of person cards
- Taken slots: opacity-50 cursor-not-allowed with "(taken)" label, not clickable (D-02)
- Available slots: tappable, calls onSelect

**`components/split/ClaimableItemCard.tsx`** — Item row with 3 states:
- Unclaimed: circle icon outline, normal card
- Claimed by me: bg-amber-50, Check icon, semibold name
- Taken by other: opacity-50 pointer-events-none, line-through name, "Taken by [Name]" with avatar dot (D-08)

**`components/split/GuestDoneScreen.tsx`** — Personal total screen (D-11):
- Converts claims.items map to assignments shape for computePersonTotals
- Shows only the current person's items and total (no other people's data)
- Item breakdown + tip share + total

### Task 3: SessionExpiredScreen + Build Fix

**`components/split/SessionExpiredScreen.tsx`** — Friendly expired session screen:
- Link2Off icon (Unlink not available in installed lucide-react)
- "This session has expired" heading
- "no longer active" body copy
- Full-screen centered layout, no CTA

**Build fix (Rule 1 — Bug):** Moved OpenAI client initialization from module level to lazy function in `/api/ocr/route.ts`, `/api/expand/route.ts`, and `/api/clarify/route.ts`. Module-level `new OpenAI()` threw at build time when `OPENAI_API_KEY` is absent during Next.js static page data collection.

## Test Results

| Category | Before (Plan 02) | After (Plan 03) |
|----------|-----------------|-----------------|
| Host tests | 0 | 10 (ShareLinkButton: 5, HostWaitingScreen: 5) |
| Guest component tests | 0 | 9 (PersonSlotPicker: 4, ClaimableItemCard: 3, GuestDoneScreen: 2) |
| AssignItemsStep | 11 (PASS) | 11 (PASS, wrapped in Toast.Provider) |
| ResultsStep | 11 (PASS) | 11 (PASS) |
| **Full suite** | 180 passing | **199 passing** |

19 new tests. 0 regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AssignItemsStep tests broken after ShareLinkButton wiring**
- **Found during:** Task 1 GREEN phase, first test run
- **Issue:** `AssignItemsStep` now renders `ShareLinkButton` which calls `Toast.useToastManager()`. This hook throws "Must be used within Toast.Provider" when component is rendered without the provider. All 11 `AssignItemsStep` tests failed.
- **Fix:** Wrapped all `render(<AssignItemsStep />)` calls in `renderInProvider(<AssignItemsStep />)` using `<Toast.Provider>` wrapper. Also added `vi.stubGlobal('fetch', ...)` in beforeEach to prevent ShareLinkButton's fetch from causing noise in these tests.
- **Files modified:** `__tests__/AssignItemsStep.test.tsx`
- **Commit:** 3f14da8

**2. [Rule 1 - Bug] GuestDoneScreen test expected wrong total amount**
- **Found during:** Task 2 GREEN phase, first test run
- **Issue:** Test expected $10.90 (computed using only claimed items' subtotal), but `computePersonTotals` uses ALL items' priceCents for the tip subtotal — unclaimed items still contribute to the group subtotal for tip calculation. Correct total was $11.13.
- **Fix:** Updated test assertion to `$11.13` and added explanatory comment about tip subtotal behavior.
- **Files modified:** `__tests__/GuestDoneScreen.test.tsx`
- **Commit:** 0ab03d1

**3. [Rule 1 - Bug] npm run build failed — OpenAI module-level instantiation throws at build time**
- **Found during:** Task 3, step 3 (npm run build)
- **Issue:** Three API routes (`/api/ocr`, `/api/expand`, `/api/clarify`) instantiate `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` at module evaluation level. During `npm run build`'s static page data collection, Next.js executes these modules without the OPENAI_API_KEY env var set, causing the OpenAI SDK to throw "Missing credentials." at module load time.
- **Fix:** Converted module-level `const openai = new OpenAI(...)` to a lazy `getOpenAI()` function with a module-level cache variable. First invocation inside the POST handler creates the client; subsequent calls return the cached instance.
- **Files modified:** `app/api/clarify/route.ts`, `app/api/ocr/route.ts`, `app/api/expand/route.ts`
- **Commit:** c0fd55d

**4. [Rule 2 - Icon substitution] Link2Off instead of Unlink for SessionExpiredScreen**
- **Found during:** Task 1 setup (checking lucide-react exports)
- **Issue:** `Unlink` icon specified in the plan is not exported in the installed version of lucide-react. Available link-related icons: `Link`, `Link2`, `Link2Off`.
- **Fix:** Used `Link2Off` which has equivalent visual semantics (broken/severed link).
- **Files modified:** `components/split/SessionExpiredScreen.tsx`

## Known Stubs

None. All components receive live data from SWR/session state. No hardcoded placeholders or TODO markers.

## Threat Surface Scan

The threat model in the plan covers all surfaces introduced. Confirmed mitigations:
- T-04-CL-02: `setOptimisticClaims({})` in `useEffect` on `session?.claims` change — grep confirms 1 match in GuestClaimingView.tsx
- T-04-CL-03: No `dangerouslySetInnerHTML` in any new file — grep returns 0
- T-04-CL-05: GuestDoneScreen shows only the current personId's data — Test 2 asserts no other person's name
- T-04-CL-06: `revalidateOnFocus: false` on all SWR hooks — grep confirms in both HostWaitingScreen and GuestClaimingView
- T-04-CL-08: No `process.env.UPSTASH_*` in client components — grep returns 0

## Pre-launch Checklist

Before publishing to Vercel:
1. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel project environment variables
2. Add `OPENAI_API_KEY` to Vercel project environment variables
3. Verify Upstash Redis database is provisioned and active (free tier: 10k commands/day, 256MB)
4. Test on real iOS Safari + Android Chrome — native camera capture and clipboard API behavior differ
5. Confirm 24h TTL on sessions is acceptable for the use case (can be changed in route handlers)
6. Note: Manual smoke test (step 5 in Task 3 action) requires real env vars — skipped in CI

## Self-Check

**Files created/modified:**
- `components/wizard/ShareLinkButton.tsx` — FOUND
- `components/wizard/HostWaitingScreen.tsx` — FOUND
- `components/split/PersonSlotPicker.tsx` — FOUND
- `components/split/ClaimableItemCard.tsx` — FOUND
- `components/split/GuestDoneScreen.tsx` — FOUND
- `components/split/SessionExpiredScreen.tsx` — FOUND
- `app/split/[sessionId]/page.tsx` — FOUND
- `app/split/[sessionId]/GuestClaimingView.tsx` — FOUND

**Commits verified:**
- 16dfc04 — test(04-03): add failing tests for ShareLinkButton and HostWaitingScreen
- 3f14da8 — feat(04-03): host slice — ShareLinkButton, HostWaitingScreen, wizard wiring
- b136498 — test(04-03): add failing tests for PersonSlotPicker, ClaimableItemCard, GuestDoneScreen
- 0ab03d1 — feat(04-03): guest claiming page — PersonSlotPicker, ClaimableItemCard, GuestDoneScreen, dynamic route
- c0fd55d — feat(04-03): SessionExpiredScreen + build fix — lazy OpenAI init

**Test suite:** 199/199 passing
**TypeScript:** npx tsc --noEmit exits 0
**Build:** npm run build exits 0

## Self-Check: PASSED
