---
phase: 01-manual-bill-splitter
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .gitignore
  - __tests__/AddItemsStep.test.tsx
  - __tests__/AddPeopleStep.test.tsx
  - __tests__/AssignItemsStep.test.tsx
  - __tests__/ResultsStep.test.tsx
  - __tests__/SetTipStep.test.tsx
  - __tests__/billMath.test.ts
  - __tests__/useBillStore.test.ts
  - app/globals.css
  - app/layout.tsx
  - app/page.tsx
  - components/ui/badge.tsx
  - components/ui/button.tsx
  - components/ui/card.tsx
  - components/ui/checkbox.tsx
  - components/ui/dialog.tsx
  - components/ui/input.tsx
  - components/ui/separator.tsx
  - components/wizard/AddItemsStep.tsx
  - components/wizard/AddPeopleStep.tsx
  - components/wizard/AssignItemsStep.tsx
  - components/wizard/ResultsStep.tsx
  - components/wizard/SetTipStep.tsx
  - components/wizard/WizardShell.tsx
  - lib/billMath.ts
  - lib/utils.ts
  - next.config.ts
  - stores/useBillStore.ts
  - tsconfig.json
  - vitest.config.mts
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
status: fixed
fixed: 2026-05-09
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

This is a well-structured React/Next.js bill splitter wizard. The core math (`billMath.ts`) is correct and the cent-conservation invariant holds. The store design is clean. Most findings are in the UI layer and test layer — several are bugs that produce incorrect visible output for users, not just style concerns.

Three blockers are identified: a font conflict in the layout that causes the wrong font to render, a custom tip input that is uncontrolled (switching away and back resets the displayed value while the store retains the old value, producing a stale display), and a display-only split calculation in `AssignItemsStep` that uses `Math.floor` instead of the largest-remainder method — making the per-person preview inconsistent with what `ResultsStep` actually charges.

---

## Critical Issues

### CR-01: Font conflict — body renders Inter, not Geist

**File:** `app/layout.tsx:8-23`

**Issue:** Two fonts are loaded: `geist` (with CSS variable `--font-sans`) and `inter`. The `<html>` element receives `font-sans` via `cn("font-sans", geist.variable)`, which maps `--font-sans` to Geist. But the `<body>` element overrides this with `inter.className`, which injects a concrete class that sets `font-family` to Inter directly. Because `body` is a descendant of `html`, and the `inter.className` class wins over the inherited CSS variable on `body` and all its children, every rendered character uses Inter — Geist is never visible. The `inter` import is dead weight and the visual output contradicts the font intent.

**Fix:**
```tsx
// Remove inter entirely. Keep only geist.
const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export default function RootLayout({ children }: ...) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  )
}
```

---

### CR-02: Custom tip input is uncontrolled — displayed value diverges from store after mode switch

**File:** `components/wizard/SetTipStep.tsx:104-115`

**Issue:** The custom tip `<Input>` uses `defaultValue={tipPercent}` (line 107). `defaultValue` sets the initial DOM value once and ignores subsequent prop changes. If a user:
1. Selects a preset (e.g. 20%) → mode switches to `preset`, input unmounts
2. Clicks "Custom" → input remounts with `defaultValue={20}` — this part works
3. Types "25" → store has 25, input shows 25
4. Clicks preset "15%" → mode = `preset`, store has 15, input unmounts
5. Clicks "Custom" again → input remounts with `defaultValue={15}` — still correct on remount

However the deeper bug is subtler: while the input is mounted and the user partially types (e.g. "2" mid-entry of "25"), the displayed input value and the store value are out of sync because `handleCustomChange` only calls `setTipPercent` when the regex passes — but the input's DOM value keeps updating freely. More critically, the input never reflects a store update triggered from elsewhere (e.g. a preset click while custom mode is active is impossible in the current flow, but this remains a design landmine). The immediate verifiable bug: `handleCustomChange` silently ignores invalid input without showing an error or resetting the visible field, so a user can see "abc" in the input while the store holds the previous value — no feedback is given.

**Fix:** Use a controlled input with local state to track the raw string, and show validation feedback:
```tsx
const [customValue, setCustomValue] = useState(String(tipPercent))

const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const raw = e.target.value
  setCustomValue(raw)
  if (/^\d+(\.\d{1,2})?$/.test(raw) && parseFloat(raw) <= 999) {
    setTipPercent(parseFloat(raw))
  }
}

// In JSX:
<Input
  inputMode="decimal"
  placeholder="Enter percent"
  value={customValue}
  onChange={handleCustomChange}
  maxLength={6}
  className="h-12 pr-8 text-base"
/>
```

---

### CR-03: AssignItemsStep shows incorrect per-person split for shared items

**File:** `components/wizard/AssignItemsStep.tsx:41`

**Issue:** The "Split equally — X each" display line uses `Math.floor(item.priceCents / assignedIds.length)` (line 41). This truncates the remainder rather than distributing it. For example, a $10.00 item split 3 ways shows "$3.33 each" — but the total of three "$3.33" shares is $9.99, not $10.00. The actual `computePersonTotals` function in `billMath.ts` uses the largest-remainder method and does charge one person $3.34. The preview is thus wrong for the majority of non-evenly-divisible prices. A user sees "$3.33 each × 3 = $9.99" but the results page charges "$3.34 + $3.33 + $3.33 = $10.00". This is a user-visible math discrepancy.

**Fix:** Apply the same largest-remainder logic, or display a range when the remainder is non-zero:
```tsx
const base = Math.floor(item.priceCents / assignedIds.length)
const remainder = item.priceCents % assignedIds.length
const perPersonCents = remainder > 0 ? null : base // null triggers range display

// In JSX:
{isShared && (
  <p className="text-[14px] text-zinc-500">
    {remainder === 0
      ? `Split equally — ${formatCents(base)} each`
      : `Split equally — ${formatCents(base)}–${formatCents(base + 1)} each`}
  </p>
)}
```

---

## Warnings

### WR-01: `parseCents` accepts "0" as valid — zero-price items silently added

**File:** `lib/billMath.ts:4-8`

**Issue:** `parseCents('0')` returns `0`, and `parsePriceWithError` in `AddItemsStep.tsx` treats 0 cents as a valid price. A user can add an item with a $0.00 price — this is almost certainly not intended and silently contaminates subtotal calculations (0-price items assigned to all people each pay $0 of that item, but those items do appear in the ResultsStep breakdown, adding noise). The test at line 21 of `billMath.test.ts` explicitly asserts `parseCents('0') === 0` and calls it valid — this test documents a design choice that should be reconsidered.

**Fix:**
```ts
export function parseCents(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const cents = Math.round(parseFloat(trimmed) * 100)
  if (cents === 0) return null // reject zero-price items
  return cents
}
```
Or, add a separate validation layer in `parsePriceWithError` that checks `cents > 0`.

---

### WR-02: `setStep` accepts arbitrary numbers at runtime despite TypeScript union type

**File:** `stores/useBillStore.ts:34`

**Issue:** `setStep: (step: BillState['step']) => void` where `BillState['step']` is `1 | 2 | 3 | 4 | 5`. TypeScript enforces this at compile time, but in `WizardShell.tsx` line 28 the hash value is cast with `Number(match[1]) as 1 | 2 | 3 | 4 | 5` — the `as` assertion bypasses type safety. If someone manually sets the URL hash to `#step-6` (or any non-matching hash that still produces a truthy match group due to regex change), the cast silently passes an out-of-range number to `setStep`, setting `step` to a value the UI cannot render, producing a blank screen.

**Fix:** Validate before casting:
```tsx
const num = Number(match[1])
if (num >= 1 && num <= 5) {
  setStep(num as 1 | 2 | 3 | 4 | 5)
}
```
The regex `/#step-([1-5])/` already restricts to 1–5 digits, but that is a fragile single line of defense. The validation is cheap and explicit.

---

### WR-03: `items.indexOf(item)` called inside render for `data-testid` — O(n) per item

**File:** `components/wizard/AddItemsStep.tsx:151`

**Issue:** `data-testid={`item-row-${items.indexOf(item)}`}` calls `Array.prototype.indexOf` on the full items array inside the map callback. This performs an O(n) linear search for each of the n items, making the overall render O(n²). For a restaurant bill with many items this is harmless in practice, but the value itself can be derived from the map's `index` parameter without cost:

```tsx
{items.map((item, index) => (
  <li key={item.id}>
    {/* ... */}
    <Card
      data-testid={`item-row-${index}`}
      {/* ... */}
    >
```

This is a correctness issue rather than purely a performance issue because `indexOf` returns the index of the first object reference match, and if the `items` array reference changes between renders (it will — Zustand creates new arrays on mutation), the behavior depends on reference identity vs. structural equality. In this codebase `items` are plain objects so `indexOf` uses reference equality, which works, but it is fragile and unidiomatic.

---

### WR-04: `colorIndex` cycles by `people.length % 6` — colors repeat predictably after person removal

**File:** `stores/useBillStore.ts:59`

**Issue:** `colorIndex: s.people.length % 6` assigns the color index based on the current array length at the time of addition. When a person is removed and a new person is added, the new person will get the same `colorIndex` as an existing person if the count coincidentally aligns. Example: Add A(0), B(1), C(2), remove B → [A(0), C(2)], add D → D gets `colorIndex: 2`, same as C. Two people with index 2 both render `bg-emerald-400`. This is a UX bug — avatars are supposed to be distinct.

**Fix:** Track the next color index independently of the array length:
```ts
nextColorIndex: 0, // add to state

addPerson: (name) =>
  set((s) => ({
    people: [
      ...s.people,
      { id: crypto.randomUUID(), name, colorIndex: s.nextColorIndex % 6 },
    ],
    nextColorIndex: s.nextColorIndex + 1,
  })),
```

---

### WR-05: `ResultsStep` tip split display line is missing the amount value

**File:** `components/wizard/ResultsStep.tsx:139-141`

**Issue:** The tip share line in the expanded card breakdown reads:
```tsx
<div className="flex justify-between text-[14px] text-zinc-600">
  <span>Tip: {formatCents(tipShare)}</span>
</div>
```
The `div` is `flex justify-between` but contains only one child `<span>`. There is no right-aligned value. The "Total:" line on line 146 has the same structure and also only has one child. This means `justify-between` does nothing — the content is left-aligned only. More importantly, the tip line label already contains the amount (`Tip: $0.84`), but the breakdown format is inconsistent: item lines have `<span>name</span><span>amount</span>`, while the tip and total lines smash both into a single span. The total line (`Total: $5.84`) duplicates information already shown in the card header, and the tip line label format differs from the item line format. This is a layout inconsistency that will be confusing for users and makes the expanded breakdown harder to scan.

**Fix:** Follow the same two-column pattern as item lines:
```tsx
<div className="flex justify-between text-[14px] text-zinc-600">
  <span>Tip</span>
  <span>{formatCents(tipShare)}</span>
</div>
<Separator />
<div className="flex justify-between text-[14px] font-semibold">
  <span>Total</span>
  <span>{formatCents(personTotal)}</span>
</div>
```

---

### WR-06: `WizardShell` pushes state on every step render, polluting browser history

**File:** `components/wizard/WizardShell.tsx:17-21`

**Issue:** The `useEffect` that syncs step → URL calls `window.history.pushState` on every step change. This means navigating forward through all 5 steps creates 5 history entries. When the user presses the browser back button, it triggers the `hashchange` listener, which calls `setStep` to the previous step. This means the back button correctly navigates between steps — but the user cannot press back to leave the app when at step 1, because each forward navigation created an entry. After completing the flow, the user has 5 extra history entries to traverse before reaching wherever they came from. The correct pattern for single-page wizard flows is `replaceState` for the current step, only using `pushState` for forward navigation and leaving back navigation to the `hashchange` listener.

**Fix:** Use `replaceState` instead of `pushState`:
```tsx
window.history.replaceState(null, '', `#step-${step}`)
```
This updates the URL without creating spurious history entries. The `hashchange` event then only fires on genuine browser navigation.

---

### WR-07: `vitest.config.mts` does not configure `globals: true` — `describe`/`it`/`expect` require explicit imports in every test file

**File:** `vitest.config.mts:7-9`

**Issue:** The test config does not set `globals: true`. This is not a bug in itself — all test files do explicitly import `describe`, `it`, `expect`, etc. from `vitest`. However, the absence of `setupFiles` also means there is no global DOM test setup, so any test that uses browser APIs without mocking (e.g., `crypto.randomUUID()`) depends on jsdom's implementation. This is noted as a design observation rather than an error, since all current tests pass explicit imports. The real gap is: there is no `globals: true` setting and no `setupFiles` configured, meaning test utilities from `@testing-library/jest-dom` are not automatically available. If tests try to use `toBeInTheDocument()` they will fail silently with confusing errors.

**Fix:**
```ts
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```
And create `vitest.setup.ts`:
```ts
import '@testing-library/jest-dom'
```

---

## Info

### IN-01: Duplicate CSS variable definitions — HSL and oklch both define the same tokens

**File:** `app/globals.css:7-70` and `115-182`

**Issue:** CSS custom properties like `--background`, `--foreground`, `--primary`, etc. are defined twice: once in the `@layer base` block (lines 7–70) using HSL format, and again in the `:root` / `.dark` blocks outside the layer (lines 115–182) using oklch format. The second definition (oklch) wins by cascade order and overrides the first (HSL). The HSL block is entirely dead code and causes maintainer confusion — any edits to the HSL block will have no visible effect.

**Fix:** Remove the `@layer base` block containing HSL definitions (lines 7–70) and keep only the oklch definitions in `:root` and `.dark`.

---

### IN-02: `inter` font loaded but never applied correctly

**File:** `app/layout.tsx:8`

**Issue:** (Related to CR-01.) Even if the font conflict is fixed, `const inter = Inter(...)` is an unused import after removing `inter.className` from the body. Dead import.

**Fix:** Remove the `inter` variable and the `Inter` named import after resolving CR-01.

---

### IN-03: Unused `nameInput` variable in test

**File:** `__tests__/AddItemsStep.test.tsx:29`

**Issue:** Line 29 assigns `const nameInput = inputs.find(...)` but `nameInput` is never used. The test proceeds to find inputs by placeholder text on line 31. This is dead code in the test that causes a lint warning and signals the test was partially rewritten.

**Fix:** Remove line 29.

---

### IN-04: `AddItemsStep` test uses fragile element-finding strategy for edit mode

**File:** `__tests__/AddItemsStep.test.tsx:121-125`

**Issue:** The test that verifies clicking a row enters edit mode uses a multi-fallback chain to locate the clickable element:
```tsx
const itemRow = screen.getByText('Coke').closest('[data-testid="item-row"]') ||
  screen.getByTestId?.('item-row-0') ||
  screen.getByText('Coke').closest('li') ||
  screen.getByText('Coke').parentElement!
```
The component uses `data-testid="item-row-0"` (with index suffix) on the `Card`, not `"item-row"`. The first two fallbacks will always fail (first misses the suffix, second calls `.getByTestId` which doesn't have an optional-chaining variant that returns null — it throws). The third fallback (`closest('li')`) succeeds and clicks the `<li>`, not the `<Card>`. The `<li>` does not have an `onClick` handler — the `Card` inside it does. The click propagates to the card, which happens to work, but it is relying on event bubbling through an unrelated DOM level. If the component structure changes this test will break silently (returning a wrong element) or fail with a confusing error.

**Fix:** Add a stable `data-testid="item-row"` to the `Card` element in the component (remove the index suffix which is fragile), and access it directly in tests:
```tsx
// In component:
<Card data-testid="item-row" ...>

// In test:
const itemRow = screen.getAllByTestId('item-row')[0]
fireEvent.click(itemRow)
```

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
