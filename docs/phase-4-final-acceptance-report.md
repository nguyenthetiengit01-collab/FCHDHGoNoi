# Phase 4 — Final Acceptance Report (Product Growth & Analytics)

- **Branch**: `feat/phase-4-product-growth-analytics`
- **Commit (HEAD)**: `b4664e786c66c0a75908cbd0b4c936d9cb8e405b` (Remediation on top of `d71f60eb571003f21a62129788e60bbefb91bed2`)
- **Base (`main`)**: `29efe831f80976ae2f5878a2044c5bcbdebf0404` (`v2.0.2`)
- **Node.js Configuration (`package.json`)**: `engines.node = "22.x"` *(không có `.nvmrc` / `.node-version`)*
- **Reported Local Test Runtime**: `Node.js v24.12.0` *(chưa có bằng chứng chạy bộ test trên Node.js `22.x`)*

---

## 1. Phân tách 5 Tầng Trạng thái Nghiệm thu (Acceptance Levels)

| Tầng nghiệm thu | Trạng thái | Nguồn bằng chứng & Giới hạn xác minh |
| :--- | :---: | :--- |
| **1. Automated Code Quality (`b4664e7`)** | **PASS** | **Session execution evidence** trên Node.js `v24.12.0`: `32/32` test files (`243/243` tests), `lint`, `tsc --noEmit`, `next build` PASS. |
| **2. Staging Migration Verification** | **VERIFIED IN CODE / EXTERNAL RUN** | Mã nguồn `scripts/migrations/phase4-analytics-v1.mjs` đã xác minh idempotent & `validateStagingTarget(..., role: "target")`; trạng thái chạy thực tế trên Turso Staging (`fchdhgonoi-staging-restore`) là **bằng chứng vận hành ngoài repository** (không có log lưu trong Git). |
| **3. Browser QA (Preview `dpl_4YE2CLfFKLBWrXSKjAVNPKXwmcQ9`)** | **PASS (User / Agent Session Evidence)** | **Bằng chứng phiên QA do User / Coding Agent cung cấp** (screenshots trên Vercel Preview với `QA_MANAGER_363B` & `QA_PLAYER_363B`); thiếu log Console/Network trực tiếp do giới hạn công cụ Chrome DevTools MCP. |
| **4. Preview Gate B (`b4664e7`)** | **PASS (Preview Only)** | Đạt ngưỡng kiểm thử trên **Vercel Preview + Staging DB**; **Preview Gate B PASS KHÔNG đồng nghĩa đã nghiệm thu Production**. |
| **5. Production Readiness** | **PENDING FORMAL APPROVAL** | Chờ phê duyệt chính thức của người vận hành, thực thi migration Production theo runbook và quyết định bật/tắt `ANALYTICS_ENABLED`. |

---

## 2. Kết quả kiểm định tự động (Session Execution Evidence)

- **Lịch sử baseline tại `d71f60e`** *(giữ nguyên số liệu ghi nhận trước sửa lỗi UI)*: `31/31` test files, `237/237` tests PASS (`7.98s`), `lint` PASS, `tsc` PASS, `build` PASS, `git diff --check` PASS, stress test `1,133ms` (`< 1,500ms`), SQLite fixture migration idempotent (`insertedBaselines: 1` → `0`).
- **Kết quả sau remediation tại `HEAD = b4664e7`** *(Node.js `v24.12.0`, session execution evidence)*:

| Kiểm tra | Trạng thái | Kết quả thực tế (Session Execution Evidence) |
| :--- | :---: | :--- |
| `npm test` (`vitest run`) | **PASS** | **32/32 test files**, **243/243 tests PASS** (`7.39s`), gồm `analyticsPhase4.test.ts` (8 tests) và `src/lib/analytics/uiState.test.ts` (6 regression tests mới) |
| `npm run lint` (`eslint src`) | **PASS** | **0 errors, 0 warnings** |
| `npx tsc --noEmit` | **PASS** | **0 errors** |
| `npm run build` (`process-webp` + `next build`) | **PASS** | Biên dịch sạch `16/16` pages + `10` API routes (chạy với `TEMP` tách biệt trên Windows để tránh khóa `EBWebView`) |
| Migration trên Turso Staging (`--env staging`) | **EXTERNAL EVIDENCE** | Không thể xác minh thực thi chỉ từ file trong repository; cần đối chiếu log/trạng thái Turso Staging ngoài repo |
| Browser QA (`ANALYTICS_ENABLED=true` trên Preview) | **USER / AGENT EVIDENCE** | Manager (6 sub-tabs, Custom Date, Sponsor Selector, Responsive 3 kích thước) & Player (`QA_PLAYER_363B` Insights, RBAC UI, Privacy, Responsive) ghi nhận PASS qua phiên Chrome DevTools MCP; thiếu log Console/Network trực tiếp |

---

## 3. Checklist Nghiệm Thu Theo Mục 10

- [x] Manager Analytics Center (`AnalyticsCenterTab.tsx`) có đủ 6 phân hệ + bộ lọc kỳ + so sánh kỳ trước + Smart Insights + Xuất CSV + guard `envelope.section === section`.
- [x] Player Personal Insights (`PlayerInsights.tsx`) chỉ lấy `playerId` từ session, hiển thị `Chưa đủ dữ liệu` khi mẫu số = 0.
- [x] KPI Engine thuần (`src/lib/analytics/metrics.ts`) kế thừa `teamStatistics.ts`, `financialCalculations.ts`, `dashboardIntelligence.ts`.
- [x] Data model lifecycle (`player_lifecycle_events`), sponsor link (`other_incomes.sponsor_id`), first-party event store & daily/monthly rollups.
- [x] API security: RBAC Guest (`401`) / Player (`403` manager sections & anti-IDOR) / Manager (`200`), CSRF/Origin (`403`), PII metadata rejection (`400`), `Cache-Control: no-store`.
- [x] Feature flag `ANALYTICS_ENABLED` mặc định `false`.
- [x] Không chỉnh sửa `main`, không deploy Production, không chạy migration lên Production.

---

## 4. Defect Register (P0–P3)

- **DEF-P4-01 (P0 — Fixed @ `b4664e7`)**:
  - *Phát hiện*: Client-side crash trên Preview gốc (`d71f60e`) khi chuyển sang 5 sub-tab Analytics ngoài `Tổng quan` do render dữ liệu stale trước khi `envelope.section === section` khớp.
  - *Khắc phục*: Guard `hasValidSectionEnvelope()` + `envelope.section === section` + `AbortController` + `requestSeqRef` tại `src/components/AnalyticsCenterTab.tsx` và `src/lib/analytics/uiState.ts`; regression tests tại `src/lib/analytics/uiState.test.ts`.
- **DEF-P4-02 (P1 — Fixed @ `b4664e7`)**:
  - *Phát hiện*: Bộ lọc ngày `Tùy chỉnh từ/đến` gửi `preset=custom` đơn độc trên Preview gốc (`d71f60e`) gây lỗi `400` (`Khoảng thời gian (preset) không hợp lệ.`).
  - *Khắc phục*: `buildAnalyticsSearchParams()` tại `src/lib/analytics/uiState.ts` bắt buộc đủ `from`/`to` định dạng `YYYY-MM-DD`, `from <= to`, không gửi `preset=custom` đơn độc; regression tests tại `src/lib/analytics/uiState.test.ts`.
- **P2 (Medium)**: **0** mở *(lưu ý `package.json` khai báo `engines.node: 22.x`, khác với local runtime `v24.12.0` đã dùng để chạy kiểm thử)*.
- **P3 (Minor / Follow-up)**:
  1. Thiết lập lịch chạy định kỳ `scripts/analytics-cleanup.mjs --days 90` khi đã bật `ANALYTICS_ENABLED=true` trên Production.
  2. Bổ sung bằng chứng Console/Network log trực tiếp từ trình duyệt (nếu cần) trước khi phê duyệt Production.
