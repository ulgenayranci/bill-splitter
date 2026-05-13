# Phase 5: Polish & Hardening - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the app around edge cases, clean up mobile UX, and give users a way to share the result outside the app. Three specific deliverables: (1) a blocking dialog warning when items remain unassigned before the results screen, (2) a copy-to-clipboard summary button on the results screen, and (3) closed error states for camera guidance, session creation failure, and guest claim/done network errors. Mobile polish in scope: safe area insets and touch target audit.

Requirements: ITEMS-04 (unassigned-item warning before results).

</domain>

<decisions>
## Implementation Decisions

### Unassigned Item Warning

- **D-01:** When the user taps "Continue" in `AssignItemsStep` with unassigned items, show a **blocking dialog** using the existing `components/ui/dialog.tsx`. The dialog lists the specific item names that are unassigned (not just a count).
- **D-02:** The dialog offers **two actions**: a primary "Go back to assign them" (returns to the step) and a secondary destructive "Continue anyway" (proceeds to results). No single-action-only blocking.

### Copy Summary

- **D-03:** The copy button lives as a **full-width CTA button at the bottom of `ResultsStep`**, alongside the existing "Start over" button area.
- **D-04:** Clipboard text format is **totals only** — one line per person: `"[Name] owes $X.XX"`, then a total at the bottom. No itemized breakdown in the clipboard text.
- **D-05:** Confirmation is a **button label swap**: "Copy summary" → "Copied!" for 2 seconds, then reverts. No toast.

### Error State Coverage

- **D-06:** Camera permission guidance: add **static text below the scan button** in `AddItemsStep`: "Allow camera access if prompted." No JS detection of permission denial — the existing "Add manually" path is the recovery.
- **D-07:** Session creation failure in `ShareLinkButton`: show **inline error text** under the button ("Couldn't create session. Try again.") instead of silently logging to console.
- **D-08:** Guest claim/un-claim errors in `GuestClaimingView`: use **optimistic update + revert on failure**, with a brief inline "Couldn't save — tap to retry" label on the affected item row.
- **D-09:** The "I'm done" fetch in `GuestClaimingView` (currently no try/catch): wrap in try/catch and show an inline error on the "I'm done" bar if the network call fails.

### Mobile UX

- **D-10:** Fix **safe area insets** on all sticky footers and bottom CTA bars (wizard nav, "I'm done" bar, ResultsStep bottom buttons) using `env(safe-area-inset-bottom)`. Prevents clipping on iPhone with notch/Dynamic Island/home indicator.
- **D-11:** **Keyboard push behavior**: let the browser handle it — the existing viewport meta in Next.js handles this on modern iOS/Android. No custom scroll-into-view logic unless testing reveals a problem.
- **D-12:** **Touch target audit**: all interactive elements must meet the 44×44px minimum (Apple HIG). Priority targets: person chip buttons in `AssignItemsStep`, item rows in `GuestClaimingView`, claim/unassign tap areas.

### Claude's Discretion

- CSS implementation of safe area insets (utility class vs inline style vs Tailwind plugin)
- Exact wording and visual treatment of the inline error messages (D-07, D-08, D-09)
- Whether the copy button shows a clipboard icon alongside the label

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision; "no dead ends" and mobile-first are core values
- `.planning/REQUIREMENTS.md` — ITEMS-04 is the explicit requirement for Phase 5

### Prior Phase Decisions (carry forward)
- `.planning/phases/01-manual-bill-splitter/01-CONTEXT.md` — Integer-cents arithmetic, Zustand store shape, wizard step structure
- `.planning/phases/04-shareable-links/04-CONTEXT.md` — Most recent phase decisions; UX clarity priority, no dead ends, avatar color system

### Key Integration Files (read before planning)
- `components/wizard/AssignItemsStep.tsx` — Where D-01/D-02 (unassigned warning dialog) is added; existing "Continue" button navigation
- `components/wizard/ResultsStep.tsx` — Where D-03/D-04/D-05 (copy summary button) is added; existing person totals layout
- `components/wizard/AddItemsStep.tsx` — Where D-06 (camera guidance text) is added; existing scan button and AbortController pattern
- `components/wizard/ShareLinkButton.tsx` — Where D-07 (session error inline message) is added; current error is silently logged
- `app/split/[sessionId]/GuestClaimingView.tsx` — Where D-08/D-09 (optimistic revert, done try/catch) is added; existing silent catch blocks
- `components/ui/dialog.tsx` — Reuse for unassigned item warning dialog (D-01)
- `stores/useBillStore.ts` — Source of `items`, `assignments`, `people`, `tipPercent` for computing copy summary text

### Stack Reference
- `CLAUDE.md` — Tailwind CSS v4, Next.js 15 App Router, shadcn/ui component primitives

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/dialog.tsx` — Radix UI dialog primitive, already in project; use for unassigned item blocking dialog (D-01/D-02)
- `components/ui/button.tsx` — All existing button variants for dialog actions and copy CTA
- `components/ui/badge.tsx` — Available for "Taken by [Name]" style inline labels if needed
- `lib/billMath.ts` — `computePersonTotals`, `formatCents` — use for generating the copy summary text
- `stores/useBillStore.ts` — `items`, `assignments`, `people`, `tipPercent` — all available for unassigned detection and copy text generation

### Established Patterns
- Integer-cents: all prices are `priceCents` (integer) — `formatCents()` converts to display string; copy summary must use `formatCents()`.
- AbortController on fetch calls tied to component lifecycle (AddItemsStep, DisambiguationDialog) — follow same pattern for any new fetch calls.
- Optimistic UI: SWR is already used in GuestClaimingView for polling; optimistic claim updates revert on error.
- OcrErrorToast / base-ui toast: established for OCR errors; D-07/D-08/D-09 deliberately use inline errors (not toast) to keep feedback contextual.
- Tailwind `env()`: Next.js Tailwind v4 setup supports `env(safe-area-inset-*)` in CSS — no special config needed.

### Integration Points
- `AssignItemsStep.tsx` — Add unassigned check before `setStep` call in the "Continue" button handler. Count items where `assignments[item.id]` is empty or missing.
- `ResultsStep.tsx` — Add copy button in the bottom action row (alongside/below "Start over"). Compute text from Zustand state + `computePersonTotals`.
- `GuestClaimingView.tsx` — Fill in silent `catch {}` blocks at claim/un-claim and add try/catch around the done fetch; add local error state per item and for the done bar.
- `app/layout.tsx` — Verify `viewport-fit=cover` is in the meta viewport tag (required for `env(safe-area-inset-*)` to work on iOS).

</code_context>

<specifics>
## Specific Ideas

- The blocking dialog for unassigned items should make "Go back" the visually dominant (primary) action, with "Continue anyway" as a secondary/destructive option. This matches the Phase 4 UX clarity principle — safe path is obvious.
- Copy summary button is a utility action, not a primary CTA — secondary button style is appropriate (not the same weight as the primary wizard navigation buttons).
- Inline error messages (D-07, D-08, D-09) should be small, contextual, and use the same red/zinc color tokens already in the design system.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Polish-Hardening*
*Context gathered: 2026-05-13*
