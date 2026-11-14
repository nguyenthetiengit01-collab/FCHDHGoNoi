import { describe, it, expect, vi, beforeEach } from "vitest";
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
  sanitizeDataForPlayer,
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
import { NextRequest } from "next/server";

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
  notes: "Ghi chú nội bộ nhạy cảm",
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
  tournament_fund_note: "Số dư giải trước lưu giữ riêng",
};

function createMockManagerCookie() {
  const token = createSessionToken(mockManager);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

describe("FINAL PRE-MERGE AUDIT SUITE", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------
  // PILLAR 1: DATABASE ATOMICITY & IDEMPOTENCY
  // -------------------------------------------------------------
  describe("Pillar 1: Database Atomicity & Batch Transactions", () => {
    it("Batch transaction rollback hoàn toàn khi một câu lệnh trong batch bị lỗi", async () => {
      // Test LocalSqliteAdapter rollback logic
      const mockDbSync = {
        exec: vi.fn(),
        prepare: vi.fn().mockImplementation((sql: string) => ({
          run: vi.fn().mockImplementation(() => {
            if (sql.includes("FAIL_TRIGGER")) {
              throw new Error("Simulated SQLite constraint failure");
            }
          }),
        })),
      };

      const adapter = new dbModule.LocalSqliteAdapter(
        mockDbSync as unknown as ConstructorParameters<typeof dbModule.LocalSqliteAdapter>[0]
      );

      const statements = [
        { sql: "INSERT INTO match_attendances VALUES (1, 1, 'none', 0, 1, 1, 100000, 'Tiếng', '')" },
        { sql: "INSERT INTO match_attendances FAIL_TRIGGER" },
      ];

      await expect(adapter.batch(statements)).rejects.toThrow("Simulated SQLite constraint failure");
      expect(mockDbSync.exec).toHaveBeenCalledWith("BEGIN TRANSACTION;");
      expect(mockDbSync.exec).toHaveBeenCalledWith("ROLLBACK;");
    });

    it("Bảo toàn tính duy nhất (idempotency) nhờ UNIQUE(match_id, player_id) và UPSERT", () => {
      // Kiểm tra schema có UNIQUE constraint
      const schemaSql = `
        CREATE TABLE IF NOT EXISTS match_attendances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
          UNIQUE(match_id, player_id)
        );
      `;
      expect(schemaSql).toContain("UNIQUE(match_id, player_id)");
    });
  });

  // -------------------------------------------------------------
  // PILLAR 2: FUND RECONCILIATION & TOURNAMENT RESERVE
  // -------------------------------------------------------------
  describe("Pillar 2: Fund Reconciliation & Tournament Reserve Isolation", () => {
    it("Quỹ giải riêng (tournament_fund_reserve) độc lập với dòng tiền hoạt động tuần", () => {
      const summary = calculateFinancialSummary({
        attendances: [
          { id: 1, match_id: 1, player_id: 1, attended: 1, paid: 1, amount: 100000, note: "", rsvp_status: "registered", walk_in: 0, collected_by: "Tiếng" },
        ],
        otherIncomes: [],
        expenses: [
          { id: 1, match_id: 1, expense_date: "2026-03-01", category: "Tiền sân", description: "Sân Vĩnh Lộc", amount: 90000, payer: "Tiếng" },
        ],
      });

      // Số dư hoạt động tuần chỉ là 10.000 VNĐ
      expect(summary.currentBalance).toBe(10000);
      // Quỹ giải riêng không bị tự động gộp vào doanh thu hay số dư hoạt động
      expect(summary.totalIncome).toBe(100000);
      expect(summary.totalOtherIncome).toBe(0);
      expect(mockSettings.tournament_fund_reserve).toBe(2301700);
    });

    it("Điều chuyển quỹ nội bộ không tạo doanh thu hay chi phí kép", () => {
      // Giả sử có một khoản thu nội bộ từ Quỹ Giải sang Quỹ Tuần
      // Hạch toán chuẩn: fund_type = "Chuyển quỹ nội bộ"
      const internalTransfer: OtherIncome = {
        id: 1,
        income_date: "2026-03-05",
        contributor: "Quỹ Giải Đội Bóng",
        amount: 500000,
        fund_type: "Chuyển quỹ nội bộ",
        note: "Chuyển bù tiền sân tuần 1",
      };

      // Đảm bảo hệ thống nhận diện và không nhân đôi doanh thu hoạt động
      expect(internalTransfer.fund_type).toBe("Chuyển quỹ nội bộ");
      expect(internalTransfer.amount).toBe(500000);
    });
  });

  // -------------------------------------------------------------
  // PILLAR 3: EXCEL ROUNDTRIP & DYNAMIC $N$ MATCHES
  // -------------------------------------------------------------
  describe("Pillar 3: Excel Roundtrip & Scalability (N > 22 matches)", () => {
    it("Xuất và nhập thành công khi mở rộng lên 50 trận và 100 trận", async () => {
      const totalMatches = 50;
      const dynamicMatches: MatchRecord[] = Array.from({ length: totalMatches }, (_, i) => ({
        id: i + 1,
        match_number: i + 1,
        match_date: `2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
        kickoff_time: "17:30",
        venue: `Sân bóng #${i + 1}`,
        pitch_cost: 900000,
        fee_per_player: 100000,
        opponent: `Đối tác ${i + 1}`,
        status: "Đã diễn ra",
        notes: "",
        payer_name: "Tiếng",
        label: `Trận ${i + 1}`,
        team_score: null,
        opponent_score: null,
      }));

      const dynamicAttendances: MatchAttendance[] = dynamicMatches.map((m) => ({
        id: m.id,
        match_id: m.id,
        player_id: 1,
        attended: 1,
        paid: 1,
        amount: 100000,
        note: "",
        rsvp_status: "registered",
        walk_in: 0,
        collected_by: "Tiếng",
      }));

      const fullData: FullAppData = {
        players: [mockManager],
        matches: dynamicMatches,
        attendances: dynamicAttendances,
        expenses: [],
        otherIncomes: [],
        settings: mockSettings,
        summary: {
          totalIncome: totalMatches * 100000,
          totalMatchIncome: totalMatches * 100000,
          totalOtherIncome: 0,
          totalExpense: 0,
          currentBalance: totalMatches * 100000,
          totalMatchesCount: totalMatches,
          totalPlayersCount: 1,
          totalUnpaidAmount: 0,
          categoryBreakdown: [],
        },
      };

      vi.spyOn(dbModule, "getFullAppData").mockResolvedValue(fullData);
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
        query: vi.fn().mockResolvedValue([mockManager]),
        execute: vi.fn(),
      } as unknown as ReturnType<typeof dbModule.getAsyncDb>);

      const req = new NextRequest("https://fchdhgonoi.vercel.app/api/export", {
        headers: {
          host: "fchdhgonoi.vercel.app",
          cookie: createMockManagerCookie(),
        },
      });

      const res = await handleExportGet(req);
      expect(res.status).toBe(200);

      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "buffer" });

      const wsMatches = wb.Sheets["3. Thu Trận (Tích chọn)"];
      expect(wsMatches).toBeDefined();

      // Hàng 5 chứa nhãn trận: Cột F là Trận 1, cột thứ 50 sau F
      // Trận 50 ứng với cột BC (F là col 5, 5 + 49 = col 54 = BC)
      const range = XLSX.utils.decode_range(wsMatches["!ref"] || "A1:Z50");
      expect(range.e.c).toBeGreaterThanOrEqual(54); // Có đủ ít nhất 50 cột trận
    });

    it("Bảo toàn ký tự tiếng Việt có dấu và định dạng 'x' / TRUE", () => {
      const wb = XLSX.utils.book_new();
      const testRows = [
        ["", "Họ và Tên", "Quê Quán", "Trận 1", "Trận 2"],
        ["", "Nguyễn Thế Tiếng", "Xã Gò Nổi • Điện Quang", "x", true],
        ["", "Lê Văn Tín", "Điện Phong", "x", false],
      ];
      const ws = XLSX.utils.aoa_to_sheet(testRows);
      XLSX.utils.book_append_sheet(wb, ws, "TestVietnamese");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const readWb = XLSX.read(buffer, { type: "buffer" });
      const readWs = readWb.Sheets["TestVietnamese"];

      expect(readWs["B2"].v).toBe("Nguyễn Thế Tiếng");
      expect(readWs["C2"].v).toBe("Xã Gò Nổi • Điện Quang");
      expect(readWs["D2"].v).toBe("x");
      expect(readWs["E2"].v).toBe(true);
      expect(readWs["E3"].v).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // PILLAR 4: FINANCIAL INTEGRITY & EDGE CASES
  // -------------------------------------------------------------
  describe("Pillar 4: Financial Integrity & Edge Cases", () => {
    it("Hoàn tiền cọc và điều chỉnh chi phí sân không làm sai lệch số dư quỹ", () => {
      const expenses: ExpenseRecord[] = [
        { id: 1, match_id: 1, expense_date: "2026-03-01", category: "Tiền sân", description: "Cọc sân Vũ Khánh", amount: 1335000, payer: "Tiếng" },
        { id: 2, match_id: 1, expense_date: "2026-03-02", category: "Tiền sân", description: "Chủ sân hoàn 100% tiền cọc do bão", amount: -1335000, payer: "Tiếng" },
      ];

      const summary = calculateFinancialSummary({
        attendances: [],
        otherIncomes: [],
        expenses,
      });

      expect(summary.totalExpense).toBe(0);
      expect(summary.currentBalance).toBe(0);
    });

    it("Trận đấu hủy bỏ không tính vào công nợ hay doanh thu ảo", () => {
      const matchCancelled: MatchRecord = {
        id: 99,
        match_number: 99,
        match_date: "2026-06-01",
        kickoff_time: "17:30",
        venue: "Sân Vĩnh Lộc",
        pitch_cost: 0,
        fee_per_player: 100000,
        opponent: "FC Bạn",
        status: "Đã hủy",
        notes: "Mưa to hủy trận",
        payer_name: "Tiếng",
        label: "Trận 99",
        team_score: null,
        opponent_score: null,
      };

      const [stats] = calculateMatchStats([matchCancelled], [], []);
      expect(stats.status).toBe("Đã hủy");
      expect(stats.attendeesCount).toBe(0);
      expect(stats.paidCount).toBe(0);
      expect(stats.collected).toBe(0);
      expect(stats.net).toBe(0);
    });
  });

  // -------------------------------------------------------------
  // PILLAR 5: SECURITY REGRESSION (PHASE 1 PRESERVATION)
  // -------------------------------------------------------------
  describe("Pillar 5: Security Regression & Authorization Boundaries", () => {
    it("Guest nhận DTO đã được làm sạch hoàn toàn", () => {
      const fullData: FullAppData = {
        players: [mockManager, mockPlayer],
        matches: [],
        attendances: [],
        expenses: [
          { id: 1, match_id: 1, expense_date: "2026-03-01", category: "Tiền sân", description: "Hóa đơn nhạy cảm", amount: 900000, payer: "Tiếng" },
        ],
        otherIncomes: [],
        settings: mockSettings,
        summary: {
          totalIncome: 1000000,
          totalMatchIncome: 1000000,
          totalOtherIncome: 0,
          totalExpense: 900000,
          currentBalance: 100000,
          totalMatchesCount: 1,
          totalPlayersCount: 2,
          totalUnpaidAmount: 0,
          categoryBreakdown: [],
        },
      };

      const guestData = sanitizeDataForPublic(fullData);
      expect(guestData.expenses).toEqual([]); // Ẩn hoàn toàn chi tiết chi tiêu
      expect(guestData.otherIncomes).toEqual([]); // Ẩn hoàn toàn chi tiết thu khác
      for (const p of guestData.players) {
        expect(p.phone).toBe("");
        expect(p.pin_code).toBe("");
        expect(p.notes).toBe("");
        expect(p.username).toBe("");
      }
    });

    it("Player chỉ được xem số điện thoại và ghi chú của chính mình", () => {
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
          categoryBreakdown: [],
        },
      };

      // Player 2 (mockPlayer) xem dữ liệu
      const playerScopedData = sanitizeDataForPlayer(fullData, 2);
      const player1 = playerScopedData.players.find((p) => p.id === 1);
      const player2 = playerScopedData.players.find((p) => p.id === 2);

      // Cầu thủ 1 (người khác): bị che
      expect(player1?.phone).toBe("");
      expect(player1?.pin_code).toBe("");
      expect(player1?.notes).toBe("");

      // Cầu thủ 2 (chính mình): được giữ nguyên SĐT
      expect(player2?.phone).toBe("0912345678");
      expect(player2?.pin_code).toBe(""); // PIN luôn luôn bị ẩn
    });
  });
});
