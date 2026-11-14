import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import type { FullAppData } from "@/types/app";
import { calculateFinancialSummary } from "./financialCalculations";
import {
  buildCashflowSeries,
  buildCollectionIntelligence,
  buildEnrichedMatches,
  buildManagementInsights,
  buildMatchAnalytics,
  buildRecentTransactions,
  getTodayVNDateString,
} from "./dashboardIntelligence";

function makeFixtureData(): FullAppData {
  const players: FullAppData["players"] = [
    {
      id: 1,
      code_order: 1,
      full_name: "Nguyễn Thế Tiếng",
      short_name: "Tiếng",
      jersey_number: 10,
      position: "Tiền vệ",
      phone: "",
      birth_year: "1990",
      avatar_url: "/uploads/avatars/member-1.jpg",
      role: "Đội trưởng",
      access_role: "manager",
      pin_code: "",
      status: "Đang sinh hoạt",
      notes: "",
    },
    {
      id: 2,
      code_order: 2,
      full_name: "Lê Văn A",
      short_name: "Văn A",
      jersey_number: 7,
      position: "Tiền đạo",
      phone: "",
      birth_year: "1994",
      avatar_url: "/uploads/avatars/member-2.jpg",
      role: "Thành viên",
      access_role: "player",
      pin_code: "",
      status: "Đang sinh hoạt",
      notes: "",
    },
    {
      id: 3,
      code_order: 3,
      full_name: "Trần Văn B",
      short_name: "Văn B",
      jersey_number: 9,
      position: "Hậu vệ",
      phone: "",
      birth_year: "1995",
      avatar_url: "/uploads/avatars/member-3.jpg",
      role: "Thành viên",
      access_role: "player",
      pin_code: "",
      status: "Đang sinh hoạt",
      notes: "",
    },
  ];

  const matches: FullAppData["matches"] = [
    {
      id: 1,
      match_number: 1,
      label: "Trận 1",
      match_date: "2026-10-10",
      kickoff_time: "19:00",
      venue: "Sân Vĩnh Lộc",
      opponent: "Giao hữu",
      fee_per_player: 100000,
      pitch_cost: 900000,
      payer_name: "Tiếng",
      team_score: 3,
      opponent_score: 2,
      status: "Đã kết thúc",
      notes: "",
    },
    {
      id: 2,
      match_number: 2,
      label: "Trận 2",
      match_date: "2026-11-05",
      kickoff_time: "19:30",
      venue: "Sân Gò Mây",
      opponent: "Giao hữu",
      fee_per_player: 100000,
      pitch_cost: 950000,
      payer_name: "Tiếng",
      team_score: 2,
      opponent_score: 2,
      status: "Đã kết thúc",
      notes: "",
    },
    {
      id: 3,
      match_number: 3,
      label: "Trận 3",
      match_date: "2026-11-20",
      kickoff_time: "19:30",
      venue: "",
      opponent: "FC Bạn",
      fee_per_player: 100000,
      pitch_cost: 0,
      payer_name: "Tiếng",
      team_score: null,
      opponent_score: null,
      status: "Sắp diễn ra",
      notes: "",
    },
  ];

  const attendances: FullAppData["attendances"] = [
    // Trận 1: #1 ra sân + đóng; #2 ra sân + chưa đóng (nợ); #3 vắng + ủng hộ tự nguyện
    {
      id: 1,
      match_id: 1,
      player_id: 1,
      rsvp_status: "registered",
      walk_in: 0,
      attended: 1,
      paid: 1,
      amount: 100000,
      collected_by: "Tiếng",
      note: "",
    },
    {
      id: 2,
      match_id: 1,
      player_id: 2,
      rsvp_status: "registered",
      walk_in: 0,
      attended: 1,
      paid: 0,
      amount: 100000,
      collected_by: "",
      note: "",
    },
    {
      id: 3,
      match_id: 1,
      player_id: 3,
      rsvp_status: "none",
      walk_in: 0,
      attended: 0,
      paid: 1,
      amount: 100000,
      collected_by: "Tiếng",
      note: "Ủng hộ",
    },
    // Trận 2: #1 ra sân + đóng
    {
      id: 4,
      match_id: 2,
      player_id: 1,
      rsvp_status: "registered",
      walk_in: 0,
      attended: 1,
      paid: 1,
      amount: 100000,
      collected_by: "Tiếng",
      note: "",
    },
  ];

  const otherIncomes: FullAppData["otherIncomes"] = [
    {
      id: 1,
      income_date: "2026-11-06",
      contributor: "Anh Sơn",
      amount: 500000,
      fund_type: "Quỹ sinh hoạt",
      note: "Ủng hộ nước uống",
    },
    {
      id: 2,
      income_date: "2026-11-06",
      contributor: "Quỹ giải",
      amount: 0,
      fund_type: "Ghi chú Quỹ giải",
      note: "Quỹ giải tồn riêng 2,301,700đ",
    },
  ];

  const expenses: FullAppData["expenses"] = [
    {
      id: 1,
      expense_date: "2026-10-10",
      category: "Tiền sân",
      description: "Tiền sân Trận 1",
      amount: 900000,
      payer: "Tiếng",
      match_id: 1,
    },
    {
      id: 2,
      expense_date: "2026-11-05",
      category: "Tiền sân",
      description: "Tiền sân Trận 2",
      amount: 950000,
      payer: "Tiếng",
      match_id: 2,
    },
  ];

  return {
    settings: {
      id: 1,
      team_name: "FC HĐH Gò Nổi tại TP.HCM",
      short_name: "FC HĐH GÒ NỔI",
      default_match_fee: 100000,
      bank_bin: "970422",
      bank_name: "MB Bank",
      bank_account_no: "0905123456",
      bank_account_name: "NGUYEN THE TIENG",
      tournament_fund_reserve: 2301700,
      tournament_fund_note: "Quỹ giải tách riêng",
    },
    players,
    matches,
    attendances,
    otherIncomes,
    expenses,
    summary: calculateFinancialSummary({ attendances, otherIncomes, expenses }),
    posts: [],
    sponsors: [],
  };
}

describe("Phase 3.6 – Dashboard Intelligence Selectors", () => {
  it("formats Vietnam timezone dates consistently across UTC midnight boundaries", () => {
    // 2026-11-13T18:00:00Z is 2026-11-14 01:00:00 in Asia/Ho_Chi_Minh
    const utcEvening = new Date("2026-11-13T18:00:00Z");
    expect(getTodayVNDateString(utcEvening)).toBe("2026-11-14");
  });

  it("buildCashflowSeries separates actualIncome from unpaidDebt in match and month modes", () => {
    const data = makeFixtureData();

    const byMatch = buildCashflowSeries(data, "match");
    expect(byMatch.hasEnoughTrendData).toBe(true);
    expect(byMatch.points).toHaveLength(3);
    // Trận 1: 200,000 collected (#1 + #3), 100,000 unpaid debt (#2)
    expect(byMatch.points[0].actualIncome).toBe(200000);
    expect(byMatch.points[0].unpaidDebt).toBe(100000);
    expect(byMatch.points[0].expense).toBe(900000);
    expect(byMatch.points[0].net).toBe(-700000);

    const byMonth = buildCashflowSeries(data, "month");
    expect(byMonth.points.map((p) => p.label)).toEqual(["T10/2026", "T11/2026"]);
    // T11/2026: Trận 2 match income (100,000) + Anh Sơn otherIncome (500,000) = 600,000
    expect(byMonth.points[1].actualIncome).toBe(600000);
    expect(byMonth.points[1].expense).toBe(950000);
    expect(byMonth.points[1].unpaidDebt).toBe(0);

    // Insufficient data flag when < 2 periods
    const singleMatchData: FullAppData = {
      ...data,
      matches: [data.matches[0]],
    };
    expect(
      buildCashflowSeries(singleMatchData, "match").hasEnoughTrendData
    ).toBe(false);
  });

  it("buildCollectionIntelligence distinguishes attended+paid, attended+unpaid, and voluntary donors", () => {
    const data = makeFixtureData();
    const ci = buildCollectionIntelligence(data);

    expect(ci.totalAttendanceTurns).toBe(3); // #1 (T1), #2 (T1), #1 (T2)
    expect(ci.paidAttendedTurns).toBe(2);
    expect(ci.unpaidAttendedTurns).toBe(1);
    expect(ci.voluntaryTurns).toBe(1); // #3 (T1)
    expect(ci.totalPaidTurns).toBe(3);
    expect(ci.totalUnpaidAmount).toBe(100000);
    expect(ci.totalVoluntaryAmount).toBe(100000);

    // Voluntary donor (#3) must NEVER appear in topDebtors
    expect(ci.topDebtors).toHaveLength(1);
    expect(ci.topDebtors[0].playerId).toBe(2);
    expect(ci.topDebtors[0].unpaidAmount).toBe(100000);
  });

  it("buildRecentTransactions excludes internal tournament reserve notes and sorts newest first", () => {
    const data = makeFixtureData();
    const tx = buildRecentTransactions(data, 10);

    expect(tx.some((t) => t.category === "Ghi chú Quỹ giải")).toBe(false);
    expect(tx[0].date).toBe("2026-11-06");
    expect(tx[0].amount).toBe(500000);
    expect(tx[0].isPositive).toBe(true);
  });

  it("buildMatchAnalytics & buildManagementInsights emit only verified real alerts", () => {
    const data = makeFixtureData();
    const analytics = buildMatchAnalytics(data, new Date("2026-11-13T10:00:00Z"));
    const collection = buildCollectionIntelligence(data);

    expect(analytics.upcomingMatch?.id).toBe(3);
    expect(analytics.latestMatch?.id).toBe(2);
    expect(analytics.missingPitchCostCount).toBe(1);

    const insights = buildManagementInsights(data, analytics, collection, true);
    expect(insights.map((i) => i.id)).toEqual(
      expect.arrayContaining([
        "unpaid-debt",
        "missing-venue",
        "missing-pitch-cost",
        "empty-rsvp",
        "latest-expense",
      ])
    );
    expect(insights.find((i) => i.id === "unpaid-debt")?.targetTab).toBe(
      "collection"
    );

    const playerInsights = buildManagementInsights(
      data,
      analytics,
      collection,
      false
    );
    expect(playerInsights.find((i) => i.id === "unpaid-debt")?.targetTab).toBe(
      "matrix"
    );
  });

  it("excludes internal transfer incomes (transfer & Chuyển quỹ nội bộ) from cashflow and recent transactions", () => {
    const data = makeFixtureData();
    data.otherIncomes.push(
      {
        id: 10,
        income_date: "2026-11-08",
        contributor: "Quỹ cũ",
        amount: 300000,
        fund_type: "transfer",
        note: "Chuyển số dư",
      },
      {
        id: 11,
        income_date: "2026-11-09",
        contributor: "Quỹ đội",
        amount: 400000,
        fund_type: "Chuyển quỹ nội bộ",
        note: "Điều chuyển nội bộ",
      }
    );

    const summary = calculateFinancialSummary({
      attendances: data.attendances,
      otherIncomes: data.otherIncomes,
      expenses: data.expenses,
    });
    const monthly = buildCashflowSeries(data, "month", 12).points;
    const totalMonthlyIncome = monthly.reduce((s, p) => s + p.actualIncome, 0);
    expect(totalMonthlyIncome).toBe(summary.totalIncome);

    const tx = buildRecentTransactions(data, 20);
    expect(tx.some((t) => t.id === "inc-10" || t.id === "inc-11")).toBe(false);
  });

  it("excludes internal transfer expenses (Chuyển quỹ nội bộ) from cashflow (month & match) and recent transactions", () => {
    const data = makeFixtureData();
    data.expenses.push({
      id: 10,
      expense_date: "2026-11-08",
      category: "Chuyển quỹ nội bộ",
      description: "Chuyển sang quỹ giải",
      amount: 600000,
      payer: "Tiếng",
      match_id: 2,
    });

    const summary = calculateFinancialSummary({
      attendances: data.attendances,
      otherIncomes: data.otherIncomes,
      expenses: data.expenses,
    });
    const monthly = buildCashflowSeries(data, "month", 12).points;
    const totalMonthlyExpense = monthly.reduce((s, p) => s + p.expense, 0);
    expect(totalMonthlyExpense).toBe(summary.totalExpense);

    const byMatch = buildCashflowSeries(data, "match", 12).points;
    const m2Point = byMatch.find((p) => p.key === "match-2");
    expect(m2Point?.expense).toBe(950000);

    const tx = buildRecentTransactions(data, 20);
    expect(tx.some((t) => t.id === "exp-10")).toBe(false);
  });

  it("handles 'Ghi chú Quỹ giải' consistently with calculateFinancialSummary", () => {
    const data = makeFixtureData();
    data.otherIncomes.push({
      id: 12,
      income_date: "2026-11-12",
      contributor: "Quỹ giải",
      amount: 250000,
      fund_type: "Ghi chú Quỹ giải",
      note: "Bổ sung thực thu có số tiền > 0",
    });

    const summary = calculateFinancialSummary({
      attendances: data.attendances,
      otherIncomes: data.otherIncomes,
      expenses: data.expenses,
    });
    const monthly = buildCashflowSeries(data, "month", 12).points;
    const totalMonthlyIncome = monthly.reduce((s, p) => s + p.actualIncome, 0);
    expect(totalMonthlyIncome).toBe(summary.totalIncome);

    const tx = buildRecentTransactions(data, 20);
    expect(tx.some((t) => t.id === "inc-12")).toBe(true);
    expect(tx.some((t) => t.id === "inc-2")).toBe(false);
  });

  it("groups match income by match_date in monthly cashflow and clarifies time & scope semantics in DashboardTab", () => {
    const data = makeFixtureData();
    const monthly = buildCashflowSeries(data, "month", 12).points;
    const oct = monthly.find((p) => p.key === "month-2026-10");
    const nov = monthly.find((p) => p.key === "month-2026-11");

    expect(oct?.actualIncome).toBe(200000);
    expect(nov?.actualIncome).toBe(600000);

    const dashboardSrc = readFileSync(
      resolve(process.cwd(), "src/components/DashboardTab.tsx"),
      "utf8"
    );
    expect(dashboardSrc).toContain("chưa lưu ngày thu thực tế");
    expect(dashboardSrc).toContain("kể cả chi phí ngoài trận");
    expect(dashboardSrc).toContain("Ngày trận:");
  });

  it("does not let match-linked non-pitch expenses (e.g. Áo đấu/Phụ kiện) mask missingPitchCostCount", () => {
    const data = makeFixtureData();
    // Match 3 has pitch_cost: 0 and status: "Sắp diễn ra".
    // Link a non-pitch expense to Match 3:
    data.expenses.push({
      id: 20,
      expense_date: "2026-11-12",
      category: "Áo đấu/Phụ kiện",
      description: "Mua bóng tập trận 3",
      amount: 350000,
      payer: "Tiếng",
      match_id: 3,
    });

    const analytics = buildMatchAnalytics(data, new Date("2026-11-13T10:00:00Z"));
    expect(analytics.missingPitchCostCount).toBe(1);
  });

  it("includes non-match expenses (match_id: null) in monthly cashflow mode", () => {
    const data = makeFixtureData();
    data.expenses.push({
      id: 30,
      expense_date: "2026-11-14",
      category: "Nước uống",
      description: "Mua nước tháng 11",
      amount: 120000,
      payer: "Tiếng",
      match_id: null,
    });

    const monthly = buildCashflowSeries(data, "month", 12).points;
    const nov = monthly.find((p) => p.key === "month-2026-11");
    expect(nov?.expense).toBe(950000 + 120000);
  });

  it("preserves debt and voluntary donation semantics unchanged", () => {
    const data = makeFixtureData();
    const ci = buildCollectionIntelligence(data);

    expect(ci.unpaidAttendedTurns).toBe(1);
    expect(ci.totalUnpaidAmount).toBe(100000);
    expect(ci.voluntaryTurns).toBe(1);
    expect(ci.totalVoluntaryAmount).toBe(100000);
  });

  it("preserves negative otherIncome adjustments in monthly cashflow and recent transactions with correct sign", () => {
    const data = makeFixtureData();
    data.otherIncomes.push({
      id: 40,
      income_date: "2026-11-15",
      contributor: "Điều chỉnh quỹ",
      amount: -150000,
      fund_type: "Quỹ sinh hoạt",
      note: "Hoàn trả tiền đóng nhầm",
    });

    const summary = calculateFinancialSummary({
      attendances: data.attendances,
      otherIncomes: data.otherIncomes,
      expenses: data.expenses,
    });
    const monthly = buildCashflowSeries(data, "month", 12).points;
    const nov = monthly.find((p) => p.key === "month-2026-11");
    expect(nov?.actualIncome).toBe(100000 + 500000 - 150000);
    expect(monthly.reduce((s, p) => s + p.actualIncome, 0)).toBe(summary.totalIncome);

    const tx = buildRecentTransactions(data, 20);
    const negInc = tx.find((t) => t.id === "inc-40");
    expect(negInc).toBeDefined();
    expect(negInc?.isPositive).toBe(false);
    expect(negInc?.amount).toBe(150000);
  });

  it("preserves negative expense adjustments in monthly cashflow and recent transactions with positive sign", () => {
    const data = makeFixtureData();
    data.expenses.push({
      id: 41,
      expense_date: "2026-11-16",
      category: "Nước uống",
      description: "Hoàn tiền nước dư",
      amount: -80000,
      payer: "Tiếng",
      match_id: null,
    });

    const summary = calculateFinancialSummary({
      attendances: data.attendances,
      otherIncomes: data.otherIncomes,
      expenses: data.expenses,
    });
    const monthly = buildCashflowSeries(data, "month", 12).points;
    const nov = monthly.find((p) => p.key === "month-2026-11");
    expect(nov?.expense).toBe(950000 - 80000);
    expect(monthly.reduce((s, p) => s + p.expense, 0)).toBe(summary.totalExpense);

    const tx = buildRecentTransactions(data, 20);
    const negExp = tx.find((t) => t.id === "exp-41");
    expect(negExp).toBeDefined();
    expect(negExp?.isPositive).toBe(true);
    expect(negExp?.amount).toBe(80000);
  });

  it("aggregates match expense = pitch_cost + non-pitch match expenses when no Tiền sân expense exists", () => {
    const data = makeFixtureData();
    data.matches.push({
      id: 4,
      match_number: 4,
      label: "Trận 4",
      match_date: "2026-11-22",
      kickoff_time: "19:30",
      venue: "Sân mới",
      opponent: "FC K",
      fee_per_player: 100000,
      pitch_cost: 800000,
      payer_name: "Tiếng",
      team_score: null,
      opponent_score: null,
      status: "Sắp diễn ra",
      notes: "",
    });
    data.expenses.push(
      {
        id: 42,
        expense_date: "2026-11-22",
        category: "Áo đấu/Phụ kiện",
        description: "Áo đấu trận 4",
        amount: 100000,
        payer: "Tiếng",
        match_id: 4,
      },
      {
        id: 43,
        expense_date: "2026-11-22",
        category: "Chuyển quỹ nội bộ",
        description: "Chuyển nội bộ",
        amount: 500000,
        payer: "Tiếng",
        match_id: 4,
      }
    );

    const enriched = buildEnrichedMatches(data);
    const m4 = enriched.find((m) => m.id === 4);
    expect(m4?.pitchExpense).toBe(800000);
    expect(m4?.expense).toBe(900000);
  });

  it("does not double-count pitch_cost when a Tiền sân expense exists alongside non-pitch match expenses", () => {
    const data = makeFixtureData();
    data.matches.push({
      id: 5,
      match_number: 5,
      label: "Trận 5",
      match_date: "2026-11-25",
      kickoff_time: "19:30",
      venue: "Sân 5",
      opponent: "FC M",
      fee_per_player: 100000,
      pitch_cost: 800000,
      payer_name: "Tiếng",
      team_score: null,
      opponent_score: null,
      status: "Sắp diễn ra",
      notes: "",
    });
    data.expenses.push(
      {
        id: 44,
        expense_date: "2026-11-25",
        category: "Tiền sân",
        description: "Tiền sân trận 5",
        amount: 800000,
        payer: "Tiếng",
        match_id: 5,
      },
      {
        id: 45,
        expense_date: "2026-11-25",
        category: "Áo đấu/Phụ kiện",
        description: "Áo đấu trận 5",
        amount: 100000,
        payer: "Tiếng",
        match_id: 5,
      },
      {
        id: 46,
        expense_date: "2026-11-25",
        category: "Chuyển quỹ nội bộ",
        description: "Chuyển nội bộ",
        amount: 300000,
        payer: "Tiếng",
        match_id: 5,
      }
    );

    const enriched = buildEnrichedMatches(data);
    const m5 = enriched.find((m) => m.id === 5);
    expect(m5?.pitchExpense).toBe(800000);
    expect(m5?.expense).toBe(900000);

    const analytics = buildMatchAnalytics(data, new Date("2026-11-13T10:00:00Z"));
    // Match 3 still missing pitch cost; Match 4 & Match 5 have pitchExpense = 800000
    expect(analytics.missingPitchCostCount).toBe(1);
  });

  it("TEST 17: does not fallback to m.pitch_cost when valid Tiền sân records net to 0", () => {
    const data = makeFixtureData();
    data.matches.push({
      id: 6,
      match_number: 6,
      label: "Trận 6",
      match_date: "2026-11-28",
      kickoff_time: "19:30",
      venue: "Sân 6",
      opponent: "FC Zero",
      fee_per_player: 100000,
      pitch_cost: 900000,
      payer_name: "Tiếng",
      team_score: null,
      opponent_score: null,
      status: "Đã kết thúc",
      notes: "",
    });
    data.expenses.push(
      {
        id: 47,
        expense_date: "2026-11-28",
        category: "Tiền sân",
        description: "Tiền sân trận 6",
        amount: 800000,
        payer: "Tiếng",
        match_id: 6,
      },
      {
        id: 48,
        expense_date: "2026-11-28",
        category: "Tiền sân",
        description: "Hoàn toàn bộ tiền sân trận 6",
        amount: -800000,
        payer: "Tiếng",
        match_id: 6,
      },
      {
        id: 49,
        expense_date: "2026-11-28",
        category: "Áo đấu/Phụ kiện",
        description: "Áo đấu trận 6",
        amount: 100000,
        payer: "Tiếng",
        match_id: 6,
      }
    );

    const enriched = buildEnrichedMatches(data);
    const m6 = enriched.find((m) => m.id === 6);
    expect(m6).toBeDefined();
    expect(m6?.pitchExpense).toBe(0);
    expect(m6?.expense).toBe(100000);
    expect(m6?.expense).not.toBe(1000000);
  });

  it("TEST 18: does not fallback to m.pitch_cost when valid Tiền sân record is negative", () => {
    const data = makeFixtureData();
    data.matches.push({
      id: 7,
      match_number: 7,
      label: "Trận 7",
      match_date: "2026-11-29",
      kickoff_time: "19:30",
      venue: "Sân 7",
      opponent: "FC Neg",
      fee_per_player: 100000,
      pitch_cost: 900000,
      payer_name: "Tiếng",
      team_score: null,
      opponent_score: null,
      status: "Đã kết thúc",
      notes: "",
    });
    data.expenses.push(
      {
        id: 50,
        expense_date: "2026-11-29",
        category: "Tiền sân",
        description: "Điều chỉnh giảm tiền sân trận 7",
        amount: -80000,
        payer: "Tiếng",
        match_id: 7,
      },
      {
        id: 51,
        expense_date: "2026-11-29",
        category: "Áo đấu/Phụ kiện",
        description: "Áo đấu trận 7",
        amount: 100000,
        payer: "Tiếng",
        match_id: 7,
      }
    );

    const enriched = buildEnrichedMatches(data);
    const m7 = enriched.find((m) => m.id === 7);
    expect(m7).toBeDefined();
    expect(m7?.pitchExpense).toBe(-80000);
    expect(m7?.expense).toBe(20000);
    expect(m7?.expense).not.toBe(1000000);
  });
});
