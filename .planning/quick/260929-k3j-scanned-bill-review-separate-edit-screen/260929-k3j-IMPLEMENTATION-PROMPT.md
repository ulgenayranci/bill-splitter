You are implementing a UX/UI change brief for easy billsy (Next.js + Tailwind v4 + shadcn, Zustand store).
Make only the changes below. Do not redesign anything not listed. Use existing tokens and
`components/ui/button.tsx` variants (see `UI-SPEC.md`); do not invent new ones. Mobile (375px) only.
Work in priority order. Decisions settled: Retake + Edit use `variant="outline"`; the edit screen exits via one "Done" button at the bottom.

## Design system / constraints
- Button variants: `default` = the one coral primary CTA per screen; `outline` = secondary actions.
- Keep the two-row item editing layout from commit 711dc36 (name on its own full-width row).
- Progress strip stays 3 segments; the new screen counts as Setup.

## Tasks (priority order)

### 1. Separate "edit scanned items" screen · high · effort L · setup step / mobile
Target: `components/wizard/SetupStep.tsx` (review block `data-testid="scan-review"` ~:374–460; photo card + Retake ~:474–508), `stores/useBillStore.ts`, `components/wizard/WizardShell.tsx`, `app/page.tsx`
Change:
- Remove the yellow scan-review block from the setup step.
- Create a new screen containing the same controls: per-item name (full-width row) / price / qty / delete, Add item, and the live "Items add up to … · Receipt subtotal … · off by …" line. Move the existing `reviewDrafts`/`commitRow` logic; don't rewrite it.
- The photo card becomes the **scanned bill review container** (name it in a comment or `data-testid="scanned-bill-review"`). Under the photo, a row with **Retake** and **Edit** side by side at the right, both `<Button variant="outline">` (Retake changes from a text link to this button). Retake keeps its current behaviour (reset guardrail and open the file picker). Edit opens the new screen.
- After a scan whose items don't reconcile to the receipt target (the current `reviewMode` condition), navigate to the new screen automatically. Clean scans stay on setup.
- The new screen ends with a single "Done" button at the bottom (the screen's one primary CTA, `default` variant) that returns to setup. Edits persist to the store.
Acceptance: see brief.md Issue 1 acceptance check (375px).
Source: review-20260929-scanreview:dictated_001, 2501a54c-43fb-4c90-8678-1d6a0a4ecb25:note_002, draw_001–draw_020

### 2. Double the receipt photo height · medium · effort S
Target: `components/wizard/SetupStep.tsx:481` (the "View bill photo" button)
Change: `h-24` → `h-48` (96px → 192px). Keep `object-cover`, the badge and the lightbox.
Acceptance: the frame is 192px tall at 375px, and tapping it still opens the full photo.
Source: review-20260929-scanreview:dictated_002

### 3. Edit screen survives refresh · medium · effort M
Target: `stores/useBillStore.ts` (persisted `easy-billsy-bill`), SetupStep guardrail state
Change: persist the receipt target total and the mismatch flag with the bill, so a refresh on the edit screen returns there with the off-by line intact. Retake / new scan must clear them.
Acceptance: refreshing on the edit screen after a mismatched scan restores the same screen, items and off-by line.
Source: AI proposal in chat (no user objection)

## Do not
- Do not change the people section, the Continue/Confirm CTA, or the split screen.
- Do not add a 4th progress segment.
- Update tests that assert the old in-page review block (`data-testid="scan-review"` in `__tests__/SetupStep*.test.tsx`), and add tests for: auto-open on mismatch, Edit button, and returning to setup. Run `npx vitest run` and `npx tsc --noEmit`. 15 unrelated tests already fail on main; don't count those as regressions.
