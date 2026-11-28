# Operations & Incident Runbook — FC HĐH Gò Nổi

Tài liệu vận hành chính thức cho hệ thống **FC HĐH Gò Nổi tại TP.HCM** (`https://fchdhgonoi.vercel.app/`).

---

## 1. Monitoring & Healthcheck

- **Endpoint**: `GET /api/health`
- **Kỳ vọng khỏe mạnh**: HTTP `200`, JSON `{ "status": "ok", "db": "connected", "latencyMs": <number>, "timestamp": <iso> }`, `Cache-Control: no-store`.
- **Trạng thái lỗi**: HTTP `503`, JSON `{ "status": "degraded", "db": "unreachable" }`.
- **Runtime Logs (Vercel)**:
  ```bash
  npx vercel logs --deployment <deployment-url-or-id>
  ```

---

## 2. Backup Định Kỳ Turso & Kiểm Tra Tính Toàn Vẹn

### 2.1. Sao lưu Read-Only Thủ Công
- Xuất bản sao JSON (gồm cả `schema` DDL và toàn bộ dữ liệu các bảng) ra ngoài thư mục Git:
  ```bash
  TURSO_DATABASE_URL="..." TURSO_AUTH_TOKEN="..." \
    node scripts/db-backup.mjs --out ../backups/gonoi-prod-$(date +%Y%m%d).json
  ```
- **Không bao giờ** commit file backup, file `.sqlite` / `.db` hoặc secrets vào Git.

### 2.2. Lịch Backup Tự Động (`.github/workflows/turso-backup.yml`)
Workflow [turso-backup.yml](../.github/workflows/turso-backup.yml) chỉ kích hoạt trên nhánh `main` (sau khi release) theo lịch tuần (`0 20 * * 0` UTC = 03:00 sáng Thứ Hai UTC+7) hoặc chạy thủ công qua `workflow_dispatch`:

- **Repository Secrets bắt buộc** (cấu hình trong **GitHub → Settings → Secrets and variables → Actions**):
  - `TURSO_PROD_DATABASE_URL`: URL Production Turso DB (ánh xạ vào `TURSO_DATABASE_URL`).
  - `TURSO_PROD_AUTH_TOKEN_RO`: Token **chỉ đọc (`--read-only`)** (ánh xạ vào `TURSO_AUTH_TOKEN`). Tuyệt đối không dùng token có quyền ghi Production trong workflow backup.
  - `TURSO_BACKUP_PUBLIC_KEY`: Khóa công khai (`gonoi-pub-v1:...`) sinh ngoại tuyến bằng `node scripts/backup-crypto.mjs keygen`. **Tuyệt đối không** lưu private key (`gonoi-priv-v1:...`) trên GitHub repository.
- **Bảo vệ & Mã hóa Artifact (X25519 + HKDF-SHA256 + AES-256-GCM)**:
  - File backup chứa dữ liệu nhạy cảm (`players.phone`, `players.pin_code`, giao dịch tài chính, `audit_logs`), do đó workflow mã hóa thành `.json.enc` và xóa file plaintext trước khi upload.
  - `concurrency: turso-production-backup` (`cancel-in-progress: false`), `timeout-minutes: 15`, `permissions: contents: read`, mọi action đều pin bằng full 40-char commit SHA, không có `continue-on-error`.
  - Artifact `turso-prod-backup-<run_id>.enc` lưu với `retention-days: 30`, `if-no-files-found: error`. Đề xuất chủ sở hữu tải định kỳ bản `.enc` sang kho lưu trữ độc lập thứ hai (ví dụ Google Drive / ổ cứng mã hóa ngoại tuyến).
- **Giải mã & Kiểm chứng Restore (Chỉ trên SQLite tạm hoặc Staging riêng)**:
  - Ưu tiên dùng `--private-key-file` (file quyền `600`, không dán private key trực tiếp vào shell history):
  ```bash
  chmod 600 ~/.secrets/gonoi-backup-priv.key
  node scripts/backup-crypto.mjs decrypt \
    --in ../backups/gonoi-prod-backup.json.enc \
    --out ../backups/decrypted.json \
    --private-key-file ~/.secrets/gonoi-backup-priv.key
  chmod 600 ../backups/decrypted.json
  node scripts/db-restore.mjs --in ../backups/decrypted.json --target ../backups/verify.sqlite --confirm
  # Hoặc kiểm chứng lên Turso Staging riêng (fchdhgonoi-staging-restore):
  node scripts/db-restore.mjs --env staging --in ../backups/decrypted.json --confirm
  rm -f ../backups/decrypted.json ../backups/verify.sqlite
  ```
  - Không tự động xóa database Staging sau kiểm thử; luôn xóa file `decrypted.json` ngay sau khi kiểm tra xong.
- **Lưu trữ Dự Phòng & Xoay Vòng Khóa (Key Recovery & Rotation)**:
  - Lưu **hai bản sao độc lập** của `privateKey` (ví dụ: Password Manager được mã hóa + USB/Vault ngoại tuyến) và định kỳ kiểm tra giải mã thử từ bản sao dự phòng để chắc chắn khóa phục hồi hoạt động.
  - Mỗi file `.json.enc` mang trường `keyId` (`k1-<fingerprint>`). Khi xoay vòng khóa (cập nhật `TURSO_BACKUP_PUBLIC_KEY` mới trên GitHub), **giữ lại private key cũ tối thiểu 30 ngày** cho tới khi toàn bộ artifact cũ hết hạn retention.
- **Hướng dẫn Staging chi tiết**: Xem [turso-staging-guide.md](turso-staging-guide.md).

---

## 3. Quy Trình Phục Hồi Production (Không Ghi Đè Trực Tiếp)

1. **Tạo database Turso mới hoặc nhánh phục hồi** (không ghi đè trực tiếp lên Production DB đang lỗi trước khi kiểm tra).
2. **Chạy Restore Drill cục bộ** từ bản sao lưu JSON gần nhất để kiểm tra schema, `rowCounts` và đối chiếu số dư tài chính:
   ```bash
   node scripts/db-restore.mjs --in ../backups/gonoi-backup.json --target ../backups/verify.sqlite --confirm
   ```
3. **Đẩy dữ liệu đã kiểm tra lên Turso DB phục hồi** (dùng `db-restore.mjs --env staging` với `TURSO_STAGING_RESTORE_DATABASE_URL` / `TURSO_STAGING_RESTORE_AUTH_TOKEN` cho Staging Restore `fchdhgonoi-staging-restore`, hoặc client đã xác thực cho DB đích mới) và kiểm tra bảng `team_settings`, `players`, `matches`, `match_attendances`, `other_incomes`, `expenses`, `audit_logs`.
   - **Lưu ý migration & cutover P1-03**:
     - Không bao giờ rebuild bảng `players` trực tiếp qua Turso HTTP (`phase7-p103-pin-default-v1.mjs --env staging` chỉ là preflight read-only trên `TURSO_STAGING_RESTORE_DATABASE_URL`). Mọi thao tác rebuild `players` phải chạy trên file SQLite cô lập (`--sqlite <isolated-temp-path.sqlite>`) rồi mới restore lên Turso DB đích sạch.
     - Migration bổ sung cột (`phase7-p103-must-change-pin-v1.mjs --env staging`) sử dụng `TURSO_STAGING_RESTORE_DATABASE_URL` và `TURSO_STAGING_RESTORE_AUTH_TOKEN` (`role="target"`), tách biệt hoàn toàn với DB nguồn `TURSO_STAGING_DATABASE_URL` và Production `TURSO_DATABASE_URL`.
     - Trong cửa sổ cắt chuyển Production P1-03, áp dụng **Two-Stage Freeze** với cửa sổ drain tối thiểu **`3.900 giây` (65 phút)**:
       - **Thời hạn token & công thức Drain Window**: Legacy token TTL là **`3.600 giây` (1 giờ)** (mặc định của `@vercel/blob` `handleUpload()` trước Bootstrap), New token TTL là **`60 giây`** (`CLIENT_UPLOAD_TOKEN_TTL_MS`), và Safety margin là **`300 giây` (5 phút)** ⇒ Drain window bắt buộc = **`3.600 + 300 = 3.900 giây` (65 phút)**.
       - **Mốc `T_drain-start`**: là thời điểm muộn nhất đã được xác minh rằng mọi Production ingress và mọi Production deployment có khả năng nhận traffic đều đã ngừng cấp Legacy Token hoàn toàn (ghi lại ISO-8601 + múi giờ + Deployment ID/SHA; không tính từ lúc mới sửa env var khi deployment cũ vẫn còn nhận traffic). Stage 1 chỉ bắt đầu Bootstrap Production sau khi **PR #21** đã tích hợp vào **PR #19** và **PR #19** được merge vào `main`.
       - **Stage 1 (Ngừng cấp token mới & Drain)**: bật `P103_CUTOVER_FREEZE_WRITES=true` + Edge WAF `Deny` (`HTTP 403`) cho các `POST /api/*` ghi dữ liệu, **nhưng Edge WAF Stage 1 phải cho phép cả hai callback path** (`/api/media/client-upload/callback` và `/api/media/client-upload`) vì WAF không phân biệt `blob.generate-client-token` và `blob.upload-completed` trong cùng endpoint cũ bằng request body. Endpoint cũ dựa vào application logic (`guardCutoverWrite()`) để từ chối token generation (`HTTP 503`) nhưng vẫn cho phép `blob.upload-completed` hợp lệ; endpoint mới chỉ xử lý callback, không cấp token (`HTTP 403`). Cả hai đều đi qua shared handler `handleClientUploadCompletedCallback`, và **giữ nguyên Turso Read/Write cùng `MEDIA_STORAGE_ENABLED=true`** để callback đã xác thực ghi metadata idempotent vào DB:
         - `POST /api/media/client-upload`: Stage 1 token generation → Application từ chối **`HTTP 503`** (`CUTOVER_WRITE_FROZEN`); Stage 1 callback → cho phép `blob.upload-completed` hợp lệ qua `handleClientUploadCompletedCallback`.
         - `POST /api/media/client-upload/callback`: Stage 1 token generation → không hỗ trợ, **`HTTP 403`** (`CALLBACK_TOKEN_GENERATION_FORBIDDEN`); Stage 1 callback → cho phép callback hợp lệ qua `handleClientUploadCompletedCallback`.
       - **Stage 2 (Đóng hoàn toàn trước Final Backup)**: chỉ cho phép chuyển sang Stage 2 sau khi đã đủ **`3.900 giây`** kể từ mốc `T_drain-start` hợp lệ, đồng thời hoàn tất đối chiếu các upload đang thực hiện, callback chờ và callback retry. Khi vào Stage 2: bật `P103_CUTOVER_FREEZE_CALLBACKS=true` (application freeze trả **`HTTP 503`** `CUTOVER_WRITE_FROZEN`), Edge WAF chặn cả callback với **`HTTP 403`**, và **sau khi xác nhận callback drain hoàn tất** mới chuyển Turso sang `--read-only` và đặt `MEDIA_STORAGE_ENABLED=false` trước khi chụp final backup. Chỉ tắt các cờ freeze sau khi smoke test sau cutover đạt. Chi tiết xem [p103-production-cutover-plan.md](p103-production-cutover-plan.md) và [p103-production-cutover-checklist.md](p103-production-cutover-checklist.md).
4. **Chuyển trỏ biến môi trường Production** trên Vercel Dashboard (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) sang DB phục hồi, redeploy Production và kiểm tra `GET /api/health` + `/bao-cao-tai-chinh`.

---

## 4. Nhật Ký Thao Tác Quản Trị (`audit_logs`)

- Mọi thao tác ghi qua `POST /api/team` và `POST /api/import` được ghi nhận vào bảng `audit_logs` (`actor_id`, `actor_name`, `actor_role`, `action`, `summary`, `created_at`) — **tuyệt đối không lưu `pin_code`, mật khẩu hay token**.
- Xem nhật ký qua `GET /api/audit-logs` (chỉ dành cho tài khoản **Manager**).

---

## 5. Quy Trình Xử Lý Sự Cố & Rollback Code Production

1. Kiểm tra `GET /api/health` và `npx vercel logs` để xác định lỗi ứng dụng hay lỗi kết nối Turso DB.
2. Nếu lỗi phát sinh từ bản phát hành mới:
   - Không reset DB, không force push `main`.
   - Rollback nhanh trên Vercel Dashboard về Deployment Production ổn định trước đó.
3. Nếu liên quan đến `AUTH_SECRET` hoặc `TURSO_AUTH_TOKEN`:
   - Chủ sở hữu kiểm tra trực tiếp trên **Vercel Dashboard → Project Settings → Environment Variables** (tách riêng `Preview` và `Production`).
