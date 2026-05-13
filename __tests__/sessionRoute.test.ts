import { describe, it, expect, beforeEach, vi } from 'vitest'

// Set env vars BEFORE any module import (mirrors ocrRoute.test.ts pattern)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockMulti = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: class {
    get = mockGet
    set = mockSet
    multi = mockMulti
  },
}))

beforeEach(() => {
  vi.resetModules()
  mockGet.mockReset()
  mockSet.mockReset()
  mockMulti.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function callPOST(body: unknown): Promise<{ status: number; json: unknown }> {
  const { POST } = await import('@/app/api/session/route')
  const req = new Request('http://localhost/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const res = await POST(req)
  return { status: res.status, json: await res.json() }
}

describe('POST /api/session', () => {
  const validBody = {
    people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
    items: [{ id: 'i1', name: 'Burger', priceCents: 1299 }],
    tipPercent: 18,
  }

  it('Test 1: Returns 200 + { sessionId: string } when given valid { people, items, tipPercent }', async () => {
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOST(validBody)
    expect(status).toBe(200)
    expect(typeof (json as { sessionId: string }).sessionId).toBe('string')
    expect((json as { sessionId: string }).sessionId.length).toBeGreaterThan(0)
  })

  it('Test 2: Returns 400 + { error: "Invalid JSON body" } when body is not valid JSON', async () => {
    const { status, json } = await callPOST('not-valid-json')
    expect(status).toBe(400)
    expect((json as { error: string }).error).toBe('Invalid JSON body')
  })

  it('Test 3: Returns 400 + { error: /invalid|missing/i } when "people" field is missing or not an array', async () => {
    const { status, json } = await callPOST({ items: [{ id: 'i1', name: 'Burger', priceCents: 1299 }], tipPercent: 18 })
    expect(status).toBe(400)
    expect((json as { error: string }).error).toMatch(/invalid|missing/i)
  })

  it('Test 4: Returns 400 + { error: /invalid|missing/i } when "items" field is missing or contains a non-integer priceCents', async () => {
    const { status, json } = await callPOST({
      people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
      items: [{ id: 'i1', name: 'Burger', priceCents: 12.99 }],
      tipPercent: 18,
    })
    expect(status).toBe(400)
    expect((json as { error: string }).error).toMatch(/invalid|missing/i)
  })

  it('Test 5: Returns 400 + { error: /invalid|missing/i } when "tipPercent" is missing or not a number 0..999', async () => {
    const { status, json } = await callPOST({
      people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
      items: [{ id: 'i1', name: 'Burger', priceCents: 1299 }],
      tipPercent: 1000,
    })
    expect(status).toBe(400)
    expect((json as { error: string }).error).toMatch(/invalid|missing/i)
  })

  it('Test 6: On success, calls redis.set with key session:{sessionId}, serialized SessionPayload, and TTL { ex: 86400 }', async () => {
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOST(validBody)
    expect(status).toBe(200)
    const sessionId = (json as { sessionId: string }).sessionId
    expect(mockSet).toHaveBeenCalledTimes(1)
    const [key, , opts] = mockSet.mock.calls[0]
    expect(key).toBe(`session:${sessionId}`)
    expect(opts).toMatchObject({ ex: 86400 })
  })

  it('Test 7: Returns 500 + { error: "Session creation failed" } when redis.set throws', async () => {
    mockSet.mockRejectedValue(new Error('Redis connection failed'))
    const { status, json } = await callPOST(validBody)
    expect(status).toBe(500)
    expect((json as { error: string }).error).toBe('Session creation failed')
  })
})
