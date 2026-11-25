# Phase 7.1.1 — Remediation & Integration Report

- **Project**: FC HĐH Gò Nổi – TP.HCM (`nguyenthetiengit01-collab/FCHDHGoNoI`)
- **Target Branch**: `fix/phase-7.1-pre-release-remediation` (PR `#16`)
- **Worktree**: `D:\Test1\QuanLyDoiBong-worktrees\phase-7.1-remediation`
- **Date**: 2026-11-25

---

## 1. Git & PR Lineage

- **Base Commit (trước PR #18)**: `78fe8aceadc1c5da08c3d678c51a19ff5cec3ce1`
- **PR #18 Commits (`fix/phase-7.1.1-ssr-public-privacy`)**:
  1. `968652d0372714a5a377656802ecb09a35f6d923` — `fix(privacy): enforce DB-first SSR authorization and public DTOs`
  2. `1339f7f168caa62317e0029741b72bcd8c85f5c4` — `fix(security): enforce player lifecycle authorization and PR CI`
- **Merge Commit trên `fix/phase-7.1-pre-release-remediation`**: `d549b4fe0ad301b3b543e47aa772888e57a39664` (`Merge pull request #18 from nguyenthetiengit01-collab/fix/phase-7.1.1-ssr-public-privacy`)
- **Bổ sung sau merge (uncommitted, chỉ mới kiểm chứng cục bộ — CHƯA được GitHub Actions CI kiểm chứng)**: Khắc phục phân loại lỗi DB (`503`) vs lỗi lập trình/SQL/HTTP client (`500`) và lỗi xác thực (`401`) trong `verifyCredentials()`, `getCurrentAuthContextFromToken()`, và `POST /api/auth` (`src/lib/auth.ts`, `src/app/api/auth/route.ts`, `src/lib/phase711SsrPublicPrivacy.test.ts`), bao gồm bọc `getAsyncDb()` trong `runAuthDbQuery()`, allowlist chặt chẽ trong `isDatabaseOutageError()`, và test `quick_login` / `switch_role` / `audit_logs`.

---

## 2. Lifecycle Authorization Policy

Chuẩn hóa theo `classifyPlayerStatus()` (`src/lib/teamStatistics.ts`) qua `isPlayerStatusAllowedForAuth()` (`src/lib/auth.ts`):

| Nhóm trạng thái | Giá trị tiêu biểu | Chính sách xác thực |
| :--- | :--- | :--- |
| **`active`** | `"Đang sinh hoạt"`, `"active"` | **Cho phép** đăng nhập & duy trì session |
| **`paused`** | `"Tạm nghỉ"`, `"Nghỉ phép"`, `"Tạm dừng"`, `"paused"` | **Cho phép** đăng nhập & duy trì session |
| **`stopped`** | `"Ngừng tham gia"`, `"Đã nghỉ"`, `"Ngưng"`, `"Rời đội"`, `"stopped"` | **Từ chối** (`401` / `403` cho `switch_role`) |
| **`unknown` / `"inactive"`** | `""`, `"inactive"`, `"Khác"`, chuỗi không nhận diện | **Fail-closed, từ chối (`401`)** |

---

## 3. DB-First Session Validation & SSR Public DTO Protections

- **DB-first session validation (`src/lib/auth.ts`, `src/app/page.tsx`, `src/lib/publicHome.ts`, `src/app/api/auth/route.ts`)**:
  - `getCurrentAuthContextFromToken(token)` xác minh chữ ký HMAC-SHA256 & hạn token, truy vấn `players` theo `AUTH_PLAYER_PROFILE_COLUMNS`, từ chối tài khoản thiếu/không hợp lệ/`stopped`/`inactive`/`unknown`, đối chiếu `pwdFingerprint` với `pin_code` hiện hành trong DB, và lấy `role` trực tiếp từ DB (`player.access_role`), không tin `session.accessRole` từ cookie cũ.
  - `requireManagerSession()`, `requirePlayerSession()`, `GET /api/auth`, `getHomePageInitialData()`, `verifyCredentials()`, và `switch_role` dùng chung quy tắc này.
- **Guest / Manager / Player SSR Behavior**:
  - **Guest / Invalid / Expired / Stopped / PIN-changed**: chỉ nhận `getPublicHomePageData()` (không PII, không `pin_code`, không ledger nội bộ).
  - **Player** (hoặc Manager vừa bị hạ quyền xuống `player` trong DB): nhận `sanitizeDataForPlayer(data, auth.player.id)` (ẩn `phone`/`username`/`notes` của cầu thủ khác, ẩn `tournament_fund_note`).
  - **Manager** (DB xác nhận `access_role === "manager"`): nhận dữ liệu đầy đủ với `pin_code` luôn bị xóa (`""`).
- **SSR Public DTO (`src/lib/publicHome.ts`)**:
  - Loại `tournament_fund_note` khỏi SQL `SELECT` bảng `team_settings`, và loại `pitch_cost`, `payer_name`, `notes` khỏi SQL `SELECT` bảng `matches` ở cả `getPublicHomePageData()` và `getPublicPlayerProfileByIdOrJersey()`, map rõ về `0` / `""` ở DTO; giữ nguyên lịch thi đấu, địa điểm, đối thủ, tỷ số, `fee_per_player`, thông tin chuyển khoản, ảnh/gallery, bài viết và nhà tài trợ.

---

## 4. DB Error Semantics (`401` / `403` / `429` / `503` / `500`)

- **`AuthDatabaseError`, `isDatabaseOutageError()` & `runAuthDbQuery()`** (`src/lib/auth.ts`, `src/app/api/auth/route.ts`):
  - Bọc cả `getAsyncDb()` lẫn các truy vấn DB (`verifyCredentials()`, `getCurrentAuthContextFromToken()`, `switch_role`/`quick_login` lookup, `recordAuditLog`) trong `runAuthDbQuery()`.
  - Allowlist chặt chẽ đồng bộ với `isTransientTursoReadError()` (`db.ts`): nhận diện `ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`, `SQLITE_BUSY`, `SERVER_ERROR`, `HRANA_WEBSOCKET_ERROR`, `HTTP_STATUS_429/502/503/504`, `DB_WRITE_OUTCOME_UNKNOWN`, lỗi cấu hình/khởi tạo DB (`Database configuration error:`), `TypeError("fetch failed")`, và đệ quy `cause` -> trả **HTTP `503`** (không cấp session cookie).
  - Loại trừ rõ `HTTP_STATUS_400/401/403/404`, `SQLITE_ERROR`, `SQLITE_CONSTRAINT`, `TypeError` lập trình, và `Error` logic ứng dụng -> trả **HTTP `500`**.
  - Sai thông tin đăng nhập / trạng thái bị từ chối / session không hợp lệ: **HTTP `401`**.
  - Tài khoản hợp lệ nhưng dùng PIN mặc định `"1234"` hoặc không đủ quyền Manager: **HTTP `403`**.
  - Vượt ngưỡng rate limit: **HTTP `429`**.

---

## 5. Regression Test Matrix (`src/lib/phase711SsrPublicPrivacy.test.ts` & `src/lib/phase71AuthPrivacy.test.ts`)

- Lifecycle đầy đủ (`Đang sinh hoạt`, `Tạm nghỉ`, `Ngừng tham gia`, `Đã nghỉ`, `Ngưng`, `Rời đội`, `inactive`, `""`, `"Khác"`, `"unknown_xyz"`) trên `verifyCredentials`, `getCurrentAuthContextFromToken`, `GET /api/auth`, `requireManagerSession`, `requirePlayerSession`, và `getHomePageInitialData`: **PASS**.
- Đổi role trong DB (`manager -> player`), đổi PIN hash khi tài khoản vẫn active, token giả mạo/hết hạn: **PASS**.
- DB failure (`503`) cho candidate lookup, PIN lookup, hydrate player profile, rate-limit driver, `getCurrentAuthContextFromToken`, `requireManagerSession`, `requirePlayerSession`, `GET /api/auth`, đồng thời giữ `401`/`403`/`429` và `500` cho `TypeError`: **PASS**.
- Public homepage & public player profile DTO privacy markers: **PASS**.

---

## 6. CI & Local Quality Gates Evidence

- **GitHub Actions Run `#70`** (`https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi/actions/runs/45585117160`, commit `1339f7f`, PR `#18`):
  - Attempt 1: `Quality Gates (Node 22.23.5)` = `success`, `Playwright Visual & Accessibility QA (Linux)` = `success`, `Playwright Visual & Accessibility QA (Windows)` = `failure`.
  - Attempt 2: `Quality Gates (Node 22.23.5)` = `success`, `Playwright Visual & Accessibility QA (Linux)` = `success`, `Playwright Visual & Accessibility QA (Windows)` = `success` (Run `#70` conclusion: `success`).
- **GitHub Actions Run `#71`** (`https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi/actions/runs/45588876909`, commit `d549b4fe0ad301b3b543e47aa772888e57a39664`, branch `fix/phase-7.1-pre-release-remediation` / PR `#16` — **trước** các thay đổi local Phase 7.1.2):
  - `Quality Gates (Node 22.23.5)`: **SUCCESS**
  - `Playwright Visual & Accessibility QA (Linux)`: **SUCCESS**
  - `Playwright Visual & Accessibility QA (Windows)`: **SUCCESS**
- **Local Quality Gates (cho các thay đổi local chưa commit/chưa chạy CI trên `phase-7.1-remediation`)**:
  - `npm test -- --maxWorkers=1`: **PASS** (`54/54` test files, `426/426` tests, exit `0`).
  - `npm run lint` (`eslint src`): **PASS** (`0` errors, `0` warnings, exit `0`).
  - `npx tsc --noEmit`: **PASS** (`0` errors, exit `0`).
  - `npm run build`: **PASS** (`Next.js 15.5.29`, `16/16` trang, exit `0`).
  - `npm run test:e2e`: **PASS** (`11/11` Playwright tests, `2.1m`, exit `0`).
  - `git diff --check`: **PASS** (exit `0`).

---

## 7. Trạng thái Release & Production Blockers

- **Production Release**: **NO-GO / CHƯA PHÁT HÀNH PRODUCTION** (không merge PR `#16`, không merge `main`, không deploy Production).
- **`P1-03` Production Containment (OPEN / RELEASE BLOCKING)**: Chưa xoay effective Production auth secret (`APP_SECRET > AUTH_SECRET > NEXTAUTH_SECRET > SESSION_SECRET`), chưa coordinated redeploy, chưa xác minh `401` cookie cũ, chưa chạy scoped PIN reset trên Production, và chưa chốt quyết định lịch sử Git.
- **Owner Sign-offs còn mở**: `P0-01` behavioral branch protection, `P1-10`–`P1-13` (RPO/RTO, DR Owners, escalation roster), tách biệt Vercel Prod/Preview env, backup key custody, remote Staging restore rehearsal, `P2-03` dev-only advisory acceptance, và iOS/Android real-device QA.
