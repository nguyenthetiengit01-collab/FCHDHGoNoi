# Analytics Event Catalog (First-Party, Privacy-First)

## 1. Event Allowlist (`POST /api/analytics/events`)
| `eventName` | Vị trí phát sinh | Dimensions / Metadata cho phép | Ghi chú |
| :--- | :--- | :--- | :--- |
| `page_view` | `PwaManager.tsx` (`usePathname`) | `routeKey` (nhóm tuyến đường allowlist) | Không lưu URL query thô. |
| `player_profile_view` | `PwaManager.tsx` (`/cau-thu/[id]`) | `contentType="player_profile"`, `contentId` | Chỉ tính tổng hợp, không gắn người xem. |
| `club_post_view` | Trang chi tiết bài viết | `contentType="club_post"`, `contentId` | Chỉ tính lượt xem bài viết. |
| `sponsor_impression` | `observeSponsorImpression` | `sponsorId`, `metadata.placement` | `IntersectionObserver` >=50% trong >=1s, dedupe/trang. |
| `sponsor_click` | Click banner/link tài trợ | `sponsorId`, `metadata.placement` | Gửi best-effort. |
| `rsvp_flow_open` | Mở giao diện điểm danh | `routeKey` | Không gửi payload cá nhân. |
| `rsvp_submit_success` | Sau khi API RSVP trả `200` | `routeKey` | Chỉ ghi khi server xác nhận thành công. |
| `feature_action_success` | Hành động quản trị được duyệt | `metadata.action` | Không gửi payload nghiệp vụ. |

## 2. Quy tắc bảo vệ quyền riêng tư
- Batch tối đa **20 events**, mỗi event mang `eventUuid` (UUID v4) chống trùng lặp ở server.
- Server tự suy ra `actor_role` và `actor_key_hash` (HMAC-SHA256 từ `ANALYTICS_ACTOR_SECRET`/`AUTH_SECRET`), bỏ qua mọi timestamp hay ID do client giả mạo.
- Từ chối (`400`) mọi metadata chứa key nhạy cảm (`pin`, `phone`, `password`, `token`, `note`, `bank`, `email`, `ip`, `user_agent`, `referrer`, `query`).
- Không lưu queue dữ liệu cá nhân lâu trên `localStorage`.
