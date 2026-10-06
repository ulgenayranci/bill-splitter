// Set env vars BEFORE any module import (mirrors ocrRoute.test.ts pattern)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token'

import { createElement } from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import fixture from './fixtures/v2-session.json'
import { normalizeSession } from '@/lib/normalizeSession'
import { isEmptySeat, seatLabel } from '@/lib/seats'
import { DONE_SCRIPT, TIP_SCRIPT } from '@/lib/sessionLua'
import {
  computeEqualChargeShares,
  computeServiceFeeShares,
  computePersonShareFromClaims,
  formatCents,
} from '@/lib/billMath'
import { PersonResultsScreen } from '@/components/split/PersonResultsScreen'
import type { SessionPayload } from '@/lib/sessionSchema'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

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
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})
afterEach(() => cleanup())

const fresh = () => JSON.parse(JSON.stringify(fixture))
const normalized = (): SessionPayload => normalizeSession(fresh())!

function totals(session: SessionPayload) {
  const taxShares = computeEqualChargeShares(session.taxCents, session.people)
  const feeShares = computeServiceFeeShares(session.serviceFeeCents, session.people)
  const out: Record<string, number> = {}
  for (const p of session.people) {
    out[p.id] = computePersonShareFromClaims(
      p.id,
      session.items,
      session.claims.items,
      session.tips[p.id] ?? 0,
      feeShares[p.id],
      taxShares[p.id]
    ).total
  }
  return out
}

async function post(route: 'done' | 'tip', body: unknown) {
  const { POST } =
    route === 'done'
      ? await import('@/app/api/session/[sessionId]/done/route')
      : await import('@/app/api/session/[sessionId]/tip/route')
  const req = new Request(`http://localhost/api/session/v2/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const res = await POST(req, { params: Promise.resolve({ sessionId: 'v2' }) })
  return { status: res.status, json: await res.json() }
}

describe('v2.0 session back-compat (REL-04)', () => {
  it('1: GET serves the fixture with only personSlots normalized to {}', async () => {
    mockGet.mockResolvedValue(fresh())
    const { GET } = await import('@/app/api/session/[sessionId]/route')
    const res = await GET(new Request('http://localhost/api/session/v2'), {
      params: Promise.resolve({ sessionId: 'v2' }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as SessionPayload
    const expected = fresh()
    expected.claims.personSlots = {}
    expect(json).toEqual(expected)
    expect(json.people).toHaveLength(3)
    expect(json.people.some((p) => 'guestNumber' in p)).toBe(false)
  })

  it('2: no v2.0 person is an empty seat; labels equal names', () => {
    const s = normalized()
    for (const p of s.people) {
      expect(isEmptySeat(p)).toBe(false)
      expect(seatLabel(p, s.people)).toBe(p.name)
    }
  })

  it('3: totals without tax/fee match pre-v2.1 values', () => {
    const t = totals(normalized())
    expect(t).toEqual({ p1: 1900, p2: 1400, p3: 400 })
    expect(t.p1 + t.p2 + t.p3).toBe(3500 + 200)
  })

  it('4: totals with tax 1001 and fee 250 sum exactly', () => {
    const s = { ...normalized(), taxCents: 1001, serviceFeeCents: 250 }
    const t = totals(s)
    expect(t).toEqual({ p1: 2318, p2: 1817, p3: 816 })
    expect(t.p1 + t.p2 + t.p3).toBe(4951)
  })

  it('5: done route evals DONE_SCRIPT atomically', async () => {
    mockEval.mockResolvedValue('OK')
    const { status, json } = await post('done', { personId: 'p2', done: true })
    expect(status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(mockEval).toHaveBeenCalledWith(DONE_SCRIPT, ['session:v2'], ['p2', 'true'])
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('6: tip route evals TIP_SCRIPT atomically', async () => {
    mockEval.mockResolvedValue('OK')
    const { status, json } = await post('tip', { personId: 'p3', tipCents: 150 })
    expect(status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(mockEval).toHaveBeenCalledWith(TIP_SCRIPT, ['session:v2'], ['p3', '150'])
  })

  const props = {
    personId: 'p1',
    currencyCode: 'EUR',
    onAddTip: vi.fn(),
    onEditBill: vi.fn(),
    sessionId: 'v2',
  }

  it('7: Results renders the fixture with every name and the exact own total', () => {
    render(createElement(PersonResultsScreen, { session: normalized(), ...props }))
    for (const name of ['Alice', 'Bob', 'Cem']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    }
    expect(screen.getByTestId('results-total').textContent?.trim()).toBe(formatCents(1900, 'EUR'))
    expect(screen.getByTestId('results-card-total').textContent).toContain(formatCents(1900, 'EUR'))
  })

  it('8: legacy-shape variant (tips [], claims.items []) renders with zero subtotals', () => {
    const legacy = { ...fresh(), tips: [], claims: { ...fresh().claims, items: [] } }
    const s = normalizeSession(legacy)!
    expect(totals(s)).toEqual({ p1: 0, p2: 0, p3: 0 })
    render(createElement(PersonResultsScreen, { session: s, ...props }))
    expect(screen.getByTestId('results-total').textContent?.trim()).toBe(formatCents(0, 'EUR'))
  })
})
