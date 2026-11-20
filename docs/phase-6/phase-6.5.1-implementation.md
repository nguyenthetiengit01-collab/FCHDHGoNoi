# Phase 6.5.1 — Playwright Portability, Synthetic QA Fixtures & Cross-Platform CI

**Nhánh / PR**: `feat/phase-6.5.1-playwright-portability` (PR #14 → `main`, không sửa worktree Phase 6.5).

## 1. QA_ROOT Lifecycle & Path Validation (`tests/e2e/qaPaths.ts`)
- `QA_ROOT`: Nếu không truyền `process.env.QA_ROOT`, `getQaRoot()` tạo thư mục tạm duy nhất theo từng lần chạy (`<os.tmpdir()>/gonoifc-phase65-qa-<pid>-<timestamp>`). Trên GitHub Actions CI, `QA_ROOT` được gán theo run: `${{ runner.temp }}/gonoifc-qa-${{ github.run_id }}-${{ github.run_attempt }}`.
- `validateQaPaths()` chạy **trước** mọi thao tác `fs.rmSync()` hay khởi tạo SQLite:
  - Từ chối ngay nếu phát hiện `VERCEL=1`, `VERCEL_ENV=production`, `NODE_ENV=production`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, hoặc `LIBSQL_URL`.
  - Xác thực đường dẫn tuyệt đối, kiểm tra `lstatSync` từ chối symlink, resolve đường dẫn thực qua `fs.realpathSync`, từ chối `QA_ROOT` / `QA_DB_PATH` nằm trong repository root và từ chối `data/gonoifc.sqlite`.

## 2. Synthetic SQLite Fixture & No-Production-Data Assurance (`tests/e2e/initSyntheticQaDb.ts`)
- Không sao chép `data/gonoifc.sqlite`, không dùng dữ liệu Production, không chứa SĐT, tài khoản ngân hàng, giao dịch tài chính hay thông tin thành viên thật.
- Khởi tạo schema bằng `initQaDatabaseSchema(db)` từ `src/lib/db.ts`, sau đó nạp dữ liệu tổng hợp xác định qua prepared statements trong transaction `BEGIN IMMEDIATE ... COMMIT` (tự động `ROLLBACK` nếu lỗi) và kiểm tra số lượng bản ghi trước khi chạy E2E:
  - `team_settings`: 1 bản ghi tổng hợp (`FC HĐH Gò Nổi QA`, `0000000000`)
  - `players`: 2 cầu thủ tổng hợp (`id=1` `Tiền đạo`, `id=2` `Hậu vệ`)
  - `matches`: 2 trận tổng hợp (`Sắp đá` và `Đã đá`)
  - `club_posts`: 1 bài viết tổng hợp (`id="post-gd-1"`)
  - `sponsors`: 1 nhà tài trợ tổng hợp (`Đơn Vị Đồng Hành QA`)

## 3. Chromium Portability, Reflow Methodology & Teardown
- `playwright.config.ts`: mặc định dùng Chromium do Playwright quản lý trên cả Linux và Windows (chỉ dùng `channel: "chrome"` khi đặt `PLAYWRIGHT_CHANNEL=chrome`). Cổng cấu hình qua `PLAYWRIGHT_PORT` (mặc định `3105`), `reuseExistingServer: false`, `workers: 1`, `MEDIA_STORAGE_ENABLED=false`, `ANALYTICS_ENABLED=false`.
- **200%-equivalent CSS reflow**: test `720x450` kiểm tra reflow/overflow/CTA/menu theo WCAG 1.4.10 (bỏ `deviceScaleFactor=2`). Native browser UI zoom 200% là bước kiểm tra thủ công riêng.
- **Teardown (`tests/e2e/global-teardown.ts`)**: chỉ xoá `qa.sqlite`, `qa.sqlite-wal`, `qa.sqlite-shm`, `qa.sqlite-journal` (không xoá đệ quy). Trên Windows, nếu `webServer` còn giữ handle mở (`EBUSY`), teardown ghi nhận rõ số file còn khoá và giữ nguyên `QA_ROOT` duy nhất theo lần chạy để lần chạy sau không bao giờ dùng lại.

## 4. Local Commands & CI Matrix (`.github/workflows/ci.yml`)
- Chạy cục bộ: `npm run test:e2e`, `npm run lint`, `npx tsc --noEmit`.
- CI Matrix (`fail-fast: false`, `timeout-minutes: 25`, `permissions: contents: read`):
  - `Quality Gates (Node 22.23.5)` (`ubuntu-latest`)
  - `Playwright Visual & Accessibility QA (Linux)` (`ubuntu-latest`, `npx playwright install --with-deps chromium`)
  - `Playwright Visual & Accessibility QA (Windows)` (`windows-latest`, `npx playwright install chromium`)
- Artifacts (`if: always()`, `retention-days: 7`): `playwright-qa-<os>-<run_id>-<run_attempt>` gồm `screenshots`, `test-results`, `html-report` (tuyệt đối không upload `qa.sqlite*`, `.env` hay secrets).
