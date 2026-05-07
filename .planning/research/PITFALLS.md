# Domain Pitfalls

**Domain:** Receipt OCR bill splitter (mobile web)
**Researched:** 2026-05-08
**Confidence:** HIGH (OCR/floating-point/camera), MEDIUM (LLM cost/latency, realtime sync), MEDIUM (UX)

---

## Critical Pitfalls

Mistakes that cause rewrites, user trust loss, or fundamentally broken math.

---

### Pitfall 1: Floating-Point Rounding Makes the Split Not Add Up

**What goes wrong:**
JavaScript native `Number` arithmetic (IEEE 754 binary floats) cannot represent common decimal values exactly. `0.1 + 0.2 === 0.30000000000000004`. When each person's share is calculated and rounded independently, the sum of shares will silently drift from the receipt total by $0.01 or more. Users notice immediately — they're staring at the receipt and your number doesn't match.

**Why it happens:**
Developers calculate each person's subtotal, multiply by `(1 + tipRate + taxRate)`, and call `.toFixed(2)`. Rounding each share independently introduces a "split remainder" that belongs to nobody. On a $100 bill split 3 ways with tip, the three rounded values will sum to $99.99 or $100.01.

`(2.55).toFixed(1)` returns `'2.5'` (rounds down) — MDN documents this inconsistency explicitly. `.toFixed()` is not safe for financial rounding.

**Consequences:**
- Sum of displayed shares ≠ receipt total — trust-destroying for a splitting app
- "Who owes the extra penny?" confusion at the table
- Silent, hard to test (only shows at certain amounts/splits)

**Prevention:**
- Work entirely in integer cents. Convert all prices to cents on input (`$12.50` → `1250`). Do all arithmetic in integers. Convert back only for display.
- Use a "remainder assignment" strategy: calculate shares as floor-of-fair-share, then assign the leftover cents one at a time to the first N people.
- Never use `.toFixed()` for calculation — only for display formatting.
- Write unit tests with known problematic splits: 3 ways, 7 ways, amounts like $0.01.

**Detection (warning signs):**
- Any code doing `price * 0.18` directly on a float
- Summing displayed `.toFixed(2)` strings instead of the integer representation
- No unit tests covering split totals

**Phase:** Address in the core calculation engine, Phase 1 or whichever phase implements the split math. Do not defer — retrofitting integer math later requires changing every calculation path.

---

### Pitfall 2: OCR Fails on Thermal Paper Under Restaurant Lighting

**What goes wrong:**
Most restaurant receipts are printed on thermal paper with low-contrast gray-on-white or faded ink. Under dim restaurant lighting, a phone camera produces images with blown highlights, low contrast, and motion blur. OCR — whether classic (Tesseract) or vision-model-based — will misread digits: `1` becomes `l`, `0` becomes `O`, `8` becomes `6`, `$13.50` becomes `$1B.5O`. A single misread price silently corrupts the entire split.

**Why it happens:**
- Thermal paper's printed areas appear dark but the contrast ratio is much lower than inkjet or laser prints
- Restaurant ambient lighting is often warm/dim, biasing the camera's white balance
- Users hold phones at an angle, causing keystone distortion and partial blur
- Receipt paper curls at the edges, causing bottom/top rows to be out of focal plane

**Consequences:**
- Wrong prices extracted silently — user doesn't catch it if they don't scrutinize
- AI name expansion can't fix a wrong price; it only renames items
- User trust destroyed when final split is wrong but the receipt photo "looked fine"

**Prevention:**
- Treat OCR output as always-unverified. Display all extracted items + prices back to the user in an editable confirmation step before proceeding.
- Use vision model (Claude Vision, GPT-4o) not classic OCR — they handle low-contrast and skewed text significantly better than Tesseract.
- Pre-process: apply contrast enhancement and adaptive thresholding before sending to OCR (canvas `filter: contrast(1.5)` or a server-side step).
- Show the captured image thumbnail alongside the extracted list so users can spot-check.
- Cap image size sent to API (resize to ~1200px width) — larger images don't improve OCR accuracy but cost more and are slower.

**Detection (warning signs):**
- Testing only with printed high-quality sample receipts, not actual crumpled thermal receipts under dim light
- No editable confirmation step for extracted items
- User can proceed to assignment without ever seeing the extracted prices

**Phase:** OCR capture phase. The editable confirmation step is non-negotiable and must be in scope from the start.

---

### Pitfall 3: iOS Safari Camera Permissions Are One-Strike

**What goes wrong:**
On iOS Safari, if the user taps "Don't Allow" on the camera permission prompt, the browser does NOT re-prompt. The permission is permanently denied for the origin until the user manually goes to iOS Settings > Safari > [site] and re-enables it. There is no API to check the current permission state before prompting, and calling `getUserMedia` after denial throws `NotAllowedError` with no recovery path in the browser.

Additionally, iOS Safari imposes restrictions that Chrome/Firefox do not:
- `getUserMedia` only works inside a direct user gesture (tap handler). Calling it in `useEffect` on page load silently fails.
- Streams from `getUserMedia` must be explicitly stopped (`track.stop()`) before switching cameras or the device stays locked.
- PWA mode (home screen shortcut) loses camera permission and re-prompts.
- iOS 16.4+ added some improvements, but permission state querying (`navigator.permissions.query({ name: 'camera' })`) was not supported in Safari until recently and remains unreliable.

**Consequences:**
- Primary flow (photo) is broken for users who accidentally deny
- User sees a blank camera view with no explanation
- PWA pinning breaks the camera — users who pin the app encounter an unexpected re-permission flow

**Prevention:**
- Always trigger `getUserMedia` from a direct tap event handler, never from lifecycle hooks.
- Show a pre-prompt screen: "We'll ask for camera access to read your receipt" with a single "Open Camera" button. This mental preparation reduces accidental denials.
- Implement a `NotAllowedError` handler that shows clear instructions: "Go to Settings > Safari > [site] > Camera and set to Allow."
- Provide `<input type="file" accept="image/*" capture="environment">` as a fallback — this invokes the native camera app without requiring `getUserMedia` permission at the browser level, and it works universally on iOS.
- Always call `track.stop()` on all stream tracks when navigating away from the camera view.
- Test explicitly on physical iOS device, not simulator — simulator has no camera.

**Detection (warning signs):**
- `getUserMedia` called in component mount / `useEffect` without user gesture
- No error state UI for `NotAllowedError`
- No file input fallback
- Only tested on Android Chrome or desktop

**Phase:** Camera capture phase. The `<input type="file">` fallback is the safest iOS-first strategy and should be the primary approach for v1, with `getUserMedia` as progressive enhancement.

---

### Pitfall 4: LLM Latency Breaks the Table Experience

**What goes wrong:**
The "AI expands abbreviations" step is a network round-trip to an LLM API. Cold start + generation time for a receipt with 15 items typically ranges from 2–8 seconds depending on the model and load. Users at a table are waiting. If the app shows no progress indicator, users assume it's frozen and tap again (double-submission). If it times out, the entire receipt capture fails and they must retake the photo.

A more subtle version: the app sends each item for expansion individually (one API call per item), resulting in 15 sequential or parallel requests that are expensive and slow.

**Why it happens:**
- Developers test with fast connections and low API load during development
- The abbreviation expansion is easy to implement as a simple loop over items
- No timeout handling added during prototyping

**Consequences:**
- Perceived app failure at the most critical moment (everyone watching)
- Costs spiral: 15 API calls per receipt at table volume is unsustainable
- Timeout handling is retrofitted as an afterthought, creating inconsistent UX

**Prevention:**
- Batch all abbreviation expansion into a single LLM call: send the full item list as JSON, receive expanded names in one response. This is one API call per receipt, not N.
- Use structured output (JSON mode) so the response is predictable and parseable without retry logic.
- Show a loading state with receipt image visible: "Reading your receipt..." with a progress animation. Users accept 5-second waits if they see activity.
- Set a hard timeout (10–15 seconds). On timeout, show all items in their raw abbreviated form with an inline "Edit" affordance. Never block the flow completely.
- Server-side: implement the LLM call in an edge function with streaming response if latency is critical, so the UI can show items appearing one by one.
- Consider cost ceiling: set a max token budget per request and truncate very long receipts gracefully.

**Detection (warning signs):**
- One API call per item in a loop
- No loading state on the OCR/expansion step
- No timeout or error fallback — error throws to a blank screen
- No cost tracking per session

**Phase:** OCR/expansion pipeline phase. Batch call architecture must be designed from the start; retro-fitting from per-item to batched requires rewiring state management.

---

## Moderate Pitfalls

---

### Pitfall 5: Multi-User Session Conflict — Two People Claim the Same Item

**What goes wrong:**
In shareable-link mode, two people open the link simultaneously and both tap the same item ("BURGER $14"). Both sessions show the item as unselected, both claim it, and the server records it as claimed by both (or by whoever saved last). The split now charges the item twice.

A related failure: the host updates the item list (edits a price, removes a duplicate) while guests are mid-assignment. Guest sessions are operating on a stale item list.

**Why it happens:**
- Classic optimistic UI: each client assumes their local state is ground truth
- No real-time sync means sessions diverge silently
- No "claimed by" display means conflicts are invisible until the final total

**Consequences:**
- Items counted twice or not at all in the final split
- Confusion and disputes at the table — worse than manual splitting

**Prevention:**
- For v1 (single-driver mode), avoid this problem entirely: one person assigns items for everyone, no concurrent editing.
- If shareable-link mode is built, display "claimed by [name]" immediately when anyone taps an item — requires real-time sync (Supabase Realtime channels or similar).
- Implement optimistic locking: the server rejects a claim if the item state has changed since the client loaded it (use a version/timestamp field).
- Consider "assignment lock" UX: items turn visually unavailable once fully claimed (shared items show a count badge).
- Host-only edit mode: only the host can modify items; guests can only claim.

**Detection (warning signs):**
- No conflict resolution logic in assignment state
- Client-side state not synchronized after host edits
- Final calculation uses client-supplied item lists rather than server-authoritative state

**Phase:** Multi-user/sharing phase. For v1, single-driver mode sidesteps this entirely. Tackle conflict resolution only when implementing shareable links.

---

### Pitfall 6: Item Name Expansion Hallucination

**What goes wrong:**
LLMs confidently expand receipt abbreviations into wrong names. "CHKN SAND LG" might become "Chicken Sandwich (Large)" correctly, but "HB STEAK 8Z" might become "Hamburger Steak 8oz" when the restaurant calls it "House Blend Steak." The name on the receipt and the LLM's expansion are both plausible. Users can't verify without the physical menu.

A worse case: an item that is actually a discount or coupon code ("LOYAL DISC -5.00") gets expanded as a food item ("Loyal Discount Dish $-5.00") and confused for a negative-price food item rather than a discount.

**Why it happens:**
- LLMs optimize for confident, plausible responses, not uncertain ones
- Receipt abbreviations are ambiguous by design (POS systems truncate to fit thermal paper columns)
- The LLM has no restaurant-specific knowledge

**Consequences:**
- Users assign a wrongly named item to the wrong person
- Discount items misidentified as food items corrupt the subtotal math
- Trust erosion: "the app made things more confusing"

**Prevention:**
- Always show expanded names as editable fields, never as locked values. Users should tap to rename.
- In the LLM prompt, explicitly instruct the model to flag ambiguous items and return a `confidence` field. Surface low-confidence items with a visual indicator ("Tap to verify").
- Include a category field in the structured response (item / discount / fee / tax / tip) so discounts and fees are visually and mathematically treated differently from food items.
- The fallback flow (menu photo) exists specifically for this: show it prominently when confidence is low rather than only when the user requests it.

**Detection (warning signs):**
- LLM prompt returns plain strings only, no confidence or category
- No editable name fields in the item list
- Negative prices not handled separately from positive food prices

**Phase:** OCR/expansion pipeline phase.

---

### Pitfall 7: State Shape Complexity Explosion

**What goes wrong:**
The bill state starts simple: `[{item, price, claimedBy}]`. Then shared items arrive: `[{item, price, sharedAmong: [person1, person2]}]`. Then partial shares ("I had 2 drinks, she had 1"): quantity fractions. Then tip percentage changes after items are assigned. Then a guest edits a price. Each new requirement mutates the state shape, and components written against the old shape break or silently show stale data.

**Why it happens:**
- State designed for happy path, not for the full feature set
- Derived values (each person's subtotal, proportional tax/tip) computed inline in render instead of in a single calculation function
- No single source of truth: tip percentage stored in one component, item assignments in another, final totals recalculated in a third

**Consequences:**
- Changing tip rate doesn't update final totals displayed in a different component
- Adding a shared item requires touching 5 places
- Refactoring becomes a multi-day effort mid-project

**Prevention:**
- Define the canonical state shape before writing a single component. Minimum viable shape:
  ```
  {
    people: [{id, name}],
    items: [{id, name, priceCents, claims: [{personId, portions}]}],
    tipMode: 'percent' | 'amount',
    tipValue: number,  // cents if amount, integer percent if percent
    taxCents: number,
    discounts: [{id, name, amountCents}]
  }
  ```
- All derived values (subtotals, totals per person, proportional tip/tax) are pure functions of this state — never stored, always computed.
- Use a single calculation module that takes the full state and returns `{subtotalByPerson, taxByPerson, tipByPerson, totalByPerson}`. This is the single place that does math.
- Use a state manager (Zustand, Redux Toolkit, or React Context with `useReducer`) that enforces normalized shape from day one.

**Detection (warning signs):**
- Total per person calculated in the display component instead of a dedicated utility
- `tip` or `tax` stored as component `useState` separate from the bill state
- Adding a new person requires finding and updating multiple state atoms

**Phase:** Core state/architecture phase (Phase 1). Non-negotiable to get the shape right before building UI on top.

---

## Minor Pitfalls

---

### Pitfall 8: Receipt Has a Subtotal + Duplicate Tax/Tip Line Items

**What goes wrong:**
Many receipts print: individual items, then a "SUBTOTAL" line, then "TAX" as a line item, then "TIP" as a line item, then "TOTAL". OCR extracts all of these including the subtotal and total as separate "items." If not filtered, the app treats "SUBTOTAL $45.00" and "TOTAL $56.25" as orderable food items and inflates everyone's bill.

**Prevention:**
- In the LLM prompt and/or post-processing, explicitly classify each extracted line by type: `item | subtotal | tax | tip | total | fee | discount`. Only `item` type rows appear in the assignment UI.
- Populate the tip and tax fields automatically from extracted values, but make them editable.
- Remove subtotal and total rows from the claimable item list.

**Phase:** OCR/expansion pipeline.

---

### Pitfall 9: Image Size Causes API Timeout or Excessive Cost

**What goes wrong:**
Modern phone cameras produce 4MB+ JPEG images. Sending a 4MB image to a vision API endpoint has two problems: (1) large upload time on a restaurant WiFi connection, (2) increased token cost for vision models that charge by image resolution. An iPhone 14 at full resolution can cost 5–10x more tokens than a properly resized image with no accuracy improvement for OCR tasks.

**Prevention:**
- Client-side resize before upload: use `<canvas>` to resize to max 1200px on the longest dimension before sending to the API.
- Convert to JPEG at 0.85 quality after resize. Receipt text is still legible; file size drops from 4MB to ~150KB.
- This is done in-browser before upload, so no server-side processing step needed.

**Phase:** Camera capture phase.

---

### Pitfall 10: "Who Owes What" Screen Is Confusing Without Context

**What goes wrong:**
The final screen says "Sarah owes $34.50" but Sarah can't remember what she ordered. She disputes the amount. The host has to reconstruct who had what from memory. The summary screen without an itemized breakdown per person creates confusion and leads users to distrust the app even when the math is right.

**Prevention:**
- The final summary must be expandable: "Sarah — $34.50 [tap for breakdown]" → "Burger $14, Wine $12, share of Fries $4, tip $3.50, tax $1".
- Show the total receipt amount and confirm it matches the bill.
- Provide a "copy to clipboard" or "share" option for each person's breakdown so they can show their friends.

**Phase:** Final summary / UX phase.

---

### Pitfall 11: Proportional Tip Calculation When Someone Ordered Nothing

**What goes wrong:**
A guest at the table had only water and nothing on the receipt (e.g. they're the designated driver). Their subtotal is $0. Proportional tip/tax formula breaks: `$0 / $totalSubtotal * tipAmount = $0`, meaning they pay $0 toward tip. Some groups expect the tip to be split equally across all people; others expect it to be proportional. If the app silently uses one policy, users at the table may disagree.

**Prevention:**
- Offer an explicit choice: "Split tip proportionally to what each person ordered" vs "Split tip equally among all people." Default to proportional (it's fairer when orders vary widely, matching the stated product principle), but make the toggle visible.
- Handle the $0 subtotal edge case: if someone's items total $0, proportional gives them $0 tip/tax share. This is mathematically correct for proportional mode; show it clearly on their summary line.

**Phase:** Calculation/UX phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Core calculation engine | Floating-point rounding | Integer-cents arithmetic from day one |
| OCR/camera capture | iOS Safari one-strike permission | `<input type="file">` as primary, `getUserMedia` as enhancement |
| OCR/camera capture | Image file too large | Client-side canvas resize before API upload |
| OCR extraction | Subtotal/Total rows extracted as food items | LLM classification step with `type` field |
| AI name expansion | Hallucination / discount misclassification | Structured output with `confidence` + `type`, editable results |
| AI name expansion | Per-item API calls | Batch all items in one structured LLM call |
| Shared item / assignment UI | State shape drift | Define canonical state shape + pure calculation module before any UI |
| Shareable link mode | Concurrent claim conflicts | Single-driver v1; real-time sync + optimistic locking before shipping shareable links |
| Final summary screen | Users can't recall their items | Expandable per-person breakdown required |
| Tip/tax calculation | Zero-subtotal person | Explicit tip-split-mode toggle (proportional vs equal) |

---

## Sources

- MDN: `getUserMedia()` — https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN: `Number.prototype.toFixed()` — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed
- Python `decimal` module docs (floating-point money pitfalls) — https://docs.python.org/3/library/decimal.html
- MDN: `BroadcastChannel` and mobile tab suspension — https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- MDN: `<input type="file" capture>` — https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file
- Domain knowledge (HIGH confidence): thermal paper OCR degradation, iOS Safari camera permission behavior, LLM batching patterns, integer arithmetic for money
