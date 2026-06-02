# Competitor Analysis: LilySplit

**Type:** Competitor app — direct, near-identical product
**Date:** 2026-06-02
**Sources:**
- [lilysplit.com](https://www.lilysplit.com/)
- [How Lily Split works](https://www.lilysplit.com/blog/how-lily-split-works)
- [The 4 Best Bill Splitting Apps (their own comparison)](https://www.lilysplit.com/blog/the-four-best-bill-splitting-apps)
- Also surfaced organically in the r/restaurant thread ("one person pays then we use LilySplit to Venmo").

## Why this one matters most
LilySplit is the **closest competitor to us by far** — same core thesis we're betting on:
**OCR receipt scan + no-login + no-install + shareable link.** They've already shipped it
and are actively SEO-marketing that exact positioning. Our "no app, just a link" wedge is
**not unique** — LilySplit owns it too. Differentiation now has to come from elsewhere.

## Their product
| | |
|---|---|
| Platform | Web app (login-free, install-free for everyone) |
| Core loop | Upload receipt → OCR itemizes → share link, friends tag their items → Venmo settle |
| Accounts | **None** — neither creator nor collaborators log in or install |
| OCR | Yes — "scan and itemize receipts, saving you the hassle of manual entry" |
| Claiming | **Async, link-based** — friends tag themselves, OR creator tags on their behalf |
| Payment | **Venmo deep-link** with amount + description pre-filled ← their standout |
| Tax/tip, quantity, shared items, currency, host controls | Not surfaced in their docs |
| Real-time sync | No — link tagging, not live collaboration |

Their own marketing claim:
> "LilySplit is the only bill splitting app that combines the power of OCR scanning with a
> truly seamless, login-free and install-free experience for all users."

Their comparison article pits them vs **Splitwise, Tab, Splid** on: free, OCR, no-login,
no-install (collaborator), no-install (owner) — and claims to be the only one ticking all boxes.

## Head-to-head with Bill Splitter
### Where THEY win / our gaps
1. **Payment settlement (Venmo deep-link, pre-filled amount).** They close the loop —
   tag → tap → Venmo opens with the exact amount. **We stop at "who owes what."** This is
   precisely the gap the Reddit research flagged (PaulWilczynski: *"how much to Venmo?"*).
   **Highest-priority thing to consider matching.**
2. **Content/SEO engine** — ranking comparison articles, "how it works" posts. Distribution edge.
3. **Dead-simple async model** — lower complexity than our real-time flow; fewer ways to confuse a casual user.

### Where WE win
1. **AI abbreviation expansion** ("CHKN SAND LG" → "Chicken Sandwich (Large)"). LilySplit
   only "itemizes" raw OCR — no cleanup. Our readability is a genuine quality differentiator.
2. **Real-time collaborative claiming** (live sync) vs their async link-tagging.
3. **Richer claiming model** — quantity steppers, shared items (multi-claimant), per-person
   tips, host approval / assign, edit-requests & disputes. They expose only flat "line items."
4. **Currency recognition (P6)** — they're Venmo/US-centric; we can serve non-US receipts.
5. **Auto-expiring sessions + no image persisted** — comparable privacy posture (see
   `easychecksplitter.md` for our audit).

## Strategic takeaways
1. **"No login / no install" is now table stakes, not a moat.** LilySplit markets it as hard
   as we'd planned to. We need a sharper wedge.
2. **Close the payment loop.** A pre-filled Venmo/iMessage/"ready-to-send who-owes-what"
   handoff would erase LilySplit's single biggest advantage and directly serve the universal
   pay-and-reimburse habit. Strong candidate for the roadmap.
3. **Lead differentiation on AI quality + collaboration depth** — abbreviation cleanup,
   real-time claiming, shared items, host controls. That's where they're thin.
4. **Currency is a clean flanking move** — own the non-US market they ignore.
5. **Invest in SEO/comparison content eventually** — they're winning discovery.

## Follow-up ideas (not yet captured as todos)
- Evaluate adding a Venmo/PayPal/iMessage payment-handoff with pre-filled amounts.
- Consider a side-by-side comparison landing page (the LilySplit playbook, turned on them).
