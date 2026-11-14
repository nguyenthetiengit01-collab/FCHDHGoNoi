# FC HĐH GÒ NỔI — HỆ THỐNG QUẢN LÝ ĐỘI BÓNG ĐỒNG HƯƠNG

<p align="center">
  <img src="public/images/logo.jpg" alt="Logo FC HĐH Gò Nổi" width="120" style="border-radius: 50%; border: 3px solid #d4af37;" />
</p>

<p align="center">
  <strong>Website chính thức câu lạc bộ bóng đá FC Hội Đồng Hương Gò Nổi tại TP. Hồ Chí Minh</strong><br />
  Nơi kết nối con em 3 xã Điện Quang, Điện Trung, Điện Phong cũ • Đại diện xã Gò Nổi, TP. Đà Nẵng
</p>

<p align="center">
  <a href="https://fchdhgonoi.vercel.app">
    <img src="https://img.shields.io/badge/Production-fchdhgonoi.vercel.app-10b981?style=for-the-badge&logo=vercel" alt="Production Website" />
  </a>
  <img src="https://img.shields.io/badge/Next.js-15.5_(App_Router)-000000?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Turso-LibSQL_Cloud-00ffff?style=for-the-badge&logo=sqlite" alt="Turso Cloud" />
  <img src="https://img.shields.io/badge/Tests-Vitest_Passed-emerald?style=for-the-badge" alt="Vitest Tests" />
</p>

---

## 📖 1. Câu Chuyện Thương Hiệu & Cội Nguồn CLB

* **Tên đội bóng chính thức**: **FC HĐH Gò Nổi tại TP.HCM**.
* **Địa danh hành chính hiện tại**: **Xã Gò Nổi • TP. Đà Nẵng** (sau mốc sáp nhập hành chính).
* **Cội nguồn quê quán cầu thủ (ngữ cảnh lịch sử)**: **Gò Nổi – Điện Bàn – Quảng Nam (cũ)** gồm 3 xã cũ **Điện Quang - Điện Trung - Điện Phong**.
* **Triết lý hiển thị**:
  * Tên 3 xã cũ được giữ nguyên vẹn trong hồ sơ cá nhân và thẻ VĐV để anh em biết rõ xóm làng của nhau và luôn tự hào về gốc gác.
  * Tên đại diện cho toàn bộ CLB trên Banner, Lịch thi đấu, Header và Chân trang là: `Xã Gò Nổi • TP. Đà Nẵng`.
  * Khẩu hiệu xuyên suốt: **"Đá phủi hết mình • Đoàn kết • Nghĩa tình • Hướng về quê hương"**.

---

## ⚡ 2. Các Tính Năng Nổi Bật

### 🌐 Cổng Thông Tin Khách & Người Hâm Mộ (`PublicGuestPortal`)
* **Bảng Tỷ Số Truyền Hình Trực Tuyến**: Cập nhật trận đấu kế tiếp, tỷ số trực tiếp, sân đấu và số lượng cầu thủ báo danh.
* **Tải Poster Đội Hình Ra Sân (PNG)**: Tạo ảnh đồ họa sắc nét chỉ trong 1 chạm để gửi ngay vào Zalo điểm danh thi đấu.
* **Đội Hình 24+ Chiến Binh**: Xem danh sách đội hình theo vị trí, tra cứu cầu thủ và xem thẻ vận động viên phóng to.
* **Tạp Chí Thể Thao & Kỷ Niệm Hoạt Động**: Lưu trữ tin tức các giải phủi, giao lưu kết nối, phóng sự ảnh WebP chất lượng cao và phân loại theo niên khóa (2024, 2025, 2026).
* **Tối Ưu Mobile Toàn Diện**: Có Mobile Navigation Drawer trượt mượt mà và thanh nhảy nhanh chuyên mục (Sticky Quick-Jump Bar).

### 🏆 Hệ Thống Nhà Tài Trợ & Đối Tác (`SponsorsTab`)
* **Phân cấp 5 hạng tài trợ**: Kim Cương (Title), Vàng (Gold), Bạc (Silver), Đối Tác (Partner), Đơn Vị Hỗ Trợ (Supporter).
* **Banner Trang Chủ Xoay Vòng**: Tự động hiển thị và xoay chuyển theo hạn định ngày bắt đầu/kết thúc tài trợ.
* **Lưu danh lâu dài**: Hàng logo tri ân đối tác ở chân trang và khu vực đối tác vinh danh trang trọng.

### 💰 Thu Tiền Trận Bằng Phiếu Thu Tạm 0ms Batch (`CollectionTab`)
* **Phản hồi tức thì 0ms**: Bấm thu tiền cầu thủ không làm giật lag hay reload giao diện.
* **Cơ chế lưu nháp an toàn**: Lưu tạm vào `localStorage`, thanh cố định đáy màn hình hiển thị danh sách và số tiền thu dự kiến.
* **Lưu 1 lần duy nhất**: Nút "Lưu Phiếu Thu (N)" chỉ gửi đúng 1 transaction batch lên Turso Cloud CSDL.

### 🪪 Thẻ Vận Động Viên Truyền Hình (`BroadcastAthleteCard`)
* Thiết kế chuẩn thể thao cao cấp theo tỉ lệ 70% Navy sâu, 25% Slate kỹ thuật, 5% Vàng Hoàng Gia.
* Huy hiệu vị trí sân: `GK` (Xanh lá), `DF` (Xanh dương), `MF` (Vàng), `FW` (Đỏ), `ĐN` (Tím).
* Hỗ trợ chọn ảnh bìa ngang từ kho ảnh hoạt động của chính cầu thủ.
* Modal cắt ảnh chân dung 1:1 (`AvatarCropperModal`) nén WebP tự động.

### 📊 Minh Bạch Tài Chính & Sổ Quỹ Thu Chi (`FinanceTab` & `MatrixTab`)
* Sổ cái thu chi công khai từng khoản tiền sân, nước uống, bóng thi đấu kèm hóa đơn/chứng từ.
* Bảng ma trận đối soát toàn bộ tiền đóng quỹ của từng cầu thủ qua tất cả các trận đấu trong năm.
* Xuất và Nhập bảng tính Excel 5 sheets chuẩn format GONOIFC.

---

## 🛠️ 3. Công Nghệ Sử Dụng

* **Frontend**: Next.js 15.5 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
* **Backend**: Next.js Route Handlers, Node.js (22.x+).
* **Database**: Turso LibSQL Cloud SQLite (`@libsql/client`), có SQLite cục bộ dự phòng cho môi trường dev/test.
* **Image & Excel Pipeline**: Sharp (Server) + HTML5 Canvas (Client) tự động nén `.webp`; SheetJS `xlsx@0.20.3` cho xuất/nhập Excel.
* **Testing & Quality**: Vitest, ESLint v9 Flat Config, TypeScript (`tsc --noEmit`).
* **Deployment**: Vercel Serverless Hosting (`https://fchdhgonoi.vercel.app`).

---

## 🚀 4. Hướng Dẫn Cài Đặt & Phát Triển Cục Bộ

### 4.1. Yêu cầu môi trường
* Node.js version **22.x** trở lên.
* Trình quản lý gói `npm`.

### 4.2. Cài đặt các gói phụ thuộc
```bash
git clone https://github.com/nguyenthetiengit01-collab/FCHDHGoNoi.git
cd FCHDHGoNoi
npm install
```

### 4.3. Cấu hình biến môi trường (`.env.local`)
Tạo tệp `.env.local` tại thư mục gốc với nội dung:
```env
TURSO_DATABASE_URL=libsql://your-db-url.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token_here
AUTH_SECRET=your_secret_key_here
```
*(Nếu không đặt `TURSO_DATABASE_URL`, ứng dụng sẽ dùng SQLite cục bộ cho môi trường dev/test).*

### 4.4. Khởi chạy máy chủ phát triển (Dev Server)
```bash
npm run dev
```
Mở trình duyệt tại địa chỉ `http://localhost:3000`.

---

## 🧪 5. Kiểm Thử & Biên Dịch Dự Án

### Chạy Unit & Integration Tests (Vitest)
```bash
npm test
```

### Kiểm tra lỗi cú pháp (Lint)
```bash
npm run lint
```

### Chuyển đổi toàn bộ ảnh sang WebP
```bash
npm run process:images
```

### Biên dịch bản phát hành (Production Build)
```bash
npm run build
```

---

## 📂 6. Tài Liệu Kỹ Thuật Bổ Sung

* [**`PROJECT_STRUCTURE.md`**](./PROJECT_STRUCTURE.md): Sơ đồ cây thư mục chi tiết, giải thích vai trò từng tệp tin và kiến trúc CSDL.
* [**`GLOSSARY.md`**](./GLOSSARY.md): Từ điển chuẩn hóa thuật ngữ nghiệp vụ bóng đá, phân quyền và câu chuyện thương hiệu.
* [**`AGENTS.md`**](./AGENTS.md): Tiêu chuẩn kỹ thuật, nguyên tắc thiết kế 70-25-5 và quy định vận hành cho AI Agents.
* [**`docs/data-contracts.md`**](./docs/data-contracts.md): Hợp đồng dữ liệu PUBLIC / PLAYER / MANAGER, sanitization và error responses.
* [**`docs/operations-and-roles.md`**](./docs/operations-and-roles.md): Hướng dẫn sử dụng cho Player, Ban Quản Lý (Manager) và quy trình vận hành.
* [**`docs/adr/0001-turso-libsql-and-webp-pipeline.md`**](./docs/adr/0001-turso-libsql-and-webp-pipeline.md): Báo cáo quyết định kiến trúc CSDL Turso Cloud và đường ống xử lý ảnh WebP.
