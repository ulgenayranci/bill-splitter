# Phase 5: Polish & Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 5-polish-hardening
**Areas discussed:** Unassigned warning UX, Copy summary format, Error state coverage, Mobile UX scope

---

## Unassigned Warning UX

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking dialog | Modal using existing Dialog component; requires explicit acknowledgment | ✓ |
| Sticky banner | Orange banner, non-blocking; Continue button still active | |
| Per-item highlight | Visual callout on unassigned rows only | |

**User's choice:** Blocking dialog

---

| Option | Description | Selected |
|--------|-------------|----------|
| Two actions: Go back + Continue anyway | Primary safe path + secondary destructive escape hatch | ✓ |
| One action: Go back only | Forces assignment before proceeding, no escape | |

**User's choice:** Two actions (Go back as primary, Continue anyway as destructive secondary)

---

| Option | Description | Selected |
|--------|-------------|----------|
| List item names | "Chicken Sandwich and Fries aren't assigned." — actionable | ✓ |
| Count only | "2 items aren't assigned." — simpler | |

**User's choice:** List item names specifically

---

## Copy Summary Format

| Option | Description | Selected |
|--------|-------------|----------|
| Totals only | "[Name] owes $X.XX" per line + total — clean group chat paste | ✓ |
| With item breakdown | Itemized list per person + total | |
| You decide | Defer format to Claude | |

**User's choice:** Totals only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom CTA button | Full-width button below breakdown list | ✓ |
| Top right icon button | Small clipboard icon in card header | |

**User's choice:** Bottom CTA button (full-width)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Button label swap | "Copy summary" → "Copied!" for 2s, then reverts | ✓ |
| Toast notification | OcrErrorToast-style via base-ui toast | |

**User's choice:** Button label swap

---

## Error State Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Static guidance text | Note under scan button: "Allow camera access if prompted." | ✓ |
| Post-attempt fallback message | Detect no-change-event, show "Trouble? Add manually →" | |
| You decide | Defer to Claude | |

**User's choice:** Static guidance text under scan button

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error under button | "Couldn't create session. Try again." contextual text | ✓ |
| Toast notification | Fire OcrErrorToast for session creation failure | |

**User's choice:** Inline error under ShareLinkButton

---

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic revert + inline message | Claim toggles locally, reverts + "Couldn't save — tap to retry" on failure | ✓ |
| Blocking error state | Full-page error, stops guest until resolved | |

**User's choice:** Optimistic revert + inline item-level message

---

## Mobile UX Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — fix safe area insets | env(safe-area-inset-*) on sticky footers + bottom CTAs | ✓ |
| No — defer to v2 | Tolerate minor clipping for now | |

**User's choice:** Yes — fix safe area insets in Phase 5

---

| Option | Description | Selected |
|--------|-------------|----------|
| Let the browser handle it | Trust Next.js viewport meta for keyboard push behavior | ✓ |
| Audit and fix keyboard behavior | Explicit scroll-into-view on input focus | |

**User's choice:** Let browser handle keyboard behavior

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — audit tap targets | Ensure 44×44px minimum on interactive elements | ✓ |
| No — they're fine as-is | Trust existing Tailwind sizing | |

**User's choice:** Yes — audit and fix touch targets (person chips, item rows, claim areas)

---

## Claude's Discretion

- CSS implementation of safe area insets (utility class vs inline style vs Tailwind plugin)
- Exact wording and visual treatment of inline error messages
- Whether the copy button shows a clipboard icon alongside the label

## Deferred Ideas

None — discussion stayed within phase scope.
