# Phase 11 — UI Review (6-Pillar Visual Audit)

**Phase:** 11 — Bug Fixes & Polish — Bill/Results Screens + Participant Management
**Overall Score:** 16/24
**Mode:** Code-only audit (Playwright not available; no screenshots captured)
**Baseline:** No phase UI-SPEC.md; audited against abstract 6-pillar standards + established design system (Geist, amber accent, coral-soft chips, rounded-lg cards, h-12 buttons) and root `UI-SPEC.md`.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | "Go back" duplicated in sticky footer and unclaimed dialog simultaneously; "Add a tip?" ends with a question mark, breaking imperative-CTA consistency |
| 2. Visuals | 3/4 | "Add a tip?" is an invisible-chrome span with no touch affordance; rename pencil overlaps avatar in the 2-column card grid |
| 3. Color | 2/4 | Two `bg-coral-500` CTAs visible simultaneously on the claiming screen (Share + "I'm done"); unclaimed section uses hardcoded `#e0a400` hex instead of `bg-warn` token |
| 4. Typography | 3/4 | 10 distinct font sizes across split components; arbitrary px sizes outnumber Tailwind scale 9-to-1; two competing hero-number sizes (24px vs 28px) |
| 5. Spacing | 4/4 | Consistent Tailwind scale; no stray arbitrary spacing (only intentional `pb-[200px]`/`pb-[160px]` bottom-bar clearance) |
| 6. Experience Design | 1/4 | BLOCKER: no loading/in-flight feedback on any split component; "Add a tip?" sub-threshold touch target; live bill view has no remove-person recovery path; SUMMARY.md inaccurately records remove-person as shipped |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **"Add a tip?" span is not a real tap target** — On mobile the span has no `min-h`, so its tap area is ~18px (text line height). iOS/WCAG require 44px. Users will miss the tap at a key monetization moment. **Fix:** replace the `<span role="button">` at `components/split/PersonResultsScreen.tsx:354` with a real shadcn `<Button variant="link" className="h-11 text-coral-600 px-0">`, and drop the question mark → "Add a tip".

2. **Two coral-500 CTAs visible simultaneously on the claiming screen** — The Share button (`components/split/BillViewHeader.tsx:122`, `bg-coral-500`) and "I'm done" (`app/split/[sessionId]/CollaborativeClaimingView.tsx:820`, `bg-coral-500`) render at once, violating "one coral action per screen." **Fix:** demote Share to `variant="outline"` or a ghost icon button; keep "I'm done" as the single primary.

3. **Unclaimed section uses hardcoded hex instead of design tokens** — `components/split/PersonResultsScreen.tsx:216` and `components/split/UnclaimedBanner.tsx:25` use `bg-[#e0a400]/10 border-[#e0a400]/30` instead of `bg-warn/10 border-warn/30`, breaking the single source of truth (`text-warn` is already used correctly in the same components). **Fix:** swap bg/border to the token classes.

---

## Detailed Findings

### Pillar 1 — Copywriting (3/4) — WARNING

- `PersonResultsScreen.tsx:413-414` (sticky footer "Go back") and `PersonResultsScreen.tsx:448` (unclaimed confirm dialog "Go back") can show two identical labels with opposite semantic weights (outline vs coral-500). **Fix:** rename dialog CTA to "Edit the bill" / "Fix unclaimed items".
- `PersonResultsScreen.tsx:361`: "Add a tip?" ends with a question mark; every other CTA is imperative ("Add me", "Share summary", "I'm done"). **Fix:** "Add a tip".
- "Nothing claimed yet" empty state (`:300`) — clear, passes.
- "Couldn't copy — try again" (`:187`) — consistent error tone, passes.
- D-04 playful headline ("Hold up — N items still up for grabs!") correctly implemented, matches tone.

### Pillar 2 — Visuals (3/4) — WARNING

- `PersonResultsScreen.tsx:354-362`: "Add a tip?" span has no height constraint (~20px line), no underline/border affordance — weakest interaction point on the screen.
- `PersonSlotPicker.tsx:103-116`: rename Pencil button is `absolute top-1 right-1`, 44px, consuming ~26% of a ~168px card on a 375px screen and partially occluding the avatar. `stopPropagation()` (D-05) is correctly met, but visual hierarchy fights the avatar.
- `BillViewHeader.tsx:117-130`: Share button has proper `min-h-[44px]` + label (D-02 pass), but its color conflicts with the primary CTA (see Pillar 3).
- Unclaimed callout is `role="button"` opening a dialog but has no chevron/arrow indicator. **Fix:** add `ChevronRight`.

### Pillar 3 — Color (2/4) — WARNING (near BLOCKER)

- **Two simultaneous coral-500 CTAs:** `BillViewHeader.tsx:122` (Share, top-right) and `CollaborativeClaimingView.tsx:820` ("I'm done", bottom sticky) both render on the claiming screen. Demote Share.
- **Hardcoded hex instead of tokens:** `PersonResultsScreen.tsx:216`, `UnclaimedBanner.tsx:25` (and pre-Phase-11 `SetupStep.tsx:353,383`) use `bg-[#e0a400]/10 border-[#e0a400]/30`. `--color-warn` is defined in globals.css → `bg-warn/10` is valid. Only bg/border are strays; `text-warn` already correct.
- Results-screen dialog ("Go back" coral + sticky "Share summary" coral) is modal, so never simultaneous — acceptable (copy issue noted in Pillar 1).
- **Positive:** avatars avoid coral; green only on "Paid" chip; warn tokens correct for `text-warn`.

### Pillar 4 — Typography (3/4) — WARNING

- 10 distinct sizes across split components: `text-[11px]`, `[12px]`, `[13px]`, `[14px]`, `[16px]`, `[20px]`, `[24px]`, `[28px]`, `text-sm`. Tailwind named scale almost entirely bypassed.
- Two competing hero-number sizes: `text-[28px]` (`PersonResultsScreen.tsx:284`) vs `text-[24px]` (TipScreen) — inconsistent across screens.
- `BillViewHeader.tsx:129`: `text-[13px]` button label where most labels use `text-[14px]`.
- **Positive:** weights well-controlled — only `font-semibold` (21×) and `font-medium` (4×).

### Pillar 5 — Spacing (4/4)

- Clean adherence to scale (`gap-2/3/6`, `px-4/6`, `py-3/4`). Only arbitrary values are `pb-[200px]` / `pb-[160px]` for fixed-bottom-bar clearance — acceptable one-offs. Strongest pillar.

### Pillar 6 — Experience Design (1/4) — BLOCKER

- **Remove-person record inaccuracy + product gap:** `11-04-SUMMARY.md` claims per-card remove + `handleRemovePerson` shipped, but commit `107c88e` deliberately descoped all of it (props, handler, self-removal effect). Descope is intentional per `[project_remove_person_setup_only]`, but the SUMMARY is inaccurate as a completion record, and the live bill view has no remove/recovery path for a wrongly-added participant (must abandon + restart).
- **No loading states:** zero spinners/skeletons/in-flight feedback in `PersonResultsScreen`, `BillViewHeader`, `PersonSlotPicker`, `IdentityModal`. Rename fires with no feedback until SWR resolves. **Fix:** disable + spinner, or `opacity-50 pointer-events-none` during fetch.
- **"Add a tip?" touch target** (also Pillar 2): repeated missed taps on mobile at a monetization moment.
- **Positive:** D-04 dialog redirect (not silent), D-06 Lua claim-freeing (atomic 5-location purge), localStorage identity restore (IDENT-04), SWR rename path, error states (rename/copy/tip), disabled +/- on `ClaimableItemCard`.

---

## Files Audited

- `components/split/PersonResultsScreen.tsx`
- `components/split/BillViewHeader.tsx`
- `components/split/PersonSlotPicker.tsx`
- `components/split/IdentityModal.tsx`
- `components/split/UnclaimedBanner.tsx`
- `components/split/TipScreen.tsx`
- `components/split/ClaimableItemCard.tsx`
- `app/split/[sessionId]/CollaborativeClaimingView.tsx`
- `app/globals.css`, root `UI-SPEC.md`
- Phase 11 PLAN.md (01–04), SUMMARY.md (01–04)
- Git: `107c88e`, `c73902c`, `99b57ab`, `2a0a62a`, `2eca8b5`, `238133d`, `ef83d2b`

---

## Recommendation Count

- Priority fixes: 3
- Additional findings: 6 (duplicate "Go back" copy, hardcoded hex tokens, remove-person gap, type-scale sprawl, missing interactive indicator on unclaimed callout, loading-state absence)
