# easy billsy — UI Spec & Consistency Worksheet

> **Purpose:** one source of truth for the look & feel, plus a worksheet for fixing the
> inconsistencies that have crept in. The **canonical rules** below are what the design
> *should* be (pulled from the real tokens in `app/globals.css` and the component
> primitives). The **screen checklists** are where *you* mark what's actually wrong.
>
> **How to use this doc:**
> 1. Read each canonical rule.
> 2. Go through the screen-by-screen section. For anything that looks off, write it in the
>    `🔴 What's wrong` line (or the Inconsistency Log at the bottom).
> 3. Hand it back to me and I'll fix everything you flagged, screen by screen.
>
> Mark items with: ✅ looks right · 🔴 wrong, see note · ❓ not sure / need your eyes
>
> _Last grounded against code: 2026-06-23. Canonical values come from `app/globals.css`._

---

## 1. Design Tokens (canonical — do not guess, these are the real values)

### Color — Coral (brand primary)
| Token | Hex | Use |
|-------|-----|-----|
| `coral-50` | `#fff3ef` | soft tints, claimed-item background |
| `coral-100` | `#ffe1d8` | soft fills, input focus ring |
| `coral-200` | `#ffc7b6` | soft borders |
| `coral-500` `--eb-primary` | `#f1603f` | **primary CTA fill, the one coral action per screen** |
| `coral-600` `--eb-primary-press` | `#dc4827` | CTA hover/press, accent text & totals (`text-coral-600`) |

### Color — Warm neutrals
| Token | Hex | Use |
|-------|-----|-----|
| `paper` / `--background` | `#faf5f1` | app background (cream) |
| `surface` / `card` | `#ffffff` | cards, inputs, sheets |
| `n50` / `secondary` | `#f6f1ec` | subtle fills |
| `n100` / `muted` | `#efe8e1` | outline-button fill, muted surfaces |
| `n200` / `border` `input` | `#e6ddd3` | default borders & input borders |
| `n500` / `muted-foreground` | `#7d7466` | secondary text |
| `ink` / `foreground` | `#2a2420` | primary text |

### Color — Semantic (each has ONE meaning)
| Token | Hex | Meaning — **never reuse for anything else** |
|-------|-----|-----|
| `settle` | `#2f9e6a` | **settled / paid money states only** (e.g. "Paid" chip) |
| `settle-soft` | `#d8f0e3` | settled background tint |
| `warn` | `#e0a400` | **review / unclaimed / needs-attention** states |
| `danger` / `destructive` | `#d8493a` | errors, destructive actions |

### Color — Person avatars (assigned in this order, NEVER coral)
`av-blue #3aa0e0` → `av-violet #9b6cf0` → `av-green #2f9e6a` → `av-gold #e0a02a` → `av-teal #16b1bd` → `av-magenta #d96aa6`

### Typography
| Role | Font | Token |
|------|------|-------|
| Everything (UI, headings, body) | **Archivo** | `--font-sans` |
| Accent / playful (wordmark flourish, hand-written feel) | **Caveat** | `--font-accent` |

- Wordmark: `easy` (regular) + space + **`billsy`** (bold). No hyphen/minus separator.
- Card titles use `font-heading` (= Archivo) at `text-base font-medium`.

### Radius
| Token | Value | Use |
|-------|-------|-----|
| `sm` | ~9px | small chips |
| `md` `--radius` | ~12px | **buttons, inputs, cards** (default) |
| `lg` | ~16px | totals, sheets |
| `xl` | ~22px | large containers |
| `pill` | 999px | badges, pills |

### Shadow
| Token | Use |
|-------|-----|
| `--eb-sh-card` | resting cards |
| `--eb-sh-pop` | popovers, dialogs |
| `--eb-sh-btn` `0 4px 14px rgba(241,96,63,.28)` | primary coral button glow |

---

## 2. Global Rules (the ones that get violated → inconsistency)

1. **One coral action per screen.** Exactly one `bg-coral-500` CTA. Everything else is
   neutral/outline. If two buttons are both coral, that's a bug.
2. **Green means money is settled** — and nothing else. Don't use green for "done",
   "success", "selected", or decoration.
3. **Warn (amber) = needs attention** — unclaimed items, review prompts, expiry notices.
4. **Avatars are never coral** and always follow the 6-color order above.
5. **Inputs:** white fill, `1.5px` `border-input`, coral focus ring (`ring-coral-100`).
6. **Cards:** white surface, `rounded-xl`, `ring-1 ring-foreground/10`. No ad-hoc shadows.
7. **Radius is `md`/`xl` tokens** — no random `rounded-md`/`rounded-2xl` one-offs.
8. **Body is paper `#faf5f1`**, not white. White is for cards/sheets only.

> ✏️ **Add any global rule you want enforced that isn't listed:**
> -

---

## 3. Component Primitives (canonical variants — flag misuse)

### Button (`components/ui/button.tsx`)
| Variant | Looks like | When to use |
|---------|-----------|-------------|
| `default` | coral-500 fill, white text, coral glow shadow | the one primary CTA |
| `outline` | `n100` fill, border, ink text | secondary actions |
| `secondary` | `n50` fill, ink text | tertiary |
| `ghost` | muted fill, muted text | low-emphasis / icon |
| `destructive` | danger tint fill, danger text | delete/remove |
| `link` | coral text, underline on hover | inline text actions |

Sizes: `xs h6 · sm h7 · default h8 · lg h9` + icon variants. Default height is **h-8**.

> 🔴 **Buttons that use the wrong variant / wrong size / hand-rolled coral:**
> -

### Input (`components/ui/input.tsx`)
White fill · `border-[1.5px] border-input` · coral focus ring (`ring-coral-100`) · `h-8` · `rounded-lg`.

> 🔴 **Inputs that don't match (gray fill, no focus ring, wrong height):**
> -

### Card (`components/ui/card.tsx`)
White · `rounded-xl` · `ring-1 ring-foreground/10` · `py-4` · footer gets `bg-muted/50 border-t`.

> 🔴 **Cards with custom shadows/borders/radius that drift from this:**
> -

### Badge (`components/ui/badge.tsx`)
Pill (`rounded-4xl`), `h-5`, `text-xs`. Variants: `default` (coral), `secondary`, `destructive`, `outline`, `ghost`, `link`.

> 🔴 **Badges with hand-rolled colors instead of variants:**
> -

### Dialog / Checkbox / Separator
- Dialog: white surface, `--eb-sh-pop` shadow, paper-dimmed overlay.
- Checkbox: coral when checked.

> 🔴 **Notes on dialogs/checkboxes/separators:**
> -

---

## 4. Screen-by-Screen Checklist

> The active flow (per project decisions): **Landing → scan/OCR → "Who are you?" identity
> modal → collaborative /split bill view → tip → per-person results.** The old wizard
> Assign/Results screens are retired. Wizard files still in the repo may be legacy — flag
> any that are still reachable.

### 4.1 Landing / Home — `app/page.tsx`
Status: ☐
- Background is paper? ✅/🔴
- Single coral CTA (scan/start)? ✅/🔴
- Wordmark rendered as `easy **billsy**`? ✅/🔴
> 🔴 What's wrong:
> -

### 4.2 App Header — `components/wizard/AppHeader.tsx`
Status: ☐
- Wordmark correct, coral hamburger/menu hover? ✅/🔴
> 🔴 What's wrong:
> -

### 4.3 OCR Loading + Errors — `OcrLoadingOverlay.tsx`, `OcrErrorToast.tsx`
Status: ☐
- Loading overlay on-brand (coral spinner, paper/surface)? ✅/🔴
- Error toast uses `danger`, not random red? ✅/🔴
> 🔴 What's wrong:
> -

### 4.4 Identity Modal ("Who are you?") — `components/split/IdentityModal.tsx`
Status: ☐
- Dialog styling matches primitive? ✅/🔴
- Avatar colors follow the 6-color order? ✅/🔴
- One coral confirm button? ✅/🔴
> 🔴 What's wrong:
> -

### 4.5 Collaborative Bill View — `app/split/[sessionId]/CollaborativeClaimingView.tsx`
Status: ☐
- Bill header (`BillViewHeader.tsx`) totals in `text-coral-600`? ✅/🔴
- Claimable item cards (`ClaimableItemCard.tsx`): claimed = `coral-50/100` tint, border `coral-200`? ✅/🔴
- Unclaimed banner (`UnclaimedBanner.tsx`) uses `warn`, not coral/red? ✅/🔴
- Person slot picker (`PersonSlotPicker.tsx`) avatars correct, no coral? ✅/🔴
> 🔴 What's wrong:
> -

### 4.6 Invite People — `components/split/InvitePeopleStep.tsx`
Status: ☐
- Share/invite affordance on-brand? ✅/🔴
> 🔴 What's wrong:
> -

### 4.7 Tip Screen — `components/split/TipScreen.tsx`
Status: ☐
- Tip buttons: one selected state, consistent radius? ✅/🔴
- Totals styling matches bill view? ✅/🔴
> 🔴 What's wrong:
> -

### 4.8 Per-Person Results — `components/split/PersonResultsScreen.tsx`
Status: ☐
- "Paid" chip is green (settled) — and green appears nowhere else? ✅/🔴
- Amount-owed styling consistent with totals elsewhere? ✅/🔴
> 🔴 What's wrong:
> -

### 4.9 Session Expired — `components/split/SessionExpiredScreen.tsx`
Status: ☐
- Uses `warn` tone, calm layout? ✅/🔴
> 🔴 What's wrong:
> -

### 4.10 Legacy Wizard Steps (verify if still reachable)
`SetupStep · AddItemsStep · AddPeopleStep · AssignItemsStep · ResultsStep · ProgressStrip · WizardShell · DisambiguationDialog · ShareLinkButton · BillPhotoLightbox`
Status: ☐
> 🔴 Which of these are still shown to users, and what's inconsistent:
> -

---

## 5. Inconsistency Log (master list — I work top to bottom)

| # | Screen / Component | What's wrong | Should be | Priority |
|---|--------------------|--------------|-----------|----------|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |

---

## 6. Open Questions for the User
- Are the legacy wizard screens (§4.10) still in the product, or fully replaced by the
  collaborative flow? (Affects whether we fix or delete them.)
- Any screen not listed above that you've seen look "off"?
- Dark mode is currently **not** rebranded (still default shadcn). In scope or ignore?
