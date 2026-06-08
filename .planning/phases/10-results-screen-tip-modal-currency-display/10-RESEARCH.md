# Phase 10: Results Screen + Tip Modal + Currency Display - Research

**Researched:** 2026-06-08
**Domain:** React UI composition, Intl.NumberFormat currency formatting, shadcn Dialog, SWR mutation, Redis write path
**Confidence:** HIGH (all key claims verified against actual codebase + Node.js runtime)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** "Done" goes straight to Results — no mandatory tip step. Tip is optional "Add a tip?" button on Results that opens a Dialog. Remove linear `tip` phase (`claiming → results`, tip as Dialog overlay). (TIP-02)
- **D-02:** Tip is optional — Confirm always enabled even at $0.00. (Preset/custom mechanics, 100% cap = existing TipScreen logic, reused verbatim.)
- **D-03:** Grand "Total" row = bill items only (sum of all item prices). Does NOT fluctuate as people add tips. Anchors to printed receipt.
- **D-04:** Each person's item share sums to the grand Total. Tips are private per-person add-ons shown only on the current user's own card as "Your tip" / "Your total". Other people's cards show item share only.
- **D-05:** Tips are personal and quiet — a person's tip affects only their own "Your total" and is not surfaced to other participants.
- **D-06:** When currency is absent or unrecognized, default to USD fallback with a small inline "change" affordance opening a picker of common currencies (USD, EUR, GBP, JPY, AUD, CAD, CHF, CNY, INR). Include detected code in list even if not "common". No blocking UI.
- **D-07:** Currency is a session-level property (`currencyCode` on shared SessionPayload). A change must apply to the whole bill / all devices, not just locally.

### Claude's Discretion
- Exact currency list contents/order, whether the picker is a shadcn `select` vs. a small dialog list.
- Visual treatment of "Your total (incl. tip)" vs. grand bill Total so the distinction reads clearly.
- Whether "Edit" path reuses the existing `done:false` → back-to-claiming pattern exactly (expected: yes).

### Deferred Ideas (OUT OF SCOPE)
- Tip nudge / reminder if someone reaches Results without tipping — tip stays purely optional.
- Privacy disclosure (out of Phase 10 scope — left for a dedicated privacy/polish pass).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESULTS-03 | Locked Results screen shows each person's itemized breakdown; current user expanded by default; others tap-to-expand; grand total visible | PersonResultsScreen → accordion pattern; computePersonShareFromClaims already works per-person; grand total = computeSubtotalCents(session.items) |
| RESULTS-04 | From Results: Copy plain-text summary, Edit the bill, start New bill | BillViewHeader.handleShare clipboard pattern to reuse; `done:false` route for Edit; localStorage clear + redirect for New Split |
| TIP-02 | User can add a tip via a modal launched from Results; totals update immediately | TipScreen logic reused wholesale inside shadcn Dialog; SWR mutate() refreshes totals |
| CURR-02 | All monetary amounts render in detected currency with correct symbol and decimal places including zero-decimal currencies (JPY) | Intl.NumberFormat with `resolvedOptions().minimumFractionDigits` gives divisor; verified in Node.js |
| CURR-03 | If currency can't be detected, app falls back gracefully; user can override | `currencyCode` already present on SessionPayload (default 'USD'); inline "change" affordance + a new `update_currency` op on `/edit` route persists override |
</phase_requirements>

---

## Summary

Phase 10 is a pure display and tip-entry phase. The data model (`tips: Record<PersonId, number>`, `currencyCode: string`) already exists in `SessionPayload` from Phase 8. No schema surgery is needed. The three deliverables are: (1) a refactored `PersonResultsScreen` that shows all participants as a local-state accordion with the current user expanded, plus a CTA bar; (2) `TipScreen` converted from a full-page screen to shadcn Dialog content mounted on the Results screen; and (3) `formatCents` gaining an optional `currencyCode` param that uses `Intl.NumberFormat` for correct zero-decimal handling.

The most technically significant piece is the `formatCents` upgrade. `Intl.NumberFormat.resolvedOptions().minimumFractionDigits` is the correct, verified way to derive the per-currency divisor (0 for JPY/KRW, 2 for USD/EUR/GBP/etc.) from a stored integer-cents value. All existing call sites omit the second argument and continue to receive the legacy `$X.XX` output unchanged.

The currency override write path (D-07, CURR-03) should be implemented as a new `op: 'update_currency'` on the existing `/api/session/[sessionId]/edit` route. This route already performs GET→mutate→SET with identical patterns for all other ops; adding one more op is far simpler than a dedicated route. The client calls it and then `mutate()` the SWR key so all devices receiving the polling interval pick up the new code within 3 seconds.

**Primary recommendation:** Implement in four self-contained tasks: (1) `formatCents` upgrade + tests; (2) Results accordion + CTA bar in `PersonResultsScreen`; (3) Tip Dialog conversion in `TipScreen` + phase machine update in `CollaborativeClaimingView`; (4) currency override op + threading. Each task is independently testable and does not depend on the others being complete first.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-person share calculation | Client (computed from session) | — | `computePersonShareFromClaims` in `lib/billMath.ts` — derived on demand, never stored |
| Grand total calculation | Client (computed from session) | — | `computeSubtotalCents(session.items)` — items-only per D-03 |
| Tip persistence | API / Backend (`/api/session/[sessionId]/tip`) | Client (SWR mutate) | `tips: Record<PersonId, number>` stored in Redis; client reads via SWR polling |
| Currency persistence | API / Backend (extend `/edit` route) | Client (SWR mutate) | `currencyCode` on SessionPayload; session-level so must write to Redis |
| Currency formatting | Client (`lib/billMath.ts` formatCents) | — | Pure display transformation; no server involvement |
| Accordion expand/collapse state | Client (local React state) | — | No persistence needed — default is current-user-expanded on mount |
| Clipboard copy | Client (navigator.clipboard + execCommand fallback) | — | Browser API; mirrors BillViewHeader.handleShare pattern |
| "Edit bill" navigation | API + Client | — | POST `done:false` to `/done` route, then `setPhase('claiming')` |
| "New Split" navigation | Client only | — | localStorage clear + `router.push('/')` |

---

## Standard Stack

### Core (all already installed — zero new npm packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui Dialog | installed | Tip modal container | Already used for IdentityModal and unclaimed-warning Dialog in this codebase; focus trap, a11y, Radix under the hood |
| React local state (`useState`) | 19.x | Accordion expand/collapse, copy feedback, new-split confirmation | No persistence needed; Dialog open state lives in CollaborativeClaimingView |
| `Intl.NumberFormat` | Browser/Node built-in | Currency-aware amount formatting | Handles zero-decimal currencies (JPY, KRW) via `resolvedOptions().minimumFractionDigits`; no library needed |
| SWR `mutate()` | 2.x | Refresh session after tip confirm or currency override | Already wired in CollaborativeClaimingView; call after POST |

**Installation:** No new packages. [VERIFIED: codebase package.json confirms all dependencies present]

---

## Package Legitimacy Audit

No new packages are installed in this phase. All required components (Dialog, Button, Input, Separator, Badge, Card) are already installed per the UI-SPEC Registry Safety section. [VERIFIED: package.json + UI-SPEC.md]

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User taps "I'm done" (claiming phase)
        |
        v
CollaborativeClaimingView: setPhase('results')
        |
        v
PersonResultsScreen (ALL people accordion)
  ├── CurrentUserCard (expanded, shows line items + "Your tip" + "Your total")
  ├── OtherPersonCard x N (collapsed → tap to expand, shows line items only)
  ├── Grand Total row (sum of all item priceCents, items-only, D-03)
  └── CTA Bar:
        ├── "Copy summary" → navigator.clipboard (+ execCommand fallback)
        ├── "Edit bill" → POST /done done:false → setPhase('claiming')
        ├── "New Split" → confirmation Dialog → localStorage.removeItem + router.push('/')
        └── "Add a tip?" button → sets tipDialogOpen=true
                                        |
                                        v
                              TipDialog (shadcn Dialog overlay)
                                ├── TipScreen logic (presets, custom %, 100% cap)
                                ├── POST /api/session/[sessionId]/tip
                                ├── mutate() on success → SWR refreshes
                                └── Dialog closes → Results totals update

Currency code flow:
  session.currencyCode (from Redis via SWR)
        |
        v
  CollaborativeClaimingView passes currencyCode prop down to:
        ├── PersonResultsScreen (all formatCents calls)
        └── TipScreen/TipDialog (all formatCents calls)

Currency override (D-07):
  User taps "Currency: {CODE} (change)" affordance
        |
        v
  Picker UI (select or small dialog)
        |
        v
  POST /api/session/[sessionId]/edit  { op: 'update_currency', currencyCode: 'EUR' }
        |
        v
  Redis: session.currencyCode = 'EUR'  (persisted, shared across all devices)
        |
        v
  mutate() → SWR revalidates → all formatCents calls use new code
```

### Recommended Project Structure (no new files needed)

```
lib/
└── billMath.ts         # formatCents(cents, currencyCode?) — change here

components/split/
├── PersonResultsScreen.tsx   # extend: accordion, all-people view, CTA bar, currency prop
└── TipScreen.tsx             # convert: full-page → Dialog content; add currencyCode prop

app/split/[sessionId]/
└── CollaborativeClaimingView.tsx  # mount tip as Dialog, remove 'tip' phase, thread currencyCode

app/api/session/[sessionId]/edit/
└── route.ts            # add 'update_currency' to VALID_OPS
```

---

## Critical Pattern: formatCents Upgrade

### Zero-decimal currency formula (CURR-02) [VERIFIED: Node.js runtime]

The key insight: `Intl.NumberFormat.resolvedOptions().minimumFractionDigits` tells you how many decimal places the currency uses. For USD/EUR/GBP this is `2` (divide cents by 100). For JPY/KRW this is `0` (the integer IS the major unit — do not divide by 100).

**The divisor formula:**
```
divisor = Math.pow(10, minimumFractionDigits)
majorUnit = integerCentsValue / divisor
```

**Proposed `formatCents` signature (backward-compatible):**
```typescript
// Source: verified against Node.js Intl implementation 2026-06-08
export function formatCents(cents: number, currencyCode?: string): string {
  if (!currencyCode) {
    // Legacy path: preserves exact '$X.XX' output for all existing call sites
    return `$${(cents / 100).toFixed(2)}`
  }
  try {
    const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode })
    const decimals = fmt.resolvedOptions().minimumFractionDigits
    const divisor = Math.pow(10, decimals)
    return fmt.format(cents / divisor)
  } catch {
    // Fallback for invalid currency codes: use legacy dollar format
    return `$${(cents / 100).toFixed(2)}`
  }
}
```

**Verified behavior:**
- `formatCents(1250)` → `"$12.50"` (no change — backward compat) [VERIFIED: Node.js]
- `formatCents(1250, 'USD')` → `"$12.50"` (matches legacy exactly) [VERIFIED: Node.js]
- `formatCents(1250, 'EUR')` → `"€12.50"` [VERIFIED: Node.js]
- `formatCents(1250, 'JPY')` → `"¥1,250"` (NOT divided by 100 — correct) [VERIFIED: Node.js]
- `formatCents(500, 'KRW')` → `"₩500"` [VERIFIED: Node.js]
- `formatCents(999, 'GBP')` → `"£9.99"` [VERIFIED: Node.js]
- `formatCents(1250, 'BOGUS')` → `"$12.50"` (catches RangeError, falls back) [VERIFIED: Node.js]

**Intl.NumberFormat `resolvedOptions().minimumFractionDigits` for D-06 currency list:**

| Currency | minimumFractionDigits | Zero-decimal? |
|----------|-----------------------|---------------|
| USD | 2 | No |
| EUR | 2 | No |
| GBP | 2 | No |
| JPY | 0 | Yes |
| AUD | 2 | No |
| CAD | 2 | No |
| CHF | 2 | No |
| CNY | 2 | No |
| INR | 2 | No |
| KRW | 0 | Yes |

[VERIFIED: Node.js runtime]

**Backward-compat note:** All 10 existing `formatCents` call sites (in PersonResultsScreen, TipScreen, billMath tests) omit the second argument and will continue to receive `"$X.XX"` output. The 3 formatCents test cases in `billMath.test.ts` will pass unchanged.

---

## Critical Pattern: Tip-as-Dialog Conversion

### Phase machine change in CollaborativeClaimingView [VERIFIED: codebase]

Current `type Phase = 'claiming' | 'tip' | 'results'` must become `type Phase = 'claiming' | 'results'`.

Changes:
1. Remove the `'tip'` branch from the `Phase` union and the `if (phase === 'tip')` render block
2. Remove `TipScreen` as a full-page screen render
3. Add `const [tipDialogOpen, setTipDialogOpen] = useState(false)` in CollaborativeClaimingView
4. In `submitDone()`: change `setPhase('tip')` to `setPhase('results')` — done goes directly to results (D-01)
5. In `derivePhase()`: the `tips?.[personId] !== undefined` check already maps to `'results'`; the `donePeople[personId]` check currently maps to `'tip'` — must be changed to also map to `'results'` since `tip` phase no longer exists
6. Mount `<TipDialog open={tipDialogOpen} onOpenChange={setTipDialogOpen} ... />` alongside the unclaimed warning Dialog in the claiming view JSX — so it remains accessible from the Results screen via prop pass-through

**derivePhase update:**
```typescript
// Source: CollaborativeClaimingView.tsx derivePhase, modified for Phase 10
function derivePhase(personId: PersonId, session: SessionPayload): Phase {
  // D-01: tip is optional; being "done" without a tip goes directly to results
  if (session.claims?.donePeople?.[personId]) return 'results'
  return 'claiming'
}
```
(The `tips?.[personId] !== undefined` check is no longer needed as a separate branch since all done people are now at results.)

### TipScreen → Dialog content [VERIFIED: codebase]

TipScreen's existing props interface:
```typescript
interface TipScreenProps {
  sessionId: string
  personId: string
  itemSubtotalCents: number
  onTipConfirmed: () => void
  onBack: () => void       // ← replaces with onOpenChange(false) from Dialog context
  mutate: () => Promise<unknown>
}
```

When re-hosting inside Dialog:
- Remove `<AppHeader />` from TipScreen (already on all /split screens)
- Remove the full-page `<main>` wrapper and sticky header with Back button
- Remove the fixed bottom CTA bar pattern
- Add `currencyCode?: string` prop; pass to all `formatCents` calls
- The Dialog's close X or backdrop close replaces `onBack`
- `onTipConfirmed` closes the Dialog (`setTipDialogOpen(false)`) instead of `setPhase('results')`
- All tip logic (presets, `applyCustom`, `handleConfirm`, `MAX_TIP_PERCENT`) is kept verbatim

The Dialog usage pattern mirrors the existing unclaimed-warning Dialog in CollaborativeClaimingView:
```typescript
// Source: CollaborativeClaimingView.tsx Dialog pattern (existing)
<Dialog open={showUnclaimedWarning} onOpenChange={setShowUnclaimedWarning}>
  <DialogContent showCloseButton={false}>
    <DialogHeader>...</DialogHeader>
    ...
  </DialogContent>
</Dialog>
```

---

## Critical Pattern: Results Accordion

### Per-person accordion without Radix Accordion [VERIFIED: UI-SPEC.md, codebase]

The UI-SPEC explicitly states: "Accordion behavior on result cards is implemented via local React state (no Radix Accordion needed)". The interaction contract says current user stays expanded (do not collapse on tap), others toggle on tap.

```typescript
// Source: UI-SPEC interaction contract + PersonResultsScreen pattern
const [expandedId, setExpandedId] = useState<string | null>(personId)

function handleCardTap(id: string) {
  if (id === personId) return // current user stays expanded (D-04)
  setExpandedId(prev => prev === id ? null : id)
}
```

**What each card shows:**
- **Current user card (always expanded):** avatar, name, line items with `formatCents(shareCents, currencyCode)`, tip row `formatCents(tipCents, currencyCode)`, "Your total" = itemSubtotal + tip in amber-600 28px
- **Other person card (collapsed):** avatar, name, grand item share in amber-600 28px; no tip row (D-04/D-05)
- **Other person card (expanded):** same as above + line items showing their claimed items and share amounts

**Grand Total row:** `computeSubtotalCents(session.items)` — items only, per D-03.

---

## Critical Pattern: Currency Override Write Path (D-07)

### Extend `/edit` route — add `update_currency` op [VERIFIED: codebase]

The existing `/edit` route handles 6 ops via a simple GET→mutate→SET pattern. Adding `'update_currency'` follows the exact same pattern.

**Why extend `/edit` rather than a new route:**
- The `/edit` route already uses the same GET→SET pattern with validation
- No Lua atomicity required for currency changes (it's a session-level singleton, not a concurrent-write-prone per-person key)
- The route's `VALID_OPS` array is the only change to the route guard
- Client-side: the same `fetch('/api/session/.../edit', ...)` + `mutate()` pattern already used for all other edits

**Proposed addition to `/edit` route:**
```typescript
// Add to VALID_OPS:
const VALID_OPS = ['add', 'remove', 'edit_price', 'edit_name', 'edit_quantity', 'add_person', 'update_currency'] as const

// Add to validateOp():
if (op === 'update_currency') {
  if (typeof b.currencyCode !== 'string' || b.currencyCode.length === 0)
    return { ok: false, error: 'Invalid update_currency: currencyCode must be a non-empty string' }
  if (b.currencyCode.length > 10) // ISO 4217 codes are 3 chars; generous limit
    return { ok: false, error: 'Invalid update_currency: currencyCode too long' }
  return { ok: true }
}

// Add to the GET→mutate→SET block:
if (op === 'update_currency') {
  const updated: SessionPayload = { ...session, currencyCode: b.currencyCode as string }
  await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
  return NextResponse.json({ ok: true })
}
```

**Client call pattern (mirrors existing edit calls in CollaborativeClaimingView):**
```typescript
async function handleCurrencyChange(newCode: string) {
  await fetch(`/api/session/${sessionId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'update_currency', currencyCode: newCode }),
  })
  await mutate()
}
```

---

## Critical Pattern: Copy Summary (RESULTS-04)

### Clipboard pattern from BillViewHeader [VERIFIED: codebase]

`BillViewHeader.handleShare` (lines 63-105) implements the exact pattern to reuse: `navigator.share` → `navigator.clipboard.writeText` → `execCommand('copy')` fallback, with `setCopied(true)` + 2-second timeout reset.

The copy summary text format (from UI-SPEC Interaction Contracts):
```
{Name} owes {formatted_amount}
{Name} owes {formatted_amount}
...
Total: {formatted_total}
```

Where amounts use `formatCents(amount, session.currencyCode)`.

---

## Critical Pattern: New Split Confirmation

### "New Split" flow [VERIFIED: UI-SPEC Interaction Contracts + codebase]

The UI-SPEC specifies: show a confirmation Dialog ("Start a new split? This clears your local progress. Other people on this bill are not affected.") with Cancel / "New Split" buttons. On confirm:
1. `localStorage.removeItem(`split:${sessionId}:personId`)` — clears persisted identity
2. `router.push('/')` — redirects to home
3. Do NOT delete the Redis session (other participants may still use it)

This requires `useRouter` from `'next/navigation'` — already used in `AppHeader` (the mock is already in `vitest.setup.ts` indirectly).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zero-decimal currency detection | Manual lookup table of currency → decimal count | `Intl.NumberFormat(undefined, {style:'currency',currency:code}).resolvedOptions().minimumFractionDigits` | ECMA-402 standard, maintained by runtime, handles all 180 ISO 4217 currencies automatically |
| Modal focus trap | Custom focus trap | shadcn Dialog (Radix under the hood) | Radix Dialog handles focus trap, Escape key, backdrop click, ARIA — already installed |
| Accordion | Radix Accordion component | Local `useState<string | null>` | UI-SPEC explicitly states: no Radix Accordion needed; interaction rule is simpler than a general accordion |
| Clipboard copy | Custom clipboard manager | `navigator.clipboard.writeText` + `execCommand` fallback | Already proven pattern in BillViewHeader |

---

## Common Pitfalls

### Pitfall 1: Dividing JPY cents by 100
**What goes wrong:** `formatCents(1250, 'JPY')` renders `"¥12"` instead of `"¥1,250"`.
**Why it happens:** Treating all currencies as 2-decimal like USD — dividing by 100 before passing to Intl.
**How to avoid:** Read `minimumFractionDigits` from `resolvedOptions()` and compute `divisor = Math.pow(10, decimals)`. When decimals is 0, divisor is 1 — no division at all.
**Warning signs:** Any amount formatted for JPY, KRW, or other zero-decimal currencies appearing 100x smaller than expected.

### Pitfall 2: Breaking existing formatCents tests
**What goes wrong:** Changing formatCents to always use Intl (even without currencyCode) causes the 3 existing billMath.test.ts assertions to fail if Intl output differs.
**Why it happens:** Intl output includes unicode symbols that may or may not match the hand-rolled `$X.XX` string exactly.
**How to avoid:** Preserve the legacy code path for the no-arg case. [VERIFIED: `Intl.NumberFormat(undefined, {style:'currency', currency:'USD'}).format(12.50)` returns `"$12.50"` which matches — but safer to keep the explicit branch for stability.]
**Warning signs:** Test failure on `'formats 1250 as "$12.50"'` test.

### Pitfall 3: `derivePhase` still routing to the removed 'tip' phase
**What goes wrong:** A returning user who is `donePeople[personId]=true` but has no tip entry lands in a non-existent phase, causing a blank screen.
**Why it happens:** `derivePhase` currently returns `'tip'` when `donePeople[personId]` is true. After Phase 10, `'tip'` is removed from the Phase union.
**How to avoid:** Update `derivePhase` to return `'results'` when `donePeople[personId]` is true (the tip is now optional and available from Results).

### Pitfall 4: Tip Dialog mounted only in the Results render branch
**What goes wrong:** The `tipDialogOpen` state + Dialog are placed inside the `phase === 'results'` render branch of CollaborativeClaimingView, causing Dialog state to reset whenever the component re-renders with phase != results.
**Why it happens:** Dialog open state initialized fresh each time the branch re-mounts.
**How to avoid:** Declare `tipDialogOpen` state at the top level of CollaborativeClaimingView, not inside a conditional branch. Mount the Dialog JSX at the same level as the unclaimed warning Dialog (unconditionally in the return, controlled by `open={tipDialogOpen}`). Pass `setTipDialogOpen` down to `PersonResultsScreen` as a prop.

### Pitfall 5: Grand Total vs "Your Total" confusion
**What goes wrong:** The Results screen shows the grand bill total (items only) in the grand total row, but the current user's card total also says "Total" — users confuse which is which.
**Why it happens:** Both rows labeled identically.
**How to avoid:** Per UI-SPEC copywriting contract: the grand total row says "Total"; the current user's card personal amount is labeled "Your share" (item-only sub-line) and "Your total" (items + tip). The amber-600 number on the current user's card is `itemSubtotal + tipCents` from their own card perspective — but this DOES NOT appear in the grand Total row, which is `computeSubtotalCents(session.items)` (all items, regardless of who claimed them).

### Pitfall 6: `Intl.NumberFormat` throws on invalid currency code
**What goes wrong:** If `session.currencyCode` is an unrecognized string (not ISO 4217), `new Intl.NumberFormat(undefined, {style:'currency', currency: 'XYZ'})` does NOT throw — it produces `"XYZ 12.50"`. However, `null`, `undefined`, or empty string DOES throw.
**Why it happens:** Intl accepts unknown currency codes but rejects non-string/empty inputs.
**How to avoid:** The try/catch in `formatCents` handles the throw cases. For the "shows currency code in output" case (e.g. `"XYZ 12.50"`), this is acceptable fallback behavior per D-06.

---

## Code Examples

### Pattern 1: formatCents with currencyCode
```typescript
// Source: verified against Node.js Intl runtime 2026-06-08
export function formatCents(cents: number, currencyCode?: string): string {
  if (!currencyCode) {
    return `$${(cents / 100).toFixed(2)}`
  }
  try {
    const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode })
    const decimals = fmt.resolvedOptions().minimumFractionDigits
    const divisor = Math.pow(10, decimals)
    return fmt.format(cents / divisor)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}
```

### Pattern 2: Tip Dialog integration in CollaborativeClaimingView
```typescript
// Source: codebase pattern — CollaborativeClaimingView existing Dialog usage
// Declare at top level of component (not in phase branch):
const [tipDialogOpen, setTipDialogOpen] = useState(false)

// In the results phase render:
if (phase === 'results') {
  return (
    <>
      <PersonResultsScreen
        session={session}
        personId={selectedPersonId}
        currencyCode={session.currencyCode ?? 'USD'}
        onAddTip={() => setTipDialogOpen(true)}
        onEditBill={() => void handleBackToClaiming()}
        sessionId={sessionId}
      />
      <Dialog open={tipDialogOpen} onOpenChange={setTipDialogOpen}>
        <DialogContent>
          <TipScreen
            sessionId={sessionId}
            personId={selectedPersonId}
            itemSubtotalCents={personalShare.itemSubtotal}
            currencyCode={session.currencyCode ?? 'USD'}
            onTipConfirmed={() => { setTipDialogOpen(false) }}
            mutate={mutate}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
```

### Pattern 3: Results accordion local state
```typescript
// Source: UI-SPEC interaction contract
const [expandedId, setExpandedId] = useState<string | null>(personId)

function handleCardTap(id: string) {
  if (id === personId) return // current user always stays expanded
  setExpandedId(prev => prev === id ? null : id)
}
```

### Pattern 4: Grand total (items-only, D-03)
```typescript
// Source: lib/billMath.ts computeSubtotalCents — this is the grand "Total" row value
const grandTotalCents = computeSubtotalCents(session.items)
// Per D-03: never includes tips, does not fluctuate with tip additions
```

### Pattern 5: Copy summary clipboard
```typescript
// Source: BillViewHeader.handleShare pattern — reuse verbatim
async function handleCopySummary() {
  const lines = session.people.map((p) => {
    const share = computePersonShareFromClaims(
      p.id, session.items, session.claims?.items ?? {}, session.tips?.[p.id] ?? 0
    )
    return `${p.name} owes ${formatCents(share.itemSubtotal, session.currencyCode)}`
  })
  const grandTotal = computeSubtotalCents(session.items)
  lines.push(`Total: ${formatCents(grandTotal, session.currencyCode)}`)
  const text = lines.join('\n')
  // navigator.clipboard → execCommand fallback (same as BillViewHeader)
}
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CURR-02 | `formatCents(1250, 'JPY')` → `"¥1,250"` (not `"¥12.50"`) | unit | `npx vitest run __tests__/billMath.test.ts` | ✅ (extend existing) |
| CURR-02 | `formatCents(1250, 'EUR')` → `"€12.50"` | unit | `npx vitest run __tests__/billMath.test.ts` | ✅ (extend existing) |
| CURR-02 | `formatCents(1250)` → `"$12.50"` (backward compat, no regression) | unit | `npx vitest run __tests__/billMath.test.ts` | ✅ (existing passes) |
| CURR-03 | `formatCents(1250, 'BOGUS')` → falls back to `"$12.50"` | unit | `npx vitest run __tests__/billMath.test.ts` | ✅ (extend existing) |
| TIP-02 | Tip Dialog renders with presets and custom %, Confirm POSTs | unit | `npx vitest run __tests__/TipScreen.test.tsx` | ✅ (update existing) |
| TIP-02 | $0 tip (Confirm enabled at 0%) | unit | `npx vitest run __tests__/TipScreen.test.tsx` | ✅ (existing Test 7) |
| RESULTS-03 | Results screen renders all people's names | unit | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ (extend existing) |
| RESULTS-03 | Current user's card shows tip + "Your total" | unit | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ (extend existing) |
| RESULTS-03 | Other person's card does not show tip | unit | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ (Wave 0 addition) |
| RESULTS-04 | Copy summary button triggers clipboard write | unit | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ (Wave 0 addition) |
| RESULTS-04 | Edit bill calls done:false route | unit | `npx vitest run __tests__/PersonResultsScreen.test.tsx` | ✅ (Wave 0 addition) |

### Sampling Rate
- **Per task commit:** `npx vitest run __tests__/billMath.test.ts __tests__/PersonResultsScreen.test.tsx __tests__/TipScreen.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Extend `__tests__/billMath.test.ts` — add 4 new `formatCents` cases: EUR, JPY (zero-decimal), GBP, fallback for bad code. These are the first tests to write.
- [ ] Extend `__tests__/PersonResultsScreen.test.tsx` — add: multi-person accordion render (all names visible), other-person card has no tip row, grand total row = sum of all item prices (not including tip), Copy summary test.
- [ ] Extend `__tests__/TipScreen.test.tsx` — update render helper to not wrap in `<main>` (Dialog host handles that); add `currencyCode` prop test showing EUR formatting.

*(No new test files needed — all existing test files are extended.)*

---

## Security Domain

`security_enforcement` is not set to `false` in config, so this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not applicable — this phase has no auth |
| V3 Session Management | No | Sessions are already managed by existing routes |
| V4 Access Control | Yes (minimal) | `update_currency` op: no additional auth needed; currency is shared/public session data. Same threat model as existing edit ops — any participant who knows the sessionId can change currency. This is acceptable per D-07 (session-level property, no host role). |
| V5 Input Validation | Yes | `update_currency` op must validate: non-empty string, max 10 chars (generous for 3-char ISO codes). Validated in `validateOp`. |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Currency code injection | Tampering | Validate as non-empty string ≤10 chars in `validateOp`; Intl.NumberFormat catches unrecognized codes gracefully (renders "XYZ 12.50") |
| Large number in tipCents overflow | Tampering | Already handled by tip route: `MAX_TIP_CENTS = 100_000` server-side cap (existing) |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `formatCents` manual `$X.XX` | `formatCents(cents, currencyCode?)` with Intl.NumberFormat | Phase 10 | Correct zero-decimal currencies (JPY, KRW); multi-currency support |
| TipScreen as full-page phase | TipScreen as Dialog content | Phase 10 | No linear `tip` phase; tip accessible from Results any time |
| Single-person results view | All-people accordion Results | Phase 10 | Social accountability; everyone sees everyone's share |
| Vercel KV | Upstash Redis | Vercel KV deprecated Dec 2024 | No impact on this phase (already migrated in Phase 4) |

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes. No new external services, CLI tools, or runtimes are required. All API routes are modifications to existing Next.js Route Handlers. The Redis connection is already established via `@upstash/redis`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Intl.NumberFormat` output for USD (`"$12.50"`) matches legacy `formatCents` output exactly in all target browsers (iOS Safari, Android Chrome) | formatCents Upgrade | If wrong, existing tests pass but browser rendering differs; mitigated by keeping legacy path for no-arg case |
| A2 | The shadcn Dialog `showCloseButton={false}` prop used in the unclaimed-warning Dialog is also available for the Tip Dialog (implies custom shadcn install supports this prop) | Tip-as-Dialog Conversion | If wrong, default close button appears; non-breaking, just cosmetic |

**If this table is small:** Most claims were verified against the actual codebase and Node.js runtime. The two assumptions above are low-risk and have graceful degradations.

---

## Open Questions

1. **Currency picker — select vs. dialog**
   - What we know: D-06 specifies common currencies + detected code; no blocking UI. UI-SPEC says "implementation discretion."
   - What's unclear: Whether a shadcn `<select>` (inline) or a small Dialog provides better mobile UX.
   - Recommendation: Use a shadcn `<select>` inline near the grand total — lower implementation cost than a Dialog, keeps the "no blocking UI" intent, and shadcn `<select>` is mobile-friendly.

2. **Grand Total row vs. current user's "Your total" visual distinction**
   - What we know: Grand total is items-only (D-03); "Your total" on user's card = itemSubtotal + tip (D-04).
   - What's unclear: Whether a user will understand the difference between the grand total row and their "Your total" without explanation.
   - Recommendation: Label the grand total row "Total" (bill total, items only) and use a subdued style; the user's card shows "Your total" in amber-600 as the prominent number. Claude's discretion on exact visual treatment (per CONTEXT.md).

---

## Sources

### Primary (HIGH confidence)
- Codebase: `lib/billMath.ts` — confirmed `formatCents` signature and all math helpers
- Codebase: `lib/sessionSchema.ts` — confirmed `tips: Record<PersonId, number>` and `currencyCode: string` both present
- Codebase: `app/api/session/[sessionId]/edit/route.ts` — confirmed GET→mutate→SET pattern and VALID_OPS extension point
- Codebase: `app/api/session/[sessionId]/tip/route.ts` — confirmed tip write pattern (non-atomic, acceptable per WR-01 comment)
- Codebase: `components/split/CollaborativeClaimingView.tsx` — confirmed Phase union, derivePhase, existing Dialog pattern
- Codebase: `components/split/PersonResultsScreen.tsx` — confirmed single-person seed for accordion extension
- Codebase: `components/split/TipScreen.tsx` — confirmed all tip logic to reuse verbatim
- Codebase: `components/split/BillViewHeader.tsx` — confirmed clipboard pattern to reuse for Copy summary
- Node.js runtime: `Intl.NumberFormat` behavior verified — zero-decimal currencies (JPY `minimumFractionDigits=0`, KRW `minimumFractionDigits=0`), all D-06 currencies tested
- `.planning/phases/10-results-screen-tip-modal-currency-display/10-CONTEXT.md` — locked decisions D-01 through D-07
- `.planning/phases/10-results-screen-tip-modal-currency-display/10-UI-SPEC.md` — component inventory, interaction contracts, copywriting contract, spacing/color system

### Secondary (MEDIUM confidence)
- ECMA-402 specification: `Intl.NumberFormat.resolvedOptions().minimumFractionDigits` is part of the standard and is consistent across V8 (Node.js, Chrome), JSC (Safari), and SpiderMonkey (Firefox). [ASSUMED: cross-browser consistency not live-verified in browser, but ECMA-402 compliance is well-established]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all libraries confirmed present in package.json and verified against running codebase
- Architecture: HIGH — all patterns derived from actual code, not assumptions
- formatCents formula: HIGH — verified in Node.js runtime with concrete outputs
- Pitfalls: HIGH — derived from actual code reading (e.g., `derivePhase` migration trap verified by reading the function)

**Research date:** 2026-06-08
**Valid until:** 2026-07-08 (stable stack; Intl.NumberFormat is a browser standard, not a moving target)
