---
phase: 09-bill-view-redesign-identity-modal
plan: "03"
subsystem: identity-modal
tags: [identity, modal, dialog, tdd, persona-selection]
dependency_graph:
  requires: []
  provides: [IdentityModal, PersonSlotPicker-modal-ready]
  affects: [components/split/CollaborativeClaimingView.tsx]
tech_stack:
  added: []
  patterns: [controlled-Dialog, dismiss-block, TDD-red-green, inline-add-form]
key_files:
  created:
    - components/split/IdentityModal.tsx
    - __tests__/IdentityModal.test.tsx
  modified:
    - components/split/PersonSlotPicker.tsx
    - __tests__/PersonSlotPicker.test.tsx
decisions:
  - opacity-50 (not opacity-40) is the ground-truth class per PersonSlotPicker.test.tsx Test 2
  - PersonSlotPicker heading/subtext removed — IdentityModal owns the Dialog header; picker is pure content
  - IdentityModal uses key-based reset (openKey) instead of clearing state imperatively for inline-add form
  - dismiss-block implemented in onOpenChange handler — blocks when !nextOpen && !allowClose
metrics:
  duration: "2m 16s"
  completed: "2026-06-06T20:45:19Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 09 Plan 03: IdentityModal + PersonSlotPicker Refactor Summary

Refactored PersonSlotPicker into modal-ready content and created IdentityModal — a Dialog wrapper with "Who are you?" heading, controlled dismiss-block/allow semantics, and an "I'm not listed" inline add form. All 14 tests pass (9 PersonSlotPicker + 5 IdentityModal).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (TDD) | Refactor PersonSlotPicker to modal content + onAddPerson inline form + opacity-50 fix | 4e689fd (RED: 51a9aaf) | `components/split/PersonSlotPicker.tsx`, `__tests__/PersonSlotPicker.test.tsx` |
| 2 (TDD) | Create IdentityModal Dialog wrapper + behavioral tests | d9b024e (RED: 181071b) | `components/split/IdentityModal.tsx`, `__tests__/IdentityModal.test.tsx` |

## What Was Built

**PersonSlotPicker.tsx** (refactored):
- Fixed `opacity-40` → `opacity-50` on taken-name cards (test ground truth, D-01)
- Removed outer page layout wrapper (`px-6 py-8` with heading/subtext) — component is now pure modal content (grid + add form)
- Added `onAddPerson?: (name: string) => Promise<void>` prop
- Added "I'm not listed" text link (`text-[14px] text-amber-600 underline`) below the grid
- Clicking link reveals `<Input placeholder="Your name" maxLength={50}>` and `<Button className="bg-amber-600 hover:bg-amber-700">Add me</Button>`
- Guard: trims input; ignores empty/whitespace-only names before calling `onAddPerson`

**IdentityModal.tsx** (new):
- `'use client'` Dialog wrapper with props: `open`, `allowClose`, `session`, `onSelect`, `onAddPerson`, `onOpenChange`
- `DialogContent showCloseButton={allowClose}` — close-X absent on first-time identity prompt
- `onOpenChange` handler blocks dismiss when `!nextOpen && !allowClose` (initial identity case)
- DialogHeader: `DialogTitle` "Who are you?" + `DialogDescription` "Pick your name from the list below."
- Renders `<PersonSlotPicker key={openKey} ...>` — `openKey` increments on every open, clearing inline-add form state

## TDD Gate Compliance

Both tasks followed RED/GREEN flow:

| Gate | Task 1 | Task 2 |
|------|--------|--------|
| RED (test commit) | 51a9aaf | 181071b |
| GREEN (feat commit) | 4e689fd | d9b024e |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

**Files exist:**
- `components/split/PersonSlotPicker.tsx` — FOUND
- `components/split/IdentityModal.tsx` — FOUND
- `__tests__/PersonSlotPicker.test.tsx` — FOUND
- `__tests__/IdentityModal.test.tsx` — FOUND

**Commits exist:**
- 51a9aaf (RED: PersonSlotPicker tests) — FOUND
- 4e689fd (GREEN: PersonSlotPicker implementation) — FOUND
- 181071b (RED: IdentityModal tests) — FOUND
- d9b024e (GREEN: IdentityModal implementation) — FOUND

**Test results:** 14/14 passing (`npx vitest run __tests__/PersonSlotPicker.test.tsx __tests__/IdentityModal.test.tsx`)

**Acceptance criteria:**
- `grep -c "opacity-40" PersonSlotPicker.tsx` → 0 (confirmed)
- `grep -n "onAddPerson" PersonSlotPicker.tsx` → prop declaration + call site (confirmed)
- `grep -n "Who are you?" IdentityModal.tsx` → DialogTitle line 60 (confirmed)
- `grep -n "showCloseButton={allowClose}" IdentityModal.tsx` → line 57 (confirmed)
- `npx tsc --noEmit` → no errors in new files (confirmed)
