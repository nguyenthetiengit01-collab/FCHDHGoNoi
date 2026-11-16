# Phase 3.1 — UX Audit Report

- **Project**: FC HĐH Gò Nổi tại TP.HCM (`FCHDHGoNoi`)
- **Branch**: `feat/phase-3.1-ux-audit-design-system`
- **Baseline**: `origin/main` (`7ae59cb10f6bae62baaf2d7cdbc243652764751f`)
- **Scope**: Audit toàn diện UX, UI consistency, Accessibility (WCAG 2.2 AA), và Mobile usability cho 3 nhóm người dùng (**Guest / Fan**, **Player**, **Manager**). Tài liệu chỉ phục vụ đánh giá và chuẩn hóa — **không** thay đổi business logic, database schema, hay auth/authorization.

---

## 1. Page & Role Inventory

### 1.1 Public Routes & Standalone Pages (`src/app/`)

| Route | Component / File chính | Vai trò truy cập | Mục đích & Chức năng |
| :--- | :--- | :--- | :--- |
| `/` | `src/app/page.tsx` → `TeamManagerApp.tsx` | Guest / Player / Manager | Cổng chính (Guest Portal khi chưa đăng nhập; Workspace điều hành theo tab khi đã đăng nhập). |
| `/hoat-dong` | `src/app/hoat-dong/page.tsx` | All (Public) | Danh sách bài viết hoạt động, tin tức, bộ sưu tập ảnh CLB. |
| `/hoat-dong/[id]` | `src/app/hoat-dong/[id]/page.tsx` | All (Public) | Chi tiết bài viết hoạt động & gallery ảnh. |
| `/cau-thu/[id]` | `src/app/cau-thu/[id]/page.tsx` → `PlayerProfileClient.tsx` | All (Public) | Hồ sơ VĐV truyền hình (`BroadcastAthleteCard`), chỉ số cá nhân công khai. |
| `/bao-cao-tai-chinh` | `src/app/bao-cao-tai-chinh/page.tsx` | All (Public) | Báo cáo tài chính công khai (thu/chi minh bạch không lộ thông tin nhạy cảm). |
| `/nha-tai-tro` | `src/app/nha-tai-tro/page.tsx` | All (Public) | Trang vinh danh nhà tài trợ & mạnh thường quân. |
| `/cau-chuyen-go-noi` | `src/app/cau-chuyen-go-noi/page.tsx` | All (Public) | Câu chuyện thương hiệu, bản sắc Xã Gò Nổi • TP. Đà Nẵng & 3 xã cũ. |
| `/offline` | `src/app/offline/page.tsx` | All (PWA Fallback) | Trang fallback khi mất kết nối mạng. |

### 1.2 Authenticated Workspace Tabs (`TeamManagerApp.tsx`)

| Tab ID | Component | Player | Manager | Ghi chú |
| :--- | :--- | :---: | :---: | :--- |
| `public` | `PublicGuestPortal.tsx` | ✓ | — | Manager không hiển thị tab `public` trên nav chính (có thể đăng xuất để về Guest). |
| `schedule` | `ScheduleTab.tsx` | ✓ | ✓ | Lịch thi đấu, điểm danh RSVP (Player), tạo/sửa/xoá trận & xác nhận ra sân (Manager). |
| `collection` | `CollectionTab.tsx` | — | ✓ | Thu tiền quỹ theo trận đấu, đối chiếu trạng thái đóng tiền. |
| `personal` | `PlayerPersonalTab.tsx` | ✓ | ✓ | Hồ sơ cá nhân, cập nhật thông tin tự quản (`update_own_profile`), đổi PIN. |
| `players` | `PlayersTab.tsx` | ✓ | ✓ | Danh sách đội hình, bộ lọc vị trí/trạng thái; Manager có thêm CRUD cầu thủ & reset PIN. |
| `dashboard` | `DashboardTab.tsx` | ✓ | ✓ | Thống kê tổng quan quỹ, chuyên cần, top ra sân. |
| `matrix` | `MatrixTab.tsx` | ✓ | ✓ | Ma trận điểm danh & đóng quỹ theo từng cầu thủ × từng trận. |
| `finance` | `FinanceTab.tsx` | — | ✓ | Sổ chi tiêu, khoản thu ngoài, thêm/sửa/xoá giao dịch quỹ. |
| `sponsors` | `SponsorsTab.tsx` | — | ✓ | Quản lý danh sách nhà tài trợ & mức đóng góp. |
| `posts` | `ClubPostsTab.tsx` | ✓ | ✓ | Xem và quản lý bài viết hoạt động CLB (Manager tạo/sửa/xoá). |

---

## 2. Executive Summary & Audit Findings (P0 / P1 / P2)

### Mức độ nghiêm trọng (Severity Scale)
- **P0 (Critical)**: Ảnh hưởng trực tiếp tới Accessibility (keyboard trap/focus), khả năng thao tác trên mobile hoặc gây gián đoạn luồng tác vụ cốt lõi.
- **P1 (High)**: Gây thiếu nhất quán nghiêm trọng về UX/UI, lặp code, sai lệch design system hoặc trải nghiệm kém trên form/table/feedback.
- **P2 (Medium / Polish)**: Cải thiện tinh chỉnh thẩm mỹ, chuẩn hóa token, tối ưu micro-interaction.

### Bảng tổng hợp các phát hiện chính

| ID | Mức độ | Nhóm vấn đề | Vai trò bị ảnh hưởng | Bằng chứng (File & Line) |
| :--- | :---: | :--- | :--- | :--- |
| **UX-01** | **P0** | Modal không dùng `<dialog>` (`showModal()`), thiếu native focus-trap & `inert` backdrop | All (Keyboard / Screen Reader) | `src/components/LoginModal.tsx:126`, `src/components/ImageLightboxModal.tsx:103`, `src/components/TeamManagerApp.tsx:938` |
| **UX-02** | **P0** | Dùng `window.confirm()` & `alert()` chặn luồng UI thay vì `ConfirmDialog` & toast/inline error | Manager | `ClubPostsTab.tsx:340`, `ScheduleTab.tsx:254`, `SponsorsTab.tsx:96,121,135,144`, `TeamManagerApp.tsx:260,287,306,318` |
| **UX-03** | **P1** | Thiếu `<a href="#main-content" className="skip-link">` trên toàn bộ các trang standalone ngoài `/` | Guest / Player / Manager | `src/app/bao-cao-tai-chinh/page.tsx`, `src/app/cau-chuyen-go-noi/page.tsx`, `src/app/hoat-dong/page.tsx`, `src/app/nha-tai-tro/page.tsx`, `src/components/PlayerProfileClient.tsx` |
| **UX-04** | **P1** | Component library `src/components/ui/` mới được adopt ở 6/15+ component chính; còn lại viết raw HTML/Tailwind rời rạc | All | Chỉ có `CollectionTab`, `DashboardTab`, `FinanceTab`, `MatrixTab`, `PlayersTab`, `ScheduleTab` import `./ui` hoặc `@/components/ui` |
| **UX-05** | **P1** | `FormField` không tự động gắn `aria-describedby` / `aria-invalid` cho input con nếu caller không tự gọi `useFieldIds()` | Player / Manager | `src/components/ui/FormControls.tsx:14-60` |
| **UX-06** | **P1** | Bảng dữ liệu tài chính & ma trận rộng trên mobile chỉ dựa vào horizontal scroll, thiếu sticky header/column hoặc card fallback | Manager / Player | `FinanceTab.tsx:719,892`, `MatrixTab.tsx`, `src/app/globals.css` (`.ds-table-wrap`) |
| **UX-07** | **P1** | Xung đột màu focus ring: `ModalDialog` close button dùng `outline-emerald-600`, trong khi global `:focus-visible` dùng `var(--brand-gold)` | All | `src/components/ModalDialog.tsx:97` vs `src/app/globals.css:202-205` |
| **UX-08** | **P1** | Phân mảnh 2 hệ thống nền (Dark Navy cho Public Pages vs Light Slate cho Workspace) với >350 mã màu hex hardcode rải rác | All | `page.tsx` (124 hex), `PublicGuestPortal.tsx` (57), `DashboardTab.tsx` (42), `FinanceTab.tsx` (28), `PlayersTab.tsx` (28), `ScheduleTab.tsx` (27) |
| **UX-09** | **P2** | Vi phạm quy chuẩn bo góc 8–12px (`AGENTS.md`): sử dụng `rounded-3xl` (24px) tạo cảm giác "bong bóng" | Guest / Fan | `src/app/hoat-dong/page.tsx:317,352,556` |
| **UX-10** | **P2** | Dot điều hướng banner trên `PublicGuestPortal` chỉ đạt `min-h-6 min-w-6` (24px), sát ngưỡng tối thiểu WCAG 2.2, khó bấm bằng ngón cái trên mobile | Guest / Fan | `src/components/PublicGuestPortal.tsx:923` |
| **UX-11** | **P2** | Không nhất quán giữa `.bg-brand-navy` (`!important` override trong `globals.css`) và utility classes Tailwind | Dev / UI Consistency | `src/app/globals.css:21-27` |

---

## 3. Detailed Audit by Role & UX Dimension

### 3.1 Role: Guest / Fan
- **Information Architecture & Navigation**:
  - Trang chủ `/` (`PublicGuestPortal.tsx`) có đầy đủ landmarks (`<header>`, `<nav aria-label="Điều hướng trang khách">`, `<nav aria-label="Thanh nhảy nhanh chuyên mục">`, `<main>` từ `TeamManagerApp.tsx`, `<footer>`), phân cấp `<h1>` → `<h2>` rõ ràng (`PublicGuestPortal.tsx:695`).
  - **Vấn đề (`UX-03`)**: Khi Guest điều hướng sang `/hoat-dong`, `/bao-cao-tai-chinh`, `/nha-tai-tro`, `/cau-chuyen-go-noi`, `/cau-thu/[id]`, không có `skip-link` ở đầu trang (riêng `/hoat-dong/page.tsx:200` có `<main id="main-content">` nhưng thiếu thẻ `<a href="#main-content" className="skip-link">`).
- **Visual Hierarchy & Design Consistency**:
  - Sử dụng nền navy sâu đúng tinh thần `AGENTS.md` (70-25-5) và không có gradient tím-hồng AI generic.
  - **Vấn đề (`UX-08`, `UX-09`)**: Dùng quá nhiều biến thể hex navy hardcode (`#040e1a`, `#040e1e`, `#030912`, `#081a33`, `#092244`, `#0b2952`, `#071933`) và `rounded-3xl` tại `src/app/hoat-dong/page.tsx:317,352,556`.
- **Mobile Usability**:
  - **Vấn đề (`UX-10`)**: Nút chấm chuyển banner (`PublicGuestPortal.tsx:923`) dùng `min-h-6 min-w-6` (24×24px). Nên nâng vùng chạm (`hit area`) lên tối thiểu `min-h-10 min-w-10` (40–44px) trong khi giữ visual dot nhỏ bên trong.

### 3.2 Role: Player
- **Navigation & Wayfinding**:
  - `TeamManagerApp.tsx` có `skip-link` (dòng 497), Desktop top tabs (`navItems`, dòng 625-649) với `aria-current="page"`, Mobile Bottom Navigation Bar (dòng 860+) ưu tiên Điểm danh (`schedule`) và nút "Thêm" mở Mobile More Menu (`role="dialog"`, dòng 938).
  - **Vấn đề (`UX-01`)**: Mobile More Menu (`TeamManagerApp.tsx:938`) và `LoginModal.tsx` (`role="dialog"`, dòng 126) tự render `<div>` overlay thay vì dùng `ModalDialog` (`<dialog showModal()`). Điều này khiến keyboard user có thể Tab xuyên ra ngoài modal xuống nội dung nền phía sau.
- **Forms & Feedback**:
  - `PlayerPersonalTab.tsx` và `ScheduleTab.tsx` dùng form thuần chưa qua `src/components/ui/FormControls.tsx` (`FormField`, `Input`, `Select`, `Textarea`).
  - **Vấn đề (`UX-05`)**: Ngay cả khi dùng `FormField` (`src/components/ui/FormControls.tsx`), lỗi validation hiện chỉ render `<p role="alert">` mà không tự inject `aria-invalid="true"` và `aria-describedby` vào input bên trong trừ khi caller gọi thủ công `useFieldIds()`.

### 3.3 Role: Manager
- **Operational Workflows & Modals (`UX-02` - P0)**:
  - Mặc dù `src/components/ui/StateViews.tsx` đã cung cấp `ConfirmDialog` (built on `ModalDialog` với nút confirm/cancel rõ ràng, hỗ trợ `danger` variant và loading state), nhiều luồng quản trị quan trọng vẫn gọi hàm blocking native của trình duyệt:
    - `ClubPostsTab.tsx:340`: `!window.confirm(...)` khi xoá bài viết.
    - `ScheduleTab.tsx:254`: `window.confirm(...)` khi xoá trận đấu.
    - `SponsorsTab.tsx:96` (`window.confirm`), `121, 135, 144` (`alert`).
    - `TeamManagerApp.tsx:260, 287, 306, 318`: `alert(...)` cho các thông báo lỗi/trạng thái hệ thống.
  - **Tác động**: Trải nghiệm giật cục trên PWA/iOS standalone mode, không đồng bộ thương hiệu, và không kiểm soát được focus sau khi đóng.
- **Tables & Data Density (`UX-06` - P1)**:
  - `FinanceTab.tsx` (dòng 719, 892) và `MatrixTab.tsx` hiển thị bảng nhiều cột trong `.overflow-x-auto`. Trên màn hình 360px–390px, người dùng phải cuộn ngang liên tục mà thiếu chỉ báo cuộn hoặc sticky cột tên/ngày.
- **Loading / Empty / Error States (`UX-04`)**:
  - `EmptyState` đã được áp dụng tốt ở `FinanceTab`, `PlayersTab`, `ScheduleTab`, `MatrixTab`, `CollectionTab`. Tuy nhiên `LoadingState` và `ErrorState` chưa được dùng đồng đều ở `ClubPostsTab.tsx`, `SponsorsTab.tsx`, `PlayerPersonalTab.tsx`.

---

## 4. Acceptance Criteria (Cho các Phase triển khai tiếp theo)

1. **Zero Native Blocking Popups (`UX-02`)**: 100% `window.confirm()` và `alert()` trong `src/components/` được thay bằng `ConfirmDialog` và hệ thống Toast / `ErrorState`.
2. **Unified Native Dialog Accessibility (`UX-01`, `UX-07`)**: `LoginModal`, `ImageLightboxModal`, và Mobile More Menu sử dụng `<dialog>` (`ModalDialog`) hoặc focus-trap chuẩn WCAG 2.2 AA; 100% focus ring dùng `var(--brand-gold)`.
3. **Skip Link Everywhere (`UX-03`)**: Mọi route trong `src/app/` đều có `<a href="#main-content" className="skip-link">` trỏ tới `<main id="main-content">`.
4. **UI Primitive Adoption (`UX-04`, `UX-05`)**: `ClubPostsTab`, `SponsorsTab`, `PlayerPersonalTab` chuyển sang dùng `@/components/ui` (`Button`, `Card`, `Badge`, `FormField`, `LoadingState`, `EmptyState`, `ErrorState`); `FormField` tự động nối `aria-describedby` & `aria-invalid` cho control con.
5. **Token Compliance (`UX-08`, `UX-09`)**: Giảm >80% hardcoded hex trong TSX bằng semantic tokens; loại bỏ hoàn toàn `rounded-3xl`, giữ radius trong khoảng `8px–12px` (`rounded-lg` / `rounded-xl`).

---

## 5. Cross-Device Test Matrix (Desktop / Tablet / Mobile)

| Flow / Màn hình | Desktop (`1440×900`) | Tablet (`768×1024`) | Mobile (`390×844`) | Tiêu chí kiểm tra chính |
| :--- | :--- | :--- | :--- | :--- |
| **Guest Portal (`/`)** | Full hero + sticky nav 1 hàng | Nav không tràn chữ | Hamburger menu + card 1 cột, dot banner `>=40px` touch target | Không tràn ngang (`scrollWidth <= innerWidth`), contrast >= 4.5:1 |
| **Hoạt động (`/hoat-dong`)** | Grid 3 cột, radius `12px` | Grid 2 cột | Grid 1 cột, ảnh `.webp` đúng tỉ lệ | Skip-link hoạt động khi nhấn `Tab`, focus ring Gold rõ |
| **Login Flow (`LoginModal`)** | Dialog căn giữa, CapsLock warning | Dialog vừa khung | Không bị bàn phím ảo che nút Submit | Focus trap trong modal, `Esc` đóng và trả focus về trigger |
| **Player RSVP (`ScheduleTab`)** | Bảng/Card 2 cột rõ trạng thái | Responsive card | Sticky/dễ chạm nút Có mặt / Vắng (`min-h-11`) | Phản hồi optimistic/toast rõ ràng (`aria-live="polite"`) |
| **Manager Finance (`FinanceTab`)** | Bảng Thu/Chi đầy đủ cột + filter | Scroll ngang mượt, header rõ | Summary card nổi bật, nút Sửa/Xoá `>=44px`, dùng `ConfirmDialog` | Không còn `window.confirm`/`alert`, xóa/sửa an toàn |
| **Manager Matrix (`MatrixTab`)** | Ma trận cầu thủ × trận | Sticky cột tên cầu thủ | Sticky cột tên + chỉ báo cuộn ngang | Dễ đọc số liệu, không lệch hàng |
