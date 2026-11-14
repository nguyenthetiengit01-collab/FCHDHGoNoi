# Hướng Dẫn Vai Trò & Vận Hành — FC HĐH Gò Nổi

Tài liệu vận hành chính thức tương ứng với phiên bản Production hiện hành (**FC HĐH Gò Nổi tại TP.HCM** — `Xã Gò Nổi • TP. Đà Nẵng`, cội nguồn `Gò Nổi – Điện Bàn – Quảng Nam (cũ)` gồm 3 xã `Điện Quang`, `Điện Trung`, `Điện Phong`).

---

## 1. Hướng Dẫn Dành Cho Cầu Thủ (Player)

1. **Đăng nhập**: Mở mục Đăng nhập, nhập `username` (hoặc số áo / SĐT đã đăng ký) và mã PIN.
2. **Điểm danh RSVP trước trận**: Tại tab **Lịch & Điểm Danh**, chọn trận sắp diễn ra và cập nhật trạng thái (`Có mặt`, `Vắng mặt`, `Chưa chắc chắn`).
3. **Cập nhật hồ sơ & đổi mã PIN**: Tại tab **Cá Nhân**, cầu thủ chỉ được phép chỉnh sửa thông tin cá nhân của chính mình (`update_own_profile`), tải ảnh WebP và đổi mã PIN (`change_own_password`).
4. **Thống kê chuyên cần cá nhân**: Tỷ lệ chuyên cần chỉ tính trên các trận **đã hoàn thành** (`Đã kết thúc`); khi chưa có trận đủ điều kiện sẽ hiển thị **`—`**.
5. **Minh bạch tài chính**: Cầu thủ xem được tổng quan quỹ và sổ thu/chi để đối soát công khai, nhưng không thấy SĐT/ghi chú riêng tư của cầu thủ khác, không nhận `pin_code` trong payload và không có quyền thu/chi hay nhập/xuất Excel quản trị.

---

## 2. Hướng Dẫn Dành Cho Ban Quản Lý (Manager)

1. **Quản lý lịch thi đấu & chốt ra sân**: Tạo lịch tuần mới, theo dõi danh sách RSVP, xác nhận cầu thủ ra sân thực tế (`attended = 1`) và chuyển trạng thái trận đấu (`Sắp diễn ra` ↔ `Đã kết thúc`).
2. **Thu tiền trận (Batch 0ms Draft)**: Tại tab **Thu Tiền & Chi Sân**, tích chọn các cầu thủ đã nộp quỹ trên phiếu thu tạm và bấm lưu một lần để ghi batch transaction.
3. **Sổ quỹ & Đối soát tài chính**: Ghi nhận chi phí sân, nước uống, trọng tài, thu khác và quỹ giải riêng; mọi chỉ số sử dụng bộ tính chuẩn tại `src/lib/financialCalculations.ts`.
4. **Xuất / Nhập Excel**:
   - **Xuất Excel (`GET /api/export`)**: Tải file `.xlsx` 5 sheets (`1. Dashboard`, `2. Danh sách`, `3. Thu Trận (Tích chọn)`, `4. Thu Khác`, `5. Chi`).
   - **Nhập Excel (`POST /api/import`)**: Chỉ chấp nhận định dạng `.xlsx`, `.xls`, `.xlsm` tối đa 5MB và đúng cấu trúc sheet chuẩn. Nên kiểm tra trước trên Staging trước khi thao tác trên Production.
5. **Quản lý thành viên, bài viết & nhà tài trợ**: Thêm/sửa cầu thủ, reset PIN cho thành viên quên mật khẩu, đăng bài viết hoạt động (ảnh tự nén WebP) và cấu hình nhà tài trợ 5 hạng.

---

## 3. Hướng Dẫn Vận Hành & An Toàn Hệ Thống

### 3.1. Phân Tách Môi Trường (Staging vs Production)
- **Production** (`main` → `https://fchdhgonoi.vercel.app/`): Kết nối **Production Turso DB** và dùng `AUTH_SECRET` riêng cho Production.
- **Preview / Staging** (nhánh phát triển): Kết nối **Staging Turso DB** và dùng `AUTH_SECRET` riêng cho Preview; không dùng chung database/secret với Production.
- **Local Dev / Test**: Khi không cấu hình `TURSO_DATABASE_URL`, ứng dụng dùng SQLite cục bộ (`data/gonoifc.sqlite` hoặc biến môi trường local).

### 3.2. Biến Môi Trường Bắt Buộc Trên Vercel
- `TURSO_DATABASE_URL`: URL Turso LibSQL (tách biệt theo scope Preview-only và Production-only).
- `TURSO_AUTH_TOKEN`: Token truy cập Turso (tách biệt theo scope Preview-only và Production-only).
- `AUTH_SECRET`: Khóa ký session HMAC (tách biệt giữa Preview và Production).

### 3.3. Quy Trình Kiểm Thử & Rollback Chuẩn
- Trước khi merge lên `main`, chạy đủ: `npm test`, `npm run lint`, `npx tsc --noEmit`, và `npm run build` (cô lập env).
- Luôn sao lưu Production DB ra ngoài repo trước khi thực hiện thao tác rủi ro cao; khi cần khôi phục bản phát hành trước, rollback về commit ổn định trước đó trên `main` hoặc promote deployment ổn định trên Vercel.
