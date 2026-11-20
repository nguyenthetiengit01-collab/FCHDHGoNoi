# Phase 7 — Disaster Recovery Assessment & Staging Rehearsal Plan

- **Baseline**: `main` @ `fd1b150c94c54f16b0f0888aa57de3c3cb4c1ea7`
- **Last Local Synthetic Drill**: 2026-11-20 (**PASSED** in isolated temp directory)

---

## 1. Disaster Recovery (DR) Assessment

| DR Dimension | Current Verified State | Gap / Risk | Recommended Target (For Owner Approval) |
| :--- | :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | `NOT DOCUMENTED` (effective RPO from weekly workflow = **up to 7 days**; Turso PITR not documented) | `P1-12` — Up to 7 days of match/finance data at risk | **7 days** (if weekly CI remains) or **<= 24 hours** (enable daily backup schedule or verify Turso PITR) |
| **RTO (Recovery Time Objective)** | `NOT DOCUMENTED` | `P1-12` — No SLA for manual Turso provisioning + restore + Vercel redeploy | **<= 2 hours** for full manual recovery per `docs/operations-runbook.md` Section 3 |
| **Backup Interval** | Weekly (`0 20 * * 0` UTC) + `workflow_dispatch` | `0` `schedule` runs yet (1st due `2026-11-22`); no failure alert (`P2-14`) | Verify `2026-11-22` run; add failure alert; consider daily cron |
| **Artifact Retention** | `30 days` on GitHub Actions | Single-vendor (GitHub) unless manually downloaded | Retain `30 days` in GH + automated or monthly verified off-GitHub copy |
| **Private Key Custody** | Policy in Runbook (`lines 35, 55-56`): 2 offline copies, never in GH | Actual custody `NOT VERIFIED` | Owner confirms 2-copy custody before launch |
| **Key Rotation** | `keyId` tracked in `.enc` envelope; keep old key >= 30 days | Sound design | Rotate annually or immediately on suspected exposure |
| **Restore Drill Frequency** | `NOT DOCUMENTED` | Ad-hoc only | **Quarterly** Staging restore drill + pre-major-migration drill |
| **Recovery Command Gap** | Runbook Section 3 Step 3 references `turso db shell` / client; `db-restore.mjs` only allows `fchdhgonoi-staging-restore` or local SQLite | Cannot run `db-restore.mjs` directly against a newly provisioned recovery DB | Document exact `sqlite3 ... .dump` / Turso CLI push command or add `--env recovery` preflight |
| **Operational Ownership** | `NOT DOCUMENTED` (generic "Chủ sở hữu" / "Ban Quản Lý") | Unclear escalation during outage | Assign Primary & Backup DR Owners + contact channels |

---

## 2. Local Synthetic Restore Drill Evidence (2026-11-20)

Executed by Agent C in disposable `D:\Test1\_phase7-audit-evidence\drill-tmp\` (Node `v24.12.0`, zero Production/Staging credentials):
1. Initialized 9 core tables with `PRAGMA foreign_keys = ON;` and synthetic records.
2. Executed `scripts/migrations/phase4-analytics-v1.mjs` twice -> confirmed idempotency (`insertedBaselines: 0` on run 2).
3. Generated v3 backup via `scripts/db-backup.mjs` (`14` tables, `9` indexes, `8` sequences).
4. Generated ephemeral X25519 keypair, encrypted and decrypted via `scripts/backup-crypto.mjs` (`X25519-HKDF-SHA256-AES-256-GCM`, exit `0`).
5. Validated payload via `validateBackupPayload()` (`valid: true`).
6. Restored into a second disposable SQLite file via `scripts/db-restore.mjs --confirm`.
7. Verified parity: `14/14` tables, `9/9` indexes, `8/8` `sqlite_sequence` entries, exact row counts, `PRAGMA integrity_check` = `ok`, `PRAGMA foreign_key_check` = `[]`.
8. Cleaned up `drill-tmp` (`Test-Path` = `False`) and verified worktree `git status` clean.

---

## 3. Staging Rehearsal Plan (Pre-Launch Execution)

**Preconditions**: Phase 7.1 fixes merged to `main`; Staging Turso DB (`fchdhgonoi-staging-restore`) and Vercel Preview environment configured with non-Production secrets.

### Step 1 — Pre-Flight & Baseline Snapshot
1. Confirm `TURSO_STAGING_DATABASE_URL` points strictly to `fchdhgonoi-staging-restore` (never Production).
2. Confirm `MEDIA_STORAGE_ENABLED=false` and `ANALYTICS_ENABLED=false` on Preview (unless explicitly testing flag-on scenarios).

### Step 2 — Synthetic Data Backup & Restore Drill on Staging
1. Seed synthetic dataset into a disposable local SQLite file (never `data/gonoifc.sqlite`).
2. Generate encrypted v3 backup (`scripts/db-backup.mjs` + `scripts/backup-crypto.mjs`) using a Staging test X25519 keypair.
3. Decrypt and execute `node scripts/db-restore.mjs --env staging --input <backup.json> --confirm`.
4. Verify `rowCounts`, `PRAGMA foreign_key_check`, and financial summary totals (`totalIncome`, `totalExpense`, `currentBalance`, `tournament_fund_reserve`).

### Step 3 — Application & Security Smoke Tests on Vercel Preview
1. Verify `GET /api/health` returns `200` (`status: "ok"`, `db: "connected"`).
2. Verify HTTP security headers (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`) on `/` and `/api/health`.
3. Verify `POST /api/team` as `player` (`set_rsvp`, `update_own_profile`) returns sanitized payload without teammates' `phone`/`username`/`notes` or `pin_code`.
4. Verify `change_own_password` updates PIN and subsequent `GET /api/auth` & `POST /api/team` succeed (`200`, no `401` lockout).
5. Verify negative/float amounts are rejected (`400`) on `add_walkin_player`, `upsert_match`, `update_settings`.
6. Verify `GET /api/export` neutralizes `=`, `+`, `-`, `@` formula prefixes.
7. Verify Guest/Player/Manager UI & real-device PWA checklist (`docs/pwa-real-device-checklist.md`) on iOS Safari & Android Chrome.

### Step 4 — Rollback & Recovery Drill
1. Trigger a simulated bad Preview deployment or inspect `vercel ls` to identify the previous healthy Preview deployment.
2. Execute Vercel Instant Rollback on Preview and re-run `GET /api/health` + guest/auth smoke checks.
3. Record timestamps to validate actual **RTO <= 2 hours**.
