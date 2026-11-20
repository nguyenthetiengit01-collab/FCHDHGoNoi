# Phase 7 — Release Go / No-Go Checklist

- **Project**: FC HĐH Gò Nổi tại TP.HCM
- **Target Baseline**: `main` @ `c37dfd3200547210e8c6308b34c44db4fe18c04e` (+ Phase 7.1 `fix/phase-7.1-pre-release-remediation`)
- **Current Decision**: **NO-GO** (`P0-01` configuration verified / enforcement behavior verification pending; P1 owner/Preview sign-off pending; Remote Staging **BLOCKED**; Preview smoke/rollback **NOT VERIFIED**; Real-device QA **NOT VERIFIED** — see [phase-7.2-staging-rehearsal-results.md](./phase-7.2-staging-rehearsal-results.md))

---

## 1. Release Gate Criteria

| Gate | Status | Evidence / Notes |
| :--- | :---: | :--- |
| **Main branch protection configuration (`P0-01`)** | **CONFIGURATION PASS** | Ruleset `27703288` (`main`) is `active`; `branches/main` `protected: true`; 3/3 required checks (`Quality Gates (Node 22.23.5)`, `Playwright Visual & Accessibility QA (Linux)`, `Playwright Visual & Accessibility QA (Windows)`). **Full closure**: `PENDING FINAL ENFORCEMENT VERIFICATION`. |
| **No unresolved P1 findings (or accepted mitigation)** | **FAIL** | P1 code/docs remediated in PR #16 (`8153da1d`), pending Preview/Owner sign-off. |
| **Post-merge CI green on `main`** | **PASS** | Run `44664470156` on `c37dfd32` (and PR #16 Run `44675008948` on `8153da1d`): `Quality Gates`, Playwright Linux & Windows all `success`. |
| **Synthetic Backup & Restore drill verified** | **PASS** | Local synthetic v3 backup + X25519 encrypt/decrypt + atomic local restore + failure injection (`phase72RestoreHardening.test.ts`) + `integrity_check` (`ok`) + `foreign_key_check` (`[]`) passed. |
| **Financial unit tests (`financialCalculations.test.ts`)** | **PASS** | `6/6` tests passed (`46/46` files, `370/370` tests total in Vitest). |
| **Production backup scheduled run verified** | **NOT VERIFIED** | Manual `workflow_dispatch` succeeded (`43839671777`); `0` `schedule` runs yet (first Sunday `2026-11-22`). |
| **Production Vercel env & Preview separation verified** | **NOT VERIFIED** | External to repo; requires Owner Dashboard verification. |
| **Real-device iOS/Android/PWA checklist signed off** | **NOT VERIFIED** | All items in `docs/pwa-real-device-checklist.md` are `[ ]`. |

---

## 2. Pre-Release Sign-Off Checklist (Required Before Phase 7.1 -> GO)

### A. Governance & GitHub (`P0-01`, `P2-15`, `P3-07`)
- [x] Configure GitHub `main` Ruleset (`ID: 27703288`) and independently verify all three required checks (`Quality Gates (Node 22.23.5)`, `Playwright Visual & Accessibility QA (Linux)`, `Playwright Visual & Accessibility QA (Windows)`) through GitHub API (`protected: true`, `enforcement: active`).
- [ ] Verify effective PR/merge enforcement without performing a direct push to `main`.
- [ ] Enable `delete_branch_on_merge` and prune merged phase branches.
- [ ] Align `package.json` version, Git tag, GitHub Release, and release notes.

### B. Security & Privacy (`P1-01`, `P1-02`, `P1-03`, `P1-04`, `P2-01`–`P2-05`)
- [ ] Fix `POST /api/team` response sanitization for `player` role and strip `pin_code` in `POST /api/team` & `POST /api/import`.
- [ ] Fix `change_own_password` cookie re-issuance to compute `pwdFingerprint` from the new `scrypt$` hash.
- [ ] Remove `outputFileTracingIncludes` (`next.config.ts`) and dead `/tmp` copy (`src/lib/db.ts`), and untrack `data/gonoifc.sqlite` from Git (verify whether Git history scrub / PIN rotation is needed).
- [ ] Add `headers()` in `next.config.ts` (`CSP`, `HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- [ ] Add `Cache-Control: no-store` to `/api/auth`, `/api/webp`, and `POST /api/team`.
- [ ] Migrate 5 routes from `getAuthSession` to DB-backed `requirePlayerSession` and add `verifyCsrfOrigin` to `POST /api/webp`.
- [ ] Triage/upgrade `@vercel/blob` / `zod >=4.6.6` (`npm audit --omit=dev`).

### C. Financial & Data Integrity (`P1-05`, `P1-06`, `P2-08`–`P2-10`)
- [ ] Enforce `parseNonNegativeIntVnd` in `add_walkin_player`, `upsert_match`, `update_settings` and validate `match_id` existence.
- [ ] Sanitize Excel formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) in `GET /api/export`.
- [ ] Wrap `upsert_match`, `delete_match`, `add_walkin_player` in `db.transaction(...)`.
- [ ] Reconcile `categoryBreakdown`, `calculateMatchStats` vs `buildEnrichedMatches`, `YYYY-MM-DD` date validation, and `sponsor_id` Excel round-trip.

### D. Reliability, Performance & UX (`P1-07`–`P1-09`, `P2-11`–`P2-13`)
- [ ] Add `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`.
- [ ] Add bounded timeout/retry to `TursoDbAdapter` and fix `/api/health` non-200 status when `!dbStatus.ok`.
- [ ] Split `getFullAppData()` for `/api/public/financial-report` and batch `save_match`/`save_player` writes.
- [ ] Complete real-device testing (`docs/pwa-real-device-checklist.md`) on iOS Safari & Android Chrome.

### E. Operations, DR & Staging (`P1-10`–`P1-13`, `P2-14`)
- [ ] Document RPO, RTO, restore drill cadence, DR owners, SEV1–SEV4 tiers, communication template, PIR process, credential-exposure playbook, and core schema rollback policy in `docs/operations-runbook.md`.
- [ ] Add failure notification to `.github/workflows/turso-backup.yml` and confirm first scheduled run (`2026-11-22`).
- [ ] **P1-03 Historical Public Git Exposure Classification**: Remains **HISTORICAL EXPOSURE CLASSIFICATION PENDING OWNER** — Owner inspects `git show c37dfd32:data/gonoifc.sqlite` offline (without printing PII/PINs) to classify whether blob `67f415fac8aaf1e80b22c356d01fa1f782083a03` contained real PII/credentials and executes incident response if needed.
- [ ] **Batch Fee Idempotency (`P3-04` / `F7.1-15`)**: Code & local/mocked tests **VERIFIED** (7-field durable operation record, `dirtyCount === 0` converged `"Đối chiếu / Thử lại"` recovery, storage read-back/quota/corrupt guards, required `Idempotency-Key`, Option B replay, Turso overlapping tx & audit rollback mocks, zero-write `--dry-run`, symlink guard); real Remote Staging Turso concurrency remains `NOT VERIFIED`, and `phase7-idempotency-v1.mjs` must be applied to Staging/Production target before release.
- [ ] Execute Staging Rehearsal Plan (`docs/phase-7/disaster-recovery-and-staging-rehearsal.md`) and record evidence.
- [ ] Owner confirms Vercel Production env vars (`TURSO_*`, `AUTH_SECRET`, `UPSTASH_REDIS_*`, `CRON_SECRET`, `MEDIA_STORAGE_ENABLED=false`, `ANALYTICS_ENABLED=false`) are distinct from Preview and offline backup private key custody is verified.

---

## 3. Required Approvals for Final Release Sign-Off

| Role | Scope | Sign-Off Status |
| :--- | :--- | :---: |
| **Repository / Club Owner** | Branch protection, Vercel Production env separation, RPO/RTO acceptance, DR key custody | **PENDING** |
| **Tech Lead / Security** | Phase 7.1 P0/P1 fixes verified via CI + regression tests | **PENDING** |
| **QA / Operations** | Staging rehearsal passed + `docs/pwa-real-device-checklist.md` completed | **PENDING** |
