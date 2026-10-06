# Feature Landscape

**Domain:** Headcount + empty-seat claiming for a flat, anonymous, receipt-scanning bill splitter (v2.1 "Faster people setup")
**Researched:** 2026-10-06
**Overall confidence:** MEDIUM. Web search confirmed only the general pattern (Tab-style real-time join and claim, calculators with "number of people" plus optional names). Specific seat-claim UX conventions come from pattern knowledge of equal-split calculators, Tab/Splitwise-style invites, and ticketing/seat pickers, so they are marked LOW to MEDIUM. No competitor was found that does exactly "headcount of anonymous seats, joiner picks any seat". This makes the feature mildly novel, so design from first principles and from the existing code.

Scope: only what the new features need. Locked decisions are respected. Conflicts are flagged, not overturned.

## Table Stakes

Missing any of these makes the feature feel broken.

| Feature | Why Expected | Complexity | Notes / Dependency on existing |
|---------|--------------|------------|--------------------------------|
| Headcount -/+ counter on Setup | Equal-split calculators all lead with a "number of people" stepper. | Low | Replaces the typed people list. Counter state must reconcile with the existing inline add-person list. Persist to the session so the share link sees N seats. |
| Default count: prefill from OCR guest count (Pax/Covers/Guests), else 2 | The prefill is locked. A fallback is needed when OCR finds nothing. 2 is the common calculator default and the minimum for "splitting". | Med (OCR/AI prompt extension) | Extends the GPT-4o-mini vision response schema with a nullable `guestCount`. Validate it as an integer in range. Treat 0, 1, and implausible values (more than the max) as "not found", so a printed table number such as "Table 24" is never mistaken for a guest count. Prefill is editable and never blocks. |
| Bounds: min 1, max about 20 (suggest 30 hard cap) | Without bounds, bad OCR or a stuck button creates a huge seat list. Min 1 allows a solo or one-person scan; the scanner always occupies a seat. | Low | The counter must not go below the number of seats that are named or hold claims. On Setup only the scanner is named, so the floor is 1. On the live Bill View the floor is "non-empty seats". Disable the minus button instead of showing an error. |
| Scanner is seat 1, named, auto-identified | The scanner types her own name and is identified on her device. Skipping the "Who are you?" modal for her avoids a redundant step. | Low | Hooks into the existing persisted identity (IDENT). Her seat is never "empty". |
| Seat labels for empty seats: "Seat 2", "Seat 3" ... (stable numbering) | Anonymous placeholders need distinct labels in the picker, chips, and results. "Guest 2" also works, but "Seat" matches the product language. | Low | Number from a monotonically increasing seat id so the label never shifts when another seat is removed. If a seat is removed, do not renumber others. Gaps are acceptable. Renumbering would break chips and claims. A counter on the session (`nextSeatNo`) is needed. |
| Joiner sees a seat picker: empty seats listed, claimed seats shown with their names | A joiner must see the whole table to know who is who. This extends the existing "Who are you?" modal from a list of people to a list of seats. | Med | Reuses the identity modal. Empty seats are tappable, so tapping one prompts for a name (pre-focused input, native keyboard). Named seats remain selectable, per the "flat model, names always selectable, concurrent same-name editing" memory. |
| "+ I'm not listed" adds a seat and claims it | Locked. This is the escape hatch when the headcount was too low. | Low | Already exists as an IDENT feature; it now creates a seat plus a name in one step. Ensure atomicity (single Lua or transaction call) to avoid duplicate seats from double taps. |
| Seat name entry validation: trimmed, non-empty, length cap (about 24 chars) | Prevents blank labels and layout breaks at 375px. | Low | Reuse the rename-person validation (PART-03..05). |
| Name collisions: allow, never block, but disambiguate in display | Flat model: no locking, concurrent same-name editing, and the existing decision stays. Two "Sam"s at one table is real. | Low to Med | Do not reject duplicates. Display suffix only when two seats share a name (case-insensitive): "Sam", "Sam (2)", ordered by seat number. Keys and claims use the seat id, never the name. Verify that existing code does not key anything by name. Concurrent claiming of the same seat by two phones is the one case where the flat model silently merges identity. Accept it, consistent with the locked no-lock decision. |
| Empty seats pay an equal share of tax and service (locked) | Seats count as people for the equal tax and service portion. | Med | Extends the Results math. Tax is split equally across ALL seats (named plus empty). Per-person tip is unchanged. This must be money-safe: shares sum exactly to the bill, with remainder cents distributed deterministically (reuse the `computeQtyWeightedShares` rounding approach). Depends on the "tax split equally" rule already in memory. |
| Empty-seat display in Results: listed as "Seat 3" rows with their equal share of tax and service, visibly marked unclaimed/unnamed | If these rows vanished, the totals would not add up and the table would be confused about who owes the leftover. The existing unclaimed-items callout is the precedent. | Med | Show the empty seat as a normal row with a muted style and a label such as "Seat 3, no name yet". Their amount is only the tax and service share, since they have no claimed items. Copy output must include them. A short footnote such as "Seats with no name still share tax/service" would reduce confusion. |
| Live add seat (anyone) on the Bill View | Locked. Late arrivals and miscounts happen. | Low | Calls a seat-add action on the session. All connected clients pick up the new seat via the existing polling or realtime. |
| Live remove seat only while empty (no name, no claims), anyone | Locked. A fat-finger add and a headcount over-estimate are common. | Med | The removal check must be server-side and atomic. Between "empty" being displayed and the tap, someone may have claimed it. Return a clear "Seat was just taken" response and refresh. This is the same class as the Critical Lua findings from the earlier live-remove-person descope. Keep the scope strictly "empty only" and write an execution test. Note the earlier descope was about people with claims, which is a different, harder case. |

## Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| OCR-prefilled headcount from the printed guest count | Most competitors make you type or count. This is the "fast" in "Faster people setup". | Med | Already locked as table stakes for the milestone. It is a differentiator versus the market. |
| Zero-typing setup for N-1 friends | Friends type only their own name on their own phone. | Low (falls out of the design) | The core product value. Names get captured by the people who know them. |
| Seat picker sorts empty seats first, claimed names after | Joiner finds a free seat without scanning a long list. | Low | Pure presentation. Highlight "Seat N" rows as the primary tap target. |
| Remember the chosen seat on the device (already in IDENT) | Reopening the link goes straight to the Bill View. | Low | Existing no-nag identity persistence applies. Confirm that it stores the seat id, not the label. |
| Equal tax/service share for empty seats appears live in the totals | Everyone sees the share dropping as more seats are added. | Low | Falls out of reactive math. Optional. |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| "N seats still empty" nudge or banner | Explicitly out of scope (locked). | Trust the group. Only the neutral Results marking of unnamed seats. |
| Host role, seat approval, or "kick" | Contradicts the flat model. | Anyone can add; anyone can remove empty seats only. |
| Locking a seat after a name is typed | Contradicts the locked no-name-locking decision. | Names stay selectable. Collisions are tolerated and disambiguated visually. |
| Removing named or claiming seats live | Prior descope (Lua findings, no test). | Keep rename only. Direct people to the Setup screen remove. |
| Blocking duplicate names | Real tables have duplicates and blocking adds friction. | Display disambiguation "(2)". |
| Auto-trusting an implausible OCR guest count | A bad prefill creates a wrong number of seats for every friend. | Plausibility range, with fallback to the default. Always editable. |
| Renumbering seats on removal | Breaks chips and claims for other viewers. | Stable seat ids and numbers. |
| Seat-count per-seat avatars, colors, or emoji | Scope creep. | Plain text labels. |
| Venmo or payment requests per seat | Out of scope, not the market. | None. |

## Feature Dependencies

```
OCR guestCount extraction (nullable) -> Setup headcount prefill
Headcount counter -> seat records created on session (ids + nextSeatNo)
Seat records -> "Who are you?" seat picker -> name-a-seat flow
Seat records -> live add seat / remove empty seat (server-atomic check)
Seat records (all seats, incl. empty) -> equal tax/service split in Results math
Equal tax/service split -> Results empty-seat rows + Copy output
Existing rename-person (PART) -> reuse for naming a seat
Existing identity persistence (IDENT) -> store seat id; scanner auto-identified
```

## Conflicts and flags (not overturning locked decisions)

1. **Empty-seat equal tax and service share versus "no nudge".** Consistent, but the Results screen is the only place a group learns seats were left unnamed. Showing unnamed rows without any prompt is a neutral display, not a nudge. Keep the copy wording informational.
2. **Same-seat double claim.** Two friends picking the same empty seat at once will merge into one identity (flat model, no lock). This is accepted by locked decisions. Make sure the name-entry step gives last-write-wins semantics deterministically, and does not crash.
3. **Counter on Setup versus live seat management.** Two entry points edit the same seat list. Use one data model (seat array) and one set of actions to avoid drift.
4. **Remove-empty race.** The one genuinely risky item. It needs an atomic server-side "remove if empty" and a test, given the prior Lua findings.
5. **Previous PROJECT.md note: tax was dropped from v2.0** ("tax cut from v2") but the v2.1 spec and memory ("tax split equally") assume a tax value exists. Confirm that tax and service inputs exist in current Results before building the equal-share math. Otherwise this requirement needs an input, not just the split.

## MVP Recommendation

Prioritize, in order:
1. Seat data model (stable ids, nextSeatNo) plus headcount counter with min/max and default 2.
2. Scanner as seat 1, auto-identified. Seat-picker modal with "Seat N" labels, naming, and "+ I'm not listed".
3. Equal tax/service across all seats in the Results math, with empty-seat rows and Copy output.
4. Live add seat, then live remove empty seat (atomic plus tested).
5. OCR guest-count extraction with plausibility guard. This can ship last, because the counter works without it using the default.

Defer: avatars or colors, seat reordering, removal of named seats (prior descope), any nudge.

## Sources

- [Tab: The simple bill splitter](https://apps.apple.com/us/app/tab-the-simple-bill-splitter/id595068606): real-time join and claim from the same bill (MEDIUM)
- [SplitMyExpenses](https://www.splitmyexpenses.com/): invite-link group join (MEDIUM)
- [Split Bill Calculator](https://splitbillcalc.com/) and [Ventrips Split Bill](https://ventrips.com/calculator/split-bill): "number of people" stepper plus optional names (MEDIUM)
- `.planning/PROJECT.md` v2.1 milestone and Key Decisions (HIGH, project source)
- Seat-label, bounds, collision, and race recommendations: design judgment from common patterns (LOW, validate in design review at 375px)
