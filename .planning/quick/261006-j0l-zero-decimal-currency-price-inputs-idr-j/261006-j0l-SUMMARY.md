---
status: complete
---
# 261006-j0l: Zero-decimal currency price inputs

Found while testing the Ippudo (IDR) receipt: edit boxes showed IDR 33,000 as "330.00" and typed prices were parsed as 2-decimal.

- lib/billMath.ts: currencyDecimals(), centsToInput(); parseCents(value, currencyCode?) accepts whole amounts with thousands separators ("33,000", "33.000") for 0-decimal currencies; 2-decimal behaviour unchanged.
- ScanItemsEditor + CollaborativeClaimingView inline edit use the currency for display and parsing.
- OCR retry message formats amounts per currency.
- Review price box widened (w-20 -> w-32, maxLength 12).
- Verified at 375px on the real Ippudo scan: boxes show 33000/114000; typing "35,000" -> "Off by IDR 2,000"; restored.
- Tests: 538/538, tsc clean. Commit 2377a3a.
