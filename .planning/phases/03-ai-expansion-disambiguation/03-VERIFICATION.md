---
phase: 03-ai-expansion-disambiguation
verified: 2026-05-10T09:38:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Two-phase loading flow visual"
    expected: "Scan a receipt on a real device. First see 'Scanning your bill…' overlay during OCR, then 'Expanding names…' overlay during expansion. Items appear with orange Review badges on low/ambiguous confidence rows."
    why_human: "jsdom cannot simulate real network latency, overlay transitions, or visual rendering. Requires a real device with an OPENAI_API_KEY configured."
  - test: "Mobile camera open verification"
    expected: "On iOS Safari or Android Chrome, tap a Review-badged item, then 'Take menu photo' in the dialog. The rear camera must open directly (not a file picker) due to capture='environment' on the hidden input."
    why_human: "Browser MediaStream/camera behavior cannot be verified in jsdom. Requires real mobile hardware."
  - test: "Full disambiguation flow end-to-end"
    expected: "Take a menu photo in the dialog. Wait for 'Checking the menu…' spinner. Confirm the edit field pre-fills with a name from the actual menu photo. Edit if needed. Save. Verify the orange Review badge disappears on the item row."
    why_human: "Requires live OpenAI API key and real menu image. GPT-4o-mini vision response quality cannot be mocked in automated tests."
  - test: "D-09 fallback on blurry/unreadable menu photo"
    expected: "If GPT cannot identify the item (blurry photo, wrong menu), the edit field should fall back to the AI's best guess from the expansion step — no error screen, no dead end."
    why_human: "Requires deliberately providing a bad menu photo to the real API. Cannot be triggered in automated tests without mocking, which is already covered."
---

# Phase 3: AI Expansion + Disambiguation — Verification Report

**Phase Goal:** Deliver AI-powered item name expansion and disambiguation so abbreviated OCR text becomes readable item names and ambiguous items can be clarified via menu photo
**Verified:** 2026-05-10T09:38:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OCR output is automatically expanded by the AI so "CHKN SAND LG" appears as "Chicken Sandwich (Large)" in the item list | VERIFIED | `/api/expand/route.ts` implements GPT-4o-mini text expansion with prompt examples. `AddItemsStep.tsx` chains `/api/ocr` → `/api/expand`, calling `setItems()` with `displayName` values. 8/8 expandRoute tests green. |
| 2 | Low-confidence expansions are visually flagged so the user knows which items to review | VERIFIED | `AddItemsStep.tsx` renders orange `<Badge>` on item rows where `item.confidence === 'low' \|\| item.confidence === 'ambiguous'`. `useBillStore.ts` carries the `confidence?` field on `Item`. 5/5 Phase 3 badge tests green. |
| 3 | For items that remain ambiguous, user is offered the choice to take a photo of the menu or enter the correct name manually | VERIFIED | `DisambiguationDialog.tsx` implements 4-state machine (choices → editing → clarifying → clarify-done). `AddItemsStep.tsx` routes Review-badged row clicks to this dialog via `handleItemRowClick`. `/api/clarify/route.ts` accepts vision call with rawName + image. 9/9 DisambiguationDialog tests + 4/4 AddItemsStep dialog tests green. |
| 4 | The app handles LLM timeout gracefully by falling back to the raw abbreviated name (still editable) rather than blocking | VERIFIED | `AddItemsStep.tsx` expand-failure catch block calls `addItem(item.name, item.priceCents)` per raw OCR item and sets `expandStatus('error')` + surfaces toast "Couldn't expand item names — you can edit them manually". D-09 fallback: `DisambiguationDialog.tsx` falls back to `item.name` on `/api/clarify` failure. Both paths verified by automated tests. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `stores/useBillStore.ts` | Item.rawName, Item.confidence, expandStatus, setExpandStatus, setItems, updateItem clears confidence | VERIFIED | All fields present and tested. `rawName?: string`, `confidence?: 'high' \| 'low' \| 'ambiguous'`, `expandStatus: 'idle' \| 'loading' \| 'done' \| 'error'`, `updateItem` sets `confidence: 'high' as const`. 24 store tests pass. |
| `components/wizard/OcrLoadingOverlay.tsx` | Optional `message` prop with default `'Scanning your bill…'` | VERIFIED | `message?: string` prop present. Default `'Scanning your bill…'` preserved exactly. `aria-label={message}` and `{message}` in render. 5 overlay tests pass. |
| `app/api/expand/route.ts` | POST handler returning `{items: [{rawName, displayName, priceCents, confidence}]}` | VERIFIED | 137 lines. GPT-4o-mini, `json_schema` strict, `expanded_items` schema name, count-mismatch guard, error isolation. No `NEXT_PUBLIC_` in runtime code. 8/8 tests green. |
| `components/wizard/AddItemsStep.tsx` | Two-step OCR→Expand flow, dual loading overlay, Review badge, disambiguation routing | VERIFIED | `handleFileChange` chains both fetches. Two `OcrLoadingOverlay` instances. Badge rendered with amber classes. `handleItemRowClick` predicate. `DisambiguationDialog` mounted and wired. 29/29 AddItemsStep tests green. |
| `app/api/clarify/route.ts` | POST handler for rawName + image, D-09 fallback, 400/500 | VERIFIED | 111 lines. `DATA_URI_RE` validation, `rawName.length > 200` guard, `image.length > 10_000_000` guard. `clarify_result` schema name. D-09 soft failures return `200 {displayName: ''}`. Only OpenAI throw returns 500. 7/7 tests green. |
| `components/wizard/DisambiguationDialog.tsx` | 4-state machine, camera input, AbortController cleanup, onSave callback | VERIFIED | 190 lines. `DialogState` type, `choices \| editing \| clarifying \| clarify-done`. `clarifyAbortRef` with 5 references. `capture="environment"` hidden input. `item?.id` useEffect dep for identity reset. `onSave(item.id, trimmed)` wired. 9/9 dialog tests green. |
| `__tests__/expandRoute.test.ts` | 8 tests covering expand route behaviors | VERIFIED | 101 lines. All 8 tests passing: happy path, 400s, 500s, model+schema assertions. |
| `__tests__/clarifyRoute.test.ts` | 7 tests covering clarify route behaviors | VERIFIED | 84 lines. All 7 tests passing including D-09 (200 + empty string), vision message format, all error paths. |
| `__tests__/DisambiguationDialog.test.tsx` | 9 isolated dialog unit tests | VERIFIED | 112 lines. All 9 tests passing: open/null guards, title, description, both buttons, Type name flow, Save name, Back, identity reset. |
| `__tests__/AddItemsStep.test.tsx` | Phase 3 describe block with 10 tests (expansion + badge + dialog) | VERIFIED | Phase 3 describe block present. 29 total tests passing (prior 20 + 9 Phase 3 expansion/badge/dialog). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AddItemsStep.tsx` handleFileChange | `/api/expand` | `fetch('/api/expand', ...)` after OCR success | WIRED | Line 175: `const expandRes = await fetch('/api/expand', ...)`. Response handled: `setItems(expandData.items.map(...))` or fallback addItem loop. |
| `app/api/expand/route.ts` | `openai.chat.completions.create` | `json_schema` strict, confidence enum | WIRED | Lines 51-90: `model: 'gpt-4o-mini'`, `response_format: { type: 'json_schema', json_schema: { name: 'expanded_items', strict: true, schema: { ...enum: ['high','low','ambiguous'] } } }` |
| `stores/useBillStore.ts` (setItems + setExpandStatus) | AddItemsStep render | Badge predicate `item.confidence === 'low' \|\| 'ambiguous'` | WIRED | Line 311: badge conditional present. `confidence` flows from store via `items` subscription. |
| `AddItemsStep.tsx` item row onClick | `DisambiguationDialog` open state | `handleItemRowClick` confidence predicate | WIRED | Lines 85-92: predicate routes low/ambiguous to dialog. Non-Review rows still go to `handleEditItemClick`. Line 304: `onClick={() => handleItemRowClick(item)}`. |
| `DisambiguationDialog.tsx` handleMenuFileChange | `/api/clarify` | `fetch('/api/clarify', {rawName, image})` | WIRED | Line 70: `const res = await fetch('/api/clarify', ...)`. AbortController used. D-09 fallback on empty `displayName` or fetch error. |
| `DisambiguationDialog.tsx` Save button | `useBillStore.updateItem` | `onSave` callback prop | WIRED | `handleSave` calls `onSave(item.id, trimmed)`. In AddItemsStep line 433-436: `onSave={(id, name) => { const target = items.find((i) => i.id === id); if (target) updateItem(id, name, target.priceCents) }}`. `updateItem` sets `confidence: 'high'`, dismissing the badge. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AddItemsStep.tsx` (item list) | `items` | `useBillStore` via `setItems(expandData.items.map(...))` after `/api/expand` success | Yes — GPT-4o-mini generates displayName per item; priceCents round-tripped from OCR | FLOWING |
| `AddItemsStep.tsx` (Review badge) | `item.confidence` | Carried in `Item` from `setItems` call (confidence field from API response) | Yes — confidence set by LLM response and validated server-side | FLOWING |
| `DisambiguationDialog.tsx` (edit input) | `editedName` | `item.name` on open; optionally replaced by `/api/clarify` `displayName` response | Yes — either AI-expanded name or menu-photo-derived name | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `/api/expand` returns 200 with items on success | `npx vitest run __tests__/expandRoute.test.ts` | 8/8 tests pass | PASS |
| `/api/clarify` returns 200 with displayName on success | `npx vitest run __tests__/clarifyRoute.test.ts` | 7/7 tests pass | PASS |
| `DisambiguationDialog` 4-state machine renders correctly | `npx vitest run __tests__/DisambiguationDialog.test.tsx` | 9/9 tests pass | PASS |
| `AddItemsStep` Phase 3 expansion + badge + dialog behaviors | `npx vitest run __tests__/AddItemsStep.test.tsx` | 29/29 tests pass | PASS |
| Full test suite — no regressions | `npx vitest run` | 151/151 tests pass, 12 test files | PASS |
| TypeScript compilation | `npx tsc --noEmit` | Exits 0, no errors | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| OCR-02 | 03-01-PLAN.md, 03-02-PLAN.md | AI expands abbreviated item names into readable names (e.g. "CHKN SAND" → "Chicken Sandwich") | SATISFIED | `/api/expand/route.ts` implements GPT-4o-mini text expansion. `AddItemsStep.tsx` chains OCR→Expand. `setItems()` replaces items with `displayName` values. 8 expand route tests + 5 expansion badge tests all green. REQUIREMENTS.md marks OCR-02 as `[x] Complete`. |
| OCR-04 | 03-01-PLAN.md, 03-03-PLAN.md | When items are ambiguous, user can take a menu photo OR enter name manually | SATISFIED | `/api/clarify/route.ts` handles vision call. `DisambiguationDialog.tsx` provides "Type name" and "Take menu photo" paths. AddItemsStep routes Review row clicks to dialog. 7 clarify route tests + 9 dialog tests + 4 AddItemsStep dialog tests all green. REQUIREMENTS.md marks OCR-04 as `[x] Complete`. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No anti-patterns found | — | No stubs, no hardcoded empty returns in production paths, no TODOs. All data flows to real state. |

### Human Verification Required

#### 1. Two-Phase Loading Flow Visual

**Test:** On a real mobile device with `OPENAI_API_KEY` configured, scan an actual restaurant receipt by tapping "Scan bill."
**Expected:** First see "Scanning your bill…" overlay while OCR runs, then immediately after OCR succeeds see "Expanding names…" overlay while expansion runs. Items then appear in the list with orange "Review" badges on any row where the AI was low/ambiguous confidence.
**Why human:** jsdom cannot simulate real network timing or confirm visual overlay transitions. Requires real device and live API key.

#### 2. Mobile Camera Open Verification

**Test:** On iOS Safari or Android Chrome, tap a Review-badged item row, then tap "Take menu photo" in the disambiguation dialog.
**Expected:** The device's rear camera opens directly (not a file picker dialog) due to `capture="environment"` attribute on the hidden file input.
**Why human:** Browser MediaStream and camera routing behavior is device-specific. jsdom has no camera API.

#### 3. Full Disambiguation Flow on Real Device

**Test:** After scanning a receipt that produces ambiguous items, tap a Review-badged row, tap "Take menu photo," photograph the restaurant menu, wait for "Checking the menu…" spinner to resolve.
**Expected:** The edit input pre-fills with the item name identified from the menu photo. User can edit if needed, then tap "Save name." The orange Review badge disappears from that item row.
**Why human:** Requires live OpenAI Vision API with a real menu image. The quality of GPT-4o-mini's response depends on image content that cannot be faked in automated tests.

#### 4. D-09 Fallback on Unreadable Menu Photo

**Test:** Tap "Take menu photo" with a deliberately blurry, unlit, or entirely wrong image (e.g., photo of a wall).
**Expected:** No error screen. The edit field shows the AI's best guess from the expansion step (the item's current name). User can still save manually.
**Why human:** Requires deliberately providing a bad image to the real API to trigger the GPT empty/uncertain response path.

### Gaps Summary

No gaps found. All 4 roadmap success criteria are verified in the codebase. All 6 primary artifacts (useBillStore, OcrLoadingOverlay, /api/expand, /api/clarify, DisambiguationDialog, AddItemsStep) exist, are substantive (no stubs), are wired, and have data flowing through them. All 151 tests pass with 0 regressions. TypeScript compiles cleanly.

The status is `human_needed` because the phase delivers visual/device behaviors (camera integration, overlay transitions, real API responses) that cannot be fully verified without a real mobile device and live API key. These items are listed in the Hand-off Note from 03-03-SUMMARY.md and are standard UAT sign-offs, not blocking gaps.

---

_Verified: 2026-05-10T09:38:00Z_
_Verifier: Claude (gsd-verifier)_
