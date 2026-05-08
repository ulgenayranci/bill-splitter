# Walking Skeleton — Bill Splitter

**Phase:** 1
**Generated:** 2026-05-08

## Capability Proven End-to-End

A user opens the app on their phone, types a name in the wizard's first step, taps "Add Person", and sees that person appear in a list — proving Next.js routing, Tailwind v4 styling, shadcn components, and Zustand state are all wired together.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) | `latest` on npm registry as of 2026-05-08; React 19.2 bundled; Turbopack default in v16. Phase 1 is unaffected by 15→16 breaking changes (no middleware, no dynamic params). RESEARCH.md Open Question #2. |
| Language | TypeScript 5.x | Enforces integer-cents discipline; catches off-by-one in split calculations. Required by Next.js 16. |
| Styling | Tailwind CSS 4.2.4 (CSS-first, no `tailwind.config.js`) | v4 is production stable since Jan 2025; `@import "tailwindcss"` in `globals.css`; `@tailwindcss/postcss` PostCSS plugin replaces autoprefixer. |
| Component primitives | shadcn/ui CLI 4.7.0 (official registry only) | Copy-paste Radix components; React 19 native; Phase 1 components: `button input card checkbox separator badge dialog`. |
| Icons | lucide-react | Bundled with shadcn default init; tree-shakeable; used for trash, chevron, plus, check. |
| Client state | Zustand 5.0.13 (single store, no Provider) | All wizard state in one store; no SSR hydration in Phase 1 so Provider is unnecessary. Locked decision in STATE.md. |
| Money arithmetic | Integer cents throughout (`Math.round(parseFloat(v) * 100)`) | Non-negotiable architecture commitment; prevents floating-point rounding errors in split math. |
| Step routing | Single `app/page.tsx` (`'use client'`) + `step` field in Zustand + `window.history.pushState('#step-N')` for back-button | RESEARCH.md Pattern 3. Avoids `useRouter().push()` which triggers full Next.js navigation lifecycle. |
| Test runner | Vitest 4.1.5 + @testing-library/react 16.3.2 + jsdom | Official Next.js recommendation for App Router unit tests. |
| Deployment target | Local dev (`npm run dev`) for Phase 1; Vercel for later phases | Phase 1 has no server routes, no env vars, no persistence — local dev proves the full stack. Vercel deployment deferred to Phase 2 when OCR API keys appear. |
| Directory layout | Feature-folders: `app/`, `components/ui/` (shadcn), `components/wizard/` (steps), `stores/`, `lib/`, `__tests__/` | Mirrors Next.js App Router conventions; subsequent phases extend `components/`, `stores/`, `lib/` without restructuring. |
| ID generation | `crypto.randomUUID()` | Available in all target browsers (iOS Safari 15.4+, Android Chrome 92+); zero dependency. |

## Stack Touched in Phase 1

- [x] Project scaffold — `npx create-next-app@latest` (Next.js 16, TS, Tailwind v4, Turbopack, App Router)
- [x] Routing — App Router single route `/` (`app/page.tsx`)
- [x] State — Zustand store (`stores/useBillStore.ts`) read AND written by UI
- [x] UI — shadcn `Button` + `Input` + `Card` interactive elements wired to store
- [x] Tests — Vitest configured (`vitest.config.mts`); unit tests for `lib/billMath.ts` and `stores/useBillStore.ts`; component test for `AddPeopleStep`
- [x] Deployment — `npm run dev` serves the app at `http://localhost:3000`; mobile-tested via local network IP. Vercel deferred to Phase 2.

## Out of Scope (Deferred to Later Slices)

These are explicitly **not** in the skeleton — they belong to later phases or are deferred to v2:

- OCR / photo capture (Phase 2) — `<input capture="environment">`, GPT-4o-mini vision call
- Abbreviation expansion / disambiguation (Phase 3) — LLM call, low-confidence flagging
- Server-side persistence (Phase 4) — Upstash Redis, session API, shareable links
- Vercel deployment + serverless functions (Phase 2) — first phase that needs API keys
- Unassigned-item warnings (Phase 5) — Step 3 silently allows unassigned items in Phase 1
- Copy-to-clipboard summary (Phase 5)
- Tax input (v2)
- Proportional tip split (v2 — Phase 1 splits tip equally per D-02)
- "Clear bill" / start-over button (Phase 1: browser refresh is the escape hatch per UI-SPEC)
- PWA manifest (v2)
- Bill history / saved splits (v2)
- User accounts / login (out of scope entirely)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2: OCR Pipeline** — adds `<input capture>` photo capture, server route `/api/ocr` calling GPT-4o-mini vision, editable item list pre-populated from OCR. Reuses Zustand store, integer-cents model, shadcn components.
- **Phase 3: AI Expansion + Disambiguation** — extends OCR response shape with `{type, confidence, raw_name, display_name}`; adds confidence badges, menu-photo fallback, manual-entry escape hatch.
- **Phase 4: Shareable Links** — adds Upstash Redis, session API, `/s/[sessionId]` route; per-person claim flow; debounced polling for state sync.
- **Phase 5: Polish & Hardening** — adds unassigned-item warnings, error states, copy-summary action, mobile UX hardening.
