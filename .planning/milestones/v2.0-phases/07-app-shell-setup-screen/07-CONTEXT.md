# Phase 7: App Shell + Setup Screen - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the easy-billsy **app shell** (branded header + hamburger menu) and a single **scan-first Setup screen** that replaces the v1 People + Items wizard steps, plus extend OCR to **detect the receipt's currency**. Covers SHELL-01–04, SETUP-01–04, CURR-01.

This phase is the user-chosen "Setup first, then reassess" slice — purely additive/restructuring, no session-schema changes (those are Phase 8). A reassess gate follows before Phase 8.
</domain>

<decisions>
## Implementation Decisions

### Currency detection (CURR-01)
- **D-01:** OCR returns currency as an **ISO 4217 code** (e.g. `"USD"`, `"EUR"`, `"JPY"`) — NOT a raw symbol. Add a `currencyCode` field to `RECEIPT_PROMPT` and the strict `json_schema` in `app/api/ocr/route.ts` (`required`, `additionalProperties:false`). Store on `useBillStore` as `currencyCode`. Rationale: disambiguates `$` (USD vs CAD/AUD) and lets `Intl.NumberFormat` handle zero-decimal currencies (JPY) correctly. **This supersedes the roadmapper's earlier "raw symbol" lean recorded in STATE.md.**
- **D-02:** Phase 7 scope is detection + store only. Threading `currencyCode` through `formatCents`/displays and the detection-failure fallback UX are **Phase 10** (CURR-02/03). If OCR can't determine a currency, return a sensible default (app default) — full fallback handling deferred.

### App shell (SHELL)
- **D-03:** **Style A** header on every screen — white background, dark `easy−billsy` wordmark, amber hamburger lines.
- **D-04:** Hamburger menu = **New Split / History / About Us**; uniform row styling (no amber pill), with hover + selected states, ~168px width (per design canvas).
- **D-05:** **New Split** starts a fresh split; show a confirm-reset only if a bill is already in progress.
- **D-06:** **History + About Us are visibly disabled/greyed** this phase — not tappable, no "coming soon" state.
- **D-07:** Progress strip = **3 segments** (Setup / Bill View / Results), Setup active. Replaces the v1 4-segment `WizardShell` strip.

### Setup screen (SETUP)
- **D-08:** Single **scan-first** screen replacing wizard steps 1+2. Tagline "Split any bill in seconds."; the scan tile (camera) is the hero action; "Who's involved in the split?" people add is **inline** on the same screen.
- **D-09:** **Scan-only entry** — NO manual item entry, NO gallery/photo-library upload. The live camera scan is the sole capture path. (User chose strictly scan-first over keeping manual/gallery fallbacks.) _(Revised 2026-06-05: UAT gap — forced re-capture when the physical bill is gone. D-09 softens from "scan-only, NO gallery" to "scan-FIRST: camera remains the hero action, but the native picker now also offers the existing photo library (the capture attribute was dropped). Manual item entry remains out of scope.")_
- **D-10:** After a scan: show the captured-bill **thumbnail + "N items found" badge + Retake**, not an editable item list. **Retake is the only OCR-failure recovery in this phase** — planning MUST ensure a failed/empty scan routes to a clear retry, never a dead end (no manual fallback exists).
- **D-11:** **Continue** is gated — disabled until a bill is scanned AND **at least two people** are added. _(Revised 2026-06-04: originally "at least one person"; tightened to ≥2 since splitting is only meaningful with two or more participants. Host adds themselves + at least one other on Setup; further joiners still arrive via the share link downstream.)_
- **D-12:** **Continue bridges to the EXISTING Assign/claiming flow** (`AssignItemsStep`) as a stopgap so the app stays usable end-to-end through the reassess gate. The new "Who are you?" modal + Bill View replace this target in Phase 9.

### Constraints carried in
- **Keep current codebase styling** — layout restructure only; no Direction A/B visual reskin this milestone.
- Item editing on Setup is intentionally absent (no list shown); misread-item fixing arrives with the Bill View in Phase 9.

### Claude's Discretion
- None — all four discussed areas were decided explicitly.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 7 goal, requirements (SHELL/SETUP/CURR-01), success criteria, and the reassess gate
- `.planning/REQUIREMENTS.md` — SHELL-01–04, SETUP-01–04, CURR-01 wording + traceability

### Research (read before planning)
- `.planning/research/SUMMARY.md` — synthesis: zero new deps, build order, key risks
- `.planning/research/ARCHITECTURE.md` — session boundary stays (Setup = Zustand-local), currencyCode data-flow, build order, new vs modified vs deleted files
- `.planning/research/STACK.md` — currency: ISO code + `Intl.NumberFormat` rationale; OCR schema extension
- `.planning/research/FEATURES.md` — scan-first / setup feature landscape, edge cases

### Design intent (external — claude.ai/design handoff, not in repo)
- The hi-fi "End-to-End Flow" defines the 6-screen target; Phase 7 implements screens 1–2 (Setup empty + after scan) and the shell/header. Reference the design decisions captured in this CONTEXT rather than the HTML (the bundle lives outside the repo).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/wizard/AddItemsStep.tsx` — the scan tile, `handleFileChange` (compress → /api/ocr → /api/expand), receipt thumbnail, and OCR/expand status handling. The Setup screen reuses this scan flow (minus manual add per D-09).
- `components/wizard/AddPeopleStep.tsx` — inline people-add pattern + `AVATAR_COLORS`; folds into the Setup "Who's involved?" section.
- `components/wizard/WizardShell.tsx` — progress strip (change 4→3 segments per D-07) and the header slot (replace with Style A wordmark + hamburger).
- `stores/useBillStore.ts` — `people`, `items`, `billImageUrl`, `ocrStatus`, `step`; add `currencyCode` + setter.
- `app/api/ocr/route.ts` — `RECEIPT_PROMPT` + strict `json_schema`; add `currencyCode` field (D-01).
- `components/wizard/AssignItemsStep.tsx` — the Continue **bridge target** (D-12).
- `components/wizard/ShareLinkButton.tsx` — existing share/session-create path (unchanged this phase).

### Established Patterns
- All prices = integer cents; derived totals computed on demand.
- Single Zustand store owns wizard state.
- OCR + expansion is a single GPT-4o-mini vision call returning strict JSON.

### Integration Points
- `app/page.tsx` — collapse wizard steps 1 & 2 into the single Setup screen; route Continue → existing `AssignItemsStep` (step 3) as the bridge.
- New header/menu component mounts in `WizardShell` (and should appear on every screen).
- `currencyCode`: OCR response → `useBillStore` (this phase). It will flow → session POST → `formatCents` in later phases.
</code_context>

<specifics>
## Specific Ideas

- Header is **Style A** (white / dark wordmark / amber hamburger) — chosen in the design canvas; menu styling: uniform rows, ~168px, hover + selected states, no amber pill.
- Setup copy is fixed: "Split any bill in seconds." + "Who's involved in the split?".
</specifics>

<deferred>
## Deferred Ideas

- **"Who are you?" identity modal** → Phase 9 (Bill View + Identity).
- **Currency display threading** (`formatCents` signature, render all amounts via `Intl.NumberFormat`) + **detection-failure fallback UX** → Phase 10 (CURR-02/03).
- **Manual item entry / gallery upload** — explicitly dropped by D-09; revisit only if scan-only proves too fragile in real use.
- **Bill history** (the History menu feature — saved/reopenable splits) → v2.1+.

### Reviewed Todos (not folded)
- `2026-06-02-add-user-facing-privacy-disclosure.md` — matched Phase 7 (score 0.6, via the About Us menu item) but **not folded**. User chose a disabled About Us (D-06) and to keep the privacy disclosure as its own deferred v2 item.
</deferred>

---

*Phase: 7-App Shell + Setup Screen*
*Context gathered: 2026-06-04*
