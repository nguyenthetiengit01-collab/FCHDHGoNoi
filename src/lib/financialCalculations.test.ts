import { describe, it, expect } from "vitest";
import {
  calculateFinancialSummary,
  calculateMatchStats,
  calculatePlayerAttendanceDebt,
} from "./financialCalculations";
import type { MatchAttendance, OtherIncome, ExpenseRecord, MatchRecord } from "@/types/app";

describe("Financial Calculations (Quản lý Quỹ & Thu Chi)", () => {
  it("tính chính xác tổng tiền trận đã thu từ các lượt đã thanh toán (paid === 1)", () => {
    const mockAttendances: MatchAttendance[] = [
      { id: 1, match_id: 1, player_id: 1, attended: 1, paid: 1, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" },
      { id: 2, match_id: 1, player_id: 2, attended: 1, paid: 1, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" },
      { id: 3, match_id: 1, player_id: 3, attended: 1, paid: 0, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" }, // chưa đóng
      { id: 4, match_id: 1, player_id: 4, attended: 0, paid: 0, amount: 0, note: "", rsvp_status: "none", walk_in: 0, collected_by: "" }, // không đi
    ];

    const summary = calculateFinancialSummary({
      attendances: mockAttendances,
      otherIncomes: [],
      expenses: [],
    });

    expect(summary.totalMatchIncome).toBe(200000);
    expect(summary.totalUnpaidAmount).toBe(100000);
  });

  it("tính chuẩn xác tổng thu = thu trận + thu tài trợ/khác", () => {
    const mockAttendances: MatchAttendance[] = [
      { id: 1, match_id: 1, player_id: 1, attended: 1, paid: 1, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" },
    ];
    const mockOtherIncomes: OtherIncome[] = [
      { id: 1, income_date: "2026-03-01", contributor: "Mạnh Thường Quân", amount: 2000000, fund_type: "Tài trợ", note: "Tài trợ áo đấu" },
      { id: 2, income_date: "2026-03-05", contributor: "Anh em Điện Quang", amount: 500000, fund_type: "Ủng hộ", note: "Ủng hộ nước mía" },
    ];

    const summary = calculateFinancialSummary({
      attendances: mockAttendances,
      otherIncomes: mockOtherIncomes,
      expenses: [],
    });

    expect(summary.totalOtherIncome).toBe(2500000);
    expect(summary.totalIncome).toBe(2600000);
  });

  it("tính chính xác quỹ tồn hiện tại = Tổng thu - Tổng chi", () => {
    const mockAttendances: MatchAttendance[] = [
      { id: 1, match_id: 1, player_id: 1, attended: 1, paid: 1, amount: 500000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" },
    ];
    const mockExpenses: ExpenseRecord[] = [
      { id: 1, match_id: null, expense_date: "2026-03-02", category: "Tiền sân", description: "Sân Chảo Lửa", amount: 300000, payer: "Tiếng" },
      { id: 2, match_id: null, expense_date: "2026-03-02", category: "Nước uống", description: "Nước khoáng", amount: 50000, payer: "Tín" },
    ];

    const summary = calculateFinancialSummary({
      attendances: mockAttendances,
      otherIncomes: [],
      expenses: mockExpenses,
    });

    expect(summary.totalExpense).toBe(350000);
    expect(summary.currentBalance).toBe(150000); // 500k - 350k = 150k
  });

  it("xử lý an toàn khi danh sách trống (không bị chia cho 0 hay NaN)", () => {
    const summary = calculateFinancialSummary({
      attendances: [],
      otherIncomes: [],
      expenses: [],
    });

    expect(summary.totalIncome).toBe(0);
    expect(summary.totalExpense).toBe(0);
    expect(summary.currentBalance).toBe(0);
    expect(summary.totalUnpaidAmount).toBe(0);
    expect(summary.categoryBreakdown.every((c) => c.percentage === 0)).toBe(true);
  });
});

describe("Player Debt Calculations (Nợ tiền quỹ của cầu thủ)", () => {
  it("tính đúng số trận nợ và số tiền nợ của từng cầu thủ cụ thể", () => {
    const mockAttendances: MatchAttendance[] = [
      { id: 1, match_id: 1, player_id: 10, attended: 1, paid: 1, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" },
      { id: 2, match_id: 2, player_id: 10, attended: 1, paid: 0, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" }, // nợ
      { id: 3, match_id: 3, player_id: 10, attended: 1, paid: 0, amount: 120000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" }, // nợ
      { id: 4, match_id: 4, player_id: 10, attended: 0, paid: 0, amount: 0, note: "", rsvp_status: "none", walk_in: 0, collected_by: "" },
    ];

    const debt = calculatePlayerAttendanceDebt(10, mockAttendances);

    expect(debt.attendedCount).toBe(3);
    expect(debt.paidCount).toBe(1);
    expect(debt.unpaidCount).toBe(2);
    expect(debt.debtAmount).toBe(220000); // 100k + 120k
  });
});

describe("Match Stats Calculations (Thống kê Trận đấu)", () => {
  it("tính chính xác số tiền thu, chi phí sân và kết quả quỹ ròng của trận", () => {
    const mockMatches: MatchRecord[] = [
      {
        id: 1,
        match_number: 1,
        label: "Trận Khai Xuân",
        match_date: "2026-03-01",
        kickoff_time: "19:00",
        venue: "Sân K334",
        opponent: "FC Bạn Bè",
        fee_per_player: 100000,
        pitch_cost: 600000,
        payer_name: "Tiếng",
        status: "Đã kết thúc",
        team_score: 5,
        opponent_score: 3,
        notes: "",
      },
    ];

    const mockAttendances: MatchAttendance[] = [
      { id: 1, match_id: 1, player_id: 1, attended: 1, paid: 1, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" },
      { id: 2, match_id: 1, player_id: 2, attended: 1, paid: 1, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" },
      { id: 3, match_id: 1, player_id: 3, attended: 1, paid: 1, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "" },
    ];

    const stats = calculateMatchStats(mockMatches, mockAttendances, []);

    expect(stats[0].collected).toBe(300000);
    expect(stats[0].expense).toBe(600000);
    expect(stats[0].net).toBe(-300000); // Thu 300k - Tiền sân 600k = -300k
    expect(stats[0].attendeesCount).toBe(3);
  });
});
