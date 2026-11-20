# Operations & Incident Runbook — FC HĐH Gò Nổi

Tài liệu vận hành chính thức cho hệ thống **FC HĐH Gò Nổi tại TP.HCM** (`https://fchdhgonoi.vercel.app/`).

---

## 1. Monitoring, Healthcheck & Alerting Ownership

- **Endpoint**: `GET /api/health`
- **Kỳ vọng khỏe mạnh**: HTTP `200`, JSON `{ "status": "ok", "db": "connected", "latencyMs": <number>, "timestamp": <iso> }`, `Cache-Control: no-store`.
- **Trạng thái lỗi**: HTTP `503`, JSON `{ "status": "degraded", "db": "unreachable" }`.
- **Runtime Logs (Vercel)**:
  ```bash
  npx vercel logs --deployment <deployment-url-or-id>
  ```
- **Monitoring & Alerting Ownership (`P2-12`)**:
  - **Monitoring Owner**: `TBD — Pending Owner Confirmation` (Primary + Backup).
  - **Healthcheck Probe Cadence**: Kiểm tra `GET /api/health` sau mỗi lần deploy Production và kiểm tra định kỳ hàng tuần (hoặc qua uptime monitor ngoài nếu chủ sở hữu kích hoạt).
  - **Alerting Channels**:
    - **GitHub Actions**: Thông báo lỗi workflow `.github/workflows/ci.yml` và `.github/workflows/turso-backup.yml` qua GitHub Notifications/Email của Repository Owner (lưu ý: `turso-backup.yml` cần bổ sung step cảnh báo lỗi chủ động nếu backup thất bại).
    - **Vercel Dashboard**: Cảnh báo build/deployment failure và runtime `5xx` trên Production.
    - **Zalo Ban Quản Lý**: Kênh leo thang nội bộ khi phát hiện sự cố SEV1/SEV2.

---

## 2. Backup Định Kỳ Turso, RPO/RTO & DR Ownership

### 2.1. RPO / RTO & DR Ownership (`P1-12`)

> **Lưu ý minh bạch trạng thái**: Các chỉ tiêu RPO/RTO dưới đây phân biệt rõ **trạng thái đã chứng minh hiện tại** và **mục tiêu đề xuất chờ chủ sở hữu phê duyệt**. Không coi các mục tiêu đề xuất là đã đạt được.

| Hạng mục DR | Trạng thái đã chứng minh hiện tại | Mục tiêu đề xuất (Chờ Owner phê duyệt) |
| :--- | :--- | :--- |
| **Lịch Backup tự động** | Hàng tuần (`0 20 * * 0` UTC = 03:00 UTC+7 Thứ Hai) + `workflow_dispatch` trong `.github/workflows/turso-backup.yml` | Duy trì kiểm tra sau mỗi lần chạy; cân nhắc nâng lên **hàng ngày** |
| **Lần Backup thành công gần nhất** | Run thủ công `43839671777` ngày `2026-11-16` (`0` lần chạy tự động theo `schedule` tính đến `2026-11-20`; lần `schedule` đầu tiên dự kiến `2026-11-22`) | Xác nhận run `2026-11-22` thành công và theo dõi liên tục |
| **RPO (Recovery Point Objective)** | `NOT DOCUMENTED` (RPO thực tế từ lịch tuần hiện tại = tối đa **7 ngày**; chưa cấu hình/tài liệu hóa Turso PITR) | **<= 24 giờ** (nếu bật backup hàng ngày hoặc xác minh Turso PITR) hoặc **<= 7 ngày** (nếu giữ lịch tuần) |
| **RTO (Recovery Time Objective)** | `NOT DOCUMENTED` (chưa có SLA chính thức cho phục hồi thủ công Turso + Vercel) | **<= 2 giờ** cho quy trình phục hồi thủ công toàn phần |
| **Tần suất Restore Drill** | Chưa định kỳ (Local synthetic drill gần nhất: `2026-11-20` — **PASSED** trong thư mục tạm cô lập) | **Hàng quý (Quarterly)** trên Staging + trước mỗi đợt migration lớn |
| **DR Owner (Primary / Backup)** | `TBD — Pending Owner Confirmation` | Chủ sở hữu chỉ định rõ **Primary DR Owner** và **Backup DR Owner** + SĐT/Zalo liên hệ |

### 2.2. Sao lưu Read-Only Thủ Công
- Xuất bản sao JSON (gồm cả `schema` DDL và toàn bộ dữ liệu các bảng) ra ngoài thư mục Git:
  ```bash
  TURSO_DATABASE_URL="..." TURSO_AUTH_TOKEN="..." \
    node scripts/db-backup.mjs --out ../backups/gonoi-prod-$(date +%Y%m%d).json
  ```
- **Không bao giờ** commit file backup, file `.sqlite` / `.db` hoặc secrets vào Git.

### 2.3. Lịch Backup Tự Động (`.github/workflows/turso-backup.yml`)
Workflow [turso-backup.yml](../.github/workflows/turso-backup.yml) chỉ kích hoạt trên nhánh `main` theo lịch tuần (`0 20 * * 0` UTC) hoặc chạy thủ công qua `workflow_dispatch`:

- **Repository Secrets bắt buộc** (cấu hình trong **GitHub → Settings → Secrets and variables → Actions**):
  - `TURSO_PROD_DATABASE_URL`: URL Production Turso DB (ánh xạ vào `TURSO_DATABASE_URL`).
  - `TURSO_PROD_AUTH_TOKEN_RO`: Token **chỉ đọc (`--read-only`)** (ánh xạ vào `TURSO_AUTH_TOKEN`). Tuyệt đối không dùng token có quyền ghi Production trong workflow backup.
  - `TURSO_BACKUP_PUBLIC_KEY`: Khóa công khai (`gonoi-pub-v1:...`) sinh ngoại tuyến bằng `node scripts/backup-crypto.mjs keygen`. **Tuyệt đối không** lưu private key (`gonoi-priv-v1:...`) trên GitHub repository.
- **Bảo vệ & Mã hóa Artifact (X25519 + HKDF-SHA256 + AES-256-GCM)**:
  - File backup chứa dữ liệu nhạy cảm (`players.phone`, `players.pin_code`, giao dịch tài chính, `audit_logs`), do đó workflow mã hóa thành `.json.enc` và xóa file plaintext trước khi upload.
  - `concurrency: turso-production-backup` (`cancel-in-progress: false`), `timeout-minutes: 15`, `permissions: contents: read`, mọi action đều pin bằng full 40-char commit SHA, không có `continue-on-error`.
  - Artifact `turso-prod-backup-<run_id>.enc` lưu với `retention-days: 30`, `if-no-files-found: error`. Đề xuất chủ sở hữu tải định kỳ bản `.enc` sang kho lưu trữ độc lập thứ hai (ví dụ Google Drive / ổ cứng mã hóa ngoại tuyến).
- **Lưu trữ Dự Phòng & Xoay Vòng Khóa (Key Recovery & Rotation)**:
  - Lưu **hai bản sao độc lập** của `privateKey` (ví dụ: Password Manager được mã hóa + USB/Vault ngoại tuyến) và định kỳ kiểm tra giải mã thử từ bản sao dự phòng.
  - Mỗi file `.json.enc` mang trường `keyId` (`k1-<fingerprint>`). Khi xoay vòng khóa (cập nhật `TURSO_BACKUP_PUBLIC_KEY` mới trên GitHub), **giữ lại private key cũ tối thiểu 30 ngày** cho tới khi toàn bộ artifact cũ hết hạn retention.
- **Hướng dẫn Staging chi tiết**: Xem [turso-staging-guide.md](turso-staging-guide.md) và [disaster-recovery-and-staging-rehearsal.md](phase-7/disaster-recovery-and-staging-rehearsal.md).

---

## 3. Quy Trình Phục Hồi (Tách Biệt Local, Staging & Production)

> **Nguyên tắc an toàn**: Tách biệt hoàn toàn 3 môi trường dưới đây. `scripts/db-restore.mjs` chỉ cho phép ghi vào file SQLite cục bộ hoặc database Staging cô lập `fchdhgonoi-staging-restore` — **tuyệt đối không** chạy tự động trong CI và **không** ghi đè trực tiếp lên Production DB đang chạy.

### 3.1. Workflow 1 — Local SQLite Restore (Kiểm chứng cục bộ / Drill)
Dùng file tạm ngoài thư mục Git và xóa ngay file plaintext sau khi kiểm tra:
```bash
chmod 600 ~/.secrets/gonoi-backup-priv.key
node scripts/backup-crypto.mjs decrypt \
  --in ../backups/gonoi-prod-backup.json.enc \
  --out ../backups/decrypted.json \
  --private-key-file ~/.secrets/gonoi-backup-priv.key
chmod 600 ../backups/decrypted.json

node scripts/db-restore.mjs \
  --in ../backups/decrypted.json \
  --target ../backups/verify.sqlite \
  --confirm

rm -f ../backups/decrypted.json ../backups/verify.sqlite
```

### 3.2. Workflow 2 — Turso Staging Restore (`fchdhgonoi-staging` → `fchdhgonoi-staging-restore`)
Chỉ sử dụng biến môi trường Staging tách biệt (`TURSO_STAGING_DATABASE_URL`, `TURSO_STAGING_AUTH_TOKEN`, `TURSO_STAGING_RESTORE_DATABASE_URL`, `TURSO_STAGING_RESTORE_AUTH_TOKEN`), không chứa bất kỳ credential Production nào trong shell:
```bash
# 1. Pre-flight kiểm tra phân tách nguồn / đích / Production
node scripts/db-restore.mjs --env staging --preflight-only

# 2. Thực hiện restore vào fchdhgonoi-staging-restore
node scripts/db-restore.mjs --env staging --in ../backups/decrypted.json --confirm

# 3. Xóa file plaintext ngay sau khi kiểm tra
rm -f ../backups/decrypted.json
```

### 3.3. Workflow 3 — Production Recovery (Phê duyệt chủ sở hữu, không tự động hóa)
1. **Phê duyệt bắt buộc**: Phải có xác nhận trực tiếp từ **Repository/Club Owner** trước khi khởi tạo hoặc chuyển trỏ Production DB.
2. **Tạo Turso Production Recovery DB mới**: Tạo một database Turso hoàn toàn mới (ví dụ `fchdhgonoi-prod-recovery-YYYYMMDD`) với cặp credential RW riêng biệt (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` mới) — không ghi đè trực tiếp lên Production DB cũ trước khi xác minh xong.
3. **Kiểm chứng cục bộ trước khi đẩy lên Recovery DB**:
   - Giải mã bản backup `.json.enc` mới nhất và chạy Local SQLite Restore vào `../backups/verify.sqlite` theo mục `3.1`.
   - Kiểm tra `rowCounts` trên toàn bộ bảng, chạy `PRAGMA integrity_check;` (`ok`) và `PRAGMA foreign_key_check;` (0 vi phạm).
4. **Đẩy dữ liệu đã kiểm chứng lên Turso Recovery DB mới**:
   - Vì `db-restore.mjs` cố ý chặn ghi từ xa ngoài `fchdhgonoi-staging-restore`, nạp dữ liệu từ `verify.sqlite` đã kiểm chứng lên Recovery DB mới bằng `sqlite3 ../backups/verify.sqlite .dump` qua `turso db shell <recovery-db-name>` (hoặc client có quyền ghi riêng trên Recovery DB mới).
5. **Đối chiếu toàn vẹn & tài chính trên Recovery DB**:
   - Kiểm tra đủ 9 bảng lõi (`team_settings`, `players`, `matches`, `match_attendances`, `other_incomes`, `expenses`, `club_posts`, `sponsors`, `audit_logs`) và các bảng phụ trợ nếu có (`schema_migrations`, `player_lifecycle_events`, `product_analytics_events`, `product_analytics_daily`, `product_analytics_monthly_actors`).
   - Đối chiếu `rowCounts`, `PRAGMA foreign_key_check` và tổng thu/chi (`totalIncome`, `totalExpense`, `currentBalance`, `tournament_fund_reserve`).
6. **Chuyển trỏ Vercel Production & Smoke Test**:
   - Cập nhật `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN` trên **Vercel Dashboard → Production** sang Recovery DB mới, redeploy Production, xác nhận `GET /api/health` (`200`), kiểm tra `/bao-cao-tai-chinh` và xóa toàn bộ file tạm (`decrypted.json`, `verify.sqlite`).

---

## 4. Nhật Ký Thao Tác Quản Trị (`audit_logs`)

- Mọi thao tác ghi qua `POST /api/team` và `POST /api/import` được ghi nhận vào bảng `audit_logs` (`actor_id`, `actor_name`, `actor_role`, `action`, `summary`, `created_at`) — **tuyệt đối không lưu `pin_code`, mật khẩu hay token**.
- Xem nhật ký qua `GET /api/audit-logs` (chỉ dành cho tài khoản **Manager**).

---

## 5. Chính Sách Tương Thích Schema & Rollback Migration (`P1-11`)

### 5.1. Chiến lược Expand-and-Contract
Mọi thay đổi schema trên Turso Production bắt buộc tuân theo mô hình **Expand-and-Contract** 4 bước:
1. **Expand**: Chỉ thêm bảng mới (`CREATE TABLE IF NOT EXISTS`) hoặc thêm cột mới ở trạng thái nullable / có giá trị `DEFAULT` an toàn (`ALTER TABLE ... ADD COLUMN`). Không xóa hoặc đổi tên cột đang dùng.
2. **Deploy Code**: Phát hành code đọc/ghi tương thích cả cấu trúc cũ và mới.
3. **Backfill & Verify**: Chạy script backfill idempotent trên Staging trước, sau đó trên Production; kiểm tra `rowCounts` và dữ liệu.
4. **Contract**: Chỉ xóa cột/bảng cũ ở một bản phát hành sau khi cửa sổ rollback đã đóng và không còn deployment cũ nào phụ thuộc.

### 5.2. Thay Đổi Tương Thích Ngược vs. Phá Vỡ Tương Thích
- **Tương thích ngược (An toàn cho code rollback)**: Thêm bảng mới, thêm cột nullable hoặc có `DEFAULT`, thêm index mới.
- **Phá vỡ tương thích (Cấm thực hiện cùng lúc với feature code)**: `DROP TABLE`, `DROP COLUMN`, `RENAME COLUMN`, siết `NOT NULL` không có default, thay đổi kiểu/ràng buộc khiến code phiên bản `N-1` bị lỗi khi ghi.

### 5.3. Thứ Tự Migration & Giới Hạn Rollback
- **Thứ tự bắt buộc**: Migration ở pha **Expand** phải chạy và kiểm chứng trên Staging (`fchdhgonoi-staging`) trước khi merge/deploy code Production sử dụng schema đó.
- **Tương thích Code Rollback**: Vercel Instant Rollback **chỉ quay lui code ứng dụng**, **không** quay lui schema database. Do đó mọi thay đổi schema ở bản `N` phải đảm bảo code bản `N-1` vẫn chạy được bình thường trên schema mới.
- **Giới hạn DB Rollback**: `scripts/db-restore.mjs` không chạy trong một transaction toàn cục xuyên suốt toàn bộ DB và không nhắm vào Production đang chạy. Không có khái niệm "rollback DB tại chỗ" mà không chấp nhận mất dữ liệu phát sinh sau thời điểm backup.

### 5.4. Tiêu Chí Forward-Fix vs. Code Rollback & Khôi Phục Migration Dở Dang
- **Ưu tiên Code Rollback (Vercel)** khi: Lỗi phát sinh từ logic ứng dụng/UI ở bản mới và schema DB hiện tại vẫn tương thích với bản `N-1`.
- **Ưu tiên Forward-Fix (Hotfix PR)** khi: Lỗi nhỏ có thể vá nhanh trong < 30 phút, hoặc bản `N` đã ghi dữ liệu mới mà code `N-1` không đọc được.
- **Khôi phục Migration dở dang**:
  - Kiểm tra bảng `schema_migrations` (đối với migration Phase 4 `scripts/migrations/phase4-analytics-v1.mjs`) và `PRAGMA table_info(<table_name>)` để biết trạng thái thực tế.
  - Vì các migration được thiết kế idempotent (`IF NOT EXISTS`), sửa nguyên nhân lỗi và chạy lại phần còn thiếu theo hướng tiến tới (forward), không xóa dữ liệu đang có.

### 5.5. Danh Mục Schema Hiện Hành (Schema Version Inventory)
- **9 bảng lõi (`src/lib/db.ts`)**: `team_settings`, `players`, `matches`, `match_attendances`, `other_incomes`, `expenses`, `club_posts`, `sponsors`, `audit_logs`.
- **5 bảng phân tích & theo dõi migration (`scripts/migrations/phase4-analytics-v1.mjs`)**: `schema_migrations`, `player_lifecycle_events`, `product_analytics_events`, `product_analytics_daily`, `product_analytics_monthly_actors`.

---

## 6. Playbook Xử Lý Lộ Lọt Credentials (`P1-10`)

Áp dụng ngay khi nghi ngờ rò rỉ `AUTH_SECRET`, `TURSO_*`, `UPSTASH_REDIS_*`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `ANALYTICS_ACTOR_SECRET` hoặc khóa backup:

1. **Phát hiện (Detection)**: Cảnh báo GitHub Secret Scanning, lộ trong log/screenshot/commit, truy cập bất thường trong `audit_logs`, hoặc biến động quota Vercel/Turso/Upstash bất thường.
2. **Cô lập tức thì (Containment)**:
   - Không xóa log hay reset DB làm mất dấu vết.
   - Nếu liên quan tới media/analytics, tạm tắt cờ tính năng (`MEDIA_STORAGE_ENABLED=false`, `ANALYTICS_ENABLED=false`) trên Vercel Dashboard.
3. **Bảo toàn bằng chứng `audit_logs`**:
   - Xuất ngay bản sao read-only (`scripts/db-backup.mjs`) hoặc truy vấn `GET /api/audit-logs` để kiểm tra mọi thao tác `POST /api/team`, `POST /api/import` bất thường.
4. **Thu hồi & Xoay vòng đồng bộ (Revocation & Rotation)**:
   - **`AUTH_SECRET`**: Tạo secret mới >= 32 ký tự trên **Vercel Dashboard → Project Settings → Environment Variables** (tách riêng `Preview` và `Production`; xóa các alias cũ như `PREVIEW_AUTH_SECRET`, `APP_SECRET`, `NEXTAUTH_SECRET`, `SESSION_SECRET` nếu có). Thao tác này **hủy hiệu lực toàn bộ phiên đăng nhập hiện tại** và buộc mọi người dùng đăng nhập lại.
   - **Turso Tokens**: Thu hồi token cũ (`turso db tokens revoke`) và cấp mới `TURSO_AUTH_TOKEN` (Vercel Production/Preview tách biệt) và `TURSO_PROD_AUTH_TOKEN_RO` (GitHub Actions secret).
   - **Vercel Env Vars khác**: Xoay vòng `UPSTASH_REDIS_REST_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `ANALYTICS_ACTOR_SECRET` trên Vercel Dashboard, sau đó **Redeploy Production** để nạp biến mới.
   - **GitHub Secrets & Backup Keypair**: Cập nhật `TURSO_PROD_AUTH_TOKEN_RO` trên GitHub. Nếu lộ `privateKey` backup (`gonoi-priv-v1:...`), sinh cặp khóa mới ngay (`node scripts/backup-crypto.mjs keygen`), cập nhật `TURSO_BACKUP_PUBLIC_KEY` trên GitHub và chạy `turso-backup.yml` thủ công để tạo bản mã hóa mới.
5. **Thông báo thành viên & PIR**: Gửi thông báo qua nhóm Zalo (theo mẫu mục `7.3`) nếu yêu cầu đăng nhập lại hoặc đổi mã PIN; hoàn tất báo cáo PIR trong 48 giờ.

---

## 7. Khung Phân Loại Sự Cố SEV1–SEV4 & Quy Trình PIR (`P1-13`)

### 7.1. Ma trận Mức Độ Sự Cố (SEV1–SEV4)

| Mức độ | Định nghĩa | Ví dụ điển hình | Incident Owner | Thời gian phản hồi (SLA) | Tần suất cập nhật |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEV1 (Critical)** | Hệ thống Production ngừng hoạt động, lộ credentials/dữ liệu, hoặc sai lệch dữ liệu tài chính trực tiếp | `GET /api/health` trả `503`, rò rỉ `AUTH_SECRET`/`TURSO_AUTH_TOKEN`, mất/sai lệch sổ quỹ | Primary Ops/DR Owner (`TBD`) + Club Owner | **<= 15 phút** | Mỗi 30 phút |
| **SEV2 (High)** | Tính năng cốt lõi gián đoạn diện rộng nhưng hệ thống vẫn truy cập được | Đăng nhập lỗi hàng loạt, `@vercel/blob` sập khi `MEDIA_STORAGE_ENABLED=true`, backup thất bại >= 2 lần liên tiếp | Primary Ops Owner (`TBD`) | **<= 1 giờ** | Mỗi 2 giờ |
| **SEV3 (Medium)** | Lỗi cục bộ không chặn luồng chính hoặc sự cố đơn lẻ ngoài giờ cao điểm | 1 route phụ lỗi, 1 lần chạy `turso-backup.yml` thất bại đơn lẻ | Ops / Backend Owner (`TBD`) | **<= 4 giờ** | Khi có tiến triển |
| **SEV4 (Low)** | Lỗi hiển thị nhỏ, không ảnh hưởng dữ liệu hay quyền truy cập | Lỗi copy/layout nhỏ trên một màn hình | Maintainer | **<= 24–48 giờ** | Khi đóng issue |

### 7.2. Vòng Đời Xử Lý Sự Cố
1. **Detection**: Phát hiện qua `GET /api/health`, Vercel logs, GitHub Actions alert hoặc phản ánh của thành viên trên Zalo.
2. **Escalation & Owner**: Chỉ định Incident Owner theo bảng SEV1–SEV4; SEV1/SEV2 báo ngay cho Repository/Club Owner.
3. **Containment & Recovery**: Áp dụng playbook tương ứng (mục `6`, `8`) hoặc rollback code (mục `9`).
4. **Communication**: Thông báo trạng thái cho thành viên trên nhóm Zalo khi sự cố ảnh hưởng đăng nhập, điểm danh hoặc số dư quỹ.
5. **Closure & PIR**: Xác nhận hệ thống ổn định (`GET /api/health` = `200`, smoke tests đạt) và lập PIR trong vòng 48 giờ đối với SEV1/SEV2.

### 7.3. Mẫu Thông Báo Thành Viên (Zalo)

- **Khi đang xử lý sự cố (Initial / Update)**:
  > `[THÔNG BÁO KỸ THUẬT - FC HĐH GÒ NỔI]`
  > Hiện tại hệ thống quản lý đội bóng đang gặp sự cố tạm thời ở mục **[tên tính năng, VD: đăng nhập / tải ảnh / xem báo cáo quỹ]**. Ban Quản Lý đang kiểm tra và khắc phục (dự kiến **[thời gian]**). Dữ liệu quỹ và điểm danh vẫn được bảo toàn. Anh em vui lòng tạm chờ thông báo tiếp theo.
- **Khi đã khắc phục xong (Resolved)**:
  > `[ĐÃ KHẮC PHỤC - FC HĐH GÒ NỔI]`
  > Sự cố tại mục **[tên tính năng]** đã được xử lý xong vào lúc **[HH:mm DD/MM/YYYY]**. **[Nếu có: Anh em vui lòng đăng nhập lại bằng mã PIN cá nhân]**. Cảm ơn anh em đã thông cảm!

### 7.4. Mẫu Báo Cáo Sau Sự Cố (Post-Incident Review — PIR)

```markdown
# PIR — [Mã sự cố / Ngày YYYY-MM-DD]
- **Mức độ**: SEV1 / SEV2 / SEV3
- **Incident Owner**: <Tên / Vai trò>
- **Thời gian ảnh hưởng**: <Bắt đầu> → <Kết thúc> (Tổng thời lượng: <...>)

## 1. Tóm tắt & Tác động (Impact)
- Người dùng / tính năng bị ảnh hưởng:
- Dữ liệu hoặc tài chính bị ảnh hưởng (nếu có):

## 2. Dòng thời gian (Timeline — UTC+7)
- `HH:mm`: Phát hiện sự cố qua ...
- `HH:mm`: Thực hiện cô lập / rollback ...
- `HH:mm`: Xác nhận phục hồi hoàn toàn.

## 3. Nguyên nhân gốc rễ (Root Cause) & Khoảng trống phát hiện (Detection Gap)
- **Root Cause**:
- **Detection Gap**: Vì sao chưa phát hiện sớm hơn?

## 4. Hành động khắc phục (Corrective Actions)
| Hành động | Người phụ trách (Owner) | Hạn hoàn thành (Due Date) | Cách kiểm chứng (Verification) |
| :--- | :--- | :--- | :--- |
| ... | ... | YYYY-MM-DD | ... |
```

---

## 8. Playbook Sự Cố Chuyên Biệt (`P2-14`)

### 8.1. Sự cố `@vercel/blob` Outage
1. Kiểm tra lỗi upload ảnh trong `npx vercel logs` hoặc Vercel Status.
2. Đặt `MEDIA_STORAGE_ENABLED=false` trong **Vercel Dashboard → Production → Environment Variables** và **Redeploy** để tắt tính năng upload media mà vẫn giữ nguyên toàn bộ chức năng điểm danh, quỹ và danh sách cầu thủ.
3. Thông báo tạm ngưng đăng ảnh mới trên Zalo; bật lại `MEDIA_STORAGE_ENABLED=true` sau khi dịch vụ ổn định.

### 8.2. Lỗi Đăng Nhập / Session Hàng Loạt (Auth Mass Failure)
1. Kiểm tra `GET /api/health` (`200` hay `503`) để loại trừ lỗi kết nối Turso DB.
2. Kiểm tra cấu hình **Upstash Redis** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) trên Vercel Production — lưu ý `authRateLimit.ts` fail-closed trả `503` nếu thiếu hoặc mất kết nối Upstash trên Production/Preview.
3. Kiểm tra `AUTH_SECRET` (>= 32 ký tự) trên Vercel Production và xem log chi tiết qua `npx vercel logs`.
4. Nếu lỗi xuất phát từ bản release mới, thực hiện Vercel Rollback theo mục `9`.

### 8.3. Sai Lệch Dữ Liệu Tài Chính Trực Tiếp (Live Financial Discrepancy)
1. Tạm thời thông báo Ban Quản Lý ngưng các thao tác ghi quỹ/trận đấu mới.
2. Chạy sao lưu read-only (`scripts/db-backup.mjs`) để giữ nguyên hiện trạng phục vụ đối chiếu.
3. Kiểm tra `GET /api/audit-logs` (tài khoản Manager) để truy vết các thao tác `POST /api/team` / `POST /api/import` gần nhất.
4. Đối chiếu số liệu giữa `matches`, `match_attendances`, `other_incomes`, `expenses` và `team_settings.tournament_fund_reserve` với màn hình `/bao-cao-tai-chinh`; lập bút toán điều chỉnh minh bạch hoặc phục hồi từ bản sao lưu theo mục `3.3` nếu cần.

### 8.4. Lỗi Backup Tự Động (`turso-backup.yml`)
1. Mở tab **GitHub Actions → Turso Production Backup** để xem log bước bị lỗi.
2. Kiểm tra 3 repository secrets (`TURSO_PROD_DATABASE_URL`, `TURSO_PROD_AUTH_TOKEN_RO`, `TURSO_BACKUP_PUBLIC_KEY`) còn hiệu lực và không hết hạn token.
3. Sau khi sửa, chạy lại thủ công bằng `workflow_dispatch` và xác nhận artifact `turso-prod-backup-<run_id>.enc` được tạo thành công. Nếu lỗi liên tiếp >= 2 tuần, nâng mức lên **SEV2**.

---

## 9. Quy Trình Rollback Code Production & Post-Rollback Smoke Tests (`P2-14`)

1. Kiểm tra `GET /api/health` và `npx vercel logs` để xác định lỗi phát sinh từ bản phát hành mới.
2. Không reset DB, không force push `main`.
3. **Xác định Deployment ổn định trước đó bằng `vercel ls`**:
   ```bash
   npx vercel ls
   ```
   Chọn URL/ID của bản Production `Ready` liền trước bản đang lỗi.
4. Thực hiện **Instant Rollback** trên Vercel Dashboard (hoặc Promote deployment ổn định trước đó).
5. **Post-Rollback Smoke Tests (Bắt buộc trước khi đóng sự cố)**:
   - `GET /api/health` trả HTTP `200`, `status: "ok"`, `db: "connected"`.
   - Kiểm tra trang chủ `/` (Guest view) hiển thị bình thường, không lỗi console/5xx trên `npx vercel logs`.
   - Kiểm tra đăng nhập Player/Manager và truy cập `/bao-cao-tai-chinh` hiển thị đúng số dư quỹ.
   - Xác nhận tương thích schema theo mục `5` (không có lỗi query cột/bảng từ bản `N-1`).

---

## 9. Xử lý lỗi `DB_WRITE_OUTCOME_UNKNOWN` (HTTP 503 — `F7.1-15`)

- Khi ghi dữ liệu sang Turso vượt quá `TURSO_REQUEST_TIMEOUT_MS` (mặc định `5000ms`), hệ thống trả HTTP `503` với mã `DB_WRITE_OUTCOME_UNKNOWN` (`retryable: false`, `reconcileRequired: true`) và `correlationId`.
- **Không tự động gửi lại (retry)** thao tác thu quỹ / chi tiêu / import.
- Kiểm tra trạng thái thực tế trong bảng giao dịch tương ứng (`GET /api/team`, `GET /api/audit-logs`) trước khi quyết định nhập lại hoặc đối soát.
