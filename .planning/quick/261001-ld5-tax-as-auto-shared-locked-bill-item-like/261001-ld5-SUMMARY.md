---
status: complete
quick_id: 261001-ld5
---

# Quick 261001-ld5: Tax as auto-shared locked bill item (like service fee)

Tax added on top of item prices is now captured by OCR (`taxCents`), shown as a locked "Tax" card, split equally across all current people, and included in tip total, results, share summary, grand total, setup status line and scanned-items editor. Included-VAT receipts yield null (prompt rule).

Commits: ef937fc (data layer), 80b06df (UI/results), plus setup/editor commit (see git log).

Generalised `computeEqualChargeShares` (alias `computeServiceFeeShares` kept) and new `BillChargeCard` (ServiceFeeCard is a thin wrapper).

Tests: vitest 458/458 passed, tsc clean. Deviations: none.
