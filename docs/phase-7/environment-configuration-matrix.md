# Phase 7 — Environment Configuration Matrix

- **Baseline**: `main` @ `fd1b150c94c54f16b0f0888aa57de3c3cb4c1ea7`
- **Safety Note**: Variable names, scopes, and code constraints only. No secret values are stored or printed.

---

## 1. Environment Variable Matrix

| Variable Name | Local Dev | Test / E2E CI | Vercel Preview | Vercel Production | GitHub Actions (`turso-backup.yml`) | Ops CLI / Scripts | Owner / Access Level / Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `TURSO_DATABASE_URL` | Optional | Not used (`USE_LOCAL_SQLITE`) | **Required** (Staging URL) | **Required** (Prod URL) | Not used | Preflight conflict check | Vercel Env; mandatory when `NODE_ENV=production` or `VERCEL` set (`src/lib/db.ts:111-126`). |
| `TURSO_AUTH_TOKEN` | Optional | Not used | **Required** (Staging RW) | **Required** (Prod RW) | Not used | Not used | Vercel Env; must be separate between Preview & Prod (`src/lib/db.ts:128-132`). |
| `AUTH_SECRET` | Optional (dev fallback) | Optional / Test secret | **Required** (>=32 chars) | **Required** (>=32 chars) | Not used | Not used | Vercel Env; fail-closed `503` in Prod/Preview (`src/lib/auth.ts:58-92`). |
| `PREVIEW_AUTH_SECRET` | Not used | Not used | Optional (overrides `AUTH_SECRET`) | Do not set | Not used | Not used | Vercel Preview Env (**Undocumented** in `docs/`). |
| `APP_SECRET` / `NEXTAUTH_SECRET` / `SESSION_SECRET` | Fallback alias | Fallback alias | Fallback alias | Fallback alias | Not used | Not used | Legacy fallback aliases in `src/lib/auth.ts:65-71` (**Undocumented**). |
| `UPSTASH_REDIS_REST_URL` | Optional | Optional | **Required** | **Required** | Not used | Not used | Vercel Env; auth rate-limit fails closed `503` if missing in Prod/Preview (`src/lib/authRateLimit.ts:79-93`). |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Optional | **Required** | **Required** | Not used | Not used | Vercel Env; paired with `UPSTASH_REDIS_REST_URL`. |
| `MEDIA_STORAGE_ENABLED` | `"false"` (default) | `"false"` | `"false"` (default) | **`"false"`** (preserved) | Not used | Not used | Feature flag (`src/lib/media/validation.ts:16-20`). |
| `BLOB_READ_WRITE_TOKEN` | Optional | Not used | Required if `MEDIA_STORAGE_ENABLED=true` | Required if `MEDIA_STORAGE_ENABLED=true` | Not used | Conflict check (`migrate-legacy-media.mjs`) | Vercel Env (`src/lib/media/storage.ts:166-176`). |
| `ANALYTICS_ENABLED` | `"false"` (default) | `"false"` | `"false"` (default) | **`"false"`** (preserved) | Not used | Not used | Feature flag (`src/lib/analytics/config.ts:6-8`). |
| `ANALYTICS_ACTOR_SECRET` | Optional | Optional | Required if `ANALYTICS_ENABLED=true` | Required if `ANALYTICS_ENABLED=true` | Not used | Not used | Vercel Env (>=32 chars; fail-closed `503` when enabled). |
| `CRON_SECRET` | Optional | Not used | Not used (`VERCEL_ENV !== "production"`) | **Required** (>=16 chars) | Not used | Not used | Vercel Prod Env; protects `/api/cron/analytics-cleanup` (`route.ts:47-60`). |
| `VERCEL` / `VERCEL_ENV` | Unset | Unset | Platform-injected (`preview`) | Platform-injected (`production`) | Unset | Guard check (`migrate-legacy-media.mjs`) | Vercel platform-injected; gates strictness & cron. |
| `USE_LOCAL_SQLITE` | Optional (`"true"`) | **`"true"`** | **Forbidden** | **Forbidden** | Not used | Not used | Throws if `"true"` in `production` or `VERCEL` (`src/lib/db.ts:37-57`). |
| `SQLITE_DB_PATH` | Optional | **Required** (with `USE_LOCAL_SQLITE`) | **Forbidden** | **Forbidden** | Not used | Not used | Absolute path outside repo, never `data/gonoifc.sqlite` (`src/lib/db.ts:59-96`). |
| `QA_ROOT` / `QA_SCREENSHOT_DIR` | Optional | Set in `ci.yml` | Not used | Not used | Not used | Not used | E2E isolated artifact/DB root (`tests/e2e/qaPaths.ts:8-23`). `QA_SCREENSHOT_DIR` **undocumented**. |
| `PLAYWRIGHT_PORT` / `PLAYWRIGHT_CHANNEL` | Optional | Optional (`3105`) | Not used | Not used | Not used | Not used | `playwright.config.ts:12,18` (**Undocumented**). |
| `TURSO_PROD_DATABASE_URL` | Never | Never | Never | Never | **Required** | Not used | GitHub Actions Secret (`turso-backup.yml:38`). |
| `TURSO_PROD_AUTH_TOKEN_RO` | Never | Never | Never | Never | **Required** (Read-Only) | Not used | GitHub Actions Secret (`turso-backup.yml:39`). |
| `TURSO_BACKUP_PUBLIC_KEY` | Never | Never | Never | Never | **Required** (Public key only) | Not used | GitHub Actions Secret (`turso-backup.yml:40`). Private key stays offline. |
| `TURSO_STAGING_DATABASE_URL` | Never | Never | Never | Never | Never | **Required** (Staging Source) | Ops Owner; Source Staging DB (e.g. `fchdhgonoi-staging`). Consumed by `scripts/db-backup.mjs`, `scripts/migrations/phase4-analytics-v1.mjs`, `scripts/analytics-cleanup.mjs`, and `scripts/db-restore.mjs` (conflict check). |
| `TURSO_STAGING_AUTH_TOKEN` | Never | Never | Never | Never | Never | **Required** (**Read-Only** for `db-backup.mjs`; RW only for Staging migrations/cleanup) | Ops Owner; Source Staging token. Must belong to `fchdhgonoi-staging` and remain distinct from restore/Prod tokens. |
| `TURSO_STAGING_RESTORE_DATABASE_URL` | Never | Never | Never | Never | Never | **Required** (Staging Restore Target) | Ops Owner; Isolated restore target DB (`fchdhgonoi-staging-restore`). Consumed by `scripts/db-restore.mjs --env staging` (and `scripts/analytics-cleanup.mjs` conflict check). |
| `TURSO_STAGING_RESTORE_AUTH_TOKEN` | Never | Never | Never | Never | Never | **Required** (**Read-Write** on restore target only) | Ops Owner; Target restore DB token. Consumed by `scripts/db-restore.mjs --env staging`. |
| `BACKUP_ENCRYPTION_PUBLIC_KEY` | Never | Never | Never | Never | Never | **Required** for `encrypt` | Ops CLI (`scripts/backup-crypto.mjs encrypt`). |
| `BACKUP_DECRYPTION_PRIVATE_KEY` | Never | Never | Never | Never | Never | **Required** for `decrypt` (or `--private-key-file`) | Offline Ops CLI only (`scripts/backup-crypto.mjs decrypt`). **Undocumented** in `docs/` matrix. |
| `MIGRATION_BLOB_READ_WRITE_TOKEN` | Never | Never | Never | Never | Never | **Required** for `--write` | Non-production Blob migration token (`scripts/migrations/migrate-legacy-media.mjs`). **Undocumented** in `docs/` matrix. |

---

## 2. Documentation & Scope Hygiene Recommendations

1. Document `PREVIEW_AUTH_SECRET`, `QA_SCREENSHOT_DIR`, `PLAYWRIGHT_PORT`, `PLAYWRIGHT_CHANNEL`, `BACKUP_DECRYPTION_PRIVATE_KEY`, and `MIGRATION_BLOB_READ_WRITE_TOKEN` in `docs/operations/ci-cd.md` or `docs/operations-runbook.md`.
2. Verify in Vercel Dashboard (Owner action) that Preview and Production never share `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, `UPSTASH_REDIS_*`, or `BLOB_READ_WRITE_TOKEN`.
