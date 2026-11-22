# Phase 7 — Release Go / No-Go Checklist

- **Project**: FC HĐH Gò Nổi tại TP.HCM
- **Target Baseline**: `main` @ `c37dfd3200547210e8c6308b34c44db4fe18c04e` (+ PR #16 `fix/phase-7.1-pre-release-remediation` @ `4d0012a0a958229bc54b59a9cf99ad04079f2ae1` / code HEAD `7f4b35ae62663465d130eb2b6320f01f5b2d43dc`)
- **Current Decision**: **NO-GO** (`P0-01` 3-layer evidence / behavioral enforcement pending; `P1-03` Owner-reported classification complete / containment `RELEASE BLOCKING`; Owner/Operator gates pending; Remote Staging **BLOCKED**; Preview smoke/rollback **NOT VERIFIED**; Real-device QA **NOT VERIFIED** — see [risk-register.md](./risk-register.md) & [phase-7.2-staging-rehearsal-results.md](./phase-7.2-staging-rehearsal-results.md))

---

## 1. Release Gate Criteria

| Gate | Status | Evidence / Notes |
| :--- | :---: | :--- |
| **Main branch protection configuration (`P0-01`)** | **OWNER / OPERATIONAL VERIFICATION PENDING** | **(1) Public Branch API:** `protected=true` independently verified (`branches/main`). **(2) Rulesets API:** Ruleset `27703288` configuration readback independently retrieved (`/protection` endpoint remains `403`). **(3) Behavioral Enforcement:** direct-push rejection & merge blocking have **not** yet been behaviorally verified. |
| **No unresolved P1 findings (or accepted mitigation)** | **FAIL** | `P1-01`–`P1-09` & `F7.1-14`–`F7.1-16` are `CODE REMEDIATED / CI VERIFIED` in PR #16; **`P1-03` classification is `COMPLETE (OWNER-REPORTED)` (`Sensitive data found = YES`, real account used `"1234"`) while `P1-03` containment remains `OPEN / ACTION REQUIRED / RELEASE BLOCKING`**; `P1-10`–`P1-13` (DR/ops sign-off) remain `OWNER / OPERATIONAL VERIFICATION PENDING`. |
| **CI green on `main` & PR #16** | **PASS** | `main` baseline Run `44664470156` on `c37dfd32` (`success`). PR #16 CI evidence: Run [`44983607245`](https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi/actions/runs/44983607245) on `4d0012a0a958229bc54b59a9cf99ad04079f2ae1` (`completed / success` `3/3`: `Quality Gates (Node 22.23.5)`, `Playwright Visual & Accessibility QA (Linux)` `11/11`, `Playwright Visual & Accessibility QA (Windows)` `11/11`; code/test HEAD `7f4b35ae62663465d130eb2b6320f01f5b2d43dc` also passed `3/3` in Run `44900795050`). For dynamic verification of any subsequent docs commit, see [PR #16 Checks](https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi/pull/16/checks). |
| **Synthetic Backup & Restore drill verified** | **PASS** | Local synthetic v3 backup + v3 completeness validation (`backupRestoreV3.test.ts` `5/5`) + X25519 encrypt/decrypt + atomic local SQLite restore + failure injection (`phase72RestoreHardening.test.ts`) + `integrity_check` (`ok`) + `foreign_key_check` (`[]`) passed. Remote Staging remains `BLOCKED`. |
| **Financial & Full Test Suite (Local)** | **PASS** | Local Coding Agent verification on code/test HEAD `7f4b35ae62663465d130eb2b6320f01f5b2d43dc`: Vitest `53/53` files (`419/419` tests passed, incl. `6/6` `financialCalculations.test.ts`); Playwright `11/11` (Linux & Windows via CI Run `44900795050` / `44983607245`); `npm audit --omit=dev` = `0` vulnerabilities (`6` dev-only moderate via `eslint-config-next@15.5.29`). |
| **Production backup scheduled run verified** | **NOT VERIFIED** | Manual `workflow_dispatch` succeeded (`43839671777`); `0` `schedule` runs yet. Cron `0 20 * * 0` UTC chạy kế tiếp vào `2026-11-22 20:00 UTC` (`2026-11-23 03:00 UTC+7`, có thể trễ theo tải GitHub Actions) trên default branch `main` (chưa gồm `Report backup failure alert` của PR #16); lần chạy này chỉ chứng minh backup theo lịch trên `main`, không gộp làm bằng chứng workflow PR #16. |
| **Production Vercel env & Preview separation verified** | **NOT VERIFIED** | External to repo; `OWNER / OPERATIONAL VERIFICATION PENDING`. |
| **Real-device iOS/Android/PWA checklist signed off** | **NOT VERIFIED** | All items in `docs/pwa-real-device-checklist.md` remain `[ ]`; `OWNER / OPERATIONAL VERIFICATION PENDING`. |

---

## 2. Pre-Release Sign-Off Checklist (Required Before Phase 7.1 -> GO)

> **Standardized Classification**:
> - `CODE REMEDIATED / CI VERIFIED`: Source fix + automated tests/build verified locally and in GitHub Actions CI.
> - `OWNER / OPERATIONAL VERIFICATION PENDING`: Requires Owner, Reviewer, or Operator execution/sign-off outside automated CI.
> - `OPEN / NOT REMEDIATED`: Known deferred/open issue tracked for future remediation or cleanup.

### A. Governance & GitHub (`P0-01`, `P2-15`, `P3-07`)
- [x] Verify layered `P0-01` GitHub `main` protection metadata: `(1)` Public Branch API `protected: true` verified; `(2)` Rulesets API `Ruleset 27703288` configuration (`enforcement: active`, `strict: true`, `1` approval, `dismiss_stale_reviews: true`, `required_review_thread_resolution: true`, `3/3` checks) retrieved (`/protection` endpoint remains `403`); `(3)` Behavioral enforcement pending below.
- [ ] **(`OWNER / OPERATIONAL VERIFICATION PENDING` — `P0-01`)** Verify effective PR/merge enforcement without performing a direct push to `main`.
- [ ] **(`OPEN / NOT REMEDIATED` — `P3-07`)** Enable `delete_branch_on_merge` and prune merged phase branches.
- [ ] **(`OWNER / OPERATIONAL VERIFICATION PENDING` — `P2-15`)** Align `package.json` version, Git tag, GitHub Release, and release notes at release time.

### B. Security & Privacy (`P1-01`, `P1-02`, `P1-03`, `P1-04`, `P2-01`–`P2-05`)
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P1-01`)** Fix `POST /api/team` response sanitization for `player` role and strip `pin_code` in `POST /api/team` & `POST /api/import`.
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P1-02`)** Fix `change_own_password` cookie re-issuance to compute `pwdFingerprint` from the new `scrypt$` hash.
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P1-03` runtime/working-tree)** Remove `outputFileTracingIncludes` (`next.config.ts`) and dead `/tmp` copy (`src/lib/db.ts`), and untrack `data/gonoifc.sqlite` from PR #16 (`NFT_SQLITE_COUNT=0`). *(Historical Git blob classification remains `OWNER / OPERATIONAL VERIFICATION PENDING` in Section 2E)*
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P1-04`)** Add `headers()` in `next.config.ts` (`CSP`, `HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`). *(Preview smoke check pending)*
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P2-04`)** Add `Cache-Control: no-store` to `/api/auth`, `/api/webp`, and `POST /api/team`.
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P2-01`, `P2-02`)** Migrate 5 routes from `getAuthSession` to DB-backed `requirePlayerSession` and add `verifyCsrfOrigin` to `POST /api/webp`.
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P2-03` prod deps)** Production audit (`npm audit --omit=dev`) = `0` vulnerabilities (`zod` override `4.6.7`). Full audit = `6 moderate` (`DEV-ONLY`, zero runtime exposure).
- [ ] **(`OWNER / OPERATIONAL VERIFICATION PENDING` — `P2-03` dev deps)** Owner acceptance: `PENDING` for the `6 moderate` `DEV-ONLY` advisories (`minimatch` `GHSA-g3hv-75wg-m249` + 5 `@typescript-eslint/*` via `eslint-config-next@15.5.29`, `0` runtime exposure) until explicit Owner approval evidence exists.

### C. Financial & Data Integrity (`P1-05`, `P1-06`, `P2-08`–`P2-10`, `P3-04`)
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P1-05`)** Enforce `parseNonNegativeIntVnd` in `add_walkin_player`, `upsert_match`, `update_settings` and validate `match_id` existence.
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P1-06`)** Sanitize Excel formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) in `GET /api/export`.
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P2-08`)** Wrap `upsert_match`, `delete_match`, `add_walkin_player` in `db.transaction(...)` and enforce atomic audit logging.
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P2-09`, `P2-10`)** Reconcile `categoryBreakdown`, `calculateMatchStats` vs `buildEnrichedMatches`, `YYYY-MM-DD` date validation, and `sponsor_id` Excel round-trip.
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P3-04` / `F7.1-15` client, API & local/E2E tests)** Live Chromium browser recovery test (`tests/e2e/collection-recovery.spec.ts`) verifies `CollectionTab` UI state, persistence/recovery behavior, exact outgoing idempotency payload/key, reconciliation warning, and fail-closed behavior under corrupted/quota `localStorage`. The `POST` request is intercepted by Playwright; therefore, this test does not prove Remote Turso execution or real database concurrency. Remote Turso replay/concurrency remains `NOT VERIFIED` pending authorized Staging rehearsal (`phase7-idempotency-v1.mjs` must be applied to Staging/Production target before release).

### D. Reliability, Performance & UX (`P1-07`–`P1-09`, `P2-11`–`P2-13`, `P3-02`, `P3-05`)
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P1-07`)** Add `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`.
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P1-08`, `P3-05`)** Add bounded timeout/retry to `TursoDbAdapter` and fix `/api/health` `503` status when `!dbStatus.ok`.
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P1-09`, `F7.1-14`, `F7.1-16`, `P3-02`)** Split `getFullAppData()` for `/api/public/financial-report`, add deterministic `ensureReady()`, and replace `"1234"` defaults with `scrypt$` hashing & strong PIN UI (`New PIN` + `Confirm new PIN`).
- [ ] **(`OWNER / OPERATIONAL VERIFICATION PENDING` — `P2-12`)** Complete real-device testing (`docs/pwa-real-device-checklist.md`) on iOS Safari & Android Chrome.

### E. Operations, DR, Staging & Open Tracking (`P1-10`–`P1-13`, `P2-14`, `P3-03`, `P3-08`, `P3-09`)
- [x] **(`CODE REMEDIATED / CI VERIFIED` — `P1-10`–`P1-13` docs, `P3-06`)** Document RPO/RTO targets, DR workflows, SEV1–SEV4 tiers, PIR process, credential-exposure playbook, and schema rollback policy in `docs/operations-runbook.md`; pin Node `22.23.5` and `upload-artifact` SHA in `turso-backup.yml`.
- [ ] **(`OWNER / OPERATIONAL VERIFICATION PENDING` — `P1-10`–`P1-13`)** Owner signs off on RPO/RTO targets, Primary/Backup DR Owners, and escalation contacts.
- [ ] **(`OWNER / OPERATIONAL VERIFICATION PENDING` — `P2-14`)** `ci.yml` `e2e-visual-qa` now enforces `needs: quality-gates`; `playwright.config.ts` intentionally retains `next dev` (`NODE_ENV=development`) for synthetic SQLite QA because `src/lib/db.ts` forbids `USE_LOCAL_SQLITE=true` in `NODE_ENV=production` (verified locally via `next start` test). `turso-backup.yml` on PR #16 adds `Report backup failure alert` (`::error::` + `$GITHUB_STEP_SUMMARY`); because PR #16 is unmerged, the `2026-11-22 20:00 UTC` (`2026-11-23 03:00 UTC+7`) `schedule` run uses `main` (without this alert step). Owner/Ops confirmation of external notification receipt remains pending.
- [ ] **(`OWNER / OPERATIONAL VERIFICATION PENDING` — `P1-03`, RELEASE BLOCKING)** **Classification (`COMPLETE / OWNER-REPORTED`)**: Owner confirmed historical blob `67f415fac8aaf1e80b22c356d01fa1f782083a03` contained **real PII, Financial, Authentication, and Operational data** and a **real account used default PIN `"1234"`** (`Sensitive data found = YES`; unauthorized access/compromise not yet established). **Containment (`OPEN / ACTION REQUIRED`)**: execute Owner-approved scoped PIN resets, rotate the effective Production auth secret per `getAuthSecret()` (`APP_SECRET` > `AUTH_SECRET` > `NEXTAUTH_SECRET` > `SESSION_SECRET`) with coordinated redeploy, verify `401` old-cookie rejection on protected endpoints, complete out-of-band Manager reauthentication, and record clone/fork + Git history decision.
- [ ] **(`BLOCKED` — Staging / Preview / Real-Device QA)** Remote Staging rehearsal (`phase7-idempotency-v1.mjs`, Turso concurrency, DR) is `BLOCKED` (`TURSO_STAGING_*=ABSENT`); Vercel Preview smoke/rollback is `BLOCKED` (Preview URL returns `302` Vercel Authentication and Preview/Production DB separation is unverified); Real-device QA (`docs/pwa-real-device-checklist.md`) is `NOT VERIFIED` (no physical iOS/Android devices).
- [ ] **(`OWNER / OPERATIONAL VERIFICATION PENDING`)** Owner confirms Vercel Production env vars (`TURSO_*`, effective auth secret `APP_SECRET` > `AUTH_SECRET` > `NEXTAUTH_SECRET` > `SESSION_SECRET`, `UPSTASH_REDIS_*`, `CRON_SECRET`, `MEDIA_STORAGE_ENABLED=false`, `ANALYTICS_ENABLED=false`) are distinct from Preview (where `PREVIEW_AUTH_SECRET` takes #1 priority) and offline backup private key custody (2 copies) is verified.
- [ ] **(`OPEN / NOT REMEDIATED` — `P3-03`, `P3-08`, `P3-09`)** Tracked open items for post-gate/follow-up cleanup: `P3-03` (consolidate DDL & gate `birth_year` backfill), `P3-08` (`POST /api/team` explicit body size cap & null/non-object `payload` guard), `P3-09` (`paid === 1 && amount === 0` draft display, legacy 5-sheet year inference, float jersey check).

---

## 3. Required Approvals for Final Release Sign-Off

| Role | Scope | Sign-Off Status |
| :--- | :--- | :---: |
| **Repository / Club Owner** | Branch protection, Vercel Production env separation, RPO/RTO acceptance, DR key custody | **PENDING** |
| **Tech Lead / Security** | Phase 7.1 P0/P1 fixes verified via CI + regression tests | **PENDING** |
| **QA / Operations** | Staging rehearsal passed + `docs/pwa-real-device-checklist.md` completed | **PENDING** |
