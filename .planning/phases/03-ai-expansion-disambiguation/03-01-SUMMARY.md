---
phase: "03-ai-expansion-disambiguation"
plan: "01"
subsystem: "store, overlay, test-scaffolds"
tags: ["zustand", "store-extension", "tdd", "test-scaffolds", "wave-0"]
dependency_graph:
  requires: ["02-03 (OCR pipeline)"]
  provides: ["Item.confidence", "Item.rawName", "expandStatus", "setExpandStatus", "setItems", "OcrLoadingOverlay.message", "failing test scaffolds for Wave 1+2"]
  affects: ["stores/useBillStore.ts", "components/wizard/OcrLoadingOverlay.tsx", "__tests__/expandRoute.test.ts", "__tests__/clarifyRoute.test.ts", "__tests__/AddItemsStep.test.tsx"]
tech_stack:
  added: []
  patterns: ["TDD RED/GREEN", "Zustand store extension", "optional prop with default", "vi.mock dynamic import"]
key_files:
  created:
    - "__tests__/expandRoute.test.ts"
    - "__tests__/clarifyRoute.test.ts"
  modified:
    - "stores/useBillStore.ts"
    - "components/wizard/OcrLoadingOverlay.tsx"
    - "__tests__/useBillStore.test.ts"
    - "__tests__/OcrLoadingOverlay.test.tsx"
    - "__tests__/AddItemsStep.test.tsx"
decisions:
  - "updateItem clears confidence to 'high' — dismissal happens via save, not a separate 'reviewed' field (per 03-RESEARCH.md A2)"
  - "setItems batch-replaces items array (not addItem loop) to support atomic OCR expansion result loading"
  - "OcrLoadingOverlay message default = 'Scanning your bill…' exactly — verbatim copy from existing line to avoid U+2026 character mismatch"
  - "expandStatus field mirrors ocrStatus pattern in every way: union type, initial value, setter, INITIAL_STATE inclusion"
metrics:
  duration: "8 min"
  completed_date: "2026-05-10"
  tasks: 3
  files: 6
---

# Phase 03 Plan 01: Wave 0 Foundation — Store + Overlay + Test Scaffolds Summary

Contract foundation for Phase 3 AI expansion and disambiguation: Zustand store extended with Item confidence/rawName fields and expandStatus state, OcrLoadingOverlay accepts optional message prop, and 25 failing test scaffolds written that Wave 1+2 will drive to green.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Extend useBillStore — Item type, expandStatus, setItems, updateItem clears confidence | 24befad | GREEN |
| 2 | Add message prop to OcrLoadingOverlay (default preserves existing copy) | cc262c5 | GREEN |
| 3 | Write failing route + component test scaffolds for Wave 1 + Wave 2 | 416c392 | GREEN (scaffolds intentionally RED) |

## Final Item Interface Shape

```typescript
export interface Item {
  id: ItemId
  name: string
  priceCents: number
  rawName?: string                           // OCR abbreviation; undefined for manual items
  confidence?: 'high' | 'low' | 'ambiguous' // undefined treated as high (no badge)
}
```

## Final BillState Extensions

```typescript
expandStatus: 'idle' | 'loading' | 'done' | 'error'
setExpandStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void
setItems: (items: Item[]) => void
```

`setItems` was added (not an alternative chosen) — it batch-replaces the items array atomically after expansion completes, rather than calling `addItem` in a loop, which would fire multiple state updates.

`updateItem` was modified to clear confidence to `'high'` on every save, satisfying the D-07 Review badge dismissal contract.

## Test Counts

Wave 0 (store + overlay) — GREEN:
- `npx vitest run __tests__/useBillStore.test.ts` — 24 tests pass (19 Phase 1/2 + 5 Phase 3)
- `npx vitest run __tests__/OcrLoadingOverlay.test.tsx` — 5 tests pass (3 existing + 2 new)

Wave 1+2 scaffolds — intentionally RED:
- `__tests__/expandRoute.test.ts` — fails (no `/api/expand/route` yet — Plan 02 will fix)
- `__tests__/clarifyRoute.test.ts` — fails (no `/api/clarify/route` yet — Plan 03 will fix)
- `__tests__/AddItemsStep.test.tsx` (Phase 3 block) — 8 tests fail (disambiguation UI not yet built)

Full suite: 3 failed test files | 8 passed | 119 tests passing | 8 intentionally failing

## Deviations from Plan

### Minor Acceptance Criteria Mismatch

**Found during:** Task 1 verification
**Issue:** The plan acceptance criterion states `grep -c "expandStatus" stores/useBillStore.ts` returns at least 4. The plan's description listed "interface field + initial state + setter signature + setter implementation" as the 4 occurrences. However, `setExpandStatus` contains an uppercase E in "Expand" — so `grep "expandStatus"` (lowercase e) does NOT match `setExpandStatus` (uppercase E). The store correctly contains `expandStatus` on 3 lines (interface state field, INITIAL_STATE, setter body's `set({ expandStatus: status })`), while `setExpandStatus` appears on 2 additional lines.
**Fix:** None needed — the implementation is correct. All 24 store tests pass including the 5 Phase 3 tests. This is a documentation mismatch in the plan's grep criterion, not a bug.
**Files modified:** None (no fix needed)

## Known Stubs

None — this plan creates type extensions and test scaffolds only. No rendering stubs introduced.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. Production source changes are TypeScript-only (interface extensions and store actions). Test files are test-process-only.

## Self-Check

- [x] stores/useBillStore.ts — modified with Item.rawName, Item.confidence, expandStatus, setExpandStatus, setItems, updateItem clears confidence
- [x] components/wizard/OcrLoadingOverlay.tsx — modified with message prop
- [x] __tests__/useBillStore.test.ts — extended with 5 Phase 3 tests
- [x] __tests__/OcrLoadingOverlay.test.tsx — extended with 2 new tests
- [x] __tests__/expandRoute.test.ts — created with 8 RED scaffold tests
- [x] __tests__/clarifyRoute.test.ts — created with 7 RED scaffold tests
- [x] __tests__/AddItemsStep.test.tsx — extended with 10 RED Phase 3 tests
- [x] Commit 24befad exists (Task 1)
- [x] Commit cc262c5 exists (Task 2)
- [x] Commit 416c392 exists (Task 3)
