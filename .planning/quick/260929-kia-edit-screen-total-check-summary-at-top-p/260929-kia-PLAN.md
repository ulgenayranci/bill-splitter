---
phase: quick-260929-kia
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/wizard/ScanItemsEditor.tsx
  - __tests__/ScanItemsEditor.test.tsx
autonomous: true
requirements: [QUICK-260929-kia]

must_haves:
  truths:
    - "When the live items sum is outside TOLERANCE_CENTS of the receipt target, the heading reads \"Your items don't match the receipt\""
    - "When the live gap is within tolerance, or there is no receipt target, the heading reads \"Edit scanned items\""
    - "The total-check summary (data-testid=scan-review-gap) renders directly under the heading, above the item list"
    - "Summary primary line reads \"Off by <amount>\" in text-warn when mismatched, and \"Matches the receipt\" in neutral zinc styling when within tolerance"
    - "Summary secondary line reads \"Receipt subtotal <target> · Your items <sum>\" (\"total\" instead of \"subtotal\" when scanCheck.hasSubtotal is false), smaller and muted"
    - "With targetCents == null no summary renders; item list, Add item and Done order below is unchanged"
  artifacts:
    - path: "components/wizard/ScanItemsEditor.tsx"
      provides: "Problem-stating heading derived from live gap + summary card above item list"
      contains: "Your items don't match the receipt"
    - path: "__tests__/ScanItemsEditor.test.tsx"
      provides: "Tests for heading states, summary text/classes, and DOM order"
      contains: "Matches the receipt"
  key_links:
    - from: "heading + summary in ScanItemsEditor.tsx"
      to: "liveDeltaCents / TOLERANCE_CENTS"
      via: "single derived boolean (e.g. isOff = targetCents != null && Math.abs(liveDeltaCents) > TOLERANCE_CENTS)"
      pattern: "Math\\.abs\\(liveDeltaCents\\) > TOLERANCE_CENTS"
---

<objective>
Restructure the edit-scanned-items screen (store step 2) so the reason it opened is visible first: a problem-stating heading derived from the LIVE gap, followed immediately by a total-check summary card, then the unchanged item list, Add item, and Done.

Purpose: Implements the user-confirmed direction in 260929-kia-BRIEF.md (Issue 1). The "off by" line is currently a small line at the bottom that users only see after scrolling.
Output: Updated ScanItemsEditor.tsx and its tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/quick/260929-kia-edit-screen-total-check-summary-at-top-p/260929-kia-BRIEF.md
@components/wizard/ScanItemsEditor.tsx
@__tests__/ScanItemsEditor.test.tsx

<interfaces>
Already imported in ScanItemsEditor.tsx (reuse, do not add new helpers or tokens):
- TOLERANCE_CENTS = 2 from '@/lib/reconcileScannedBill'
- formatCents(cents: number, currencyCode?: string): string from '@/lib/billMath' (no currencyCode -> '$X.XX')
- Existing locals: liveSumCents, targetCents (scanCheck?.targetCents ?? null), liveDeltaCents (targetCents - liveSumCents, or 0), currencyCode, scanCheck.hasSubtotal
- Store: scanCheck shape { correctedCount, mismatch, targetCents, hasSubtotal } set via useBillStore.getState().setScanCheck(...)

Current test seed: items Widget $10.00 + Fries $4.00 = $14.00, target $15.00, hasSubtotal true, mismatch true. Test "editing a price" sets Widget to 11.00 -> sum $15.00 (delta 0).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Update tests for new heading and top summary card (RED)</name>
  <files>__tests__/ScanItemsEditor.test.tsx</files>
  <behavior>
    - Mismatched seed ($14.00 vs $15.00): heading (getByRole('heading', { level: 1 })) text is "Your items don't match the receipt".
    - Mismatched seed: scan-review-gap textContent contains "Off by $1.00", "Receipt subtotal $15.00", and "Your items $14.00"; the element carrying "Off by" has class text-warn.
    - DOM order: the scan-review-gap element comes after the h1 and before the first "Item name" input (use compareDocumentPosition with Node.DOCUMENT_POSITION_FOLLOWING).
    - After editing Widget price to 11.00 and blurring: gap textContent contains "Matches the receipt", does NOT contain "Off by", the primary line does not have text-warn; heading becomes "Edit scanned items".
    - hasSubtotal false variant (setScanCheck with hasSubtotal: false, mismatch false, targetCents 1500): secondary line says "Receipt total $15.00"; heading is still "Your items don't match the receipt" because it derives from the live gap, not scanCheck.mismatch.
    - Clean scan (targetCents 1400 matching the $14.00 sum, mismatch false): heading "Edit scanned items" and summary shows "Matches the receipt".
    - No scanCheck (seed(false)): no scan-review-gap element; heading "Edit scanned items".
  </behavior>
  <action>
    Rewrite the assertions in __tests__/ScanItemsEditor.test.tsx to match the behavior block. Keep the existing seed helper, but extend it with an optional scanCheck override (e.g. seed(check?: Partial<ScanCheck> | false)) so the hasSubtotal-false and clean-scan cases can be seeded without duplicating setup. Replace the old "off by $0.00" assertion (that text no longer exists; within tolerance shows "Matches the receipt"). Keep the Add/Remove and Done tests unchanged. Query the heading by role, not by text, because the region's aria-label is also "Edit scanned items". To check the warning colour, give the primary and secondary lines their own data-testids inside the summary (scan-review-gap-primary, scan-review-gap-detail) and assert on className containing text-warn / not containing it. Run the test file and confirm the new assertions fail against the current component (RED).
  </action>
  <verify>
    <automated>npx vitest run __tests__/ScanItemsEditor.test.tsx (expected to FAIL on new heading/summary assertions before Task 2)</automated>
  </verify>
  <done>Test file encodes every acceptance-check bullet from the BRIEF; new assertions fail against the unmodified component; Add/Remove and Done tests still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Move total check to top as summary card and derive heading from live gap (GREEN)</name>
  <files>components/wizard/ScanItemsEditor.tsx</files>
  <behavior>
    - All tests in __tests__/ScanItemsEditor.test.tsx pass.
  </behavior>
  <action>
    In ScanItemsEditor.tsx, add one derived boolean after liveDeltaCents: isOff = targetCents != null and Math.abs(liveDeltaCents) > TOLERANCE_CENTS. Heading h1 (keep its existing text-[18px] font-semibold text-zinc-900 classes) renders "Your items don't match the receipt" when isOff, otherwise "Edit scanned items". Stop reading scanCheck.mismatch for the heading (brief: base it on the live gap so it flips after the user fixes items). Leave the region's aria-label "Edit scanned items" as-is.

    Delete the bottom paragraph and render the summary directly after the h1 and before the item ul, only when targetCents != null. Summary element is a div with data-testid="scan-review-gap" (must stay on the summary container), styled as a small card using existing classes only (e.g. rounded-md border border-border bg-white px-3 py-2 flex flex-col gap-0.5). Inside it:
    - Primary line (data-testid="scan-review-gap-primary"): when isOff, "Off by " + formatCents(Math.abs(liveDeltaCents), currencyCode) with classes text-[16px] font-semibold text-warn; otherwise "Matches the receipt" with text-[16px] font-semibold text-zinc-900 (neutral, no warn).
    - Secondary line (data-testid="scan-review-gap-detail"), text-[13px] text-zinc-500: "Receipt " + ("subtotal" if scanCheck?.hasSubtotal else "total") + " " + formatCents(targetCents, currencyCode) + " · Your items " + formatCents(liveSumCents, currencyCode). Use the literal middle dot with spaces as in the existing line.

    No new colour tokens, no new helpers, no new imports. Item list, Add item button and the Done footer stay in the same order and unchanged. Update the file's doc comment to mention the top summary card.
  </action>
  <verify>
    <automated>npx vitest run __tests__/ScanItemsEditor.test.tsx</automated>
  </verify>
  <done>ScanItemsEditor test file passes fully; heading and summary behave per BRIEF acceptance check; data-testid="scan-review-gap" is on the summary container above the item list.</done>
</task>

<task type="auto">
  <name>Task 3: Regression and type check</name>
  <files>(none modified unless a regression is found in the two files above)</files>
  <action>
    Run npx tsc --noEmit and the full npx vitest run. Compare failing tests against the 15 known pre-existing failures on main (AppHeader, BillViewHeader, ClaimableItemCard, CollaborativeClaimingView Test 26, InvitePeopleStep, PersonResultsScreen, WizardShell). Those are not regressions; do not fix them. Any failure outside that list, or any tsc error in ScanItemsEditor.tsx / its test, must be fixed within the two owned files only. Record the pass/fail counts in the SUMMARY.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run 2>&1 | tail -30</automated>
  </verify>
  <done>tsc reports no errors; full suite shows only the 15 known pre-existing failures (none in ScanItemsEditor).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Pure client-side presentation change; values come from the existing Zustand store, rendered as React text (auto-escaped) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kia-01 | Tampering | ScanItemsEditor summary text | accept | Amounts rendered via formatCents as React text nodes; no dangerouslySetInnerHTML, no new input paths |
</threat_model>

<verification>
- npx vitest run __tests__/ScanItemsEditor.test.tsx passes
- npx vitest run shows only the 15 known pre-existing failures
- npx tsc --noEmit clean
- grep -n 'data-testid="scan-review-gap"' components/wizard/ScanItemsEditor.tsx appears before the item list ul
- grep -c "Please confirm or edit" components/wizard/ScanItemsEditor.tsx returns 0
</verification>

<success_criteria>
- Heading states the problem ("Your items don't match the receipt") when the live gap exceeds TOLERANCE_CENTS, otherwise "Edit scanned items"
- Summary card sits directly under the heading: "Off by X" in text-warn (or "Matches the receipt" neutral) plus muted "Receipt subtotal|total X · Your items Y"
- Item list, Add item, Done unchanged below
- Only ScanItemsEditor.tsx and its test modified
</success_criteria>

<output>
Create `.planning/quick/260929-kia-edit-screen-total-check-summary-at-top-p/260929-kia-SUMMARY.md` when done
</output>
