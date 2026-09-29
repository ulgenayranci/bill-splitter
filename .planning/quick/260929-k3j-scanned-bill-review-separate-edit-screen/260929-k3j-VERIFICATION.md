---
task: quick-260929-k3j
verified: 2026-09-29
status: human_needed
score: 8/8 truths verified in code; visual/browser items pending
---

# Quick 260929-k3j Verification

**Goal:** Scanned bill review: separate edit screen, Retake+Edit, taller photo

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Mismatched scan auto-opens the edit screen (step 2) | VERIFIED | SetupStep.tsx:261 and :285 call `setStep(2)` when `mismatch && targetCents != null`, right after `setScanCheck`. ScanItemsEditor renders name, price, qty and delete per item, plus Add item and the gap line. |
| 2 | Clean scan stays on setup | VERIFIED | `setStep(2)` is called only inside the mismatch condition. |
| 3 | No yellow `scan-review` list in SetupStep | VERIFIED | `grep -c 'data-testid="scan-review"'` returns 0. Only `scan-review-still-off` remains, which the plan intends. |
| 4 | Container has `data-testid="scanned-bill-review"`, h-48 photo, and outline Retake + Edit at the right | VERIFIED | SetupStep.tsx:349-388: `h-48`, and the row is `flex justify-end gap-2` with two `variant="outline"` Buttons. |
| 5 | Edit opens the editor at any time; one default-variant Done returns to step 1 and commits drafts | VERIFIED | Edit calls `setStep(2)`. `handleDone` commits pending drafts and then calls `setStep(1)`. Done is a `Button` with no variant, so it is the default variant. |
| 6 | Retake clears the scan check and opens the picker | VERIFIED | `setScanCheck(null)` then `fileInputRef.current?.click()`. |
| 7 | Step and scanCheck persist across refresh | VERIFIED (code) | The store has a `ScanCheck` type, `setScanCheck`, and `scanCheck: null` in INITIAL_STATE, so `reset()` clears it. `partialize` includes `scanCheck: s.scanCheck` (line 226). page.tsx routes `step === 2 && itemCount > 0` to `ScanItemsEditor`, with a `setStep(1)` fallback when there are no items. An actual browser refresh was not run. |
| 8 | Progress strip stays 3 segments, edit screen fills only Setup | VERIFIED | `filledSegments(2)` returns 1. WizardShell is unchanged from before the task (`git diff` is quiet). |

## Automated checks

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 15 failed, 363 passed (378 total). The 15 failures are exactly the known pre-existing ones (AppHeader, BillViewHeader, ClaimableItemCard, CollaborativeClaimingView Test 26, InvitePeopleStep, PersonResultsScreen, WizardShell). No SetupStep, ScanItemsEditor or useBillStore failures. The WizardShell failures are among the pre-existing 15 (3 there).
- No TBD/FIXME/XXX markers were introduced. The moved edit logic (`commitRow` validation, `maxLength`s) is unchanged.

## Human verification required

1. **375px visual pass after a mismatched scan.** Expected: the edit screen opens by itself, the item name gets its own row, and the off-by line shows. After Done, the container sits under the tagline with a 192px photo and Retake + Edit side by side at the right.
2. **Refresh on the edit screen.** Expected: same items and same off-by line after a reload (the hydration path is exercised only in a real browser).
3. **Retake opens the camera or file picker on a real device.** Also check the lightbox still opens on photo tap.

## Gaps

None found.
