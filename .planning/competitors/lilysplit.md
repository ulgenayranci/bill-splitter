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
1. **Product clarity — the main gap (per founder, 2026-06-02).** LilySplit reads as a
   *clearer, more focused* product than ours: a dead-simple async model (upload → tag →
   done) with fewer ways to get confused. Our richer feature set (real-time, host controls,
   disputes) risks feeling more complex. **This is the priority** — being addressed via a
   flow redesign in Claude design.
2. **Content/SEO engine** — ranking comparison articles, "how it works" posts. Distribution edge.

> **NOT a priority (founder, 2026-06-02):** Venmo / payment-settlement. We are **not
> targeting the US market**, so Venmo deep-linking is irrelevant. Ignore the
> "close the payment loop" framing from earlier Reddit research for our positioning.

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
1. **Product clarity is the #1 priority.** Match LilySplit's focus and simplicity without
   losing our depth — make the rich features (real-time, host controls) feel effortless, not
   complex. Founder is reworking the flow in Claude design.
2. **"No login / no install" is now table stakes, not a moat.** LilySplit markets it as hard
   as we'd planned to. We need a sharper wedge — clarity + AI quality.
3. **Lead differentiation on AI quality + collaboration depth** — abbreviation cleanup,
   real-time claiming, shared items, host controls. That's where they're thin.
4. **Currency / non-US focus is our lane.** We are explicitly *not* chasing the US market;
   LilySplit is US/Venmo-centric. P6 currency support aligns with this.
5. **Invest in SEO/comparison content eventually** — they're winning discovery.

> **Out of scope:** Venmo/payment settlement (not US-focused). See note above.

## Follow-up ideas (not yet captured as todos)
- Consider a side-by-side comparison landing page (the LilySplit playbook, turned on them).
