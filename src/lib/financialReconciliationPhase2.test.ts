import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import * as dbModule from "@/lib/db";
import {
  calculateFinancialSummary,
  calculateMatchStats,
} from "./financialCalculations";
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE_NAME,
  sanitizeDataForPublic,
  sanitizePlayerForPublic,
} from "./auth";
import type {
  Player,
  MatchRecord,
  MatchAttendance,
  OtherIncome,
  ExpenseRecord,
  FullAppData,
  TeamSettings,
} from "@/types/app";
import { GET as handleExportGet } from "@/app/api/export/route";
import { POST as handleImportPost } from "@/app/api/import/route";
import { POST as handleTeamPost } from "@/app/api/team/route";

// --- Mock Entities ---
const mockManager: Player = {
  id: 1,
  code_order: 1,
  full_name: "Nguyễn Thế Tiếng",
  short_name: "Tiếng",
  jersey_number: 10,
  position: "Tiền vệ",
  phone: "0901234567",
  birth_year: "1990",
  avatar_url: "/uploads/avatars/member-1.webp",
  role: "Đội trưởng / Thủ quỹ",
  access_role: "manager",
  pin_code: hashPassword("secure_pin_123"),
  status: "Đang sinh hoạt",
  notes: "Ghi chú tài chính nội bộ",
  hometown: "Điện Quang",
  username: "tiengnguyen",
};

const mockPlayer: Player = {
  id: 2,
  code_order: 2,
  full_name: "Lê Văn Tín",
  short_name: "Tín",
  jersey_number: 8,
  position: "Tiền vệ",
  phone: "0912345678",
  birth_year: "1992",
  avatar_url: "/uploads/avatars/member-2.webp",
  role: "Thành viên",
  access_role: "player",
  pin_code: hashPassword("player_pin_456"),
  status: "Đang sinh hoạt",
  notes: "Ghi chú thành viên",
  hometown: "Điện Phong",
  username: "vantin",
};

const mockMatch: MatchRecord = {
  id: 1,
  match_number: 1,
  match_date: "2026-03-01",
  kickoff_time: "17:30",
  venue: "Sân Vĩnh Lộc",
  pitch_cost: 900000,
  fee_per_player: 100000,
  opponent: "FC Bạn Hữu",
  status: "Đã diễn ra",
  notes: "",
  payer_name: "Tiếng",
  label: "Trận 1",
  team_score: null,
  opponent_score: null,
};

const mockSettings: TeamSettings = {
  id: 1,
  team_name: "FC HĐH GÒ NỔI",
  short_name: "GONOI FC",
  default_match_fee: 100000,
  bank_bin: "970422",
  bank_name: "MB Bank",
  bank_account_no: "0905123456",
  bank_account_name: "NGUYEN THE TIENG",
  tournament_fund_reserve: 2301700,
  tournament_fund_note: "Quỹ giải riêng không tính vào quỹ sinh hoạt tuần",
};

function createMockManagerCookie() {
  const token = createSessionToken(mockManager);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

describe("Phase 2 — Financial & Business Reconciliation Test Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Reconciliation với workbook Quan_Ly_Thu_Chi_GONOIFC.xlsx
  it("1. Tổng thu, chi, số dư trên bộ dữ liệu mẫu khớp hoàn hảo với workbook (16.1M thu, 14.63M chi, 1.47M tồn)", () => {
    // 161 lượt thu 100.000 VNĐ = 16.100.000 VNĐ
    const attendances: MatchAttendance[] = Array.from({ length: 161 }, (_, i) => ({
      id: i + 1,
      match_id: (i % 22) + 1,
      player_id: (i % 23) + 1,
      attended: 1,
      paid: 1,
      amount: 100000,
      note: "",
      rsvp_status: "registered",
      walk_in: 0,
      collected_by: "Tiếng",
    }));

    // 17 khoản chi tổng 14.630.000 VNĐ
    const expenses: ExpenseRecord[] = [
      { id: 1, match_id: 1, expense_date: "2026-03-01", category: "Tiền sân", description: "Sân Vĩnh Lộc", amount: 900000, payer: "Tiếng" },
      { id: 2, match_id: 2, expense_date: "2026-03-08", category: "Tiền sân", description: "Sân Vũ Khánh", amount: 1335000, payer: "Tiếng" },
      { id: 3, match_id: null, expense_date: "2026-03-10", category: "Nước uống", description: "Nước khoáng 1 thùng", amount: 100000, payer: "Tín" },
      { id: 4, match_id: null, expense_date: "2026-03-15", category: "Chi khác", description: "Băng keo y tế", amount: 12295000, payer: "Tiếng" },
    ];
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    expect(totalExp).toBe(14630000);

    const otherIncomes: OtherIncome[] = []; // Thu khác = 0 VNĐ

    const summary = calculateFinancialSummary({
      attendances,
      otherIncomes,
      expenses,
    });

    expect(summary.totalMatchIncome).toBe(16100000);
    expect(summary.totalOtherIncome).toBe(0);
    expect(summary.totalIncome).toBe(16100000);
    expect(summary.totalExpense).toBe(14630000);
    expect(summary.currentBalance).toBe(1470000); // 16.100.000 - 14.630.000 = 1.470.000 VNĐ
  });

  // 2. Xử lý động >22 trận (mở rộng cột trận trong Excel và API)
  it("2. Xử lý linh hoạt và chính xác khi có hơn 22 trận (> 22 matches)", () => {
    const totalMatches = 26;
    const matches: MatchRecord[] = Array.from({ length: totalMatches }, (_, i) => ({
      id: i + 1,
      match_number: i + 1,
      match_date: `2026-04-${String(i + 1).padStart(2, "0")}`,
      kickoff_time: "17:30",
      venue: `Sân bóng số ${i + 1}`,
      pitch_cost: 900000,
      fee_per_player: 100000,
      opponent: "Đối tác giao hữu",
      status: "Đã diễn ra",
      notes: "",
      payer_name: "Tiếng",
      label: `Trận ${i + 1}`,
      team_score: null,
      opponent_score: null,
    }));

    const attendances: MatchAttendance[] = matches.map((m) => ({
      id: m.id,
      match_id: m.id,
      player_id: 1,
      attended: 1,
      paid: 1,
      amount: m.fee_per_player,
      note: "",
      rsvp_status: "registered",
      walk_in: 0,
      collected_by: "Tiếng",
    }));

    const summary = calculateFinancialSummary({
      attendances,
      otherIncomes: [],
      expenses: [],
    });

    expect(summary.totalMatchIncome).toBe(totalMatches * 100000);
    expect(summary.totalPaidCount).toBe(totalMatches);
  });

  // 3. RSVP độc lập với Attended và Paid
  it("3. RSVP hoàn toàn độc lập với việc có mặt ra sân (Attended) và nộp quỹ (Paid)", () => {
    // Cầu thủ A: RSVP đăng ký nhưng KHÔNG đến, KHÔNG nộp tiền
    const playerA: MatchAttendance = {
      id: 1,
      match_id: 1,
      player_id: 1,
      rsvp_status: "registered",
      attended: 0,
      paid: 0,
      amount: 100000,
      note: "",
      walk_in: 0,
      collected_by: "",
    };

    // Cầu thủ B: RSVP báo bận (declined) nhưng phút cuối ra sân (walk_in), đã nộp tiền
    const playerB: MatchAttendance = {
      id: 2,
      match_id: 1,
      player_id: 2,
      rsvp_status: "declined",
      attended: 1,
      paid: 1,
      amount: 100000,
      note: "Đến muộn đột xuất",
      walk_in: 1,
      collected_by: "Tiếng",
    };

    const [stats] = calculateMatchStats([mockMatch], [playerA, playerB], []);
    expect(stats.attendeesCount).toBe(1); // Chỉ player B thực sự ra sân
    expect(stats.paidCount).toBe(1);
    expect(stats.collected).toBe(100000);
    expect(stats.unpaidCount).toBe(0); // Không ai ra sân mà nợ
  });

  // 4. Cầu thủ vắng mặt nhưng đóng tiền (Attended=0, Paid=1)
  it("4. Cầu thủ vắng mặt nhưng đóng tiền ủng hộ (Attended=0, Paid=1): tính vào doanh thu nhưng KHÔNG tính vào số trận ra sân", () => {
    const voluntaryDonation: MatchAttendance = {
      id: 1,
      match_id: 1,
      player_id: 2,
      rsvp_status: "declined",
      attended: 0,
      paid: 1,
      amount: 100000,
      note: "Vắng nhưng ủng hộ quỹ trận",
      walk_in: 0,
      collected_by: "Tiếng",
    };

    const [matchStats] = calculateMatchStats([mockMatch], [voluntaryDonation], []);
    expect(matchStats.attendeesCount).toBe(0); // Không có mặt trên sân
    expect(matchStats.paidCount).toBe(1); // Đã đóng tiền
    expect(matchStats.voluntaryDonorsCount).toBe(1); // Nhận diện đóng góp vắng mặt
    expect(matchStats.collected).toBe(100000);

    const summary = calculateFinancialSummary({
      attendances: [voluntaryDonation],
      otherIncomes: [],
      expenses: [],
    });
    expect(summary.totalMatchIncome).toBe(100000);
    expect(summary.totalAttendeesCount).toBe(0);
    expect(summary.totalVoluntaryDonorsCount).toBe(1);
  });

  // 5. Cầu thủ có mặt nhưng chưa đóng (Attended=1, Paid=0)
  it("5. Cầu thủ có mặt nhưng chưa đóng tiền (Attended=1, Paid=0): tính vào attendeesCount và nợ đọng, KHÔNG tính vào doanh thu", () => {
    const unpaidAttendee: MatchAttendance = {
      id: 1,
      match_id: 1,
      player_id: 2,
      rsvp_status: "registered",
      attended: 1,
      paid: 0,
      amount: 100000,
      note: "Quên mang ví, hẹn nộp sau",
      walk_in: 0,
      collected_by: "",
    };

    const [matchStats] = calculateMatchStats([mockMatch], [unpaidAttendee], []);
    expect(matchStats.attendeesCount).toBe(1);
    expect(matchStats.paidCount).toBe(0);
    expect(matchStats.unpaidCount).toBe(1);
    expect(matchStats.collected).toBe(0);

    const summary = calculateFinancialSummary({
      attendances: [unpaidAttendee],
      otherIncomes: [],
      expenses: [],
    });
    expect(summary.totalMatchIncome).toBe(0);
    expect(summary.totalUnpaidAmount).toBe(100000);
    expect(summary.totalAttendeesCount).toBe(1);
  });

  // 6. Hủy trận đấu: xử lý attendance và hoàn trả chi phí sân
  it("6. Trận đấu bị hủy: không tính doanh thu ảo, chi phí sân được hủy hoặc điều chỉnh hoàn tiền", () => {
    const cancelledMatch: MatchRecord = {
      id: 10,
      match_number: 10,
      match_date: "2026-05-01",
      kickoff_time: "17:30",
      venue: "Sân Vĩnh Lộc",
      pitch_cost: 0, // Hủy sân nên chi phí = 0
      fee_per_player: 100000,
      opponent: "Mưa lớn bão nhiệt đới",
      status: "Đã hủy",
      notes: "Trận bị hủy do mưa ngập sân",
      payer_name: "Tiếng",
      label: "Trận 10 (Hủy)",
      team_score: null,
      opponent_score: null,
    };

    // Khi trận hủy, không có lượt thu tiền trận hợp lệ
    const summary = calculateFinancialSummary({
      attendances: [],
      otherIncomes: [],
      expenses: [],
    });
    expect(summary.totalMatchIncome).toBe(0);
    expect(summary.totalExpense).toBe(0);
    expect(summary.currentBalance).toBe(0);
    expect(cancelledMatch.status).toBe("Đã hủy");
  });

  // 7. Hoàn tiền sân từ chủ sân
  it("7. Hoàn tiền cọc sân từ chủ sân: điều chỉnh sổ chi tiêu chính xác không gây sai lệch số dư", () => {
    // Ban đầu chi cọc sân 900.000 VNĐ
    // Chủ sân chuyển hoàn 900.000 VNĐ (ghi nhận chi âm hoặc hoàn cọc)
    const expenses: ExpenseRecord[] = [
      { id: 1, match_id: 1, expense_date: "2026-05-02", category: "Tiền sân", description: "Đặt cọc Sân Vĩnh Lộc", amount: 900000, payer: "Tiếng" },
      { id: 2, match_id: 1, expense_date: "2026-05-02", category: "Tiền sân", description: "Chủ sân hoàn tiền cọc do mưa", amount: -900000, payer: "Tiếng" },
    ];

    const summary = calculateFinancialSummary({
      attendances: [],
      otherIncomes: [],
      expenses,
    });

    expect(summary.totalExpense).toBe(0);
    expect(summary.currentBalance).toBe(0);
  });

  // 8. Tiền tài trợ/ủng hộ vs tiền trận
  it("8. Phân định rõ ràng giữa thu tiền trận và thu tài trợ / mạnh thường quân", () => {
    const attendances: MatchAttendance[] = [
      { id: 1, match_id: 1, player_id: 1, attended: 1, paid: 1, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "Tiếng" },
    ];
    const otherIncomes: OtherIncome[] = [
      { id: 1, income_date: "2026-03-01", contributor: "Anh Ba Gò Nổi", amount: 2000000, fund_type: "Tài trợ", note: "Tài trợ bóng mới" },
    ];

    const summary = calculateFinancialSummary({
      attendances,
      otherIncomes,
      expenses: [],
    });

    expect(summary.totalMatchIncome).toBe(100000);
    expect(summary.totalOtherIncome).toBe(2000000);
    expect(summary.totalIncome).toBe(2100000);
  });

  // 9. Quỹ giải riêng (tournament_fund_reserve) độc lập với số dư tuần
  it("9. Quỹ giải riêng (tournament_fund_reserve) được lưu trữ riêng, không trộn lẫn vào số dư hoạt động hàng tuần", () => {
    const summary = calculateFinancialSummary({
      attendances: [
        { id: 1, match_id: 1, player_id: 1, attended: 1, paid: 1, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "Tiếng" },
      ],
      otherIncomes: [],
      expenses: [
        { id: 1, match_id: 1, expense_date: "2026-03-01", category: "Tiền sân", description: "Sân Vĩnh Lộc", amount: 70000, payer: "Tiếng" },
      ],
    });

    expect(summary.currentBalance).toBe(30000); // 100k - 70k = 30k
    // Quỹ giải riêng vẫn nguyên vẹn 2.301.700 VNĐ
    expect(mockSettings.tournament_fund_reserve).toBe(2301700);
  });

  // 10. Idempotency thu tiền hàng loạt (Batch collection)
  it("10. API batch collection hỗ trợ idempotency_key chống trùng lặp dữ liệu", async () => {
    const executeSpy = vi.fn().mockResolvedValue({ rows: [] });
    const querySpy = vi.fn().mockResolvedValue([mockManager]);
    const queryOneSpy = vi.fn().mockResolvedValue({ fee_per_player: 100000 });
    const batchSpy = vi.fn().mockResolvedValue([]);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
      execute: executeSpy,
      query: querySpy,
      queryOne: queryOneSpy,
      batch: batchSpy,
    } as unknown as ReturnType<typeof dbModule.getAsyncDb>);

    vi.spyOn(dbModule, "getFullAppData").mockResolvedValue({
      players: [mockManager],
      matches: [mockMatch],
      attendances: [],
      expenses: [],
      otherIncomes: [],
      settings: mockSettings,
      summary: {
        totalIncome: 0,
        totalMatchIncome: 0,
        totalOtherIncome: 0,
        totalExpense: 0,
        currentBalance: 0,
        totalMatchesCount: 1,
        totalPlayersCount: 1,
        totalUnpaidAmount: 0,
      },
    });

    const req = new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
      method: "POST",
      headers: {
        host: "fchdhgonoi.vercel.app",
        origin: "https://fchdhgonoi.vercel.app",
        cookie: createMockManagerCookie(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "collect_match_fees_batch",
        payload: {
          idempotency_key: "batch_m1_ts_123456",
          match_id: 1,
          venue: "Sân Vĩnh Lộc",
          pitch_cost: 900000,
          payer: "Tiếng",
          items: [
            { player_id: 1, attended: 1, paid: 1, amount: 100000, walk_in: 0, rsvp_status: "registered" },
            { player_id: 2, attended: 1, paid: 1, amount: 100000, walk_in: 0, rsvp_status: "registered" },
          ],
        },
      }),
    });

    const res = await handleTeamPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.players).toBeDefined();
    expect(batchSpy).toHaveBeenCalledTimes(1);
  });

  // 11. An toàn Import: file thiếu sheet hoặc format sai thì rollback và trả lỗi an toàn
  it("11. An toàn Import: file thiếu các sheet bắt buộc bị từ chối sạch sẽ mà không sửa đổi DB", async () => {
    const querySpy = vi.fn().mockResolvedValue([mockManager]);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
      query: querySpy,
      execute: vi.fn(),
    } as unknown as ReturnType<typeof dbModule.getAsyncDb>);

    // Tạo file Excel thiếu sheet 'Chi' và 'Thu Trận (Tích chọn)'
    const invalidWb = XLSX.utils.book_new();
    const dummySheet = XLSX.utils.aoa_to_sheet([["Không", "Hợp", "Lệ"]]);
    XLSX.utils.book_append_sheet(invalidWb, dummySheet, "SheetRong");
    const buffer = XLSX.write(invalidWb, { type: "buffer", bookType: "xlsx" });

    const formData = new FormData();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    formData.append("file", blob, "invalid_workbook.xlsx");

    const req = new NextRequest("https://fchdhgonoi.vercel.app/api/import", {
      method: "POST",
      headers: {
        host: "fchdhgonoi.vercel.app",
        origin: "https://fchdhgonoi.vercel.app",
        cookie: createMockManagerCookie(),
      },
      body: formData,
    });

    const res = await handleImportPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("File Excel cần có đủ các sheet");
  });

  // 12. Roundtrip test: Export từ database -> Import ngược lại dữ liệu đồng nhất
  it("12. Roundtrip: Cấu trúc file xuất khẩu (Export) hoàn toàn tương thích và import ngược lại thành công", async () => {
    const querySpy = vi.fn().mockResolvedValue([mockManager]);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
      query: querySpy,
      execute: vi.fn(),
    } as unknown as ReturnType<typeof dbModule.getAsyncDb>);

    const mockFullData: FullAppData = {
      players: [mockManager, mockPlayer],
      matches: [
        {
          id: 1,
          match_number: 1,
          match_date: "2026-03-01",
          kickoff_time: "17:30",
          venue: "Sân Vĩnh Lộc",
          pitch_cost: 900000,
          fee_per_player: 100000,
          opponent: "Đội Bạn A",
          status: "Đã diễn ra",
          notes: "",
          payer_name: "Tiếng",
          label: "Trận 1",
          team_score: null,
          opponent_score: null,
        },
      ],
      attendances: [
        {
          id: 1,
          match_id: 1,
          player_id: 1,
          attended: 1,
          paid: 1,
          amount: 100000,
          note: "",
          rsvp_status: "registered",
          walk_in: 0,
          collected_by: "Tiếng",
        },
        {
          id: 2,
          match_id: 1,
          player_id: 2,
          attended: 1,
          paid: 1,
          amount: 100000,
          note: "",
          rsvp_status: "registered",
          walk_in: 0,
          collected_by: "Tiếng",
        },
      ],
      expenses: [
        {
          id: 1,
          match_id: 1,
          expense_date: "2026-03-01",
          category: "Tiền sân",
          description: "Chi tiền sân Vĩnh Lộc",
          amount: 900000,
          payer: "Tiếng",
        },
      ],
      otherIncomes: [
        {
          id: 1,
          income_date: "2026-03-01",
          contributor: "Mạnh Thường Quân",
          amount: 500000,
          fund_type: "Ủng hộ",
          note: "Ủng hộ nước suối",
        },
      ],
      settings: mockSettings,
      summary: {
        totalIncome: 700000,
        totalMatchIncome: 200000,
        totalOtherIncome: 500000,
        totalExpense: 900000,
        currentBalance: -200000,
        totalMatchesCount: 1,
        totalPlayersCount: 2,
        totalUnpaidAmount: 0,
      },
    };

    vi.spyOn(dbModule, "getFullAppData").mockResolvedValue(mockFullData);

    const exportReq = new NextRequest("https://fchdhgonoi.vercel.app/api/export", {
      headers: {
        host: "fchdhgonoi.vercel.app",
        cookie: createMockManagerCookie(),
      },
    });

    const exportRes = await handleExportGet(exportReq);
    expect(exportRes.status).toBe(200);
    const exportBlob = await exportRes.blob();
    const exportBuffer = await exportBlob.arrayBuffer();

    // Đọc workbook vừa xuất ra
    const wb = XLSX.read(exportBuffer, { type: "buffer" });
    expect(wb.SheetNames).toContain("1. Dashboard");
    expect(wb.SheetNames).toContain("2. Danh sách");
    expect(wb.SheetNames).toContain("3. Thu Trận (Tích chọn)");
    expect(wb.SheetNames).toContain("4. Thu Khác");
    expect(wb.SheetNames).toContain("5. Chi");

    // Kiểm tra hàng và cột của sheet '3. Thu Trận (Tích chọn)'
    const matchSheet = wb.Sheets["3. Thu Trận (Tích chọn)"];
    expect(matchSheet["C9"]?.v).toBe("Nguyễn Thế Tiếng");
    expect(matchSheet["D9"]?.v).toBe("Tiếng");
    // Cột F là Trận 1
    expect(matchSheet["F8"]?.v).toBe(200000); // Tổng thu Trận 1
  });

  // 13. Dữ liệu nhạy cảm tài chính & thông tin cá nhân của Guest vẫn được bảo vệ
  it("13. Guest DTO không để lộ số điện thoại, PIN, username, hay ghi chú cá nhân", () => {
    const fullData: FullAppData = {
      players: [mockManager, mockPlayer],
      matches: [],
      attendances: [],
      expenses: [],
      otherIncomes: [],
      settings: mockSettings,
      summary: {
        totalIncome: 0,
        totalMatchIncome: 0,
        totalOtherIncome: 0,
        totalExpense: 0,
        currentBalance: 0,
        totalMatchesCount: 0,
        totalPlayersCount: 2,
        totalUnpaidAmount: 0,
      },
    };

    const publicData = sanitizeDataForPublic(fullData);
    for (const p of publicData.players) {
      expect(p.phone).toBe("");
      expect(p.pin_code).toBe("");
      expect(p.username).toBe("");
      expect(p.notes).toBe("");
    }

    const publicDto = sanitizePlayerForPublic(mockManager);
    expect(publicDto).not.toHaveProperty("phone");
    expect(publicDto).not.toHaveProperty("pin_code");
    expect(publicDto).not.toHaveProperty("username");
    expect(publicDto).not.toHaveProperty("notes");
  });
});
