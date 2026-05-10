---
phase: 03-ai-expansion-disambiguation
plan: 03
subsystem: disambiguation
tags: [ocr, ai, disambiguation, dialog, vision, gpt-4o-mini]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [OCR-04]
  affects: [components/wizard/AddItemsStep.tsx, app/api/clarify/route.ts, components/wizard/DisambiguationDialog.tsx]
tech_stack:
  added: []
  patterns:
    - GPT-4o-mini vision call for menu photo identification (mirrors /api/ocr pattern)
    - 4-state local machine in dialog component (choices | editing | clarifying | clarify-done)
    - AbortController cleanup on unmount for in-flight fetch cancellation
    - Click routing predicate on item confidence to open disambiguation vs inline edit
key_files:
  created:
    - app/api/clarify/route.ts
    - components/wizard/DisambiguationDialog.tsx
    - __tests__/DisambiguationDialog.test.tsx
  modified:
    - components/wizard/AddItemsStep.tsx
decisions:
  - "D-09 fallback: all soft GPT failures (empty content, malformed JSON, missing field) return 200 + displayName empty string — client falls back to AI's best guess pre-filling the edit field"
  - "T-03-CL-02 mitigation: rawName wrapped in double quotes in the prompt to bound prompt injection; strict json_schema constrains output to { displayName: string }"
  - "Test harness swap wrapped in act() to avoid React 19 act() warning on Harness state updates (deviation from plan template — minor adjustment for React testing correctness)"
  - "Item photo discarded after /api/clarify call returns — never stored in Zustand (D-10 enforced, T-03-CL-06 mitigation)"
metrics:
  duration: "~12 min"
  completed_date: "2026-05-10"
---

# Phase 3 Plan 03: Disambiguation Dialog Summary

**One-liner:** OCR-04 end-to-end — review-badged item rows open a 4-state disambiguation dialog (type name OR take menu photo via GPT-4o-mini vision), saving dismisses the badge.

---

## What Was Built

### /api/clarify contract

**Request:** `POST /api/clarify` with `{ rawName: string, image: string (data URI) }`

**Validation:**
- `rawName`: required string, non-empty, max 200 chars → 400 on failure
- `image`: required string, must match `DATA_URI_RE`, max 10MB → 400 on failure
- Both validations fire BEFORE the OpenAI call

**Response:**
- `200 { displayName: string }` — success path (displayName may be empty on D-09)
- `400 { error }` — invalid rawName or image
- `500 { error: 'Clarify failed' }` — OpenAI client throw only

**D-09 fallback paths (all resolve to 200 + displayName: ''):**
1. Empty GPT response (`completion.choices[0]?.message?.content` is falsy)
2. Response content is not valid JSON
3. Parsed JSON lacks a `displayName` string field

**Security:** rawName wrapped in double-quotes in prompt (T-03-CL-02); API key server-only env (T-03-CL-04); OpenAI internals never reflected to client (T-03-CL-01); maxDuration=30 bounds slow vision calls (T-03-CL-05).

---

### DisambiguationDialog state machine

```
open(item) → 'choices'
  → [Type name] → 'editing' → [Save name] → onSave + close
  → [← Back] (from editing) → 'choices'
  → [Take menu photo] → 'clarifying' → /api/clarify resolves → 'clarify-done' → [Save name] → onSave + close
  → [X close] → onOpenChange(false), no save, badge intact
```

**Key contracts:**
- `DialogTitle` renders "What's this item?" (HTML entity `&apos;` for the apostrophe)
- `DialogDescription` renders `item.name` (fallback: "Unknown item" if name is empty)
- Item identity change (`item?.id` useEffect dep) resets to 'choices' and re-syncs editedName
- AbortController on unmount cancels in-flight /api/clarify (T-03-CL-05 mitigated)
- Menu photos: created in `handleMenuFileChange`, sent to /api/clarify, discarded on function return — never stored (D-10)

---

### AddItemsStep routing change

`handleItemRowClick` replaces direct `handleEditItemClick` binding on display-mode Card:

```typescript
const handleItemRowClick = (item: Item) => {
  if (item.confidence === 'low' || item.confidence === 'ambiguous') {
    setDisambigItem(item)
    setDisambigOpen(true)
  } else {
    handleEditItemClick(item)
  }
}
```

- Review-badged items (confidence 'low' | 'ambiguous') → opens DisambiguationDialog
- All other items (confidence 'high' | undefined) → existing inline edit (no regression)
- `onSave` looks up current `priceCents` from store via `items.find()` before calling `updateItem(id, name, priceCents)` — updateItem sets `confidence: 'high'`, dismissing the badge

---

## Test Count Delta

| Test file | Before | After | Delta |
|-----------|--------|-------|-------|
| clarifyRoute.test.ts | 0 (file missing) | 7 | +7 |
| DisambiguationDialog.test.tsx | 0 (file missing) | 9 | +9 |
| AddItemsStep.test.tsx (Phase 3 dialog) | 25 passed, 4 failed | 29 passed | +4 pass |
| All other test files | 111 passed | 111 passed | 0 |
| **Total** | **136 passed, 4 failed** | **151 passed** | **+15 pass, 0 regressions** |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test harness swap wrapped in act()**
- **Found during:** Task 2 — DisambiguationDialog test 9 (item identity change)
- **Issue:** The plan's `__tests__/DisambiguationDialog.test.tsx` template called `swap(...)` without wrapping in `act()`. React 19 throws an "update not wrapped in act" warning and the state update is not processed synchronously, causing `screen.getByText('Fries')` to fail because the DOM still shows 'Burger'
- **Fix:** Imported `act` from `@testing-library/react` and wrapped the swap call: `act(() => { swap(lowItem({ id: 'i2', name: 'Fries' })) })`
- **Files modified:** `__tests__/DisambiguationDialog.test.tsx`
- **Commit:** de67097

No other deviations — plan executed as written.

---

## Phase 3 User Story: Complete

**Scan receipt → see expanded names + Review badges → tap Review → choose method → save → badge dismissed → continue to assignment**

1. User taps "Scan bill" → OCR + expand runs → items appear with orange "Review" badges on low/ambiguous confidence items
2. User taps a Review-badged row → DisambiguationDialog opens with "What's this item?" title and AI's best guess in description
3. User taps "Type name" → editable input pre-filled with AI's best guess → edits → taps "Save name" → badge dismissed, item updated
4. OR: User taps "Take menu photo" → device rear camera opens → photo taken → "Checking the menu…" spinner → GPT-4o-mini identifies item → edit field pre-filled → user reviews → taps "Save name" → badge dismissed
5. If clarify fails (D-09) → edit field pre-filled with AI's original guess → user can still save manually → no dead end

---

## Known Stubs

None — all data flows wired end-to-end.

---

## Threat Flags

No new security surface beyond what was planned in the threat model.

---

## Hand-off Note for /gsd-verify-work

Manual UAT items (cannot be automated in jsdom):

1. **Two-phase loading flow visual:** On a real device, scan a receipt and observe (a) "Scanning your bill…" overlay during OCR, then (b) "Expanding names…" overlay during expansion. Verify overlays transition correctly and items appear with Review badges.

2. **Mobile camera open verification:** On iOS Safari or Android Chrome, tap a Review-badged item, then "Take menu photo" in the dialog. Verify the rear camera opens directly (not a file picker) due to `capture="environment"` on the hidden input.

3. **Full disambiguation flow:** Take a menu photo, wait for "Checking the menu…" spinner to resolve, confirm the edit field is pre-filled with a name from the menu photo. Edit and save. Verify the Review badge is gone on the item row.

4. **D-09 fallback:** If GPT cannot identify the item from the menu photo (e.g., blurry photo, wrong menu), verify the edit field falls back to the AI's best guess (from expansion step) — no error screen.

Per VALIDATION.md Phase 3 acceptance gate.

---

## Self-Check: PASSED

- app/api/clarify/route.ts: FOUND
- components/wizard/DisambiguationDialog.tsx: FOUND
- __tests__/DisambiguationDialog.test.tsx: FOUND
- commit 553614c (Task 1): FOUND
- commit de67097 (Task 2): FOUND
- commit 1697caa (Task 3): FOUND
