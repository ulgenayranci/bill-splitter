# Feature Landscape

**Domain:** Bill splitter / expense splitting web app with receipt OCR
**Researched:** 2026-05-08
**Confidence:** MEDIUM (training knowledge of Splitwise, Tricount, Tab, Kite, Settle Up; web tools unavailable in this session)

---

## Table Stakes

Features users expect from any bill splitter. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add people to a session | Can't split without knowing who's at the table | Low | Name-only is fine; no login required |
| Manual item entry | Fallback when OCR fails or no photo available | Low | Every competitor has this |
| Assign items to people | The core mechanical action of splitting | Low-Med | Must handle one item → many people (shared items) |
| Shared item splitting | Appetizers, bottles, bread baskets — always present | Med | Equal division among selected people |
| Tip input (% or flat $) | Every restaurant bill has tip | Low | Preset buttons (15/18/20%) + custom |
| Tax input (% or flat $) | Tax is pre-printed on most receipts; must account for it | Low | Often already on receipt, should auto-read |
| Proportional tip & tax distribution | Fair split — person who spent more pays more tip | Med | Total subtotal as denominator |
| Final per-person total | The entire point of the app | Low | Clear, scannable, large font |
| Edit / correct OCR results | OCR is never 100% accurate | Med | Inline editing of item names and prices |
| Add items not on receipt | Easy to forget items; comps; rounding | Low | Free-entry row at the bottom |

---

## Differentiators

Features that set a product apart. Not expected by default, but highly valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Receipt photo → OCR line items | Eliminates manual entry entirely; core innovation | High | The whole thesis of this product |
| AI abbreviation expansion | "CHKN SAND LG" → "Chicken Sandwich (Large)" — receipts are unreadable without this | Med-High | Requires LLM call; critical for usability |
| Menu photo fallback | When AI can't resolve an abbreviation, snap the menu page | Med | Second OCR pass against menu; resolves ~80% of edge cases |
| Shareable link (multi-device) | Each person claims their own items on their own phone | High | Requires real-time sync or polling; eliminates "pass the phone" |
| Single-driver mode | One person assigns items for everyone without link share | Low | Just the default if no link is shared |
| Unassigned items warning | Surfaces items nobody claimed before locking totals | Low | Simple validation step; prevents undercounting |
| Item-level discount handling | Happy hour prices, promo deductions, coupons | Med | Discount applied before proportional split |
| Comp / zero-price item marking | Comped drinks still need to be assigned (affects proportionality of tip) | Low | Mark as $0 but assign to person for tip calculation |
| Rounding reconciliation | Cent-level rounding produces totals that don't sum correctly | Med | Assign residual cents to one person (payer or heaviest orderer) |
| No-account / anonymous use | Zero friction; open URL and start | Low | Session stored in URL or localStorage; no auth required |
| PWA installable | "Add to home screen" so it's always handy | Low | manifest.json + service worker; high leverage for repeat use |
| Copy-to-clipboard summary | "Sarah $34.50, Mike $28.20" — paste into group chat | Low | Text blob, no formatting required |
| Venmo/CashApp deep-link per person | Tap a button, land directly on payment screen with amount pre-filled | Med | URL scheme deep-links only; no API needed |

---

## Anti-Features

Features to explicitly NOT build in v1. They add complexity, maintenance burden, or distract from the core flow without proportional value for a restaurant bill use case.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User accounts / login | Breaks zero-friction promise; adds auth infrastructure; most sessions are one-shot | Anonymous sessions via URL token |
| Bill history / saved sessions | Implies account system; storage costs; GDPR surface area | Let users screenshot the final screen |
| Recurring expense tracking | That's Splitwise's job; completely different product | Out of scope — different domain |
| Group debt management ("you owe Sarah $12 from 3 bills") | Requires persistence, accounts, trust model | Solve one bill at a time |
| In-app payment processing | Venmo/CashApp deep-links cover 90% of need; payments add PCI scope, fraud, chargebacks | Deep-link to payment apps instead |
| Push notifications | No persistence = nothing to notify about | N/A |
| Currency conversion | Adds complexity; travel expense apps (Trail Wallet) do this better | Single-currency assumption; note it explicitly |
| Receipt storage / photo gallery | Privacy risk; storage costs; no retention value | Only hold photo long enough for OCR; discard after |
| Social features (comments, reactions, disputes) | Overcomplicates a utility tool | "Talk to your friends" |
| Admin / permission roles (host-only edits) | Friction; trust model complexity | Optimistic: anyone with the link can edit |
| Native iOS / Android app | Web app with PWA covers the use case; App Store review delays iteration | Ship web-first, evaluate native later |

---

## Feature Dependencies

```
People list → Item assignment (can't assign without people)
People list → Shareable link (link maps to person slot)
OCR extraction → AI abbreviation expansion (expansion requires extracted text)
OCR extraction → Edit / correct OCR results (correction requires extracted output)
Menu photo fallback → OCR extraction (fallback is triggered by failed first OCR)
Item assignment → Shared item splitting (shared is a variant of assignment)
Item assignment → Unassigned items warning (warning requires assignment state)
Item assignment → Proportional tip & tax (proportionality requires per-person subtotals)
Proportional tip & tax → Rounding reconciliation (rounding is a post-calculation step)
Proportional tip & tax → Final per-person total (totals include tip + tax)
Final per-person total → Copy-to-clipboard summary (summary is derived from totals)
Final per-person total → Venmo deep-link (deep-link uses per-person total)
```

---

## Edge Cases in Bill Splitting (Research Notes)

These are not separate features but must be handled correctly inside core features.

### Discounts and Comps
- Item-level discount: "Happy hour -$2.00" — deduct before proportional calculation, not after
- Whole-bill discount: "10% off" line on receipt — apply to subtotal before tip/tax base
- Comped item: $0.00 on receipt — assign to person anyway so their subtotal stays correct for tip proportionality
- If comp is not assigned, proportionality silently shifts to other payers

### Rounding Errors
- Floating-point arithmetic on currency produces e.g. $0.01 gaps
- Per-person totals may not sum exactly to the bill total
- Standard approach: round everyone down to 2 decimal places, assign remaining cents to the last person (or the person who opened the session)
- Must display: "Total: $124.00 | Sum of shares: $124.00" with explicit reconciliation check

### Tax Behavior Variance
- Some receipts show tax as a line item (easy — read it)
- Some receipts show tax-inclusive prices (UK, Canada) — tax must be extracted differently or left out
- Some receipts show multiple tax lines (state + local, alcohol surcharge) — sum them
- Recommendation: allow manual override of tax amount always

### Tip Scenarios
- No tip printed (user calculates after) — tip entry UI must come after OCR
- Gratuity already included (auto-grat for large parties) — may appear as a line item on receipt; OCR should flag it, not double-count
- Split tip: sometimes parties agree different people tip different amounts — out of scope for v1, but note that flat equal-split of tip is wrong; proportional is correct

### Person Assignment Edge Cases
- One item ordered twice by the same person — handle as quantity or two rows
- One person pays for another (gift, treating) — assign to payer, not recipient; out of scope unless explicitly noted
- Person leaves early and is removed — their items must be reassigned

### Shared Item Math
- 3 people share a $13 item: $13 / 3 = $4.333... — round to $4.34 / $4.33 / $4.33 (or $4.34 each with reconciliation)
- Display the rounded per-share, reconcile at total level

---

## MVP Recommendation

**Prioritize (build in v1):**
1. Add people
2. Receipt photo → OCR → AI name expansion
3. Edit/correct OCR output
4. Item assignment (single-driver)
5. Shared item marking + person selection
6. Tip + tax entry (proportional split)
7. Final breakdown (per-person totals)
8. Shareable link (multi-device item claiming)
9. Unassigned items warning
10. Copy-to-clipboard summary

**Defer to later:**
- Venmo/CashApp deep-links — useful but not blocking core flow
- Menu photo fallback — implement after OCR is stable and you can measure disambiguation failure rate
- PWA installable — add after core flow ships; one-day effort
- Rounding reconciliation display — implement but low visibility

**Explicitly out of scope (v1):**
All anti-features listed above. The PROJECT.md already correctly excludes accounts, payment integrations, and history.

---

## Competitive Landscape Notes

**Splitwise** — Dominant in persistent group debt tracking. Not a receipt-first app. No OCR. Table stakes for long-term group finances (roommates, trips). Different job-to-be-done from this product.

**Tab (tab.money)** — Closest competitor. Receipt OCR, item assignment, shareable link. Its existence validates the thesis. Differentiate on: speed, no-account friction, AI name expansion quality.

**Tricount** — Group expense tracker. Manual entry only. No OCR. Strong in Europe. Different JTBD (track over time vs split once).

**Kite** — Restaurant bill splitter with OCR. Simpler than Tab. Less polished AI expansion. Mobile app (iOS/Android), not web.

**Settle Up** — Cross-platform group expenses. Manual entry. Debt simplification. No OCR.

**Key insight:** The photo-first + AI expansion combination is genuinely differentiating. Tab has photo-first but AI expansion quality varies. No competitor pairs receipt OCR with LLM-powered name resolution as a first-class feature. This is the moat.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Table stakes features | HIGH | These are consistent across all bill-splitter apps; well-established |
| Differentiators | MEDIUM | Tab/Kite feature lists from training data; web tools unavailable to verify current state |
| Anti-features | HIGH | Product decision reasoning is sound regardless of competitive data |
| Edge cases (rounding, tax, comps) | HIGH | Mathematical properties; not dependent on competitor research |
| Competitive landscape | MEDIUM | Training data through Aug 2025; Tab/Kite may have shipped new features |

---

## Sources

- Training knowledge: Splitwise (splitwise.com), Tab (tab.money), Tricount (tricount.com), Kite (kiteapp.co), Settle Up — HIGH familiarity, MEDIUM confidence due to knowledge cutoff
- PROJECT.md: /Users/ulgenayranci/playground/gsd-course/.planning/PROJECT.md — confirmed scope and out-of-scope decisions
- Web tools (WebSearch, WebFetch) were unavailable in this session; competitive feature lists could not be verified against live product pages
