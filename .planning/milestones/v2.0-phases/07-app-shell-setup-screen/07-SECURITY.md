---
phase: 07
slug: app-shell-setup-screen
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-05
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (07-01/02/03 `<threat_model>` blocks); verified
> against the implementation by gsd-security-auditor on 2026-06-05.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → store | AppHeader/SetupStep read/write client-side Zustand state (reset, setStep, people, items). | Client-local session state only |
| client → /api/ocr | SetupStep sends a user-supplied receipt image (compressed base64) to the OCR route. | Receipt image (base64 data-URI) |
| browser → camera/library | Native `<input type="file" accept="image/*">` accesses the device camera or photo library; the captured File becomes a blob/base64 URL held in client state. | Photo File → base64 data-URL |
| model → server | gpt-4o-mini returns an untrusted `currencyCode` string the route must validate. | Model JSON (items, currencyCode) |
| server → client | OCR response `{ items, currencyCode }` crosses to the browser; only a normalized 3-letter code is emitted, never raw model text. | Normalized OCR result |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-7-01-01 | Tampering | AppHeader New Split reset | accept | `reset()` → `set({ ...INITIAL_STATE })` pure client Zustand (useBillStore.ts:146-150); confirm-reset Dialog gated by `hasProgress` (AppHeader.tsx:31,40-44,116). No server data. | closed |
| T-7-01-02 | Denial of service | WizardShell hashchange listener | accept | Regex `/#step-([1-4])/` (WizardShell.tsx:36) + clamp `num>=1 && num<=4` (38-41); malformed hashes produce no `setStep`. | closed |
| T-7-02-01 | Denial of service | SetupStep image upload | mitigate | Client compress `maxSizeMB 0.5 / maxWidthOrHeight 1920` (SetupStep.tsx:78-83); server cap `image.length > 10_000_000` (route.ts:44). | closed |
| T-7-02-02 | Information disclosure | billImageUrl persistence | accept | `billImageUrl` in `partialize` (useBillStore.ts:170) — localStorage on user's device only; transmitted once to OCR over HTTPS, not retained server-side. | closed |
| T-7-02-03 | Tampering | Continue gate bypass | accept | `canContinue = billScanned && people.length>=2` + `disabled` (SetupStep.tsx:53,330); downstream views recompute from store, forced nav cannot fabricate data. | closed |
| T-7-03-01 | Tampering | currencyCode from model output | mitigate | `/^[A-Za-z]{3}$/.test(rawCode) ? rawCode.toUpperCase() : 'USD'` (route.ts:123-126) before response. | closed |
| T-7-03-02 | Information disclosure | OCR error path | mitigate | Catch returns generic `{ error: 'OCR failed' }`, `console.error` server-side only (route.ts:129-133); same generic response on empty (93-94) and schema mismatch (103-104). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-7-01-01 | Reset destroys only client-local Zustand session state; no server-side data exists to tamper. Dialog guard (D-05) prevents accidental loss of in-progress work. | secure-phase | 2026-06-05 |
| AR-07-02 | T-7-01-02 | hashchange listener bounded by strict `#step-([1-4])` regex + `>=1 && <=4` clamp; malformed hashes silently ignored, no state side-effects. | secure-phase | 2026-06-05 |
| AR-07-03 | T-7-02-02 | Bill photo is a base64 data-URL in the user's own localStorage via `partialize`; transmitted once to the OCR route over HTTPS, never retained server-side. | secure-phase | 2026-06-05 |
| AR-07-04 | T-7-02-03 | Continue gate is a UX affordance, not an authz control; downstream Assign/Results are driven by store state from the OCR route — forced hash navigation cannot inject fabricated data. | secure-phase | 2026-06-05 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-05 | 7 | 7 | 0 | gsd-security-auditor (verify mode, register authored at plan time) |

**Audit note:** `SetupStep.tsx:17` documents the 2026-06-05 design revision dropping `capture="environment"` (gallery softening, gap closure 07-04). This is UX-only; the compression pipeline and all controls verified under T-7-02-01 are unaffected regardless of file source. No new attack surface; no unregistered flags.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-05
