import { describe, it, expect, beforeEach, vi } from 'vitest'

process.env.OPENAI_API_KEY = 'test-key'

// vi.mock MUST be set up before the route module is imported. Vitest hoists
// vi.mock factory calls above all imports, but we still call POST through a
// dynamic import inside each test so the mock applies before module init.
const createMock = vi.fn()

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: createMock } }
      constructor() {}
    },
  }
})

beforeEach(() => {
  vi.resetModules()
  createMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function callPOST(body: unknown): Promise<{ status: number; json: unknown }> {
  const { POST } = await import('@/app/api/ocr/route')
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
  const req = new Request('http://localhost/api/ocr', init)
  const res = await POST(req)
  const json = await res.json()
  return { status: res.status, json }
}

describe('app/api/ocr/route.ts (POST handler)', () => {
  it('returns 200 with parsed items + detected currency on a successful gpt-4.1-mini call', async () => {
    // Expanded contract: per-line unitPriceCents + lineTotalCents (either nullable)
    // and a top-level subtotalCents (nullable). The route returns them unchanged
    // after coercing non-positive-integers to null; reconciliation is client-side.
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                { name: 'Burger', quantity: 1, unitPriceCents: 1299, lineTotalCents: null },
                { name: 'Fries', quantity: 2, unitPriceCents: 499, lineTotalCents: 998 },
              ],
              currencyCode: 'EUR',
              subtotalCents: 2297,
            }),
          },
        },
      ],
    })

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })

    expect(status).toBe(200)
    expect(json).toEqual({
      items: [
        { name: 'Burger', quantity: 1, unitPriceCents: 1299, lineTotalCents: null },
        { name: 'Fries', quantity: 2, unitPriceCents: 499, lineTotalCents: 998 },
      ],
      currencyCode: 'EUR',
      subtotalCents: 2297,
    })
    expect(createMock).toHaveBeenCalledTimes(1)
    const callArgs = createMock.mock.calls[0][0]
    expect(callArgs.model).toBe('gpt-4.1-mini')
    expect(callArgs.response_format.type).toBe('json_schema')
    expect(callArgs.response_format.json_schema.strict).toBe(true)
    // CURR-01: currencyCode is part of the strict schema contract.
    expect(callArgs.response_format.json_schema.schema.required).toContain('currencyCode')
    // Scan-guardrail contract: new fields are part of the strict schema.
    expect(callArgs.response_format.json_schema.schema.required).toContain('subtotalCents')
    const itemRequired = callArgs.response_format.json_schema.schema.properties.items.items.required
    expect(itemRequired).toContain('unitPriceCents')
    expect(itemRequired).toContain('lineTotalCents')
  })

  it('drops a line only when BOTH unitPriceCents and lineTotalCents are null', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                { name: 'Keeper', quantity: 1, unitPriceCents: 500, lineTotalCents: null },
                { name: 'NoPrice', quantity: 1, unitPriceCents: null, lineTotalCents: null },
                { name: 'AlsoKeeper', quantity: 3, unitPriceCents: null, lineTotalCents: 900 },
              ],
              currencyCode: 'USD',
              subtotalCents: null,
            }),
          },
        },
      ],
    })

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })
    expect(status).toBe(200)
    const items = (json as { items: { name: string }[] }).items
    expect(items.map((i) => i.name)).toEqual(['Keeper', 'AlsoKeeper'])
    expect((json as { subtotalCents: number | null }).subtotalCents).toBeNull()
  })

  it('normalizes the currency code to uppercase ISO 4217 (CURR-01 / D-01)', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [{ name: 'Tea', priceCents: 300, quantity: 1 }],
              currencyCode: 'gbp',
            }),
          },
        },
      ],
    })

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })
    expect(status).toBe(200)
    expect((json as { currencyCode: string }).currencyCode).toBe('GBP')
  })

  it('falls back to USD when the model omits/garbles the currency (D-01)', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [{ name: 'Tea', priceCents: 300, quantity: 1 }],
              currencyCode: '$$',
            }),
          },
        },
      ],
    })

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })
    expect(status).toBe(200)
    expect((json as { currencyCode: string }).currencyCode).toBe('USD')
  })

  it('returns 400 when the image field is missing from the body', async () => {
    const { status, json } = await callPOST({})
    expect(status).toBe(400)
    expect(json).toEqual({ error: 'No image provided' })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the image field is not a string', async () => {
    const { status, json } = await callPOST({ image: 12345 })
    expect(status).toBe(400)
    expect(json).toEqual({ error: 'No image provided' })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('returns 400 when the request body is not valid JSON', async () => {
    const { status } = await callPOST('not-json')
    expect(status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('returns 500 with a generic error when OpenAI throws', async () => {
    createMock.mockRejectedValue(new Error('OpenAI internal: rate-limited xyz123'))

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })

    expect(status).toBe(500)
    expect(json).toEqual({ error: 'OCR failed' })
    // The thrown error message must NOT leak into the response body
    // (T-2-04 mitigation: prevent OpenAI error details exposure).
    expect(JSON.stringify(json)).not.toContain('rate-limited')
    expect(JSON.stringify(json)).not.toContain('xyz123')
  })

  it('returns 500 when OpenAI returns malformed JSON content', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'not actually json {{{' } }],
    })

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })

    expect(status).toBe(500)
    expect(json).toEqual({ error: 'OCR failed' })
  })

  it('returns 500 when OpenAI returns empty/null content', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
    })

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })

    expect(status).toBe(500)
    expect(json).toEqual({ error: 'OCR failed' })
  })

  // ── Auto-retry on failed checksum (G2 / UAT Test 2) ─────────────────────────

  function mockContent(payload: unknown) {
    return { choices: [{ message: { content: JSON.stringify(payload) } }] }
  }

  it('does NOT retry when pass 1 reconciles to the printed subtotal (clean scan)', async () => {
    // Two lines summing to 2000 with a printed subtotal of 2000 — no mismatch.
    createMock.mockResolvedValue(
      mockContent({
        items: [
          { name: 'Burger', quantity: 1, unitPriceCents: null, lineTotalCents: 1200 },
          { name: 'Fries', quantity: 1, unitPriceCents: null, lineTotalCents: 800 },
        ],
        currencyCode: 'USD',
        subtotalCents: 2000,
      }),
    )

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })

    expect(status).toBe(200)
    // Single pass — no retry.
    expect(createMock).toHaveBeenCalledTimes(1)
    const items = (json as { items: { name: string }[] }).items
    expect(items.map((i) => i.name)).toEqual(['Burger', 'Fries'])
  })

  it('retries once on checksum mismatch and passes through the corrected pass', async () => {
    // Pass 1 misses a duplicate line: sums to 1200 vs printed 2400 (mismatch).
    // Pass 2 (with the corrective instruction) re-reads the duplicate -> sums to 2400.
    createMock
      .mockResolvedValueOnce(
        mockContent({
          items: [{ name: 'Ayran', quantity: 1, unitPriceCents: null, lineTotalCents: 1200 }],
          currencyCode: 'TRY',
          subtotalCents: 2400,
        }),
      )
      .mockResolvedValueOnce(
        mockContent({
          items: [
            { name: 'Ayran', quantity: 1, unitPriceCents: null, lineTotalCents: 1200 },
            { name: 'Ayran', quantity: 1, unitPriceCents: null, lineTotalCents: 1200 },
          ],
          currencyCode: 'TRY',
          subtotalCents: 2400,
        }),
      )

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })

    expect(status).toBe(200)
    expect(createMock).toHaveBeenCalledTimes(2)
    // The retry's corrective instruction is appended to the prompt text.
    const retryPromptText = createMock.mock.calls[1][0].messages[0].content[0].text as string
    expect(retryPromptText).toContain('printed total')
    expect(retryPromptText).toContain('identical duplicates')
    // Corrected (closer) pass is returned.
    const items = (json as { items: { name: string }[] }).items
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.name)).toEqual(['Ayran', 'Ayran'])
  })

  it('keeps the best (closest) pass when the retry is still mismatched', async () => {
    // Printed total 2400. Pass 1 off by 1200 (one line). Pass 2 off by only 400
    // (still short, but closer) — pass 2 must be kept. Caps at 2 passes.
    createMock
      .mockResolvedValueOnce(
        mockContent({
          items: [{ name: 'Ayran', quantity: 1, unitPriceCents: null, lineTotalCents: 1200 }],
          currencyCode: 'TRY',
          subtotalCents: 2400,
        }),
      )
      .mockResolvedValueOnce(
        mockContent({
          items: [
            { name: 'Ayran', quantity: 1, unitPriceCents: null, lineTotalCents: 1200 },
            { name: 'Ayran', quantity: 1, unitPriceCents: null, lineTotalCents: 800 },
          ],
          currencyCode: 'TRY',
          subtotalCents: 2400,
        }),
      )

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })

    expect(status).toBe(200)
    expect(createMock).toHaveBeenCalledTimes(2)
    const items = (json as { items: { name: string }[] }).items
    // Pass 2 reconciles closer (sum 2000 vs 1200) -> kept.
    expect(items).toHaveLength(2)
  })

  it('does NOT retry when no printed subtotal exists (checksum cannot run)', async () => {
    createMock.mockResolvedValue(
      mockContent({
        items: [{ name: 'Coffee', quantity: 1, unitPriceCents: null, lineTotalCents: 350 }],
        currencyCode: 'USD',
        subtotalCents: null,
      }),
    )

    const { status } = await callPOST({ image: 'data:image/jpeg;base64,abc' })
    expect(status).toBe(200)
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to pass 1 when the retry call throws', async () => {
    createMock
      .mockResolvedValueOnce(
        mockContent({
          items: [{ name: 'Ayran', quantity: 1, unitPriceCents: null, lineTotalCents: 1200 }],
          currencyCode: 'TRY',
          subtotalCents: 2400,
        }),
      )
      .mockRejectedValueOnce(new Error('retry rate-limited'))

    const { status, json } = await callPOST({ image: 'data:image/jpeg;base64,abc' })

    expect(status).toBe(200)
    expect(createMock).toHaveBeenCalledTimes(2)
    const items = (json as { items: { name: string }[] }).items
    expect(items).toHaveLength(1)
  })
})
