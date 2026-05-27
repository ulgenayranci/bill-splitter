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
  const { POST } = await import('@/app/api/session/[sessionId]/resolve-dispute/route')
  const req = new Request(`http://localhost/api/session/${sessionId}/resolve-dispute`, {
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
  claims: {
    items: {
      i1: { p1: { qty: 1, assignedBy: 'host' } },
    },
    personSlots: {},
    donePeople: {},
  },
  hostToken: 'host-token-abc',
  hostPersonId: undefined,
  tips: {},
  editRequests: {},
  disputes: {
    'dispute-1': {
      itemId: 'i1',
      personId: 'p1',
      status: 'pending',
      createdAt: Date.now(),
    },
  },
  createdAt: Date.now(),
}

describe('POST /api/session/[sessionId]/resolve-dispute', () => {
  it("Test 1 (resolve via reassign): POST { disputeId, decision: 'resolved', reassignTo: 'p2', hostToken } updates claims to { p2: { qty: 1, assignedBy: 'host' } }, sets dispute status='resolved', returns { ok: true }", async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      disputeId: 'dispute-1',
      decision: 'resolved',
      reassignTo: 'p2',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    expect(savedPayload.claims.items['i1']['p2']).toEqual({ qty: 1, assignedBy: 'host' })
    expect(savedPayload.disputes['dispute-1'].status).toBe('resolved')
  })

  it("Test 2 (rejected — confirm original): POST { disputeId, decision: 'rejected', hostToken } leaves claims.items[itemId] unchanged, sets dispute status='rejected', returns { ok: true }", async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      disputeId: 'dispute-1',
      decision: 'rejected',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const savedPayload = JSON.parse(mockSet.mock.calls[0][1])
    expect(savedPayload.claims.items['i1']['p1']).toEqual({ qty: 1, assignedBy: 'host' }) // unchanged
    expect(savedPayload.disputes['dispute-1'].status).toBe('rejected')
  })

  it("Test 3 (FORBIDDEN): wrong hostToken returns 403 + { error: 'Forbidden' }", async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status, json } = await callPOSTWithParams('test-session', {
      disputeId: 'dispute-1',
      decision: 'resolved',
      reassignTo: 'p2',
      hostToken: 'wrong-token',
    })
    expect(status).toBe(403)
    expect((json as { error: string }).error).toBe('Forbidden')
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('Test 4: Returns 404 when session not found', async () => {
    mockGet.mockResolvedValue(null)
    const { status, json } = await callPOSTWithParams('missing-session', {
      disputeId: 'dispute-1',
      decision: 'resolved',
      reassignTo: 'p2',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBeDefined()
  })

  it('Test 5: Returns 400 when disputeId not in session.disputes', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', {
      disputeId: 'nonexistent-dispute',
      decision: 'resolved',
      reassignTo: 'p2',
      hostToken: 'host-token-abc',
    })
    expect(status).toBe(400)
  })
})
