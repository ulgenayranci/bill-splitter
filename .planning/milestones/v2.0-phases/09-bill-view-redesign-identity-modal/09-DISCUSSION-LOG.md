# Phase 9: Bill View Redesign + Identity Modal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 9-Bill View Redesign + Identity Modal
**Areas discussed:** Identity modal behavior, Live attribution look, Unclaimed-items warning, Sharing & quantity stepper

---

## Identity modal behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Taken names greyed out (Recommended) | Once picked on a phone, nobody else can pick it; matches current picker | ✓ |
| Anyone can pick any name | No locking; two phones could be the same person | |
| Greyed out + "that's me" override | Takeover flow for switched-phone case | |

**User's choice:** Taken names greyed out

| Option | Description | Selected |
|--------|-------------|----------|
| Added for everyone instantly (Recommended) | "I'm not listed" name joins the shared bill immediately | ✓ |
| Added only after they claim something | Stays local until first claim | |

**User's choice:** Added for everyone instantly

| Option | Description | Selected |
|--------|-------------|----------|
| Tap your own pill (Recommended) | Tapping your highlighted pill reopens the modal | |
| Tap anywhere on the strip | Any tap on the people row opens the modal | ✓ |
| Strip is display-only | Identity change lives elsewhere | |

**User's choice:** Tap anywhere on the strip
**Notes:** User initially paused the question to share a design screenshot of the Bill View header (bill title + date, people strip with own identity as expanded highlighted pill, others as compact colored avatar circles with +N overflow, receipt + share icons right). Screenshot copied to `09-design-bill-view-header.png`. The question was reformulated around the screenshot.

| Option | Description | Selected |
|--------|-------------|----------|
| Claims stay with the old name (Recommended) | Wrong-name claims fixed manually by un-claim/re-claim | ✓ |
| Claims move with you | Auto re-assign on identity switch | |
| Ask at switch time | Prompt to keep or bring claims | |

**User's choice:** Claims stay with the old name

---

## Live attribution look

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar chips on the card (Recommended) | Colored initial-circles matching the header strip | ✓ |
| Name text | "claimed by Alice" text under item name | |
| Chips + name text | Both; busiest | |

**User's choice:** Avatar chips on the card

| Option | Description | Selected |
|--------|-------------|----------|
| Highlighted card + your chip (Recommended) | Amber border/tint on your items + your chip | ✓ |
| Just your chip, no highlight | Egalitarian, quieter | |
| "You" label on your chip | Breaks color-matching | |

**User's choice:** Highlighted card + your chip

| Option | Description | Selected |
|--------|-------------|----------|
| Show up to 3, then +N (Recommended) | Matches the header strip pattern | ✓ |
| Show all chips, wrap if needed | Full transparency, taller cards | |

**User's choice:** Show up to 3, then +N

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle — chips just appear (Recommended) | Updates show on next poll, no fanfare | ✓ |
| Brief highlight flash | Newly-claimed item pulses | |
| Toast notification | "Mike claimed Fries" popup | |

**User's choice:** Subtle — chips just appear

---

## Unclaimed-items warning

| Option | Description | Selected |
|--------|-------------|----------|
| Warn but allow (Recommended) | "I'm done" warns with "Continue anyway" escape | ✓ |
| Hard block until claimed | Results unreachable while items unclaimed | |
| Silent — just show a list section | No interruption at all | |

**User's choice:** Warn but allow

| Option | Description | Selected |
|--------|-------------|----------|
| Counter banner at top (Recommended) | "4 of 12 items still unclaimed", live, tap scrolls | ✓ |
| Unclaimed section pinned on top | Grouped list; items jump around | |
| Visual style only | Dashed border, no banner | |

**User's choice:** Counter banner at top

| Option | Description | Selected |
|--------|-------------|----------|
| Header icon + warning CTA (Recommended) | Persistent share icon + share CTA inside the warning | ✓ |
| Header icon only | Cleaner dialog, misses the rescue nudge | |
| Warning CTA only | Sharing only surfaces on unclaimed warning | |

**User's choice:** Header icon + warning CTA

| Option | Description | Selected |
|--------|-------------|----------|
| Straight to your results (Recommended) | Own breakdown immediately; waiting-screen gate removed | ✓ |
| Waiting screen stays | "Continue anyway" still parks on waiting | |

**User's choice:** Straight to your results

---

## Sharing & quantity stepper

| Option | Description | Selected |
|--------|-------------|----------|
| Both tap it — auto equal split (Recommended) | Tap to join sharers, equal division, tap again to leave | ✓ |
| Explicit "Share this" mode | Picker to choose sharers; against flat model | |
| Portion stepper on every item | Dial your fraction; fiddly | |

**User's choice:** Both tap it — auto equal split

| Option | Description | Selected |
|--------|-------------|----------|
| Keep stepper as-is (Recommended) | Phase 6 stepper unchanged for qty>1 items | ✓ |
| Also allow splitting one unit | Co-owning a single unit out of N; confusing | |

**User's choice:** Keep stepper as-is

| Option | Description | Selected |
|--------|-------------|----------|
| You decide (Recommended) | Claude picks a deterministic leftover-cent rule | ✓ |
| First sharer absorbs the extra cent | First claimant pays the extra cent | |
| Round everyone up | Table slightly overpays | |

**User's choice:** You decide (odd-cent rounding delegated to Claude)

| Option | Description | Selected |
|--------|-------------|----------|
| Show your share (Recommended) | Full price + "your share: $X.XX" once joined | ✓ |
| Full price only | Per-person amounts only on results | |
| Everyone's share listed | Tall cards, redundant | |

**User's choice:** Show your share

---

## Claude's Discretion

- Odd-cent rounding rule for equal splits (deterministic; shares must sum to the item price exactly)
- Identity modal visual design (within existing shadcn/ui dialog + current styling)
- Exact banner/warning copy

## Deferred Ideas

- Identity takeover flow ("that's me on another device")
- Claim-activity animations/toasts
- Edit attribution ("edited by X") — carried from Phase 8
- Privacy disclosure todo — reviewed (weak 0.4 match), stays deferred as in Phases 7 & 8
