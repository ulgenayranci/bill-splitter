# Quick 260929-kia Summary

Edit-scanned-items screen now leads with a problem-stating heading ("Your items don't match the receipt", derived from the live gap) and a total-check summary card above the item list ("Off by X" in text-warn, or "Matches the receipt"; muted "Receipt subtotal|total X · Your items Y").

Files: components/wizard/ScanItemsEditor.tsx, __tests__/ScanItemsEditor.test.tsx.
Verification: ScanItemsEditor tests 8/8 pass; tsc clean; full suite 15 failures, all the known pre-existing ones.
Deviations: none.
