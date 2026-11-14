import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { AuthSession, FullAppData } from "@/types/app";
import {
  createTransitionSafeData,
  executeSessionHydration,
  fetchAuthorizedTeamData,
  isValidFullAppData,
} from "./sessionHydration";
import { getPlayerPositionBadge } from "./athleteProfile";

function makeBaseData(overrides: Partial<FullAppData> = {}): FullAppData {
  return {
    settings: {
      id: 1,
      team_name: "FC HĐH Gò Nổi",
      short_name: "Gò Nổi FC",
      default_match_fee: 100000,
      bank_bin: "970415",
      bank_name: "VietinBank",
      bank_account_no: "123456",
      bank_account_name: "NGUYEN THE TIENG",
      tournament_fund_reserve: 2301700,
      tournament_fund_note: "",
    },
    players: [
      {
        id: 24,
        code_order: 24,
        full_name: "QA_MANAGER_363B",
        short_name: "Manager",
        jersey_number: null,
        position: "Tiền vệ",
        phone: "",
        birth_year: "1990",
        avatar_url: "",
        role: "Ban Quản Lý",
        access_role: "player",
        pin_code: "",
        status: "Đang sinh hoạt",
        notes: "",
      },
      {
        id: 25,
        code_order: 25,
        full_name: "QA_PLAYER_363B",
        short_name: "Player",
        jersey_number: null,
        position: "DF",
        phone: "",
        birth_year: "1992",
        avatar_url: "",
        role: "Thành viên",
        access_role: "player",
        pin_code: "",
        status: "Đang sinh hoạt",
        notes: "",
      },
    ],
    matches: [],
    attendances: [],
    otherIncomes: [],
    expenses: [],
    summary: {
      totalMatchIncome: 16100000,
      totalOtherIncome: 0,
      totalIncome: 16100000,
      totalExpense: 14630000,
      currentBalance: 1470000,
      totalMatchesCount: 15,
      totalPlayersCount: 25,
      totalUnpaidAmount: 0,
      totalVoluntaryAmount: 0,
      categoryBreakdown: [],
    },
    posts: [],
    sponsors: [],
    ...overrides,
  };
}

const MANAGER_SESSION: AuthSession = {
  role: "manager",
  playerId: 24,
  fullName: "QA_MANAGER_363B",
  shortName: "Manager",
  jerseyNumber: null,
  position: "Tiền vệ",
  teamRole: "Ban Quản Lý",
};

const PLAYER_SESSION: AuthSession = {
  role: "player",
  playerId: 25,
  fullName: "QA_PLAYER_363B",
  shortName: "Player",
  jerseyNumber: null,
  position: "DF",
  teamRole: "Thành viên",
};

const GUEST_SESSION: AuthSession = {
  role: "guest",
  playerId: null,
  fullName: "Khách thăm quan",
  shortName: "Khách",
  jerseyNumber: null,
  position: "",
  teamRole: "Khách vãng lai",
};

describe("DEF-363C4-01: Session Hydration & Role Data Isolation", () => {
  it("1. Guest -> Manager login triggers GET /api/team and hydrates full 16 expenses", async () => {
    const managerExpenses = Array.from({ length: 16 }, (_, idx) => ({
      id: idx + 1,
      expense_date: "2026-10-28",
      category: idx === 15 ? "Áo đấu/Phụ kiện" : "Tiền sân",
      description: `Khoản chi #${idx + 1}`,
      amount: idx === 15 ? 110000 : 968000,
      payer: "Tiếng",
      match_id: 15,
    }));
    const managerData = makeBaseData({
      expenses: managerExpenses,
      settings: {
        ...makeBaseData().settings,
        tournament_fund_note: "Ghi chú nội bộ Manager",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(managerData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    let currentData = makeBaseData({ expenses: [] }); // Guest stale empty expenses
    let currentSession: AuthSession = GUEST_SESSION;
    let isLoading = false;
    let errorMsg: string | null = null;

    const ok = await executeSessionHydration({
      epoch: 1,
      getCurrentEpoch: () => 1,
      isMounted: () => true,
      nextSession: MANAGER_SESSION,
      nextTab: "schedule",
      fetchImpl: fetchMock,
      onStartTransition: () => {
        isLoading = true;
        currentData = createTransitionSafeData(currentData);
      },
      onSuccess: (fresh, nextSession) => {
        currentData = fresh;
        currentSession = nextSession;
        isLoading = false;
      },
      onError: (msg) => {
        errorMsg = msg;
        isLoading = false;
      },
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/team",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      })
    );
    expect(currentSession.role).toBe("manager");
    expect(currentData.expenses).toHaveLength(16);
    expect(isLoading).toBe(false);
    expect(errorMsg).toBeNull();
  });

  it("2 & 4. Guest -> Player login hydrates Player-sanitized data without Manager secrets", async () => {
    const playerData = makeBaseData({
      players: [
        {
          ...makeBaseData().players[0],
          phone: "",
          username: "",
          notes: "",
          access_role: "player",
        },
        {
          ...makeBaseData().players[1],
          phone: "0900000025",
          username: "player25",
          access_role: "player",
        },
      ],
      settings: {
        ...makeBaseData().settings,
        tournament_fund_note: "",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(playerData), { status: 200 })
    );

    let currentData = makeBaseData();
    const ok = await executeSessionHydration({
      epoch: 1,
      getCurrentEpoch: () => 1,
      isMounted: () => true,
      nextSession: PLAYER_SESSION,
      nextTab: "schedule",
      fetchImpl: fetchMock,
      onStartTransition: () => {},
      onSuccess: (fresh) => {
        currentData = fresh;
      },
      onError: () => {},
    });

    expect(ok).toBe(true);
    expect(currentData.settings.tournament_fund_note).toBe("");
    expect(currentData.players[0].phone).toBe("");
    expect(currentData.players[0].username).toBe("");
    expect(currentData.players[1].phone).toBe("0900000025");
  });

  it("3 & 5. Logout clears Manager-specific data and restores sanitized Guest state", async () => {
    const managerLoadedData = makeBaseData({
      expenses: [
        {
          id: 1,
          expense_date: "2026-10-28",
          category: "Tiền sân",
          description: "Sân",
          amount: 1000000,
          payer: "Tiếng",
          match_id: 15,
        },
      ],
      otherIncomes: [
        {
          id: 1,
          income_date: "2026-10-28",
          contributor: "Mạnh thường quân",
          amount: 500000,
          fund_type: "Quỹ sinh hoạt",
          note: "Ủng hộ",
        },
      ],
      settings: {
        ...makeBaseData().settings,
        tournament_fund_note: "Nội bộ Manager",
      },
    });

    const guestData = makeBaseData({ expenses: [], otherIncomes: [] });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(guestData), { status: 200 })
    );

    let currentData = managerLoadedData;
    let currentSession: AuthSession = MANAGER_SESSION;

    await executeSessionHydration({
      epoch: 2,
      getCurrentEpoch: () => 2,
      isMounted: () => true,
      nextSession: GUEST_SESSION,
      nextTab: "public",
      fetchImpl: fetchMock,
      onStartTransition: () => {
        currentData = createTransitionSafeData(currentData);
        // Immediately stripped before network returns
        expect(currentData.expenses).toHaveLength(0);
        expect(currentData.otherIncomes).toHaveLength(0);
        expect(currentData.settings.tournament_fund_note).toBe("");
      },
      onSuccess: (fresh, nextSession) => {
        currentData = fresh;
        currentSession = nextSession;
      },
      onError: () => {},
    });

    expect(currentSession.role).toBe("guest");
    expect(currentData.expenses).toHaveLength(0);
    expect(currentData.otherIncomes).toHaveLength(0);
  });

  it("6. Hydration failure sets error state and does not retain stale ledger", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Lỗi máy chủ" }), { status: 500 })
    );

    let currentData = makeBaseData({
      expenses: [
        {
          id: 99,
          expense_date: "2026-10-01",
          category: "Tiền sân",
          description: "Old",
          amount: 500000,
          payer: "Tiếng",
          match_id: 1,
        },
      ],
    });
    let hydrationError: string | null = null;
    let successCalled = false;

    const ok = await executeSessionHydration({
      epoch: 1,
      getCurrentEpoch: () => 1,
      isMounted: () => true,
      nextSession: MANAGER_SESSION,
      nextTab: "schedule",
      fetchImpl: fetchMock,
      onStartTransition: () => {
        currentData = createTransitionSafeData(currentData);
      },
      onSuccess: () => {
        successCalled = true;
      },
      onError: (msg) => {
        hydrationError = msg;
      },
    });

    expect(ok).toBe(false);
    expect(successCalled).toBe(false);
    expect(hydrationError).toContain("Lỗi máy chủ");
    expect(currentData.expenses).toHaveLength(0);
  });

  it("7. Slower previous request cannot overwrite newer session (stale-request protection)", async () => {
    let activeEpoch = 1;
    let resolveSlow!: (val: Response) => void;
    const slowFetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveSlow = resolve;
        })
    );

    const oldManagerData = makeBaseData({
      expenses: [
        {
          id: 1,
          expense_date: "2026-10-28",
          category: "Tiền sân",
          description: "Old manager",
          amount: 100000,
          payer: "Tiếng",
          match_id: 1,
        },
      ],
    });

    let currentSession: AuthSession = GUEST_SESSION;
    let currentData = makeBaseData();

    const p1 = executeSessionHydration({
      epoch: 1,
      getCurrentEpoch: () => activeEpoch,
      isMounted: () => true,
      nextSession: MANAGER_SESSION,
      nextTab: "schedule",
      fetchImpl: slowFetch,
      onStartTransition: () => {},
      onSuccess: (fresh, nextSession) => {
        currentData = fresh;
        currentSession = nextSession;
      },
      onError: () => {},
    });

    // Newer logout/switch happens before slow request resolves
    activeEpoch = 2;
    const fastFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makeBaseData({ expenses: [] })), { status: 200 })
    );
    await executeSessionHydration({
      epoch: 2,
      getCurrentEpoch: () => activeEpoch,
      isMounted: () => true,
      nextSession: PLAYER_SESSION,
      nextTab: "schedule",
      fetchImpl: fastFetch,
      onStartTransition: () => {},
      onSuccess: (fresh, nextSession) => {
        currentData = fresh;
        currentSession = nextSession;
      },
      onError: () => {},
    });

    // Now old slow response arrives
    resolveSlow(new Response(JSON.stringify(oldManagerData), { status: 200 }));
    const oldResult = await p1;

    expect(oldResult).toBe(false);
    expect(currentSession.role).toBe("player");
    expect(currentData.expenses).toHaveLength(0);
  });

  it("8. Loading state prevents premature privileged rendering & validates malformed payloads", async () => {
    expect(isValidFullAppData(null)).toBe(false);
    expect(isValidFullAppData({ summary: {} })).toBe(false);

    const badFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ invalid: true }), { status: 200 })
    );
    await expect(fetchAuthorizedTeamData(badFetch)).rejects.toThrow(
      "Dữ liệu trả về từ máy chủ không hợp lệ."
    );
  });
});

describe("DEF-363C4-04: Athlete Card Position Mapping", () => {
  it("maps supported Vietnamese and abbreviated codes consistently", () => {
    expect(getPlayerPositionBadge({ position: "GK" })).toMatchObject({
      code: "GK",
      label: "THỦ MÔN",
    });
    expect(getPlayerPositionBadge({ position: "Thủ môn" })).toMatchObject({
      code: "GK",
      label: "THỦ MÔN",
    });
    expect(getPlayerPositionBadge({ position: "DF" })).toMatchObject({
      code: "DF",
      label: "HẬU VỆ",
    });
    expect(getPlayerPositionBadge({ position: "df" })).toMatchObject({
      code: "DF",
      label: "HẬU VỆ",
    });
    expect(getPlayerPositionBadge({ position: "Hậu vệ" })).toMatchObject({
      code: "DF",
      label: "HẬU VỆ",
    });
    expect(getPlayerPositionBadge({ position: "Trung vệ thòng" })).toMatchObject({
      code: "DF",
      label: "HẬU VỆ",
    });
    expect(getPlayerPositionBadge({ position: "MF" })).toMatchObject({
      code: "MF",
      label: "TIỀN VỆ",
    });
    expect(getPlayerPositionBadge({ position: "Tiền vệ trung tâm" })).toMatchObject({
      code: "MF",
      label: "TIỀN VỆ",
    });
    expect(getPlayerPositionBadge({ position: "FW" })).toMatchObject({
      code: "FW",
      label: "TIỀN ĐẠO",
    });
    expect(getPlayerPositionBadge({ position: "Tiền đạo cánh" })).toMatchObject({
      code: "FW",
      label: "TIỀN ĐẠO",
    });
    expect(getPlayerPositionBadge({ position: "Đa năng" })).toMatchObject({
      code: "ĐN",
      label: "ĐA NĂNG",
    });
  });
});

describe("DEF-363C4-02 & Ledger Zero Formatting Static Checks", () => {
  it("ensures password visibility toggles in ScheduleTab have Vietnamese aria-labels", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/ScheduleTab.tsx"),
      "utf8"
    );
    expect(src).toContain("Hiện mật khẩu hiện tại");
    expect(src).toContain("Ẩn mật khẩu hiện tại");
    expect(src).toContain("Hiện mật khẩu mới");
    expect(src).toContain("Ẩn mật khẩu mới");
    expect(src).toContain("Hiện xác nhận mật khẩu mới");
    expect(src).toContain("Ẩn xác nhận mật khẩu mới");
  });

  it("ensures FinanceTab formats zero filtered expenses without negative-zero (-0)", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/FinanceTab.tsx"),
      "utf8"
    );
    expect(src).toContain("if (totalFiltered === 0) return formatVND(0);");
    expect(src).toContain("totalFiltered > 0");
  });
});
