---
status: complete
---
# 261006-k2k: Compact scanned-items preview (option A + fade from C)

User picked mockup A (compact header + show all) with the white fade from mockup C.

- SetupStep: big h-48 photo replaced by compact card — 44×56 thumbnail (opens BillPhotoLightbox, aria "View bill photo"), "N items found", items total + "· matches receipt" / "· off by X" (vs scanCheck.targetCents), Retake + Edit round icon buttons (aria-labels kept).
- Preview: first 3 items (qty×, name, bare amount per currency decimals), bottom white fade overlay while collapsed, "Show all N" / "Show less" toggle (aria-expanded); no toggle when ≤3 items.
- Test "photo frame is 192px (h-48)" replaced (asserted the old design) by 4 tests for the compact view.
- Verified at 375px with the Ippudo scan: collapsed + expanded. 541/541 tests, tsc clean. Commit a754448.
