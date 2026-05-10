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
  const { POST } = await import('@/app/api/clarify/route')
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }
  const req = new Request('http://localhost/api/clarify', init)
  const res = await POST(req)
  const json = await res.json()
  return { status: res.status, json }
}

describe('app/api/clarify/route.ts (POST handler)', () => {
  it('returns 200 with displayName for valid rawName + image', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ displayName: 'Chicken Sandwich' }) } }],
    })
    const { status, json } = await callPOST({
      rawName: 'CHKN SAND',
      image: 'data:image/jpeg;base64,abc',
    })
    expect(status).toBe(200)
    expect(json).toEqual({ displayName: 'Chicken Sandwich' })
    const callArgs = createMock.mock.calls[0][0]
    expect(callArgs.model).toBe('gpt-4o-mini')
    const content = callArgs.messages[0].content
    expect(Array.isArray(content)).toBe(true)
    expect(content.some((c: { type: string }) => c.type === 'text')).toBe(true)
    expect(content.some((c: { type: string }) => c.type === 'image_url')).toBe(true)
  })
  it('returns 400 when rawName is missing', async () => {
    const { status } = await callPOST({ image: 'data:image/jpeg;base64,abc' })
    expect(status).toBe(400)
  })
  it('returns 400 when rawName exceeds 200 chars', async () => {
    const { status } = await callPOST({ rawName: 'a'.repeat(201), image: 'data:image/jpeg;base64,abc' })
    expect(status).toBe(400)
  })
  it('returns 400 when image is missing or invalid data URI', async () => {
    const { status } = await callPOST({ rawName: 'X', image: 'not-a-data-uri' })
    expect(status).toBe(400)
  })
  it('returns 400 when image exceeds 10MB', async () => {
    const huge = 'data:image/jpeg;base64,' + 'A'.repeat(10_000_001)
    const { status } = await callPOST({ rawName: 'X', image: huge })
    expect(status).toBe(400)
  })
  it('returns 200 with empty displayName when GPT returns empty string (D-09)', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ displayName: '' }) } }],
    })
    const { status, json } = await callPOST({ rawName: 'XYZ', image: 'data:image/jpeg;base64,abc' })
    expect(status).toBe(200)
    expect(json).toEqual({ displayName: '' })
  })
  it('returns 500 with generic error when OpenAI throws', async () => {
    createMock.mockRejectedValue(new Error('boom'))
    const { status, json } = await callPOST({ rawName: 'X', image: 'data:image/jpeg;base64,abc' })
    expect(status).toBe(500)
    expect(json).toEqual({ error: 'Clarify failed' })
  })
})
