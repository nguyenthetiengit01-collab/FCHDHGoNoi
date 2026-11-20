# Phase 7.2 — Follow-Up Remediation, Local DR & Staging Rehearsal Results

- **Project**: FC HĐH Gò Nổi tại TP.HCM (`nguyenthetiengit01-collab/FCHDHGoNoi`)
- **Feature Branch / PR**: `fix/phase-7.1-pre-release-remediation` (PR #16 — **DRAFT / OPEN / NOT MERGED**)
- **Base `main` SHA**: `c37dfd3200547210e8c6308b34c44db4fe18c04e`
- **Latest Verified Commit**: `8153da1d53b62041e104e2479e8d21e8339439a4`
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

### Idempotency & Reconciliation Design Note (`F7.1-15`)
- `collect_match_fees_batch` (`src/app/api/team/route.ts:1208-1210`) currently accepts `idempotency_key` (`void idempotency_key;`) without DB-level persistence (`P3-04` remains **OPEN**).
- Per audit guardrails, no in-memory-only idempotency cache was added. All financial mutations (`collect_match_fee`, `collect_match_fees_batch`, `upsert_expense`, `upsert_other_income`) are documented as **reconciliation-required** when `DB_WRITE_OUTCOME_UNKNOWN` (`503`) occurs.
- **Proposed DB-level Idempotency Design (For Owner Approval)**: Add an `idempotency_keys (key TEXT PRIMARY KEY, action TEXT NOT NULL, actor_id INTEGER NOT NULL, status TEXT NOT NULL, response_json TEXT, created_at TEXT NOT NULL)` table in a future migration so financial batch writes check/insert the key inside the same `db.transaction(...)`.

---

## 3. Additional Security Review

- **Player API Response**: Verified `pin_code`, `scrypt$` hashes, `pwdFingerprint`, teammates' `phone`/`username`/`notes`/`access_role`, and `tournament_fund_note` are absent from `player` responses (`POST /api/team`, `GET /api/team`, `POST /api/import`, `GET/POST /api/auth`).
- **Club Financial Transparency Boundary**: `sanitizeDataForPlayer` (`src/lib/auth.ts:904-937`) intentionally exposes `otherIncomes`, `expenses`, `attendances`, and `summary` to authenticated `player` members (per club transparency policy) while `sanitizeDataForPublic` hides `otherIncomes` and `expenses` from `Guest`.
- **Session & Error Behavior**: `requirePlayerSession` / `requireManagerSession` verify DB active status, `access_role`, and `pwdFingerprint` on all authenticated endpoints; error responses expose zero SQL/secrets/stack traces.

---

## 4. Local Synthetic DR Rehearsal & Hardening (`8153da1d`)

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

## 6. Verification Evidence (`8153da1d53b62041e104e2479e8d21e8339439a4`)

### A. Local Execution Evidence
- `npm audit --omit=dev`: **0 vulnerabilities**
- `npm test -- --maxWorkers=1`: **46/46 test files passed, 370/370 tests passed**.
- `npm run lint` (`eslint src`): **0 errors, 0 warnings**.
- `npx tsc --noEmit`: **0 errors**.
- `npm run build`: **Passed** (`NFT_SQLITE_COUNT=0`).
- `npm run test:e2e` (Windows, isolated `QA_ROOT`): **10/10 passed** (axe-core `0` violations, `LAB_VITALS_HOME: {"lcp":2524,"cls":0}`).

### B. GitHub Actions CI Evidence
- **Run ID**: `44675008948` (`https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi/actions/runs/44675008948`)
- **Jobs**:
  - `Quality Gates (Node 22.23.5)`: **`success`**
  - `Playwright Visual & Accessibility QA (Linux)`: **`success`**
  - `Playwright Visual & Accessibility QA (Windows)`: **`success`**
