# Checklist Thực Thi Cắt Chuyển Production P1-03 — FC HĐH Gò Nổi

Sử dụng checklist này song song với [p103-production-cutover-plan.md](p103-production-cutover-plan.md) trong cửa sổ bảo trì cắt chuyển. Thực hiện **tuần tự**, không bỏ bước.

- **Ngày thực hiện**: `____-__-__`
- **Release Coordinator**: `__________________`
- **Database & Backup Custodian**: `__________________`
- **Verifier / QA**: `__________________`

---

## 0. Preflight Trước Cửa Sổ Bảo Trì
- [ ] Đã thông báo lịch bảo trì cho anh em đội bóng (ngoài giờ thi đấu/điểm danh).
- [ ] Đã chuẩn bị sẵn `privateKey` (`gonoi-priv-v1:...`) ở file quyền `600` (`~/.secrets/gonoi-backup-priv.key`) và `publicKey` (`gonoi-pub-v1:...`).
- [ ] Đã tạo sẵn Turso Production DB mới (trống) và lưu URL + RW token vào Password Manager của Chủ sở hữu.
- [ ] Đã lưu dự phòng RW token của Turso Production DB cũ trong Password Manager để phục vụ rollback nếu cần.
- [ ] Thư mục ngoài repo `../backups/` đã sẵn sàng, không nằm trong Git working tree.

---

## 1. Trình Tự Cắt Chuyển Chuẩn (Bootstrap → Stage 1 → Legacy Token Expiry → Callback Drain → Stage 2 → Read-only Turso)
> **Lưu ý:** Tuyệt đối không dùng bản snapshot cũ làm final cutover backup. Tuân thủ đúng trình tự: `Bootstrap Deployment → Stage 1 → Legacy Token Expiry → Callback Drain → Stage 2 → Read-only Turso → Final Backup → Offline Migration → Restore → DB Switch → Smoke Test → Unfreeze`.

- [ ] **Tích hợp PR & Bootstrap Deployment (Bắt buộc trước Stage 1)**:
  - [ ] Owner phê duyệt & merge **PR #21** (`feat/p103-production-cutover-readiness` → `hotfix/p1-03-default-pin-containment`).
  - [ ] Chạy lại & xác nhận toàn bộ CI trên **PR #19** (`hotfix/p1-03-default-pin-containment` → `main`) pass sau khi đã chứa code freeze/callback từ PR #21.
  - [ ] Owner phê duyệt & merge **PR #19 vào `main`** để deploy Bootstrap Deployment (giữ `TURSO_AUTH_TOKEN` quyền ghi và `MEDIA_STORAGE_ENABLED=true`), xác nhận Deployment SHA trên Production chứa đủ containment + freeze/callback. *(Rollback nếu lỗi: Vercel Instant Rollback về deployment trước đó).*
- [ ] **Stage 1 (Stop issuing new upload tokens & Ghi nhận `T_drain-start`)**:
  - [ ] *(Tầng Edge)* Bật rule **Vercel Firewall / WAF (`Deny` → HTTP `403`)** chặn `POST /api/*` **ngoại trừ cả hai path `/api/media/client-upload/callback` và `/api/media/client-upload`** (endpoint cũ vẫn tự chặn cấp token mới với `503`; endpoint mới chặn cấp token với `403`) và chặn `GET /api/cron/analytics-cleanup`.
  - [ ] **Giữ nguyên `TURSO_AUTH_TOKEN` (quyền ghi) và `MEDIA_STORAGE_ENABLED=true`**; đặt `P103_CUTOVER_FREEZE_WRITES=true` (giữ `P103_CUTOVER_FREEZE_CALLBACKS` tắt).
  - [ ] Xác minh **mọi Production ingress và mọi Production deployment** đều không thể cấp Legacy Token nữa, rồi ghi nhận mốc **`T_drain-start`** (ISO-8601 kèm múi giờ, Deployment ID/SHA và bằng chứng chặn token-gen).
  - [ ] *(Tùy chọn cho smoke test 6)* Lưu 1 cookie `fc_session` Manager hợp lệ trước khi đóng băng ghi.
- [ ] **Legacy Token Expiry & Callback Drain**:
  - [ ] Chờ đủ **`3.900 giây` (65 phút)** tính từ **`T_drain-start`** (`3.600 giây` legacy max TTL + `300 giây` safety margin).
  - [ ] Xác nhận không còn upload/multipart upload in-flight, callback & retry đã hoàn tất và `media_upload_records` / DB metadata nhất quán (không còn Blob mồ côi).
- [ ] **Stage 2 → Read-only Turso**:
  - [ ] Bật `P103_CUTOVER_FREEZE_CALLBACKS=true` (app trả `503 CUTOVER_WRITE_FROZEN`) và bật WAF `Deny` chặn toàn bộ `POST /api/*` gồm cả callback (`403`).
  - [ ] **Sau khi Stage 2 có hiệu lực**, tạo `--read-only` token cho Turso Production DB cũ (`turso db tokens create <old-prod-db> --read-only`), lưu RW token cũ vào Password Manager, đặt `TURSO_AUTH_TOKEN` = RO token và `MEDIA_STORAGE_ENABLED=false` trên Vercel Production rồi redeploy (đợi `Ready`).
  - [ ] Xác nhận `GET /api/health` trả HTTP `200`, `POST /api/team`, `POST /api/media/upload`, `POST /api/media/client-upload` và `POST /api/media/client-upload/callback` đều bị chặn (`403` ở WAF hoặc `503` từ app; **0 DB write, 0 Blob write**) trước khi chụp final backup.

---

## 2. Final Encrypted v3 Backup & Key Custody
- [ ] Chụp final backup v3 từ DB Production cũ (read-only):
  ```bash
  TURSO_DATABASE_URL="<old-prod-turso-url>" \
  TURSO_AUTH_TOKEN="<old-prod-readonly-token>" \
    node scripts/db-backup.mjs --out ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json
  ```
- [ ] Ghi nhận golden baseline `rowCounts` & `objectCounts`:
  - `players`: `____` | `matches`: `____` | `match_attendances`: `____`
  - `other_incomes`: `____` | `expenses`: `____` | `audit_logs`: `____`
- [ ] Mã hóa file backup bằng `backup-crypto.mjs`:
  ```bash
  BACKUP_ENCRYPTION_PUBLIC_KEY="gonoi-pub-v1:..." \
    node scripts/backup-crypto.mjs encrypt \
      --in ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json \
      --out ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json.enc
  ```
- [ ] Xác nhận bản `.json.enc` đã được lưu sang kho dự phòng độc lập thứ hai và `privateKey` được giữ ngoại tuyến (không nằm trên GitHub/Vercel).

---

## 3. Offline SQLite Restore & Dual-Migration
- [ ] Restore JSON v3 vào file SQLite cô lập **ngoài** thư mục repo (không dùng tên `gonoifc.sqlite` hay chứa `prod`/`production`):
  ```bash
  node scripts/db-restore.mjs \
    --in ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json \
    --target ../backups/cutover-work.sqlite \
    --confirm
  ```
- [ ] Chạy Migration 1 (`phase7-p103-pin-default-v1.mjs`) — dry-run trước, apply sau:
  ```bash
  node scripts/migrations/phase7-p103-pin-default-v1.mjs --sqlite ../backups/cutover-work.sqlite --dry-run
  node scripts/migrations/phase7-p103-pin-default-v1.mjs --sqlite ../backups/cutover-work.sqlite
  ```
- [ ] Chạy Migration 2 (`phase7-p103-must-change-pin-v1.mjs`) — dry-run trước, apply sau:
  ```bash
  node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --sqlite ../backups/cutover-work.sqlite --dry-run
  node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --sqlite ../backups/cutover-work.sqlite
  ```
- [ ] Re-export file SQLite đã migrate ra bản JSON v3 mới:
  ```bash
  node scripts/db-backup.mjs \
    --sqlite ../backups/cutover-work.sqlite \
    --out ../backups/gonoi-prod-migrated-<YYYYMMDD-HHMM>.json
  ```

---

## 4. Restore Lên Turso Production Mới & Kiểm Chứng
- [ ] Chạy `--dry-run` với `scripts/p103-cutover-restore.mjs` dùng `TURSO_CUTOVER_TARGET_DATABASE_URL` / `TURSO_CUTOVER_TARGET_AUTH_TOKEN` (khớp chính xác host `fchdhgonoi-prod-cutover-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io` & DB `fchdhgonoi-prod-cutover-nguyenthetiengit01-collab`; `--expected-target-host` chỉ là xác nhận bổ sung):
  ```bash
  TURSO_CUTOVER_TARGET_DATABASE_URL="<new-prod-turso-url>" \
  TURSO_CUTOVER_TARGET_AUTH_TOKEN="<new-prod-rw-token>" \
    node scripts/p103-cutover-restore.mjs \
      --in ../backups/gonoi-prod-migrated-<YYYYMMDD-HHMM>.json \
      --dry-run
  ```
- [ ] Chạy `--apply --confirm-production-cutover`:
  ```bash
  TURSO_CUTOVER_TARGET_DATABASE_URL="<new-prod-turso-url>" \
  TURSO_CUTOVER_TARGET_AUTH_TOKEN="<new-prod-rw-token>" \
    node scripts/p103-cutover-restore.mjs \
      --in ../backups/gonoi-prod-migrated-<YYYYMMDD-HHMM>.json \
      --apply --confirm-production-cutover
  ```
- [ ] **Post-Restore Verification** trên Turso Production DB mới:
  - [ ] `rowCounts` mọi bảng khớp 100% với golden baseline ở Bước 2.
  - [ ] `SELECT version FROM schema_migrations;` có đủ `phase7-p103-pin-default-v1` và `phase7-p103-must-change-pin-v1`.
  - [ ] `PRAGMA table_info(players);` xác nhận `pin_code` có `dflt_value` là `''` (không còn `'1234'`).
  - [ ] `PRAGMA table_info(players);` xác nhận có cột `must_change_pin` (`INTEGER NOT NULL DEFAULT 0`).
  - [ ] `PRAGMA integrity_check;` trả về `ok`.
  - [ ] `PRAGMA foreign_key_check;` trả về `0` vi phạm.

---

## 5. Chuyển Đổi Vercel Env & Redeploy (Trong Chế Độ Freeze)
- [ ] Xác nhận `P103_CUTOVER_FREEZE_WRITES=true` vẫn đang **BẬT** trên Vercel Production.
- [ ] Cập nhật `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN` trên **Vercel Dashboard → Production** sang **Turso Production DB mới**.
- [ ] Thực hiện **Redeploy Production** trên Vercel Dashboard (để env mới có hiệu lực) và đợi đạt trạng thái `Ready`.

---

## 6. Smoke Tests (Read-Only Freeze)
> **Cấm mở khóa ghi** nếu bất kỳ mục nào dưới đây chưa pass.

- [ ] `GET /api/health` trả HTTP `200`, `db: "connected"`.
- [ ] Trang chủ (`/`), danh sách cầu thủ, `/bao-cao-tai-chinh`, `GET /api/team` (Guest), `GET /api/media/legacy` hiển thị đúng dữ liệu & số dư quỹ.
- [ ] *(Với cookie `fc_session` Manager có sẵn từ trước freeze)* `GET /api/audit-logs` và `GET /api/export` trả HTTP `200` (0 ghi DB/Blob).
- [ ] Thử gọi `POST /api/team`, `POST /api/auth`, `POST /api/media/upload` và `POST /api/media/client-upload`: trả HTTP `403` (nếu Edge WAF Deny đang bật) hoặc HTTP `503 CUTOVER_WRITE_FROZEN` (`Cache-Control: no-store`, từ `guardCutoverWrite()`).

---

## 7. Mở Khóa Ghi & Smoke Tests Sau Unfreeze
- [ ] Đổi `P103_CUTOVER_FREEZE_WRITES=false` và `P103_CUTOVER_FREEZE_CALLBACKS=false` (hoặc xóa biến) trên **Vercel Dashboard → Production** và redeploy Production.
- [ ] Đợi deployment mới đạt trạng thái `Ready`.
- [ ] `GET /api/health` trả HTTP `200`.
- [ ] Đăng nhập Manager (`POST /api/auth`) và kiểm tra `GET /api/audit-logs` thành công.
- [ ] Thử 1 thao tác ghi có kiểm soát (và xác nhận xuất hiện bản ghi mới trong `audit_logs`).
- [ ] Kiểm tra `npx vercel logs` không có lỗi 500 hoặc lỗi kết nối DB.
- [ ] Xóa các file plaintext `.json` và `.sqlite` tạm trong `../backups/` (`rm -f ...`), chỉ giữ bản `.json.enc`.
- [ ] Thông báo hoàn tất bảo trì tới đội bóng và bắt đầu quy trình tái cấp mật khẩu theo [p103-account-recovery-runbook.md](p103-account-recovery-runbook.md).

---

## 8. Quy Tắc Rollback Nhanh (Nếu Có Sự Cố)
- **Nếu CHƯA mở khóa ghi** (`P103_CUTOVER_FREEZE_WRITES=true`):
  - [ ] Trỏ lại `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` trên Vercel Production về DB cũ (dùng lại RW token cũ).
  - [ ] Rollback Vercel Deployment về bản Production ổn định trước PR #19 (nếu lỗi code).
  - [ ] Kiểm tra `GET /api/health` + `/bao-cao-tai-chinh`, sau đó mới tắt `P103_CUTOVER_FREEZE_WRITES`.
- **Nếu ĐÃ mở khóa ghi và có giao dịch mới phát sinh**:
  - [ ] Bật lại `P103_CUTOVER_FREEZE_WRITES=true` và redeploy ngay lập tức.
  - [ ] Chụp backup khẩn cấp DB mới (`scripts/db-backup.mjs`).
  - [ ] **Không** tự ý trỏ về DB cũ khi chưa đối soát; thực hiện đối soát toàn bộ giao dịch mới (`audit_logs`, tài chính, điểm danh, `players`) trước khi fix-forward hoặc replay bù giao dịch.
