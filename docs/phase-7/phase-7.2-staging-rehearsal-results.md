# Phase 7.2 — Follow-Up Remediation, Local DR & Staging Rehearsal Results

- **Project**: FC HĐH Gò Nổi tại TP.HCM (`nguyenthetiengit01-collab/FCHDHGoNoi`)
- **Feature Branch / PR**: `fix/phase-7.1-pre-release-remediation` (PR #16 — **DRAFT / OPEN / NOT MERGED**)
- **Base `main` SHA**: `c37dfd3200547210e8c6308b34c44db4fe18c04e`
- **Latest Verified Code+E2E Commit**: `c7e95719467207441722a9fbc065fc73fa1f676c`
- **Date**: 2026-11-20
- **Overall Release Decision**: **NO-GO** (`P0-01` configuration verified / enforcement behavior verification pending; P1 owner/Preview sign-off pending; Remote Staging **BLOCKED**; Preview Smoke/Rollback & Real-Device QA **NOT VERIFIED**)

---

## 1. GitHub Main Branch Protection — Owner Action (`P0-01`)

Independently verified via GitHub API on 2026-11-20:
- **Branch API (`branches/main`)**: `protected: true`
- **Repository Ruleset**: `main` (**ID**: `27703288`, `enforcement: active`, target `refs/heads/main`)
- **Required Status Checks (3/3)**:
  1. `Quality Gates (Node 22.23.5)`
  2. `Playwright Visual & Accessibility QA (Linux)`
  3. `Playwright Visual & Accessibility QA (Windows)`
- **Policy Controls**: `strict: true`, `1` required approving review, `dismiss_stale_reviews: true`, `required_review_thread_resolution: true`, `current_user_bypass: never`, force-push & branch deletion blocked.
- **Evidence URLs**:
  - `https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi/rules/27703288`
  - `https://api.github.com/repos/nguyenthetiengit01-collab/FCHDHGoNoi/branches/main`
- **Closure Status**: **CONFIGURATION VERIFIED — ENFORCEMENT BEHAVIOR VERIFICATION PENDING** (`Blocking = YES` until PR/merge enforcement behavior is validated).

---

## 2. Technical Follow-Up Remediations (F7.1-14, F7.1-15, F7.1-16)

| ID | Scope & Implementation | Verification | Status |
| :--- | :--- | :--- | :---: |
| **F7.1-14** | Deterministic FK initialization in `TursoDbAdapter` (`src/lib/db.ts`): replaced fire-and-forget `void adapter.enableForeignKeys().catch(() => {})` with `ensureReady()` memoized `initPromise` + `initState` (`uninitialized`/`initializing`/`ready`). All `query`, `queryOne`, `run`, `batch`, `exec`, and `transaction` await `ensureReady()`. Failed init resets state and rejects all waiting callers without marking ready. | `phase71DatabaseTurso.test.ts` (20 concurrent first queries run init once; init failure rejects all waiters & retries cleanly; `Row[]` & `ResultSet` typed cleanly) | **CODE & TEST VERIFIED** |
| **F7.1-15** | Turso write timeout & unknown outcome (`src/lib/db.ts`, `src/app/api/team/route.ts`, `src/app/api/import/route.ts`): inspected `@libsql/client` (`@libsql/core/lib-esm/api.d.ts`) — per-request `AbortSignal` cancellation is not supported. Added `TursoWriteOutcomeUnknownError` (`code: "DB_WRITE_OUTCOME_UNKNOWN"`, `outcome: "unknown"`, `retryable: false`, `reconcileRequired: true`, `operationType`, `correlationId`, `timeoutMs`) on write timeouts (`run`, `batch`, `exec`, `transaction.run`, `transaction.exec`, `transaction.commit`). On `transaction.commit` timeout, `tx.rollback()` is NOT called. Added `mapDatabaseErrorToHttpResponse()` returning HTTP `503` with Vietnamese anti-resubmit guidance. | `phase71DatabaseTurso.test.ts` (write timeout while underlying promise settles later, `transaction.commit` timeout without rollback, 0 automatic write retries, HTTP `503` mapper) | **CODE & TEST VERIFIED** |
| **F7.1-16** | Default PIN hashing (`src/app/api/team/route.ts`, `src/lib/db.ts`): replaced literal `'1234'` in `add_walkin_player` and `save_player` fallback with `hashPassword("1234")`, and replaced literal `'1234'` in `seedAsyncInitialDataIfNeeded` / `seedInitialDataIfNeeded` with `hashSeedDefaultPin("1234")` (`scrypt$`). | `phase71AuthPrivacy.test.ts` (`scrypt$` format, `verifyPassword("1234", hash)` = `true`, raw != `"1234"`, `pin_code` omitted from API DTO, `change_own_password` compatible) | **CODE & TEST VERIFIED** |

### Idempotency & Reconciliation Design Note (`F7.1-15` / `P3-04`)
- **REMEDIATED (Phase 7.1.3 + Phase 7.1.4 + Phase 7.1.5 + Consolidated Closure)**:
  - Client (`CollectionTab.tsx`, `src/lib/collectionDraft.ts`) persists a 7-field logical operation record (`match_id`, `idempotency_key`, `payload_fingerprint`, `collected_by`, normalized `items`, `state`, `created_at`) verified by read-back before sending, detects unresolved operations independently of `dirtyCount` (even when `dirtyCount === 0` after server convergence, UI displays `"Có giao dịch thu quỹ chưa đối chiếu"` + `"Đối chiếu / Thử lại"` using the persisted original payload & key and never displays `"Đã đồng bộ với máy chủ"`), blocks payload changes or overwrites while unresolved, and clears pending only on confirmed success or definitive 4xx no-write.
  - Server (`POST /api/team` `collect_match_fees_batch`) requires `Idempotency-Key` (`400` if missing/invalid) and persists `idempotency_keys` atomically inside `db.transaction(...)` with `match_attendances` and `audit_logs` (verified against `LocalSqliteAdapter` and overlapping `TursoDbAdapter` mocked transactions including audit rollback & actor isolation).
  - **Response Contract (Option B)**: `idempotency_keys` stores deduplication metadata (`payload_hash`, `status_code`, summary `response_json`); HTTP replay returns `200` with `X-Idempotent-Replay: true` and an authorized fresh `getFullAppData()` snapshot (zero duplicate financial or audit writes).
  - **Remaining Limitations**: Manual discard only removes client state after explicit reconciliation warning (cannot roll back a committed server transaction); clearing browser site data/storage removes the local recovery record; mocked libSQL concurrency does not replace real Remote Staging Turso verification (`NOT VERIFIED`).
  - **Live Browser E2E & Dependency Audit**: `tests/e2e/collection-recovery.spec.ts` — Live Chromium browser recovery test verifies `CollectionTab` UI state, persistence/recovery behavior, exact outgoing idempotency payload/key, reconciliation warning, and fail-closed behavior under corrupted/quota `localStorage`. The `POST` request is intercepted by Playwright; therefore, this test does not prove Remote Turso execution or real database concurrency. Remote Turso replay/concurrency remains `NOT VERIFIED` pending authorized Staging rehearsal. `npm audit --omit=dev` = `0` vulnerabilities; full `npm audit` = `6` dev-only moderate advisories (`minimatch` `GHSA-g3hv-75wg-m249` + 5 `@typescript-eslint/*` via `eslint-config-next@15.5.29`, zero runtime exposure).
  - Authoritative pre-release migration `scripts/migrations/phase7-idempotency-v1.mjs` enforces zero-write `--dry-run`, `TURSO_STAGING_DATABASE_URL` / `TURSO_STAGING_AUTH_TOKEN` allowlist preflight, and local SQLite `realpathSync` symlink safety guards (`ensureIdempotencyKeysReady` remains as a lazy backward-compatibility safety net).
- On `DB_WRITE_OUTCOME_UNKNOWN` (`503`), retrying with the preserved `Idempotency-Key` and identical payload either replays cleanly (if committed) or executes once (if rolled back). Other single-row financial mutations remain reconciliation-required on `503`.

### Phase 7.1.2 & 7.1.3 Residual Hardening Summary
- **P1-03 Historical Exposure (`HISTORICAL EXPOSURE CLASSIFICATION PENDING OWNER`)**: Current working tree remediated (`data/gonoifc.sqlite` deleted from PR #16, `0` `.nft.json` traces); historical public Git blob (`67f415fac8aaf1e80b22c356d01fa1f782083a03` in `c37dfd32`) awaits **Owner Offline Classification** (`git show c37dfd32:data/gonoifc.sqlite` inspected offline without printing PII/PINs; if real data existed, rotate credentials and evaluate history cleanup).
- **P3-02 UI Reset PIN & Add Player**: `PlayersTab.tsx` and `TeamManagerApp.tsx` remove all `"1234"` defaults/titles/placeholders; manager enters `New PIN` + `Confirm new PIN` validated via `src/lib/passwordStrength.ts`, preserving inputs and showing API `400` errors (`phase713ResetPinUi.test.ts`).
- **`P2-08` Financial & Audit Atomicity**: All financial, account, settings, and multi-table mutations in `POST /api/team` wrap business writes and `recordAuditLog({ ..., tx })` inside one `db.transaction(...)` (with `ensureAuditLogsReady()` before `tx`).
- **`P2-05` Serverless Upload Limits**: `/api/import` and `/api/webp` cap uploads at `4 MB` (`413` on `Content-Length`, `file.size`, and body bytes; `400` on invalid MIME, empty file, or malformed multipart). Note: Next.js `req.formData()` buffers the multipart body in memory before `file.size`/`arrayBuffer` inspection on Vercel's 4.5 MB payload limit; pre-checking `Content-Length > 4 MB` rejects declared oversized uploads early.
- **Restore DDL Hardening**: `scripts/lib/backup-format.mjs` enforces lexical single-statement SQL, exact `object.name` extraction match, duplicate object rejection, and `schema === objects.tables` parity, verified with adversarial tests (literals/identifiers with `;`, escaped quotes, comments, triggers with `BEGIN/END` & `CASE/END`, real `sqlite_master` DDL).
- **CSP Baseline Limitation**: `next.config.ts` retains `'unsafe-inline'` for Next.js 15 static prerendering & Tailwind CSS v4 compatibility; full nonce-based CSP requires `middleware.ts` dynamic rendering and Preview smoke verification.

---

## 3. Additional Security Review

- **Player API Response**: Verified `pin_code`, `scrypt$` hashes, `pwdFingerprint`, teammates' `phone`/`username`/`notes`/`access_role`, and `tournament_fund_note` are absent from `player` responses (`POST /api/team`, `GET /api/team`, `POST /api/import`, `GET/POST /api/auth`).
- **Club Financial Transparency Boundary**: `sanitizeDataForPlayer` (`src/lib/auth.ts:904-937`) intentionally exposes `otherIncomes`, `expenses`, `attendances`, and `summary` to authenticated `player` members (per club transparency policy) while `sanitizeDataForPublic` hides `otherIncomes` and `expenses` from `Guest`.
- **Session & Error Behavior**: `requirePlayerSession` / `requireManagerSession` verify DB active status, `access_role`, and `pwdFingerprint` on all authenticated endpoints; error responses expose zero SQL/secrets/stack traces.

---

## 4. Local Synthetic DR Rehearsal & Hardening (`8153da1d` -> `c7e95719`)

Executed on 2026-11-20 using synthetic data in `os.tmpdir()` (zero `data/gonoifc.sqlite`, zero Production/Staging credentials):
- **v3 Payload Validation (`scripts/lib/backup-format.mjs`)**: `sequences` array required; `schema` & `objects.tables` DDL consistency enforced; `rowCounts` non-negative integers matched against `tables[t].length`.
- **Local SQLite Atomicity (`scripts/db-restore.mjs`)**: `restoreToLocalSqlite()` validates parent directory & approved restore directory (`os.tmpdir()` / `RESTORE_APPROVED_DIR`), checks target emptiness, executes full restore inside `BEGIN IMMEDIATE; ... COMMIT;` (`ROLLBACK` on failure), and runs `PRAGMA foreign_key_check` (`[]`), `assertRowCountsMatch()`, and `PRAGMA integrity_check` (`ok`).
- **Failure Injection (`src/lib/phase72RestoreHardening.test.ts` + `src/lib/backupRestoreV3.test.ts`)**:
  - Missing `sequences`, malformed `schema`, malformed `rowCounts`: **Rejected before touching target**.
  - Non-empty target (`existing.sqlite`), missing parent dir, wrong local/staging target identity: **Rejected**; existing data preserved untouched.
  - Failure halfway through table inserts, index creation, sequence restoration, `PRAGMA foreign_key_check`, `PRAGMA integrity_check != ok`, and `COMMIT`: **Rolled back atomically** (`sqlite_master` empty `[]`, never reports `"status": "ok"`).
- **Cleanup**: All disposable temp files removed (`workDirRemaining: false`, `cleanupErrors: []`).

### Remote Turso Restore Limitation (CRITICAL)
- **Remote Turso restore (`restoreToTursoStaging()`) is NOT atomic across the full database.** Local SQLite atomicity and remote Turso contamination handling are separate properties.
- The remote `_restore_contaminated` marker is **best-effort** and can fail to persist during connection loss.
- Remote Staging was **not** executed, and remote restore behavior is **not proven** against real Staging.
- Any remote partial or unknown outcome must render the target **unusable** until owner/operator reconciliation. Always provision a unique disposable target and never reuse a possibly contaminated target.

---

## 5. Remote Staging, Preview, Rollback & Real-Device Status

| Gate / Activity | Status | Observed Evidence / Blocker |
| :--- | :---: | :--- |
| **Staging Preflight (Env Presence)** | **BLOCKED** | Local shell env: `TURSO_STAGING_DATABASE_URL=ABSENT`, `TURSO_STAGING_AUTH_TOKEN=ABSENT`, `TURSO_STAGING_RESTORE_DATABASE_URL=ABSENT`, `TURSO_STAGING_RESTORE_AUTH_TOKEN=ABSENT`. PR #16 is open/draft and not merged to `main`. |
| **Remote Staging Backup & Restore** | **BLOCKED** | Blocked by incomplete prerequisites (PR #16 not merged, Staging env absent, `P0-01` enforcement behavior pending). |
| **Vercel Preview Smoke Tests** | **BLOCKED** | Blocked until PR #16 merges/deploys cleanly with verified Preview/Production env separation. |
| **Vercel Preview Rollback Drill** | **NOT VERIFIED** | Blocked with Preview smoke tests; actual RTO not yet measured. |
| **Real-Device QA (`docs/pwa-real-device-checklist.md`)** | **NOT VERIFIED** | Physical iOS Safari & Android Chrome devices unavailable in automated environment; desktop Chromium Playwright emulation cannot substitute for real-device sign-off. |

---

## 6. Verification Evidence (`c7e95719467207441722a9fbc065fc73fa1f676c`)

### A. Local Execution Evidence (Coding Agent)
- `npm audit --omit=dev`: **0 vulnerabilities** (`npm audit` full = `6 moderate` dev-only via `eslint-config-next@15.5.29`).
- `npm test -- --maxWorkers=1`: **51/51 test files passed, 390/390 tests passed**.
- `npm run lint` (`eslint src`): **0 errors**.
- `npx tsc --noEmit`: **0 errors**.
- `npm run build`: **Passed** (`NFT_SQLITE_COUNT=0`).
- `npm run test:e2e` (Windows, isolated `QA_ROOT`): **11/11 passed** (`LCP: 2692ms`, `CLS: 0`).

### B. GitHub Actions CI Evidence
- **Run ID**: `44711932818` (`https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi/actions/runs/44711932818`)
- **Jobs**:
  - `Quality Gates (Node 22.23.5)`: **`success`**
  - `Playwright Visual & Accessibility QA (Linux)`: **`success`**
  - `Playwright Visual & Accessibility QA (Windows)`: **`success`**

## 7. Current Evidence Addendum — 2026-11-23

### 7.1 Read-only Account Assessment
- Exact target hostname: `fchdhgonoi-staging-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io`.
- Code context: `feat/p103-pin-enforcement` at `7e3c5d7e59e8bf3fa8f58398cdd3661ac525be1b`.
- Result: `status=ok`, `readOnly=true`; exact Staging hostname validated.
- URL and token were entered interactively and cleared after execution. Only read transaction, schema inspection and SELECT queries were performed. Token was supplied as read-only by the operator; actual Turso token permissions were not independently inspected.
- Accounts: 2 total, 2 active; 1 manager and 1 player.
- Credentials: 2 `scryptNonDefault`; 0 missing, 0 plaintext default `1234`, 0 scrypt default `1234`, 0 undetermined.
- `resetRequiredCount=0`; `mustChangePinPending=2`; `schemaPinCodeDefault=empty`.
- Both accounts remain gated by `must_change_pin=1`. The assessment did not mark either account as reset-required; it does not establish credential handoff availability.

### 7.2 Audit Log Reconciliation
- `audit_logs` table and required schema: PASS.
- Manager recovery `CHG-P103C48-20261123-01`: 1 record.
- Bulk reset `CHG-P103C-RESETALL-20261123-01`: 2 records.
- Bulk reset `CHG-P103C-RESETALL-20261123-02`: 2 records.
- Unknown approval references: 0. Missing approval references: 0.
- Both active QA accounts have `must_change_pin=1`.
- The second Bulk Apply is confirmed by its two audit records. No PIN, player identifier, phone, hash or raw audit summary was exported.

### 7.3 Credential Handoff & E2E
- Operator could not confirm retention or delivery of the credential handoff from the second Bulk Apply. Treat all previously displayed temporary credentials as unavailable and do not reuse them.
- No additional reset was executed. A future reset requires fresh Owner approval, one controlled Apply, and secure out-of-band handoff.
- Manager/Player Login E2E: BLOCKED / NOT STARTED.
- Staging authenticated security regression: NOT VERIFIED; passing CI tests do not establish authenticated behavior against Staging.
- Formal Staging/DR rehearsal remains blocked until Phase 7.1 is merged to `main`, as required by the runbook. These read-only checks do not constitute formal rehearsal acceptance.

### 7.4 Latest PR #16 CI Evidence
- Head: `e1610490f2c8ae1ab09ccd936a28a402191bb30b`.
- GitHub Actions Run #67: https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi/actions/runs/45168499285 — completed / success.
- Quality Gates, Playwright Windows, Playwright Linux: all SUCCESS.
- Vercel commit status: SUCCESS; deployment status does not prove authenticated Preview smoke tests or Preview/Production DB separation.
- Local verification: 53/53 Vitest files, 420/420 tests; ESLint PASS; TypeScript PASS; Next.js build PASS.
- Three warning annotations were non-failing runtime/deprecation notices. Track them as maintenance; do not suppress warnings just to remove annotations.

### 7.5 Current Release Decision
**NO-GO remains in force.** P0-01 behavioral enforcement, P1-03 Production containment, P1-10–P1-13 Owner/Operations sign-offs, Preview separation and authenticated smoke/rollback, remote DR restore, and real-device QA remain open or unverified.
