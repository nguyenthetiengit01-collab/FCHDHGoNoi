# Phase 6.4 — Component Decomposition & Token Consolidation

**Trạng thái**: Đã triển khai & xác minh trên nhánh `feat/phase-6.4-component-decomposition` (dựa trên `feat/phase-6.3-accessibility-mobile-ux` @ `36e86bd094152ae0d5a214de9b6fc60802f31e33`).

## 1. Shared Player Profile & Gallery Extraction
- Tạo `src/components/shared/PlayerProfileEditor.tsx` và `src/components/shared/PlayerGalleryManager.tsx`.
- Hợp nhất logic chỉnh sửa hồ sơ VĐV, chọn/cắt ảnh hoạt động, quản lý album profile rộng và hành động touch-visible (`min-h-11 min-w-11 md:min-h-8 md:min-w-8` / `md:min-h-7 md:min-w-7`, giữ nguyên `aria-label` và focus ring từ Phase 6.3).
- Tích hợp vào:
  - `src/components/PlayerPersonalTab.tsx` (~926 dòng)
  - `src/components/ScheduleTab.tsx` (~2,409 dòng)
  - `src/components/PlayersTab.tsx` (~1,526 dòng)

## 2. PublicGuestPortal Decomposition
- Tách `src/components/PublicGuestPortal.tsx` (2,197 → 289 dòng) thành các module chuyên biệt trong `src/components/guest/`:
  - `shared.tsx` (Reveal, SoccerBallIcon, MOSAIC, WRAP, types)
  - `GuestHeaderNav.tsx` (desktop nav, mobile `role="dialog"` drawer với `useDialogA11y`)
  - `HeroBanner.tsx` (hero showcase, CTA, match ticker)
  - `MatchdaySection.tsx` (banner slider, matchday fixture, poster trigger, upcoming/past tabs)
  - `RosterShowcase.tsx` (filter, search, squad list, `BroadcastAthleteCard` & detail)
  - `ActivitiesMagazine.tsx` (timeline filter, category filter, magazine grid)
  - `SponsorsFooter.tsx` (sponsor tiers & official club footer)

## 3. FinanceTab Decomposition
- Tách `src/components/FinanceTab.tsx` (1,645 → ~741 dòng) thành:
  - `src/components/finance/ExpenseLedgerSection.tsx` (sổ chi, lọc danh mục, mobile card + desktop table, giữ nguyên format `-0` guard)
  - `src/components/finance/OtherIncomeSection.tsx` (tài trợ & thu khác)
  - `src/components/finance/FinanceTransactionModal.tsx` (modal thêm/sửa chi tiêu và thu khác)

## 4. Token Consolidation & Regression Tests
- Thay thế toàn bộ hardcoded Tailwind `-[#...]` HEX trong `PublicGuestPortal.tsx`, `src/components/guest/*`, và `src/components/BroadcastAthleteCard.tsx` bằng `@theme` tokens (`navy-*`, `gold-*`, `royal-600`). Giữ ngoại lệ có tài liệu cho `#1877F2` (Facebook brand) trong `GuestHeaderNav.tsx` và `[-webkit-text-stroke:2px_#d4af37]` trong `HeroBanner.tsx`.
- Mở rộng `src/lib/designTokensPhase35.test.ts` và thêm `src/lib/phase64Decomposition.test.ts`.
- Không sửa API, auth, DB, logic tài chính hay biến môi trường (`MEDIA_STORAGE_ENABLED=false`, `ANALYTICS_ENABLED=false`).
