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

async function callPOST(
  sessionId: string,
  body: unknown
): Promise<{ status: number; json: unknown }> {
  const { POST } = await import('@/app/api/session/[sessionId]/edit/route')
  const req = new Request(`http://localhost/api/session/${sessionId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const params = Promise.resolve({ sessionId })
  const res = await POST(req, { params })
  return { status: res.status, json: await res.json() }
}

/** Flat session fixture — no hostToken, hostPersonId, editRequests, disputes */
const baseSession = {
  people: [
    { id: 'p1', name: 'Alice', colorIndex: 0 },
    { id: 'p2', name: 'Bob', colorIndex: 1 },
  ],
  items: [
    { id: 'i1', name: 'Burger', priceCents: 1299, quantity: 2 },
    { id: 'i2', name: 'Fries', priceCents: 499, quantity: 1 },
  ],
  claims: {
    items: {
      i1: {
        p1: { qty: 1 },
        p2: { qty: 1 },
      },
    },
    personSlots: {},
    donePeople: {},
  },
  tips: {},
  currencyCode: 'USD',
  createdAt: Date.now(),
}

describe('POST /api/session/[sessionId]/edit', () => {
  // --- op: add ---
  it('Test 1 (add): appends new item with nanoid id and returns 200 { ok: true }', async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOST('test-session', {
      op: 'add',
      name: 'Salad',
      priceCents: 899,
      quantity: 1,
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    expect(mockSet).toHaveBeenCalledTimes(1)
    const [, savedPayload] = mockSet.mock.calls[0]
    const saved = typeof savedPayload === 'string' ? JSON.parse(savedPayload) : savedPayload
    expect(saved.items).toHaveLength(3)
    const newItem = saved.items.find((it: { name: string }) => it.name === 'Salad')
    expect(newItem).toBeDefined()
    expect(newItem.priceCents).toBe(899)
    expect(newItem.quantity).toBe(1)
    expect(typeof newItem.id).toBe('string')
    expect(newItem.id.length).toBeGreaterThan(0)
  })

  // --- op: edit_name ---
  it('Test 2 (edit_name): updates item.name in place and returns 200 { ok: true }', async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOST('test-session', {
      op: 'edit_name',
      itemId: 'i1',
      newName: 'Cheeseburger',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const [, savedPayload] = mockSet.mock.calls[0]
    const saved = typeof savedPayload === 'string' ? JSON.parse(savedPayload) : savedPayload
    const edited = saved.items.find((it: { id: string }) => it.id === 'i1')
    expect(edited.name).toBe('Cheeseburger')
  })

  // --- op: edit_price ---
  it('Test 3 (edit_price): updates item.priceCents and returns 200; D-01 — claims for that item are preserved (not dropped)', async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOST('test-session', {
      op: 'edit_price',
      itemId: 'i1',
      newPriceCents: 1499,
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const [, savedPayload] = mockSet.mock.calls[0]
    const saved = typeof savedPayload === 'string' ? JSON.parse(savedPayload) : savedPayload
    // price updated
    const edited = saved.items.find((it: { id: string }) => it.id === 'i1')
    expect(edited.priceCents).toBe(1499)
    // D-01: claims for i1 must still exist (not purged)
    expect(saved.claims.items['i1']).toBeDefined()
    expect(saved.claims.items['i1']['p1']).toBeDefined()
    expect(saved.claims.items['i1']['p2']).toBeDefined()
    expect(saved.claims.items['i1']['p1'].qty).toBe(1)
    expect(saved.claims.items['i1']['p2'].qty).toBe(1)
  })

  // --- op: edit_quantity ---
  it('Test 4 (edit_quantity): updates item.quantity and returns 200 { ok: true }', async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOST('test-session', {
      op: 'edit_quantity',
      itemId: 'i2',
      newQuantity: 3,
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const [, savedPayload] = mockSet.mock.calls[0]
    const saved = typeof savedPayload === 'string' ? JSON.parse(savedPayload) : savedPayload
    const edited = saved.items.find((it: { id: string }) => it.id === 'i2')
    expect(edited.quantity).toBe(3)
  })

  it('Test 5 (edit_quantity below claimed): returns 400 when newQuantity < totalAlreadyClaimed (Pitfall 4)', async () => {
    // i1 has 2 claims (p1:1, p2:1) = totalClaimed=2; reducing to 1 should be rejected
    mockGet.mockResolvedValue(baseSession)
    const { status, json } = await callPOST('test-session', {
      op: 'edit_quantity',
      itemId: 'i1',
      newQuantity: 1,
    })
    expect(status).toBe(400)
    expect(typeof (json as { error: string }).error).toBe('string')
  })

  // --- op: remove ---
  it('Test 6 (remove): deletes item from items[] AND purges claims.items[itemId], returns 200 { ok: true }', async () => {
    mockGet.mockResolvedValue(baseSession)
    mockSet.mockResolvedValue('OK')
    const { status, json } = await callPOST('test-session', {
      op: 'remove',
      itemId: 'i1',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    const [, savedPayload] = mockSet.mock.calls[0]
    const saved = typeof savedPayload === 'string' ? JSON.parse(savedPayload) : savedPayload
    // item removed from items[]
    expect(saved.items.find((it: { id: string }) => it.id === 'i1')).toBeUndefined()
    // claims purged for that itemId
    expect(saved.claims.items['i1']).toBeUndefined()
  })

  // --- 404 path ---
  it('Test 7: returns 404 { error: "session_not_found" } when session does not exist', async () => {
    mockGet.mockResolvedValue(null)
    const { status, json } = await callPOST('missing-session', {
      op: 'edit_name',
      itemId: 'i1',
      newName: 'New Name',
    })
    expect(status).toBe(404)
    expect((json as { error: string }).error).toBe('session_not_found')
  })

  // --- 400 invalid op ---
  it('Test 8: returns 400 when op is invalid or missing', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOST('test-session', {
      op: 'unknown_op',
      itemId: 'i1',
    })
    expect(status).toBe(400)
  })

  // --- 400 missing itemId ---
  it('Test 9: returns 400 when itemId is missing for ops that require it', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOST('test-session', {
      op: 'edit_name',
      newName: 'No ItemId Provided',
    })
    expect(status).toBe(400)
  })

  // --- 400 itemId not in session ---
  it('Test 10: returns 400 when itemId is not found in session.items', async () => {
    mockGet.mockResolvedValue(baseSession)
    const { status } = await callPOST('test-session', {
      op: 'remove',
      itemId: 'nonexistent-item',
    })
    expect(status).toBe(400)
  })

  // --- op: add_person ---
  it('Test 11 (add_person ok): creates person atomically via Lua, returns 200 { ok:true, personId:<string> }; redis.eval called exactly once', async () => {
    mockEval.mockResolvedValue('OK')
    const { status, json } = await callPOST('test-session', {
      op: 'add_person',
      name: 'Carol',
    })
    expect(status).toBe(200)
    const body = json as { ok: boolean; personId: string }
    expect(body.ok).toBe(true)
    expect(typeof body.personId).toBe('string')
    expect(body.personId.length).toBeGreaterThan(0)
    expect(mockEval).toHaveBeenCalledTimes(1)
    // GET (redis.get) must NOT be called for add_person (Lua does the read internally)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('Test 12 (add_person name empty): returns 400; eval NOT called', async () => {
    const { status, json } = await callPOST('test-session', {
      op: 'add_person',
      name: '',
    })
    expect(status).toBe(400)
    expect(typeof (json as { error: string }).error).toBe('string')
    expect(mockEval).not.toHaveBeenCalled()
  })

  it('Test 13 (add_person name too long): name length 51 returns 400; eval NOT called', async () => {
    const { status, json } = await callPOST('test-session', {
      op: 'add_person',
      name: 'A'.repeat(51),
    })
    expect(status).toBe(400)
    expect(typeof (json as { error: string }).error).toBe('string')
    expect(mockEval).not.toHaveBeenCalled()
  })

  it('Test 14 (add_person name trimmed): whitespace-padded name is trimmed before eval; ARGV[0] receives trimmed value', async () => {
    mockEval.mockResolvedValue('OK')
    await callPOST('test-session', {
      op: 'add_person',
      name: '  Carol  ',
    })
    expect(mockEval).toHaveBeenCalledTimes(1)
    // eval is called as redis.eval(script, keys, args) — args[0] is trimmed name
    const evalArgs = mockEval.mock.calls[0]
    // evalArgs[2] is the ARGV array: [trimmedName, newPersonId]
    const argv = evalArgs[2] as string[]
    expect(argv[0]).toBe('Carol')
  })

  it('Test 15 (add_person session full): eval resolves "session_full" → 409', async () => {
    mockEval.mockResolvedValue('session_full')
    const { status, json } = await callPOST('test-session', {
      op: 'add_person',
      name: 'Extra',
    })
    expect(status).toBe(409)
    expect(typeof (json as { error: string }).error).toBe('string')
  })

  it('Test 16 (add_person session not found): eval resolves "session_not_found" → 404', async () => {
    mockEval.mockResolvedValue('session_not_found')
    const { status, json } = await callPOST('test-session', {
      op: 'add_person',
      name: 'Ghost',
    })
    expect(status).toBe(404)
    expect(typeof (json as { error: string }).error).toBe('string')
  })
})
