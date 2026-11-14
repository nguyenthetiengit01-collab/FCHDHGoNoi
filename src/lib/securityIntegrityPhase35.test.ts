import fs from "fs";
import path from "path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { Client } from "@libsql/client";
import * as dbModule from "@/lib/db";
import {
  LocalSqliteAdapter,
  TursoDbAdapter,
  resolveTursoConfig,
  seedAsyncInitialDataIfNeeded,
} from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { calculateFinancialSummary } from "@/lib/financialCalculations";
import { POST as handleTeamPost } from "@/app/api/team/route";
import type {
  ExpenseRecord,
  MatchAttendance,
  OtherIncome,
  Player,
  TeamSettings,
} from "@/types/app";

function createInMemorySqlite() {
  const sqlite = process.getBuiltinModule(
    "node:sqlite"
  ) as typeof import("node:sqlite");
  const db = new sqlite.DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE team_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      team_name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      default_match_fee INTEGER NOT NULL DEFAULT 100000,
      bank_bin TEXT NOT NULL DEFAULT '970422',
      bank_name TEXT NOT NULL DEFAULT 'MB Bank',
      bank_account_no TEXT NOT NULL DEFAULT '',
      bank_account_name TEXT NOT NULL DEFAULT 'NGUYEN THE TIENG',
      tournament_fund_reserve INTEGER NOT NULL DEFAULT 2301700,
      tournament_fund_note TEXT NOT NULL DEFAULT '',
      fanpage_url TEXT NOT NULL DEFAULT 'https://www.facebook.com/FCHDHGoNoi/'
    );
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_order INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      jersey_number INTEGER,
      position TEXT NOT NULL DEFAULT 'Tiền vệ',
      phone TEXT NOT NULL DEFAULT '',
      birth_year TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      profile_image_url TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'Thành viên',
      access_role TEXT NOT NULL DEFAULT 'player',
      username TEXT,
      pin_code TEXT NOT NULL DEFAULT '1234',
      status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
      notes TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      hometown TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      playing_style TEXT NOT NULL DEFAULT '',
      gallery_urls TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      match_date TEXT NOT NULL,
      kickoff_time TEXT NOT NULL DEFAULT '19:00',
      venue TEXT NOT NULL DEFAULT 'Sân Vĩnh Lộc',
      opponent TEXT NOT NULL DEFAULT 'Giao hữu',
      fee_per_player INTEGER NOT NULL DEFAULT 100000,
      pitch_cost INTEGER NOT NULL DEFAULT 900000,
      payer_name TEXT NOT NULL DEFAULT 'Tiếng',
      team_score INTEGER,
      opponent_score INTEGER,
      status TEXT NOT NULL DEFAULT 'Đã kết thúc',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE match_attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      rsvp_status TEXT NOT NULL DEFAULT 'none',
      walk_in INTEGER NOT NULL DEFAULT 0,
      attended INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      amount INTEGER NOT NULL DEFAULT 0,
      collected_by TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      UNIQUE(match_id, player_id)
    );
    CREATE TABLE other_incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      income_date TEXT NOT NULL,
      contributor TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      fund_type TEXT NOT NULL DEFAULT 'Quỹ sinh hoạt',
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      payer TEXT NOT NULL DEFAULT 'Tiếng',
      match_id INTEGER
    );
  `);
  return db;
}

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
  pin_code: hashPassword("test_manager_secret"),
  status: "Đang sinh hoạt",
  notes: "",
  username: "tieng",
};

const mockPlayer: Player = {
  id: 2,
  code_order: 2,
  full_name: "Lê Văn Cầu Thủ",
  short_name: "Thủ",
  jersey_number: 7,
  position: "Tiền đạo",
  phone: "0987654321",
  birth_year: "1994",
  avatar_url: "/uploads/avatars/member-2.webp",
  role: "Thành viên",
  access_role: "player",
  pin_code: hashPassword("test_player_secret"),
  status: "Đang sinh hoạt",
  notes: "",
  username: "cauthu",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Phase 3.5 – Task A & F: Secure Turso Credentials & Runtime Selection", () => {
  it("allows Local SQLite in development and test when no Turso/Vercel env vars are set", () => {
    expect(resolveTursoConfig({ NODE_ENV: "development" })).toBeNull();
    expect(resolveTursoConfig({ NODE_ENV: "test" })).toBeNull();
  });

  it("requires TURSO_DATABASE_URL in production even without VERCEL (no SQLite fallback or default URL)", () => {
    expect(() =>
      resolveTursoConfig({
        NODE_ENV: "production",
        TURSO_AUTH_TOKEN: "env_only_token_placeholder",
      })
    ).toThrow(/TURSO_DATABASE_URL/);
  });

  it("requires TURSO_DATABASE_URL when VERCEL is set", () => {
    expect(() =>
      resolveTursoConfig({
        NODE_ENV: "production",
        VERCEL: "1",
        TURSO_AUTH_TOKEN: "env_only_token_placeholder",
      })
    ).toThrow(/TURSO_DATABASE_URL/);
  });

  it("throws when TURSO_DATABASE_URL is set without TURSO_AUTH_TOKEN", () => {
    expect(() =>
      resolveTursoConfig({
        NODE_ENV: "test",
        TURSO_DATABASE_URL: "libsql://example.turso.io",
      })
    ).toThrow(/TURSO_AUTH_TOKEN/);
  });

  it("throws when VERCEL or production has URL but TURSO_AUTH_TOKEN is missing or whitespace", () => {
    expect(() =>
      resolveTursoConfig({
        NODE_ENV: "production",
        VERCEL: "1",
        TURSO_DATABASE_URL: "libsql://example.turso.io",
        TURSO_AUTH_TOKEN: "   ",
      })
    ).toThrow(/TURSO_AUTH_TOKEN/);
  });

  it("throws when TURSO_DATABASE_URL is empty or whitespace even in development", () => {
    expect(() =>
      resolveTursoConfig({
        NODE_ENV: "development",
        TURSO_DATABASE_URL: "   ",
        TURSO_AUTH_TOKEN: "env_only_token_placeholder",
      })
    ).toThrow(/TURSO_DATABASE_URL/);
  });

  it("returns resolved config when both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are provided via env", () => {
    const cfg = resolveTursoConfig({
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://custom.turso.io",
      TURSO_AUTH_TOKEN: "env_only_token_placeholder",
    });
    expect(cfg).toEqual({
      url: "libsql://custom.turso.io",
      authToken: "env_only_token_placeholder",
    });
  });

  it("contains zero hardcoded JWT tokens or default Turso URLs in src/lib/db.ts", () => {
    const dbSource = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db.ts"),
      "utf8"
    );
    expect(dbSource).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./);
    expect(dbSource).not.toContain("DEFAULT_TURSO_URL");
  });
});

describe("Phase 3.5 – Task B: update_settings Preserves Omitted Fields & Enforces Manager Auth", () => {
  function setupSettingsRouteWithMemoryDb() {
    const sqliteDb = createInMemorySqlite();
    sqliteDb
      .prepare(
        `INSERT INTO team_settings (
          id, team_name, short_name, default_match_fee,
          bank_bin, bank_name, bank_account_no, bank_account_name,
          tournament_fund_reserve, tournament_fund_note, fanpage_url
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "FC HĐH Gò Nổi tại TP.HCM",
        "FC HĐH GÒ NỔI",
        100000,
        "970422",
        "MB Bank",
        "0905123456",
        "NGUYEN THE TIENG",
        2301700,
        "Quỹ giải riêng",
        "https://www.facebook.com/CustomGoNoiPage/"
      );
    sqliteDb
      .prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, position, access_role, pin_code)
         VALUES (1, ?, ?, 10, 'Tiền vệ', 'manager', ?)`
      )
      .run(mockManager.full_name, mockManager.short_name, mockManager.pin_code);
    sqliteDb
      .prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, position, access_role, pin_code)
         VALUES (2, ?, ?, 7, 'Tiền đạo', 'player', ?)`
      )
      .run(mockPlayer.full_name, mockPlayer.short_name, mockPlayer.pin_code);

    const adapter = new LocalSqliteAdapter(sqliteDb);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter);
    vi.spyOn(dbModule, "getFullAppData").mockImplementation(async () => {
      const settings = await adapter.queryOne<TeamSettings>(
        "SELECT * FROM team_settings WHERE id = 1"
      );
      const players = await adapter.query<Player>("SELECT * FROM players");
      return {
        settings: settings!,
        players,
        matches: [],
        attendances: [],
        otherIncomes: [],
        expenses: [],
        summary: calculateFinancialSummary({
          attendances: [],
          otherIncomes: [],
          expenses: [],
        }),
        clubPosts: [],
        sponsors: [],
      };
    });

    return { sqliteDb, adapter };
  }

  function makeAuthRequest(player: Player | null, body: Record<string, unknown>) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
    };
    if (player) {
      const token = createSessionToken(player, 24);
      headers.cookie = `${SESSION_COOKIE_NAME}=${token}`;
    }
    return new NextRequest("http://localhost:3000/api/team", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  it("preserves existing fanpage_url when payload omits fanpage_url", async () => {
    const { sqliteDb } = setupSettingsRouteWithMemoryDb();
    try {
      const req = makeAuthRequest(mockManager, {
        action: "update_settings",
        payload: {
          team_name: "FC HĐH Gò Nổi tại TP.HCM",
          default_match_fee: 120000,
        },
      });
      const res = await handleTeamPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.settings.fanpage_url).toBe(
        "https://www.facebook.com/CustomGoNoiPage/"
      );
      expect(data.settings.default_match_fee).toBe(120000);
    } finally {
      sqliteDb.close();
    }
  });

  it("updates fanpage_url when payload explicitly includes a valid fanpage_url", async () => {
    const { sqliteDb } = setupSettingsRouteWithMemoryDb();
    try {
      const req = makeAuthRequest(mockManager, {
        action: "update_settings",
        payload: {
          fanpage_url: "https://www.facebook.com/UpdatedGoNoiOfficial/",
        },
      });
      const res = await handleTeamPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.settings.fanpage_url).toBe(
        "https://www.facebook.com/UpdatedGoNoiOfficial/"
      );
    } finally {
      sqliteDb.close();
    }
  });

  it("preserves fanpage_url when updating tournament_fund_reserve only", async () => {
    const { sqliteDb } = setupSettingsRouteWithMemoryDb();
    try {
      const req = makeAuthRequest(mockManager, {
        action: "update_settings",
        payload: {
          tournament_fund_reserve: 2500000,
          tournament_fund_note: "Cập nhật quỹ giải",
        },
      });
      const res = await handleTeamPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.settings.tournament_fund_reserve).toBe(2500000);
      expect(data.settings.fanpage_url).toBe(
        "https://www.facebook.com/CustomGoNoiPage/"
      );
    } finally {
      sqliteDb.close();
    }
  });

  it("rejects update_settings for non-manager player (403) and unauthenticated guest (401)", async () => {
    const { sqliteDb } = setupSettingsRouteWithMemoryDb();
    try {
      const playerReq = makeAuthRequest(mockPlayer, {
        action: "update_settings",
        payload: { team_name: "Unauthorized Change" },
      });
      const playerRes = await handleTeamPost(playerReq);
      expect(playerRes.status).toBe(403);

      const guestReq = makeAuthRequest(null, {
        action: "update_settings",
        payload: { team_name: "Unauthorized Change" },
      });
      const guestRes = await handleTeamPost(guestReq);
      expect(guestRes.status).toBe(401);
    } finally {
      sqliteDb.close();
    }
  });

  it("preserves both changes when two concurrent/sequential partial updates modify different fields (Task H)", async () => {
    const { sqliteDb } = setupSettingsRouteWithMemoryDb();
    try {
      const req1 = makeAuthRequest(mockManager, {
        action: "update_settings",
        payload: { tournament_fund_reserve: 2999000 },
      });
      const req2 = makeAuthRequest(mockManager, {
        action: "update_settings",
        payload: { fanpage_url: "https://www.facebook.com/ConcurrentUpdate/" },
      });

      const [res1, res2] = await Promise.all([
        handleTeamPost(req1),
        handleTeamPost(req2),
      ]);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const finalRow = sqliteDb
        .prepare("SELECT * FROM team_settings WHERE id = 1")
        .get() as unknown as TeamSettings;
      expect(finalRow.tournament_fund_reserve).toBe(2999000);
      expect(finalRow.fanpage_url).toBe(
        "https://www.facebook.com/ConcurrentUpdate/"
      );
      expect(finalRow.team_name).toBe("FC HĐH Gò Nổi tại TP.HCM");
    } finally {
      sqliteDb.close();
    }
  });

  it("handles empty or unknown-only payload safely without unintended updates (Task H)", async () => {
    const { sqliteDb } = setupSettingsRouteWithMemoryDb();
    try {
      const req = makeAuthRequest(mockManager, {
        action: "update_settings",
        payload: { unknown_column: "malicious", id: 999 },
      });
      const res = await handleTeamPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.settings.team_name).toBe("FC HĐH Gò Nổi tại TP.HCM");
      expect(data.settings.fanpage_url).toBe(
        "https://www.facebook.com/CustomGoNoiPage/"
      );
    } finally {
      sqliteDb.close();
    }
  });
});

describe("Phase 3.5 – Task C: Transaction-Safe Reset (LocalSqliteAdapter & TursoDbAdapter)", () => {
  it("rolls back all deletes and partial inserts when an error occurs mid-reset, and leaves connection usable", async () => {
    const sqliteDb = createInMemorySqlite();
    const adapter = new LocalSqliteAdapter(sqliteDb);

    try {
      // 1. Seed initial data first
      await seedAsyncInitialDataIfNeeded(adapter, false);

      // 2. Add custom pre-reset data
      await adapter.run(
        `UPDATE team_settings SET team_name = ?, tournament_fund_reserve = ? WHERE id = 1`,
        ["Custom Pre-Reset Team", 3100000]
      );
      await adapter.run(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, position, access_role)
         VALUES (99, 'Cầu Thủ Trước Reset', 'TrướcReset', 99, 'Tiền đạo', 'player')`
      );
      await adapter.run(
        `INSERT INTO expenses (expense_date, category, description, amount, payer)
         VALUES ('2026-11-12', 'Nước uống', 'Nước trước reset', 150000, 'Tiếng')`
      );

      const beforeCounts = {
        players: (await adapter.query("SELECT id FROM players")).length,
        matches: (await adapter.query("SELECT id FROM matches")).length,
        attendances: (await adapter.query("SELECT id FROM match_attendances")).length,
        expenses: (await adapter.query("SELECT id FROM expenses")).length,
        otherIncomes: (await adapter.query("SELECT id FROM other_incomes")).length,
        settings: await adapter.queryOne<TeamSettings>(
          "SELECT * FROM team_settings WHERE id = 1"
        ),
      };

      // 3. Wrap adapter.transaction to simulate a failure AFTER DELETEs and partial INSERTs
      let insertCount = 0;
      const failingAdapter: dbModule.AsyncDb = {
        query: adapter.query.bind(adapter),
        queryOne: adapter.queryOne.bind(adapter),
        run: adapter.run.bind(adapter),
        exec: adapter.exec.bind(adapter),
        batch: adapter.batch.bind(adapter),
        transaction: async (fn) => {
          return adapter.transaction(async (tx) => {
            const wrappedTx: dbModule.AsyncDbTx = {
              query: tx.query,
              queryOne: tx.queryOne,
              exec: tx.exec,
              run: async (sql, params) => {
                if (sql.trim().toUpperCase().startsWith("INSERT")) {
                  insertCount++;
                  if (insertCount === 5) {
                    throw new Error("Simulated failure mid-reset");
                  }
                }
                return tx.run(sql, params);
              },
            };
            return fn(wrappedTx);
          });
        },
      };

      await expect(
        seedAsyncInitialDataIfNeeded(failingAdapter, true)
      ).rejects.toThrow("Simulated failure mid-reset");

      // 4. Verify full rollback to pre-reset state
      const afterFailCounts = {
        players: (await adapter.query("SELECT id FROM players")).length,
        matches: (await adapter.query("SELECT id FROM matches")).length,
        attendances: (await adapter.query("SELECT id FROM match_attendances")).length,
        expenses: (await adapter.query("SELECT id FROM expenses")).length,
        otherIncomes: (await adapter.query("SELECT id FROM other_incomes")).length,
        settings: await adapter.queryOne<TeamSettings>(
          "SELECT * FROM team_settings WHERE id = 1"
        ),
      };

      expect(afterFailCounts).toEqual(beforeCounts);

      // 5. Verify transaction is not hung/stuck: normal query + successful reset commit cleanly
      await expect(seedAsyncInitialDataIfNeeded(adapter, true)).resolves.toBeUndefined();
      const postResetSettings = await adapter.queryOne<TeamSettings>(
        "SELECT * FROM team_settings WHERE id = 1"
      );
      expect(postResetSettings?.team_name).toBe("Đội Bóng HĐH Gò Nổi");
      expect(postResetSettings?.tournament_fund_reserve).toBe(2301700);
      const postResetPlayers = await adapter.query<{ full_name: string }>(
        "SELECT full_name FROM players WHERE full_name = ?",
        ["Cầu Thủ Trước Reset"]
      );
      expect(postResetPlayers).toHaveLength(0);
    } finally {
      sqliteDb.close();
    }
  });

  it("TursoDbAdapter.transaction commits & closes on success, and rolls back & closes on failure", async () => {
    const commitMock = vi.fn().mockResolvedValue(undefined);
    const rollbackMock = vi.fn().mockResolvedValue(undefined);
    const closeMock = vi.fn();
    const executeMock = vi.fn().mockResolvedValue({
      rows: [],
      lastInsertRowid: BigInt(1),
      rowsAffected: 1,
    });
    const executeMultipleMock = vi.fn().mockResolvedValue(undefined);

    const mockClient = {
      transaction: vi.fn().mockResolvedValue({
        execute: executeMock,
        executeMultiple: executeMultipleMock,
        commit: commitMock,
        rollback: rollbackMock,
        close: closeMock,
      }),
    } as unknown as Client;

    const tursoAdapter = new TursoDbAdapter(mockClient);

    // Success case
    const ok = await tursoAdapter.transaction(async (tx) => {
      await tx.exec("DELETE FROM players;");
      await tx.run("INSERT INTO players (name) VALUES (?)", ["Test"]);
      return "committed";
    });
    expect(ok).toBe("committed");
    expect(mockClient.transaction).toHaveBeenCalledWith("write");
    expect(commitMock).toHaveBeenCalledTimes(1);
    expect(rollbackMock).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledTimes(1);

    // Failure case
    commitMock.mockClear();
    rollbackMock.mockClear();
    closeMock.mockClear();

    await expect(
      tursoAdapter.transaction(async (tx) => {
        await tx.exec("DELETE FROM players;");
        throw new Error("Turso mid-reset failure");
      })
    ).rejects.toThrow("Turso mid-reset failure");

    expect(commitMock).not.toHaveBeenCalled();
    expect(rollbackMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("serializes external queries/writes while LocalSqliteAdapter.transaction is active without deadlock (Task G)", async () => {
    const sqliteDb = createInMemorySqlite();
    const adapter = new LocalSqliteAdapter(sqliteDb);

    try {
      await seedAsyncInitialDataIfNeeded(adapter, false);

      const events: string[] = [];
      let releaseTx!: () => void;
      const txHold = new Promise<void>((resolve) => {
        releaseTx = resolve;
      });

      const txPromise = adapter
        .transaction(async (tx) => {
          events.push("tx:start");
          await tx.run(
            "INSERT INTO expenses (expense_date, category, description, amount, payer) VALUES (?, ?, ?, ?, ?)",
            ["2026-11-13", "Khác", "Inside failing tx", 50000, "Tiếng"]
          );
          await txHold;
          events.push("tx:throwing");
          throw new Error("Abort tx");
        })
        .catch((err: Error) => err.message);

      // Give txPromise a microtask tick to enter BEGIN TRANSACTION
      await Promise.resolve();

      // Queue external write & read while transaction is open
      const externalWritePromise = adapter
        .run(
          "INSERT INTO expenses (expense_date, category, description, amount, payer) VALUES (?, ?, ?, ?, ?)",
          ["2026-11-13", "Nước uống", "External after tx", 75000, "Tiếng"]
        )
        .then(() => events.push("external:write"));

      const externalReadPromise = adapter
        .query<{ description: string }>(
          "SELECT description FROM expenses WHERE description IN ('Inside failing tx', 'External after tx')"
        )
        .then((rows) => {
          events.push("external:read");
          return rows.map((r) => r.description);
        });

      // External ops must NOT have completed before tx finishes
      await new Promise((r) => setTimeout(r, 20));
      expect(events).toEqual(["tx:start"]);

      releaseTx();

      const [txErr, , readRows] = await Promise.all([
        txPromise,
        externalWritePromise,
        externalReadPromise,
      ]);

      expect(txErr).toBe("Abort tx");
      expect(events).toEqual([
        "tx:start",
        "tx:throwing",
        "external:write",
        "external:read",
      ]);
      // Rolled-back insert is absent; external write succeeded cleanly after rollback
      expect(readRows).toEqual(["External after tx"]);
    } finally {
      sqliteDb.close();
    }
  });
});

describe("Phase 3.5 – Task E: Financial Calculations Regression", () => {
  it("keeps tournament reserve separate and excludes unpaid debt from totalIncome", () => {
    const attendances: MatchAttendance[] = [
      {
        id: 1,
        match_id: 1,
        player_id: 1,
        rsvp_status: "registered",
        walk_in: 0,
        attended: 1,
        paid: 1,
        amount: 100000,
        collected_by: "Tiếng",
        note: "",
      },
      {
        id: 2,
        match_id: 1,
        player_id: 2,
        rsvp_status: "registered",
        walk_in: 0,
        attended: 1,
        paid: 0,
        amount: 100000,
        collected_by: "",
        note: "Chưa đóng",
      },
    ];
    const otherIncomes: OtherIncome[] = [
      {
        id: 1,
        income_date: "2026-11-02",
        contributor: "Tài trợ",
        amount: 500000,
        fund_type: "Quỹ sinh hoạt",
        note: "",
      },
      {
        id: 2,
        income_date: "2026-11-02",
        contributor: "Quỹ giải riêng",
        amount: 0,
        fund_type: "Ghi chú Quỹ giải",
        note: "2,301,700đ",
      },
    ];
    const expenses: ExpenseRecord[] = [
      {
        id: 1,
        expense_date: "2026-11-01",
        category: "Tiền sân",
        description: "Tiền sân Trận 1",
        amount: 400000,
        payer: "Tiếng",
        match_id: 1,
      },
    ];

    const summary = calculateFinancialSummary({
      attendances,
      otherIncomes,
      expenses,
    });

    expect(summary.totalMatchIncome).toBe(100000);
    expect(summary.totalOtherIncome).toBe(500000);
    expect(summary.totalIncome).toBe(600000);
    expect(summary.totalExpense).toBe(400000);
    expect(summary.currentBalance).toBe(200000);
    expect(summary.totalUnpaidAmount).toBe(100000);
  });
});
