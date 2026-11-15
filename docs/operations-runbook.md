# Operations & Incident Runbook — FC HĐH Gò Nổi

Tài liệu vận hành chính thức cho hệ thống **FC HĐH Gò Nổi tại TP.HCM** (`https://fchdhgonoi.vercel.app/`).

## 1. Monitoring & Healthcheck

- **Endpoint**: `GET /api/health`
- **Kỳ vọng khỏe mạnh**: HTTP `200`, JSON `{ "status": "ok", "db": "connected", "latencyMs": <number>, "timestamp": <iso> }`, `Cache-Control: no-store`.
- **Trạng thái lỗi**: HTTP `503`, JSON `{ "status": "degraded", "db": "unreachable" }`.
- **Runtime Logs (Vercel)**:
  ```bash
  npx vercel logs --deployment <deployment-url-or-id>
  ```

## 2. Backup Định Kỳ & Restore Drill

### 2.1. Sao lưu Read-Only
- Xuất bản sao JSON ra ngoài thư mục Git trước khi thao tác rủi ro cao hoặc theo lịch tuần:
  ```bash
  node scripts/db-backup.mjs --out ../backups/gonoi-backup-$(date +%Y%m%d).json
  ```
- Không bao giờ commit file backup hoặc file `.db` vào Git.

### 2.2. Diễn tập Khôi phục (Restore Drill)
- Khôi phục vào một SQLite cục bộ riêng biệt để kiểm tra tính toàn vẹn dữ liệu:
  ```bash
  node scripts/db-restore.mjs --in ../backups/gonoi-backup.json --target ../backups/drill.sqlite --confirm
  ```
- Đối chiếu `rowCounts` đầu ra giữa `db-backup.mjs` và `db-restore.mjs`.

## 3. Nhật Ký Thao Tác Quản Trị (`audit_logs`)

- Mọi thao tác ghi qua `POST /api/team` được ghi nhận vào bảng `audit_logs` (actor_id, actor_name, actor_role, action, summary, created_at) — không lưu `pin_code` hay dữ liệu nhạy cảm.
- Xem nhật ký qua `GET /api/audit-logs` (chỉ dành cho tài khoản **Manager**).

## 4. Quy Trình Xử Lý Sự Cố & Rollback Production

1. Kiểm tra `GET /api/health` và `npx vercel logs` để xác định lỗi ứng dụng hay lỗi kết nối Turso DB.
2. Nếu lỗi phát sinh từ bản phát hành mới:
   - Không reset DB, không force push `main`.
   - Rollback nhanh trên Vercel Dashboard hoặc CLI về Deployment Production ổn định trước đó (`vercel promote` / rollback trên dashboard).
3. Nếu liên quan đến `AUTH_SECRET` hoặc `TURSO_AUTH_TOKEN`:
   - Chủ sở hữu kiểm tra trực tiếp trên **Vercel Dashboard → Project Settings → Environment Variables** (tách riêng Preview và Production).
