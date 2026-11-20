# Phase 7 — Production Readiness & Release Audit Report

- **Project**: FC HĐH Gò Nổi tại TP.HCM (`nguyenthetiengit01-collab/FCHDHGoNoi`)
- **Base Branch / Verified Merge Commit**: `main` @ `c37dfd3200547210e8c6308b34c44db4fe18c04e` (PR #15)
- **Remediation Branch**: `fix/phase-7.1-pre-release-remediation` (Phase 7.1)
- **Audit Date**: 2026-11-20
- **Audit Mode**: Phase 7.1 Pre-Release Remediation (PR in DRAFT; no Production DB/deploy/merge)
- **Release Decision**: **NO-GO** (`P0-01` Branch Protection on `main` remains **OPEN** pending Owner configuration; see [phase-7.1-remediation.md](./phase-7.1-remediation.md))

---

## 1. Executive Summary & Release Decision

The FC HĐH Gò Nổi codebase demonstrates strong foundational engineering across authentication (`scrypt` + `timingSafeEqual` + fail-closed `AUTH_SECRET` and Upstash Redis rate limiting), financial calculations (`calculateFinancialSummary` invariants), cross-platform CI (`Quality Gates` + Linux/Windows Playwright visual & WCAG 2.2 AA QA), and encrypted read-only Turso backups (`X25519-HKDF-SHA256-AES-256-GCM`).

However, **1 P0 governance blocker** and **13 P1 high-severity findings** across runtime packaging, HTTP security headers, API data-contract sanitization, session re-issuance, financial input validation, Excel export security, SSR reliability, and disaster recovery governance prevent an immediate Production release sign-off.

| Severity | Count | Release Impact |
| --- | :---: | --- |
| **P0 — Critical** | **1** | **NO-GO** (`main` branch protection disabled on GitHub) |
| **P1 — High** | **13** | **NO-GO** (Privacy leak on `POST /api/team`, broken session after `change_own_password`, `data/gonoifc.sqlite` in Git & all `.nft.json` bundles, missing HTTP security headers, financial validation bypasses, Excel formula injection, missing SSR error boundaries/DB timeouts, unprojected `getFullAppData()`, missing DR/incident governance & RPO/RTO) |
| **P2 — Medium** | **15** | Recommended before/shortly after launch (stateless `getAuthSession` on 5 routes, missing CSRF check on `/api/webp`, `zod` advisories, `Cache-Control: no-store` gaps, 4.5 MB Vercel payload mismatch, non-atomic match/player writes, financial category/match divergence, PWA/RUM/real-device gaps) |
| **P3 — Low** | **7** | Maintenance & hygiene improvements |
| **NOT VERIFIED** | **5** | External Production/device controls inaccessible in read-only audit |

**Decision**: **NO-GO** — Proceed to a dedicated **Phase 7.1: Pre-Release Remediation & Governance Hardening** PR to resolve all P0 and P1 findings, followed by re-verification and Staging rehearsal.

---

## 2. Baseline & Evidence Verification Status

Every claim in this report is tagged with its verification basis:
- **Code verified**: Directly inspected in `fd1b150c94c54f16b0f0888aa57de3c3cb4c1ea7`.
- **Test verified**: Executed locally on synthetic data / build / audit tools.
- **CI verified**: Confirmed via GitHub Actions API on `fd1b150c94c54f16b0f0888aa57de3c3cb4c1ea7`.
- **Documentation only**: Stated in `docs/` without runtime verification.
- **Not verified**: External to repo (Vercel Dashboard, live Turso Production, offline key custody, physical iOS/Android devices).

### 2.1 Git, PR #14 & CI/CD Baseline
- **PR #14**: `state = closed`, `merged = true`, `merge_commit_sha = fd1b150c94c54f16b0f0888aa57de3c3cb4c1ea7` (**CI verified** via GitHub API).
- **`origin/main` HEAD**: `fd1b150c94c54f16b0f0888aa57de3c3cb4c1ea7`.
- **Post-Merge CI Run (`44658813350`)**: `completed` / `success` (**CI verified**):
  - `Quality Gates (Node 22.23.5)` (`npm ci`, Vitest, ESLint, `tsc --noEmit`, `next build`): `success`
  - `Playwright Visual & Accessibility QA (Linux)`: `success`
  - `Playwright Visual & Accessibility QA (Windows)`: `success`
- **Vercel Commit Status (`fd1b150c`)**: `state = success` (`Deployment has completed`). *Note*: Git status success confirms build completion only; live Production health/env vars remain **Not verified** per safety guardrails.

---

## 3. Domain Audit Summaries

### 3.1 Application Architecture & Vercel Deployment (Agent A)
- **Runtime & Build (Code & Test verified)**: Next.js 15.5.29 App Router, React 19, TypeScript, Node 22.x serverless runtime (`vercel.json` pins `regions: ["hnd1"]`). `npm run build` succeeded in isolated `TEMP`/`TMP` in `18.2s`; `sharp` and `xlsx` (`serverExternalPackages`) trace cleanly only to their respective routes.
- **Critical DB Packaging (`P1-03`)**: `data/gonoifc.sqlite` (274,432 bytes) is tracked in Git (`.gitignore:17`) and traced into **every** Next.js serverless function (`.nft.json` shows `2` entries on `/` and all `15` `/api/*` routes, `1` entry on remaining pages) due to `outputFileTracingIncludes` (`next.config.ts:5-8`) and unreachable `BUNDLED_DB_PATH` copy (`src/lib/db.ts:452-495`). Production/Vercel strictly forces Turso (`src/lib/db.ts:111-137`). Removing `outputFileTracingIncludes` and untracking `data/gonoifc.sqlite` will not break any environment. *(Escalates to **P0** if `data/gonoifc.sqlite` holds real member PII).*
- **HTTP Security Headers (`P1-04`)**: Neither `next.config.ts` (`headers()`) nor `src/middleware.ts`/`src/proxy.ts` sets `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, or global `X-Content-Type-Options: nosniff`.
- **Caching & Limits (`P2-04`, `P2-05`)**: `GET/POST /api/auth`, `POST /api/webp`, and `POST /api/team` (final `200`/`catch`) omit `Cache-Control: no-store`. `/api/import` (5 MB) and `/api/webp` (10 MB) exceed Vercel's 4.5 MB serverless body limit.

### 3.2 Security & Privacy (Agent B)
- **Verified Controls (Code verified)**: `scrypt` (16-byte random salt, 64-byte key) + `timingSafeEqual`, dummy `scrypt` anti-enumeration, HMAC-SHA256 `HttpOnly`/`SameSite=Lax`/`Secure` cookies, fail-closed `AUTH_SECRET` & Upstash Redis rate limiting (1500 ms timeout) in Production/Preview, parameterized SQL queries, and SHA-pinned workflows.
- **Confirmed P1 Defects**:
  - **`P1-01`**: `POST /api/team` (`src/app/api/team/route.ts:1947-1948`) returns unsanitized `getFullAppData()` to `player` sessions, leaking teammates' `phone`, `username`, `notes`, `access_role`, and `tournament_fund_note` (and serializing `pin_code: ""`, also in `POST /api/import:1396-1398`).
  - **`P1-02`**: `change_own_password` (`src/app/api/team/route.ts:1951-1965`) re-issues the session cookie using `updatedPlayer` where `pin_code` is `""`, computing `pwdFingerprint` of `"1234"` instead of the new `scrypt$` hash — immediately causing `401` on the user's next request.
- **Confirmed P2 Defects**:
  - **`P2-01`**: 5 routes (`GET /api/team`, `GET /api/analytics`, `POST /api/media/upload`, `POST /api/media/client-upload`, `POST /api/webp`) use stateless `getAuthSession(req)` instead of DB-backed `requirePlayerSession(req)`, allowing deactivated/demoted/password-reset users access until cookie expiry (up to 30 days).
  - **`P2-02`**: `POST /api/webp` (`src/app/api/webp/route.ts:13-22`) lacks `verifyCsrfOrigin(req)`.
  - **`P2-03` (Test verified)**: `npm audit --omit=dev --json` reported 4 high-severity advisories via `@vercel/blob` -> `@vercel/oidc` -> `@vercel/cli-config` -> `zod <4.6.6` (`GHSA-mrhx-c7xc-m3w5`).

### 3.3 Database, Turso & Disaster Recovery (Agent C)
- **Database Integrity (Code verified)**: Strict mode isolation (`local-sqlite-qa`, `turso`, `local-sqlite-default`), atomic `TursoDbAdapter` & `LocalSqliteAdapter` transactions, idempotent `phase4-analytics-v1.mjs`. Gaps: `TursoDbAdapter` does not run `PRAGMA foreign_keys = ON;` (`P2-06`), and schema DDL is split across 4 locations (`P3-03`).
- **Backup Workflow (Code & CI verified)**: `.github/workflows/turso-backup.yml` uses weekly cron (`0 20 * * 0` UTC) + `workflow_dispatch`, read-only Production token (`TURSO_PROD_AUTH_TOKEN_RO`), `client.transaction("read")` snapshot, pre-upload local restore verification, `X25519-HKDF-SHA256-AES-256-GCM` encryption, plaintext deletion, and 30-day retention.
- **Local Synthetic Restore Drill (Test verified)**: Executed end-to-end in disposable `D:\Test1\_phase7-audit-evidence\drill-tmp\` (cleaned up afterward). Verified synthetic init -> `phase4-analytics-v1` idempotency -> v3 backup -> ephemeral X25519 encrypt/decrypt -> payload validation -> `db-restore.mjs --confirm` -> **14/14 tables, 9/9 indexes, 8/8 sequences matched**; `PRAGMA integrity_check` = `ok`; `PRAGMA foreign_key_check` = `[]`.
- **DR Gaps (`P1-12`, `P2-07`)**: RPO, RTO, restore drill cadence, and formal DR ownership are `NOT DOCUMENTED` in `docs/operations-runbook.md`; weekly backup yields a 7-day RPO with no Turso PITR documented; `db-restore.mjs` is non-transactional across the full DB.

### 3.4 Financial & Business Data Integrity (Agent D)
- **Calculation Engine (Code & Test verified)**: `src/lib/financialCalculations.test.ts` passed (`6/6`). Income conservation, balance conservation, tournament fund isolation, and 3-state attendance independence hold in `financialCalculations.ts`.
- **Confirmed Defects**:
  - **`P1-05`**: `add_walkin_player`, `upsert_match`, and `update_settings` in `POST /api/team` bypass `parseNonNegativeIntVnd`, allowing negative/float/NaN amounts and silently turning `0` fees into `100,000`.
  - **`P1-06`**: `GET /api/export` (`src/app/api/export/route.ts:68-285`) writes raw user-controlled strings to `.xlsx` cells without neutralizing leading `=`, `+`, `-`, `@`, `\t`, `\r` (Excel formula injection).
  - **`P2-08`, `P2-09`, `P2-10`**: Non-atomic multi-table writes in `upsert_match`, `delete_match`, `add_walkin_player`, and decoupled `recordAuditLog`; non-canonical expense categories omitted from `categoryBreakdown`; `calculateMatchStats` vs `buildEnrichedMatches` divergence; missing `YYYY-MM-DD` validation in `upsert_expense`/`upsert_other_income`; `other_incomes.sponsor_id` wiped on Excel round-trip.

### 3.5 Reliability, Performance & UX (Agent E)
- **Reliability (`P1-07`, `P1-08`, `P3-05`)**: No `error.tsx`, `global-error.tsx`, or `not-found.tsx` under `src/app/`; `TursoDbAdapter` lacks query timeout and transient retry/backoff; `GET /api/health` returns `503` on exception but would return `200` if `pingDatabase()` returned `{ ok: false }` without throwing.
- **Performance (`P1-09`, `P2-11`, `P2-13`)**: `getFullAppData()` runs 8 `SELECT *` queries + `JSON.parse(JSON.stringify(...))` on `/api/team`, `/api/public/financial-report`, and authenticated `/` SSR; `save_match`/`save_player` execute N+1 sequential `db.run()` loops; only Lab LCP/CLS exist in Playwright (no INP, no Field RUM); `SponsorsTab` uses `unoptimized` on `next/image` and 12 raw `<img>` tags remain.
- **Observability, PWA & Device Coverage (`P2-12`, `P2-13`)**: Auth failures/lockouts are not logged; several API routes log raw `error` objects; stale `public/manifest.json` coexists with `src/app/manifest.ts`; `sw.js` uses static `CACHE_VERSION`; Playwright omits `/bao-cao-tai-chinh`, `/nha-tai-tro`, `/cau-chuyen-go-noi`, `/offline`, and authenticated tabs; all real-device iOS/Android/PWA checks in `docs/pwa-real-device-checklist.md` are `[ ]` (**Not verified**).

### 3.6 CI/CD, Release & Incident Operations (Agent F)
- **Release Control (`P0-01`, `P2-15`)**: `main` branch protection is **disabled** (`protected: False` via GitHub API); `package.json` (`1.0.0`), Git tags (`v2.0.2`), GitHub Releases (`0`), and `docs/release-readiness-v2.0.md` have drifted behind `main`.
- **Incident & Rollback Governance (`P1-10`, `P1-11`, `P1-13`, `P2-14`)**: `docs/operations-runbook.md` lacks SEV1–SEV4 tiers, named/role incident ownership, member communication templates, PIR process, credential-exposure playbook, core-table schema compatibility/rollback policy, `vercel ls` / post-rollback smoke checks, and dedicated playbooks for `@vercel/blob`, auth mass failure, financial discrepancy, and backup failure. `turso-backup.yml` has no failure notification step.

---

## 4. Safety & Guardrail Compliance Confirmation

Confirmed for Phase 7 audit execution:
- No Production DB connected or queried; no Production SQL executed.
- No Production migrations, backups, or restores triggered.
- No Production environment variables or Vercel Production settings modified.
- No Production deployment triggered; no PR merged; auto-merge not enabled.
- `MEDIA_STORAGE_ENABLED=false` and `ANALYTICS_ENABLED=false` preserved.
- Phase 6.5 and Phase 6.5.1 worktrees untouched.
- Synthetic restore drill executed exclusively in disposable external directory (`D:\Test1\_phase7-audit-evidence\drill-tmp\`) and cleaned up.

---

## 5. Recommended Next Phase (Phase 7.1)

Open a dedicated **Phase 7.1 — Pre-Release Remediation & Governance Hardening** PR (do not patch in this audit branch) to:
1. Enable GitHub Branch Protection on `main` (`P0-01`).
2. Fix `POST /api/team` player response sanitization & `change_own_password` cookie `pwdFingerprint` (`P1-01`, `P1-02`).
3. Remove `outputFileTracingIncludes` + dead `/tmp` DB copy and untrack `data/gonoifc.sqlite` (`P1-03`).
4. Add HTTP security headers in `next.config.ts` (`P1-04`) and `Cache-Control: no-store` on `/api/auth`, `/api/webp`, `/api/team` (`P2-04`).
5. Enforce `parseNonNegativeIntVnd` in `add_walkin_player`/`upsert_match`/`update_settings` (`P1-05`) and sanitize Excel formula prefixes in `GET /api/export` (`P1-06`).
6. Add `error.tsx`, `global-error.tsx`, `not-found.tsx` (`P1-07`), Turso query timeout (`P1-08`), and lightweight projection for `/api/public/financial-report` (`P1-09`).
7. Complete `docs/operations-runbook.md` with SEV1–SEV4 governance, RPO/RTO targets, DR ownership, credential-exposure & incident playbooks, and schema rollback policy (`P1-10`–`P1-13`).

See companion Phase 7 artifacts:
- [Risk Register](./risk-register.md)
- [Release Go/No-Go Checklist](./release-go-no-go-checklist.md)
- [Disaster Recovery & Staging Rehearsal Plan](./disaster-recovery-and-staging-rehearsal.md)
- [Environment Configuration Matrix](./environment-configuration-matrix.md)
