---
phase: quick-261006-gpu
plan: 01
status: complete
completed: 2026-10-06
---

# Quick 261006-gpu: OCR guardrails, force review on doubtful scans

Doubtful scans (mismatch, no printed total, or any flagged line) now open the review screen; flagged lines are highlighted with a reason chip that clears on edit.

## Commits
- 59f743b: pure lib `lib/scanSanityChecks.ts` (flagScannedLines, shouldForceScanReview) + tests
- (task 2) per-line `confidence` ('high'|'low', default 'high') in OCR strict schema, prompt, parser
- (task 3) `Item.scanFlag`, SetupStep routing in both expand paths, ScanItemsEditor chips + no-total copy

## Deviations
- shouldForceScanReview lists 'mismatch' whenever `mismatch` is true (even if target is null), so the "multiple causes" case lists all four reasons.
- No lint config exists in the repo (pre-existing); lint skipped.
- worktree had no node_modules; symlinked the main checkout's (untracked, not committed).

## Tests
Full vitest: 29 files, 513 tests pass. `tsc --noEmit` clean. No existing tests needed changes beyond updating the ocrRoute exact-equality expectation to include `confidence: 'high'`.

## Self-Check: PASSED
