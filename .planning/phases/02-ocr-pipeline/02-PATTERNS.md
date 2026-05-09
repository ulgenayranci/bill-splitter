# Phase 2: OCR Pipeline - Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 7
**Analogs found:** 6 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/api/ocr/route.ts` | route-handler | request-response | None (no Route Handlers exist yet) | no-analog |
| `app/layout.tsx` | config | request-response | `app/layout.tsx` (self — modify) | self |
| `app/providers.tsx` | provider | request-response | `app/page.tsx` (client-boundary wrapper pattern) | role-match |
| `stores/useBillStore.ts` | store | CRUD | `stores/useBillStore.ts` (self — extend) | self |
| `components/wizard/AddItemsStep.tsx` | component | event-driven | `components/wizard/AddItemsStep.tsx` (self — modify) | self |
| `components/wizard/OcrLoadingOverlay.tsx` | component | event-driven | `components/ui/dialog.tsx` (portal + overlay pattern) | role-match |
| `components/wizard/OcrErrorToast.tsx` | component | event-driven | `components/ui/dialog.tsx` (@base-ui/react composition) | role-match |

---

## Pattern Assignments

### `app/api/ocr/route.ts` (route-handler, request-response)

**Analog:** None — first Route Handler in the project. Use RESEARCH.md Pattern 1 as the canonical source.

**No analog exists in the codebase.** The project has no existing `app/api/` directory. The RESEARCH.md Pattern 1 (lines 192–263) is the primary source.

**Imports pattern to create** (from RESEARCH.md Pattern 1, lines 197–200):
```typescript
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
```

**Core Route Handler pattern** (from RESEARCH.md Pattern 1, lines 213–263):
```typescript
export const maxDuration = 30

export async function POST(request: Request) {
  const { image } = await request.json() as { image: string }
  if (!image) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }
  try {
    // ... OpenAI call ...
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('OCR error:', err)
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  }
}
```

**Security constraint (from RESEARCH.md):** `OPENAI_API_KEY` must be a server-only env var — never use `NEXT_PUBLIC_` prefix. Instantiate `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` at module scope.

---

### `app/layout.tsx` (config, modify)

**Analog:** `app/layout.tsx` (self — lines 1–23)

**Current imports pattern** (lines 1–4):
```typescript
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
```

**Current body pattern** (lines 18–22):
```typescript
return (
  <html lang="en" className={cn("font-sans", geist.variable)}>
    <body>{children}</body>
  </html>
);
```

**Modification target:** Wrap `{children}` inside `<Providers>` imported from `./providers`. The layout itself stays as a Server Component (no `'use client'`). The `Providers` component is the client boundary.

```typescript
// After modification:
import { Providers } from './providers'

// ...
<body>
  <Providers>{children}</Providers>
</body>
```

---

### `app/providers.tsx` (provider, new)

**Analog:** `app/page.tsx` (lines 1–22) — the closest existing `'use client'` wrapper pattern

**'use client' declaration pattern** (`app/page.tsx` line 1):
```typescript
'use client'
```

**Import pattern** (`app/page.tsx` lines 3–9):
```typescript
import { useBillStore } from '@/stores/useBillStore'
import { WizardShell } from '@/components/wizard/WizardShell'
// etc.
```

**Client boundary wrapper pattern** (standard Next.js — no codebase analog; use RESEARCH.md Pattern 5, lines 367–379):
```typescript
'use client'

import { Toast } from '@base-ui/react/toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider>
      {children}
      <OcrErrorToast />
    </Toast.Provider>
  )
}
```

**Note:** `Toast.Provider` requires `'use client'`. Placing it in `providers.tsx` keeps `layout.tsx` as a Server Component — this is the standard Next.js App Router pattern for client context providers.

---

### `stores/useBillStore.ts` (store, CRUD, modify)

**Analog:** `stores/useBillStore.ts` (self — lines 1–94)

**Interface extension pattern** (lines 27–43 — add after existing fields):
```typescript
// Existing interface block (lines 27-43):
interface BillState {
  step: 1 | 2 | 3 | 4 | 5
  people: Person[]
  items: Item[]
  assignments: Record<ItemId, PersonId[]>
  tipPercent: number
  nextColorIndex: number
  setStep: (step: BillState['step']) => void
  // ... existing actions ...
  reset: () => void
}
```

**Fields to add to BillState interface:**
```typescript
billImageUrl: string | null
ocrStatus: 'idle' | 'loading' | 'done' | 'error'
setBillImage: (url: string | null) => void
setOcrStatus: (status: 'idle' | 'loading' | 'done' | 'error') => void
```

**INITIAL_STATE extension pattern** (lines 45–52 — add fields):
```typescript
const INITIAL_STATE = {
  step: 1 as const,
  people: [],
  items: [],
  assignments: {},
  tipPercent: 18,
  nextColorIndex: 0,
  // Add:
  billImageUrl: null,
  ocrStatus: 'idle' as const,
}
```

**Action implementation pattern** (lines 54–94 — follow existing `set()` call pattern):
```typescript
// Existing simple setter pattern (line 56):
setStep: (step) => set({ step }),

// New actions follow same pattern:
setBillImage: (url) => set({ billImageUrl: url }),
setOcrStatus: (status) => set({ ocrStatus: status }),
```

**reset() extension — blob URL revocation** (line 93):
```typescript
// Current:
reset: () => set({ ...INITIAL_STATE }),

// After modification (revoke blob URL before clearing):
reset: () => set((s) => {
  if (s.billImageUrl) URL.revokeObjectURL(s.billImageUrl)
  return { ...INITIAL_STATE }
}),
```

---

### `components/wizard/AddItemsStep.tsx` (component, event-driven, modify)

**Analog:** `components/wizard/AddItemsStep.tsx` (self — lines 1–261)

**Imports to add** (after existing imports at lines 1–18):
```typescript
import { useRef, useCallback } from 'react'
import { Camera } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { Toast } from '@base-ui/react/toast'
import { OcrLoadingOverlay } from './OcrLoadingOverlay'
```

**Additional store selectors pattern** (lines 39–43 — follow existing `useBillStore` selector pattern):
```typescript
// Existing pattern:
const items = useBillStore((s) => s.items)
const addItem = useBillStore((s) => s.addItem)

// New selectors to add:
const billImageUrl = useBillStore((s) => s.billImageUrl)
const ocrStatus = useBillStore((s) => s.ocrStatus)
const setBillImage = useBillStore((s) => s.setBillImage)
const setOcrStatus = useBillStore((s) => s.setOcrStatus)
```

**Toast hook pattern** (inside component, after store selectors):
```typescript
const toastManager = Toast.useToastManager()
const fileInputRef = useRef<HTMLInputElement>(null)
```

**File input handler pattern** (from RESEARCH.md Code Examples, lines 489–537):
```typescript
const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''  // reset so same file can be selected again

  const blobUrl = URL.createObjectURL(file)
  setBillImage(blobUrl)
  setOcrStatus('loading')

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg',
    })
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(compressed)
    })
    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    })
    if (!res.ok) throw new Error(`OCR route returned ${res.status}`)
    const { items: ocrItems } = await res.json() as { items: { name: string; priceCents: number }[] }
    ocrItems.forEach((item) => addItem(item.name, item.priceCents))
    setOcrStatus('done')
  } catch (err) {
    console.error(err)
    setOcrStatus('error')
    toastManager.add({
      description: "Couldn't read the bill — try again or enter manually",
      timeout: 4000,
    })
  }
}, [setBillImage, setOcrStatus, addItem, toastManager])
```

**Hidden file input JSX pattern** (add inside return, near scan button):
```typescript
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  capture="environment"
  className="sr-only"
  onChange={handleFileChange}
  aria-hidden="true"
  tabIndex={-1}
/>
```

**Scan button pattern** (follow existing Button usage pattern from lines 225–232):
```typescript
{ocrStatus !== 'done' && (
  <Button
    type="button"
    variant="outline"
    onClick={() => fileInputRef.current?.click()}
    className="h-12 w-full gap-2"
  >
    <Camera size={20} />
    Scan bill
  </Button>
)}
```

**Thumbnail display pattern** (use Card from existing import, lines 7):
```typescript
{billImageUrl && (
  <div className="relative w-full overflow-hidden rounded-xl">
    <img
      src={billImageUrl}
      alt="Bill photo"
      className="w-full object-cover max-h-48 rounded-xl"
    />
  </div>
)}
```

**Loading overlay placement** (render at bottom of return, before closing `</div>`):
```typescript
<OcrLoadingOverlay visible={ocrStatus === 'loading'} />
```

---

### `components/wizard/OcrLoadingOverlay.tsx` (component, event-driven, new)

**Analog:** `components/ui/dialog.tsx` (lines 26–40) — closest portal+overlay pattern in codebase

**Dialog overlay pattern for reference** (`components/ui/dialog.tsx` lines 26–40):
```typescript
function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 ...",
        className
      )}
      {...props}
    />
  )
}
```

**New component — React Portal pattern** (from RESEARCH.md Pattern 4, lines 343–355):
```typescript
'use client'

import { createPortal } from 'react-dom'
import { LoaderCircle } from 'lucide-react'

export function OcrLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible || typeof document === 'undefined') return null
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-label="Scanning your bill"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80"
    >
      <div className="flex flex-col items-center gap-4">
        <LoaderCircle size={40} className="text-white animate-spin" aria-hidden="true" />
        <p className="text-[16px] text-white">Scanning your bill…</p>
      </div>
    </div>,
    document.body
  )
}
```

**Key differences from Dialog overlay:**
- Uses `createPortal` directly (not `@base-ui/react/dialog` — RESEARCH.md explicitly warns against Dialog for process-state overlays)
- No focus trap, no `role="dialog"`, no `aria-modal`
- SSR guard: `typeof document === 'undefined'` check required (Next.js renders on server)
- `'use client'` directive required for `createPortal`

---

### `components/wizard/OcrErrorToast.tsx` (component, event-driven, new)

**Analog:** `components/ui/dialog.tsx` (lines 1–161) — `@base-ui/react` composition pattern

**@base-ui/react composition pattern** (`components/ui/dialog.tsx` lines 1–5):
```typescript
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"
```

**New component — Toast composition pattern** (from RESEARCH.md Pattern 5, lines 383–408):
```typescript
'use client'

import { Toast } from '@base-ui/react/toast'
import { cn } from '@/lib/utils'

export function OcrErrorToast() {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport
        className={cn(
          'fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-[480px] flex-col gap-2'
        )}
      >
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="rounded-xl bg-zinc-900 px-4 py-3 text-white shadow-lg"
          >
            <Toast.Description className="text-[16px]" />
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
```

**Critical constraint:** `OcrErrorToast` must be rendered inside `Toast.Provider`. Place it in `app/providers.tsx` alongside the Provider (see `providers.tsx` pattern above). Using `Toast.useToastManager()` outside the Provider throws at runtime.

---

## Shared Patterns

### 'use client' directive
**Source:** `components/wizard/AddItemsStep.tsx` line 1, `app/page.tsx` line 1, `components/ui/dialog.tsx` line 1
**Apply to:** `app/providers.tsx`, `components/wizard/OcrLoadingOverlay.tsx`, `components/wizard/OcrErrorToast.tsx`

All new client components in this project declare `'use client'` as the first line of the file.

```typescript
'use client'
```

### Path alias imports
**Source:** `components/wizard/AddItemsStep.tsx` lines 5–18
**Apply to:** All new component and store files

The project uses `@/` as the root alias for all imports:
```typescript
import { Button } from '@/components/ui/button'
import { useBillStore } from '@/stores/useBillStore'
import { cn } from '@/lib/utils'
```

### Zustand selector pattern
**Source:** `components/wizard/AddItemsStep.tsx` lines 38–43
**Apply to:** `components/wizard/AddItemsStep.tsx` (modified), `components/wizard/OcrErrorToast.tsx`

Each selector is a separate `useBillStore((s) => s.field)` call — not destructuring the whole store:
```typescript
const items = useBillStore((s) => s.items)
const addItem = useBillStore((s) => s.addItem)
```

### Tailwind class conventions
**Source:** `components/wizard/AddItemsStep.tsx` lines 225–232, `components/wizard/AddPeopleStep.tsx` lines 95–100
**Apply to:** All new component JSX

- CTA buttons: `h-12 w-full` with amber accent `bg-amber-600 hover:bg-amber-700`
- Interactive elements: `rounded-md` or `rounded-xl`, touch target minimum `h-12 w-12`
- Text sizes: `text-[16px]` for body, `text-[20px] font-semibold` for headings — explicit pixel sizes via arbitrary values
- Safe-area inset: `style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}` on bottom CTAs

### @base-ui/react import convention
**Source:** `components/ui/dialog.tsx` line 4, `components/ui/button.tsx` line 1
**Apply to:** `app/providers.tsx`, `components/wizard/OcrErrorToast.tsx`

Imports use the subpath pattern, not the barrel:
```typescript
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
// For Toast:
import { Toast } from '@base-ui/react/toast'
```

### cn() for class merging
**Source:** `components/ui/dialog.tsx` line 6, `components/ui/button.tsx` line 3
**Apply to:** `components/wizard/OcrLoadingOverlay.tsx`, `components/wizard/OcrErrorToast.tsx`

```typescript
import { cn } from '@/lib/utils'
// Usage:
className={cn('base-classes', conditionalClass && 'conditional')}
```

### Test file structure
**Source:** `__tests__/AddItemsStep.test.tsx` lines 1–6, `__tests__/useBillStore.test.ts` lines 1–4
**Apply to:** All new test files

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useBillStore } from '@/stores/useBillStore'

describe('ComponentName', () => {
  beforeEach(() => {
    useBillStore.getState().reset()
  })
  afterEach(() => {
    cleanup()
  })
  // ...
})
```

### vitest.setup.ts additions required
**Source:** `vitest.setup.ts` (currently lines 1–6 — no active setup)
**Apply to:** `vitest.setup.ts` (modify before writing file-selection tests)

```typescript
// Required mocks for URL.createObjectURL (jsdom does not implement it):
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/api/ocr/route.ts` | route-handler | request-response | No Route Handlers exist in the project yet — first `app/api/` file. Use RESEARCH.md Pattern 1 (lines 192–263) as canonical source. |

---

## Metadata

**Analog search scope:** `app/`, `components/`, `stores/`, `lib/`, `__tests__/`
**Files scanned:** 26
**Pattern extraction date:** 2026-05-09
