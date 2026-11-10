# FC HĐH Gò Nổi — Agent Rules & Engineering Standards

Hệ thống quản lý đội bóng FC Hội Đồng Hương Gò Nổi. Website phục vụ quản lý chuyên cần thi đấu, tài chính minh bạch, hồ sơ vận động viên truyền hình và lưu trữ kỷ niệm dài hạn cho hội đồng hương.

## Tech Stack & Architecture

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4.
- **Database**: Turso LibSQL (Cloud SQLite) kết nối qua `@libsql/client`.
- **Media Pipeline**: Tự động chuyển đổi mọi hình ảnh upload sang định dạng `.webp` nhẹ và sắc nét (2 tầng: Client Canvas qua `imageToWebp.ts` + Server Node qua `sharp`).
- **Icons**: `lucide-react`.

## Visual Identity & Design Guidelines

- **Bảng màu 70-25-5 chuyên nghiệp**:
  - 70% Nền sẫm thể thao / Navy sâu (`#040e1a` - `#081a33` - `#0b2447`).
  - 25% Trắng & Slate xám kỹ thuật (`text-slate-100`, `text-slate-300`, `border-white/10`).
  - 5% Điểm nhấn Vàng Hoàng Gia Gò Nổi (`#d4af37` / `#fde047`) & Xanh sân cỏ Emerald.
- **Huy hiệu vị trí kỹ thuật**:
  - `GK` (Thủ môn): Xanh lá Emerald
  - `DF` (Hậu vệ): Xanh dương Blue
  - `MF` (Tiền vệ): Vàng hổ phách Amber
  - `FW` (Tiền đạo): Đỏ hồng Rose
  - `ĐN` (Đa năng): Tím Purple
- **Tránh vibe website AI**:
  - Tuyệt đối tránh gradient tím hồng generic, bo tròn quá đà 32px kiểu bong bóng.
  - Sử dụng góc bo sắc nét (8px - 12px), typography kỹ thuật, border tương phản tinh tế.

## Security & Permission Boundaries

- **Khách (Guest)**: Chỉ xem trang chủ (`PublicGuestPortal`), danh sách cầu thủ công khai và bài viết hoạt động. Không xem được SĐT, mã PIN hay thao tác sửa.
- **Cầu thủ (Player)**: Chỉ được phép sửa thông tin cá nhân của chính mình (`update_own_profile`), đổi mã PIN của mình và điểm danh RSVP trước trận.
- **Ban Quản Lý (Manager)**: Được phép thu tiền quỹ, xác nhận ra sân thực tế, quản lý toàn bộ thành viên, reset mã PIN và tạo bài viết mới.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `nguyenthetiengit01-collab/FCHDHGoNoi`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repository. See `docs/agents/domain.md` and `GLOSSARY.md`.

