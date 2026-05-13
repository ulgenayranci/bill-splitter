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

async function callPOSTWithParams(sessionId: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const { POST } = await import('@/app/api/session/[sessionId]/done/route')
  const req = new Request(`http://localhost/api/session/${sessionId}/done`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const params = Promise.resolve({ sessionId })
  const res = await POST(req, { params })
  return { status: res.status, json: await res.json() }
}

const baseSession = {
  people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }],
  items: [{ id: 'i1', name: 'Burger', priceCents: 1299 }],
  tipPercent: 18,
  claims: { items: { i1: 'p1' }, personSlots: { p1: true }, donePeople: {} },
  createdAt: Date.now(),
}

describe('POST /api/session/[sessionId]/done', () => {
  it('Test 1: Sets claims.donePeople[personId] = true via redis.set; returns { ok: true }', async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1' })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    expect(mockSet).toHaveBeenCalledTimes(1)
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    expect(savedPayload.claims.donePeople['p1']).toBe(true)
  })

  it('Test 2: Returns 404 when session does not exist', async () => {
    mockGet.mockResolvedValue(null)
    const { status, json } = await callPOSTWithParams('missing-session', { personId: 'p1' })
    expect(status).toBe(404)
    expect(json).toBeDefined()
  })

  it('Test 3: Returns 400 when personId is missing from body', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', {})
    expect(status).toBe(400)
  })
})
