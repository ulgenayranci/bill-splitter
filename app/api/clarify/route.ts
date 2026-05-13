import OpenAI from 'openai'
import { NextResponse } from 'next/server'

// Read OPENAI_API_KEY from server-only env. NEVER prefix with NEXT_PUBLIC_.
// (T-03-CL-04 mitigation)
// NOTE: Instantiated lazily inside POST (not at module level) to avoid build-time
// errors when OPENAI_API_KEY is not present during static page collection.
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

// Note the trailing space — rawName will be appended directly in quotes.
// (T-03-CL-02 mitigation: rawName wrapped in quotes to bound prompt injection.)
const CLARIFY_PROMPT_PREFIX = `You are looking at a restaurant menu image.
Below is an abbreviated item name from a receipt. Find that item on the menu and return its full name.

Return ONLY valid JSON matching this schema:
{ "displayName": string }

Rules:
- displayName: the full readable item name as printed on the menu. Examples: "Chicken Caesar Wrap", "Margherita Pizza".
- If the item is NOT clearly visible on the menu OR you cannot determine which item matches, return { "displayName": "" } — an empty string.
- Do NOT invent items. Do NOT guess if the menu does not show the item.

Receipt abbreviation: `

// Vercel Hobby tier allows up to 60s; 30s is generous for gpt-4o-mini vision.
// (T-03-CL-05 mitigation)
export const maxDuration = 30

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawName =
    body && typeof body === 'object' && 'rawName' in body
      ? (body as { rawName: unknown }).rawName
      : undefined
  if (typeof rawName !== 'string' || rawName.trim().length === 0 || rawName.length > 200) {
    return NextResponse.json({ error: 'Invalid rawName' }, { status: 400 })
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
            { type: 'text', text: `${CLARIFY_PROMPT_PREFIX}"${rawName}"` },
            { type: 'image_url', image_url: { url: image, detail: 'high' } },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'clarify_result',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              displayName: { type: 'string' },
            },
            required: ['displayName'],
            additionalProperties: false,
          },
        },
      },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      // D-09: even on empty GPT response, return 200 with empty displayName.
      // The client populates the edit field with the existing best guess as fallback.
      console.error('Clarify: empty response from gpt-4o-mini — returning empty displayName')
      return NextResponse.json({ displayName: '' })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('Clarify: response was not valid JSON — returning empty displayName')
      return NextResponse.json({ displayName: '' })
    }

    const displayName =
      parsed && typeof parsed === 'object' && typeof (parsed as { displayName?: unknown }).displayName === 'string'
        ? (parsed as { displayName: string }).displayName
        : ''

    return NextResponse.json({ displayName })
  } catch (err) {
    // OpenAI client error — return 500 generic. Per the test contract, only OpenAI THROW
    // produces 500; soft failures (empty content, malformed JSON, missing field) all
    // resolve to 200 + displayName: '' so the user lands on the edit field, not an error.
    // (T-03-CL-01 mitigation: never echo OpenAI internals to client)
    console.error('Clarify error:', err)
    return NextResponse.json({ error: 'Clarify failed' }, { status: 500 })
  }
}
