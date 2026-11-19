# Quy trình CI/CD & Vận hành Phát hành — FC HĐH Gò Nổi

Tài liệu này chuẩn hóa quy trình phát triển, kiểm tra chất lượng tự động (CI), kiểm thử Preview, phê duyệt hợp nhất (Merge), kiểm tra sau phát hành (Post-Merge Smoke Test), và khôi phục (Rollback) cho repository `nguyenthetiengit01-collab/FCHDHGoNoi`.

---

## 1. Quy trình Tạo Branch
- Luôn đồng bộ nhánh `main` mới nhất trước khi tách nhánh:
  - Tạo nhánh tính năng/sửa lỗi từ `main` với tiền tố rõ ràng: `feat/...`, `fix/...`, `docs/...`, `chore/...`.
  - Khuyến nghị làm việc trên Git worktree riêng (ví dụ `D:\Test1\QuanLyDoiBong-worktrees\<phase>`) để giữ nguyên trạng thái thư mục làm việc chính và tránh lẫn file cục bộ (`data/*.sqlite`, `.env*`).
- Không commit trực tiếp lên `main`, không chứa secret, token, hoặc file database cục bộ trong commit.

---

## 2. Pull Request (PR)
- Mọi thay đổi vào `main` phải đi qua Pull Request.
- Nội dung PR cần nêu rõ:
  - Phạm vi thay đổi và nguyên nhân gốc.
  - Kết quả chạy các Quality Gates cục bộ trên Node.js `v22.23.5`.
  - Biến môi trường mới bắt buộc (nếu có) và xác nhận không thay đổi cấu hình/dữ liệu Production trái phép.
- Toàn bộ review comments phải được giải quyết (Conversation Resolution) trước khi merge.

---

## 3. CI Quality Gates (`.github/workflows/ci.yml`)
- **Trigger**: Tự động chạy khi có `pull_request` vào `main` và `push` lên `main`.
- **Quyền hạn & An toàn**:
  - `permissions: contents: read` (chỉ đọc mã nguồn).
  - Không sử dụng Production secrets, không kết nối Turso Production/Staging, không dùng SQLite Production, không deploy và không chạy migration.
  - Mọi GitHub Actions đều pin theo **commit SHA** đầy đủ.
  - Có `timeout-minutes: 20` và `concurrency` hủy lượt chạy PR cũ khi có commit mới; **không** dùng `continue-on-error`.
- **5 Gate Tuần tự trên Node.js `v22.23.5`**:
  1. **Gate 1**: `npm ci` (cài phụ thuộc sạch theo `package-lock.json`, tận dụng npm cache).
  2. **Gate 2**: `npm test -- --maxWorkers=1` (chạy toàn bộ Vitest suite tuần tự worker để tránh tranh chấp khóa SQLite WAL cục bộ).
  3. **Gate 3**: `npm run lint` (`eslint src`).
  4. **Gate 4**: `npx tsc --noEmit` (kiểm tra kiểu TypeScript toàn dự án).
  5. **Gate 5**: `npm run build` với `TEMP`, `TMP`, `TMPDIR` cô lập trong `${{ runner.temp }}/nextjs-build`.

---

## 4. Vercel Preview
- Mỗi PR vào `main` tự động tạo một bản **Vercel Preview Deployment** độc lập.
- Sau khi `Quality Gates (Node 22.23.5)` và Vercel Preview đạt `Ready`:
  - Kiểm tra các route công khai (`/`, `/hoat-dong`, `/cau-thu/[id]`) và API công khai ở chế độ **chỉ đọc (GET-only)**.
  - Xác nhận không rò rỉ dữ liệu nhạy cảm (`pin_code`, `phone`, `notes`), không có `data:image` Base64 trong HTML/API công khai, và giao diện Desktop (`1440×900`) + Mobile (`390×844`) không vỡ ảnh hoặc tràn ngang.

---

## 5. Merge Approval & Đề xuất Branch Protection trên `main`
- Trước khi hợp nhất PR vào `main`:
  - Kiểm tra `Quality Gates (Node 22.23.5)` xanh hoàn toàn.
  - Kiểm tra `Vercel` Preview deployment thành công.
  - Nếu PR có yêu cầu biến môi trường Production mới (ví dụ `AUTH_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`), **bắt buộc cấu hình xong trước khi merge**.
- **Thiết lập Branch Protection khuyến nghị trên GitHub `main`** (cần Chủ dự án phê duyệt và bật trên GitHub Settings):
  - **Require a pull request before merging** (yêu cầu >= 1 approving review, dismiss stale reviews khi có commit mới).
  - **Require status checks to pass before merging** (kèm **Require branches to be up to date before merging**):
    - Required check: `Quality Gates (Node 22.23.5)`
    - Required check (khuyến nghị): `Vercel`
  - **Require conversation resolution before merging**: Bật.
  - **Do not allow bypassing the above settings** (áp dụng cho cả admin nếu phù hợp quy trình).
  - **Restrict force pushes** (không bật *Allow force pushes*) và **Allow deletions** = Tắt.

---

## 6. Post-Merge Smoke Test (Production Read-Only)
Ngay sau khi PR được merge vào `main` và Vercel hoàn tất deploy `https://fchdhgonoi.vercel.app`:
1. **HTTP GET-only & Payload Security**:
   - Kiểm tra `/`, `/cau-thu/1`, `/hoat-dong`, `/api/public/activities`, `/api/public/activities?id=<postId>`, `/hoat-dong/<postId>` đều trả `HTTP 200`, `0` lỗi `500`, `0` `data:image` Base64, không lộ `pin_code`/`scrypt$`/`phone`/sổ chi tiết.
   - Kiểm tra `/api/media/legacy?entity=users&id=1&field=pin_code` trả `HTTP 400`.
2. **Browser Visual QA (Read-only)**:
   - Kiểm tra trên Desktop (`1440×900`) và Mobile (`390×844`): `naturalWidth > 0` cho toàn bộ ảnh hiển thị, `scrollWidth <= innerWidth`, không lỗi JavaScript `pageerror`, và Lightbox mở/đóng bình thường.
   - Tuyệt đối không đăng nhập, không gửi form ghi dữ liệu, không thay đổi env/dữ liệu trong lúc smoke test.

---

## 7. Quy trình Rollback Phát hành
Khi phát hiện sự cố nghiêm trọng sau khi merge vào `main`:
1. **Giảm thiểu tác động tức thời trên Vercel (Rollback Deployment)**:
   - Trên Vercel Dashboard → **Deployments** → chọn bản Production deployment ổn định liền trước → chọn **Instant Rollback** (chỉ thao tác khi được chủ dự án xác nhận).
2. **Rollback mã nguồn trên Git (An toàn, không force-push)**:
   - Không bao giờ dùng `git reset --hard` + `git push --force` trên `main`.
   - Tạo nhánh `revert/...` từ `main`, chạy `git revert <merge-commit-sha>`, mở PR mới đi qua đầy đủ `Quality Gates (Node 22.23.5)` trước khi merge lại vào `main`.
3. **Kiểm tra lại dữ liệu & cấu hình**:
   - Nếu sự cố liên quan biến môi trường hoặc schema DB, kiểm tra đối chiếu trước bằng `scripts/db-backup.mjs` (read-only) trước khi thực hiện bất kỳ thao tác phục hồi nào.
