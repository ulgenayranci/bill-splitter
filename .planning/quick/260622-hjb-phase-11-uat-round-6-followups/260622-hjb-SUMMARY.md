---
quick_id: 260622-hjb
slug: phase-11-uat-round-6-followups
date: 2026-06-22
status: complete
tasks: 5
phase: 11
---

# Quick Task 260622-hjb Summary — Phase 11 UAT round-6 follow-ups

Resolved the 3 UAT round-5/6 fails (Tests 2, 3, 7), added the Test-5 enhancement
(claimed-badge cleanup), and produced the Test-4 doc request. Styling kept the existing
Tailwind amber + Geist tokens and matched the Figma LAYOUT only (not #DD6500/Archivo).
Bad-scan handling is auto-retry-then-warn — no new editing UI (manual edit already lives
in the bill view).

## Tasks

| # | Task | Commit | Verification |
|---|------|--------|--------------|
| 1 | OCR auto-retry on checksum mismatch (G2) — `runOcrPass`/`parseOcrResponse` helpers; retry once when `subtotalCents != null && completeness.mismatch`; keep closer pass; cap 2 passes; `maxDuration` 30→60 | `c96cd73` | tsc clean; `ocrRoute.test.ts` 15/15 (6 new retry tests: no-retry clean, retry→corrected, keep-best-when-still-mismatched, no-subtotal no-retry, retry-throws falls back) |
| 2 | Scan failure-mode + warning-copy catalogue (G2.3) — new `SCAN-EDGE-CASES.md` | `c53e80d` | All quoted copy strings grep-verified against SetupStep.tsx / ClaimableItemCard.tsx / ocr/route.ts |
| 3 | Invite screen redesign (G4) — AppHeader + ProgressStrip(filled=1), Users icon + heading + subtext, Skip (outline) / Share link (amber) row; removed Copy button + URL preview | `c8183e0` | tsc clean; `InvitePeopleStep.test.tsx` 5/5 (exactly two buttons, no copy/URL, header+progress present, Skip→onContinue, share native + clipboard fallback) |
| 4 | Drop redundant claimed badge (G7) — removed bottom-right `claimed-indicator`; kept top-row qty=1 check + multi-qty `claimed-count` | `ac96690` | tsc clean; `ClaimableItemCard.test.tsx` 24/24 (claimed-indicator now absent; count + strikethrough retained) |
| 5 | Finish dialog redesign (G8) — Share bill link (outline) / Show my result (amber) row + centered "Continue editing" link; "Finish anyway"/"Go back" retired; `submitDone`/`handleWarningShare` preserved | `124acff` | tsc clean; `CollaborativeClaimingView.test.tsx` 36/36 (Show my result fires submitDone, Continue editing closes dialog, share still works) |

## Post-task housekeeping

- UAT-CHECKLIST.md Tests 2/3/7 flipped ❌→✅ with notes (Test 3's original Figma CSS dump preserved inside a `<details>` block). Commit `d2cee49`.
- STATE.md "Quick Tasks Completed" table updated.

## Full suite

`npm test`: **435 passed, 3 failed** — the 3 failures are exactly the known pre-existing
retired-wizard tests (`AddPeopleStep` ×2, `AddItemsStep` ×1). No other failures.

## Deviations

- None affecting behavior. The route's response contract was kept identical
  (`{ items, currencyCode, subtotalCents }`, items carrying `unitPriceCents`/`lineTotalCents`);
  the plan's shorthand "{ items, currencyCode, subtotalCents }" was honored — no client change.
- Task 3 test required mocking `next/navigation` + `useBillStore` because the redesigned
  invite screen now mounts `AppHeader` (which uses `useRouter` + the store). Mirrors the
  existing `AppHeader.test.tsx` mock pattern.

## Self-Check: PASSED

- `app/api/ocr/route.ts`, `lib/reconcileScannedBill.ts` import wired — present.
- `.planning/phases/11-.../SCAN-EDGE-CASES.md` — present.
- `components/split/InvitePeopleStep.tsx`, `components/split/ClaimableItemCard.tsx`,
  `app/split/[sessionId]/CollaborativeClaimingView.tsx` — modified, present.
- All 6 commits (`c96cd73`, `c53e80d`, `c8183e0`, `ac96690`, `124acff`, `d2cee49`) in git log, pushed to main.
