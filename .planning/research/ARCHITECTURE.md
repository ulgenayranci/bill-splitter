# Architecture Patterns

**Domain:** Mobile-friendly bill splitter web app with receipt OCR and AI expansion
**Researched:** 2026-05-08
**Confidence:** MEDIUM-HIGH (training knowledge; external tools unavailable for verification)

---

## Recommended Architecture

This is a **single-page application with a server-side OCR+AI pipeline**. The client owns all interactive UI state; the server handles only the two computationally heavy, privacy-sensitive operations: OCR and AI name expansion. Persistence is ephemeral — a session lives in a short-lived server-side store (Redis or in-memory), keyed by a shareable ID.

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (SPA)                        │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  Camera  │  │  Wizard  │  │  Calculation Engine  │  │
│  │  Capture │→ │  State   │→ │  (pure functions)    │  │
│  │  Module  │  │  Store   │  └──────────────────────┘  │
│  └──────────┘  └────┬─────┘                            │
│                     │ sync on change                   │
└─────────────────────┼───────────────────────────────────┘
                      │ HTTP
┌─────────────────────┼───────────────────────────────────┐
│                SERVER│(API)                             │
│                     │                                   │
│  ┌──────────────────▼──────────────────────────────┐   │
│  │              Session Store (Redis / memory)      │   │
│  │   sessionId → { items, people, assignments, ... }│   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌───────────────┐     ┌──────────────────────────┐    │
│  │  OCR Service  │     │  AI Expansion Service    │    │
│  │  (image→text) │     │  (raw text→clean names)  │    │
│  └───────────────┘     └──────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Location |
|-----------|---------------|-------------------|----------|
| Camera Capture | Access device camera/file picker, capture image, compress before upload | Wizard State Store | Client |
| Wizard State Store | Owns all session state: people, items, assignments, tip/tax, current step | Every UI component; Session Sync | Client |
| Calculation Engine | Pure functions: per-person subtotal, proportional tip/tax, final owed amounts | Wizard State Store (read), Results UI (write) | Client |
| Session Sync | Serializes wizard state → server session; polls/pushes for multi-user sync | Wizard State Store; Session API | Client |
| Session API | CRUD for session state; generates shareable IDs | Session Store; client | Server |
| OCR Service | Accepts image upload, returns structured line items `[{name, price}]` | Session API (orchestrates call) | Server |
| AI Expansion Service | Accepts raw item names + optional menu context, returns expanded names | Session API (orchestrates call) | Server |
| Session Store | Ephemeral KV store for session data, TTL 24h | Session API | Server |

### What stays client-only

- All calculation math (subtotals, proportional splits, per-person totals)
- UI step progression logic
- Assignment state (who ordered what)
- Tip and tax input state
- People list management

### What requires server

- OCR (image processing is CPU-heavy and should not run in the main browser thread at scale; server allows using cloud OCR APIs like Google Vision or AWS Textract which are significantly more accurate than Tesseract.js for restaurant receipts)
- AI name expansion (requires LLM API call with a secret key)
- Session persistence for shareable links (client-only storage cannot be accessed from another device)

---

## Data Model

### Core entities and their relationships

```
Session
  id: string (nanoid, URL-safe, 8-12 chars)
  created_at: timestamp
  ttl: 24h
  state: BillState

BillState
  people: Person[]
  items: LineItem[]
  assignments: Assignment[]
  tip: TipConfig
  tax: TaxConfig
  step: WizardStep   // tracks where the group is in the flow

Person
  id: string
  name: string
  color: string      // for visual differentiation in UI

LineItem
  id: string
  raw_name: string   // exactly as OCR returned it, e.g. "CHKN SAND LG"
  display_name: string // AI-expanded, e.g. "Chicken Sandwich (Large)"
  price: number      // in cents to avoid float math
  is_shared: boolean
  source: "ocr" | "manual"

Assignment
  item_id: string
  person_ids: string[]   // 1+ people; if >1, item.is_shared = true
  // note: shared items divide price equally among person_ids

TipConfig
  mode: "percent" | "amount"
  value: number          // percent (e.g. 18) or cents

TaxConfig
  mode: "percent" | "amount"
  value: number

WizardStep
  type: "add_people" | "capture_image" | "review_items" | "assign_items" | "review_totals"
```

### Calculation model (pure, no side effects)

```
for each person P:
  subtotal(P) = sum of price for items assigned solely to P
              + sum of (item.price / assignees.length) for shared items P is part of

  grand_total_subtotal = sum of subtotal(all persons)

  tip_amount(P)  = subtotal(P) / grand_total_subtotal * total_tip
  tax_amount(P)  = subtotal(P) / grand_total_subtotal * total_tax

  owes(P) = subtotal(P) + tip_amount(P) + tax_amount(P)
```

Prices stored in **integer cents** throughout. Display layer formats to dollars. This avoids floating point rounding errors entirely (HIGH confidence — this is the standard approach for financial apps).

---

## Data Flow

### Happy path: Photo to results

```
1. Host opens app
   → Client creates local BillState with empty people/items
   → Client calls POST /sessions → gets sessionId
   → URL updates to /<sessionId>

2. Host adds people
   → Wizard State Store updated locally
   → Session Sync pushes to POST /sessions/:id (debounced, ~500ms)

3. Host captures photo
   → Camera Capture compresses image (target <500KB, JPEG 0.8)
   → POST /sessions/:id/ocr with image blob
   → Server: OCR Service extracts raw line items
   → Server: AI Expansion Service enriches names
   → Server returns: { items: LineItem[] }
   → Client: Wizard State Store merges returned items
   → Client: advances to "review_items" step

4. Host reviews and edits items
   → Any manual edits update Wizard State Store directly
   → Session Sync pushes delta to server

5. Assignment phase
   → Single-driver: Host assigns each item to person(s)
   → Shareable: Host copies link, each person opens /<sessionId>?token=<jwt>
       → Client loads state from GET /sessions/:id
       → Each person marks their own items
       → Each client pushes assignments back via PATCH /sessions/:id/assignments

6. Calculation
   → Runs entirely client-side via Calculation Engine
   → No server round-trip needed
   → Results displayed immediately
```

### OCR pipeline detail

```
Image (JPEG, <500KB)
  → POST /ocr
  → Image pre-processing (server): straighten, contrast enhance
  → Cloud OCR API (Google Vision / AWS Textract) OR Tesseract
  → Raw text lines
  → Line item parser: regex + heuristics to identify (name, price) pairs
  → AI prompt: "Expand these abbreviated receipt item names: [...]"
  → Returns: LineItem[]
```

---

## Client-Side vs Server-Side OCR: Decision

**Use server-side OCR. Reason: accuracy.**

| Dimension | Client-side (Tesseract.js) | Server-side (Vision API / Textract) |
|-----------|---------------------------|--------------------------------------|
| Accuracy on receipts | ~70-80% — receipts are thermal print, skewed, low contrast | ~92-97% — purpose-built models |
| First load | +4-8 MB WASM bundle | 0 |
| Processing speed | 5-15s on mid-range phone | 1-3s server-side |
| Privacy | Image never leaves device | Image sent to server/cloud API |
| Cost | Free | ~$0.0015/image (Vision API) |
| Offline | Yes | No |
| Secret keys | Not needed | API key stays server-side |

**Verdict:** The accuracy gap is decisive for this use case. A bill splitter with 80% OCR accuracy requires too much manual correction, defeating the value proposition. Server-side OCR is not optional — it is architecturally required for the product to work.

Privacy tradeoff: receipt images contain personal/financial data. Mitigate by: (1) not storing images after OCR completes, (2) clear privacy policy, (3) consider deleting session data on explicit "done" action.

---

## Real-Time vs Single-Driver: Decision

**Use optimistic-sync-on-change, not WebSockets.**

The shareable link pattern does not need true real-time sync. The flow is:

1. Host creates session, shares link.
2. Each person opens link, sees current items.
3. Each person independently assigns their own items.
4. Host reviews final state and presents results.

There is no racing assignment conflict (each person owns their own assignments). This means:

- **No WebSockets needed.** Polling every 2-3 seconds is sufficient during the assignment phase.
- **Conflict resolution is trivial:** server stores assignments keyed by person_id, last-write-wins per person is safe.
- **Fallback:** single-driver mode requires no sync at all — host does everything locally, session state is never needed to be shared.

This keeps the architecture dramatically simpler. WebSockets would add a stateful server requirement (cannot use serverless), deployment complexity, and reconnection handling — for no meaningful UX benefit given the non-simultaneous nature of the assignment flow.

---

## State Management Pattern

**Use a single wizard store (Zustand or equivalent) with step-gated slices.**

The multi-step flow has a natural state machine shape:

```
add_people → capture_image → review_items → assign_items → review_totals
                                  ↑
                         [manual_entry fallback]
```

Store structure:

```typescript
interface BillStore {
  // Session
  sessionId: string | null
  step: WizardStep

  // Entities
  people: Person[]
  items: LineItem[]
  assignments: Assignment[]
  tip: TipConfig
  tax: TaxConfig

  // Async states
  ocrStatus: "idle" | "uploading" | "processing" | "done" | "error"
  syncStatus: "idle" | "syncing" | "error"

  // Actions
  addPerson(name: string): void
  removePerson(id: string): void
  setItems(items: LineItem[]): void
  updateItem(id: string, patch: Partial<LineItem>): void
  assignItem(itemId: string, personIds: string[]): void
  setTip(config: TipConfig): void
  setTax(config: TaxConfig): void
  advanceStep(): void
  retreatStep(): void

  // Derived (computed, not stored)
  // totals computed on-demand from items + assignments + tip + tax
}
```

Keep derived values (per-person totals) as **computed properties, not stored state**. This eliminates sync bugs where stored totals drift from source data.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-side OCR as primary path
**What goes wrong:** Tesseract.js WASM bundle adds 4-8 MB to initial load on mobile. Accuracy on thermal receipt photos is insufficient (~70-80%). Users encounter too many misread items and abandon.
**Instead:** Always route OCR through server. Client-side OCR only viable as offline fallback if the product explicitly requires offline operation.

### Anti-Pattern 2: Storing computed totals in state
**What goes wrong:** Assignments change → must remember to recompute totals → bugs where displayed total doesn't match current assignments.
**Instead:** Compute totals inline from authoritative source data (items + assignments + tip + tax). Pure function, no storage.

### Anti-Pattern 3: Float arithmetic for prices
**What goes wrong:** `$12.99 + $8.99 = $21.979999999999997` in JavaScript. Displays incorrectly, splits incorrectly.
**Instead:** Store all prices as integer cents. `1299 + 899 = 2198`. Format for display only at render time.

### Anti-Pattern 4: WebSocket for shareable link sync
**What goes wrong:** Stateful server required (no serverless), reconnection complexity, overkill for non-realtime assignment pattern.
**Instead:** Optimistic local updates + polling during active assignment phase.

### Anti-Pattern 5: Per-item assignment stored as booleans per person
**What goes wrong:** Schema becomes `item.assignedToAlice = true`, `item.assignedToBob = true` — impossible to query "what did Alice order" without scanning all items.
**Instead:** Normalize with `Assignment { item_id, person_ids[] }` or `Assignment { item_id, person_id }` rows. Query by person_id directly.

### Anti-Pattern 6: Session state in localStorage only
**What goes wrong:** Shareable link opens on a different device — no access to localStorage. Entire shareable feature breaks.
**Instead:** Server-side session store (even in-memory) keyed by sessionId in the URL. localStorage is fine as a secondary cache.

---

## Suggested Build Order

Dependencies flow top to bottom. Each layer can only be built after the layers above it.

```
Layer 0: Foundation
  ├── Project scaffold (Next.js or Vite + React)
  ├── Routing (/ for new session, /:sessionId for shared)
  ├── Data types/interfaces (Person, LineItem, Assignment, etc.)
  └── Integer-cents money utilities

Layer 1: Core Logic (no UI, no server)
  ├── Calculation Engine (pure functions, fully testable)
  └── State Store skeleton (Zustand store with all slices, no actions wired)

Layer 2: Manual Entry Flow (proves core loop without OCR)
  ├── Add People step
  ├── Manual item entry (name + price)
  ├── Assign Items step (single-driver)
  ├── Tip/Tax step
  └── Results step
  → At this point you have a working bill splitter (no OCR yet)

Layer 3: Server Foundation
  ├── Session API (POST /sessions, GET /sessions/:id, PATCH /sessions/:id)
  ├── Session Store (in-memory first, Redis later)
  └── Session Sync on client (push state on change)

Layer 4: Shareable Links
  ├── Generate shareable URL /:sessionId
  ├── Load session state from URL on open
  ├── Polling during assignment phase
  └── Per-person assignment isolation (each person edits only their own)

Layer 5: OCR Pipeline
  ├── Camera Capture component (camera + file upload fallback)
  ├── Image compression before upload
  ├── OCR Service integration (Google Vision or Textract)
  ├── Line item parser (text → structured items)
  └── Review/edit OCR results step

Layer 6: AI Expansion
  ├── AI Expansion Service (LLM API call, server-side)
  ├── Ambiguity detection (confidence threshold)
  └── Menu photo fallback path (second OCR call on menu image)

Layer 7: Polish
  ├── Loading states (OCR processing, sync)
  ├── Error recovery (OCR failed → manual entry)
  ├── Mobile camera UX (viewfinder, capture feedback)
  └── Share sheet integration (navigator.share API)
```

**Critical dependency:** Layer 5 (OCR) requires Layer 3 (Server) because OCR runs server-side. But Layers 1-2 are entirely client-side — you can build and ship a working manual-entry bill splitter before writing a single line of server code. This is the correct order: validate the calculation model and UX before investing in the OCR pipeline.

---

## Scalability Considerations

| Concern | At 100 sessions/day | At 10K sessions/day | At 100K sessions/day |
|---------|--------------------|--------------------|----------------------|
| Session store | In-memory fine | Redis required | Redis cluster |
| OCR cost | ~$0.15/day (Vision API) | ~$15/day | ~$150/day — consider caching, batching |
| Compute | Single serverless instance | Serverless auto-scales | Same |
| Image storage | Never store — delete after OCR | Same | Same |
| Session TTL | 24h covers all use cases | Same | Shorter TTL (6h) to reduce storage |

Serverless deployment (Vercel, Netlify Functions) fits this profile well — OCR calls are infrequent relative to UI interactions, and sessions are short-lived.

---

## Sources

- Architecture analysis based on domain knowledge of React SPA patterns, OCR pipeline design, and bill-splitting data models (training knowledge, MEDIUM confidence)
- Integer cents pattern: standard practice in payment/financial systems (HIGH confidence)
- OCR accuracy comparison: Google Vision API vs Tesseract.js for printed receipts (MEDIUM confidence — specific percentages are estimates based on known characteristics of thermal print OCR challenges)
- Proportional tip/tax split: common pattern in bill splitting applications (HIGH confidence)
- WebSocket vs polling tradeoffs for non-concurrent collaborative patterns (HIGH confidence)
