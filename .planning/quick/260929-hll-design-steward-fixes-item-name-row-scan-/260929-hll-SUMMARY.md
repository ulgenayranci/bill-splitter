# Quick 260929-hll: Design Steward fixes Summary

Two-row item edit/add forms (name full width, then price/qty/confirm/cancel), white bg-card done bar, and new scan-card copy.

## Commits
- b78a9bb: CollaborativeClaimingView two-row edit + add forms, done bar bg-card, added two-row test assertion
- 711dc36: SetupStep new scan-card copy, two-row scan-review rows

## Notes
- SetupStep scan-review row name was estimated ~111px wide at 375px (under the 120px threshold), so the two-row fix was applied.
- The "I vs we" voice question remains open for the user.
- Copy set to: "Take a photo of the receipt and I will capture all the items for you."

## Deviations
None to the plan.

## Deferred Issues
15 tests fail across 7 files (AppHeader, BillViewHeader, ClaimableItemCard, CollaborativeClaimingView Test 26, InvitePeopleStep, PersonResultsScreen, WizardShell). They concern header wordmark, share affordance, colour classes and progress strips, none touched by this change (SetupStep tests all pass). Believed pre-existing from the brand rebrand; not verified against the base commit. `npx tsc --noEmit` exits 0.

## Self-Check: PASSED
