import OpenAI from 'openai'
import { NextResponse } from 'next/server'

// Read OPENAI_API_KEY from server-only env. NEVER prefix with NEXT_PUBLIC_.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const EXPAND_PROMPT = `You are a restaurant receipt item name expander.
Given a list of abbreviated receipt item names and their prices in cents, expand each name into a readable description.

Return ONLY valid JSON matching this schema:
{ "items": [{ "rawName": string, "displayName": string, "priceCents": integer, "confidence": "high" | "low" | "ambiguous" }] }

Rules:
- rawName: copy the input name EXACTLY, unchanged.
- displayName: full readable name. Examples: "CHKN SAND LG" -> "Chicken Sandwich (Large)", "FF" -> "French Fries", "DC" -> "Diet Coke".
- priceCents: copy the input priceCents EXACTLY, unchanged. Must be an integer.
- confidence: "high" if the expansion is unambiguous; "low" if you made an educated guess; "ambiguous" if you cannot determine the item.
- Return the SAME number of items as the input, in the SAME order.`

// Vercel Hobby tier allows up to 60s; 30s is generous for gpt-4o-mini on a receipt while keeping client-side overlay UX bounded.
export const maxDuration = 30

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const items =
    body && typeof body === 'object' && 'items' in body
      ? (body as { items: unknown }).items
      : undefined

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 100 ||
    !items.every(
      (i) =>
        i && typeof i === 'object' &&
        typeof (i as { name?: unknown }).name === 'string' &&
        Number.isInteger((i as { priceCents?: unknown }).priceCents)
    )
  ) {
    return NextResponse.json({ error: 'Invalid items' }, { status: 400 })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `${EXPAND_PROMPT}\n\nItems to expand:\n${JSON.stringify(items)}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'expanded_items',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    rawName: { type: 'string' },
                    displayName: { type: 'string' },
                    priceCents: { type: 'integer' },
                    confidence: {
                      type: 'string',
                      enum: ['high', 'low', 'ambiguous'],
                    },
                  },
                  required: ['rawName', 'displayName', 'priceCents', 'confidence'],
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
      console.error('Expand error: empty response from gpt-4o-mini')
      return NextResponse.json({ error: 'Expand failed' }, { status: 500 })
    }

    const parsed = JSON.parse(content) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as Record<string, unknown>).items)
    ) {
      console.error('Expand error: response did not match expected schema')
      return NextResponse.json({ error: 'Expand failed' }, { status: 500 })
    }

    const responseItems = ((parsed as { items: unknown[] }).items).filter(
      (i): i is { rawName: string; displayName: string; priceCents: number; confidence: 'high' | 'low' | 'ambiguous' } => {
        if (!i || typeof i !== 'object') return false
        const obj = i as Record<string, unknown>
        return (
          typeof obj.rawName === 'string' &&
          typeof obj.displayName === 'string' &&
          Number.isInteger(obj.priceCents) &&
          (obj.priceCents as number) > 0 &&
          typeof obj.confidence === 'string' &&
          (obj.confidence === 'high' || obj.confidence === 'low' || obj.confidence === 'ambiguous')
        )
      },
    )

    // Pitfall 2 / D-03: response item count must match request item count.
    // Mismatch indicates the LLM dropped/merged/added items — treat as expansion failure.
    if (responseItems.length !== (items as unknown[]).length) {
      console.error(`Expand error: count mismatch (sent ${(items as unknown[]).length}, got ${responseItems.length})`)
      return NextResponse.json({ error: 'Expand failed' }, { status: 500 })
    }

    return NextResponse.json({ items: responseItems })
  } catch (err) {
    // Log server-side only. Do NOT echo OpenAI internals to the client.
    console.error('Expand error:', err)
    return NextResponse.json({ error: 'Expand failed' }, { status: 500 })
  }
}
