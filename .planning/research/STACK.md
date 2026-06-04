# Stack Research

**Domain:** v2.0 easy-billsy — currency recognition + flat collaborative model
**Researched:** 2026-06-04
**Confidence:** HIGH — all recommendations grounded in existing validated stack + native browser APIs + verified OCR schema extension

---

## Context: What is Already in Place

This is a SUBSEQUENT MILESTONE research file. The following stack is validated and shipped — do not re-evaluate unless a v2 feature creates a real conflict.

| Layer | Validated Choice |
|-------|-----------------|
| Framework | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Client state | Zustand 5 |
| Session storage | Upstash Redis (serverless KV, 24h TTL, atomic Lua eval claim writes) |
| OCR + AI | OpenAI GPT-4o-mini vision (single API call, structured JSON output) |
| Supporting | browser-image-compression, SWR (3s polling), nanoid |
| Hosting | Vercel |

---

## v2.0 New Features and Stack Impact

### Feature 1 — Currency Recognition

**What it needs:** Detect the receipt's currency, then render all monetary amounts in that currency throughout the app.

#### Recommendation: Extend the OCR prompt schema; use `Intl.NumberFormat` for rendering

No new dependency is warranted. Here is the full approach:

**Step 1 — OCR prompt extension (one field added to `RECEIPT_PROMPT` schema):**

Add `"currencyCode": string` to the JSON schema in `app/api/ocr/route.ts`. Instruct GPT-4o-mini to return the ISO 4217 three-letter currency code detected from the receipt (e.g. `"USD"`, `"EUR"`, `"GBP"`, `"JPY"`). Fallback default: `"USD"`.

Why ask for the ISO code and not the symbol? Because symbol-to-code lookup is inherently ambiguous — `$` maps to USD, CAD, AUD, HKD, SGD, and more. The model reads the full receipt context (location cues, language, price formatting) and can resolve to the correct ISO code with high accuracy. This avoids any reverse-lookup library entirely.

Updated schema addition:
```typescript
currencyCode: { type: 'string' }  // added alongside existing `items` array
```

Updated prompt rule addition: `"- currencyCode must be an ISO 4217 three-letter code (e.g. USD, EUR, GBP, JPY). If uncertain, default to USD."`

**Step 2 — `formatCents` upgrade (`lib/billMath.ts`):**

Replace the hardcoded `$` with `Intl.NumberFormat`. Signature changes from:
```typescript
formatCents(cents: number): string
```
to:
```typescript
formatCents(cents: number, currencyCode: string): string
```

Implementation:
```typescript
export function formatCents(cents: number, currencyCode: string): string {
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
  })
  // Intl.NumberFormat knows decimal places per currency (JPY=0, USD=2, etc.)
  const fractionDigits = formatter.resolvedOptions().minimumFractionDigits
  return formatter.format(cents / Math.pow(10, fractionDigits))
}
```

`Intl.NumberFormat` is a native browser API available in all modern browsers and Node.js. It handles:
- Decimal precision per currency (JPY = 0, USD = 2, KWD = 3)
- Symbol placement (leading vs trailing)
- Locale-appropriate separators
- Narrow symbols where needed

**Step 3 — Zustand store + Redis session schema:** Add `currencyCode: string` (default `'USD'`) as a top-level field to both `SessionPayload` and the Zustand bill store. This is a one-line addition to each.

**What NOT to do:**
- Do not add `currency-symbol-map` or any npm currency library. `currency-symbol-map` v5.1.0 explicitly removed reverse-lookup support (removed in changelog) and was last published May 2022 with no active maintenance.
- Do not try to infer currency from the symbol string returned by the OCR — too ambiguous.
- Do not add `dinero.js` or `money.js` — all arithmetic stays as integer cents; `Intl.NumberFormat` covers all display needs.

**Confidence:** HIGH — `Intl.NumberFormat` is a W3C standard, universally supported (caniuse baseline: all modern browsers), and handles subunit-zero currencies (JPY, KRW) correctly by design. GPT-4o-mini structured output with `response_format: json_schema` is confirmed to support vision + JSON schema simultaneously (OpenAI docs).

---

### Feature 2 — Flat Collaborative Model (Remove Host Role)

**What it needs:** Anyone who opens the link can claim items. No host approval, no edit requests, no disputes.

#### Recommendation: Schema surgery only — no new dependencies

This is a removal operation, not an addition. The impact is:

**`lib/sessionSchema.ts` changes:**
- Remove `hostToken: string` field from `SessionPayload`
- Remove `hostPersonId?: PersonId` field
- Remove `editRequests: Record<string, EditRequest>` field
- Remove `disputes: Record<string, Dispute>` field
- Remove the `EditRequest` interface
- Remove the `Dispute` interface
- Remove `ClaimEntry.assignedBy: 'self' | 'host'` and `ClaimEntry.accepted?: boolean` — with no host, all claims are self-assigned

**`SessionClaims` shape simplification:**
```typescript
export interface ClaimEntry {
  qty: number
  // assignedBy and accepted removed — flat model, all claims are peer claims
}
```

**Redis session writes:** The Lua eval atomic claim scripts can stay — they enforce `qty <= item.quantity` invariant which is still valid. Remove any Lua paths that check `assignedBy === 'host'` or gate writes on `hostToken`.

**SWR polling:** No change needed — 3s polling continues to serve real-time updates. The flat model reduces server-side write complexity (no approval queue), so polling latency is unaffected.

**What NOT to do:**
- Do not add a WebSocket library (socket.io, Pusher, etc.) for "better real-time." SWR 3s polling is validated and sufficient for table-side bill splitting. The round-trip for a claim is fast enough. Adding WS would double the operational surface for marginal UX gain.
- Do not add an optimistic update library — the existing Zustand + SWR pattern handles this; `onMutate` callbacks in SWR are sufficient if you want instant local feedback.

**Confidence:** HIGH — this is a schema simplification of existing validated code.

---

### Feature 3 — Scan-First Setup Screen + "Who Are You?" Identity Modal

**What it needs:** A restructured UI flow. The existing stack handles this with no additions.

- Existing shadcn/ui `Dialog` component covers the identity modal
- Existing Zustand store covers session/identity state
- Native `<input capture="environment">` covers the scan action

No new dependencies.

---

### Feature 4 — easy-billsy App Shell (Header + Hamburger Menu)

**What it needs:** A persistent header with wordmark and hamburger nav (New Split / History / About Us).

- shadcn/ui `Sheet` component (already in the copy-paste model) is the correct primitive for a mobile slide-out menu
- No routing library changes needed — Next.js App Router handles `History` as a stub route returning a "coming soon" view

No new dependencies.

---

## Recommended Stack: v2.0 Delta

### Core Technologies (Unchanged)

All existing core technologies remain. No version upgrades required.

### Changes to Existing Code (Not New Dependencies)

| Area | Change | Why |
|------|--------|-----|
| `app/api/ocr/route.ts` — `RECEIPT_PROMPT` | Add `currencyCode: string` to JSON schema and prompt rules | Currency detection at source |
| `lib/billMath.ts` — `formatCents` | Add `currencyCode: string` parameter; use `Intl.NumberFormat` | Replace hardcoded `$` |
| `lib/sessionSchema.ts` | Remove `hostToken`, `hostPersonId`, `editRequests`, `disputes`, `EditRequest`, `Dispute`; simplify `ClaimEntry` | Flat model cleanup |
| Zustand bill store | Add `currencyCode: string` field (default `'USD'`) | Currency threading |
| `SessionPayload` | Add `currencyCode: string` field | Persist currency for guests opening shared link |
| Redis Lua eval scripts | Remove host-gated write paths | Flat model no longer has host authority |

### New Dependencies: NONE

No new npm packages are needed for v2.0.

### Supporting Libraries (Unchanged)

| Library | Version | Purpose |
|---------|---------|---------|
| browser-image-compression | 2.x | Still needed for receipt photo compression before OCR |
| SWR | current | Still needed for 3s claim polling |
| nanoid | current | Still needed for session and person IDs |

---

## What NOT to Add

| Do Not Add | Why |
|------------|-----|
| `currency-symbol-map` | Removed reverse-lookup in v5.x (the feature you need); unmaintained since 2022 |
| `dinero.js` | Full monetary arithmetic library; overkill — all math is integer cents, display is `Intl.NumberFormat` |
| `money.js` | Same — overkill for a display-only problem |
| `socket.io` / Pusher / Ably | SWR 3s polling is validated for this use case; WS doubles ops surface for no meaningful UX gain at table-side latency |
| Any i18n library (`react-intl`, `i18next`) | The only i18n requirement is currency formatting; `Intl.NumberFormat` covers it natively |
| `react-webcam` | Still not needed; native `<input capture>` remains the right choice |

---

## Integration Points

### OCR Route → Currency Code Flow

```
Receipt image
  → POST /api/ocr
  → GPT-4o-mini vision (structured output: { items[], currencyCode })
  → API route validates currencyCode is 3 uppercase letters (fallback: 'USD')
  → Returned to client alongside items
  → Stored in Zustand store + SessionPayload.currencyCode
  → formatCents(cents, currencyCode) called wherever amounts are rendered
```

### formatCents Call Sites

Every component currently calling `formatCents(cents)` needs updating to `formatCents(cents, currencyCode)`. The `currencyCode` is read from Zustand store. This is a mechanical find-and-replace; TypeScript will surface all call sites as type errors the moment the signature changes, making the migration exhaustive and safe.

---

## Version Compatibility

No version changes to existing stack. `Intl.NumberFormat` with `style: 'currency'` and `resolvedOptions()` is available in all browsers supported by Next.js 16 (no IE support required). The `minimumFractionDigits` resolved option correctly returns 0 for JPY, 2 for USD/EUR/GBP, 3 for KWD — no manual lookup table needed.

---

## Sources

- [MDN: Intl.NumberFormat constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat) — currency style, resolvedOptions, subunit handling (HIGH confidence)
- [OpenAI: Introducing Structured Outputs in the API](https://openai.com/index/introducing-structured-outputs-in-the-api/) — JSON schema + vision compatibility confirmed (HIGH confidence)
- [OpenAI: Structured model outputs](https://platform.openai.com/docs/guides/structured-outputs) — gpt-4o-mini schema enforcement confirmed (HIGH confidence)
- [GitHub: bengourley/currency-symbol-map](https://github.com/bengourley/currency-symbol-map) — reverse lookup removed in v5.x, last published May 2022, not maintained (HIGH confidence — changelog reviewed)
- Existing codebase: `lib/billMath.ts`, `lib/sessionSchema.ts`, `app/api/ocr/route.ts` — direct inspection of current schema and prompt

---

*Stack research for: easy-billsy v2.0 currency recognition + flat collaborative model*
*Researched: 2026-06-04*
