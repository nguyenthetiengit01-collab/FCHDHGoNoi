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
  totalAttendeesCount: number;
  totalPaidCount: number;
  totalVoluntaryDonorsCount: number;
  totalVoluntaryAmount: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

/**
 * Tính toán toàn bộ bức tranh tài chính (Thu, Chi, Quỹ tồn, Nợ tiền trận)
 * Tuân thủ nguyên tắc kế toán:
 * - Tổng thu = Tiền quỹ trận thực thu (paid === 1) + Thu khác hợp lệ (không tính chuyển quỹ nội bộ)
 * - Tổng chi = Các khoản chi hợp lệ
 * - Số dư hiện tại = Tổng thu - Tổng chi
 * - Nợ tiền trận = Cầu thủ đã ra sân thực tế nhưng chưa nộp (attended === 1 && paid === 0)
 * - Đóng góp tự nguyện = Cầu thủ vắng mặt nhưng vẫn nộp quỹ (attended === 0 && paid === 1)
 */
export function calculateFinancialSummary(params: {
  attendances: MatchAttendance[];
  otherIncomes: OtherIncome[];
  expenses: ExpenseRecord[];
}): FinancialSummaryResult {
  const { attendances, otherIncomes, expenses } = params;

  // 1. Tiền trận đã thực thu (paid === 1)
  const totalMatchIncome = attendances.reduce(
    (sum, a) => sum + (a.paid ? Number(a.amount) || 0 : 0),
    0
  );

  // 2. Tiền trận chưa thu (có ra sân thực tế nhưng chưa nộp: attended === 1 && paid === 0)
  const totalUnpaidAmount = attendances.reduce(
    (sum, a) => sum + (a.attended === 1 && !a.paid ? Number(a.amount) || 0 : 0),
    0
  );

  // 3. Số lượt cầu thủ thực sự có mặt ra sân thi đấu (không nhầm với người chỉ nộp tiền)
  const totalAttendeesCount = attendances.filter((a) => a.attended === 1).length;

  // 4. Số lượt thanh toán quỹ trận đã hoàn tất
  const totalPaidCount = attendances.filter((a) => a.paid === 1).length;

  // 5. Cầu thủ vắng mặt nhưng tự nguyện đóng góp quỹ trận
  const voluntaryRecords = attendances.filter((a) => a.attended === 0 && a.paid === 1);
  const totalVoluntaryDonorsCount = voluntaryRecords.length;
  const totalVoluntaryAmount = voluntaryRecords.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0
  );

  // 6. Tiền thu từ nguồn khác (tài trợ, mạnh thường quân), loại trừ giao dịch chuyển quỹ nội bộ
  const totalOtherIncome = otherIncomes
    .filter((o) => o.fund_type !== "transfer" && o.fund_type !== "Chuyển quỹ nội bộ")
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  // 7. Tổng thu
  const totalIncome = totalMatchIncome + totalOtherIncome;

  // 8. Tổng chi, loại trừ giao dịch chuyển quỹ nội bộ
  const totalExpense = expenses
    .filter((e) => e.category !== "Chuyển quỹ nội bộ")
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // 9. Quỹ tồn hiện tại
  const currentBalance = totalIncome - totalExpense;

  // 10. Phân bổ tỷ lệ theo từng danh mục chi phí chuẩn
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
    totalAttendeesCount,
    totalPaidCount,
    totalVoluntaryDonorsCount,
    totalVoluntaryAmount,
    categoryBreakdown,
  };
}

export interface MatchStatsItem extends MatchRecord {
  collected: number;
  attendeesCount: number;
  paidCount: number;
  rsvpCount: number;
  unpaidCount: number;
  voluntaryDonorsCount: number;
  expense: number;
  net: number;
}

/**
 * Thống kê chi tiết tài chính & 3 trạng thái độc lập theo từng trận đấu:
 * - rsvpCount: Số người đăng ký trước (RSVP)
 * - attendeesCount: Số người THỰC TẾ có mặt ra sân (không bao gồm người vắng)
 * - paidCount: Số người đã nộp tiền
 * - unpaidCount: Số người ra sân nhưng chưa đóng quỹ
 * - voluntaryDonorsCount: Số người vắng mặt nhưng tự nguyện đóng góp quỹ trận
 */
export function calculateMatchStats(
  matches: MatchRecord[],
  attendances: MatchAttendance[],
  expenses: ExpenseRecord[]
): MatchStatsItem[] {
  return matches.map((m) => {
    const matchAtts = attendances.filter((a) => a.match_id === m.id);

    // Tiền trận đã thu
    const collected = matchAtts
      .filter((a) => a.paid === 1)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);

    // Người thực tế ra sân (CHUẨN HÓA: Chỉ tính a.attended === 1, KHÔNG gộp với a.paid)
    const attendeesCount = matchAtts.filter((a) => a.attended === 1).length;

    // Người đã nộp tiền
    const paidCount = matchAtts.filter((a) => a.paid === 1).length;

    // Người đăng ký tham gia trước (RSVP)
    const rsvpCount = matchAtts.filter((a) => a.rsvp_status === "registered").length;

    // Người ra sân nhưng chưa nộp quỹ
    const unpaidCount = matchAtts.filter((a) => a.attended === 1 && a.paid === 0).length;

    // Người vắng mặt nhưng tự nguyện đóng góp
    const voluntaryDonorsCount = matchAtts.filter(
      (a) => a.attended === 0 && a.paid === 1
    ).length;

    const matchExp = expenses
      .filter((e) => e.match_id === m.id)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const pitchOrExp = matchExp > 0 ? matchExp : (Number(m.pitch_cost) || 0);

    return {
      ...m,
      collected,
      attendeesCount,
      paidCount,
      rsvpCount,
      unpaidCount,
      voluntaryDonorsCount,
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
  const voluntaryRecords = playerRecords.filter(
    (a) => a.attended === 0 && a.paid === 1
  );

  const unpaidCount = unpaidRecords.length;
  const debtAmount = unpaidRecords.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0
  );
  const voluntaryCount = voluntaryRecords.length;
  const voluntaryAmount = voluntaryRecords.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0
  );

  return {
    attendedCount,
    paidCount,
    unpaidCount,
    debtAmount,
    voluntaryCount,
    voluntaryAmount,
  };
}

