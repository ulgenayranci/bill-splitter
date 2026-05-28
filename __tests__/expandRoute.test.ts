import { describe, it, expect, beforeEach, vi } from 'vitest'

process.env.OPENAI_API_KEY = 'test-key'

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
  const { POST } = await import('@/app/api/expand/route')
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
  const req = new Request('http://localhost/api/expand', init)
  const res = await POST(req)
  const json = await res.json()
  return { status: res.status, json }
}

describe('app/api/expand/route.ts (POST handler)', () => {
  it('returns 200 with expanded items on a successful gpt-4o-mini call', async () => {
    createMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            items: [
              { rawName: 'CHKN SAND LG', displayName: 'Chicken Sandwich (Large)', priceCents: 1299, confidence: 'high' },
            ],
          }),
        },
      }],
    })
    const { status, json } = await callPOST({ items: [{ name: 'CHKN SAND LG', priceCents: 1299, quantity: 3 }] })
    expect(status).toBe(200)
    expect(json).toEqual({
      items: [{ rawName: 'CHKN SAND LG', displayName: 'Chicken Sandwich (Large)', priceCents: 1299, confidence: 'high', quantity: 3 }],
    })
    const callArgs = createMock.mock.calls[0][0]
    expect(callArgs.model).toBe('gpt-4o-mini')
    expect(callArgs.response_format.type).toBe('json_schema')
    expect(callArgs.response_format.json_schema.strict).toBe(true)
  })
  it('returns 400 when items field is missing', async () => {
    const { status } = await callPOST({})
    expect(status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })
  it('returns 400 when items is an empty array', async () => {
    const { status } = await callPOST({ items: [] })
    expect(status).toBe(400)
  })
  it('returns 400 when items.length > 100', async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ name: `i${i}`, priceCents: 100 }))
    const { status } = await callPOST({ items })
    expect(status).toBe(400)
  })
  it('returns 400 when body is not valid JSON', async () => {
    const { status } = await callPOST('not-json')
    expect(status).toBe(400)
  })
  it('returns 500 with generic error and no leak when OpenAI throws', async () => {
    createMock.mockRejectedValue(new Error('OpenAI internal: rate-limited xyz123'))
    const { status, json } = await callPOST({ items: [{ name: 'X', priceCents: 100 }] })
    expect(status).toBe(500)
    expect(json).toEqual({ error: 'Expand failed' })
    expect(JSON.stringify(json)).not.toContain('xyz123')
  })
  it('returns 500 when response item count differs from request item count (D-03 fallback)', async () => {
    createMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({ items: [{ rawName: 'A', displayName: 'A', priceCents: 100, confidence: 'high' }] }),
        },
      }],
    })
    const { status, json } = await callPOST({ items: [{ name: 'A', priceCents: 100 }, { name: 'B', priceCents: 200 }] })
    expect(status).toBe(500)
    expect(json).toEqual({ error: 'Expand failed' })
  })
  it('returns 500 when OpenAI returns empty content', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: null } }] })
    const { status, json } = await callPOST({ items: [{ name: 'X', priceCents: 100 }] })
    expect(status).toBe(500)
    expect(json).toEqual({ error: 'Expand failed' })
  })
})
