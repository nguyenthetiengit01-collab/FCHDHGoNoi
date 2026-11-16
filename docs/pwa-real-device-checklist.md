# PWA Real-Device Verification Checklist — FC HĐH Gò Nổi

Tài liệu phân biệt rõ **kiểm thử tự động (Playwright/Vitest)** và **kiểm thử thủ công trên thiết bị thật** (Android Chrome & iOS Safari) cho `https://fchdhgonoi.vercel.app/`.

---

## 1. Phạm Vi Đã Kiểm Chứng Tự Động (Playwright + Vitest)
- [x] `GET /manifest.webmanifest` trả HTTP `200`, `display: "standalone"`, `theme_color: "#040e1a"`.
- [x] 4 icons (`/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) trả HTTP `200`.
- [x] `GET /sw.js` trả HTTP `200`, đăng ký thành công trên Production ở scope `/` trạng thái `activated`.
- [x] `CacheStorage` trên Production không chứa `/api/team` hay `/api/public/financial-report`.
- [x] Offline fallback `/offline` hiển thị khi ngắt mạng trong Playwright và điều hướng tới `/hoat-dong`.

---

## 2. Checklist Thiết Bị Thật — Android (Chrome)
*Mở `https://fchdhgonoi.vercel.app/` trên Chrome Android mới nhất:*

- [ ] **Cài đặt (Installability)**: Banner cài đặt PWA hoặc menu Chrome hiển thị tùy chọn **"Install app" / "Cài đặt ứng dụng"**.
- [ ] **Icon & Maskable**: Biểu tượng FC HĐH Gò Nổi hiển thị tròn/bo góc đúng safe-zone trên launcher Android (không bị cắt viền logo).
- [ ] **Chế độ Standalone**: Mở từ màn hình chính không còn thanh URL trình duyệt, thanh trạng thái dùng màu `#040e1a`.
- [ ] **Chế độ Offline**: Bật chế độ Máy bay → mở lại app hoặc chuyển trang bất kỳ → hiển thị trang **"BẠN ĐANG NGOẠI TUYẾN"** và nút **"THỬ TẢI LẠI"** hoạt động khi bật mạng lại.
- [ ] **Cập nhật phiên bản mới**: Khi có bản SW mới ở trạng thái `waiting`, banner cập nhật hiển thị ở góc dưới phải và tải lại mượt khi bấm cập nhật.

---

## 3. Checklist Thiết Bị Thật — iOS (Safari)
*Mở `https://fchdhgonoi.vercel.app/` trên Safari iOS:*

- [ ] **Add to Home Screen**: Bấm nút Chia sẻ (Share) → **"Thêm vào MH chính" (Add to Home Screen)** hiển thị đúng tên **"FC Gò Nổi"** và icon `apple-touch-icon.png` (`180×180`).
- [ ] **Chế độ Standalone**: Mở từ màn hình chính chạy full-screen (`apple-mobile-web-app-capable`), status bar `black-translucent` đọc rõ chữ.
- [ ] **Điều hướng & Chạm**: Toàn bộ nút, menu, form đăng nhập và bảng báo cáo tài chính thao tác mượt, không bị che khuất bởi notch/home indicator.
- [ ] **Chế độ Offline**: Bật chế độ Máy bay → điều hướng trang → hiển thị trang fallback `/offline` và khôi phục bình thường khi có mạng.
