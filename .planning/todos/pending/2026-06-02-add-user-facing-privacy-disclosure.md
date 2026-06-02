---
created: 2026-06-02T17:30:24.835Z
title: Add user-facing privacy disclosure
area: general
files:
  - app/api/ocr/route.ts
  - lib/sessionSchema.ts
  - stores/useBillStore.ts:131
---

## Problem

The app publishes **no privacy policy or user-facing disclosure**, yet a receipt
photo leaves the user's device. Data-flow audit (2026-06-02) confirmed:

- Scanned images are **never persisted** by us: `billImageUrl` is a browser-only
  `blob:` URL revoked on replace (`useBillStore.ts:131`); the OCR route forwards
  base64 to OpenAI and returns only `{ items }` (`app/api/ocr/route.ts`); the Redis
  `SessionPayload` is text-only (people/items/claims/tips/…) with a 24h TTL — no
  image field (`lib/sessionSchema.ts`).
- **BUT** the full receipt image is transmitted to **OpenAI (gpt-4o-mini vision)**
  for OCR. Receipts can contain PII (card last-4, server name, location, timestamp),
  and that third-party hop is currently undisclosed.

Competitor note: EasyCheckSplitter publishes a clear local-first privacy statement.
Our *actual* privacy is arguably stronger (auto 24h expiry, no image persisted) but
undisclosed — closing that gap is the high-ROI move. Reddit user research also shows
strong demand for no-account/private tools, so an honest privacy story doubles as
marketing.

Deferred to a future milestone/volume at the user's request (not needed now).

## Solution

- Add a short privacy section — a `/privacy` route or a footer note. Suggested copy:
  > "No login. Your photo is processed to read items and never stored — only the
  > item list is kept, and it auto-deletes in 24 hours."
- Disclose the OpenAI hop: one line stating the image is sent to an AI service to
  read it.
- Verify OpenAI's current API data-retention / DPA terms before publishing the claim
  (policies drift; standard policy is no-training + ~30d abuse-monitoring retention).
- Optional hardening: consider not sending high-risk receipt regions (card-number
  footer) to OCR.
