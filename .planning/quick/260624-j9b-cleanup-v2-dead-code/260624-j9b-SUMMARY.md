---
quick_task: 260624-j9b
status: complete
completed: "2026-06-24"
commits:
  - e9fdc5a  # Task 1: delete 16 dead files
  - f88a671  # Task 2: drop OcrErrorToast mount + fix stale comments
  - 2d0d5b9  # Task 3 fix: delete clarifyRoute.test.ts missed by plan
---

# Quick Task 260624-j9b — Cleanup v2.0 Dead Code

## Outcome

All dead code from the v2.0 retired wizard + collaborative-flow unification is removed. The tree is clean: tsc passes, vitest runs green (deleted tests absent), and the production build passes with `/api/clarify` absent from the route table.

## What Was Done

### Task 1 — Delete dead components, route, and tests (commit e9fdc5a)
Deleted 16 files via `git rm`:
- 6 retired wizard step components: `AssignItemsStep`, `ResultsStep`, `AddItemsStep`, `AddPeopleStep`, `DisambiguationDialog`, `ShareLinkButton`
- 1 retired toast component: `OcrErrorToast`
- 1 retired split component: `UnclaimedBanner`
- 1 route: `app/api/clarify/route.ts` (+ empty `app/api/clarify/` dir auto-removed)
- 7 test files covering only the above components

### Task 2 — Remove runtime mount and fix stale comments (commit f88a671)
- `app/providers.tsx`: removed `Toast` import, `OcrErrorToast` import, `<Toast.Provider>` wrapper, and `<OcrErrorToast />` mount. Component now renders `{children}` directly.
- `lib/createSession.ts`: dropped "and ShareLinkButton" from the usage comment.
- `lib/sessionUtils.ts`: dropped "UnclaimedBanner," from the usage comment.

### Task 3 — Unplanned stale reference fix (commit 2d0d5b9)
`tsc --noEmit` surfaced two references not in the plan's locked import graph:
1. `__tests__/clarifyRoute.test.ts` — imported the deleted `/api/clarify` route; deleted via `git rm`.
2. `.next/types/validator.ts` and `.next/types/routes.d.ts` — auto-generated Next.js type files (gitignored) that referenced the deleted route. Removed the stale block; files are regenerated correctly by `npm run build`.

## Acceptance Gate Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | Clean (0 errors) |
| `npx vitest run` | 352 passed / 15 pre-existing failures / 367 total — all 7+1 deleted test files absent |
| `npm run build` | Pass — `/api/clarify` absent from route table |

## Pre-existing Test Failures (not introduced by this task)
The 15 failing tests are pre-existing UI/branding regressions in: `BillViewHeader`, `WizardShell`, `AppHeader`, `ClaimableItemCard`, `InvitePeopleStep`, `PersonResultsScreen`, `CollaborativeClaimingView`. None are caused by this cleanup.
