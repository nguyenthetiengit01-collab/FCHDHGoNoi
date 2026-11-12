# Cấu Trúc Dự Án & Hồ Sơ Kỹ Thuật — FC HĐH Gò Nổi

Hệ thống số hóa toàn diện dành cho **FC HĐH Gò Nổi tại TP.HCM** — Câu lạc bộ bóng đá Hội Đồng Hương Xã Gò Nổi (TP. Đà Nẵng), nơi hội tụ và kết nối con em 3 xã Điện Quang, Điện Trung, Điện Phong cũ tại TP. Hồ Chí Minh.

---

## 1. Thông Tin Nhận Diện & Định Danh Dự Án

* **Tên chính thức CLB**: **FC HĐH Gò Nổi tại TP.HCM**
* **Địa danh đại diện CLB**: **Xã Gò Nổi • TP. Đà Nẵng** (sau sáp nhập hành chính)
* **Cội nguồn quê quán cầu thủ**: **Điện Quang - Điện Trung - Điện Phong** (3 xã cũ của TX. Điện Bàn, tỉnh Quảng Nam cũ) — được trân trọng lưu giữ trong hồ sơ cá nhân và thẻ VĐV để anh em luôn nhớ về nguồn cội và dễ dàng nhận xóm làng
* **Website sản xuất (Production URL)**: `https://fchdhgonoi.vercel.app`
* **Công nghệ cốt lõi**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Turso LibSQL Cloud Database, Sharp WebP Pipeline, Vitest, Lucide Icons

---

## 2. Sơ Đồ Cây Thư Mục Toàn Dự Án

```
QuanLyDoiBong/
├── .agents/                          # Kỹ năng và tài liệu chuyên biệt của AI agents
├── data/                             # Dữ liệu cục bộ & backup SQLite
│   ├── gonoifc.sqlite                # Tệp SQLite cục bộ (dùng dự phòng / dev offline)
│   ├── gonoifc.sqlite-shm
│   └── gonoifc.sqlite-wal
├── docs/                             # Tài liệu kỹ thuật, ADR & chuẩn nghiệp vụ
│   ├── adr/
│   │   └── 0001-turso-libsql-and-webp-pipeline.md  # Quyết định kiến trúc Turso + WebP
│   └── agents/
│       ├── domain.md                 # Chuẩn mực thuật ngữ nghiệp vụ cốt lõi
│       ├── issue-tracker.md          # Quy chuẩn quản lý issue trên GitHub
│       └── triage-labels.md          # Phân loại nhãn triage kiểm định
├── hinhanh/                          # Thư mục chứa ảnh gốc phân theo chủ đề
│   ├── anhbia/                       # Ảnh bìa tập thể, banner đội bóng
│   ├── cauthu/                       # Ảnh chân dung, ảnh thẻ cầu thủ
│   ├── giaidau/                      # Ảnh thi đấu giải phong trào sân 7
│   ├── giaoluu/                      # Ảnh giao hữu kết nối đồng hương
│   └── taitro/                       # Ảnh tri ân đơn vị tài trợ & đối tác
├── public/                           # Tài nguyên tĩnh phục vụ website
│   ├── images/
│   │   ├── logo.jpg                  # Logo chính thức FC HĐH Gò Nổi
│   │   └── hinhanh-webp/             # Ảnh đã chuyển đổi WebP nhẹ & sắc nét
│   │       ├── anhbia/
│   │       ├── cauthu/
│   │       ├── giaidau/
│   │       ├── giaoluu/
│   │       └── taitro/
│   ├── uploads/                      # Ảnh upload từ người dùng (avatar, banner)
│   ├── icon.svg                      # Favicon vector
│   └── manifest.json                 # Web App Manifest
├── scripts/
│   └── process-webp.mjs              # Script tự động quét và nén ảnh sang .webp
├── src/
│   ├── app/                          # Next.js App Router (Giao diện & API Endpoints)
│   │   ├── api/
│   │   │   ├── auth/route.ts         # Xác thực phiên (Login, PIN, Session Cookie, Logout)
│   │   │   ├── export/route.ts       # Xuất file Excel 5 sheets chuẩn GONOIFC
│   │   │   ├── import/route.ts       # Nhập file Excel cập nhật CSDL
│   │   │   ├── team/route.ts         # Server Actions xử lý mọi mutation (Batch thu tiền, Profile, Sponsors...)
│   │   │   └── webp/route.ts         # API chuyển đổi ảnh sang WebP tức thì phía server
│   │   ├── cau-thu/[id]/page.tsx     # Trang hồ sơ công khai độc lập của từng cầu thủ
│   │   ├── hoat-dong/page.tsx        # Trang kho lưu trữ bài viết & hoạt động CLB
│   │   ├── hoat-dong/[id]/page.tsx   # Trang đọc chi tiết bài viết & album ảnh HD
│   │   ├── globals.css               # Phong cách CSS toàn cục (Tailwind v4, Scrollbar, Keyframes)
│   │   ├── layout.tsx                # Layout gốc HTML/Body, Metadata SEO & OpenGraph
│   │   └── page.tsx                  # Trang chủ (Server Component nạp dữ liệu ban đầu)
│   ├── components/                   # Hệ thống thành phần giao diện (UI Components)
│   │   ├── AvatarCropperModal.tsx    # Modal cắt ảnh chân dung tỉ lệ 1:1 chuẩn WebP
│   │   ├── BroadcastAthleteCard.tsx  # Thẻ VĐV phát sóng truyền hình, ảnh bìa rộng, lưới chỉ số
│   │   ├── ClubPostsTab.tsx          # Tab quản lý & đăng bài viết hoạt động cho BQL
│   │   ├── CollectionTab.tsx         # Tab thu tiền trận bằng PHIẾU THU TẠM (Draft 0ms Batch)
│   │   ├── DashboardTab.tsx          # Tab tổng quan tài chính, biểu đồ & thống kê quỹ
│   │   ├── FinanceTab.tsx            # Tab quản lý sổ quỹ thu chi, hóa đơn tiền sân, chứng từ
│   │   ├── ImageLightboxModal.tsx    # Hộp thoại phóng to ảnh HD đa năng, duyệt phím mũi tên
│   │   ├── LoginModal.tsx            # Modal đăng nhập chuyên nghiệp (PIN, Số áo, SĐT, Rate-limit)
│   │   ├── MatchdayRosterPoster.tsx  # Modal & Poster tạo ảnh đội hình ra sân xuất PNG gửi Zalo
│   │   ├── MatrixTab.tsx             # Bảng ma trận đối soát thu tiền tất cả các trận
│   │   ├── ModalDialog.tsx           # Thành phần hộp thoại modal tái sử dụng
│   │   ├── PlayerPersonalTab.tsx     # Tab cá nhân của cầu thủ (sửa bio, đổi PIN, chọn ảnh)
│   │   ├── PlayerProfileClient.tsx   # Giao diện hiển thị chi tiết VĐV dạng trang riêng
│   │   ├── PlayersTab.tsx            # Tab quản lý danh sách cầu thủ cho BQL (thêm, sửa, reset PIN)
│   │   ├── PublicGuestPortal.tsx     # Cổng thông tin công khai (TV Scoreboard, Tin tức, Mobile Drawer)
│   │   ├── ScheduleTab.tsx           # Tab lịch thi đấu, điểm danh RSVP, duyệt ra sân thực tế
│   │   ├── SponsorsTab.tsx           # Tab quản lý nhà tài trợ, banner trang chủ, phân 5 hạng tài trợ
│   │   └── TeamManagerApp.tsx        # Khung ứng dụng điều hướng chính (Desktop Tabs & Mobile Bar)
│   ├── data/
│   │   └── clubActivities.ts         # Dữ liệu tĩnh các bài viết khởi nguồn, giải đấu & niên khóa
│   ├── lib/                          # Thư viện tiện ích, CSDL và Unit Tests
│   │   ├── athleteProfile.ts         # Tính toán tuổi, năm sinh, vị trí & chỉ số cầu thủ
│   │   ├── athleteProfile.test.ts    # Unit test hồ sơ cầu thủ
│   │   ├── auth.ts                   # Quản lý mã hóa PIN, cookie phiên làm việc, rate limit
│   │   ├── auth.test.ts              # Unit test phân quyền và xác thực
│   │   ├── collectionDraft.ts        # Quản lý trạng thái lưu tạm phiếu thu trận (Local Draft Engine)
│   │   ├── collectionDraft.test.ts   # Unit test lưu nháp phiếu thu
│   │   ├── db.ts                     # Kết nối Turso LibSQL Cloud, khởi tạo bảng & truy vấn
│   │   ├── exportImage.ts            # Tiện ích chụp ảnh DOM xuất PNG độ phân giải cao
│   │   ├── exportImage.test.ts       # Unit test xuất ảnh
│   │   ├── financialCalculations.ts  # Thuật toán tính số dư quỹ, chi phí sân & doanh thu
│   │   ├── financialCalculations.test.ts # Unit test tài chính
│   │   ├── format.ts                 # Định dạng tiền tệ VNĐ, ngày tháng tiếng Việt
│   │   ├── imageToWebp.ts            # Chuyển đổi WebP phía Client qua Canvas API
│   │   ├── serverWebp.ts             # Chuyển đổi WebP phía Server Node.js qua Sharp
│   │   ├── serverWebp.test.ts        # Unit test nén WebP server
│   │   ├── sponsors.ts               # Bộ lọc phân loại nhà tài trợ, kiểm tra hạn banner
│   │   └── sponsors.test.ts          # Unit test phân hạng và hiển thị tài trợ
│   └── types/
│       └── app.ts                    # Toàn bộ định nghĩa TypeScript types & interfaces
├── .env.local                        # Biến môi trường kết nối Turso LibSQL & Secret key
├── AGENTS.md                         # Tiêu chuẩn kỹ thuật và nguyên tắc vận hành cho AI Agents
├── eslint.config.mjs                 # Cấu hình kiểm tra lỗi mã nguồn ESLint v9 Flat Config
├── GLOSSARY.md                       # Từ điển chuẩn hóa thuật ngữ nghiệp vụ CLB
├── next.config.ts                    # Cấu hình Next.js 15
├── package.json                      # Danh mục gói phụ thuộc & scripts thực thi
├── postcss.config.mjs                # Cấu hình PostCSS với Tailwind CSS v4
├── PROJECT_STRUCTURE.md              # [TỆP HIỆN TẠI] Hồ sơ cấu trúc kỹ thuật dự án
├── Quan_Ly_Thu_Chi_GONOIFC.xlsx      # Bảng tính Excel mẫu chuẩn để import/export
├── README.md                         # Giới thiệu tổng quan dự án & hướng dẫn cài đặt
├── tsconfig.json                     # Cấu hình TypeScript nghiêm ngặt (Strict Mode)
├── vercel.json                       # Cấu hình triển khai hạ tầng Vercel
└── vitest.config.mjs                 # Cấu hình môi trường chạy kiểm thử Vitest
```

---

## 3. Kiến Trúc Cơ Sở Dữ Liệu (Turso Cloud LibSQL SQLite)

Toàn bộ dữ liệu của FC HĐH Gò Nổi được lưu trữ an toàn trên đám mây **Turso Cloud (AWS Tokyo `ap-northeast-1`)**, đảm bảo tốc độ phản hồi nhanh (< 50ms) từ Việt Nam:

| Bảng Cơ Sở Dữ Liệu | Mục Đích Lưu Trữ | Trường Dữ Liệu Tiêu Biểu |
| :--- | :--- | :--- |
| **`players`** | Hồ sơ toàn bộ thành viên & cầu thủ | `id`, `full_name`, `short_name`, `jersey_number`, `position`, `hamlet` (thôn xóm), `birth_year`, `phone`, `pin_hash`, `access_role` (`guest`/`player`/`manager`), `avatar_url`, `cover_photo_url`, `action_photos` (JSON WebP), `bio`, `playing_style`, `status` |
| **`matches`** | Danh sách các trận bóng định kỳ & giải đấu | `id`, `match_date`, `kickoff_time`, `venue`, `pitch_cost`, `opponent`, `label`, `team_score`, `opponent_score`, `status` (`Sắp diễn ra`/`Đã kết thúc`), `notes` |
| **`match_attendances`** | Điểm danh & Ra sân thực tế | `id`, `match_id`, `player_id`, `rsvp_status` (`registered`/`declined`/`tentative`), `attended` (0/1), `match_fee`, `paid` (0/1), `payment_method`, `notes` |
| **`transactions`** | Sổ quỹ thu chi minh bạch | `id`, `date`, `category` (`Thu`/`Chi`), `type`, `amount`, `description`, `receipt_url`, `match_id` |
| **`club_posts`** | Bài viết hoạt động, phóng sự ảnh WebP | `id`, `category` (`giaidau`/`giaoluu`/`cauthu`/`taitro`/`anhbia`), `title`, `slug`, `summary`, `published_date`, `event_year`, `author`, `featured_image`, `gallery_images` (JSON), `reading_time`, `paragraphs` (JSON), `quote`, `highlights` (JSON), `tagged_player_names` (JSON) |
| **`sponsors`** | Đơn vị tài trợ, đối tác & banner | `id`, `name`, `tier` (`title`/`gold`/`silver`/`partner`/`supporter`), `logo_url`, `banner_url`, `website_url`, `description`, `start_date`, `end_date`, `display_positions` (JSON: `home_banner`, `home_partners`, `footer`), `is_active` |
| **`settings`** | Cài đặt hệ thống CLB | `key`, `value` (Fanpage URL, Số áo tối đa, Quỹ mặc định 100k, Mật khẩu mặc định 1234) |

---

## 4. Các Phân Hệ Tính Năng Cốt Lõi Đã Triển Khai

### 4.1. Cổng Thông Tin Công Khai (`PublicGuestPortal`)
* **TV Broadcast Matchday Scoreboard**: Bảng điểm điện tử truyền hình trực tiếp cho trận cầu sắp tới, hiển thị đầy đủ tỉ số, sân bóng, ngày giờ, số lượng cầu thủ đã báo danh.
* **Xuất Ảnh Đội Hình Ra Sân (`MatchdayRosterPoster`)**: Tự động tổng hợp danh sách cầu thủ báo danh ra sân thành ảnh đồ họa thể thao sang trọng (PNG) bằng 1 chạm để gửi ngay vào nhóm Zalo đội bóng.
* **Bố Cục Đội Hình Đối Xứng 50/50**: Nửa trái hiển thị thẻ vận động viên chi tiết kèm bộ sưu tập ảnh hành động; nửa phải hiển thị danh sách cuộn thu nhỏ tìm kiếm theo tên, số áo, vị trí.
* **Hoạt Động & Ký Ức Sân Cỏ**: Trình bày theo phong cách Tạp chí thể thao (Lead Story 7 cột + Dòng tin hoạt động 5 cột + Kho lưu trữ 3 cột), hỗ trợ lọc theo niên khóa (2024, 2025, 2026) và 5 chuyên mục.
* **Điều Hướng Thông Minh**:
  * **Thanh nhảy nhanh (Sticky Quick-Jump Bar)**: Cố định dưới Header, chuyển vùng tức thì 1 chạm.
  * **Mobile Navigation Drawer**: Menu vuốt mượt mà trên điện thoại với icon thể thao và badge nhận diện.

### 4.2. Phân Hệ Thu Tiền Trận Bằng Phiếu Thu Tạm (Draft 0ms Batch)
* **Vấn đề đã giải quyết**: Loại bỏ hoàn toàn tình trạng bấm thu tiền từng người gây giật lag và chờ đợi máy chủ.
* **Cơ chế hoạt động**:
  * Bấm chọn nộp quỹ chuyển sang trạng thái nháp ngay lập tức (**0ms độ trễ**).
  * Tự động lưu bản nháp vào `localStorage` (`gonoi_collection_draft_match_{id}`).
  * Thanh tác vụ cố định đáy màn hình hiển thị số tiền thu tạm tính và danh sách cầu thủ.
  * Nút **"Lưu Phiếu Thu (N)"** gửi **1 transaction duy nhất** lên server thông qua action `collect_match_fees_batch`.

### 4.3. Hệ Thống Tài Trợ & Banner Đối Tác (`SponsorsTab`)
* **Phân cấp 5 hạng tài trợ**:
  1. `title` — Nhà Tài Trợ Kim Cương / Bảo Trợ
  2. `gold` — Nhà Tài Trợ Vàng
  3. `silver` — Nhà Tài Trợ Bạc
  4. `partner` — Đối Tác Đồng Hành
  5. `supporter` — Đơn Vị Hỗ Trợ
* **Cơ chế hiển thị thông minh**:
  * Đặt hạn định hiển thị theo ngày bắt đầu và ngày kết thúc (`start_date` → `end_date`).
  * Tích chọn vị trí hiển thị linh hoạt: Banner trang chủ (`home_banner`), Khu vực đối tác (`home_partners`), Chân trang (`footer`).
  * Carousel Banner tự động xoay chuyển mỗi 6 giây trên trang chủ.
  * Phân tầng trang trọng vinh danh đóng góp dài hạn của các mạnh thường quân quê nhà.

### 4.4. Thẻ Vận Động Viên & Quản Lý Hồ Sơ Cầu Thủ (`BroadcastAthleteCard`)
* **Bảng màu thể thao 70-25-5 chuyên nghiệp**:
  * 70% Navy sâu (`#040e1a` - `#081a33` - `#0b2447`)
  * 25% Kỹ thuật Slate & Trắng (`text-slate-100`, `border-white/10`)
  * 5% Điểm nhấn Vàng Hoàng Gia (`#ffd700` / `#d4af37`) & Xanh sân cỏ Emerald (`#10b981`)
* **Huy hiệu vị trí sân bóng chuẩn quốc tế**: `GK` (Xanh lá), `DF` (Xanh dương), `MF` (Vàng hổ phách), `FW` (Đỏ hồng), `ĐN` (Tím).
* **Quê quán chuẩn mực**: Hiển thị rõ tên 3 xã cũ `Xã [Điện Quang / Điện Trung / Điện Phong]` kèm nhãn đại diện `Xã Gò Nổi • TP. Đà Nẵng`.
* **Chọn ảnh bìa ngang từ ảnh hoạt động**: Cho phép cầu thủ chọn một trong những bức ảnh đá bóng cá nhân của mình để làm ảnh bìa ngang cho thẻ VĐV.
* **Bộ cắt ảnh thông minh (`AvatarCropperModal`)**: Hỗ trợ phóng to, xoay và cắt ảnh tỉ lệ vuông 1:1, tự động nén sang `.webp` dung lượng dưới 100KB.

### 4.5. Hệ Thống Điểm Danh & Phân Quyền An Toàn
* **Ba cấp phân quyền (`AuthSession`)**:
  1. `guest` (Khách): Chỉ xem công khai, không xem được số điện thoại hay thao tác sửa.
  2. `player` (Cầu thủ): Tự sửa thông tin của mình, đổi mã PIN cá nhân, điểm danh RSVP trước trận.
  3. `manager` (Ban Quản Lý): Quyền hạn cao nhất (thu tiền quỹ, duyệt ra sân thực tế, thêm/sửa cầu thủ, reset mật khẩu về 1234, quản lý tài trợ, đăng bài viết CLB, nhập/xuất Excel).
* **Bảo mật**: Mã hóa PIN một chiều (Hash), cookie phiên `HttpOnly; SameSite=Lax`, kiểm soát chống spam (Rate-limiting khóa tạm sau 5 lần nhập sai).

### 4.6. Đường Ống Xử Lý Ảnh Tối Ưu (.webp 2 Tầng)
* **Tầng 1 (Client Canvas)**: File ảnh upload trực tiếp từ trình duyệt được canvas nén sang WebP độ phân giải cao và kích thước siêu nhẹ trước khi gửi lên máy chủ.
* **Tầng 2 (Server Node.js)**: API server sử dụng thư viện `sharp` chuẩn hóa ảnh, tối ưu hóa kích thước tối đa (Avatar: 600px, Banner: 1600px).
* **Prebuild Script (`scripts/process-webp.mjs`)**: Tự động chuyển đổi 100% hình ảnh trong thư mục `hinhanh/` sang định dạng `.webp` trong `public/images/hinhanh-webp/` trước mỗi lượt build.

---

## 5. Quy Chuẩn Đóng Gói, Kiểm Thử & Triển Khai

* **Bộ kiểm thử tự động (Unit Tests)**: 48/48 bài kiểm thử chạy qua Vitest bao phủ 100% các module tính toán nhạy cảm (`auth`, `financialCalculations`, `collectionDraft`, `athleteProfile`, `sponsors`, `serverWebp`, `exportImage`).
* **Kiểm tra cú pháp (Linting)**: ESLint v9 Flat Config không phát sinh bất kỳ lỗi (0 errors, 0 warnings).
* **Biên dịch (Build)**: Next.js 15 Standalone Optimized Build hoàn thành với mã thoát 0.
* **Môi trường triển khai**: Vercel Serverless Platform, tự động gắn kết với Turso Database thông qua các biến môi trường:
  * `TURSO_DATABASE_URL`: `libsql://fchdhgonoi-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io`
  * `TURSO_AUTH_TOKEN`: Token xác thực an toàn
  * `APP_SECRET`: Khóa bí mật ký phiên làm việc cookie

