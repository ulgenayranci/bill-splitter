---
phase: 05-polish-hardening
fixed_at: 2026-05-14T09:07:00Z
review_path: .planning/phases/05-polish-hardening/05-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-05-14T09:07:00Z
**Source review:** .planning/phases/05-polish-hardening/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, CR-02, CR-03, WR-02, WR-03; WR-01 and WR-04 explicitly excluded per instructions)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: handleItemTap silently treats non-ok /claim response as success

**Files modified:** `app/split/[sessionId]/GuestClaimingView.tsx`
**Commit:** 925b99f
**Applied fix:** Stored the fetch result in `claimRes`, added `if (!claimRes.ok)` guard that reverts the optimistic claim state and sets the item error before returning early. The `mutate` call and error-clear now only execute on a successful response, matching the intended behaviour described in the review.

---

### CR-02: Blob URL created by URL.createObjectURL is never revoked

**Files modified:** `components/wizard/AddItemsStep.tsx`
**Commit:** 1537792
**Applied fix:** Added two revocation sites: (1) at the top of `handleFileChange`, reads the previous `billImageUrl` from the store via `useBillStore.getState()` and calls `URL.revokeObjectURL` if it is a blob URL, before creating and storing the new one; (2) in the cleanup `useEffect`, revokes the current blob URL on component unmount alongside the existing abort controller cleanup.

---

### CR-03: AVATAR_COLORS array index used without bounds-checking

**Files modified:** `app/split/[sessionId]/GuestClaimingView.tsx`, `components/split/ClaimableItemCard.tsx`
**Commits:** 925b99f (GuestClaimingView), cb06591 (ClaimableItemCard)
**Applied fix:** Both AVATAR_COLORS lookup sites now use `AVATAR_COLORS[colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]` — the modulo guards against out-of-range indices from server/Redis payloads, and the nullish coalesce provides a final fallback.

---

### WR-02: Misleading comment in AssignItemsStep.handleContinue

**Files modified:** `components/wizard/AssignItemsStep.tsx`
**Commit:** 98ec97b
**Applied fix:** Replaced the inaccurate "stale closure on the assignments selector" framing with the accurate description: "Read directly from store to guarantee latest state at click time, avoiding any stale render-time snapshot of items/assignments."

---

### WR-03: handleDone catch block silently discards error information

**Files modified:** `app/split/[sessionId]/GuestClaimingView.tsx`
**Commit:** 925b99f
**Applied fix:** Changed `catch {` to `catch (err) {` and added `console.error('Done submission failed:', err)` before the `setDoneError(...)` call, preserving HTTP status information for production debugging.

---

## Skipped Issues

_(None — all in-scope findings were fixed successfully.)_

**Explicitly excluded per instructions (not in scope for this run):**

- **WR-01** — `setStep(5)` in `AssignItemsStep` is intentional per the phase plan; "See results" deliberately navigates to results (step 5).
- **WR-04** — Installing `@testing-library/jest-dom` and updating all test assertions requires a dedicated refactor; out of scope for this patch fix.

---

**Test results after all fixes:** 212 tests passed across 23 test files (vitest --run). No regressions.

---

_Fixed: 2026-05-14T09:07:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
