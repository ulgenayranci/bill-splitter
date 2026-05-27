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
  const { POST } = await import('@/app/api/session/[sessionId]/edit-request/route')
  const req = new Request(`http://localhost/api/session/${sessionId}/edit-request`, {
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

describe('POST /api/session/[sessionId]/edit-request', () => {
  it("Test 1 (add type): POST { personId, type: 'add', payload: { name, priceCents, quantity } } writes editRequests entry with status 'pending', returns { ok: true, requestId: string }", async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      type: 'add',
      payload: { name: 'Fries', priceCents: 399, quantity: 1 },
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    expect(typeof (json as { requestId: string }).requestId).toBe('string')
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    const requests = Object.values(savedPayload.editRequests) as Array<{ status: string; type: string }>
    expect(requests).toHaveLength(1)
    expect(requests[0].status).toBe('pending')
    expect(requests[0].type).toBe('add')
  })

  it("Test 2 (remove type): payload { itemId } where itemId exists in session.items → ok", async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      type: 'remove',
      payload: { itemId: 'i1' },
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
  })

  it("Test 3 (edit_price type): payload { itemId, newPriceCents } where itemId exists → ok", async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      type: 'edit_price',
      payload: { itemId: 'i1', newPriceCents: 999 },
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
  })

  it("Test 4 (edit_name type): payload { itemId, newName } where itemId exists → ok", async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      type: 'edit_name',
      payload: { itemId: 'i1', newName: 'Big Burger' },
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
  })

  it('Test 5: Returns 400 when type not in whitelist', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      type: 'invalid_type',
      payload: {},
    })
    expect(status).toBe(400)
  })

  it('Test 6 (remove with invalid itemId): Returns 400', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      type: 'remove',
      payload: { itemId: 'nonexistent-item' },
    })
    expect(status).toBe(400)
  })

  it('Test 7: Returns 404 when session not found', async () => {
    mockGet.mockResolvedValue(null)
    const { status, json } = await callPOSTWithParams('missing-session', {
      personId: 'p1',
      type: 'add',
      payload: { name: 'Fries', priceCents: 399, quantity: 1 },
    })
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBeDefined()
  })
})
