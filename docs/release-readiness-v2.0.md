# Hồ sơ Nghiệm thu Phát hành & Đồng bộ Lộ trình (Release Candidate v2.0)

- **Dự án**: FC HĐH Gò Nổi tại TP.HCM (`FCHDHGoNoi`)
- **Nhánh tích hợp**: `release/v2.0-complete`
- **Baseline Production**: `origin/main` (`7ae59cb10f6bae62baaf2d7cdbc243652764751f`)
- **Các nhánh hợp nhất**:
  1. `feat/phase-3.1-ux-audit-design-system` (`7c163ef`) — UX Audit & Design System Spec
  2. `feat/phase-3.7.1-workspace-player-profile-qa` (`0fb4f98`) — Chuỗi chuẩn hóa UI/UX, Accessibility WCAG 2.2 AA, Design Tokens & Cross-Device Visual QA (Phase 3.2 → 3.7.1)
  3. `feat/phase-5-hardening-audit-ops` (`10ec2d0`) — Bảo mật nâng cao, `/api/audit-logs`, `/api/health`, bảo vệ `/api/webp`, Backup/Restore V3 mã hóa `X25519 + AES-256-GCM` & GitHub Actions workflow
- **Tài liệu đối chiếu**: `AGENTS.md`, `GLOSSARY.md`, `PROJECT_STRUCTURE.md`, `README.md`, `prompt.update.docx` (Master Prompt + Prompt 01 → Prompt 10), Lộ trình `P0` → `P9`.

---

## 1. Bảng Đồng bộ Bộ 10 Prompt (`prompt.update.docx`) ↔ Lộ trình `P0 → P9`

| Prompt (`prompt.update.docx`) | Giai đoạn Lộ trình | Trạng thái | Bằng chứng triển khai & kiểm thử |
| :--- | :--- | :---: | :--- |
| **Master Prompt + Prompt 01** *(Codebase Audit)* | **P0 — CODEBASE AUDIT** | **HOÀN TẤT** | `AGENTS.md`, `PROJECT_STRUCTURE.md`, `GLOSSARY.md`, `docs/ux-audit-phase-3.1.md`, `docs/design-system-phase-3.1.md`, `src/lib/preMergeAudit.test.ts` |
| **Prompt 02** *(Security Hardening)* | **P1 — SECURITY & DATA PROTECTION** | **HOÀN TẤT** | `scrypt` + salt, HMAC-SHA256 HttpOnly cookies, rate limit, RBAC Guest/Player/Manager, DTO tách biệt, Excel security (`auth.test.ts`, `securityPhase1.test.ts`, `securityIntegrityPhase35.test.ts`, `excelSecurityHardening.test.ts`), + Phase 5 `/api/webp` auth guard, `/api/audit-logs`, `/api/health` (`hardeningAndOps.test.ts`) |
| **Prompt 03** *(Domain & Business Logic)* | **P2 — DOMAIN & BUSINESS LOGIC** | **HOÀN TẤT** | `financialCalculations.ts`, `financialReconciliationPhase2.test.ts`, `collectionDraft.test.ts`, `athleteProfile.test.ts`, `goNoiStory.test.ts` (tách biệt RSVP / Attended / Paid, chuẩn địa danh `Xã Gò Nổi • TP. Đà Nẵng` & 3 xã cũ `Điện Phong - Điện Trung - Điện Quang`) |
| **Prompt 04** *(Architecture & UX)* | **P3 — ARCHITECTURE & UX** | **HOÀN TẤT** | Phân tách `PublicGuestPortal` vs `TeamManagerApp` + dynamic tabs, chuẩn hóa `<dialog showModal()>` & focus restoration qua `useDialogA11y.ts`, loại bỏ 100% `window.confirm`/`alert` bằng `ConfirmDialog` & toast (`accessibilityPhase32.test.ts`, `uiStandardizationPhase33.test.ts`) |
| **Prompt 05** *(Design System)* | **P4 — PREMIUM DESIGN SYSTEM** | **HOÀN TẤT** | Hệ thống 70-25-5 Deep Navy – Royal Gold – Slate trong `src/app/globals.css` (`@theme` & `:root`), giảm ~77% HEX hardcode, dual-ring WCAG 2.2 focus tokens `--focus-on-light`/`--focus-on-dark` trong `@layer base`/`@layer components`, radius 4/6/8/12px (`designTokensPhase35.test.ts`, `contrastPhase351.test.ts`, `visualPolishPhase36.test.ts`) |
| **Prompt 06** *(Public Website Redesign)* | **P5 — PUBLIC WEBSITE REDESIGN** | **HOÀN TẤT** | Trang chủ `PublicGuestPortal.tsx` và các trang công khai `/hoat-dong`, `/hoat-dong/[id]`, `/bao-cao-tai-chinh`, `/nha-tai-tro`, `/cau-chuyen-go-noi`, `/offline` (`0px` overflow 320px–1920px, banner dots `44×44px`, `skip-link` toàn tuyến) |
| **Prompt 07** *(Matchday & Player Experience)* | **P6 — MATCHDAY & PLAYER EXPERIENCE** | **HOÀN TẤT** | Match Center, RSVP 3 trạng thái, `BroadcastAthleteCard`, `MatchdayRosterPoster`, `/cau-thu/[id]` & `PlayerPersonalTab` (QA đã kiểm chứng cả `/cau-thu/2` và 404 `/cau-thu/99999`) |
| **Prompt 08** *(Management & Finance)* | **P7 — MANAGEMENT & FINANCE** | **HOÀN TẤT** | `DashboardTab`, `ScheduleTab`, `CollectionTab`, `FinanceTab` (bổ sung Mobile Card View `< 768px`), `MatrixTab` (Sticky Column + scroll ngang nội bộ), `PlayersTab`, Import/Export Excel, cộng thêm `audit_logs` & `GET /api/audit-logs` từ Phase 5 (`responsiveTablesPhase34.test.ts`) |
| **Prompt 09** *(Community & Media)* | **P8 — COMMUNITY & MEDIA** | **HOÀN TẤT** | WebP pipeline 2 tầng (`imageToWebp.ts` + `sharp`), `ClubPostsTab`, `SponsorsTab` (5 tier + tự động ẩn hết hạn), `ImageLightboxModal` (`serverWebp.test.ts`, `clubPhotoGallery.test.ts`, `sponsors.test.ts`) |
| **Prompt 10** *(Final QA & Release)* | **P9 — PERFORMANCE & RELEASE** | **SẴN SÀNG** | SEO (`seo.test.ts`), PWA + `/offline` (`pwa.test.ts`), Turso Backup/Restore V3 (`backupRestoreV3.test.ts`, `backupSecurityHardening.test.ts`), `.github/workflows/turso-backup.yml`, tài liệu vận hành `docs/operations-runbook.md` & `docs/turso-staging-guide.md` |

---

## 2. Kết quả Kiểm định Cuối cùng theo Đầu ra của Prompt 10

### A. Release Readiness Report
- **Kết luận**: **READY FOR INTEGRATION INTO `main`** trên nhánh `release/v2.0-complete`.
- Toàn bộ 3 luồng phát triển (`Phase 3.1 Docs`, `Phase 3.2–3.7.1 UI/UX/A11y`, `Phase 5 Security/Ops/Backup V3`) đã hợp nhất sạch (`0` conflicts), vượt qua đầy đủ automated tests, lint, type-check, production build và Cross-Device Chrome DevTools QA (`320px–1920px`).

### B. Test Results Thực Tế (Trên `release/v2.0-complete`)
- `npm test` (`vitest run`): **`30` test files, `229` tests** (chạy toàn bộ kết hợp từ Phase 1 → Phase 5).
- `npm run lint` (`eslint src`): **0 errors, 0 warnings**.
- `npx tsc --noEmit`: **0 errors**.
- `npm run build` (`process-webp.mjs` + `next build`): Build sạch 16 routes + App API endpoints (`/api/auth`, `/api/audit-logs`, `/api/export`, `/api/health`, `/api/import`, `/api/public/financial-report`, `/api/team`, `/api/webp`).
- `git diff --check`: **0 lỗi formatting/conflict markers**.

### C. Bugs Còn Tồn Tại Phân Theo P0–P3
- **P0 (Critical)**: **0**.
- **P1 (High)**: **0**.
- **P2 (Medium)**: **0**.
- **P3 (Backlog — không chặn phát hành)**:
  1. Một số input phụ trong modal có thể bổ sung thêm `autocomplete` để loại bỏ gợi ý Console DevTools.
  2. Trên `/bao-cao-tai-chinh` ở màn hình siêu hẹp `320×700`, các nút lọc năm/tháng khi wrap xuống dòng hơi khít (có thể tinh chỉnh `gap-y-1.5`).
  3. Kiểm thử trên thiết bị vật lý thật (Safari iOS & Chrome Android thật) sau khi phát hành theo checklist [pwa-real-device-checklist.md](pwa-real-device-checklist.md).

### D. Performance Findings
- 9 tab quản trị trong `TeamManagerApp.tsx` được lazy-load bằng `next/dynamic(..., { ssr: false })`, giữ gói JS dùng chung ~`103 kB`.
- Pipeline chuyển đổi ảnh `.webp` tự động ở cả Client Canvas (`imageToWebp.ts`) và Server Node (`sharp`), build prebuild xác nhận `102` ảnh trong `hinhanh/` đã tối ưu `.webp`.

### E. Security Findings
- **Xác thực & Phiên**: Password hashing bằng `scrypt` + random salt; session cookie ký HMAC-SHA256 (`HttpOnly`); rate limiting chống brute-force; không trả `pin_code`, hash hay token về client.
- **Phân quyền Server-Side (RBAC)**: Guest chỉ nhận Public DTO; Player chỉ sửa hồ sơ cá nhân, đổi PIN của mình và RSVP; Manager mới có quyền tài chính, quản lý thành viên, reset PIN, xem `/api/audit-logs`, `/api/export`, `/api/import`, `/api/webp` (`10MB` limit).
- **Backup Security**: Backup đọc trong `client.transaction("read")` nhất quán; mã hóa bằng khóa công khai (`X25519 + HKDF-SHA256 + AES-256-GCM`) qua `TURSO_BACKUP_PUBLIC_KEY` trước khi upload GitHub Artifact (retention 30 ngày); tuyệt đối không lưu private key trong Git hay GitHub Secrets.

### F. Deployment Checklist
1. **Vercel Environment Variables (`Production` & `Preview` tách biệt)**:
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`.
2. **GitHub Repository Secrets** (tại `Settings → Secrets and variables → Actions`, phục vụ `.github/workflows/turso-backup.yml`):
   - `TURSO_PROD_DATABASE_URL`
   - `TURSO_PROD_AUTH_TOKEN_RO` (chỉ dùng `--read-only` token)
   - `TURSO_BACKUP_PUBLIC_KEY` (`gonoi-pub-v1:...` sinh ngoại tuyến bằng `node scripts/backup-crypto.mjs keygen`)

### G. Rollback Plan
1. **Application Rollback**: Trên Vercel Dashboard chọn **Rollback** về deployment ổn định trước đó; không force push `main`.
2. **Database Recovery**: Làm theo [operations-runbook.md](operations-runbook.md) — giải mã `.json.enc` bằng private key lưu ngoại tuyến (`backup-crypto.mjs decrypt --private-key-file ...`), kiểm chứng bằng `db-restore.mjs` lên DB tách biệt (SQLite tạm hoặc Turso DB phục hồi riêng), đối chiếu `rowCounts` & số dư quỹ trước khi đổi biến môi trường Vercel.

### H. Những Việc Cần Chủ Dự Án Xác Nhận / Thực Hiện
1. Ra lệnh hợp nhất `release/v2.0-complete` vào `main` và gắn tag phát hành (`v2.0.0`).
2. Cấu hình 3 GitHub Repository Secrets (`TURSO_PROD_DATABASE_URL`, `TURSO_PROD_AUTH_TOKEN_RO`, `TURSO_BACKUP_PUBLIC_KEY`), cất giữ an toàn 2 bản sao độc lập của `privateKey`, và chạy thử workflow `Weekly Turso Production Backup (Read-Only)` bằng nút **Run workflow** ngay sau khi merge lên `main`.
3. Kiểm tra nhanh trên thiết bị di động thật (iOS Safari / Android Chrome) theo [pwa-real-device-checklist.md](pwa-real-device-checklist.md).
