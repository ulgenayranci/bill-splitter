# Quick 260929-kyg: Invite screen auto-continue Summary

InvitePeopleStep now advances by itself: immediately after a successful native share, and 5000 ms after a successful copy ("Copied!" stays). A single-fire `proceed()` guard (ref) is used by Skip, share success and the timer; the timer is cleared on unmount.

Commits: 4d8cbc0 (RED tests), fcf70f3 (implementation).

Files: components/split/InvitePeopleStep.tsx, __tests__/InvitePeopleStep.test.tsx (5 new fake-timer tests).

Verification: InvitePeopleStep file 9 pass / 1 known failure; full suite 15 failed (all the known set) / 372 passed; tsc clean.

Deviations: none.
