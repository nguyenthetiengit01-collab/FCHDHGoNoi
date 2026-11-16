# Analytics Data Model & Migration Specification

## 1. Bảng & Cột mới (`scripts/migrations/phase4-analytics-v1.mjs`)
- **`schema_migrations`**: `version TEXT PRIMARY KEY, applied_at TEXT NOT NULL, summary TEXT`.
- **`players.joined_at`**: `TEXT NULL` (giữ `NULL` cho hồ sơ cũ chưa xác thực ngày gia nhập; tự ghi `nowIso` cho cầu thủ tạo mới).
- **`player_lifecycle_events`**: `id, player_id, event_type ('baseline'|'joined'|'status_changed'), from_status, to_status, effective_at, actor_id, source ('migration'|'manager_action'|'import'), created_at`.
  - Indexes: `idx_lifecycle_player_effective(player_id, effective_at)`, `idx_lifecycle_type_effective(event_type, effective_at)`.
- **`other_incomes.sponsor_id`**: `INTEGER NULL` + index `idx_other_incomes_sponsor(sponsor_id)`. Giao dịch cũ giữ `NULL` (`Chưa phân bổ`). Không cascade delete lịch sử tài chính.
- **`product_analytics_events`**: `id, event_uuid UNIQUE, event_name, route_key, content_type, content_id, sponsor_id, actor_role, actor_key_hash, occurred_at, metadata_json`.
  - Indexes: `idx_pa_events_occurred_name(occurred_at, event_name)`, `idx_pa_events_route(route_key)`.
- **`product_analytics_daily`**: `event_date, event_name, actor_role, route_key, content_type, content_id, sponsor_id, event_count` với `UNIQUE` composite key cho tất cả các chiều.
- **`product_analytics_monthly_actors`**: `month_key, actor_role, actor_key_hash` với `UNIQUE(month_key, actor_role, actor_key_hash)`.

## 2. Retention & Rebuild
- Raw events trong `product_analytics_events` lưu tối đa **90 ngày** và được dọn bằng `scripts/analytics-cleanup.mjs` (hỗ trợ `--dry-run`), không xóa bảng tổng hợp `product_analytics_daily` và `product_analytics_monthly_actors`.
- Có thể tái tạo toàn bộ rollup từ raw events bằng `rebuildAnalyticsRollups(db)`.
