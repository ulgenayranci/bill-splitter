---
phase: quick-260929-kyg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/split/InvitePeopleStep.tsx
  - __tests__/InvitePeopleStep.test.tsx
autonomous: true
requirements: [QUICK-260929-kyg]

must_haves:
  truths:
    - "After the link is copied, the button reads 'Copied!' and stays that way, and about 5 s later the host lands on the itemize (claiming) screen"
    - "After a successful native share, the host lands on the itemize screen immediately"
    - "If the share sheet is cancelled or fails, the link is copied instead and the 5 s auto-continue applies"
    - "Tapping Skip during the 5 s wait proceeds right away and onContinue is never called a second time"
    - "Leaving the screen during the wait cancels the pending timer (no late onContinue)"
    - "Skip / Share link buttons keep their current labels, icons and styles"
  artifacts:
    - path: "components/split/InvitePeopleStep.tsx"
      provides: "Auto-continue after copy (5000 ms) and after share success (immediate), single-fire guard, unmount cleanup"
      contains: "5000"
    - path: "__tests__/InvitePeopleStep.test.tsx"
      provides: "Fake-timer tests for copy, share success, share cancelled, Skip-during-wait (plus unmount)"
  key_links:
    - from: "components/split/InvitePeopleStep.tsx handleShare"
      to: "onContinue prop"
      via: "guarded proceed() helper (ref flag) used by Skip, share success and the copy timer"
      pattern: "proceed"
---

<objective>
Make the "Invite your group" screen move on by itself once the host has shared the link: right away after a successful native share, and 5 seconds after a successful copy (button keeps showing "Copied!"). Skip during the wait still works and never causes a double advance.

Purpose: Today the button flips to "Copied!" and the host is stranded with no obvious way forward (user report 2026-09-29).
Output: Updated `InvitePeopleStep.tsx` and fake-timer tests covering all four acceptance cases.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/quick/260929-kyg-invite-screen-auto-continue-after-share-/260929-kyg-BRIEF.md
@components/split/InvitePeopleStep.tsx
@__tests__/InvitePeopleStep.test.tsx

<interfaces>
From components/split/InvitePeopleStep.tsx (current, unchanged public API):
- `export function InvitePeopleStep({ sessionId, onContinue }: { sessionId: string; onContinue: () => void })`
- internal `copyToClipboard(): Promise<boolean>` (Clipboard API then execCommand fallback) — keep as is
- internal `flashCopied()` sets `copied=true` then reverts after 2000 ms — this revert is REMOVED
- internal `handleShare()`: tries `navigator.share({ url, title: 'Split the bill' })`, returns on success, on throw falls through to copy
- Skip button: `<Button variant="outline" onClick={onContinue} ...>Skip</Button>`
- Consumer: `app/split/[sessionId]/CollaborativeClaimingView.tsx:198` passes `onContinue={handleInviteContinue}`; do not modify the consumer.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Auto-continue after share/copy with single-fire guard (tests first)</name>
  <files>__tests__/InvitePeopleStep.test.tsx, components/split/InvitePeopleStep.tsx</files>
  <behavior>
    - Copy path (navigator stubbed with only `clipboard.writeText` resolving): after clicking Share link, button text becomes "Copied!"; after advancing 4999 ms onContinue has NOT been called; after 1 more ms it has been called exactly once; the button still reads "Copied!" after 2000+ ms (no revert).
    - Native share success (navigator stubbed with `share` resolving): after clicking Share link and flushing microtasks, onContinue called exactly once with no timer advance; advancing 10000 ms afterwards keeps it at 1.
    - Share cancelled (navigator stubbed with `share` rejecting, e.g. `new DOMException('Abort','AbortError')` or plain Error, plus `clipboard.writeText` resolving): writeText called with the /split/sess-1 URL, onContinue not called immediately, called exactly once after 5000 ms.
    - Skip during wait (copy path): click Share link, flush, advance 2000 ms, click Skip -> onContinue called once; advance 10000 ms -> still exactly once.
    - Unmount during wait (copy path): click Share link, flush, unmount, advance 10000 ms -> onContinue never called.
  </behavior>
  <action>
RED first: add the five tests above to `__tests__/InvitePeopleStep.test.tsx` inside the existing describe block. Use `vi.useFakeTimers()` at the start of each new test (or in a nested describe's beforeEach) and `vi.useRealTimers()` in afterEach. Do NOT use RTL `waitFor` with fake timers (it does not auto-advance vitest fake timers); instead flush the async click chain with `await act(async () => { await vi.advanceTimersByTimeAsync(0) })` and advance time with `await act(async () => { await vi.advanceTimersByTimeAsync(N) })` (import `act` from `@testing-library/react`). Leave the existing tests untouched (including the known-failing heading/Users icon/progress strip test). Run the file; the new copy/share/Skip-during-wait/unmount tests must fail. Commit `test(quick-260929-kyg): failing tests for invite auto-continue`.

GREEN: in `components/split/InvitePeopleStep.tsx`:
- Add `useRef` and `useEffect` to the react import.
- Add `continuedRef = useRef(false)` and `timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`.
- Add a `proceed()` helper: if `continuedRef.current` is true return; set it true; clear `timerRef.current` if set; call `onContinue()`. This is the single path to `onContinue` (brief rule 4).
- Add a `useEffect` with empty deps whose cleanup clears `timerRef.current` (brief rule 4, unmount).
- Replace `flashCopied()` with a function (e.g. `copiedThenContinue()`) that sets `copied=true` (no 2000 ms revert, brief rule 1) and schedules `timerRef.current = setTimeout(proceed, 5000)` only if no timer is already pending and not already continued (guards a double tap on Share link from scheduling two timers).
- In `handleShare`, after `await navigator.share(...)` resolves, call `proceed()` then return (brief rule 2). Keep the catch fall-through to copy unchanged (brief rule 3).
- Change the Skip button's `onClick` to `proceed` (brief rule 4). Keep all labels, icons, classNames and variants exactly as they are (brief rule 5).
- Update the component doc comment to mention the auto-continue behaviour (copy -> 5 s, share -> immediate).
Name the 5000 ms as a module constant `COPY_CONTINUE_DELAY_MS = 5000`.
Run tests; all new tests pass. Commit `feat(quick-260929-kyg): auto-continue invite screen after share or copy`.
  </action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx vitest run __tests__/InvitePeopleStep.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>InvitePeopleStep test file: all tests pass except the single pre-existing "renders the heading, Users icon, header and progress strip" failure; the 5 new tests pass; `npx tsc --noEmit` clean. Note: the vitest command exits non-zero because of that one known failure; judge by the per-test output.</done>
</task>

<task type="auto">
  <name>Task 2: Full-suite regression check</name>
  <files>(none; verification only)</files>
  <action>Run the full suite with `npx vitest run` and compare against the 15 known pre-existing failures listed in the BRIEF (AppHeader, BillViewHeader, ClaimableItemCard, CollaborativeClaimingView Test 26, InvitePeopleStep heading test, PersonResultsScreen, WizardShell). Failing count must be 15 or fewer and every failure must belong to that known set. If CollaborativeClaimingView tests that exercise the invite step now fail for a new reason (e.g. they relied on the Copied! label reverting, or on onContinue not being called after share), inspect and fix within `__tests__/` only if the failure is due to the intended new behaviour; otherwise fix the component. Record the counts in the SUMMARY.</action>
  <verify>
    <automated>cd /Users/ulgenayranci/playground/gsd-course && npx vitest run 2>&1 | tail -40</automated>
  </verify>
  <done>Full run shows no failures outside the 15 known pre-existing ones; tsc clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Client-only UI timing change; no new input, network or storage paths |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kyg-01 | Denial of Service (UX) | InvitePeopleStep timer | mitigate | Ref guard makes onContinue single-fire; timer cleared on unmount and on Skip |
</threat_model>

<verification>
- `npx vitest run __tests__/InvitePeopleStep.test.tsx`: only the known heading test fails
- `npx vitest run`: no failures beyond the 15 known
- `npx tsc --noEmit`: clean
</verification>

<success_criteria>
- Copy: "Copied!" stays, onContinue fires once at 5000 ms
- Native share success: onContinue fires immediately, once
- Share cancelled: falls back to copy, then 5000 ms rule
- Skip during wait: one call only; unmount cancels timer
- Buttons, labels, styles unchanged
</success_criteria>

<output>
Create `.planning/quick/260929-kyg-invite-screen-auto-continue-after-share-/260929-kyg-SUMMARY.md` when done
</output>
