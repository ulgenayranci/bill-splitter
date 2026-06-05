# Bill Splitter

## What This Is

A mobile-friendly web app that lets groups split restaurant bills fairly. The core experience: snap a photo of the bill, the app reads it, AI cleans up the abbreviations, and everyone selects what they had. No more mental math at the table.

## The Problem

Splitting restaurant bills is annoying because:
- Shared items (appetizers, bottles) are hard to divide fairly
- Tip and tax split fairly should be proportional to what each person ordered
- Receipt item names are abbreviated and unrecognizable
- Doing the math manually is error-prone

## Core Value

**Photo → items → each person picks what they had → everyone knows what they owe.**

## Who It's For

Anyone splitting a restaurant bill with friends. Built for broad use, not just personal use.

## How It Works

### Primary Flow (Photo)
1. Host opens app, adds people at the table
2. Host takes a photo of the bill
3. OCR extracts line items and prices
4. AI expands abbreviations into readable names (e.g. "CHKN SAND LG" → "Chicken Sandwich (Large)")
5. If items are still ambiguous, app prompts: **Take photo of menu** OR **Enter manually**
6. Each person selects what they ordered (single-driver or shareable link)
7. App calculates each person's share including proportional tip and tax
8. Final screen: "Sarah owes $34.50, Mike owes $28.20..."

### Shared Items
- Any item can be marked as shared
- User picks which people shared it
- Cost divided equally among those people

### Tip & Tax
- User enters tip percentage (15%, 18%, 20%, custom) or amount
- User enters tax amount or percentage
- Both split **proportionally** to each person's subtotal

### Multi-user
- Single-driver mode: one person assigns items for the group
- Shareable link: host shares a link, each person opens on their own phone and taps what they had

## Platform

Mobile-friendly web app. Works on any phone via browser, no install needed. Can be pinned to home screen.

## Current Milestone: v2.0 easy-billsy Redesign

**Goal:** Rebuild the bill splitter as "easy-billsy" — a clarity-driven, scan-first flow with no host role, so a casual table anywhere (any currency) can split fast without friction.

**Target features:**
- App shell — easy-billsy header (wordmark + hamburger: New Split / History / About Us)
- Setup screen — scan-first, inline people add
- "Who are you?" identity modal between Setup and claiming
- Bill View — flat real-time claiming (shared items, quantity stepper); **no host role**
- Results — locked per-person breakdown + Copy / Edit bill / New bill
- Tip — modal launched from a button on the Results screen
- Currency recognition — OCR detects the receipt's currency symbol; all amounts render in it

**Deferred:** Bill history (inert "History" stub now; saved splits → v2.1+)

## Requirements

### Validated

- [x] User can add people to the bill — v1.0 Phase 1 (PEOPLE-01)
- [x] User can mark items as shared and select who shared them — v1.0 Phase 1 (ITEMS-02, ITEMS-03)
- [x] Each person can select what they ordered — v1.0 Phase 1 (ITEMS-01)
- [x] Tip calculation with percentage options (15%, 18%, 20%, custom) — v1.0 Phase 1 (TIP-01)
- [x] Final breakdown showing what each person owes — v1.0 Phase 1 (RESULTS-01)
- [x] Photo of the bill for OCR extraction — v1.0 Phase 2 (OCR-01)
- [x] AI expands abbreviated item names into readable names — v1.0 Phase 3 (OCR-02)
- [x] Ambiguous items prompt: take menu photo OR enter manually — v1.0 Phase 3 (OCR-04)
- [x] Shareable link so each person claims their own items — v1.0 Phase 4 (RESULTS-02)
- [x] Real-time collaborative claiming with quantity, shared items, and per-person tips — v1.0 Phase 6

### Active (v2.0 — easy-billsy)

- [ ] easy-billsy app shell — header wordmark + hamburger menu (New Split / History / About Us)
- [ ] Scan-first Setup screen with inline people add
- [ ] "Who are you?" identity modal
- [ ] Flat real-time Bill View — claim items, shared items, quantity stepper (no host role)
- [ ] Locked Results — per-person breakdown + Copy / Edit bill / New bill
- [ ] Tip via a Results-screen modal
- [ ] Currency recognition from the receipt (symbol detected + rendered throughout)

REQ-IDs assigned in REQUIREMENTS.md.

### Out of Scope (v1) / Deferred to v2

- Tax input + proportional tip/tax split — dropped from the v2 redesign (per-person tip only)
- Native iOS/Android app — web app covers the use case
- Payment integrations (Venmo, etc.) — confirmed out: **not targeting the US market**
- Bill history / saved splits — now planned for v2 (the "History" menu item)
- User accounts / login — anonymous use keeps friction low (reaffirmed)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app over native | Fastest to ship, works on all phones, no App Store | ✓ Good — shipped on Vercel, no install friction |
| Photo-first flow | Core differentiator vs manual-entry-only apps | ✓ Good — reinforced as the hero action in v2 redesign |
| AI abbreviation expansion | Receipts are unreadable without it | ✓ Good — our clearest quality moat vs competitors |
| Menu photo as fallback | Handles edge cases without forcing manual typing | ✓ Good — shipped Phase 3 |
| Proportional tip/tax | Fairer than equal split when orders vary widely | ⚠️ Dropped — per-person tip shipped instead; tax cut from v2 |
| Host approval / moderation flow | Central authority for edits & disputes | ⚠️ Revisit — adds complexity; v2 removes it for a flat model |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
## Current State

**v1.0 MVP shipped (2026-06-04)** — the full photo → OCR → AI-cleaned items → collaborative per-person claiming → per-person tips → results flow is live on Vercel. ~6,270 LOC TS/TSX across 6 phases. Stack: Next.js 16, React 19, Tailwind v4, shadcn/ui, Zustand, Upstash Redis, GPT-4o-mini vision.

**v2.0 easy-billsy redesign in progress** — clarity-driven rebuild (flat model, scan-first flow). Phase 7 (App Shell + Setup) and Phase 8 (Flat Model — Schema + API Surgery) complete: all host-role concepts removed from the schema, Lua scripts, and routes; the direct `/edit` route is live; `currencyCode` now rides the shared-bill payload (USD default). Next: Phase 9 — Bill View Redesign + Identity Modal.

*Last updated: 2026-06-06 after Phase 8*
