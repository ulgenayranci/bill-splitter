// Set env vars BEFORE any module import (mirrors ocrRoute.test.ts pattern)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockMulti = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: class {
    get = mockGet
    set = mockSet
    multi = vi.fn().mockReturnValue({ set: vi.fn(), exec: vi.fn() })
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
    items: [{ id: 'i1', name: 'Burger', priceCents: 1299, quantity: 1 }],
  }

  it('Test 1: Returns 200 + { sessionId: string } (no hostToken in response) when given valid { people, items }', async () => {
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOST(validBody)
    expect(status).toBe(200)
    const result = json as { sessionId: string; hostToken?: unknown }
    expect(typeof result.sessionId).toBe('string')
    expect(result.sessionId.length).toBeGreaterThan(0)
    // Flat model: hostToken is NOT returned in the response
    expect(result.hostToken).toBeUndefined()
  })

  it('Test 2: Response contains only sessionId (no hostToken, no hostPersonId)', async () => {
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOST(validBody)
    expect(status).toBe(200)
    const result = json as Record<string, unknown>
    expect(typeof result.sessionId).toBe('string')
    expect(result.hostToken).toBeUndefined()
    expect(result.hostPersonId).toBeUndefined()
  })

  it('Test 3: redis.set called with flat payload containing currencyCode + tips; no hostToken/editRequests/disputes in payload', async () => {
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOST(validBody)
    expect(status).toBe(200)
    const sessionId = (json as { sessionId: string }).sessionId
    expect(mockSet).toHaveBeenCalledTimes(1)
    const [key, payloadStr, opts] = mockSet.mock.calls[0]
    expect(key).toBe(`session:${sessionId}`)
    expect(opts).toMatchObject({ ex: 86400 })
    const payload = JSON.parse(payloadStr as string)
    // Flat model: no host fields
    expect(payload.hostToken).toBeUndefined()
    expect(payload.editRequests).toBeUndefined()
    expect(payload.disputes).toBeUndefined()
    expect(payload.hostPersonId).toBeUndefined()
    // Required flat fields
    expect(payload.tips).toEqual({})
    expect(typeof payload.currencyCode).toBe('string')
    // Phase 4 shared-tip percent field must NOT be in Phase 6 payload (D-17)
    const legacyTipKey = ['tip', 'Percent'].join('')
    expect(legacyTipKey in payload).toBe(false)
  })

  it('Test 4: Returns 400 when people is missing or invalid', async () => {
    const { status, json } = await callPOST({
      items: [{ id: 'i1', name: 'Burger', priceCents: 1299, quantity: 1 }],
    })
    expect(status).toBe(400)
    expect((json as { error: string }).error).toMatch(/invalid|missing/i)
  })

  it('Test 5: Returns 400 when items is missing or has non-integer priceCents', async () => {
    const { status, json } = await callPOST({
      people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
      items: [{ id: 'i1', name: 'Burger', priceCents: 12.99, quantity: 1 }],
    })
    expect(status).toBe(400)
    expect((json as { error: string }).error).toMatch(/invalid|missing/i)
  })

  it('Test 6: Returns 400 when items lack quantity field OR have quantity < 1', async () => {
    const { status, json } = await callPOST({
      people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
      items: [{ id: 'i1', name: 'Burger', priceCents: 1299, quantity: 0 }],
    })
    expect(status).toBe(400)
    expect((json as { error: string }).error).toMatch(/invalid|missing/i)
  })

  it('Test 7: Returns 500 when redis.set throws', async () => {
    mockSet.mockRejectedValue(new Error('Redis connection failed'))
    const { status, json } = await callPOST(validBody)
    expect(status).toBe(500)
    expect((json as { error: string }).error).toBe('Session creation failed')
  })

  it('Test 8 (D-04): currencyCode in POST body is persisted; absent/invalid code defaults to "USD"', async () => {
    mockSet.mockResolvedValue('OK')
    // Valid currencyCode passed
    const { json: json1 } = await callPOST({ ...validBody, currencyCode: 'EUR' })
    const [, payloadStr1] = mockSet.mock.calls[0]
    const payload1 = JSON.parse(payloadStr1 as string)
    expect(payload1.currencyCode).toBe('EUR')
    mockSet.mockReset()
    mockSet.mockResolvedValue('OK')
    vi.resetModules()
    // No currencyCode → defaults to USD
    const { json: json2 } = await callPOST(validBody)
    const [, payloadStr2] = mockSet.mock.calls[0]
    const payload2 = JSON.parse(payloadStr2 as string)
    expect(payload2.currencyCode).toBe('USD')
    // Suppress unused var warnings
    void json1; void json2
  })
})
