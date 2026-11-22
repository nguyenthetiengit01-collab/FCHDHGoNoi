# Phase 7.1 — GitHub `main` Branch Protection Owner Setup (`P0-01`)

> **Status (`P0-01`)**: **LAYERED EVIDENCE — PUBLIC `protected=true` & RULESETS API READBACK VERIFIED / `/protection` 403 / BEHAVIORAL ENFORCEMENT PENDING** (`Blocking = YES` until behavioral enforcement is verified via authorized PR-based validation).

---

## 1. Layered Verification Summary

1. **Public Branch API (`GET /repos/nguyenthetiengit01-collab/FCHDHGoNoi/branches/main`)**: `"protected": true` — **independently verified**.
2. **Rulesets API (`Ruleset 27703288`)**: configuration readback **independently retrieved** through the connected GitHub API integration (Branch Protection `/protection` endpoint remains inaccessible `403`):
   - **Repository**: `nguyenthetiengit01-collab/FCHDHGoNoi`
   - **Ruleset**: `main` (**ID**: `27703288`)
   - **Enforcement**: `active`
   - **Target**: `refs/heads/main`
   - **Required Status Checks (3/3)**:
     - `Quality Gates (Node 22.23.5)`
     - `Playwright Visual & Accessibility QA (Linux)`
     - `Playwright Visual & Accessibility QA (Windows)`
   - **Strict Required Checks**: `true`
   - **Required Approving Reviews**: `1`
   - **Dismiss Stale Reviews**: `true`
   - **Required Review Thread Resolution**: `true`
   - **Current User Bypass**: `never`
   - **Deletion**: `blocked`
   - **Non-Fast-Forward (Force Push)**: `blocked`
   - **Evidence URLs**:
     - `https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi/rules/27703288`
     - `https://api.github.com/repos/nguyenthetiengit01-collab/FCHDHGoNoi/branches/main`
3. **Behavioral Enforcement**: direct-push rejection and merge blocking have **not yet been behaviorally verified**.

---

## 2. Remaining Enforcement Verification Requirements

1. **Do NOT perform a real direct push to `main`** as a test operation.
2. Validate effective PR/merge enforcement using an authorized PR-based validation (confirming merge is blocked when required checks are pending/failing, when `1` approving review is absent, or when review threads remain unresolved), or leave behavioral enforcement explicitly marked **NOT VERIFIED**.
3. Only after behavioral enforcement is confirmed may `P0-01` be marked **CLOSED** in `docs/phase-7/risk-register.md` and `docs/phase-7/release-go-no-go-checklist.md`.
