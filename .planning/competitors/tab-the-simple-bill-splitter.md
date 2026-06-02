# Competitor Analysis: Tab — The Simple Bill Splitter

**Type:** Competitor app (App Store review teardown)
**Date:** 2026-06-01
**Sources:**
- [App Store listing](https://apps.apple.com/us/app/tab-the-simple-bill-splitter/id595068606)
- [Ratings & Reviews](https://apps.apple.com/us/app/tab-the-simple-bill-splitter/id595068606?see-all=reviews&platform=iphone)
- [Google Play](https://play.google.com/store/apps/details?id=com.bring10.tab)
- [splitty vs Tab](https://splittyapp.com/vs/tab/)

## Snapshot
| | |
|---|---|
| Developer | bring10, LLC |
| Rating | 4.2 ★ from ~1.1K ratings |
| Price | Free |
| Last update | Feb 27, 2025 (v3.124.0) — 15+ months stale |
| Core loop | Snap receipt → OCR line items → tap to claim → auto tax/tip → real-time sync |

Tab is our **closest direct analog** — same fundamental loop as our app
(photo → items → each picks → totals). The incumbent we're implicitly competing with.

## What reviewers love (the bar to clear)
1. **Receipt scan kills manual entry** — most-praised feature. Table stakes; we have it.
2. **No-account claiming** — repeatedly the deciding factor. "Without everyone having
   to have an account or join the bill" (JannaH16, 5★). The feature people switch *for*.
3. **Effortless group math** — proportional tax/tip on the happy path.

## What reviewers complain about (our opportunities)
| Tab's pain point | Evidence | Our position |
|---|---|---|
| OCR misreads — dates/times as prices, subtotal & tax added as line items, phantom $58 tip | "terrible at itemizing" (2★, Christian Grant) | Our GPT-4o-mini cleanup pass is built to filter junk lines. Ensure it drops subtotal/tax/date rows. |
| Account/login required to save & join | Top complaint; competitors praised for not needing it | Our core bet — shareable link, guests just claim. Validated as #1 switching reason. |
| Can't upload an existing photo — must shoot in-app | "A major flaw is not being able to upload a previously taken photo" | Verify our gallery upload works (drop `capture` to allow it). Cheap win. |
| No per-person color coding | "would be perfect if each user had a different color" (Nserrano1999) | Already done — `AVATAR_COLORS`. |
| Can't edit tax / manual override | "inability to edit tax amounts" | Confirm edit flow covers tax/totals. |
| No partial / quantity splits | requested (5★, Rosentrotter) | Already done — quantity stepper + shared claiming. |
| Can't send itemized summary to non-app users | PDF/text sharing requested | Copy-summary partially covers; a read-only results link would close it. |

## The killer quote
> "Used to be good, much better options available these days… now I can't live without
> 'fairShare'… all my friends can pick their own items without downloading the app or
> needing a login." — LocalTraveler, May 2026

A churned Tab user; the reason is exactly our architecture (no-login, link-based,
accurate). Market is migrating away from account-gated incumbents.

## Strategic takeaways
1. Lead with "no app, no account — just tap your link." Proven #1 switching trigger.
2. OCR accuracy is where incumbents bleed; our AI-cleanup layer is the moat — worth a
   dedicated eval that it strips non-item lines.
3. Allow gallery upload, not just live capture.
4. Tab hasn't shipped in 15+ months — the incumbent is stagnant; there's an opening.
5. Our P6 currency recognition isn't even requested here — a differentiator outside the US.
