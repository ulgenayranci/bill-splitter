# Phase 5: Polish & Hardening - Research

**Researched:** 2026-05-13
**Domain:** React component hardening, clipboard API, mobile safe area insets, error state UX, dialog patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Unassigned item warning is a blocking dialog using `components/ui/dialog.tsx`. Lists specific item names.
- **D-02:** Dialog offers two actions: primary "Go back to assign them" and secondary destructive "Continue anyway".
- **D-03:** Copy button lives as full-width CTA at the bottom of `ResultsStep`, alongside "Start over" (to be added).
- **D-04:** Clipboard text format is totals-only: one line per person (`"[Name] owes $X.XX"`), plus a total at the bottom. No itemized breakdown.
- **D-05:** Confirmation is a button label swap: "Copy summary" → "Copied!" for 2 seconds, then reverts. No toast.
- **D-06:** Camera permission guidance: static text below scan button in `AddItemsStep`: "Allow camera access if prompted." No JS detection.
- **D-07:** Session creation failure in `ShareLinkButton`: inline error text under button instead of current console.error + toast.
- **D-08:** Guest claim/un-claim errors: optimistic update + revert on failure, with inline "Couldn't save — tap to retry" label on affected item row.
- **D-09:** "I'm done" fetch in `GuestClaimingView`: wrap in try/catch, show inline error on "I'm done" bar if the network call fails.
- **D-10:** Fix safe area insets on all sticky footers using `env(safe-area-inset-bottom)`.
- **D-11:** Keyboard push behavior: let browser handle it. No custom scroll logic unless testing reveals a problem.
- **D-12:** Touch target audit: all interactive elements must meet 44×44px minimum (Apple HIG).

### Claude's Discretion

- CSS implementation of safe area insets (utility class vs inline style vs Tailwind plugin)
- Exact wording and visual treatment of inline error messages (D-07, D-08, D-09)
- Whether the copy button shows a clipboard icon alongside the label

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITEMS-04 | App warns user if items remain unassigned before finalizing | D-01/D-02 implement this: unassigned check in `AssignItemsStep` before `setStep(5)`, blocking dialog using existing `dialog.tsx` listing item names |
</phase_requirements>

---

## Summary

Phase 5 is a pure hardening phase — no new architectural concepts, all work is additive changes to six existing files. Every required component and utility already exists in the codebase. The work decomposes cleanly into three delivery areas: (1) unassigned-item warning dialog, (2) copy-to-clipboard summary, and (3) three error-state fills plus mobile polish.

The clipboard pattern is already established in `HostWaitingScreen.tsx` (`navigator.clipboard.writeText` + 2-second label-swap via `useState`). The dialog pattern is already established in `AddItemsStep.tsx` (remove-confirmation Dialog). The inline error pattern (`text-red-600 text-sm`) is already established in the price input fields. All three Phase 5 features can be implemented by following existing patterns without introducing new dependencies.

The one gap that needs a Wave 0 fix: `app/layout.tsx` exports no `viewport` metadata, which means `viewport-fit=cover` is missing. Without it, `env(safe-area-inset-bottom)` silently returns `0` on iOS devices with Dynamic Island/home indicator. This must be added before D-10 safe area inset changes will have any effect on device.

**Primary recommendation:** Implement all changes as direct, minimal additions to existing files following established patterns. No new dependencies needed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Unassigned item warning dialog (D-01/D-02) | Frontend (client component) | — | Pure UI gate before step navigation; Zustand store already holds `items` and `assignments` |
| Copy summary to clipboard (D-03/D-04/D-05) | Browser (Navigator API) | Frontend computation | `computePersonTotals` runs on client; clipboard write is browser API |
| Camera permission guidance text (D-06) | Frontend (client component) | — | Static text rendered conditionally alongside existing scan button |
| Session creation inline error (D-07) | Frontend (client component) | — | `ShareLinkButton` already handles the fetch; error state is local component state |
| Guest claim optimistic revert + retry (D-08) | Frontend (client component) | — | Optimistic UI pattern already in place; add per-item error state |
| Guest done try/catch + inline error (D-09) | Frontend (client component) | — | `handleDone` already exists; wrap in try/catch, add local error state |
| Safe area insets (D-10) | Browser / CSS | Next.js layout | `viewport-fit=cover` is required in `<head>` via Next.js `viewport` export |
| Touch target audit (D-12) | Frontend CSS | — | Tailwind utility class additions only |

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React / Next.js | 19 / 15.x | Component rendering | [VERIFIED: package.json] |
| Zustand | 5.x | Bill state (`items`, `assignments`, `people`, `tipPercent`) | [VERIFIED: stores/useBillStore.ts] |
| `@base-ui/react/dialog` | installed | Blocking unassigned dialog | [VERIFIED: components/ui/dialog.tsx uses DialogPrimitive from @base-ui] |
| Tailwind CSS | 4.x | Styling all changes | [VERIFIED: app/globals.css] |
| `lib/billMath.ts` | n/a | `computePersonTotals`, `formatCents` for copy text | [VERIFIED: lib/billMath.ts] |
| Navigator Clipboard API | Browser native | Copy summary text | [VERIFIED: HostWaitingScreen.tsx uses `navigator.clipboard.writeText`] |
| Vitest + jsdom | 4.x | Test framework | [VERIFIED: vitest.config.mts, package.json] |

**No new npm installs required for Phase 5.**

---

## Architecture Patterns

### System Architecture Diagram

```
User taps "See results" in AssignItemsStep
           │
           ▼
  ┌─────────────────────────┐
  │  Unassigned item check  │
  │  items.filter(unassigned)│
  └────────────┬────────────┘
               │
    ┌──────────┴──────────┐
    │ any unassigned?     │
    │                     │
   YES                    NO
    │                     │
    ▼                     ▼
  Dialog (D-01)       setStep(5)
  ├── "Go back"     ResultsStep
  └── "Continue"         │
                         ▼
              Copy Summary Button (D-03)
              computePersonTotals() →
              format text → clipboard.writeText()
              label swap: "Copy summary" → "Copied!"
```

```
GuestClaimingView error states
  handleItemTap():
    setOptimisticClaims(newClaim) ──────────────────► render
    fetch /api/session/.../claim
      ├── success: mutate(swrKey)
      └── catch: revert optimistic + set perItemError[itemId] ► inline label

  handleDone():
    fetch /api/session/.../done
      ├── success: mutate(swrKey)
      └── catch: setDoneError("Couldn't submit — tap to retry")
               ► inline error on done bar
```

### Recommended Project Structure (no new folders)

All changes are in-place modifications to existing files:

```
components/wizard/
├── AssignItemsStep.tsx    ← Add: unassigned check + Dialog (D-01/D-02)
├── ResultsStep.tsx        ← Add: copy summary button + Start over button (D-03/D-04/D-05)
├── AddItemsStep.tsx       ← Add: camera guidance text (D-06)
└── ShareLinkButton.tsx    ← Replace toast with inline error (D-07)

app/split/[sessionId]/
└── GuestClaimingView.tsx  ← Add: per-item error state, done try/catch (D-08/D-09)

app/
└── layout.tsx             ← Add: viewport export with viewportFit:'cover' (D-10 prerequisite)
```

### Pattern 1: Unassigned Item Dialog (D-01/D-02)

The existing remove-confirmation dialog in `AddItemsStep` is the canonical model. Replicate the same `Dialog` + `useState` pattern:

```typescript
// Source: VERIFIED from components/wizard/AddItemsStep.tsx + components/ui/dialog.tsx
const [showUnassignedDialog, setShowUnassignedDialog] = useState(false)
const [unassignedItems, setUnassignedItems] = useState<Item[]>([])

function handleContinue() {
  const unassigned = items.filter(
    (item) => !assignments[item.id] || assignments[item.id].length === 0
  )
  if (unassigned.length > 0) {
    setUnassignedItems(unassigned)
    setShowUnassignedDialog(true)
  } else {
    setStep(5)
  }
}

// Dialog usage pattern — identical to remove-confirmation dialog:
<Dialog open={showUnassignedDialog} onOpenChange={setShowUnassignedDialog}>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>Some items aren't assigned</DialogTitle>
      <DialogDescription>
        These items have no one assigned: {unassignedItems.map(i => i.name).join(', ')}
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button onClick={() => setShowUnassignedDialog(false)}>
        Go back to assign them
      </Button>
      <Button variant="destructive" onClick={() => { setShowUnassignedDialog(false); setStep(5) }}>
        Continue anyway
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Important:** `AssignItemsStep` currently navigates to step 5 via "See results" button (line 115). The "Continue anyway" in the dialog is also `setStep(5)`. The "Go back" simply closes the dialog. The existing `ShareLinkButton` already on the page is the separate share path and does not need guarding.

### Pattern 2: Copy Summary Button (D-03/D-04/D-05)

The canonical model is `HostWaitingScreen.tsx` lines 23 and 42-49:

```typescript
// Source: VERIFIED from components/wizard/HostWaitingScreen.tsx
const [copied, setCopied] = useState(false)

async function handleCopy() {
  try {
    const { people, items, assignments, tipPercent } = useBillStore.getState()
    const totals = computePersonTotals(people, items, assignments, tipPercent)
    const subtotal = computeSubtotalCents(items)
    const tip = computeTipCents(subtotal, tipPercent)
    const lines = people.map(
      (p) => `${p.name} owes ${formatCents(totals[p.id] ?? 0)}`
    )
    lines.push(`Total: ${formatCents(subtotal + tip)}`)
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  } catch {
    // Silent fallback — clipboard access denied is non-critical
  }
}
```

The silent-catch pattern from `HostWaitingScreen` is intentional (clipboard permission denials are non-fatal). The copy button itself uses `variant="outline"` (secondary style per D-05 guidance in CONTEXT.md).

### Pattern 3: Inline Error State (D-07, D-08, D-09)

The canonical model is the existing `priceError` display in `AddItemsStep.tsx`:

```typescript
// Source: VERIFIED from components/wizard/AddItemsStep.tsx lines 287-289
{editState!.priceError && (
  <span id="edit-price-error" className="text-red-600 text-sm">{editState!.priceError}</span>
)}
```

All three inline errors (D-07, D-08, D-09) should use this same `text-red-600 text-sm` pattern. No new color tokens needed.

**D-07 — ShareLinkButton change:** Replace the `toastManager.add(...)` call in the catch block with:
1. Local state: `const [sessionError, setSessionError] = useState<string | null>(null)`
2. On catch: `setSessionError("Couldn't create session. Try again.")`
3. On success: `setSessionError(null)` before `setStep(5)`
4. Render: `{sessionError && <span className="mt-1 text-red-600 text-sm">{sessionError}</span>}`

**Note:** The `Toast.useToastManager()` import in ShareLinkButton can be removed when replacing with inline error, but the `Toast.Provider` wrapping in `app/providers.tsx` must remain (other components like `AddItemsStep` still use it).

**D-08 — per-item error in GuestClaimingView:**

```typescript
// Source: VERIFIED from app/split/[sessionId]/GuestClaimingView.tsx
const [itemErrors, setItemErrors] = useState<Record<ItemId, boolean>>({})

// In handleItemTap catch:
catch {
  setOptimisticClaims((prev) => { const next = { ...prev }; delete next[itemId]; return next })
  setItemErrors((prev) => ({ ...prev, [itemId]: true }))
}
```

Pass `hasError={!!itemErrors[item.id]}` to `ClaimableItemCard` and render the inline label there.

**D-09 — done error:**
```typescript
const [doneError, setDoneError] = useState<string | null>(null)

async function handleDone() {
  if (!selectedPersonId) return
  try {
    await fetch(...)
    await mutate(swrKey)
  } catch {
    setDoneError("Couldn't submit — tap to retry")
  }
}
```

Render `{doneError && <p className="mt-1 text-center text-sm text-red-600">{doneError}</p>}` inside the fixed done bar, above the button.

### Pattern 4: Safe Area Insets + viewport-fit=cover (D-10)

**Critical gap:** `app/layout.tsx` currently exports only `metadata` with no `viewport` export. `env(safe-area-inset-bottom)` silently returns `0` on iOS unless `viewport-fit=cover` is declared.

```typescript
// Source: CITED from https://nextjs.org/docs/app/api-reference/functions/generate-viewport
// Add to app/layout.tsx alongside existing metadata export:
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
```

The `viewportFit: 'cover'` property maps to `viewport-fit=cover` in the rendered `<meta>` tag. [CITED: nextjs.org/docs/app/api-reference/functions/generate-viewport]

**Existing inline style pattern (already correct for all footers):**
```typescript
// Source: VERIFIED from multiple existing components
style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
```

This fallback value (`16px`) is already used consistently. The only fix needed is adding `viewportFit: 'cover'` to layout — the `env()` calls themselves are already present in all sticky footers.

**Files that already have safe-area inline styles (verified):**
- `AssignItemsStep.tsx` — bottom CTA div
- `ResultsStep.tsx` — fixed bottom strip
- `GuestClaimingView.tsx` — fixed done bar
- `SetTipStep.tsx`, `HostWaitingScreen.tsx`, `AddPeopleStep.tsx`, `AddItemsStep.tsx`

### Pattern 5: Touch Target Audit (D-12)

**Current state of priority targets (verified by code reading):**

| Target | Current Size | 44px Min? | Fix Needed |
|--------|-------------|-----------|------------|
| Person chips in `AssignItemsStep` | `h-10 w-10` (40px) + `min-h-12 min-w-12` | YES via min-h/min-w | None — already has min-h-12 (48px) |
| Item rows in `ClaimableItemCard` | `px-4 py-3` Card | implicit via Card height | Add `min-h-[44px]` to Card className |
| "I'm done" button in `GuestClaimingView` | `h-12 w-full` (48px) | YES | None needed |
| Trash icon buttons in `AddItemsStep` | `h-12 w-12` (48px) | YES | None needed |
| Confirm checkmark buttons | `h-12 w-12` (48px) | YES | None needed |

The person chips already satisfy the 44px minimum via `min-h-12 min-w-12` (48px). The primary gap is `ClaimableItemCard`: the `Card` has no explicit minimum height — `py-3` (24px) + content makes it approximately 48-52px in practice, but adding `min-h-[44px]` explicitly is the correct defensive fix.

### Anti-Patterns to Avoid

- **Toast for inline errors (D-07, D-08, D-09):** CONTEXT.md explicitly requires inline errors, not toasts. The existing toast infrastructure is NOT the pattern here.
- **Blocking all navigation when unassigned (D-02):** The "Continue anyway" escape hatch is required. A hard block with no override would conflict with the "no dead ends" design principle from Phase 4.
- **Using `metadata.viewport` instead of `export const viewport`:** Next.js 15 deprecates `metadata.viewport`; the dedicated `viewport` export is required. [CITED: nextjs.org/docs/messages/no-document-viewport-meta]
- **Storing computed copy text in Zustand:** Text is derived from existing store state — compute it at copy time, never store it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blocking dialog | Custom modal/overlay | `components/ui/dialog.tsx` (already installed) | Radix/base-ui dialog handles focus trap, keyboard dismiss, scroll lock automatically |
| Clipboard write | `document.execCommand('copy')` | `navigator.clipboard.writeText()` | `execCommand` is deprecated; Async Clipboard API is the standard |
| Safe area insets | JavaScript geometry calculations | CSS `env(safe-area-inset-bottom)` | Browser provides this as CSS env variable; JS polling is fragile |
| Copy confirmation | Toast | `useState` label swap (pattern already in `HostWaitingScreen`) | Per D-05; already has a working model in the codebase |

---

## Common Pitfalls

### Pitfall 1: viewport-fit=cover Not Declared
**What goes wrong:** `env(safe-area-inset-bottom)` returns `0` on iOS (Safari WebKit). All the inline style additions in components have no effect. The home indicator clips the bottom buttons.
**Why it happens:** WebKit only exposes safe area env variables when the page opts into `viewport-fit=cover`.
**How to avoid:** Add `export const viewport: Viewport = { viewportFit: 'cover' }` to `app/layout.tsx` before any inset testing.
**Warning signs:** If you add safe area insets but the bottom bar still clips on iPhone, this is the cause.

### Pitfall 2: Dialog Close Button Collides With Footer Buttons
**What goes wrong:** `DialogContent` defaults to `showCloseButton={true}`, which renders an ×-button in the top-right. For the unassigned warning dialog, we want ONLY the two footer buttons (no ×).
**Why it happens:** The `DialogContent` component in this project accepts `showCloseButton` prop; default is `true`.
**How to avoid:** Pass `showCloseButton={false}` on the unassigned warning `DialogContent` (per D-02: the dialog should force a choice between two explicit actions).

### Pitfall 3: Clipboard API Not Available in jsdom Tests
**What goes wrong:** `navigator.clipboard.writeText` is undefined in jsdom; tests crash with `TypeError: Cannot read properties of undefined`.
**Why it happens:** jsdom does not implement the Clipboard API.
**How to avoid:** Add a `navigator.clipboard` mock to `vitest.setup.ts`:
```typescript
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
})
```
[VERIFIED: pattern from web search cross-referenced with existing `URL.createObjectURL` mock in vitest.setup.ts — same technique]

### Pitfall 4: AssignItemsStep "See results" vs ShareLinkButton Both Navigate
**What goes wrong:** The unassigned guard should only intercept "See results" (→ step 5). The `ShareLinkButton` (which also navigates to step 5 via a different path through session creation) must NOT be guarded — it's the sharing path, not the direct-results path.
**Why it happens:** Both live in the same component and both end at step 5.
**How to avoid:** Attach the unassigned check only to the "See results" button's `onClick`, not to `ShareLinkButton`. `ShareLinkButton` has its own `handleShare()` logic.

### Pitfall 5: ShareLinkButton Toast Import After D-07
**What goes wrong:** After replacing the toast call with inline error state, the `Toast.useToastManager()` call at the top of `ShareLinkButton` becomes orphaned. It won't cause a runtime error (the hook still works outside a Toast.Provider context in newer @base-ui), but it's dead code.
**Why it happens:** The hook import was added for error handling that is now replaced.
**How to avoid:** Remove `Toast.useToastManager()` and its import from `ShareLinkButton` once D-07 is implemented. Keep `app/providers.tsx` — other components still need the provider.

### Pitfall 6: `computePersonTotals` Signature
**What goes wrong:** Using `useBillStore((s) => s)` to get state in the copy handler causes unnecessary re-renders.
**Why it happens:** Selecting the full store is a Zustand anti-pattern.
**How to avoid:** Use `useBillStore.getState()` at copy time (same pattern as `ShareLinkButton`'s `handleShare()`):
```typescript
const { people, items, assignments, tipPercent } = useBillStore.getState()
```
[VERIFIED: ShareLinkButton.tsx line 25 uses this exact pattern]

---

## Code Examples

### Viewport Export (D-10 prerequisite)
```typescript
// Source: CITED from https://nextjs.org/docs/app/api-reference/functions/generate-viewport
// app/layout.tsx — add alongside existing metadata export
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
```

### Unassigned Check Logic
```typescript
// Source: VERIFIED from stores/useBillStore.ts (items, assignments shape)
const unassigned = items.filter(
  (item) => !assignments[item.id] || assignments[item.id].length === 0
)
```

### Copy Summary Text Generation
```typescript
// Source: VERIFIED from lib/billMath.ts (computePersonTotals, formatCents signatures)
const totals = computePersonTotals(people, items, assignments, tipPercent)
const subtotal = computeSubtotalCents(items)
const tip = computeTipCents(subtotal, tipPercent)
const lines = [
  ...people.map((p) => `${p.name} owes ${formatCents(totals[p.id] ?? 0)}`),
  `Total: ${formatCents(subtotal + tip)}`,
]
await navigator.clipboard.writeText(lines.join('\n'))
```

### Clipboard Mock for vitest.setup.ts
```typescript
// Source: VERIFIED pattern — matches existing URL mock in vitest.setup.ts
;(navigator as { clipboard?: unknown }).clipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
}
```

---

## Runtime State Inventory

Step 2.5 SKIPPED — Phase 5 contains no renames, refactors, or migrations. All changes are additive UI modifications.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner | YES | v24.15.0 | — |
| npm | Package management | YES | 11.12.1 | — |
| Vitest | Test framework | YES | ^4.1.5 [VERIFIED: package.json] | — |
| Navigator Clipboard API | D-03 copy feature | Browser only (not jsdom) | Browser native | Mock in vitest.setup.ts |
| `@base-ui/react/dialog` | D-01 dialog | YES [VERIFIED: dialog.tsx imports it] | installed | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `navigator.clipboard` in test environment: not available in jsdom → mock in `vitest.setup.ts` (no install needed).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run --reporter=verbose` |

**Current state:** 199 tests passing across 22 files. [VERIFIED: test run 2026-05-13]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITEMS-04 | Unassigned items trigger warning dialog before step 5 | unit | `npm test -- --run AssignItemsStep` | ✅ (extend existing) |
| D-02 | Dialog shows item names, has "Go back" and "Continue anyway" | unit | `npm test -- --run AssignItemsStep` | ✅ (extend existing) |
| D-03/D-04/D-05 | Copy button writes correct totals-only text, label swaps | unit | `npm test -- --run ResultsStep` | ✅ (extend existing) |
| D-07 | ShareLinkButton shows inline error on 500 | unit | `npm test -- --run ShareLinkButton` | ✅ (extend existing) |
| D-08 | Optimistic claim revert + inline label on network error | unit | `npm test -- --run GuestClaimingView` — NEW FILE | ❌ Wave 0 |
| D-09 | "I'm done" try/catch + inline error on done bar | unit | `npm test -- --run GuestClaimingView` — NEW FILE | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test -- --run --reporter=verbose`
- **Phase gate:** Full suite green (199+ tests) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `__tests__/GuestClaimingView.test.tsx` — covers D-08 (item error revert) and D-09 (done bar error). Currently no test file exists for GuestClaimingView.
- [ ] `vitest.setup.ts` — add `navigator.clipboard` mock (covers D-03 copy test).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | Phase 4 handles session lifecycle |
| V4 Access Control | No | — |
| V5 Input Validation | No | No new inputs introduced |
| V6 Cryptography | No | — |

No new security surface area in Phase 5. All changes are UI hardening only.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `viewportFit: 'cover'` is a valid property on the Next.js `Viewport` type | Safe Area Insets pattern | Would need to use `generateViewport()` function form instead — low risk, same effect |
| A2 | `ClaimableItemCard` `py-3` content renders at ≥44px in practice on real devices | Touch target audit | Some cards may clip on small text / small screen — mitigated by explicitly adding `min-h-[44px]` |

---

## Open Questions

1. **"Start over" button in ResultsStep**
   - What we know: D-03 says the copy button goes "alongside the existing 'Start over' button area"
   - What's unclear: There is currently NO "Start over" button in `ResultsStep.tsx`. The component only has "Back to tip" and a fixed bottom strip showing the total.
   - Recommendation: The copy button and a "Start over" (calls `reset()` from Zustand) should be added together to the fixed bottom strip alongside the existing total label — or as a second row below the total. Planner should clarify which location. Based on D-03 ("full-width CTA at the bottom"), placing it in the fixed bottom strip (or immediately above it) is the correct read.

2. **GuestClaimingView test file**
   - What we know: No `__tests__/GuestClaimingView.test.tsx` exists. The component uses `useSWR` and fetch mocks.
   - What's unclear: Whether Wave 0 should create a stub with only the D-08/D-09 tests, or also backfill basic rendering tests.
   - Recommendation: Create the file with focused D-08 and D-09 tests only. Backfill is out of scope.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `components/ui/dialog.tsx` — verified Dialog primitive and props (`showCloseButton`, `DialogFooter`)
- Codebase: `components/wizard/HostWaitingScreen.tsx` — verified clipboard pattern and label-swap pattern
- Codebase: `components/wizard/AssignItemsStep.tsx` — verified existing navigation structure and touch target sizing
- Codebase: `components/wizard/ResultsStep.tsx` — verified existing layout and missing "Start over" button
- Codebase: `app/split/[sessionId]/GuestClaimingView.tsx` — verified existing optimistic UI pattern and silent catch blocks
- Codebase: `stores/useBillStore.ts` — verified state shape for copy text computation
- Codebase: `lib/billMath.ts` — verified `computePersonTotals`, `formatCents`, `computeSubtotalCents`, `computeTipCents` signatures
- Codebase: `vitest.setup.ts` — verified existing mock pattern for `URL.createObjectURL`
- Context7 (`/vercel/next.js`): viewport export with `viewportFit: 'cover'` — [CITED: nextjs.org/docs/app/api-reference/functions/generate-viewport]

### Secondary (MEDIUM confidence)
- WebSearch: `navigator.clipboard` mock pattern in jsdom/vitest — cross-referenced with existing URL mock technique in codebase
- WebSearch: `viewport-fit=cover` required for `env(safe-area-inset-*)` to function on iOS WebKit — consistent across MDN, Next.js forum posts

### Tertiary (LOW confidence)
None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and source files
- Architecture: HIGH — all patterns verified in existing codebase; no new concepts
- Pitfalls: HIGH — identified directly from code reading (silent catch blocks, missing viewport export, clipboard jsdom gap)
- Open questions: LOW on "Start over" button — requires planner decision

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable stack, no fast-moving dependencies)
