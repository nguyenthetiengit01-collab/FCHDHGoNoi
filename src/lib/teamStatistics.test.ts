import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  calculatePlayerAttendanceStats,
  calculateTeamAvgAttendanceRate,
  classifyMatchStatus,
  classifyPlayerStatus,
  formatAttendanceRate,
  getMatchStatistics,
  getPlayerStatistics,
  getTeamStatistics,
  isActivePlayer,
  isCancelledMatch,
  isCompletedMatch,
  isUpcomingMatch,
} from "./teamStatistics";
import { GET as teamGet } from "@/app/api/team/route";
import * as dbModule from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import type { FullAppData } from "@/types/app";

afterEach(() => {
  vi.restoreAllMocks();
});

function buildSyntheticData(): FullAppData {
  return {
    settings: {
      id: 1,
      team_name: "FC HĐH Gò Nổi",
      short_name: "GONOIFC",
      default_match_fee: 100000,
      bank_bin: "970400",
      bank_name: "TestBank",
      bank_account_no: "000111222",
      bank_account_name: "QUY DOI",
      tournament_fund_reserve: 0,
      tournament_fund_note: "Ghi chú nội bộ",
      fanpage_url: "https://example.com",
    },
    players: [
      {
        id: 1,
        code_order: 1,
        full_name: "Nguyễn Quản Lý",
        short_name: "Quản Lý",
        jersey_number: 1,
        position: "Thủ môn",
        phone: "0901000001",
        birth_year: "1992",
        avatar_url: "",
        role: "Đội trưởng",
        access_role: "manager",
        username: "mgr1",
        pin_code: "scrypt$fakehash1",
        status: "Đang sinh hoạt",
        notes: "Ghi chú riêng manager",
      },
      {
        id: 2,
        code_order: 2,
        full_name: "Trần Cầu Thủ",
        short_name: "Cầu Thủ",
        jersey_number: 10,
        position: "Tiền vệ",
        phone: "0902000002",
        birth_year: "1995",
        avatar_url: "",
        role: "Thành viên",
        access_role: "player",
        username: "plr2",
        pin_code: "scrypt$fakehash2",
        status: "Tạm nghỉ",
        notes: "Ghi chú riêng player 2",
      },
      {
        id: 3,
        code_order: 3,
        full_name: "Lê Ngừng Sinh Hoạt",
        short_name: "Lê",
        jersey_number: 7,
        position: "Tiền đạo",
        phone: "0903000003",
        birth_year: "1994",
        avatar_url: "",
        role: "Thành viên",
        access_role: "player",
        username: "plr3",
        pin_code: "scrypt$fakehash3",
        status: "Ngừng tham gia",
        notes: "Ghi chú riêng player 3",
      },
      {
        id: 4,
        code_order: 4,
        full_name: "Phạm Chưa Rõ",
        short_name: "Phạm",
        jersey_number: 99,
        position: "Đa năng",
        phone: "0904000004",
        birth_year: "1996",
        avatar_url: "",
        role: "Thành viên",
        access_role: "player",
        username: "plr4",
        pin_code: "scrypt$fakehash4",
        status: "Trạng thái lạ",
        notes: "Ghi chú riêng player 4",
      },
    ],
    matches: [
      {
        id: 101,
        match_number: 1,
        label: "Trận 1",
        match_date: "2026-10-01",
        kickoff_time: "19:00",
        venue: "Sân A",
        opponent: "Đội A",
        fee_per_player: 100000,
        pitch_cost: 900000,
        payer_name: "Quản Lý",
        team_score: 3,
        opponent_score: 2,
        status: "Đã kết thúc",
        notes: "",
      },
      {
        id: 102,
        match_number: 2,
        label: "Trận 2",
        match_date: "2026-10-08",
        kickoff_time: "19:00",
        venue: "Sân A",
        opponent: "Đội B",
        fee_per_player: 100000,
        pitch_cost: 0,
        payer_name: "",
        team_score: null,
        opponent_score: null,
        status: "Đã hủy",
        notes: "Mưa lớn",
      },
      {
        id: 103,
        match_number: 3,
        label: "Trận 3",
        match_date: "2026-10-15",
        kickoff_time: "19:00",
        venue: "Sân A",
        opponent: "Đội C",
        fee_per_player: 100000,
        pitch_cost: 0,
        payer_name: "",
        team_score: null,
        opponent_score: null,
        status: "Sắp diễn ra",
        notes: "",
      },
      {
        id: 104,
        match_number: 4,
        label: "Trận 4",
        match_date: "2026-10-22",
        kickoff_time: "19:00",
        venue: "Sân A",
        opponent: "Đội D",
        fee_per_player: 100000,
        pitch_cost: 0,
        payer_name: "",
        team_score: null,
        opponent_score: null,
        status: "",
        notes: "",
      },
    ],
    attendances: [
      { id: 1, match_id: 101, player_id: 1, rsvp_status: "registered", walk_in: 0, attended: 1, paid: 1, amount: 100000, collected_by: "Quản Lý", note: "" },
      { id: 2, match_id: 102, player_id: 1, rsvp_status: "registered", walk_in: 0, attended: 1, paid: 0, amount: 0, collected_by: "", note: "" },
      { id: 3, match_id: 103, player_id: 1, rsvp_status: "registered", walk_in: 0, attended: 1, paid: 0, amount: 0, collected_by: "", note: "" },
      { id: 4, match_id: 104, player_id: 1, rsvp_status: "registered", walk_in: 0, attended: 1, paid: 0, amount: 0, collected_by: "", note: "" },
    ],
    otherIncomes: [
      { id: 1, income_date: "2026-10-01", contributor: "Tài trợ", amount: 500000, fund_type: "general", note: "Nội bộ" },
    ],
    expenses: [
      { id: 1, expense_date: "2026-10-01", category: "Tiền sân", description: "Sân A", amount: 900000, payer: "Quản Lý", match_id: 101 },
    ],
    summary: {
      totalMatchIncome: 100000,
      totalOtherIncome: 500000,
      totalIncome: 600000,
      totalExpense: 900000,
      currentBalance: -300000,
      totalUnpaidAmount: 0,
      categoryBreakdown: [],
    },
  };
}

describe("Team Statistics – Lifecycle, Attendance & Data Contracts", () => {
  it("classifies active, paused, stopped, and unknown players without misclassifying paused or unknown", () => {
    const players = [
      { status: "Đang sinh hoạt" },
      { status: "Tạm nghỉ" },
      { status: "Nghỉ phép" },
      { status: "Ngừng tham gia" },
      { status: "Ngưng sinh hoạt" },
      { status: "Đã nghỉ" },
      { status: "" },
      { status: null },
      { status: "Không rõ" },
    ];

    expect(classifyPlayerStatus("Đang sinh hoạt")).toBe("active");
    expect(classifyPlayerStatus("Tạm nghỉ")).toBe("paused");
    expect(classifyPlayerStatus("Tạm nghỉ")).not.toBe("stopped");
    expect(classifyPlayerStatus("Ngừng tham gia")).toBe("stopped");
    expect(classifyPlayerStatus("")).toBe("unknown");
    expect(classifyPlayerStatus("Không rõ")).toBe("unknown");

    expect(isActivePlayer({ status: "Đang sinh hoạt" })).toBe(true);
    expect(isActivePlayer({ status: "Tạm nghỉ" })).toBe(false);
    expect(isActivePlayer({ status: "Ngừng tham gia" })).toBe(false);
    expect(isActivePlayer({ status: "" })).toBe(false);

    expect(getPlayerStatistics(players)).toEqual({
      total: 9,
      active: 1,
      paused: 2,
      stopped: 3,
      unknown: 3,
    });
  });

  it("classifies upcoming, completed, cancelled, inProgress, and unknown matches without defaulting unknown/cancelled to completed", () => {
    const matches = [
      { status: "Sắp diễn ra" },
      { status: "Đã kết thúc" },
      { status: "Đã hủy" },
      { status: "Hủy do mưa" },
      { status: "Đang diễn ra" },
      { status: "" },
      { status: "Trạng thái lạ" },
    ];

    expect(classifyMatchStatus("Sắp diễn ra")).toBe("upcoming");
    expect(classifyMatchStatus("Đã kết thúc")).toBe("completed");
    expect(classifyMatchStatus("Đã hủy")).toBe("cancelled");
    expect(classifyMatchStatus("Đã hủy")).not.toBe("completed");
    expect(classifyMatchStatus("Đang diễn ra")).toBe("inProgress");
    expect(classifyMatchStatus("")).toBe("unknown");
    expect(classifyMatchStatus("Trạng thái lạ")).toBe("unknown");

    expect(isUpcomingMatch({ status: "Sắp diễn ra" })).toBe(true);
    expect(isCompletedMatch({ status: "Đã kết thúc" })).toBe(true);
    expect(isCancelledMatch({ status: "Đã hủy" })).toBe(true);

    expect(getMatchStatistics(matches)).toEqual({
      total: 7,
      upcoming: 1,
      completed: 1,
      cancelled: 2,
      inProgress: 1,
      unknown: 2,
    });
  });

  it("calculates attendance strictly on completed matches and renders '—' when zero eligible matches exist", () => {
    const data = buildSyntheticData();
    // Player 1 attended match 101 (completed), 102 (cancelled), 103 (upcoming), 104 (unknown)
    // Only match 101 is eligible -> 1/1 = 100%
    const stats = calculatePlayerAttendanceStats(1, data.matches, data.attendances);
    expect(stats).toEqual({
      matchesPlayed: 1,
      eligibleMatchesCount: 1,
      attendanceRate: 100,
    });
    expect(formatAttendanceRate(stats.attendanceRate)).toBe("100%");

    // Zero eligible matches (only upcoming + cancelled + unknown)
    const nonCompletedMatches = data.matches.filter((m) => m.id !== 101);
    const zeroStats = calculatePlayerAttendanceStats(1, nonCompletedMatches, data.attendances);
    expect(zeroStats).toEqual({
      matchesPlayed: 0,
      eligibleMatchesCount: 0,
      attendanceRate: null,
    });
    expect(formatAttendanceRate(zeroStats.attendanceRate)).toBe("—");

    const zeroTeamAvg = calculateTeamAvgAttendanceRate(
      data.players,
      nonCompletedMatches,
      data.attendances
    );
    expect(zeroTeamAvg).toBeNull();
    expect(formatAttendanceRate(zeroTeamAvg)).toBe("—");
  });

  it("omits pin_code completely, enforces role permissions, and keeps statistics consistent across Public, Player, and Manager", async () => {
    const synthetic = buildSyntheticData();
    vi.spyOn(dbModule, "getFullAppData").mockResolvedValue(synthetic);

    const expectedStats = getTeamStatistics(synthetic);

    // 1. PUBLIC (Guest)
    const guestRes = await teamGet(new NextRequest("http://localhost:3000/api/team"));
    expect(guestRes.status).toBe(200);
    const guestJson = await guestRes.json();
    expect(guestJson.statistics).toEqual(expectedStats);
    expect(guestJson.expenses).toEqual([]);
    expect(guestJson.otherIncomes).toEqual([]);
    for (const p of guestJson.players) {
      expect("pin_code" in p).toBe(false);
      expect(p.phone).toBe("");
      expect(p.notes).toBe("");
    }

    // 2. PLAYER (id = 2)
    const playerToken = createSessionToken(synthetic.players[1], 1);
    const playerRes = await teamGet(
      new NextRequest("http://localhost:3000/api/team", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${playerToken}` },
      })
    );
    expect(playerRes.status).toBe(200);
    const playerJson = await playerRes.json();
    expect(playerJson.statistics).toEqual(expectedStats);
    expect(playerJson.expenses).toHaveLength(1);
    expect(playerJson.otherIncomes).toHaveLength(1);
    for (const p of playerJson.players) {
      expect("pin_code" in p).toBe(false);
      if (p.id === 2) {
        expect(p.phone).toBe("0902000002");
        expect(p.notes).toBe("Ghi chú riêng player 2");
      } else {
        expect(p.phone).toBe("");
        expect(p.notes).toBe("");
      }
    }

    // 3. MANAGER (id = 1)
    const managerToken = createSessionToken(synthetic.players[0], 1);
    const managerRes = await teamGet(
      new NextRequest("http://localhost:3000/api/team", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${managerToken}` },
      })
    );
    expect(managerRes.status).toBe(200);
    const managerJson = await managerRes.json();
    expect(managerJson.statistics).toEqual(expectedStats);
    expect(managerJson.expenses).toHaveLength(1);
    expect(managerJson.otherIncomes).toHaveLength(1);
    for (const p of managerJson.players) {
      expect("pin_code" in p).toBe(false);
    }
    expect(managerJson.players[1].phone).toBe("0902000002");
  });
});
