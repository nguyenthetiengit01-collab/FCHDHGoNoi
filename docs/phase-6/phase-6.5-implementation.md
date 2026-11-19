# Phase 6.5 — Image Optimization, Live Browser Visual QA & Polish

**Trạng thái**: Đã triển khai & xác minh trên nhánh `feat/phase-6.5-image-visual-qa` (xếp chồng trên `feat/phase-6.4-component-decomposition`).

## 1. Tối ưu hoá hình ảnh (`next/image`)
- Chuyển đổi các ảnh công khai sang `next/image` (`<Image>` với `sizes`, `fill`/`width`/`height`, và `unoptimized={!src.startsWith("/")}` cho URL ngoài hoặc `data:` URI):
  - `src/components/guest/GuestHeaderNav.tsx`
  - `src/components/guest/HeroBanner.tsx` (ảnh hero đầu tiên gắn `priority={i === 0}`, `loading="eager"`, `sizes="100vw"`)
  - `src/components/guest/MatchdaySection.tsx`
  - `src/components/guest/RosterShowcase.tsx`
  - `src/components/guest/ActivitiesMagazine.tsx`
  - `src/components/guest/SponsorsFooter.tsx`
  - `src/app/hoat-dong/page.tsx`
  - `src/app/hoat-dong/[id]/page.tsx`
- Giữ `<img>` trong `src/components/BroadcastAthleteCard.tsx` để bảo đảm xuất PNG qua `html-to-image` ổn định.

## 2. Sửa lỗi hiển thị, độ tương phản & responsive từ Live QA
- **WCAG 2.2 AA Contrast**:
  - `src/lib/athleteProfile.ts`: nâng độ tương phản huy hiệu vị trí (`GK`, `DF`, `MF`, `FW`, `ĐN`) trên nền `bg-navy-500`/`bg-navy-700` từ `4.11:1` lên `> 8:1` (`bg-*-950/60 text-*-200`).
  - `src/app/hoat-dong/[id]/page.tsx`: sửa badge `GN` từ `bg-navy-500 text-gold-500` (`4.26:1`) sang `bg-navy-800 text-gold-300` (`> 10:1`).
  - `src/components/BroadcastAthleteCard.tsx`: sửa nút `"Tải Ảnh Thẻ Về Máy (PNG)"` từ `bg-emerald-600` (`3.65:1`) sang `bg-emerald-800 hover:bg-emerald-700` (`> 7:1`).
- **Mobile & Desktop Polish**:
  - `src/components/guest/HeroBanner.tsx`: tăng khoảng đệm đáy mobile (`pb-28 sm:pb-20`) để CTA `"Vào khu thành viên"` không bị che bởi banner PWA ở đáy màn hình `360x800` / `390x844`.
  - `src/components/guest/GuestHeaderNav.tsx`: thêm `whitespace-nowrap shrink-0` cho nav desktop và nút `Đăng nhập` để không xuống dòng ở `1440x900`.
  - `src/components/PwaManager.tsx`: thay `#11315f` bằng `bg-navy-600`, nâng touch target lên `min-h-11` / `min-w-11`.
- **Local SQLite QA Adapter**:
  - `src/lib/db.ts`: chuẩn hoá object trả về từ `LocalSqliteAdapter.rawQuery` / `rawQueryOne` thành plain object (`{ ...row }`) để Next.js 15 RSC serialize ổn định khi chạy QA trên `node:sqlite`.

## 3. Kết quả kiểm thử Live Browser (Playwright + axe-core)
- Chạy trên server QA cục bộ dùng SQLite tạm (`D:\Test1\_tmp_phase65_qa\qa.sqlite`), giữ `MEDIA_STORAGE_ENABLED=false` và `ANALYTICS_ENABLED=false`.
- **7/7 Playwright tests đạt**:
  - Viewports `360x800`, `390x844`, `768x1024`, `1440x900`, và `200%` zoom (`720x450` @ `2x`): `scrollWidth <= innerWidth` (0 tràn ngang).
  - `axe-core` (`wcag2a`, `wcag2aa`, `wcag22aa`) trên `/`, `/hoat-dong`, `/hoat-dong/post-gd-1`, `/cau-thu/1`: **0 vi phạm**.
  - Lab Core Web Vitals trên `/`: **LCP = 2400 ms**, **CLS = 0**.
  - `prefers-reduced-motion: reduce`: xác minh CSS animations được tắt (`0s`).
  - Ảnh chụp màn hình lưu tại `D:\Test1\_tmp_phase65_qa\screenshots\`.
