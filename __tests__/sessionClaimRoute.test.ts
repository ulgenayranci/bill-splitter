import { describe, it, expect, beforeEach, vi } from 'vitest'

// Set env vars BEFORE any module import (mirrors ocrRoute.test.ts pattern)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockExec = vi.fn()
const mockMultiSet = vi.fn()
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
  mockMultiSet.mockReset()
  mockExec.mockReset()
  // multi() returns a pipeline-like object
  mockMulti.mockReturnValue({ set: mockMultiSet, exec: mockExec })
  mockMultiSet.mockReturnValue({ set: mockMultiSet, exec: mockExec })
  mockExec.mockResolvedValue(['OK'])
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function callPOSTWithParams(sessionId: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const { POST } = await import('@/app/api/session/[sessionId]/claim/route')
  const req = new Request(`http://localhost/api/session/${sessionId}/claim`, {
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
  items: [{ id: 'i1', name: 'Burger', priceCents: 1299 }],
  tipPercent: 18,
  claims: { items: {}, personSlots: {}, donePeople: {} },
  createdAt: Date.now(),
}

describe('POST /api/session/[sessionId]/claim', () => {
  it('Test 1 (item claim): Given session with item unclaimed, POST { personId, itemId, action: "item" } sets claims via redis.multi().set().exec(), returns { ok: true }', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      itemId: 'i1',
      action: 'item',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    expect(mockMulti).toHaveBeenCalledTimes(1)
    expect(mockExec).toHaveBeenCalledTimes(1)
  })

  it('Test 2 (un-claim, D-09): Given session with claims.items[itemId] === personId, POST same body deletes the claim and returns { ok: true }', async () => {
    const sessionWithClaim = {
      ...baseSession,
      claims: { ...baseSession.claims, items: { i1: 'p1' }, personSlots: {}, donePeople: {} },
    }
    mockGet.mockResolvedValue(sessionWithClaim)
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      itemId: 'i1',
      action: 'item',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    // Verify that the saved session does NOT have the claim
    const savedPayload = JSON.parse(mockMultiSet.mock.calls[0][1])
    expect(savedPayload.claims.items['i1']).toBeUndefined()
  })

  it('Test 3 (conflict): Given claims.items[itemId] === "other-person", POST returns 200 with { ok: false, reason: "conflict", takenBy: "other-person" } and does NOT call multi/exec', async () => {
    const sessionWithConflict = {
      ...baseSession,
      claims: { ...baseSession.claims, items: { i1: 'p2' }, personSlots: {}, donePeople: {} },
    }
    mockGet.mockResolvedValue(sessionWithConflict)
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      itemId: 'i1',
      action: 'item',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean; reason: string; takenBy: string }).ok).toBe(false)
    expect((json as { ok: boolean; reason: string; takenBy: string }).reason).toBe('conflict')
    expect((json as { ok: boolean; reason: string; takenBy: string }).takenBy).toBe('p2')
    expect(mockMulti).not.toHaveBeenCalled()
    expect(mockExec).not.toHaveBeenCalled()
  })

  it('Test 4 (person slot claim, D-02): POST { personId, action: "slot" } when claims.personSlots[personId] is unset writes personSlots[personId] = true atomically; returns { ok: true }', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      action: 'slot',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    expect(mockMulti).toHaveBeenCalledTimes(1)
    expect(mockExec).toHaveBeenCalledTimes(1)
    const savedPayload = JSON.parse(mockMultiSet.mock.calls[0][1])
    expect(savedPayload.claims.personSlots['p1']).toBe(true)
  })

  it('Test 5 (slot conflict): POST { personId, action: "slot" } when slot already true returns { ok: false, reason: "slot_taken" }', async () => {
    const sessionWithSlotClaimed = {
      ...baseSession,
      claims: { ...baseSession.claims, items: {}, personSlots: { p1: true }, donePeople: {} },
    }
    mockGet.mockResolvedValue(sessionWithSlotClaimed)
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      action: 'slot',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean; reason: string }).ok).toBe(false)
    expect((json as { ok: boolean; reason: string }).reason).toBe('slot_taken')
  })

  it('Test 6: Returns 404 + { error: "session_not_found" } when redis.get returns null', async () => {
    mockGet.mockResolvedValue(null)
    const { status, json } = await callPOSTWithParams('missing-session', {
      personId: 'p1',
      itemId: 'i1',
      action: 'item',
    })
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBe('session_not_found')
  })

  it('Test 7: Returns 400 when body is missing personId or action', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', {
      itemId: 'i1',
      // missing personId and action
    })
    expect(status).toBe(400)
  })
})
