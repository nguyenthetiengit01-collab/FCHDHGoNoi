import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as dbModule from "./db";
import type { AsyncDb } from "./db";
import {
  createSessionToken,
  hashPassword,
  requireManagerSession,
  requirePlayerSession,
  SESSION_COOKIE_NAME,
  verifyCredentials,
  verifyPassword,
  sanitizeTeamResponseData,
} from "./auth";
import {
  __resetAuthRateLimitForTest,
  __setAuthRateLimitDriverForTest,
} from "./authRateLimit";
import { GET as getAuthRoute, POST as postAuthRoute } from "@/app/api/auth/route";
import { POST as postTeamRoute } from "@/app/api/team/route";

const VALID_TEST_SECRET = "test-p103-pin-enforcement-secret-key-2026-32bytes";

function setupIsolatedDb(
  tempDirs: string[],
  openDbs: DatabaseSync[],
  options?: { omitMustChangePinColumn?: boolean }
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p103-pin-enforce-"));
  tempDirs.push(dir);
  const raw = new DatabaseSync(path.join(dir, "test.sqlite"));
  openDbs.push(raw);
  raw.exec(`
    CREATE TABLE team_settings (
      id INTEGER PRIMARY KEY,
      team_name TEXT NOT NULL DEFAULT 'FC',
      monthly_fee INTEGER NOT NULL DEFAULT 100000,
      default_match_fee INTEGER NOT NULL DEFAULT 100000,
      fund_initial_balance INTEGER NOT NULL DEFAULT 0,
      tournament_fund_reserve INTEGER NOT NULL DEFAULT 0,
      tournament_fund_note TEXT NOT NULL DEFAULT '',
      fanpage_url TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO team_settings (id) VALUES (1);
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
      ${options?.omitMustChangePinColumn ? "" : "must_change_pin INTEGER NOT NULL DEFAULT 0,"}
      hometown TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      playing_style TEXT NOT NULL DEFAULT '',
      gallery_urls_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, match_number INTEGER NOT NULL, label TEXT NOT NULL, match_date TEXT NOT NULL, kickoff_time TEXT NOT NULL DEFAULT '19:00', venue TEXT NOT NULL DEFAULT '', opponent TEXT NOT NULL DEFAULT '', fee_per_player INTEGER NOT NULL DEFAULT 100000, pitch_cost INTEGER NOT NULL DEFAULT 0, payer_name TEXT NOT NULL DEFAULT '', team_score INTEGER, opponent_score INTEGER, status TEXT NOT NULL DEFAULT 'Đã kết thúc', notes TEXT NOT NULL DEFAULT '');
    INSERT INTO matches (id, match_number, label, match_date) VALUES (1, 1, 'Match 1', '2026-11-22');
    CREATE TABLE match_attendances (id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER NOT NULL, player_id INTEGER NOT NULL, rsvp_status TEXT NOT NULL DEFAULT 'none', walk_in INTEGER NOT NULL DEFAULT 0, attended INTEGER NOT NULL DEFAULT 0, paid INTEGER NOT NULL DEFAULT 0, amount INTEGER NOT NULL DEFAULT 0, collected_by TEXT NOT NULL DEFAULT '', paid_at TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', UNIQUE(match_id, player_id));
    CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER NOT NULL, actor_name TEXT NOT NULL, actor_role TEXT NOT NULL, action TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);

  const adapter = new dbModule.LocalSqliteAdapter(raw);
  vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter as unknown as AsyncDb);
  return { raw, adapter };
}

function makeReq(pathName: string, body: Record<string, unknown>, cookie?: string) {
  return new NextRequest(`https://fchdhgonoi.vercel.app${pathName}`, {
    method: "POST",
    headers: {
      host: "fchdhgonoi.vercel.app",
      origin: "https://fchdhgonoi.vercel.app",
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("P1-03B PIN Security Enforcement", () => {
  const tempDirs: string[] = [];
  const openDbs: DatabaseSync[] = [];

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_SECRET", VALID_TEST_SECRET);
    const allow = async () => ({ success: true, remaining: 99, reset: Date.now() + 60_000 });
    __setAuthRateLimitDriverForTest({ limitAccount: allow, limitPair: allow, limitIp: allow });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    __resetAuthRateLimitForTest();
    for (const db of openDbs.splice(0, openDbs.length)) {
      try {
        db.close();
      } catch {
        // ignore
      }
    }
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("1, 3, 4, 8, 9, 10, 11. Manager random reset, unique PINs, business API blocked, temp PIN reuse rejected, new session issued, old session invalidated, no PIN/hash in audit", async () => {
    const { raw } = setupIsolatedDb(tempDirs, openDbs);
    const managerHash = hashPassword("ManagerStrong@2026");
    const playerHash = hashPassword("OldPlayer@2026");

    raw.prepare(
      `INSERT INTO players (id, code_order, full_name, short_name, username, access_role, pin_code, must_change_pin, status)
       VALUES
         (1, 1, 'Manager User', 'Manager', 'manager1', 'manager', ?, 0, 'Đang sinh hoạt'),
         (2, 2, 'Player Two', 'Player2', 'player2', 'player', ?, 0, 'Đang sinh hoạt')`
    ).run(managerHash, playerHash);

    const managerRow = raw.prepare("SELECT * FROM players WHERE id = 1").get() as Record<string, unknown>;
    const playerRowBefore = raw.prepare("SELECT * FROM players WHERE id = 2").get() as Record<string, unknown>;
    const managerCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(managerRow as never, 24)}`;
    const oldPlayerCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(playerRowBefore as never, 24)}`;

    // 1 & 3. Missing/invalid mode and client-supplied new_pin are rejected; consecutive random_temporary resets produce distinct crypto-random PINs
    const missingModeRes = await postTeamRoute(
      makeReq("/api/team", { action: "reset_player_password", payload: { player_id: 2 } }, managerCookie)
    );
    expect(missingModeRes.status).toBe(400);

    const invalidModeRes = await postTeamRoute(
      makeReq("/api/team", { action: "reset_player_password", payload: { player_id: 2, mode: "explicit" } }, managerCookie)
    );
    expect(invalidModeRes.status).toBe(400);

    const clientPinRejectedRes = await postTeamRoute(
      makeReq(
        "/api/team",
        { action: "reset_player_password", payload: { player_id: 2, mode: "random_temporary", new_pin: "ClientChosen@2026" } },
        managerCookie
      )
    );
    expect(clientPinRejectedRes.status).toBe(400);

    const resetRes1 = await postTeamRoute(
      makeReq("/api/team", { action: "reset_player_password", payload: { player_id: 2, mode: "random_temporary" } }, managerCookie)
    );
    expect(resetRes1.status).toBe(200);
    expect(resetRes1.headers.get("cache-control")).toContain("no-store");
    const resetBody1 = (await resetRes1.json()) as { temporaryPin?: string };
    expect(typeof resetBody1.temporaryPin).toBe("string");
    expect((resetBody1.temporaryPin || "").length).toBeGreaterThanOrEqual(12);

    const resetRes2 = await postTeamRoute(
      makeReq("/api/team", { action: "reset_player_password", payload: { player_id: 2, mode: "random_temporary" } }, managerCookie)
    );
    expect(resetRes2.status).toBe(200);
    const resetBody2 = (await resetRes2.json()) as { temporaryPin?: string };
    const tempPin = resetBody2.temporaryPin || "";
    expect(tempPin).not.toBe(resetBody1.temporaryPin);

    const afterResetRow = raw
      .prepare("SELECT pin_code, must_change_pin FROM players WHERE id = 2")
      .get() as { pin_code: string; must_change_pin: number };
    expect(afterResetRow.must_change_pin).toBe(1);
    expect(afterResetRow.pin_code.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword(tempPin, afterResetRow.pin_code)).toBe(true);

    // 9. Pre-reset cookie is immediately invalid (401)
    const oldSessionCheck = await requirePlayerSession(
      new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
        headers: { host: "fchdhgonoi.vercel.app", cookie: oldPlayerCookie },
      })
    );
    expect(oldSessionCheck.authorized).toBe(false);
    expect(oldSessionCheck.status).toBe(401);

    // Player logs in with temporary PIN
    const loginCheck = await verifyCredentials("player2", tempPin, "127.0.0.1");
    expect(loginCheck.success).toBe(true);
    expect(loginCheck.mustChangePassword).toBe(true);

    const loginRes = await postAuthRoute(
      makeReq("/api/auth", { action: "login", username: "player2", pin: tempPin })
    );
    expect(loginRes.status).toBe(200);
    const tempPlayerCookie = (loginRes.headers.get("set-cookie") || "").split(";")[0];

    // 4. Business APIs (requirePlayerSession & set_rsvp & update_own_profile) blocked with 403 PIN_CHANGE_REQUIRED
    const blockedAuthCheck = await requirePlayerSession(
      new NextRequest("https://fchdhgonoi.vercel.app/api/export", {
        headers: { host: "fchdhgonoi.vercel.app", cookie: tempPlayerCookie },
      })
    );
    expect(blockedAuthCheck.authorized).toBe(false);
    expect(blockedAuthCheck.status).toBe(403);
    expect(blockedAuthCheck.errorCode).toBe("PIN_CHANGE_REQUIRED");

    const blockedRsvpRes = await postTeamRoute(
      makeReq("/api/team", { action: "set_rsvp", payload: { player_id: 2, match_id: 1, rsvp_status: "registered" } }, tempPlayerCookie)
    );
    expect(blockedRsvpRes.status).toBe(403);
    expect(((await blockedRsvpRes.json()) as { code?: string }).code).toBe("PIN_CHANGE_REQUIRED");

    const blockedProfileRes = await postTeamRoute(
      makeReq("/api/team", { action: "update_own_profile", payload: { player_id: 2, full_name: "Player Two" } }, tempPlayerCookie)
    );
    expect(blockedProfileRes.status).toBe(403);

    // 8. Reusing the temporary PIN as the new PIN is rejected
    const reuseRes = await postTeamRoute(
      makeReq(
        "/api/team",
        { action: "change_own_password", payload: { old_pin: tempPin, new_pin: tempPin } },
        tempPlayerCookie
      )
    );
    expect(reuseRes.status).toBe(400);

    // 10. Distinct strong personal PIN clears must_change_pin=0 and issues a fresh valid session cookie
    const changeRes = await postTeamRoute(
      makeReq(
        "/api/team",
        { action: "change_own_password", payload: { old_pin: tempPin, new_pin: "PersonalStrong@2026" } },
        tempPlayerCookie
      )
    );
    expect(changeRes.status).toBe(200);
    const freshPlayerCookie = (changeRes.headers.get("set-cookie") || "").split(";")[0];
    expect(freshPlayerCookie.startsWith(`${SESSION_COOKIE_NAME}=`)).toBe(true);
    expect(freshPlayerCookie).not.toBe(tempPlayerCookie);

    const updatedAfterChange = raw
      .prepare("SELECT pin_code, must_change_pin FROM players WHERE id = 2")
      .get() as { pin_code: string; must_change_pin: number };
    expect(updatedAfterChange.must_change_pin).toBe(0);
    expect(verifyPassword("PersonalStrong@2026", updatedAfterChange.pin_code)).toBe(true);

    // Old temporary-PIN session is now rejected (401)
    const staleTempCheck = await requirePlayerSession(
      new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
        headers: { host: "fchdhgonoi.vercel.app", cookie: tempPlayerCookie },
      })
    );
    expect(staleTempCheck.authorized).toBe(false);
    expect(staleTempCheck.status).toBe(401);

    // Fresh session succeeds on business API (set_rsvp)
    const allowedRsvpRes = await postTeamRoute(
      makeReq("/api/team", { action: "set_rsvp", payload: { player_id: 2, match_id: 1, rsvp_status: "registered" } }, freshPlayerCookie)
    );
    expect(allowedRsvpRes.status).toBe(200);

    // Re-login with the new personal PIN succeeds with mustChangePassword=false
    const reloginRes = await postAuthRoute(
      makeReq("/api/auth", { action: "login", username: "player2", pin: "PersonalStrong@2026" })
    );
    expect(reloginRes.status).toBe(200);
    const reloginBody = (await reloginRes.json()) as {
      success?: boolean;
      mustChangePassword?: boolean;
      player?: { mustChangePin?: boolean };
    };
    expect(reloginBody.success).toBe(true);
    expect(reloginBody.mustChangePassword).toBe(false);
    expect(reloginBody.player?.mustChangePin).toBe(false);

    // 11. Audit logs contain neither plaintext PINs nor scrypt$ hashes
    const auditRows = raw.prepare("SELECT action, summary FROM audit_logs").all() as Array<{
      action: string;
      summary: string;
    }>;
    expect(auditRows.length).toBeGreaterThanOrEqual(3);
    for (const entry of auditRows) {
      expect(entry.summary).not.toContain(resetBody1.temporaryPin || "x");
      expect(entry.summary).not.toContain(tempPin);
      expect(entry.summary).not.toContain("PersonalStrong@2026");
      expect(entry.summary).not.toContain("scrypt$");
    }
  });

  it("2 & 5. Regular player cannot reset PIN, Manager cannot self-reset, and change_own_password ignores/rejects spoofed player_id even for Manager", async () => {
    const { raw } = setupIsolatedDb(tempDirs, openDbs);
    const managerHash = hashPassword("ManagerStrong@2026");
    const playerHash = hashPassword("PlayerStrong@2026");

    raw.prepare(
      `INSERT INTO players (id, code_order, full_name, short_name, username, access_role, pin_code, must_change_pin, status)
       VALUES
         (1, 1, 'Manager User', 'Manager', 'manager1', 'manager', ?, 0, 'Đang sinh hoạt'),
         (2, 2, 'Player Two', 'Player2', 'player2', 'player', ?, 0, 'Đang sinh hoạt')`
    ).run(managerHash, playerHash);

    const managerRow = raw.prepare("SELECT * FROM players WHERE id = 1").get() as Record<string, unknown>;
    const playerRow = raw.prepare("SELECT * FROM players WHERE id = 2").get() as Record<string, unknown>;
    const managerCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(managerRow as never, 24)}`;
    const playerCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(playerRow as never, 24)}`;

    // 2. Regular player cannot call reset_player_password
    const playerResetRes = await postTeamRoute(
      makeReq("/api/team", { action: "reset_player_password", payload: { player_id: 1, mode: "random_temporary" } }, playerCookie)
    );
    expect(playerResetRes.status).toBe(403);

    // Manager cannot reset own account via reset_player_password
    const selfResetRes = await postTeamRoute(
      makeReq("/api/team", { action: "reset_player_password", payload: { player_id: 1, mode: "random_temporary" } }, managerCookie)
    );
    expect(selfResetRes.status).toBe(400);

    // 5. Manager cannot spoof player_id in change_own_password to change Player 2's PIN
    const spoofRes = await postTeamRoute(
      makeReq(
        "/api/team",
        {
          action: "change_own_password",
          payload: { player_id: 2, old_pin: "ManagerStrong@2026", new_pin: "HijackedPin@2026" },
        },
        managerCookie
      )
    );
    expect(spoofRes.status).toBe(403);
    expect(spoofRes.headers.get("set-cookie")).toBeNull();
    const p2After = raw.prepare("SELECT pin_code FROM players WHERE id = 2").get() as { pin_code: string };
    expect(verifyPassword("PlayerStrong@2026", p2After.pin_code)).toBe(true);
  });

  it("6 & 7. Fails closed (503) when must_change_pin column is missing or schema query errors, and distinguishes duplicate-column from fatal migration errors", async () => {
    const { raw } = setupIsolatedDb(tempDirs, openDbs, { omitMustChangePinColumn: true });
    const mgrHash = hashPassword("ManagerStrong@2026");
    raw.prepare(
      `INSERT INTO players (id, code_order, full_name, short_name, username, access_role, pin_code, status)
       VALUES (1, 1, 'Manager User', 'Manager', 'manager1', 'manager', ?, 'Đang sinh hoạt')`
    ).run(mgrHash);

    const mgrRow = raw.prepare("SELECT * FROM players WHERE id = 1").get() as Record<string, unknown>;
    const mgrCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(mgrRow as never, 24)}`;

    // 6. Missing column -> fail-closed 503 on requireManagerSession, requirePlayerSession, GET /api/auth
    const mgrGuard = await requireManagerSession(
      new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
        headers: { host: "fchdhgonoi.vercel.app", cookie: mgrCookie },
      })
    );
    expect(mgrGuard.authorized).toBe(false);
    expect(mgrGuard.status).toBe(503);
    expect(mgrGuard.errorCode).toBe("PIN_ENFORCEMENT_UNAVAILABLE");

    const plrGuard = await requirePlayerSession(
      new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
        headers: { host: "fchdhgonoi.vercel.app", cookie: mgrCookie },
      }),
      { allowTemporaryPinChange: true }
    );
    expect(plrGuard.authorized).toBe(false);
    expect(plrGuard.status).toBe(503);

    const authGetRes = await getAuthRoute(
      new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
        headers: { host: "fchdhgonoi.vercel.app", cookie: mgrCookie },
      })
    );
    expect(authGetRes.status).toBe(503);

    // 7. Schema query error -> fail-closed 503
    const brokenDb = {
      query: async (sql: string) => {
        if (sql.includes("must_change_pin")) {
          throw new Error("SQLITE_BUSY: database connection error");
        }
        return [mgrRow];
      },
      queryOne: async () => {
        throw new Error("SQLITE_BUSY: database connection error");
      },
    } as unknown as AsyncDb;
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(brokenDb);
    const brokenGuard = await requirePlayerSession(
      new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
        headers: { host: "fchdhgonoi.vercel.app", cookie: mgrCookie },
      })
    );
    expect(brokenGuard.authorized).toBe(false);
    expect(brokenGuard.status).toBe(503);

    // ensureMustChangePinColumn ignores duplicate-column but rethrows connection/permission errors
    await expect(
      dbModule.ensureMustChangePinColumn({
        query: async () => [],
        exec: async () => {
          throw new Error("duplicate column name: must_change_pin");
        },
      })
    ).resolves.toBeUndefined();

    await expect(
      dbModule.ensureMustChangePinColumn({
        query: async () => [],
        exec: async () => {
          throw new Error("ECONNREFUSED: permission denied");
        },
      })
    ).rejects.toThrow(/ECONNREFUSED/);
  });

  it("12. Hides mustChangePin from Guest while exposing it to Manager", () => {
    const sampleData = {
      settings: {
        id: 1,
        team_name: "FC",
        short_name: "FC",
        monthly_fee: 100000,
        default_match_fee: 100000,
        fund_initial_balance: 0,
        tournament_fund_reserve: 0,
        tournament_fund_note: "secret note",
        bank_bin: "",
        bank_name: "",
        bank_account_no: "",
        bank_account_name: "",
        fanpage_url: "https://example.com",
      },
      players: [
        {
          id: 1,
          code_order: 1,
          full_name: "Manager",
          short_name: "M1",
          jersey_number: 1,
          position: "GK",
          phone: "0900000001",
          birth_year: "1990",
          avatar_url: "",
          role: "Đội trưởng",
          access_role: "manager" as const,
          username: "m1",
          pin_code: "",
          must_change_pin: 0,
          status: "Đang sinh hoạt",
          notes: "",
        },
        {
          id: 2,
          code_order: 2,
          full_name: "Player 2",
          short_name: "P2",
          jersey_number: 2,
          position: "DF",
          phone: "0900000002",
          birth_year: "1995",
          avatar_url: "",
          role: "Thành viên",
          access_role: "player" as const,
          username: "p2",
          pin_code: "",
          must_change_pin: 1,
          status: "Đang sinh hoạt",
          notes: "",
        },
      ],
      matches: [],
      attendances: [],
      otherIncomes: [],
      expenses: [],
      summary: {
        totalCollectionIncome: 0,
        totalMatchIncome: 0,
        totalOtherIncome: 0,
        totalIncome: 0,
        totalExpense: 0,
        currentBalance: 0,
        totalUnpaidAmount: 0,
        remainingMatchCount: 0,
        categoryBreakdown: [],
      },
    };

    const guestView = sanitizeTeamResponseData(sampleData, null);
    expect((guestView.players[1] as Record<string, unknown>).mustChangePin).toBeUndefined();
    expect((guestView.players[1] as Record<string, unknown>).must_change_pin).toBeUndefined();

    const managerView = sanitizeTeamResponseData(sampleData, {
      playerId: 1,
      accessRole: "manager",
    });
    expect(managerView.players[1].mustChangePin).toBe(true);
  });

  it("13. LoginModal, PlayerPersonalTab, and PlayersTab allow 12-char mixed-case/symbol temporary PINs without numeric/4-digit restrictions or browser storage", () => {
    const loginSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/LoginModal.tsx"),
      "utf8"
    );
    const personalSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/PlayerPersonalTab.tsx"),
      "utf8"
    );
    const playersTabSrc = fs.readFileSync(
      path.join(process.cwd(), "src/components/PlayersTab.tsx"),
      "utf8"
    );

    for (const src of [loginSrc, personalSrc, playersTabSrc]) {
      expect(src).not.toContain('inputMode="numeric"');
      expect(src).not.toContain("maxLength={4}");
      expect(src).not.toContain('maxLength="4"');
    }
    expect(loginSrc).toContain("setPin(e.target.value)");
    expect(playersTabSrc).toContain("{issuedTempPin}");
    expect(playersTabSrc).not.toContain("localStorage");
    expect(playersTabSrc).not.toContain("sessionStorage");
  });
});
