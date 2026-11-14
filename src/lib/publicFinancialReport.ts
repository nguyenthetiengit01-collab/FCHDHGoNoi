import { calculateFinancialSummary } from "./financialCalculations";
import {
  formatMonthLabelVN,
  isCountableExpense,
  isCountableOtherIncome,
} from "./dashboardIntelligence";
import type { FullAppData } from "@/types/app";

export interface PublicIncomeSourceItem {
  key: "match" | "other";
  label: string;
  amount: number;
  percentage: number;
}

export interface PublicMonthlyTrendItem {
  month: string;
  label: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
}

export interface PublicFinancialReportResponse {
  teamName: string;
  generatedAt: string;
  latestActivityDate: string | null;
  filter: {
    year: string;
    month: string;
  };
  availableYears: string[];
  availableMonths: string[];
  summary: {
    totalMatchIncome: number;
    totalOtherIncome: number;
    totalIncome: number;
    totalExpense: number;
    currentBalance: number;
    categoryBreakdown: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
  tournamentReserve: number;
  incomeSources: PublicIncomeSourceItem[];
  monthlyTrend: PublicMonthlyTrendItem[];
  hasData: boolean;
}

function isValidYear(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value.trim());
}

function isValidMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value.trim());
}

function extractYearMonth(dateStr: string | null | undefined): string | null {
  if (typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 7);
  }
  return null;
}

/**
 * Tổng hợp báo cáo tài chính công khai từ nguồn dữ liệu gốc.
 * Tái sử dụng hoàn toàn calculateFinancialSummary() để đảm bảo
 * đồng nhất tuyệt đối với Dashboard Ban Quản Lý và không làm lộ dữ liệu cá nhân/hóa đơn chi tiết.
 */
export function buildPublicFinancialReport(
  data: FullAppData,
  options?: {
    year?: string | null;
    month?: string | null;
    now?: Date;
  }
): PublicFinancialReportResponse {
  const now = options?.now ?? new Date();
  const rawMonth = options?.month?.trim() || "all";
  const rawYear = options?.year?.trim() || "all";

  const selectedMonth = isValidMonth(rawMonth) ? rawMonth : "all";
  const selectedYear =
    selectedMonth !== "all"
      ? selectedMonth.slice(0, 4)
      : isValidYear(rawYear)
        ? rawYear
        : "all";

  const matchDateById = new Map<number, string>();
  for (const m of data.matches) {
    matchDateById.set(m.id, (m.match_date || "").trim());
  }

  const monthSet = new Set<string>();
  const allDates: string[] = [];

  for (const m of data.matches) {
    const d = (m.match_date || "").trim();
    const ym = extractYearMonth(d);
    if (ym) monthSet.add(ym);
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) allDates.push(d.slice(0, 10));
  }

  for (const inc of data.otherIncomes) {
    if (!isCountableOtherIncome(inc)) continue;
    const d = (inc.income_date || "").trim();
    const ym = extractYearMonth(d);
    if (ym) monthSet.add(ym);
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) allDates.push(d.slice(0, 10));
  }

  for (const exp of data.expenses) {
    if (!isCountableExpense(exp)) continue;
    const d = (exp.expense_date || "").trim();
    const ym = extractYearMonth(d);
    if (ym) monthSet.add(ym);
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) allDates.push(d.slice(0, 10));
  }

  const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  const availableYears = Array.from(
    new Set(availableMonths.map((ym) => ym.slice(0, 4)))
  ).sort((a, b) => b.localeCompare(a));

  const latestActivityDate =
    allDates.length > 0 ? allDates.sort((a, b) => b.localeCompare(a))[0] : null;

  const matchesDateFilter = (dateStr: string | null | undefined): boolean => {
    const ym = extractYearMonth(dateStr);
    if (selectedMonth !== "all") {
      return ym === selectedMonth;
    }
    if (selectedYear !== "all") {
      return ym !== null && ym.slice(0, 4) === selectedYear;
    }
    return true;
  };

  const filteredAttendances =
    selectedMonth === "all" && selectedYear === "all"
      ? data.attendances
      : data.attendances.filter((a) =>
          matchesDateFilter(matchDateById.get(a.match_id))
        );

  const filteredOtherIncomes =
    selectedMonth === "all" && selectedYear === "all"
      ? data.otherIncomes
      : data.otherIncomes.filter((inc) => matchesDateFilter(inc.income_date));

  const filteredExpenses =
    selectedMonth === "all" && selectedYear === "all"
      ? data.expenses
      : data.expenses.filter((exp) => matchesDateFilter(exp.expense_date));

  const canonical = calculateFinancialSummary({
    attendances: filteredAttendances,
    otherIncomes: filteredOtherIncomes,
    expenses: filteredExpenses,
  });

  const tournamentReserve = Number(data.settings?.tournament_fund_reserve) || 0;

  const incomeTotalForShare = Math.max(0, canonical.totalIncome);
  const calcShare = (val: number) =>
    incomeTotalForShare > 0
      ? Math.round((Math.max(0, val) / incomeTotalForShare) * 1000) / 10
      : 0;

  const incomeSources: PublicIncomeSourceItem[] = [
    {
      key: "match",
      label: "Quỹ trận thực thu",
      amount: canonical.totalMatchIncome,
      percentage: calcShare(canonical.totalMatchIncome),
    },
    {
      key: "other",
      label: "Thu khác & Tài trợ",
      amount: canonical.totalOtherIncome,
      percentage: calcShare(canonical.totalOtherIncome),
    },
  ];

  // Xu hướng thu/chi theo tháng (tuân thủ đúng quy tắc lọc nội bộ của calculateFinancialSummary)
  const trendMap = new Map<string, { totalIncome: number; totalExpense: number }>();
  const ensureMonth = (ym: string) => {
    let bucket = trendMap.get(ym);
    if (!bucket) {
      bucket = { totalIncome: 0, totalExpense: 0 };
      trendMap.set(ym, bucket);
    }
    return bucket;
  };

  const includeInTrend = (ym: string | null): ym is string => {
    if (!ym) return false;
    if (selectedYear !== "all") {
      return ym.slice(0, 4) === selectedYear;
    }
    return true;
  };

  for (const a of data.attendances) {
    if (!a.paid) continue;
    const ym = extractYearMonth(matchDateById.get(a.match_id));
    if (!includeInTrend(ym)) continue;
    ensureMonth(ym).totalIncome += Number(a.amount) || 0;
  }

  for (const inc of data.otherIncomes) {
    if (!isCountableOtherIncome(inc)) continue;
    const ym = extractYearMonth(inc.income_date);
    if (!includeInTrend(ym)) continue;
    ensureMonth(ym).totalIncome += Number(inc.amount) || 0;
  }

  for (const exp of data.expenses) {
    if (!isCountableExpense(exp)) continue;
    const ym = extractYearMonth(exp.expense_date);
    if (!includeInTrend(ym)) continue;
    ensureMonth(ym).totalExpense += Number(exp.amount) || 0;
  }

  const monthlyTrend: PublicMonthlyTrendItem[] = Array.from(trendMap.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((ym) => {
      const b = trendMap.get(ym)!;
      return {
        month: ym,
        label: formatMonthLabelVN(ym),
        totalIncome: b.totalIncome,
        totalExpense: b.totalExpense,
        net: b.totalIncome - b.totalExpense,
      };
    });

  const hasData =
    canonical.totalIncome !== 0 ||
    canonical.totalExpense !== 0 ||
    tournamentReserve !== 0 ||
    monthlyTrend.length > 0;

  return {
    teamName: data.settings?.team_name || "FC HĐH Gò Nổi tại TP.HCM",
    generatedAt: now.toISOString(),
    latestActivityDate,
    filter: {
      year: selectedYear,
      month: selectedMonth,
    },
    availableYears,
    availableMonths,
    summary: {
      totalMatchIncome: canonical.totalMatchIncome,
      totalOtherIncome: canonical.totalOtherIncome,
      totalIncome: canonical.totalIncome,
      totalExpense: canonical.totalExpense,
      currentBalance: canonical.currentBalance,
      categoryBreakdown: canonical.categoryBreakdown,
    },
    tournamentReserve,
    incomeSources,
    monthlyTrend,
    hasData,
  };
}
