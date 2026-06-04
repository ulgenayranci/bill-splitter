# Phase 7: App Shell + Setup Screen - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 7-App Shell + Setup Screen
**Areas discussed:** Currency field shape, Continue destination, Scan vs manual/gallery, Menu behavior

---

## Currency field shape (CURR-01)

| Option | Description | Selected |
|--------|-------------|----------|
| ISO code + Intl | OCR returns ISO 4217 (EUR/JPY); Intl.NumberFormat. Disambiguates $, handles zero-decimal currencies | ✓ |
| Raw symbol prefix | OCR returns symbol (€/£), prefixed. Simpler but can't disambiguate $ or format JPY | |
| You decide | Claude's discretion | |

**User's choice:** ISO code + Intl.NumberFormat
**Notes:** Supersedes the roadmapper's earlier "raw symbol" lean. Phase 7 = detection + store only; display threading + failure fallback are Phase 10.

---

## Continue destination

| Option | Description | Selected |
|--------|-------------|----------|
| Bridge to existing flow | Continue → current Assign/claiming flow; app usable end-to-end through reassess gate | ✓ |
| Wire but stub | Continue → placeholder screen; app non-functional between Phases 7–9 | |
| You decide | Claude's discretion | |

**User's choice:** Bridge to existing flow
**Notes:** Keeps the app testable at the reassess gate. Bridge target = AssignItemsStep; replaced by Bill View in Phase 9.

---

## Scan vs manual / gallery

| Option | Description | Selected |
|--------|-------------|----------|
| Manual add + gallery | Keep manual entry fallback + allow existing-photo upload | |
| Manual add only | Camera + manual entry (current), no gallery | |
| Scan only (camera) | Strictly scan-first; no manual, no gallery | ✓ |

**User's choice:** Scan only (camera)
**Notes:** Cleanest scan-first. Consequence flagged: Retake is the only OCR-failure recovery; planning must avoid a dead-end on failed scans. No editable item list on Setup → item fixes arrive in Phase 9.

---

## Menu behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled, privacy deferred | History + About Us greyed/disabled; privacy stays its own deferred todo | ✓ |
| About Us hosts privacy now | Build minimal About Us with privacy disclosure; folds the todo | |
| 'Coming soon' tap states | Tappable items show coming-soon; privacy deferred | |

**User's choice:** Disabled, privacy stays deferred
**Notes:** Privacy-disclosure todo reviewed (matched 0.6) but NOT folded into Phase 7.

---

## Claude's Discretion

None — all four areas were decided explicitly.

## Deferred Ideas

- "Who are you?" identity modal → Phase 9
- Currency display threading + detection-failure fallback → Phase 10
- Manual entry / gallery upload → dropped (revisit only if scan-only proves fragile)
- Bill history (History menu feature) → v2.1+
- Privacy disclosure todo → remains deferred (not folded)
