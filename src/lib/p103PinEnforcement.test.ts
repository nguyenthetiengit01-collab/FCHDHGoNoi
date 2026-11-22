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

function setupIsolatedDb(tempDirs: string[], openDbs: DatabaseSync[]) {
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
      must_change_pin INTEGER NOT NULL DEFAULT 0,
      hometown TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      playing_style TEXT NOT NULL DEFAULT '',
      gallery_urls_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, match_number INTEGER NOT NULL, label TEXT NOT NULL, match_date TEXT NOT NULL, kickoff_time TEXT NOT NULL DEFAULT '19:00', venue TEXT NOT NULL DEFAULT '', opponent TEXT NOT NULL DEFAULT '', fee_per_player INTEGER NOT NULL DEFAULT 100000, pitch_cost INTEGER NOT NULL DEFAULT 0, payer_name TEXT NOT NULL DEFAULT '', team_score INTEGER, opponent_score INTEGER, status TEXT NOT NULL DEFAULT 'Đã kết thúc', notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE match_attendances (id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER NOT NULL, player_id INTEGER NOT NULL, rsvp_status TEXT NOT NULL DEFAULT 'none', walk_in INTEGER NOT NULL DEFAULT 0, attended INTEGER NOT NULL DEFAULT 0, paid INTEGER NOT NULL DEFAULT 0, amount INTEGER NOT NULL DEFAULT 0, collected_by TEXT NOT NULL DEFAULT '', paid_at TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '');
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

describe("P1-03 PIN Enforcement Remediation (must_change_pin & assessment)", () => {
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

  it("sets must_change_pin=1 on manager reset_player_password, blocks normal actions with 403 PIN_CHANGE_REQUIRED, and clears on personal PIN update", async () => {
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
    const managerCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(managerRow as never, 24)}`;

    // 1. Manager resets player 2's PIN to a unique temporary PIN
    const resetRes = await postTeamRoute(
      makeReq(
        "/api/team",
        { action: "reset_player_password", payload: { player_id: 2, new_pin: "TempReset@9911" } },
        managerCookie
      )
    );
    expect(resetRes.status).toBe(200);

    const updatedAfterReset = raw
      .prepare("SELECT pin_code, must_change_pin FROM players WHERE id = 2")
      .get() as { pin_code: string; must_change_pin: number };
    expect(updatedAfterReset.must_change_pin).toBe(1);
    expect(updatedAfterReset.pin_code.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("TempReset@9911", updatedAfterReset.pin_code)).toBe(true);

    // 2. Player logs in with temporary PIN -> succeeds with mustChangePassword=true
    const loginCheck = await verifyCredentials("player2", "TempReset@9911", "127.0.0.1");
    expect(loginCheck.success).toBe(true);
    expect(loginCheck.mustChangePassword).toBe(true);

    const loginRes = await postAuthRoute(
      makeReq("/api/auth", { action: "login", username: "player2", pin: "TempReset@9911" })
    );
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as {
      mustChangePassword?: boolean;
      player?: { mustChangePin?: boolean };
    };
    expect(loginBody.mustChangePassword).toBe(true);
    expect(loginBody.player?.mustChangePin).toBe(true);

    const setCookieHeader = loginRes.headers.get("set-cookie") || "";
    const playerCookie = setCookieHeader.split(";")[0];
    expect(playerCookie.startsWith(`${SESSION_COOKIE_NAME}=`)).toBe(true);

    // GET /api/auth also reflects mustChangePassword=true
    const sessionRes = await getAuthRoute(
      new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
        headers: { host: "fchdhgonoi.vercel.app", cookie: playerCookie },
      })
    );
    expect(sessionRes.status).toBe(200);
    const sessionBody = (await sessionRes.json()) as { mustChangePassword?: boolean };
    expect(sessionBody.mustChangePassword).toBe(true);

    // 3. Normal mutating action (set_rsvp) is blocked while must_change_pin=1
    const blockedRsvpRes = await postTeamRoute(
      makeReq(
        "/api/team",
        { action: "set_rsvp", payload: { player_id: 2, match_id: 1, rsvp_status: "registered" } },
        playerCookie
      )
    );
    expect(blockedRsvpRes.status).toBe(403);
    const blockedBody = (await blockedRsvpRes.json()) as { code?: string };
    expect(blockedBody.code).toBe("PIN_CHANGE_REQUIRED");

    // 4. Reusing the temporary PIN as the new PIN is rejected
    const reuseRes = await postTeamRoute(
      makeReq(
        "/api/team",
        {
          action: "change_own_password",
          payload: { player_id: 2, old_pin: "TempReset@9911", new_pin: "TempReset@9911" },
        },
        playerCookie
      )
    );
    expect(reuseRes.status).toBe(400);

    // 5. Updating to a distinct strong personal PIN clears must_change_pin=0
    const changeRes = await postTeamRoute(
      makeReq(
        "/api/team",
        {
          action: "change_own_password",
          payload: { player_id: 2, old_pin: "TempReset@9911", new_pin: "PersonalStrong@2026" },
        },
        playerCookie
      )
    );
    expect(changeRes.status).toBe(200);

    const updatedAfterChange = raw
      .prepare("SELECT pin_code, must_change_pin FROM players WHERE id = 2")
      .get() as { pin_code: string; must_change_pin: number };
    expect(updatedAfterChange.must_change_pin).toBe(0);
    expect(verifyPassword("PersonalStrong@2026", updatedAfterChange.pin_code)).toBe(true);
  });

  it("hides mustChangePin from Guest while exposing it to Manager", () => {
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

  it("computes read-only aggregate account assessment without leaking PII or credential values", async () => {
    const mod = (await import("../../scripts/p103-account-assessment.mjs")) as {
      aggregateAccountAssessment: (
        rows: Array<Record<string, unknown>>,
        opts?: { hasMustChangePinColumn?: boolean; schemaPinCodeDefault?: string }
      ) => Record<string, unknown>;
    };

    const summary = mod.aggregateAccountAssessment(
      [
        { status: "Đang sinh hoạt", access_role: "manager", pin_code: hashPassword("StrongMgr@2026"), must_change_pin: 0 },
        { status: "Đang sinh hoạt", access_role: "player", pin_code: "1234", must_change_pin: 0 },
        { status: "Đang sinh hoạt", access_role: "player", pin_code: hashPassword("1234"), must_change_pin: 0 },
        { status: "Đang sinh hoạt", access_role: "player", pin_code: hashPassword("Temp@9911"), must_change_pin: 1 },
        { status: "inactive", access_role: "player", pin_code: "1234", must_change_pin: 0 },
      ],
      { hasMustChangePinColumn: true, schemaPinCodeDefault: "none" }
    );

    expect(summary).toEqual({
      status: "ok",
      readOnly: true,
      totalAccounts: 5,
      activeAccounts: 4,
      inactiveAccounts: 1,
      activeByRole: { manager: 1, player: 3, other: 0 },
      activeCredentials: {
        missingOrEmpty: 0,
        legacyPlaintextDefault1234: 1,
        legacyPlaintextNonDefault: 0,
        scryptDefault1234: 1,
        scryptNonDefault: 2,
        undetermined: 0,
      },
      resetRequiredCount: 2,
      mustChangePinPending: 1,
      schemaPinCodeDefault: "none",
    });
  });
});
