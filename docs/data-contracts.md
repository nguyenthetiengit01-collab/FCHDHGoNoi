# Data Contracts — FC HĐH Gò Nổi (`GET /api/team` & API Endpoints)

Tài liệu chuẩn hóa 3 hợp đồng dữ liệu theo cấp quyền (**PUBLIC**, **PLAYER**, **MANAGER**) tương ứng với `src/types/app.ts`, `src/lib/auth.ts`, `src/lib/teamStatistics.ts` và `src/app/api/team/route.ts`.

---

## 1. Tổng Quan Phân Quyền & Sanitization

| Hợp đồng | Điều kiện phiên (`getAuthSession`) | Xử lý phía server | Chính sách Cache |
|---|---|---|---|
| **PUBLIC** (`PublicTeamPayload`) | Không có session hợp lệ (`null`) | `sanitizeDataForPublic(data)` + bỏ hẳn property `pin_code` | `Cache-Control: no-store, no-cache, must-revalidate` |
| **PLAYER** (`PlayerTeamPayload`) | Session hợp lệ với `accessRole === "player"` | `sanitizeDataForPlayer(data, session.playerId)` + bỏ hẳn property `pin_code` | `Cache-Control: no-store, no-cache, must-revalidate` |
| **MANAGER** (`ManagerTeamPayload`) | Session hợp lệ với `accessRole === "manager"` | Trả dữ liệu đầy đủ, bỏ hẳn property `pin_code` | `Cache-Control: no-store, no-cache, must-revalidate` |

---

## 2. Hợp Đồng Chi Tiết Theo Field (`GET /api/team`)

### 2.1. Top-level Payload

| Field name | TypeScript type | Required | Nullability | PUBLIC | PLAYER | MANAGER |
|---|---|---|---|---|---|---|
| `settings` | `TeamSettings` | Required | Non-null | `tournament_fund_note` bị xóa rỗng (`""`) | `tournament_fund_note` bị xóa rỗng (`""`) | Đầy đủ |
| `players` | `SafePlayerPayload[]` | Required | Non-null | Không có `pin_code`; ẩn `phone`, `username`, `notes`, ép `access_role: "player"` | Không có `pin_code`; giữ `phone`/`username`/`notes` của **chính mình**, ẩn của người khác | Không có `pin_code`; đầy đủ các trường quản trị |
| `matches` | `MatchRecord[]` | Required | Non-null | Đầy đủ | Đầy đủ | Đầy đủ |
| `attendances` | `MatchAttendance[]` | Required | Non-null | Đầy đủ (phục vụ đếm RSVP/ra sân) | Đầy đủ | Đầy đủ |
| `otherIncomes` | `OtherIncome[]` | Required | Non-null | Mảng rỗng `[]` (ẩn sổ chi tiết) | Đầy đủ | Đầy đủ |
| `expenses` | `ExpenseRecord[]` | Required | Non-null | Mảng rỗng `[]` (ẩn chứng từ chi tiết) | Đầy đủ | Đầy đủ |
| `summary` | `FinancialSummary` | Required | Non-null | Chỉ số tổng hợp tài chính | Đầy đủ | Đầy đủ |
| `posts` | `ClubActivityPost[]` | Optional | `undefined` nếu chưa có | Đầy đủ | Đầy đủ | Đầy đủ |
| `sponsors` | `Sponsor[]` | Optional | `undefined` nếu chưa có | Đầy đủ | Đầy đủ | Đầy đủ |
| `statistics` | `TeamStatistics` | Optional | `undefined` nếu không tính | Tính từ dữ liệu canonical trước sanitize (nhất quán 3 vai trò) | Nhất quán 3 vai trò | Nhất quán 3 vai trò |

### 2.2. `SafePlayerPayload` (`Omit<Player, "pin_code">`) & Quyền Theo Field

- **Bắt buộc bảo mật**: Thuộc tính `pin_code` (kể cả chuỗi rỗng hay hash) **không được serialize trong JSON response ở bất kỳ role nào** (`PUBLIC`, `PLAYER`, `MANAGER`).

| Field name | TypeScript type | Required | Nullability | PUBLIC | PLAYER (bản thân) | PLAYER (người khác) | MANAGER |
|---|---|---|---|---|---|---|---|
| `id`, `code_order` | `number` | Required | Non-null | Cho phép | Cho phép | Cho phép | Cho phép |
| `full_name`, `short_name` | `string` | Required | Non-null | Cho phép | Cho phép | Cho phép | Cho phép |
| `jersey_number` | `number \| null` | Required | Nullable | Cho phép | Cho phép | Cho phép | Cho phép |
| `position`, `birth_year`, `role`, `status`, `avatar_url` | `string` | Required | Non-null | Cho phép | Cho phép | Cho phép | Cho phép |
| `profile_image_url`, `bio`, `hometown`, `nickname`, `playing_style` | `string` | Optional | `undefined` | Cho phép | Cho phép | Cho phép | Cho phép |
| `gallery_urls` | `string[]` | Optional | `undefined` | Cho phép | Cho phép | Cho phép | Cho phép |
| `phone` | `string` | Required | Non-null | `""` | Giá trị thật | `""` | Giá trị thật |
| `username` | `string` | Optional | `undefined` | `""` | Giá trị thật | `""` | Giá trị thật |
| `notes` | `string` | Required | Non-null | `""` | Giá trị thật | `""` | Giá trị thật |
| `access_role` | `"manager" \| "player"` | Required | Non-null | Ép `"player"` | Giá trị thật | Ép `"player"` | Giá trị thật |
| `pin_code` | *(omitted)* | — | — | **Không có trong JSON** | **Không có trong JSON** | **Không có trong JSON** | **Không có trong JSON** |

---

## 3. Lifecycle Categories & Attendance Denominator (`src/lib/teamStatistics.ts`)

### 3.1. Phân loại Cầu thủ (`PlayerLifecycleCategory`)
Các nhóm loại trừ lẫn nhau:
- `active`: `"Đang sinh hoạt"` / `"active"`.
- `paused`: `"Tạm nghỉ"` / `"Nghỉ phép"` / `"Tạm dừng"` (kiểm tra trước `stopped` để không nhầm `paused` thành `stopped`).
- `stopped`: `"Ngừng tham gia"` / `"Đã nghỉ"` / `"Ngưng"` / `"Rời đội"`.
- `unknown`: Giá trị rỗng, `null` hoặc chuỗi không nhận diện (**không** âm thầm mặc định thành `active`).

### 3.2. Phân loại Trận đấu (`MatchLifecycleCategory`)
Các nhóm loại trừ lẫn nhau:
- `cancelled`: `"Đã hủy"` / `"Hủy"` (kiểm tra trước `completed`).
- `inProgress`: `"Đang diễn ra"` / `"Đang đá"`.
- `upcoming`: `"Sắp diễn ra"`.
- `completed`: `"Đã kết thúc"` / `"Hoàn thành"`.
- `unknown`: Giá trị rỗng, `null` hoặc chuỗi không nhận diện (**không** âm thầm mặc định thành `completed`).

### 3.3. Quy tắc tính Tỷ lệ Chuyên cần (`calculatePlayerAttendanceStats`)
- **Mẫu số (`eligibleMatchesCount`)**: Chỉ đếm các trận có phân loại `completed` (loại bỏ `upcoming`, `cancelled`, `inProgress`, `unknown`).
- **Tử số (`matchesPlayed`)**: Số trận thuộc tập mẫu số mà cầu thủ có `attended === 1`.
- **Hiển thị**: Khi `eligibleMatchesCount === 0`, hàm trả về `attendanceRate: null` và UI hiển thị dấu **`—`** thay vì `0%`.

---

## 4. Error Response Contract

Mọi API Route (`src/app/api/*`) trả về JSON dạng `ApiErrorResponse` (`{ error: string }`) kèm `Cache-Control: no-store`:

| HTTP Status | Ngữ cảnh áp dụng | Ví dụ endpoint |
|---|---|---|
| `400` | Payload không hợp lệ, thiếu trường bắt buộc, sai định dạng file Excel (`.xlsx`, `.xls`, `.xlsm`), vượt quá 5MB, sai cấu trúc sheet | `POST /api/auth`, `POST /api/team`, `POST /api/import` |
| `401` | Chưa đăng nhập hoặc session cookie không hợp lệ / hết hạn | `POST /api/team` (action cần quyền), `GET /api/export`, `POST /api/import` |
| `403` | Vi phạm CSRF/Origin (`!verifyCsrfOrigin(req)`) hoặc sai vai trò (Player gọi API của Manager) | `POST /api/team`, `GET /api/export`, `POST /api/import`, `POST /api/webp` |
| `429` | Vượt giới hạn thử đăng nhập sai (rate-limit) | `POST /api/auth` |
| `500` | Lỗi hệ thống / truy vấn CSDL không mong muốn (không trả stack trace hoặc secret ra client) | Tất cả `/api/*` |
