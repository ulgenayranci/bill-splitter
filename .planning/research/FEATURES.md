# Feature Research

**Domain:** Bill splitter web app — v2.0 easy-billsy redesign (flat model, scan-first, multi-currency)
**Researched:** 2026-06-04
**Confidence:** HIGH (primary sources: competitor analyses, user research, and v1.0 codebase all current)

---

## Context

This is a SUBSEQUENT MILESTONE research document. v1.0 is shipped. The question is not
"what should a bill splitter do?" but "what do the v2.0 changes require, and what edge
cases does the flat model create?"

Four feature areas under investigation:
1. Scan-first single Setup screen (scan + add people inline)
2. "Who are you?" identity modal (pick-your-name gate before claiming)
3. Flat collaborative model (host role removed; anyone edits/claims)
4. Currency recognition from receipt

---

## Table Stakes (Users Expect These)

Features users assume exist in v2. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Scan receipt as the first action | v2 headline promise; scan-first is the brand | LOW | Camera input already exists; action is repositioning, not rebuilding |
| Inline people-add on Setup screen | Users want one screen to configure before sharing | LOW | People list already exists in Zustand; UI is repositioned, not rebuilt |
| Identity selection before claiming | Without a host, users must self-identify to claim | LOW | Name picker modal; reads the people list set during Setup |
| Per-person results breakdown | The point of the whole flow | LOW | Already shipped; locked-read rendering is new wrapper |
| Copy-to-clipboard summary | Table stakes after Reddit research; users paste into group chat | LOW | Already shipped in v1; surfacing on Results screen |
| Tip entry (percentage presets + custom) | Every restaurant bill has tip; v1 already does this | LOW | Moving to a modal launched from Results, not inline during claim |
| Real-time claim sync | Already shipped in v1.0; removing it would be a regression | HIGH | Upstash Redis + polling/SSE already in place |
| Shared items (multi-claimant splitting) | Appetizers, bottles — present on nearly every bill | MEDIUM | Already shipped; must survive flat-model refactor |
| Quantity stepper per item | Ordered two of the same thing is a real scenario | LOW | Already shipped; must survive flat-model refactor |
| Edit item names / prices | OCR is not perfect; users must correct | MEDIUM | Already shipped; in flat model any user may edit |
| Unassigned items warning before results | Without host enforcement, leftovers become invisible | MEDIUM | Was advisory in v1; in flat model this is the only safety net |
| New bill / reset action | Users want to start again at the table | LOW | "New bill" in Results screen actions + hamburger menu |

---

## Differentiators (Competitive Advantage)

Features that set easy-billsy apart. Not required by users, but valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI abbreviation expansion | "CHKN SAND LG" → "Chicken Sandwich (Large)" — competitors ship raw OCR output; our readability is the moat | MEDIUM | Already shipped in v1; must survive v2 refactor intact |
| Currency recognition from OCR | Non-US receipts show £, €, ¥, ₹, etc.; detect and render consistently | MEDIUM | GPT-4o-mini already reads the receipt; add currency symbol extraction to the prompt + store currency in session state |
| Flat (host-less) model | Removes the biggest UX friction point: waiting for host approval; anyone at the table can fix a mistake | MEDIUM | Primary v2 model change; see edge-case enumeration below |
| Scan-first Setup (no pre-config required) | Lower barrier than adding people before scanning; scan produces the items list and THEN people name what they had | LOW | Reduces steps-to-value from ~4 to ~2 |
| "Who are you?" auto-skip for solo use | If only 1 person is in the session, skip the identity modal; avoids friction for the person recapping a solo business meal | LOW | Conditional render: if people.length === 1, auto-select and proceed |
| Tip-after-results modal | Clarifies the mental model: "here's what everyone owes, now let's add tip" rather than asking for tip before the breakdown | LOW | Already built; repositioned to Results screen |
| Easy-billsy brand shell (wordmark + hamburger) | Coherent product identity signals legitimacy and repeatability | LOW | Header + nav component; History stub inert |
| WhatsApp/iMessage-ready one-tap share message | split-fair.com ships this; bridges app output back into "one person pays, others reimburse" default behavior (the dominant pattern per Reddit research) | LOW | Extend existing copy-summary with formatted per-person lines |
| Privacy-first framing | No accounts, auto-expiring sessions, image not stored — EasyCheckSplitter wins on this because they publish it; we don't | LOW | Marketing/UI change, not code change; add a one-line disclosure near scan |

---

## Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Host approval / dispute queue | "Someone else changed my item" — users want enforcement | Adds a blocking async step that kills real-time flow; the host is almost never physically watching the session at the moment a conflict arises; adds complexity disproportionate to incidence rate | Optimistic flat model + real-time UI showing who claimed what so group can self-police at the table |
| User accounts / login | "Save my bill history" — natural next ask | Breaks zero-friction promise; forces setup before use; our lead is "just open the link"; any auth gate loses the table-side use case | History stub in v2; full history in v2.1 using the existing session ID as a lookup key (no login needed) |
| Currency conversion | Multi-currency receipts (travel, cross-border) | Travel expense apps (Trail Wallet, Tricount) own that domain; adding exchange rates introduces staleness, external API dependency, and a reconciliation problem (at what rate?) | Single-currency recognition per session; display in the detected symbol; conversion is out of scope |
| In-app payment / settlement | "Tell me how to pay Sarah" | Not targeting US market; Venmo deep-links don't work for our non-US audience; payment rails vary per country; adds legal surface area | Copy-summary message is the payment bridge; users paste into their preferred payment app |
| Dispute / edit-request workflow | "I didn't order that" with no host | Complex async back-and-forth that degrades the at-table experience; if the dispute resolution is slower than just talking to the person next to you, it's friction, not help | Show live claim attribution ("Mike claimed this") so group resolves by talking; anyone can edit freely |
| Receipt image stored / gallery | "See my past receipts" | Privacy risk; GDPR surface area; storage cost; image contains PII (card last-4, server name) | Image used only for OCR, never persisted; discard after extraction (already implemented in v1) |
| Proportional tax distribution | "Fairer" split including tax | Tax line already read by OCR; computing proportional tax adds a tax-entry UI step that most non-US users don't expect (VAT/GST is often tax-inclusive); per-person tip covers the "fairness" ask for v2 | Explicitly dropped per PROJECT.md; revisit in v2.1 if user demand surfaces |
| Even-split shortcut | "We all ordered the same thing" | Not an anti-feature per se, but building it as a mode adds a mode-switch decision point before users even know if they need it; complicates the scan-first flow | Show item count after scan; if 1 item with price = bill total, offer "split evenly?" CTA — single code path, not a separate mode |

---

## Feature Dependencies

```
People list (Setup)
    └──required by──> "Who are you?" modal (must have names to pick from)
    └──required by──> Per-person results (must know who's splitting)
    └──required by──> Real-time claim sync (session is keyed to people)

Scan receipt (Setup)
    └──required by──> Items list (OCR produces items)
    └──required by──> Currency recognition (symbol detected during OCR)
    └──required by──> AI abbreviation expansion (expansion requires raw OCR text)
    └──required by──> Edit / correct items (correction requires extracted output)

Currency recognition
    └──enhances──> All amount display (symbol threads through item prices, per-person totals, tip modal, results)
    └──required by──> Copy-summary message (amounts must use detected symbol)

"Who are you?" modal
    └──required by──> Claiming (app must know which person is claiming)
    └──required by──> Per-person results (must map claims to a name)
    └──enhanced by──> Auto-skip when people.length === 1

Item claiming (flat model)
    └──required by──> Unassigned items warning (warning needs claim state)
    └──required by──> Per-person subtotals (subtotals sum claimed items)
    └──required by──> Shared item splitting (shared is a variant of claim)

Per-person subtotals
    └──required by──> Tip modal (tip is split against subtotals)
    └──required by──> Results screen (results display subtotal + tip share)
    └──required by──> Copy-summary message

Flat model (host role removed)
    └──conflicts with──> Host approval / dispute queue (removed in v2)
    └──conflicts with──> "Host-only edit" permission gate (removed in v2)
    └──requires──> Unassigned items warning becomes the primary safety net
    └──requires──> Live claim attribution UI (so group can self-police)
```

### Dependency Notes

- **Currency recognition requires OCR:** The symbol (£, €, etc.) is read from the receipt at scan time. If OCR is skipped (manual entry fallback), currency must be asked explicitly or default to a neutral display (e.g. "–" prefix or bare numbers).
- **"Who are you?" requires people list:** The modal renders the names added during Setup. If Setup has 0 people added (user skipped), modal must offer an "add name" inline path or the app is stuck.
- **Flat model requires unassigned-items warning:** In v1, the host could assign leftovers. In v2, nobody is responsible. The warning is the only mechanism preventing a bill that silently undercounts.
- **Tip modal requires per-person subtotals:** Tip is distributed proportionally. Subtotals must be computed before the modal opens, so it can show "your share of tip: £3.20".

---

## Open Product Decisions (Flat Model Creates These)

These are not implementation details — they are product decisions that requirements must answer before coding begins.

### 1. Unclaimed / Leftover Items
**The problem:** In v1, the host could assign unclaimed items before locking the bill. In v2, no host exists. If users leave the table without claiming item X, the money disappears from the total.

**Options:**
- A) Block Results screen until all items are claimed (strict gate). Forces resolution but can strand a session if someone left early.
- B) Warn before Results ("3 items unclaimed — continue anyway?") and include unclaimed items as a visible line in the totals ("Unclaimed: £12.40 — assign or split evenly"). Allows forward progress.
- C) Auto-split unclaimed items evenly across all people as a default. Frictionless but silently unfair.

**Recommendation:** Option B. Show the warning prominently; present a one-tap "split unclaimed evenly" action alongside the "continue anyway" path. This matches how real groups handle it ("let's just split the leftovers").

### 2. Anyone-Can-Edit Conflicts (Two People Edit Simultaneously)
**The problem:** Without host approval, two people could edit the same item concurrently (rename "PASTA" → different names, or change price). Last-write-wins is the simplest but creates invisible overwrites.

**Recommendation:** Last-write-wins is acceptable for v2 given the real-time at-table context. Show edit attribution ("last edited by Mike") alongside the item so the group can self-correct by talking. Do NOT build an async conflict-resolution queue — that is exactly the complexity the flat model is supposed to eliminate.

### 3. Claiming Someone Else's Items
**The problem:** In a flat model, Alice can claim items for Bob (e.g. Bob is in the bathroom). This is genuinely useful — host used to do this in v1 — but creates accidental overclaims if done carelessly.

**Recommendation:** Allow it. The identity modal establishes "I am Alice on this device" but the Bill View should show claim attribution per item ("claimed by: Alice"). Bob, when he opens the link, can see Alice claimed something for him and can un-claim it. No approval queue needed.

### 4. Editing Others' Claims
**The problem:** Can Alice un-claim an item Bob has claimed? In v1 only the host could do this.

**Recommendation:** Yes — full flat model means anyone can edit any claim. Show the current claimer's name on the item. This is the social contract of the flat model: trust replaces permission gates. The at-table context makes this safe; this is not an async/untrusted-stranger scenario.

### 5. Identity Without Adding People First (Empty Setup)
**The problem:** If the person who opens the app shares the link before adding names (e.g. just scans and shares immediately), joiners arrive at "Who are you?" with an empty list.

**Recommendation:** The "Who are you?" modal must have an inline "Add my name" path when the list is empty or the user's name isn't in it. This is distinct from the Setup screen's people-add UI — it's a single-field entry inside the modal itself. The name is added to the session and the user proceeds.

### 6. Currency Detection Failure
**The problem:** OCR may not find a recognizable currency symbol (handwritten receipt, faded ink, unusual locale formatting, or receipts that show only numbers).

**Fallback behavior must be specified:**
- Display amounts with no symbol (bare numbers) — acceptable but looks unfinished
- Default to a neutral symbol and note "(currency not detected)" — clearest for the user
- Prompt user to select currency — correct but adds a setup step

**Recommendation:** Default to bare numbers with a small inline prompt "Currency detected: none — tap to set" in the Setup screen after scan. One-tap to open a short currency picker. Do not block the flow; detecting nothing is not an error, just incomplete.

---

## Edge Cases by Feature Area

### Scan-First Setup
- **User cancels scan / no photo:** Must offer manual item entry as the fallback — already exists in v1 as "Enter manually" path. In v2 this path must still be reachable from Setup without having scanned.
- **User scans then adds people:** Items are known before names. This is the happy path. Names do not affect OCR output, so the order is safe.
- **User adds people then scans:** Also valid. No dependency in either direction.
- **Gallery upload vs live capture:** Tab's #1 complaint was not being able to upload a gallery photo. The Setup screen must support both `capture="environment"` (native camera) and gallery fallback. In the current implementation this is a single `<input>` — verify that removing the `capture` attribute allows gallery selection on iOS Safari.
- **OCR produces 0 items:** Show an error state with "try again" and "enter manually" — don't strand the user on an empty item list.

### "Who Are You?" Identity Modal
- **One person in session:** Auto-skip. Assign the single person automatically and proceed directly to Bill View.
- **Zero people in session:** Show the inline "Add my name" path inside the modal. Do not redirect to Setup.
- **Name not in list:** Same — inline add within the modal.
- **Two devices claim the same name:** Allowed in flat model. Session state tracks claims by person slot, not device. If two devices both say "I am Alice," they see the same claim state and effectively share the Alice view. This is an edge case but not harmful — group will notice and correct.
- **User comes back after session expiry (>24h Redis TTL):** Show session-expired screen, not the identity modal. Already handled in v1.

### Flat Collaborative Model
- **Item edited mid-claim:** Last-write-wins. Attribution label ("edited by Alice") surfaces the change. No queue.
- **Item price changed after someone has claimed it:** Recalculate totals in real-time. The claimer sees an updated subtotal. This is correct behavior.
- **Item deleted after being claimed:** The claim becomes orphaned. Remove the orphaned claim from the claimer's subtotal. Show a toast "Item removed — your total was updated."
- **Person removed from the session after claiming:** Their claims become unclaimed items. Surface via the unassigned-items warning. Do not silently drop the money.
- **All items claimed but totals don't sum to bill total:** This can happen if OCR missed a line or a price was edited. Show a reconciliation line "Difference: £1.40" on Results rather than hiding the discrepancy.
- **Session with 1 person:** Flat model with 1 person is a degenerate case (solo recap). Works fine — identity auto-skip, all items default to that person, Results shows one row.

### Currency Recognition
- **Symbol in OCR output:** GPT-4o-mini reads the receipt holistically. Extend the extraction prompt to return `{ currency_symbol: "£" | "€" | "¥" | "₹" | null, items: [...] }`. Store `currency_symbol` in session state.
- **Conflicting symbols on same receipt:** Rare (e.g. exchange-bureau receipts). Take the symbol that appears most frequently, or the one on the total line. Flag as "detected: GBP" and allow override.
- **Symbol detected but wrong (OCR misread):** Allow user to tap the symbol anywhere it appears to override. A tap opens a 3-option currency picker (recent + "other").
- **Symbol not detected (bare numbers):** Bare number display + "tap to set currency" prompt. Does not block flow.
- **Manual entry fallback (no scan):** No symbol available. Default to bare numbers; show "set currency" prompt.
- **Copy-summary and results:** All amount rendering throughout the app must consume `currency_symbol` from session state, not hardcode "$".

---

## Feature Prioritization Matrix (v2.0 scope only)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Scan-first Setup screen (repositioned UI) | HIGH | LOW (existing camera + OCR; UI reorg) | P1 |
| "Who are you?" identity modal | HIGH | LOW (name picker modal + auto-skip logic) | P1 |
| Flat model (remove host/approval queue) | HIGH | MEDIUM (delete host-gating logic; expose edit to all) | P1 |
| Currency recognition (symbol extraction) | HIGH | LOW (prompt change + session state field + display threading) | P1 |
| Easy-billsy app shell (wordmark + hamburger) | MEDIUM | LOW (new header component; nav stubs) | P1 |
| Results screen redesign (locked breakdown + actions) | HIGH | LOW (existing totals; new layout + action buttons) | P1 |
| Tip modal (from Results screen) | HIGH | LOW (tip UI already exists; move it to a modal) | P1 |
| Unassigned-items warning as primary safety net | HIGH | LOW (already exists; elevate prominence + add "split evenly" CTA) | P1 |
| Live claim attribution per item ("claimed by: Alice") | MEDIUM | LOW (claim state already has person reference; surface in UI) | P2 |
| Currency override / picker (failure fallback) | MEDIUM | LOW (small picker component) | P2 |
| Inline "Add my name" path inside identity modal | MEDIUM | LOW (single text input inside modal) | P2 |
| "Split unclaimed items evenly" one-tap action | MEDIUM | LOW (math already exists; new CTA on warning) | P2 |
| History stub in hamburger (inert) | LOW | LOW (nav item; navigates to "coming soon" page) | P3 |
| About Us in hamburger | LOW | LOW (static page) | P3 |
| WhatsApp-ready copy message | MEDIUM | LOW (extend existing copy-summary format) | P3 |

---

## Competitor Feature Analysis (v2 context)

| Feature | LilySplit | Tab | EasyCheckSplitter | Our v2 Approach |
|---------|-----------|-----|-------------------|-----------------|
| Host role | Implicit (creator can tag on others' behalf) | Explicit host | None | None — flat model |
| Identity / "who are you?" | Not surfaced | Account-gated | None | Identity modal with auto-skip |
| Scan-first flow | Upload first, then share | Scan-first | Manual entry primary | Scan-first; inline people add after |
| Multi-currency | No (US-only / Venmo focus) | No | Likely single-currency | Yes — detect symbol from OCR |
| Real-time sync | No (async tagging) | Yes | No | Yes (unchanged from v1) |
| Unclaimed item handling | Unknown | Unknown | Unknown | Warning + "split evenly" CTA |
| Edit by non-creator | Unknown | Unknown | Local-first, no conflict model | Yes — anyone edits; attribution shown |
| Tip UX | Unknown | In-flow | Yes | Modal from Results screen |
| No-login / link-based | Yes (their headline) | Partially (account to save) | Yes | Yes (unchanged) |

---

## MVP Definition (v2.0)

### Launch With (v2.0 — this milestone)

- [ ] Easy-billsy app shell — header wordmark + hamburger (New Split / History stub / About Us)
- [ ] Scan-first Setup screen — scan receipt as hero action; inline people add below
- [ ] Currency detection — extract symbol from OCR result; thread through all amount displays
- [ ] Currency fallback — bare numbers + "tap to set" prompt; small currency picker
- [ ] "Who are you?" identity modal — name picker; auto-skip if 1 person; inline add if name missing
- [ ] Flat Bill View — remove host/approval queue; expose item editing to all; show claim attribution
- [ ] Unassigned items warning (elevated) — prominent warning + "split evenly" CTA before Results
- [ ] Results screen redesign — locked per-person breakdown; tip modal; Copy / Edit bill / New bill actions
- [ ] Tip modal (from Results) — percentage presets + custom; proportional distribution

### Add After v2 Launch (v2.1)

- [ ] Bill history — real saved splits using existing session IDs; requires UI only if sessions are stored by user token
- [ ] WhatsApp/iMessage-ready copy message — formatted per-person text block
- [ ] Even-split shortcut — post-scan CTA when all items look equal
- [ ] Tax input — proportional tip/tax split was dropped from v2; add back if user demand surfaces

### Future Consideration (v3+)

- [ ] PWA manifest + install prompt — high leverage for repeat users; one-day effort
- [ ] Privacy disclosure page — publish the data flow in plain English (image not stored, 24h TTL, etc.)
- [ ] Drinks-first claiming shortcut — Reddit pain point #1; one-tap "I didn't drink" exclude

---

## Sources

- `.planning/PROJECT.md` — confirmed v2 requirements and out-of-scope decisions
- `.planning/competitors/lilysplit.md` — async claim model, no real-time sync, no host role, US/Venmo focus
- `.planning/competitors/tab-the-simple-bill-splitter.md` — gallery upload gap (Tab pain point), account-gate churn
- `.planning/competitors/reddit-r-restaurant-bill-splitting.md` — unclaimed items behavioral context, dominant "one pays / others Venmo" default
- `.planning/competitors/easychecksplitter.md` — local-first privacy posture; privacy disclosure gap
- `.planning/competitors/README.md` — strategic themes; non-US currency as our lane
- v1.0 shipped codebase — confirmed: image not persisted, Redis text-only + 24h TTL, claim state keyed to person slot
- WebSearch: Veryfi/Mindee/OneSplit — confirmed multi-currency OCR is standard in OCR APIs (91 currencies, symbol detection); validates our approach of extracting symbol from GPT-4o-mini response
- WebSearch: SplitSnap, Scan&Split — confirm scan-first UI is standard in newer apps; validates our direction
- WebSearch: NN/G mobile onboarding — permission-at-intent (camera) and minimum-steps principle confirm scan-first Setup

---

*Feature research for: easy-billsy v2.0 bill splitter redesign*
*Researched: 2026-06-04*
