import type { FullAppData } from "@/types/app";
import { formatDateVN, formatVND } from "./format";

export interface CashflowPoint {
  key: string;
  label: string;
  fullLabel: string;
  actualIncome: number;
  expense: number;
  unpaidDebt: number;
  net: number;
  attendeesCount?: number;
  paidCount?: number;
}

export interface CollectionIntelligence {
  totalAttendanceTurns: number;
  paidAttendedTurns: number;
  unpaidAttendedTurns: number;
  voluntaryTurns: number;
  totalPaidTurns: number;
  totalUnpaidAmount: number;
  totalVoluntaryAmount: number;
  topDebtors: Array<{
    playerId: number;
    fullName: string;
    shortName: string;
    jerseyNumber: number | null;
    unpaidAmount: number;
    unpaidMatchesCount: number;
  }>;
}

export interface RecentTransactionItem {
  id: string;
  date: string;
  type: "match_income" | "other_income" | "expense";
  category: string;
  title: string;
  actor: string;
  amount: number;
  isPositive: boolean;
}

export interface EnrichedMatchStat {
  id: number;
  match_number: number;
  label: string;
  match_date: string;
  kickoff_time: string;
  venue: string;
  status: string;
  pitch_cost: number;
  payer_name: string;
  fee_per_player: number;
  registeredCount: number;
  attendeesCount: number;
  paidCount: number;
  unpaidCount: number;
  collected: number;
  unpaidAmount: number;
  expense: number;
  pitchExpense: number;
  net: number;
}

export interface MatchAnalytics {
  latestMatch: EnrichedMatchStat | null;
  upcomingMatch: EnrichedMatchStat | null;
  recentMatches: EnrichedMatchStat[];
  missingPitchCostCount: number;
}

export interface ManagementInsight {
  id: string;
  severity: "warning" | "info" | "success";
  title: string;
  description: string;
  targetTab: "schedule" | "matrix" | "finance" | "collection";
  actionLabel: string;
}

export function getTodayVNDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatMonthLabelVN(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  if (!year || !month) return monthKey;
  return `T${month}/${year}`;
}

export function isCountableOtherIncome(
  inc: FullAppData["otherIncomes"][number]
): boolean {
  return (
    inc.fund_type !== "transfer" &&
    inc.fund_type !== "Chuyển quỹ nội bộ"
  );
}

export function isCountableExpense(
  exp: FullAppData["expenses"][number]
): boolean {
  return exp.category !== "Chuyển quỹ nội bộ";
}

export function buildEnrichedMatches(data: FullAppData): EnrichedMatchStat[] {
  const { matches, attendances, expenses } = data;
  return matches.map((m) => {
    const matchAtts = attendances.filter((a) => a.match_id === m.id);
    const collected = matchAtts
      .filter((a) => a.paid === 1)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const unpaidAmount = matchAtts
      .filter((a) => a.attended === 1 && a.paid === 0)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const registeredCount = matchAtts.filter(
      (a) => a.rsvp_status === "registered"
    ).length;
    const attendeesCount = matchAtts.filter((a) => a.attended === 1).length;
    const paidCount = matchAtts.filter((a) => a.paid === 1).length;
    const unpaidCount = matchAtts.filter(
      (a) => a.attended === 1 && a.paid === 0
    ).length;
    const countableMatchExpenses = expenses.filter(
      (e) => e.match_id === m.id && isCountableExpense(e)
    );
    const pitchExpenseRecords = countableMatchExpenses.filter(
      (e) => e.category === "Tiền sân"
    );
    const hasPitchExpenseRecord = pitchExpenseRecords.length > 0;
    const matchPitchExp = pitchExpenseRecords.reduce(
      (s, e) => s + (Number(e.amount) || 0),
      0
    );
    const pitchExpense = hasPitchExpenseRecord
      ? matchPitchExp
      : Number(m.pitch_cost) || 0;
    const otherMatchExpense = countableMatchExpenses
      .filter((e) => e.category !== "Tiền sân")
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expense = pitchExpense + otherMatchExpense;

    return {
      id: m.id,
      match_number: m.match_number,
      label: m.label,
      match_date: m.match_date,
      kickoff_time: m.kickoff_time,
      venue: m.venue,
      status: m.status,
      pitch_cost: m.pitch_cost,
      payer_name: m.payer_name,
      fee_per_player: m.fee_per_player,
      registeredCount,
      attendeesCount,
      paidCount,
      unpaidCount,
      collected,
      unpaidAmount,
      expense,
      pitchExpense,
      net: collected - expense,
    };
  });
}

export function buildCashflowSeries(
  data: FullAppData,
  mode: "match" | "month",
  limit?: number
): { points: CashflowPoint[]; hasEnoughTrendData: boolean } {
  const enriched = buildEnrichedMatches(data);

  if (mode === "match") {
    const sliced =
      typeof limit === "number" && limit > 0 ? enriched.slice(-limit) : enriched;
    const points: CashflowPoint[] = sliced.map((m) => ({
      key: `match-${m.id}`,
      label: `T${m.match_number}`,
      fullLabel: `${m.label} • ${formatDateVN(m.match_date)} (${m.venue || "Chưa rõ sân"})`,
      actualIncome: m.collected,
      expense: m.expense,
      unpaidDebt: m.unpaidAmount,
      net: m.net,
      attendeesCount: m.attendeesCount,
      paidCount: m.paidCount,
    }));
    return { points, hasEnoughTrendData: points.length >= 2 };
  }

  // Monthly aggregation in chronological order
  const byMonth = new Map<
    string,
    { actualIncome: number; expense: number; unpaidDebt: number }
  >();
  const ensureMonth = (monthKey: string) => {
    let bucket = byMonth.get(monthKey);
    if (!bucket) {
      bucket = { actualIncome: 0, expense: 0, unpaidDebt: 0 };
      byMonth.set(monthKey, bucket);
    }
    return bucket;
  };

  const matchDateById = new Map(
    data.matches.map((m) => [m.id, m.match_date || ""])
  );

  for (const a of data.attendances) {
    const mDate = matchDateById.get(a.match_id) || "";
    const monthKey = mDate.slice(0, 7);
    if (!monthKey) continue;
    const bucket = ensureMonth(monthKey);
    if (a.paid === 1) {
      bucket.actualIncome += Number(a.amount) || 0;
    } else if (a.attended === 1 && a.paid === 0) {
      bucket.unpaidDebt += Number(a.amount) || 0;
    }
  }

  for (const inc of data.otherIncomes) {
    if (!isCountableOtherIncome(inc)) {
      continue;
    }
    const amount = Number(inc.amount) || 0;
    if (amount === 0) continue;
    const monthKey = (inc.income_date || "").slice(0, 7);
    if (!monthKey) continue;
    ensureMonth(monthKey).actualIncome += amount;
  }

  for (const exp of data.expenses) {
    if (!isCountableExpense(exp)) {
      continue;
    }
    const amount = Number(exp.amount) || 0;
    if (amount === 0) continue;
    const monthKey = (exp.expense_date || "").slice(0, 7);
    if (!monthKey) continue;
    ensureMonth(monthKey).expense += amount;
  }

  const sortedKeys = Array.from(byMonth.keys()).sort();
  const slicedKeys =
    typeof limit === "number" && limit > 0
      ? sortedKeys.slice(-limit)
      : sortedKeys;

  const points: CashflowPoint[] = slicedKeys.map((monthKey) => {
    const b = byMonth.get(monthKey)!;
    const label = formatMonthLabelVN(monthKey);
    return {
      key: `month-${monthKey}`,
      label,
      fullLabel: `Tháng ${label}`,
      actualIncome: b.actualIncome,
      expense: b.expense,
      unpaidDebt: b.unpaidDebt,
      net: b.actualIncome - b.expense,
    };
  });

  return { points, hasEnoughTrendData: points.length >= 2 };
}

export function buildCollectionIntelligence(
  data: FullAppData
): CollectionIntelligence {
  const { attendances, players, summary } = data;
  const totalAttendanceTurns = attendances.filter((a) => a.attended === 1).length;
  const paidAttendedTurns = attendances.filter(
    (a) => a.attended === 1 && a.paid === 1
  ).length;
  const unpaidAttendedTurns = attendances.filter(
    (a) => a.attended === 1 && a.paid === 0
  ).length;
  const voluntaryTurns = attendances.filter(
    (a) => a.attended === 0 && a.paid === 1
  ).length;
  const totalPaidTurns = paidAttendedTurns + voluntaryTurns;
  const totalVoluntaryAmount = attendances
    .filter((a) => a.attended === 0 && a.paid === 1)
    .reduce((s, a) => s + (Number(a.amount) || 0), 0);

  const debtByPlayer = new Map<
    number,
    { unpaidAmount: number; unpaidMatchesCount: number }
  >();
  for (const a of attendances) {
    if (a.attended === 1 && a.paid === 0) {
      const cur = debtByPlayer.get(a.player_id) ?? {
        unpaidAmount: 0,
        unpaidMatchesCount: 0,
      };
      cur.unpaidAmount += Number(a.amount) || 0;
      cur.unpaidMatchesCount += 1;
      debtByPlayer.set(a.player_id, cur);
    }
  }

  const topDebtors = players
    .map((p) => {
      const d = debtByPlayer.get(p.id);
      if (!d || d.unpaidAmount <= 0) return null;
      return {
        playerId: p.id,
        fullName: p.full_name,
        shortName: p.short_name,
        jerseyNumber: p.jersey_number,
        unpaidAmount: d.unpaidAmount,
        unpaidMatchesCount: d.unpaidMatchesCount,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort(
      (a, b) =>
        b.unpaidAmount - a.unpaidAmount ||
        b.unpaidMatchesCount - a.unpaidMatchesCount
    );

  return {
    totalAttendanceTurns,
    paidAttendedTurns,
    unpaidAttendedTurns,
    voluntaryTurns,
    totalPaidTurns,
    totalUnpaidAmount: summary.totalUnpaidAmount,
    totalVoluntaryAmount,
    topDebtors,
  };
}

export function buildRecentTransactions(
  data: FullAppData,
  limit = 8
): RecentTransactionItem[] {
  const items: RecentTransactionItem[] = [];

  for (const exp of data.expenses) {
    if (!isCountableExpense(exp)) {
      continue;
    }
    const rawAmount = Number(exp.amount) || 0;
    if (rawAmount === 0) {
      continue;
    }
    items.push({
      id: `exp-${exp.id}`,
      date: exp.expense_date,
      type: "expense",
      category: exp.category,
      title: exp.description,
      actor: exp.payer || "Ban Quản Lý",
      amount: Math.abs(rawAmount),
      isPositive: rawAmount < 0,
    });
  }

  for (const inc of data.otherIncomes) {
    if (!isCountableOtherIncome(inc)) {
      continue;
    }
    const rawAmount = Number(inc.amount) || 0;
    if (rawAmount === 0) {
      continue;
    }
    items.push({
      id: `inc-${inc.id}`,
      date: inc.income_date,
      type: "other_income",
      category: inc.fund_type || "Thu khác",
      title: inc.note || "Đóng góp / Tài trợ quỹ đội",
      actor: inc.contributor,
      amount: Math.abs(rawAmount),
      isPositive: rawAmount > 0,
    });
  }

  const enriched = buildEnrichedMatches(data);
  for (const m of enriched) {
    if (m.collected > 0) {
      items.push({
        id: `match-inc-${m.id}`,
        date: m.match_date,
        type: "match_income",
        category: "Thu tiền trận",
        title: `Thu quỹ ${m.label} (${m.venue || "Sân đội"})`,
        actor: `${m.paidCount} lượt đã đóng`,
        amount: m.collected,
        isPositive: true,
      });
    }
  }

  return items
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, limit);
}

export function buildMatchAnalytics(
  data: FullAppData,
  now: Date = new Date()
): MatchAnalytics {
  const enriched = buildEnrichedMatches(data);
  const todayVN = getTodayVNDateString(now);

  const upcomingCandidates = enriched
    .filter(
      (m) =>
        m.status !== "Đã kết thúc" &&
        m.status !== "Đã hủy" &&
        (!m.match_date || m.match_date >= todayVN || m.status === "Sắp diễn ra")
    )
    .sort((a, b) => (a.match_date || "").localeCompare(b.match_date || ""));

  const upcomingMatch = upcomingCandidates[0] ?? null;

  const finishedCandidates = enriched.filter((m) => m.status === "Đã kết thúc");
  const latestMatch =
    finishedCandidates[finishedCandidates.length - 1] ??
    enriched[enriched.length - 1] ??
    null;

  const recentMatches = enriched.slice().reverse().slice(0, 5);

  const missingPitchCostCount = enriched.filter(
    (m) => m.status !== "Đã hủy" && m.pitchExpense <= 0
  ).length;

  return {
    latestMatch,
    upcomingMatch,
    recentMatches,
    missingPitchCostCount,
  };
}

export function buildManagementInsights(
  data: FullAppData,
  analytics: MatchAnalytics,
  collection: CollectionIntelligence,
  canManageCollection: boolean
): ManagementInsight[] {
  const insights: ManagementInsight[] = [];

  if (collection.totalUnpaidAmount > 0) {
    insights.push({
      id: "unpaid-debt",
      severity: "warning",
      title: `Còn ${formatVND(collection.totalUnpaidAmount)} tiền trận chưa thu`,
      description: `${collection.unpaidAttendedTurns} lượt cầu thủ đã ra sân nhưng đang ghi nhận chưa nộp quỹ.`,
      targetTab: canManageCollection ? "collection" : "matrix",
      actionLabel: canManageCollection ? "Thu tiền trận" : "Xem bảng thu",
    });
  }

  if (analytics.upcomingMatch && !analytics.upcomingMatch.venue?.trim()) {
    insights.push({
      id: "missing-venue",
      severity: "warning",
      title: `${analytics.upcomingMatch.label} chưa có thông tin sân`,
      description: `Trận đấu ngày ${formatDateVN(analytics.upcomingMatch.match_date)} chưa cập nhật địa điểm sân thi đấu.`,
      targetTab: "schedule",
      actionLabel: "Cập nhật lịch",
    });
  }

  if (analytics.missingPitchCostCount > 0) {
    insights.push({
      id: "missing-pitch-cost",
      severity: "warning",
      title: `${analytics.missingPitchCostCount} trận chưa có chi phí sân`,
      description:
        "Kiểm tra và bổ sung tiền sân để cân đối thu chi từng trận chính xác.",
      targetTab: "finance",
      actionLabel: "Mở sổ chi",
    });
  }

  if (
    analytics.upcomingMatch &&
    analytics.upcomingMatch.registeredCount === 0
  ) {
    insights.push({
      id: "empty-rsvp",
      severity: "info",
      title: `${analytics.upcomingMatch.label} chưa có lượt RSVP`,
      description: `Trận ngày ${formatDateVN(analytics.upcomingMatch.match_date)} hiện chưa ghi nhận cầu thủ đăng ký tham dự.`,
      targetTab: "schedule",
      actionLabel: "Điểm danh",
    });
  }

  if (data.expenses.length > 0) {
    const latestExp = data.expenses[data.expenses.length - 1];
    insights.push({
      id: "latest-expense",
      severity: "info",
      title: `Khoản chi gần đây: ${formatVND(latestExp.amount)}`,
      description: `${latestExp.description} (${latestExp.category}) • ${formatDateVN(latestExp.expense_date)}`,
      targetTab: "finance",
      actionLabel: "Xem sổ chi",
    });
  }

  return insights;
}

