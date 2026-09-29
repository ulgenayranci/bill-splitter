---
phase: quick-260929-lxp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/billMath.ts
  - lib/reconcileScannedBill.ts
  - lib/sessionSchema.ts
  - lib/createSession.ts
  - app/api/ocr/route.ts
  - app/api/session/route.ts
  - stores/useBillStore.ts
  - components/split/ServiceFeeCard.tsx
  - components/split/TipScreen.tsx
  - app/split/[sessionId]/CollaborativeClaimingView.tsx
  - components/split/PersonResultsScreen.tsx
  - components/wizard/SetupStep.tsx
  - components/wizard/ScanItemsEditor.tsx
  - __tests__/billMath.test.ts
  - __tests__/reconcileScannedBill.test.ts
  - __tests__/ocrRoute.test.ts
  - __tests__/sessionRoute.test.ts
  - __tests__/useBillStore.test.ts
  - __tests__/ServiceFeeCard.test.tsx
  - __tests__/CollaborativeClaimingView.test.tsx
  - __tests__/TipScreen.test.tsx
  - __tests__/PersonResultsScreen.test.tsx
  - __tests__/SetupStep.test.tsx
autonomous: true
requirements: [QUICK-260929-lxp]

must_haves:
  truths:
    - "A receipt with a printed service charge/fee/coperto/cover charge yields serviceFeeCents from /api/ocr, and that amount is never inside items"
    - "The service fee never causes or hides an items 'Off by' mismatch (grand-total fallback target subtracts it; printed subtotal target unchanged)"
    - "On /split/[sessionId] every person sees a 'Service fee' card that is selected, locked, non-interactive, labelled 'Shared by everyone', showing their share"
    - "The fee is split equally across ALL current session.people with integer cents summing exactly to the fee (500 over 3 people -> 167/167/166 in people-array order)"
    - "When a person joins later (I'm not listed), every share recalculates automatically, with no claim writes"
    - "The service fee is never counted as unclaimed, never affects the items-claimed chip, and never blocks I'm done"
    - "Results show a Service fee row in each person's breakdown, included in each person's total and in the grand total and share summary"
    - "A bill without a service fee (field absent/null, including old persisted stores and stored sessions) renders and computes exactly as before"
  artifacts:
    - path: "lib/billMath.ts"
      provides: "computeServiceFeeShares(feeCents, people) + optional serviceFeeShareCents arg on computePersonShareFromClaims"
      exports: ["computeServiceFeeShares", "computePersonShareFromClaims"]
    - path: "lib/reconcileScannedBill.ts"
      provides: "itemsReconcileTarget(subtotal, grandTotal, serviceFee) shared by OCR route and SetupStep"
      exports: ["itemsReconcileTarget"]
    - path: "components/split/ServiceFeeCard.tsx"
      provides: "Locked, always-selected, non-interactive service fee card"
      exports: ["ServiceFeeCard"]
    - path: "lib/sessionSchema.ts"
      provides: "Optional serviceFeeCents on SessionPayload"
      contains: "serviceFeeCents?: number"
  key_links:
    - from: "app/api/ocr/route.ts"
      to: "SetupStep -> useBillStore.serviceFeeCents -> createSession -> POST /api/session -> SessionPayload.serviceFeeCents"
      via: "serviceFeeCents field threaded end to end"
      pattern: "serviceFeeCents"
    - from: "app/split/[sessionId]/CollaborativeClaimingView.tsx"
      to: "lib/billMath.ts computeServiceFeeShares"
      via: "shares derived from session.people on every render (late joiners included)"
      pattern: "computeServiceFeeShares\\(session"
    - from: "components/split/PersonResultsScreen.tsx"
      to: "lib/billMath.ts computeServiceFeeShares + computePersonShareFromClaims"
      via: "per-person serviceFeeShareCents passed into share computation; grand total adds fee"
      pattern: "computeServiceFeeShares"
---

<objective>
Capture a printed service fee from the receipt and make it an automatically shared, locked bill line: split equally among all current people (recomputed when people join), always shown as selected and non-interactive on the claiming screen, included in results totals and the grand total, and excluded from scan reconciliation and unclaimed logic.

Purpose: implements the user request in 260929-lxp-BRIEF.md (the spec; its three locked decisions are binding: equal split, always included and un-deselectable, late joiners included).
Output: OCR field, data model + math, locked claiming card, results/tip/setup integration, and unit tests. Full vitest suite green, tsc clean.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.planning/quick/260929-lxp-service-fee-as-auto-shared-locked-bill-i/260929-lxp-BRIEF.md

## Design decisions (planner, binding for executor)

- DD-1 (model): the service fee is NOT an `Item` and has NO claims. It is a bill-level scalar `serviceFeeCents` (store: `number | null`; session payload: optional `number`, present only when > 0). The "Service fee line" on each screen is a synthetic row rendered from that scalar. Why: shares are computed from the people list (late joiners included with zero writes), it can never be un-claimed, it is automatically excluded from `getUnclaimedCounts` / `getClaimedUnitCounts` / `getUnclaimedItems` (they iterate `session.items`), it cannot be edited/deleted by the item edit ops (`/edit` only touches `items`), and item subtotal/reconciliation math is untouched. The existing Lua scripts in `app/api/session/[sessionId]/edit` and `claim` decode and re-encode the whole session, so an unknown numeric top-level field round-trips intact; done/tip routes spread the session. No change needed in those routes.
- DD-2 (split order): equal split by largest remainder in `session.people` ARRAY order (join order, server-authoritative, identical on every device) — the same convention as the D-02 tip split in `computePersonTotals`. Earlier people receive the leftover cents: 500 over 3 -> [167, 167, 166].
- DD-3 (reconciliation): the target the items reconcile against becomes: printed subtotal if present (unchanged); otherwise grand total MINUS service fee (when that stays > 0); otherwise null. One shared helper used by both the OCR route retry decision and SetupStep, so the fee can neither cause nor hide an "Off by". The prompt's items-vs-subtotal self-check stays unchanged.
- DD-4 (tip): tip base stays the items-only subtotal (brief: tip changes out of scope). Only the displayed totals add the fee share.
- DD-5 (editor): ScanItemsEditor shows a read-only note row (not an editable item, not in the list, not in the live sum) when a fee exists. SetupStep shows a one-line status under the scanned-bill review.
- DD-6 (OCR response back-compat): `/api/ocr` includes `serviceFeeCents` in the JSON response only when non-null (pass `best.serviceFeeCents ?? undefined`, which NextResponse.json drops), so existing `toEqual` response assertions in `__tests__/ocrRoute.test.ts` remain valid unchanged.

<interfaces>
From lib/billMath.ts (existing):
- computeSubtotalCents(items: Item[]): number
- formatCents(cents: number, currencyCode?: string): string
- computePersonShareFromClaims(personId, items, claimsItems, tipCents) returns { itemSubtotal, tip, total, lineItems: Array<{ item, shareCents, claimedQty }> }

From lib/reconcileScannedBill.ts (existing): reconcileScannedBill(rawLines, { subtotalCents }), TOLERANCE_CENTS = 2.

From app/api/ocr/route.ts (existing): RECEIPT_PROMPT, interface OcrParsed { items, currencyCode, subtotalCents, grandTotalCents }, reconcileTarget(pass), toIntCentsOrNull(v), parseOcrResponse(content), runOcrPass (strict json_schema; every property must be in `required`, nullable via ['integer','null']), passMismatchMagnitude(pass).

From lib/sessionSchema.ts (existing): SessionPayload { people, items, claims, tips, createdAt, currencyCode }.

From lib/createSession.ts: CreateSessionInput { people, items, currencyCode }; POSTs JSON body to /api/session.

From app/api/session/route.ts: validates people/items/currencyCode, builds SessionPayload, redis.set with ex 86400.

From stores/useBillStore.ts: zustand persist store `easy-billsy-bill` version 1; INITIAL_STATE; partialize lists persisted keys (includes scanCheck); reset() spreads INITIAL_STATE. Default persist merge is shallow over initial state, so a persisted blob lacking a new key falls back to the INITIAL_STATE value.

From components/split/TipScreen.tsx: props { sessionId, personId, itemSubtotalCents, currencyCode, onTipConfirmed, mutate }; personalTotal = itemSubtotalCents + tipCents, rendered in data-testid="tip-total-display".

From components/split/ClaimableItemCard.tsx: selected-state styling = avatar hex from AVATAR_COLORS[colorIndex] with 'bg-[' and ']' stripped; border color = hex, white fill with linear-gradient(hex14, hex14); filled circular Check badge in hex; rounded-lg border px-4 py-3; name text-[16px] font-semibold; price text-[14px] text-zinc-500; secondary line text-[14px] text-zinc-500.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: OCR field + data model + equal-split math + reconciliation target + session threading</name>
  <files>lib/billMath.ts, lib/reconcileScannedBill.ts, app/api/ocr/route.ts, lib/sessionSchema.ts, app/api/session/route.ts, lib/createSession.ts, stores/useBillStore.ts, __tests__/billMath.test.ts, __tests__/reconcileScannedBill.test.ts, __tests__/ocrRoute.test.ts, __tests__/sessionRoute.test.ts, __tests__/useBillStore.test.ts</files>
  <read_first>lib/billMath.ts, lib/reconcileScannedBill.ts, app/api/ocr/route.ts, app/api/session/route.ts, stores/useBillStore.ts, and the existing test files listed (for mock/setup patterns only)</read_first>
  <behavior>
    - computeServiceFeeShares(500, [a,b]) -> { a: 250, b: 250 }; (500, [a,b,c]) -> { a: 167, b: 167, c: 166 } (people-array order, sums to 500); (0 or null, people) -> every person 0; (500, []) -> {}; adding a 3rd person to a 2-person list changes 250/250 to 167/167/166 (late-join recalculation).
    - computePersonShareFromClaims with a 5th arg serviceFeeShareCents=167 returns serviceFee 167, itemSubtotal unchanged (items only), total = itemSubtotal + 167 + tip; without the 5th arg serviceFee is 0 and total is exactly as before.
    - itemsReconcileTarget(2000, 2700, 500) -> 2000 (subtotal wins, fee ignored); (null, 2500, 500) -> 2000; (null, 2500, null) -> 2500; (null, 400, 500) -> null (non-positive after subtraction); (null, null, 500) -> null.
    - OCR: model JSON with serviceFeeCents 500 -> response includes serviceFeeCents 500 and items do not change; JSON without the field or with 0/negative/float -> response has no serviceFeeCents key; strict schema `required` contains 'serviceFeeCents'; the retry-decision target subtracts the fee when only a grand total is printed (items 2000, grand 2500, fee 500 -> no retry, createMock called once).
    - POST /api/session with serviceFeeCents 500 persists payload.serviceFeeCents 500; absent/0/negative/non-integer/over 10000000 -> payload has no serviceFeeCents key.
    - Store: serviceFeeCents defaults null, setServiceFeeCents sets it, partialize includes it, reset() clears it to null.
  </behavior>
  <action>
Write the failing tests from the behavior block first (extend the existing test files, new describe blocks), then implement:

1. lib/billMath.ts: add exported computeServiceFeeShares(feeCents: number | null | undefined, people: Person[]): Record<PersonId, number>. Per DD-2 and locked decision 1 (equal split among all people): if people is empty return {}; if fee is not a positive integer, every person maps to 0; else base = floor(fee / n), remainder = fee % n, person at array index idx gets base + (idx < remainder ? 1 : 0). JSDoc must state: people-array order determinism, sums exactly to fee, recomputed from the live people list so late joiners are included (locked decision 3). Extend computePersonShareFromClaims with an optional 5th parameter serviceFeeShareCents = 0; add serviceFee to the returned object; total becomes itemSubtotal + serviceFee + tipCents. itemSubtotal stays items-only (DD-4, it is the tip base). Do not change computeQtyWeightedShares, computeSubtotalCents, or computePersonTotals.

2. lib/reconcileScannedBill.ts: add exported pure itemsReconcileTarget(subtotalCents, grandTotalCents, serviceFeeCents) (all number | null | undefined) implementing DD-3: return subtotal when it is a positive integer; else if grand total is a positive integer, compute grand minus (fee if positive integer else 0) and return it when > 0, else null; else null. Leave reconcileScannedBill itself unchanged.

3. app/api/ocr/route.ts: add serviceFeeCents: number | null to OcrParsed; in parseOcrResponse read it with toIntCentsOrNull. Add serviceFeeCents: { type: ['integer','null'] } to the strict schema properties and to the top-level `required` array. Prompt edits: change the exclusion rule to "Exclude subtotals, tax, tip, service charge / service fee / coperto / cover charge, and total lines from items"; add a rule "serviceFeeCents (top level): the printed service charge, service fee, coperto or cover charge AMOUNT (if printed as a percentage, use the printed money amount next to it). Never put it in items. null if none is printed. Do not invent it." Keep the self-check rule text unchanged. Replace the body of reconcileTarget(pass) with itemsReconcileTarget(pass.subtotalCents, pass.grandTotalCents, pass.serviceFeeCents) (import it). In the final NextResponse.json add serviceFeeCents: best.serviceFeeCents ?? undefined (DD-6).

4. lib/sessionSchema.ts: add optional serviceFeeCents?: number to SessionPayload with a doc comment: bill-level service fee in integer cents, split equally across all people at render time via computeServiceFeeShares; absent on sessions without a fee and on sessions created before this feature.

5. app/api/session/route.ts: read b.serviceFeeCents; accept only Number.isInteger and > 0 and <= 10_000_000 (T-lxp-01); when valid set payload.serviceFeeCents, otherwise omit the key entirely (so no-fee sessions are byte-identical in shape to today). lib/createSession.ts: add optional serviceFeeCents?: number | null to CreateSessionInput and include it in the POST body only when it is a positive number.

6. stores/useBillStore.ts: add serviceFeeCents: number | null to BillState and INITIAL_STATE (null), add setServiceFeeCents(cents: number | null) action, add serviceFeeCents to partialize. Do NOT bump the persist version: old persisted blobs without the key fall back to null via the default shallow merge (backward compatible). reset() already restores INITIAL_STATE.
  </action>
  <verify>
    <automated>npx vitest run __tests__/billMath.test.ts __tests__/reconcileScannedBill.test.ts __tests__/ocrRoute.test.ts __tests__/sessionRoute.test.ts __tests__/useBillStore.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>New tests for equal-split rounding, late-join recalculation, share-with-fee, reconcile target, OCR field parsing/schema/retry target, session persistence and store are green; all pre-existing tests in these files pass unchanged; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Locked service-fee card on the claiming screen + Tip total</name>
  <files>components/split/ServiceFeeCard.tsx, app/split/[sessionId]/CollaborativeClaimingView.tsx, components/split/TipScreen.tsx, __tests__/ServiceFeeCard.test.tsx, __tests__/CollaborativeClaimingView.test.tsx, __tests__/TipScreen.test.tsx</files>
  <read_first>components/split/ClaimableItemCard.tsx (styling to mirror), app/split/[sessionId]/CollaborativeClaimingView.tsx (item list around the session.items.map and the add-item li; personalShare computation; TipScreen render), components/split/TipScreen.tsx, __tests__/CollaborativeClaimingView.test.tsx (session fixture + fetch mock pattern)</read_first>
  <behavior>
    - ServiceFeeCard renders "Service fee", the full fee formatted in the currency, a "Shared by everyone" line with "your share" amount, a lock icon, and a filled check badge; it has no role="button", no onClick, no aria-pressed; clicking it calls no callback and changes nothing.
    - CollaborativeClaimingView with session.serviceFeeCents 500 and 2 people shows data-testid="service-fee-card" with your share 2.50; with 3 people shows 1.67 for the first person and 1.66 for the third; re-rendering with a session whose people array gained a person updates the share (late join).
    - Clicking the service-fee card triggers no fetch to /claim; the items-claimed chip and the unclaimed-warning count ignore the fee (a session where all items are claimed and a fee exists goes straight through I'm done without the unclaimed dialog).
    - Session without serviceFeeCents: no service-fee-card in the DOM (existing tests unchanged).
    - TipScreen with serviceFeeShareCents 250 and itemSubtotalCents 2000 shows tip-total-display including 2.50; without the prop the total is as before.
  </behavior>
  <action>
Write the failing tests first, then implement:

1. Create components/split/ServiceFeeCard.tsx exporting ServiceFeeCard({ feeCents, myShareCents, peopleCount, myColorIndex, currencyCode }). Per locked decision 2 (selected and cannot be un-selected): visually match a selected ClaimableItemCard (same Card wrapper classes: flex min-h-[44px] flex-col gap-2 rounded-lg border px-4 py-3 shadow-none ring-0; border color = my avatar hex, white fill plus 8% tint gradient, filled circular Check badge in my hex; name "Service fee" text-[16px] font-semibold; full fee text-[14px] text-zinc-500 on the right). Add a lucide Lock icon (size 14, text-zinc-400, aria-hidden) beside the name. Second line (text-[14px] text-zinc-500, data-testid="service-fee-share"): "Shared by everyone · your share {formatCents(myShareCents)}" (append " ({peopleCount} people)" is optional; keep it on one line at 375px). Non-interactive: no role="button", no onClick, no cursor-pointer, no stepper; put data-testid="service-fee-card" and aria-label "Service fee, shared equally by everyone" on the Card. Derive the hex exactly as ClaimableItemCard does (AVATAR_COLORS[colorIndex % length] with 'bg-[' and ']' stripped).

2. CollaborativeClaimingView.tsx: compute feeShares = computeServiceFeeShares(session.serviceFeeCents, session.people) (import from lib/billMath) near personalShare, so it re-derives from the current people list on every render (locked decision 3, no claim writes). When session.serviceFeeCents is a positive number, render one extra li after the session.items.map rows and before the add-item li containing ServiceFeeCard (no edit pencil beside it; wrap to keep the same width as item cards, i.e. the card may span full row width). Pass myShareCents = feeShares[selectedPersonId] ?? 0 and myColorIndex from peopleById[selectedPersonId]. Pass feeShares[selectedPersonId] as the 5th arg to the existing computePersonShareFromClaims call for personalShare, and pass serviceFeeShareCents={feeShares[selectedPersonId] ?? 0} to TipScreen. Do NOT touch getUnclaimedCounts / getClaimedUnitCounts usage or handleDone: the fee is not an item so it is never unclaimed and never blocks I'm done.

3. TipScreen.tsx: add optional prop serviceFeeShareCents?: number (default 0). Tip percentages stay computed on itemSubtotalCents (DD-4). personalTotal = itemSubtotalCents + serviceFeeShareCents + tipCents. When serviceFeeShareCents > 0 render a small row "Service fee" / amount (data-testid="tip-service-fee") above "Your total".
  </action>
  <verify>
    <automated>npx vitest run __tests__/ServiceFeeCard.test.tsx __tests__/CollaborativeClaimingView.test.tsx __tests__/TipScreen.test.tsx __tests__/ClaimableItemCard.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Locked card renders only when a fee exists, shows the correct equal share (2.50 for 2 people; 1.67/1.67/1.66 for 3), recalculates when people change, tapping it does nothing, unclaimed/I'm-done behaviour unchanged; TipScreen total includes the fee share; all prior tests in these files still pass; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Results breakdown/totals + Setup/Editor integration</name>
  <files>components/split/PersonResultsScreen.tsx, components/wizard/SetupStep.tsx, components/wizard/ScanItemsEditor.tsx, __tests__/PersonResultsScreen.test.tsx, __tests__/SetupStep.test.tsx</files>
  <read_first>components/split/PersonResultsScreen.tsx (share summary, per-person card, subtotal/tip/total rows, grand total row), components/wizard/SetupStep.tsx (handleFileChange, handleContinue), components/wizard/ScanItemsEditor.tsx (top summary / off-by area), __tests__/PersonResultsScreen.test.tsx and __tests__/SetupStep.test.tsx (fixture + fetch mock patterns)</read_first>
  <behavior>
    - PersonResultsScreen with serviceFeeCents 500 and 2 people: each person's breakdown has a "Service fee" row of 2.50; current user's results-card-total and results-total include the 2.50; other people's header amount includes their 2.50; results-grand-total = items subtotal + 5.00; the copied share summary lines include each person's fee share and the Total line includes the fee.
    - 3 people and 500: rows show 1.67 / 1.67 / 1.66 in session.people order.
    - Unclaimed items section and count never list the service fee.
    - No serviceFeeCents: no service-fee row anywhere, grand total and all totals identical to today (existing tests unchanged).
    - SetupStep: OCR response with serviceFeeCents 500, subtotalCents null, grandTotalCents 2500 and items summing to 2000 -> no mismatch, editor not auto-opened, store serviceFeeCents 500, a "Service fee" status line is shown; createSession is called with serviceFeeCents 500. A new scan (or retake) clears the previous fee before OCR.
  </behavior>
  <action>
Write the failing tests first, then implement:

1. PersonResultsScreen.tsx: compute feeShares = computeServiceFeeShares(session.serviceFeeCents, session.people) once. For every person pass feeShares[person.id] ?? 0 as the 5th arg to computePersonShareFromClaims (both in the card loop and in handleShareSummary). In each person's expanded breakdown, when share.serviceFee > 0, render a row after the line items (NOT inside share.lineItems) labelled "Service fee" with a Lock icon (size 12, aria-hidden) and "shared by everyone" caption, amount formatCents(share.serviceFee), data-testid `results-service-fee-${person.id}`; render it even when the person has no claimed items (so the "nothing claimed" empty state is still shown for items, plus this row). Header amount for non-current people becomes share.itemSubtotal + share.serviceFee (current user keeps share.total, which now includes the fee). In the current user's Subtotal/tip/Total block, add a "Service fee" row between Subtotal and Your tip (data-testid="results-service-fee") when share.serviceFee > 0. Grand total = computeSubtotalCents(session.items) + (positive serviceFeeCents or 0). Share summary: "owes" amount = itemSubtotal + serviceFee (still no tip, D-04), Total line uses the new grand total. Do not change getUnclaimedCounts/getUnclaimedItems usage.

2. SetupStep.tsx: select serviceFeeCents and setServiceFeeCents from the store. In handleFileChange call setServiceFeeCents(null) at the start alongside setScanCheck(null), and also in the Retake button onClick. Parse data.serviceFeeCents from the OCR response (typed optional number | null); after a non-empty OCR result call setServiceFeeCents(value when positive integer else null). Replace `const targetCents = ocrSubtotalCents ?? ocrGrandTotalCents` with itemsReconcileTarget(ocrSubtotalCents, ocrGrandTotalCents, ocrServiceFeeCents) (DD-3) so the fee neither causes nor hides an "Off by"; scanCheck.targetCents therefore already excludes the fee and ScanItemsEditor's live gap needs no math change. In handleContinue read serviceFeeCents from useBillStore.getState() and pass it to createSession. When billScanned and serviceFeeCents > 0, render under the Retake/Edit row a one-line status (text-[12px] text-zinc-500, data-testid="service-fee-status"): "Service fee {formatCents(fee, currencyCode)} found — split equally between everyone." Add serviceFeeCents setter to the useCallback dependency list.

3. ScanItemsEditor.tsx (DD-5): when the store's serviceFeeCents > 0, render a read-only row (data-testid="editor-service-fee") outside and below the editable item list: "Service fee {amount} — split equally, not part of the items total", with a Lock icon; no inputs, no delete, and it is NOT added to liveSumCents.
  </action>
  <verify>
    <automated>npx vitest run && npx tsc --noEmit</automated>
  </verify>
  <done>Results show the fee row, per-person totals and grand total including the fee with exact 2.50/2.50 and 1.67/1.67/1.66 splits; setup reconciles against grand-total-minus-fee and threads the fee into the session; editor shows it read-only outside the sum; no-fee bills unchanged; the FULL suite is green (387 previous tests plus the new ones, zero failures) and tsc is clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| OpenAI response -> /api/ocr | Model output is untrusted JSON; serviceFeeCents may be missing, float, negative or huge |
| client -> POST /api/session | Arbitrary client-supplied serviceFeeCents is persisted to Redis and shown to every participant |
| Redis session -> client render | Old sessions lack the field; payload may be malformed |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-lxp-01 | Tampering | app/api/session/route.ts serviceFeeCents | mitigate | Accept only Number.isInteger, > 0, <= 10_000_000; otherwise omit the key (never store null/NaN/strings) |
| T-lxp-02 | Tampering | app/api/ocr/route.ts parseOcrResponse | mitigate | Coerce via existing toIntCentsOrNull; non-positive-integer -> null and omitted from response |
| T-lxp-03 | Denial of Service | computeServiceFeeShares render path | mitigate | Guard empty people (return {}) and non-positive/non-integer fee (all zeros) so no division by zero or NaN reaches formatCents |
| T-lxp-04 | Repudiation/Integrity | per-device share mismatch | mitigate | Deterministic split in server-authoritative session.people array order; same helper used by claiming card, tip and results |
| T-lxp-05 | Tampering | /edit and /claim Lua scripts re-encoding session | accept | cjson round-trips an unknown numeric top-level field unchanged; no script references it; no new write path added |
</threat_model>

<verification>
- `npx vitest run` fully green (previous 387 plus new tests, zero failures).
- `npx tsc --noEmit` clean.
- `grep -n "serviceFeeCents" app/api/ocr/route.ts lib/sessionSchema.ts app/api/session/route.ts lib/createSession.ts stores/useBillStore.ts components/wizard/SetupStep.tsx` shows the field threaded end to end.
- `grep -n "computeServiceFeeShares" app/split/\[sessionId\]/CollaborativeClaimingView.tsx components/split/PersonResultsScreen.tsx` shows both consumers.
- `grep -c "serviceFee" lib/sessionUtils.ts` returns 0 (unclaimed logic untouched by design).
</verification>

<success_criteria>
- Acceptance (brief, mobile 375px): EUR 5.00 fee + 2 people -> "Service fee" line, locked and selected for each person, results 2.50 each included in totals and grand total; 3 people -> 1.67/1.67/1.66; late joiner triggers equal recalculation; tapping the fee card does nothing; unclaimed count ignores it; receipts without a fee behave exactly as before.
- Unit tests exist for OCR field parsing, equal-split rounding, the locked card, results totals and late-join recalculation.
- Full vitest suite green and tsc clean.
</success_criteria>

<output>
Create `.planning/quick/260929-lxp-service-fee-as-auto-shared-locked-bill-i/260929-lxp-SUMMARY.md` when done
</output>
