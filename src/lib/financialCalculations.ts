import { EXPENSE_CATEGORIES } from "@/types/app";
import type {
  MatchAttendance,
  OtherIncome,
  ExpenseRecord,
  MatchRecord,
} from "@/types/app";

export interface FinancialSummaryResult {
  totalMatchIncome: number;
  totalOtherIncome: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  totalUnpaidAmount: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

/**
 * Tính toán toàn bộ bức tranh tài chính (Thu, Chi, Quỹ tồn, Nợ tiền trận)
 */
export function calculateFinancialSummary(params: {
  attendances: MatchAttendance[];
  otherIncomes: OtherIncome[];
  expenses: ExpenseRecord[];
}): FinancialSummaryResult {
  const { attendances, otherIncomes, expenses } = params;

  // Tiền trận đã thực thu (paid === 1)
  const totalMatchIncome = attendances.reduce(
    (sum, a) => sum + (a.paid ? Number(a.amount) || 0 : 0),
    0
  );

  // Tiền trận chưa thu (có đi đá nhưng chưa nộp: attended === 1 && paid === 0)
  const totalUnpaidAmount = attendances.reduce(
    (sum, a) => sum + (a.attended && !a.paid ? Number(a.amount) || 0 : 0),
    0
  );

  // Tiền thu từ nguồn khác (tài trợ, mạnh thường quân)
  const totalOtherIncome = otherIncomes.reduce(
    (sum, o) => sum + (Number(o.amount) || 0),
    0
  );

  // Tổng thu
  const totalIncome = totalMatchIncome + totalOtherIncome;

  // Tổng chi
  const totalExpense = expenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );

  // Quỹ tồn hiện tại
  const currentBalance = totalIncome - totalExpense;

  // Phân bổ tỷ lệ theo từng danh mục chi phí
  const categoryBreakdown = EXPENSE_CATEGORIES.map((category) => {
    const amount = expenses
      .filter((e) => e.category === category)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return {
      category,
      amount,
      percentage:
        totalExpense > 0
          ? Math.round((amount / totalExpense) * 1000) / 10
          : 0,
    };
  });

  return {
    totalMatchIncome,
    totalOtherIncome,
    totalIncome,
    totalExpense,
    currentBalance,
    totalUnpaidAmount,
    categoryBreakdown,
  };
}

/**
 * Thống kê chi tiết tài chính & quân số theo từng trận đấu
 */
export function calculateMatchStats(
  matches: MatchRecord[],
  attendances: MatchAttendance[],
  expenses: ExpenseRecord[]
) {
  return matches.map((m) => {
    const collected = attendances
      .filter((a) => a.match_id === m.id && a.paid === 1)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);

    const attendeesCount = attendances.filter(
      (a) => a.match_id === m.id && (a.attended === 1 || a.paid === 1)
    ).length;

    const matchExp = expenses
      .filter((e) => e.match_id === m.id)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const pitchOrExp = matchExp > 0 ? matchExp : (Number(m.pitch_cost) || 0);

    return {
      ...m,
      collected,
      attendeesCount,
      expense: pitchOrExp,
      net: collected - pitchOrExp,
    };
  });
}

/**
 * Tính số trận và số tiền nợ quỹ của một cầu thủ cụ thể
 */
export function calculatePlayerAttendanceDebt(
  playerId: number,
  attendances: MatchAttendance[]
) {
  const playerRecords = attendances.filter((a) => a.player_id === playerId);

  const attendedCount = playerRecords.filter((a) => a.attended === 1).length;
  const paidCount = playerRecords.filter((a) => a.paid === 1).length;
  const unpaidRecords = playerRecords.filter(
    (a) => a.attended === 1 && a.paid === 0
  );

  const unpaidCount = unpaidRecords.length;
  const debtAmount = unpaidRecords.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0
  );

  return {
    attendedCount,
    paidCount,
    unpaidCount,
    debtAmount,
  };
}
