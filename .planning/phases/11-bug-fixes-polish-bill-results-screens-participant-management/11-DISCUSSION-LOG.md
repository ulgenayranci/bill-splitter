# Phase 11 Discussion Log

**Date:** 2026-06-09
**Mode:** discuss (default, interactive)

> Human-reference record of the discussion. Not consumed by downstream agents (they read 11-CONTEXT.md).

## Source
Post-v2.0 UAT bug list reported by user 2026-06-08 (5 items). v2.0 milestone reopened to add this phase.

## Codebase scout findings (key)
- Receipt button (`BillViewHeader.tsx:121-127`) is a no-op; the scanned image is **not** persisted to the shared session (only in the scanner's local store) — guests can't see it.
- Share/Receipt buttons are bare 22px icons, no padding.
- Unclaimed detection already exists (`getUnclaimedCounts`, `UnclaimedBanner`) — reusable on Results.
- No `remove_person` / `rename_person` API ops exist; claims are keyed by personId.
- Tip is a faint text link; currency is an inline `<select>` dropdown — both on the Results screen (not the bill screen as the user phrased it).

## Questions & answers

### Q1 — Receipt button
Options: Remove it for now / Build it properly (cloud image storage) / Show only to scanner.
**Answer: Remove it for now.** Rationale surfaced: image isn't stored server-side, so a full feature is large; defer it.

### Q2 — Unclaimed-state message tone
Options: Friendly nudge / Clear & direct / Playful.
**Answer: Playful** (e.g. "Hold up — N items are still up for grabs!").

### Q3 — Removing a person who has claimed items
Options: Items become unclaimed again / Block until items cleared.
**Answer: Items become unclaimed again.**

### Q4 — Tip & currency layout
Options: "Yes, do that" (prominent tip button + small currency link under total) / "Let me describe it".
**Answer: Let me describe it →** user then said: **remove the currency edit control entirely for now.** Reason: a currency control "makes me feel like it will exchange the currency, not correct the scan." Will validate with user feedback before re-adding. Tip still promoted to a prominent button.

## Confirmed assumptions (participant management)
- Anyone can remove/rename anyone (flat, no-name-locking model).
- Rename = inline name edit.
- Remove/rename are shared writes → update for all participants live.
User confirmed: "yes".

## Deferred ideas
- Receipt viewing for all participants (needs server-side image storage) — own future phase.
- Currency-correction control — revisit if users request it; frame as "fix scanned currency," not a converter.
