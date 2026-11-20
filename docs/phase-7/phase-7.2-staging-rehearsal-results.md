# Phase 7.2 — Follow-Up Remediation, Local DR & Staging Rehearsal Results

- **Project**: FC HĐH Gò Nổi tại TP.HCM (`nguyenthetiengit01-collab/FCHDHGoNoi`)
- **Feature Branch / PR**: `fix/phase-7.1-pre-release-remediation` (PR #16 — **DRAFT / OPEN / NOT MERGED**)
- **Base `main` SHA**: `c37dfd3200547210e8c6308b34c44db4fe18c04e`
- **Date**: 2026-11-20
- **Overall Release Decision**: **NO-GO** (`P0-01` Branch Protection on `main` still `protected: False`; Remote Staging, Vercel Preview, Preview Rollback, and Real-Device QA are **BLOCKED / NOT VERIFIED**)

---

## 1. Technical Follow-Up Remediations (F7.1-14, F7.1-15, F7.1-16)

| ID | Scope & Implementation | Verification | Status |
| :--- | :--- | :--- | :---: |
| **F7.1-14** | Deterministic FK initialization in `TursoDbAdapter` (`src/lib/db.ts`): replaced fire-and-forget `void adapter.enableForeignKeys().catch(() => {})` with `ensureReady()` memoized `initPromise` + `initState` (`uninitialized`/`initializing`/`ready`). All `query`, `queryOne`, `run`, `batch`, `exec`, and `transaction` await `ensureReady()`. Failed init resets state and rejects all waiting callers without marking ready. | `phase71DatabaseTurso.test.ts` (20 concurrent first queries run init once; init failure rejects all waiters & retries cleanly) | **CODE & TEST VERIFIED** |
| **F7.1-15** | Turso write timeout & unknown outcome (`src/lib/db.ts`, `src/app/api/team/route.ts`, `src/app/api/import/route.ts`): inspected `@libsql/client` (`@libsql/core/lib-esm/api.d.ts`) — per-request `AbortSignal` cancellation is not supported. Added `TursoWriteOutcomeUnknownError` (`code: "DB_WRITE_OUTCOME_UNKNOWN"`, `outcome: "unknown"`, `retryable: false`, `reconcileRequired: true`, `operationType`, `correlationId`, `timeoutMs`) on write timeouts (`run`, `batch`, `exec`, `transaction.run`, `transaction.exec`, `transaction.commit`). On `transaction.commit` timeout, `tx.rollback()` is NOT called. Added `mapDatabaseErrorToHttpResponse()` returning HTTP `503` with Vietnamese anti-resubmit guidance. | `phase71DatabaseTurso.test.ts` (write timeout while underlying promise settles later, `transaction.commit` timeout without rollback, 0 automatic write retries, HTTP `503` mapper) | **CODE & TEST VERIFIED** |
| **F7.1-16** | Default PIN hashing (`src/app/api/team/route.ts`, `src/lib/db.ts`): replaced literal `'1234'` in `add_walkin_player` and `save_player` fallback with `hashPassword("1234")`, and replaced literal `'1234'` in `seedAsyncInitialDataIfNeeded` / `seedInitialDataIfNeeded` with `hashSeedDefaultPin("1234")` (`scrypt$`). | `phase71AuthPrivacy.test.ts` (`scrypt$` format, `verifyPassword("1234", hash)` = `true`, raw != `"1234"`, `pin_code` omitted from API DTO, `change_own_password` compatible) | **CODE & TEST VERIFIED** |

### Idempotency & Reconciliation Design Note (`F7.1-15`)
- `collect_match_fees_batch` (`src/app/api/team/route.ts:1208-1210`) currently accepts `idempotency_key` (`void idempotency_key;`) without DB-level persistence.
- Per audit guardrails, no in-memory-only idempotency cache was added. All financial mutations (`collect_match_fee`, `collect_match_fees_batch`, `upsert_expense`, `upsert_other_income`) are documented as **reconciliation-required** when `DB_WRITE_OUTCOME_UNKNOWN` (`503`) occurs.
- **Proposed DB-level Idempotency Design (For Owner Approval)**: Add an `idempotency_keys (key TEXT PRIMARY KEY, action TEXT NOT NULL, actor_id INTEGER NOT NULL, status TEXT NOT NULL, response_json TEXT, created_at TEXT NOT NULL)` table in a future migration so financial batch writes check/insert the key inside the same `db.transaction(...)`.

---

## 2. Additional Security Review (Section 5)

- **Player API Response**: Verified `pin_code`, `scrypt$` hashes, `pwdFingerprint`, teammates' `phone`/`username`/`notes`/`access_role`, and `tournament_fund_note` are absent from `player` responses (`POST /api/team`, `GET /api/team`, `POST /api/import`, `GET/POST /api/auth`).
- **Club Financial Transparency Boundary**: `sanitizeDataForPlayer` (`src/lib/auth.ts:904-937`) intentionally exposes `otherIncomes`, `expenses`, `attendances`, and `summary` to authenticated `player` members (per club transparency policy) while `sanitizeDataForPublic` hides `otherIncomes` and `expenses` from `Guest`. *Observation*: `otherIncomes.contributor` and `expenses.payer_name` remain visible to authenticated players; if privacy policy changes, a role-specific financial projection should be added.
- **Session & Error Behavior**: `requirePlayerSession` / `requireManagerSession` verify DB active status, `access_role`, and `pwdFingerprint` on all authenticated endpoints; error responses expose zero SQL/secrets/stack traces.

---

## 3. Local Synthetic DR Rehearsal (Section 6)

Executed on 2026-11-20 in disposable `os.tmpdir()/phase72-local-dr-1795146863458-6473a9` (no `data/gonoifc.sqlite`, no Production/Staging credentials):
- **Migrations (`phase4-analytics-v1.mjs`)**: Run 1 inserted `2` baselines; Run 2 inserted `0` baselines (idempotent).
- **Backup v3 (`scripts/db-backup.mjs`)**: `14` tables, `10` indexes, `1` view, `8` sequences.
- **Encryption (`scripts/backup-crypto.mjs`)**: Ephemeral X25519 keygen -> `X25519-HKDF-SHA256-AES-256-GCM` encrypt -> decrypt (`0` errors).
- **Restore (`scripts/db-restore.mjs --confirm`)**: `status: "ok"`; restored `14` tables, `10` indexes, `1` view, `8` sequences; financial totals matched (`totalIncome: 400000`, `totalExpense: 600000`, `currentBalance: -200000`); `PRAGMA integrity_check` = `ok`; `PRAGMA foreign_key_check` = `[]`.
- **Failure Injection**:
  - `corruptEncryptedArtifact`: **Rejected** (`true`)
  - `invalidAuthTag`: **Rejected** (`true`)
  - `invalidBackupVersion` (`99`): **Rejected** (`true`)
  - `nonEmptyTargetPreservedOnFailure`: **Preserved** (`true`)
  - `partialFailureBlocked`: **Rejected** (`true`)
  - *Operational Observations*: `missingSchema` / `missingSequences` returned `false` (not rejected by `db-restore.mjs` when `objects.tables` was present), and `invalidTargetPath` (`missing-dir/sub/bad.sqlite`) auto-created parent directories via `fs.mkdirSync(..., { recursive: true })`.
- **Cleanup**: `createdCount: 12`, `removedCount: 13`, `workDirRemaining: false`, `cleanupErrors: []`.

---

## 4. Remote Staging, Preview, Rollback & Real-Device Status

| Gate / Activity | Status | Observed Evidence / Blocker |
| :--- | :---: | :--- |
| **Staging Preflight (Env Presence)** | **BLOCKED** | Local shell env: `TURSO_STAGING_DATABASE_URL=ABSENT`, `TURSO_STAGING_AUTH_TOKEN=ABSENT`, `TURSO_STAGING_RESTORE_DATABASE_URL=ABSENT`, `TURSO_STAGING_RESTORE_AUTH_TOKEN=ABSENT`. Prerequisites 1–4 (`P0-01` branch protection `protected: false`, PR #16 `open/draft`, not merged to `main`) are incomplete. |
| **Remote Staging Backup & Restore** | **BLOCKED** | Blocked by incomplete prerequisites (`P0-01` OPEN, PR #16 not merged, Staging env absent). |
| **Vercel Preview Smoke Tests** | **BLOCKED** | Blocked until PR #16 merges/deploys cleanly with verified Preview/Production env separation. |
| **Vercel Preview Rollback Drill** | **NOT VERIFIED** | Blocked with Preview smoke tests; actual RTO not yet measured. |
| **Real-Device QA (`docs/pwa-real-device-checklist.md`)** | **NOT VERIFIED** | Physical iOS Safari & Android Chrome devices unavailable in automated environment; desktop Chromium Playwright emulation cannot substitute for real-device sign-off. |

---

## 5. Final Regression Verification (`fix/phase-7.1-pre-release-remediation`)

- `npm audit --omit=dev`: **0 vulnerabilities**
- Full `npm audit --json` (including devDependencies): `0` critical, `0` high, `6` moderate (dev/tooling only), `0` low.
- `npm test -- --maxWorkers=1`: **45/45 test files passed, 366/366 tests passed**.
- `npm run lint`: **0 errors, 0 warnings**.
- `npx tsc --noEmit`: **0 errors**.
- `npm run build`: **Passed** (`NFT_SQLITE_COUNT=0` — zero `gonoifc.sqlite` traces in `.next/**/*.nft.json`).
- `npm run test:e2e` (isolated `QA_ROOT`): **10/10 passed** (axe-core `0` violations, `LAB_VITALS_HOME: {"lcp":3444,"cls":0}`).
- **Linux E2E & Windows E2E CI**: Pending GitHub Actions run on latest follow-up commits (prior run `44667793379` on `ed706d2` passed both Linux & Windows).
