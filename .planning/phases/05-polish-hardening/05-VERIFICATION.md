---
phase: 05-polish-hardening
verified: 2026-05-14T08:53:00Z
status: human_needed
score: 9/9
overrides_applied: 0
human_verification:
  - test: "On phone with notch/Dynamic Island (e.g. iPhone 14 Pro), open the app and reach AssignItemsStep. Check that the bottom CTA row clears the home indicator — no content is clipped by the notch."
    expected: "The env(safe-area-inset-bottom) inset is non-zero and the sticky footer sits above the system gesture bar."
    why_human: "viewportFit: 'cover' effect requires a real iOS device or accurate simulator; cannot verify CSS env() resolution programmatically."
  - test: "On a mobile browser, reach AddItemsStep and check below the 'Scan bill' button."
    expected: "The text 'Allow camera access if prompted.' is visible in zinc-500 style below the scan button."
    why_human: "Static text rendering and visual appearance require human eyes on device."
  - test: "Complete a bill split with multiple people, reach ResultsStep, and tap 'Copy summary'."
    expected: "Clipboard receives one line per person in format '[Name] owes $X.XX', followed by 'Total: $X.XX'. Button label changes to 'Copied!' with a check icon for ~2 seconds, then reverts to 'Copy summary'."
    why_human: "Real clipboard interaction requires a browser context; label timing revert needs visual confirmation."
  - test: "On AssignItemsStep, leave at least one item unassigned and tap 'See results'."
    expected: "A blocking dialog appears listing the unassigned item(s) by name. Tapping 'Go back to assign them' closes the dialog and stays on the step. Tapping 'Continue anyway' navigates to the results screen."
    why_human: "Dialog rendering and navigation behavior require a running browser to confirm the full flow."
  - test: "In a guest claiming session (/split/[sessionId]), simulate a network failure (devtools offline) and tap an item card."
    expected: "The optimistic check mark disappears and the inline label 'Couldn't save — tap to retry' appears on that item only. Going back online and tapping again clears the error."
    why_human: "Network-failure simulation requires browser devtools and a live Upstash session."
  - test: "In a guest claiming session, simulate network failure and tap 'I'm done'."
    expected: "The text 'Couldn't submit — tap to retry' appears above the 'I'm done' button in the bottom bar."
    why_human: "Same as above — requires live session and network manipulation."
---

# Phase 5: Polish & Hardening — Verification Report

**Phase Goal:** As a dinner host using the app on my phone, I want to be warned before I accidentally finalize a bill that still has unassigned items, and I want to be able to share a plain-text summary to the group chat, so that nobody is left out and everyone knows what they owe.
**Verified:** 2026-05-14T08:53:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | App warns user if any items remain unassigned before showing final totals screen | VERIFIED | `handleContinue()` in `AssignItemsStep.tsx` filters items with no assignees; blocking dialog rendered with `showUnassignedDialog` state; 5 new tests all pass |
| 2 | Dialog lists unassigned items by name, has primary 'Go back' and secondary destructive 'Continue anyway' buttons | VERIFIED | Dialog renders `{unassignedItems.map((i) => i.name).join(', ')}` in DialogDescription; both buttons present with correct onClick handlers at lines 161–169 |
| 3 | When all items assigned, 'See results' navigates to step 5 with no dialog | VERIFIED | `handleContinue()` calls `setStep(5)` directly when `unassigned.length === 0`; test confirms step becomes 5 and dialog is null |
| 4 | User can copy a plain-text totals summary to clipboard | VERIFIED | `handleCopy()` in `ResultsStep.tsx` calls `navigator.clipboard.writeText` with per-person lines + Total line; wired to 'Copy summary' button onClick |
| 5 | Button label swaps to 'Copied!' for ~2s then reverts | VERIFIED | `setCopied(true)` + `setTimeout(() => setCopied(false), 2000)` in `handleCopy()`; `{copied ? <>Check Copied!</> : <>Copy Copy summary</>}` conditional in JSX |
| 6 | User can tap 'Start over' to reset the bill | VERIFIED | `const reset = useBillStore((s) => s.reset)` wired to `onClick={reset}` on Start over button; test confirms `people.length === 0` after click |
| 7 | Camera-guidance text 'Allow camera access if prompted.' is visible below the Scan bill button | VERIFIED | `<p className="text-sm text-zinc-500">Allow camera access if prompted.</p>` at AddItemsStep line 248, inside same `ocrStatus` gate as the button |
| 8 | All error states show clear recovery messages (ShareLinkButton, guest claim, guest done) | VERIFIED | ShareLinkButton: `setSessionError("Couldn't create session. Try again.")` in catch, rendered as inline span; GuestClaimingView: `setItemErrors` on /claim failure, `setDoneError("Couldn't submit — tap to retry")` on /done failure; ClaimableItemCard renders `Couldn&apos;t save — tap to retry` when `hasError` is true |
| 9 | iOS viewport-fit=cover enables env(safe-area-inset-bottom) on notch devices | VERIFIED | `export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }` in `app/layout.tsx` lines 14–18 |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/layout.tsx` | Viewport export with `viewportFit: 'cover'` | VERIFIED | Lines 14–18: `export const viewport: Viewport = { ... viewportFit: 'cover' }` |
| `components/wizard/AssignItemsStep.tsx` | Unassigned-item warning dialog + `handleContinue` | VERIFIED | `handleContinue` at line 38, `showUnassignedDialog` state at line 27, Dialog at lines 149–172 |
| `components/wizard/AddItemsStep.tsx` | Static camera guidance text | VERIFIED | Literal `Allow camera access if prompted.` at line 248 |
| `components/wizard/ResultsStep.tsx` | Copy summary + Start over buttons | VERIFIED | Both buttons in fixed bottom strip at lines 216–241 |
| `components/wizard/ShareLinkButton.tsx` | Inline error replacing toast | VERIFIED | `setSessionError` state (3 occurrences); no Toast import; error span at lines 56–58 |
| `app/split/[sessionId]/GuestClaimingView.tsx` | Per-item error + done-bar error | VERIFIED | `itemErrors` state, `setItemErrors` (3 occurrences), `doneError` state, `setDoneError` (3 occurrences) |
| `components/split/ClaimableItemCard.tsx` | `min-h-[44px]` touch target + `hasError` prop | VERIFIED | `min-h-[44px]` in Card className (line 42); `hasError` in interface, destructure, and conditional render |
| `vitest.setup.ts` | `navigator.clipboard.writeText` mock | VERIFIED | Lines 21–23: `(navigator as { clipboard?: unknown }).clipboard = { writeText: vi.fn()... }` |
| `__tests__/GuestClaimingView.test.tsx` | D-08 and D-09 test coverage | VERIFIED | File exists; 2 tests (D-08 item error revert, D-09 done bar error); both pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AssignItemsStep` 'See results' onClick | `handleContinue()` which guards navigation | `items.filter(item => !assignments[item.id] \|\| assignments[item.id].length === 0)` | WIRED | `onClick={handleContinue}` confirmed; guard logic present in function body |
| Dialog 'Continue anyway' onClick | `setStep(5)` | `setShowUnassignedDialog(false); setStep(5)` | WIRED | Line 166: `onClick={() => { setShowUnassignedDialog(false); setStep(5) }}` |
| `ResultsStep` 'Copy summary' onClick | `navigator.clipboard.writeText` | `handleCopy()` via `useBillStore.getState()` + `computePersonTotals` + `formatCents` | WIRED | `onClick={handleCopy}` wired; `navigator.clipboard.writeText(lines.join('\n'))` at line 72 |
| `ShareLinkButton` catch block | `setSessionError(...)` | `useState<string \| null>` | WIRED | `setSessionError("Couldn't create session. Try again.")` at line 41; no `toastManager` reference anywhere |
| `GuestClaimingView` handleItemTap catch | `setItemErrors(...)` | `useState<Record<string, boolean>>` | WIRED | Line 94: `setItemErrors((prev) => ({ ...prev, [itemId]: true }))` |
| `GuestClaimingView` handleDone catch | `setDoneError(...)` | `useState<string \| null>` | WIRED | Line 110: `setDoneError("Couldn't submit — tap to retry")` |
| `ClaimableItemCard` `hasError` prop | Inline span rendering error text | Card child JSX | WIRED | Line 75–77: `{hasError && <span>Couldn&apos;t save — tap to retry</span>}` |
| `app/layout.tsx` viewport export | Browser viewport meta with `viewport-fit=cover` | Next.js `generate-viewport` convention | WIRED | `export const viewport: Viewport` at line 14; Next.js 15 handles meta tag generation |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `ResultsStep.tsx` Copy summary | `people`, `items`, `assignments`, `tipPercent` | `useBillStore.getState()` snapshot at click time | Yes — live Zustand store state | FLOWING |
| `AssignItemsStep.tsx` Dialog | `unassignedItems` | `useBillStore.getState()` in `handleContinue()`, filtered from `storeItems` | Yes — live store items | FLOWING |
| `ClaimableItemCard.tsx` error label | `hasError` prop | `!!itemErrors[item.id]` passed from `GuestClaimingView` | Yes — error state from catch block | FLOWING |
| `GuestClaimingView.tsx` done error | `doneError` state | Set in `handleDone` catch block | Yes — set on real fetch failure | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npm test -- --run` | 212 tests, 23 files, 0 failures | PASS |
| AssignItemsStep ITEMS-04 tests | `npm test -- --run AssignItemsStep` | 17 tests pass (12 pre-existing + 5 new) | PASS |
| ResultsStep copy tests | `npm test -- --run ResultsStep` | Included in 212 total (4 new tests) | PASS |
| ShareLinkButton inline error tests | `npm test -- --run ShareLinkButton` | Included in 212 total | PASS |
| GuestClaimingView D-08/D-09 tests | `npm test -- --run GuestClaimingView` | 2 tests pass | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ITEMS-04 | 05-01-PLAN.md | App warns user if items remain unassigned before finalizing | SATISFIED | `handleContinue()` guard in `AssignItemsStep.tsx`; 5 passing tests confirm all paths |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `vitest.setup.ts` | 13–15 | TODO comment re `@testing-library/jest-dom` | Info | Pre-existing; out of scope for Phase 5; no functional impact |

No blockers or warnings found. The one TODO is pre-existing and explicitly noted as out of scope in 05-02-SUMMARY.md.

---

### Human Verification Required

#### 1. iOS Safe-Area Inset Behavior

**Test:** On an iPhone with notch or Dynamic Island (e.g. iPhone 14 Pro), open the app in Safari. Navigate to AssignItemsStep and observe the sticky bottom CTA row.
**Expected:** The row sits above the home indicator; no content is clipped. The `env(safe-area-inset-bottom)` CSS value is non-zero, proving `viewportFit: 'cover'` took effect.
**Why human:** CSS `env()` resolution requires a real device or accurate iOS Simulator; cannot be confirmed via grep or Node-based tests.

#### 2. Camera Guidance Text Appearance

**Test:** Open the app on a mobile browser. On AddItemsStep, confirm the text below the Scan bill button.
**Expected:** The text `Allow camera access if prompted.` appears in muted zinc-500 styling directly below the scan button and disappears once a scan is completed.
**Why human:** Visual rendering and conditional display based on `ocrStatus` require a running browser.

#### 3. Copy Summary End-to-End

**Test:** Complete a full bill split with at least two people. Reach ResultsStep. Tap 'Copy summary'. Paste into a notes app or text editor.
**Expected:** Each person appears as `[Name] owes $X.XX` on its own line, with a final `Total: $X.XX` line. The button shows `Copied!` for ~2 seconds then returns to `Copy summary`.
**Why human:** Real clipboard write + paste verification requires a browser context; timer animation requires visual confirmation.

#### 4. Unassigned-Item Warning Dialog (Full Flow)

**Test:** Add two items, assign only one, then tap 'See results' in AssignItemsStep.
**Expected:** Blocking dialog appears listing the unassigned item by name. 'Go back to assign them' closes dialog without navigating. 'Continue anyway' navigates to results.
**Why human:** Dialog rendering and navigation require a running app; the ✗ button must be absent (showCloseButton={false}).

#### 5. Guest Claim Error — Per-Item Inline Label

**Test:** Open a shared link (/split/[sessionId]) as a guest. Select a person. Enable browser devtools offline mode. Tap an item card.
**Expected:** The optimistic check mark disappears; `Couldn't save — tap to retry` appears below the item name on that card only. Re-enabling network and tapping again clears the label and the claim sticks.
**Why human:** Requires a live Upstash Redis session and browser devtools network manipulation.

#### 6. Guest Done Error — Done Bar Inline Message

**Test:** Same setup as above. With offline mode active, tap 'I'm done'.
**Expected:** `Couldn't submit — tap to retry` appears above the 'I'm done' button in the bottom bar. The button remains tappable for retry.
**Why human:** Same as test 5 — live session and network manipulation required.

---

### Gaps Summary

No gaps found. All 9 observable truths are VERIFIED with codebase evidence. All artifacts exist, are substantive, are wired, and have data flowing through them. The full test suite passes with 212 tests across 23 files.

The 6 human verification items cover mobile device behavior (iOS safe-area insets), visual rendering, real clipboard API interaction, and network-failure simulation — none of which can be confirmed programmatically from source code alone.

---

_Verified: 2026-05-14T08:53:00Z_
_Verifier: Claude (gsd-verifier)_
