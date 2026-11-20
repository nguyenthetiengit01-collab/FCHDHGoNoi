import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { calculateFinancialSummary } from "./financialCalculations";
import { buildPublicFinancialReport } from "./publicFinancialReport";
import { EXPENSE_CATEGORIES, type FullAppData } from "@/types/app";

vi.mock("@/lib/db", () => ({
  getFullAppData: vi.fn(),
  getPublicFinancialReportData: vi.fn(),
}));

import { getPublicFinancialReportData } from "@/lib/db";
import { GET } from "@/app/api/public/financial-report/route";

function createSampleData(): FullAppData {
  const attendances: FullAppData["attendances"] = [
    {
      id: 1,
      match_id: 1,
      player_id: 1,
      attended: 1,
      paid: 1,
      amount: 100000,
      walk_in: 0,
      collected_by: "A",
      rsvp_status: "registered",
      note: "Ghi chú nội bộ 1",
    },
    {
      id: 2,
      match_id: 1,
      player_id: 2,
      attended: 1,
      paid: 0,
      amount: 100000,
      walk_in: 0,
      collected_by: "",
      rsvp_status: "registered",
      note: "Chưa đóng",
    },
    {
      id: 3,
      match_id: 2,
      player_id: 1,
      attended: 0,
      paid: 1,
      amount: 100000,
      walk_in: 0,
      collected_by: "A",
      rsvp_status: "absent_notice",
      note: "Tự nguyện",
    },
  ];

  const otherIncomes: FullAppData["otherIncomes"] = [
    {
      id: 1,
      income_date: "2026-10-12",
      contributor: "Mạnh thường quân A",
      amount: 500000,
      fund_type: "Quỹ sinh hoạt",
      note: "Ủng hộ",
    },
    {
      id: 2,
      income_date: "2026-10-15",
      contributor: "Quỹ giải",
      amount: 300000,
      fund_type: "Ghi chú Quỹ giải",
      note: "Ghi chú quỹ giải",
    },
    {
      id: 3,
      income_date: "2026-11-02",
      contributor: "Nội bộ",
      amount: 200000,
      fund_type: "Chuyển quỹ nội bộ",
      note: "Loại trừ",
    },
    {
      id: 4,
      income_date: "2026-11-03",
      contributor: "Nội bộ 2",
      amount: 150000,
      fund_type: "transfer",
      note: "Loại trừ",
    },
  ];

  const expenses: FullAppData["expenses"] = [
    {
      id: 1,
      expense_date: "2026-10-10",
      category: "Tiền sân",
      description: "Thuê sân tháng 10",
      amount: 400000,
      payer: "A",
      match_id: 1,
    },
    {
      id: 2,
      expense_date: "2026-11-01",
      category: "Nước uống",
      description: "Nước suối",
      amount: 80000,
      payer: "A",
      match_id: 2,
    },
    {
      id: 3,
      expense_date: "2026-11-02",
      category: "Khác",
      description: "Điều chỉnh giảm chi",
      amount: -30000,
      payer: "A",
      match_id: null,
    },
    {
      id: 4,
      expense_date: "2026-11-02",
      category: "Chuyển quỹ nội bộ",
      description: "Chuyển nội bộ",
      amount: 200000,
      payer: "A",
      match_id: null,
    },
  ];

  const summary = calculateFinancialSummary({
    attendances,
    otherIncomes,
    expenses,
  });

  return {
    settings: {
      id: 1,
      team_name: "FC HĐH Gò Nổi tại TP.HCM",
      short_name: "FC GÒ NỔI",
      default_match_fee: 100000,
      bank_bin: "970422",
      bank_name: "MB",
      bank_account_no: "0123456789",
      bank_account_name: "NGUYEN THE TIENG",
      tournament_fund_reserve: 2301700,
      tournament_fund_note: "Ghi chú nội bộ quỹ giải tuyệt mật",
    },
    players: [
      {
        id: 1,
        code_order: 1,
        full_name: "Nguyễn Văn A",
        short_name: "A",
        jersey_number: 10,
        position: "MF",
        phone: "0909123456",
        birth_year: "1995",
        avatar_url: "",
        role: "Cầu thủ",
        access_role: "manager",
        username: "admin",
        pin_code: "hashed-pin-secret",
        status: "Đang sinh hoạt",
        notes: "Ghi chú cá nhân",
      },
    ],
    matches: [
      {
        id: 1,
        match_number: 1,
        label: "Trận 1",
        match_date: "2026-10-10",
        kickoff_time: "19:00",
        venue: "Sân A",
        opponent: "Đội bạn A",
        team_score: 3,
        opponent_score: 2,
        status: "completed",
        pitch_cost: 400000,
        payer_name: "A",
        fee_per_player: 100000,
        notes: "",
      },
      {
        id: 2,
        match_number: 2,
        label: "Trận 2",
        match_date: "2026-11-01",
        kickoff_time: "19:00",
        venue: "Sân B",
        opponent: "Đội bạn B",
        team_score: 1,
        opponent_score: 1,
        status: "completed",
        pitch_cost: 350000,
        payer_name: "A",
        fee_per_player: 100000,
        notes: "",
      },
    ],
    attendances,
    otherIncomes,
    expenses,
    summary,
    posts: [],
    sponsors: [],
  };
}

describe("publicFinancialReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches Manager Dashboard calculateFinancialSummary 100% for all-time totals and keeps tournamentReserve independent", () => {
    const data = createSampleData();
    const report = buildPublicFinancialReport(data);

    // Match income: 100k + 100k = 200k (unpaid 100k excluded)
    // Other income: 500k + 300k ("Ghi chú Quỹ giải") = 800k (internal transfers excluded)
    // Total income = 1,000,000
    // Total expense: 400k + 80k - 30k = 450,000 (internal transfer excluded, negative retained)
    // Balance = 550,000
    expect(report.summary.totalMatchIncome).toBe(data.summary.totalMatchIncome);
    expect(report.summary.totalOtherIncome).toBe(data.summary.totalOtherIncome);
    expect(report.summary.totalIncome).toBe(1000000);
    expect(report.summary.totalExpense).toBe(450000);
    expect(report.summary.currentBalance).toBe(550000);
    expect(report.tournamentReserve).toBe(2301700);
    expect(report.summary.categoryBreakdown).toEqual(data.summary.categoryBreakdown);
    expect(report.summary.categoryBreakdown).toHaveLength(EXPENSE_CATEGORIES.length);
  });

  it("reconciles month filter (YYYY-MM) with calculateFinancialSummary on the same period", () => {
    const data = createSampleData();
    const report = buildPublicFinancialReport(data, { month: "2026-10" });

    const expected = calculateFinancialSummary({
      attendances: data.attendances.filter((a) => a.match_id === 1),
      otherIncomes: data.otherIncomes.filter((i) => i.income_date.startsWith("2026-10")),
      expenses: data.expenses.filter((e) => e.expense_date.startsWith("2026-10")),
    });

    expect(report.filter).toEqual({ year: "2026", month: "2026-10" });
    expect(report.summary.totalIncome).toBe(expected.totalIncome);
    expect(report.summary.totalExpense).toBe(expected.totalExpense);
    expect(report.summary.currentBalance).toBe(expected.currentBalance);
    expect(report.summary.categoryBreakdown).toEqual(expected.categoryBreakdown);
  });

  it("strips all sensitive personal, credential, debt, and raw invoice fields", () => {
    const data = createSampleData();
    const report = buildPublicFinancialReport(data);
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain("0909123456");
    expect(serialized).not.toContain("hashed-pin-secret");
    expect(serialized).not.toContain("0123456789");
    expect(serialized).not.toContain("Ghi chú nội bộ quỹ giải tuyệt mật");
    expect(serialized).not.toContain("Mạnh thường quân A");
    expect(serialized).not.toContain("Thuê sân tháng 10");
    expect(serialized).not.toContain("totalUnpaidAmount");
    expect("players" in report).toBe(false);
    expect("attendances" in report).toBe(false);
    expect("otherIncomes" in report).toBe(false);
    expect("expenses" in report).toBe(false);
    expect("matches" in report).toBe(false);
  });

  it("returns hasData: false when filtered period has no transactions, even if tournamentReserve > 0", () => {
    const data = createSampleData();
    const report = buildPublicFinancialReport(data, { month: "2025-01" });

    expect(report.summary.totalIncome).toBe(0);
    expect(report.summary.totalExpense).toBe(0);
    expect(report.summary.currentBalance).toBe(0);
    expect(report.tournamentReserve).toBe(2301700);
    expect(report.hasData).toBe(false);
  });

  it("supports year filtering and keeps tournamentReserve unchanged across filters", () => {
    const data = createSampleData();
    const allReport = buildPublicFinancialReport(data);
    const yearReport = buildPublicFinancialReport(data, { year: "2026" });
    const monthReport = buildPublicFinancialReport(data, { month: "2026-10" });

    expect(yearReport.filter).toEqual({ year: "2026", month: "all" });
    expect(yearReport.summary.totalIncome).toBe(allReport.summary.totalIncome);
    expect(yearReport.summary.totalExpense).toBe(allReport.summary.totalExpense);
    expect(yearReport.hasData).toBe(true);
    expect(allReport.tournamentReserve).toBe(2301700);
    expect(yearReport.tournamentReserve).toBe(2301700);
    expect(monthReport.tournamentReserve).toBe(2301700);
  });

  it("returns hasData: true when a period has valid transactions whose net total is 0", () => {
    const data = createSampleData();
    data.expenses.push(
      {
        id: 10,
        expense_date: "2026-12-05",
        category: "Khác",
        description: "Tạm ứng",
        amount: 100000,
        payer: "A",
        match_id: null,
      },
      {
        id: 11,
        expense_date: "2026-12-06",
        category: "Khác",
        description: "Hoàn ứng",
        amount: -100000,
        payer: "A",
        match_id: null,
      }
    );

    const report = buildPublicFinancialReport(data, { month: "2026-12" });
    expect(report.summary.totalIncome).toBe(0);
    expect(report.summary.totalExpense).toBe(0);
    expect(report.summary.currentBalance).toBe(0);
    expect(report.hasData).toBe(true);
  });

  it("GET /api/public/financial-report returns HTTP 200 with no-store and filtered totals", async () => {
    const sample = createSampleData();
    vi.mocked(getPublicFinancialReportData).mockResolvedValueOnce(sample);

    const req = new NextRequest(
      "http://localhost:3000/api/public/financial-report?year=2026&month=2026-11"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");

    const json = await res.json();
    expect(json.summary.totalIncome).toBe(100000);
    expect(json.summary.totalExpense).toBe(50000);
    expect(json.summary.currentBalance).toBe(50000);
    expect(json.tournamentReserve).toBe(2301700);
  });
});
