# Phase 4 — Implementation Notes & File Mapping

- **Branch**: `feat/phase-4-product-growth-analytics`
- **Base (`main`)**: `29efe831f80976ae2f5878a2044c5bcbdebf0404` (`v2.0.2`)

| File | Vai trò & Thay đổi |
| :--- | :--- |
| `src/lib/analytics/config.ts` | Feature flag `ANALYTICS_ENABLED` (mặc định `false`), ngưỡng coverage `0.95`, retention `90` ngày, batch max `20`. |
| `src/lib/analytics/types.ts` | TypeScript contracts cho `AnalyticsEnvelope<T>`, 8 sections, `SmartInsight`, `ProductEventInput`. |
| `src/lib/analytics/validation.ts` | Chuẩn hóa kỳ lọc `Asia/Ho_Chi_Minh`, `computePreviousPeriod`, allowlist `section` / `eventName` / `routeKey` / `metadata` (chặn PII). |
| `src/lib/analytics/metrics.ts` | Pure KPI engine (Club Health, Match Performance, Retention 30/90d, Finance Intelligence, Personal Insights, Smart Insights). |
| `src/lib/analytics/lifecycle.ts` | Ghi `player_lifecycle_events` (`joined`, `status_changed`) và kiểm chứng `other_incomes.sponsor_id`. |
| `src/lib/analytics/productEvents.ts` | `deriveActorKeyHash` (HMAC-SHA256), `ingestProductEvents` (idempotent `event_uuid` + rollup), `rebuildAnalyticsRollups`, `cleanupExpiredRawEvents`. |
| `src/lib/analytics/queries.ts` | Server-side query aggregation theo kỳ cho tất cả 8 sections, kèm `coverage` metadata. |
| `src/lib/analytics/clientTracker.ts` | First-party best-effort batch tracker + `observeSponsorImpression` (`IntersectionObserver` >=50%, >=1s, dedupe). |
| `src/lib/analytics/exportCsv.ts` | Xuất CSV UTF-8 BOM từ cùng `AnalyticsEnvelope` hiển thị trên UI (không lộ PII/hash). |
| `src/app/api/analytics/route.ts` | `GET /api/analytics` với RBAC Guest/Player/Manager, anti-IDOR, `Cache-Control: no-store`. |
| `src/app/api/analytics/events/route.ts` | `POST /api/analytics/events` với CSRF/Origin check, rate limit, batch <=20, strict allowlist. |
| `src/app/api/team/route.ts` | Tích hợp lifecycle events khi tạo/sửa trạng thái cầu thủ và `sponsor_id` cho `upsert_other_income`. |
| `src/app/api/import/route.ts` | Ghi lifecycle events (`source: "import"`) khi import Excel có thay đổi trạng thái hoặc cầu thủ mới. |
| `src/components/AnalyticsCenterTab.tsx` | Tab **Thống kê & Phân tích** cho Ban Quản Lý (6 phân hệ, bộ lọc kỳ, so sánh kỳ trước, Smart Insights, CSV Export). |
| `src/components/PlayerInsights.tsx` | Thống kê chuyên cần & RSVP cá nhân trong `PlayerPersonalTab.tsx`. |
| `src/components/TeamManagerApp.tsx` | Gắn tab lazy-load `analytics` cho Manager. |
| `src/components/FinanceTab.tsx` | Bổ sung chọn Nhà tài trợ (`sponsor_id`) tùy chọn trong modal Thu khác. |
| `src/components/PwaManager.tsx` | Emit `page_view` (theo route group allowlist) và `player_profile_view`. |
| `scripts/migrations/phase4-analytics-v1.mjs` | Migration idempotent (hỗ trợ `--sqlite`, `--env staging`, `--dry-run`). |
| `scripts/analytics-cleanup.mjs` | Dọn raw events quá hạn 90 ngày, giữ nguyên daily/monthly rollups. |
| `src/lib/analytics/analyticsPhase4.test.ts` | Bộ test KPI, migration, rollup, retention, security RBAC/CSRF/PII và stress 100k rows. |
