import OpenAI from 'openai'
import { NextResponse } from 'next/server'

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
{ "items": [{ "name": string, "quantity": number, "unitPriceCents": number | null, "lineTotalCents": number | null }], "currencyCode": string, "subtotalCents": number | null }
Rules:
- All cents values must be integers (e.g. $12.99 -> 1299). NEVER use floats.
- quantity must be a positive integer (default 1 if not shown).
- unitPriceCents: the price per SINGLE unit, if the receipt prints a per-unit price. If only a line/extended total is shown, set unitPriceCents to null.
- lineTotalCents: the extended/line total for ALL units of this line (e.g. "2 × Beer 4.50 ... 9.00" -> lineTotalCents 900). If only a per-unit price is shown, set lineTotalCents to null.
- Provide whichever of unitPriceCents / lineTotalCents the receipt actually prints; set the other to null. Provide BOTH when both are printed. Do NOT compute or guess the missing one — leave it null.
- name should be a short readable description (3-6 words max).
- Exclude subtotals, tax, tip, and total lines from "items".
- subtotalCents (top level): the printed items subtotal (pre-tax/pre-tip) in integer cents, or null if the receipt does not print one. Do not invent it.
- If you cannot read an item clearly, include your best guess.
- currencyCode: the receipt's currency as a 3-letter ISO 4217 code (e.g. "USD", "EUR", "GBP", "JPY"). Infer it from the currency symbol, tax wording, language, or locale on the receipt. If you cannot determine the currency, use "USD".`

// Vercel Hobby tier allows up to 60s; 30s is generous for gpt-4o-mini vision
// on a ~500KB receipt image while keeping client-side overlay UX bounded.
export const maxDuration = 30

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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: RECEIPT_PROMPT },
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
            },
            required: ['items', 'currencyCode', 'subtotalCents'],
            additionalProperties: false,
          },
        },
      },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      console.error('OCR error: empty response from gpt-4o-mini')
      return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
    }

    const parsed = JSON.parse(content) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as Record<string, unknown>).items)
    ) {
      console.error('OCR error: response did not match expected schema')
      return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
    }
    // Coerce a candidate to a positive integer cents value, else null.
    const toIntCentsOrNull = (v: unknown): number | null =>
      Number.isInteger(v) && (v as number) > 0 ? (v as number) : null

    const items = ((parsed as { items: unknown[] }).items)
      .map((raw) => {
        const i = raw as Record<string, unknown>
        const name = typeof i.name === 'string' ? i.name : null
        const quantity = Number.isInteger(i.quantity) && (i.quantity as number) > 0 ? (i.quantity as number) : 1
        const unitPriceCents = toIntCentsOrNull(i.unitPriceCents)
        const lineTotalCents = toIntCentsOrNull(i.lineTotalCents)
        return { name, quantity, unitPriceCents, lineTotalCents }
      })
      .filter(
        (i): i is { name: string; quantity: number; unitPriceCents: number | null; lineTotalCents: number | null } =>
          // Drop a line only when it has NO usable price (both null) or no name.
          i.name !== null && (i.unitPriceCents !== null || i.lineTotalCents !== null),
      )

    // CURR-01 / D-01: normalize to an ISO 4217 code; fall back to app default (USD)
    // when the model can't determine the currency.
    const rawCode = (parsed as { currencyCode?: unknown }).currencyCode
    const currencyCode =
      typeof rawCode === 'string' && /^[A-Za-z]{3}$/.test(rawCode)
        ? rawCode.toUpperCase()
        : 'USD'

    // Top-level printed items subtotal (integer cents) or null.
    const subtotalCents = toIntCentsOrNull((parsed as { subtotalCents?: unknown }).subtotalCents)

    return NextResponse.json({ items, currencyCode, subtotalCents })
  } catch (err) {
    // Log server-side only. Do NOT echo OpenAI internals to the client.
    console.error('OCR error:', err)
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  }
}
