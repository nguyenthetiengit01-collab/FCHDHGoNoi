# Account Recovery & Full Credential Rotation Runbook (P1-03)

Tài liệu hướng dẫn quy trình tái cấp thông tin đăng nhập (20 ký tự ngẫu nhiên) và phục hồi tài khoản không khóa Ban Quản Lý cho **FC HĐH Gò Nổi tại TP.HCM**.

---

## 1. Tiêu chuẩn Credential Mới
- **Độ dài khuyến nghị**: Tối thiểu 20 ký tự cho mỗi tài khoản (chữ hoa, chữ thường, chữ số, ký tự đặc biệt).
- **Sinh ngẫu nhiên**: Mỗi tài khoản một mật khẩu riêng biệt từ Password Manager; không dùng lại giữa các tài khoản; không chứa họ tên, số điện thoại, năm sinh, username hoặc tên đội bóng.
- **Lưu trữ & bàn giao**: Chỉ lưu trong Password Manager hoặc file mã hóa của Chủ sở hữu; gửi riêng từng người qua kênh trực tiếp, tuyệt đối không gửi chung vào nhóm chat.

---

## 2. Cơ chế `must_change_pin` & Giới hạn API
1. Khi Ban Quản Lý thực hiện `reset_player_password`, hệ thống:
   - Băm mật khẩu mới bằng `scrypt` (`16-byte random salt`, `64-byte key`).
   - Đặt `must_change_pin = 1` trong bảng `players`.
   - Ghi nhận vào `audit_logs` (`actor_id`, `target=#<id>`, `targetRole`, `result=success`), tuyệt đối không ghi PIN hay hash.
   - Tự động vô hiệu hóa mọi phiên `fc_session` cũ của tài khoản đích do `pwdFingerprint` thay đổi.
2. Khi người dùng đăng nhập bằng mật khẩu tạm thời:
   - `POST /api/auth` (`login`) và `GET /api/auth` trả `mustChangePassword: true`.
   - Mọi API nghiệp vụ (`/api/team` trừ `change_own_password`, `/api/import`, `/api/export`, `/api/audit-logs`, `/api/webp`, `/api/media/upload`, `/api/auth` `switch_role`) bị chặn với HTTP `403 PIN_CHANGE_REQUIRED`.
   - Chỉ được phép: xem trạng thái `GET /api/auth`, đăng xuất (`logout`), và tự đổi mật khẩu (`change_own_password`).
3. Khi người dùng tự đổi mật khẩu (`change_own_password`):
   - Từ chối nếu mật khẩu mới trùng mật khẩu tạm thời hiện tại hoặc không đạt chính sách độ mạnh.
   - Đặt `must_change_pin = 0`, cấp lại cookie `fc_session` với `pwdFingerprint` mới, và vô hiệu hóa cookie cũ.

---

## 3. Trình tự Tái Cấp 4 Đợt (Zero-Lockout)
1. **Preflight (Phase A)**: Chụp backup mã hóa Turso Production (chỉ đọc, lưu ngoài Git), ghi nhận `audit_logs`, và kiểm kê tài khoản.
2. **Đợt 1 — Manager dự phòng**: Giữ phiên Manager điều phối của Chủ sở hữu; reset 1 Manager khác với mật khẩu 20 ký tự, gửi riêng và xác nhận người đó đăng nhập + dùng quyền Manager thành công.
3. **Đợt 2 — Các Manager còn lại**: Reset từng Manager còn lại và xác nhận đăng nhập thành công.
4. **Đợt 3 — Toàn bộ Player**: Reset từng Player, cấp riêng mật khẩu mới và xác nhận nhận credential.
5. **Đợt 4 — Tài khoản Chủ sở hữu (cuối cùng)**: Đổi mật khẩu tài khoản điều phối bằng `change_own_password`, đăng nhập lại bằng mật khẩu mới và xác nhận đầy đủ quyền quản trị.

---

## 4. Phục hồi Khẩn cấp (Nếu Toàn bộ Manager Bị Khóa)
- Nếu tất cả tài khoản Manager đều không đăng nhập được (do dùng `"1234"` sau khi bật P1-03):
  1. Chụp encrypted backup Turso Production trước mọi thao tác.
  2. Dùng script/kết nối quản trị được Owner ủy quyền để cập nhật `pin_code` cho **duy nhất 1 tài khoản Manager chỉ định** bằng hash `scrypt` của mật khẩu 20 ký tự mới (đặt `must_change_pin = 1` để Manager đó tự đổi lại ngay sau khi đăng nhập).
  3. Đăng nhập bằng tài khoản Manager vừa khôi phục và dùng giao diện `PlayersTab` để đặt lại PIN cho các tài khoản còn lại.

---

## 5. Migration Bổ sung (`must_change_pin`)
- Migration: `scripts/migrations/phase7-p103-must-change-pin-v1.mjs` (additive `ALTER TABLE players ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0`, idempotent, tương thích ngược với DB chưa migrate).
- Chạy `--dry-run` trước khi áp dụng:
  ```bash
  node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --sqlite <isolated-temp.sqlite> --dry-run
  node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --env staging --dry-run
  ```
- Không bao giờ tự động chạy migration ghi Production khi khởi động ứng dụng hoặc khi deploy.
