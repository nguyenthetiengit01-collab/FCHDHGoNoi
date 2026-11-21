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
  getAuthSecret,
  hashPassword,
  requireManagerSession,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "./auth";
import * as dbModule from "./db";
import type { AsyncDb } from "./db";
import type { Player } from "@/types/app";
import {
  MIGRATION_VERSION,
  runPhase7P103PinDefaultLocalMigration,
} from "../../scripts/migrations/phase7-p103-pin-default-v1.mjs";

const SECRET_A = "p103-followup-secret-alpha-32-chars-minimum!";
const SECRET_B = "p103-followup-secret-bravo-32-chars-minimum!";
const SECRET_C = "p103-followup-secret-charlie-32-chars-min!";
const SECRET_D = "p103-followup-secret-delta-32-chars-minimum!";
const SECRET_P = "p103-followup-preview-secret-32-chars-min!!";

const tempDirs: string[] = [];

function createTempDir(prefix = "fc-p103-followup-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createLegacyPlayersDbWithDefault1234() {
  const dir = createTempDir("fc-p103-mig-");
  const sqlitePath = path.join(dir, "legacy-default.sqlite");
  const raw = new DatabaseSync(sqlitePath);

  raw.exec(`
    PRAGMA foreign_keys = ON;
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
      pin_code TEXT NOT NULL DEFAULT '1234',
      status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
      notes TEXT NOT NULL DEFAULT '',
      hometown TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      playing_style TEXT NOT NULL DEFAULT '',
      gallery_urls_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX idx_players_status ON players(status);
    CREATE TABLE player_audit_shadow (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      event_name TEXT NOT NULL
    );
    CREATE TRIGGER trg_players_after_update AFTER UPDATE ON players
    BEGIN
      INSERT INTO player_audit_shadow (player_id, event_name) VALUES (NEW.id, 'updated');
    END;
    CREATE TABLE matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      match_date TEXT NOT NULL,
      kickoff_time TEXT NOT NULL DEFAULT '19:00',
      venue TEXT NOT NULL DEFAULT 'Sân Vĩnh Lộc',
      opponent TEXT NOT NULL DEFAULT 'Giao hữu',
      fee_per_player INTEGER NOT NULL DEFAULT 100000,
      pitch_cost INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'scheduled',
      notes TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO matches (match_number, label, match_date) VALUES (1, 'Trận 1', '2026-11-20');
    CREATE TABLE match_attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      rsvp_status TEXT NOT NULL DEFAULT 'yes',
      attended INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      amount INTEGER NOT NULL DEFAULT 0,
      walk_in INTEGER NOT NULL DEFAULT 0,
      collected_by TEXT NOT NULL DEFAULT '',
      paid_at TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      UNIQUE(match_id, player_id)
    );
    CREATE TABLE other_incomes (id INTEGER PRIMARY KEY AUTOINCREMENT, income_date TEXT NOT NULL, title TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, contributor TEXT NOT NULL DEFAULT '', sponsor_id INTEGER, notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, expense_date TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Khác', amount INTEGER NOT NULL DEFAULT 0, paid_by TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE club_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', cover_image_url TEXT NOT NULL DEFAULT '', gallery_urls_json TEXT NOT NULL DEFAULT '[]', published_at TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE sponsors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, tier TEXT NOT NULL DEFAULT 'Đồng hành', contribution_amount INTEGER NOT NULL DEFAULT 0, contribution_note TEXT NOT NULL DEFAULT '', logo_url TEXT NOT NULL DEFAULT '', featured INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER NOT NULL, actor_name TEXT NOT NULL, actor_role TEXT NOT NULL, action TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  `);

  const mgrHash = hashPassword("MgrStrong@2026");
  const plrHash = hashPassword("PlrStrong@2026");
  raw.prepare(`
    INSERT INTO players (code_order, full_name, short_name, jersey_number, access_role, username, pin_code, status)
    VALUES (1, 'Manager Active', 'Mgr1', 1, 'manager', 'mgr1', ?, 'Đang sinh hoạt'),
           (2, 'Player Active', 'Plr2', 2, 'player', 'plr2', ?, 'Đang sinh hoạt'),
           (3, 'Default Plain Target', 'Def3', 3, 'player', 'def3', '1234', 'Đang sinh hoạt'),
           (4, 'Default Hash Target', 'Def4', 4, 'player', 'def4', ?, 'Đang sinh hoạt'),
           (5, 'Empty Pin Target', 'Emp5', 5, 'player', 'emp5', '', 'Đang sinh hoạt'),
           (6, 'Inactive Target', 'Ina6', 6, 'player', 'ina6', ?, 'inactive')
  `).run(mgrHash, plrHash, hashPassword("1234"), hashPassword("InactiveStrong@2026"));

  raw.prepare("INSERT INTO match_attendances (match_id, player_id, attended, paid, amount) VALUES (1, 2, 1, 1, 100000)").run();

  return { sqlitePath, raw, mgrHash, plrHash };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("P1-03 Follow-Up Hardening — Schema Migration, switch_role Containment & Secret Precedence", () => {
  it("1, 2, 3, 4. Legacy schema migration removes DEFAULT '1234', is idempotent, and preserves columns, rows, indexes, triggers, and FK integrity", () => {
    const { raw, mgrHash, plrHash } = createLegacyPlayersDbWithDefault1234();
    try {
      const beforeCols = raw.prepare("PRAGMA table_info(players)").all() as Array<{
        name: string;
        dflt_value: string | null;
      }>;
      expect(beforeCols.find((c) => c.name === "pin_code")?.dflt_value).toBe("'1234'");

      // Dry-run performs zero writes
      const dryRes = runPhase7P103PinDefaultLocalMigration({ db: raw, dryRun: true });
      expect(dryRes.dryRun).toBe(true);
      expect(dryRes.applied).toBe(false);
      expect(dryRes.actions.length).toBeGreaterThan(0);

      const afterDryCols = raw.prepare("PRAGMA table_info(players)").all() as Array<{
        name: string;
        dflt_value: string | null;
      }>;
      expect(afterDryCols.find((c) => c.name === "pin_code")?.dflt_value).toBe("'1234'");

      // Apply migration
      const applyRes = runPhase7P103PinDefaultLocalMigration({ db: raw, dryRun: false });
      expect(applyRes.applied).toBe(true);
      expect(applyRes.alreadyApplied).toBe(false);
      expect(applyRes.preservedIndexes).toBe(1);
      expect(applyRes.preservedTriggers).toBe(1);

      const afterCols = raw.prepare("PRAGMA table_info(players)").all() as Array<{
        name: string;
        dflt_value: string | null;
      }>;
      expect(afterCols.map((c) => c.name)).toEqual(beforeCols.map((c) => c.name));
      expect(afterCols.find((c) => c.name === "pin_code")?.dflt_value).toBe("''");

      const p1 = raw.prepare("SELECT pin_code FROM players WHERE id = 1").get() as { pin_code: string };
      const p2 = raw.prepare("SELECT pin_code FROM players WHERE id = 2").get() as { pin_code: string };
      expect(p1.pin_code).toBe(mgrHash);
      expect(p2.pin_code).toBe(plrHash);

      // Index & trigger preserved
      const idx = raw.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_players_status'").get();
      expect(idx).toBeDefined();
      raw.prepare("UPDATE players SET notes = 'check-trigger' WHERE id = 2").run();
      const trgRow = raw.prepare("SELECT event_name FROM player_audit_shadow WHERE player_id = 2").get() as { event_name: string };
      expect(trgRow.event_name).toBe("updated");

      // Schema version recorded & idempotent on re-run
      const migRow = raw.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(MIGRATION_VERSION);
      expect(migRow).toBeDefined();
      const secondRun = runPhase7P103PinDefaultLocalMigration({ db: raw, dryRun: false });
      expect(secondRun.applied).toBe(false);
      expect(secondRun.alreadyApplied).toBe(true);
      expect(secondRun.actions).toEqual([]);

      // Foreign key integrity preserved
      expect(raw.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect((raw.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check).toBe("ok");
      expect(() =>
        raw.prepare("INSERT INTO match_attendances (match_id, player_id) VALUES (1, 9999)").run()
      ).toThrow();
    } finally {
      raw.close();
    }
  });

  it("5 & 6. Seed, walk-in, and Excel import preserve existing credentials and never create '1234'", async () => {
    vi.stubEnv("APP_SECRET", SECRET_A);
    const { sqlitePath, raw, plrHash } = createLegacyPlayersDbWithDefault1234();
    const adapter = new dbModule.LocalSqliteAdapter(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter as unknown as AsyncDb);
    try {
      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(mgr)}`;

      // Walk-in creates random scrypt$ hash (never '1234')
      const walkinRes = await postTeamRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://fchdhgonoi.vercel.app",
            cookie: mgrCookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "add_walkin_player",
            payload: { new_player_name: "Walkin Safe", match_id: 1, amount: 100000 },
          }),
        })
      );
      expect(walkinRes.status).toBe(200);
      const walkinRow = raw.prepare("SELECT pin_code FROM players WHERE full_name = 'Walkin Safe'").get() as { pin_code: string };
      expect(walkinRow.pin_code.startsWith("scrypt$")).toBe(true);
      expect(verifyPassword("1234", walkinRow.pin_code)).toBe(false);

      // Excel import preserves Player Active's existing pin_code and assigns random hash to new player
      const wb = XLSX.utils.book_new();
      const wsDanhSach = XLSX.utils.aoa_to_sheet([
        ["DANH SÁCH ĐỘI BÓNG"],
        [""],
        [""],
        ["STT", "Họ và tên", "Vị trí", "Số áo", "SĐT", "Ghi chú"],
        [1, "Player Active", "MF", 2, "0909222333", "Updated profile"],
        [2, "Brand New Import", "FW", 19, "0909444555", ""],
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
      const importRes = await postImportRoute(
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
      expect(importRes.status).toBe(200);

      const existingAfter = raw.prepare("SELECT pin_code FROM players WHERE full_name = 'Player Active'").get() as { pin_code: string };
      expect(existingAfter.pin_code).toBe(plrHash);

      const importedNew = raw.prepare("SELECT pin_code FROM players WHERE full_name = 'Brand New Import'").get() as { pin_code: string };
      expect(importedNew.pin_code.startsWith("scrypt$")).toBe(true);
      expect(verifyPassword("1234", importedNew.pin_code)).toBe(false);

      // Seeded fresh DB sets random scrypt$ hashes (never '1234')
      const freshDir = createTempDir("fc-p103-seed-");
      const freshPath = path.join(freshDir, "fresh.sqlite");
      const freshRaw = new DatabaseSync(freshPath);
      try {
        dbModule.initQaDatabaseSchema(freshRaw);
        const freshAdapter = new dbModule.LocalSqliteAdapter(freshRaw);
        await dbModule.seedAsyncInitialDataIfNeeded(freshAdapter, true);
        const seededRows = freshRaw.prepare("SELECT pin_code FROM players").all() as Array<{ pin_code: string }>;
        expect(seededRows.length).toBeGreaterThan(0);
        for (const r of seededRows) {
          expect(r.pin_code.startsWith("scrypt$")).toBe(true);
          expect(verifyPassword("1234", r.pin_code)).toBe(false);
        }
      } finally {
        freshRaw.close();
      }
      expect(sqlitePath).toBeTruthy();
    } finally {
      raw.close();
    }
  });

  it("7, 8, 9. switch_role rejects default plaintext/hashed '1234', empty credential, and inactive targets without issuing fc_session; normal switch succeeds and is audited", async () => {
    vi.stubEnv("APP_SECRET", SECRET_A);
    const { raw } = createLegacyPlayersDbWithDefault1234();
    const adapter = new dbModule.LocalSqliteAdapter(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter as unknown as AsyncDb);
    try {
      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(mgr)}`;

      const doSwitch = (playerId: number) =>
        postAuthRoute(
          new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
            method: "POST",
            headers: {
              host: "fchdhgonoi.vercel.app",
              origin: "https://fchdhgonoi.vercel.app",
              cookie: mgrCookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ action: "switch_role", playerId }),
          })
        );

      for (const blockedId of [3, 4, 5, 6]) {
        const res = await doSwitch(blockedId);
        expect(res.status).toBe(403);
        expect(res.headers.get("set-cookie")).toBeNull();
      }

      const okRes = await doSwitch(2);
      expect(okRes.status).toBe(200);
      expect(okRes.headers.get("set-cookie") || "").toContain(`${SESSION_COOKIE_NAME}=`);
      const audit = raw
        .prepare("SELECT actor_id, action, summary FROM audit_logs WHERE action = 'switch_role'")
        .get() as { actor_id: number; action: string; summary: string } | undefined;
      expect(audit?.actor_id).toBe(1);
      expect(audit?.summary).toContain("player #2");
    } finally {
      raw.close();
    }
  });

  it("10, 11, 12. Effective secret precedence (Production & Preview) and independent rotation test", async () => {
    // 10. Production precedence: APP_SECRET > AUTH_SECRET > NEXTAUTH_SECRET > SESSION_SECRET
    expect(
      getAuthSecret({
        NODE_ENV: "production",
        APP_SECRET: SECRET_A,
        AUTH_SECRET: SECRET_B,
        NEXTAUTH_SECRET: SECRET_C,
        SESSION_SECRET: SECRET_D,
      })
    ).toBe(SECRET_A);
    expect(
      getAuthSecret({
        NODE_ENV: "production",
        AUTH_SECRET: SECRET_B,
        NEXTAUTH_SECRET: SECRET_C,
        SESSION_SECRET: SECRET_D,
      })
    ).toBe(SECRET_B);
    expect(
      getAuthSecret({
        NODE_ENV: "production",
        NEXTAUTH_SECRET: SECRET_C,
        SESSION_SECRET: SECRET_D,
      })
    ).toBe(SECRET_C);
    expect(
      getAuthSecret({
        NODE_ENV: "production",
        SESSION_SECRET: SECRET_D,
      })
    ).toBe(SECRET_D);

    // 11. Preview precedence: PREVIEW_AUTH_SECRET > APP_SECRET > AUTH_SECRET > NEXTAUTH_SECRET > SESSION_SECRET
    expect(
      getAuthSecret({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        PREVIEW_AUTH_SECRET: SECRET_P,
        APP_SECRET: SECRET_A,
        AUTH_SECRET: SECRET_B,
        NEXTAUTH_SECRET: SECRET_C,
        SESSION_SECRET: SECRET_D,
      })
    ).toBe(SECRET_P);

    // 12. Independent effective rotation test with fc_session
    const { raw } = createLegacyPlayersDbWithDefault1234();
    const adapter = new dbModule.LocalSqliteAdapter(raw);
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter as unknown as AsyncDb);
    try {
      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;

      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("APP_SECRET", SECRET_A);
      vi.stubEnv("AUTH_SECRET", SECRET_B);

      const cookieSignedByA = `${SESSION_COOKIE_NAME}=${createSessionToken(mgr)}`;

      // Changing AUTH_SECRET from B to C does NOT invalidate cookie signed with APP_SECRET=A
      vi.stubEnv("AUTH_SECRET", SECRET_C);
      const authCheckStillValid = await getAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          headers: { cookie: cookieSignedByA },
        })
      );
      expect(authCheckStillValid.status).toBe(200);
      expect((await authCheckStillValid.json()).authenticated).toBe(true);

      // Changing APP_SECRET from A to D invalidates old cookie
      vi.stubEnv("APP_SECRET", SECRET_D);
      const authCheckInvalidated = await getAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          headers: { cookie: cookieSignedByA },
        })
      );
      expect(authCheckInvalidated.status).toBe(200);
      expect((await authCheckInvalidated.json()).authenticated).toBe(false);

      const mgrCheckInvalidated = await requireManagerSession(
        new NextRequest("https://fchdhgonoi.vercel.app/api/team", {
          headers: { cookie: cookieSignedByA },
        })
      );
      expect(mgrCheckInvalidated.authorized).toBe(false);
      expect(mgrCheckInvalidated.status).toBe(401);

      // Cookie signed by D is accepted
      const cookieSignedByD = `${SESSION_COOKIE_NAME}=${createSessionToken(mgr)}`;
      const authCheckD = await getAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          headers: { cookie: cookieSignedByD },
        })
      );
      expect(authCheckD.status).toBe(200);
      expect((await authCheckD.json()).authenticated).toBe(true);

      // Preview independently uses PREVIEW_AUTH_SECRET
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("PREVIEW_AUTH_SECRET", SECRET_P);
      const previewRejectsD = await getAuthRoute(
        new NextRequest("https://preview.vercel.app/api/auth", {
          headers: { cookie: cookieSignedByD },
        })
      );
      expect(previewRejectsD.status).toBe(200);
      expect((await previewRejectsD.json()).authenticated).toBe(false);

      const previewCookie = `${SESSION_COOKIE_NAME}=${createSessionToken(mgr)}`;
      const previewAcceptsP = await getAuthRoute(
        new NextRequest("https://preview.vercel.app/api/auth", {
          headers: { cookie: previewCookie },
        })
      );
      expect(previewAcceptsP.status).toBe(200);
      expect((await previewAcceptsP.json()).authenticated).toBe(true);
    } finally {
      raw.close();
    }
  });
});
