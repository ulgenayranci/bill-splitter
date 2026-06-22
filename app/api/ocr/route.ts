import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { reconcileScannedBill } from '@/lib/reconcileScannedBill'

// Read OPENAI_API_KEY from server-only env. NEVER prefix with NEXT_PUBLIC_.
// (T-2-01 mitigation — see 02-RESEARCH.md Security Domain.)
// Lazy initialization to avoid build-time errors when env var is absent.
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

const RECEIPT_PROMPT = `You are a receipt parser. Extract every line item and its price from this receipt image.
Return ONLY valid JSON matching this schema exactly:
{ "items": [{ "name": string, "quantity": number, "unitPriceCents": number | null, "lineTotalCents": number | null }], "currencyCode": string, "subtotalCents": number | null, "grandTotalCents": number | null }
Rules:
- All cents values must be integers (e.g. $12.99 -> 1299). NEVER use floats.
- quantity must be a positive integer (default 1 if not shown).
- unitPriceCents: the price per SINGLE unit, if the receipt prints a per-unit price. If only a line/extended total is shown, set unitPriceCents to null.
- lineTotalCents: the extended/line total for ALL units of this line (e.g. "2 × Beer 4.50 ... 9.00" -> lineTotalCents 900). If only a per-unit price is shown, set lineTotalCents to null.
- Provide whichever of unitPriceCents / lineTotalCents the receipt actually prints; set the other to null. Provide BOTH when both are printed. Do NOT compute or guess the missing one — leave it null.
- name should be a short readable description (3-6 words max).
- Exclude subtotals, tax, tip, and total lines from "items".
- Include EVERY line the receipt prints, in order — including repeated identical items (e.g. several separate "AYRAN" lines). Never skip, drop, or silently lose a duplicate. If you combine identical lines into one, raise its quantity so the line total still covers all of them.
- subtotalCents (top level): the printed PRE-TAX items subtotal — the figure the line items themselves should sum to, BEFORE any tax, service charge, or tip is added. Capture it only when the receipt prints a distinct pre-tax subtotal line; null if no separate subtotal is printed. Do not invent it.
- grandTotalCents (top level): the final printed total the customer pays, AFTER tax, service charge, and tip are added. Capture it whenever a final total line is printed; null only if the receipt prints no total at all. Do not invent it.
- Self-check before answering: the sum of all line totals (lineTotalCents, or unitPriceCents × quantity) should equal subtotalCents (the pre-tax items subtotal). If it does not, you have missed or miscounted a line — re-read and correct it.
- If you cannot read an item clearly, include your best guess.
- currencyCode: the receipt's currency as a 3-letter ISO 4217 code (e.g. "USD", "EUR", "GBP", "JPY"). Infer it from the currency symbol, tax wording, language, or locale on the receipt. If you cannot determine the currency, use "USD".`

// Vercel Hobby tier allows up to 60s. A failed-checksum scan triggers ONE retry
// pass (2 gpt-4.1-mini vision calls worst-case), so we budget the full 60s.
export const maxDuration = 60

/** Parsed + normalized shape the route returns to the client (contract unchanged). */
interface OcrItem {
  name: string
  quantity: number
  unitPriceCents: number | null
  lineTotalCents: number | null
}
interface OcrParsed {
  items: OcrItem[]
  currencyCode: string
  /** Printed PRE-TAX items subtotal in integer cents — the figure line items should sum to. */
  subtotalCents: number | null
  /** Final printed total (after tax/service/tip) in integer cents. */
  grandTotalCents: number | null
}

/**
 * The figure line items should reconcile against: the pre-tax subtotal when printed,
 * falling back to the grand total. `reconcileScannedBill` is agnostic — it just receives
 * this target as its `subtotalCents` option (locked decision 3).
 */
function reconcileTarget(pass: OcrParsed): number | null {
  return pass.subtotalCents ?? pass.grandTotalCents
}

// Coerce a candidate to a positive integer cents value, else null.
function toIntCentsOrNull(v: unknown): number | null {
  return Number.isInteger(v) && (v as number) > 0 ? (v as number) : null
}

/**
 * Coerce/normalize one raw OpenAI JSON content string into the route's response
 * shape. Returns null when the payload is missing/malformed (caller maps to 500).
 */
function parseOcrResponse(content: string | null | undefined): OcrParsed | null {
  if (!content) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as Record<string, unknown>).items)
  ) {
    return null
  }

  const items = (parsed as { items: unknown[] }).items
    .map((raw) => {
      const i = raw as Record<string, unknown>
      const name = typeof i.name === 'string' ? i.name : null
      const quantity =
        Number.isInteger(i.quantity) && (i.quantity as number) > 0 ? (i.quantity as number) : 1
      const unitPriceCents = toIntCentsOrNull(i.unitPriceCents)
      const lineTotalCents = toIntCentsOrNull(i.lineTotalCents)
      return { name, quantity, unitPriceCents, lineTotalCents }
    })
    .filter(
      (i): i is OcrItem =>
        // Drop a line only when it has NO usable price (both null) or no name.
        i.name !== null && (i.unitPriceCents !== null || i.lineTotalCents !== null),
    )

  // CURR-01 / D-01: normalize to an ISO 4217 code; fall back to app default (USD)
  // when the model can't determine the currency.
  const rawCode = (parsed as { currencyCode?: unknown }).currencyCode
  const currencyCode =
    typeof rawCode === 'string' && /^[A-Za-z]{3}$/.test(rawCode) ? rawCode.toUpperCase() : 'USD'

  const subtotalCents = toIntCentsOrNull((parsed as { subtotalCents?: unknown }).subtotalCents)
  const grandTotalCents = toIntCentsOrNull((parsed as { grandTotalCents?: unknown }).grandTotalCents)

  return { items, currencyCode, subtotalCents, grandTotalCents }
}

/**
 * Run ONE OpenAI OCR pass and return the parsed/normalized payload (or null on a
 * missing/malformed response). `extraInstruction`, when present, is appended to the
 * base prompt — used by the retry pass to tell the model about the checksum gap.
 */
async function runOcrPass(
  openai: OpenAI,
  image: string,
  extraInstruction?: string,
): Promise<OcrParsed | null> {
  const promptText = extraInstruction ? `${RECEIPT_PROMPT}\n\n${extraInstruction}` : RECEIPT_PROMPT
  const completion = await openai.chat.completions.create({
    // gpt-4.1-mini: bake-off across 3 real receipts beat gpt-4o-mini decisively
    // (correct quantities + unit-vs-line-total), and beat gpt-4o/gpt-4.1 too
    // (which catastrophically misread Turkish number formats). Same API key.
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: image, detail: 'high' } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'receipt_items',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'integer' },
                  // Nullable in strict mode is expressed via a type union; null is
                  // the "absent" signal (the receipt didn't print this figure).
                  unitPriceCents: { type: ['integer', 'null'] },
                  lineTotalCents: { type: ['integer', 'null'] },
                },
                // Strict mode requires EVERY property to appear in `required`;
                // optionality is encoded by the null union above, not by omission.
                required: ['name', 'quantity', 'unitPriceCents', 'lineTotalCents'],
                additionalProperties: false,
              },
            },
            currencyCode: { type: 'string' },
            subtotalCents: { type: ['integer', 'null'] },
            grandTotalCents: { type: ['integer', 'null'] },
          },
          required: ['items', 'currencyCode', 'subtotalCents', 'grandTotalCents'],
          additionalProperties: false,
        },
      },
    },
  })

  return parseOcrResponse(completion.choices[0]?.message?.content)
}

/** Absolute |target − reconciledSum| for a pass; Infinity when no truth figure exists. */
function passMismatchMagnitude(pass: OcrParsed): number {
  const { completeness } = reconcileScannedBill(pass.items, { subtotalCents: reconcileTarget(pass) })
  if (!completeness.hasSubtotal) return Infinity
  return Math.abs(completeness.deltaCents)
}

/** Format integer cents as a plain decimal string (e.g. 2297 -> "22.97") for the retry message. */
function formatCentsPlain(cents: number): string {
  return (cents / 100).toFixed(2)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const image =
    body && typeof body === 'object' && 'image' in body
      ? (body as { image: unknown }).image
      : undefined

  const DATA_URI_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/
  if (typeof image !== 'string' || image.length > 10_000_000 || !DATA_URI_RE.test(image)) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  try {
    const openai = getOpenAI()

    // Pass 1.
    const pass1 = await runOcrPass(openai, image)
    if (!pass1) {
      console.error('OCR error: empty/malformed response from gpt-4.1-mini (pass 1)')
      return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
    }

    // Reconcile pass 1 to decide whether a corrective retry is warranted. We only
    // retry when the receipt printed a truth figure (pre-tax subtotal, else grand
    // total) AND our reading does not reconcile to it — that gap is the strongest
    // signal of a missed/miscounted (often duplicate) line, the known weak spot.
    const target1 = reconcileTarget(pass1)
    const recon1 = reconcileScannedBill(pass1.items, { subtotalCents: target1 })

    let best = pass1
    if (target1 != null && recon1.completeness.mismatch) {
      const reconciledSum = recon1.completeness.reconciledSumCents
      const subtotal = target1
      const delta = Math.abs(recon1.completeness.deltaCents)
      const extraInstruction =
        `Your previous reading summed to ${formatCentsPlain(reconciledSum)} but the printed total is ` +
        `${formatCentsPlain(subtotal)} (off by ${formatCentsPlain(delta)}). You likely missed or ` +
        `miscounted a repeated line. Re-read every line — including identical duplicates — and return ` +
        `the corrected full list.`

      console.log(
        `OCR pass 1 checksum mismatch (delta ${delta} cents) — running corrective retry (pass 2)`,
      )

      try {
        const pass2 = await runOcrPass(openai, image, extraInstruction)
        if (pass2) {
          // Keep whichever pass reconciles closer to the printed total.
          best = passMismatchMagnitude(pass2) < passMismatchMagnitude(pass1) ? pass2 : pass1
          console.log(`OCR retry complete — kept ${best === pass2 ? 'pass 2' : 'pass 1'}`)
        } else {
          console.error('OCR retry (pass 2) returned empty/malformed response — keeping pass 1')
        }
      } catch (retryErr) {
        // A failed retry must never lose the usable pass-1 result.
        console.error('OCR retry (pass 2) threw — keeping pass 1:', retryErr)
      }
    }

    return NextResponse.json({
      items: best.items,
      currencyCode: best.currencyCode,
      subtotalCents: best.subtotalCents,
      grandTotalCents: best.grandTotalCents,
    })
  } catch (err) {
    // Log server-side only. Do NOT echo OpenAI internals to the client.
    console.error('OCR error:', err)
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  }
}
