---
phase: 01-manual-bill-splitter
plan: 01
subsystem: ui
tags: [next.js, react, tailwind, shadcn, zustand, vitest, typescript, integer-cents]

# Dependency graph
requires: []
provides:
  - Next.js 16 + Tailwind v4 + shadcn/ui scaffold with all 7 components installed
  - Zustand 5 store with people, items, assignments, tipPercent, step state
  - Integer-cents math library with parseCents, formatCents, computePersonTotals
  - WizardShell with URL hash step sync + 5 wizard step components (Step 1 fully functional)
  - Vitest test suite with 38 passing tests
  - PEOPLE-01 requirement satisfied end-to-end
affects: [01-02, 01-03]

# Tech tracking
tech-stack:
  added:
    - next@16.2.6 (App Router, Turbopack)
    - react@19.2.0 + react-dom@19.2.0
    - tailwindcss@4.2.4 + @tailwindcss/postcss@4.2.4 (CSS-first, no config file)
    - shadcn/ui@4.7.0 with @base-ui/react primitives (button, input, card, dialog, checkbox, separator, badge)
    - zustand@5.0.13 (single store, no Provider)
    - lucide-react@1.14.0 (bundled with shadcn)
    - vitest@4.1.5 + @testing-library/react@16.3.2 + jsdom + vite-tsconfig-paths@6.1.1
  patterns:
    - Integer-cents arithmetic throughout: parseCents() validates + converts, formatCents() for display only
    - Single Zustand store with INITIAL_STATE snapshot for reset()
    - Largest-remainder method for shared item penny distribution
    - URL hash step routing via window.history.pushState + hashchange listener
    - TDD red-green cycle: test commit (failing) → implementation commit (passing)

key-files:
  created:
    - lib/billMath.ts
    - stores/useBillStore.ts
    - components/wizard/WizardShell.tsx
    - components/wizard/AddPeopleStep.tsx
    - components/wizard/AddItemsStep.tsx
    - components/wizard/AssignItemsStep.tsx
    - components/wizard/SetTipStep.tsx
    - components/wizard/ResultsStep.tsx
    - app/page.tsx
    - app/layout.tsx
    - app/globals.css
    - vitest.config.mts
    - __tests__/billMath.test.ts
    - __tests__/useBillStore.test.ts
    - __tests__/AddPeopleStep.test.tsx
    - components/ui/button.tsx
    - components/ui/input.tsx
    - components/ui/card.tsx
    - components/ui/dialog.tsx
    - components/ui/checkbox.tsx
    - components/ui/separator.tsx
    - components/ui/badge.tsx
    - lib/utils.ts
    - package.json
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - components.json
    - .gitignore
  modified: []

key-decisions:
  - "Scaffolded manually (not via create-next-app) because planning directory existed in worktree root"
  - "shadcn 4.7.0 uses @base-ui/react primitives instead of @radix-ui/react-* (new pattern in shadcn 4.x)"
  - "Added afterEach(cleanup) to AddPeopleStep tests due to @base-ui/react Dialog portal rendering in jsdom accumulating DOM across tests"
  - "parseCents regex uses \\d{1,2} (1 or 2 decimal places) per Pitfall 5 in RESEARCH.md — empty string returns null"
  - "Dialog onOpenChange handler adapted for base-ui signature (open: boolean, eventDetails) vs Radix (open: boolean)"

patterns-established:
  - "Pattern 1: All monetary values as integer cents — parseCents() validates input, formatCents() for display only, never floats in calculations"
  - "Pattern 2: Zustand store with INITIAL_STATE const + spread in reset() for clean initial state restoration"
  - "Pattern 3: URL hash routing (#step-N) via window.history.pushState on step change + hashchange listener for back-button"
  - "Pattern 4: TDD red-green cycle per task — test commit first (failing), then implementation commit (passing)"
  - "Pattern 5: afterEach(cleanup) required when using @base-ui/react components in Vitest/jsdom tests"

requirements-completed: [PEOPLE-01]

# Metrics
duration: 12min
completed: 2026-05-08
---

# Phase 01, Plan 01: Walking Skeleton Summary

**Next.js 16 + shadcn/ui scaffold with Zustand integer-cents store, 38-test Vitest suite, and fully functional Add People wizard step satisfying PEOPLE-01**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-08T19:40:22Z
- **Completed:** 2026-05-08T19:52:34Z
- **Tasks:** 3 (Task 1: Scaffold, Task 2: billMath + store TDD, Task 3: UI components TDD)
- **Files modified:** 29

## Accomplishments

- Greenfield Next.js 16 project with Tailwind v4, shadcn/ui, Zustand 5, and Vitest fully wired
- Integer-cents arithmetic library (`lib/billMath.ts`) with 21 unit tests covering edge cases, largest-remainder method, and float-drift prevention
- Zustand store (`stores/useBillStore.ts`) with 11 store mutation tests covering all CRUD actions and orphan cleanup
- AddPeopleStep fully functional: add person by name, colored avatar, trash → Dialog confirm, disabled CTA gating, Continue advances to Step 2
- All 38 tests pass; `npx tsc --noEmit` clean; `npm run build` succeeds; dev server serves correct page

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 16 + Tailwind v4 + shadcn + Zustand + Vitest** - `0f80d9b` (chore)
2. **Task 2 RED: Failing tests for billMath and useBillStore** - `b6b65c9` (test)
3. **Task 2 GREEN: billMath and useBillStore implementation** - `79fc5ab` (feat)
4. **Task 3 RED: Failing AddPeopleStep component test** - `4a6e244` (test)
5. **Task 3 GREEN: WizardShell and AddPeopleStep implementation** - `a4778d4` (feat)

_Note: TDD tasks have separate test → feat commits per TDD red-green protocol_

## Files Created/Modified

- `lib/billMath.ts` — Pure integer-cents arithmetic: parseCents, formatCents, computeSubtotalCents, computeTipCents, computePersonTotals (largest-remainder)
- `stores/useBillStore.ts` — Zustand store with people/items/assignments/tipPercent/step + all CRUD actions, AVATAR_COLORS, crypto.randomUUID() IDs
- `components/wizard/WizardShell.tsx` — Progress strip, URL hash sync via window.history.pushState, hashchange back-button listener
- `components/wizard/AddPeopleStep.tsx` — Step 1: name input, Add Person, avatar list, trash → Dialog confirm, disabled CTA gating, setStep(2)
- `components/wizard/AddItemsStep.tsx` — Placeholder shell (Plan 02)
- `components/wizard/AssignItemsStep.tsx` — Placeholder shell (Plan 02)
- `components/wizard/SetTipStep.tsx` — Placeholder shell (Plan 03)
- `components/wizard/ResultsStep.tsx` — Placeholder shell (Plan 03)
- `app/page.tsx` — Wizard entry point: renders active step from store
- `app/layout.tsx` — Root layout with "Bill Splitter" title, globals.css import
- `app/globals.css` — Tailwind v4 @import + shadcn CSS variables (oklch)
- `vitest.config.mts` — Vitest with jsdom, tsconfigPaths, @vitejs/plugin-react
- `__tests__/billMath.test.ts` — 21 unit tests for arithmetic functions
- `__tests__/useBillStore.test.ts` — 11 store mutation tests
- `__tests__/AddPeopleStep.test.tsx` — 6 component tests proving PEOPLE-01 end-to-end
- `components/ui/*.tsx` — 7 shadcn components (button, input, card, dialog, checkbox, separator, badge)
- `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `components.json`, `.gitignore`

## Decisions Made

- **Manual scaffold instead of create-next-app**: The worktree root had `.planning/` and `CLAUDE.md`, causing create-next-app to reject the directory as non-empty. Scaffolded manually by installing Next.js, TypeScript, Tailwind, and related packages directly via npm, then writing config files by hand.
- **shadcn 4.7.0 uses @base-ui/react**: shadcn 4.x switched from `@radix-ui/react-*` to `@base-ui/react` primitives. The Dialog and Button components use `@base-ui/react/dialog` and `@base-ui/react/button` respectively. API is compatible with the plan's usage (open/onOpenChange).
- **parseCents regex**: Used `\d{1,2}` (1 or 2 decimal places) per RESEARCH.md Pitfall 5. This correctly rejects `""`, `"12.345"`, and `"-5"` while accepting `"12.50"`, `"12.5"`, and `"0"`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added afterEach(cleanup) to AddPeopleStep tests**
- **Found during:** Task 3 (AddPeopleStep component test GREEN phase)
- **Issue:** @base-ui/react Dialog renders into a portal (document.body) and components were not being unmounted between tests. Without cleanup(), each `render()` call accumulated in the DOM, causing `getByRole('button', { name: /continue to items/i })` to find multiple matching elements and throw.
- **Fix:** Added `afterEach(() => { cleanup() })` to the test's `describe` block. This ensures @testing-library/react properly unmounts all rendered trees after each test.
- **Files modified:** `__tests__/AddPeopleStep.test.tsx`
- **Verification:** All 6 AddPeopleStep tests pass after fix
- **Committed in:** `a4778d4` (Task 3 GREEN commit)

**2. [Rule 1 - Bug] Dialog onOpenChange adapter for base-ui signature**
- **Found during:** Task 3 (AddPeopleStep implementation)
- **Issue:** The plan's code used Radix UI's `onOpenChange={(open) => !open && setPendingRemove(null)}` but `@base-ui/react`'s Dialog Root `onOpenChange` signature is `(open: boolean, eventDetails: ChangeEventDetails)`. The inline negation `!open &&` works but needed to be wrapped in a proper function.
- **Fix:** Changed to `onOpenChange={(open) => { if (!open) setPendingRemove(null) }}` which works with both single and dual-parameter signatures.
- **Files modified:** `components/wizard/AddPeopleStep.tsx`
- **Verification:** TypeScript type check passes; dialog closes correctly in tests
- **Committed in:** `a4778d4` (Task 3 GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both auto-fixes were required for test correctness and TypeScript compatibility. No scope creep.

## Known Stubs

Steps 2-5 are intentional placeholder shells per the plan specification:
- `components/wizard/AddItemsStep.tsx` — Step 2 placeholder ("Placeholder — implemented in Plan 02")
- `components/wizard/AssignItemsStep.tsx` — Step 3 placeholder ("Placeholder — implemented in Plan 02")
- `components/wizard/SetTipStep.tsx` — Step 4 placeholder ("Placeholder — implemented in Plan 03")
- `components/wizard/ResultsStep.tsx` — Step 5 placeholder ("Placeholder — implemented in Plan 03")

These stubs are intentional — the plan explicitly documents that Plans 02 and 03 will fill them in. They do not prevent PEOPLE-01 (the only requirement claimed by this plan) from being achieved.

## Issues Encountered

- **create-next-app rejected worktree directory**: The `.planning/` directory and `CLAUDE.md` prevented automatic scaffolding. Resolved by installing Next.js and all dependencies manually and writing config files directly.

## Next Phase Readiness

- `stores/useBillStore.ts` exports `useBillStore`, `Person`, `Item`, `PersonId`, `ItemId`, `AVATAR_COLORS` — ready for Plans 02 and 03 to import
- `lib/billMath.ts` exports all math functions — ready for SetTipStep and ResultsStep in Plan 03
- Steps 2-5 exist as placeholder shells — Plans 02 and 03 replace placeholder content without changing file paths
- All architectural decisions locked: integer cents, no Provider Zustand, URL hash routing, shadcn @base-ui/react components
- PEOPLE-01 fully satisfied: add people, colored avatars, trash → dialog confirm, disabled CTA gating, advance to step 2

---
*Phase: 01-manual-bill-splitter*
*Completed: 2026-05-08*
