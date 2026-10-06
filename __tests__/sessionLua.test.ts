import { describe, it, expect } from 'vitest'
import { DONE_SCRIPT, TIP_SCRIPT } from '@/lib/sessionLua'

const COMMON = [
  "redis.call('GET', KEYS[1])",
  'pcall(cjson.decode, raw)',
  "'session_not_found'",
  "'invalid_session'",
  "'person_not_found'",
  "'invalid_args'",
  "'EX', 86400",
]

const FORBIDDEN = ['table.insert', 'table.remove', 'session.people =', 'session.items =', 'session.claims.items =']

describe.each([
  ['DONE_SCRIPT', DONE_SCRIPT],
  ['TIP_SCRIPT', TIP_SCRIPT],
])('%s (static content)', (_name, script) => {
  it.each(COMMON)('contains %s', (needle) => {
    expect(script).toContain(needle)
  })

  it.each(FORBIDDEN)('does not contain %s', (needle) => {
    expect(script).not.toContain(needle)
  })

  it('references only KEYS[1], ARGV[1], ARGV[2]', () => {
    expect(script).not.toMatch(/KEYS\[(?!1\])/)
    expect(script).not.toMatch(/ARGV\[(?![12]\])/)
  })

  it('has no template interpolation', () => {
    expect(script).not.toContain('${')
  })
})

describe('field scope', () => {
  it('DONE_SCRIPT writes donePeople only', () => {
    expect(DONE_SCRIPT).toContain('donePeople[personId]')
    expect(DONE_SCRIPT).not.toContain('session.tips')
  })

  it('TIP_SCRIPT writes tips only', () => {
    expect(TIP_SCRIPT).toContain('session.tips[personId]')
    expect(TIP_SCRIPT).not.toContain('donePeople')
  })
})
