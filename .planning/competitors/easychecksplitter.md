# Competitor Analysis: EasyCheckSplitter (privacy evaluation)

**Type:** Competitor app — data-privacy / architecture evaluation
**Date:** 2026-06-02
**Source:** [easychecksplitter.com/#about](https://easychecksplitter.com/#about)

## Their posture
- **Browser-local by default** — friends, items, fees, tips computed on-device.
- **Optional snapshots** — creating a share link saves data to a database for retrieval.
- **No accounts / no sign-in.**
- **OCR receipt scanning** exists, but the site **does not disclose** where images are
  processed ("The scanner is not perfect and will likely require manual adjustments").
- **Analytics:** Umami, "anonymous… no PII." Affiliate cookies. Bug reports optional
  name/email. Snapshot deletion by emailing the check ID.

> Their claim: "All calculations and data are stored and processed locally in your
> browser. If you create a snapshot, the data is saved to a database so it can be
> retrieved from the share link."

## Head-to-head
| Dimension | EasyCheckSplitter | Bill Splitter (us) |
|---|---|---|
| Compute model | Fully browser-local by default | Server-assisted (Next.js API routes) |
| Scan/OCR | Has OCR, undisclosed processing | Image → **OpenAI** (third party), not stored |
| What's stored | Nothing unless you make a snapshot → DB | Text-only session in Redis, **24h auto-expiry** |
| Accounts | None | None |
| Deletion | Email check ID | Automatic via TTL (better) |
| Explicit privacy claim | **Yes** | **None published** ← gap |

**Their edge:** a clear, plain-English privacy statement + local-first default.
**Our edge:** automatic 24h expiry (no indefinite snapshots, no manual delete), no image
ever persisted, `hostToken` kept server-side. Our *actual* privacy is arguably stronger
— we just don't tell anyone.

## Our data-flow audit (what triggered this)
Confirmed by tracing the code:
- `billImageUrl` is a browser-only `blob:` URL, revoked on replace (`useBillStore.ts:131`).
- OCR route forwards base64 to OpenAI, returns only `{ items }` — **no server-side
  storage** of the image (`app/api/ocr/route.ts`).
- Redis `SessionPayload` is **text-only** (people/items/claims/tips/…), 24h TTL, **no
  image field** (`lib/sessionSchema.ts`).
- **Nuance:** the full receipt image *is* transmitted to OpenAI (gpt-4o-mini vision) and
  can contain PII (card last-4, server name, location, timestamp). Currently undisclosed.

## Recommendations
1. Publish a short privacy blurb — honest story is a selling point given no-account demand.
   → Captured as todo: `.planning/todos/pending/2026-06-02-add-user-facing-privacy-disclosure.md`
2. Disclose the OpenAI hop (one line).
3. Verify OpenAI's current API retention/DPA terms before publishing claims.
4. Optional: avoid sending high-risk receipt regions (card-number footer) to OCR.
