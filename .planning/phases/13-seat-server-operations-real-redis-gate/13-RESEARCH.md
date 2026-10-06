# Phase 13: Seat Server Operations + Real-Redis Gate - Research

**Researched:** 2026-10-06
**Domain:** Atomic Redis Lua scripts (Upstash REST in prod, local redis-server for tests), Next.js route handlers, vitest harness
**Confidence:** HIGH (every key claim below was executed against a real Redis 8.10.2 and, for the shape differences, against the live Upstash runtime with throwaway/pure-compute calls)

## Summary

Phase 13 adds three new atomic scripts (`claim_seat`, `add_seat`, `remove_seat`), puts a `person_not_found` guard on every person-keyed script, converts the `/edit` item ops (WR-01) from whole-session GET-spread-SET to field-level Lua, and proves all of it against a real `redis-server` through a separate vitest project. I prototyped all three seat scripts plus item-op scripts and ran them: 20 concurrent claims on one seat gave exactly 1 OK + 19 `seat_taken`; 25 concurrent `add_seat` at 2 people gave exactly 18 OK + 7 `too_many_people` with 20 final people and unique guest numbers; remove "Guest 2" left "Guest 3" as 3. The same scripts also ran correctly on the live Upstash runtime (throwaway key, deleted).

**The single most important discovery: real Redis and Upstash disagree on `cjson` empty-table encoding.** Real Redis 8.10.2 encodes EVERY empty Lua table as `{}`. Upstash (Redis 8.4.0 compatible, `upstash_version 1.18.1`) encodes EVERY empty table as `[]`. Upstash also decodes JSON `null` to Lua `nil` (real Redis gives `cjson.null` userdata) and drops `null` array elements. Consequences: (1) the existing comments in `claim/route.ts` ("cjson encodes empty Lua tables as []") are true only on Upstash; (2) WR-02 (`items: []` becoming `{}`) is a **local-Redis-only** hazard today, but must still be closed because the harness runs on real Redis and because Upstash could change; (3) scripts must be written shape-agnostic (guard with `type(x) == 'table'`, never test `x == cjson.null`), and the harness must seed BOTH shapes and read results through `normalizeSession`.

**Primary recommendation:** Add `ioredis@5.11.1` as a devDependency, a separate `vitest.redis.config.mts` + `npm run test:redis` with a `globalSetup` that spawns an ephemeral-port `redis-server`, move all Lua strings (including those currently inline in the claim and edit routes) into `lib/sessionLua.ts`, and drive the route handlers themselves against real Redis via a `vi.mock('@/lib/redis')` ioredis adapter. Use the validated script drafts in Code Examples as the starting point.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 13 (`ls` of the phase dir is empty). Constraints below are copied from the orchestrator's locked decisions in the research request and from STATE.md.

### Locked Decisions
- Real local Redis installed via Homebrew (`brew install redis`, dev-only, never touches live data) is the Lua test harness. Homebrew 5.1.8 present; redis-server/docker NOT installed yet.
- Anyone (no host role) can add a seat or remove an EMPTY seat. Minimum 2 people, `MAX_PEOPLE` 20.
- Seat = `Person` with `name: ''`.
- Stable `guestNumber` (lib/seats.ts `nextGuestNumber` / fallback).
- Flat no-lock model; `rename_person` stays unconditional for named people.
- `remove_seat` never purges claims.
- Requirement IDs: REL-01, REL-02, REL-03, SEAT-03, SEAT-04.

### Claude's Discretion
- Harness mechanics (client library, start/stop, config split, skip behaviour).
- Lua script structure, return codes, guestNumber allocation scheme (must be compatible with `lib/seats.ts`).
- HTTP status mapping consistent with existing routes.
- How to close WR-01 / WR-02 / IN-04.

### Deferred Ideas (OUT OF SCOPE)
- Host role, name locking, removing named/active people live, UI for any of this (Phases 15-16), OCR guest count (Phase 14), "seats still empty" nudge.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | Seat actions and done/tip cannot overwrite each other | Item ops to Lua (WR-01), mixed-concurrency no-lost-update test, all writers field-level |
| REL-02 | Picks/tips/done for a non-existent person rejected, never stored | `person_not_found` guard on claim/share/slot (+ done/tip/rename existing); byte-identical-state test; orphan invariant |
| REL-03 | All new/changed scripts tested on real local Redis incl. simultaneous claims and remove-vs-claim | ioredis + globalSetup `redis-server` harness, `npm run test:redis`, coverage meta-test, pair matrix |
| SEAT-03 | Never below 2 people | `remove_seat` floor via ARGV `MIN_PEOPLE`, race test |
| SEAT-04 | Guest numbers never shift | Lua allocator mirroring `nextGuestNumber`, max+1 over present people, parity test |
</phase_requirements>

## Project Constraints (from CLAUDE.md)
- Stack is Next.js (App Router route handlers) + TypeScript strict + Upstash Redis REST in production. No new runtime dependencies are needed; the only new package is a **devDependency**.
- GSD workflow: all repo edits go through a GSD command (planner/executor), not ad hoc.
- Memory: "Always push to main" after every commit; user is non-technical (explain in plain English in any user-facing summary); mobile-only (375px) is irrelevant here (server-only phase).
- Conventions/architecture not yet formalised in CLAUDE.md; follow existing patterns (inline-Lua `redis.eval(script, keys[], args[])`, status-code strings mapped in the route).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Seat claim/add/remove atomicity | Database (Lua inside Redis) | API route (status mapping) | Only a Redis script is atomic on Upstash REST (`multi()` is not). The race lives in the data tier. |
| Input validation (name trim/length, ids, ints) | API route | Lua (defence-in-depth `invalid_args`) | Route is the trust boundary; Lua re-checks cheaply because ARGV is the only injection surface. |
| Orphan rejection (person_not_found) | Database (Lua) | API route | Existence check must be in the same atomic step as the write. |
| Guest-number allocation | Database (Lua) | `lib/seats.ts` (display + parity oracle) | Must be atomic with the insert; TS helper is the reference implementation for tests. |
| `[]` vs `{}` shape repair | API route boundary (GET normalizeSession) | — | Lua cannot force array/object encoding; repair at the single client-facing read. |
| Real-Redis test harness | Dev tooling (vitest global setup) | — | Never in the app bundle; never touches Upstash. |

## Standard Stack

### Core (existing, unchanged)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @upstash/redis | ^1.38.0 (installed) | Prod Redis client; `redis.eval(script, keys, args)` | Already used; REST EVAL is the atomic primitive. [VERIFIED: package.json] |
| vitest | 4.1.5 (installed) | Test runner | Already used; supports `globalSetup` + `project.provide`/`inject`. [VERIFIED: node_modules/vitest/package.json; CITED: vitest.dev/config/globalsetup] |

### New (dev only)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ioredis | 5.11.1 (devDependency) | Node client to run the exact Lua strings against local redis-server | Test harness only. 5.x line is the long-stable one; 6.0.0 (2026-07-31) also exists and would work, but 5.11.1 avoids a 2-month-old major for a dev tool. [VERIFIED: npm registry `npm view ioredis`] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ioredis | `redis` (node-redis 6.3.0) | Works, but `eval` takes an options object; ioredis's `eval(script, numKeys, ...keys, ...args)` maps 1:1 onto Upstash's `eval(script, keys, args)` via a 3-line adapter. |
| ioredis | spawning `redis-cli` per call | No dependency, but no true concurrency (process spawn per call serialises timing), awkward JSON/argument escaping, slow. Rejected. |
| ioredis | `redis-memory-server` (0.17.1) | Downloads and COMPILES Redis from source; slow, needs a toolchain, conflicts with the Homebrew decision. Rejected. |
| Lua-in-JS (fengari/wasmoon) | — | Not real Redis; cjson is absent/different. Rejected: the whole point is real cjson behaviour (see the shape finding). |
| Local redis-server | Dedicated Upstash test DB | Would exercise the production runtime but needs credentials, network and cleanup; user locked local Redis. Keep a one-off manual Upstash smoke as a post-ship check (see Environment/Open Questions). |

**Installation:**
```bash
brew install redis                      # one-time, dev machine only (Homebrew formula redis 8.10.2 [VERIFIED: brew info redis])
npm install --save-dev ioredis@5.11.1
```

**Version verification:** `npm view ioredis version` -> 6.0.0 latest, 5.11.1 latest 5.x (published 2026-06-04); weekly downloads 36.3M; repo github.com/redis/ioredis; MIT; no `postinstall` script. [VERIFIED: npm registry, npmjs downloads API]

## Package Legitimacy Audit

slopcheck could not be installed in this environment (`pip install slopcheck` produced no usable binary), so per protocol the package is tagged `[ASSUMED]` and the planner must gate the install behind a `checkpoint:human-verify`. Evidence strongly favours legitimacy (it is the canonical redis/ioredis package, 36M weekly downloads), so the checkpoint is a formality.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| ioredis | npm | many years (5.11.1 published 2026-06-04) | ~36.3M/wk | github.com/redis/ioredis | unavailable [ASSUMED] | Approved pending one human-verify checkpoint |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged [SUS]:** none (slopcheck unavailable; ioredis tagged `[ASSUMED]`)

## Architecture Patterns

### System Architecture Diagram

```
 phone A / phone B / scanner phone  (many simultaneous requests)
        |  POST /api/session/:id/edit  {op: claim_seat|add_seat|remove_seat|item ops|rename_person|add_person|update_currency}
        |  POST /api/session/:id/claim {action: qty|share|slot}
        |  POST /api/session/:id/done  |  /tip
        v
  Route handler (validate shape in TS: trim/length/int, nanoid for new ids)
        |  redis.eval(SCRIPT, ['session:<id>'], [ARGV...])      <- the ONLY write path (no GET-spread-SET)
        v
  Redis (single-threaded: every EVAL runs start-to-finish, one at a time)
   Lua: GET -> cjson.decode -> guard people table -> person exists? -> business rule -> mutate ONE concern -> cjson.encode -> SET EX 86400 -> return status string/array
        |
        v
  Route maps status string -> HTTP (404 not found / 409 conflict / 400 invalid / 500 invalid_session)
        |
  Clients poll GET /api/session/:id -> normalizeSession() repairs [] vs {} -> UI

 Test path (npm run test:redis):
  vitest globalSetup -> spawn redis-server 127.0.0.1:<free port> --save "" --appendonly no
     -> tests import the SAME script constants from lib/sessionLua.ts
     -> (a) direct: ioredis.eval(script, ...)   (b) route-level: vi.mock('@/lib/redis') -> ioredis adapter -> real route POST()
     -> assertions on decoded + normalizeSession'd state; invariants checked after every concurrent run
```

### Recommended Project Structure
```
lib/
  sessionLua.ts            # ALL Lua strings (move claim/share/slot/add_person/rename/currency here + new scripts + item ops)
  sessionSchema.ts         # MAX_PEOPLE, MIN_PEOPLE (exist) -> passed to Lua via ARGV
  seats.ts                 # nextGuestNumber = parity oracle for the Lua allocator
app/api/session/[sessionId]/
  edit/route.ts            # + claim_seat, add_seat, remove_seat ops; item ops -> eval
  claim/route.ts           # scripts imported; person_not_found mapping
redis-tests/               # NEW (excluded from the default vitest run)
  global-setup.ts          # spawn/stop redis-server, provide port
  helpers/redis.ts         # client factory, evalScript adapter, seedSession, readSession, assertNoOrphans
  helpers/redisAdapter.ts  # Upstash-shaped {eval,get,set} backed by ioredis (for route-level tests)
  seatScripts.redis.test.ts
  personGuards.redis.test.ts
  itemOps.redis.test.ts
  concurrency.redis.test.ts
  shapes.redis.test.ts
  coverage.redis.test.ts   # meta: every *_SCRIPT export is exercised
  routes.redis.test.ts     # real route handlers on real Redis (status mapping)
vitest.redis.config.mts
```

### Pattern 1: Harness config split (default run unaffected)
**What:** Default `vitest.config.mts` excludes `**/*.redis.test.ts`; `vitest.redis.config.mts` includes only them, runs in the `node` environment (no jsdom), non-parallel files, with a `globalSetup`.
**Example:**
```ts
// vitest.config.mts  (default; add exclude)
import { defineConfig, configDefaults } from 'vitest/config'
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'],
    exclude: [...configDefaults.exclude, '**/*.redis.test.ts'],
  },
})

// vitest.redis.config.mts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['redis-tests/**/*.redis.test.ts'],
    globalSetup: ['./redis-tests/global-setup.ts'],
    fileParallelism: false,       // one server, deterministic; keys are unique per test anyway
    testTimeout: 20_000,
  },
})
// package.json scripts:  "test:redis": "vitest run --config vitest.redis.config.mts"
```
[CITED: vitest.dev/config/globalsetup for globalSetup/provide/inject; configDefaults.exclude is standard vitest API]

### Pattern 2: globalSetup spawning an ephemeral redis-server
```ts
// redis-tests/global-setup.ts
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'
import Redis from 'ioredis'
import type { TestProject } from 'vitest/node'

declare module 'vitest' { export interface ProvidedContext { redisPort: number } }

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)) })
    s.on('error', rej)
  })
}

export default async function setup(project: TestProject) {
  const bin = process.env.REDIS_SERVER_BIN ?? 'redis-server'
  if (spawnSync(bin, ['--version']).error) {
    throw new Error('redis-server not found. Install it with `brew install redis` (dev-only), or set REDIS_SERVER_BIN. test:redis is a ship gate and must not silently pass.')
  }
  const port = await freePort()
  const proc: ChildProcess = spawn(bin, ['--port', String(port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no', '--dir', os.tmpdir()], { stdio: 'ignore' })
  // readiness: poll PING (max ~5s)
  const probe = new Redis({ port, lazyConnect: true, maxRetriesPerRequest: 0, retryStrategy: () => null })
  for (let i = 0; i < 50; i++) {
    try { await probe.connect(); await probe.ping(); break } catch { await new Promise(r => setTimeout(r, 100)) }
  }
  probe.disconnect()
  project.provide('redisPort', port)
  return () => { proc.kill('SIGTERM') }          // teardown
}
```
Notes: 127.0.0.1 + ephemeral port + dedicated process means the harness cannot reach live data (it never reads `UPSTASH_*`). `--save ""` and `--appendonly no` mean no files. I proved on this machine that the Homebrew 8.10.2 binary starts with exactly these flags and serves EVAL. [VERIFIED: ran redis-server 8.10.2 from the Homebrew bottle]

**Skip vs fail:** `npm test` / `npx vitest run` never load these files (excluded), so they are unaffected when redis-server is absent, and `next build` on Vercel does not run tests. `test:redis` itself should FAIL LOUDLY when redis-server is missing (REL-03 is a ship gate; a silent skip is how v2.0 shipped untested Lua). If the user prefers skip-with-warning, gate the throw behind `process.env.REDIS_TEST_OPTIONAL === '1'` and use `describe.skipIf` — flagged as an Open Question.

### Pattern 3: Eval adapter (Upstash call shape on ioredis)
```ts
// redis-tests/helpers/redisAdapter.ts
import Redis from 'ioredis'
export function createAdapter(port: number) {
  const client = new Redis({ port, maxRetriesPerRequest: 0 })
  return {
    client,
    // same signature the routes use: redis.eval(script, keys[], args[])
    eval: (script: string, keys: string[], args: (string | number)[]) =>
      client.eval(script, keys.length, ...keys, ...args.map(String)),
    // Upstash auto-JSON-parses on get(); mimic it for any remaining JS readers
    get: async <T = unknown>(k: string): Promise<T | null> => { const v = await client.get(k); if (v == null) return null; try { return JSON.parse(v) as T } catch { return v as unknown as T } },
    set: (k: string, v: unknown, opts?: { ex?: number }) => opts?.ex ? client.set(k, typeof v === 'string' ? v : JSON.stringify(v), 'EX', opts.ex) : client.set(k, typeof v === 'string' ? v : JSON.stringify(v)),
  }
}
```
Route-level tests then do:
```ts
vi.mock('@/lib/redis', async () => {
  const { inject } = await import('vitest')
  const { createAdapter } = await import('./helpers/redisAdapter')
  return { redis: createAdapter(inject('redisPort')) }
})
```
and call the real `POST` from the edit/claim/done/tip route files. Return-type parity: ioredis returns strings as strings, Lua integers as numbers, arrays as arrays, nil as `null` — identical to Upstash REST (I verified `return {'OK', 3, 'x'}` gives `["OK",3,"x"]` on both). [VERIFIED: executed on both]

### Pattern 4: Script shape-agnostic prelude (use in every script)
Guard every table access with `type(x) == 'table'`; never compare against `cjson.null` (Upstash decodes `null` to `nil`, local Redis to userdata, and `type(userdata) ~= 'table'` is false-safe on both). Skip non-table elements in `ipairs(people)`. Do the mutation AFTER the loop (never `table.remove` inside the iteration that finds the element). See Code Examples.

### Anti-Patterns to Avoid
- **GET-spread-SET in any route that mutates a session** (the whole of WR-01). After this phase, `grep -n "redis.get\|redis.set" app/api/session` should show only `GET` (read) and `POST /api/session` (create).
- **Testing Lua by string inspection** (`sessionLua.test.ts` style). Keep those static tests if wanted, but they prove nothing about execution (IN-04).
- **Asserting raw JSON text from local Redis** (key order and `{}`/`[]` differ from Upstash). Always `JSON.parse` + `normalizeSession` + invariants.
- **Mutating `session.people` while iterating it** (`table.remove` in the loop) or relying on `#` after leaving holes.
- **Putting scripts in a route file** (Next.js route modules may export only route fields; the harness cannot import them). Move them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic read-check-write | `multi()`/`WATCH` or JS locking | Single Lua `EVAL` | `multi()` is not atomic on Upstash REST; Lua runs serially in Redis. |
| Running Lua in tests | A JS Lua interpreter | Real `redis-server` via ioredis | cjson semantics (empty tables, null) are the bug surface and differ per runtime. |
| Redis lifecycle in tests | Manual "start redis first" steps | vitest `globalSetup` + `project.provide` | Reproducible, no leftover processes, ephemeral port. |
| `[]`/`{}` repair | Per-script shape forcing | `normalizeSession` at the GET boundary (exists) | Lua cannot control encoding; one repair point. |
| Unique ids | Counters in Lua | `nanoid()` in the route, passed in ARGV (existing add_person pattern) | Lua has no nanoid; ids need no atomic generation. |
| Guest numbers | Client-computed numbers | Lua allocator mirroring `lib/seats.ts` | Two phones adding at once must not mint the same number. |

**Key insight:** every correctness property in this phase (exactly one winner, no lost update, no orphan, floor, cap) is a property of ONE script execution, so each is cheap to guarantee in Lua and expensive/impossible in JS.

## Runtime State Inventory

Not a rename/refactor phase. One-line note: existing 24h sessions in Upstash have `people` entries with no `guestNumber` and may have `[]` for empty maps; all new scripts handle absence and both shapes (verified by seeding both). Nothing to migrate.

## Common Pitfalls

### Pitfall 1: Upstash and real Redis encode empty tables differently
**What goes wrong:** Tests pass locally and prod behaves differently (or the reverse). Local: `items: []` -> `{}` after any Lua write, breaking later JS `[...session.items]`. Upstash: `tips: {}` -> `[]`.
**Why:** Different cjson builds. Measured: local `cjson.encode(cjson.decode('{"items":[],"tips":{}}'))` = `{"items":{},"tips":{}}`; Upstash = `{"items":[],"tips":[]}`; `cjson.encode({})` = `{}` locally. [VERIFIED: executed on both]
**Avoid:** Scripts never depend on shape; after WR-01 no JS code reads the raw session except GET, which normalises. Harness seeds both shapes (hand-written JSON strings) and asserts through `normalizeSession`.
**Warning signs:** `TypeError: session.items is not iterable`; a test asserting `toEqual({ tips: {} })` on raw decoded state.

### Pitfall 2: null handling differs (WR-04 cousin)
**What goes wrong:** `"people": null` -> local: userdata (truthy, not a table); Upstash: `nil`. `[null, {...}]` -> local keeps a userdata hole element; Upstash silently drops the null. [VERIFIED: executed on both]
**Avoid:** `type(session.people) ~= 'table'` -> `invalid_session`; `type(p) == 'table'` inside loops (both already in DONE/TIP). Test cases: `people:null`, `[null,{...}]` on local Redis (these are the IN-04 cases).

### Pitfall 3: Same-name claim retries
**What goes wrong:** A phone retries a timed-out `claim_seat` with the same name and gets `seat_taken` because its first attempt actually succeeded.
**Avoid:** Keep the CAS strict (any non-empty seat -> `seat_taken`; accepting "same name" would let two different friends both named "Sam" merge into one seat). The client (Phase 16) must on `seat_taken` refetch the session and check whether the seat now carries its own name/personId. Document this contract for Phase 16; do not weaken the script.

### Pitfall 4: Whitespace-only and non-ASCII "empty" names
**What goes wrong:** TS `isEmptySeat` uses `.trim()` (Unicode whitespace, e.g. U+00A0); Lua `%s` is ASCII-only. A seat named `" "` is "empty" in the UI but "taken" in Lua.
**Avoid:** Names are trimmed with JS `trim()` before every write (rename/claim/add_person), so stored non-empty names never hit this. Only `POST /api/session` accepts raw names (does not trim). Cheap fix: trim `people[].name` there (optional hardening), plus a Lua parity test for `''`, `' '`, `'\t'`, `'A'`.

### Pitfall 5: Removing a seat leaves stale per-person keys
**What goes wrong:** `donePeople[id] = false` (after done -> undone) or other leftover keys referencing a removed id become orphans.
**Avoid:** `remove_seat` blocks only on `donePeople == true`, `personSlots == true`, any `tips` entry (including 0), any `claims.items[*][id]` entry (any qty shape: qty and share claims both store `{qty = n}`). On success also nil the id's keys in `donePeople`/`personSlots`/`tips` so `assertNoOrphans` holds. This is tidy-up of non-active flags, not purging claims (claims already block removal).

### Pitfall 6: Guest-number growth/reuse
**What goes wrong:** `max+1` over present people reuses a number when the highest seat is removed (Guest 3 removed, next add is Guest 3 again) and can only exceed `MAX_GUEST_NUMBER` (999) after ~50 heavy add/remove cycles.
**Avoid:** Reuse of the highest freed number is acceptable for SEAT-04 (existing seats are never renumbered). If the candidate exceeds 999, fall back to the smallest unused positive integer (in the draft). A monotonic `session.nextGuestNumber` counter would avoid reuse but adds a new session field; not recommended.

### Pitfall 7: Existing tests that assert old behaviour
`__tests__/editRoute.test.ts` has ~10 tests for add/remove/edit_* that mock `redis.get`/`redis.set` and assert on the saved payload. WR-01 changes the route to `redis.eval`, so those tests must be rewritten to the `mockEval` style (like Tests 14-16 for add_person). `add_person` tests assert `argv[0]` is the trimmed name: keep add_person's ARGV order `[name, newPersonId]`.

### Pitfall 8: rename_person on an empty seat bypasses the CAS
`RENAME_PERSON_SCRIPT` is unconditional, so a client (or a stale UI) calling `rename_person` on an EMPTY seat would let two phones overwrite each other's name, i.e. the Pitfall-1 merge via a side door. Locked decision says rename stays unconditional "for named people". Recommended hardening: in the script, if the target is currently empty return `seat_empty` (route: 409) so empty seats can only be taken through `claim_seat`. See Open Question 2.

### Pitfall 9: vi.mock factory ordering for `inject`
`vi.mock` factories are hoisted; import `inject` via `await import('vitest')` inside the factory (shown above), or read the port from `process.env` set in globalSetup. Prove in a Wave-0 spike that the route-level mock sees the port.

## Code Examples

All scripts below were executed on local Redis 8.10.2; the three seat scripts were also executed on Upstash (throwaway key, deleted). They are drafts for `lib/sessionLua.ts`; ARGV carries limits so TS constants stay the single source of truth.

### Shared prelude (concatenate into each script via template literal; constants only, never user input)
```lua
local raw = redis.call('GET', KEYS[1])
if not raw then return 'session_not_found' end
local ok, session = pcall(cjson.decode, raw)
if not ok or type(session) ~= 'table' then return 'invalid_session' end
if type(session.people) ~= 'table' then return 'invalid_session' end
local function isEmptyName(p)
  return type(p.name) ~= 'string' or string.match(p.name, '^%s*$') ~= nil
end
local function findPerson(id)
  for i, p in ipairs(session.people) do
    if type(p) == 'table' and p.id == id then return i, p end
  end
  return nil, nil
end
```

### CLAIM_SEAT  (KEYS[1]=session; ARGV[1]=personId, ARGV[2]=trimmed name)
Returns `'OK' | 'seat_taken' | 'person_not_found' | 'invalid_args' | 'session_not_found' | 'invalid_session'`.
```lua
-- PRELUDE
local personId = ARGV[1]
local name = ARGV[2]
if type(name) ~= 'string' or string.match(name, '^%s*$') ~= nil then return 'invalid_args' end
local idx, person = findPerson(personId)
if not idx then return 'person_not_found' end
if not isEmptyName(person) then return 'seat_taken' end
person.name = name
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
```
Measured: 20 concurrent claims -> 1 `OK`, 19 `seat_taken`, winner's name persisted. On Upstash: `OK` then `seat_taken`.

### ADD_SEAT  (ARGV[1]=newPersonId (nanoid from route), ARGV[2]=MAX_PEOPLE, ARGV[3]=MAX_GUEST_NUMBER)
Returns `{'OK', guestNumber}` or a status string (`'too_many_people'`, ...). Mirrors `nextGuestNumber`/`fallbackGuestNumbers` in `lib/seats.ts` exactly, so mixed v2.0/seat sessions never get duplicate labels (review WR-03).
```lua
-- PRELUDE
local newId = ARGV[1]
local maxPeople = tonumber(ARGV[2])
local maxGuest = tonumber(ARGV[3])
if newId == nil or newId == '' or maxPeople == nil or maxGuest == nil then return 'invalid_args' end
if #session.people >= maxPeople then return 'too_many_people' end
local function validGN(v) return type(v) == 'number' and v >= 1 and v <= maxGuest and v % 1 == 0 end
local taken, maxN = {}, 0
for _, p in ipairs(session.people) do
  if type(p) == 'table' and validGN(p.guestNumber) then
    taken[p.guestNumber] = true
    if p.guestNumber > maxN then maxN = p.guestNumber end
  end
end
local n = 0
for _, p in ipairs(session.people) do
  if type(p) == 'table' and isEmptyName(p) and not validGN(p.guestNumber) then
    repeat n = n + 1 until not taken[n]
    if n > maxN then maxN = n end
  end
end
local guestNumber = maxN + 1
if guestNumber > maxGuest then
  guestNumber = 1
  while taken[guestNumber] do guestNumber = guestNumber + 1 end
end
table.insert(session.people, { id = newId, name = '', colorIndex = #session.people % 6, guestNumber = guestNumber })
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return { 'OK', guestNumber }
```
Measured: 25 concurrent adds at 2 people -> 18 arrays, 7 `too_many_people`, 20 people, unique guest numbers; Guests 1/2/3, remove 2, add -> 4 (Guest 3 stays 3). Route response: `{ ok: true, personId, guestNumber }` (route reads `result[1]`/`result[2]`; must also accept the status-string case).

### REMOVE_SEAT  (ARGV[1]=personId, ARGV[2]=MIN_PEOPLE)
Check order (document it, test it): `person_not_found` > `seat_not_empty` > `too_few_people`.
```lua
-- PRELUDE
local personId = ARGV[1]
local minPeople = tonumber(ARGV[2])
if minPeople == nil then return 'invalid_args' end
local idx, person = findPerson(personId)
if not idx then return 'person_not_found' end
if not isEmptyName(person) then return 'seat_not_empty' end
local claims = type(session.claims) == 'table' and session.claims or {}
if type(claims.items) == 'table' then
  for _, perItem in pairs(claims.items) do
    if type(perItem) == 'table' and perItem[personId] ~= nil then return 'seat_not_empty' end
  end
end
if type(claims.personSlots) == 'table' and claims.personSlots[personId] == true then return 'seat_not_empty' end
if type(claims.donePeople) == 'table' and claims.donePeople[personId] == true then return 'seat_not_empty' end
if type(session.tips) == 'table' and session.tips[personId] ~= nil then return 'seat_not_empty' end
if #session.people <= minPeople then return 'too_few_people' end
table.remove(session.people, idx)
-- (recommended) also: claims.donePeople[personId] = nil ; claims.personSlots[personId] = nil  (only reached when they are absent/false)
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 86400)
return 'OK'
```
Measured: slot/done/tip/claim each -> `seat_not_empty`; `donePeople=false` -> removable; at 2 people -> `too_few_people`. Caveat: `tips[id] == 0` counts as a tip (conservative). If you add the cleanup lines, note that assigning `claims.donePeople[personId] = nil` on a fallback `{}` created by `or {}` is a no-op on the session, so write them against `session.claims` guarded by `type(session.claims) == 'table'`.

### person_not_found guard for the three claim scripts (QTY_CLAIM, SHARE_CLAIM, SLOT_CLAIM, after moving them to lib/sessionLua.ts)
Insert after the decode (same prelude, plus the people guard):
```lua
if type(session.people) ~= 'table' then return 'invalid_session' end
local found = false
for _, p in ipairs(session.people) do
  if type(p) == 'table' and p.id == personId then found = true break end
end
if not found then return 'person_not_found' end
```
Apply it to ALL branches including `qty == 0` and `joining == 'false'` (leaving for a ghost is also rejected, consistently). Also add to `RENAME_PERSON_SCRIPT` the `type(p) == 'table'` guard (it uses bare `p.id`, which errors on a local-Redis `cjson.null` element). `UPDATE_CURRENCY` and `ADD_PERSON` need only the `type(session) == 'table'` / people-table guards.

### Item ops (WR-01): one small script per op, shared ITEM prelude
```lua
-- PRELUDE + :
if type(session.items) ~= 'table' then return 'invalid_session' end
local function findItem(id)
  for i, it in ipairs(session.items) do
    if type(it) == 'table' and it.id == id then return i, it end
  end
  return nil, nil
end
```
- `ITEM_ADD` ARGV `[newItemId(nanoid), name, priceCents, quantity]` -> `table.insert(session.items, {id=,name=,priceCents=tonumber,quantity=tonumber})`.
- `ITEM_REMOVE` ARGV `[itemId]` -> `table.remove(session.items, idx)`; `session.claims.items[itemId] = nil` (guarded). Touches only items + that one claims key.
- `ITEM_EDIT_PRICE` / `ITEM_EDIT_NAME` -> set one field on the found item (`item_not_found` otherwise).
- `ITEM_EDIT_QUANTITY` ARGV `[itemId, newQty]` -> sum `claims.items[itemId][*].qty` inside Lua; `if q < total then return {'qty_below_claimed', total}` (route builds the existing message `Cannot reduce quantity to N: M units are already claimed`). This also closes the old validate-in-JS-then-SET race against `QTY_CLAIM_SCRIPT`.
Route mapping: `item_not_found` -> 400 `Invalid payload: itemId not found in session` (unchanged contract); `qty_below_claimed` -> 400 (unchanged); `session_not_found` -> 404; `invalid_session` -> 500. TS `validateOp` keeps shape validation but no longer needs the session (drop its `session` param for these ops, keep `{}`-style call like the other Lua ops). Verified: removing the last item stores `items:{}` locally and a following `ITEM_ADD` revives it as an array (`ipairs`/`table.insert` tolerate both).

### Route status mapping (consistent with existing routes)
| Script result | HTTP | Body | Notes |
|---|---|---|---|
| `OK` / array `{'OK', n}` | 200 | `{ ok: true }` (+ `personId`, `guestNumber` for add_seat) | existing contract |
| `session_not_found` | 404 | `{ error: 'session_not_found' }` | existing |
| `person_not_found` | 404 | `{ error: 'person_not_found' }` | matches rename_person today. done/tip currently return 400 `Invalid personId: not in session` and their tests lock that; leave them (clients do not branch on it: grep of components found no status-specific handling) |
| `seat_taken` | 409 | `{ error: 'seat_taken' }` | claim_seat |
| `seat_not_empty` | 409 | `{ error: 'seat_not_empty' }` | remove_seat |
| `too_few_people` | 409 | `{ error: 'too_few_people' }` | remove_seat floor |
| `too_many_people` | 409 | `{ error: 'too_many_people' }` | add_seat; add_person keeps `session_full` / `Session is full (max 20 people)` 409 (existing test) |
| `qty_exceeded` | 409 | existing | unchanged |
| `invalid_args` | 400 | `Invalid <op>: ...` | route validation normally catches first |
| `invalid_session` | 500 | `{ error: 'invalid_session' }` | existing |
| unknown result | 500 | `{ error: 'Edit failed' }` + `console.error` | pattern from done/tip |

claim_seat route validation: reuse the `add_person` name rules (string, trimmed non-empty, <= 50, return `normalizedName`), plus `personId` non-empty string. remove_seat: `personId` non-empty string. add_seat: no body fields; route generates `nanoid()` and passes `[newId, String(MAX_PEOPLE), String(MAX_GUEST_NUMBER)]`.

### Concurrency / invariants test design (real Redis)
Redis runs scripts one at a time, so "simultaneous" means arrival order is unknown, not that scripts interleave. Therefore tests assert order-independent invariants over many runs, and enumerate both orderings of each conflicting pair explicitly.
1. **Stampede claim:** 20 `claim_seat` on one seat via `Promise.all`, each on its OWN ioredis connection, distinct names -> exactly 1 `OK`, 19 `seat_taken`, final name equals the winner's name (REL-03, criterion 1).
2. **No lost update (REL-01):** seed 2 named + 3 empty seats + 3 items; fire together: `done(a)`, `tip(b, 500)`, `claim_seat(g1,'Sam')`, `add_seat` x3, `ITEM_EDIT_PRICE(i1)`, `ITEM_EDIT_NAME(i2)`, `ITEM_ADD`, `qty claim(a,i1)`, `share claim(b,i2)`. Assert EVERY effect is present in the final state (commutative ops, so any serial order yields the same state).
3. **Pair matrix, both orders run sequentially AND concurrent x N fresh sessions:** (claim_seat, remove_seat same seat), (qty/share claim by empty seat's id, remove_seat), (tip/done for the seat id, remove_seat), (add_seat, remove_seat), (rename_person, remove_seat). Decision table: claim first -> remove returns `seat_not_empty`; remove first -> claim returns `person_not_found`. Never "claim OK and seat gone", never "named seat removed".
4. **Floor under race:** seed 1 named + 2 empty seats (3 people); fire 2 concurrent `remove_seat` for the two empties -> exactly 1 `OK` and 1 `too_few_people`, final `people.length == 2`. Also seed 2 named + 3 empty (5) and fire 5 concurrent removes of the 3 empties -> 3 `OK`, final 2 named.
5. **Cap under race:** 18 people, 5 concurrent `add_seat` -> 2 OK, 3 `too_many_people`, final 20, unique guest numbers.
6. **Orphan invariant helper**, called after every test: every personId key in `claims.items[*]`, `tips`, `claims.donePeople`, `claims.personSlots` is in `people[].id`; no duplicate person ids; no duplicate non-null guestNumbers; `people.length` in [2, 20] for seat-op tests.
7. **Ghost writes are rejected and NOT stored:** for qty/share/slot/done/tip with an unknown id: result `person_not_found` and `GET` string byte-identical before/after (REL-02).
8. **Shape tests:** seed each fixture twice (Upstash-shape `[]` empties, local-shape `{}` empties) for all scripts; plus `people:null`, `[null, {...}]`, `items: {}` then `ITEM_ADD`, `claims` missing entirely; assert `normalizeSession(JSON.parse(raw))` yields array `items`/`people` and object maps (WR-02, WR-04, IN-04).
9. **TS/Lua parity (SEAT-04):** property-style loop over generated people arrays (mix of stored numbers, unnumbered empties, named, gaps) -> Lua `ADD_SEAT` guestNumber == `nextGuestNumber(people)`; Lua empty check == `isEmptySeat` for `''`, `' '`, `'\t'`, `'A'`.
10. **Coverage meta-test (REL-03):** `Object.keys(await import('@/lib/sessionLua')).filter(k => k.endsWith('_SCRIPT'))` must all appear in a local list of "scripts exercised by real-Redis tests"; adding a script without a test fails the gate.
11. **Negative control (optional, recommended):** one test reimplements the OLD GET-spread-SET for an item edit and shows it loses a concurrent `done` write on the real server, proving the harness can detect a clobber.
Seed/read helpers: `seed(session | string)` -> `SET session:<nanoid>`; `read()` -> `JSON.parse(GET)`. Use unique keys per test (no `FLUSHDB` needed, but safe because the server is dedicated).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mock `redis.eval` and string-match Lua | Run exact Lua on real redis-server | This phase | Catches cjson and logic errors (v2.0 failure mode) |
| `/edit` item ops GET-spread-SET | Field-level Lua | This phase | REL-01 |
| Scripts inline in route files | Scripts in `lib/sessionLua.ts` | Phase 12 started it | Importable by harness |

**Deprecated/outdated:** the code comment "cjson encodes empty Lua tables as []" (claim route) is only true for Upstash; the `sessionLua.ts` header sentence that the done/tip move "removed the silent-revert window" becomes true only after WR-01; update both comments.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ioredis is a legitimate package (slopcheck unavailable; evidence: 36M weekly downloads, redis/ioredis repo) | Package Legitimacy | Low; planner adds a human-verify checkpoint |
| A2 | Strict CAS (no "same name is OK") is the desired claim_seat semantics; Phase 16 client handles the retry case via refetch | Pitfall 3 | Retried claims show a spurious "seat taken" until Phase 16 handles it |
| A3 | `rename_person` should reject empty seats (`seat_empty`) | Pitfall 8 | If user wants rename to work on empty seats, drop the guard; CAS bypass then possible |
| A4 | `test:redis` should fail hard when redis-server is absent | Pattern 2 | If user prefers skip, add `REDIS_TEST_OPTIONAL` switch |
| A5 | `tips[id] == 0` counts as "has a tip" blocking removal | Pitfall 5 | An empty seat with a stored 0 tip would be unremovable (very unlikely: no device can tip for an unclaimed seat) |
| A6 | Reusing the highest freed guest number is acceptable for SEAT-04 | Pitfall 6 | If user wants never-reused numbers, add `session.nextGuestNumber` |

All Redis/Upstash behaviour claims above are `[VERIFIED: executed]` in this session, not assumed.

## Open Questions

1. **Hard fail vs skip when redis-server is absent for `npm run test:redis`?**
   - Known: default `vitest run` and Vercel builds are unaffected either way (files excluded from the default config).
   - Recommendation: hard fail with the install hint; allow `REDIS_TEST_OPTIONAL=1` opt-out.
2. **Should `rename_person` refuse empty seats (`seat_empty`)?**
   - Recommendation: yes (closes the CAS bypass). Existing editRoute tests mock eval so are unaffected.
3. **Post-ship Upstash smoke:** Local Redis (8.10.2) differs from Upstash (8.4.0-compatible, different cjson empty/null handling). The automated gate covers script logic under both shapes; recommend a one-off manual Upstash smoke (throwaway session, same as Phase 12's 2026-10-06 run) as the final human-verify step, not as an automated test.
4. **Where to put `claim_seat` etc. in the API?** Architecture research says `/edit` ops; this document follows that (ops `claim_seat`, `add_seat`, `remove_seat` added to `VALID_OPS`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | vitest, ioredis | yes | v24.15.0 | — |
| Homebrew | install redis | yes | 5.1.8 | — |
| redis-server / redis-cli | REL-03 harness | NO (not installed) | brew formula 8.10.2 available | none; install is a Wave-0 prerequisite (`brew install redis`) |
| docker | (not needed) | NO | — | — |
| Upstash REST creds | not needed by harness; only the optional manual smoke | yes (.env.local) | Redis 8.4.0 / upstash 1.18.1 | — |

**Missing dependencies with no fallback:** redis-server (user decision: install via Homebrew; a blocking human-action checkpoint at start of the harness plan). Note I extracted the Homebrew 8.10.2 bottle to a scratch dir and ran it successfully (needed `DYLD_LIBRARY_PATH=/opt/homebrew/opt/openssl@3/lib` only because it ran outside the Cellar; a normal `brew install redis` resolves openssl itself). Redis 8 licensing (RSALv2/SSPL/AGPLv3 tri-license) is irrelevant for a dev-only local tool that is not distributed. [ASSUMED]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 (existing, jsdom default project) + new node-environment redis project; ioredis 5.11.1 client |
| Config file | `vitest.config.mts` (add `exclude` for `*.redis.test.ts`); NEW `vitest.redis.config.mts` |
| Quick run command | `npx vitest run` (existing mock/unit suite; must stay green and Redis-free) |
| Real-Redis command | `npm run test:redis` (= `vitest run --config vitest.redis.config.mts`) |
| Full suite command | `npx vitest run && npm run test:redis` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REL-03 | Every `*_SCRIPT` export executes on real Redis; harness boots/stops redis-server; coverage meta-test fails if a script is untested | real-redis integration | `npm run test:redis` | Wave 0 |
| REL-03 | Static string tests for new scripts (no `${`, KEYS/ARGV count) | unit | `npx vitest run __tests__/sessionLua.test.ts` | extend existing |
| SEAT-03 (success 1) | 20 concurrent claims on one seat -> 1 OK + 19 `seat_taken`; route maps to 409 | real-redis | `npx vitest run --config vitest.redis.config.mts redis-tests/seatScripts.redis.test.ts redis-tests/concurrency.redis.test.ts` | Wave 0 |
| REL-01 (success 2) | Mixed concurrent claim/add/remove/done/tip/item-ops keep every effect; edit route item ops use `eval` not `get`/`set` | real-redis + unit(mock) | `npx vitest run --config vitest.redis.config.mts redis-tests/concurrency.redis.test.ts redis-tests/itemOps.redis.test.ts` and `npx vitest run __tests__/editRoute.test.ts` | Wave 0 / rewrite existing |
| REL-02 (success 3) | Ghost personId rejected (`person_not_found`) and state byte-identical for qty/share/slot/done/tip; no orphan keys after remove-vs-claim races | real-redis | `npx vitest run --config vitest.redis.config.mts redis-tests/personGuards.redis.test.ts` | Wave 0 |
| SEAT-03 (success 4) | Named/claimed/tipped/done/slot seat -> `seat_not_empty`; floor 2 -> `too_few_people`; floor holds under concurrent removes; cap 20 under concurrent adds | real-redis | `npx vitest run --config vitest.redis.config.mts redis-tests/seatScripts.redis.test.ts` | Wave 0 |
| SEAT-04 (success 5) | Remove Guest 2 keeps Guest 3; add after remove = max+1; Lua allocator == `nextGuestNumber` over generated inputs | real-redis + unit | same seatScripts file; `npx vitest run __tests__/seats.test.ts` | Wave 0 |
| REL-02/WR-02/WR-04/IN-04 | Both empty-table shapes, `people:null`, null elements, `items:{}` then add, via `normalizeSession` | real-redis | `npx vitest run --config vitest.redis.config.mts redis-tests/shapes.redis.test.ts` | Wave 0 |
| Route status mapping | 200/404/409/400 per mapping table, real route handlers on real Redis | real-redis | `npx vitest run --config vitest.redis.config.mts redis-tests/routes.redis.test.ts` | Wave 0 |
| Back-compat (REL-04 regression) | v2.0 fixture still opens/claims/tips after the changes | unit | `npx vitest run __tests__/v2SessionCompat.test.ts` | exists |

### Sampling Rate
- **Per task commit:** `npx vitest run` (default suite) plus the specific `test:redis` file touched
- **Per wave merge:** `npx vitest run && npm run test:redis`
- **Phase gate:** both green, then a manual Upstash smoke (human-verify) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `brew install redis` (human action; blocks every `*.redis.test.ts`)
- [ ] `npm i -D ioredis@5.11.1` (behind human-verify checkpoint, slopcheck unavailable)
- [ ] `vitest.redis.config.mts`, `redis-tests/global-setup.ts`, `redis-tests/helpers/{redis,redisAdapter}.ts`, `package.json` `test:redis` script, default config `exclude`
- [ ] Spike proving `vi.mock('@/lib/redis')` + `inject('redisPort')` works inside the factory
- [ ] Move claim/share/slot/add_person/rename/currency scripts into `lib/sessionLua.ts` (tests import them) and keep existing route tests green
- [ ] All `*.redis.test.ts` files listed in the structure above

## Security Domain

`security_enforcement` is not set to false in `.planning/config.json` (absent = enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | App has no accounts (anonymous links) |
| V3 Session Management | no (session = bill id) | — |
| V4 Access Control | yes (light) | Flat model by decision; `person_not_found` guard stops acting as non-existent people; no host role |
| V5 Input Validation | yes | Route validation (trimmed 1..50 name, non-empty ids, integers) + Lua `invalid_args`; user data only via ARGV, never interpolated into script text |
| V6 Cryptography | no | — |

### Known Threat Patterns for Redis-Lua + Next route handlers
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Lua injection via string interpolation | Tampering | KEYS/ARGV only; the only template interpolation is a TS constant prelude |
| Seat-claim race / identity merge | Tampering/Spoofing | Atomic CAS on empty name |
| Orphan writes after removal | Tampering | `person_not_found` in same script as write |
| Unbounded people growth / DoS | DoS | Cap in Lua (`MAX_PEOPLE` via ARGV), plus POST create cap (Phase 12) |
| Huge ARGV (name) | DoS | Route enforces <= 50 chars before eval |
| Test harness touching live data | Information/Tampering | Spawn on 127.0.0.1 ephemeral port; never read `UPSTASH_*` in `redis-tests/` |
| Dev dependency supply chain | Tampering | devDependency only; human-verify checkpoint; no postinstall |

## Sources

### Primary (HIGH confidence)
- Executed experiments (this session): Homebrew redis 8.10.2 bottle (`brew fetch` + extract, ran on port 6390) and the live Upstash REST endpoint (pure-compute `EVAL` with 0 keys, plus one throwaway key `session:zz-p13-research-throwaway` with 120s TTL, deleted) for cjson empty-table/null/number/array-return behaviour and for all three seat scripts.
- Repo code: `lib/sessionLua.ts`, `lib/seats.ts`, `lib/normalizeSession.ts`, `lib/sessionSchema.ts`, `app/api/session/[sessionId]/{edit,claim,done,tip,route}.ts`, `__tests__/editRoute.test.ts`, `__tests__/sessionLua.test.ts`, `.planning/phases/12-*/12-REVIEW.md`, `12-HUMAN-UAT.md`, `.planning/research/{SUMMARY,PITFALLS}.md`.
- vitest.dev/config/globalsetup (globalSetup signature, `project.provide`, `inject`, `ProvidedContext` augmentation).
- npm registry: `npm view ioredis` (versions, dates, engines, deps), npmjs downloads API.

### Secondary (MEDIUM confidence)
- Homebrew `brew info redis` (stable 8.10.2).

### Tertiary (LOW confidence)
- Redis 8 licence note (A-tagged above); not verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for ioredis/vitest mechanics (verified API + executed); package legitimacy `[ASSUMED]` only because slopcheck was unavailable.
- Architecture/scripts: HIGH, drafts executed on real Redis and partially on Upstash.
- Pitfalls: HIGH for shape/null differences (measured); MEDIUM for the policy items (A2-A6).

**Research date:** 2026-10-06
**Valid until:** 2026-11-05 (Upstash runtime or Redis cjson build could change the shape behaviour; re-run the two cjson probes if more than ~30 days pass)
