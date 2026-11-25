import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getAuthRoute, POST as postAuthRoute } from "@/app/api/auth/route";
import {
  createSessionToken,
  getCurrentAuthContextFromToken,
  hashPassword,
  requireManagerSession,
  requirePlayerSession,
  SESSION_COOKIE_NAME,
  verifyCredentials,
} from "./auth";
import {
  __resetAuthRateLimitForTest,
  __setAuthRateLimitDriverForTest,
  type AuthRateLimitDriver,
} from "./authRateLimit";
import * as dbModule from "./db";
import type { AsyncDb } from "./db";
import { getHomePageInitialData } from "./publicHome";
import type { FullAppData, Player } from "@/types/app";

const VALID_TEST_SECRET = "phase711-ssr-test-auth-secret-at-least-32-chars!";
const tempDirs: string[] = [];

function createSsrTestDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-p711-"));
  tempDirs.push(dir);
  const sqlitePath = path.join(dir, "phase711.sqlite");
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
      tournament_fund_reserve INTEGER NOT NULL DEFAULT 2301700,
      tournament_fund_note TEXT NOT NULL DEFAULT 'SECRET_FUND_NOTE_SSR',
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
      pin_code TEXT NOT NULL DEFAULT '',
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
      payer_name TEXT NOT NULL DEFAULT 'SECRET_SSR_PAYER',
      team_score INTEGER,
      opponent_score INTEGER,
      status TEXT NOT NULL DEFAULT 'Sắp diễn ra',
      notes TEXT NOT NULL DEFAULT 'SECRET_SSR_MATCH_NOTE'
    );
    INSERT INTO matches (match_number, label, match_date) VALUES (1, 'Trận 1', '2026-11-25');

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
      note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE other_incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      income_date TEXT NOT NULL,
      source TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      sponsor_id INTEGER
    );

    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      payer TEXT NOT NULL,
      match_id INTEGER
    );

    CREATE TABLE club_posts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'tin-tuc',
      category_label TEXT NOT NULL DEFAULT 'Tin tức',
      category_badge_class TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT 'Post',
      slug TEXT NOT NULL DEFAULT 'post',
      summary TEXT NOT NULL DEFAULT '',
      published_date TEXT NOT NULL DEFAULT '2026-11-20',
      event_year TEXT NOT NULL DEFAULT '2026',
      author TEXT NOT NULL DEFAULT 'BQL',
      featured_image TEXT NOT NULL DEFAULT '',
      reading_time TEXT NOT NULL DEFAULT '3 phút',
      tagged_players_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE sponsors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Sponsor',
      tier TEXT NOT NULL DEFAULT 'partner',
      logo_url TEXT NOT NULL DEFAULT '',
      banner_url TEXT NOT NULL DEFAULT '',
      website_url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      display_positions_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT ''
    );
  `);

  const adapter: AsyncDb = {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
    async queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      return (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
    },
    async run(sql: string, params: unknown[] = []) {
      const info = raw.prepare(sql).run(...(params as never[]));
      return {
        lastInsertRowid: Number(info.lastInsertRowid ?? 0),
        changes: Number(info.changes ?? 0),
      };
    },
    async exec(sql: string) {
      raw.exec(sql);
    },
    async batch(statements) {
      for (const s of statements) {
        raw.prepare(s.sql).run(...((s.params || []) as never[]));
      }
    },
    async transaction(fn) {
      return fn(this);
    },
  };

  return { raw, adapter };
}

afterEach(() => {
  vi.restoreAllMocks();
  __resetAuthRateLimitForTest();
  delete process.env.AUTH_SECRET;
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createAllowAllRateLimiter(): AuthRateLimitDriver {
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

describe("Phase 7.1.1 — SSR HomePage DB-first Authorization", () => {
  it("uses DB role instead of stale token accessRole and falls back to public data when inactive, PIN changed, or token invalid", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, adapter } = createSsrTestDb();
    try {
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter);
      vi.spyOn(dbModule, "getFullAppData").mockImplementation(async () => {
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
        const matches = raw
          .prepare("SELECT * FROM matches ORDER BY match_number ASC")
          .all() as unknown as FullAppData["matches"];
        const attendances = raw
          .prepare("SELECT * FROM match_attendances")
          .all() as unknown as FullAppData["attendances"];
        return {
          settings,
          players,
          matches,
          attendances,
          otherIncomes: [],
          expenses: [],
          summary: {
            totalIncome: 0,
            totalMatchIncome: 0,
            totalOtherIncome: 0,
            totalExpense: 0,
            currentBalance: 0,
            totalUnpaidAmount: 0,
            categoryBreakdown: [],
          },
          posts: [],
          sponsors: [],
        };
      });

      raw
        .prepare(
          "INSERT INTO players (code_order, full_name, short_name, phone, access_role, username, pin_code, status, notes) VALUES (1, 'Manager One', 'Mgr1', '0901111111', 'manager', 'mgr1', ?, 'Đang sinh hoạt', 'MGR_PRIVATE_NOTE')"
        )
        .run(hashPassword("MgrSsr@2026"));
      raw
        .prepare(
          "INSERT INTO players (code_order, full_name, short_name, phone, access_role, username, pin_code, status, notes) VALUES (2, 'Player Two', 'Plr2', '0902222222', 'player', 'plr2', ?, 'Đang sinh hoạt', 'PLR2_PRIVATE_NOTE')"
        )
        .run(hashPassword("PlrSsr@2026"));

      const mgrRow = raw
        .prepare("SELECT * FROM players WHERE username = 'mgr1'")
        .get() as unknown as Player;
      const staleManagerCookie = createSessionToken(mgrRow, 24);

      // 1. Valid DB manager receives full data (with pin_code stripped)
      const data1 = await getHomePageInitialData(staleManagerCookie);
      expect(data1.players.find((p) => p.id === 2)?.phone).toBe("0902222222");
      expect(data1.settings.tournament_fund_note).toBe("SECRET_FUND_NOTE_SSR");
      expect(data1.players.every((p) => p.pin_code === "")).toBe(true);

      // 2. Demoted to player in DB: old manager cookie MUST NOT get manager data
      raw.prepare("UPDATE players SET access_role = 'player' WHERE id = 1").run();
      const data2 = await getHomePageInitialData(staleManagerCookie);
      expect(data2.settings.tournament_fund_note).toBe("");
      expect(data2.players.find((p) => p.id === 2)?.phone).toBe("");
      expect(data2.players.find((p) => p.id === 2)?.notes).toBe("");
      expect(data2.players.find((p) => p.id === 1)?.phone).toBe("0901111111");

      // 3. Inactive account: old cookie gets public data only
      raw.prepare("UPDATE players SET status = 'inactive' WHERE id = 1").run();
      const data3 = await getHomePageInitialData(staleManagerCookie);
      expect(JSON.stringify(data3)).not.toContain("0901111111");
      expect(JSON.stringify(data3)).not.toContain("SECRET_SSR_PAYER");
      expect(JSON.stringify(data3)).not.toContain("SECRET_SSR_MATCH_NOTE");
      expect(JSON.stringify(data3)).not.toContain("SECRET_FUND_NOTE_SSR");

      // 4. PIN hash changed while account remains active + manager: old cookie MUST return public data only
      raw
        .prepare("UPDATE players SET status = 'Đang sinh hoạt', access_role = 'manager', pin_code = ? WHERE id = 1")
        .run(hashPassword("NewMgrSsr@2026"));
      const data4 = await getHomePageInitialData(staleManagerCookie);
      expect(JSON.stringify(data4)).not.toContain("0901111111");
      expect(JSON.stringify(data4)).not.toContain("0902222222");
      expect(JSON.stringify(data4)).not.toContain("MGR_PRIVATE_NOTE");
      expect(JSON.stringify(data4)).not.toContain("PLR2_PRIVATE_NOTE");
      expect(JSON.stringify(data4)).not.toContain("SECRET_SSR_PAYER");
      expect(JSON.stringify(data4)).not.toContain("SECRET_SSR_MATCH_NOTE");
      expect(JSON.stringify(data4)).not.toContain("SECRET_FUND_NOTE_SSR");
      expect(data4.settings.tournament_fund_note).toBe("");
      expect(data4.otherIncomes).toEqual([]);
      expect(data4.expenses).toEqual([]);

      // 5. Tampered or expired token gets public data only
      const data5 = await getHomePageInitialData(`${staleManagerCookie.slice(0, -4)}zzzz`);
      expect(JSON.stringify(data5)).not.toContain("0901111111");
      expect(JSON.stringify(data5)).not.toContain("SECRET_SSR_PAYER");

      // 6. SSR page.tsx no longer uses verifySessionToken or session.accessRole
      const pageSource = fs.readFileSync(
        path.join(process.cwd(), "src", "app", "page.tsx"),
        "utf8"
      );
      expect(pageSource).not.toContain("session.accessRole");
      expect(pageSource).not.toContain("verifySessionToken");
      expect(pageSource).toContain("getHomePageInitialData");
    } finally {
      raw.close();
    }
  });

  it("returns 503 (never 401) across getCurrentAuthContextFromToken, requireManagerSession, and requirePlayerSession when DB query fails", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, adapter } = createSsrTestDb();
    try {
      raw
        .prepare(
          "INSERT INTO players (code_order, full_name, short_name, phone, access_role, username, pin_code, status) VALUES (1, 'Manager DB', 'Mgr', '0901111111', 'manager', 'mgrdb', ?, 'Đang sinh hoạt')"
        )
        .run(hashPassword("MgrSsr@2026"));

      const mgrRow = raw
        .prepare("SELECT * FROM players WHERE username = 'mgrdb'")
        .get() as unknown as Player;
      const token = createSessionToken(mgrRow, 24);

      const failingAdapter: AsyncDb = {
        ...adapter,
        async query() {
          throw new Error("Simulated Turso network timeout");
        },
      };
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(failingAdapter);

      const ctxRes = await getCurrentAuthContextFromToken(token);
      expect(ctxRes.authorized).toBe(false);
      expect(ctxRes.status).toBe(503);

      const req = new NextRequest("http://localhost:3000/api/team", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });

      const mgrRes = await requireManagerSession(req);
      expect(mgrRes.authorized).toBe(false);
      expect(mgrRes.status).toBe(503);

      const plrRes = await requirePlayerSession(req);
      expect(plrRes.authorized).toBe(false);
      expect(plrRes.status).toBe(503);

      const getAuthRes = await getAuthRoute(
        new NextRequest("http://localhost:3000/api/auth", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
        })
      );
      expect(getAuthRes.status).toBe(503);
    } finally {
      raw.close();
    }
  });

  it("enforces canonical player lifecycle policy across verifyCredentials, getCurrentAuthContextFromToken, GET /api/auth, requireManagerSession, requirePlayerSession, and SSR", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    __setAuthRateLimitDriverForTest(createAllowAllRateLimiter());
    const { raw, adapter } = createSsrTestDb();
    try {
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter);
      vi.spyOn(dbModule, "getFullAppData").mockImplementation(async () => {
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
        const matches = raw
          .prepare("SELECT * FROM matches ORDER BY match_number ASC")
          .all() as unknown as FullAppData["matches"];
        const attendances = raw
          .prepare("SELECT * FROM match_attendances")
          .all() as unknown as FullAppData["attendances"];
        return {
          settings,
          players,
          matches,
          attendances,
          otherIncomes: [],
          expenses: [],
          summary: {
            totalIncome: 0,
            totalMatchIncome: 0,
            totalOtherIncome: 0,
            totalExpense: 0,
            currentBalance: 0,
            totalUnpaidAmount: 0,
            categoryBreakdown: [],
          },
          posts: [],
          sponsors: [],
        };
      });

      const mgrPin = "MgrLife@2026";
      const plrPin = "PlrLife@2026";
      raw
        .prepare(
          "INSERT INTO players (code_order, full_name, short_name, phone, access_role, username, pin_code, status, notes) VALUES (1, 'Mgr Lifecycle', 'MgrL', '0901111111', 'manager', 'mgrlife', ?, 'Đang sinh hoạt', 'MGR_PRIVATE')"
        )
        .run(hashPassword(mgrPin));
      raw
        .prepare(
          "INSERT INTO players (code_order, full_name, short_name, phone, access_role, username, pin_code, status, notes) VALUES (2, 'Plr Lifecycle', 'PlrL', '0902222222', 'player', 'plrlife', ?, 'Đang sinh hoạt', 'PLR_PRIVATE')"
        )
        .run(hashPassword(plrPin));

      const mgrRow = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const plrRow = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
      const mgrToken = createSessionToken(mgrRow, 24);
      const plrToken = createSessionToken(plrRow, 24);

      // 1 & 2. Allowed statuses: "Đang sinh hoạt" (active) and "Tạm nghỉ" (paused)
      for (const allowedStatus of ["Đang sinh hoạt", "Tạm nghỉ"]) {
        raw.prepare("UPDATE players SET status = ? WHERE id IN (1, 2)").run(allowedStatus);

        const loginRes = await verifyCredentials("mgrlife", mgrPin, "127.0.0.1");
        expect(loginRes.success).toBe(true);

        const ctx = await getCurrentAuthContextFromToken(mgrToken);
        expect(ctx.authorized).toBe(true);
        if (ctx.authorized) {
          expect(ctx.role).toBe("manager");
        }

        const req = new NextRequest("http://localhost:3000/api/auth", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${mgrToken}` },
        });
        const authRes = await getAuthRoute(req);
        expect(authRes.status).toBe(200);
        const authJson = await authRes.json();
        expect(authJson.authenticated).toBe(true);
        expect(authJson.role).toBe("manager");

        expect((await requireManagerSession(req)).authorized).toBe(true);
        expect((await requirePlayerSession(req)).authorized).toBe(true);

        const ssrData = await getHomePageInitialData(mgrToken);
        expect(ssrData.players.find((p) => p.id === 2)?.phone).toBe("0902222222");
      }

      // 3-8. Denied statuses: stopped ("Ngừng tham gia", "Đã nghỉ", "Ngưng", "Rời đội"), "inactive", and empty/unknown ("", "Khác", "unknown_xyz")
      for (const deniedStatus of [
        "Ngừng tham gia",
        "Đã nghỉ",
        "Ngưng",
        "Rời đội",
        "inactive",
        "",
        "Khác",
        "unknown_xyz",
      ]) {
        raw.prepare("UPDATE players SET status = ? WHERE id IN (1, 2)").run(deniedStatus);

        const mgrLogin = await verifyCredentials("mgrlife", mgrPin, "127.0.0.1");
        expect(mgrLogin.success).toBe(false);
        expect(mgrLogin.status).toBe(401);

        const plrLogin = await verifyCredentials("plrlife", plrPin, "127.0.0.1");
        expect(plrLogin.success).toBe(false);
        expect(plrLogin.status).toBe(401);

        // 9. Manager cookie rejected
        const mgrCtx = await getCurrentAuthContextFromToken(mgrToken);
        expect(mgrCtx.authorized).toBe(false);
        expect(mgrCtx.status).toBe(401);

        // 10. Player cookie rejected
        const plrCtx = await getCurrentAuthContextFromToken(plrToken);
        expect(plrCtx.authorized).toBe(false);
        expect(plrCtx.status).toBe(401);

        const mgrReq = new NextRequest("http://localhost:3000/api/auth", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${mgrToken}` },
        });
        const authGetRes = await getAuthRoute(mgrReq);
        const authGetJson = await authGetRes.json();
        expect(authGetJson.authenticated).toBe(false);

        expect((await requireManagerSession(mgrReq)).status).toBe(401);
        expect((await requirePlayerSession(mgrReq)).status).toBe(401);

        // 13. Guest/public fallback for SSR when stopped/inactive/unknown
        const ssrMgrFallback = await getHomePageInitialData(mgrToken);
        expect(JSON.stringify(ssrMgrFallback)).not.toContain("0901111111");
        expect(JSON.stringify(ssrMgrFallback)).not.toContain("0902222222");
        expect(JSON.stringify(ssrMgrFallback)).not.toContain("MGR_PRIVATE");
        expect(JSON.stringify(ssrMgrFallback)).not.toContain("SECRET_SSR_PAYER");
        expect(JSON.stringify(ssrMgrFallback)).not.toContain("SECRET_FUND_NOTE_SSR");

        const ssrPlrFallback = await getHomePageInitialData(plrToken);
        expect(JSON.stringify(ssrPlrFallback)).not.toContain("0902222222");
        expect(JSON.stringify(ssrPlrFallback)).not.toContain("PLR_PRIVATE");
      }

      // 11. Role change in DB (manager -> player): old manager token loses manager privileges across SSR, GET /api/auth, and requireManagerSession
      raw.prepare("UPDATE players SET status = 'Đang sinh hoạt', access_role = 'player' WHERE id = 1").run();
      const demotedReq = new NextRequest("http://localhost:3000/api/auth", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${mgrToken}` },
      });
      const demotedGetJson = await (await getAuthRoute(demotedReq)).json();
      expect(demotedGetJson.authenticated).toBe(true);
      expect(demotedGetJson.role).toBe("player");
      expect((await requireManagerSession(demotedReq)).status).toBe(403);
      const demotedSsr = await getHomePageInitialData(mgrToken);
      expect(demotedSsr.players.find((p) => p.id === 2)?.phone).toBe("");
      expect(demotedSsr.settings.tournament_fund_note).toBe("");
    } finally {
      raw.close();
    }
  });

  it("returns HTTP 503 on POST /api/auth for DB failures (candidate lookup, PIN lookup, hydration, rate-limit) while preserving 401/403/429 and 500 on programming errors", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    __setAuthRateLimitDriverForTest(createAllowAllRateLimiter());
    const { raw, adapter } = createSsrTestDb();
    try {
      const mgrPin = "MgrDbErr@2026";
      raw
        .prepare(
          "INSERT INTO players (code_order, full_name, short_name, phone, access_role, username, pin_code, status) VALUES (1, 'Mgr Err', 'MgrE', '0901111111', 'manager', 'mgre', ?, 'Đang sinh hoạt')"
        )
        .run(hashPassword(mgrPin));
      raw
        .prepare(
          "INSERT INTO players (code_order, full_name, short_name, phone, access_role, username, pin_code, status) VALUES (2, 'Default Pin', 'DefP', '0902222222', 'player', 'defp', '1234', 'Đang sinh hoạt')"
        )
        .run();

      raw.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_id INTEGER NOT NULL,
          actor_name TEXT NOT NULL,
          actor_role TEXT NOT NULL,
          action TEXT NOT NULL,
          summary TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      raw
        .prepare(
          "INSERT INTO players (code_order, full_name, short_name, phone, access_role, username, pin_code, status) VALUES (3, 'Switch Target', 'SwT', '0903333333', 'player', 'swt', ?, 'Đang sinh hoạt')"
        )
        .run(hashPassword("SwitchTarget@2026"));

      const mgrRow = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrToken = createSessionToken(mgrRow, 24);

      const makeLoginReq = (username: string, pin: string) =>
        new NextRequest("http://localhost:3000/api/auth", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({ action: "login", username, pin }),
        });

      const makeSwitchReq = (playerId: number, action: "switch_role" | "quick_login" = "switch_role", cookieToken = mgrToken) =>
        new NextRequest("http://localhost:3000/api/auth", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${cookieToken}`,
          },
          body: JSON.stringify({ action, playerId }),
        });

      const assertNoSessionCookie = (res: Response) => {
        const setCookie = res.headers.get("set-cookie") || "";
        expect(setCookie).not.toContain(`${SESSION_COOKIE_NAME}=`);
      };

      // 1. Turso timeout / ECONNRESET / ECONNREFUSED / LibsqlError allowlist / TypeError("fetch failed") on candidate lookup -> 503
      const outageErrors: unknown[] = [
        Object.assign(new Error("Turso candidate lookup timeout"), { code: "ETIMEDOUT" }),
        Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
        Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
        Object.assign(new Error("Hrana server error"), { name: "LibsqlError", code: "SERVER_ERROR" }),
        Object.assign(new Error("Hrana websocket error"), { name: "LibsqlError", code: "HRANA_WEBSOCKET_ERROR" }),
        Object.assign(new Error("Gateway unavailable"), { name: "LibsqlError", code: "HTTP_STATUS_503" }),
        Object.assign(new Error("SQLite busy"), { name: "LibsqlError", code: "SQLITE_BUSY" }),
        new TypeError("fetch failed"),
        new TypeError("fetch failed", { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) }),
      ];

      for (const err of outageErrors) {
        vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
          ...adapter,
          async query() {
            throw err;
          },
        });
        const res = await postAuthRoute(makeLoginReq("mgre", mgrPin));
        expect(res.status).toBe(503);
        assertNoSessionCookie(res);
      }

      // 1b. P1-01: getAsyncDb() throwing DB configuration/init error -> 503; throwing programming/arbitrary error -> 500
      vi.spyOn(dbModule, "getAsyncDb").mockImplementation(() => {
        throw new Error("Database configuration error: TURSO_DATABASE_URL is required when Turso is enabled.");
      });
      const dbInitErrRes = await postAuthRoute(makeLoginReq("mgre", mgrPin));
      expect(dbInitErrRes.status).toBe(503);
      assertNoSessionCookie(dbInitErrRes);

      const ctxInitErr = await getCurrentAuthContextFromToken(mgrToken);
      expect(ctxInitErr.authorized).toBe(false);
      expect(ctxInitErr.status).toBe(503);

      vi.spyOn(dbModule, "getAsyncDb").mockImplementation(() => {
        throw new TypeError("Unexpected getAsyncDb programming bug");
      });
      const dbInitProgErrRes = await postAuthRoute(makeLoginReq("mgre", mgrPin));
      expect(dbInitProgErrRes.status).toBe(500);
      assertNoSessionCookie(dbInitProgErrRes);
      await expect(getCurrentAuthContextFromToken(mgrToken)).rejects.toThrow(TypeError);

      // 1c. P1-02 & P2-02: Non-transient SQL errors and HTTP 400/401/403 LibsqlErrors must NOT return 503
      for (const nonOutageErr of [
        Object.assign(new Error("Bad request"), { name: "LibsqlError", code: "HTTP_STATUS_400" }),
        Object.assign(new Error("Unauthorized token"), { name: "LibsqlError", code: "HTTP_STATUS_401" }),
        Object.assign(new Error("Forbidden"), { name: "LibsqlError", code: "HTTP_STATUS_403" }),
        Object.assign(new Error("SQLite syntax error"), { name: "LibsqlError", code: "SQLITE_ERROR" }),
        Object.assign(new Error("Constraint failed"), { name: "LibsqlError", code: "SQLITE_CONSTRAINT" }),
      ]) {
        vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
          ...adapter,
          async query() {
            throw nonOutageErr;
          },
        });
        const res = await postAuthRoute(makeLoginReq("mgre", mgrPin));
        expect(res.status).toBe(500);
        assertNoSessionCookie(res);
      }

      // 2. PIN lookup DB outage -> 503
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
        ...adapter,
        async queryOne(sql: string) {
          if (sql.includes("SELECT pin_code FROM players")) {
            throw Object.assign(new Error("Connection reset"), { code: "ECONNRESET" });
          }
          return null;
        },
      });
      const pinLookupRes = await postAuthRoute(makeLoginReq("mgre", mgrPin));
      expect(pinLookupRes.status).toBe(503);
      assertNoSessionCookie(pinLookupRes);

      // 3. Hydrate player profile DB outage -> 503
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
        ...adapter,
        async queryOne<T>(sql: string, params?: unknown[]) {
          if (sql.includes("FROM players WHERE id = ? LIMIT 1") && !sql.includes("SELECT pin_code")) {
            throw Object.assign(new Error("Turso hydration timeout"), { code: "ETIMEDOUT" });
          }
          return adapter.queryOne<T>(sql, params);
        },
      });
      const hydrateRes = await postAuthRoute(makeLoginReq("mgre", mgrPin));
      expect(hydrateRes.status).toBe(503);
      assertNoSessionCookie(hydrateRes);

      // 4. Rate-limit driver outage -> 503
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter);
      __setAuthRateLimitDriverForTest({
        async limitIp() {
          throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
        },
        async limitAccount() {
          throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
        },
        async limitPair() {
          throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
        },
        async resetAccount() {},
        async resetPair() {},
      });
      const rlOutageRes = await postAuthRoute(makeLoginReq("mgre", mgrPin));
      expect(rlOutageRes.status).toBe(503);
      assertNoSessionCookie(rlOutageRes);

      // 5. switch_role & quick_login target lookup DB outage -> 503 (no cookie issued); non-manager quick_login -> 403
      __setAuthRateLimitDriverForTest(createAllowAllRateLimiter());
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
        ...adapter,
        async query<T>(sql: string, params?: unknown[]) {
          return adapter.query<T>(sql, params);
        },
        async queryOne<T>(sql: string, params?: unknown[]) {
          if (sql.includes("FROM players WHERE id = ? LIMIT 1")) {
            throw new TypeError("fetch failed");
          }
          return adapter.queryOne<T>(sql, params);
        },
      });
      const switchLookupErrRes = await postAuthRoute(makeSwitchReq(3, "switch_role"));
      expect(switchLookupErrRes.status).toBe(503);
      assertNoSessionCookie(switchLookupErrRes);

      const quickLoginLookupErrRes = await postAuthRoute(makeSwitchReq(3, "quick_login"));
      expect(quickLoginLookupErrRes.status).toBe(503);
      assertNoSessionCookie(quickLoginLookupErrRes);

      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter);
      const targetRow = raw.prepare("SELECT * FROM players WHERE id = 3").get() as unknown as Player;
      const targetToken = createSessionToken(targetRow, 24);
      const playerQuickLoginForbidden = await postAuthRoute(
        makeSwitchReq(1, "quick_login", targetToken)
      );
      expect(playerQuickLoginForbidden.status).toBe(403);
      assertNoSessionCookie(playerQuickLoginForbidden);

      // 6. switch_role audit_logs DB outage -> 503 (no cookie issued); generic bug -> 500 (no cookie issued)
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
        ...adapter,
        async run(sql: string, params?: unknown[]) {
          if (sql.includes("INSERT INTO audit_logs")) {
            throw Object.assign(new Error("Turso write timeout"), { code: "ETIMEDOUT" });
          }
          return adapter.run(sql, params);
        },
      });
      const auditOutageRes = await postAuthRoute(makeSwitchReq(3));
      expect(auditOutageRes.status).toBe(503);
      assertNoSessionCookie(auditOutageRes);

      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
        ...adapter,
        async run(sql: string, params?: unknown[]) {
          if (sql.includes("INSERT INTO audit_logs")) {
            throw new Error("Unexpected application bug in audit serializer");
          }
          return adapter.run(sql, params);
        },
      });
      const auditAppBugRes = await postAuthRoute(makeSwitchReq(3));
      expect(auditAppBugRes.status).toBe(500);
      assertNoSessionCookie(auditAppBugRes);

      // 7. Preserve 429 rate-limit, 401 invalid credentials, 403 default PIN
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter);
      __setAuthRateLimitDriverForTest({
        async limitIp() {
          return { success: false, remaining: 0, reset: Date.now() + 30_000 };
        },
        async limitAccount() {
          return { success: true, remaining: 5, reset: Date.now() + 30_000 };
        },
        async limitPair() {
          return { success: true, remaining: 5, reset: Date.now() + 30_000 };
        },
        async resetAccount() {},
        async resetPair() {},
      });
      const rateLimitRes = await postAuthRoute(makeLoginReq("mgre", mgrPin));
      expect(rateLimitRes.status).toBe(429);
      assertNoSessionCookie(rateLimitRes);

      __setAuthRateLimitDriverForTest(createAllowAllRateLimiter());
      const invalidRes = await postAuthRoute(makeLoginReq("mgre", "Wrong@999"));
      expect(invalidRes.status).toBe(401);
      assertNoSessionCookie(invalidRes);

      const defaultPinRes = await postAuthRoute(makeLoginReq("defp", "1234"));
      expect(defaultPinRes.status).toBe(403);
      assertNoSessionCookie(defaultPinRes);

      // 8. Programming error (TypeError) and generic application Error must still return 500, NOT 503
      for (const appBug of [
        new TypeError("Cannot read properties of undefined (reading 'id')"),
        new Error("Unexpected application invariant violation"),
      ]) {
        vi.spyOn(dbModule, "getAsyncDb").mockReturnValue({
          ...adapter,
          async query() {
            throw appBug;
          },
        });
        const bugRes = await postAuthRoute(makeLoginReq("mgre", mgrPin));
        expect(bugRes.status).toBe(500);
        assertNoSessionCookie(bugRes);
      }
    } finally {
      raw.close();
    }
  });
});
