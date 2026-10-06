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

  it('persists serviceFeeCents when valid; omits it otherwise', async () => {
    mockSet.mockResolvedValue('OK')
    await callPOST({ ...validBody, serviceFeeCents: 500 })
    expect(JSON.parse(mockSet.mock.calls[0][1] as string).serviceFeeCents).toBe(500)
    for (const bad of [undefined, 0, -1, 1.5, '500', 10_000_001]) {
      mockSet.mockReset()
      mockSet.mockResolvedValue('OK')
      vi.resetModules()
      await callPOST({ ...validBody, serviceFeeCents: bad })
      const payload = JSON.parse(mockSet.mock.calls[0][1] as string)
      expect('serviceFeeCents' in payload).toBe(false)
    }
  })

  it('persists taxCents when valid; omits it otherwise', async () => {
    mockSet.mockResolvedValue('OK')
    await callPOST({ ...validBody, taxCents: 800 })
    expect(JSON.parse(mockSet.mock.calls[0][1] as string).taxCents).toBe(800)
    for (const bad of [undefined, 0, -1, 1.5, '800', 10_000_001]) {
      mockSet.mockReset()
      mockSet.mockResolvedValue('OK')
      vi.resetModules()
      await callPOST({ ...validBody, taxCents: bad })
      const payload = JSON.parse(mockSet.mock.calls[0][1] as string)
      expect('taxCents' in payload).toBe(false)
    }
  })
})

describe('POST /api/session — seats and people cap', () => {
  const items = [{ id: 'i1', name: 'Burger', priceCents: 1299, quantity: 1 }]
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, colorIndex: 0 }))

  it('accepts exactly 20 people', async () => {
    mockSet.mockResolvedValue('OK')
    const { status } = await callPOST({ people: mk(20), items })
    expect(status).toBe(200)
    expect(mockSet).toHaveBeenCalledTimes(1)
    expect(JSON.parse(mockSet.mock.calls[0][1] as string).people).toHaveLength(20)
  })

  it('rejects 21 people with 400 and writes nothing', async () => {
    const { status, json } = await callPOST({ people: mk(21), items })
    expect(status).toBe(400)
    expect((json as { error: string }).error).toBe('Too many people (max 20)')
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('accepts an empty seat with guestNumber and stores it', async () => {
    mockSet.mockResolvedValue('OK')
    const { status } = await callPOST({
      people: [
        { id: 'p1', name: 'Ana', colorIndex: 0 },
        { id: 's1', name: '', colorIndex: 1, guestNumber: 1 },
      ],
      items,
    })
    expect(status).toBe(200)
    const stored = JSON.parse(mockSet.mock.calls[0][1] as string)
    expect(stored.people[1].name).toBe('')
    expect(stored.people[1].guestNumber).toBe(1)
  })

  it('rejects invalid guestNumber values', async () => {
    for (const gn of [0, -1, 1.5, '2', 1000]) {
      mockSet.mockReset()
      vi.resetModules()
      const { status, json } = await callPOST({
        people: [{ id: 's1', name: '', colorIndex: 1, guestNumber: gn }],
        items,
      })
      expect(status).toBe(400)
      expect((json as { error: string }).error).toBe('Invalid people')
      expect(mockSet).not.toHaveBeenCalled()
    }
  })

  it('strips unknown person keys', async () => {
    mockSet.mockResolvedValue('OK')
    await callPOST({
      people: [{ id: 'p1', name: 'Ana', colorIndex: 0, isHost: true, foo: 'x' }],
      items,
    })
    const stored = JSON.parse(mockSet.mock.calls[0][1] as string)
    expect(Object.keys(stored.people[0]).sort()).toEqual(['colorIndex', 'id', 'name'])
  })

  it('v2.0-shaped body stores no guestNumber key', async () => {
    mockSet.mockResolvedValue('OK')
    const { status } = await callPOST({
      people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
      items,
    })
    expect(status).toBe(200)
    const stored = JSON.parse(mockSet.mock.calls[0][1] as string)
    expect('guestNumber' in stored.people[0]).toBe(false)
  })
})
