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
  const { POST } = await import('@/app/api/session/[sessionId]/dispute/route')
  const req = new Request(`http://localhost/api/session/${sessionId}/dispute`, {
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
  claims: { items: {}, personSlots: {}, donePeople: {} },
  hostToken: 'host-token-abc',
  hostPersonId: undefined,
  tips: {},
  editRequests: {},
  disputes: {},
  createdAt: Date.now(),
}

describe('POST /api/session/[sessionId]/dispute', () => {
  it("Test 1: POST { personId, itemId } writes session.disputes[id] = { itemId, personId, status: 'pending', createdAt: number }, returns { ok: true, disputeId: string }", async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', itemId: 'i1' })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    expect(typeof (json as { disputeId: string }).disputeId).toBe('string')
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    const disputes = Object.values(savedPayload.disputes) as Array<{ itemId: string; personId: string; status: string; createdAt: number }>
    expect(disputes).toHaveLength(1)
    expect(disputes[0].itemId).toBe('i1')
    expect(disputes[0].personId).toBe('p1')
    expect(disputes[0].status).toBe('pending')
    expect(typeof disputes[0].createdAt).toBe('number')
  })

  it('Test 2: Returns 400 when itemId not in session.items', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', { personId: 'p1', itemId: 'nonexistent' })
    expect(status).toBe(400)
  })

  it('Test 3: Returns 400 when personId not in session.people', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', { personId: 'p999', itemId: 'i1' })
    expect(status).toBe(400)
  })

  it('Test 4: Returns 404 when session not found', async () => {
    mockGet.mockResolvedValue(null)
    const { status, json } = await callPOSTWithParams('missing-session', { personId: 'p1', itemId: 'i1' })
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBeDefined()
  })
})
