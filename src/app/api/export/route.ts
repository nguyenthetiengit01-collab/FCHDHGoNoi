import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getFullAppData } from "@/lib/db";

export async function GET() {
  try {
    const data = getFullAppData();
    const wb = XLSX.utils.book_new();

    // 1. Sheet Dashboard
    const dashboardRows = [
      ["QUẢN LÝ TÀI CHÍNH ĐỘI BÓNG HĐH GÒ NỔI"],
      ["Báo cáo tự động thông minh - Xuất từ ứng dụng GONOI FC"],
      [],
      ["TỔNG THU QUỸ ĐỘI", "TỔNG CHI TIÊU", "TỒN QUỸ HIỆN TẠI", "QUỸ GIẢI RIÊNG"],
      [
        data.summary.totalIncome,
        data.summary.totalExpense,
        data.summary.currentBalance,
        data.settings.tournament_fund_reserve,
      ],
      [],
      ["BẢNG PHÂN BỔ HẠNG MỤC CHI", "Số Tiền (VND)", "Tỷ trọng (%)"],
      ...data.summary.categoryBreakdown.map((c) => [
        c.category,
        c.amount,
        `${c.percentage}%`,
      ]),
    ];
    const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardRows);
    XLSX.utils.book_append_sheet(wb, wsDashboard, "1. Dashboard");

    // 2. Sheet Danh sách
    const playerRows = [
      ["DANH SÁCH THÀNH VIÊN ĐỘI BÓNG HĐH GÒ NỔI"],
      [],
      ["STT", "Họ và Tên", "Tên Gọi", "Vị Trí", "Số Áo", "Vai Trò", "SĐT", "Trạng Thái", "Ghi Chú"],
      ...data.players.map((p, idx) => [
        idx + 1,
        p.full_name,
        p.short_name,
        p.position,
        p.jersey_number ?? "",
        p.role,
        p.phone,
        p.status,
        p.notes,
      ]),
    ];
    const wsPlayers = XLSX.utils.aoa_to_sheet(playerRows);
    XLSX.utils.book_append_sheet(wb, wsPlayers, "2. Danh sách");

    // 3. Sheet Thu Trận (Tích chọn)
    const matchHeaders = data.matches.map((m) => m.label);
    const matchFees = data.matches.map((m) => m.fee_per_player);
    const matchTotals = data.matches.map((m) =>
      data.attendances
        .filter((a) => a.match_id === m.id && a.paid === 1)
        .reduce((s, a) => s + a.amount, 0)
    );

    const thuTranRows: Array<Array<string | number>> = [
      ["THEO DÕI THU TIỀN TRẬN HẰNG TUẦN"],
      [],
      ["", "Ngày/Tháng:", "", "", ...matchHeaders],
      ["", "Số tiền/Trận:", "", "", ...matchFees],
      ["STT", "Họ và Tên", "Tên", "Tổng Đã Nộp", ...data.matches.map(() => "Tích chọn")],
      ["", "TỔNG TIỀN THU ĐƯỢC:", "", data.summary.totalMatchIncome, ...matchTotals],
    ];

    data.players.forEach((p, idx) => {
      const playerPaidTotal = data.attendances
        .filter((a) => a.player_id === p.id && a.paid === 1)
        .reduce((s, a) => s + a.amount, 0);

      const flags = data.matches.map((m) => {
        const rec = data.attendances.find(
          (a) => a.match_id === m.id && a.player_id === p.id
        );
        return rec?.paid ? 1 : 0;
      });

      thuTranRows.push([
        idx + 1,
        p.full_name,
        p.short_name,
        playerPaidTotal,
        ...flags,
      ]);
    });

    const wsThuTran = XLSX.utils.aoa_to_sheet(thuTranRows);
    XLSX.utils.book_append_sheet(wb, wsThuTran, "3. Thu Trận (Tích chọn)");

    // 4. Sheet Thu Khác
    const thuKhacRows = [
      ["CÁC KHOẢN THU NGOÀI & TÀI TRỢ"],
      [],
      ["STT", "Ngày", "Người Ủng Hộ / Nguồn Thu", "Số Tiền (VND)", "Loại Quỹ", "Ghi Chú / Mục Đích"],
      ["", "", "TỔNG THU KHÁC:", data.summary.totalOtherIncome, "", ""],
      ...data.otherIncomes.map((o, idx) => [
        idx + 1,
        o.income_date,
        o.contributor,
        o.amount,
        o.fund_type,
        o.note,
      ]),
    ];
    const wsThuKhac = XLSX.utils.aoa_to_sheet(thuKhacRows);
    XLSX.utils.book_append_sheet(wb, wsThuKhac, "4. Thu Khác");

    // 5. Sheet Chi
    const chiRows = [
      ["SỔ CHI TIÊU QUỸ ĐỘI BÓNG"],
      [],
      ["STT", "Ngày", "Hạng Mục Luỹ Kế", "Nội Dung Chi Tiết", "Số Tiền (VND)", "Người Chi / Xác Nhận"],
      ["", "", "", "TỔNG CHI TIÊU:", data.summary.totalExpense, ""],
      ...data.expenses.map((e, idx) => [
        idx + 1,
        e.expense_date,
        e.category,
        e.description,
        e.amount,
        e.payer,
      ]),
    ];
    const wsChi = XLSX.utils.aoa_to_sheet(chiRows);
    XLSX.utils.book_append_sheet(wb, wsChi, "5. Chi");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="Quan_Ly_Thu_Chi_GONOIFC_Updated.xlsx"',
      },
    });
  } catch (error) {
    console.error("GET /api/export error:", error);
    return NextResponse.json(
      { error: "Không thể xuất file Excel" },
      { status: 500 }
    );
  }
}

