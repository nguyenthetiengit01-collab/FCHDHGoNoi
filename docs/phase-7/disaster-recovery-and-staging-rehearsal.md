# Phase 7 — Disaster Recovery Assessment & Staging Rehearsal Plan

- **Baseline**: `main` @ `c37dfd3200547210e8c6308b34c44db4fe18c04e` (Phase 7.1 DR/Governance documented in `docs/operations-runbook.md`)
- **Last Local Synthetic Drill**: 2026-11-20 (**PASSED** in isolated `os.tmpdir()/phase72-local-dr-1795146863458-6473a9`; Remote Staging **BLOCKED** pending `P0-01` & PR #16 merge — see [phase-7.2-staging-rehearsal-results.md](./phase-7.2-staging-rehearsal-results.md))

---

## 1. Disaster Recovery (DR) Assessment

| DR Dimension | Current Verified State | Gap / Risk | Recommended Target (For Owner Approval) |
| :--- | :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | `NOT DOCUMENTED` (effective RPO from weekly workflow = **up to 7 days**; Turso PITR not documented) | `P1-12` — Up to 7 days of match/finance data at risk | **7 days** (if weekly CI remains) or **<= 24 hours** (enable daily backup schedule or verify Turso PITR) |
| **RTO (Recovery Time Objective)** | `NOT DOCUMENTED` | `P1-12` — No SLA for manual Turso provisioning + restore + Vercel redeploy | **<= 2 hours** for full manual recovery per `docs/operations-runbook.md` Section 3 |
| **Backup Interval** | Weekly (`0 20 * * 0` UTC = `20:00 UTC` Chủ Nhật / `03:00 UTC+7` Thứ Hai) + `workflow_dispatch` | `0` `schedule` runs yet. Lần chạy kế tiếp dự kiến `2026-11-22 20:00 UTC` (`2026-11-23 03:00 UTC+7`, có thể trễ theo tải GitHub Actions). **Phạm vi nhánh**: GitHub chỉ chạy `schedule` trên default branch (`main`); do PR #16 chưa merge, lần chạy này dùng workflow trên `main` (chưa có `Report backup failure alert` của PR #16) và **không** chứng minh bước cảnh báo mới trong PR #16. | Giữ cron `0 20 * * 0` (03:00 Thứ Hai UTC+7); xác minh run `2026-11-22/23` trên `main` tách biệt với bằng chứng workflow PR #16 sau khi merge; cân nhắc daily cron. |
| **Artifact Retention** | `30 days` on GitHub Actions | Single-vendor (GitHub) unless manually downloaded | Retain `30 days` in GH + automated or monthly verified off-GitHub copy |
| **Private Key Custody** | Policy in Runbook (`lines 35, 55-56`): 2 offline copies, never in GH | Actual custody `NOT VERIFIED` | Owner confirms 2-copy custody before launch |
| **Key Rotation** | `keyId` tracked in `.enc` envelope; keep old key >= 30 days | Sound design | Rotate annually or immediately on suspected exposure |
| **Restore Drill Frequency** | `NOT DOCUMENTED` | Ad-hoc only | **Quarterly** Staging restore drill + pre-major-migration drill |
| **Recovery Command Gap** | Runbook Section 3 Step 3 references `turso db shell` / client; `db-restore.mjs` only allows `fchdhgonoi-staging-restore` or local SQLite | Cannot run `db-restore.mjs` directly against a newly provisioned recovery DB | Document exact `sqlite3 ... .dump` / Turso CLI push command or add `--env recovery` preflight |
| **Operational Ownership** | `NOT DOCUMENTED` (generic "Chủ sở hữu" / "Ban Quản Lý") | Unclear escalation during outage | Assign Primary & Backup DR Owners + contact channels |

> **Scope Separation**: Section 3 below is a **Staging-only rehearsal** using `fchdhgonoi-staging` and `fchdhgonoi-staging-restore`. **Production recovery** is never executed via `db-restore.mjs --env staging` or automated CI; it requires explicit owner authorization and provisioning of a separate Production recovery Turso database per `docs/operations-runbook.md` Section 3.

---

## 2. Local Synthetic Restore Drill Evidence (2026-11-20)

Executed by Agent C in disposable `D:\Test1\_phase7-audit-evidence\drill-tmp\` (Node `v24.12.0`, zero Production/Staging credentials):
1. Initialized 9 core tables with `PRAGMA foreign_keys = ON;` and synthetic records.
2. Executed `scripts/migrations/phase4-analytics-v1.mjs` twice -> confirmed idempotency (`insertedBaselines: 0` on run 2).
3. Generated v3 backup via `scripts/db-backup.mjs` (`14` tables, `9` indexes, `8` sequences).
4. Generated ephemeral X25519 keypair, encrypted and decrypted via `scripts/backup-crypto.mjs` (`X25519-HKDF-SHA256-AES-256-GCM`, exit `0`).
5. Validated payload via `validateBackupPayload()` (`valid: true`).
6. Restored into a second disposable SQLite file via `scripts/db-restore.mjs --in <backup.json> --target <restored.sqlite> --confirm`.
7. Verified parity: `14/14` tables, `9/9` indexes, `8/8` `sqlite_sequence` entries, exact row counts, `PRAGMA integrity_check` = `ok`, `PRAGMA foreign_key_check` = `[]`.
8. Cleaned up `drill-tmp` (`Test-Path` = `False`) and verified worktree `git status` clean.

---

## 3. Staging Rehearsal Plan (Staging-Only, Pre-Launch Execution)

### Staging Topology & Role Mapping

| Role | Environment Variables | Example Database Name | Access Level |
| :--- | :--- | :--- | :--- |
| **Source Staging DB** | `TURSO_STAGING_DATABASE_URL`, `TURSO_STAGING_AUTH_TOKEN` | `fchdhgonoi-staging` | **Read-only** (source snapshot / preflight) |
| **Target Restore DB** | `TURSO_STAGING_RESTORE_DATABASE_URL`, `TURSO_STAGING_RESTORE_AUTH_TOKEN` | `fchdhgonoi-staging-restore` | **Read-write** (isolated restore target) |

- Source (`fchdhgonoi-staging`) and target (`fchdhgonoi-staging-restore`) **must be different databases**, and **both must differ from Production**.

### Preconditions
1. Phase 7.1 fixes are merged to `main`.
2. Both the source Staging database (`fchdhgonoi-staging`) and the target restore Staging database (`fchdhgonoi-staging-restore`) exist and have been independently verified.
3. Vercel Preview environment is configured with non-Production secrets only.

### Step 1 — Pre-Flight Verification
1. Verify `TURSO_STAGING_DATABASE_URL` points to `fchdhgonoi-staging` and `TURSO_STAGING_AUTH_TOKEN` is a **read-only** token for that source Staging DB.
2. Verify `TURSO_STAGING_RESTORE_DATABASE_URL` points to `fchdhgonoi-staging-restore` and `TURSO_STAGING_RESTORE_AUTH_TOKEN` is a **read-write** token belonging **only** to the target restore DB.
3. Verify source Staging URL, target restore URL, and Production URL are all distinct, and **no Production credentials** are present in the shell environment.
4. Run non-destructive preflight checks before touching the target database:
   ```bash
   node scripts/db-backup.mjs --env staging --out /tmp/staging-preflight.json --preflight-only
   node scripts/db-restore.mjs --env staging --preflight-only
   ```
5. Confirm `MEDIA_STORAGE_ENABLED=false` and `ANALYTICS_ENABLED=false` on Vercel Preview.

### Step 2 — Synthetic Backup, Decrypt & Staging Restore Drill
1. Generate a synthetic or source-Staging backup (`db-backup.mjs` reads `TURSO_STAGING_DATABASE_URL` + `TURSO_STAGING_AUTH_TOKEN` in read-only mode) and encrypt it using a Staging test X25519 keypair:
   ```bash
   node scripts/db-backup.mjs --env staging --out /tmp/staging-backup.json
   BACKUP_ENCRYPTION_PUBLIC_KEY="gonoi-pub-v1:..." node scripts/backup-crypto.mjs encrypt --in /tmp/staging-backup.json --out /tmp/staging-backup.json.enc
   rm -f /tmp/staging-backup.json
   ```
2. Decrypt the encrypted backup to a **disposable temporary JSON file**:
   ```bash
   BACKUP_DECRYPTION_PRIVATE_KEY="gonoi-priv-v1:..." node scripts/backup-crypto.mjs decrypt --in /tmp/staging-backup.json.enc --out /tmp/staging-decrypted.json
   ```
3. Restore into the isolated Staging restore target (`fchdhgonoi-staging-restore`, via `TURSO_STAGING_RESTORE_DATABASE_URL` + `TURSO_STAGING_RESTORE_AUTH_TOKEN`):
   ```bash
   node scripts/db-restore.mjs --env staging --in /tmp/staging-decrypted.json --confirm
   ```
4. Verify restore integrity:
   - Compare `rowCounts` across all restored tables.
   - Confirm `PRAGMA foreign_key_check` returns zero violations.
   - Reconcile synthetic financial totals (`totalIncome`, `totalExpense`, `currentBalance`, `tournament_fund_reserve`).
5. **Remove the temporary plaintext backup safely** immediately after verification:
   ```bash
   rm -f /tmp/staging-decrypted.json
   ```

### Step 3 — Application & Security Smoke Tests on Vercel Preview
1. Verify `GET /api/health` returns `200` (`status: "ok"`, `db: "connected"`).
2. Verify HTTP security headers (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`) on `/` and `/api/health`.
3. Verify `POST /api/team` as `player` (`set_rsvp`, `update_own_profile`) returns sanitized payload without teammates' `phone`/`username`/`notes` or `pin_code`.
4. Verify `change_own_password` updates PIN and subsequent `GET /api/auth` & `POST /api/team` succeed (`200`, no `401` lockout).
5. Verify negative/float amounts are rejected (`400`) on `add_walkin_player`, `upsert_match`, `update_settings`.
6. Verify `GET /api/export` neutralizes `=`, `+`, `-`, `@` formula prefixes.
7. Verify Guest/Player/Manager UI & real-device PWA checklist (`docs/pwa-real-device-checklist.md`) on iOS Safari & Android Chrome.

### Step 4 — Rollback & Recovery Drill (Preview Only)
1. Identify the previous healthy Vercel Preview deployment via `npx vercel ls`.
2. Execute Vercel Instant Rollback on Preview and re-run `GET /api/health` + guest/auth smoke checks.
3. Record timestamps to validate actual **RTO <= 2 hours**.

### 3.5. Staging Readiness & Migration Concurrency Checklist (`phase7-idempotency-v1.mjs`)
- **Code & Synthetic Pre-Checks (`VERIFIED` locally)**:
  - `scripts/migrations/phase7-idempotency-v1.mjs` accepts **only** `TURSO_STAGING_DATABASE_URL` + `TURSO_STAGING_AUTH_TOKEN` (`role: "source"`), disallows `TURSO_DATABASE_URL` fallback, runs `validateStagingTarget()` before `createClient()`, executes zero writes on `--dry-run`, wraps apply in a transaction, and enforces `realpathSync` symlink safety on `--sqlite`.
- **Authorized Remote Staging Execution Checklist (`BLOCKED` / `NOT VERIFIED` until Owner authorization)**:
  - [ ] Confirm separate `TURSO_STAGING_DATABASE_URL` & `TURSO_STAGING_AUTH_TOKEN` (never Production) and provision a **disposable** `fchdhgonoi-staging-restore` target for restore drills.
  - [ ] Run `node scripts/migrations/phase7-idempotency-v1.mjs --env staging --dry-run` and confirm `applied: false` with expected action plan.
  - [ ] Obtain explicit approval, then run `node scripts/migrations/phase7-idempotency-v1.mjs --env staging` and verify idempotent re-apply (`actions: []`).
  - [ ] Execute real Remote Turso concurrency tests against Staging Preview: 2 concurrent identical `collect_match_fees_batch` requests (single financial + audit write, `X-Idempotent-Replay: true`), 2 concurrent conflicting payloads (`200` + `409`), `SQLITE_BUSY` behavior, and timeout `503 DB_WRITE_OUTCOME_UNKNOWN`.
  - [ ] Complete Preview smoke/rollback (Steps 3–4) and Real-Device QA (`iPhone / Safari`, `Android / Chrome`, including offline/disconnect recovery during fee collection).
  - [ ] Operator & Owner sign-off recorded in `phase-7.2-staging-rehearsal-results.md`.
