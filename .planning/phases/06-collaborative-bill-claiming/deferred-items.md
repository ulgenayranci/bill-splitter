# Deferred Items — Phase 06 Plan 06

## Pre-existing Test Failures (Out of Scope)

### AddItemsStep.test.tsx + AssignItemsStep.test.tsx — 24 failures

**Status:** Pre-existing failures — these tests failed BEFORE Plan 06 execution began.

**Evidence:** `git stash` + rerun showed 24 failures before any Plan 06 changes.

**Root cause (inferred):** Tests use `getByRole('button', { name: /confirm|check|add|save/i })` 
pattern but multiple buttons now match after prior plan changes (possibly Plan 01 added 
`ShareLinkButton` or similar to a shared component that renders in the same context).

**Scope:** These test files are NOT in the Plan 06 `files_modified` list. Fixing them is 
out of scope for this plan.

**Recommendation:** Fix in a future plan or in a dedicated test-repair task.
