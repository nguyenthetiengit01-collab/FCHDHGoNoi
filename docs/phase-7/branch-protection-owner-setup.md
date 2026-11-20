# Phase 7.1 — GitHub `main` Branch Protection Owner Setup (`P0-01`)

> **Status (`P0-01`)**: **OPEN** — `P0-01` remains **OPEN** until the repository owner configures these branch protection settings in GitHub and they are independently verified (via GitHub API `/repos/nguyenthetiengit01-collab/FCHDHGoNoi/branches/main/protection` or a live PR check). Agents must **not** modify GitHub branch protection settings directly.

---

## 1. Repository & Target Branch

- **Repository**: `nguyenthetiengit01-collab/FCHDHGoNoi`
- **Target Branch**: `main`

---

## 2. Exact GitHub UI Steps (Classic Branch Protection Rule)

1. Sign in as the **Repository Owner / Admin** and open:
   `https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi/settings/branches`
2. Under **Branch protection rules**, click **Add branch protection rule** (or **Add rule**).
3. In **Branch name pattern**, enter:
   ```text
   main
   ```
4. Under **Protect matching branches**, enable and configure the following options:
   - **Require a pull request before merging**: **Checked**
     - **Require approvals**: **Checked** — set required approving reviews per owner policy (recommended: `1`).
     - **Dismiss stale pull request approvals when new commits are pushed**: **Checked**
     - **Require conversation resolution before merging**: **Checked**
   - **Require status checks to pass before merging**: **Checked**
     - **Require branches to be up to date before merging**: **Checked**
     - In the status checks search box, select these **exact** check names (must have run at least once on a PR/push so GitHub lists them):
       - `Quality Gates (Node 22.23.5)`
       - `Playwright Visual & Accessibility QA (Linux)`
       - `Playwright Visual & Accessibility QA (Windows)`
     - *(Optional per owner preference)*: Also add `Vercel` if Preview deployment success should block merge.
   - **Do not allow bypassing the above settings** (Include administrators): **Checked** (recommended so `main` cannot be accidentally pushed directly).
5. Under **Rules applied to everyone including administrators** (Force pushes & Deletions):
   - **Allow force pushes**: **Unchecked** (restrict force pushes).
   - **Allow deletions**: **Unchecked** (restrict branch deletion).
6. Click **Create** (or **Save changes**).

---

## 3. Independent Verification Checklist (After Owner Setup)

1. Confirm `GET /repos/nguyenthetiengit01-collab/FCHDHGoNoi/branches/main` returns `"protected": true`.
2. Confirm `GET /repos/nguyenthetiengit01-collab/FCHDHGoNoi/branches/main/protection` lists all three required status check contexts:
   - `Quality Gates (Node 22.23.5)`
   - `Playwright Visual & Accessibility QA (Linux)`
   - `Playwright Visual & Accessibility QA (Windows)`
3. Confirm direct `git push origin main` is rejected by GitHub, and a test PR displays all required checks and conversation/approval gates before merge.
4. Only after steps 1–3 are independently verified should `P0-01` be marked **CLOSED** in `docs/phase-7/risk-register.md` and `docs/phase-7/release-go-no-go-checklist.md`.
