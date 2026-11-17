# Analytics KPI Dictionary — FC HĐH Gò Nổi

Múi giờ chuẩn: **`Asia/Ho_Chi_Minh`**. Ngưỡng tin cậy dữ liệu mặc định: **`95%`** (`ANALYTICS_COVERAGE_THRESHOLD = 0.95`). Khi độ phủ dưới 95% hiển thị nhãn **`Dữ liệu chưa đầy đủ`**. Khi mẫu số bằng `0`, trả `null` và hiển thị `—` hoặc `Chưa đủ dữ liệu` (không bao giờ trả `NaN`/`Infinity` hay `0%` giả).

## 1. Club Health
| KPI | Công thức | Quy tắc & Giới hạn |
| :--- | :--- | :--- |
| Active / Paused / Stopped Players | Phân loại trạng thái cuối kỳ từ `player_lifecycle_events` | Mutually exclusive; không có lifecycle thì dùng snapshot hiện tại. |
| New Members / Net Member Growth | `COUNT(joined)` và `New - Stopped` trong kỳ | Chỉ tính từ thời điểm có lifecycle events (`baselineAt`). |
| Attendance Coverage | `knownAttendanceSlots / eligibleSlots` | Slot thiếu row không bị coi là vắng mặt. |
| Team Attendance Rate | `COUNT(attended=1) / knownAttendanceSlots` | Luôn đi kèm `attendanceCoverage`. |
| RSVP Response Rate | `rsvpRespondedSlots / eligibleSlots` | Tính `registered`, `attending`, `absent_notice`, `declined`, `tentative`; loại `none`. |
| RSVP Positive Rate | `rsvpPositiveSlots / rsvpRespondedSlots` | Chỉ tính `registered`, `attending`. |
| Attendance After Positive RSVP | `attended=1 trong positive RSVP / positive RSVP có kq` | Loại row thiếu. |

## 2. Match Performance
| KPI | Công thức | Quy tắc |
| :--- | :--- | :--- |
| Completed / Scored Matches | `status = completed`; có đủ `team_score >= 0` & `opponent_score >= 0` | Chỉ trận có tỷ số hợp lệ mới tính W/D/L & hiệu số. |
| Win Rate | `Wins / Scored Matches` | `null` nếu `Scored Matches = 0`. |
| Recent Form | 5 trận `completed` có tỷ số gần nhất theo `match_date` | Sắp xếp theo ngày trận, không theo ID. |
| Cost per Attendee | `totalMatchCost / totalAttendees` | Không cộng trùng `pitch_cost` và chi phí `"Tiền sân"`. |

## 3. Player Engagement & Retention
| KPI | Công thức | Quy tắc |
| :--- | :--- | :--- |
| Player Attendance (Self) | `attendedMatches / knownEligibleCompletedMatches` | Player chỉ xem của bản thân qua session. |
| 30 / 90-day Retention | Cohort có `joined_at` đủ >= 30/90 ngày vẫn `active` | Hồ sơ cũ `joined_at = NULL` không đưa vào cohort. |
| Monthly Active Players / Managers | `COUNT(DISTINCT actor_key_hash)` theo tháng | Aggregate server-side; không trả danh sách cá nhân. |

## 4. Financial Intelligence
| KPI | Công thức | Quy tắc |
| :--- | :--- | :--- |
| Match Income | `SUM(amount)` với `paid=1` | Giữ nguyên quy tắc `financialCalculations.ts`. |
| Mandatory Expected / Collected | `attended=1` và `attended=1 AND paid=1` | Tự nguyện (`attended=0, paid=1`) tách riêng, không tính nợ. |
| Collection Rate | `mandatoryCollected / mandatoryExpected` | `null` nếu `mandatoryExpected = 0`. |
| Outstanding Debt | `SUM(amount)` với `attended=1 AND paid=0` | Chỉ hiển thị chi tiết cho Manager. |
| Other Income / Operating Expense | Loại `"transfer"` và `"Chuyển quỹ nội bộ"` | Khớp sổ cái gốc. |
| Sponsor Attributed Income | `SUM(other_incomes.amount)` với `sponsor_id IS NOT NULL` | Giao dịch cũ `NULL` hiển thị `Chưa phân bổ`. |

## 5. Sponsor, Community & Product
| KPI | Công thức | Quy tắc |
| :--- | :--- | :--- |
| Sponsor Impressions / Clicks / CTR | `sponsor_impression` (>=50% viewport, >=1s), `sponsor_click`, `Clicks/Impressions` | Không đồng nhất impression với giá trị tài trợ. |
| Club Post Views / Page Views | Aggregate từ `product_analytics_daily` | Theo route group allowlist, không lưu query/PII. |
