// Set env vars BEFORE any module import (mirrors ocrRoute.test.ts pattern)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockEval = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: class {
    get = mockGet
    set = mockSet
    eval = mockEval
    multi = vi.fn().mockReturnValue({ set: vi.fn(), exec: vi.fn() })
  },
}))

beforeEach(() => {
  vi.resetModules()
  mockGet.mockReset()
  mockSet.mockReset()
  mockEval.mockReset()
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

/** Flat baseSession — no hostToken, editRequests, disputes, hostPersonId */
const baseSession = {
  people: [{ id: 'p1', name: 'Alice', colorIndex: 0 }, { id: 'p2', name: 'Bob', colorIndex: 1 }],
  items: [{ id: 'i1', name: 'Burger', priceCents: 1299, quantity: 1 }],
  claims: { items: {}, personSlots: {}, donePeople: {} },
  tips: {},
  currencyCode: 'USD',
  createdAt: Date.now(),
}

describe('POST /api/session/[sessionId]/claim', () => {
  it('Test 1 (claim qty=1): calls redis.eval with Lua script; ARGV=[itemId, personId, "1"]; returns { ok: true }', async () => {
    mockEval.mockResolvedValue('OK')
    mockGet.mockResolvedValue(baseSession)
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', itemId: 'i1', qty: 1 })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    expect(mockEval).toHaveBeenCalledTimes(1)
    const [script, keys, args] = mockEval.mock.calls[0]
    expect(typeof script).toBe('string')
    expect(script).toContain('cjson.decode')
    expect(keys).toEqual(['session:test-session'])
    // Flat model: ARGV is [itemId, personId, qty] — no assignedBy/hostToken fields
    expect(args[0]).toBe('i1')
    expect(args[1]).toBe('p1')
    expect(args[2]).toBe('1')
  })

  it('Test 2 (claim qty=3 for quantity item): ARGV[2] === "3"', async () => {
    mockEval.mockResolvedValue('OK')
    mockGet.mockResolvedValue({
      ...baseSession,
      items: [{ id: 'i1', name: 'Burger', priceCents: 2700, quantity: 3 }],
    })
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', itemId: 'i1', qty: 3 })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const [, , args] = mockEval.mock.calls[0]
    expect(args[2]).toBe('3')
  })

  it('Test 3 (unclaim via qty=0): passes "0" as ARGV[2]; returns { ok: true }', async () => {
    mockEval.mockResolvedValue('OK')
    mockGet.mockResolvedValue(baseSession)
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', itemId: 'i1', qty: 0 })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const [, , args] = mockEval.mock.calls[0]
    expect(args[2]).toBe('0')
  })

  it('Test 4 (slot claim): POST { personId, action: "slot" } returns { ok: true }', async () => {
    mockEval.mockResolvedValue('OK')
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', action: 'slot' })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
  })

  it('Test 5: Returns 404 + { error: "session_not_found" } when session not found', async () => {
    mockEval.mockResolvedValue('session_not_found')
    mockGet.mockResolvedValue(null)
    const { status, json } = await callPOSTWithParams('missing-session', { personId: 'p1', itemId: 'i1', qty: 1 })
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBe('session_not_found')
  })

  it('Test 6: Returns 400 when body is missing personId', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', { itemId: 'i1', qty: 1 })
    expect(status).toBe(400)
  })

  it('Test 7: Returns 400 when qty is negative or non-integer', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', { personId: 'p1', itemId: 'i1', qty: -1 })
    expect(status).toBe(400)
  })

  it('Test 8 (share join): POST { action:"share", joining:true } → 200 { ok:true }; ARGV=[itemId, personId, "true"]', async () => {
    mockEval.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      itemId: 'i1',
      action: 'share',
      joining: true,
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    expect(mockEval).toHaveBeenCalledTimes(1)
    const [script, keys, args] = mockEval.mock.calls[0]
    expect(typeof script).toBe('string')
    expect(script).toContain('cjson.decode') // Lua script contains JSON decode (shared pattern)
    expect(script).not.toContain('totalClaimed') // SHARE_CLAIM_SCRIPT has no bounds check (no totalClaimed)
    expect(keys).toEqual(['session:test-session'])
    expect(args).toEqual(['i1', 'p1', 'true'])
  })

  it('Test 9 (share leave): POST { action:"share", joining:false } → 200; ARGV third element is "false"', async () => {
    mockEval.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      itemId: 'i1',
      action: 'share',
      joining: false,
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const [, , args] = mockEval.mock.calls[0]
    expect(args[2]).toBe('false')
  })

  it('Test 10 (share validation): action:"share" without boolean joining → 400', async () => {
    const { status } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      itemId: 'i1',
      action: 'share',
      // joining omitted → invalid
    })
    expect(status).toBe(400)
  })

  it('Test 11 (share session not found): eval resolves "session_not_found" → 404', async () => {
    mockEval.mockResolvedValue('session_not_found')
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      itemId: 'i1',
      action: 'share',
      joining: true,
    })
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBe('session_not_found')
  })

  it('Test 12 (share invalid session): eval resolves "invalid_session" → 500', async () => {
    mockEval.mockResolvedValue('invalid_session')
    const { status } = await callPOSTWithParams('test-session', {
      personId: 'p1',
      itemId: 'i1',
      action: 'share',
      joining: true,
    })
    expect(status).toBe(500)
  })
})
