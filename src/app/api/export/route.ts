import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getFullAppData } from "@/lib/db";
import { requireManagerSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireManagerSession(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || "Thao tác yêu cầu quyền Ban Quản Lý (Manager)" },
        {
          status: auth.status,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    const data = await getFullAppData();
    const wb = XLSX.utils.book_new();

    // 1. Sheet Dashboard (Đồng bộ cấu trúc chuẩn với Quan_Ly_Thu_Chi_GONOIFC.xlsx)
    const dashboardRows: unknown[][] = [
      ["", "QUẢN LÝ TÀI CHÍNH ĐỘI BÓNG HĐH GÒ NỔI"],
      ["", "Báo cáo tự động thông minh - Xuất từ ứng dụng GONOI FC"],
      [],
      [],
      ["", "TỔNG THU QUỸ ĐỘI", "", "", "", "TỔNG CHI TIÊU", "", "", "", "TỒN QUỸ HIỆN TẠI", "", "", "", "QUỸ GIẢI RIÊNG"],
      [
        "",
        { t: "n", v: data.summary.totalIncome, f: "'3. Thu Trận (Tích chọn)'!E8 + '4. Thu Khác'!E5" },
        "",
        "",
        "",
        { t: "n", v: data.summary.totalExpense, f: "'5. Chi'!F5" },
        "",
        "",
        "",
        { t: "n", v: data.summary.currentBalance, f: "B6-F6" },
        "",
        "",
        "",
        data.settings.tournament_fund_reserve,
      ],
      [],
      [],
      [],
      ["", "BẢNG PHÂN BỔ HẠNG MỤC CHI"],
      ["", "Hạng Mục Chi", "Số Tiền (VND)", "Tỷ trọng (%)"],
      ...(data.summary.categoryBreakdown || []).map((c) => [
        "",
        c.category,
        c.amount,
        `${c.percentage}%`,
      ]),
    ];
    const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardRows);
    XLSX.utils.book_append_sheet(wb, wsDashboard, "1. Dashboard");

    // 2. Sheet Danh sách (Đồng bộ cấu trúc chuẩn B:STT, C:Họ và Tên, D:Vị Trí, E:Số Áo, F:SĐT, G:Ghi Chú)
    const playerRows: unknown[][] = [
      ["Phn"],
      ["", "DANH SÁCH THÀNH VIÊN ĐỘI BÓNG"],
      [],
      ["", "STT", "Họ và Tên", "Vị Trí", "Số Áo", "SĐT", "Ghi Chú"],
      ...data.players.map((p, idx) => [
        "",
        idx + 1,
        p.full_name,
        p.position,
        p.jersey_number ?? "",
        p.phone,
        p.notes,
      ]),
    ];
    const wsPlayers = XLSX.utils.aoa_to_sheet(playerRows);
    XLSX.utils.book_append_sheet(wb, wsPlayers, "2. Danh sách");

    // 3. Sheet Thu Trận (Tích chọn) (Hỗ trợ động N trận đấu, tương thích 100% công thức Excel)
    const matchCount = data.matches.length;
    const lastColIndex = 5 + matchCount - 1;
    const lastColLetter = XLSX.utils.encode_col(lastColIndex);
    const lastPlayerExcelRow = 8 + data.players.length;

    const matchHeaders = data.matches.map((m) => m.label);
    const matchFees = data.matches.map((m) => m.fee_per_player);
    const matchTotals = data.matches.map((m) =>
      data.attendances
        .filter((a) => a.match_id === m.id && a.paid === 1)
        .reduce((s, a) => s + a.amount, 0)
    );

    const thuTranRows: unknown[][] = [
      ["", "THEO DÕI THU TIỀN TRẬN HẰNG TUẦN"],
      ["", "Cố định dòng Tổng cộng ở trên đầu để dễ theo dõi khi thêm thành viên phía dưới."],
      [],
      [],
      ["", "", "Ngày/Tháng:", "", "", ...matchHeaders],
      ["", "", "Số tiền/Trận:", "", "", ...matchFees],
      ["", "STT", "Họ và Tên", "Tên", "Tổng Đã Nộp", ...data.matches.map(() => "Tích chọn")],
      [
        "",
        "TỔNG TIỀN THU ĐƯỢC:",
        "",
        "",
        {
          t: "n",
          v: data.summary.totalMatchIncome,
          f: `SUM(E9:E${Math.max(9, lastPlayerExcelRow)})`,
        },
        ...data.matches.map((m, mIdx) => {
          const colLet = XLSX.utils.encode_col(5 + mIdx);
          return {
            t: "n",
            v: matchTotals[mIdx],
            f: `COUNTIF(${colLet}9:${colLet}${Math.max(9, lastPlayerExcelRow)}, "x")*${colLet}$6 + COUNTIF(${colLet}9:${colLet}${Math.max(9, lastPlayerExcelRow)}, TRUE)*${colLet}$6`,
          };
        }),
      ],
    ];

    data.players.forEach((p, idx) => {
      const playerPaidTotal = data.attendances
        .filter((a) => a.player_id === p.id && a.paid === 1)
        .reduce((s, a) => s + a.amount, 0);

      const flags = data.matches.map((m) => {
        const rec = data.attendances.find(
          (a) => a.match_id === m.id && a.player_id === p.id
        );
        return rec?.paid === 1 ? true : false;
      });

      const excelRow = 9 + idx;
      // Khắc phục triệt để lỗi bỏ sót cột Z:AA trong workbook cũ bằng dải động F..lastCol
      const dynamicSumFormula = `IF(C${excelRow}="","",SUMIF(F${excelRow}:${lastColLetter}${excelRow}, "x", F$6:${lastColLetter}$6) + SUMIF(F${excelRow}:${lastColLetter}${excelRow}, TRUE, F$6:${lastColLetter}$6))`;

      thuTranRows.push([
        "",
        idx + 1,
        p.full_name,
        p.short_name,
        { t: "n", v: playerPaidTotal, f: dynamicSumFormula },
        ...flags,
      ]);
    });

    const wsThuTran = XLSX.utils.aoa_to_sheet(thuTranRows);
    XLSX.utils.book_append_sheet(wb, wsThuTran, "3. Thu Trận (Tích chọn)");

    // 4. Sheet Thu Khác
    const thuKhacRows: unknown[][] = [
      [],
      ["", "CÁC KHOẢN THU NGOÀI & TÀI TRỢ"],
      [],
      ["", "STT", "Ngày", "Người Ủng Hộ / Nguồn Thu", "Số Tiền (VND)", "Ghi Chú / Mục Đích"],
      [
        "",
        "",
        "",
        "TỔNG THU KHÁC:",
        { t: "n", v: data.summary.totalOtherIncome, f: `SUM(E6:E${Math.max(6, 5 + data.otherIncomes.length)})` },
        "",
      ],
      ...data.otherIncomes.map((o, idx) => [
        "",
        idx + 1,
        o.income_date,
        o.contributor,
        o.amount,
        o.note,
      ]),
    ];
    const wsThuKhac = XLSX.utils.aoa_to_sheet(thuKhacRows);
    XLSX.utils.book_append_sheet(wb, wsThuKhac, "4. Thu Khác");

    // 5. Sheet Chi
    const chiRows: unknown[][] = [
      [],
      ["", "SỔ CHI TIÊU QUỸ ĐỘI BÓNG"],
      [],
      ["", "STT", "Ngày", "Hạng Mục Luỹ Kế", "Nội Dung Chi Tiết", "Số Tiền (VND)", "Người Chi / Xác Nhận"],
      [
        "",
        "",
        "",
        "",
        "TỔNG CHI TIÊU:",
        { t: "n", v: data.summary.totalExpense, f: `SUM(F6:F${Math.max(6, 5 + data.expenses.length)})` },
        "",
      ],
      ...data.expenses.map((e, idx) => [
        "",
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
        "Cache-Control": "no-store, no-cache, must-revalidate",
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

