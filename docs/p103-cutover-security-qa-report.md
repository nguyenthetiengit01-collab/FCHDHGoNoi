# P1-03 Production Cutover — Independent Security QA & Remediation Report

- **Worktree**: `D:\Test1\QuanLyDoiBong-worktrees\p103-production-cutover`
- **Branch**: `feat/p103-production-cutover-readiness`
- **Mode**: Read-only audit + verified remediation

---

## 1. Complete Route & Side-Effect Inventory (`P103_CUTOVER_FREEZE_WRITES=true`)

| Route / Entrypoint | Method | Side Effects (Normal Mode) | Behavior During Freeze (`P103_CUTOVER_FREEZE_WRITES=true`) |
| :--- | :---: | :--- | :--- |
| `/api/team` | `POST` | DB `INSERT/UPDATE/DELETE`, `audit_logs`, media WebP | **Blocked at entry** (`guardCutoverWrite` -> `503 CUTOVER_WRITE_FROZEN`, `no-store`) |
| `/api/auth` | `POST` | Login auto-rehash (`UPDATE players`), cookie mutations | **Blocked at entry** (`guardCutoverWrite` -> `503 CUTOVER_WRITE_FROZEN`, `no-store`) |
| `/api/import` | `POST` | Bulk Excel DB transaction writes | **Blocked at entry** (`guardCutoverWrite` -> `503 CUTOVER_WRITE_FROZEN`, `no-store`) |
| `/api/media/upload` | `POST` | External **Vercel Blob** `put()` | **Blocked at entry** (`guardCutoverWrite` -> `503 CUTOVER_WRITE_FROZEN`, `no-store`) |
| `/api/media/client-upload` | `POST` | Token issuance (`blob.generate-client-token`) + legacy `blob.upload-completed` callback | **Stage 1 Drain**: blocks token issuance (`503`), routes verified `blob.upload-completed` to shared `handleClientUploadCompletedCallback`; **Stage 2 Closed**: `503 CUTOVER_WRITE_FROZEN` |
| `/api/media/client-upload/callback` | `POST` | Dedicated Vercel Blob `onUploadCompleted` webhook (`media_upload_records` idempotent upsert) | **Stage 1 Drain**: open only to Vercel-signed `blob.upload-completed` (forbids token generation `403`); **Stage 2 Closed**: blocked by `guardCutoverCallbackWrite` (`P103_CUTOVER_FREEZE_CALLBACKS=true` -> `503 CUTOVER_WRITE_FROZEN`) |
| `/api/webp` | `POST` | CPU/Image conversion side effect | **Blocked at entry** (`guardCutoverWrite` -> `503 CUTOVER_WRITE_FROZEN`, `no-store`) |
| `/api/analytics/events` | `POST` | Analytics event `INSERT` | **Blocked at entry** (`guardCutoverWrite` -> `503 CUTOVER_WRITE_FROZEN`, `no-store`) |
| `/api/cron/analytics-cleanup` | `GET` | Cron `DELETE` from analytics tables | **Blocked at entry** (`guardCutoverWrite` -> `503 CUTOVER_WRITE_FROZEN`, `no-store`) |
| `/api/analytics` | `GET` | Conditional `recordAuditLog` when Manager views other player insights | **Read-only**: `recordAuditLog` skipped when `isCutoverWriteFrozen()` is true |
| `/api/team`, `/api/public/financial-report`, `/api/export` | `GET` | `getFullAppData()` cold-start `ensureClubPostsReady` / `ensureSponsorsReady` | **Read-only**: initializers return early when `isCutoverWriteFrozen()` is true; `GET /api/export` performs zero DB/Blob writes |
| `/api/audit-logs` | `GET` | `getAuditLogs()` cold-start `ensureAuditLogsReady()` | **Read-only**: `ensureAuditLogsReady()` returns early when `isCutoverWriteFrozen()` is true |
| `/api/media/legacy` | `GET` | None (`SELECT` only + `parseAndValidateDataImageUri`) | **Read-only**: zero DB writes, zero Blob writes |
| `/api/health`, `/api/auth`, `/api/public/activities` | `GET` | None (`SELECT 1` / read-only `SELECT`) | **Read-only**: operational during freeze |
| Server Actions (`"use server"`) | — | None in codebase | **N/A** (0 `"use server"` files) |

---

## 2. Resolved Security QA Findings & Evidence

| ID | Severity | Finding | Resolution & Verification Evidence |
| :--- | :---: | :--- | :--- |
| `F-01` | **P1** | Write Freeze sequencing gap (`main` lacks `P103_CUTOVER_FREEZE_WRITES` prior to PR #21 → PR #19 merge; Vercel env changes require redeploy; Turso RO token does not block Vercel Blob) | Reworked `docs/p103-production-cutover-plan.md`, `docs/p103-production-cutover-checklist.md`, and `docs/operations-runbook.md`: integrate **PR #21 → PR #19 → `main`** first for Bootstrap Deployment, enable Stage 1 Edge WAF `Deny` (**HTTP 403**, allowing **both** `/api/media/client-upload/callback` and legacy `/api/media/client-upload`) + `P103_CUTOVER_FREEZE_WRITES=true` (`503`), wait **>= 3,900 seconds (65 minutes)** from verified `T_drain-start` (`3,600s` legacy TTL + `300s` safety margin), close Stage 2 (`P103_CUTOVER_FREEZE_CALLBACKS=true` + WAF `403` on both callback paths), then switch old DB to `--read-only`, capture final backup, restore to new DB, switch `TURSO_*` env, and redeploy. |
| `F-02` | **P1** | `GET /api/analytics` `recordAuditLog` unguarded | Guarded `recordAuditLog` in `src/app/api/analytics/route.ts:112` with `!isCutoverWriteFrozen()`. |
| `F-03` | **P2** | Cold-start DDL/DML in `getFullAppData()` & `getAuditLogs()` | Added `if (isCutoverWriteFrozen()) return;` in `ensureClubPostsReady`, `ensureSponsorsReady`, and `ensureAuditLogsReady` (`src/lib/db.ts`); verified zero DDL/DML on legacy schema in `src/lib/cutoverFreeze.test.ts`. |
| `F-04` | **P2** | Smoke-test contradiction (`POST /api/auth` frozen during `P103_CUTOVER_FREEZE_WRITES=true`) | Updated Section 7.1/7.2 of cutover plan & Section 6/7 of checklist to run Guest + WAF `403` / app `503 CUTOVER_WRITE_FROZEN` checks during freeze and Manager `POST /api/auth` + `GET /api/audit-logs` after unfreezing. |
| `F-05` | **P1** | `--expected-target-host` could bypass `isAllowlistedCutoverDb()` and prefix wildcard existed in `p103-cutover-restore.mjs` | Fixed `validateCutoverTarget()` (`scripts/p103-cutover-restore.mjs`): removed prefix wildcard (`startsWith`), enforces exact `APPROVED_CUTOVER_TARGET_HOST` (`fchdhgonoi-prod-cutover-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io`) & `APPROVED_CUTOVER_TARGET_DB_NAME`, rejects explicit ports (`parsed.port`), and keeps `--expected-target-host` strictly as an additional confirmation (never an override/broadening); added negative tests in `src/lib/p103CutoverRestore.test.ts`. |
| `F-06` | **P3** | `--env=*` flag parsing & non-table objects in `assertEmptyTargetDatabase` | Rejected `--env=*` in `parseCutoverCliArgs()` and expanded `assertEmptyTargetDatabase()` to `type IN ('table', 'view', 'index', 'trigger')`. |
| `F-07` | **P1** | Vercel Blob `clientToken` 1-hour default TTL & post-freeze in-flight upload/callback window | Inspected `@vercel/blob@2.9.0` (`handleUpload` defaults `validUntil` to `3,600s`). Tightened `src/app/api/media/client-upload/route.ts` with `CLIENT_UPLOAD_TOKEN_TTL_MS = 60_000` (60s) for new tokens, added mandatory **>= 3,900 seconds (65 minutes)** drain window (`3,600s` legacy token TTL + `300s` safety margin) before Stage 2 & final backup, verified `blob.upload-completed` & `POST /api/team` return `503 CUTOVER_WRITE_FROZEN` in Stage 2 (zero inconsistent DB metadata), and added post-cutover orphan Blob reconciliation in Section 7.2. |

---

## 3. Legacy-Schema Backward Compatibility & Pre-Freeze Session Smoke Proof
- Verified in `src/lib/cutoverFreeze.test.ts` against an in-memory SQLite database **missing `players.must_change_pin`**:
  - `GET /api/team`, `GET /api/auth`, `GET /api/media/legacy`, `GET /api/audit-logs`, and `GET /api/export` (using a pre-freeze Manager `fc_session` cookie) all return `200` (or `404` on empty media) with **0 DDL/DML** and **0 Blob writes**.
  - `POST /api/team` and `POST /api/auth` fail closed with `503 CUTOVER_WRITE_FROZEN`.

---

## 4. Dependency Security Remediation (`zod` & `minimatch`)
- **Production Vulnerabilities (`npm audit --omit=dev`)**: **0 vulnerabilities** (`EXIT=0`).
  - **`zod` (`4.1.11` → `4.6.7`, High `GHSA-mrhx-c7xc-m3w5` RESOLVED)**:
    - Remediated via a narrowly scoped npm override in `package.json`: `"@vercel/oidc@3.8.10": { "@vercel/cli-config": "0.3.8" }`.
    - Preserves `@vercel/blob@2.9.0` (avoids `--force` downgrade to `2.4.0`) and `@vercel/oidc@3.8.10`, upgrading `@vercel/cli-config` (`0.3.1` → `0.3.8`) which resolves `zod@4.6.7`.
    - Verified `@vercel/cli-config@0.3.8` exports, `@vercel/oidc@3.8.10`, `@vercel/blob/client` (`generateClientTokenFromReadWriteToken`), plus `src/lib/media/workstreamB.test.ts` and `src/lib/cutoverFreeze.test.ts`.
- **Remaining Development-Only Advisories (`npm audit`)**:
  - **`minimatch` (`10.2.6`, Moderate `GHSA-g3hv-75wg-m249`, `>=7.0.0 <11.0.1`)**: Dev-only via `eslint-config-next@15.5.29` → `@typescript-eslint/parser@8.72.1` → `@typescript-eslint/typescript-estree@8.72.1`. Not included in Production runtime bundle. Deliberately **not** forced to `minimatch@11` in the ESLint toolchain without dedicated ESLint compatibility testing. (`minimatch@3.1.5` under `eslint@9.39.5` is outside the advisory range.)

---

## 5. Final Release Sequencing — Legacy Token Lifetime, Bootstrap Deployment & Test Evidence
- **Exact Cutover Sequence**:
  `Bootstrap Deployment → Stage 1 → Legacy Token Expiry → Callback Drain → Stage 2 → Read-only Turso → Final Backup → Offline Migration → Restore → DB Switch → Smoke Test → Unfreeze`
- **Legacy Token Lifetime & Drain Window**:
  - Inspected baseline `b9bad43:src/app/api/media/client-upload/route.ts`: `onBeforeGenerateToken` omitted `validUntil` and emitted `tokenPayload: JSON.stringify({ entity, uploadedByPlayerId })`. Therefore `@vercel/blob@2.9.0` `handleUpload()` defaulted legacy tokens to **3,600 seconds (1 hour)**.
  - Accordingly, the Stage 1 **Legacy Token Expiry + Callback Drain** window is governed by the **maximum remaining legacy token lifetime (`3,600s` / 60 minutes + 5-minute safety margin = `>= 65 minutes`)**, not the new `CLIENT_UPLOAD_TOKEN_TTL_MS` (`60s`).
  - **Bootstrap Deployment**: PR #21 is integrated into PR #19 (`hotfix/p1-03-default-pin-containment`), PR #19 CI is re-verified, and then PR #19 is merged to `main` (legacy-schema compatible, `P103_CUTOVER_FREEZE_WRITES=true` blocks new token generation while allowing verified legacy callbacks, `TURSO_AUTH_TOKEN` remains RW and `MEDIA_STORAGE_ENABLED=true` during Stage 1 Drain; rollback before migration via Vercel Instant Rollback — RPO/RTO figures are design targets, not measured SLAs).
  - **Stage 2 → Read-only Turso**: Once `>= 3,900s` from `T_drain-start` elapses and drain/reconciliation completes, `P103_CUTOVER_FREEZE_CALLBACKS=true` (`503`) + Edge WAF `Deny` (`403`) close both callback paths, and **then** `TURSO_AUTH_TOKEN` is switched to `--read-only` + `MEDIA_STORAGE_ENABLED=false` (zero DB writes and zero Blob writes) before final backup.
- **Separated Test Suites & Observed Results**:
  - **Application-level unit tests** (`src/lib/cutoverFreeze.test.ts` — **9/9 passed**): sets deterministic `VERCEL_BLOB_CALLBACK_URL=http://localhost:3000`, proves `handleUpload()` issues `clientToken` with `validUntil <= issuedAt + 60_000` and `callbackUrl = http://localhost:3000/api/media/client-upload/callback`, verifies Stage 1 allows valid Vercel-signed `blob.upload-completed` callbacks on **both** `/api/media/client-upload/callback` (post-split) and `/api/media/client-upload` (pre-split **exact legacy `tokenPayload` fixture `{ entity, uploadedByPlayerId }`**) while blocking token issuance (`503`), rejects `blob.generate-client-token` on callback (`403`), rejects invalid `x-vercel-signature` (`401`) and expired `expiresAt` (`400`), proves duplicate delivery/retries across both routes remain strictly idempotent (`COUNT(*) = 1` in `media_upload_records`), and verifies Stage 2 `P103_CUTOVER_FREEZE_CALLBACKS=true` blocks both routes with `503 CUTOVER_WRITE_FROZEN` and **0 DB / 0 Blob writes**.
  - **In-test Edge WAF policy simulation** (`src/lib/cutoverWafPolicy.test.ts` — **3/3 passed**; in-test simulation only, NOT live Vercel Firewall verification): verifies Stage 1 Edge WAF `Deny` returns **HTTP 403** on mutating `POST /api/*` & `GET /api/cron/analytics-cleanup`, allows **both** `/api/media/client-upload` and `/api/media/client-upload/callback` through to app handlers (where app rejects token-gen with `503` on legacy / `403` on new, and persists signed callbacks via shared handler), Stage 2 Edge WAF `Deny` returns **HTTP 403** on **both** callback paths before app execution, and read-only `GET` routes pass (`200 OK`).
  - **Cutover restore allowlist & strict v3 completeness** (`src/lib/p103CutoverRestore.test.ts` — **15/15 passed**) and **Media upload flow** (`src/lib/media/workstreamB.test.ts` — **9/9 passed**).
- **P1-03.2A Follow-Up & Baseline CI vs Local Quality Gates**:
  - **Pre-remediation GitHub CI Baseline (HEAD `7c82d2bbdef9ab3ac9eb5d7d1c56e61268408d19`)**: GitHub Actions Run **#81** (`46135687894`) **PASSED** (Quality Gates: 385 Vitest tests, Next.js build `16/16`, ESLint `0` errors / `2` pre-existing warnings, Linux Playwright `11/11`, Windows Playwright `11/11`, Vercel Preview `Success`). **Note**: Run #81 predates P1-03.2A edits (`F-01`–`F-04`) and is NOT evidence for P1-03.2A; a fresh GitHub CI run is required after separately authorized push.
  - **P1-03.2A Status**:
    - `F-01` (Stage 1 WAF both callback paths): **Resolved & locally verified** (`src/lib/cutoverWafPolicy.test.ts`). Live Vercel Firewall rule still requires Owner verification at cutover.
    - `F-02` (PR #21 → PR #19 → `main` order): **Resolved in docs** (`p103-production-cutover-plan.md`, `p103-production-cutover-checklist.md`, `operations-runbook.md`).
    - `F-03` (Unified `T_drain-start` definition): **Resolved in docs** (replaced `T_stage1` across all 3 docs).
    - `F-04` (Strict v3 completeness & fail-closed restore): **Resolved & locally verified** (`scripts/lib/backup-format.mjs`, `scripts/p103-cutover-restore.mjs`, `src/lib/p103CutoverRestore.test.ts`). Live Turso target rehearsal & Owner WAF/Production cutover remain Owner-controlled gates.
