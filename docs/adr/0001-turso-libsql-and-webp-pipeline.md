# 0001. Turso LibSQL Database & Dual-Layer WebP Media Pipeline

- **Trạng thái**: Accepted
- **Ngày**: 2026-11-09

## Ngữ cảnh & Vấn đề

1. Ban đầu website lưu trữ trạng thái trên cookies / local state, dẫn đến dữ liệu không đồng bộ giữa các máy hoặc khi mở tab mới. Đội bóng cần một database lưu trữ bền vững, nhanh, chi phí 0đ và dễ vận hành.
2. Cầu thủ và Ban Quản Lý thường xuyên tải lên ảnh chụp từ điện thoại (dung lượng 3MB - 10MB dạng JPEG/PNG). Nếu lưu nguyên bản, website tải rất chậm và tốn dung lượng băng thông.

## Quyết định đã đưa ra

1. **Turso LibSQL (Cloud SQLite)**:
   - Sử dụng database serverless Turso đặt tại Tokyo (`aws-ap-northeast-1`) cho độ trễ cực thấp về Việt Nam.
   - Thư viện kết nối `@libsql/client` cho phép query an toàn với SQL statements.
2. **Quy trình chuyển đổi ảnh WebP 2 tầng (Dual-Layer WebP Pipeline)**:
   - **Tầng 1 (Client Canvas)**: Hàm `convertFileToWebp` và `convertMultipleFilesToWebp` chạy trực tiếp trên browser của người dùng ngay khi chọn file. Ảnh được resize chuẩn tỉ lệ (portrait 600x800, landscape 1280x960, quality 0.85) và nén sang `.webp` trước khi gửi lên server.
   - **Tầng 2 (Server Fallback)**: Hàm `ensureWebpBuffer` và `ensureWebpBase64` trên route API sử dụng thư viện `sharp` để đảm bảo 100% hình ảnh ghi vào database/disk đều ở định dạng WebP, giảm 80-90% dung lượng.

## Hậu quả & Đánh giá

- Dữ liệu luôn đồng bộ thời gian thực cho mọi cầu thủ và khách truy cập.
- Tốc độ tải trang đạt chuẩn truyền hình, mượt mà trên cả mạng di động 4G.

