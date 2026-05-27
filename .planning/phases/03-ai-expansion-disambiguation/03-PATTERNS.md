# Phase 3: AI Expansion + Disambiguation - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/api/expand/route.ts` | route handler | request-response | `app/api/ocr/route.ts` | exact |
| `app/api/clarify/route.ts` | route handler | request-response | `app/api/ocr/route.ts` | exact |
| `stores/useBillStore.ts` | store | CRUD | `stores/useBillStore.ts` (self — extend) | self-extension |
| `components/wizard/AddItemsStep.tsx` | component | event-driven | `components/wizard/AddItemsStep.tsx` (self — extend) | self-extension |
| `components/wizard/OcrLoadingOverlay.tsx` | component | request-response | `components/wizard/OcrLoadingOverlay.tsx` (self — extend) | self-extension |
| `components/wizard/DisambiguationDialog.tsx` | component | event-driven | `components/wizard/AddItemsStep.tsx` (Dialog usage pattern) | role-match |
| `__tests__/expandRoute.test.ts` | test | request-response | `__tests__/ocrRoute.test.ts` | exact |
| `__tests__/clarifyRoute.test.ts` | test | request-response | `__tests__/ocrRoute.test.ts` | exact |

---

## Pattern Assignments

### `app/api/expand/route.ts` (route handler, request-response)

**Analog:** `app/api/ocr/route.ts`

**Imports pattern** (lines 1-6):
```typescript
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

// Read OPENAI_API_KEY from server-only env. NEVER prefix with NEXT_PUBLIC_.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
```

**maxDuration + POST skeleton** (lines 19-26):
```typescript
export const maxDuration = 30

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
```

**Input validation pattern** (lines 29-37):
```typescript
// Validate items array from body
const items =
  body && typeof body === 'object' && 'items' in body
    ? (body as { items: unknown }).items
    : undefined

if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
  return NextResponse.json({ error: 'Invalid items' }, { status: 400 })
}
```

**json_schema strict response_format** (lines 51-77):
```typescript
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'receipt_items',   // change to 'expanded_items' for /expand
    strict: true,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              priceCents: { type: 'integer' },
            },
            required: ['name', 'priceCents'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
},
```
For `/api/expand` the schema properties become:
`rawName`, `displayName`, `priceCents`, `confidence` (with `enum: ['high', 'low', 'ambiguous']`).

**Response validation and runtime filter** (lines 79-100):
```typescript
const content = completion.choices[0]?.message?.content
if (!content) {
  console.error('OCR error: empty response from gpt-4o-mini')
  return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
}

const parsed = JSON.parse(content) as unknown
if (
  !parsed ||
  typeof parsed !== 'object' ||
  !Array.isArray((parsed as Record<string, unknown>).items)
) {
  console.error('OCR error: response did not match expected schema')
  return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
}
const items = ((parsed as { items: unknown[] }).items).filter(
  (i): i is { name: string; priceCents: number } =>
    typeof (i as Record<string, unknown>).name === 'string' &&
    Number.isInteger((i as Record<string, unknown>).priceCents) &&
    (i as { priceCents: number }).priceCents > 0,
)
return NextResponse.json({ items })
```
For `/api/expand`: filter must also check `rawName`, `displayName`, and `confidence` field types. Additionally validate that `response.items.length === request.items.length` — mismatch triggers a 500 (D-03 fallback path).

**Error handling** (lines 101-105):
```typescript
} catch (err) {
  // Log server-side only. Do NOT echo OpenAI internals to the client.
  console.error('OCR error:', err)
  return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
}
```
For `/api/expand`: use `{ error: 'Expand failed' }` as the generic client message.

**Text-only messages (no image_url):**
```typescript
// /api/expand uses text-only content — no image_url in the messages array
messages: [
  {
    role: 'user',
    content: `${EXPAND_PROMPT}\n\nItems to expand:\n${JSON.stringify(items)}`,
  },
]
```

---

### `app/api/clarify/route.ts` (route handler, request-response)

**Analog:** `app/api/ocr/route.ts`

**Imports + OpenAI init** (lines 1-6): identical to `/api/expand` above.

**maxDuration:** `export const maxDuration = 30` — same.

**Input validation** (lines 29-37) — two fields to validate:
```typescript
// Validate rawName
const rawName =
  body && typeof body === 'object' && 'rawName' in body
    ? (body as { rawName: unknown }).rawName
    : undefined
if (typeof rawName !== 'string' || rawName.trim().length === 0 || rawName.length > 200) {
  return NextResponse.json({ error: 'Invalid rawName' }, { status: 400 })
}

// Validate image — reuse exact DATA_URI_RE + length check from OCR route
const DATA_URI_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/
if (typeof image !== 'string' || image.length > 10_000_000 || !DATA_URI_RE.test(image)) {
  return NextResponse.json({ error: 'No image provided' }, { status: 400 })
}
```

**Vision messages pattern** (lines 42-49) — copy from OCR route, add rawName as text prefix:
```typescript
messages: [
  {
    role: 'user',
    content: [
      { type: 'text', text: CLARIFY_PROMPT_PREFIX + rawName },
      { type: 'image_url', image_url: { url: image, detail: 'high' } },
    ],
  },
]
```

**D-09 handling — empty result is 200, not 500:**
```typescript
// If GPT returns empty string or parse fails, return { displayName: '' } with 200.
// The client populates the edit field with the expansion best guess as fallback.
return NextResponse.json({ displayName: parsedName ?? '' })
```

**Error message:** use `{ error: 'Clarify failed' }` as the generic client message (keep the same `console.error` server-only pattern).

---

### `stores/useBillStore.ts` (store, CRUD — self-extension)

**Analog:** `stores/useBillStore.ts` (current file)

**Current Item interface** (lines 21-25):
```typescript
export interface Item {
  id: ItemId
  name: string
  priceCents: number
}
```
Extend by adding three optional fields (undefined on manual items):
```typescript
export interface Item {
  id: ItemId
  name: string
  priceCents: number
  rawName?: string                           // OCR abbreviation; undefined for manual items
  confidence?: 'high' | 'low' | 'ambiguous' // undefined treated as high (no badge)
}
```

**Current BillState status field pattern** (lines 35-36):
```typescript
ocrStatus: 'idle' | 'loading' | 'done' | 'error'
// ...
setOcrStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void
```
Mirror exactly for expand:
```typescript
expandStatus: 'idle' | 'loading' | 'done' | 'error'
setExpandStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void
```

**Current INITIAL_STATE pattern** (lines 49-58):
```typescript
const INITIAL_STATE = {
  step: 1 as const,
  people: [],
  items: [],
  assignments: {},
  tipPercent: 18,
  nextColorIndex: 0,
  billImageUrl: null,
  ocrStatus: 'idle' as const,
}
```
Add `expandStatus: 'idle' as const` to INITIAL_STATE.

**Current setOcrStatus action** (line 100):
```typescript
setOcrStatus: (status) => set({ ocrStatus: status }),
```
Add parallel setter:
```typescript
setExpandStatus: (status) => set({ expandStatus: status }),
```

**New `setItems` action** (batch replace after expansion):
```typescript
setItems: (items: Item[]) => set({ items }),
```
Pattern mirrors the `set({...})` style used by `setTipPercent` and `setBillImage`.

**Updated `updateItem` — clears confidence on save** (lines 90-93):
```typescript
// Current:
updateItem: (id, name, priceCents) =>
  set((s) => ({
    items: s.items.map((i) => (i.id === id ? { ...i, name, priceCents } : i)),
  })),

// Phase 3 — add confidence: 'high' to dismiss the Review badge:
updateItem: (id, name, priceCents) =>
  set((s) => ({
    items: s.items.map((i) =>
      i.id === id
        ? { ...i, name, priceCents, confidence: 'high' as const }
        : i
    ),
  })),
```

---

### `components/wizard/OcrLoadingOverlay.tsx` (component — self-extension)

**Analog:** `components/wizard/OcrLoadingOverlay.tsx` (current file)

**Current interface + implementation** (lines 7-30):
```typescript
export interface OcrLoadingOverlayProps {
  visible: boolean
}

export function OcrLoadingOverlay({ visible }: OcrLoadingOverlayProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted || !visible) return null
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-label="Scanning your bill"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 transition-opacity duration-150"
    >
      <div className="flex flex-col items-center gap-4">
        <LoaderCircle size={40} className="text-white animate-spin" aria-hidden="true" />
        <p className="text-[16px] text-white">Scanning your bill…</p>
      </div>
    </div>,
    document.body,
  )
}
```

**Phase 3 extension — add `message` prop with default:**
```typescript
export interface OcrLoadingOverlayProps {
  visible: boolean
  message?: string  // default must be "Scanning your bill…" (preserves existing tests)
}

export function OcrLoadingOverlay({ visible, message = 'Scanning your bill…' }: OcrLoadingOverlayProps) {
  // ... same mounted-flag pattern ...
  // Change hardcoded string to:
  <p className="text-[16px] text-white">{message}</p>
  // Change aria-label to match message (or use generic "Loading"):
  aria-label={message}
```

**Critical:** The default value `"Scanning your bill…"` must match the literal string tested in `__tests__/OcrLoadingOverlay.test.tsx` line 17 and 23. Changing the default breaks existing tests.

**Usage for expansion phase:**
```typescript
<OcrLoadingOverlay visible={ocrStatus === 'loading'} />
<OcrLoadingOverlay visible={expandStatus === 'loading'} message="Expanding names…" />
```

---

### `components/wizard/AddItemsStep.tsx` (component — self-extension)

**Analog:** `components/wizard/AddItemsStep.tsx` (current file)

**Store subscriptions pattern** (lines 41-49):
```typescript
const items = useBillStore((s) => s.items)
const addItem = useBillStore((s) => s.addItem)
const updateItem = useBillStore((s) => s.updateItem)
const removeItem = useBillStore((s) => s.removeItem)
const setStep = useBillStore((s) => s.setStep)
const billImageUrl = useBillStore((s) => s.billImageUrl)
const ocrStatus = useBillStore((s) => s.ocrStatus)
const setBillImage = useBillStore((s) => s.setBillImage)
const setOcrStatus = useBillStore((s) => s.setOcrStatus)
```
Add Phase 3 subscriptions in the same pattern:
```typescript
const expandStatus = useBillStore((s) => s.expandStatus)
const setExpandStatus = useBillStore((s) => s.setExpandStatus)
const setItems = useBillStore((s) => s.setItems)
```

**AbortController pattern** (lines 55-59):
```typescript
const abortRef = useRef<AbortController | null>(null)

useEffect(() => {
  return () => { abortRef.current?.abort() }
}, [])
```
Add a parallel ref for the clarify fetch (used inside DisambiguationDialog):
```typescript
const clarifyAbortRef = useRef<AbortController | null>(null)
```

**handleFileChange / expansion trigger pattern** (lines 105-154):
The expansion fetch follows directly after OCR success. The pattern is the same `useCallback` with `abortRef`:
```typescript
// After OCR success, instead of calling addItem() per item:
setOcrStatus('done')
setExpandStatus('loading')
abortRef.current?.abort()
abortRef.current = new AbortController()
const expandRes = await fetch('/api/expand', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: data.items }),
  signal: abortRef.current.signal,
})
if (!expandRes.ok) throw new Error(`Expand route returned ${expandRes.status}`)
const expandData = (await expandRes.json()) as {
  items: { rawName: string; displayName: string; priceCents: number; confidence: 'high' | 'low' | 'ambiguous' }[]
}
// Map to Item shape and add ids via setItems():
setItems(expandData.items.map((ei) => ({
  id: crypto.randomUUID(),
  name: ei.displayName,
  rawName: ei.rawName,
  priceCents: ei.priceCents,
  confidence: ei.confidence,
})))
setExpandStatus('done')
```

**Expansion error fallback (D-03):**
```typescript
// In the catch block — after OCR succeeds but expansion fails:
setExpandStatus('error')
// Insert raw OCR items without confidence (they stay editable):
for (const item of data.items) {
  addItem(item.name, item.priceCents)
}
toastManager.add({
  description: "Couldn't expand item names — you can edit them manually",
  timeout: 4000,
})
```

**Toast pattern** (lines 53, 147-150):
```typescript
const toastManager = Toast.useToastManager()
// ...
toastManager.add({
  description: "Couldn't read the bill — try again or enter manually",
  timeout: 4000,
})
```

**Badge rendering on item row** (inside the display-mode `<Card>`, lines 246-269):
```typescript
// Add alongside the existing name span:
{(item.confidence === 'low' || item.confidence === 'ambiguous') && (
  <Badge
    className="bg-amber-100 text-amber-700 border border-amber-300 text-xs font-medium"
  >
    Review
  </Badge>
)}
```

**Item row click routing — Review vs normal edit:**
```typescript
// Replace the direct onClick={() => handleEditItemClick(item)} with:
const handleItemRowClick = (item: Item) => {
  if (item.confidence === 'low' || item.confidence === 'ambiguous') {
    // Open disambiguation dialog
    setActiveItem(item)
    setDialogState('choices')
    setEditedName(item.name)
    setDisambiguationOpen(true)
  } else {
    handleEditItemClick(item)  // existing inline edit
  }
}
```

**Existing Dialog usage pattern** (lines 338-361) — exact API for the disambiguation dialog:
```typescript
<Dialog
  open={pendingRemove !== null}
  onOpenChange={(open) => { if (!open) setPendingRemove(null) }}
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Remove {pendingRemove?.name}?</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={...}>Cancel</Button>
      <Button variant="destructive" onClick={...}>Remove</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Camera input pattern** (lines 194-205) — reuse for menu photo in DisambiguationDialog:
```typescript
<input
  ref={menuFileInputRef}       // separate ref from fileInputRef
  type="file"
  accept="image/*"
  capture="environment"
  className="sr-only"
  onChange={handleMenuFileChange}
  aria-hidden="true"
  tabIndex={-1}
  data-testid="menu-file-input"
/>
```

**Dual overlay usage** (line 363):
```typescript
// Current:
<OcrLoadingOverlay visible={ocrStatus === 'loading'} />

// Phase 3: add second overlay for expansion phase
<OcrLoadingOverlay visible={ocrStatus === 'loading'} />
<OcrLoadingOverlay visible={expandStatus === 'loading'} message="Expanding names…" />
```

---

### `components/wizard/DisambiguationDialog.tsx` (component, event-driven)

**Analog:** `components/wizard/AddItemsStep.tsx` (Dialog usage + local state machine pattern)

**Local state machine** (from RESEARCH.md Pattern 4):
```typescript
type DialogState = 'choices' | 'editing' | 'clarifying' | 'clarify-done'

// Props interface:
interface DisambiguationDialogProps {
  item: Item | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: ItemId, name: string) => void
}

// Internal local state — nothing here reaches Zustand:
const [dialogState, setDialogState] = useState<DialogState>('choices')
const [editedName, setEditedName] = useState('')
const menuFileInputRef = useRef<HTMLInputElement>(null)
const clarifyAbortRef = useRef<AbortController | null>(null)
```

**Sync editedName when item identity changes (Pitfall 3 avoidance):**
```typescript
useEffect(() => {
  if (item) setEditedName(item.name)
  setDialogState('choices')
}, [item?.id])  // Only on identity change, not every render
```

**Dialog open/close API** — copy from `dialog.tsx` usage in AddItemsStep (lines 338-341):
```typescript
<Dialog
  open={open}
  onOpenChange={(isOpen) => { if (!isOpen) onOpenChange(false) }}
>
```

**Clarify fetch with AbortController** — copy AbortController pattern from AddItemsStep lines 128-135:
```typescript
clarifyAbortRef.current?.abort()
clarifyAbortRef.current = new AbortController()
const res = await fetch('/api/clarify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rawName: item.rawName ?? item.name, image: base64 }),
  signal: clarifyAbortRef.current.signal,
})
```

**AbortController cleanup in useEffect:**
```typescript
useEffect(() => {
  return () => { clarifyAbortRef.current?.abort() }
}, [])
```

**Available dialog sub-components** (from `components/ui/dialog.tsx`):
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
- Import path: `@/components/ui/dialog`

---

### `__tests__/expandRoute.test.ts` (test, request-response)

**Analog:** `__tests__/ocrRoute.test.ts`

**Full test file structure** (lines 1-36):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

process.env.OPENAI_API_KEY = 'test-key'

const createMock = vi.fn()

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: createMock } }
      constructor() {}
    },
  }
})

beforeEach(() => {
  vi.resetModules()
  createMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function callPOST(body: unknown): Promise<{ status: number; json: unknown }> {
  const { POST } = await import('@/app/api/expand/route')  // change path
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
  const req = new Request('http://localhost/api/expand', init)  // change URL
  const res = await POST(req)
  const json = await res.json()
  return { status: res.status, json }
}
```

**Key differences from ocrRoute.test.ts:**
- Request body shape: `{ items: [{ name, priceCents }] }` instead of `{ image }`
- Response shape: `{ items: [{ rawName, displayName, priceCents, confidence }] }`
- Additional test: item count mismatch returns 500 (fallback path)
- Error message: `{ error: 'Expand failed' }` not `'OCR failed'`
- 400 for: missing items, empty array, array > 100 items, non-array items field

**Happy-path mock response:**
```typescript
createMock.mockResolvedValue({
  choices: [
    {
      message: {
        content: JSON.stringify({
          items: [
            { rawName: 'CHKN SAND LG', displayName: 'Chicken Sandwich (Large)', priceCents: 1299, confidence: 'high' },
          ],
        }),
      },
    },
  ],
})
```

---

### `__tests__/clarifyRoute.test.ts` (test, request-response)

**Analog:** `__tests__/ocrRoute.test.ts`

**Test file structure:** identical to `expandRoute.test.ts` above — same `vi.mock('openai')` pattern, same `vi.resetModules()` in `beforeEach`, same dynamic import in `callPOST`.

**Key differences:**
- Import path: `@/app/api/clarify/route`
- Request URL: `http://localhost/api/clarify`
- Request body shape: `{ rawName: string, image: string (data URI) }`
- Response shape: `{ displayName: string }`
- Error message: `{ error: 'Clarify failed' }`
- Additional test: D-09 — when GPT returns empty string, route returns `{ displayName: '' }` with status 200 (not 500)
- Validate 400 for: missing rawName, missing image, rawName > 200 chars, invalid data URI

**D-09 mock (empty displayName returns 200, not 500):**
```typescript
it('returns 200 with empty displayName when GPT returns empty string (D-09 fallback)', async () => {
  createMock.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ displayName: '' }) } }],
  })
  const { status, json } = await callPOST({
    rawName: 'XYZ123',
    image: 'data:image/jpeg;base64,abc',
  })
  expect(status).toBe(200)
  expect(json).toEqual({ displayName: '' })
})
```

---

## Shared Patterns

### Authentication / Security: Server-Only API Key
**Source:** `app/api/ocr/route.ts` line 6
**Apply to:** `app/api/expand/route.ts`, `app/api/clarify/route.ts`
```typescript
// NEVER prefix with NEXT_PUBLIC_. Route handlers are server-only.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
```

### Error Isolation: console.error Server-Side Only
**Source:** `app/api/ocr/route.ts` lines 82, 101-104
**Apply to:** All route handlers
```typescript
} catch (err) {
  // Log server-side only. Do NOT echo OpenAI internals to the client.
  console.error('Expand error:', err)
  return NextResponse.json({ error: 'Expand failed' }, { status: 500 })
}
```

### Input Validation: DATA_URI_RE + Size Check
**Source:** `app/api/ocr/route.ts` lines 34-37
**Apply to:** `app/api/clarify/route.ts` (for the `image` field)
```typescript
const DATA_URI_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/
if (typeof image !== 'string' || image.length > 10_000_000 || !DATA_URI_RE.test(image)) {
  return NextResponse.json({ error: 'No image provided' }, { status: 400 })
}
```

### Toast Error Notification
**Source:** `components/wizard/AddItemsStep.tsx` lines 53, 147-150
**Apply to:** `AddItemsStep.tsx` expansion error handler
```typescript
const toastManager = Toast.useToastManager()
// ...
toastManager.add({
  description: "Couldn't expand item names — you can edit them manually",
  timeout: 4000,
})
```

### Loading Overlay: Portal + Mounted-Flag Pattern
**Source:** `components/wizard/OcrLoadingOverlay.tsx` lines 12-30
**Apply to:** `OcrLoadingOverlay.tsx` (extending for `message` prop), `AddItemsStep.tsx` (adding second overlay)
```typescript
const [mounted, setMounted] = useState(false)
useEffect(() => { setMounted(true) }, [])
if (!mounted || !visible) return null
return createPortal(<div role="status" ...>, document.body)
```

### AbortController Lifecycle Pattern
**Source:** `components/wizard/AddItemsStep.tsx` lines 55-59, 128-135
**Apply to:** `AddItemsStep.tsx` (clarify fetch), `DisambiguationDialog.tsx`
```typescript
const abortRef = useRef<AbortController | null>(null)
useEffect(() => {
  return () => { abortRef.current?.abort() }
}, [])
// Inside async handler:
abortRef.current?.abort()
abortRef.current = new AbortController()
const res = await fetch('/api/...', { signal: abortRef.current.signal })
```

### Zustand Status Field Pattern
**Source:** `stores/useBillStore.ts` lines 35-36, 57-58, 100
**Apply to:** `stores/useBillStore.ts` (adding `expandStatus`)
```typescript
// State field:
ocrStatus: 'idle' | 'loading' | 'done' | 'error'
// Initial value:
ocrStatus: 'idle' as const,
// Action:
setOcrStatus: (status) => set({ ocrStatus: status }),
```

### Dialog Open/Close API
**Source:** `components/wizard/AddItemsStep.tsx` lines 338-341, `components/ui/dialog.tsx` line 10
**Apply to:** `DisambiguationDialog.tsx`
```typescript
<Dialog
  open={pendingRemove !== null}
  onOpenChange={(open) => { if (!open) setPendingRemove(null) }}
>
```
Always use `@/components/ui/dialog` exports — never import directly from `@base-ui/react/dialog`.

### Test: vi.mock + vi.resetModules + Dynamic Import
**Source:** `__tests__/ocrRoute.test.ts` lines 8-22, 26-36
**Apply to:** `__tests__/expandRoute.test.ts`, `__tests__/clarifyRoute.test.ts`
```typescript
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } }
    constructor() {}
  },
}))

beforeEach(() => {
  vi.resetModules()    // Required — prevents stale module state between tests
  createMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// Dynamic import inside test or helper to ensure mock is applied:
const { POST } = await import('@/app/api/expand/route')
```

### Test: renderInProvider (Toast.Provider required)
**Source:** `__tests__/AddItemsStep.test.tsx` lines 12-14
**Apply to:** Any new component tests that use `Toast.useToastManager()`
```typescript
function renderInProvider(ui: React.ReactElement) {
  return render(<Toast.Provider>{ui}</Toast.Provider>)
}
```

### Test: StubFR (FileReader stub for async file pipeline)
**Source:** `__tests__/AddItemsStep.test.tsx` lines 202-213
**Apply to:** New `AddItemsStep.test.tsx` tests for the expansion + clarify flows
```typescript
class StubFR {
  onloadend: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  result: string | ArrayBuffer | null = null
  readAsDataURL() {
    this.result = 'data:image/jpeg;base64,FAKEBASE64'
    queueMicrotask(() => this.onloadend?.())
  }
}
;(global as unknown as { FileReader: typeof StubFR }).FileReader = StubFR
// Restore after test:
;(global as unknown as { FileReader: typeof origFR }).FileReader = origFR
```

---

## No Analog Found

All Phase 3 files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `app/api/`, `components/wizard/`, `components/ui/`, `stores/`, `__tests__/`
**Files scanned:** 11 source files read in full
**Pattern extraction date:** 2026-05-10
