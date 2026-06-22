---
quick_id: 260622-hjb
slug: phase-11-uat-round-6-followups
date: 2026-06-22
status: ready
description: "Phase 11 UAT round-6 follow-ups — OCR auto-retry, invite/finish redesigns, claimed-badge cleanup, scan edge-case doc"
plans: 1
tasks: 5
---

# Quick Task 260622-hjb: Phase 11 UAT round-6 follow-ups

## Context

UAT round-5/6 on the live app surfaced 3 fails (Tests 2, 3, 7) + 1 enhancement (Test 5) + 1 doc request (Test 4). Full plan + rationale: `~/.claude/plans/i-have-completed-the-misty-rain.md`. User decisions (locked):
- **Styling:** keep existing Tailwind *amber* + *Geist* — match the LAYOUT of the Figma/jpeg, NOT the exact `#DD6500`/Archivo.
- **Bad scans:** auto-retry once, then fall back to the existing warning + manual edit (manual edit already exists in the bill view, no new UI).

Each task = one atomic commit, pushed to main immediately after (per project convention + standing "always push" preference). Run on the main tree (no worktree).

## Verification gates (all tasks)
- `npx tsc --noEmit` clean.
- `npm test` green except the 3 known pre-existing retired-wizard failures (AddPeopleStep ×2, AddItemsStep ×1).

---

## Task 1 — Test 2: OCR auto-retry on failed checksum
**Files:** `app/api/ocr/route.ts` (+ test if one exists)
**Action:**
- Refactor the single OpenAI call + parse/normalize block (current lines ~54–151) into helpers: `runOcrPass(image, extraInstruction?)` (does the chat.completions.create + returns the parsed/normalized `{ items, currencyCode, subtotalCents }`) and `parseOcrResponse(content)` (the existing coercion/normalization).
- After pass 1, import and call `reconcileScannedBill` from `lib/reconcileScannedBill.ts` with the raw lines + `{ subtotalCents }` to get `completeness`.
- **Retry exactly once** only when `subtotalCents != null` AND `completeness.mismatch === true`. The retry passes an `extraInstruction` appended to the prompt stating the gap, e.g. _"Your previous reading summed to {reconciledSum} but the printed total is {subtotal} (off by {delta}). You likely missed or miscounted a repeated line. Re-read every line — including identical duplicates — and return the corrected full list."_ (format the cents values as plain integers/decimals in the message.)
- Keep whichever pass has the smaller `|reconciledSum − subtotal|` (compute via `reconcileScannedBill` on each). Cap at 2 total passes.
- **Response shape unchanged**: `{ items, currencyCode, subtotalCents }` — no client change.
- Bump `export const maxDuration` from `30` → `60`.
- `console.error`/`console.log` may note pass count for server-side telemetry; never echo OpenAI internals to the client.
**Verify:** tsc clean; OCR route test (if present) updated with (a) mismatch→retry→corrected pass-through and (b) still-mismatched returns best pass. Reason through the retry branch for a clean scan (no retry) vs a mismatched scan (one retry, best kept).
**Done:** Route runs ≤2 passes, self-corrects mismatches when a printed total exists, identical client contract.
**Commit:** `feat(11): OCR auto-retry on checksum mismatch before showing scan (G2)`

## Task 2 — Test 4: scan edge-case catalogue
**Files (new):** `.planning/phases/11-bug-fixes-polish-bill-results-screens-participant-management/SCAN-EDGE-CASES.md`
**Action:** Markdown reference table: scenario → trigger → detection (which `reconcileScannedBill` field/flag) → behavior (auto-correct / retry / warn / none) → exact user-facing copy string. Cover: missing line / dropped duplicate; miscounted repeated identical lines (known weak spot, now mitigated by Task 1 retry); unit-price-vs-line-total confusion (`corrected` flag, auto-fixed); no printed total (checksum can't run → no warning); tax/tip/subtotal misread as an item; currency misread; float price coerced; zero/negative price dropped; over-claim at claim time. Quote the actual strings from `SetupStep.tsx` (guardrail-completeness / guardrail-corrected) and the new retry message.
**Verify:** Every copy string in the doc matches the real source (grep to confirm).
**Done:** Doc enumerates each failure mode with accurate detection + copy.
**Commit:** `docs(11): scan failure-mode + warning-copy catalogue (G2.3)`

## Task 3 — Test 3: Invite screen redesign
**Files:** `components/split/InvitePeopleStep.tsx` (+ its test if present)
**Action:** Match the Figma layout with amber/Geist:
- Remove the "Copy link" `Button` and the URL-preview `<div>`. (`handleShare` already clipboard-copies when `navigator.share` is absent — copy stays covered.)
- Mount `AppHeader` (`components/wizard/AppHeader.tsx`) + `ProgressStrip filled={1}` (`components/wizard/ProgressStrip.tsx`) at the top — invite is step 1 of 3 (claiming uses `filled={2}`).
- Keep the heading "Invite your group", the subtext, and the `Users` icon circle.
- Bottom button row (side by side): `Skip` (outline `variant`, left) → calls `onContinue`; `Share link` (amber primary, right) → existing `handleShare`. Remove the old plain-text "Skip → claim items" link.
- Layout should sit cleanly under the header (drop the full-screen vertical-center if it conflicts with the header/progress mount).
**Verify:** tsc clean; test asserts exactly two buttons (Skip + Share link), no "Copy link"/URL preview, header + progress present. `onContinue` still fires from Skip; `localStorage` "show once" logic in `CollaborativeClaimingView.tsx` untouched.
**Done:** Invite screen shows header + progress (1/3) + Skip/Share link only.
**Commit:** `feat(11): redesign invite screen — header+progress, Skip/Share only (G4)`

## Task 4 — Test 5: remove redundant claimed badge
**Files:** `components/split/ClaimableItemCard.tsx` (+ test)
**Action:** Delete the bottom-right indicator block (current lines ~236–242: `Check` icon + "claimed" text, `data-testid="claimed-indicator"`, rendered when `allClaimantEntries.length > 0`). Keep the top-row qty=1 `Check` icon (~line 121) and the multi-qty `"{x} of {N} claimed"` count (`data-testid="claimed-count"`, ~lines 187–194). Remove any now-unused vars only if truly unused (keep `allClaimantEntries` if used elsewhere).
**Verify:** tsc clean; `ClaimableItemCard` test drops `claimed-indicator` assertions, keeps `claimed-count`; single-qty claimed card still shows top-row check + strikethrough.
**Done:** No bottom-right "claimed" badge on any card; multi-qty still shows "x of N claimed".
**Commit:** `feat(11): drop redundant claimed badge on cards, keep x-of-N count (G7)`

## Task 5 — Test 7: Finish dialog redesign
**Files:** `app/split/[sessionId]/CollaborativeClaimingView.tsx` (dialog ~lines 839–878; + claiming-view test)
**Action:** Restructure the unclaimed-warning `Dialog` to match the jpeg:
- Keep `DialogTitle` ("{N} item(s) still unclaimed") and `DialogDescription` body.
- Remove the standalone full-width "Share bill link" button above the row.
- Button **row** (`flex gap-2`): left = `Share bill link` (outline `variant`, keep `handleWarningShare` + `warningLinkCopied` "Link copied!" state + Share2/Check icon); right = `Show my result` (amber primary, keep `submitDone()` — **rename** from "Finish anyway").
- Below the row: a centered plain-text link `Continue editing` → `setShowUnclaimedWarning(false)` (replaces the old "Go back" outline button).
**Verify:** tsc clean; test asserts `Show my result` + `Continue editing` present, no "Finish anyway"/"Go back"; `submitDone` fires from Show my result, dialog closes from Continue editing, share still works.
**Done:** Dialog shows Share bill link + Show my result row + Continue editing link.
**Commit:** `feat(11): redesign finish dialog — Show my result + Continue editing (G8)`

---

## After all tasks
- Flip Tests 2, 3, 7 in `UAT-CHECKLIST.md` to ✅ with a short note.
- Update STATE.md "Quick Tasks Completed" table.
- Write SUMMARY.md for this quick task.
