// Set env vars BEFORE any module import (mirrors ocrRoute.test.ts pattern)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()

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
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function callPOSTWithParams(sessionId: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const { POST } = await import('@/app/api/session/[sessionId]/tip/route')
  const req = new Request(`http://localhost/api/session/${sessionId}/tip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const params = Promise.resolve({ sessionId })
  const res = await POST(req, { params })
  return { status: res.status, json: await res.json() }
}

const baseSession = {
  people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }, { id: 'p2', name: 'Bob', colorIndex: 1 }],
  items: [{ id: 'i1', name: 'Burger', priceCents: 1299, quantity: 1 }],
  // CR-02: personSlots must be set for tip to succeed
  claims: { items: {}, personSlots: { p1: true, p2: true }, donePeople: {} },
  hostToken: 'host-token-abc',
  hostPersonId: undefined,
  tips: {},
  editRequests: {},
  disputes: {},
  createdAt: Date.now(),
}

describe('POST /api/session/[sessionId]/tip', () => {
  it('Test 1: POST { personId, tipCents: 200 } sets session.tips[personId] = 200 via redis.set, returns { ok: true }', async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', tipCents: 200 })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    expect(mockSet).toHaveBeenCalledTimes(1)
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    expect(savedPayload.tips['p1']).toBe(200)
  })

  it('Test 2: POST { personId, tipCents: 0 } is valid (zero tip per D-07), returns { ok: true }', async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', tipCents: 0 })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
  })

  it('Test 3: Returns 400 when tipCents is negative', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', { personId: 'p1', tipCents: -1 })
    expect(status).toBe(400)
  })

  it('Test 4: Returns 400 when tipCents is not an integer', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', { personId: 'p1', tipCents: 1.5 })
    expect(status).toBe(400)
  })

  it('Test 5: Returns 400 when personId not in session.people', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', { personId: 'p999', tipCents: 100 })
    expect(status).toBe(400)
  })

  it('Test 6: Returns 404 when session not found', async () => {
    mockGet.mockResolvedValue(null)
    const { status, json } = await callPOSTWithParams('missing-session', { personId: 'p1', tipCents: 200 })
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBeDefined()
  })
})
