---
status: partial
phase: 12-seat-foundations-atomic-prerequisites
source: [12-VERIFICATION.md]
started: 2026-10-06T13:08:00Z
updated: 2026-10-06T13:08:00Z
---

## Current Test

Waiting on Phase 13 real-Redis harness (REL-03) — not a manual user test.

## Tests

### 1. DONE_SCRIPT / TIP_SCRIPT execute correctly on real Redis
expected: Lua scripts in lib/sessionLua.ts run against a real Redis (local redis-server via Homebrew, Phase 13): concurrent done + tip both persist; person_not_found / invalid_args returned; cjson empty-table shapes (claims, tips, items) round-trip without breaking later writes (review WR-02, WR-04)
result: partial — 2026-10-06 smoke run against the real Upstash DB via the local app (throwaway session, 24h TTL): concurrent done(pA)+tip(pB) both 200 and both persisted; ghost personId → 400 "Invalid personId: not in session"; empty-name seat with guestNumber 1 stored and read back; personSlots normalised to {}. Still pending in Phase 13: full real-Redis harness incl. WR-02 (empty items shape) and WR-04 (null people).

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

- Carry to Phase 13: review WR-01 (edit-route item ops still whole-session GET/SET can clobber done/tip — REL-01), WR-02 (empty items re-encoded as {} would break edit route), WR-04 (null people guard in Lua).
