---
phase: 11-bug-fixes-polish-bill-results-screens-participant-management
plan: "03"
subsystem: bill-view-header
tags: [ui, accessibility, mobile, share]
dependency_graph:
  requires: []
  provides: [enlarged-share-button, receipt-button-removed]
  affects: [components/split/BillViewHeader.tsx, __tests__/BillViewHeader.test.tsx]
tech_stack:
  added: []
  patterns: [tailwind-44px-touch-target, amber-600-cta-button, lucide-icon-with-label]
key_files:
  created: []
  modified:
    - components/split/BillViewHeader.tsx
    - __tests__/BillViewHeader.test.tsx
decisions:
  - "Receipt button removed entirely — it was a no-op (image never persisted to shared session); removing reduces attack surface and eliminates user confusion"
  - "Copy removed from lucide-react import alongside Receipt — it was unused in the component body"
  - "Share button uses amber-600 CTA styling (bg-amber-600 hover:bg-amber-700) consistent with app primary action style"
metrics:
  duration: "78s (~1m)"
  completed: "2026-06-09"
  tasks: 1
  files: 2
---

# Phase 11 Plan 03: Bill View Header — Remove Receipt Button + Enlarge Share Summary

**One-liner:** Removed no-op Receipt button and restyled Share as an amber CTA with min-h-[44px] touch target, icon size 20, and visible "Share"/"Copied!" text label.

## What Was Built

### D-01: Receipt Button Removed

The `<button aria-label="View receipt">` block (lines 121-127) was deleted from `BillViewHeader.tsx`. The Receipt component was no longer imported. `Copy` was also removed from the import — it had been present since an earlier iteration but was never referenced in the component body.

### D-02: Share Button Enlarged to 44px Touch Target

The bare icon-only Share button was restyled to a proper mobile tap target:

- **Classes applied:** `flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-white hover:bg-amber-700 transition-colors`
- **Icon size:** reduced from 22 to 20 (`Share2`/`Check`)
- **Text label added:** `<span className="text-[14px] font-medium">` showing "Share" (default) or "Copied!" (after share action)
- **Preserved:** `onClick={handleShare}`, `aria-label="Share bill link"`, conditional `Check`/`Share2` rendering

### Tests Updated

- **Test 7 replaced:** Old assertion (`getByLabelText('View receipt')` present) replaced with `queryByLabelText('View receipt')` is null
- **Test 10 added:** Asserts `screen.getByLabelText('Share bill link').className` contains `'min-h-[44px]'`
- All 10 tests pass

## Verification

- `npx vitest run __tests__/BillViewHeader.test.tsx` — 10/10 passed
- `npx tsc --noEmit` — clean (no dangling Receipt import)
- `grep -c "Receipt" components/split/BillViewHeader.tsx` → 0
- `grep -c "View receipt" components/split/BillViewHeader.tsx` → 0
- `grep -c 'min-h-\[44px\]' components/split/BillViewHeader.tsx` → 1

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1: Remove Receipt + enlarge Share | 2a0a62a | components/split/BillViewHeader.tsx, __tests__/BillViewHeader.test.tsx |

## Deviations from Plan

None — plan executed exactly as written. `Copy` removal was explicitly called out in the plan instructions ("verify before removing Copy — if unused, remove it too"), confirmed unused, removed as instructed.

## Threat Flags

None. This plan is a pure JSX/styling change. The removed Receipt button was a no-op; removing it reduces (not increases) attack surface. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- [x] `components/split/BillViewHeader.tsx` — exists and contains `min-h-[44px]`
- [x] `__tests__/BillViewHeader.test.tsx` — exists and contains Test 10 (D-02)
- [x] Commit 2a0a62a exists in git log
- [x] All 10 BillViewHeader tests green
