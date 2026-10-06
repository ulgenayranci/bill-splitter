# Phase 10: Results Screen + Tip Modal + Currency Display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 10-results-screen-tip-modal-currency-display
**Areas discussed:** Tip flow & optionality, What "Total" means, Currency override (CURR-03), Tip privacy

---

## Tip flow & optionality

| Option | Description | Selected |
|--------|-------------|----------|
| Straight to Results | "Done" goes right to Results; tip is an optional button there. Nobody forced through a tip step. Matches new design. | ✓ |
| Tip step first | Keep a dedicated tip screen everyone passes through before Results. | |

**User's choice:** Straight to Results (recommended)
**Notes:** Removes the linear `tip` phase; tip becomes a Dialog launched from Results (TIP-02). Confirm always enabled → tip is optional.

---

## What "Total" means

| Option | Description | Selected |
|--------|-------------|----------|
| The bill, items only | Matches the printed receipt; never jumps as people tip. Each person's tip shows inside their own total. | ✓ |
| Items + everyone's tips | Full all-in group amount; per-person cards sum to it exactly, but won't match the receipt and shifts as people tip. | |

**User's choice:** The bill, items only (recommended)
**Notes:** Resolved the "parts don't add up" tension with D-04 — per-person *item shares* sum to the grand bill Total; tips layer privately on the current user's own "Your total."

---

## Currency override (CURR-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Pick from common list | Detected currency (or USD fallback) + small "change" opening a short list of common currencies. Low effort, satisfies CURR-03. | ✓ |
| Display only, no change | Show detected/default only. Simplest, but wrong detection leaves the user stuck. | |
| Type a 3-letter code | Free-text ISO code. Most flexible, but error-prone, needs validation. | |

**User's choice:** Pick from common list (recommended)
**Notes:** Currency is session-level → override applies to the whole bill/all devices (D-07). Persistence path (extend /edit vs. dedicated route) deferred to research.

---

## Tip privacy

| Option | Description | Selected |
|--------|-------------|----------|
| Personal & quiet | Your tip rolls into your own total; not called out as a separate line to others. | ✓ |
| Shown to everyone | Each person's tip appears as a visible line others can see. | |

**User's choice:** Personal & quiet (recommended)
**Notes:** Combined with the items-only Total, others' cards show item share only; tip is private to each person's own "Your total."

---

## Claude's Discretion

- Exact currency list contents/order; picker as shadcn `select` vs. small dialog list.
- Visual distinction between the current user's "Your total (incl. tip)" and the grand bill Total.
- Whether "Edit bill" reuses the existing `done:false` → back-to-claiming round-trip (expected yes).

## Deferred Ideas

- Tip nudge/reminder for users who reach Results without tipping — tip stays optional; revisit only if UAT shows it's missed.
- "Add user-facing privacy disclosure" todo — reviewed, not folded; out of Phase 10 scope (concerns scan/photo data).
