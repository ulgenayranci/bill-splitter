<!-- GSD:project-start source:PROJECT.md -->
## Project

**Bill Splitter**

A mobile-friendly web app that lets groups split restaurant bills fairly. The core experience: snap a photo of the bill, the app reads it, AI cleans up the abbreviations, and everyone selects what they had. No more mental math at the table.

**Core Value:** **Photo → items → each person picks what they had → everyone knows what they owe.**
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
### AI / LLM (Abbreviation Expansion)
| Technology | Model | Purpose | Why |
|------------|-------|---------|-----|
| OpenAI API | gpt-4o-mini | Expand abbreviated receipt item names | The abbreviation expansion task ("CHKN SAND LG" → "Chicken Sandwich (Large)") is a short-context, low-latency text task. gpt-4o-mini is cost-optimized for exactly this — fast, cheap, and highly capable for text normalization. A single receipt fits easily within a small context window. |
### State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.x | Client-side bill state | The bill-splitting state (people, items, assignments, tip, tax) is complex but entirely client-side — no server persistence needed for the active session. Zustand is the right tool: minimal boilerplate, works cleanly with Next.js App Router (no Provider wrapping issues with RSC), and slices scale well. React Context + useState would create prop-drilling hell across the item assignment UI. Redux is overkill with no async middleware needed. |
### Session / Sharing
| Technology | Version/Tier | Purpose | Why |
|------------|-------------|---------|-----|
| Upstash Redis (via Vercel Marketplace) | Serverless | Shareable link storage | The shareable-link feature requires persisting the bill state so others can open it on their phones. Upstash Redis is the standard serverless KV store for Vercel-hosted apps after Vercel KV was discontinued in December 2024 (confirmed via official Vercel docs). Free tier: 10,000 commands/day, 256MB storage — more than sufficient for MVP. Bill state serializes to <5KB JSON per session, with a TTL of 24 hours to auto-expire stale sessions. |
### Infrastructure / Hosting
| Technology | Version/Tier | Purpose | Why |
|------------|-------------|---------|-----|
| Vercel | Hobby/Pro | Hosting + serverless functions | Zero-config Next.js deployment, confirmed via official docs (last updated 2026-03-02). Serverless functions handle the OCR and AI API calls without managing containers. Global CDN for static assets. Hobby tier is free for personal projects; Pro ($20/month) adds team features. No server to manage. |
### Camera / Image Capture
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native HTML `<input type="file" accept="image/*" capture="environment">` | Browser API | Mobile camera access | **Recommended over react-webcam.** On mobile browsers, `<input capture="environment">` opens the rear camera directly and hands back a File object. No JavaScript camera API needed. Works on iOS Safari and Android Chrome. Avoids the ~50KB react-webcam dependency and the complexity of managing MediaStream lifecycle in React. Use react-webcam only if you need a live viewfinder overlay (e.g., framing guides) — that is a v2 concern. |
### Image Preprocessing (Optional)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| browser-image-compression | 2.x | Compress before upload | Receipt photos from phone cameras are 3-10MB. LLM vision APIs charge per image token, and large images slow the upload. Compress to ~500KB JPEG before sending. This library runs in-browser, is lightweight (~50KB), and reduces API costs meaningfully. |
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
## Installation
# Create project
# Core dependencies
# UI components (shadcn/ui)
# Session storage (Upstash Redis)
# Dev dependencies
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
