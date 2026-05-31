---
status: complete
phase: 06-collaborative-bill-claiming
source: [06-VERIFICATION.md, 06-ROADMAP success criteria]
started: 2026-05-28T00:00:00.000Z
updated: 2026-05-29T00:00:00.000Z
---

## Setup

**Requires:** Live Vercel deployment with Upstash Redis.
**Recommended:** Two devices (or two browser tabs) to simulate host + guest.

---

## Current Test

[testing complete — all 17 tests pass, acceptance persistence gap found and fixed post-UAT]

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
result: pass
fix: 2bf6578 — Lua script updated to allow multiple claimants per item; proportional split logic added

---

### 5. Quantity stepper for qty > 1 items (SC4)
expected: Add an item with quantity 3 (e.g., "Beer x3") to the bill. On the claiming screen, the item card shows a stepper (−/+). Tapping + increments "how many you had"; tapping − decrements. The stepper prevents going below 0 or above remaining unclaimed quantity.
result: pass
note: Stepper UI works correctly. Gaps from initial UAT now fixed — a9281c1 added Qty field to wizard AddItemsStep (both add and edit forms) and updated OCR prompt to extract quantities; 75ec726 added ×N badge to wizard step 2 item rows and HostPanel unclaimed tab.

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
note: Button order and confirmation UX gaps from initial UAT fixed in a9281c1 — Reject now left, Approve right (NNG order); confirmation state replaces full button row with [Cancel] [Confirm reject?] instead of appending.

---

### 10. Host-assigned items on review screen (SC7a)
expected: Host assigns an unclaimed item to a specific person via HostPanel. That person taps "I'm done". Instead of going straight to TipScreen, they see ReviewHostAssignedScreen listing the host-assigned item(s) with "Accept" and "Dispute" options per row.
result: pass
fix: 75ec726 — claim/route.ts now accepts and validates assignedBy param against hostToken; HostPanel passes assignedBy:'host' so host-assigned items are correctly flagged and handleDone routes to ReviewHostAssignedScreen

---

### 11. Dispute bounces back to host (SC7b)
expected: On ReviewHostAssignedScreen, tapping "Dispute" on a host-assigned item sends the dispute. The item returns to the HostPanel "Disputes" tab. The guest returns to the claiming screen (or a waiting state).
result: pass

---

### 12. "I'm done" soft checkpoint — back returns to claiming (SC8)
expected: Tap "I'm done". Then tap the back button (from ReviewHostAssignedScreen or TipScreen). The app returns to the claiming screen with all previously claimed items still intact and editable. No items are lost; the "done" state is reversed on the server.
result: pass
note: Back from TipScreen works. Gap from initial UAT fixed in a9281c1 — PersonResultsScreen now has a back button that returns to TipScreen.

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
passed: 17
issues: 0
pending: 0
blocked: 0
skipped: 0

## Gaps

- truth: "After tapping Share link, the guest URL is copied to clipboard so the host can share it"
  status: fixed
  fix: 8e15bc6 — ShareLinkButton replaced with dialog-based flow; 3-tier copy fallback (clipboard API → execCommand → manual copy); guest URL copied before redirecting host
  severity: major
  test: 2

- truth: "Multiple people can claim the same item — all claimants appear on the item card with proportional split"
  status: fixed
  fix: 2bf6578 — Lua claim script updated to allow multiple claimants; proportional split calculated server-side
  severity: major
  test: 4

- truth: "HostPanel edit request card: Reject (outline) on left, Approve (amber filled) on right — per NNG Heuristic #4 (platform conventions) and error prevention"
  status: fixed
  fix: a9281c1 — button order swapped to Reject (left) / Approve (right)
  severity: cosmetic
  test: 9

- truth: "Reject confirmation state replaces the full button row — shows only Cancel (outline, left) and Confirm Reject (red filled, right). Approve disappears entirely."
  status: fixed
  fix: a9281c1 — confirmation state now replaces button row entirely with [Cancel] [Confirm reject?]
  severity: cosmetic
  test: 9

- truth: "When host has assigned items to a person, tapping 'I'm done' shows ReviewHostAssignedScreen before TipScreen"
  status: fixed
  fix: 75ec726 — claim/route.ts validates assignedBy against hostToken; HostPanel passes assignedBy:'host'; handleDone correctly routes to ReviewHostAssignedScreen when host-assigned items exist
  severity: major
  test: 10

- truth: "PersonResultsScreen has a back button so guests can return to TipScreen (and then to claiming) if they need to make changes"
  status: fixed
  fix: a9281c1 — PersonResultsScreen gained optional onBack prop; CollaborativeClaimingView passes () => setPhase('tip')
  severity: minor
  test: 12

- truth: "Item cards display the quantity (e.g. '×2' badge) consistently across ALL screens — wizard step 2, claiming screen, HostPanel — not just the guest claiming flow"
  status: fixed
  fix: 75ec726 — ×N badge added to AssignItemsStep (wizard step 2) and HostPanel unclaimed tab item rows when quantity > 1
  severity: major
  test: 5

- truth: "Add item form includes a quantity field so users can create items with qty > 1 (enabling the stepper on claiming screen)"
  status: fixed
  fix: a9281c1 — Qty number input (min 1, max 99, default 1) added to both add and edit forms in AddItemsStep; OCR prompt updated to extract quantity per line item
  severity: major
  test: 5

- truth: "Item input row can be dismissed without completing — via an X button or tapping outside the input"
  status: fixed
  fix: a9281c1 — X (Cancel) button added to both add and edit inline forms in AddItemsStep
  severity: minor
  test: adhoc

- truth: "Host-assignment acceptance is durable — if a guest accepts an item then navigates back to claiming and taps done again, the accepted item does not reappear on ReviewHostAssignedScreen"
  status: fixed
  fix: ce9301b — added accepted?: boolean to ClaimEntry; new POST /api/session/[sessionId]/accept route writes accepted:true to Redis; ReviewHostAssignedScreen calls API on Accept instead of local state; hasHostAssignedItems + handleDone filter exclude accepted claims
  severity: major
  test: post-UAT Vercel

- truth: "Taken slots in PersonSlotPicker should be non-clickable — a guest should not be able to claim another person's slot"
  status: fixed
  fix: 0ddccec — taken slots are now non-clickable with (taken) label; slot_taken server response no longer bypasses into setSelectedPersonId; localStorage auto-restore handles legitimate refresh re-join
  severity: critical
  test: post-UAT Vercel

- truth: "After sharing the guest link via the iOS/Android native share sheet, the host should be redirected to their session"
  status: fixed
  fix: 4787c61 — navigator.share path was returning early without calling router.push; all three share paths (native share, clipboard API, execCommand) now call the same redirectHost helper after 1200ms
  severity: major
  test: post-UAT mobile
