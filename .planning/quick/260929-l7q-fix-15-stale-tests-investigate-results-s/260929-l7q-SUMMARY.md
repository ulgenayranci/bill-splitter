# Quick 260929-l7q Summary

Cleared all 15 stale vitest failures by retargeting tests at the current UI. Only `__tests__/` changed.

Commits: dec4f01, 6335ee8, 0aa08fd.

- AppHeader/WizardShell/InvitePeopleStep: label `easy billsy`; strip selectors `bg-coral-500`/`bg-zinc-200` (still 3 segments, 1 filled on Setup, so no product bug).
- BillViewHeader: en-GB long date, `Invite — copy bill link` button (+ min-h-[44px]), avatar class via `AVATAR_COLORS[1]` (`bg-[#9b6cf0]`).
- CollaborativeClaimingView Test 26: Invite button.
- ClaimableItemCard: mine highlight = `bg-white` + inline borderColor + linear-gradient.
- PersonResultsScreen: "Unclaimed items" section intact, items still listed (li colour changed amber-700 to zinc-700 in ef83d2b). Tests now scoped by section aria-label.

Result: vitest 387/387 pass; tsc clean.
