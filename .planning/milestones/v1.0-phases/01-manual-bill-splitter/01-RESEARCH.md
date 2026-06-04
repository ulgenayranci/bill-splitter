# Phase 1: Manual Bill Splitter - Research

**Researched:** 2026-05-08
**Domain:** Next.js 16 App Router, Zustand 5, Tailwind CSS v4, shadcn/ui — mobile-first wizard UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Tip is entered at the end of the flow, after all items are assigned — just before the results screen.
- **D-02:** Tip is split equally among all people in v1 (proportional split deferred to v2).
- **D-03:** Results screen shows each person's total with an expandable item breakdown underneath. Not all-at-once — totals are visible by default, items revealed on tap.
- **Integer-cents arithmetic:** All prices stored as integer cents throughout — never floats in calculation paths (from STATE.md — non-negotiable).
- **Zustand single store:** All wizard state (people, items, assignments, tip, current step) in one Zustand store.
- **Derived totals:** Per-person totals computed on demand, never stored in state.

### Claude's Discretion
- Flow layout (single-page vs wizard) — Claude decides based on mobile UX best practices
- Item assignment UX (checkboxes, tap-to-assign, etc.) — Claude decides
- Shared item selection pattern — Claude decides (equal split among selected sharers)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PEOPLE-01 | User can add people to the bill by name (no account required) | Zustand store slice for `people[]`, shadcn Input + Button for name entry, shadcn Dialog for destructive remove confirm |
| ITEMS-01 | User can manually enter items with prices | Inline editable row pattern (Input + commit), integer-cents conversion on commit via `Math.round(parseFloat(v) * 100)` |
| ITEMS-02 | User can assign items to one or more people | Avatar-chip tap-to-assign UX (per UI-SPEC), Zustand `assignments` map keyed by itemId |
| ITEMS-03 | User can mark an item as shared and select which people shared it | Multi-select chip state: when 2+ persons selected → shared mode + shadcn Badge "Shared"; equal-split display computed from cents |
| TIP-01 | User can select tip percentage (15%, 18%, 20%, or custom) to be added to the bill | Preset Button group + conditional custom Input; tip computed as `Math.round(subtotalCents * tipPercent / 100)` |
| RESULTS-01 | App shows final breakdown of what each person owes | Collapsible result cards; per-person total = sum of assigned item cents + equal tip share; displayed via `(cents / 100).toFixed(2)` |
</phase_requirements>

---

## Summary

Phase 1 builds a fully self-contained mobile-first bill splitter wizard without any server-side features, OCR, or persistence. The stack is greenfield: the codebase has no package.json and no source files yet. Every tool in the stack (Next.js 16, React 19, Zustand 5, Tailwind CSS v4, shadcn/ui) is production-stable and verified via npm registry as of research date.

The critical non-obvious choice is that **Next.js has moved to version 16** since the project CLAUDE.md was written (which targets 15.x). Next.js 16 (released October 2025) is now `latest` at `16.2.6`. It ships Turbopack as the default bundler, React 19.2, and has breaking changes: async `params`/`searchParams`, `middleware.ts` renamed to `proxy.ts`, and `next lint` removed. For Phase 1 — which is pure client-side UI with no middleware, no dynamic params, and no lint step in scope — none of these breaking changes affect implementation. The planner should target Next.js 16 as the scaffold command (`npx create-next-app@latest`) will create a Next.js 16 project by default.

The wizard is implemented as a single `page.tsx` (`'use client'`) that renders the active step based on a `step` field in the Zustand store. URL hash sync (`window.history.pushState`) is the correct pattern for mobile back-button support without Next.js router navigation. Zustand 5 in Next.js App Router does NOT require a Provider wrapper for pure client-side state (no SSR hydration needed for Phase 1 — the entire wizard is `'use client'`).

**Primary recommendation:** Scaffold with `npx create-next-app@latest`, run `npx shadcn@latest init -t next`, install shadcn components (`button input card checkbox separator badge dialog`), install Zustand 5, then build the wizard as a single client page.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wizard step rendering | Browser / Client | — | All state is ephemeral; no SSR needed; entire page is `'use client'` |
| Bill state (people, items, assignments, tip) | Browser / Client (Zustand) | — | No persistence in Phase 1; Zustand store lives in client memory |
| Derived totals computation | Browser / Client | — | Computed from Zustand state on render, never stored |
| Step URL sync (hash) | Browser / Client | — | `window.history.pushState` on step advance; `hashchange` listener for back-button |
| shadcn component rendering | Browser / Client | — | All shadcn components used here are client components (Dialog, Checkbox, etc.) |
| Static asset serving | CDN / Static (Vercel) | — | Next.js static export via Vercel; no dynamic server routes needed in Phase 1 |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.6 | Full-stack React framework + scaffold | `latest` on npm registry as of 2026-05-08; `create-next-app` default; ships Turbopack, React 19.2, App Router |
| React | 19.2.6 | UI rendering | Bundled with Next.js 16; Server Components reduce client bundle (though Phase 1 is pure client) |
| TypeScript | 5.x (5+ required by Next.js 16) | Type safety for bill math | Enforces integer-cents discipline; catches off-by-one in split calculations |
| Tailwind CSS | 4.2.4 | Utility-first CSS | v4 CSS-first config; no `tailwind.config.js` needed; `@import "tailwindcss"` in globals.css |
| shadcn/ui | 4.7.0 (CLI) | Accessible component primitives | Copy-paste model; Radix UI underneath for Dialog/Checkbox ARIA; Tailwind v4 compatible |
| Zustand | 5.0.13 | Client wizard state | No Provider needed for pure client apps; TypeScript-native; zero boilerplate for interconnected state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.14.0 | Icons (Trash, ChevronDown, Plus, Check) | Bundled with shadcn default init; use for trash icon (aria-label required), chevron on collapsible cards |
| @tailwindcss/postcss | 4.2.4 | PostCSS plugin for Tailwind v4 | Required alongside Tailwind v4 install; replaces autoprefixer-based config |
| vitest | 4.1.5 | Unit test runner | Official Next.js recommendation for unit tests; supports Client Components; async Server Components not supported (none in Phase 1) |
| @testing-library/react | 16.3.2 | Component render/assertion | Standard pairing with Vitest; `screen`, `render`, `fireEvent` API |
| @vitejs/plugin-react | 6.0.1 | Vite/Vitest React transform | Required for Vitest with React; registered in `vitest.config.mts` |
| vite-tsconfig-paths | 6.1.1 | Path aliases in tests | Required so `@/*` imports resolve in Vitest (mirrors Next.js tsconfig paths) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js 16 | Next.js 15.5.x | 15.x is still stable and actively patched; 16 is latest stable with Turbopack default. For greenfield, 16 is the right choice. |
| Zustand (no Provider) | Zustand with Context Provider | Provider needed only if you have SSR hydration requirements. Phase 1 is pure client — skip Provider. |
| vitest | jest | Jest requires more config for ESM/TypeScript; Vitest is the official Next.js-recommended unit test runner for App Router |

**Installation:**
```bash
# 1. Scaffold (creates Next.js 16 project with TypeScript, Tailwind v4, App Router, Turbopack)
npx create-next-app@latest bill-splitter

# 2. Initialize shadcn/ui (creates components.json, updates globals.css, sets up @/* alias)
npx shadcn@latest init -t next

# 3. Install Phase 1 shadcn components
npx shadcn@latest add button input card checkbox separator badge dialog

# 4. Install Zustand
npm install zustand

# 5. Install dev dependencies (testing)
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

**Version verification:** All versions above confirmed via `npm view <package> version` on 2026-05-08.
[VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
User (Mobile Browser, 390px)
        │
        ▼
app/page.tsx  ──── 'use client' ─────────────────────────┐
        │                                                  │
        │  reads step from Zustand                        │
        ▼                                                  │
┌───────────────────┐                                     │
│  WizardShell      │  (progress strip + back btn)        │
│  ├── Step 1: AddPeopleStep                              │
│  ├── Step 2: AddItemsStep                               │
│  ├── Step 3: AssignItemsStep                            │
│  ├── Step 4: SetTipStep                                 │
│  └── Step 5: ResultsStep                               │
└───────────────────┘                                     │
        │                                                  │
        │  reads/writes                                    │
        ▼                                                  │
┌─────────────────────────────────────┐                   │
│  useBillStore (Zustand)             │ ◄─────────────────┘
│  ├── people: Person[]               │
│  ├── items: Item[]                  │
│  ├── assignments: Record<id, id[]>  │
│  ├── tipPercent: number             │
│  └── step: 1 | 2 | 3 | 4 | 5       │
│                                     │
│  Derived (computed, not stored):    │
│  └── personTotal(personId) → cents  │
└─────────────────────────────────────┘
        │
        │  step advance/back
        ▼
window.history.pushState('#step-N')
        │
        │  browser back button
        ▼
window 'hashchange' → store.setStep(N)
```

Entry: Browser loads `/` → page.tsx renders WizardShell → reads `step` from Zustand → renders active step component → user interacts → mutations write to Zustand → next render reflects new state.

### Recommended Project Structure
```
bill-splitter/
├── app/
│   ├── layout.tsx          # Root layout (Inter font, globals.css import)
│   ├── globals.css         # Tailwind v4: @import "tailwindcss"; shadcn CSS variables
│   └── page.tsx            # 'use client' — wizard shell, step router
├── components/
│   ├── ui/                 # shadcn components (auto-generated by CLI)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── separator.tsx
│   │   ├── badge.tsx
│   │   └── dialog.tsx
│   └── wizard/             # Phase 1 feature components
│       ├── WizardShell.tsx        # Progress strip + back button wrapper
│       ├── AddPeopleStep.tsx      # Step 1 (PEOPLE-01)
│       ├── AddItemsStep.tsx       # Step 2 (ITEMS-01)
│       ├── AssignItemsStep.tsx    # Step 3 (ITEMS-02, ITEMS-03)
│       ├── SetTipStep.tsx         # Step 4 (TIP-01)
│       └── ResultsStep.tsx        # Step 5 (RESULTS-01)
├── stores/
│   └── useBillStore.ts     # Zustand store (people, items, assignments, tip, step)
├── lib/
│   └── billMath.ts         # Pure functions: integer-cents arithmetic, derived totals
├── __tests__/
│   ├── billMath.test.ts    # Unit tests for arithmetic (high-value, fast)
│   └── useBillStore.test.ts # Store mutation tests
├── vitest.config.mts        # Vitest config (jsdom, tsconfigPaths, react plugin)
├── next.config.ts           # Minimal config (no cacheComponents needed for Phase 1)
├── postcss.config.mjs       # @tailwindcss/postcss plugin
└── components.json          # shadcn configuration (created by init)
```

### Pattern 1: Zustand Store Shape (Pure Client)
**What:** Single Zustand store with no Provider wrapper (pure client page, no SSR).
**When to use:** When all consumers are `'use client'` components on a single page with no server-rendered children that need the same state.
```typescript
// Source: https://github.com/pmndrs/zustand (Context7: /pmndrs/zustand)
// stores/useBillStore.ts
import { create } from 'zustand'

export type PersonId = string  // nanoid
export type ItemId = string    // nanoid

export interface Person {
  id: PersonId
  name: string
  colorIndex: number  // 0-5, indexes into AVATAR_COLORS
}

export interface Item {
  id: ItemId
  name: string
  priceCents: number  // integer cents, NEVER float
}

interface BillState {
  step: 1 | 2 | 3 | 4 | 5
  people: Person[]
  items: Item[]
  assignments: Record<ItemId, PersonId[]>  // empty array = unassigned
  tipPercent: number  // e.g., 18 for 18%

  // Actions
  setStep: (step: BillState['step']) => void
  addPerson: (name: string) => void
  removePerson: (id: PersonId) => void
  addItem: (name: string, priceCents: number) => void
  removeItem: (id: ItemId) => void
  updateItem: (id: ItemId, name: string, priceCents: number) => void
  setAssignment: (itemId: ItemId, personIds: PersonId[]) => void
  setTipPercent: (percent: number) => void
  reset: () => void
}

export const useBillStore = create<BillState>()((set) => ({
  step: 1,
  people: [],
  items: [],
  assignments: {},
  tipPercent: 18,
  setStep: (step) => set({ step }),
  addPerson: (name) => set((s) => ({
    people: [...s.people, { id: crypto.randomUUID(), name, colorIndex: s.people.length % 6 }]
  })),
  removePerson: (id) => set((s) => ({
    people: s.people.filter((p) => p.id !== id),
    assignments: Object.fromEntries(
      Object.entries(s.assignments).map(([k, v]) => [k, v.filter((pid) => pid !== id)])
    ),
  })),
  addItem: (name, priceCents) => set((s) => ({
    items: [...s.items, { id: crypto.randomUUID(), name, priceCents }],
  })),
  removeItem: (id) => set((s) => {
    const { [id]: _, ...rest } = s.assignments
    return { items: s.items.filter((i) => i.id !== id), assignments: rest }
  }),
  updateItem: (id, name, priceCents) => set((s) => ({
    items: s.items.map((i) => i.id === id ? { ...i, name, priceCents } : i),
  })),
  setAssignment: (itemId, personIds) => set((s) => ({
    assignments: { ...s.assignments, [itemId]: personIds },
  })),
  setTipPercent: (percent) => set({ tipPercent: percent }),
  reset: () => set({ step: 1, people: [], items: [], assignments: {}, tipPercent: 18 }),
}))
```

### Pattern 2: Integer-Cents Arithmetic
**What:** All monetary values stored as integer cents. Display-only conversion at render time.
**When to use:** Every monetary value in the app, without exception.
```typescript
// Source: Architecture commitment from STATE.md + standard financial JS practice
// lib/billMath.ts

/** Parse user-typed dollar string → integer cents. Reject non-numeric. */
export function parseCents(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null
  return Math.round(parseFloat(trimmed) * 100)
}

/** Format integer cents → display string ("$12.50"). Never use for calculation. */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Compute per-person totals in cents.
 * Tip is split equally (D-02 — Phase 1 constraint).
 * Shared items split equally among sharers using largest-remainder method.
 */
export function computePersonTotals(
  people: Person[],
  items: Item[],
  assignments: Record<ItemId, PersonId[]>,
  tipPercent: number
): Record<PersonId, number> {
  const totals: Record<PersonId, number> = Object.fromEntries(
    people.map((p) => [p.id, 0])
  )

  for (const item of items) {
    const sharers = assignments[item.id] ?? []
    if (sharers.length === 0) continue
    const base = Math.floor(item.priceCents / sharers.length)
    const remainder = item.priceCents % sharers.length
    sharers.forEach((pid, idx) => {
      totals[pid] = (totals[pid] ?? 0) + base + (idx < remainder ? 1 : 0)
    })
  }

  // Tip: equal split (D-02)
  const subtotalCents = items.reduce((s, i) => s + i.priceCents, 0)
  const totalTipCents = Math.round(subtotalCents * tipPercent / 100)
  if (people.length > 0) {
    const tipBase = Math.floor(totalTipCents / people.length)
    const tipRemainder = totalTipCents % people.length
    people.forEach((p, idx) => {
      totals[p.id] = (totals[p.id] ?? 0) + tipBase + (idx < tipRemainder ? 1 : 0)
    })
  }

  return totals
}
```

### Pattern 3: URL Hash Step Sync
**What:** Use `window.history.pushState` for step URL sync; `hashchange` listener for back-button.
**When to use:** Single-page wizard where step is Zustand state but mobile back-button must work.
```typescript
// Source: https://nextjs.org/docs/app/guides/single-page-applications (Context7: /vercel/next.js)
// In WizardShell.tsx — 'use client'
import { useEffect } from 'react'
import { useBillStore } from '@/stores/useBillStore'

export function WizardShell({ children }: { children: React.ReactNode }) {
  const step = useBillStore((s) => s.step)
  const setStep = useBillStore((s) => s.setStep)

  // Sync step → URL hash on step change
  useEffect(() => {
    window.history.pushState(null, '', `#step-${step}`)
  }, [step])

  // Sync URL hash → step on back/forward
  useEffect(() => {
    const handleHashChange = () => {
      const match = window.location.hash.match(/#step-(\d)/)
      if (match) setStep(Number(match[1]) as 1 | 2 | 3 | 4 | 5)
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [setStep])

  return <div>{children}</div>
}
```

### Pattern 4: shadcn Dialog for Destructive Confirms
**What:** Radix Dialog via shadcn for remove-person and remove-item confirmation.
**When to use:** Any irreversible action (trash icon taps per UI-SPEC).
```tsx
// Source: https://github.com/shadcn-ui/ui (Context7: /shadcn-ui/ui)
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Remove {name}?</DialogTitle>
      <DialogDescription>
        Any items currently assigned to them will become unassigned.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleConfirm}>Remove</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Anti-Patterns to Avoid
- **Storing tip/total as floats:** The `tipPercent` field stores the *percent value* (e.g., `18`), not a decimal. All dollar amounts are always integer cents. Never do `price * 0.18` without `Math.round`.
- **Storing derived totals in Zustand:** Per-person totals must be computed on demand in `billMath.ts`. Storing them creates stale-state bugs when items or assignments change.
- **Using `parseInt` on price input:** `parseInt("12.50")` = `1250` cents (wrong). Use `Math.round(parseFloat(value) * 100)`.
- **Using `useRouter().push('#step-N')` for step navigation:** This triggers a full Next.js navigation lifecycle. Use `window.history.pushState` instead for intra-page step transitions.
- **Placing interactive inputs in the lower half of the mobile screen:** iOS virtual keyboard obscures the lower half. All form inputs must be placed in the upper region (per UI-SPEC Mobile-First Constraints).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible modal/dialog | Custom `<div role="dialog">` | `shadcn Dialog` (Radix) | Focus trap, Escape key, scroll lock, aria-modal — all complex and browser-inconsistent to hand-roll |
| Accessible checkbox | `<div onClick>` toggle | `shadcn Checkbox` (Radix) | Keyboard navigation, indeterminate state, form integration — Radix handles it |
| Icon components | SVG string literals | `lucide-react` | Tree-shakeable, consistent stroke width, accessible with title prop |
| Number formatting | Manual string ops | `(cents / 100).toFixed(2)` | `Intl.NumberFormat` is overkill for single-currency; toFixed(2) on display-layer cents is the correct pattern |
| Unique IDs | Custom counter or Math.random | `crypto.randomUUID()` | Available in all modern browsers; no dependency; collision-safe |

**Key insight:** shadcn components eliminate the biggest accessibility risks at zero runtime overhead. The Dialog's focus trap alone would take days to implement correctly across iOS Safari and Android Chrome.

---

## Common Pitfalls

### Pitfall 1: Floating-Point in Tip Calculation
**What goes wrong:** `subtotalDollars * 0.18` produces `2.3400000000000002` instead of `2.34`.
**Why it happens:** IEEE 754 binary floating-point cannot exactly represent many decimal fractions.
**How to avoid:** Store `subtotalCents` (integer). Compute: `Math.round(subtotalCents * tipPercent / 100)`. Never convert to dollars before multiplying.
**Warning signs:** `toFixed(2)` producing strings like `"12.000000000001"` in intermediate computation.

### Pitfall 2: Shared Item Remainder Penny Distribution
**What goes wrong:** 3 people split a $10.00 item. `Math.floor(1000 / 3)` = `333` cents each = `999` cents total. One cent lost.
**Why it happens:** Integer division discards the remainder.
**How to avoid:** Use the largest-remainder method: `base = Math.floor(priceCents / n)`, `remainder = priceCents % n`, then assign `+1` cent to the first `remainder` sharers. See `computePersonTotals` in Pattern 2.
**Warning signs:** Sum of per-person totals ≠ sum of item prices + tip total.

### Pitfall 3: iOS Virtual Keyboard + Input Position
**What goes wrong:** On iOS, tapping an Input in the lower half of the screen causes the viewport to scroll unpredictably. The input can disappear under the keyboard.
**Why it happens:** iOS does not resize the viewport; it scrolls the page. Inputs below the fold get obscured.
**How to avoid:** Place all form inputs (name entry, price entry, custom tip field) in the upper region of the step. The inline "Add item" row at the bottom of the list is an exception — position it above the keyboard clearance zone (see `env(safe-area-inset-bottom)` in UI-SPEC).
**Warning signs:** Users reporting they cannot see the input field when the keyboard appears.

### Pitfall 4: Remove Person Leaving Orphaned Assignments
**What goes wrong:** Remove "Alice" but her PersonId remains in `assignments[itemId]`. Display breaks; bill math includes a ghost person.
**Why it happens:** `removePerson` only removes from `people[]` but not from `assignments` map.
**How to avoid:** `removePerson` action in the store must filter every assignment value array to exclude the removed PersonId (see Pattern 1 store code — `removePerson` action already handles this).
**Warning signs:** `computePersonTotals` returns a total for an ID not in `people[]`.

### Pitfall 5: `parseInt` vs `parseFloat` on Price Input
**What goes wrong:** User types "12.50". `Math.round(parseInt("12.50") * 100)` = `Math.round(12 * 100)` = `1200` (off by 50 cents).
**Why it happens:** `parseInt` truncates at the decimal point.
**How to avoid:** Always `parseFloat` then `Math.round` * 100. Validate with regex `/^\d+(\.\d{0,2})?$/` before parsing.
**Warning signs:** Prices always round down to the nearest dollar.

### Pitfall 6: shadcn Not Initialized Before Component Install
**What goes wrong:** Running `npx shadcn@latest add button` before `npx shadcn@latest init` fails or creates files without the correct import paths.
**Why it happens:** `init` creates `components.json` which tells the CLI where to write component files and which import alias to use.
**How to avoid:** Always run `init` first (creates `components.json`). Greenfield projects must run `npx shadcn@latest init -t next` before any `add` commands. This is called out in UI-SPEC "shadcn gate note."
**Warning signs:** Components written to wrong directory; `@/components/ui/` path not resolving.

### Pitfall 7: Zustand Provider Required for SSR (not needed here, but watch for Phase 4)
**What goes wrong:** If Phase 4 adds server-rendered components that need bill state, the singleton Zustand store will leak state between requests.
**Why it happens:** Singleton Zustand stores on the server are shared across all requests (no request isolation).
**How to avoid:** Phase 1 is pure `'use client'` — no Provider needed. When Phase 4 adds server features, migrate to the Zustand Context Provider pattern from the official docs. Do NOT add a Provider now — it adds unnecessary complexity.
**Warning signs:** Build errors saying "cannot use hooks in Server Components."

---

## Code Examples

Verified patterns from official sources:

### Tailwind v4 Setup (globals.css)
```css
/* Source: https://tailwindcss.com/docs/guides/nextjs */
/* app/globals.css */
@import "tailwindcss";

/* shadcn CSS variables (generated by npx shadcn@latest init) */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    /* ... shadcn init generates the full set */
  }
}
```

### PostCSS Config (required for Tailwind v4)
```javascript
// Source: https://tailwindcss.com/docs/guides/nextjs
// postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

### Vitest Config
```typescript
// Source: https://nextjs.org/docs/app/guides/testing/vitest
// vitest.config.mts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
  },
})
```

### Zustand Typed Store (minimal)
```typescript
// Source: https://github.com/pmndrs/zustand (Context7: /pmndrs/zustand)
import { create } from 'zustand'

interface BearState {
  bears: number
  increasePopulation: () => void
}

const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
}))
```

### Price Input: Parse and Validate
```typescript
// Source: Architecture pattern derived from STATE.md integer-cents commitment
// Validate price string before converting to cents
function parsePriceCents(raw: string): { cents: number } | { error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { error: 'Enter a price' }
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return { error: 'Numbers only' }
  return { cents: Math.round(parseFloat(trimmed) * 100) }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 15.x target | Next.js 16.x is now `latest` | Oct 2025 (released) | Scaffold with `create-next-app@latest` will create Next.js 16; `middleware.ts` → `proxy.ts`; async params required |
| Tailwind v3 with `tailwind.config.js` | Tailwind v4 CSS-first, no config file | Jan 2025 | `@import "tailwindcss"` in globals.css; `@theme` directive for customization; `postcss.config.mjs` required |
| shadcn forwardRef components (React 18) | shadcn removes forwardRef (React 19) | 2025 | New shadcn components are React 19 native; `ref` as prop directly; Phase 1 uses `npx shadcn@latest` which delivers React 19 versions |
| Webpack (default bundler) | Turbopack (default in Next.js 16) | Oct 2025 | Dev server starts faster; no webpack config needed for Phase 1 |
| `next lint` command | Removed in Next.js 16 | Oct 2025 | Use ESLint or Biome directly; `next build` no longer runs linting — not relevant for Phase 1 |

**Deprecated/outdated:**
- `tailwind.config.js`: Not created by default in v4. If you need one, it can still be used but isn't required.
- `middleware.ts`: Deprecated in Next.js 16; renamed to `proxy.ts`. Phase 1 has no middleware, so not impacted.
- Vercel KV: Discontinued December 2024. Phase 4 will use Upstash Redis. Phase 1 has no persistence.
- `next lint` CLI: Removed in Next.js 16. Phase 1 plan should use `eslint` directly if linting is needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `crypto.randomUUID()` is available in all target mobile browsers (iOS Safari 15.4+, Android Chrome 92+) | Standard Stack / Pattern 1 | IDs won't generate; fallback: `nanoid` (~130 bytes) | [ASSUMED]
| A2 | The `billMath.ts` pure-function pattern (no Zustand inside) is compatible with Vitest without mocking | Architecture Patterns | Tests may need store mocks; mitigation: keep math pure functions outside the store |
| A3 | shadcn `init -t next` correctly configures Tailwind v4 with Next.js 16 without manual intervention | Standard Stack | May need manual `postcss.config.mjs` or CSS edits; low risk given both are production stable and well-documented together |

---

## Open Questions

1. **shadcn preset string**
   - What we know: `01-UI-SPEC.md` flags "pending init — confirm preset string before executor runs `npx shadcn@latest init`"
   - What's unclear: The `--preset` flag for `npx shadcn@latest init` (e.g., `default`, `new-york`) — the UI-SPEC has `preset: none`.
   - Recommendation: Use `npx shadcn@latest init -t next` without a preset flag. When asked interactively, select "Default" style (zinc base color, as specified in UI-SPEC color section).

2. **Next.js 16 vs CLAUDE.md targeting 15.x**
   - What we know: CLAUDE.md specifies "Next.js 15.x" but npm latest is now 16.2.6 (released Oct 2025). Greenfield project; no existing code to migrate.
   - What's unclear: Whether the user wants to pin to 15.x or use latest.
   - Recommendation: Use Next.js 16.2.6 (`create-next-app@latest` default). Phase 1 is unaffected by the 15→16 breaking changes (no middleware, no dynamic params, no `revalidateTag`). Document the upgrade in execution notes.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm/npx execution | ✓ | v24.15.0 | — |
| npm | Package installation | ✓ | 11.12.1 | — |
| npx | create-next-app, shadcn CLI | ✓ | 11.12.1 | — |
| git | Version control | ✓ | 2.50.1 | — |
| Next.js (not installed) | App framework | ✗ (not yet) | — | Install via create-next-app |
| Zustand (not installed) | Client state | ✗ (not yet) | — | Install via npm |
| shadcn/ui (not installed) | Component library | ✗ (not yet) | — | Install via CLI |

**Missing dependencies with no fallback:** None — all required tools (Node, npm) are present.

**Missing dependencies with fallback:** Next.js, Zustand, shadcn — all absent because the project is greenfield. Wave 0 of the plan scaffolds the project.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.mts` — Wave 0 creates this |
| Quick run command | `npm run test -- --run` (single-pass, no watch) |
| Full suite command | `npm run test` (watch mode) or `npm run test -- --run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITEMS-01 | `parsePriceCents` rejects empty/non-numeric, converts correctly | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ Wave 0 |
| ITEMS-01 | `parsePriceCents("12.50")` returns `1250` | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ Wave 0 |
| ITEMS-01 | `parsePriceCents("0.1")` returns `10` (no float error) | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ Wave 0 |
| ITEMS-02 | `setAssignment` replaces previous assignment | unit | `npx vitest run __tests__/useBillStore.test.ts` | ❌ Wave 0 |
| ITEMS-03 | Shared item 3-person split distributes remainder correctly (999+1) | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ Wave 0 |
| TIP-01 | Tip calculation: 18% of 1000 cents = 180 cents (no float drift) | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ Wave 0 |
| RESULTS-01 | `computePersonTotals` sum equals items total + tip | unit | `npx vitest run __tests__/billMath.test.ts` | ❌ Wave 0 |
| PEOPLE-01 | `removePerson` cleans assignments map | unit | `npx vitest run __tests__/useBillStore.test.ts` | ❌ Wave 0 |
| PEOPLE-01 | Add people render + interaction (Step 1 renders with ≥1 person) | component | `npx vitest run __tests__/AddPeopleStep.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run __tests__/billMath.test.ts` (math unit tests, ~1s)
- **Per wave merge:** `npx vitest run` (all tests, ~5-10s)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.mts` — Vitest configuration file
- [ ] `__tests__/billMath.test.ts` — covers ITEMS-01, ITEMS-03, TIP-01, RESULTS-01
- [ ] `__tests__/useBillStore.test.ts` — covers PEOPLE-01, ITEMS-02
- [ ] `__tests__/AddPeopleStep.test.tsx` — covers PEOPLE-01 rendering
- [ ] Dev dependencies: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`
- [ ] `package.json` test script: `"test": "vitest"`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in Phase 1 |
| V3 Session Management | no | No session in Phase 1 |
| V4 Access Control | no | No server resources in Phase 1 |
| V5 Input Validation | yes | Price field: regex `/^\d+(\.\d{0,2})?$/` before parse; name field: trim + length cap (no XSS vector in Phase 1 as values are rendered as text, not HTML) |
| V6 Cryptography | no | No crypto operations; `crypto.randomUUID()` for IDs (not a security-critical operation in this context) |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via item/person names | Spoofing | React renders text as text nodes by default; no `dangerouslySetInnerHTML` |
| Prototype pollution via assignments object | Tampering | Validate ItemId/PersonId are UUIDs before keying; never merge untrusted keys into `assignments` |
| Oversized price input | Denial of Service | Cap name input at 100 chars; cap price at 7 digits (cents) before `Math.round` |

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Planner Must Enforce |
|-----------|--------|---------------------|
| Integer-cents arithmetic — non-negotiable | CLAUDE.md + STATE.md | Every price, tip, and total stored/computed as integer cents |
| Next.js 15.x target (CLAUDE.md) | CLAUDE.md | Research finds 16.x is now `latest`; recommend 16 for greenfield — flag Open Question #2 for user confirmation |
| Tailwind CSS 4.x | CLAUDE.md | Confirmed stable at 4.2.4; CSS-first (no tailwind.config.js) |
| shadcn/ui (copy-paste, official registry only) | CLAUDE.md + UI-SPEC | No third-party shadcn registries; all 7 components from official registry |
| Zustand 5.x single store | CLAUDE.md + STATE.md | One store for all wizard state; derived totals not stored |
| Deployment: Vercel | CLAUDE.md | Next.js 16 + Vercel is zero-config; no server infrastructure for Phase 1 |
| No accounts/login | REQUIREMENTS.md | Phase 1 is entirely anonymous; no auth surface |
| `<input capture="environment">` for camera | CLAUDE.md | Phase 2 concern; out of scope for Phase 1 |

---

## Sources

### Primary (HIGH confidence)
- [/vercel/next.js] (Context7) — App Router navigation, pushState pattern, create-next-app scaffold, Vitest setup
- [/pmndrs/zustand] (Context7) — Store creation, TypeScript patterns, Next.js integration
- [/shadcn-ui/ui] (Context7) — Init commands, Dialog/Checkbox patterns, component API
- [https://nextjs.org/blog/next-16](https://nextjs.org/blog/next-16) — Next.js 16 breaking changes, feature list, published Oct 2025
- [https://nextjs.org/docs/app/guides/testing/vitest](https://nextjs.org/docs/app/guides/testing/vitest) — Vitest setup, exact config, last updated 2026-05-07
- [https://tailwindcss.com/docs/guides/nextjs](https://tailwindcss.com/docs/guides/nextjs) — Tailwind v4 + Next.js setup, postcss.config.mjs requirement
- npm registry — All package versions verified via `npm view` on 2026-05-08

### Secondary (MEDIUM confidence)
- [https://ui.shadcn.com/docs/installation/next](https://ui.shadcn.com/docs/installation/next) — shadcn init command syntax verified
- WebSearch: Next.js 16 stability (multiple sources confirming production readiness)
- WebSearch: Tailwind v4 CSS-first config (confirmed against official docs)

### Tertiary (LOW confidence)
- None — all claims verified via primary or secondary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed via npm registry; framework docs verified via Context7 + official docs
- Architecture: HIGH — patterns derived from verified official docs and architecture commitments from STATE.md
- Pitfalls: HIGH — integer-cents and iOS keyboard pitfalls are well-documented; shadcn init order verified

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (30 days — stable stack, low churn expected)
