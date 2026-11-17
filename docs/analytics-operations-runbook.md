# Analytics Operations Runbook

## 1. Biến môi trường bắt buộc (Chỉ nêu tên biến)
- `ANALYTICS_ENABLED`: Mặc định **`false`** (tắt). Chỉ bật `true` trên Staging hoặc Production sau khi đã chạy migration `phase4-analytics-v1.mjs` thành công và cấu hình đủ các biến bảo mật bên dưới.
- `ANALYTICS_ACTOR_SECRET` (**Bắt buộc khi `ANALYTICS_ENABLED=true`**, tối thiểu **32 ký tự**): Khóa HMAC-SHA256 chuyên biệt để băm `actor_key_hash` và khóa rate-limit ẩn danh. Tuyệt đối **không** dùng `AUTH_SECRET` hay `APP_SECRET` làm fallback; nếu thiếu hoặc `< 32` ký tự khi `ANALYTICS_ENABLED=true`, endpoint `POST /api/analytics/events` **fail-closed với HTTP 503** và không ghi dữ liệu.
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` (**Bắt buộc khi `ANALYTICS_ENABLED=true`**): Kết nối Upstash Redis cho shared atomic sliding-window rate limiting (`60` requests / `60` giây / identity đã băm HMAC). Nếu thiếu cấu hình khi `ANALYTICS_ENABLED=true`, hệ thống **fail-closed HTTP 503**.
- `CRON_SECRET` (**Bắt buộc cho Cron endpoint**, tối thiểu **16 ký tự**): Bearer token dùng để xác thực `GET /api/cron/analytics-cleanup`.

## 2. Chế độ Degraded Mode của Rate Limiter
- Khi Upstash Redis đã cấu hình hợp lệ nhưng gặp timeout (`1,500 ms`) hoặc lỗi kết nối tạm thời:
  - Hệ thống phát log cảnh báo `event=analytics_rate_limit_degraded` (không chứa IP, `playerId` hay secret).
  - Kích hoạt emergency in-memory fallback cục bộ với ngưỡng chặt hơn (`20` requests / `60` giây, tối đa `1,000` bucket, tự dọn key hết hạn).
  - **Lưu ý giới hạn**: Degraded fallback **không** cung cấp rate limiting phân tán xuyên serverless instances và chỉ là lớp bảo vệ khẩn cấp tạm thời.

## 3. Chạy Migration An Toàn (Staging trước, Production sau)
```bash
# 1. Dry-run kiểm tra trên Staging
node scripts/migrations/phase4-analytics-v1.mjs --env staging --dry-run

# 2. Thực thi Migration trên Staging
node scripts/migrations/phase4-analytics-v1.mjs --env staging

# 3. Kiểm tra lại (idempotent — lần 2 phải báo insertedBaselines: 0)
node scripts/migrations/phase4-analytics-v1.mjs --env staging
```

## 4. Dọn dẹp Raw Events Quá Hạn (90 ngày, Batching)
- Chỉ xóa `product_analytics_events` quá hạn `90` ngày (UTC ISO cutoff), tối đa `5,000` dòng/batch (tối đa `10` batch hoặc `8,000 ms` mỗi lần chạy); giữ nguyên `product_analytics_daily`, `product_analytics_monthly_actors`, `player_lifecycle_events` và toàn bộ bảng nghiệp vụ.
- Báo cáo rõ `partial: true` và `remainingEligible > 0` nếu còn dữ liệu quá hạn chưa xóa hết trong 1 lần gọi.
```bash
# Staging
node scripts/analytics-cleanup.mjs --env staging --days 90 --dry-run
node scripts/analytics-cleanup.mjs --env staging --days 90

# Production CLI (bắt buộc --confirm-production và target allowlist)
node scripts/analytics-cleanup.mjs --env production --confirm-production --days 90 --dry-run
node scripts/analytics-cleanup.mjs --env production --confirm-production --days 90
```

## 5. Protected Cron Endpoint (`GET /api/cron/analytics-cleanup`)
- Chỉ chấp nhận `GET` với header `Authorization: Bearer <CRON_SECRET>` (so sánh constant-time).
- Bắt buộc `VERCEL_ENV=production` và xác thực đích Production DB (`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`) do server kiểm soát; từ chối mọi URL do caller truyền vào và trả `Cache-Control: no-store`.
- **Trạng thái hiện tại**: Lịch chạy tự động (`vercel.json` Cron) **chưa được kích hoạt** cho tới khi `CRON_SECRET` được cấu hình trên Production và thao tác cleanup được phê duyệt chính thức.

## 6. Rollback / Xử lý sự cố
1. **Tắt khẩn cấp**: Đặt `ANALYTICS_ENABLED=false` trên Vercel Dashboard và Redeploy. Website chính, điểm danh và thu quỹ vẫn hoạt động bình thường.
2. **Schema**: Migration mang tính additive (chỉ thêm cột nullable và bảng mới). Nếu cần sửa schema, dùng forward-fix migration mới; không drop cột hoặc xóa dữ liệu tài chính/lịch sử.
