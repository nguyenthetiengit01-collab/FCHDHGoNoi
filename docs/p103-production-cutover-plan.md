# Kế Hoạch Cắt Chuyển Production P1-03 (Turso Cutover Plan) — FC HĐH Gò Nổi

Tài liệu thiết kế quy trình cắt chuyển (cutover) có kiểm soát cho hệ thống **FC HĐH Gò Nổi tại TP.HCM** (`https://fchdhgonoi.vercel.app/`) khi nâng cấp lên kiến trúc bảo mật **P1-03** trên một **Turso Production Database mới và sạch** (không rebuild trực tiếp bảng `players` qua Turso HTTP).

> [!CAUTION]
> **Nguyên tắc bất di bất dịch:**
> - **KHÔNG** dùng bản snapshot cũ (backup tuần tự động hoặc bản drill cũ) làm dữ liệu cắt chuyển cuối cùng.
> - **KHÔNG** rebuild bảng `players` trực tiếp trên Turso Production qua HTTP. Mọi thao tác migration `phase7-p103-pin-default-v1.mjs` phải thực hiện ngoại tuyến trên file SQLite cô lập nằm **ngoài** thư mục repository.
> - **KHÔNG** mở khóa ghi (`P103_CUTOVER_FREEZE_WRITES`) trước khi toàn bộ smoke test ở chế độ chỉ đọc trên Production mới đạt 100%.
> - **KHÔNG** commit file backup `.json`, `.json.enc`, `.sqlite`, hay bất kỳ token / private key / mã PIN nào vào Git.

---

## 1. Mục Tiêu RPO / RTO & Phân Công Trách Nhiệm (Incident Responsibilities)

### 1.1. Mục tiêu RPO & RTO
| Kịch bản | RPO (Mất dữ liệu tối đa) | RTO (Thời gian khôi phục) | Ghi chú |
| --- | --- | --- | --- |
| **Cắt chuyển có kế hoạch (Planned Cutover)** | **0 (Zero data loss)** | **<= 45 phút** | Đóng băng ghi trước khi chụp final backup nên không có giao dịch phát sinh bị bỏ sót. |
| **Rollback trước khi mở khóa ghi** | **0** | **<= 15 phút** | DB Production cũ còn nguyên vẹn; chỉ cần trỏ lại env vars + rollback deployment Vercel. |
| **Sự cố sau khi đã có giao dịch ghi mới** | **0 (sau đối soát)** | **<= 60 phút** | Bắt buộc đóng băng ghi lại và đối soát đầy đủ trước khi quyết định fix-forward hay rollback có bù giao dịch. |
| **Khôi phục thảm họa ngoài giờ cắt chuyển** | **<= 7 ngày** (hoặc **0** nếu DB gốc còn truy cập đọc) | **<= 60 phút** | Dựa trên artifact mã hóa tuần `.github/workflows/turso-backup.yml` và bản lưu trữ ngoại tuyến. |

### 1.2. Phân công trách nhiệm
- **Release Coordinator (Chủ sở hữu / Điều phối cắt chuyển)**:
  - Điều phối phê duyệt & merge **PR #21 vào `hotfix/p1-03-default-pin-containment`**, chạy lại CI trên **PR #19**, sau đó phê duyệt & merge **PR #19 vào `main`** để triển khai Bootstrap Deployment; thực thi đóng băng ghi trên Vercel, chuyển biến môi trường Production, và ra quyết định Go / No-Go / Rollback.
- **Database & Backup Custodian (Quản trị DB & Khóa giải mã)**:
  - Chụp final encrypted backup v3, giữ `privateKey` (`gonoi-priv-v1:...`) ngoại tuyến an toàn, chạy offline SQLite restore + dual-migration, re-export v3, và chạy `scripts/p103-cutover-restore.mjs` lên Turso Production mới.
- **Verifier / QA (Kiểm chứng dữ liệu & Smoke Test)**:
  - Đối chiếu `rowCounts`, `schema_migrations`, `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, kiểm tra số dư tài chính, và chạy smoke test trước & sau khi mở khóa ghi.
- **Team Comms (Ban Quản Lý / Thông báo đội bóng)**:
  - Thông báo khung giờ bảo trì (khuyến nghị ngoài giờ thi đấu/điểm danh), xác nhận hoàn tất, và phối hợp đợt tái cấp credential theo [p103-account-recovery-runbook.md](p103-account-recovery-runbook.md).

---

## 2. Giai Đoạn 1: Đóng Băng Ghi (Write Freeze Procedure)

### 2.1. Lý do KHÔNG được dùng snapshot cũ làm Final Cutover Backup
Mọi bản snapshot chụp trước thời điểm đóng băng ghi (kể cả backup tuần tự động hoặc bản test trước đó vài giờ) đều có nguy cơ thiếu các thao tác phát sinh sau thời điểm chụp: điểm danh RSVP, thu/chi quỹ trận, cập nhật hồ sơ cầu thủ, đổi PIN hoặc `audit_logs`. Việc dùng snapshot cũ sẽ làm **mất dữ liệu giao dịch thật** và **lệch sổ quỹ**. Do đó, final backup **chỉ được phép chụp sau khi Write Freeze đã có hiệu lực**.

### 2.2. Hai lớp đóng băng ghi & Thứ tự triển khai trên Vercel (Zero-Gap Freeze)
> [!IMPORTANT]
> **Ngữ nghĩa biến môi trường của Vercel & Lưu trữ Blob ngoài DB:**
> 1. Thay đổi biến môi trường trên Vercel Dashboard **chỉ có hiệu lực khi tạo một Deployment mới** (không tự áp dụng vào bản Production đang chạy).
> 2. Nhánh `main` hiện tại **chưa** có `P103_CUTOVER_FREEZE_WRITES` và chưa có cơ chế callback drain trước khi tích hợp **PR #21 → PR #19 → `main`**.
> 3. Token Turso `--read-only` chỉ chặn ghi vào Turso DB, **không** chặn ghi vào **Vercel Blob** (`BLOB_READ_WRITE_TOKEN` qua `/api/media/upload`, `/api/media/client-upload`).

Vì vậy, để đóng băng **100% đường ghi DB và Blob ngoài** mà không làm gãy upload in-flight, quy trình thực hiện theo **trình tự cắt chuyển chuẩn 12 bước**:

```text
PR Integration (PR #21 → PR #19 → main) / Bootstrap Deployment → Stage 1 → T_drain-start → Legacy Token Expiry (3.900s) & Callback Drain → Stage 2 → Read-only Turso → Final Backup → Offline Migration → Restore → DB Switch → Smoke Test → Unfreeze
```

### 2.3. Chi tiết Bootstrap Deployment & Hai Giai Đoạn Freeze
1. **Trình tự tích hợp PR & Bootstrap Deployment (Bắt buộc trước Stage 1)**:
   - *(Tài liệu này chỉ mô tả kế hoạch; mọi thao tác merge/deploy đều cần phê duyệt riêng của Owner).*
   - **Bước A**: Hoàn tất review & CI cho **PR #21** (`feat/p103-production-cutover-readiness` → `hotfix/p1-03-default-pin-containment`), sau đó Owner phê duyệt và merge **PR #21 vào nhánh `hotfix/p1-03-default-pin-containment`**.
   - **Bước B**: Chạy lại và xác nhận toàn bộ CI trên **PR #19** (`hotfix/p1-03-default-pin-containment` → `main`) đã bao gồm đủ code `cutoverFreeze.ts`, `clientUploadCallback.ts`, hai callback routes và route guards.
   - **Bước C**: Owner phê duyệt và merge **PR #19 vào `main`** để deploy **Bootstrap Deployment** (giữ `TURSO_AUTH_TOKEN` quyền ghi + `MEDIA_STORAGE_ENABLED=true`). Chỉ tiến hành Stage 1 sau khi xác minh Deployment SHA trên Production thực sự chứa cả containment lẫn cutover-freeze/callback.
   - **Rollback Bootstrap**: Nếu phát sinh lỗi ở Bootstrap Deployment (trước khi migrate DB), thực hiện **Vercel Instant Rollback** về bản Production ổn định trước đó (mục tiêu `RTO <= 5 phút`, `RPO = 0` — mục tiêu thiết kế, chưa phải SLA đã đo).
2. **Stage 1 — Stop Issuing New Upload Tokens & Ghi nhận `T_drain-start`**:
   - **Tầng Edge (Vercel Firewall / WAF `Deny` → HTTP `403`)**: Bật rule chặn `POST /api/*` **ngoại trừ cả hai callback path `/api/media/client-upload/callback` và `/api/media/client-upload`** (vì Edge WAF không inspect `body.type` trên endpoint cũ; `/api/media/client-upload` vẫn tự chặn cấp token mới ở tầng app với `503`), và chặn `GET /api/cron/analytics-cleanup`.
   - **Tầng ứng dụng**: Đặt `P103_CUTOVER_FREEZE_WRITES=true` (giữ `P103_CUTOVER_FREEZE_CALLBACKS` tắt, giữ `TURSO_AUTH_TOKEN` quyền ghi và `MEDIA_STORAGE_ENABLED=true`). Endpoint `/api/media/client-upload/callback` từ chối cấp token với `403 CALLBACK_TOKEN_GENERATION_FORBIDDEN`.
   - **Định nghĩa chuẩn `T_drain-start`**: là thời điểm muộn nhất đã được xác minh rằng **mọi Production ingress và mọi Production deployment có khả năng nhận traffic đều không thể cấp Legacy Blob Token nữa** (không bắt đầu đếm giờ chỉ vì mới sửa env var hoặc bật WAF khi deployment cũ vẫn còn nhận traffic). Ghi lại timestamp ISO-8601 kèm múi giờ, deployed SHA / Deployment ID và bằng chứng chặn token-gen.
3. **Legacy Token Expiry & Callback Drain (`>= 3.900 giây` = 65 phút từ `T_drain-start`)**:
   - Bản deploy cũ trước Bootstrap (`b9bad43:src/app/api/media/client-upload/route.ts`) không đặt `validUntil`, nên `@vercel/blob` `handleUpload()` mặc định cấp token có thời hạn **1 giờ (`3.600 giây`)** và `tokenPayload` cũ `{ entity, uploadedByPlayerId }`.
   - Công thức Drain tối thiểu: **`3.600 giây` (legacy max TTL) + `300 giây` (safety margin) = `3.900 giây` (65 phút)** tính từ **`T_drain-start`** (không dùng TTL `60 giây` của bản mới).
   - Stage 2 không được phép bắt đầu trước khi đủ `3.900 giây` từ `T_drain-start` và đã đối chiếu xong upload in-flight, callback chờ, callback retry trong `media_upload_records` (không còn Blob mồ côi).
4. **Stage 2 → Read-only Turso**:
   - Bật `P103_CUTOVER_FREEZE_CALLBACKS=true` (app trả `503 CUTOVER_WRITE_FROZEN` cho cả `/api/media/client-upload` và `/api/media/client-upload/callback`) và cập nhật Edge WAF `Deny` chặn toàn bộ `POST /api/*` gồm cả hai callback path (`403` trước khi vào app).
   - **Sau khi Stage 2 có hiệu lực**: chuyển `TURSO_AUTH_TOKEN` trên DB Production cũ sang `--read-only` (`turso db tokens create <old-prod-db-name> --read-only`), đặt `MEDIA_STORAGE_ENABLED=false` (nếu cần), và xác nhận **0 DB write, 0 Blob write** trước khi sang Giai đoạn 2 (Final Backup → Offline Migration → Restore → DB Switch → Smoke Test → Unfreeze).

---

## 3. Giai Đoạn 2: Final Encrypted v3 Backup & Lưu Trữ Khóa

### 3.1. Chụp Final Backup v3 (Read-Only)
Thực hiện từ máy vận hành, lưu file **bên ngoài thư mục Git** (ví dụ `../backups/`):
```bash
TURSO_DATABASE_URL="<old-prod-turso-url>" \
TURSO_AUTH_TOKEN="<old-prod-readonly-token>" \
  node scripts/db-backup.mjs --out ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json
```
Kiểm tra output JSON từ terminal:
- `status: "ok"`, `version: 3`
- Ghi nhận `objectCounts` (`tables`, `indexes`, `triggers`, `views`, `sequences`) và `rowCounts` của từng bảng (`players`, `matches`, `match_attendances`, `other_incomes`, `expenses`, `team_settings`, `audit_logs`, v.v.) làm **mốc đối chiếu chuẩn (golden baseline)**.

### 3.2. Mã hóa Artifact v3 bằng `backup-crypto.mjs`
Mã hóa file JSON vừa xuất bằng public key (`gonoi-pub-v1:...`, thuật toán `X25519-HKDF-SHA256-AES-256-GCM`):
```bash
BACKUP_ENCRYPTION_PUBLIC_KEY="gonoi-pub-v1:..." \
  node scripts/backup-crypto.mjs encrypt \
    --in ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json \
    --out ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json.enc
```
Lưu bản `.json.enc` vào ít nhất 2 nơi độc lập (máy vận hành + kho lưu trữ mã hóa ngoại tuyến / Google Drive riêng của Chủ sở hữu).

### 3.3. Quy tắc quản lý khóa Backup (Key Custody Rules)
- **Tách biệt khóa**: `TURSO_BACKUP_PUBLIC_KEY` (`gonoi-pub-v1:...`) dùng để mã hóa; `privateKey` (`gonoi-priv-v1:...`) **tuyệt đối không** lưu trên GitHub, Vercel env, hay commit vào repository.
- **Dự phòng 2 bản độc lập**: Lưu `privateKey` ở tối thiểu 2 nơi độc lập (Password Manager mã hóa + USB/Vault ngoại tuyến).
- **Bảo vệ file cục bộ**: Khi cần giải mã trên máy vận hành, luôn dùng `--private-key-file` với quyền `600` (tránh dán private key vào shell history):
  ```bash
  chmod 600 ~/.secrets/gonoi-backup-priv.key
  ```
- **Xoay vòng & lưu trữ khóa cũ**: Mỗi file `.json.enc` ghi nhận `keyId` (`k1-<fingerprint>`). Khi xoay vòng khóa, giữ lại `privateKey` cũ tối thiểu **30 ngày** cho tới khi mọi bản backup cũ hết hạn.
- **Dọn dẹp plaintext**: Xóa toàn bộ file `.json` giải mã tạm và file `.sqlite` trung gian ngay sau khi hoàn tất cắt chuyển và kiểm chứng.

---

## 4. Giai Đoạn 3: Offline SQLite Restore & Dual-Migration

> [!IMPORTANT]
> Cả `phase7-p103-pin-default-v1.mjs` và `phase7-p103-must-change-pin-v1.mjs` đều áp dụng `validateLocalSqlitePath`: từ chối mọi đường dẫn nằm **bên trong** thư mục repository và từ chối tên file `gonoifc.sqlite` hoặc chứa `prod` / `production`. Luôn đặt file SQLite tạm ở thư mục ngoài repo (ví dụ `../backups/cutover-work.sqlite`).

### 4.1. Giải mã (nếu thao tác từ bản `.json.enc`)
```bash
node scripts/backup-crypto.mjs decrypt \
  --in ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json.enc \
  --out ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json \
  --private-key-file ~/.secrets/gonoi-backup-priv.key
chmod 600 ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json
```

### 4.2. Restore vào file SQLite cô lập ngoại tuyến
```bash
node scripts/db-restore.mjs \
  --in ../backups/gonoi-prod-cutover-<YYYYMMDD-HHMM>.json \
  --target ../backups/cutover-work.sqlite \
  --confirm
```
Xác nhận `status: "ok"` và `restoredCounts` khớp 100% với golden baseline.

### 4.3. Chạy Dual-Migration trên file SQLite cô lập
1. **Migration 1 — Gỡ `DEFAULT '1234'` khỏi `players.pin_code`** (`scripts/migrations/phase7-p103-pin-default-v1.mjs`):
   ```bash
   # Dry-run trước
   node scripts/migrations/phase7-p103-pin-default-v1.mjs --sqlite ../backups/cutover-work.sqlite --dry-run
   # Áp dụng thật
   node scripts/migrations/phase7-p103-pin-default-v1.mjs --sqlite ../backups/cutover-work.sqlite
   ```
2. **Migration 2 — Bổ sung cột `players.must_change_pin`** (`scripts/migrations/phase7-p103-must-change-pin-v1.mjs`):
   ```bash
   # Dry-run trước
   node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --sqlite ../backups/cutover-work.sqlite --dry-run
   # Áp dụng thật
   node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --sqlite ../backups/cutover-work.sqlite
   ```

### 4.4. Re-export bản Backup v3 đã Migrate
Xuất lại toàn bộ schema và dữ liệu đã migrate từ `cutover-work.sqlite` ra file JSON v3 mới:
```bash
node scripts/db-backup.mjs \
  --sqlite ../backups/cutover-work.sqlite \
  --out ../backups/gonoi-prod-migrated-<YYYYMMDD-HHMM>.json
```
*(Khuyến nghị mã hóa thêm một bản `.json.enc` của file đã migrate để lưu vết phục hồi sau cutover.)*

---

## 5. Giai Đoạn 4: Restore Lên Turso Production Mới & Kiểm Chứng

### 5.1. Tạo Turso Production Database mới (trống)
```bash
turso db create fchdhgonoi-prod-cutover-nguyenthetiengit01-collab --group default
turso db show fchdhgonoi-prod-cutover-nguyenthetiengit01-collab --url
turso db tokens create fchdhgonoi-prod-cutover-nguyenthetiengit01-collab
```
*(Xác nhận URL từ `turso db show --url` khớp chính xác `libsql://fchdhgonoi-prod-cutover-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io`.)*

### 5.2. Chạy `scripts/p103-cutover-restore.mjs`
Script sử dụng biến môi trường riêng `TURSO_CUTOVER_TARGET_DATABASE_URL` và `TURSO_CUTOVER_TARGET_AUTH_TOKEN` (từ chối trùng lặp với `TURSO_DATABASE_URL` của Production cũ hay Staging, và **bắt buộc khớp chính xác** `APPROVED_CUTOVER_TARGET_HOST` = `fchdhgonoi-prod-cutover-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io` và `APPROVED_CUTOVER_TARGET_DB_NAME` = `fchdhgonoi-prod-cutover-nguyenthetiengit01-collab`; cờ `--expected-target-host <hostname>` chỉ là xác nhận bổ sung thứ hai, **không** mở rộng hay thay thế allowlist):
1. **Chạy `--dry-run` trước** (mặc định không ghi):
   ```bash
   TURSO_CUTOVER_TARGET_DATABASE_URL="<new-prod-turso-url>" \
   TURSO_CUTOVER_TARGET_AUTH_TOKEN="<new-prod-rw-token>" \
     node scripts/p103-cutover-restore.mjs \
       --in ../backups/gonoi-prod-migrated-<YYYYMMDD-HHMM>.json \
       --dry-run
   ```
   Kiểm tra output preflight: target là DB mới/trống, payload v3 hợp lệ, số lượng bảng & dòng dự kiến khớp baseline.
2. **Chạy `--apply --confirm-production-cutover`**:
   ```bash
   TURSO_CUTOVER_TARGET_DATABASE_URL="<new-prod-turso-url>" \
   TURSO_CUTOVER_TARGET_AUTH_TOKEN="<new-prod-rw-token>" \
     node scripts/p103-cutover-restore.mjs \
       --in ../backups/gonoi-prod-migrated-<YYYYMMDD-HHMM>.json \
       --apply --confirm-production-cutover
   ```

### 5.3. Kiểm chứng sau Restore (Post-Restore Verification)
Kiểm tra trực tiếp trên Turso Production DB mới (có thể dùng `turso db shell <new-prod-db-name>` hoặc script kiểm chứng read-only):
- **Row counts**: Số lượng dòng của mọi bảng (`players`, `matches`, `match_attendances`, `other_incomes`, `expenses`, `team_settings`, `audit_logs`, v.v.) phải **khớp chính xác** với golden baseline.
- **`schema_migrations`**: Có đủ cả 2 bản ghi `phase7-p103-pin-default-v1` và `phase7-p103-must-change-pin-v1`.
- **`pin_code DEFAULT`**: `PRAGMA table_info(players);` xác nhận cột `pin_code` có `dflt_value` là `''` (không còn `'1234'`).
- **`must_change_pin`**: `PRAGMA table_info(players);` xác nhận cột `must_change_pin` tồn tại (`INTEGER NOT NULL DEFAULT 0`).
- **Toàn vẹn cấu trúc**:
  - `PRAGMA integrity_check;` trả về `ok`.
  - `PRAGMA foreign_key_check;` trả về `0` dòng vi phạm.

---

## 6. Giai Đoạn 5: Chuyển Đổi Vercel Env Sang DB Mới (Trong Chế Độ Freeze)

> [!WARNING]
> **Thứ tự bắt buộc:** Giữ nguyên `P103_CUTOVER_FREEZE_WRITES=true` khi đổi `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` sang DB Production mới, sau đó **Redeploy Production** để biến môi trường mới có hiệu lực. Chỉ tắt `P103_CUTOVER_FREEZE_WRITES` **sau khi** smoke test ở chế độ chỉ đọc đã pass.

1. Xác nhận `P103_CUTOVER_FREEZE_WRITES=true` đang bật trên **Vercel Dashboard → Project Settings → Environment Variables (Production)**.
2. Cập nhật `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN` trên Vercel **Production** trỏ sang **Turso Production DB mới** (không sửa môi trường `Preview`).
3. Thực hiện **Redeploy Production** trên Vercel Dashboard và đợi deployment mới đạt trạng thái `Ready`.
4. **Chạy Smoke Tests (Chế độ Read-Only Freeze)** (xem Mục 7.1).
5. **Mở khóa ghi (Unfreeze Writes)**:
   - Chỉ khi toàn bộ Smoke Test mục 7.1 đạt: cập nhật `P103_CUTOVER_FREEZE_WRITES=false` (hoặc xóa biến) trên Vercel Production và thực hiện Redeploy Production.
6. **Chạy Smoke Tests (Sau khi mở khóa ghi)** (xem Mục 7.2).
7. Dọn dẹp file `.json` plaintext và `.sqlite` tạm trên máy vận hành (`rm -f ...`).

---

## 7. Smoke Tests (Trong Read-Only Freeze & Sau Khi Mở Khóa Ghi)

### 7.1. Smoke Tests khi đang đóng băng ghi (`P103_CUTOVER_FREEZE_WRITES=true`)
- `GET https://fchdhgonoi.vercel.app/api/health`: trả HTTP `200`, JSON `{ "status": "ok", "db": "connected", ... }`.
- Trang chủ (`/`), danh sách cầu thủ công khai, `/bao-cao-tai-chinh`, `GET /api/team` (Guest), `GET /api/auth` (Guest) và `GET /api/media/legacy`: hiển thị đầy đủ dữ liệu, số dư quỹ khớp với sổ cũ, 0 ghi DB/Blob.
- *(Với cookie `fc_session` Manager đã lấy từ trước freeze)* `GET /api/audit-logs` và `GET /api/export`: trả HTTP `200` với 0 DDL/DML và 0 ghi Blob.
- Thử gọi `POST /api/team`, `POST /api/auth`, `POST /api/media/upload` và `POST /api/media/client-upload`:
  - Khi **Edge WAF Deny** đang bật: trả HTTP **`403`** tại edge.
  - Khi kiểm tra trực tiếp lớp ứng dụng **`guardCutoverWrite()`** (WAF đã tắt hoặc test nội bộ): trả HTTP **`503`** (`code: "CUTOVER_WRITE_FROZEN"`, `Cache-Control: no-store`, `Retry-After: 300`), không làm thay đổi dữ liệu trong DB mới hay Vercel Blob. *(Lưu ý: `POST /api/auth` bị khóa trong thời gian freeze để chặn auto-rehash; kiểm tra đăng nhập mới thực hiện ở mục 7.2 sau khi mở khóa ghi.)*

### 7.2. Smoke Tests sau khi mở khóa ghi (`P103_CUTOVER_FREEZE_WRITES=false`)
- `GET /api/health` trả HTTP `200`.
- Đăng nhập Manager (`POST /api/auth`) và kiểm tra `GET /api/audit-logs`: đọc được nhật ký cũ bình thường.
- Thực hiện một thao tác ghi có kiểm soát (ví dụ Manager thực hiện đổi/reset mật khẩu cho 1 tài khoản thử nghiệm hoặc ghi nhận 1 điểm danh test rồi hoàn tác) → thành công, có bản ghi mới trong `audit_logs`.
- Kiểm tra luồng `must_change_pin`: tài khoản vừa được reset bị chặn API nghiệp vụ với HTTP `403 PIN_CHANGE_REQUIRED` cho tới khi hoàn tất `change_own_password`.
- **Đối chiếu Blob mồ côi (Orphan Reconciliation)**: Nếu có upload in-flight trong cửa sổ `[T_freeze - 60s, T_freeze + 60s]`, đối chiếu danh sách Blob mới tạo với các cột URL trong DB (`players`, `club_posts`, `sponsors`) và xóa các Blob object chưa được tham chiếu.
- Kiểm tra `npx vercel logs` không có lỗi 500 hoặc lỗi kết nối Turso.

---

## 8. Chiến Lược Rollback (Trước vs Sau Khi Có Giao Dịch Mới)

### 8.1. Rollback TRƯỚC khi mở khóa ghi (`P103_CUTOVER_FREEZE_WRITES=true`)
Tại thời điểm này, **chưa có bất kỳ giao dịch ghi mới nào** phát sinh trên DB Production mới; DB Production cũ vẫn nguyên vẹn 100%:
1. Trên Vercel Dashboard (Production), trỏ lại `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN` về **DB Production cũ** (nếu đã đổi sang token RO trên DB cũ thì khôi phục lại token RW cũ).
2. Nếu lỗi đến từ code PR #19, thực hiện **Rollback Deployment** trên Vercel Dashboard về bản Production ổn định ngay trước PR #19.
3. Kiểm tra `GET /api/health` và trang `/bao-cao-tai-chinh`.
4. Tắt `P103_CUTOVER_FREEZE_WRITES` (sau khi đã xác nhận trỏ đúng DB cũ + code ổn định).

### 8.2. Rollback SAU khi đã mở khóa ghi và có giao dịch/thay đổi mới
> [!CAUTION]
> **TUYỆT ĐỐI KHÔNG** trỏ thẳng về DB Production cũ hoặc ghi đè lại DB cũ nếu đã có giao dịch tài chính, điểm danh, reset PIN hay `audit_logs` mới phát sinh trên DB mới. Việc rollback mù quáng sẽ làm **mất trắng giao dịch mới** của đội bóng.

Quy trình bắt buộc khi cần xử lý sự cố sau khi đã có giao dịch mới:
1. **Đóng băng ghi ngay lập tức**: Đặt lại `P103_CUTOVER_FREEZE_WRITES=true` trên Vercel Production và redeploy để ngăn dữ liệu tiếp tục phân kỳ.
2. **Chụp backup khẩn cấp DB mới**:
   ```bash
   TURSO_DATABASE_URL="<new-prod-turso-url>" \
   TURSO_AUTH_TOKEN="<new-prod-rw-token>" \
     node scripts/db-backup.mjs --out ../backups/gonoi-incident-snapshot-<YYYYMMDD-HHMM>.json
   ```
3. **Đánh giá Fix-Forward vs Rollback có đối soát**:
   - **Ưu tiên Fix-Forward**: Nếu lỗi chỉ nằm ở UI/API code (dữ liệu DB mới chuẩn), giữ nguyên DB mới, vá hotfix hoặc rollback code có tương thích schema, rồi mở khóa ghi.
   - **Nếu bắt buộc phải quay lại DB cũ**: Thực hiện **đối soát bắt buộc (Mandatory Reconciliation)** toàn bộ các bảng có phát sinh (`audit_logs`, `matches`, `match_attendances`, `other_incomes`, `expenses`, `players`) giữa bản snapshot sự cố và DB cũ; xuất danh sách giao dịch chênh lệch và nhập/bù đầy đủ (replay) sang DB đích trước khi mở khóa ghi cho người dùng.

---

## Tài Liệu Liên Quan
- [p103-production-cutover-checklist.md](p103-production-cutover-checklist.md) — Checklist thực thi từng bước tại thời điểm cắt chuyển.
- [operations-runbook.md](operations-runbook.md) — Runbook vận hành tổng quát.
- [p103-account-recovery-runbook.md](p103-account-recovery-runbook.md) — Quy trình tái cấp mật khẩu 4 đợt sau khi cắt chuyển P1-03.
- [turso-staging-guide.md](turso-staging-guide.md) — Hướng dẫn diễn tập trên Turso Staging.
