# Brief: Invite screen auto-continue

Source: user request in chat, 2026-09-29, on the "Invite your group" screen (`components/split/InvitePeopleStep.tsx`, rendered by `app/split/[sessionId]/CollaborativeClaimingView.tsx:198` with `onContinue={handleInviteContinue}`).

User's words: *"on this page after link copied the button says copied but then there is no proceed to the itemize screen. so after the button says copied delay for 5 seconds and proceed to the next screen"*
User decision (asked): when the link is shared through the native share sheet, **go to the itemize screen right away**.

## Change
1. **Copy path:** when `copyToClipboard()` succeeds, show "Copied!" and keep it (do not revert after 2s), then call `onContinue()` after **5000 ms**.
2. **Native share path:** when `navigator.share()` resolves successfully, call `onContinue()` immediately.
3. If the share sheet is cancelled or fails, keep today's fallback to copy (which then follows rule 1).
4. Clear the pending timer on unmount, and don't call `onContinue` twice (e.g. if the user taps Skip during the 5 s wait, Skip proceeds immediately and the timer must not fire a second call).
5. Keep the existing buttons, labels and styles.

## Acceptance
- Copy: button reads "Copied!" and about 5 s later the claiming (itemize) screen shows, with `onContinue` called exactly once.
- Native share success: `onContinue` is called immediately.
- Share cancelled: falls back to copy, then rule 1 applies.
- Skip during the wait: proceeds once, with no second call.
- Unit tests with fake timers in `__tests__/InvitePeopleStep.test.tsx` cover all four cases. That file already has 1 pre-existing unrelated failure ("renders the heading, Users icon, header and progress strip"), which is not a regression. The full run has 15 known pre-existing failures (AppHeader, BillViewHeader, ClaimableItemCard, CollaborativeClaimingView Test 26, InvitePeopleStep heading test, PersonResultsScreen, WizardShell).
