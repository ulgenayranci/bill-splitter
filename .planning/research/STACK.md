# Technology Stack

**Project:** Bill Splitter (receipt OCR + AI expansion + bill splitting)
**Researched:** 2026-05-08
**Confidence:** MEDIUM-HIGH — core framework choices HIGH (official docs confirmed), OCR service pricing MEDIUM (Google Cloud Vision confirmed), AI model specifics MEDIUM (training knowledge, API details not directly fetchable)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x | Full-stack React framework | App Router gives collocated API routes (Server Actions / Route Handlers) for OCR and AI calls without a separate backend. Vercel deployment is zero-config. React 19 support built-in. |
| React | 19.x | UI rendering | Ships with Next.js 15. Server Components reduce client bundle size — important on mobile. |
| TypeScript | 5.x | Type safety | Enforces correctness in the bill-splitting math and OCR response parsing where off-by-one errors are user-visible. |

### Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first CSS | v4 released January 2025, production stable. 8x faster incremental builds. No config file needed. Container queries built-in — eliminates the need for a breakpoint-heavy responsive layout for the mobile-first camera/item selection screens. |
| shadcn/ui | latest | Accessible component primitives | Copy-paste component model means no black-box dependency versioning. Radix UI primitives underneath give accessible dialogs, popovers, and checkboxes for the item assignment UI without writing ARIA from scratch. Integrates directly with Tailwind. |

### OCR

| Technology | Version/Tier | Purpose | Why |
|------------|-------------|---------|-----|
| Google Cloud Vision API — Document Text Detection | REST/gRPC | Receipt text extraction from photo | **Recommended primary OCR.** Dedicated `DOCUMENT_TEXT_DETECTION` feature is purpose-built for dense printed text like receipts. Free tier: first 1,000 units/month. Cost: $1.50/1,000 units thereafter. Handles poor lighting, rotation, and thermal printer fonts better than Tesseract.js. Returns word-level bounding boxes and confidence scores. |

**Why not Tesseract.js:** Browser-based OCR is attractive (zero API cost, no round-trip) but has three critical problems for this use case: (1) thermal receipt fonts and condensed text have poor accuracy without careful preprocessing, (2) the WASM binary is ~10MB download on mobile, blocking the camera UX, (3) requires significant image preprocessing (deskew, contrast) to match cloud accuracy. As an experiment or fallback it is valid, but it is not a production-quality receipt OCR choice without substantial engineering investment. Confidence: MEDIUM (training data — Tesseract.js limitations are well-documented in the community but I could not verify current v5 state via official docs).

**Why not AWS Textract `AnalyzeExpense`:** Textract has a dedicated expense/receipt API that returns structured fields (vendor, total, line items). However, it is $0.0015 per page for expense analysis (no free tier for this feature), requires AWS credentials setup, and the SDK is heavier than a simple Vision API REST call. For a greenfield app without existing AWS infrastructure, Google Cloud Vision is faster to bootstrap and the free tier is more useful at launch scale. If structured output (vendor name, date, totals auto-extracted) becomes critical in a later phase, Textract `AnalyzeExpense` is worth revisiting. Confidence: MEDIUM (AWS pricing page was unreachable; pricing from training data).

### AI / LLM (Abbreviation Expansion)

| Technology | Model | Purpose | Why |
|------------|-------|---------|-----|
| OpenAI API | gpt-4o-mini | Expand abbreviated receipt item names | The abbreviation expansion task ("CHKN SAND LG" → "Chicken Sandwich (Large)") is a short-context, low-latency text task. gpt-4o-mini is cost-optimized for exactly this — fast, cheap, and highly capable for text normalization. A single receipt fits easily within a small context window. |

**Architecture note:** The OCR result (raw text lines + prices) goes into a structured prompt. The LLM returns a JSON array of `{ original, expanded, price }` objects. Parsing is deterministic because you control the prompt. Do not use streaming for this call — wait for the full JSON response before rendering items.

**Single-call design:** Combine OCR + expansion into one LLM call using gpt-4o or gpt-4o-mini with vision input. Send the receipt image directly to the LLM. It can both read the text AND expand abbreviations in one round trip, eliminating the need for a separate Google Vision call. This is the recommended approach: simpler pipeline, fewer API credentials, and GPT-4o's vision accuracy on receipts is production-quality as of 2024.

**Revised primary recommendation:** Use **GPT-4o-mini with vision** as the single OCR + expansion API call. Sequence: capture image → base64 encode → POST to `/api/parse-receipt` (Next.js Route Handler) → prompt GPT-4o-mini vision to "extract all line items and prices as JSON, expand any abbreviations" → return structured JSON. This eliminates Google Vision as a dependency entirely.

**Keep Google Vision as a fallback option** in PITFALLS/ARCHITECTURE notes: if LLM costs become a concern at scale, splitting into Vision (cheap, accurate OCR) + cheaper LLM (text only, no vision tokens) reduces cost per call by ~5-10x.

**Why not Claude for this:** Claude models have vision capability and strong text understanding, but using the same provider for both OCR and expansion creates single-vendor lock-in. Pragmatically, OpenAI's gpt-4o-mini is currently the most cost-effective vision model for this task. Confidence: MEDIUM (specific pricing not confirmed via live API docs).

**Why not Gemini:** Gemini Flash is a valid cost-optimized alternative with vision support. The recommendation here favors OpenAI because it is the most widely-documented choice for receipt parsing in the developer ecosystem, reducing implementation friction. If you want to avoid OpenAI dependency, Gemini 1.5 Flash is a direct substitute with comparable pricing. Confidence: LOW (Gemini pricing not confirmed).

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.x | Client-side bill state | The bill-splitting state (people, items, assignments, tip, tax) is complex but entirely client-side — no server persistence needed for the active session. Zustand is the right tool: minimal boilerplate, works cleanly with Next.js App Router (no Provider wrapping issues with RSC), and slices scale well. React Context + useState would create prop-drilling hell across the item assignment UI. Redux is overkill with no async middleware needed. |

**State shape (guidance for implementation):**
```typescript
interface BillState {
  people: Person[]
  items: LineItem[]        // from OCR, expandedName included
  assignments: Record<string, string[]>  // itemId -> personIds
  sharedItems: Record<string, string[]>  // itemId -> personIds who share
  tip: { mode: 'percent' | 'amount'; value: number }
  tax: { mode: 'percent' | 'amount'; value: number }
}
```

**No TanStack Query needed:** This app has no polling, no cache invalidation, no optimistic updates. The two API calls (receipt parse, optional menu parse) are one-shot. Use native `fetch` with React state (`useState` + loading/error flags) directly in the Server Action / client component. Adding TanStack Query would be premature abstraction.

### Session / Sharing

| Technology | Version/Tier | Purpose | Why |
|------------|-------------|---------|-----|
| Upstash Redis (via Vercel Marketplace) | Serverless | Shareable link storage | The shareable-link feature requires persisting the bill state so others can open it on their phones. Upstash Redis is the standard serverless KV store for Vercel-hosted apps after Vercel KV was discontinued in December 2024 (confirmed via official Vercel docs). Free tier: 10,000 commands/day, 256MB storage — more than sufficient for MVP. Bill state serializes to <5KB JSON per session, with a TTL of 24 hours to auto-expire stale sessions. |

**Note:** Vercel KV is explicitly deprecated as of December 2024. Do not use it for new projects. Upstash Redis with the official Upstash Vercel integration is the current recommended replacement (confirmed via Vercel docs).

**Alternative if you want zero dependencies for MVP:** Encode the entire bill state in the URL as a base64 query string. This works for small bills (< ~20 items) and requires zero backend. Upgrades to Upstash Redis when URL length becomes a constraint or when you need real-time multi-user assignment.

### Infrastructure / Hosting

| Technology | Version/Tier | Purpose | Why |
|------------|-------------|---------|-----|
| Vercel | Hobby/Pro | Hosting + serverless functions | Zero-config Next.js deployment, confirmed via official docs (last updated 2026-03-02). Serverless functions handle the OCR and AI API calls without managing containers. Global CDN for static assets. Hobby tier is free for personal projects; Pro ($20/month) adds team features. No server to manage. |

### Camera / Image Capture

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native HTML `<input type="file" accept="image/*" capture="environment">` | Browser API | Mobile camera access | **Recommended over react-webcam.** On mobile browsers, `<input capture="environment">` opens the rear camera directly and hands back a File object. No JavaScript camera API needed. Works on iOS Safari and Android Chrome. Avoids the ~50KB react-webcam dependency and the complexity of managing MediaStream lifecycle in React. Use react-webcam only if you need a live viewfinder overlay (e.g., framing guides) — that is a v2 concern. |

**Why not react-webcam for v1:** react-webcam wraps `getUserMedia` and provides a live preview canvas. This is valuable for desktop apps or when you need to draw overlays on the video stream. For a mobile bill-splitting app where the user simply taps a button and takes a photo, the native file input is simpler, smaller, and already understood by the browser permission model on all mobile platforms. Confidence: HIGH (browser standard, no library version dependency).

### Image Preprocessing (Optional)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| browser-image-compression | 2.x | Compress before upload | Receipt photos from phone cameras are 3-10MB. LLM vision APIs charge per image token, and large images slow the upload. Compress to ~500KB JPEG before sending. This library runs in-browser, is lightweight (~50KB), and reduces API costs meaningfully. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| OCR | GPT-4o-mini vision (single call) | Google Vision + text LLM | Two API calls, two credentials, more moving parts. Only adopt if cost per receipt scan exceeds ~$0.05 at scale. |
| OCR | GPT-4o-mini vision | Tesseract.js | Poor accuracy on thermal printer fonts, 10MB WASM download on mobile, requires preprocessing pipeline |
| OCR | GPT-4o-mini vision | AWS Textract AnalyzeExpense | No free tier for expense feature, heavier AWS SDK, adds AWS credentials requirement |
| AI/LLM | OpenAI gpt-4o-mini | Anthropic Claude | Claude is viable; OpenAI chosen for broader ecosystem documentation and lowest cost-per-call for this task |
| AI/LLM | OpenAI gpt-4o-mini | Google Gemini 1.5 Flash | Valid cost alternative; less community documentation for receipt parsing pattern specifically |
| Styling | Tailwind CSS v4 | CSS Modules | CSS Modules require more files and don't provide the rapid mobile-responsive iteration that Tailwind enables |
| Styling | Tailwind CSS v4 | styled-components / Emotion | Runtime CSS-in-JS has measurable performance cost on mobile; Tailwind is static CSS |
| State | Zustand | Redux Toolkit | Overkill. No async middleware needed. Zustand has 80% less boilerplate for this complexity level |
| State | Zustand | Jotai | Atom model makes sense for isolated state; bill-splitting state is deeply interconnected (tip depends on subtotals, etc.), making a single Zustand store cleaner |
| State | Zustand | React Context + useReducer | Verbose for this complexity level; Context re-renders the entire subtree on any update — bad for the item selection screen with many checkboxes |
| Session | Upstash Redis | Vercel KV | Vercel KV is discontinued as of December 2024 |
| Session | Upstash Redis | Supabase | Full Postgres is overkill for ephemeral session KV. No relational data needed. |
| Camera | Native `<input capture>` | react-webcam | Unnecessary dependency for mobile; native input opens camera directly |
| Hosting | Vercel | Netlify | Vercel is the native Next.js platform with the best integration story |
| Hosting | Vercel | Railway / Fly.io | Server-managed hosting adds ops burden. Serverless is correct for this traffic pattern |

---

## Installation

```bash
# Create project
npx create-next-app@latest bill-splitter --typescript --tailwind --app --src-dir --import-alias "@/*"

# Core dependencies
npm install zustand openai browser-image-compression

# UI components (shadcn/ui)
npx shadcn@latest init
npx shadcn@latest add button input dialog checkbox slider card separator

# Session storage (Upstash Redis)
npm install @upstash/redis

# Dev dependencies
npm install -D @types/node
```

**Tailwind CSS v4 note:** `create-next-app` as of this writing installs Tailwind v3. After scaffolding, upgrade with:
```bash
npx @tailwindcss/upgrade@latest
```
Or accept v3 for v1 — the differences are not blocking. Upgrade to v4 is worthwhile for the container query support on the item assignment layout.

---

## Sources

- Next.js 15 release blog: https://nextjs.org/blog/next-15 (confirmed stable, October 2024)
- Vercel + Next.js deployment docs: https://vercel.com/docs/frameworks/nextjs (last updated 2026-03-02)
- Vercel KV deprecation: https://vercel.com/docs/redis (confirmed December 2024 migration to Upstash)
- Google Cloud Vision pricing: https://cloud.google.com/vision/pricing (confirmed $1.50/1000 units, 1000/month free)
- AWS Textract capabilities: https://docs.aws.amazon.com/textract/latest/dg/what-is.html (confirmed AnalyzeExpense API)
- Tailwind CSS v4: https://tailwindcss.com/blog/tailwindcss-v4 (confirmed production stable, January 2025)
- OpenAI gpt-4o-mini vision: Training knowledge — MEDIUM confidence, not confirmed via live API docs (WebFetch blocked)
- Zustand v5: Training knowledge — MEDIUM confidence
- browser-image-compression: Training knowledge — MEDIUM confidence
