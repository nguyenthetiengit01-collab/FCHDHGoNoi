import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getAuthRoute, POST as postAuthRoute } from "@/app/api/auth/route";
import { GET as getTeamRoute, POST as postTeamRoute } from "@/app/api/team/route";
import { POST as postImportRoute } from "@/app/api/import/route";
import {
  createSessionToken,
  hashPassword,
  projectSafePlayer,
  sanitizeTeamResponseData,
  SESSION_COOKIE_NAME,
} from "./auth";
import {
  __resetAuthRateLimitForTest,
  __setAuthRateLimitDriverForTest,
  type AuthRateLimitDriver,
} from "./authRateLimit";
import * as dbModule from "./db";
import type { AsyncDb } from "./db";
import type { FullAppData, Player } from "@/types/app";

const VALID_TEST_SECRET = "phase71-valid-test-auth-secret-at-least-32-chars!";
const tempDirs: string[] = [];

function createInMemoryRateLimiter(): AuthRateLimitDriver {
  const allow = async () => ({
    success: true,
    remaining: 99,
    reset: Date.now() + 60_000,
  });
  return {
    limitAccount: allow,
    limitIp: allow,
    limitPair: allow,
    async resetAccount() {},
    async resetPair() {},
  };
}

function createPhase71TestDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-p71-"));
  tempDirs.push(dir);
  const sqlitePath = path.join(dir, "phase71.sqlite");
  const raw = new DatabaseSync(sqlitePath);

  raw.exec(`
    CREATE TABLE team_settings (
      id INTEGER PRIMARY KEY,
      team_name TEXT NOT NULL DEFAULT 'FC HĐH Gò Nổi',
      short_name TEXT NOT NULL DEFAULT 'FC HĐH GÒ NỔI',
      default_match_fee INTEGER NOT NULL DEFAULT 100000,
      bank_bin TEXT NOT NULL DEFAULT '970422',
      bank_name TEXT NOT NULL DEFAULT 'MB Bank',
      bank_account_no TEXT NOT NULL DEFAULT '0123456789',
      bank_account_name TEXT NOT NULL DEFAULT 'QUY DOI',
      tournament_fund_reserve INTEGER NOT NULL DEFAULT 0,
      tournament_fund_note TEXT NOT NULL DEFAULT 'Ghi chú quỹ giải nội bộ',
      fanpage_url TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO team_settings (id) VALUES (1);

    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_order INTEGER NOT NULL DEFAULT 1,
      full_name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      jersey_number INTEGER,
      position TEXT NOT NULL DEFAULT 'Đa năng',
      phone TEXT NOT NULL DEFAULT '',
      birth_year TEXT NOT NULL DEFAULT '1995',
      avatar_url TEXT NOT NULL DEFAULT '',
      profile_image_url TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      hometown TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      playing_style TEXT NOT NULL DEFAULT '',
      gallery_urls_json TEXT NOT NULL DEFAULT '[]',
      role TEXT NOT NULL DEFAULT 'Thành viên',
      access_role TEXT NOT NULL DEFAULT 'player',
      username TEXT NOT NULL DEFAULT '',
      pin_code TEXT NOT NULL DEFAULT '1234',
      status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_number INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      match_date TEXT NOT NULL,
      kickoff_time TEXT NOT NULL DEFAULT '19:30',
      venue TEXT NOT NULL DEFAULT 'Sân Test',
      opponent TEXT NOT NULL DEFAULT 'Đội Test',
      fee_per_player INTEGER NOT NULL DEFAULT 100000,
      pitch_cost INTEGER NOT NULL DEFAULT 900000,
      payer_name TEXT NOT NULL DEFAULT '',
      team_score INTEGER,
      opponent_score INTEGER,
      status TEXT NOT NULL DEFAULT 'Sắp diễn ra',
      notes TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO matches (match_number, label, match_date, status) VALUES (1, 'Trận 1', '2026-11-20', 'Sắp diễn ra');

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
      source TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      sponsor_id INTEGER
    );
    INSERT INTO other_incomes (income_date, source, description, amount) VALUES ('2026-11-01', 'Tài trợ', 'Tài trợ test', 500000);

    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      payer TEXT NOT NULL,
      match_id INTEGER
    );
    INSERT INTO expenses (expense_date, category, description, amount, payer) VALUES ('2026-11-01', 'Tiền sân', 'Sân test', 300000, 'Manager');

    CREATE TABLE club_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Tin tức',
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      gallery_urls_json TEXT NOT NULL DEFAULT '[]',
      published_date TEXT NOT NULL DEFAULT '2026-11-01',
      author_name TEXT NOT NULL DEFAULT 'BQL',
      is_pinned INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE sponsors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'Đồng hành',
      logo_url TEXT NOT NULL DEFAULT '',
      website_url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      actor_name TEXT,
      actor_role TEXT,
      action TEXT,
      summary TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const runExec = (sql: string, params: unknown[]) => {
    const info = raw.prepare(sql).run(...(params as never[]));
    return {
      lastInsertRowid: Number(info.lastInsertRowid || 0),
      changes: Number(info.changes || 0),
    };
  };

  const db: AsyncDb = {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
    async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      return (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
    },
    async run(sql: string, params: unknown[] = []) {
      return runExec(sql, params);
    },
    async exec(sql: string) {
      raw.exec(sql);
    },
    async batch(statements: Array<{ sql: string; params?: unknown[] }>) {
      for (const stmt of statements) {
        raw.prepare(stmt.sql).run(...((stmt.params || []) as never[]));
      }
    },
    async transaction<T>(fn: (tx: dbModule.AsyncDbTx) => Promise<T>): Promise<T> {
      raw.exec("BEGIN");
      try {
        const res = await fn({
          query: db.query,
          queryOne: db.queryOne,
          run: db.run,
          exec: db.exec,
        });
        raw.exec("COMMIT");
        return res;
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    },
  };

  return { raw, db };
}

function spyFullAppDataFromTestDb(raw: DatabaseSync) {
  return vi.spyOn(dbModule, "getFullAppData").mockImplementation(async () => {
    const settings = raw
      .prepare("SELECT * FROM team_settings WHERE id = 1")
      .get() as unknown as FullAppData["settings"];
    const players = (
      raw.prepare("SELECT * FROM players ORDER BY code_order ASC, id ASC").all() as unknown as Player[]
    ).map((p) => ({
      ...p,
      pin_code: "",
      profile_image_url: p.profile_image_url || "",
      gallery_urls: [],
    }));
    const matches = raw.prepare("SELECT * FROM matches ORDER BY match_number ASC").all() as unknown as FullAppData["matches"];
    const attendances = raw.prepare("SELECT * FROM match_attendances").all() as unknown as FullAppData["attendances"];
    const otherIncomes = raw.prepare("SELECT * FROM other_incomes").all() as unknown as FullAppData["otherIncomes"];
    const expenses = raw.prepare("SELECT * FROM expenses").all() as unknown as FullAppData["expenses"];
    return {
      settings,
      players,
      matches,
      attendances,
      otherIncomes,
      expenses,
      summary: {
        totalIncome: 500000,
        totalMatchIncome: 0,
        totalOtherIncome: 500000,
        totalExpense: 300000,
        currentBalance: 200000,
        totalMatchesCount: matches.length,
        totalPlayersCount: players.length,
        totalUnpaidAmount: 0,
        categoryBreakdown: [],
      },
      posts: [],
      sponsors: [],
    };
  });
}

function buildSyntheticFullAppData(): FullAppData {
  return {
    settings: {
      id: 1,
      team_name: "FC HĐH Gò Nổi tại TP.HCM",
      short_name: "FC HĐH GÒ NỔI",
      default_match_fee: 100000,
      bank_bin: "970422",
      bank_name: "MB Bank",
      bank_account_no: "000111222",
      bank_account_name: "QUY DOI",
      tournament_fund_reserve: 1000000,
      tournament_fund_note: "Ghi chú quỹ giải nội bộ",
      fanpage_url: "https://example.com",
    },
    players: [
      {
        id: 1,
        code_order: 1,
        full_name: "Nguyễn Quản Lý",
        short_name: "Quản Lý",
        jersey_number: 1,
        position: "GK",
        phone: "0901111111",
        birth_year: "1990",
        avatar_url: "",
        role: "Đội trưởng",
        access_role: "manager",
        username: "manager1",
        pin_code: hashPassword("MgrSecret@2026"),
        status: "Đang sinh hoạt",
        notes: "Ghi chú BQL",
      },
      {
        id: 2,
        code_order: 2,
        full_name: "Trần Cầu Thủ",
        short_name: "Cầu Thủ",
        jersey_number: 10,
        position: "MF",
        phone: "0902222222",
        birth_year: "1995",
        avatar_url: "",
        role: "Thành viên",
        access_role: "player",
        username: "player2",
        pin_code: hashPassword("PlrSecret@2026"),
        status: "Đang sinh hoạt",
        notes: "Ghi chú riêng player 2",
      },
      {
        id: 3,
        code_order: 3,
        full_name: "Lê Đồng Đội",
        short_name: "Đồng Đội",
        jersey_number: 7,
        position: "FW",
        phone: "0903333333",
        birth_year: "1996",
        avatar_url: "",
        role: "Thành viên",
        access_role: "player",
        username: "player3",
        pin_code: hashPassword("PeerSecret@2026"),
        status: "Đang sinh hoạt",
        notes: "Ghi chú riêng player 3",
      },
    ],
    matches: [],
    attendances: [],
    otherIncomes: [],
    expenses: [],
    summary: {
      totalIncome: 0,
      totalMatchIncome: 0,
      totalOtherIncome: 0,
      totalExpense: 0,
      currentBalance: 0,
      totalMatchesCount: 0,
      totalPlayersCount: 3,
      totalUnpaidAmount: 0,
      categoryBreakdown: [],
    },
  };
}

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match?.[1] || "";
}

afterEach(() => {
  vi.restoreAllMocks();
  __setAuthRateLimitDriverForTest(null);
  __resetAuthRateLimitForTest();
  delete process.env.AUTH_SECRET;
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("Phase 7.1 – Authentication, RBAC & Privacy Remediation", () => {
  it("allow-list DTO sanitization strips pin_code and private peer fields for player role", () => {
    const data = buildSyntheticFullAppData();
    const extraPlayer = {
      ...data.players[1],
      pwdFingerprint: "secret_fp",
      internal_hash: "secret_hash",
    } as unknown as Player;

    const projected = projectSafePlayer(extraPlayer);
    expect("pin_code" in projected).toBe(false);
    expect("pwdFingerprint" in (projected as unknown as Record<string, unknown>)).toBe(false);
    expect("internal_hash" in (projected as unknown as Record<string, unknown>)).toBe(false);

    const playerScoped = sanitizeTeamResponseData(data, {
      playerId: 2,
      accessRole: "player",
    });

    expect(playerScoped.settings.tournament_fund_note).toBe("");
    for (const p of playerScoped.players) {
      expect("pin_code" in p).toBe(false);
    }

    const own = playerScoped.players.find((p) => p.id === 2);
    const peer = playerScoped.players.find((p) => p.id === 3);
    const mgr = playerScoped.players.find((p) => p.id === 1);

    expect(own?.phone).toBe("0902222222");
    expect(own?.username).toBe("player2");
    expect(own?.notes).toBe("Ghi chú riêng player 2");

    expect(peer?.phone).toBe("");
    expect(peer?.username).toBe("");
    expect(peer?.notes).toBe("");
    expect(peer?.access_role).toBe("player");

    expect(mgr?.phone).toBe("");
    expect(mgr?.username).toBe("");
    expect(mgr?.notes).toBe("");
    expect(mgr?.access_role).toBe("player");
  });

  it("POST /api/team as player (set_rsvp, update_own_profile) returns sanitized DTO with no-store header", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, db } = createPhase71TestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppDataFromTestDb(raw);

    try {
      const mgrHash = hashPassword("MgrPass@2026");
      const plr2Hash = hashPassword("Plr2Pass@2026");
      const plr3Hash = hashPassword("Plr3Pass@2026");

      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, phone, access_role, username, pin_code, notes)
         VALUES (1, 'Manager One', 'Mgr', 1, '0901111111', 'manager', 'mgr1', ?, 'Mgr secret note'),
                (2, 'Player Two', 'Plr2', 10, '0902222222', 'player', 'plr2', ?, 'Plr2 note'),
                (3, 'Player Three', 'Plr3', 7, '0903333333', 'player', 'plr3', ?, 'Plr3 secret note')`
      ).run(mgrHash, plr2Hash, plr3Hash);

      const plr2Row = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
      const plr2Token = createSessionToken(plr2Row, 24);

      const rsvpRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${plr2Token}`,
          },
          body: JSON.stringify({
            action: "set_rsvp",
            payload: { match_id: 1, player_id: 2, rsvp_status: "yes" },
          }),
        })
      );

      expect(rsvpRes.status).toBe(200);
      expect(rsvpRes.headers.get("cache-control")).toContain("no-store");
      const rsvpJson = await rsvpRes.json();
      expect(rsvpJson.settings.tournament_fund_note).toBe("");
      for (const p of rsvpJson.players) {
        expect("pin_code" in p).toBe(false);
        if (p.id === 2) {
          expect(p.phone).toBe("0902222222");
        } else {
          expect(p.phone).toBe("");
          expect(p.username).toBe("");
          expect(p.notes).toBe("");
          expect(p.access_role).toBe("player");
        }
      }

      const profileRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${plr2Token}`,
          },
          body: JSON.stringify({
            action: "update_own_profile",
            payload: {
              player_id: 2,
              full_name: "Player Two Updated",
              short_name: "Plr2",
              phone: "0902222999",
            },
          }),
        })
      );

      expect(profileRes.status).toBe(200);
      expect(profileRes.headers.get("cache-control")).toContain("no-store");
      const profileJson = await profileRes.json();
      expect(profileJson.settings.tournament_fund_note).toBe("");
      for (const p of profileJson.players) {
        expect("pin_code" in p).toBe(false);
        if (p.id !== 2) {
          expect(p.phone).toBe("");
          expect(p.username).toBe("");
          expect(p.notes).toBe("");
          expect(p.access_role).toBe("player");
        }
      }
    } finally {
      raw.close();
    }
  });

  it("repairs change_own_password session refresh lifecycle and rejects old PIN & old session", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    __setAuthRateLimitDriverForTest(createInMemoryRateLimiter());
    const { raw, db } = createPhase71TestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppDataFromTestDb(raw);

    try {
      const oldPin = "OldPin@2026";
      const newPin = "NewPin@2026!";
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, phone, access_role, username, pin_code, status)
         VALUES (1, 'Lifecycle Player', 'Lifecycle', 8, '0908888888', 'player', 'lifecycle8', ?, 'Đang sinh hoạt')`
      ).run(hashPassword(oldPin));

      // 1. Login with old PIN
      const loginRes = await postAuthRoute(
        new NextRequest("http://localhost:3000/api/auth", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            action: "login",
            username: "lifecycle8",
            pin: oldPin,
          }),
        })
      );
      expect(loginRes.status).toBe(200);
      const loginJson = await loginRes.json();
      expect("pin_code" in loginJson.player).toBe(false);

      const initialCookie = extractSessionCookie(loginRes);
      expect(initialCookie.length).toBeGreaterThan(20);

      // 2. Change PIN via POST /api/team
      const changeRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${initialCookie}`,
          },
          body: JSON.stringify({
            action: "change_own_password",
            payload: {
              player_id: 1,
              old_pin: oldPin,
              new_pin: newPin,
            },
          }),
        })
      );
      expect(changeRes.status).toBe(200);
      const refreshedCookie = extractSessionCookie(changeRes);
      expect(refreshedCookie.length).toBeGreaterThan(20);
      expect(refreshedCookie).not.toBe(initialCookie);

      // 3. New session cookie works on GET /api/auth
      const authGetNew = await getAuthRoute(
        new NextRequest("http://localhost:3000/api/auth", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${refreshedCookie}` },
        })
      );
      expect(authGetNew.status).toBe(200);
      const authGetNewJson = await authGetNew.json();
      expect(authGetNewJson.authenticated).toBe(true);
      expect("pin_code" in authGetNewJson.player).toBe(false);

      // 4. New session cookie works on subsequent POST /api/team
      const postWithNew = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${refreshedCookie}`,
          },
          body: JSON.stringify({
            action: "set_rsvp",
            payload: { match_id: 1, player_id: 1, rsvp_status: "yes" },
          }),
        })
      );
      expect(postWithNew.status).toBe(200);

      // 5. Old session cookie is rejected on GET /api/auth and POST /api/team
      const authGetOld = await getAuthRoute(
        new NextRequest("http://localhost:3000/api/auth", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${initialCookie}` },
        })
      );
      const authGetOldJson = await authGetOld.json();
      expect(authGetOldJson.authenticated).toBe(false);

      const postWithOld = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${initialCookie}`,
          },
          body: JSON.stringify({
            action: "set_rsvp",
            payload: { match_id: 1, player_id: 1, rsvp_status: "no" },
          }),
        })
      );
      expect(postWithOld.status).toBe(401);

      // 6. Old PIN rejected on login; new PIN accepted
      const oldLoginRes = await postAuthRoute(
        new NextRequest("http://localhost:3000/api/auth", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            action: "login",
            username: "lifecycle8",
            pin: oldPin,
          }),
        })
      );
      expect(oldLoginRes.status).toBe(401);

      const newLoginRes = await postAuthRoute(
        new NextRequest("http://localhost:3000/api/auth", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            action: "login",
            username: "lifecycle8",
            pin: newPin,
          }),
        })
      );
      expect(newLoginRes.status).toBe(200);
    } finally {
      raw.close();
    }
  });

  it("POST /api/import response omits pin_code property from all players", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, db } = createPhase71TestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppDataFromTestDb(raw);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, access_role, username, pin_code)
         VALUES (1, 'Manager Import', 'Mgr', 1, 'manager', 'mgr_imp', ?)`
      ).run(hashPassword("MgrImp@2026"));

      const mgrRow = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrToken = createSessionToken(mgrRow, 24);

      const wb = XLSX.utils.book_new();
      const wsDanhSach = XLSX.utils.aoa_to_sheet([
        ["DANH SÁCH ĐỘI BÓNG"],
        [""],
        [""],
        ["STT", "Họ và tên", "Vị trí", "Số áo", "SĐT", "Ghi chú"],
        [1, "Manager Import", "GK", 1, "0901234567", ""],
        [2, "Cầu Thủ Mới", "MF", 19, "0907654321", ""],
      ]);
      const wsThuTran = XLSX.utils.aoa_to_sheet([["STT", "Họ và tên"]]);
      const wsChi = XLSX.utils.aoa_to_sheet([["Ngày", "Danh mục", "Nội dung", "Số tiền", "Người chi"]]);
      XLSX.utils.book_append_sheet(wb, wsDanhSach, "2. Danh sách");
      XLSX.utils.book_append_sheet(wb, wsThuTran, "3. Thu Trận (Tích chọn)");
      XLSX.utils.book_append_sheet(wb, wsChi, "5. Chi");

      const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      const formData = new FormData();
      formData.append(
        "file",
        new File([new Uint8Array(xlsxBuffer)], "team.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );

      const res = await postImportRoute(
        new NextRequest("http://localhost:3000/api/import", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: formData,
        })
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.players.length).toBeGreaterThanOrEqual(2);
      for (const p of json.players) {
        expect("pin_code" in p).toBe(false);
      }
    } finally {
      raw.close();
    }
  });

  it("rejects cross-player unauthorized mutations with 403 and validates GET /api/team against DB", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, db } = createPhase71TestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppDataFromTestDb(raw);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, phone, access_role, username, pin_code, status)
         VALUES (1, 'Manager A', 'MgrA', 1, '0901111111', 'manager', 'mgra', ?, 'Đang sinh hoạt'),
                (2, 'Player B', 'PlrB', 2, '0902222222', 'player', 'plrb', ?, 'Đang sinh hoạt'),
                (3, 'Player C', 'PlrC', 3, '0903333333', 'player', 'plrc', ?, 'Đang sinh hoạt')`
      ).run(hashPassword("MgrA@2026"), hashPassword("PlrB@2026"), hashPassword("PlrC@2026"));

      const plrB = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
      const plrBToken = createSessionToken(plrB, 24);

      for (const [action, payload] of [
        ["update_own_profile", { player_id: 3, full_name: "Tampered" }],
        ["change_own_password", { player_id: 3, old_pin: "PlrC@2026", new_pin: "Hack@2026" }],
        ["set_rsvp", { match_id: 1, player_id: 3, rsvp_status: "yes" }],
      ] as const) {
        const res = await postTeamRoute(
          new NextRequest("http://localhost:3000/api/team", {
            method: "POST",
            headers: {
              host: "localhost:3000",
              origin: "http://localhost:3000",
              cookie: `${SESSION_COOKIE_NAME}=${plrBToken}`,
            },
            body: JSON.stringify({ action, payload }),
          })
        );
        expect(res.status).toBe(403);
      }

      // P2-01: GET /api/team DB-backed validation falls back to guest public data when player becomes inactive
      raw.prepare("UPDATE players SET status = 'inactive' WHERE id = 2").run();
      const getInactiveRes = await getTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${plrBToken}` },
        })
      );
      expect(getInactiveRes.status).toBe(200);
      const inactiveJson = await getInactiveRes.json();
      expect(inactiveJson.expenses).toEqual([]);
      expect(inactiveJson.otherIncomes).toEqual([]);
      for (const p of inactiveJson.players) {
        expect("pin_code" in p).toBe(false);
        expect(p.phone).toBe("");
      }
    } finally {
      raw.close();
    }
  });

  it("F7.1-16: hashes walk-in default PIN with scrypt, omits pin_code from API response, and preserves reset/change flow", async () => {
    const { raw, db } = createPhase71TestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppDataFromTestDb(raw);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, phone, access_role, username, pin_code, status)
         VALUES (1, 'Manager A', 'MgrA', 1, '0901111111', 'manager', 'mgra', ?, 'Đang sinh hoạt')`
      ).run(hashPassword("MgrA@2026"));

      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrToken = createSessionToken(mgr, 24);

      const walkinRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: JSON.stringify({
            action: "add_walkin_player",
            payload: {
              match_id: 1,
              new_player_name: "Nguyễn Vãng Lai",
              amount: 100000,
              paid: 1,
            },
          }),
        })
      );

      expect(walkinRes.status).toBe(200);
      const walkinJson = await walkinRes.json();
      const apiWalkin = walkinJson.players.find(
        (p: { full_name: string }) => p.full_name === "Nguyễn Vãng Lai"
      );
      expect(apiWalkin).toBeDefined();
      expect("pin_code" in apiWalkin).toBe(false);

      const stored = raw
        .prepare("SELECT id, pin_code FROM players WHERE full_name = ?")
        .get("Nguyễn Vãng Lai") as { id: number; pin_code: string };

      expect(stored.pin_code).not.toBe("1234");
      expect(stored.pin_code.startsWith("scrypt$")).toBe(true);
      expect(verifyPassword("1234", stored.pin_code)).toBe(true);
      expect(verifyPassword("9999", stored.pin_code)).toBe(false);

      // Walk-in player can change own PIN from default "1234"
      const walkinPlayerRow = raw
        .prepare("SELECT * FROM players WHERE id = ?")
        .get(stored.id) as unknown as Player;
      const walkinToken = createSessionToken(walkinPlayerRow, 24);

      const changeRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${walkinToken}`,
          },
          body: JSON.stringify({
            action: "change_own_password",
            payload: {
              player_id: stored.id,
              old_pin: "1234",
              new_pin: "WalkinNew@2026",
            },
          }),
        })
      );
      expect(changeRes.status).toBe(200);

      const updatedStored = raw
        .prepare("SELECT pin_code FROM players WHERE id = ?")
        .get(stored.id) as { pin_code: string };
      expect(verifyPassword("WalkinNew@2026", updatedStored.pin_code)).toBe(true);
      expect(verifyPassword("1234", updatedStored.pin_code)).toBe(false);
    } finally {
      raw.close();
    }
  });
});
