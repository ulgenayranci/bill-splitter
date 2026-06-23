---
phase: quick-260623-olg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/ulgenayranci/playground/gsd-course/app/layout.tsx
  - /Users/ulgenayranci/playground/gsd-course/app/globals.css
  - /Users/ulgenayranci/playground/gsd-course/stores/useBillStore.ts
  - /Users/ulgenayranci/playground/gsd-course/components/wizard/AppHeader.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/split/InvitePeopleStep.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/split/ClaimableItemCard.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/split/PersonResultsScreen.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/split/TipScreen.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/split/BillViewHeader.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/split/PersonSlotPicker.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/split/UnclaimedBanner.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/wizard/ResultsStep.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/wizard/SetupStep.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/wizard/AddItemsStep.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/wizard/AddPeopleStep.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/wizard/ProgressStrip.tsx
  - /Users/ulgenayranci/playground/gsd-course/components/wizard/ShareLinkButton.tsx
  - /Users/ulgenayranci/playground/gsd-course/app/split/[sessionId]/CollaborativeClaimingView.tsx
autonomous: true
requirements: [BRAND-REBRAND-easy-billsy]

must_haves:
  truths:
    - "Primary CTAs render Friendly Coral (#f1603f), not amber"
    - "App background is warm cream paper (#faf5f1), text is ink (#2a2420)"
    - "UI type renders in Archivo; Caveat available as accent font var"
    - "Avatars cycle the 6 person colors in order, never coral"
    - "Header wordmark reads 'easy billsy' (light + space + bold), no minus separator"
    - "Page/tab title reads 'easy billsy'"
    - "npm run build passes with no broken token/font references"
  artifacts:
    - path: /Users/ulgenayranci/playground/gsd-course/app/globals.css
      provides: "easy billsy token block + remapped shadcn semantic tokens (both HSL and OKLch blocks) + coral/person/semantic Tailwind color utilities"
      contains: "--eb-coral-500"
    - path: /Users/ulgenayranci/playground/gsd-course/app/layout.tsx
      provides: "Archivo as --font-sans, Caveat as --font-accent, easy billsy metadata"
      contains: "Archivo"
    - path: /Users/ulgenayranci/playground/gsd-course/stores/useBillStore.ts
      provides: "AVATAR_COLORS = 6 spec person colors in order"
      contains: "3aa0e0"
    - path: /Users/ulgenayranci/playground/gsd-course/components/wizard/AppHeader.tsx
      provides: "easy billsy wordmark, coral hamburger, coral menu hover"
      contains: "billsy"
  key_links:
    - from: components/ui/button.tsx (default variant bg-primary)
      to: app/globals.css --primary token
      via: "--primary remapped to coral-500 in BOTH the HSL @layer base block and the OKLch :root block"
      pattern: "--primary"
    - from: stores/useBillStore.ts AVATAR_COLORS
      to: avatar consumers (className)
      via: "arbitrary-value bg-[#hex] classes, array shape/order unchanged"
      pattern: "AVATAR_COLORS"
---

<objective>
Apply the "easy billsy" Brand & UI Spec — a deliberate rebrand of the Bill Splitter app from amber/Geist to Friendly Coral + warm cream paper + Archivo/Caveat fonts. Re-style what already exists: no screen re-layout, no flow/structure changes.

Purpose: The user designed and approved this brand in claude.design. The spec (`bill-splitter/project/branding/easy billsy - Brand & UI Spec.html` §09) is the single source of truth for token values. This supersedes the prior "keep amber/Geist" decision.

Output: Coral-primary, warm-paper, Archivo-typed UI across all screens; `easy billsy` wordmark and tab title; 6-color person avatar palette.

NOTE ON PATHS: The active app source lives in the PARENT directory `/Users/ulgenayranci/playground/gsd-course/` (app/, components/, stores/). The `bill-splitter/` subfolder holds only the design handoff bundle and this plan. All file paths in this plan are absolute and point at the real app source. Do NOT look at or implement anything under `bill-splitter/project/hi-fi/`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/ulgenayranci/playground/gsd-course/CLAUDE.md
@/Users/ulgenayranci/playground/gsd-course/bill-splitter/project/branding/easy billsy - Brand & UI Spec.html

<interfaces>
<!-- Extracted from the real codebase. Use directly — no exploration needed. -->

CANONICAL TOKEN BLOCK (spec §09, paste verbatim values):
  Coral ramp:  50 #fff3ef · 100 #ffe1d8 · 200 #ffc7b6 · 300 #fba48b · 400 #f67e60
               500 #f1603f (PRIMARY) · 600 #dc4827 (press) · 700 #b8381c · 800 #8f2d18 · 900 #5e2113
  --eb-primary = coral-500 · --eb-primary-press = coral-600 · --eb-primary-soft = coral-100
  Warm neutrals: paper #faf5f1 · surface #ffffff · n50 #f6f1ec · n100 #efe8e1 · n200 #e6ddd3
                 n300 #d3c9bd · n400 #a89d8f · n500 #7d7466 · n600 #5a5249 · ink #2a2420
  Semantic: settle #2f9e6a · settle-soft #d8f0e3 · warn #e0a400 · danger #d8493a
  Avatars (in order, never coral): blue #3aa0e0 · violet #9b6cf0 · green #2f9e6a
                                   gold #e0a02a · teal #16b1bd · magenta #d96aa6
  Radii: xs 7 · sm 9 · md 12 · lg 16 · xl 22 · pill 999
  Shadows: card "0 1px 0 rgba(0,0,0,.02),0 18px 40px -28px rgba(42,36,32,.22)"
           pop  "0 8px 30px rgba(42,36,32,.18)"   btn "0 4px 14px rgba(241,96,63,.28)"
  Fonts: --eb-font 'Archivo' · --eb-font-accent 'Caveat'

CRITICAL — globals.css has TWO coexisting token systems (verified by reading the file):
  1. HSL block in `@layer base { :root { ... } .dark { ... } }` (lines ~7-50).
     Consumed via `hsl(var(--x))` — drives body background/foreground/border in @layer base.
     Values here are bare HSL triples like `--primary: 240 5.9% 10%`.
  2. OKLch bare block `:root { ... }` / `.dark { ... }` (lines ~115-182), UNLAYERED, appears LAST.
     This is what `@theme inline` maps through (`--color-primary: var(--primary)`, no hsl() wrapper),
     so Tailwind utilities like `bg-primary` / `bg-background` resolve from THIS block.
  => You MUST remap the brand semantic tokens in BOTH blocks consistently, or utilities and
     base styles will disagree. HSL block: write `H S% L%` triples. OKLch block: write
     `oklch(...)` OR a plain color (hex works as a standalone value); keep each block internally
     valid for how it's consumed.

@theme inline radius multipliers (lines ~106-112) currently scale from --radius:
  --radius-sm .6 · --radius-md .8 · --radius-lg 1.0 · --radius-xl 1.4 · etc.
  Tune so md lands ~12px (buttons/cards) and lg ~16px (totals/sheets) per spec.

app/layout.tsx (current):
  import { Geist } from "next/font/google"
  const geist = Geist({subsets:['latin'],variable:'--font-sans'})
  metadata.title = "Bill Splitter"
  <html className={cn("font-sans", geist.variable)}>

components/ui/button.tsx default variant: "bg-primary text-primary-foreground ..." 
  => inherits coral automatically once --primary is coral in BOTH token blocks. Do not edit button.tsx.

stores/useBillStore.ts AVATAR_COLORS (current, array of Tailwind class strings, consumed as className):
  ['bg-amber-400','bg-sky-400','bg-emerald-400','bg-violet-400','bg-rose-400','bg-orange-400']

AppHeader.tsx wordmark (lines ~85-92):
  <span className="font-normal">easy</span>
  <span className="opacity-30">−</span>      <-- REMOVE this minus span
  <span className="font-bold">billsy</span>
  aria-label="easy-billsy"                    <-- change to "easy billsy"
  Also: hamburger lines use bg-amber-600; menu item hover uses hover:bg-amber-50.

LIVE amber footprint (run grep yourself to confirm — 16 files, 57 occurrences at plan time):
  components/split/: InvitePeopleStep, ClaimableItemCard, PersonResultsScreen, TipScreen,
                     BillViewHeader, PersonSlotPicker, UnclaimedBanner
  components/wizard/: ResultsStep, SetupStep, AddItemsStep, AppHeader, AddPeopleStep,
                      ProgressStrip, ShareLinkButton
  app/split/[sessionId]/CollaborativeClaimingView.tsx
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fonts + tokens (layout.tsx + globals.css)</name>
  <files>/Users/ulgenayranci/playground/gsd-course/app/layout.tsx, /Users/ulgenayranci/playground/gsd-course/app/globals.css</files>
  <action>
FONTS (app/layout.tsx): Replace the `Geist` import and instance with `Archivo` from `next/font/google` (weights 400/500/600/700/800/900, subsets ['latin']) bound to `variable:'--font-sans'`. Add a second `Caveat` font (weights 500/600/700, subsets ['latin']) bound to `variable:'--font-accent'`. Apply BOTH `.variable`s on the `<html>` element via cn(). Update metadata: `title` → "easy billsy", `description` → "Split the restaurant bill without killing the vibe." Leave the existing `viewport` export untouched.

TOKENS (app/globals.css): Three coordinated edits.
(a) Add the full easy billsy `:root` token block (coral ramp 50-900, --eb-primary/-press/-soft, warm neutrals paper..ink, semantic settle/settle-soft/warn/danger, avatars av-blue..av-magenta, radii --eb-r-*, shadows --eb-sh-*, --eb-font/--eb-font-accent) using the exact hex values from the §09 canonical block in <interfaces>. Place this block so its custom props are globally available.
(b) Remap the shadcn semantic tokens to brand values in BOTH coexisting blocks (see the CRITICAL note in <interfaces>): in the HSL `@layer base { :root }` block write `H S% L%` triples; in the OKLch bare `:root` block write valid standalone color values. Map: --primary → coral-500, --primary-foreground → white, --background → paper, --foreground → ink, --card/--popover → surface white, --secondary/--muted/--accent → warm n50 or n100, --muted-foreground → n500, --border/--input → n200, --ring → coral-500, --destructive → danger #d8493a. Keep both blocks internally valid for how each is consumed. Leave `.dark` blocks FUNCTIONAL (don't crash) but do NOT re-theme them to brand — out of scope.
(c) In `@theme inline`: register brand Tailwind color utilities so components can use bg-coral-500 / text-coral-700 / border-coral-200 / bg-paper / text-ink / bg-settle / bg-settle-soft / text-warn / bg-danger / bg-av-blue..bg-av-magenta — i.e. add `--color-coral-50..900`, `--color-paper`, `--color-ink`, `--color-settle`, `--color-settle-soft`, `--color-warn`, `--color-danger`, `--color-av-*` pointing at the --eb-* vars. Add `--font-accent: var(--font-accent)`; keep `--font-sans` pointed at the Archivo var. Tune the `--radius` base and/or the `--radius-md`/`--radius-lg` multipliers so md ≈ 12px and lg ≈ 16px per spec. Set body background to paper (already flows from --background → paper; verify no dot-grid is added).

Do NOT edit components/ui/button.tsx — it inherits coral from --primary automatically.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && grep -q "Archivo" app/layout.tsx && grep -q "Caveat" app/layout.tsx && grep -q "easy billsy" app/layout.tsx && grep -q -- "--eb-coral-500" app/globals.css && grep -q -- "--color-coral-500" app/globals.css && ! grep -q "Geist" app/layout.tsx && echo PASS</automated>
  </verify>
  <done>layout.tsx uses Archivo (--font-sans) + Caveat (--font-accent), title "easy billsy", no Geist. globals.css contains the easy billsy token block, remapped semantic tokens in both blocks, and registered coral/person/semantic Tailwind color utilities + --font-accent.</done>
</task>

<task type="auto">
  <name>Task 2: Avatar palette + wordmark (useBillStore.ts + AppHeader.tsx)</name>
  <files>/Users/ulgenayranci/playground/gsd-course/stores/useBillStore.ts, /Users/ulgenayranci/playground/gsd-course/components/wizard/AppHeader.tsx</files>
  <action>
AVATARS (stores/useBillStore.ts): Replace the `AVATAR_COLORS` array with the 6 spec person colors IN ORDER as arbitrary-value classes (so no coral leaks in): 'bg-[#3aa0e0]' (blue), 'bg-[#9b6cf0]' (violet), 'bg-[#2f9e6a]' (green), 'bg-[#e0a02a]' (gold), 'bg-[#16b1bd]' (teal), 'bg-[#d96aa6]' (magenta). Keep the array shape and `as const`; the order matters (avatars assign in order). Consumers are unchanged.

WORDMARK (components/wizard/AppHeader.tsx): In the wordmark div, render `easy billsy` as `<span className="font-normal">easy</span>` + a literal space + `<span className="font-bold">billsy</span>`, and REMOVE the `<span className="opacity-30">−</span>` minus span entirely. Keep lowercase and ink text color. Change `aria-label="easy-billsy"` → `aria-label="easy billsy"`. Also restyle this file's amber usages here (covered fully in Task 3, but you'll touch them): hamburger `bg-amber-600` → `bg-coral-500`, menu-item `hover:bg-amber-50` → `hover:bg-coral-50`, and the confirm-reset dialog button `bg-amber-600 hover:bg-amber-700` → `bg-coral-500 hover:bg-coral-600`.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && grep -q "3aa0e0" stores/useBillStore.ts && grep -q "d96aa6" stores/useBillStore.ts && ! grep -q "easy-billsy" components/wizard/AppHeader.tsx && grep -q ">billsy<" components/wizard/AppHeader.tsx && ! grep -v '^#' components/wizard/AppHeader.tsx | grep -q "amber" && echo PASS</automated>
  </verify>
  <done>AVATAR_COLORS holds the 6 person colors in order. Header renders "easy billsy" (light + space + bold) with no minus, aria-label "easy billsy", and AppHeader.tsx has zero amber utilities.</done>
</task>

<task type="auto">
  <name>Task 3: Re-style remaining amber components (role-mapped) + build</name>
  <files>/Users/ulgenayranci/playground/gsd-course/components/split/InvitePeopleStep.tsx, /Users/ulgenayranci/playground/gsd-course/components/split/ClaimableItemCard.tsx, /Users/ulgenayranci/playground/gsd-course/components/split/PersonResultsScreen.tsx, /Users/ulgenayranci/playground/gsd-course/components/split/TipScreen.tsx, /Users/ulgenayranci/playground/gsd-course/components/split/BillViewHeader.tsx, /Users/ulgenayranci/playground/gsd-course/components/split/PersonSlotPicker.tsx, /Users/ulgenayranci/playground/gsd-course/components/split/UnclaimedBanner.tsx, /Users/ulgenayranci/playground/gsd-course/components/wizard/ResultsStep.tsx, /Users/ulgenayranci/playground/gsd-course/components/wizard/SetupStep.tsx, /Users/ulgenayranci/playground/gsd-course/components/wizard/AddItemsStep.tsx, /Users/ulgenayranci/playground/gsd-course/components/wizard/AddPeopleStep.tsx, /Users/ulgenayranci/playground/gsd-course/components/wizard/ProgressStrip.tsx, /Users/ulgenayranci/playground/gsd-course/components/wizard/ShareLinkButton.tsx, /Users/ulgenayranci/playground/gsd-course/app/split/[sessionId]/CollaborativeClaimingView.tsx</files>
  <action>
First run `grep -rn "amber" components app` to get the live exact file/line list (it should match the 14 files above plus AppHeader, already done in Task 2). Map every amber utility to coral BY ROLE, not by number, per spec §06:
- Primary CTA `bg-amber-600`/`-700` → `bg-coral-500` + `hover:bg-coral-600` (and `active:bg-coral-600`); add the coral button shadow where the spec shows it (shadow via `--eb-sh-btn`, e.g. an inline style or a shadow utility).
- Soft fills `bg-amber-100`/`bg-amber-50` → `bg-coral-100`/`bg-coral-50`. Claimed-item tint = `bg-coral-50` with `border-coral-200`.
- Accent text `text-amber-600`/`-700` → `text-coral-600`/`-700`.
- Borders `border-amber-400`/`-300` → `border-coral-200`.
- Progress filled segment (ProgressStrip) → `bg-coral-500`.
- "One coral action per screen": if a screen has multiple amber buttons, keep ONLY the primary CTA coral; demote the others to neutral outline/ghost (shadcn outline variant or neutral n-tones).
- Settled/paid states stay GREEN: "your share / settled" cards use settle-soft (`bg-settle-soft` / green), never coral. Total cards use `bg-coral-100` per spec demos.
Finish with ZERO amber stragglers anywhere, then run the build.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && ! grep -rn "amber" components app && ! grep -rn "Geist" app components && npm run build 2>&1 | tail -5 && echo BUILD_DONE</automated>
  </verify>
  <done>`grep -rn "amber" components app` returns nothing; `grep -rn "Geist" app components` returns nothing; coral CTAs follow one-coral-per-screen; settled/paid stays green; `npm run build` passes.</done>
</task>

</tasks>

<verification>
1. `grep -rn "amber" components app` → no results.
2. `grep -rn "Geist" app components` → no results.
3. `npm run build` passes (no broken token/font references).
4. `npm run dev`, mobile viewport, walk scan → "Who are you?" → collaborative split → tip → results. Confirm: coral primary CTAs, Archivo type, warm-paper background, person-colored avatars (no coral avatar), green only on settled/paid, totals in tabular-nums.
5. Header shows "easy billsy" with the weight jump and NO minus; browser tab title reads "easy billsy".
</verification>

<success_criteria>
- All amber utilities replaced by role-mapped coral/neutral/green; zero amber stragglers.
- Archivo is the UI font (--font-sans); Caveat available as --font-accent; no Geist references.
- globals.css carries the easy billsy token block, remapped shadcn semantic tokens in BOTH the HSL and OKLch blocks, and coral/person/semantic Tailwind color utilities.
- AVATAR_COLORS = 6 spec person colors in order, never coral.
- Wordmark = "easy billsy" (light + bold, no minus); tab title = "easy billsy".
- `.dark` left functional (not crashing), not re-themed. No screen re-layout or flow changes. No hi-fi mockups consulted.
- `npm run build` passes.
</success_criteria>

<output>
Create `.planning/quick/260623-olg-apply-the-easy-billsy-brand-ui-spec-rebr/260623-olg-SUMMARY.md` when done.
</output>
