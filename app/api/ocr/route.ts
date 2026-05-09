import OpenAI from 'openai'
import { NextResponse } from 'next/server'

// Read OPENAI_API_KEY from server-only env. NEVER prefix with NEXT_PUBLIC_.
// (T-2-01 mitigation — see 02-RESEARCH.md Security Domain.)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const RECEIPT_PROMPT = `You are a receipt parser. Extract every line item and its price from this receipt image.
Return ONLY valid JSON matching this schema exactly:
{ "items": [{ "name": string, "priceCents": number }] }
Rules:
- priceCents must be an integer (e.g. $12.99 -> 1299)
- name should be a short readable description (3-6 words max)
- Exclude subtotals, tax, tip, and total lines
- If you cannot read an item clearly, include your best guess`

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
                    priceCents: { type: 'integer' },
                  },
                  required: ['name', 'priceCents'],
                  additionalProperties: false,
                },
              },
            },
            required: ['items'],
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
    const items = ((parsed as { items: unknown[] }).items).filter(
      (i): i is { name: string; priceCents: number } =>
        typeof (i as Record<string, unknown>).name === 'string' &&
        Number.isInteger((i as Record<string, unknown>).priceCents) &&
        (i as { priceCents: number }).priceCents > 0,
    )
    return NextResponse.json({ items })
  } catch (err) {
    // Log server-side only. Do NOT echo OpenAI internals to the client.
    console.error('OCR error:', err)
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  }
}
