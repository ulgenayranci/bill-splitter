---
phase: quick-260623-olg
plan: 01
subsystem: ui-branding
tags: [rebrand, design-tokens, tailwind, fonts, theming]
requires: []
provides:
  - easy billsy brand token system (coral/paper/ink/semantic/avatar) in globals.css
  - Archivo (--font-sans) + Caveat (--font-accent) typography
  - 6-color person avatar palette
  - "easy billsy" wordmark + tab title
affects:
  - all app/ and components/ screens (re-styled, no layout/flow change)
tech-stack:
  added:
    - Archivo (next/font/google)
    - Caveat (next/font/google)
  patterns:
    - Dual-block token remap (HSL @layer base + OKLch :root) kept consistent
    - Role-based color mapping (CTA→coral, warn→warn, settled→green, avatars→palette)
    - One-coral-action-per-screen rule
key-files:
  created: []
  modified:
    - app/layout.tsx
    - app/globals.css
    - stores/useBillStore.ts
    - components/wizard/AppHeader.tsx
    - components/wizard/ResultsStep.tsx
    - components/wizard/SetupStep.tsx
    - components/wizard/AddItemsStep.tsx
    - components/wizard/AddPeopleStep.tsx
    - components/wizard/ProgressStrip.tsx
    - components/wizard/ShareLinkButton.tsx
    - components/split/InvitePeopleStep.tsx
    - components/split/ClaimableItemCard.tsx
    - components/split/PersonResultsScreen.tsx
    - components/split/TipScreen.tsx
    - components/split/BillViewHeader.tsx
    - components/split/PersonSlotPicker.tsx
    - components/split/UnclaimedBanner.tsx
    - app/split/[sessionId]/CollaborativeClaimingView.tsx
decisions:
  - Warning/review states mapped to warn (#e0a400) via arbitrary-value opacity utilities, not coral
  - Setup add-person "+" demoted to neutral ink to honor one-coral-per-screen (Start splitting is the screen CTA)
  - Scan "items found" badge + items-claimed chip use coral-soft (brand-positive), green reserved strictly for settled/paid money states
metrics:
  duration: ~25 minutes
  completed: 2026-06-23
---

# Quick Task 260623-olg: Apply "easy billsy" Brand & UI Spec Summary

Rebranded the Bill Splitter app from amber/Geist to the approved "easy billsy" identity — Friendly Coral primary on warm cream paper, Archivo/Caveat typography, and a 6-color person avatar palette — by re-styling existing screens (no layout or flow changes).

## What Shipped

**Task 1 — Fonts + tokens** (`a34a4b8`)
- `app/layout.tsx`: Geist → Archivo (`--font-sans`, weights 400–900) + Caveat (`--font-accent`, 500–700); metadata title "easy billsy" + new tagline.
- `app/globals.css`: added the full §09 `:root` token block (coral 50–900, warm neutrals, semantic settle/settle-soft/warn/danger, 6 avatars, radii, shadows, fonts). Remapped shadcn semantic tokens to brand in BOTH coexisting blocks — HSL `@layer base { :root }` (H S% L% triples) and the unlayered OKLch `:root` (standalone hex). Registered brand Tailwind color utilities (`coral-*`, `paper`, `ink`, `settle`, `settle-soft`, `warn`, `danger`, `av-*`) + `--font-accent` in `@theme inline`. Tuned `--radius` to 0.75rem and the md/lg multipliers so md ≈ 12px, lg ≈ 16px. `.dark` left functional, not re-themed.

**Task 2 — Avatars + wordmark** (`9c9c6b7`)
- `stores/useBillStore.ts`: `AVATAR_COLORS` → 6 spec person colors in order (`#3aa0e0` blue, `#9b6cf0` violet, `#2f9e6a` green, `#e0a02a` gold, `#16b1bd` teal, `#d96aa6` magenta), arbitrary-value classes so no coral leaks in; shape/order unchanged.
- `components/wizard/AppHeader.tsx`: wordmark now "easy" + space + bold "billsy" (minus separator removed), `aria-label="easy billsy"`, coral hamburger + coral menu hover + coral confirm-reset button.

**Task 3 — Role-mapped remaining components + build** (`ef83d2b`)
- 14 files re-styled by role per spec §06: primary CTAs → `bg-coral-500 hover:bg-coral-600`; soft fills + claimed-item tint → `bg-coral-50/100` + `border-coral-200`; accent text/totals → `text-coral-600`; warning/review states (unclaimed banner & section, scan-review, expired notice, Review badge, still-off hint) → warn tones; ProgressStrip filled → `bg-coral-500`.
- One-coral-per-screen enforced: Setup's add-person "+" demoted to neutral ink (the screen's coral CTA is "Start splitting").
- Settled/paid stays green: the "Paid" chip in PersonResultsScreen untouched (`green-100/700`).
- `npm run build` passes; compiled CSS confirmed to contain coral (`f1603f`), paper (`faf5f1`), avatar blue (`3aa0e0`), and warn (`e0a400`).

## Verification

- `grep -rn "amber" components app` → empty (exit 1).
- `grep -rn "Geist" app components` → empty (exit 1).
- `npm run build` → "Compiled successfully", TypeScript clean, all routes generated.
- Brand hex values verified present in the emitted CSS bundle (Tailwind v4 only emits used utilities, so this confirms the new utilities actually resolve).

## Deviations from Plan

None of the Rule 1–4 kind. Two judgment calls within the plan's stated rules, recorded as decisions above:
- Warning/review surfaces use the `warn` token (`#e0a400`) via arbitrary-value opacity utilities (`bg-[#e0a400]/10`) since there is no `warn-soft` token — keeps warnings off-coral per "one coral action per screen".
- The Setup "+" add-person control was demoted to neutral ink (not coral) so the screen has a single coral action ("Start splitting").

## Self-Check: PASSED

- Files exist: app/layout.tsx, app/globals.css, stores/useBillStore.ts, all 15 components — FOUND.
- Commits exist: a34a4b8, 9c9c6b7, ef83d2b — FOUND (all pushed to origin/main).
- Build: PASS. Grep gates: both empty.
