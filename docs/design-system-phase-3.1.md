# Phase 3.1 — Unified Design System Specification

- **Project**: FC HĐH Gò Nổi tại TP.HCM (`FCHDHGoNoi`)
- **Branch**: `feat/phase-3.1-ux-audit-design-system`
- **Reference Standards**: `AGENTS.md`, `src/app/globals.css`, `src/components/ui/`
- **Scope**: Chuẩn hóa Design Tokens, Typography, Color System (70-25-5), Border Radius (8–12px), và Component Contracts cho giai đoạn tái cấu trúc UI tiếp theo.

---

## 1. Brand & Visual Principles (`AGENTS.md`)

1. **Nguyên tắc 70-25-5**:
   - **70% Surface & Backdrop**: Navy sâu thể thao (`#040e1a` → `#081a33` → `#0b2447` / `#0d2e5b`) cho Public/Broadcast Portal; hoặc nền Slate sáng kỹ thuật (`#f1f5f9` / `#ffffff`) cho không gian làm việc mật độ dữ liệu cao (Manager/Player Workspace).
   - **25% Typography & Technical Borders**: Trắng / Slate kỹ thuật (`#f8fafc`, `#cbd5e1`, `#334155`, `border-white/10`, `border-slate-200`).
   - **5% Brand Accents**: Vàng Hoàng Gia Gò Nổi (`#d4af37` / `#fde047`) & Xanh sân cỏ Emerald (`#10b981` / `#059669`).
2. **Chống "Vibe Website AI"**:
   - **Cấm**: Gradient tím/hồng generic, hiệu ứng neon loè loẹt, bo góc bong bóng (`rounded-2xl` / `rounded-3xl` / `24px–32px` cho card/container lớn).
   - **Chuẩn**: Góc bo sắc nét **8px–12px** (`rounded-lg` = 8px, `rounded-xl` = 12px), đường viền tương phản tinh tế (`1px`), số liệu dùng `tabular-nums`, tiêu đề kỹ thuật `Barlow Condensed` uppercase.
3. **Địa danh chuẩn hóa**:
   - Nhãn địa danh đại diện toàn CLB: `Xã Gò Nổi • TP. Đà Nẵng`.
   - Thông tin quê quán từng cầu thủ giữ nguyên 3 xã cũ: `Điện Phong - Điện Trung - Điện Quang`.

---

## 2. Color & Semantic Token Architecture

Hiện tại `src/app/globals.css` đã có bước đầu tốt với `@theme` và `:root`, nhưng trong TSX vẫn còn >350 mã hex hardcode (`#040e1a`, `#040e1e`, `#030912`, `#081a33`, `#092244`, `#0a2347`, `#0b2952`, `#0d2e5b`, `#17488c`, `#d4af37`). Cần hợp nhất thành bộ token chuẩn dưới đây trong `src/app/globals.css`:

```css
@theme {
  /* Core Brand Navy Scale (70%) */
  --color-navy-950: #040e1a; /* Deepest broadcast/footer backdrop */
  --color-navy-900: #081a33; /* Public portal primary surface */
  --color-navy-800: #092244; /* Text primary on light / dark card base */
  --color-navy-700: #0b2447; /* Elevated dark card / mobile nav bar */
  --color-navy-600: #0d2e5b; /* Brand primary button & active surface */
  --color-navy-500: #17488c; /* Hover / secondary navy */

  /* Royal Gold & Pitch Emerald Accents (5%) */
  --color-gold-500: #d4af37;
  --color-gold-600: #b89635;
  --color-gold-300: #fde047;
  --color-emerald-500: #10b981;
  --color-emerald-600: #059669;

  /* Technical Sky */
  --color-sky-600: #0284c7;
}
```

### Dual-Context Surface Tokens

| Context | Token | Giá trị chuẩn | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Broadcast / Public** | `--surface-broadcast-bg` | `#040e1a` | Nền trang `/`, `/hoat-dong`, `/nha-tai-tro`, `/cau-chuyen-go-noi`, `/bao-cao-tai-chinh` |
| **Broadcast / Public** | `--surface-broadcast-card` | `#081a33` / `#0b2447` | Card trận đấu, bài viết, hồ sơ VĐV |
| **Broadcast / Public** | `--border-broadcast` | `rgba(255, 255, 255, 0.10)` | Viền card nền tối (`border-white/10`) |
| **Workspace (Light)** | `--bg-page` | `#f1f5f9` | Nền vùng làm việc Manager / Player |
| **Workspace (Light)** | `--bg-surface` | `#ffffff` | Card, bảng, form input nền sáng |
| **Workspace (Light)** | `--text-primary` | `#092244` | Chữ chính (contrast > 12:1 trên `#ffffff`) |
| **Workspace (Light)** | `--text-secondary` | `#334155` | Nhãn phụ, mô tả |
| **Workspace (Light)** | `--text-muted` | `#64748b` | Placeholder, metadata phụ (chú ý chỉ dùng trên nền trắng để đạt >= 4.5:1) |

> **Quy tắc chuyển đổi**: Loại bỏ hoàn toàn `!important` trên `.bg-brand-navy` / `.bg-brand-navy-mid` trong `src/app/globals.css:21-27` sau khi chuyển các component sang token `@theme` chuẩn (`bg-navy-600`, `bg-navy-500`).

---

## 3. Typography, Spacing & Radius Scale

### 3.1 Typography
- **Display Font**: `Barlow Condensed` (`--font-display`, weights `600`, `700`, `800`), dùng cho tiêu đề hero, tỷ số trận đấu, số áo, tên cầu thủ trên thẻ VĐV (`font-display uppercase tracking-tight`).
- **Body / UI Font**: System sans-serif stack (`font-sans antialiased`) cho form, bảng dữ liệu, đoạn văn dài để đảm bảo đọc rõ tiếng Việt có dấu ở cỡ `12px–16px`.
- **Tabular Numbers**: Mọi cột tiền tệ (VNĐ), ngày tháng, số áo, thống kê ra sân bắt buộc dùng `tabular-nums`.

### 3.2 Border Radius (Tuân thủ 8px–12px theo `AGENTS.md`)
| Token | Giá trị | Tailwind Class | Áp dụng cho |
| :--- | :--- | :--- | :--- |
| `--radius-sm` | `6px` (`0.375rem`) | `rounded-md` | Badge nhỏ, tag, inline chip |
| `--radius-md` | `8px` (`0.5rem`) | `rounded-lg` | Button, Input, Select, Textarea, Tab item |
| `--radius-lg` | `12px` (`0.75rem`) | `rounded-xl` | Card, ModalDialog, Table container (`.ds-card`, `.ds-table-wrap`) |
| **Cấm dùng** | `>= 24px` | `rounded-3xl` | **Không dùng** cho card/section container (ngoại lệ duy nhất: `rounded-full` cho avatar tròn & status dot) |

### 3.3 Touch Targets & Spacing (WCAG 2.2 AA)
- Mọi nút bấm tương tác, input, select trên form tối thiểu `min-h-11` (`44px`) ở kích thước mặc định (`md`) và `min-h-10` (`40px`) cho action phụ trên desktop; riêng mobile hit target không dưới `40px × 40px` (`min-h-10 min-w-10`).
- Focus ring thống nhất toàn hệ thống: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4af37]` (thay thế `outline-emerald-600` ở `ModalDialog.tsx:97`).

---

## 4. Technical Position Badges (`src/components/ui/Badge.tsx`)

Chuẩn hóa đúng theo `AGENTS.md` và `PositionBadge`:

| Mã vị trí | Ý nghĩa | Tone màu | Contrast Rule |
| :--- | :--- | :--- | :--- |
| `GK` | Thủ môn | Emerald (`bg-emerald-50 text-emerald-800 border-emerald-200`) | Chữ tối trên nền nhạt (Light) / Emerald sáng trên nền Navy (Dark) |
| `DF` | Hậu vệ | Blue/Sky (`bg-sky-50 text-sky-800 border-sky-200`) | Tương phản >= 4.5:1 |
| `MF` | Tiền vệ | Amber (`bg-amber-50 text-amber-800 border-amber-200`) | Tương phản >= 4.5:1 |
| `FW` | Tiền đạo | Rose (`bg-rose-50 text-rose-800 border-rose-200`) | Tương phản >= 4.5:1 |
| `ĐN` | Đa năng | Purple (`bg-purple-50 text-purple-800 border-purple-200`) | Tương phản >= 4.5:1 |

---

## 5. Component Library Contract (`src/components/ui/`)

Tất cả các tab và trang quản trị phải ưu tiên sử dụng primitive từ `@/components/ui` (barrel export tại `src/components/ui/index.ts`):

| Component | File nguồn | Trạng thái hiện tại | Chuẩn hóa cần làm ở Phase tiếp theo |
| :--- | :--- | :--- | :--- |
| `Button` | `ui/Button.tsx` | 6 variants, 3 sizes, loading state | Thay 6 hex hardcode bằng token `bg-navy-600`, `bg-gold-500`... |
| `Badge`, `PositionBadge` | `ui/Badge.tsx` | Đầy đủ 5 vị trí + tone | Bổ sung `surface="dark"` prop cho Public Portal |
| `Card`, `StatCard` | `ui/Card.tsx` | `default`/`navy`/`subtle` (`rounded-xl`) | Giữ chuẩn `rounded-xl` (12px), mở rộng sử dụng sang `ClubPostsTab`, `SponsorsTab` |
| `FormField`, `Input`, `Select`, `Textarea` | `ui/FormControls.tsx` | Có `useFieldIds()`, `role="alert"` | Tự động pass `id`, `aria-invalid`, `aria-describedby` vào child control hoặc cung cấp wrapper bound sẵn |
| `LoadingState`, `EmptyState`, `ErrorState`, `ConfirmDialog` | `ui/StateViews.tsx` | `EmptyState` dùng nhiều; `ConfirmDialog` bị bỏ qua ở vài tab | Bắt buộc dùng `ConfirmDialog` thay `window.confirm()`, dùng Toast/ErrorState thay `alert()` |
| `ModalDialog` | `components/ModalDialog.tsx` | Dùng native `<dialog showModal()>` | Đưa `ModalDialog` vào `ui/`, sửa close button focus thành `var(--brand-gold)`, migrate `LoginModal` & `ImageLightboxModal` sang dùng `ModalDialog` |

---

## 6. Phased Rollout Roadmap (Đề xuất cho các Phase sau)

1. **Phase 3.2 — Accessibility & Blocking Dialog Remediation (P0)**:
   - Thay toàn bộ `window.confirm()` & `alert()` bằng `ConfirmDialog` và Toast.
   - Chuẩn hóa `LoginModal`, `ImageLightboxModal`, và Mobile Menu dùng `<dialog>` / focus trap; thêm `skip-link` vào tất cả standalone pages.
2. **Phase 3.3 — Token & Primitive Consolidation (P1)**:
   - Hợp nhất `@theme` CSS tokens trong `globals.css`, bỏ `!important`.
   - Refactor `ClubPostsTab`, `SponsorsTab`, `PlayerPersonalTab` sang dùng `@/components/ui` và nâng cấp `FormField` auto-ARIA.
3. **Phase 3.4 — Mobile Density & Visual Polish (P2)**:
   - Sticky column / mobile card view cho `FinanceTab` và `MatrixTab`.
   - Loại bỏ `rounded-3xl` ở `src/app/hoat-dong/page.tsx`, nâng hit-area dot banner ở `PublicGuestPortal.tsx`.
