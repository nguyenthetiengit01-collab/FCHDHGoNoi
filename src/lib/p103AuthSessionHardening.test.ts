import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getAuthRoute, POST as postAuthRoute } from "@/app/api/auth/route";
import { POST as postImportRoute } from "@/app/api/import/route";
import { POST as postTeamRoute } from "@/app/api/team/route";
import {
  createSessionToken,
  getPasswordFingerprint,
  hashPassword,
  isDefaultPassword,
  requireManagerSession,
  requirePlayerSession,
  SESSION_COOKIE_NAME,
  verifyCredentials,
  verifyPassword,
  verifySessionToken,
} from "./auth";
import {
  __resetAuthRateLimitForTest,
  __setAuthRateLimitDriverForTest,
  type AuthRateLimitDriver,
} from "./authRateLimit";
import * as dbModule from "./db";
import type { AsyncDb } from "./db";
import type { Player } from "@/types/app";

const SECRET_A = "p103-effective-secret-key-alpha-at-least-32-chars!";
const SECRET_B = "p103-effective-secret-key-bravo-at-least-32-chars!";
const tempDirs: string[] = [];

function createAllowRateLimiter(): AuthRateLimitDriver {
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

function createIsolatedDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-p103-"));
  tempDirs.push(dir);
  const sqlitePath = path.join(dir, "p103.sqlite");
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
      status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
      notes TEXT NOT NULL DEFAULT '',
      hometown TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      playing_style TEXT NOT NULL DEFAULT '',
      gallery_urls_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      match_date TEXT NOT NULL,
      kickoff_time TEXT NOT NULL DEFAULT '19:00',
      venue TEXT NOT NULL DEFAULT 'Sân Vĩnh Lộc',
      opponent TEXT NOT NULL DEFAULT 'Giao hữu / Nội bộ',
      fee_per_player INTEGER NOT NULL DEFAULT 100000,
      pitch_cost INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE match_attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      rsvp_status TEXT NOT NULL DEFAULT 'yes',
      attended INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      amount INTEGER NOT NULL DEFAULT 0,
      collected_by TEXT NOT NULL DEFAULT '',
      paid_at TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE other_incomes (id INTEGER PRIMARY KEY AUTOINCREMENT, income_date TEXT NOT NULL, title TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, contributor TEXT NOT NULL DEFAULT '', sponsor_id INTEGER, notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, expense_date TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Khác', amount INTEGER NOT NULL DEFAULT 0, paid_by TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE club_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', cover_image_url TEXT NOT NULL DEFAULT '', gallery_urls_json TEXT NOT NULL DEFAULT '[]', published_at TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE sponsors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, tier TEXT NOT NULL DEFAULT 'Đồng hành', contribution_amount INTEGER NOT NULL DEFAULT 0, contribution_note TEXT NOT NULL DEFAULT '', logo_url TEXT NOT NULL DEFAULT '', featured INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER NOT NULL, actor_name TEXT NOT NULL, actor_role TEXT NOT NULL, action TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);

  const mgrHash = hashPassword("MgrStrong@2026");
  const playerHash = hashPassword("PlrStrong@2026");
  raw.prepare(`
    INSERT INTO players (code_order, full_name, short_name, jersey_number, access_role, username, pin_code, status)
    VALUES (1, 'Manager One', 'Mgr1', 1, 'manager', 'mgr1', ?, 'Đang sinh hoạt'),
           (2, 'Player Two', 'Plr2', 2, 'player', 'plr2', ?, 'Đang sinh hoạt'),
           (3, 'Default Plain', 'Def3', 3, 'player', 'def3', '1234', 'Đang sinh hoạt'),
           (4, 'Default Hash', 'Def4', 4, 'player', 'def4', ?, 'Đang sinh hoạt'),
           (5, 'Empty Pin', 'Emp5', 5, 'player', 'emp5', '', 'Đang sinh hoạt'),
           (6, 'Legacy Custom', 'Leg6', 6, 'player', 'leg6', 'LegacyNonDefault@99', 'Đang sinh hoạt')
  `).run(mgrHash, playerHash, hashPassword("1234"));

  const adapter = new dbModule.LocalSqliteAdapter(raw);
  vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter as unknown as AsyncDb);
  return { raw, adapter };
}

function buildCookieHeader(token: string) {
  return `${SESSION_COOKIE_NAME}=${token}`;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  __resetAuthRateLimitForTest();
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("P1-03 Security Incident — Authentication & Session Hardening", () => {
  it("1. Import cannot create PIN '1234' and assigns random unclaimed scrypt$ hash", async () => {
    vi.stubEnv("APP_SECRET", SECRET_A);
    vi.stubEnv("AUTH_SECRET", SECRET_A);
    const { raw } = createIsolatedDb();
    try {
      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrCookie = buildCookieHeader(createSessionToken(mgr));

      const wb = XLSX.utils.book_new();
      const wsDanhSach = XLSX.utils.aoa_to_sheet([
        ["DANH SÁCH ĐỘI BÓNG"],
        [""],
        [""],
        ["STT", "Họ và tên", "Vị trí", "Số áo", "SĐT", "Ghi chú"],
        [1, "Imported Member", "MF", 19, "0909111222", ""],
      ]);
      const wsThuTran = XLSX.utils.aoa_to_sheet([["STT", "Họ và tên"]]);
      const wsChi = XLSX.utils.aoa_to_sheet([["Ngày", "Danh mục", "Nội dung", "Số tiền", "Người chi"]]);
      XLSX.utils.book_append_sheet(wb, wsDanhSach, "2. Danh sách");
      XLSX.utils.book_append_sheet(wb, wsThuTran, "3. Thu Trận (Tích chọn)");
      XLSX.utils.book_append_sheet(wb, wsChi, "5. Chi");
      const xlsxBytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

      const form = new FormData();
      form.append(
        "file",
        new File([new Uint8Array(xlsxBytes)], "import.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );

      const res = await postImportRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/import", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://fchdhgonoi.vercel.app",
            cookie: mgrCookie,
          },
          body: form,
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(JSON.stringify(body)).not.toContain("scrypt$");

      const imported = raw
        .prepare("SELECT pin_code FROM players WHERE full_name = 'Imported Member'")
        .get() as { pin_code: string };
      expect(imported.pin_code.startsWith("scrypt$")).toBe(true);
      expect(verifyPassword("1234", imported.pin_code)).toBe(false);
    } finally {
      raw.close();
    }
  });

  it("2, 3, 4. Upsert rejects '1234', '123456', weak PINs, and client-supplied scrypt$; omitted PIN produces random unclaimed hash", async () => {
    vi.stubEnv("APP_SECRET", SECRET_A);
    const { raw } = createIsolatedDb();
    try {
      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrCookie = buildCookieHeader(createSessionToken(mgr));

      const callUpsert = (payload: Record<string, unknown>) =>
        postTeamRoute(
          new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
            method: "POST",
            headers: {
              host: "fchdhgonoi.vercel.app",
              origin: "https://fchdhgonoi.vercel.app",
              cookie: mgrCookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ action: "upsert_player", payload }),
          })
        );

      for (const badPin of ["1234", "123456", "111111", hashPassword("1234")]) {
        const createRes = await callUpsert({ full_name: "Bad Create", pin_code: badPin });
        expect(createRes.status).toBe(400);

        const updateRes = await callUpsert({ id: 2, full_name: "Player Two", pin_code: badPin });
        expect(updateRes.status).toBe(400);
      }

      const omittedRes = await callUpsert({ full_name: "Omitted Pin Player", access_role: "player" });
      expect(omittedRes.status).toBe(200);
      const created = raw
        .prepare("SELECT pin_code FROM players WHERE full_name = 'Omitted Pin Player'")
        .get() as { pin_code: string };
      expect(created.pin_code.startsWith("scrypt$")).toBe(true);
      expect(verifyPassword("1234", created.pin_code)).toBe(false);
    } finally {
      raw.close();
    }
  });

  it("5, 6, 7, 8, 9. Fail-closed missing/null/default PINs, scrypt$ '1234' detection, and deterministic non-default legacy migration", async () => {
    vi.stubEnv("APP_SECRET", SECRET_A);
    __setAuthRateLimitDriverForTest(createAllowRateLimiter());
    const { raw } = createIsolatedDb();
    try {
      expect(getPasswordFingerprint(null)).toBeNull();
      expect(getPasswordFingerprint("")).toBeNull();
      expect(() =>
        createSessionToken({
          id: 5,
          code_order: 5,
          full_name: "Empty Pin",
          short_name: "Emp5",
          jersey_number: 5,
          position: "Đa năng",
          phone: "",
          birth_year: "",
          avatar_url: "",
          bio: "",
          role: "Thành viên",
          access_role: "player",
          pin_code: "",
          status: "Đang sinh hoạt",
          notes: "",
        })
      ).toThrow();

      // Missing/empty PIN in DB fails closed even when attempting "1234"
      const emptyDbRes = await verifyCredentials("emp5", "1234", "10.0.0.1");
      expect(emptyDbRes.success).toBe(false);
      expect(emptyDbRes.status).toBe(401);

      // Plaintext default PIN "1234" cannot authenticate and is NOT auto-rehashed
      const plainDefaultRes = await verifyCredentials("def3", "1234", "10.0.0.1");
      expect(plainDefaultRes.success).toBe(false);
      expect(plainDefaultRes.status).toBe(403);
      expect(plainDefaultRes.errorCode).toBe("DEFAULT_PIN_RESET_REQUIRED");
      const def3Row = raw.prepare("SELECT pin_code FROM players WHERE id = 3").get() as { pin_code: string };
      expect(def3Row.pin_code).toBe("1234");

      // Hash of "1234" is still detected as default and rejected at login
      expect(isDefaultPassword("1234")).toBe(true);
      expect(isDefaultPassword(hashPassword("1234"))).toBe(true);
      const hashDefaultRes = await verifyCredentials("def4", "1234", "10.0.0.1");
      expect(hashDefaultRes.success).toBe(false);
      expect(hashDefaultRes.status).toBe(403);
      expect(hashDefaultRes.errorCode).toBe("DEFAULT_PIN_RESET_REQUIRED");

      // Non-default legacy plaintext migrates deterministically to scrypt$
      const legacyRes = await verifyCredentials("leg6", "LegacyNonDefault@99", "10.0.0.1");
      expect(legacyRes.success).toBe(true);
      expect(legacyRes.status).toBe(200);
      const leg6Row = raw.prepare("SELECT pin_code FROM players WHERE id = 6").get() as { pin_code: string };
      expect(leg6Row.pin_code.startsWith("scrypt$")).toBe(true);
      expect(verifyPassword("LegacyNonDefault@99", leg6Row.pin_code)).toBe(true);
    } finally {
      raw.close();
    }
  });

  it("10, 11, 12, 13. Reset PIN invalidates old session, legacy token without pwdFingerprint is rejected, and effective secret rotation invalidates old fc_session", async () => {
    vi.stubEnv("APP_SECRET", SECRET_A);
    vi.stubEnv("AUTH_SECRET", SECRET_A);
    const { raw } = createIsolatedDb();
    try {
      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const plr = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
      const mgrCookie = buildCookieHeader(createSessionToken(mgr));
      const oldPlrToken = createSessionToken(plr);

      // 11. Legacy token without pwdFingerprint is explicitly rejected
      const legacyPayloadB64 = Buffer.from(
        JSON.stringify({
          playerId: 2,
          accessRole: "player",
          fullName: "Player Two",
          shortName: "Plr2",
          jerseyNumber: 2,
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString("base64url");
      const legacySig = crypto.createHmac("sha256", SECRET_A).update(legacyPayloadB64).digest("base64url");
      const legacyToken = `${legacyPayloadB64}.${legacySig}`;
      expect(verifySessionToken(legacyToken)).toBeNull();

      const legacyGetRes = await getAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          headers: { cookie: buildCookieHeader(legacyToken) },
        })
      );
      expect(legacyGetRes.status).toBe(200);
      expect((await legacyGetRes.json()).authenticated).toBe(false);

      // 10. Reset PIN invalidates prior fingerprint-bearing session
      const resetRes = await postTeamRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://fchdhgonoi.vercel.app",
            cookie: mgrCookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "reset_player_password",
            payload: { player_id: 2, new_pin: "NewSafePin@2026" },
          }),
        })
      );
      expect(resetRes.status).toBe(200);

      const staleCheck = await requirePlayerSession(
        new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
          headers: { cookie: buildCookieHeader(oldPlrToken) },
        })
      );
      expect(staleCheck.authorized).toBe(false);
      expect(staleCheck.status).toBe(401);

      const staleGet = await getAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          headers: { cookie: buildCookieHeader(oldPlrToken) },
        })
      );
      expect(staleGet.status).toBe(200);
      expect((await staleGet.json()).authenticated).toBe(false);

      // 12 & 13. Effective secret rotation (APP_SECRET prioritized in Production) rejects old fc_session and accepts new
      vi.stubEnv("APP_SECRET", SECRET_B);
      vi.stubEnv("AUTH_SECRET", SECRET_B);

      const rotatedGet = await getAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          headers: { cookie: mgrCookie },
        })
      );
      expect(rotatedGet.status).toBe(200);
      expect((await rotatedGet.json()).authenticated).toBe(false);

      const rotatedMgrCheck = await requireManagerSession(
        new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
          headers: { cookie: mgrCookie },
        })
      );
      expect(rotatedMgrCheck.authorized).toBe(false);
      expect(rotatedMgrCheck.status).toBe(401);

      const newMgrToken = createSessionToken(mgr);
      const newMgrGet = await getAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          headers: { cookie: buildCookieHeader(newMgrToken) },
        })
      );
      expect(newMgrGet.status).toBe(200);
      expect((await newMgrGet.json()).authenticated).toBe(true);
    } finally {
      raw.close();
    }
  });

  it("14 & 15. Manager switch_role is RBAC-protected and auditable; ordinary login, logout, and rememberMe work", async () => {
    vi.stubEnv("APP_SECRET", SECRET_A);
    vi.stubEnv("AUTH_SECRET", SECRET_A);
    __setAuthRateLimitDriverForTest(createAllowRateLimiter());
    const { raw } = createIsolatedDb();
    try {
      // Ordinary login with rememberMe=true sets fc_session cookie
      const loginRes = await postAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://fchdhgonoi.vercel.app",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "login",
            username: "mgr1",
            pin: "MgrStrong@2026",
            rememberMe: true,
          }),
        })
      );
      expect(loginRes.status).toBe(200);
      const setCookie = loginRes.headers.get("set-cookie") || "";
      expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);

      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const plr = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;

      // Player caller rejected 403
      const plrSwitch = await postAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://fchdhgonoi.vercel.app",
            cookie: buildCookieHeader(createSessionToken(plr)),
            "content-type": "application/json",
          },
          body: JSON.stringify({ action: "switch_role", playerId: 1 }),
        })
      );
      expect(plrSwitch.status).toBe(403);

      // Manager caller succeeds and writes audit_logs without credentials
      const mgrSwitch = await postAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://fchdhgonoi.vercel.app",
            cookie: buildCookieHeader(createSessionToken(mgr)),
            "content-type": "application/json",
          },
          body: JSON.stringify({ action: "switch_role", playerId: 2 }),
        })
      );
      expect(mgrSwitch.status).toBe(200);

      const audit = raw
        .prepare("SELECT actor_id, actor_role, action, summary FROM audit_logs WHERE action = 'switch_role'")
        .get() as { actor_id: number; actor_role: string; action: string; summary: string } | undefined;
      expect(audit).toBeDefined();
      expect(audit?.actor_id).toBe(1);
      expect(audit?.actor_role).toBe("manager");
      expect(audit?.summary).toContain("player #2");
      expect(audit?.summary).not.toContain("scrypt$");

      // Logout clears fc_session
      const logoutRes = await postAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://fchdhgonoi.vercel.app",
            "content-type": "application/json",
          },
          body: JSON.stringify({ action: "logout" }),
        })
      );
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.headers.get("set-cookie") || "").toContain(`${SESSION_COOKIE_NAME}=;`);
    } finally {
      raw.close();
    }
  });
});
