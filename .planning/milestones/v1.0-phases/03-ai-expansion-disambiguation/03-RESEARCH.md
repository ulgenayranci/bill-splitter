# Phase 3: AI Expansion + Disambiguation — Research

**Researched:** 2026-05-10
**Domain:** GPT-4o-mini text API, Next.js Route Handlers, Zustand store extension, React local state machine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Two-step architecture — OCR and expansion are separate API calls.
- Step 1: Existing `/api/ocr` route extracts raw item names and prices (unchanged from Phase 2).
- Step 2: New `/api/expand` route takes the list of raw items and returns expanded names with confidence scores.
- The user sees two loading phases: "Scanning bill…" (OCR), then "Expanding names…" (expansion). Both use the existing `OcrLoadingOverlay` pattern.

**D-02:** The `/api/expand` route accepts `{ items: [{ name: string, priceCents: number }] }` and returns `{ items: [{ rawName: string, displayName: string, priceCents: number, confidence: 'high' | 'low' | 'ambiguous' }] }`.
- `high` — AI is confident (no badge)
- `low` — AI made an educated guess (orange "Review" badge)
- `ambiguous` — AI cannot determine (orange "Review" badge, same treatment as low)

**D-03:** On expansion timeout or API failure, the raw abbreviated names from OCR are kept as-is and inserted into the store (still editable). No dead end.

**D-04:** Items with `confidence: 'low' | 'ambiguous'` show an orange "Review" badge on their item row.

**D-05:** No forced modal — the item list appears immediately after expansion. Users fix items on their own schedule.

**D-06:** Tapping a "Review" item opens a dialog with two options: "Type name" or "Take menu photo".

**D-07:** The "Review" badge is dismissed when the user saves any edit on that item.

**D-08:** Menu photo flow — camera opens, photo sent to `/api/clarify` with the raw name as context, AI returns best guess, result auto-populates the edit field.

**D-09:** If `/api/clarify` cannot determine the name, it returns whatever it found. The edit field is populated with this result and the user edits manually — no error screen.

**D-10:** Menu photos are NOT stored in state. Used once for name resolution and discarded.

### Claude's Discretion

- Exact prompt design for `/api/expand` and `/api/clarify`
- Loading state label for the expansion phase ("Expanding names…" or similar)
- Exact visual styling of the "Review" badge (orange, consistent with the existing design system)
- Whether to reuse `OcrLoadingOverlay` for the expansion loading phase or show a lighter inline spinner
- Dialog design for the disambiguation choices (reuse existing `Dialog` primitive from shadcn/ui)

### Deferred Ideas (OUT OF SCOPE)

None surfaced during discussion.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OCR-02 | AI expands abbreviated item names into readable names (e.g. "CHKN SAND" → "Chicken Sandwich") | `/api/expand` route with GPT-4o-mini text API + json_schema strict output; `Item` type extended with `confidence` + `rawName`; `expandStatus` state in Zustand |
| OCR-04 | When items are ambiguous, user can take a menu photo OR enter the name manually | `/api/clarify` route with GPT-4o-mini vision API; disambiguation `Dialog` component; hidden `<input type="file" capture="environment">` in dialog; local `dialogState` machine in `AddItemsStep` |

</phase_requirements>

---

## Summary

Phase 3 adds two new API routes and extends one existing component. The core pattern is already proven: the OCR route (`app/api/ocr/route.ts`) demonstrates the exact structure needed — OpenAI SDK with `json_schema` strict response format, runtime validation, AbortController on the client, and graceful toast fallback on failure. Both new routes follow this pattern directly.

The Zustand store needs a modest extension: the `Item` interface gains `confidence`, `rawName`, and a dismissal flag; a new `expandStatus` field and matching setter parallel the existing `ocrStatus`. The `updateItem()` action already exists and can clear confidence on save without a new action.

The disambiguation dialog introduces the only genuinely new pattern in the phase: a local React state machine with four states (`choices`, `editing`, `clarifying`, `clarify-done`). This lives entirely in component-local state — nothing about the dialog's internal view reaches Zustand. The `@base-ui/react/dialog` primitive (already in use in `dialog.tsx`) handles open/close; the internal view transitions are plain `useState`.

**Primary recommendation:** Follow the `/api/ocr` route pattern exactly for both new routes. Extend the `Item` interface with `confidence: 'high' | 'low' | 'ambiguous'` and `rawName: string` (optional, only present after OCR+expand). Add `expandStatus` to the store. Build the disambiguation dialog as a self-contained component with local state.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Abbreviation expansion (text → text) | API / Backend (`/api/expand`) | — | LLM API key must stay server-side; no NEXT_PUBLIC_ prefix |
| Menu photo clarification (image + context → text) | API / Backend (`/api/clarify`) | — | Same reason; image data URI posted from client, processed server-side |
| Confidence badge display | Frontend (AddItemsStep component) | — | Purely presentational, driven by item.confidence in store |
| Disambiguation dialog UX | Frontend (AddItemsStep or extracted DisambiguationDialog component) | — | Local state machine, no server side needed |
| expandStatus tracking | Client state (Zustand store) | — | Drives overlay visibility; mirrors ocrStatus pattern |
| Item confidence/rawName persistence | Client state (Zustand store) | — | Session-only; survives component remounts but not page reload |

---

## Standard Stack

### Core (all already installed — no new installs needed for Phase 3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | 6.37.0 | `/api/expand` and `/api/clarify` API calls | Already installed, used by `/api/ocr`; text completion (no vision needed for `/api/expand`) [VERIFIED: package.json] |
| zustand | 5.0.13 | `expandStatus` + extended `Item` type | Already installed; established pattern [VERIFIED: package.json] |
| @base-ui/react | 1.4.1 | Dialog primitive for disambiguation dialog | Already installed; `dialog.tsx` already wraps it [VERIFIED: package.json] |
| lucide-react | 1.14.0 | `LoaderCircle`, `Pencil`, `Camera` icons | Already installed; used throughout [VERIFIED: package.json] |

**No new npm installs required for Phase 3.** All dependencies are already in `node_modules`. [VERIFIED: package.json + node_modules inspection]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| json_schema strict output for `/api/expand` | Free-form JSON + manual parse | Strict schema eliminates parse-time surprises; same pattern as OCR route |
| Local React state machine for dialog | Zustand slice | Dialog state is ephemeral and per-item; no reason to persist it across the session |
| Reusing `OcrLoadingOverlay` with `message` prop | New `ExpandLoadingOverlay` component | Reuse avoids duplication; UI-SPEC confirms identical visual treatment is correct |

---

## Architecture Patterns

### System Architecture Diagram

```
User taps "Scan bill"
        │
        ▼
[AddItemsStep] compress image
        │
        ▼
[/api/ocr] ──────── GPT-4o-mini (vision)
        │                   │
        │          { items: [{name, priceCents}] }
        │
        ▼
[AddItemsStep] ocrStatus='done'
        │         expandStatus='loading'
        ▼
[/api/expand] ───── GPT-4o-mini (text)
        │                   │
        │        { items: [{rawName, displayName,
        │                   priceCents, confidence}] }
        │
        ├── success ──► store.setItems(expanded)
        │               expandStatus='done'
        │               "Review" badges appear
        │
        └── error ───► store keeps raw OCR names
                        expandStatus='error'
                        toast: "Couldn't expand..."

User taps "Review" item row
        │
        ▼
[DisambiguationDialog] dialogState='choices'
        │
        ├── "Type name" ──► dialogState='editing'
        │                   Input pre-filled with displayName
        │                   "Save name" → updateItem() → badge dismissed
        │
        └── "Take menu photo" ──► <input capture="environment">
                                  dialogState='clarifying'
                                        │
                                  [/api/clarify] ─── GPT-4o-mini (vision)
                                        │                   │
                                        │            { displayName }
                                        │
                                  dialogState='clarify-done'
                                  Input pre-filled with result
                                  "Save name" → updateItem() → badge dismissed
```

### Recommended Project Structure

```
app/
├── api/
│   ├── ocr/route.ts          # Phase 2 — unchanged
│   ├── expand/route.ts       # Phase 3 — NEW
│   └── clarify/route.ts      # Phase 3 — NEW
stores/
└── useBillStore.ts           # Extended: Item type + expandStatus
components/
└── wizard/
    ├── AddItemsStep.tsx       # Extended: expansion trigger + Review badges + dialog
    ├── OcrLoadingOverlay.tsx  # Extended: message prop added
    └── DisambiguationDialog.tsx  # NEW (or inline in AddItemsStep — planner decides)
__tests__/
├── expandRoute.test.ts       # NEW
├── clarifyRoute.test.ts      # NEW
└── AddItemsStep.test.tsx     # Extended: Phase 3 interactions
```

### Pattern 1: Route Handler (text completion, no vision)

`/api/expand` uses text-only GPT-4o-mini — no image URL in messages. Same structure as `/api/ocr` but simpler input/output.

```typescript
// Source: app/api/ocr/route.ts (established pattern in codebase)
// VERIFIED: codebase read

export const maxDuration = 30

export async function POST(request: Request) {
  // 1. Parse + validate body
  // 2. Call openai.chat.completions.create with:
  //    - model: 'gpt-4o-mini'
  //    - messages: [{ role: 'user', content: EXPAND_PROMPT + JSON.stringify(items) }]
  //    - response_format: { type: 'json_schema', json_schema: { strict: true, ... } }
  // 3. Validate response shape at runtime
  // 4. Return NextResponse.json({ items: validated })
  // 5. catch: console.error (server-only), return 500 with generic message
}
```

**json_schema for `/api/expand` response:**
```typescript
// ASSUMED — exact schema to design during implementation
{
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rawName:     { type: 'string' },
          displayName: { type: 'string' },
          priceCents:  { type: 'integer' },
          confidence:  { type: 'string', enum: ['high', 'low', 'ambiguous'] },
        },
        required: ['rawName', 'displayName', 'priceCents', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
}
```

**Critical:** `priceCents` passes through unchanged from OCR output. The expand route must echo back the exact integer the caller sent — it does not re-parse or re-extract prices.

### Pattern 2: Route Handler (vision, image + text context)

`/api/clarify` sends both a text prompt and an image URL — same structure as `/api/ocr`.

```typescript
// Source: app/api/ocr/route.ts — same messages content array pattern
// VERIFIED: codebase read

messages: [
  {
    role: 'user',
    content: [
      { type: 'text', text: `Context: "${rawName}". What is the full name of this item on the menu? Return only: { "displayName": string }` },
      { type: 'image_url', image_url: { url: image, detail: 'high' } },
    ],
  },
]
```

**Input validation:** Same `DATA_URI_RE` pattern as OCR route. Additionally validate `rawName` is a non-empty string (max 200 chars). [VERIFIED: app/api/ocr/route.ts]

**D-09 handling:** If GPT returns an empty string or the parse fails, return `{ displayName: '' }` with status 200 — not a 500. The client populates the edit field with the expansion best guess as fallback.

### Pattern 3: Zustand Store Extension

**Current `Item` interface:**
```typescript
// Source: stores/useBillStore.ts — VERIFIED
export interface Item {
  id: ItemId
  name: string
  priceCents: number
}
```

**Phase 3 extension:**
```typescript
export interface Item {
  id: ItemId
  name: string
  priceCents: number
  // Phase 3 additions:
  rawName?: string                              // OCR raw abbreviation (undefined for manual items)
  confidence?: 'high' | 'low' | 'ambiguous'    // undefined = high (manual items, pre-Phase 3 items)
  reviewed?: boolean                            // true after updateItem() called on this item
}
```

Items added manually via `addItem()` do not set these fields — they are treated as high-confidence by default. The badge renders only when `confidence === 'low' || confidence === 'ambiguous'` AND `reviewed !== true`. [VERIFIED: 03-UI-SPEC.md]

**New store fields:**
```typescript
expandStatus: 'idle' | 'loading' | 'done' | 'error'
setExpandStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void
```

**`updateItem()` must clear the review badge.** Two approaches:
1. `updateItem()` sets `reviewed: true` on the item — badge condition checks `reviewed !== true`
2. `updateItem()` sets `confidence: 'high'` on the item — simpler, no new field

The UI-SPEC says "badge dismissed when user saves any edit" and "set `item.reviewed = true` OR derive dismissal from the save action". Approach 2 (set confidence to 'high') is simpler and avoids a new field. The planner should choose — both are valid. [CITED: 03-UI-SPEC.md Surface F]

**`addExpandedItems()` action (or batch update approach):** After `/api/expand` returns, the client needs to replace the raw OCR items with expanded items. Two approaches:
1. New action `setItems(items: Item[])` — replaces the entire items array
2. New action `updateItemsFromExpansion(expanded: ExpandedItem[])` — targeted update matching by name/order

Approach 1 is simpler. The expand response preserves `priceCents` order, so a direct `setItems` on the OCR results is safe. The planner should decide. [ASSUMED — based on store architecture, not explicitly decided in CONTEXT.md]

### Pattern 4: Disambiguation Dialog Local State Machine

The dialog has four internal states managed by `useState`. This is entirely component-local — no Zustand.

```typescript
// VERIFIED: 03-UI-SPEC.md Surface G
type DialogState = 'choices' | 'editing' | 'clarifying' | 'clarify-done'

// Local state:
const [dialogOpen, setDialogOpen] = useState(false)
const [activeItem, setActiveItem] = useState<Item | null>(null)
const [dialogState, setDialogState] = useState<DialogState>('choices')
const [editedName, setEditedName] = useState('')
const menuFileInputRef = useRef<HTMLInputElement>(null)
const clarifyAbortRef = useRef<AbortController | null>(null)
```

**State transition rules (from UI-SPEC):**
- Row tap (Review badge visible) → `setDialogOpen(true)`, `setActiveItem(item)`, `setDialogState('choices')`, `setEditedName(item.name)`
- "Type name" tap → `setDialogState('editing')`
- "← Back" tap → `setDialogState('choices')`
- "Take menu photo" → trigger `menuFileInputRef`, on file change → `setDialogState('clarifying')` → fetch `/api/clarify` → `setDialogState('clarify-done')`, `setEditedName(result || activeItem.name)`
- "Save name" → `updateItem(activeItem.id, editedName, activeItem.priceCents)` → `setDialogOpen(false)`
- Dialog X close → `setDialogOpen(false)` (badge remains — D-07)
- Re-tap a Review row → reset to `'choices'` state (prior editing state discarded)

**`@base-ui/react/dialog` open/close API:**
```typescript
// VERIFIED: components/ui/dialog.tsx
// The Dialog wrapper accepts open + onOpenChange (same as Radix UI surface API)
<Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false) }}>
```

### Anti-Patterns to Avoid

- **Storing dialog state in Zustand:** Dialog state is ephemeral and per-interaction. Zustand is for session state. Keep dialog local.
- **Storing menu photo data URI in Zustand:** D-10 explicitly forbids this. The image is used once and discarded.
- **Returning `confidence` as a numeric score (0–1):** The contract is a string enum: `'high' | 'low' | 'ambiguous'`. The LLM decides which bucket.
- **Mutating `priceCents` in `/api/expand`:** The expand route echoes back the exact integer from the request. Prices are NOT re-parsed from the image at this stage.
- **Using NEXT_PUBLIC_ for OPENAI_API_KEY:** Server-only. See Phase 2 security constraints.
- **Blocking on expansion failure:** D-03 is explicit — expansion error falls back to raw names, not a dead-end error screen.
- **`vi.mock` without `vi.resetModules()` in route tests:** The OCR test pattern requires `vi.resetModules()` in `beforeEach` when using dynamic imports. Follow the same pattern in `expandRoute.test.ts` and `clarifyRoute.test.ts`. [VERIFIED: `__tests__/ocrRoute.test.ts`]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON from LLM | Custom JSON extraction regex | `response_format: { type: 'json_schema', strict: true }` | GPT-4o-mini guaranteed to return valid JSON matching schema; no parse-time surprises |
| Dialog open/close state | Custom visibility toggling | `@base-ui/react/dialog` via `dialog.tsx` | Accessible focus trapping, scroll locking, backdrop click dismissal — all handled |
| Loading overlay | New component | Extend `OcrLoadingOverlay` with `message` prop | Identical visual; one source of truth for the portal + mounted-flag pattern |
| Image upload for menu photo | Custom file handling | Native `<input type="file" capture="environment">` | Same pattern as OCR scan; no react-webcam needed |
| Abbreviation expansion | Local dictionary lookup | GPT-4o-mini | Receipt abbreviations are restaurant-specific and unpredictable; LLM handles the long tail |

---

## Common Pitfalls

### Pitfall 1: `confidence` field in json_schema strict mode requires `enum` constraint

**What goes wrong:** If you specify `confidence: { type: 'string' }` without `enum: ['high', 'low', 'ambiguous']`, GPT-4o-mini will still return strings but could return values outside the expected set (e.g. "medium", "uncertain").

**Why it happens:** json_schema strict mode enforces schema shape but not string content unless `enum` is specified.

**How to avoid:** Include `enum: ['high', 'low', 'ambiguous']` in the `confidence` property schema. Validate at runtime after parsing.

**Warning signs:** Items with confidence values that don't match the type union cause TypeScript errors or silent badge-visibility bugs.

### Pitfall 2: Expansion response item count may differ from request item count

**What goes wrong:** The LLM may merge duplicate items, skip items it can't parse, or return more items than sent (rare but possible with poorly constrained prompts).

**Why it happens:** LLMs are not lossless transformers by default.

**How to avoid:** Validate that the response contains the same number of items as the request. If the count doesn't match, treat as an expansion failure and fall back to raw names (D-03 path). [ASSUMED — based on LLM behavior knowledge]

**Warning signs:** Item list length changes unexpectedly after expansion.

### Pitfall 3: Dialog re-renders reset `editedName` if `activeItem` changes

**What goes wrong:** If `activeItem` is set from Zustand state and Zustand triggers a re-render (e.g., from an unrelated store update), the `editedName` local state stays stale while `activeItem.name` has changed.

**Why it happens:** `useEffect` to sync `editedName` from `activeItem` only runs on `activeItem` identity change, not on store updates to the same item.

**How to avoid:** Use `useEffect([activeItem?.id])` to reset `editedName` when the active item's identity changes. Do NOT sync on every render.

### Pitfall 4: AbortController cleanup for `/api/clarify`

**What goes wrong:** If the user opens the dialog, takes a menu photo, then closes the dialog before `/api/clarify` resolves, the fetch continues. If the component unmounts, the state setter fires on an unmounted component.

**Why it happens:** `AbortController` for the clarify fetch needs the same lifecycle cleanup as the OCR abort ref.

**How to avoid:** Use a separate `clarifyAbortRef` (or reuse `abortRef` since clarify and OCR are sequential). Abort in `useEffect` cleanup. [VERIFIED: AddItemsStep.tsx — `abortRef` pattern established]

### Pitfall 5: `OcrLoadingOverlay` `message` prop addition breaks existing tests

**What goes wrong:** If `OcrLoadingOverlay.test.tsx` checks for the exact string "Scanning your bill…", adding a `message` prop with a default will make those tests pass — but changing the default will break them.

**Why it happens:** The existing test asserts on the literal text content.

**How to avoid:** Keep the default value of `message` prop identical to the current hardcoded string: `"Scanning your bill…"`. All existing tests pass without modification. [VERIFIED: `__tests__/OcrLoadingOverlay.test.tsx`]

### Pitfall 6: `@base-ui/react/dialog` vs Radix UI Dialog open/close API

**What goes wrong:** `@base-ui/react` Dialog has a slightly different prop surface than Radix UI. The `onOpenChange` callback receives the new open state (boolean), same as Radix — but `DialogPrimitive.Root` is imported from `@base-ui/react/dialog`, not `@radix-ui/react-dialog`.

**Why it happens:** The dialog.tsx wrapper already handles this correctly, but if implementing the dialog manually (not via dialog.tsx), using Radix import paths will break.

**How to avoid:** Always use `dialog.tsx` components. Do not import directly from `@base-ui/react/dialog` in feature code. [VERIFIED: `components/ui/dialog.tsx`]

---

## Code Examples

### /api/expand: Suggested prompt structure

```typescript
// Source: pattern derived from app/api/ocr/route.ts
// ASSUMED — exact wording is Claude's discretion (CONTEXT.md)

const EXPAND_PROMPT = `You are a restaurant receipt item name expander.
Given a list of abbreviated receipt item names and prices, expand each name into a readable description.

Return ONLY valid JSON matching this schema:
{ "items": [{ "rawName": string, "displayName": string, "priceCents": number, "confidence": "high" | "low" | "ambiguous" }] }

Rules:
- rawName: copy the input name exactly, unchanged
- displayName: full readable name (e.g. "CHKN SAND LG" → "Chicken Sandwich (Large)")
- priceCents: copy the input priceCents exactly, unchanged (integer)
- confidence: "high" if you are confident, "low" if you made an educated guess, "ambiguous" if you cannot determine
- Return the SAME number of items as the input, in the SAME order`

// Call with text-only content (no image_url):
messages: [
  {
    role: 'user',
    content: `${EXPAND_PROMPT}\n\nItems to expand:\n${JSON.stringify(items)}`,
  },
]
```

### OcrLoadingOverlay extension

```typescript
// Source: components/wizard/OcrLoadingOverlay.tsx — VERIFIED

// Current interface:
export interface OcrLoadingOverlayProps {
  visible: boolean
}

// Phase 3 extension:
export interface OcrLoadingOverlayProps {
  visible: boolean
  message?: string  // default: "Scanning your bill…"
}

// Usage:
<OcrLoadingOverlay visible={ocrStatus === 'loading'} />
<OcrLoadingOverlay visible={expandStatus === 'loading'} message="Expanding names…" />
```

### Store extension sketch

```typescript
// Source: stores/useBillStore.ts — VERIFIED, extended pattern

export interface Item {
  id: ItemId
  name: string
  priceCents: number
  rawName?: string
  confidence?: 'high' | 'low' | 'ambiguous'
}

// In BillState:
expandStatus: 'idle' | 'loading' | 'done' | 'error'
setExpandStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void

// updateItem() clears confidence:
updateItem: (id, name, priceCents) =>
  set((s) => ({
    items: s.items.map((i) =>
      i.id === id
        ? { ...i, name, priceCents, confidence: 'high' as const }
        : i
    ),
  })),
```

### Badge rendering on item row

```typescript
// Source: 03-UI-SPEC.md Surface F — VERIFIED
// Badge already installed at components/ui/badge.tsx — VERIFIED

{(item.confidence === 'low' || item.confidence === 'ambiguous') && (
  <Badge
    className="bg-amber-100 text-amber-700 border border-amber-300 text-xs font-medium"
  >
    Review
  </Badge>
)}
```

### Item row click routing (Review vs normal edit)

```typescript
// Source: VERIFIED from AddItemsStep.tsx handleEditItemClick pattern

const handleItemRowClick = (item: Item) => {
  if (item.confidence === 'low' || item.confidence === 'ambiguous') {
    setActiveItem(item)
    setDialogState('choices')
    setEditedName(item.name)
    setDialogOpen(true)
  } else {
    handleEditItemClick(item)  // existing inline edit
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Vercel KV for session storage | Upstash Redis | December 2024 | Irrelevant to Phase 3 (no session persistence in this phase) |
| GPT-4 for abbreviation expansion | GPT-4o-mini (text) | 2024 | Cost-optimized; same quality for short-context text normalization |

**Deprecated/outdated:**
- `response_format: { type: 'json_object' }`: Replaced by `json_schema` strict mode for deterministic output. The OCR route already uses strict mode. [VERIFIED: app/api/ocr/route.ts]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Expansion response item count mismatch should trigger D-03 fallback | Pitfall 2 | If LLM reliably returns matching count, extra validation is harmless; if not added and counts differ, items silently disappear |
| A2 | `updateItem()` clearing `confidence` to `'high'` is preferable to a separate `reviewed: boolean` field | Store extension pattern | If planner chooses `reviewed` field instead, the badge condition and updateItem signature change slightly |
| A3 | A new `setItems()` action is the cleanest way to apply expanded items | Store extension pattern | If planner prefers a targeted merge action (match by position or name), the implementation differs |

---

## Open Questions

1. **Should `DisambiguationDialog` be extracted to its own file or kept inline in `AddItemsStep.tsx`?**
   - What we know: `AddItemsStep.tsx` is already 366 lines with the Phase 2 OCR handler; adding the dialog internal state machine will add ~100+ lines more.
   - What's unclear: The planner's preference for file length vs. co-location.
   - Recommendation: Extract to `components/wizard/DisambiguationDialog.tsx` for testability and readability. Pass `item`, `onSave`, and `onClose` as props.

2. **Where does the expansion call live — in `AddItemsStep.tsx` or in a new `useExpansion` hook?**
   - What we know: The OCR handler is currently a `useCallback` inside `AddItemsStep`. A hook would make it independently testable.
   - What's unclear: Whether the project's test conventions need hook-level tests or component-level tests suffice.
   - Recommendation: Keep it as a `useCallback` inside `AddItemsStep` to match the existing OCR pattern. If the component grows unwieldy, extract to a hook in a follow-up.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| openai npm package | `/api/expand`, `/api/clarify` | Yes | 6.37.0 | — |
| Node.js runtime | Next.js dev/build | Yes | 24.15.0 | — |
| OPENAI_API_KEY (env var) | Both new routes | Not verified in this session | — | Set in `.env.local` (Phase 2 prerequisite) |

**Note:** `OPENAI_API_KEY` must be present in `.env.local` for the new routes to function. This was a Phase 2 prerequisite. No new credentials are required for Phase 3.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |
| Baseline | 111 tests passing (verified 2026-05-10) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OCR-02 | `/api/expand` returns expanded names with confidence for valid input | unit | `npx vitest run __tests__/expandRoute.test.ts` | No — Wave 0 |
| OCR-02 | `/api/expand` returns 400 for missing/invalid items | unit | `npx vitest run __tests__/expandRoute.test.ts` | No — Wave 0 |
| OCR-02 | `/api/expand` returns 500 with generic error when OpenAI throws | unit | `npx vitest run __tests__/expandRoute.test.ts` | No — Wave 0 |
| OCR-02 | Expansion overlay shows when expandStatus is 'loading' | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 additions |
| OCR-02 | Review badge visible for low/ambiguous confidence items | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 additions |
| OCR-02 | Review badge hidden for high confidence items | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 additions |
| OCR-02 | Expansion error falls back to raw names (no dead end) | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 additions |
| OCR-02 | OcrLoadingOverlay renders message prop correctly | unit | `npx vitest run __tests__/OcrLoadingOverlay.test.tsx` | Partial (needs new test case) |
| OCR-04 | `/api/clarify` returns displayName for valid image + rawName | unit | `npx vitest run __tests__/clarifyRoute.test.ts` | No — Wave 0 |
| OCR-04 | `/api/clarify` returns empty displayName on clarify failure (not 500) | unit | `npx vitest run __tests__/clarifyRoute.test.ts` | No — Wave 0 |
| OCR-04 | Tapping Review item row opens disambiguation dialog | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 additions |
| OCR-04 | "Type name" in dialog switches to editing state with pre-filled input | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 additions |
| OCR-04 | "Save name" calls updateItem and dismisses badge | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 additions |
| OCR-04 | Dialog X close leaves badge intact | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 additions |

### Sampling Rate

- **Per task commit:** `npx vitest run __tests__/expandRoute.test.ts __tests__/clarifyRoute.test.ts __tests__/AddItemsStep.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (111+ tests) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `__tests__/expandRoute.test.ts` — covers OCR-02 API contract
- [ ] `__tests__/clarifyRoute.test.ts` — covers OCR-04 API contract
- [ ] New test cases in `__tests__/AddItemsStep.test.tsx` — covers Phase 3 component behavior (expansion flow, badges, dialog)
- [ ] New test case in `__tests__/OcrLoadingOverlay.test.tsx` — covers `message` prop rendering

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in this phase |
| V3 Session Management | No | No new session state |
| V4 Access Control | No | No authorization logic |
| V5 Input Validation | Yes | Validate `items` array shape + `image` data URI in route handlers |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Oversized image payload in `/api/clarify` | Tampering / DoS | Reuse `DATA_URI_RE` + `image.length > 10_000_000` check from OCR route |
| OPENAI_API_KEY exposure | Information Disclosure | Never prefix with `NEXT_PUBLIC_`; server-only env (inherited constraint from Phase 2) |
| OpenAI error details leaking to client | Information Disclosure | `console.error` server-side only; return generic `{ error: 'Expand failed' }` — same pattern as OCR route |
| Unlimited items array in `/api/expand` | DoS | Validate `items.length <= 100` (receipts have at most ~30 items; 100 is generous) [ASSUMED] |
| Injected rawName in `/api/clarify` prompt | Tampering | Wrap rawName in quotes in the prompt; validate `typeof rawName === 'string' && rawName.length <= 200` |

---

## Project Constraints (from CLAUDE.md)

The following directives are extracted from `CLAUDE.md` and apply to this phase:

| Directive | Constraint |
|-----------|------------|
| OPENAI_API_KEY | Server-only. Never use `NEXT_PUBLIC_` prefix on any key |
| GPT-4o-mini model | Use `gpt-4o-mini` for `/api/expand` (text) and `/api/clarify` (vision) |
| Integer cents | `priceCents` is always an integer. The expand route must not modify price values |
| Zustand 5.x | Already installed; extend `useBillStore.ts` — do not add a second store |
| No react-webcam | Use native `<input type="file" capture="environment">` for menu photo capture |
| shadcn/ui | Use existing installed components; no new `npx shadcn@latest add` needed for Phase 3 |
| Tailwind CSS 4.x | No config file; use utility classes directly |
| GSD workflow enforcement | Do not make direct repo edits outside a GSD workflow |

---

## Sources

### Primary (HIGH confidence)

- Codebase: `app/api/ocr/route.ts` — Pattern for GPT-4o-mini json_schema strict output, AbortController, error handling
- Codebase: `stores/useBillStore.ts` — Current store shape, Item interface, update patterns
- Codebase: `components/wizard/AddItemsStep.tsx` — OCR flow integration, AbortController usage, Toast pattern
- Codebase: `components/wizard/OcrLoadingOverlay.tsx` — Portal + mounted-flag pattern
- Codebase: `components/ui/dialog.tsx` — @base-ui/react dialog API confirmed
- Codebase: `components/ui/badge.tsx` — Badge component API confirmed
- Codebase: `__tests__/ocrRoute.test.ts` — Route test patterns (vi.mock, vi.resetModules, dynamic import)
- Codebase: `__tests__/AddItemsStep.test.tsx` — Component test patterns (renderInProvider, StubFR)
- Codebase: `package.json` + `node_modules` — All versions verified
- `.planning/phases/03-ai-expansion-disambiguation/03-CONTEXT.md` — Locked decisions
- `.planning/phases/03-ai-expansion-disambiguation/03-UI-SPEC.md` — Full visual contract

### Secondary (MEDIUM confidence)

- `CLAUDE.md` — Technology stack and project conventions
- `.planning/REQUIREMENTS.md` — OCR-02 and OCR-04 requirement text

### Tertiary (LOW confidence / ASSUMED)

- LLM behavior with item count mismatch (Pitfall 2) — ASSUMED from general LLM knowledge
- `items.length <= 100` DoS limit — ASSUMED reasonable ceiling, not specified in requirements

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via package.json + node_modules
- Architecture: HIGH — derived directly from existing codebase patterns
- Pitfalls: MEDIUM — route pitfalls HIGH (verified from OCR route); dialog pitfalls MEDIUM (derived from React patterns)
- Test patterns: HIGH — verified from existing test files

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (stable stack; openai SDK and @base-ui/react update occasionally)
