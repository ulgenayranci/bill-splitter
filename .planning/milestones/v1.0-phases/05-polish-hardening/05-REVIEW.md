---
phase: 05-polish-hardening
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - app/layout.tsx
  - components/wizard/AddItemsStep.tsx
  - components/wizard/AssignItemsStep.tsx
  - components/wizard/ResultsStep.tsx
  - components/wizard/ShareLinkButton.tsx
  - app/split/[sessionId]/GuestClaimingView.tsx
  - components/split/ClaimableItemCard.tsx
  - vitest.setup.ts
  - __tests__/AssignItemsStep.test.tsx
  - __tests__/ResultsStep.test.tsx
  - __tests__/ShareLinkButton.test.tsx
  - __tests__/GuestClaimingView.test.tsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This phase delivers UI polish and hardening across the wizard flow and guest claiming experience. The overall structure is sound: abort controllers are used correctly, optimistic updates in `GuestClaimingView` follow a clear pattern, and the test suite covers the most important user paths.

Three critical issues were found. The most serious is a `Rules of Hooks` violation in `AssignItemsStep` — calling `useBillStore.getState()` inside an event handler is not a hook call, but the comment says the opposite; the real problem is that the component calls `useBillStore.getState()` without a hook inside a non-hook context, which is fine for Zustand — **however**, a separate and concrete critical issue exists: `handleItemTap` in `GuestClaimingView` silently ignores a non-ok HTTP response from the `/claim` endpoint, treating it as a success and triggering `mutate`. Two additional critical findings relate to XSS risk from item names rendered directly into dialog `aria-label` and `DialogTitle` without sanitisation, and a race condition in `AddItemsStep` where a stale `blobUrl` created by `URL.createObjectURL` is never revoked, leaking object URLs on every OCR attempt.

---

## Critical Issues

### CR-01: `handleItemTap` silently treats non-ok `/claim` response as success

**File:** `app/split/[sessionId]/GuestClaimingView.tsx:74-84`

**Issue:** `handleItemTap` fires `fetch` to `/api/session/${sessionId}/claim` but never checks `response.ok`. When the server returns 4xx/5xx, the code still calls `mutate(swrKey)` (which re-fetches and overwrites the optimistic state) and clears any existing item error — giving the user the false impression the claim succeeded. The optimistic update stays visible until the next SWR poll resolves to the real server state, which may silently show the wrong owner.

```ts
// current — no ok-check
await fetch(`/api/session/${sessionId}/claim`, { ... })
await mutate(swrKey)
setItemErrors((prev) => { ... delete next[itemId]; return next })
```

**Fix:**
```ts
const claimRes = await fetch(`/api/session/${sessionId}/claim`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ personId: selectedPersonId, itemId, action: 'item' }),
})
if (!claimRes.ok) {
  // Revert optimistic and surface error — same path as the catch block
  setOptimisticClaims((prev) => { const next = { ...prev }; delete next[itemId]; return next })
  setItemErrors((prev) => ({ ...prev, [itemId]: true }))
  return
}
await mutate(swrKey)
setItemErrors((prev) => { if (!prev[itemId]) return prev; const next = { ...prev }; delete next[itemId]; return next })
```

---

### CR-02: Blob URL created by `URL.createObjectURL` is never revoked — object URL leak on every OCR attempt

**File:** `components/wizard/AddItemsStep.tsx:127`

**Issue:** `handleFileChange` calls `URL.createObjectURL(file)` and stores the result in Zustand as `billImageUrl`. This object URL is never passed to `URL.revokeObjectURL`. If the user taps "Scan bill" multiple times (e.g., retrying after an OCR error), a new blob URL is created each time. The previous URL is overwritten in the store but never freed, holding the underlying `File` buffer in memory for the lifetime of the page. On low-memory mobile devices this can cause the browser to discard the tab.

**Fix:** Revoke the previous blob URL before creating the new one, and revoke on component unmount.

```ts
// At the top of handleFileChange, before setBillImage(blobUrl):
const prevUrl = useBillStore.getState().billImageUrl
if (prevUrl?.startsWith('blob:')) URL.revokeObjectURL(prevUrl)

// In the cleanup useEffect (line 64-66), also revoke current:
useEffect(() => {
  return () => {
    abortRef.current?.abort()
    const url = useBillStore.getState().billImageUrl
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }
}, [])
```

---

### CR-03: `AVATAR_COLORS` array index used without bounds-checking — out-of-bounds access crashes render

**File:** `app/split/[sessionId]/GuestClaimingView.tsx:139` and `components/split/ClaimableItemCard.tsx:67`

**Issue:** Both files access `AVATAR_COLORS[me.colorIndex]` and `AVATAR_COLORS[otherPerson.colorIndex]` without guarding against an index that exceeds `AVATAR_COLORS.length - 1` (5). `colorIndex` is assigned in `useBillStore.addPerson` as `nextColorIndex % 6`, which is safe for locally-created people. However, `SessionPayload.people` arrives from the server / Redis, and `Person.colorIndex` is typed as `number` — no runtime validation enforces the 0-5 range. A corrupted or hand-crafted session payload with `colorIndex: 99` would produce `undefined` for the Tailwind class string, causing a React hydration error or missing style. In `GuestClaimingView`, `me` comes directly from `session.people` (server data) on line 131.

**Fix:** Guard the lookup at the point of use, or validate `colorIndex` at the API boundary:

```ts
// Utility guard (add to useBillStore or a shared helper):
export function safeColorClass(colorIndex: number): string {
  return AVATAR_COLORS[colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]
}
```

Apply `safeColorClass(me.colorIndex)` in `GuestClaimingView` (line 139) and `safeColorClass(otherPerson.colorIndex)` in `ClaimableItemCard` (line 67). The same guard should be applied in `AssignItemsStep` (line 99) and `ResultsStep` (line 123) for consistency, though those use locally-created people where the store already enforces `% 6`.

---

## Warnings

### WR-01: `handleContinue` in `AssignItemsStep` skips to step 5 instead of the correct next step number

**File:** `components/wizard/AssignItemsStep.tsx:48`

**Issue:** `handleContinue` calls `setStep(5)` when all items are assigned. But looking at the store type (`step: 1 | 2 | 3 | 4 | 5`) and the wizard flow — step 4 is the tip step, step 5 is results — the "Assign items" step is step 3 (confirmed by `AddItemsStep` calling `setStep(3)` to advance). So pressing "See results" from step 3 (AssignItems) should go to step 4 (Tip), not skip directly to step 5. The `Back` button on the same component also goes to `setStep(3)` (line 132), which would loop back to itself if the user is currently on step 4.

The intent may be to skip the tip step entirely, but this is inconsistent with the `Back` button on `ResultsStep` calling `setStep(4)` (line 91 of ResultsStep) — that Back button would then land back on the tip step, which was bypassed. Verify the intended step ordering and fix one of the two navigation directions.

**Fix:** If the tip step (step 4) should always be shown, change line 48 to `setStep(4)`. If the tip step is intentionally skipped, the `Back` button in `ResultsStep` must also skip over it (change `setStep(4)` to `setStep(3)` there).

---

### WR-02: Misleading comment in `AssignItemsStep.handleContinue` — "stale closure" framing is incorrect

**File:** `components/wizard/AssignItemsStep.tsx:39`

**Issue:** The comment says "Read fresh state to avoid stale closure on the assignments selector." But `handleContinue` is not a `useCallback`, and the function body does not close over `assignments` from the selector — it reads `items` and `assignments` from the selector at lines 22-23 inside the component body, which are captured at render time. The correct pattern for avoiding staleness is either to read from `useBillStore.getState()` (as done here) or to use `useCallback` with proper deps. Using `getState()` works, but the comment mislabels the problem. More importantly: `items` (line 41) also comes from `storeItems` obtained via `getState()`, which is correct — but the component-level `items` selector (line 21) is redundant for this function. The mixed sourcing (component selector for render, `getState()` for the click handler) is confusing but not technically wrong for Zustand.

**Fix:** Update the comment to accurately describe the pattern:

```ts
// Read directly from store to guarantee latest state at click time,
// avoiding any stale render-time snapshot of items/assignments.
const { items: storeItems, assignments: storeAssignments } = useBillStore.getState()
```

---

### WR-03: `handleDone` in `GuestClaimingView` catches all errors silently and loses the HTTP status information

**File:** `app/split/[sessionId]/GuestClaimingView.tsx:98-111`

**Issue:** `handleDone` throws `new Error(...)` on non-ok status (line 107) to enter the catch block, but the catch block (`catch { setDoneError(...) }`) discards the error entirely — including the status code that was embedded in the error message. This makes debugging in production impossible. More importantly, the catch clause uses `catch {}` with no binding, so no information from the error is available even for logging.

**Fix:**
```ts
} catch (err) {
  console.error('Done submission failed:', err)
  setDoneError("Couldn't submit — tap to retry")
}
```

---

### WR-04: `vitest.setup.ts` contains a TODO that leaves the test suite without `@testing-library/jest-dom` matchers — tests use `.toBeDefined()` instead of `.toBeInTheDocument()`

**File:** `vitest.setup.ts:13-15`

**Issue:** The TODO comment notes that `@testing-library/jest-dom` is not installed. As a result, every test in the suite uses `expect(element).toBeDefined()` rather than `expect(element).toBeInTheDocument()`. The `toBeDefined()` assertion passes even if the element is present in the DOM but detached (e.g., inside a hidden portal), making the tests less reliable. For example, in `ResultsStep.test.tsx` tests 1 and 2, the assertions `expect(screen.getByText('Alice')).toBeDefined()` would pass even if the element were detached.

**Fix:** Install the dependency and activate it:
```bash
npm install --save-dev @testing-library/jest-dom
```
Then in `vitest.setup.ts`:
```ts
import '@testing-library/jest-dom'
```
Then update assertions across all test files to use `.toBeInTheDocument()`.

---

## Info

### IN-01: `ResultsStep.handleCopy` re-computes totals from `getState()` redundantly

**File:** `components/wizard/ResultsStep.tsx:63-77`

**Issue:** `handleCopy` calls `useBillStore.getState()` and re-runs `computePersonTotals`, `computeSubtotalCents`, and `computeTipCents` — computations already performed at the top of the render function (lines 54-57). For the copy case this is harmless since the user can only click "Copy" when the component is mounted and the state has not changed, but it creates unnecessary duplication and the two computation sites could diverge if one is updated without the other.

**Fix:** Capture the store snapshot once at the top of `handleCopy` or lift the totals computation to a useMemo, then reference it inside the handler.

---

### IN-02: `layout.tsx` missing `maximumScale` in viewport export — iOS Safari auto-zooms on input focus

**File:** `app/layout.tsx:14-18`

**Issue:** The viewport export sets `width` and `initialScale` but omits `maximumScale`. On iOS Safari, input fields with font-size below 16px trigger automatic zoom-in on focus. Since many inputs in `AddItemsStep` and the edit rows use `text-base` (16px), this may be acceptable — but if any input ever drops below 16px, users will experience disruptive zoom. Adding `maximumScale: 1` prevents this, at the cost of disabling user-initiated pinch-zoom (a known accessibility trade-off that should be a conscious decision).

**Fix (only if pinch-zoom suppression is acceptable per product decision):**
```ts
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}
```

---

### IN-03: `GuestClaimingView` test's `selectAlice` helper calls `vi.unstubAllGlobals()` mid-test, potentially resetting stubs needed by subsequent assertions

**File:** `__tests__/GuestClaimingView.test.tsx:57`

**Issue:** `selectAlice()` stubs `fetch` to mock the slot-claim call, then calls `vi.unstubAllGlobals()` before returning. This means each test that calls `selectAlice()` must immediately re-stub `fetch` for its own assertions. The two tests that use `selectAlice` do re-stub afterward (lines 64, 73), so there is no bug today — but the pattern is fragile. If a future test calls `selectAlice()` and forgets to re-stub, its fetch call will use the real `fetch`, causing a network error in the test environment.

**Fix:** Remove the `vi.unstubAllGlobals()` call from inside `selectAlice()` and rely solely on `afterEach`'s `vi.clearAllMocks()` / `vi.unstubAllGlobals()` for teardown. Alternatively, use `vi.spyOn(global, 'fetch')` which `vi.restoreAllMocks()` can undo without affecting other stubs.

---

_Reviewed: 2026-05-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
