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

### 2.2. Đề Xuất Lịch Backup Tự Động (GitHub Actions — Chưa Bật Tự Động)
Chủ sở hữu có thể tạo workflow `.github/workflows/turso-backup.yml` và cấu hình **Repository Secrets** (`TURSO_PROD_DATABASE_URL`, `TURSO_PROD_AUTH_TOKEN_RO` chỉ đọc):

```yaml
name: Weekly Turso Backup (Read-Only)
on:
  schedule:
    - cron: "0 20 * * 0" # 03:00 sáng Thứ Hai (UTC+7)
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci --ignore-scripts
      - name: Run read-only Turso backup
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_PROD_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_PROD_AUTH_TOKEN_RO }}
        run: |
          node scripts/db-backup.mjs --out /tmp/gonoi-backup.json
          node scripts/db-restore.mjs --in /tmp/gonoi-backup.json --target /tmp/verify.sqlite --confirm
      - name: Upload encrypted/private workflow artifact
        uses: actions/upload-artifact@v4
        with:
          name: turso-backup-${{ github.run_id }}
          path: /tmp/gonoi-backup.json
          retention-days: 30
```

- **Kiểm tra & Cảnh báo thất bại**: Bước `db-restore.mjs` ngay trong job xác minh file backup có thể khôi phục thành công. Nếu job fail, GitHub Actions gửi email/notification cho chủ sở hữu repository.

---

## 3. Quy Trình Phục Hồi Production (Không Ghi Đè Trực Tiếp)

1. **Tạo database Turso mới hoặc nhánh phục hồi** (không ghi đè trực tiếp lên Production DB đang lỗi trước khi kiểm tra).
2. **Chạy Restore Drill cục bộ** từ bản sao lưu JSON gần nhất để kiểm tra schema, `rowCounts` và đối chiếu số dư tài chính:
   ```bash
   node scripts/db-restore.mjs --in ../backups/gonoi-backup.json --target ../backups/verify.sqlite --confirm
   ```
3. **Đẩy dữ liệu đã kiểm tra lên Turso DB phục hồi** (dùng `turso db shell` hoặc client đã xác thực) và kiểm tra bảng `team_settings`, `players`, `matches`, `match_attendances`, `other_incomes`, `expenses`, `audit_logs`.
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
