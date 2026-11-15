# Hướng Dẫn Chuẩn Bị & Kiểm Thử Turso Cloud Staging

Tài liệu này hướng dẫn thiết lập môi trường **Turso Cloud Staging** tách biệt hoàn toàn với Production (`fchdhgonoi`) để kiểm thử quy trình Backup/Restore v2 an toàn.

> [!CAUTION]
> **Nguyên tắc an toàn bắt buộc:**
> - **KHÔNG** sử dụng `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` đang trỏ tới database `fchdhgonoi` (Production).
> - **KHÔNG** ghi, sửa, xóa dữ liệu trên Production hoặc chạy backup/restore tự động từ Production.
> - **KHÔNG** commit secrets, token, file `.env*`, file backup `.json` hoặc `.sqlite` lên Git.

---

## 1. Staging Setup Guide (Tạo Database & Token Phạm Vi Riêng)

### 1.1. Cài đặt và đăng nhập Turso CLI (trên máy vận hành)
```bash
turso auth login
turso auth whoami
```

### 1.2. Tạo Turso Staging Database nguồn
Tạo một database Staging riêng (tên phải chứa `staging`, `dev`, hoặc `test`):
```bash
turso db create fchdhgonoi-staging --group default
turso db show fchdhgonoi-staging --url
```

### 1.3. Tạo Database đích riêng cho Restore Drill
Tạo thêm một database riêng biệt dùng làm đích khôi phục thử nghiệm (tên phải chứa `restore` hoặc `drill`):
```bash
turso db create fchdhgonoi-staging-restore --group default
turso db show fchdhgonoi-staging-restore --url
```

### 1.4. Tạo Token riêng theo nguyên tắc tối thiểu quyền (Least Privilege)
- **Token chỉ đọc (Read-Only)** cho Staging nguồn (dùng cho `db-backup.mjs`):
  ```bash
  turso db tokens create fchdhgonoi-staging --read-only
  ```
- **Token đọc-ghi** chỉ cấp cho database đích restore (dùng cho `db-restore.mjs`):
  ```bash
  turso db tokens create fchdhgonoi-staging-restore
  ```

### 1.5. Cấu hình biến môi trường (chỉ lưu cục bộ / secret manager, không đưa vào Git)
Thiết lập trong shell phiên làm việc hoặc file môi trường cục bộ không track Git:
```bash
# Nguồn Staging (chỉ đọc)
TURSO_STAGING_DATABASE_URL="libsql://fchdhgonoi-staging-<org>.turso.io"
TURSO_STAGING_AUTH_TOKEN="<staging-readonly-token>"

# Đích Restore Staging riêng biệt (đọc/ghi)
TURSO_STAGING_RESTORE_DATABASE_URL="libsql://fchdhgonoi-staging-restore-<org>.turso.io"
TURSO_STAGING_RESTORE_AUTH_TOKEN="<staging-restore-token>"
```

---

## 2. Preflight Safety Checklist (Trước Khi Chạy)

- [ ] Xác nhận `TURSO_STAGING_DATABASE_URL` khác hoàn toàn `TURSO_DATABASE_URL` (Production).
- [ ] Xác nhận `TURSO_STAGING_RESTORE_DATABASE_URL` khác cả `TURSO_DATABASE_URL` lẫn `TURSO_STAGING_DATABASE_URL`.
- [ ] Xác nhận tên database trong URL không phải `fchdhgonoi` và có chứa từ khóa môi trường (`staging`, `restore`, `drill`, `dev`, hoặc `test`).
- [ ] Chạy preflight khô (không kết nối ghi) để xác nhận script chặn fallback sang Production:
  ```bash
  node scripts/db-backup.mjs --env staging --preflight-only
  node scripts/db-restore.mjs --env staging --preflight-only
  ```
  Nếu thiếu biến môi trường Staging hoặc URL trỏ nhầm sang Production, script sẽ dừng ngay lập tức với exit code `1`.

---

## 3. Backup / Restore Execution Guide (Trên Turso Staging)

### Bước 1: Chạy Backup v2 từ Turso Staging
```bash
node scripts/db-backup.mjs --env staging --out ../backups/staging-drill.json
```
Kiểm tra output JSON có đủ `version: 2`, `schema`, `rowCounts`, `tables`.

### Bước 2: Chạy Restore vào Database Staging đích riêng
```bash
node scripts/db-restore.mjs --env staging --in ../backups/staging-drill.json --confirm
```
Script sẽ in ra JSON xác nhận `mode: "staging-restore"`, `targetHost`, `dbName`, `schemaTables`, và `restoredCounts`.

### Bước 3: Đối chiếu sau Restore
- So sánh `schemaTables` và `restoredCounts` từ output của `db-restore.mjs` với `rowCounts` trong file `../backups/staging-drill.json`.
- Xác nhận không có token/credential nào xuất hiện trong log terminal.
