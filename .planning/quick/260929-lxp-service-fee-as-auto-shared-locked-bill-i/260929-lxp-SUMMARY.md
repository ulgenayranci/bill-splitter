# Quick 260929-lxp Summary

Service fee captured by OCR as `serviceFeeCents` and shown as a locked, always-selected line, split equally among all current people (largest remainder in people-array order), included in tip screen, results, share summary and grand total; excluded from reconciliation and unclaimed logic.

Commits: ee14b7c (task 1), f6d36b4 (task 2), third commit (task 3, see git log).
Tests: vitest 26 files / 423 tests pass (387 base + 36 new); tsc clean.
Deviations: none. Worktree was reset to 262ac89 at start (base differed).
