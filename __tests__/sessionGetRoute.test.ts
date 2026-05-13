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

async function callGET(sessionId: string): Promise<{ status: number; json: unknown }> {
  const { GET } = await import('@/app/api/session/[sessionId]/route')
  const req = new Request(`http://localhost/api/session/${sessionId}`)
  const params = Promise.resolve({ sessionId })
  const res = await GET(req, { params })
  return { status: res.status, json: await res.json() }
}

describe('GET /api/session/[sessionId]', () => {
  const mockSessionPayload = {
    people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
    items: [{ id: 'i1', name: 'Burger', priceCents: 1299 }],
    tipPercent: 18,
    claims: { items: {}, personSlots: {}, donePeople: {} },
    createdAt: Date.now(),
  }

  it('Test 1: Returns 200 + the session JSON when redis.get returns a valid payload', async () => {
    mockGet.mockResolvedValue(mockSessionPayload)
    const { status, json } = await callGET('test-session-id')
    expect(status).toBe(200)
    expect(json).toEqual(mockSessionPayload)
  })

  it('Test 2: Returns 404 + { error: "Session not found" } when redis.get returns null/undefined', async () => {
    mockGet.mockResolvedValue(null)
    const { status, json } = await callGET('missing-session-id')
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBe('Session not found')
  })

  it('Test 3: Returns 500 + { error: "Session not found" } when redis.get throws', async () => {
    mockGet.mockRejectedValue(new Error('Redis unavailable'))
    const { status, json } = await callGET('test-session-id')
    expect(status).toBe(500)
    expect((json as { error: string }).error).toBe('Session not found')
  })

  it('Test 4: Awaits params (Next.js 15 contract): params passed as Promise.resolve({ sessionId }) and the handler must accept it', async () => {
    mockGet.mockResolvedValue(mockSessionPayload)
    const { GET } = await import('@/app/api/session/[sessionId]/route')
    const req = new Request('http://localhost/api/session/test-session-id')
    const params = Promise.resolve({ sessionId: 'test-session-id' })
    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    // Verify the handler used the sessionId from params
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('test-session-id'))
  })
})
