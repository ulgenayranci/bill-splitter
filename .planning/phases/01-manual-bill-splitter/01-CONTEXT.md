# Phase 1: Manual Bill Splitter - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a fully working manual bill splitter — add people by name, enter items with prices, assign items to people (including shared items), set a tip percentage, and see the final per-person breakdown. No OCR, no server, no shareable links. Phase 1 must be shippable on its own.

</domain>

<decisions>
## Implementation Decisions

### Tip & Results Display

- **D-01:** Tip is entered at the end of the flow, after all items are assigned — just before the results screen.
- **D-02:** Tip is split equally among all people in v1 (proportional split deferred to v2).
- **D-03:** Results screen shows each person's total with an expandable item breakdown underneath. Not all-at-once — totals are visible by default, items revealed on tap.

### Claude's Discretion

- Flow layout (single-page vs wizard) — Claude decides based on mobile UX best practices
- Item assignment UX (checkboxes, tap-to-assign, etc.) — Claude decides
- Shared item selection pattern — Claude decides (equal split among selected sharers)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision, core value, and how the app works
- `.planning/REQUIREMENTS.md` — v1 requirements with REQ-IDs (PEOPLE-01, ITEMS-01–03, TIP-01, RESULTS-01 are Phase 1)

### Architecture Commitments (from research)
- `.planning/research/ARCHITECTURE.md` — Integer-cents data model, Zustand store shape, component boundaries
- `.planning/research/STACK.md` — Next.js 15, Tailwind v4, Zustand 5, shadcn/ui

### Pitfalls to Avoid
- `.planning/research/PITFALLS.md` — Floating-point rounding, state shape design, iOS Safari camera quirks

No external ADRs — all requirements captured in planning files above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — greenfield project

### Established Patterns
- Integer-cents arithmetic: all prices stored as cents (integer), never floats — non-negotiable from STATE.md
- Zustand single store: all wizard state (people, items, assignments, tip, current step) in one store
- Derived totals: per-person totals computed on demand, never stored in state

### Integration Points
- Phase 1 establishes the data model and store shape that Phase 2 (OCR) and Phase 4 (shareable links) depend on — get it right here

</code_context>

<specifics>
## Specific Ideas

No specific visual references — open to clean, mobile-first approaches. Priority is usability at a restaurant table (large touch targets, readable on a phone screen in varying light).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Manual Bill Splitter*
*Context gathered: 2026-05-08*
