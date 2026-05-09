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

## Requirements

### Validated

- [x] User can add people to the bill — Validated in Phase 01: manual-bill-splitter (PEOPLE-01)
- [x] User can mark items as shared and select who shared them — Validated in Phase 01: manual-bill-splitter (ITEMS-02, ITEMS-03)
- [x] Each person can select what they ordered — Validated in Phase 01: manual-bill-splitter (ITEMS-01)
- [x] Tip calculation with percentage options (15%, 18%, 20%, custom) — Validated in Phase 01: manual-bill-splitter (TIP-01)
- [x] Final breakdown showing what each person owes — Validated in Phase 01: manual-bill-splitter (RESULTS-01)

### Active

- [ ] User can take a photo of the bill for OCR extraction
- [ ] AI expands abbreviated item names into readable names
- [ ] Ambiguous items prompt: take menu photo OR enter manually
- [ ] Tax calculation (amount or percentage)
- [ ] Tip and tax split proportionally to each person's subtotal
- [ ] Shareable link so each person selects their own items

### Out of Scope (v1)

- Native iOS/Android app — web app covers the use case
- Payment integrations (Venmo, etc.) — out of scope for now
- Bill history / saved splits — complexity not justified for v1
- User accounts / login — anonymous use keeps friction low

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app over native | Fastest to ship, works on all phones, no App Store | Pending |
| Photo-first flow | Core differentiator vs manual-entry-only apps | Pending |
| AI abbreviation expansion | Receipts are unreadable without it | Pending |
| Menu photo as fallback | Handles edge cases without forcing manual typing | Pending |
| Proportional tip/tax | Fairer than equal split when orders vary widely | Pending |

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

Phase 01 (manual-bill-splitter) complete — full 5-step wizard implemented with 85 passing tests, integer-cent arithmetic, and largest-remainder tip distribution. Manual bill splitting is fully functional end-to-end.

*Last updated: 2026-05-09 after Phase 01 completion*
