# Phase 4 — Product Growth & Analytics Architecture

## 1. Mục tiêu & North Star
- **North Star Metric**: **Club Engagement Health** — mức độ gắn kết thực tế của FC HĐH Gò Nổi tại TP.HCM, đo qua tỷ lệ ra sân (`attended=1`) và phản hồi RSVP đi kèm độ phủ dữ liệu (`coverage`).
- **Nguyên tắc đạo đức & bảo mật dữ liệu**: Không dùng AI dự báo/chấm điểm cầu thủ, không xếp hạng cầu thủ theo tiền đóng quỹ, không dùng tracking SDK bên thứ ba (GA/Meta/Hotjar/Mixpanel), không thu IP thô, user-agent thô, SĐT hay mã PIN.

## 2. Kiến trúc tổng thể
1. **KPI Engine thuần (`src/lib/analytics/metrics.ts`)**: Tái sử dụng `teamStatistics.ts`, `financialCalculations.ts` và `dashboardIntelligence.ts` làm nguồn công thức duy nhất.
2. **Data Foundation**:
   - `player_lifecycle_events` + `players.joined_at` (không backfill giả).
   - `other_incomes.sponsor_id` nullable (`Chưa phân bổ` cho giao dịch lịch sử).
   - `product_analytics_events`, `product_analytics_daily`, `product_analytics_monthly_actors`.
3. **Server-Side APIs (`Cache-Control: no-store`)**:
   - `GET /api/analytics?section=...` (RBAC Guest/Player/Manager).
   - `POST /api/analytics/events` (CSRF, rate-limit, allowlist, HMAC-SHA256 `actor_key_hash` server-side).
4. **Feature Flag**: `ANALYTICS_ENABLED` mặc định `false` cho tới khi migration Staging/Production được nghiệm thu và phê duyệt bật.
5. **UI**:
   - Manager: Tab **Thống kê & Phân tích** (`AnalyticsCenterTab.tsx`) với 6 khu vực, bộ lọc thời gian, so sánh kỳ liền trước, Smart Insights dựa trên quy tắc, và xuất CSV.
   - Player: `PlayerInsights.tsx` trong `PlayerPersonalTab.tsx` chỉ hiển thị số liệu của bản thân.
