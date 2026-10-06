# Technology Stack — v2.1 "Faster people setup"

**Project:** Bill Splitter (easy-billsy)
**Researched:** 2026-10-06
**Scope:** Only what the NEW v2.1 features need. Base stack (Next.js 16, React 19, TS, Tailwind v4, shadcn/ui, Zustand 5.0.13, @upstash/redis 1.38, openai 6.37, nanoid, Vitest 4) is validated and not re-researched.
**Overall confidence:** HIGH (conclusions come from reading the actual code, not external docs)

## Verdict: NO new dependencies

Every v2.1 capability is a change to an existing piece. Do not run `npm install` for this milestone.

The key design choice that makes this true: **a "seat" is just a `Person` whose `name` is the empty string.** No new `seats` array, no new entity.

Why this is the right model, from the code:
- `POST /api/session` `isValidPeople` already accepts `name: ''` (it only checks `typeof name === 'string'`). Session creation needs no change for empty seats (it needs a cap check, see below).
- `computeEqualChargeShares(charge, people)` divides tax and service across `people.length`. Empty seats are already in `people`, so "empty seats pay an equal share of tax/service" works with zero billing-math changes.
- A single source of truth (`session.people`) avoids a second list drifting out of sync under concurrent edits. A parallel `seats[]` would need its own Lua and its own reconcile logic.
- "Empty" is derived: `name.trim() === ''` AND no claims AND no tip AND not done. It is never stored as a flag, so it cannot go stale.

## Changes to existing pieces

### 1. OCR schema — `app/api/ocr/route.ts` (small)

| Where | Change |
|-------|--------|
| `SYSTEM_PROMPT` (line ~20 JSON shape + rules ~30-39) | Add `guestCount` to the documented shape plus a rule: "number of diners printed as Pax / Covers / Guests / Persons / Couverts / Kisi (an integer), null if not printed. Never infer from item quantities." |
| `response_format` JSON schema (~line 205-225) | Add `guestCount: { type: ['integer', 'null'] }` to `properties` AND to `required`. Strict mode rejects schemas where a property is missing from `required`; nullability is the optionality mechanism (same as `serviceFeeCents`). |
| `OcrParsed` interface + `parseOcrResponse` (~line 58, 155) | Add `guestCount: number \| null`. Normalise with a new tiny guard: integer, `>= 1`, `<= 20` else null (not `toIntCentsOrNull`, which is cents-specific). |
| Two-pass merge (~line 321 `best`) | Carry `guestCount` through the retry path: `best` is picked per pass, so take `guestCount` from whichever pass has non-null (prefer pass 1). Easy to forget; the retry path builds the result by hand. |
| Route JSON response + client consumer in `SetupStep` | Return `guestCount`; client calls `setHeadcount(guestCount ?? 2)` only as a PREFILL. |
| `__tests__/ocrRoute.test.ts` | Add cases: guestCount present, null, 0, 99, non-integer. |

Why a cap of 20: `ADD_PERSON_SCRIPT` hard-caps `#session.people >= 20`. A misread "Pax 120" must never produce a headcount the server will reject. Clamp the same value in the OCR parser, the counter UI max, and `POST /api/session` (see below). Define it once as an exported constant (e.g. `MAX_PEOPLE = 20` in `lib/sessionSchema.ts`) and also pass it into the Lua scripts as an ARGV rather than hardcoding a third copy.

Cost/latency: one extra nullable integer in the same vision call. No extra call, no extra model, no measurable cost.

### 2. Zustand store — `stores/useBillStore.ts` (small, additive)

No new library, no new middleware. Existing `persist` (key `easy-billsy-bill`, `version: 1`) stays.

| Change | Detail |
|--------|--------|
| New field `headcount: number` (INITIAL_STATE `1`) + `setHeadcount(n)` | Setup-screen counter value. Clamp to `[1, MAX_PEOPLE]` in the setter. |
| New action `setSeatCount(total, ownerName)` OR derive on submit | On "Create session": `people = [owner, ...Array(headcount-1) of {id, name:'', colorIndex}]`. Prefer deriving at submit time in one pure helper `buildPeopleFromHeadcount(ownerName, headcount, startColorIndex)` in `lib/` (unit-testable) rather than keeping empty people in the store while the counter is being tapped. |
| `addPerson(name)` | Already accepts any string; allow `''`. Check no caller trims-and-rejects. |
| `removePerson(id)` | Unchanged. It is the setup-only remove and already safe. |
| Persistence | Add `headcount` to `partialize`. Missing in older persisted blobs is harmless (defaults from INITIAL_STATE via shallow merge), so **do NOT bump `version`** and do not write a `migrate`. |
| Do NOT persist | OCR `guestCount` itself. It is a one-shot prefill, not state. |

Important integration point: the live Bill View reads the session from Redis polling, not from this store. The store only covers Setup. Live seat add/remove goes through the API, not Zustand, so the store needs no "seat" concept beyond `headcount`.

Colour index: `ADD_PERSON_SCRIPT` uses `#people % 6`. Seat removal makes this non-unique over time (two people may end up with the same colour after a middle seat is removed). Acceptable and cosmetic; do not add colour bookkeeping.

### 3. Session schema — `lib/sessionSchema.ts` (essentially none)

- `SessionPayload` shape is UNCHANGED. `Person.name` is already `string`; document that `''` means empty seat.
- Add `export const MAX_PEOPLE = 20` and `export const isEmptySeat(person, session)` helper (name blank AND not in `claims.items[*]`, `tips`, `donePeople`).
- No migration. Existing sessions have only named people; they simply have no empty seats. 24h TTL means old payloads vanish by themselves anyway.
- `POST /api/session`: add `b.people.length <= MAX_PEOPLE` to `isValidPeople`. At present creation has no cap while add_person does, so a client could create 25 seats and then be unable to add one more. Also optionally enforce "at least one non-empty name" is NOT required (scanner may go straight in; she still types her name per the spec, so validate client-side only).

### 4. Redis / Lua — `app/api/session/[sessionId]/edit/route.ts` (the real work)

Keep the existing architecture: `redis.eval` of a Lua script, `cjson` decode/encode, `EX 86400`, one script constant per op, validate in TypeScript first. This is the proven pattern here (ADD_PERSON, RENAME_PERSON, UPDATE_CURRENCY) and the only atomic option, because Upstash REST `multi()` is not atomic (already documented in the claim route). Do NOT switch to `WATCH`/optimistic transactions, Redis JSON module, hashes, or Streams. Whole-session JSON string with Lua is fine at <5 KB and 20 people.

New ops (add to `VALID_OPS`):

| Op | Purpose | Lua behaviour | Returns |
|----|---------|---------------|---------|
| `claim_seat` | Friend picks ANY empty seat and types a name | Find person by id; if `name ~= ''` return `seat_taken`; else set `name`. This is a compare-and-set so two friends tapping the same seat in the same second cannot both "win" and silently merge identities. | `OK` / `seat_taken` / `person_not_found` / `session_not_found` / `invalid_session` |
| `add_seat` | Anyone adds an empty seat live | Same as `ADD_PERSON_SCRIPT` with `name = ''`. Simplest: reuse `ADD_PERSON_SCRIPT` and allow `name ''` for the op `add_seat` (validator differs: no non-empty requirement). Keep `add_person` (named, for "I'm not listed") unchanged. | `OK` + `personId` / `session_full` |
| `remove_seat` | Anyone removes an EMPTY seat | Atomically verify emptiness INSIDE Lua, then remove from `people`. See below. | `OK` / `seat_not_empty` / `last_seat` / `person_not_found` / ... |

`remove_seat` Lua must check, in the same script as the delete (a TS pre-check is a race, same reasoning as the CR-03 comment in the claim script):
1. `p.name == ''` (else `seat_not_empty`)
2. `session.claims.items[*][personId]` absent for every item
3. `session.tips[personId]` nil
4. `session.claims.donePeople[personId]` nil and `personSlots[personId]` nil
5. `#session.people > 1` (never delete the last seat)
Then `table.remove(session.people, idx)`.

Concurrency hole to close (this is the one genuinely new correctness risk): **claim/tip/done scripts do not currently verify that `personId` exists in `session.people`.** Today that is harmless because people are never removed live. With `remove_seat`, a friend who loaded the page before the removal can fire a claim for a deleted seat and create an orphan claim that bills nobody and shows as "claimed" in the unclaimed counts. Fix: add a `person_not_found` guard (loop over `session.people`) at the top of `QTY_CLAIM_SCRIPT`, `SHARE_CLAIM_SCRIPT`, and the tip/done scripts, and map it to a 404/409 that the client treats as "your seat was removed, pick again" (re-open the identity modal). This guard is cheap (<=20 iterations).

Lua/cjson gotchas that bite specifically here (HIGH confidence, visible in the existing code comments):
- `cjson.encode` writes an EMPTY Lua table as `[]`, not `{}`. After `remove_seat` deletes the last key from `tips`, `donePeople` or `personSlots`, they will serialise as `[]`. The client reads them as `Record<...>` and lookups on `[]` return `undefined`, so it mostly works, but `Object.entries` / spreads stay fine while `JSON.stringify` roundtrips differ. The claim script already works around this by deleting empty per-item objects; follow that. Do not write defensive code that assumes `{}`; normalise on the client read (`Array.isArray(x) ? {} : x`) in one place (the session fetch helper).
- `table.remove` shifts later elements down; `people` order drives the remainder-cent allocation in `computeEqualChargeShares`, so removing a seat can change who gets the extra cent. This is fine and deterministic (server-authoritative order), just do not "cache" order client-side.
- Remove a seat and the headcount for tax splits drops with it automatically (tax/service are derived from `people.length` at render). No claim writes needed.
- Numbers like `qty` survive cjson as numbers; names stay strings. `''` names round-trip (cjson encodes `""`).

Routing: add the three ops to the existing `/edit` route (same file, same `VALID_OPS` list, same error mapping). Do not create new route files. Do not introduce a `redis.ts` helper layer for scripts now; the three existing scripts live inline in the route and a fourth/fifth is consistent. (If the file passes ~600 lines, extract all Lua to `lib/sessionScripts.ts` as a single refactor, not mixed into feature work.)

Testing: the project's own memory notes live remove-person was descoped because the Lua had "no execution test". `__tests__/editRoute.test.ts` mocks `redis`, so it cannot catch Lua bugs. For `remove_seat` and `claim_seat`, the failure modes are precisely Lua-logic bugs. Recommended (still no new runtime dependency):
- Add Lua execution tests using `fengari` OR run scripts against a real Redis (`redis-server` in CI / a local Upstash dev DB). Both are DEV-only additions. Preferred: a throwaway test that runs the script string against a real local Redis via the existing `@upstash/redis`-compatible `ioredis`, only if the user accepts a dev dependency. If not, a manual smoke checklist against the real Upstash DB in the phase verification is the minimum. Flag this as a decision for the roadmap (not required to ship, but it is the stated reason the earlier descope happened). Confidence on `fengari` fit with cjson: LOW (it does not ship `cjson`; would need a shim), so a real Redis is the more faithful option.

### 5. Client / API consumers

- `lib/createSession.ts`: no signature change. `people` now includes empty-name seats; `isValidPeople` already accepts them.
- Identity modal ("Who are you?"): lists seats (named people + empty seats rendered as "Seat 3"; label is a UI-computed fallback, never stored, so renaming and i18n stay free). Picking an empty seat -> prompt for name -> POST `claim_seat`. "+ I'm not listed" keeps `add_person`.
- Polling/refresh: unchanged. Seat changes are just `people` changes in the same session GET.
- localStorage identity (the persisted "who am I"): if my seat is removed by someone else (only possible while it is empty/unnamed, so only my own unclaimed identity), drop the stored identity and re-show the modal.
- Display names: anywhere a person name is rendered (chips, results, copy-to-clipboard text, Results rows) must fall back to "Seat N" for `name === ''`. Empty seats appear in Results because they pay a tax/service share; the "Copy" text should list them too. Grep for `.name` on Person during implementation.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Seat model | `Person` with `name: ''` | Separate `seats[]` or `isSeat: true` flag | Second source of truth; needs its own Lua and migration; `computeEqualChargeShares` and every consumer would need to merge two lists |
| Atomicity | Inline Lua via `redis.eval` | `WATCH/MULTI`, Redis JSON, `@upstash/lock`, hashes | Upstash REST multi is not atomic; rewriting storage is out of proportion for 5 KB sessions; Lua pattern already proven in 3 scripts |
| Seat claim | Compare-and-set `claim_seat` | Reuse `rename_person` | `rename_person` overwrites unconditionally, so two friends tapping the same empty seat would silently share/overwrite. Still consistent with "no name locking" because it only guards EMPTY seats; renaming a named person stays free |
| Headcount UI | Plain `-`/`+` buttons + existing shadcn `Button` | Stepper / number-input library | A stepper is two buttons and one clamped integer; the item quantity stepper already exists in the codebase, reuse its component/pattern |
| Guest count OCR | Field in existing vision call | Second OCR/regex pass over text | Extra cost and failure surface; the vision model already reads the whole ticket |
| Validation | Hand-written guards (matches codebase) | Add `zod` | Whole API layer uses manual guards; adding zod for 3 new ops creates two validation styles |
| Real-time | Existing polling | WebSockets / Ably / Pusher / Upstash pub/sub | Seats are just more `people` in the same fetched JSON; no new channel needed |

## What NOT to add

- **No new npm packages** for runtime. (Optional dev-only: Lua test harness, see above; needs explicit user OK.)
- No `zod`, no `react-hook-form`, no stepper/counter component library.
- No state-sync layer (Zustand stays setup-only; live state is the server session).
- No host/owner concept or "claimed by" lock on seats (explicitly out of scope: flat model).
- No "seats still empty" nudge or banner (explicit product decision).
- No removal of named/claimed people live (still descoped; `remove_seat` must REFUSE non-empty seats rather than purge).
- No schema version field / migration for sessions or the Zustand blob.

## Installation

```bash
# Nothing to install for v2.1.
```

## Risks to carry into the roadmap

| Risk | Severity | Mitigation / phase |
|------|----------|--------------------|
| Orphan claims after live seat removal (claim/tip/done scripts don't check person exists) | HIGH | Add `person_not_found` guard to every person-keyed Lua script in the same phase as `remove_seat` |
| Lua `remove_seat` / `claim_seat` logic untested (mocked redis) | HIGH | Real-Redis execution test or documented manual smoke on live Upstash; this was the reason for the earlier descope |
| Headcount/OCR value above `ADD_PERSON` cap of 20 | MEDIUM | Single `MAX_PEOPLE` constant used by OCR parser, counter, create-route, and Lua ARGV |
| Empty-name rendering leaks (blank chips, blank Results rows, blank copy text) | MEDIUM | Central `displayName(person, index)` helper; grep all `person.name` uses |
| cjson empty-table -> `[]` for `tips`/`donePeople`/`personSlots` | LOW | Normalise at the session fetch boundary |
| OCR misreads "Table 12" / "Pax" ambiguity | LOW | Prompt rule "only Pax/Covers/Guests/Persons labels; null if unsure"; counter is user-editable anyway, so a wrong prefill costs one tap |

## Sources

- Codebase (HIGH): `app/api/session/route.ts` (isValidPeople accepts empty names; no length cap), `app/api/session/[sessionId]/edit/route.ts` (ADD_PERSON/RENAME_PERSON/UPDATE_CURRENCY Lua pattern, 20-person cap), `app/api/session/[sessionId]/claim/route.ts` (Lua rationale, cjson empty-table note, no person-existence check), `lib/sessionSchema.ts`, `lib/billMath.ts` (`computeEqualChargeShares` counts all people), `stores/useBillStore.ts` (persist v1, `partialize`), `app/api/ocr/route.ts` (strict JSON schema, `required` list, two-pass merge), `package.json` (versions).
- No external docs consulted: no new libraries are involved. OpenAI strict structured-output rule "all properties must be in `required`, use null unions for optional" is already demonstrated by the existing `serviceFeeCents`/`taxCents` fields (HIGH, in-repo evidence).
- Fengari/cjson shim compatibility: training knowledge only (LOW).
