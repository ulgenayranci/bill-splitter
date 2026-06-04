# Phase 2: OCR Pipeline - Research

**Researched:** 2026-05-09
**Domain:** GPT-4o-mini vision OCR, Next.js App Router Route Handlers, browser-image-compression, @base-ui/react Toast, React portals
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Photo capture embedded in AddItems (step 2) via "Scan bill" button — no new wizard step. WizardShell and step count (1–5) remain unchanged.
- **D-02:** OCR results replace the empty items list inline using same editable rows as manual entry. No separate "confirm" gate — items appear directly and are immediately editable.
- **D-03:** Captured bill thumbnail stored in Zustand as blob URL. Persists throughout session. Displayed at top of step 2 once captured.
- **D-04:** Scan is optional. Step 2 shows both "Scan bill" button and manual entry form simultaneously. Phase 1 manual flow must remain fully intact.
- **D-05:** After scanning, manual entry form stays visible below OCR-populated list. User can add more items manually (additive, not replace-only).
- **D-06:** Full-screen loading overlay shown during OCR processing with "Scanning your bill…" message and spinner. All interaction blocked until call completes or fails.
- **D-07:** On OCR failure: dismiss overlay, show brief error toast ("Couldn't read the bill — try again or enter manually"). User stays in step 2 with manual entry available.

### Claude's Discretion

- OCR API route structure (`app/api/ocr/route.ts`) — standard Next.js App Router Route Handler
- GPT-4o-mini prompt design for structured JSON extraction (`{ items: [{ name: string, priceCents: number }] }`)
- Image compression before upload (browser-image-compression 2.x, targeting ~500KB JPEG)
- Blob URL vs data URL for thumbnail storage in Zustand state
- Error toast implementation (shadcn/ui Toast or simple inline message)

### Deferred Ideas (OUT OF SCOPE)

- Abbreviation expansion and confidence display → Phase 3 (OCR-02, OCR-04)
- Menu photo fallback for ambiguous items → Phase 3
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OCR-01 | User can take a photo of the bill to extract items automatically | GPT-4o-mini vision call in Route Handler; `<input capture="environment">` for camera; browser-image-compression before upload |
| OCR-03 | User can review and edit extracted items before assigning | OCR items inserted via existing `addItem()` loop into the existing editable list; no new edit UI needed |
</phase_requirements>

---

## Summary

Phase 2 adds a photo-capture and OCR path into the existing AddItems step. The host taps "Scan bill", the browser opens the native camera via `<input type="file" capture="environment">`, the selected image is compressed to ~500KB JPEG client-side via `browser-image-compression`, then posted as base64 JSON to `app/api/ocr/route.ts`. The route handler calls GPT-4o-mini with the image and a strict JSON schema prompt, parses the response, and returns `{ items: [{ name, priceCents }] }`. On the client, each item is batch-inserted via the existing `addItem()` action. A full-screen portal overlay blocks UI during the call; a `@base-ui/react` Toast appears on failure.

The key implementation complexity is threefold: (1) prompt engineering to get GPT-4o-mini to reliably return integer cents (not floats), (2) handling iOS Safari's HEIC-vs-JPEG output correctly in both compression and base64 encoding, and (3) wiring the `@base-ui/react` Toast with its `Provider`/`useToastManager` pattern, which requires a wrapping Provider in the component tree above AddItemsStep.

**Primary recommendation:** Send image as base64 JSON (not multipart/form-data) — simpler server-side code, no temp file handling, and the OpenAI SDK accepts `data:image/jpeg;base64,...` URL strings directly in the chat completions message content.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera capture / file selection | Browser (client) | — | Native `<input capture>` is a browser API; no server involvement |
| Image compression | Browser (client) | — | `browser-image-compression` runs in-browser before upload |
| Blob URL creation + thumbnail display | Browser (client) | — | `URL.createObjectURL(file)` is a browser API; blob URLs are local only |
| OCR execution (GPT-4o-mini call) | API / Backend (Route Handler) | — | API key must stay server-side; OpenAI SDK call in `app/api/ocr/route.ts` |
| JSON parsing + response validation | API / Backend (Route Handler) | — | Parse and validate before returning to client |
| Item insertion into store | Browser (client) | — | `addItem()` is a Zustand action; loop from OCR response |
| ocrStatus state machine | Browser (client) | — | UI-only state; no server persistence needed |
| Error toast display | Browser (client) | — | Triggered by ocrStatus === 'error' transition |
| Loading overlay | Browser (client) | — | CSS fixed overlay rendered via React portal to document.body |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | 6.37.0 | GPT-4o-mini vision API calls | Official SDK; handles auth, retries, type-safety. Not yet installed — Wave 0 task. [VERIFIED: npm registry] |
| browser-image-compression | 2.0.2 | Client-side JPEG compression before upload | Runs in-browser Web Worker; reduces 3-10MB photos to ~500KB. Not yet installed — Wave 0 task. [VERIFIED: npm registry] |
| @base-ui/react | 1.4.1 | Toast primitives | Already installed as transitive dep (via shadcn components); provides `Toast.Provider`, `useToastManager`, `Toast.Root`, `Toast.Viewport`. [VERIFIED: node_modules] |
| react-dom (createPortal) | 19.2.0 | Full-screen loading overlay | Built-in; renders fixed overlay outside WizardShell DOM subtree. [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next (App Router Route Handler) | 16.2.6 | `app/api/ocr/route.ts` POST endpoint | Standard App Router pattern; `request.formData()` or `request.json()` accepted. [VERIFIED: node_modules] |
| zustand | 5.0.13 | State additions: `billImageUrl`, `ocrStatus` | Existing store extension — add two new fields and two new actions. [VERIFIED: package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Base64 JSON body | multipart/form-data | FormData adds complexity with no benefit here — image is already in memory and well under 1MB after compression |
| `@base-ui/react` Toast | sonner | Sonner not installed; `@base-ui/react` is already in node_modules (no new dependency) |
| React portal (manual) | shadcn Dialog | Dialog introduces focus trap and ARIA role `dialog` — wrong semantics for a process-state overlay |

**Installation (Wave 0):**
```bash
npm install openai browser-image-compression
```

**Version verification:** Confirmed against npm registry on 2026-05-09.
- `openai` latest: 6.37.0 [VERIFIED: npm view]
- `browser-image-compression` latest: 2.0.2 [VERIFIED: npm view]

---

## Architecture Patterns

### System Architecture Diagram

```
[User taps "Scan bill"]
        |
        v
[<input type="file" capture="environment">]
  (native camera/file picker opens)
        |
        v (file selected)
[browser-image-compression]
  maxSizeMB: 0.5, fileType: 'image/jpeg'
  → compressedFile (Blob, <500KB JPEG)
        |
        +---> URL.createObjectURL(compressedFile)
        |       → billImageUrl (Zustand) → thumbnail shown
        |
        v
[FileReader.readAsDataURL(compressedFile)]
  → base64DataURL string
        |
        v
[fetch POST /api/ocr]
  body: JSON { image: base64DataURL }
  ocrStatus → 'loading' (overlay mounts)
        |
        v
[app/api/ocr/route.ts]  ← SERVER BOUNDARY
  1. parse JSON body
  2. extract base64 string
  3. openai.chat.completions.create({
       model: 'gpt-4o-mini',
       messages: [{ role: 'user', content: [
         { type: 'text', text: PROMPT },
         { type: 'image_url', image_url: { url: base64DataURL, detail: 'high' } }
       ]}],
       response_format: { type: 'json_schema', ... }
     })
  4. parse JSON response
  5. validate items array
  6. return { items: [{ name, priceCents }] }
        |
        v (success)
[client: ocrStatus → 'done']
  overlay unmounts
  items.forEach(item => addItem(item.name, item.priceCents))
  "Scan bill" button hides
        |
        v (failure — network/API error)
[client: ocrStatus → 'error']
  overlay unmounts
  Error toast shown (4s auto-dismiss)
  "Scan bill" button re-appears
```

### Recommended Project Structure

```
app/
├── api/
│   └── ocr/
│       └── route.ts          # POST handler: image → items
├── layout.tsx                 # Add Toast.Provider here
├── page.tsx                   # Unchanged (step rendering)
components/
├── wizard/
│   ├── AddItemsStep.tsx       # Augmented with scan button, thumbnail, overlay
│   └── OcrLoadingOverlay.tsx  # New: fixed portal overlay component
│   └── OcrErrorToast.tsx      # New: toast list renderer (uses useToastManager)
stores/
└── useBillStore.ts            # Extended: billImageUrl, ocrStatus, actions
```

### Pattern 1: Base64 JSON to OpenAI Vision

**What:** Send compressed image as base64 data URL in JSON body to Route Handler; Route Handler calls OpenAI chat completions with vision.

**When to use:** Single image, <1MB after compression, API key must stay server-side.

**Example:**
```typescript
// Source: https://developers.openai.com/api/docs/guides/images-vision [CITED]
// app/api/ocr/route.ts
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const RECEIPT_PROMPT = `You are a receipt parser. Extract every line item and its price from this receipt image.
Return ONLY valid JSON matching this schema exactly:
{ "items": [{ "name": string, "priceCents": number }] }
Rules:
- priceCents must be an integer (e.g. $12.99 → 1299)
- name should be a short readable description (3-6 words max)
- Exclude subtotals, tax, tip, and total lines
- If you cannot read an item clearly, include your best guess`

export const maxDuration = 30

export async function POST(request: Request) {
  const { image } = await request.json() as { image: string }
  if (!image) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: RECEIPT_PROMPT },
          { type: 'image_url', image_url: { url: image, detail: 'high' } }
        ]
      }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'receipt_items',
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
                    priceCents: { type: 'integer' }
                  },
                  required: ['name', 'priceCents'],
                  additionalProperties: false
                }
              }
            },
            required: ['items'],
            additionalProperties: false
          }
        }
      }
    })
    const content = completion.choices[0].message.content
    if (!content) throw new Error('Empty response from GPT-4o-mini')
    const parsed = JSON.parse(content) as { items: { name: string; priceCents: number }[] }
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('OCR error:', err)
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  }
}
```

### Pattern 2: Client-Side Compression + Blob URL

**What:** Compress the file before POSTing; create a blob URL for the thumbnail immediately (before OCR completes).

**When to use:** All OCR scans — reduces API cost and upload time.

**Example:**
```typescript
// Source: https://github.com/donaldcwl/browser-image-compression/blob/master/README.md [CITED]
import imageCompression from 'browser-image-compression'

async function handleFileSelect(file: File) {
  // 1. Set thumbnail immediately (non-blocking)
  const blobUrl = URL.createObjectURL(file) // use original for thumb; JPEG will be fast
  setBillImage(blobUrl)

  // 2. Compress for upload
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',  // ensure JPEG output (handles iOS HEIC → JPEG conversion)
  })

  // 3. Convert to base64
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(compressed)
  })

  return base64
}
```

### Pattern 3: Zustand Store Extension

**What:** Add `billImageUrl`, `ocrStatus`, and their actions to the existing store without breaking existing state or actions.

**When to use:** Extending the Phase 1 store for Phase 2 additions.

**Example:**
```typescript
// Source: stores/useBillStore.ts (existing codebase) [VERIFIED]
// Add to BillState interface:
interface BillState {
  // ... existing fields ...
  billImageUrl: string | null
  ocrStatus: 'idle' | 'loading' | 'done' | 'error'
  setBillImage: (url: string | null) => void
  setOcrStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void
}

// Add to INITIAL_STATE:
const INITIAL_STATE = {
  // ... existing fields ...
  billImageUrl: null,
  ocrStatus: 'idle' as const,
}

// Add to create() implementation:
setBillImage: (url) => set({ billImageUrl: url }),
setOcrStatus: (status) => set({ ocrStatus: status }),
```

### Pattern 4: React Portal Loading Overlay

**What:** Render a full-screen fixed overlay outside the WizardShell DOM subtree using `ReactDOM.createPortal`.

**When to use:** When an overlay must cover the entire viewport regardless of parent stacking context.

**Example:**
```typescript
// Source: [ASSUMED - standard React Portal pattern]
import { createPortal } from 'react-dom'
import { LoaderCircle } from 'lucide-react'

export function OcrLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible || typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 transition-opacity duration-150">
      <div className="flex flex-col items-center gap-4">
        <LoaderCircle size={40} className="text-white animate-spin" />
        <p className="text-[16px] text-white">Scanning your bill…</p>
      </div>
    </div>,
    document.body
  )
}
```

### Pattern 5: @base-ui/react Toast Integration

**What:** Wrap the app in `Toast.Provider` at layout level; use `useToastManager()` inside a ToastList renderer to iterate and render toasts.

**When to use:** Phase 2 error toast on OCR failure.

**Example:**
```typescript
// Source: https://base-ui.com/react/components/toast [CITED]

// In app/layout.tsx — wrap children:
import { Toast } from '@base-ui/react/toast'
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Toast.Provider>
          {children}
          <ToastList />
        </Toast.Provider>
      </body>
    </html>
  )
}

// ToastList component (new file):
function ToastList() {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed bottom-4 left-4 right-4 z-50 max-w-[480px] mx-auto flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="bg-zinc-900 text-white rounded-xl px-4 py-3 shadow-lg"
          >
            <Toast.Description className="text-[16px]" />
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

// In AddItemsStep (or OCR handler) — trigger the toast:
const toastManager = Toast.useToastManager()
toastManager.add({
  description: "Couldn't read the bill — try again or enter manually",
  timeout: 4000,
})
```

### Anti-Patterns to Avoid

- **Floating-point price parsing:** GPT-4o-mini will return floats unless explicitly constrained. Use `json_schema` with `"type": "integer"` on `priceCents`, AND add a prompt instruction `"priceCents must be an integer"`. Both constraints together are more reliable than either alone.
- **Storing blob URL in localStorage or serialized JSON:** Blob URLs are in-memory only; they become invalid after page reload. Zustand does not persist this store (no `persist` middleware), so this is safe. Do not add persistence middleware to useBillStore.
- **Using Dialog for the loading overlay:** shadcn Dialog (backed by `@base-ui/react/dialog`) adds `role="dialog"`, `aria-modal="true"`, and a focus trap — none of which are appropriate for a process-state overlay. Use a raw `fixed` div via `createPortal`.
- **Calling OpenAI from the browser:** The `OPENAI_API_KEY` must never be exposed to the client. Always proxy through the Route Handler. Never use `NEXT_PUBLIC_OPENAI_API_KEY`.
- **Not setting `fileType: 'image/jpeg'` in compression options:** iOS Safari with `accept="image/*"` may deliver HEIC images. Setting `fileType: 'image/jpeg'` in browser-image-compression forces JPEG output regardless of input format. The OpenAI API accepts JPEG reliably; HEIC support is not guaranteed.
- **Not handling the `file picker cancelled` case:** When the user opens the file picker and cancels without selecting, the `change` event does not fire. Do not set `ocrStatus = 'loading'` until a file is confirmed selected.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image compression | Manual canvas resize + quality iteration | browser-image-compression | EXIF orientation handling, HEIC detection, Web Worker threading, progressive quality reduction — many edge cases |
| Structured JSON from LLM | Prompt-only JSON parsing with regex | `response_format: { type: 'json_schema', ... }` | Enforces schema at API level; eliminates parsing errors without fallback logic |
| Toast lifecycle management | Custom useState + setTimeout dismiss | `@base-ui/react` Toast with `useToastManager` | Provider already handles stacking, auto-dismiss, accessibility `aria-live`, animation |
| OpenAI API client | Fetch wrapper | `openai` npm package | Handles retries, streaming, error typing, model-specific content types |

**Key insight:** The image compression and LLM output parsing are both domains with invisible edge cases that only surface in production (dim restaurant lighting, curved receipts, HEIC iOS output). Use libraries designed for these problems.

---

## Common Pitfalls

### Pitfall 1: GPT-4o-mini Returns Float Prices
**What goes wrong:** Model returns `{"priceCents": 12.99}` instead of `{"priceCents": 1299}`.
**Why it happens:** The model infers "cents" but may still produce decimal values without strict constraints.
**How to avoid:** Use BOTH `response_format` with `"type": "integer"` on the priceCents property AND include the rule `"priceCents must be an integer (e.g. $12.99 → 1299)"` in the system prompt. The JSON schema constraint alone is sometimes ignored without the textual reinforcement.
**Warning signs:** Items with very small priceCents values (e.g., 12 instead of 1200).

### Pitfall 2: iOS HEIC Output Breaks Base64 Encoding
**What goes wrong:** iOS Safari delivers a `.jpg` file but it's actually HEIC internally; the OpenAI API may reject it or return garbled output.
**Why it happens:** iOS Safari 17+ auto-converts HEIC to JPEG only in some contexts. With `accept="image/*"` and `capture="environment"`, the file may be HEIC masquerading as JPEG.
**How to avoid:** Set `fileType: 'image/jpeg'` in browser-image-compression options. This forces re-encoding to JPEG regardless of input. The compressed output is guaranteed JPEG.
**Warning signs:** OCR errors only on iOS devices; Android and desktop work fine.

### Pitfall 3: Toast.Provider Not in Component Tree
**What goes wrong:** `useToastManager()` throws "No ToastContext found" at runtime.
**Why it happens:** `@base-ui/react` Toast requires `Toast.Provider` as an ancestor. If it's only inside `AddItemsStep` or `WizardShell`, it won't be in scope when the error fires.
**How to avoid:** Add `Toast.Provider` to `app/layout.tsx` (root layout), wrapping all children. The `ToastList` component (with Viewport and toasts map) must also be inside the Provider.
**Warning signs:** Works in Storybook but throws in the app.

### Pitfall 4: URL.createObjectURL Not Available in jsdom Tests
**What goes wrong:** Tests throw `URL.createObjectURL is not a function` when simulating file selection.
**Why it happens:** jsdom 29 does not implement `URL.createObjectURL` — it's undefined. [VERIFIED: local jsdom probe]
**How to avoid:** Add to `vitest.setup.ts`:
```typescript
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()
```
**Warning signs:** Test suite crashes on `<AddItemsStep />` render after Phase 2 changes.

### Pitfall 5: File Input onChange vs No-op on Cancel
**What goes wrong:** A cancelled file picker leaves the input in an indeterminate state; if the handler triggers OCR on any input event, it may fire unexpectedly.
**Why it happens:** `<input type="file">` does not fire `change` if the user cancels — but `click` fires regardless.
**How to avoid:** Gate all OCR logic on `e.target.files && e.target.files.length > 0` before proceeding. Reset the input's `value` to `""` after each use so selecting the same file twice fires `change` again.

### Pitfall 6: Next.js Route Handler Has No Default Body Size Override for App Router
**What goes wrong:** Images larger than the default Next.js request body limit are silently truncated or rejected.
**Why it happens:** App Router Route Handlers use the Web Fetch Request API and do not apply the Pages Router `bodyParser` config. The effective limit depends on the runtime.
**How to avoid:** The image is compressed to ~500KB before upload. This is well within Vercel's 4.5MB function payload limit and Node.js's default limits. No special config needed at this image size. If the image grows beyond 1MB, add `export const config = { api: { bodyParser: { sizeLimit: '2mb' } } }` but this should not be needed.

### Pitfall 7: ocrStatus 'done' Does Not Reset on New Session
**What goes wrong:** On second scan in the same session, the "Scan bill" button is hidden (because ocrStatus === 'done') even after the user wants to re-scan.
**Why it happens:** The CONTEXT.md spec says the scan button hides when `ocrStatus === 'done'`, but does not describe a re-scan path in the success case.
**How to avoid:** The UI-SPEC says "Re-shown after scan failure (ocrStatus === 'error')". For re-scanning on success: the current design has no explicit re-scan button — the user would need to add items manually or reset. This is acceptable for Phase 2 MVP. Document this in the plan as a known limitation.

---

## Code Examples

### Complete OCR flow (client side)

```typescript
// Source: browser-image-compression docs + React standard patterns [CITED + ASSUMED]
import imageCompression from 'browser-image-compression'

const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return  // user cancelled

  // Reset input so same file can be selected again
  e.target.value = ''

  // Set thumbnail immediately
  const blobUrl = URL.createObjectURL(file)
  setBillImage(blobUrl)
  setOcrStatus('loading')

  try {
    // Compress + force JPEG
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg',
    })

    // Convert to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(compressed)
    })

    // Call OCR route
    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    })
    if (!res.ok) throw new Error(`OCR route returned ${res.status}`)

    const { items } = await res.json() as { items: { name: string; priceCents: number }[] }
    items.forEach(item => addItem(item.name, item.priceCents))
    setOcrStatus('done')
  } catch (err) {
    console.error(err)
    setOcrStatus('error')
    toastManager.add({
      description: "Couldn't read the bill — try again or enter manually",
      timeout: 4000,
    })
  }
}
```

### GPT-4o-mini vision with structured output

```typescript
// Source: https://developers.openai.com/api/docs/guides/images-vision [CITED]
// Source: https://developers.openai.com/api/docs/guides/migrate-to-responses (json_schema) [CITED]
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: RECEIPT_PROMPT },
      { type: 'image_url', image_url: { url: base64DataUrl, detail: 'high' } }
    ]
  }],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'receipt_items',
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
                priceCents: { type: 'integer' }
              },
              required: ['name', 'priceCents'],
              additionalProperties: false
            }
          }
        },
        required: ['items'],
        additionalProperties: false
      }
    }
  }
})
```

---

## Runtime State Inventory

> Omitted — this is a greenfield feature addition (new route handler + store extension), not a rename/refactor/migration phase.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js Route Handler / OpenAI SDK | Yes | v24.15.0 | — |
| Next.js | App Router Route Handler | Yes | 16.2.6 | — |
| openai npm package | OCR Route Handler | No — needs install | 6.37.0 (latest) | None — must install |
| browser-image-compression | Client-side compression | No — needs install | 2.0.2 (latest) | None — must install |
| @base-ui/react Toast | Error toast | Yes (transitive dep) | 1.4.1 | — |
| OPENAI_API_KEY env var | OCR Route Handler | No — must create .env.local | — | None — must configure |

**Missing dependencies with no fallback:**

- `openai` package: Run `npm install openai` in Wave 0
- `browser-image-compression` package: Run `npm install browser-image-compression` in Wave 0
- `OPENAI_API_KEY`: Create `.env.local` with `OPENAI_API_KEY=<key>` before testing OCR route

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

**Current baseline:** 85 tests, all passing. [VERIFIED: local test run]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OCR-01 | "Scan bill" button visible in Step 2 (idle state) | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | Partial (existing file, new tests needed) |
| OCR-01 | File input triggers compression + OCR call on file select | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 |
| OCR-01 | ocrStatus transitions: idle → loading → done | unit | `npx vitest run __tests__/useBillStore.test.ts` | No — Wave 0 |
| OCR-01 | OCR route handler returns `{ items }` for valid base64 input | unit | `npx vitest run __tests__/ocrRoute.test.ts` | No — Wave 0 |
| OCR-03 | OCR items appear in items list as editable rows after scan | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 |
| OCR-03 | Loading overlay visible when ocrStatus === 'loading' | unit | `npx vitest run __tests__/OcrLoadingOverlay.test.tsx` | No — Wave 0 |
| OCR-03 | Error toast fires on ocrStatus === 'error' | unit | `npx vitest run __tests__/AddItemsStep.test.tsx` | No — Wave 0 |

**Note on OCR route test:** The Route Handler test is a unit test of the parsing/validation logic only. Tests that call the live OpenAI API are skipped in CI (mark with `it.skip` or environment guard `if (!process.env.OPENAI_API_KEY)`).

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (85 existing + Phase 2 additions) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.setup.ts` — add `URL.createObjectURL` and `URL.revokeObjectURL` mocks (required for file-selection tests)
- [ ] `__tests__/useBillStore.test.ts` — new cases for `billImageUrl`, `ocrStatus`, `setBillImage`, `setOcrStatus`
- [ ] `__tests__/AddItemsStep.test.tsx` — new cases for scan button visibility, OCR item population, overlay, error toast
- [ ] `__tests__/ocrRoute.test.ts` — new file; unit tests for Route Handler parsing logic (mock `openai` module with `vi.mock`)
- [ ] `__tests__/OcrLoadingOverlay.test.tsx` — new file; renders when `visible=true`, absent when `visible=false`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes | Validate `image` field present and is a string; validate response JSON before calling `addItem` |
| V6 Cryptography | No | — |
| V7 Error Handling | Yes | Never expose OpenAI error details to client; log server-side only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure | Information Disclosure | `OPENAI_API_KEY` in server-only env var (no `NEXT_PUBLIC_` prefix); only accessed in Route Handler |
| Oversized image upload | Denial of Service | Browser-image-compression caps at 500KB before POST; Route Handler validates `image` field |
| Malformed JSON response from LLM | Tampering | Wrap `JSON.parse` in try/catch; return 500 on parse failure; never pass un-parsed response to client |
| Prompt injection via image text | Tampering | System prompt has strict output schema; `response_format: json_schema` with `strict: true` constrains model output format |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Vision + GPT text LLM (two API calls) | Single GPT-4o-mini vision call | ~2023 (GPT-4V) | Simpler architecture, one credential, lower latency |
| Tesseract.js (WASM) | GPT-4o-mini vision | ~2023 | ~10MB WASM eliminated; accuracy better on thermal receipts |
| `response_format: { type: 'json_object' }` | `response_format: { type: 'json_schema', ... }` | 2024 (Structured Outputs) | Schema enforced at API level; eliminates unparseable responses |
| Vercel KV | Upstash Redis | December 2024 | Vercel KV deprecated; Upstash is the replacement (Phase 4 concern, not Phase 2) |

**Deprecated/outdated:**

- `response_format: { type: 'json_object' }`: Valid but less strict than `json_schema`. Does not enforce field types or required fields. Use `json_schema` with `strict: true` for OCR.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GPT-4o-mini vision accurately extracts receipt line items from real-world photos (thermal receipts, varying lighting) | Architecture Patterns | OCR quality may be lower in practice; fallback is manual entry (already built) |
| A2 | `detail: 'high'` is needed for dense receipt text; `detail: 'low'` may miss items | Standard Stack / Code Examples | If `high` is not needed, `low` (85 tokens) would reduce cost significantly; test early |
| A3 | `fileType: 'image/jpeg'` in browser-image-compression correctly forces HEIC→JPEG on iOS Safari | Common Pitfalls | If conversion fails, iOS HEIC images will fail OCR; test on physical iPhone required |
| A4 | The `@base-ui/react` Toast `Toast.Provider` placed in `app/layout.tsx` will not cause RSC issues with Next.js 16 (requires `'use client'` or client boundary) | Architecture Patterns | If `app/layout.tsx` cannot use `'use client'`, Toast.Provider needs to be in a separate Client Component wrapper |
| A5 | OpenAI `json_schema` with `strict: true` and `"type": "integer"` reliably prevents float price output | Common Pitfalls | If floats still appear, add a client-side `Math.round()` safety guard on `priceCents` before calling `addItem` |

---

## Open Questions

1. **`app/layout.tsx` and `'use client'`**
   - What we know: `Toast.Provider` is a Client Component (uses React context). Next.js App Router layout files can render Server Components.
   - What's unclear: The current `app/layout.tsx` may not have `'use client'`. Adding `Toast.Provider` directly would require either making the whole layout a Client Component (losing RSC benefits) or wrapping it in a dedicated `<Providers>` Client Component.
   - Recommendation: Create `app/providers.tsx` as a `'use client'` wrapper containing only `Toast.Provider`. Import it in `app/layout.tsx`. This is the standard Next.js pattern for Client Context Providers.

2. **gpt-4o-mini vs gpt-4o for receipt accuracy**
   - What we know: CLAUDE.md and STATE.md both specify gpt-4o-mini. It's cost-optimized.
   - What's unclear: Real-world receipt OCR accuracy for gpt-4o-mini on faded thermal receipts has not been validated.
   - Recommendation: Implement with gpt-4o-mini as specified. Add a TODO comment in the route handler to make the model configurable via env var for easy A/B testing.

3. **Blob URL revocation timing**
   - What we know: `billImageUrl` holds a blob URL. Blob URLs should be revoked when no longer needed to free memory.
   - What's unclear: The CONTEXT.md stores it for the session. The `reset()` action clears state but does not revoke the blob URL.
   - Recommendation: In the `reset()` action, revoke the existing blob URL before setting `billImageUrl: null`. This prevents memory leaks on session reset.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| Integer-cents arithmetic everywhere | OCR API must return `priceCents: integer`; prompt must enforce this; client must not apply floating arithmetic to parsed items |
| Single Zustand store for all state | `billImageUrl` and `ocrStatus` go into the existing `useBillStore`, not a new store |
| Use GPT-4o-mini for OCR (not Google Vision) | Single API call; `OPENAI_API_KEY` env var only |
| Use `<input type="file" accept="image/*" capture="environment">` | No `react-webcam` or `getUserMedia`; native input handles camera |
| Use `browser-image-compression` 2.x | Target ~500KB JPEG; `fileType: 'image/jpeg'` for iOS compatibility |
| Zustand 5.x; no Provider wrapping issues with RSC | Store can be accessed in Client Components without a Provider |
| No separate backend — App Router Route Handlers | OCR route at `app/api/ocr/route.ts` |
| Vercel Hobby/Pro deployment | `maxDuration = 30` in route handler is within Hobby limits (60s); default is fine for most calls |

---

## Sources

### Primary (HIGH confidence)

- `/openai/openai-node` (Context7) — chat completions create, structured outputs
- `/websites/developers_openai_api` (Context7) — vision base64 image input, json_schema response format, gpt-4o-mini pricing
- `/donaldcwl/browser-image-compression` (Context7) — imageCompression() API, options, fileType parameter
- `/vercel/next.js` (Context7) — Route Handler POST formData, environment variables, maxDuration config
- `https://base-ui.com/react/components/toast` (WebFetch) — Toast.Provider, useToastManager, full composition pattern
- Local codebase inspection — useBillStore.ts, AddItemsStep.tsx, package.json, node_modules/@base-ui/react/toast/
- Local npm registry — openai@6.37.0, browser-image-compression@2.0.2 confirmed latest versions

### Secondary (MEDIUM confidence)

- WebSearch: iOS Safari HEIC/JPEG behavior with `<input capture>` — multiple sources corroborate HEIC conversion issue; fileType fix recommended
- WebSearch: GPT-4o-mini vision receipt OCR accuracy — community reports ~90%+ accuracy; floats-vs-integers issue documented

### Tertiary (LOW confidence)

- A1-A5 in Assumptions Log — test-driven validation needed before relying on them in production

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions verified against npm registry and node_modules
- Architecture: HIGH — Route Handler pattern verified via Context7; OpenAI vision pattern verified via official docs
- @base-ui/react Toast: HIGH — fetched from official docs; existing pattern confirmed in local codebase
- Pitfalls: MEDIUM-HIGH — iOS HEIC and jsdom URL.createObjectURL verified; float pricing pitfall from community reports
- OCR accuracy: LOW — no production testing; gpt-4o-mini on real thermal receipts not validated

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days; openai SDK updates frequently — verify version before release)
