# Deferred Items — Phase 07

Out-of-scope discoveries logged during execution (not fixed; outside the current task's changes).

## Pre-existing test failures (discovered during 07-04 full-suite run, 2026-06-05)

These 5 tests fail independently of the 07-04 gap-closure changes (WizardShell + SetupStep
only). Verified failing in isolation with no dependency on the modified files. Not regressions.

| File | Test | Note |
|------|------|------|
| `__tests__/AddItemsStep.test.tsx` | `tapping "Continue" with ≥1 item calls setStep(3)` | Pre-existing |
| `__tests__/AddPeopleStep.test.tsx` | `disables CTA when no people added` | Pre-existing |
| `__tests__/AddPeopleStep.test.tsx` | `enables CTA after adding a person` | Pre-existing |
| `__tests__/CollaborativeClaimingView.test.tsx` | `Test 18 (Confirm tip → Results)` | Pre-existing |
| `__tests__/PersonSlotPicker.test.tsx` | `Test 2: opacity-50 + "(taken)"` | Pre-existing |

These likely reflect the v1 → v2 wizard restructure (AddItemsStep/AddPeopleStep superseded by
SetupStep) and unrelated claiming-flow drift. Address under a dedicated test-cleanup task.

## Pre-existing tooling issue

- `npm run lint` fails: ESLint 9.39 requires flat config (`eslint.config.js`); repo has none.
  Out of scope for 07-04. Migration needed before lint can gate CI.
