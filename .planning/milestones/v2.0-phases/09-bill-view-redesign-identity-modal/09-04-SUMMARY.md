---
phase: 09-bill-view-redesign-identity-modal
plan: 04
subsystem: ui
tags: [react, typescript, tailwind, vitest, bill-view, header, banner]

# Dependency graph
requires:
  - phase: 08-03
    provides: host-free ShareLinkButton + flat component surface
provides:
  - "BillViewHeader: title + date, people strip (own pill + compact circles + +N overflow), receipt + share icons"
  - "UnclaimedBanner: live 'N of M still unclaimed' counter, hidden when 0 unclaimed, onTap scroll callback"

affects:
  - "Plan 09-06 (CollaborativeClaimingView orchestrator) mounts both components and provides callbacks"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "People strip is one tappable container firing onStripTap (D-03 change identity)"
    - "Header share icon reuses ShareLinkButton clipboard/navigator.share logic (D-11, CLAIM-06)"
    - "Banner conditional render: getUnclaimedCounts → null when unclaimed === 0"
    - "Unclaimed predicate: totalClaimed < (item.quantity ?? 1), summed from claims.items[id] entries"

key-files:
  created:
    - components/split/BillViewHeader.tsx
    - components/split/UnclaimedBanner.tsx
    - __tests__/BillViewHeader.test.tsx
    - __tests__/UnclaimedBanner.test.tsx
  modified: []
  deleted: []

key-decisions:
  - "No merchantName in schema (Pitfall 7) — title falls back to 'Bill — {Mon DD}' formatted from session.createdAt"
  - "Both components are pure presentational, driven by SWR session data; all interactivity flows through callback props"
  - "Banner styled amber (bg-amber-50/border-amber-200/text-amber-800) per UI-SPEC Unclaimed Banner Visual Contract"

patterns-established:
  - "data-testid='unclaimed-banner' tap target wraps the whole banner row"

requirements-completed: [IDENT-03, CLAIM-05, CLAIM-06]

# Metrics
duration: ~9min
completed: 2026-06-07
---

# Phase 09 Plan 04: Bill View Chrome (Header + Unclaimed Banner) Summary

**BillViewHeader (title/date, tappable people strip, receipt + share icons) and UnclaimedBanner (live unclaimed counter that hides at zero) — the two presentational chrome components the Plan 06 orchestrator mounts.**

## What Was Built

### Task 1 — BillViewHeader (commits 563329d, 19993a2)
- Title block "Bill — {Mon DD}" formatted from `session.createdAt` (no merchantName — Pitfall 7)
- People strip: own-identity pill + compact avatar circles + "+N" overflow, colors via `AVATAR_COLORS[(colorIndex ?? 0) % AVATAR_COLORS.length]`
- Entire strip is one tap target firing `onStripTap` (D-03 / IDENT-03 change identity)
- Receipt icon (`Receipt`) and share icon (`Share2`) with aria-labels "View receipt" / "Share bill link"; share reuses ShareLinkButton logic (D-11 / CLAIM-06)
- 9/9 tests green

### Task 2 — UnclaimedBanner (commits e03b7af RED, 91da71b GREEN)
- `getUnclaimedCounts(session)` iterates `session.items`, sums claimed qty per item from `session.claims?.items?.[item.id]`, counts unclaimed when `totalClaimed < (item.quantity ?? 1)`
- Returns null when `unclaimed === 0`
- Copy: "1 item still unclaimed — tap to find it" (singular) / "{N} of {M} items still unclaimed — tap to find them" (plural)
- Tappable banner (`onClick={onTap}`) for scroll-to-first-unclaimed (D-10 / CLAIM-05), amber styling per UI-SPEC
- 6/6 tests green

## Verification

- `npx vitest run __tests__/BillViewHeader.test.tsx __tests__/UnclaimedBanner.test.tsx` → 2 files, 15/15 tests pass
- `npx tsc --noEmit` → no errors in the two new files
- `grep "still unclaimed" components/split/UnclaimedBanner.tsx` returns both copy variants

## Deviations

- The executor agent's Write tool was denied for new-file creation mid-plan. Task 1 completed normally; Task 2's implementation file (`UnclaimedBanner.tsx`, commit 91da71b) and this SUMMARY were written by the orchestrator following the plan's `<action>` spec exactly. Tests were authored by the executor (commit e03b7af) and pass unmodified.

## Self-Check: PASSED
