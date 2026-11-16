# Analytics Operations Runbook

## 1. Biến môi trường & Feature Flag
- `ANALYTICS_ENABLED`: Mặc định **`false`** (tắt). Chỉ bật `true` trên Staging hoặc Production sau khi đã chạy migration `phase4-analytics-v1.mjs` thành công.
- `ANALYTICS_ACTOR_SECRET` (tùy chọn, khuyến nghị >=32 ký tự): Dùng để băm `actor_key_hash` bằng HMAC-SHA256; nếu chưa đặt sẽ dùng `AUTH_SECRET`/`APP_SECRET`.

## 2. Chạy Migration An Toàn (Staging trước, Production sau)
```bash
# 1. Dry-run kiểm tra trên Staging
node scripts/migrations/phase4-analytics-v1.mjs --env staging --dry-run

# 2. Thực thi Migration trên Staging
node scripts/migrations/phase4-analytics-v1.mjs --env staging

# 3. Kiểm tra lại (idempotent — lần 2 phải báo insertedBaselines: 0)
node scripts/migrations/phase4-analytics-v1.mjs --env staging
```

## 3. Dọn dẹp Raw Events Quá Hạn (90 ngày)
```bash
node scripts/analytics-cleanup.mjs --env staging --days 90 --dry-run
node scripts/analytics-cleanup.mjs --env staging --days 90
```
Lưu ý: Lệnh này chỉ xóa `product_analytics_events` quá hạn 90 ngày, giữ nguyên `product_analytics_daily` và `product_analytics_monthly_actors`. Không ghép lệnh cleanup vào workflow backup.

## 4. Rollback / Xử lý sự cố
1. **Tắt khẩn cấp**: Đặt `ANALYTICS_ENABLED=false` trên Vercel Dashboard và Redeploy. Website chính, điểm danh và thu quỹ vẫn hoạt động bình thường.
2. **Schema**: Migration mang tính additive (chỉ thêm cột nullable và bảng mới). Nếu cần sửa schema, dùng forward-fix migration mới; không drop cột hoặc xóa dữ liệu tài chính/lịch sử.
