# Phase 10: Results Screen + Tip Modal + Currency Display - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/billMath.ts` | utility | transform | `lib/billMath.ts` (itself — existing `formatCents`) | exact |
| `components/split/PersonResultsScreen.tsx` | component | request-response | `components/split/PersonResultsScreen.tsx` (existing, extend) + `app/split/[sessionId]/CollaborativeClaimingView.tsx` (accordion state pattern) | exact |
| `components/split/TipScreen.tsx` | component | request-response | `components/split/TipScreen.tsx` (itself — convert full-page → Dialog content) + `app/split/[sessionId]/CollaborativeClaimingView.tsx` Dialog pattern | exact |
| `app/split/[sessionId]/CollaborativeClaimingView.tsx` | component | request-response | `app/split/[sessionId]/CollaborativeClaimingView.tsx` (itself — phase machine + Dialog mounting) + `components/wizard/AppHeader.tsx` (New Split confirm dialog + router.push) | exact |
| `app/api/session/[sessionId]/edit/route.ts` | route | CRUD | `app/api/session/[sessionId]/edit/route.ts` (itself — extend VALID_OPS + validateOp) | exact |

---

## Pattern Assignments

### `lib/billMath.ts` (utility, transform)

**Analog:** `lib/billMath.ts` lines 13-15 (current `formatCents`)

**Existing signature to replace** (lines 13-15):
```typescript
/** Format integer cents → display string ("$12.50"). */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
```

**New signature — backward-compatible** (add optional `currencyCode` param):
```typescript
/** Format integer cents → display string.
 *  With no currencyCode: preserves legacy "$X.XX" output unchanged (backward-compat).
 *  With currencyCode: uses Intl.NumberFormat and handles zero-decimal currencies (JPY, KRW).
 */
export function formatCents(cents: number, currencyCode?: string): string {
  if (!currencyCode) {
    // Legacy path: all 10 existing call sites omit this arg and get unchanged output.
    return `$${(cents / 100).toFixed(2)}`
  }
  try {
    const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode })
    const decimals = fmt.resolvedOptions().minimumFractionDigits
    const divisor = Math.pow(10, decimals)
    return fmt.format(cents / divisor)
  } catch {
    // Catches null/undefined/empty-string; invalid codes (e.g. 'BOGUS') do NOT throw — Intl
    // renders "BOGUS 12.50" which is acceptable per D-06.
    return `$${(cents / 100).toFixed(2)}`
  }
}
```

**Key formula — zero-decimal divisor:**
- `fmt.resolvedOptions().minimumFractionDigits` returns 0 for JPY/KRW and 2 for USD/EUR/GBP
- `divisor = Math.pow(10, decimals)` → JPY divisor = 1 (no divide-by-100), USD divisor = 100
- `formatCents(1250, 'JPY')` → `"¥1,250"` (NOT `"¥12"`)
- `formatCents(1250, 'USD')` → `"$12.50"` (same as legacy)
- `formatCents(1250)` → `"$12.50"` (unchanged, backward compat)

**Test file to extend:** `__tests__/billMath.test.ts` — existing `describe('formatCents')` block (lines 47-59)
Add 4 cases: EUR, JPY (zero-decimal), GBP, bad code fallback. The 3 existing test cases (no currencyCode arg) must continue to pass unchanged.

---

### `components/split/PersonResultsScreen.tsx` (component, request-response)

**Analog A:** `components/split/PersonResultsScreen.tsx` (existing — the current single-person seed)
**Analog B:** `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 88-91 (Dialog open state) + `components/split/BillViewHeader.tsx` lines 63-105 (clipboard + copy-feedback pattern)

**Existing props interface to extend** (lines 14-18):
```typescript
export interface PersonResultsScreenProps {
  session: PublicSessionPayload
  personId: PersonId
  onBack?: () => void
}
```

**New props interface:**
```typescript
export interface PersonResultsScreenProps {
  session: PublicSessionPayload
  personId: PersonId            // current user — always expanded
  currencyCode: string          // thread from session.currencyCode ?? 'USD'
  onAddTip: () => void          // opens the Tip Dialog in CollaborativeClaimingView
  onEditBill: () => void        // calls handleBackToClaiming (done:false) in parent
  sessionId: string             // for localStorage clear on New Split
}
```

**Accordion local state pattern** (no Radix Accordion — UI-SPEC confirmed):
```typescript
// Source: UI-SPEC interaction contract + ResearchMd Pattern 3
const [expandedId, setExpandedId] = useState<string | null>(personId)

function handleCardTap(id: string) {
  if (id === personId) return // current user stays expanded (do not collapse on tap)
  setExpandedId(prev => prev === id ? null : id)
}
```

**Avatar pattern** (from existing PersonResultsScreen lines 49-65):
```typescript
<div
  className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold ${AVATAR_COLORS[person.colorIndex % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]}`}
  aria-hidden="true"
>
  {person.name.charAt(0).toUpperCase()}
</div>
```

**Per-person card structure** (from existing PersonResultsScreen lines 33-99 — adapt for accordion):
- Current user card: always expanded; shows line items (`formatCents(shareCents, currencyCode)`); tip row `formatCents(tipCents, currencyCode)`; "Your total" amount in `text-amber-600 text-[28px] font-semibold`
- Other person card collapsed: name + item-share total only (no tip row — D-04/D-05); tap expands to show line items
- Grand total row: `computeSubtotalCents(session.items)` formatted with `formatCents(grandTotal, currencyCode)` — items only, never includes tips (D-03); style `text-[16px] font-semibold border-t border-border`

**Clipboard / copy-summary pattern** (from `BillViewHeader.tsx` lines 63-105):
```typescript
// Source: BillViewHeader.tsx handleShare — adapt text content for copy-summary
const [copied, setCopied] = useState(false)

async function handleCopySummary() {
  const lines = session.people.map((p) => {
    const share = computePersonShareFromClaims(
      p.id, session.items, session.claims?.items ?? {}, 0  // item share only (D-04)
    )
    return `${p.name} owes ${formatCents(share.itemSubtotal, currencyCode)}`
  })
  const grandTotal = computeSubtotalCents(session.items)
  lines.push(`Total: ${formatCents(grandTotal, currencyCode)}`)
  const text = lines.join('\n')

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    } catch { /* fall through */ }
  }
  // execCommand fallback (BillViewHeader.tsx lines 93-104)
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  const success = document.execCommand('copy')
  document.body.removeChild(el)
  if (success) {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
}
```

**Copy button feedback** (from BillViewHeader.tsx lines 133-138):
```typescript
// icon swaps to Check for 2s, then reverts — same as BillViewHeader share icon
{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
{copied ? 'Copied!' : 'Copy summary'}
```

**Currency override affordance** (inline select near grand total, D-06/D-07):
```typescript
// Shadcn select inline — "Currency: USD (change)" near grand total row
// Calls POST /api/session/[sessionId]/edit { op: 'update_currency', currencyCode } then mutate()
// Full list: ['USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','INR'] + session.currencyCode if not in list
```

**New Split confirm dialog pattern** (from AppHeader.tsx lines 119-143):
```typescript
// Source: AppHeader.tsx — exact same Dialog pattern
const [showNewSplitConfirm, setShowNewSplitConfirm] = useState(false)
const router = useRouter()  // from 'next/navigation'

// On confirm:
localStorage.removeItem(`split:${sessionId}:personId`)
router.push('/')
// Do NOT delete Redis session — other participants may still use it

<Dialog open={showNewSplitConfirm} onOpenChange={setShowNewSplitConfirm}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Start a new split?</DialogTitle>
      <DialogDescription>
        This clears your local progress. Other people on this bill are not affected.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowNewSplitConfirm(false)}>Cancel</Button>
      <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleNewSplit}>
        New Split
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Bottom CTA bar pattern** (from TipScreen.tsx lines 152-169 — fixed bar):
```typescript
// Source: TipScreen.tsx lines 152-169
<div
  className="fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] border-t border-border bg-background px-6 py-4"
  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
>
  {/* Copy summary + Edit bill + New Split buttons */}
  <Button className="h-12 w-full bg-amber-600 hover:bg-amber-700" onClick={handleCopySummary} ...>
    Copy summary
  </Button>
  {/* Secondary CTAs below */}
</div>
```

**Error pattern** (from TipScreen.tsx line 145-149, CollaborativeClaimingView.tsx):
```typescript
{error && (
  <p role="alert" className="text-[14px] text-red-600">{error}</p>
)}
```

**Test file to extend:** `__tests__/PersonResultsScreen.test.tsx`
- Update `makeSession` helper: already has `currencyCode: 'USD'` (line 28 — no change needed)
- Update render calls to pass new props: `currencyCode`, `onAddTip`, `onEditBill`, `sessionId`
- Remove `onBack` prop (no longer in interface)
- Add tests: multi-person accordion (all names visible), other-person card has no tip row, grand total = sum of item prices, Copy summary clipboard call

---

### `components/split/TipScreen.tsx` (component, request-response → Dialog content)

**Analog:** `components/split/TipScreen.tsx` (itself — keep all tip logic verbatim; strip full-page shell)
**Analog B:** `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 761-800 (Dialog pattern with `showCloseButton={false}`)

**Props interface change — replace `onBack` with Dialog-compatible signature:**
```typescript
// Source: TipScreen.tsx lines 11-18 (current)
// Keep: sessionId, personId, itemSubtotalCents, onTipConfirmed, mutate
// Add: currencyCode?: string
// Remove: onBack (Dialog's X button / onOpenChange handles close)
export interface TipScreenProps {
  sessionId: string
  personId: string
  itemSubtotalCents: number
  currencyCode?: string         // new: for formatCents calls
  onTipConfirmed: () => void
  mutate: () => Promise<unknown>
}
```

**JSX shell to REMOVE** (full-page wrapper → Dialog handles it):
```typescript
// Remove these wrappers (TipScreen.tsx lines 84-97, 152-169):
// <main className="mx-auto min-h-screen max-w-[480px] bg-background">
// <AppHeader />
// <header className="sticky top-0 ..."> ... Back button ... </header>
// Fixed bottom CTA bar wrapper
```

**JSX content to KEEP verbatim** (tip logic — TipScreen.tsx lines 35-80, 99-169):
```typescript
// Keep all of:
const [tipCents, setTipCents] = useState(0)
const [customPercentText, setCustomPercentText] = useState('')
const [submitting, setSubmitting] = useState(false)
const [error, setError] = useState<string | null>(null)

function applyPreset(percent: number) { ... }      // lines 40-44
const MAX_TIP_PERCENT = 100                         // line 47
function applyCustom(text: string) { ... }          // lines 49-58
async function handleConfirm() { ... }              // lines 60-80 — unchanged
```

**formatCents calls to update** (pass `currencyCode` to each):
```typescript
// TipScreen.tsx line 108: formatCents(tipCents) → formatCents(tipCents, currencyCode)
// TipScreen.tsx line 143: formatCents(personalTotal) → formatCents(personalTotal, currencyCode)
```

**Return shape — Dialog content only** (no `<main>`, no `<AppHeader />`, no sticky header):
```typescript
// New return: just the Dialog-friendly content block
return (
  <div className="flex flex-col gap-6 px-6 py-4">
    <h1 className="text-[20px] font-semibold leading-[1.2]">Add a tip?</h1>
    {/* tip amount display, presets, custom input, separator, your total, error — all kept */}
    {/* Confirm tip button — no fixed wrapper, just a regular Button at bottom of content */}
    <Button
      type="button"
      className="h-12 w-full bg-amber-600 hover:bg-amber-700"
      onClick={handleConfirm}
      disabled={submitting}
      aria-label={submitting ? 'Confirming tip…' : 'Confirm tip'}
    >
      {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Confirm tip'}
    </Button>
  </div>
)
```

**Test file to extend:** `__tests__/TipScreen.test.tsx`
- Update `renderTip` helper: remove `onBack` prop, add `currencyCode` prop
- Remove Test 6 (`onBack` test) or update to test Dialog close behavior
- Add: `currencyCode='EUR'` formats tip amounts with `€` symbol
- Existing Tests 1-5, 7, 8 pass with minor prop tweak (remove `onBack`)

---

### `app/split/[sessionId]/CollaborativeClaimingView.tsx` (component, request-response)

**Analog:** `app/split/[sessionId]/CollaborativeClaimingView.tsx` (itself — phase machine + Dialog)
**Analog B:** `components/wizard/AppHeader.tsx` lines 36-49 (confirm-before-navigate pattern)

**Phase union change** (line 53):
```typescript
// Current (line 53):
type Phase = 'claiming' | 'tip' | 'results'

// New:
type Phase = 'claiming' | 'results'
```

**`derivePhase` function change** (lines 68-74):
```typescript
// Current (lines 68-74):
function derivePhase(personId: PersonId, session: SessionPayload): Phase {
  if (session.tips?.[personId] !== undefined) return 'results'
  if (session.claims?.donePeople?.[personId]) {
    return 'tip'
  }
  return 'claiming'
}

// New (D-01: tip phase removed; done → results directly):
function derivePhase(personId: PersonId, session: SessionPayload): Phase {
  if (session.claims?.donePeople?.[personId]) return 'results'
  return 'claiming'
}
// Note: tips?.[personId] check no longer needed as a separate branch
// because all done people now land at results (tip optional from there).
```

**Tip Dialog state** — declare at TOP LEVEL of component, NOT inside a phase branch (Pitfall 4):
```typescript
// Source: CollaborativeClaimingView.tsx lines 88-91 pattern (showUnclaimedWarning)
// Add alongside existing dialog state declarations:
const [tipDialogOpen, setTipDialogOpen] = useState(false)
```

**`submitDone` change** (line 348):
```typescript
// Current (line 348): setPhase('tip')
// New:               setPhase('results')  // D-01: done goes straight to results
```

**Remove the 'tip' phase render block** (lines 539-550):
```typescript
// Remove this entire block:
// if (phase === 'tip') {
//   return <TipScreen ... />
// }
```

**Replace the 'results' phase render block** (lines 552-554) — mount Dialog alongside screen:
```typescript
// Current (lines 552-554):
// if (phase === 'results') {
//   return <PersonResultsScreen session={session} personId={selectedPersonId} onBack={() => setPhase('tip')} />
// }

// New pattern (mirroring existing unclaimed-warning Dialog at lines 762-800):
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
        <DialogContent showCloseButton={false}>
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

**`handleCurrencyChange` function** (new — mirrors existing edit calls in the file, lines 425-432 pattern):
```typescript
// Source: CollaborativeClaimingView.tsx handleInlineSubmit fetch+mutate pattern (lines 451-458)
async function handleCurrencyChange(newCode: string) {
  await fetch(`/api/session/${sessionId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'update_currency', currencyCode: newCode }),
  })
  await mutate()
}
```

**Imports to add:**
```typescript
// Add Check, Copy icons (for copy-summary feedback in PersonResultsScreen)
// TipScreen already imported (line 26)
// Dialog imports already present (lines 9-15)
// No new imports needed for the phase machine change itself
```

---

### `app/api/session/[sessionId]/edit/route.ts` (route, CRUD)

**Analog:** `app/api/session/[sessionId]/edit/route.ts` (itself — extend existing patterns)

**VALID_OPS extension** (line 8):
```typescript
// Current (line 8):
const VALID_OPS = ['add', 'remove', 'edit_price', 'edit_name', 'edit_quantity', 'add_person'] as const

// New — add 'update_currency' to the end:
const VALID_OPS = ['add', 'remove', 'edit_price', 'edit_name', 'edit_quantity', 'add_person', 'update_currency'] as const
```

**`validateOp` extension** — add new op case before the final `return { ok: true }` at line 122:
```typescript
// Source: validateOp function pattern (lines 52-123) — follow exact same if-op structure
// Add after the edit_quantity block:
if (op === 'update_currency') {
  if (typeof b.currencyCode !== 'string' || b.currencyCode.length === 0)
    return { ok: false, error: 'Invalid update_currency: currencyCode must be a non-empty string' }
  if (b.currencyCode.length > 10)
    // ISO 4217 codes are 3 chars; 10 chars is a generous safe limit
    return { ok: false, error: 'Invalid update_currency: currencyCode too long' }
  return { ok: true }
}
```

**GET→mutate→SET block extension** — add after the `edit_quantity` block inside the main `try` (around line 225):
```typescript
// Source: same GET→mutate→SET pattern used for all ops (lines 191-228)
// Add inside the try block, before `const updated: SessionPayload = {...}`:
if (op === 'update_currency') {
  const updated: SessionPayload = { ...session, currencyCode: b.currencyCode as string }
  await redis.set(`session:${sessionId}`, JSON.stringify(updated), { ex: 86400 })
  return NextResponse.json({ ok: true })
}
```

**Note:** `update_currency` does NOT need the Lua atomicity of `add_person` — `currencyCode` is a session-level singleton, not a concurrent-write-prone per-person key. The standard GET→mutate→SET path (last-write-wins) is correct.

**Test file to extend:** `__tests__/editRoute.test.ts`
- Add `describe('update_currency op')` block
- Test cases: valid code ('EUR') → 200 ok:true; empty string → 400; missing currencyCode → 400; string > 10 chars → 400

---

## Shared Patterns

### Dialog mounting pattern
**Source:** `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 761-800 (unclaimed warning Dialog)
**Apply to:** Tip Dialog in CollaborativeClaimingView results branch; New Split confirm Dialog in PersonResultsScreen

```typescript
// Source: CollaborativeClaimingView.tsx lines 762-800
<Dialog open={showUnclaimedWarning} onOpenChange={setShowUnclaimedWarning}>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle className="text-[20px] font-semibold leading-[1.2]">
        {/* title */}
      </DialogTitle>
      <DialogDescription className="text-[16px] text-zinc-500">
        {/* description */}
      </DialogDescription>
    </DialogHeader>
    <DialogFooter className="flex-col gap-2 sm:flex-col">
      <Button className="h-12 w-full bg-amber-600 hover:bg-amber-700">
        {/* primary action */}
      </Button>
      <Button variant="outline" className="h-12 w-full">
        {/* secondary/cancel */}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Error handling pattern
**Source:** `components/split/TipScreen.tsx` lines 145-149; `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 740-742
**Apply to:** All interactive handlers in PersonResultsScreen (copy, edit bill) and TipScreen (confirm tip)

```typescript
// Inline alert — always role="alert", text-red-600 (not text-destructive directly — see existing)
{error && (
  <p role="alert" className="text-[14px] text-red-600">{error}</p>
)}
```

### Fixed bottom CTA bar pattern
**Source:** `components/split/TipScreen.tsx` lines 152-169; `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 736-746
**Apply to:** PersonResultsScreen CTA bar (Copy, Edit, New Split buttons)

```typescript
// Source: TipScreen.tsx lines 152-169
<div
  className="fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] border-t border-border bg-background px-6 py-4"
  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
>
  <Button className="h-12 w-full bg-amber-600 hover:bg-amber-700">
    {/* primary CTA */}
  </Button>
</div>
```

### SWR mutate after POST pattern
**Source:** `components/split/TipScreen.tsx` line 73 (`await mutate()`); `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 409, 477
**Apply to:** After `handleCurrencyChange` and after tip confirm

```typescript
// Post a mutation, then force SWR revalidation so all devices pick up new state within 3s:
await fetch(`/api/session/${sessionId}/...`, { method: 'POST', ... })
await mutate()
```

### Amber-600 monetary total display
**Source:** `components/split/PersonResultsScreen.tsx` lines 57-60; `components/split/TipScreen.tsx` lines 103-109
**Apply to:** Per-person total display (28px), primary CTA buttons throughout PersonResultsScreen + TipScreen

```typescript
// Total amount: text-[28px] font-semibold text-amber-600
// Primary button: bg-amber-600 hover:bg-amber-700
<span className="text-[28px] font-semibold text-amber-600" data-testid="results-total">
  {formatCents(result.total, currencyCode)}
</span>
```

### localStorage scoped-key pattern
**Source:** `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 107-113, 128-131
**Apply to:** PersonResultsScreen New Split handler (clear identity on new split)

```typescript
// Source: CollaborativeClaimingView.tsx lines 107-113
// Key format: `split:${sessionId}:personId`  (sessionId-scoped)
try {
  localStorage.removeItem(`split:${sessionId}:personId`)
} catch {
  // localStorage unavailable in private browsing — silently ignore
}
```

### Import aliases and barrel imports
**Source:** `components/split/PersonResultsScreen.tsx` lines 1-12; `app/split/[sessionId]/CollaborativeClaimingView.tsx` lines 1-29

```typescript
// Path aliases (@/ prefix):
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { formatCents, computeSubtotalCents, computePersonShareFromClaims } from '@/lib/billMath'
import type { SessionPayload, PublicSessionPayload } from '@/lib/sessionSchema'
import type { PersonId } from '@/stores/useBillStore'
import { AVATAR_COLORS } from '@/stores/useBillStore'
import { AppHeader } from '@/components/wizard/AppHeader'
// lucide-react icons: Check, Copy, ChevronLeft, Loader2, Share2
```

---

## No Analog Found

All 5 files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns alone — though the `formatCents` Intl formula should be taken from RESEARCH.md since it is a new algorithm (the research document has the verified Node.js runtime outputs).

---

## Metadata

**Analog search scope:** `lib/`, `components/split/`, `app/split/[sessionId]/`, `app/api/session/[sessionId]/edit/`, `__tests__/`
**Files scanned:** 12 source files + 5 test files
**Pattern extraction date:** 2026-06-08
