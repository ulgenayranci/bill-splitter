# Bill Splitter — UAT Checklist (Phase 11, round 5/6)

**App:** https://bill-splitter-eight-omega.vercel.app
**What this covers:** every change shipped in the 2026-06-21 session (the G1–G10 punch list + the OCR upgrade + the name-entry redesign).

## How to use this
1. **Hard-refresh the app first** (reload / pull-to-refresh) so you get the newest version.
2. Go through the tests **in order** — they follow the natural flow through the app.
3. For each test, mark the result: change `⬜` to ✅ (pass) or ❌ (fail), and jot a note if it fails.
4. A few tests need **a second phone** or a **special setup** — flagged inline.
5. When done, hand the failures back (just the test numbers, e.g. "#6 failed") and they'll be fixed.

---

## 🧾 SETUP SCREEN

### Test 1 — Name entry: inline "+" button (G5)
**Steps:**
1. On the first screen, find the **"Add a name…"** box.
2. Type a name (e.g. *Alice*) and tap the round **+** button on the right edge of the box.
3. Type another name (e.g. *Bob*) and press **Enter / Done** on the keyboard.

**✅ Expected:** Both names get added to the list. The **+ button is always visible** next to the box (faded when the box is empty, solid orange once you type). Both the **+ tap** and **Enter** add a name; after each add the box clears so you can type the next one.

**Result:** ✅  — notes:

---

### Test 2 — OCR accuracy (G2) ⭐ the important one
**Steps:**
1. Scan a real receipt (ideally one with **multi-quantity** lines, e.g. "Coffee ×3", "Beer ×2").
2. Compare the items the app shows against the paper receipt.

**✅ Expected:** Item names, **quantities**, and prices match the receipt. Multi-quantity lines show the correct **unit price AND line total** (e.g. 3 × 1,200 = 3,600), and the overall bill total matches the receipt's printed total.

**Result:** ✅ — Fixed in round-6 quick task 260622-hjb — OCR route now auto-retries once on a failed checksum (printed total vs reconciled sum) and keeps the closer pass before presenting to the user.

---

### Test 3 — "Invite your group" step (G4)
*Shows once, to the person who creates the bill.*

**Steps:**
1. After scanning + adding names, continue to create the bill.
2. You should land on an **"Invite your group"** screen.
3. Tap **Copy link** (should say "Copied!"). Tap **Share link** (your phone's share sheet should open). Tap **"Skip → claim items"**.
4. Reload the bill page.

**✅ Expected:** Copy and Share both work; "Skip → claim items" goes to the claiming screen. After reload, it goes **straight to claiming** — the invite screen does **not** show a second time.
*(To see the invite again, start a brand-new bill or use a fresh/incognito browser.)*

**Result:** ✅ — Fixed in round-6 quick task 260622-hjb — invite screen redesigned to app header + 3-segment progress bar (step 1) + Skip/Share link row only (Copy button and URL preview removed); amber/Geist layout matching the Figma below.

<details><summary>Original Figma CSS dump (kept for reference)</summary>

UI neeeds to change. user either share the link or skip inviting friends to the bill split. here is the code for the final design : /* 3. Invite  */

position: relative;
width: 286px;
height: 734.78px;



/* Background+Border+Shadow */

position: absolute;
width: 286px;
height: 600px;
left: 0px;
top: 36px;

background: #FFFFFF;
border-radius: 26px;


/* Background+HorizontalBorder */

position: absolute;
height: 44px;
left: 2px;
right: 2px;
top: 2px;

background: #FFFFFF;


/* easy-billsy */

position: absolute;
width: 70.55px;
height: 16px;
left: 14px;
top: calc(50% - 16px/2 - 1px);

font-family: 'Archivo';
font-style: normal;
font-weight: 400;
font-size: 15px;
line-height: 15px;
/* or 100% */
display: flex;
align-items: center;
letter-spacing: -0.375px;

color: #2B2926;



/* Horizontal Divider */

position: absolute;
width: 17px;
height: 1.5px;
left: 249px;
top: calc(50% - 1.5px/2 - 6px);

background: #DD6500;
border-radius: 2px;


/* Horizontal Divider */

position: absolute;
width: 17px;
height: 1.5px;
left: 249px;
top: calc(50% - 1.5px/2 - 0.5px);

background: #DD6500;
border-radius: 2px;


/* Horizontal Divider */

position: absolute;
width: 17px;
height: 1.5px;
left: 249px;
top: calc(50% - 1.5px/2 + 5px);

background: #DD6500;
border-radius: 2px;


/* Background */

position: absolute;
height: 4px;
left: 20px;
right: 184px;
top: 56px;

background: #DD6500;


/* Background */

position: absolute;
height: 4px;
left: 102px;
right: 102px;
top: 56px;

background: #E3DED3;


/* Background */

position: absolute;
height: 4px;
left: 184px;
right: 20px;
top: 56px;

background: #E3DED3;


/* Container */

position: absolute;
left: 0px;
right: 4px;
top: 70px;
bottom: -8px;



/* Invite your group */

position: absolute;
height: 19px;
left: 72px;
right: 73px;
top: 166px;

font-family: 'Archivo';
font-style: normal;
font-weight: 700;
font-size: 17px;
line-height: 18px;
/* identical to box height */
display: flex;
align-items: center;
letter-spacing: -0.17px;

color: #2B2926;



/* Send everyone the link so they can claim what they had from the bill. */

position: absolute;
height: 59px;
left: 26px;
right: 12px;
top: 201px;

font-family: 'Archivo';
font-style: normal;
font-weight: 500;
font-size: 13px;
line-height: 20px;
/* or 154% */
display: flex;
align-items: center;
letter-spacing: -0.17px;

color: rgba(43, 41, 38, 0.89);



/* Screenshot 2026-06-21 at 14.55.24 2 */

position: absolute;
width: 96px;
height: 81px;
left: 93px;
top: 64px;

background: url(Screenshot 2026-06-21 at 14.55.24.png);


/* Background+HorizontalBorder */

position: absolute;
height: 71px;
left: 0px;
right: 0px;
bottom: 176px;

background: #FFFFFF;


/* Background+Border */

box-sizing: border-box;

position: absolute;
height: 42px;
left: 16px;
right: 145px;
top: 15px;

background: #FFFFFF;
border: 1px solid #2B2926;
border-radius: 11px;


/* Skip */

position: absolute;
width: 33.34px;
height: 15px;
left: calc(50% - 33.34px/2 + 0.2px);
top: calc(50% - 15px/2);

font-family: 'Archivo';
font-style: normal;
font-weight: 600;
font-size: 14px;
line-height: 15px;
display: flex;
align-items: center;
text-align: center;

color: #2B2926;



/* Background+Border */

box-sizing: border-box;

position: absolute;
height: 42px;
left: 145px;
right: 16px;
top: 15px;

background: #DD6500;
border: 1px solid #DD6500;
border-radius: 11px;


/* Share link */

position: absolute;
width: 72.19px;
height: 15px;
left: calc(50% - 72.19px/2 + 0.16px);
top: calc(50% - 15px/2);

font-family: 'Archivo';
font-style: normal;
font-weight: 600;
font-size: 14px;
line-height: 15px;
display: flex;
align-items: center;
text-align: center;

color: #FFFFFF;



</details>

---

### Test 4 — Checksum warning (G2.3) ⚠️ situational
*Only appears when the scanned items don't add up to the receipt total — e.g. a receipt with many identical repeated lines that the scan miscounts. You may not see it every time.*

**Steps:**
1. Scan a receipt with several identical repeated items (e.g. 4× the same drink).
2. Watch for an amber warning banner on the setup screen.

**✅ Expected:** *If* the warning appears, it names the actual amounts — **"Your items add up to X, but the receipt total is Y…"** — not a vague message. (If it never appears, that's fine — it means the scan matched the total.)

**Result:** ✅ — notes: give me the complete edge and corner cases on false scan scenarios and warning messages for the errors.

---

## ✋ CLAIMING SCREEN

### Test 5 — Claimed item styling (G7)
**Steps:**
1. Claim an item (tap it / set its quantity to yours).

**✅ Expected:** The item's **name + quantity get a strikethrough**, but the card is **NOT greyed out / dimmed** — it stays clear and readable.

**Result:** ✅  — notes: there is an extra checked icon and claimed indicator on the right bottom of the claimed cards on the multiple numbered items. lets remove that from all the claimed items chips to reduce cognitive load. keep only x of n claimed indicator on the multipled items 

---

### Test 6 — Identity edit: Save / Cancel order (G10)
**Steps:**
1. Tap the people row at the top ("Who are you?" / change identity).
2. Edit a name so the **Save** and **Cancel** buttons appear.

**✅ Expected:** Buttons are **Cancel on the LEFT, Save (orange) on the RIGHT** — the standard order.

**Result:** ✅  — notes:

---

## 🏁 FINISHING

### Test 7 — "Finish anyway" wording (G8)
**Steps:**
1. With at least one item still unclaimed, tap **"I'm done"** → a warning dialog appears.

**✅ Expected:** The primary button reads **"Finish anyway"** (not "Continue anyway").

**Result:** ✅ — Fixed in round-6 quick task 260622-hjb — finish dialog redesigned per the jpeg: a Share bill link (outline) + Show my result (amber) button row, with a centered "Continue editing" text link underneath ("Finish anyway"/"Go back" retired).

---

### Test 8 — Results opens at the top (G9)
**Steps:**
1. On the claiming screen, scroll **down** a bit.
2. Finish the bill to reach the **Results** screen.

** ✅Expected:** The Results screen opens **scrolled to the very top** — not stuck at the position you were at.

**Result:** ✅  — notes:

---

### Test 9 — "Go back" wording (G6)
**Steps:**
1. On the **Results** screen, look at the bottom button bar.

**✅ Expected:** The button reads **"Go back"** (not "Edit bill"). Tapping it returns you to the claiming screen.

**Result:** ✅ — notes:

---

## 🔗 EXPIRED / BROKEN LINK

### Test 10 — Dead link auto-recovers (G3)
**Steps:**
1. In your browser's address bar, change the bill URL to a fake one — e.g. `…/split/garbagetest123`.
2. Try it **twice**: once as the person who made a bill, and once in an **incognito/private window** (a "guest" with no bill).

**✅ Expected:** In **both** cases, instead of a dead-end "session expired" screen, the app **automatically takes you to a fresh scan screen** with a small notice: **"That link expired — here's a fresh start."**

**Result:** ✅  — notes:

---

## Notes
- Tests **3 (sharing to others)** and full multi-person claiming are best done with **a second phone**.
- If a test fails, note the **number** and what you saw — that's all that's needed to fix it.
- Tests shipped in commits `681089b`–`ae8ffc6` (G1–G10 + OCR upgrade gpt-4.1-mini + name-entry redesign).
