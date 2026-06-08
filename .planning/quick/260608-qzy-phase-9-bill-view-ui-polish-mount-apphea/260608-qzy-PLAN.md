---
phase: quick-260608-qzy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/wizard/AppHeader.tsx
  - app/split/[sessionId]/CollaborativeClaimingView.tsx
  - components/split/TipScreen.tsx
  - components/split/PersonResultsScreen.tsx
  - components/split/BillViewHeader.tsx
autonomous: false
requirements: [SHELL-01, SHELL-02]

must_haves:
  truths:
    - "The easy-billsy header appears at the top of every /split screen (identity gate, bill view, tip, results)"
    - "Tapping New Split from a /split URL navigates the user back to the setup screen at /"
    - "The people strip on the bill view renders as an overlapping facepile (avatars partially stacked), not side-by-side"
    - "The active person remains the amber pill, leftmost and on top; the +N overflow badge still shows correct N"
  artifacts:
    - path: "components/wizard/AppHeader.tsx"
      provides: "startNewSplit navigates to / via useRouter"
      contains: "router.push('/')"
    - path: "app/split/[sessionId]/CollaborativeClaimingView.tsx"
      provides: "AppHeader mounted in both identity-gate and main bill-view returns"
      contains: "AppHeader"
    - path: "components/split/TipScreen.tsx"
      provides: "AppHeader as first child of root main"
      contains: "AppHeader"
    - path: "components/split/PersonResultsScreen.tsx"
      provides: "AppHeader as first child of root main"
      contains: "AppHeader"
    - path: "components/split/BillViewHeader.tsx"
      provides: "Overlapping facepile people strip with negative margins, white rings, descending z-index"
      contains: "ring-2 ring-white"
  key_links:
    - from: "AppHeader.tsx"
      to: "next/navigation router"
      via: "router.push('/') inside startNewSplit"
      pattern: "useRouter"
    - from: "/split screens"
      to: "components/wizard/AppHeader"
      via: "import + JSX mount as first child of root main"
      pattern: "import.*AppHeader"
---

<objective>
Two presentational UI fixes to shipped Phase 9 collaborative bill-view code:

1. Mount the easy-billsy `<AppHeader />` on top of every /split screen, and fix the
   "New Split" menu action so it navigates back to `/` (it currently only resets the
   store, stranding the user on the bill URL).
2. Convert the people strip in `BillViewHeader` from a side-by-side row to an
   overlapping facepile (stacked avatars), matching the user's reference screenshot.

Purpose: Header is currently only present inside the wizard route (WizardShell), so the
collaborative /split screens have no app chrome. The people strip looks like a flat row
rather than the intended stacked-avatar pattern.

Output: AppHeader visible on all four /split screens; New Split returns to setup;
facepile rendering on the people strip. No schema/API/store-shape changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<interfaces>
<!-- Contracts the executor needs. Already verified in the codebase — no exploration required. -->

AppHeader (components/wizard/AppHeader.tsx) — client component, default behavior unchanged:
  export function AppHeader(): JSX.Element
  Renders a 48px-tall white header (h-12) with the easy-billsy wordmark + hamburger menu.
  Current startNewSplit body:  `reset(); setStep(1)`  — needs router.push('/') added.
  Already imports useBillStore; needs `import { useRouter } from 'next/navigation'`.

How WizardShell mounts it (components/wizard/WizardShell.tsx, reference pattern):
  <AppHeader /> is rendered as the FIRST child inside the outer container, above the
  progress strip and `<main>`. On /split screens there is no progress strip — AppHeader
  becomes the first child of the existing root `<main className="mx-auto min-h-screen max-w-[480px] bg-background">`.

BillViewHeader people strip (components/split/BillViewHeader.tsx):
  AVATAR_COLORS imported from '@/stores/useBillStore' (array of bg-* color classes).
  MAX_STRIP_AVATARS = 3 (keep).
  myPerson → amber pill (bg-amber-50 border border-amber-400, h-8, px-3).
  visibleOthers → otherPeople.slice(0, 3); overflowCount = max(0, others - 3).
  Strip container currently: `flex items-center gap-2 cursor-pointer mt-2 pb-1`
  with role="button" tabIndex={0} aria-label, onClick={onStripTap}, onKeyDown.
  Each "other" circle: `inline-flex h-8 w-8 shrink-0 ... rounded-full text-white {colorClass}`,
  title={person.name}, aria-hidden.
  Overflow badge: `h-8 w-8 ... rounded-full bg-zinc-100 text-zinc-500` showing `+{overflowCount}`.

NOTE: __tests__/BillViewHeader.test.tsx asserts on TEXT only (names, initials, "+1"),
not layout classes — so the facepile change will not break it as long as the same
people/initials/overflow text still render.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Mount AppHeader on all /split screens + fix New Split navigation</name>
  <files>components/wizard/AppHeader.tsx, app/split/[sessionId]/CollaborativeClaimingView.tsx, components/split/TipScreen.tsx, components/split/PersonResultsScreen.tsx</files>
  <action>
First, fix AppHeader navigation (components/wizard/AppHeader.tsx):
- Add `import { useRouter } from 'next/navigation'` to the imports.
- Inside the component, add `const router = useRouter()`.
- Change the startNewSplit body from `reset(); setStep(1)` to also navigate: call `reset()`, `setStep(1)`, then `router.push('/')`. This returns the user to the setup screen from any /split URL and is a no-op-correct on the wizard route (already at '/'). Do NOT change handleNewSplit / confirmReset logic — only startNewSplit.

Then mount the header. In each file below, add `import { AppHeader } from '@/components/wizard/AppHeader'` and render `<AppHeader />` as the FIRST child inside the root `<main className="mx-auto min-h-screen max-w-[480px] bg-background">` (above all existing content, including each screen's own back-button header):

- app/split/[sessionId]/CollaborativeClaimingView.tsx — TWO returns:
  1. the identity-gate shell (the `if (selectedPersonId === null)` return, root main ~line 513) — AppHeader above the `<IdentityModal>`.
  2. the main bill-view return (root main ~line 557) — AppHeader above `<BillViewHeader>`.
  (The `phase === 'tip'` and `phase === 'results'` branches return TipScreen / PersonResultsScreen, which get their own AppHeader below — do not touch those branches here.)
- components/split/TipScreen.tsx — root main ~line 84; AppHeader above the existing sticky back `<header>`.
- components/split/PersonResultsScreen.tsx — root main ~line 32; AppHeader above the inner content `<div>`.

Do not alter any store shape, props, or business logic. AppHeader and all four screens are already `'use client'`.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx tsc --noEmit && npm run lint && npx vitest run __tests__/CollaborativeClaimingView.test.tsx __tests__/PersonResultsScreen.test.tsx</automated>
  </verify>
  <done>AppHeader renders as first child of the root main on the identity gate, bill view, tip, and results screens; startNewSplit calls router.push('/'); typecheck, lint, and the affected component tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Convert people strip to an overlapping facepile in BillViewHeader</name>
  <files>components/split/BillViewHeader.tsx</files>
  <action>
Rework only Row 2 (the people strip, ~lines 143-193) of components/split/BillViewHeader.tsx into an overlapping facepile. Keep MAX_STRIP_AVATARS = 3 and all data logic (myPerson, visibleOthers, overflowCount, AVATAR_COLORS lookup, initials, title attribute, aria-hidden).

Strip container: remove `gap-2` from the container className (spacing now comes from negative margins). Keep `flex items-center cursor-pointer mt-2 pb-1`, the role="button", tabIndex={0}, aria-label, onClick={onStripTap}, and onKeyDown handler exactly as they are.

Z-ordering = leftmost on top (descending). Apply z-index via inline `style={{ zIndex: ... }}` because Tailwind dynamic z-classes are NOT safelisted in this project. Compute a descending zIndex per element so the amber pill is highest and each subsequent circle sits behind the one to its left.

- Amber pill (myPerson): keep its existing classes (flex items-center gap-2 h-8 rounded-full bg-amber-50 border border-amber-400 px-3 and inner avatar/name spans). It is leftmost and gets the highest zIndex. No negative margin on the pill.
- Each "other" circle (visibleOthers.map): keep `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white {colorClass}`, plus ADD `ring-2 ring-white` and a negative left margin (`-ml-3`) so it overlaps the previous element. Give each a descending inline zIndex.
- Overflow badge (+N): same overlap treatment — add `ring-2 ring-white` and `-ml-3`, keep `h-8 w-8 ... rounded-full bg-zinc-100 text-[14px] font-semibold text-zinc-500`, lowest zIndex (behind the colored circles). Keep the `+{overflowCount}` text.

For zIndex assignment, a simple scheme: pill = otherPeople.length + 2; each visibleOthers[i] = (otherPeople.length + 1) - i; overflow badge = 0. Any descending scheme that keeps the pill highest and circles descending left-to-right is acceptable.

Do not change Row 1, the share/receipt logic, props, or formatBillDate. Preserve the exact text output (names, single-letter initials, "+N") so __tests__/BillViewHeader.test.tsx (which asserts on text) keeps passing.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx tsc --noEmit && npm run lint && npx vitest run __tests__/BillViewHeader.test.tsx</automated>
  </verify>
  <done>People strip renders avatars overlapping (negative margins + white rings) with the amber pill leftmost and on top, descending z-index via inline style, +N overflow badge preserved; tsc, lint, and BillViewHeader.test.tsx pass.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>AppHeader mounted on all /split screens with working New Split navigation, and the people-strip facepile in BillViewHeader.</what-built>
  <how-to-verify>
1. Run `npm run dev` and open a `/split/[sessionId]` link on a narrow viewport (mobile width).
2. Confirm the easy-billsy header appears at the top of: the "Who are you?" identity gate, the main bill view, the tip screen, and the results screen.
3. Open the hamburger menu → tap "New Split" → confirm you are taken back to the setup screen at `/` (after the confirm dialog if a bill is in progress).
4. On the bill view, confirm the people chips now OVERLAP (stacked facepile): amber active-person pill leftmost and on top, colored circles partially behind it with thin white rings, then a grey +N badge if there are more than 3 others.
5. Tap anywhere on the people strip → confirm the change-identity modal still opens.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what looks off (e.g., header spacing, overlap direction, z-order).</resume-signal>
</task>

</tasks>

<verification>
- tsc --noEmit passes (no type regressions from the new imports/router).
- npm run lint passes.
- Existing component tests pass: CollaborativeClaimingView, PersonResultsScreen, BillViewHeader.
- Human visual check confirms header presence on all 4 /split screens, New Split navigation, and facepile overlap.
</verification>

<success_criteria>
- easy-billsy header visible on identity gate, bill view, tip, and results /split screens.
- New Split from a /split URL navigates to `/` and resets state.
- People strip renders as an overlapping facepile (amber pill on top, descending z-index, white rings, +N overflow preserved).
- No schema/API/store-shape changes; all existing tests green.
</success_criteria>

<output>
Create `.planning/quick/260608-qzy-phase-9-bill-view-ui-polish-mount-apphea/260608-qzy-SUMMARY.md` when done.
</output>
