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
  const { POST } = await import('@/app/api/session/[sessionId]/resolve-edit/route')
  const req = new Request(`http://localhost/api/session/${sessionId}/resolve-edit`, {
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
  editRequests: {
    'req-1': {
      personId: 'p1',
      type: 'add',
      payload: { name: 'Fries', priceCents: 399, quantity: 1 },
      status: 'pending',
      createdAt: Date.now(),
    },
    'req-remove': {
      personId: 'p1',
      type: 'remove',
      payload: { itemId: 'i1' },
      status: 'pending',
      createdAt: Date.now(),
    },
    'req-price': {
      personId: 'p1',
      type: 'edit_price',
      payload: { itemId: 'i1', newPriceCents: 999 },
      status: 'pending',
      createdAt: Date.now(),
    },
    'req-name': {
      personId: 'p1',
      type: 'edit_name',
      payload: { itemId: 'i1', newName: 'Big Burger' },
      status: 'pending',
      createdAt: Date.now(),
    },
  },
  disputes: {},
  createdAt: Date.now(),
}

describe('POST /api/session/[sessionId]/resolve-edit', () => {
  it("Test 1 (approve add): POST { requestId: 'req-1', decision: 'approved', hostToken: 'host-token-abc' } appends item to session.items, sets status='approved', returns { ok: true }", async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      requestId: 'req-1',
      decision: 'approved',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    expect(savedPayload.items).toHaveLength(2)
    expect(savedPayload.editRequests['req-1'].status).toBe('approved')
  })

  it("Test 2 (approve remove): removes item from session.items AND deletes session.claims.items[itemId]", async () => {
    const sessionWithClaims = {
      ...baseSession,
      claims: {
        ...baseSession.claims,
        items: { i1: { p1: { qty: 1, assignedBy: 'self' } } },
      },
    }
    mockGet.mockResolvedValue(sessionWithClaims)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      requestId: 'req-remove',
      decision: 'approved',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    expect(savedPayload.items.find((i: { id: string }) => i.id === 'i1')).toBeUndefined()
    expect(savedPayload.claims.items['i1']).toBeUndefined()
  })

  it('Test 3 (approve edit_price): updates session.items[idx].priceCents in place', async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      requestId: 'req-price',
      decision: 'approved',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    expect(savedPayload.items[0].priceCents).toBe(999)
  })

  it('Test 4 (approve edit_name): updates session.items[idx].name in place', async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      requestId: 'req-name',
      decision: 'approved',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    expect(savedPayload.items[0].name).toBe('Big Burger')
  })

  it("Test 5 (reject): decision: 'rejected' sets status='rejected' WITHOUT mutating session.items", async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      requestId: 'req-1',
      decision: 'rejected',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    expect(savedPayload.items).toHaveLength(1) // item NOT added
    expect(savedPayload.editRequests['req-1'].status).toBe('rejected')
  })

  it("Test 6 (FORBIDDEN): missing or wrong hostToken returns 403 + { error: 'Forbidden' } and does NOT call redis.set", async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status, json } = await callPOSTWithParams('test-session', {
      requestId: 'req-1',
      decision: 'approved',
      hostToken: 'wrong-token',
    })
    expect(status).toBe(403)
    expect((json as { error: string }).error).toBe('Forbidden')
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('Test 7: Returns 404 when session not found', async () => {
    mockGet.mockResolvedValue(null)
    const { status, json } = await callPOSTWithParams('missing-session', {
      requestId: 'req-1',
      decision: 'approved',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBeDefined()
  })

  it('Test 8: Returns 400 when requestId not found in session.editRequests', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', {
      requestId: 'nonexistent-req',
      decision: 'approved',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(400)
  })
})
