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

describe('POST /api/session/[sessionId]/claim', () => {
  it('Test 1 (claim qty=1): calls redis.eval with Lua script; ARGV=[itemId, personId, "1", "self", ""]; returns { ok: true }', async () => {
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
    expect(args).toEqual(['i1', 'p1', '1', 'self', ''])
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

  it('Test 8 (host-assigned): assignedBy:"host" + valid hostToken passes ARGV[4]="host", ARGV[5]=hostToken', async () => {
    mockEval.mockResolvedValue('OK')
    mockGet.mockResolvedValue(baseSession)
    const { status, json } = await callPOSTWithParams('test-session', {
      personId: 'p2', itemId: 'i1', qty: 1, assignedBy: 'host', hostToken: 'host-token-abc',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const [, , args] = mockEval.mock.calls[0]
    expect(args[3]).toBe('host')
    expect(args[4]).toBe('host-token-abc')
  })

  it('Test 9 (host-assigned without token): assignedBy:"host" with no hostToken passes ARGV[5]=""', async () => {
    mockEval.mockResolvedValue('OK')
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', {
      personId: 'p2', itemId: 'i1', qty: 1, assignedBy: 'host',
    })
    expect(status).toBe(200)
    const [, , args] = mockEval.mock.calls[0]
    expect(args[3]).toBe('host')
    expect(args[4]).toBe('')
  })

  it('Test 10: Returns 400 when assignedBy is an invalid value', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOSTWithParams('test-session', {
      personId: 'p1', itemId: 'i1', qty: 1, assignedBy: 'admin',
    })
    expect(status).toBe(400)
  })
})
