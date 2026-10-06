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
  // --- item ops: one field-level Lua script each (WR-01: no whole-session GET -> SET) ---
  it('Test 1 (add): one ITEM_ADD_SCRIPT eval with [newId, name, price, qty]; never GET/SET', async () => {
    mockEval.mockResolvedValue('OK')
    const { status, json } = await callPOST('test-session', { op: 'add', name: 'Salad', priceCents: 899, quantity: 1 })
    expect(status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(mockEval).toHaveBeenCalledTimes(1)
    const [script, keys, args] = mockEval.mock.calls[0]
    const { ITEM_ADD_SCRIPT } = await import('@/lib/sessionLua')
    expect(script).toBe(ITEM_ADD_SCRIPT)
    expect(keys).toEqual(['session:test-session'])
    expect(typeof args[0]).toBe('string')
    expect((args[0] as string).length).toBeGreaterThan(0)
    expect(args.slice(1)).toEqual(['Salad', '899', '1'])
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('Test 2 (edit_name): ITEM_EDIT_SCRIPT with [itemId, "name", newName]', async () => {
    mockEval.mockResolvedValue('OK')
    const { status } = await callPOST('test-session', { op: 'edit_name', itemId: 'i1', newName: 'Cheeseburger' })
    expect(status).toBe(200)
    const { ITEM_EDIT_SCRIPT } = await import('@/lib/sessionLua')
    expect(mockEval).toHaveBeenCalledWith(ITEM_EDIT_SCRIPT, ['session:test-session'], ['i1', 'name', 'Cheeseburger'])
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('Test 3 (edit_price): ITEM_EDIT_SCRIPT with [itemId, "priceCents", value]; script never touches claims', async () => {
    mockEval.mockResolvedValue('OK')
    const { status } = await callPOST('test-session', { op: 'edit_price', itemId: 'i1', newPriceCents: 1499 })
    expect(status).toBe(200)
    const { ITEM_EDIT_SCRIPT } = await import('@/lib/sessionLua')
    expect(mockEval).toHaveBeenCalledWith(ITEM_EDIT_SCRIPT, ['session:test-session'], ['i1', 'priceCents', '1499'])
    // D-01: claims for an edited item are preserved — the edit script only reads claims
    expect(ITEM_EDIT_SCRIPT).not.toMatch(/session\.claims\.items\[ARGV\[1\]\]\s*=/)
  })

  it('Test 4 (edit_quantity): ITEM_EDIT_SCRIPT with [itemId, "quantity", value]', async () => {
    mockEval.mockResolvedValue('OK')
    const { status } = await callPOST('test-session', { op: 'edit_quantity', itemId: 'i1', newQuantity: 3 })
    expect(status).toBe(200)
    const { ITEM_EDIT_SCRIPT } = await import('@/lib/sessionLua')
    expect(mockEval).toHaveBeenCalledWith(ITEM_EDIT_SCRIPT, ['session:test-session'], ['i1', 'quantity', '3'])
  })

  it('Test 5 (edit_quantity below claimed): Lua "qty_below_claimed:2" → 400 with the claimed count (Pitfall 4)', async () => {
    mockEval.mockResolvedValue('qty_below_claimed:2')
    const { status, json } = await callPOST('test-session', { op: 'edit_quantity', itemId: 'i1', newQuantity: 1 })
    expect(status).toBe(400)
    expect((json as { error: string }).error).toBe('Cannot reduce quantity to 1: 2 units are already claimed')
  })

  it('Test 6 (remove): ITEM_REMOVE_SCRIPT with [itemId]; script purges claims.items[itemId]', async () => {
    mockEval.mockResolvedValue('OK')
    const { status } = await callPOST('test-session', { op: 'remove', itemId: 'i1' })
    expect(status).toBe(200)
    const { ITEM_REMOVE_SCRIPT } = await import('@/lib/sessionLua')
    expect(mockEval).toHaveBeenCalledWith(ITEM_REMOVE_SCRIPT, ['session:test-session'], ['i1'])
    expect(ITEM_REMOVE_SCRIPT).toContain('session.claims.items[ARGV[1]] = nil')
  })

  it('Test 7: Lua "session_not_found" → 404 { error: "session_not_found" }', async () => {
    mockEval.mockResolvedValue('session_not_found')
    const { status, json } = await callPOST('missing', { op: 'remove', itemId: 'i1' })
    expect(status).toBe(404)
    expect(json).toEqual({ error: 'session_not_found' })
  })

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
  it('Test 10: Lua "item_not_found" → 400 itemId not found', async () => {
    mockEval.mockResolvedValue('item_not_found')
    const { status, json } = await callPOST('test-session', { op: 'edit_name', itemId: 'nope', newName: 'X' })
    expect(status).toBe(400)
    expect((json as { error: string }).error).toBe('Invalid payload: itemId not found in session')
  })

  // --- op: claim_seat (compare-and-set on an empty seat) ---
  it('claim_seat ok: CLAIM_SEAT_SCRIPT with [personId, trimmed name] → 200', async () => {
    mockEval.mockResolvedValue('OK')
    const { status, json } = await callPOST('test-session', { op: 'claim_seat', personId: 'g1', name: '  Deniz  ' })
    expect(status).toBe(200)
    expect(json).toEqual({ ok: true })
    const { CLAIM_SEAT_SCRIPT } = await import('@/lib/sessionLua')
    expect(mockEval).toHaveBeenCalledWith(CLAIM_SEAT_SCRIPT, ['session:test-session'], ['g1', 'Deniz'])
  })

  it('claim_seat taken: Lua "seat_taken" → 409 { error: "seat_taken" }', async () => {
    mockEval.mockResolvedValue('seat_taken')
    const { status, json } = await callPOST('test-session', { op: 'claim_seat', personId: 'g1', name: 'Deniz' })
    expect(status).toBe(409)
    expect(json).toEqual({ error: 'seat_taken' })
  })

  it('claim_seat unknown seat: Lua "person_not_found" → 404', async () => {
    mockEval.mockResolvedValue('person_not_found')
    const { status } = await callPOST('test-session', { op: 'claim_seat', personId: 'ghost', name: 'Deniz' })
    expect(status).toBe(404)
  })

  it.each([
    [{ op: 'claim_seat', name: 'Deniz' }],
    [{ op: 'claim_seat', personId: 'g1', name: '   ' }],
    [{ op: 'claim_seat', personId: 'g1', name: 'x'.repeat(51) }],
    [{ op: 'claim_seat', personId: 'g1' }],
  ])('claim_seat invalid body %j → 400, eval not called', async (body) => {
    const { status } = await callPOST('test-session', body)
    expect(status).toBe(400)
    expect(mockEval).not.toHaveBeenCalled()
  })

  it('rename_person on an empty seat: Lua "seat_empty" → 409 (seats are claimed, not renamed)', async () => {
    mockEval.mockResolvedValue('seat_empty')
    const { status, json } = await callPOST('test-session', { op: 'rename_person', personId: 'g1', newName: 'Deniz' })
    expect(status).toBe(409)
    expect(json).toEqual({ error: 'seat_empty' })
  })

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

  // --- op: update_currency ---
  describe('update_currency op', () => {
    it('Test 17 (update_currency valid): CR-01 — uses atomic Lua eval, NOT GET+SET; redis.eval called once with currencyCode in ARGV', async () => {
      // CR-01 fix: update_currency now runs atomically via Lua (mirrors add_person pattern).
      // redis.get must NOT be called; redis.set must NOT be called; redis.eval called exactly once.
      mockEval.mockResolvedValue('OK')
      const { status, json } = await callPOST('test-session', {
        op: 'update_currency',
        currencyCode: 'EUR',
      })
      expect(status).toBe(200)
      expect((json as { ok: boolean }).ok).toBe(true)
      expect(mockEval).toHaveBeenCalledTimes(1)
      expect(mockGet).not.toHaveBeenCalled()
      expect(mockSet).not.toHaveBeenCalled()
      // Confirm ARGV[0] is the currency code passed to Lua
      const evalArgs = mockEval.mock.calls[0]
      // evalArgs[2] is the ARGV array: [currencyCode]
      const argv = evalArgs[2] as string[]
      expect(argv[0]).toBe('EUR')
    })

    it('Test 17b (update_currency session_not_found): eval returns "session_not_found" → 404', async () => {
      mockEval.mockResolvedValue('session_not_found')
      const { status, json } = await callPOST('test-session', {
        op: 'update_currency',
        currencyCode: 'EUR',
      })
      expect(status).toBe(404)
      expect(typeof (json as { error: string }).error).toBe('string')
    })

    it('Test 18 (update_currency empty string): returns 400; eval NOT called', async () => {
      const { status } = await callPOST('test-session', {
        op: 'update_currency',
        currencyCode: '',
      })
      expect(status).toBe(400)
      expect(mockEval).not.toHaveBeenCalled()
    })

    it('Test 19 (update_currency missing field): returns 400; eval NOT called', async () => {
      const { status } = await callPOST('test-session', {
        op: 'update_currency',
      })
      expect(status).toBe(400)
      expect(mockEval).not.toHaveBeenCalled()
    })

    it('Test 20 (update_currency too long): currencyCode > 10 chars returns 400; eval NOT called', async () => {
      const { status } = await callPOST('test-session', {
        op: 'update_currency',
        currencyCode: 'ABCDEFGHIJK', // 11 chars
      })
      expect(status).toBe(400)
      expect(mockEval).not.toHaveBeenCalled()
    })
  })

  // --- op: rename_person ---
  it('Test 25 (rename_person ok): renames person atomically via Lua, returns 200 { ok:true }; eval called once with correct ARGV', async () => {
    mockEval.mockResolvedValue('OK')
    const { status, json } = await callPOST('test-session', {
      op: 'rename_person',
      personId: 'p1',
      newName: 'Alicia',
    })
    expect(status).toBe(200)
    expect((json as { ok: boolean }).ok).toBe(true)
    expect(mockEval).toHaveBeenCalledTimes(1)
    expect(mockGet).not.toHaveBeenCalled()
    // Verify ARGV = [personId, trimmedName]
    const evalArgs = mockEval.mock.calls[0]
    const argv = evalArgs[2] as string[]
    expect(argv[0]).toBe('p1')
    expect(argv[1]).toBe('Alicia')
  })

  it('Test 26 (rename_person name trimmed): whitespace-padded newName is trimmed; ARGV[1] receives trimmed value', async () => {
    mockEval.mockResolvedValue('OK')
    await callPOST('test-session', {
      op: 'rename_person',
      personId: 'p1',
      newName: '  Alicia  ',
    })
    expect(mockEval).toHaveBeenCalledTimes(1)
    const evalArgs = mockEval.mock.calls[0]
    const argv = evalArgs[2] as string[]
    expect(argv[1]).toBe('Alicia')
  })

  it('Test 27 (rename_person empty name): whitespace-only newName returns 400; eval NOT called', async () => {
    const { status, json } = await callPOST('test-session', {
      op: 'rename_person',
      personId: 'p1',
      newName: '   ',
    })
    expect(status).toBe(400)
    expect(typeof (json as { error: string }).error).toBe('string')
    expect(mockEval).not.toHaveBeenCalled()
  })

  it('Test 28 (rename_person name too long): 51-char newName returns 400; eval NOT called', async () => {
    const { status, json } = await callPOST('test-session', {
      op: 'rename_person',
      personId: 'p1',
      newName: 'A'.repeat(51),
    })
    expect(status).toBe(400)
    expect(typeof (json as { error: string }).error).toBe('string')
    expect(mockEval).not.toHaveBeenCalled()
  })

  it('Test 29 (rename_person missing personId): returns 400; eval NOT called', async () => {
    const { status, json } = await callPOST('test-session', {
      op: 'rename_person',
      // personId intentionally omitted
      newName: 'Alicia',
    })
    expect(status).toBe(400)
    expect(typeof (json as { error: string }).error).toBe('string')
    expect(mockEval).not.toHaveBeenCalled()
  })
})
