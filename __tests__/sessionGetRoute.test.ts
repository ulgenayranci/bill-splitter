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

async function callGET(sessionId: string): Promise<{ status: number; json: unknown }> {
  const { GET } = await import('@/app/api/session/[sessionId]/route')
  const req = new Request(`http://localhost/api/session/${sessionId}`)
  const params = Promise.resolve({ sessionId })
  const res = await GET(req, { params })
  return { status: res.status, json: await res.json() }
}

/** Flat baseSession — no hostToken, editRequests, disputes, hostPersonId */
const baseSession = {
  people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }, { id: 'p2', name: 'Bob', colorIndex: 1 }],
  items: [{ id: 'i1', name: 'Burger', priceCents: 1299, quantity: 1 }],
  claims: { items: {}, personSlots: {}, donePeople: {} },
  tips: {},
  currencyCode: 'USD',
  createdAt: Date.now(),
}

describe('GET /api/session/[sessionId]', () => {
  it('Test 1: Returns 200 + flat session JSON (currencyCode present, no host fields)', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status, json } = await callGET('test-session-id')
    expect(status).toBe(200)
    const result = json as Record<string, unknown>
    // Flat model: host fields are not stored and not returned
    expect(result.hostToken).toBeUndefined()
    expect(result.editRequests).toBeUndefined()
    expect(result.disputes).toBeUndefined()
    // currencyCode must be returned (D-04)
    expect(result.currencyCode).toBe('USD')
    // Other safe fields still present
    expect((result.people as unknown[]).length).toBe(2)
    expect((result as { tips: unknown }).tips).toEqual({})
  })

  it('Test 2: Returns 404 + { error: "Session not found" } when redis.get returns null', async () => {
    mockGet.mockResolvedValue(null)
    const { status, json } = await callGET('missing-session-id')
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBe('Session not found')
  })

  it('Test 3: Returns 500 when redis.get throws', async () => {
    mockGet.mockRejectedValue(new Error('Redis unavailable'))
    const { status, json } = await callGET('test-session-id')
    expect(status).toBe(500)
    expect((json as { error: string }).error).toBeDefined()
  })

  it('Test 4: Awaits params per Next.js 15 contract', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { GET } = await import('@/app/api/session/[sessionId]/route')
    const req = new Request('http://localhost/api/session/test-session-id')
    const params = Promise.resolve({ sessionId: 'test-session-id' })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('test-session-id'))
  })
})
