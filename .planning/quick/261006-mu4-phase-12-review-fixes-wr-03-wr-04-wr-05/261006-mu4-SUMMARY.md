---
status: complete
---
# 261006-mu4: Phase 12 review fixes (WR-03, WR-04, WR-05)

From .planning/phases/12-seat-foundations-atomic-prerequisites/12-REVIEW.md.
- WR-03 lib/seats.ts: fallbackGuestNumbers() gives unnumbered empty seats the smallest numbers not stored on anyone (people order); seatLabel and nextGuestNumber both use it → labels unique in mixed v2.0/new sessions. Test "ignores invalid values" now expects 3 (seats with invalid numbers are Guest 1/2) — intended behaviour change.
- WR-04 lib/sessionLua.ts: DONE/TIP return 'invalid_session' if people isn't a table; skip non-table entries.
- WR-05 lib/seats.ts: seatInitial uses toUpperCase() and keeps one code point.
- Header comment now states /edit item ops can still clobber done/tip (WR-01 → Phase 13, REL-01). WR-02 also → Phase 13.
- Tests 646/646, tsc clean; real-DB smoke (local app → Upstash): concurrent done+tip 200 and both persisted, ghost 400. Commit 984515c.
