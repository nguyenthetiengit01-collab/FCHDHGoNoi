# Phase 7.1 — Pre-Release Remediation & Governance Hardening Record

- **Feature Branch**: `fix/phase-7.1-pre-release-remediation`
- **Base `main` SHA**: `c37dfd3200547210e8c6308b34c44db4fe18c04e` (PR #15 merge commit)
- **Date**: 2026-11-20
- **Release Decision**: **NO-GO** (`P0-01` Branch Protection on `main` remains **OPEN** pending Owner configuration; PR #16 created as **DRAFT**)

---

## 1. Agent Workstream Commits

| Agent | Workstream | Branch | Commit SHA |
| :---: | :--- | :--- | :--- |
| **A** | Auth, RBAC & Privacy | `agent/phase-71-auth-privacy` | `1539d5ba58b9d7ceb649663cf7d0769196cef438` |
| **B** | Database Exposure & Turso Reliability | `agent/phase-71-database-runtime` | `fd38939c94d9cdaee7ecb2cf6c4e15e5dd098bfd` |
| **C** | Financial Validation & Excel Security | `agent/phase-71-finance-excel` | `071f6e81801e337d6477b599fa90dc02cbaaccd9` |
| **D** | HTTP Security & App Reliability | `agent/phase-71-http-reliability` | `85eeecba581e2f9551bf352d4debd0e0d2219475` |
| **E** | Supply Chain & CI Security | `agent/phase-71-dependency-ci` | `67524a691f875ae51285032267a354a6d79bae2e` |
| **F** | Operations, DR & Incident Governance | `agent/phase-71-operations-dr` | `1e0b38a151f649c933ee7adb517d7a0ef319d4e8` |

---

## 2. Finding Closure Matrix (P0, P1 & Pulled-Forward P2/P3)

| ID | Severity | Commit | File Paths | Verification & Tests | Status | Residual Risk |
| :--- | :---: | :--- | :--- | :--- | :---: | :--- |
| **P0-01** | **P0** | `1e0b38a` | `docs/phase-7/branch-protection-owner-setup.md` | GitHub API `/branches/main` still `protected: False` | **OPEN (Owner Action)** | `main` unprotected until owner applies UI checklist. |
| **P1-01** | **P1** | `1539d5b` | `src/lib/auth.ts`, `src/app/api/team/route.ts`, `src/app/api/import/route.ts`, `src/app/api/auth/route.ts` | `phase71AuthPrivacy.test.ts` (5/5) + `teamStatistics.test.ts` | **CODE & TEST VERIFIED** | Pending Preview smoke test. |
| **P1-02** | **P1** | `1539d5b` | `src/app/api/team/route.ts` (`change_own_password`) | `phase71AuthPrivacy.test.ts` (full login -> change -> next request) | **CODE & TEST VERIFIED** | None after test pass. |
| **P1-03** | **P1** | `fd38939` | `next.config.ts`, `src/lib/db.ts`, `.gitignore` (`git rm --cached data/gonoifc.sqlite`) | `next build` `.nft.json` trace count = `0`; `phase71DatabaseTurso.test.ts` | **CODE & BUILD VERIFIED** | Old Git history still holds prior snapshots; owner must confirm whether history scrub/PIN rotation is needed. |
| **P1-04** | **P1** | `85eeecb` | `next.config.ts` (`headers()`) | `phase71HttpReliability.test.ts` (6/6) + `next build` | **CODE & TEST VERIFIED** | Enforced CSP should be smoke-tested on Vercel Preview. |
| **P1-05** | **P1** | `071f6e8` | `src/lib/financeValidation.ts`, `src/app/api/team/route.ts` | `phase71FinanceExcel.test.ts` (6/6) + `financialCalculations.test.ts` (6/6) | **CODE & TEST VERIFIED** | Explicit `0` preserved; negative/float/`NaN` rejected `400`. |
| **P1-06** | **P1** | `071f6e8` | `src/lib/excelSanitize.ts`, `src/app/api/export/route.ts` | `phase71FinanceExcel.test.ts` + `excelSecurityHardening.test.ts` | **CODE & TEST VERIFIED** | None in exported text cells. |
| **P1-07** | **P1** | `85eeecb` | `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx` | `phase71HttpReliability.test.ts` + `next build` | **CODE & BUILD VERIFIED** | Visual check on Preview recommended. |
| **P1-08** | **P1** | `fd38939` | `src/lib/db.ts` (`TursoDbAdapter` timeout + read-only retry) | `phase71DatabaseTurso.test.ts` (8/8) | **CODE & TEST VERIFIED** | Live Turso latency behavior unverified without Staging/Prod. |
| **P1-09** | **P1** | `fd38939` | `src/lib/db.ts`, `src/lib/publicFinancialReport.ts`, `src/app/api/public/financial-report/route.ts` | `phase71DatabaseTurso.test.ts` + `publicFinancialReport.test.ts` (7/7) | **CODE & TEST VERIFIED** | `getFullAppData()` still serves authenticated `/api/team` (now projected without `SELECT *`). |
| **P1-10** | **P1** | `1e0b38a` | `docs/operations-runbook.md` (Credential Exposure Playbook) | Documentation review | **DOCS VERIFIED** | Operational execution requires owner tabletop/drill. |
| **P1-11** | **P1** | `1e0b38a` | `docs/operations-runbook.md` (Schema Compatibility & Rollback) | Documentation review | **DOCS VERIFIED** | Expand/contract discipline required on future PRs. |
| **P1-12** | **P1** | `1e0b38a` | `docs/operations-runbook.md` (RPO/RTO, DR Ownership, Recovery Workflows) | Documentation review | **DOCS VERIFIED (Targets Proposed)** | RPO/RTO & named DR Owner remain `TBD` pending Owner approval; 1st `schedule` backup due `2026-11-22`. |
| **P1-13** | **P1** | `1e0b38a` | `docs/operations-runbook.md` (SEV1–SEV4 & PIR Template) | Documentation review | **DOCS VERIFIED** | Requires owner sign-off on escalation contacts. |
| **P2-01** | **P2** | `1539d5b`, `85eeecb` | `/api/team`, `/api/webp`, `/api/analytics`, `/api/media/upload`, `/api/media/client-upload` | `phase71AuthPrivacy.test.ts`, `phase71HttpReliability.test.ts`, `workstreamB.test.ts` | **CODE & TEST VERIFIED** | Revoked/inactive sessions rejected immediately. |
| **P2-02** | **P2** | `85eeecb` | `src/app/api/webp/route.ts` (`verifyCsrfOrigin`) | `phase71HttpReliability.test.ts` | **CODE & TEST VERIFIED** | None. |
| **P2-03** | **P2** | `67524a6` | `package.json`, `package-lock.json` (`zod` override `^4.6.6` -> `4.6.7`) | `npm audit --omit=dev` = `0 vulnerabilities` | **VERIFIED** | Re-check when `@vercel/blob` updates upstream. |
| **P2-04** | **P2** | `1539d5b`, `85eeecb` | `/api/auth`, `/api/webp`, `POST /api/team` (`Cache-Control: no-store`) | `phase71HttpReliability.test.ts` | **CODE & TEST VERIFIED** | None. |
| **P2-06** | **P2** | `fd38939` | `src/lib/db.ts` (`PRAGMA foreign_keys = ON` on Turso init) | `phase71DatabaseTurso.test.ts` | **CODE & TEST VERIFIED** | None. |
| **P2-14** | **P2** | `67524a6`, `1e0b38a` | `.github/workflows/turso-backup.yml`, `docs/operations-runbook.md` | Workflow YAML review + docs review | **PARTIAL** | CI E2E `next dev` & missing `needs: quality-gates` remain open. |
| **P3-05** | **P3** | `85eeecb` | `src/app/api/health/route.ts` (`!dbStatus.ok` -> `503`) | `phase71HttpReliability.test.ts` | **CODE & TEST VERIFIED** | None. |
| **P3-06** | **P3** | `67524a6` | `.github/workflows/turso-backup.yml` (Node `22.23.5`, `upload-artifact` SHA) | Workflow YAML review | **VERIFIED** | None. |
| **F7.1-14** | **P1 (Follow-up)** | `6d7c11e` | `src/lib/db.ts` (`TursoDbAdapter.ensureReady()`) | `phase71DatabaseTurso.test.ts` (20 concurrent queries + failure retry) | **CODE & TEST VERIFIED** | None. |
| **F7.1-15** | **P1 (Follow-up)** | `5cc77e2` | `src/lib/db.ts`, `src/app/api/team/route.ts`, `src/app/api/import/route.ts` (`TursoWriteOutcomeUnknownError`, HTTP `503`) | `phase71DatabaseTurso.test.ts` (timeout outcome, no commit rollback, no write retry) | **CODE & TEST VERIFIED** | Financial batch `idempotency_key` DB persistence proposed for future approval. |
| **F7.1-16** | **P1 (Follow-up)** | `f1e5c37` + Phase 7.1.2 | `src/app/api/team/route.ts` (`add_walkin_player`, `save_player`, `reset_player_password`), `src/lib/db.ts` (`hashRandomUnclaimedPin`) | `phase71AuthPrivacy.test.ts` + `phase712Hardening.test.ts` (unguessable `scrypt$` hash, `'1234'` rejected, `reset_player_password` requires strong PIN) | **CODE & TEST VERIFIED** | `PlayersTab.tsx` UI reset dialog still sends `'1234'` (blocked by API `400` until UI updated). |
| **P2-05 / P2-08 / DDL / Auth** | **P2 (Phase 7.1.2)** | Phase 7.1.2 | `src/app/api/team/route.ts`, `src/app/api/import/route.ts`, `src/app/api/webp/route.ts`, `scripts/lib/backup-format.mjs`, `next.config.ts` | `phase712Hardening.test.ts` + `phase72RestoreHardening.test.ts` (`change_own_password` atomic, `P2-08` transactions, `4MB` upload cap `413`, lexical single-statement DDL + name match) | **CODE & TEST VERIFIED** | `collect_match_fees_batch` `idempotency_key` DB persistence remains **OPEN**; CSP `'unsafe-inline'` baseline limitation documented. |
