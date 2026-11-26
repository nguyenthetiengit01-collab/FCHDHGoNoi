import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getAuthRoute, POST as postAuthRoute } from "@/app/api/auth/route";
import { GET as getTeamRoute, POST as postTeamRoute } from "@/app/api/team/route";
import { POST as postImportRoute } from "@/app/api/import/route";
import { GET as getExportRoute } from "@/app/api/export/route";
import { GET as getAuditLogsRoute } from "@/app/api/audit-logs/route";
import { POST as postWebpRoute } from "@/app/api/webp/route";
import * as publicHomeModule from "@/lib/publicHome";
import {
  createSessionToken,
  hashPassword,
  isDefaultPassword,
  requireManagerSession,
  requirePlayerSession,
  SESSION_COOKIE_NAME,
  verifyCredentials,
  verifyPassword,
  verifySessionToken,
} from "./auth";
import { __resetAuthRateLimitForTest } from "./authRateLimit";
import * as dbModule from "./db";
import type { AsyncDb } from "./db";
import type { Player } from "@/types/app";

const VALID_TEST_SECRET = "p103-hotfix-test-auth-secret-at-least-32-chars!";
const tempDirs: string[] = [];
const openDbs: DatabaseSync[] = [];

function createFullTempAsyncDb(): { raw: DatabaseSync; asyncDb: AsyncDb } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-p103-hotfix-"));
  tempDirs.push(dir);
  const sqlitePath = path.join(dir, "hotfix-test.sqlite");
  const raw = new DatabaseSync(sqlitePath);
  openDbs.push(raw);
  dbModule.initQaDatabaseSchema(raw);

  const normalizeRow = (row: Record<string, unknown> | undefined) => row ?? null;

  const makeRunner = () => ({
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = raw.prepare(sql);
      return stmt.all(...(params as never[])) as T[];
    },
    async queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
      const stmt = raw.prepare(sql);
      return normalizeRow(stmt.get(...(params as never[])) as Record<string, unknown> | undefined) as T | null;
    },
    async run(sql: string, params: unknown[] = []) {
      const stmt = raw.prepare(sql);
      const res = stmt.run(...(params as never[]));
      return {
        changes: Number(res.changes ?? 0),
        lastInsertRowid: Number(res.lastInsertRowid ?? 0),
      };
    },
    async exec(sql: string) {
      raw.exec(sql);
    },
  });

  const runner = makeRunner();
  const asyncDb: AsyncDb = {
    ...runner,
    async batch(statements) {
      for (const s of statements) {
        await runner.run(s.sql, s.params);
      }
    },
    async transaction<T>(fn: (tx: dbModule.AsyncDbTx) => Promise<T>): Promise<T> {
      raw.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(runner);
        raw.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          raw.exec("ROLLBACK");
        } catch {
          // ignore
        }
        throw err;
      }
    },
  };

  return { raw, asyncDb };
}

function seedPlayers(raw: DatabaseSync) {
  const managerPin = hashPassword("MgrStrong@2026");
  const playerPin = hashPassword("PlyStrong@2026");
  const defaultScryptPin = hashPassword("1234");

  raw.exec(`
    INSERT INTO team_settings (id, team_name, short_name)
    VALUES (1, 'FC HĐH Gò Nổi', 'Gò Nổi FC');
  `);

  const insert = raw.prepare(`
    INSERT INTO players (id, code_order, full_name, short_name, jersey_number, position, phone, birth_year, avatar_url, bio, role, access_role, username, pin_code, status, notes)
    VALUES (?, ?, ?, ?, ?, 'Tiền vệ', ?, '1995', '', '', ?, ?, ?, ?, ?, '')
  `);

  insert.run(1, 1, "Quản Lý Test", "QL", 1, "0900000001", "Quản lý", "manager", "mgr1", managerPin, "Đang sinh hoạt");
  insert.run(2, 2, "Cầu Thủ Test", "CT", 2, "0900000002", "Thành viên", "player", "ply2", playerPin, "Đang sinh hoạt");
  insert.run(3, 3, "Plain 1234 User", "P1234", 3, "0900000003", "Thành viên", "player", "plain1234", "1234", "Đang sinh hoạt");
  insert.run(4, 4, "Scrypt 1234 User", "S1234", 4, "0900000004", "Thành viên", "player", "scrypt1234", defaultScryptPin, "Đang sinh hoạt");
  insert.run(5, 5, "Empty PIN User", "EmptyPin", 5, "0900000005", "Thành viên", "player", "emptypin", "", "Đang sinh hoạt");
  insert.run(6, 6, "Inactive User", "Inactive", 6, "0900000006", "Thành viên", "player", "inactive6", playerPin, "inactive");
}

function makeCookieHeader(player: Player): string {
  const token = createSessionToken(player, 24);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

afterEach(() => {
  vi.restoreAllMocks();
  __resetAuthRateLimitForTest();
  delete process.env.AUTH_SECRET;
  for (const db of openDbs.splice(0)) {
    try {
      db.close();
    } catch {
      // ignore
    }
  }
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("P1-03 Default PIN Containment Hotfix", () => {
  it("rejects plaintext '1234', scrypt('1234'), and missing/empty PIN on login without fallback or session", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, asyncDb } = createFullTempAsyncDb();
    seedPlayers(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(asyncDb);

    // 1. Plaintext "1234" -> 403 DEFAULT_PIN_RESET_REQUIRED and NOT auto-rehashed
    const plainRes = await verifyCredentials("plain1234", "1234", "10.0.0.1");
    expect(plainRes.success).toBe(false);
    expect(plainRes.status).toBe(403);
    expect(plainRes.errorCode).toBe("DEFAULT_PIN_RESET_REQUIRED");
    const rowAfterPlain = raw.prepare("SELECT pin_code FROM players WHERE id = 3").get() as { pin_code: string };
    expect(rowAfterPlain.pin_code).toBe("1234");

    // 2. Scrypt("1234") -> 403 DEFAULT_PIN_RESET_REQUIRED via POST /api/auth
    const scryptReq = new NextRequest("http://localhost:3000/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify({ action: "login", username: "scrypt1234", pin: "1234" }),
    });
    const scryptRes = await postAuthRoute(scryptReq);
    const scryptJson = await scryptRes.json();
    expect(scryptRes.status).toBe(403);
    expect(scryptJson.code).toBe("DEFAULT_PIN_RESET_REQUIRED");
    expect(scryptRes.headers.get("set-cookie")).toBeNull();

    // 3. Missing/empty PIN in DB -> 401 even if client submits "1234" (no fallback to "1234")
    const emptyRes = await verifyCredentials("emptypin", "1234", "10.0.0.2");
    expect(emptyRes.success).toBe(false);
    expect(emptyRes.status).toBe(401);
  });

  it("refuses reset_player_password without explicit strong non-default PIN and stores scrypt on valid reset", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, asyncDb } = createFullTempAsyncDb();
    seedPlayers(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(asyncDb);

    const manager = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
    const cookie = makeCookieHeader(manager);

    for (const badPin of [undefined, "", "   ", "1234", "123456", "111111"]) {
      const req = new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          action: "reset_player_password",
          payload: { player_id: 3, new_pin: badPin },
        }),
      });
      const res = await postTeamRoute(req);
      expect(res.status).toBe(400);
    }

    // Valid strong PIN succeeds and hashes with scrypt
    const okReq = new NextRequest("http://localhost:3000/api/team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        origin: "http://localhost:3000",
        host: "localhost:3000",
      },
      body: JSON.stringify({
        action: "reset_player_password",
        payload: { player_id: 3, new_pin: "NewStrong@99" },
      }),
    });
    const okRes = await postTeamRoute(okReq);
    expect(okRes.status).toBe(200);
    const updated = raw.prepare("SELECT pin_code FROM players WHERE id = 3").get() as { pin_code: string };
    expect(updated.pin_code.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("NewStrong@99", updated.pin_code)).toBe(true);
    expect(isDefaultPassword(updated.pin_code)).toBe(false);
  });

  it("prevents creating new players or walk-ins with default PIN '1234' and enforces scrypt", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, asyncDb } = createFullTempAsyncDb();
    seedPlayers(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(asyncDb);

    const manager = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
    const cookie = makeCookieHeader(manager);

    // 1. upsert_player rejects "1234" and raw scrypt$
    for (const badPin of ["1234", hashPassword("1234")]) {
      const req = new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          action: "upsert_player",
          payload: { full_name: "New Member", pin_code: badPin },
        }),
      });
      const res = await postTeamRoute(req);
      expect(res.status).toBe(400);
    }

    // 2. upsert_player with omitted pin_code generates random scrypt hash (not "1234")
    const createReq = new NextRequest("http://localhost:3000/api/team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        origin: "http://localhost:3000",
        host: "localhost:3000",
      },
      body: JSON.stringify({
        action: "upsert_player",
        payload: { full_name: "Random Pin Player", pin_code: "" },
      }),
    });
    const createRes = await postTeamRoute(createReq);
    expect(createRes.status).toBe(200);
    const createdRow = raw
      .prepare("SELECT pin_code FROM players WHERE full_name = 'Random Pin Player'")
      .get() as { pin_code: string };
    expect(createdRow.pin_code.startsWith("scrypt$")).toBe(true);
    expect(isDefaultPassword(createdRow.pin_code)).toBe(false);

    // 3. add_walkin_player creates walk-in with random scrypt hash (not "1234")
    raw.exec(`
      INSERT INTO matches (id, match_number, label, match_date, kickoff_time, venue, opponent, fee_per_player, pitch_cost, payer_name, team_score, opponent_score, status, notes)
      VALUES (1, 1, 'Trận 1', '2026-11-25', '19:00', 'Sân A', 'FC B', 100000, 500000, 'QL', 0, 0, 'Sắp đá', '');
    `);
    const walkinReq = new NextRequest("http://localhost:3000/api/team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        origin: "http://localhost:3000",
        host: "localhost:3000",
      },
      body: JSON.stringify({
        action: "add_walkin_player",
        payload: { match_id: 1, new_player_name: "Khách Sân QA", amount: 100000, paid: 1 },
      }),
    });
    const walkinRes = await postTeamRoute(walkinReq);
    expect(walkinRes.status).toBe(200);
    const walkinRow = raw
      .prepare("SELECT pin_code FROM players WHERE full_name = 'Khách Sân QA'")
      .get() as { pin_code: string };
    expect(walkinRow.pin_code.startsWith("scrypt$")).toBe(true);
    expect(isDefaultPassword(walkinRow.pin_code)).toBe(false);
  });

  it("Excel import never introduces default PIN '1234' for new players", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, asyncDb } = createFullTempAsyncDb();
    seedPlayers(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(asyncDb);

    const manager = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
    const cookie = makeCookieHeader(manager);

    const wb = XLSX.utils.book_new();
    const listAoA = [
      ["DANH SÁCH THÀNH VIÊN"],
      [],
      [],
      ["STT", "Họ và tên", "Tên gọi", "Số áo", "Vị trí", "SĐT", "Năm sinh", "Vai trò", "Ghi chú"],
      [1, "Import Player Mới", "Import", 22, "Tiền vệ", "0900000088", "1996", "Thành viên", ""],
    ];
    const chiAoA = [
      ["NHẬT KÝ CHI"],
      [],
      [],
      ["STT", "Ngày", "Danh mục", "Nội dung", "Người chi", "Số tiền"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(listAoA), "2. Danh sách");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["THU TRẬN"], [], [], ["STT", "Họ và tên"]]), "3. Thu Trận (Tích chọn)");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["THU KHÁC"], [], [], ["STT", "Ngày", "Nội dung", "Số tiền"]]), "4. Thu Khác");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(chiAoA), "5. Chi");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(buf)], "import-test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );

    const req = new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost:3000",
        host: "localhost:3000",
      },
      body: form,
    });
    const res = await postImportRoute(req);
    const resBody = await res.json();
    expect(res.status, JSON.stringify(resBody)).toBe(200);

    const imported = raw
      .prepare("SELECT pin_code FROM players WHERE full_name = 'Import Player Mới'")
      .get() as { pin_code: string };
    expect(imported.pin_code.startsWith("scrypt$")).toBe(true);
    expect(isDefaultPassword(imported.pin_code)).toBe(false);
  });

  it("blocks switch_role and quick_login for default/empty/inactive targets, preserves RBAC, and audits valid switch", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, asyncDb } = createFullTempAsyncDb();
    seedPlayers(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(asyncDb);

    const manager = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
    const player = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
    const mgrCookie = makeCookieHeader(manager);
    const plyCookie = makeCookieHeader(player);

    // Player cannot switch_role (403)
    const nonMgrRes = await postAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: plyCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({ action: "switch_role", playerId: 1 }),
      })
    );
    expect(nonMgrRes.status).toBe(403);

    // Manager blocked from quick_login / switch_role to plaintext 1234, scrypt 1234, empty PIN, inactive
    for (const [action, targetId] of [
      ["switch_role", 3],
      ["quick_login", 4],
      ["switch_role", 5],
      ["quick_login", 6],
    ] as const) {
      const res = await postAuthRoute(
        new NextRequest("http://localhost:3000/api/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: mgrCookie,
            origin: "http://localhost:3000",
            host: "localhost:3000",
          },
          body: JSON.stringify({ action, playerId: targetId }),
        })
      );
      expect(res.status).toBe(403);
      expect(res.headers.get("set-cookie")).toBeNull();
    }

    // Valid switch_role succeeds, scrubs pin_code, and writes audit log
    const validSwitch = await postAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: mgrCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({ action: "switch_role", playerId: 2 }),
      })
    );
    const switchJson = await validSwitch.json();
    expect(validSwitch.status).toBe(200);
    expect(switchJson.player.pin_code).toBe("");
    const audit = raw.prepare("SELECT action, summary FROM audit_logs ORDER BY id DESC LIMIT 1").get() as {
      action: string;
      summary: string;
    };
    expect(audit.action).toBe("switch_role");
    expect(audit.summary).toContain("#2");
  });

  it("enforces fail-closed session fingerprints, scrubs PIN in GET /api/auth, and preserves DB 503 vs programming 500", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, asyncDb } = createFullTempAsyncDb();
    seedPlayers(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(asyncDb);

    const player = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
    const emptyPlayer = raw.prepare("SELECT * FROM players WHERE id = 5").get() as unknown as Player;
    expect(() => createSessionToken(emptyPlayer, 1)).toThrow();

    const validCookie = makeCookieHeader(player);
    const authCheck = await requirePlayerSession(
      new NextRequest("http://localhost:3000/api/team", { headers: { cookie: validCookie } })
    );
    expect(authCheck.authorized).toBe(true);

    // GET /api/auth scrubs pin_code
    const getRes = await getAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", { headers: { cookie: validCookie } })
    );
    const getJson = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(getJson.player.pin_code).toBe("");

    // Changing PIN invalidates old session immediately
    raw.prepare("UPDATE players SET pin_code = ? WHERE id = 2").run(hashPassword("RotatedPin@2026"));
    expect(verifySessionToken(validCookie.split("=")[1], hashPassword("RotatedPin@2026"))).toBeNull();
    const afterChange = await requirePlayerSession(
      new NextRequest("http://localhost:3000/api/team", { headers: { cookie: validCookie } })
    );
    expect(afterChange.authorized).toBe(false);
    expect(afterChange.status).toBe(401);

    // DB outage -> 503 vs programming error -> 500
    vi.spyOn(dbModule, "getAsyncDb").mockImplementation(() => {
      const err = new TypeError("fetch failed") as TypeError & { code?: string };
      err.code = "ECONNRESET";
      throw err;
    });
    const outageRes = await verifyCredentials("mgr1", "MgrStrong@2026", "10.0.0.9");
    expect(outageRes.status).toBe(503);
    const mgrOutage = await requireManagerSession(
      new NextRequest("http://localhost:3000/api/team", { headers: { cookie: validCookie } })
    );
    expect(mgrOutage.status).toBe(503);

    vi.spyOn(dbModule, "getAsyncDb").mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'foo')");
    });
    const progRes = await postAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
        body: JSON.stringify({ action: "login", username: "mgr1", pin: "MgrStrong@2026" }),
      })
    );
    expect(progRes.status).toBe(500);
  });

  it("removes default '1234' state, placeholders, and reset-to-1234 behavior from UI components", () => {
    const playersTab = fs.readFileSync(
      path.join(process.cwd(), "src/components/PlayersTab.tsx"),
      "utf-8"
    );
    const scheduleTab = fs.readFileSync(
      path.join(process.cwd(), "src/components/ScheduleTab.tsx"),
      "utf-8"
    );
    const teamManagerApp = fs.readFileSync(
      path.join(process.cwd(), "src/components/TeamManagerApp.tsx"),
      "utf-8"
    );
    expect(playersTab).not.toContain('useState("1234")');
    expect(playersTab).not.toContain('new_pin: "1234"');
    expect(playersTab).not.toContain("Mặc định 1234");
    expect(scheduleTab).not.toContain("mặc định 1234");
    expect(teamManagerApp).not.toContain("về mặc định (1234)");
  });

  it("rejects malformed scrypt hashes (401 without rehash) and pre-hotfix default-PIN sessions on middleware & GET /api/auth", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, asyncDb } = createFullTempAsyncDb();
    seedPlayers(raw);
    raw.prepare("UPDATE players SET pin_code = 'scrypt$bad' WHERE id = 5").run();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(asyncDb);

    // 1. Malformed scrypt hash -> 401 and untouched in DB
    const malformedRes = await verifyCredentials("emptypin", "1234", "10.0.0.11");
    expect(malformedRes.success).toBe(false);
    expect(malformedRes.status).toBe(401);
    const afterMalformed = raw.prepare("SELECT pin_code FROM players WHERE id = 5").get() as { pin_code: string };
    expect(afterMalformed.pin_code).toBe("scrypt$bad");

    // 2. Pre-hotfix session for plaintext/scrypt "1234" account rejected by requireManagerSession, requirePlayerSession, and GET /api/auth
    const defaultUser = raw.prepare("SELECT * FROM players WHERE id = 4").get() as unknown as Player;
    const preHotfixCookie = makeCookieHeader({ ...defaultUser, access_role: "manager" });

    const mgrCheck = await requireManagerSession(
      new NextRequest("http://localhost:3000/api/team", { headers: { cookie: preHotfixCookie } })
    );
    expect(mgrCheck.authorized).toBe(false);
    expect(mgrCheck.status).toBe(403);
    expect(mgrCheck.errorCode).toBe("DEFAULT_PIN_RESET_REQUIRED");

    const plyCheck = await requirePlayerSession(
      new NextRequest("http://localhost:3000/api/team", { headers: { cookie: preHotfixCookie } })
    );
    expect(plyCheck.authorized).toBe(false);
    expect(plyCheck.status).toBe(403);

    const getAuthRes = await getAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", { headers: { cookie: preHotfixCookie } })
    );
    const getAuthJson = await getAuthRes.json();
    expect(getAuthJson.authenticated).toBe(false);
    expect(getAuthJson.code).toBe("DEFAULT_PIN_RESET_REQUIRED");
    expect(getAuthRes.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=;`);
  });

  it("enforces DB-first SSR validation in HomePage (rejects invalid/default-PIN/503 without hydrating private data)", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, asyncDb } = createFullTempAsyncDb();
    seedPlayers(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(asyncDb);
    const fullDataSpy = vi.spyOn(dbModule, "getFullAppData");

    const defaultUser = raw.prepare("SELECT * FROM players WHERE id = 4").get() as unknown as Player;
    const defaultToken = createSessionToken(defaultUser, 24);

    // 1. Default-PIN session -> falls back to public homepage data (no getFullAppData, no private fields)
    const defaultData = await publicHomeModule.resolveHomePageInitialData(defaultToken);
    expect(fullDataSpy).not.toHaveBeenCalled();
    expect(defaultData.players.every((p) => !p.phone && !p.pin_code)).toBe(true);

    // 2. DB outage during SSR -> fail-closed to safe fallback without getFullAppData
    vi.spyOn(dbModule, "getAsyncDb").mockImplementation(() => {
      const err = new TypeError("fetch failed") as TypeError & { code?: string };
      err.code = "ECONNRESET";
      throw err;
    });
    const outageData = await publicHomeModule.resolveHomePageInitialData(defaultToken).catch(() => null);
    expect(fullDataSpy).not.toHaveBeenCalled();
    if (outageData) {
      expect(outageData.players.every((p) => !p.phone && !p.pin_code)).toBe(true);
    }
  });

  it("rejects empty/default in change_own_password, rejects PIN===username in upsert_player, and returns 503 on GET /api/auth & switch_role DB outage", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, asyncDb } = createFullTempAsyncDb();
    seedPlayers(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(asyncDb);

    const manager = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
    const emptyUser = raw.prepare("SELECT * FROM players WHERE id = 5").get() as unknown as Player;
    const mgrCookie = makeCookieHeader(manager);

    // 1. upsert_player rejects PIN === username on create and update
    const createSameRes = await postTeamRoute(
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: mgrCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          action: "upsert_player",
          payload: { full_name: "Same User", username: "sameuser99", pin_code: "sameuser99" },
        }),
      })
    );
    expect(createSameRes.status).toBe(400);

    const updateSameRes = await postTeamRoute(
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: mgrCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          action: "upsert_player",
          payload: { id: 2, full_name: "Cầu Thủ Test", pin_code: "ply2" },
        }),
      })
    );
    expect(updateSameRes.status).toBe(400);

    // 2. change_own_password rejects empty credential in DB and rejects new_pin="1234"
    // Force player 2 to have empty pin_code after minting valid session? Use manager on player 5 via player session
    const validPly = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
    const plyCookie = makeCookieHeader(validPly);
    const badNewPinRes = await postTeamRoute(
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: plyCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          action: "change_own_password",
          payload: { player_id: 2, old_pin: "PlyStrong@2026", new_pin: "1234" },
        }),
      })
    );
    expect(badNewPinRes.status).toBe(400);

    // Clear player 2's pin_code in DB -> change_own_password must fail closed (401/400)
    expect(emptyUser.pin_code).toBe("");
    raw.prepare("UPDATE players SET pin_code = '' WHERE id = 2").run();
    const emptyCredRes = await postTeamRoute(
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: plyCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          action: "change_own_password",
          payload: { player_id: 2, old_pin: "1234", new_pin: "StrongNew@2026" },
        }),
      })
    );
    expect([400, 401]).toContain(emptyCredRes.status);

    // 3. GET /api/auth and switch_role return 503 on DB outage without issuing or deleting cookie
    vi.spyOn(dbModule, "getAsyncDb").mockImplementation(() => {
      const err = new TypeError("fetch failed") as TypeError & { code?: string };
      err.code = "ETIMEDOUT";
      throw err;
    });

    const getOutageRes = await getAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", { headers: { cookie: mgrCookie } })
    );
    expect(getOutageRes.status).toBe(503);
    expect(getOutageRes.headers.get("set-cookie")).toBeNull();

    const switchOutageRes = await postAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: mgrCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({ action: "switch_role", playerId: 2 }),
      })
    );
    expect(switchOutageRes.status).toBe(503);
    expect(switchOutageRes.headers.get("set-cookie")).toBeNull();
  });

  it("migrates legacy SQLite fixture with DEFAULT '1234' safely, preserving rows, indexes, triggers, sequence, and FKs", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-p103-mig-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "legacy.sqlite");
    const legacyDb = new DatabaseSync(dbPath);
    openDbs.push(legacyDb);

    legacyDb.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        pin_code TEXT NOT NULL DEFAULT '1234'
      );
      CREATE INDEX idx_players_name ON players(full_name);
      CREATE TABLE match_attendances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
      );
      CREATE TABLE audit_trail (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT);
      CREATE TRIGGER trg_players_insert AFTER INSERT ON players BEGIN
        INSERT INTO audit_trail (note) VALUES (NEW.full_name);
      END;
      INSERT INTO players (id, full_name, pin_code) VALUES (1, 'Legacy Player 1', 'scrypt$salt$hash');
      INSERT INTO players (id, full_name, pin_code) VALUES (5, 'Legacy Player 5', '1234');
      DELETE FROM players WHERE id = 5;
      INSERT INTO match_attendances (player_id) VALUES (1);
    `);

    const migModule = await import(
      path.resolve(process.cwd(), "scripts/migrations/phase7-p103-pin-default-v1.mjs")
    );

    // Dry-run leaves DEFAULT '1234' intact
    const dryRes = migModule.runPhase7P103PinDefaultLocalMigration({ db: legacyDb, dryRun: true });
    expect(dryRes.applied).toBe(false);
    expect(dryRes.actions.length).toBeGreaterThan(0);

    // Apply migration and verify PRAGMA checks execute strictly BEFORE COMMIT
    const executionOrder: string[] = [];
    const origExec = legacyDb.exec.bind(legacyDb);
    const execSpy = vi.spyOn(legacyDb, "exec").mockImplementation((sql: string) => {
      if (sql.trim().toUpperCase().startsWith("COMMIT")) {
        executionOrder.push("COMMIT");
      }
      return origExec(sql);
    });

    const applyRes = migModule.runPhase7P103PinDefaultLocalMigration({
      db: legacyDb,
      dryRun: false,
      checkForeignKeys: (targetDb: DatabaseSync) => {
        executionOrder.push("PRAGMA_FOREIGN_KEY_CHECK");
        return targetDb.prepare("PRAGMA foreign_key_check").all();
      },
      checkIntegrity: (targetDb: DatabaseSync) => {
        executionOrder.push("PRAGMA_INTEGRITY_CHECK");
        return targetDb.prepare("PRAGMA integrity_check").all();
      },
    });
    execSpy.mockRestore();

    expect(executionOrder).toEqual([
      "PRAGMA_FOREIGN_KEY_CHECK",
      "PRAGMA_INTEGRITY_CHECK",
      "COMMIT",
    ]);
    expect(applyRes.applied).toBe(true);
    expect(applyRes.preservedIndexes).toBe(1);
    expect(applyRes.preservedTriggers).toBe(1);

    // Verify DEFAULT '1234' removed, rows preserved, AUTOINCREMENT preserved, FK intact
    const cols = legacyDb.prepare("PRAGMA table_info(players)").all() as Array<{ name: string; dflt_value: string }>;
    const pinCol = cols.find((c) => c.name === "pin_code");
    expect(pinCol?.dflt_value).toBe("''");

    const row1 = legacyDb.prepare("SELECT full_name, pin_code FROM players WHERE id = 1").get() as {
      full_name: string;
      pin_code: string;
    };
    expect(row1.full_name).toBe("Legacy Player 1");
    expect(row1.pin_code).toBe("scrypt$salt$hash");

    // Next insert without id respects sqlite_sequence (id >= 6) and without pin_code defaults to ''
    legacyDb.prepare("INSERT INTO players (full_name) VALUES ('Post Migration')").run();
    const inserted = legacyDb
      .prepare("SELECT id, pin_code FROM players WHERE full_name = 'Post Migration'")
      .get() as { id: number; pin_code: string };
    expect(inserted.id).toBeGreaterThanOrEqual(6);
    expect(inserted.pin_code).toBe("");

    // Idempotent re-run
    const secondRes = migModule.runPhase7P103PinDefaultLocalMigration({ db: legacyDb, dryRun: false });
    expect(secondRes.alreadyApplied).toBe(true);
    expect(secondRes.applied).toBe(false);
  });

  it("rolls back rebuild and schema_migrations atomically if PRAGMA foreign_key_check or integrity_check fails before COMMIT", async () => {
    const migModule = await import(
      path.resolve(process.cwd(), "scripts/migrations/phase7-p103-pin-default-v1.mjs")
    );

    const createFixture = (name: string) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fc-p103-rb-${name}-`));
      tempDirs.push(dir);
      const db = new DatabaseSync(path.join(dir, "legacy.sqlite"));
      openDbs.push(db);
      db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE players (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          pin_code TEXT NOT NULL DEFAULT '1234'
        );
        CREATE INDEX idx_players_name ON players(full_name);
        CREATE TABLE match_attendances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
        );
        CREATE TABLE audit_trail (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT);
        CREATE TRIGGER trg_players_insert AFTER INSERT ON players BEGIN
          INSERT INTO audit_trail (note) VALUES (NEW.full_name);
        END;
        INSERT INTO players (id, full_name, pin_code) VALUES (1, 'Legacy Player 1', 'scrypt$salt$hash');
        INSERT INTO players (id, full_name, pin_code) VALUES (5, 'Legacy Player 5', '1234');
        DELETE FROM players WHERE id = 5;
        INSERT INTO match_attendances (player_id) VALUES (1);
      `);
      return db;
    };

    const assertUntouchedLegacyState = (db: DatabaseSync) => {
      const cols = db.prepare("PRAGMA table_info(players)").all() as Array<{ name: string; dflt_value: string }>;
      expect(cols.find((c) => c.name === "pin_code")?.dflt_value).toBe("'1234'");

      const rows = db.prepare("SELECT id, full_name, pin_code FROM players").all() as Array<{
        id: number;
        full_name: string;
        pin_code: string;
      }>;
      expect(rows).toEqual([{ id: 1, full_name: "Legacy Player 1", pin_code: "scrypt$salt$hash" }]);

      const idx = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_players_name'")
        .get();
      const trg = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_players_insert'")
        .get();
      const seq = db
        .prepare("SELECT seq FROM sqlite_sequence WHERE name = 'players'")
        .get() as { seq: number };
      const migTable = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
        .get();

      expect(idx).toBeTruthy();
      expect(trg).toBeTruthy();
      expect(seq.seq).toBe(5);
      expect(migTable).toBeUndefined();
    };

    // 1. foreign_key_check failure -> full rollback
    const fkFailDb = createFixture("fk");
    expect(() =>
      migModule.runPhase7P103PinDefaultLocalMigration({
        db: fkFailDb,
        dryRun: false,
        checkForeignKeys: () => [{ table: "match_attendances", rowid: 1, parent: "players", fkid: 0 }],
      })
    ).toThrow(/Pre-commit PRAGMA foreign_key_check failed/);
    assertUntouchedLegacyState(fkFailDb);

    // 2. integrity_check failure (non-'ok' and multi-row) -> full rollback
    const intFailDb = createFixture("int");
    expect(() =>
      migModule.runPhase7P103PinDefaultLocalMigration({
        db: intFailDb,
        dryRun: false,
        checkIntegrity: () => [{ integrity_check: "corrupt btree page" }],
      })
    ).toThrow(/Pre-commit PRAGMA integrity_check failed/);
    assertUntouchedLegacyState(intFailDb);

    const multiRowIntDb = createFixture("multi");
    expect(() =>
      migModule.runPhase7P103PinDefaultLocalMigration({
        db: multiRowIntDb,
        dryRun: false,
        checkIntegrity: () => [{ integrity_check: "ok" }, { integrity_check: "extra" }],
      })
    ).toThrow(/Pre-commit PRAGMA integrity_check failed/);
    assertUntouchedLegacyState(multiRowIntDb);
  });

  it("enforces persistent must_change_pin lifecycle, API restrictions, session re-issue, and audit privacy", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, asyncDb } = createFullTempAsyncDb();
    seedPlayers(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(asyncDb);

    // Existing users default to must_change_pin = 0
    const initialFlag = raw.prepare("SELECT must_change_pin FROM players WHERE id = 2").get() as {
      must_change_pin: number;
    };
    expect(initialFlag.must_change_pin).toBe(0);

    const manager = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
    const mgrCookie = makeCookieHeader(manager);

    // Manager resets Player #2 with strong temporary PIN -> sets must_change_pin = 1 & audits target/role/result without PIN/hash
    const resetRes = await postTeamRoute(
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: mgrCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          action: "reset_player_password",
          payload: { player_id: 2, new_pin: "TempStrong@2026" },
        }),
      })
    );
    expect(resetRes.status).toBe(200);
    const afterReset = raw
      .prepare("SELECT pin_code, must_change_pin FROM players WHERE id = 2")
      .get() as { pin_code: string; must_change_pin: number };
    expect(afterReset.must_change_pin).toBe(1);

    const auditRow = raw
      .prepare("SELECT actor_id, action, summary FROM audit_logs ORDER BY id DESC LIMIT 1")
      .get() as { actor_id: number; action: string; summary: string };
    expect(auditRow.actor_id).toBe(1);
    expect(auditRow.action).toBe("reset_player_password");
    expect(auditRow.summary).toContain("target=#2");
    expect(auditRow.summary).toContain("targetRole=player");
    expect(auditRow.summary).toContain("result=success");
    expect(auditRow.summary).not.toContain("TempStrong@2026");
    expect(auditRow.summary).not.toContain("scrypt$");

    // Player #2 logs in -> 200 with mustChangePassword: true
    const loginRes = await postAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({ action: "login", username: "ply2", pin: "TempStrong@2026" }),
      })
    );
    const loginJson = await loginRes.json();
    expect(loginRes.status).toBe(200);
    expect(loginJson.mustChangePassword).toBe(true);
    const setCookie = loginRes.headers.get("set-cookie") || "";
    const tempCookie = setCookie.split(";")[0];

    // GET /api/auth permitted & exposes mustChangePassword: true
    const statusRes = await getAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", { headers: { cookie: tempCookie } })
    );
    const statusJson = await statusRes.json();
    expect(statusRes.status).toBe(200);
    expect(statusJson.authenticated).toBe(true);
    expect(statusJson.mustChangePassword).toBe(true);

    // Business APIs blocked while must_change_pin === 1
    const rsvpBlocked = await postTeamRoute(
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: tempCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({ action: "set_rsvp", payload: { match_id: 1, player_id: 2, rsvp_status: "yes" } }),
      })
    );
    expect(rsvpBlocked.status).toBe(403);
    expect((await rsvpBlocked.json()).code).toBe("PIN_CHANGE_REQUIRED");

    const webpBlocked = await postWebpRoute(
      new NextRequest("http://localhost:3000/api/webp", {
        method: "POST",
        headers: { cookie: tempCookie },
      })
    );
    expect(webpBlocked.status).toBe(403);

    const getTeamPublicOnly = await getTeamRoute(
      new NextRequest("http://localhost:3000/api/team", { headers: { cookie: tempCookie } })
    );
    const teamJson = await getTeamPublicOnly.json();
    expect(teamJson.players.every((p: { phone?: string }) => !p.phone)).toBe(true);

    // Manager with must_change_pin = 1 is also blocked on Manager business endpoints
    raw.prepare("UPDATE players SET must_change_pin = 1 WHERE id = 1").run();
    for (const res of [
      await getAuditLogsRoute(new NextRequest("http://localhost:3000/api/audit-logs", { headers: { cookie: mgrCookie } })),
      await getExportRoute(new NextRequest("http://localhost:3000/api/export", { headers: { cookie: mgrCookie } })),
      await postImportRoute(
        new NextRequest("http://localhost:3000/api/import", {
          method: "POST",
          headers: { cookie: mgrCookie, origin: "http://localhost:3000", host: "localhost:3000" },
        })
      ),
      await postAuthRoute(
        new NextRequest("http://localhost:3000/api/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: mgrCookie,
            origin: "http://localhost:3000",
            host: "localhost:3000",
          },
          body: JSON.stringify({ action: "switch_role", playerId: 2 }),
        })
      ),
    ]) {
      expect(res.status).toBe(403);
    }
    raw.prepare("UPDATE players SET must_change_pin = 0 WHERE id = 1").run();

    // Player #2 cannot reuse temporary PIN
    const reuseRes = await postTeamRoute(
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: tempCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          action: "change_own_password",
          payload: { player_id: 2, old_pin: "TempStrong@2026", new_pin: "TempStrong@2026" },
        }),
      })
    );
    expect(reuseRes.status).toBe(400);

    // Player #2 changes PIN -> clears must_change_pin = 0, re-issues cookie, invalidates old cookie
    const changeRes = await postTeamRoute(
      new NextRequest("http://localhost:3000/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: tempCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          action: "change_own_password",
          payload: { player_id: 2, old_pin: "TempStrong@2026", new_pin: "FinalOwn@2026!" },
        }),
      })
    );
    expect(changeRes.status).toBe(200);
    const cleared = raw.prepare("SELECT must_change_pin FROM players WHERE id = 2").get() as {
      must_change_pin: number;
    };
    expect(cleared.must_change_pin).toBe(0);

    const newCookie = (changeRes.headers.get("set-cookie") || "").split(";")[0];
    expect(newCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(newCookie).not.toBe(tempCookie);

    // Old tempCookie is immediately invalid (401)
    const oldSessionCheck = await requirePlayerSession(
      new NextRequest("http://localhost:3000/api/team", { headers: { cookie: tempCookie } })
    );
    expect(oldSessionCheck.authorized).toBe(false);
    expect(oldSessionCheck.status).toBe(401);

    // New cookie is authorized and mustChangePassword is false
    const newStatusRes = await getAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", { headers: { cookie: newCookie } })
    );
    const newStatusJson = await newStatusRes.json();
    expect(newStatusRes.status).toBe(200);
    expect(newStatusJson.authenticated).toBe(true);
    expect(newStatusJson.mustChangePassword).toBe(false);

    // Logout is permitted even when must_change_pin = 1
    const logoutRes = await postAuthRoute(
      new NextRequest("http://localhost:3000/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: tempCookie,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({ action: "logout" }),
      })
    );
    expect(logoutRes.status).toBe(200);
  });

  it("supports additive must_change_pin migration and backward compatibility on legacy schema without must_change_pin", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-p103-mcp-"));
    tempDirs.push(dir);
    const db = new DatabaseSync(path.join(dir, "legacy-no-mcp.sqlite"));
    openDbs.push(db);
    db.exec(`
      CREATE TABLE players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_order INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        short_name TEXT NOT NULL,
        jersey_number INTEGER,
        position TEXT NOT NULL DEFAULT 'Đa năng',
        phone TEXT NOT NULL DEFAULT '',
        birth_year TEXT NOT NULL DEFAULT '',
        avatar_url TEXT NOT NULL DEFAULT '',
        profile_image_url TEXT NOT NULL DEFAULT '',
        bio TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'Thành viên',
        access_role TEXT NOT NULL DEFAULT 'player',
        username TEXT NOT NULL DEFAULT '',
        pin_code TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
        notes TEXT NOT NULL DEFAULT ''
      );
    `);
    const strongPin = hashPassword("LegacyStrong@2026");
    db.prepare(
      `INSERT INTO players (code_order, full_name, short_name, access_role, username, pin_code, status)
       VALUES (1, 'Legacy Owner', 'Owner', 'manager', 'owner1', ?, 'Đang sinh hoạt')`
    ).run(strongPin);

    // Backward-compatible auth works even BEFORE additive migration runs
    const legacyAsyncDb: AsyncDb = {
      async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
        return db.prepare(sql).all(...(params as never[])) as T[];
      },
      async queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
        return (db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
      },
      async run(sql: string, params: unknown[] = []) {
        const res = db.prepare(sql).run(...(params as never[]));
        return { changes: Number(res.changes ?? 0), lastInsertRowid: Number(res.lastInsertRowid ?? 0) };
      },
      async exec(sql: string) {
        db.exec(sql);
      },
      async batch(statements) {
        for (const s of statements) await this.run(s.sql, s.params);
      },
      async transaction<T>(fn: (tx: dbModule.AsyncDbTx) => Promise<T>): Promise<T> {
        return fn(this);
      },
    };
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(legacyAsyncDb);
    const legacyLogin = await verifyCredentials("owner1", "LegacyStrong@2026", "10.0.0.15");
    expect(legacyLogin.success).toBe(true);
    expect(legacyLogin.mustChangePassword).toBe(false);

    // Additive migration adds must_change_pin DEFAULT 0 and is idempotent
    const mcpMig = await import(
      path.resolve(process.cwd(), "scripts/migrations/phase7-p103-must-change-pin-v1.mjs")
    );
    const dryRes = mcpMig.runMustChangePinLocalMigration({ db, dryRun: true });
    expect(dryRes.applied).toBe(false);
    expect(dryRes.actions.length).toBeGreaterThan(0);

    const applyRes = mcpMig.runMustChangePinLocalMigration({ db, dryRun: false });
    expect(applyRes.applied).toBe(true);
    const rowAfter = db.prepare("SELECT full_name, must_change_pin FROM players WHERE id = 1").get() as {
      full_name: string;
      must_change_pin: number;
    };
    expect(rowAfter.full_name).toBe("Legacy Owner");
    expect(rowAfter.must_change_pin).toBe(0);

    const rerunRes = mcpMig.runMustChangePinLocalMigration({ db, dryRun: false });
    expect(rerunRes.alreadyApplied).toBe(true);
    expect(rerunRes.applied).toBe(false);
  });
});
