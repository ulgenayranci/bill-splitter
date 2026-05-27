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

const baseSession = {
  people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }, { id: 'p2', name: 'Bob', colorIndex: 1 }],
  items: [{ id: 'i1', name: 'Burger', priceCents: 1299, quantity: 1 }],
  claims: { items: {}, personSlots: {}, donePeople: {} },
  hostToken: 'host-token-abc',
  hostPersonId: undefined,
  tips: {},
  editRequests: {},
  disputes: {},
  createdAt: Date.now(),
}

describe('GET /api/session/[sessionId]', () => {
  it('Test 1: Returns 200 + session JSON with hostToken stripped (CR-01)', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status, json } = await callGET('test-session-id')
    expect(status).toBe(200)
    // CR-01: hostToken must NOT be returned to clients — it's a host capability secret
    expect((json as Record<string, unknown>).hostToken).toBeUndefined()
    expect((json as typeof baseSession).tips).toEqual({})
    expect((json as typeof baseSession).editRequests).toEqual({})
    // Other safe fields should still be present
    expect((json as typeof baseSession).people).toHaveLength(2)
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
