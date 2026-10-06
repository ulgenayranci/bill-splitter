// Set env vars BEFORE any module import (mirrors ocrRoute.test.ts pattern)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DONE_SCRIPT } from '@/lib/sessionLua'

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
  const { POST } = await import('@/app/api/session/[sessionId]/done/route')
  const req = new Request(`http://localhost/api/session/${sessionId}/done`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const params = Promise.resolve({ sessionId })
  const res = await POST(req, { params })
  return { status: res.status, json: await res.json() }
}

describe('POST /api/session/[sessionId]/done', () => {
  it('done:true evals DONE_SCRIPT atomically and returns { ok: true }', async () => {
    mockEval.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', done: true })
    expect(status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(mockEval).toHaveBeenCalledTimes(1)
    expect(mockEval).toHaveBeenCalledWith(DONE_SCRIPT, ['session:test-session'], ['p1', 'true'])
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('done:false passes "false" (soft checkpoint D-08) and returns { ok: true }', async () => {
    mockEval.mockResolvedValue('OK')
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', done: false })
    expect(status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(mockEval).toHaveBeenCalledWith(DONE_SCRIPT, ['session:test-session'], ['p1', 'false'])
  })

  it('session_not_found -> 404', async () => {
    mockEval.mockResolvedValue('session_not_found')
    const { status, json } = await callPOSTWithParams('missing-session', { personId: 'p1', done: true })
    expect(status).toBe(404)
    expect(json).toEqual({ error: 'session_not_found' })
  })

  it('person_not_found -> 400 with v2.0 message', async () => {
    mockEval.mockResolvedValue('person_not_found')
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p999', done: true })
    expect(status).toBe(400)
    expect(json).toEqual({ error: 'Invalid personId: not in session' })
  })

  it.each(['invalid_session', 'invalid_args', 'something_unexpected'])('eval result %s -> 500 generic', async (result) => {
    mockEval.mockResolvedValue(result)
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', done: true })
    expect(status).toBe(500)
    expect(json).toEqual({ error: 'Done failed' })
  })

  it('eval throws -> 500 generic, message not leaked', async () => {
    mockEval.mockRejectedValue(new Error('secret-redis-detail'))
    const { status, json } = await callPOSTWithParams('test-session', { personId: 'p1', done: true })
    expect(status).toBe(500)
    expect(json).toEqual({ error: 'Done failed' })
    expect(JSON.stringify(json)).not.toContain('secret-redis-detail')
  })

  it('missing personId -> 400, eval not called', async () => {
    const { status } = await callPOSTWithParams('test-session', { done: true })
    expect(status).toBe(400)
    expect(mockEval).not.toHaveBeenCalled()
  })

  it.each([{ personId: 'p1' }, { personId: 'p1', done: 'true' }])('bad done %j -> 400, eval not called', async (body) => {
    const { status } = await callPOSTWithParams('test-session', body)
    expect(status).toBe(400)
    expect(mockEval).not.toHaveBeenCalled()
  })

  it('invalid JSON -> 400, eval not called', async () => {
    const { status } = await callPOSTWithParams('test-session', '{not json')
    expect(status).toBe(400)
    expect(mockEval).not.toHaveBeenCalled()
  })
})
