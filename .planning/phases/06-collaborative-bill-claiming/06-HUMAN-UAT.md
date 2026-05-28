---
status: complete
phase: 06-collaborative-bill-claiming
source: [06-VERIFICATION.md, 06-ROADMAP success criteria]
started: 2026-05-28T00:00:00.000Z
updated: 2026-05-28T00:00:00.000Z
---

## Setup

**Requires:** Live Vercel deployment with Upstash Redis.
**Recommended:** Two devices (or two browser tabs) to simulate host + guest.

---

## Current Test

[testing complete]

---

## Tests

### 1. Host redirect — no waiting screen (SC1)
expected: After tapping "Share link" on the Assign/Share step, the host is immediately redirected to /split/{sessionId}?hostToken=xxx — there is NO intermediate "Waiting for guests" screen.
result: pass

---

### 2. Host token persistence (SC2)
expected: Host opens /split/{sessionId}?hostToken=xxx, then closes the tab and re-opens the same URL. The HostPanel FAB (floating action button) is still visible — host privileges are restored from the URL token without re-authenticating.
result: pass
note: required fix — auto-restore host slot from session.hostPersonId on re-open

---

### 3. PersonSlotPicker — identity selection
expected: On /split/{sessionId}, a name picker appears before the claiming screen. Selecting a name that is already taken (occupied by another session) shows the slot as disabled or visually distinct. Selecting an available name advances to the claiming screen.
result: pass

---

### 4. Multi-person simultaneous claiming + shared items (SC3)
expected: Open the same session in two browser tabs (or two devices). Person A claims Item 1. Person B claims Item 1 as well. Both claimants appear on the item card (e.g., "Alice, Bob — 50% each"). The proportional split is reflected in each person's subtotal.
result: issue
reported: "shared claiming is fully broken — even 2 people cannot claim the same item. Second person gets 'Couldn't save — tap to retry' error. Only one person can hold a claim per item."
severity: major

---

### 5. Quantity stepper for qty > 1 items (SC4)
expected: Add an item with quantity 3 (e.g., "Beer x3") to the bill. On the claiming screen, the item card shows a stepper (−/+). Tapping + increments "how many you had"; tapping − decrements. The stepper prevents going below 0 or above remaining unclaimed quantity.
result: pass
note: Stepper UI works correctly (shows ×4 badge, −/+ stepper, "2 of 4 claimed"). Guest's "Add item" button in claiming screen includes quantity field. Gap: host's wizard item-add form has no quantity field; OCR does not preserve quantities from scanned bills.

---

### 6. Unclaimed units flagged to host (SC5)
expected: With a qty-3 item where only 1 unit is claimed, open the HostPanel (tap the FAB). The "Unassigned" tab lists the item with unclaimed unit count. The host can assign the unclaimed units directly from this tab.
result: pass

---

### 7. Edit request — add item (SC6a)
expected: As a guest, tap "Request edit" → type → "Add item". Enter a name and price. The request appears in the HostPanel "Edit requests" tab. Host taps "Approve" — the new item appears in the item list for all participants.
result: pass
note: No separate "Request edit" button — direct "Add item" button is the intended UX. Modal title says "Request edit" but no changes needed.

---

### 8. Edit request — reprice item (SC6b)
expected: Submit a reprice edit request for an existing item. Host approves. The item's displayed price updates for all participants.
result: pass
note: UX discussion needed — item cards should show an "edited" indicator (e.g. a badge or strikethrough original price) when an edit request has been approved so all participants can see the item was changed.

---

### 9. Edit request — host rejects (SC6c)
expected: Submit any edit request. Host taps "Reject" in the HostPanel. The request disappears from the queue; the original item is unchanged. No error shown to the guest — the rejection is silent on the guest side (or shows a soft message if implemented).
result: pass
note: Button order violates NNG conventions — Approve (filled) is on left, Reject (outline) on right. Should be swapped: Reject (outline) left, Approve (amber filled) right.

---

### 10. Host-assigned items on review screen (SC7a)
expected: Host assigns an unclaimed item to a specific person via HostPanel. That person taps "I'm done". Instead of going straight to TipScreen, they see ReviewHostAssignedScreen listing the host-assigned item(s) with "Accept" and "Dispute" options per row.
result: issue
reported: "It goes straight to the tip screen — no review screen appeared"
severity: major

---

### 11. Dispute bounces back to host (SC7b)
expected: On ReviewHostAssignedScreen, tapping "Dispute" on a host-assigned item sends the dispute. The item returns to the HostPanel "Disputes" tab. The guest returns to the claiming screen (or a waiting state).
result: skipped
reason: Blocked by test 10 — ReviewHostAssignedScreen never appears so Dispute button is unreachable.

---

### 12. "I'm done" soft checkpoint — back returns to claiming (SC8)
expected: Tap "I'm done". Then tap the back button (from ReviewHostAssignedScreen or TipScreen). The app returns to the claiming screen with all previously claimed items still intact and editable. No items are lost; the "done" state is reversed on the server.
result: pass
note: Back from TipScreen works. Gap: no back button on PersonResultsScreen — once tip is confirmed and results screen appears, guest is stuck with no way to go back.

---

### 13. Per-person tip — zero is valid (SC9a)
expected: On TipScreen, the "Confirm tip" button is enabled with the default value of $0.00 / 0%. Tapping "Confirm tip" at zero proceeds to PersonResultsScreen without error.
result: pass

---

### 14. Per-person tip — presets and custom (SC9b)
expected: Tapping 10%, 15%, 20% preset buttons updates the tip amount in real time. Entering a custom percentage in the input field also updates the amount. The "Total" preview (subtotal + tip) updates live.
result: pass

---

### 15. Per-person results — no waiting (SC10)
expected: After tapping "Confirm tip", PersonResultsScreen renders immediately showing the person's claimed items, tip amount, and total. There is NO spinner or "waiting for others" message — each person sees their result independently.
result: pass

---

### 16. HostPanel only visible to host
expected: Open the session as a guest (no hostToken in URL). Confirm the HostPanel FAB is NOT visible. Open the same session as host (with hostToken). The FAB IS visible.
result: pass

---

### 17. Session expired screen
expected: Open a URL for a non-existent or expired session ID (e.g., /split/doesnotexist). The app shows a "Session expired" or "Link not found" screen — NOT a blank page or unhandled error.
result: pass

---

## Summary

total: 17
passed: 14
issues: 2
pending: 0
blocked: 0
skipped: 1

## Gaps

- truth: "After tapping Share link, the guest URL is copied to clipboard so the host can share it"
  status: failed
  reason: "ShareLinkButton redirects host immediately but never calls navigator.clipboard.writeText() — no guest URL is copied"
  severity: major
  test: 2
  fix: "Copy ${origin}/split/${sessionId} to clipboard before router.push() in ShareLinkButton.handleShare()"

- truth: "Multiple people can claim the same item — all claimants appear on the item card with proportional split"
  status: failed
  reason: "User reported: shared claiming is fully broken — even 2 people cannot claim the same item. Second person gets 'Couldn't save — tap to retry' error. Only one person can hold a claim per item."
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []

- truth: "HostPanel edit request card: Reject (outline) on left, Approve (amber filled) on right — per NNG Heuristic #4 (platform conventions) and error prevention"
  status: failed
  reason: "User reported: Approve and Reject buttons are swapped — Approve is on the left (primary position), Reject on the right. Violates platform conventions (iOS HIG, Material Design) where affirmative action is always on the right."
  severity: cosmetic
  test: 9
  root_cause: "Button order in HostPanel edit request card"
  artifacts: []
  missing: []

- truth: "Reject confirmation state replaces the full button row — shows only Cancel (outline, left) and Confirm Reject (red filled, right). Approve disappears entirely."
  status: failed
  reason: "Confirmation state appends buttons instead of replacing them — 3 mismatched buttons appear: Approve (amber filled), Confirm reject? (red outline with ?, ambiguous), Cancel (bare text, smallest). Violates NNG #3 (escape hatch invisible), #5 (Approve still dominant = accidental approval risk), #6 (question mark creates doubt about action), #8 (3 mismatched weights = visual noise)."
  severity: cosmetic
  test: 9
  root_cause: "Confirmation mode adds to button row instead of swapping state"
  artifacts: []
  missing: []

- truth: "When host has assigned items to a person, tapping 'I'm done' shows ReviewHostAssignedScreen before TipScreen"
  status: failed
  reason: "User reported: goes straight to tip screen — ReviewHostAssignedScreen never appeared despite host having assigned items to the person"
  severity: major
  test: 10
  root_cause: ""
  artifacts: []
  missing: []

- truth: "PersonResultsScreen has a back button so guests can return to TipScreen (and then to claiming) if they need to make changes"
  status: failed
  reason: "User reported: no back button after confirming tip — once on PersonResultsScreen the guest is stuck with no navigation path back"
  severity: minor
  test: 12
  root_cause: ""
  artifacts: []
  missing: []

- truth: "Item cards display the quantity (e.g. '×2' badge) consistently across ALL screens — wizard step 2, claiming screen, HostPanel — not just the guest claiming flow"
  status: failed
  reason: "User reported: quantity badge only visible on claiming screen. Wizard step 2 item cards have no quantity indicator. OCR also does not preserve quantities from scanned bills so qty defaults to 1 and is never shown."
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []

- truth: "Add item form includes a quantity field so users can create items with qty > 1 (enabling the stepper on claiming screen)"
  status: failed
  reason: "User reported: add item form only has Item name and Price — no quantity field. SC4 quantity stepper is entirely unreachable."
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []

- truth: "Item input row can be dismissed without completing — via an X button or tapping outside the input"
  status: failed
  reason: "User reported: once item input is activated there is no way to cancel it — user must type a name and price, confirm, then delete the item. No X button or tap-outside-to-dismiss."
  severity: minor
  test: adhoc
  root_cause: ""
  artifacts: []
  missing: []
