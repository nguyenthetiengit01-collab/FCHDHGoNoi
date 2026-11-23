import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postTeamRoute } from "@/app/api/team/route";
import { GET as getAuthRoute } from "@/app/api/auth/route";
import { POST as postImportRoute } from "@/app/api/import/route";
import { POST as postWebpRoute } from "@/app/api/webp/route";
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from "./auth";
import * as dbModule from "./db";
import { LocalSqliteAdapter, TursoWriteOutcomeUnknownError } from "./db";
import type { Player } from "@/types/app";

const tempDirs: string[] = [];

function createTestDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-p712-"));
  tempDirs.push(dir);
  const dbPath = path.join(dir, "test.sqlite");
  const raw = new DatabaseSync(dbPath);
  raw.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE team_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      team_name TEXT NOT NULL DEFAULT 'FC Test',
      short_name TEXT NOT NULL DEFAULT 'FCT',
      default_match_fee INTEGER NOT NULL DEFAULT 100000,
      bank_bin TEXT NOT NULL DEFAULT '',
      bank_name TEXT NOT NULL DEFAULT '',
      bank_account_no TEXT NOT NULL DEFAULT '',
      bank_account_name TEXT NOT NULL DEFAULT '',
      tournament_fund_reserve INTEGER NOT NULL DEFAULT 0,
      tournament_fund_note TEXT NOT NULL DEFAULT '',
      fanpage_url TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO team_settings (id) VALUES (1);
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_order INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      short_name TEXT NOT NULL DEFAULT '',
      jersey_number INTEGER,
      position TEXT NOT NULL DEFAULT 'ĐN',
      phone TEXT NOT NULL DEFAULT '',
      birth_year TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      profile_image_url TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'Thành viên',
      access_role TEXT NOT NULL DEFAULT 'player',
      username TEXT UNIQUE,
      pin_code TEXT NOT NULL DEFAULT '',
      must_change_pin INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
      notes TEXT NOT NULL DEFAULT '',
      hometown TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      playing_style TEXT NOT NULL DEFAULT '',
      gallery_urls_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      idempotency_key TEXT NOT NULL,
      actor_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      PRIMARY KEY (idempotency_key, actor_id, action)
    );
    CREATE TABLE matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      match_date TEXT NOT NULL,
      kickoff_time TEXT NOT NULL DEFAULT '19:00',
      venue TEXT NOT NULL DEFAULT '',
      opponent TEXT NOT NULL DEFAULT '',
      fee_per_player INTEGER NOT NULL DEFAULT 100000,
      pitch_cost INTEGER NOT NULL DEFAULT 0,
      payer_name TEXT NOT NULL DEFAULT '',
      team_score INTEGER,
      opponent_score INTEGER,
      status TEXT NOT NULL DEFAULT 'Sắp diễn ra',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE match_attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      rsvp_status TEXT NOT NULL DEFAULT 'none',
      walk_in INTEGER NOT NULL DEFAULT 0,
      attended INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      amount INTEGER NOT NULL DEFAULT 0,
      collected_by TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      UNIQUE(match_id, player_id)
    );
    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      payer TEXT NOT NULL DEFAULT '',
      match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_keys(expires_at);
  `);
  return { raw, db: new LocalSqliteAdapter(raw) };
}

function spyFullAppData(raw: DatabaseSync) {
  return vi.spyOn(dbModule, "getFullAppData").mockImplementation(async () => {
    const players = raw.prepare("SELECT * FROM players").all() as unknown as Player[];
    const matches = raw.prepare("SELECT * FROM matches").all() as never[];
    const attendances = raw.prepare("SELECT * FROM match_attendances").all() as never[];
    const expenses = raw.prepare("SELECT * FROM expenses").all() as never[];
    return {
      settings: {
        id: 1,
        team_name: "FC Test",
        short_name: "FCT",
        default_match_fee: 100000,
        bank_bin: "",
        bank_name: "",
        bank_account_no: "",
        bank_account_name: "",
        tournament_fund_reserve: 0,
        tournament_fund_note: "",
        fanpage_url: "",
      },
      players: players.map((p) => ({ ...p, pin_code: "" })),
      matches,
      attendances,
      otherIncomes: [],
      expenses,
      summary: {
        totalIncome: 0,
        totalMatchIncome: 0,
        totalOtherIncome: 0,
        totalExpense: 0,
        currentBalance: 0,
        totalMatchesCount: matches.length,
        totalPlayersCount: players.length,
        totalUnpaidAmount: 0,
        categoryBreakdown: [],
      },
    };
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const d = tempDirs.pop();
    if (d && fs.existsSync(d)) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        // Ignore Windows SQLite lock release timing
      }
    }
  }
});

describe("Phase 7.1.2 – Account Atomicity, Predictable PIN Removal, Financial Atomicity & Upload Limits", () => {
  it("change_own_password validates all fields before writing and commits username+PIN atomically", async () => {
    const { raw, db } = createTestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppData(raw);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, access_role, username, pin_code, status)
         VALUES (1, 'Manager', 'Mgr', 'manager', 'mgra', ?, 'Đang sinh hoạt'),
                (2, 'Player Two', 'P2', 'player', 'player2', ?, 'Đang sinh hoạt')`
      ).run(hashPassword("MgrStrong@2026"), hashPassword("OldStrong@2026"));

      const p2 = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
      const token2 = createSessionToken(p2, 24);

      // 1. Weak PIN + valid new username -> NO username change in DB
      const weakRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${token2}`,
          },
          body: JSON.stringify({
            action: "change_own_password",
            payload: {
              player_id: 2,
              old_pin: "OldStrong@2026",
              new_username: "newplayer2",
              new_pin: "1234",
            },
          }),
        })
      );
      expect(weakRes.status).toBe(400);
      const afterWeak = raw.prepare("SELECT username FROM players WHERE id = 2").get() as {
        username: string;
      };
      expect(afterWeak.username).toBe("player2");

      // 2. Duplicate username + valid PIN -> NO changes
      const dupRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${token2}`,
          },
          body: JSON.stringify({
            action: "change_own_password",
            payload: {
              player_id: 2,
              old_pin: "OldStrong@2026",
              new_username: "mgra",
              new_pin: "NewStrong@2026",
            },
          }),
        })
      );
      expect(dupRes.status).toBe(400);
      const afterDup = raw
        .prepare("SELECT username, pin_code FROM players WHERE id = 2")
        .get() as { username: string; pin_code: string };
      expect(afterDup.username).toBe("player2");
      expect(verifyPassword("OldStrong@2026", afterDup.pin_code)).toBe(true);

      // 3. Username + PIN update atomically + subsequent authenticated request succeeds
      const okRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${token2}`,
          },
          body: JSON.stringify({
            action: "change_own_password",
            payload: {
              player_id: 2,
              old_pin: "OldStrong@2026",
              new_username: "player2_renamed",
              new_pin: "NewStrong@2026",
            },
          }),
        })
      );
      expect(okRes.status).toBe(200);
      const setCookie = okRes.headers.get("set-cookie") || "";
      const newCookieVal = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1] || "";
      expect(newCookieVal).toBeTruthy();

      const nextAuthRes = await getAuthRoute(
        new NextRequest("http://localhost:3000/api/auth", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${newCookieVal}` },
        })
      );
      expect(nextAuthRes.status).toBe(200);
      const nextAuthJson = await nextAuthRes.json();
      expect(nextAuthJson.authenticated).toBe(true);
    } finally {
      raw.close();
    }
  });

  it("rejects missing or weak PIN on reset_player_password and never sets predictable '1234' on seeded/new accounts", async () => {
    const { raw, db } = createTestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppData(raw);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, access_role, username, pin_code, status)
         VALUES (1, 'Manager', 'Mgr', 'manager', 'mgra', ?, 'Đang sinh hoạt'),
                (2, 'Player Two', 'P2', 'player', 'player2', ?, 'Đang sinh hoạt')`
      ).run(hashPassword("MgrStrong@2026"), hashPassword("OldStrong@2026"));

      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrToken = createSessionToken(mgr, 24);

      const missingRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: JSON.stringify({
            action: "reset_player_password",
            payload: { player_id: 2 },
          }),
        })
      );
      expect(missingRes.status).toBe(400);

      const weakRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: JSON.stringify({
            action: "reset_player_password",
            payload: { player_id: 2, new_pin: "1234" },
          }),
        })
      );
      expect(weakRes.status).toBe(400);

      // Seeded players do not authenticate with fixed "1234"
      const seedDir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-seed-check-"));
      tempDirs.push(seedDir);
      const seedRaw = new DatabaseSync(path.join(seedDir, "seed.sqlite"));
      const seedAdapter = new LocalSqliteAdapter(seedRaw);
      dbModule.initQaDatabaseSchema(seedRaw);
      await dbModule.seedAsyncInitialDataIfNeeded(seedAdapter, true);
      const seededPins = seedRaw.prepare("SELECT pin_code FROM players").all() as {
        pin_code: string;
      }[];
      for (const row of seededPins) {
        expect(row.pin_code.startsWith("scrypt$")).toBe(true);
        expect(verifyPassword("1234", row.pin_code)).toBe(false);
      }
      seedRaw.close();
    } finally {
      raw.close();
    }
  }, 15000);

  it("rolls back add_walkin_player, upsert_match, and delete_match atomically on mid-transaction failure and maps commit timeout to 503", async () => {
    const { raw, db } = createTestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppData(raw);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, access_role, username, pin_code, status)
         VALUES (1, 'Manager', 'Mgr', 'manager', 'mgra', ?, 'Đang sinh hoạt')`
      ).run(hashPassword("MgrStrong@2026"));

      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrToken = createSessionToken(mgr, 24);

      // Simulate failure on attendance insert inside add_walkin_player transaction -> orphan player rolled back
      raw.exec(
        `CREATE TRIGGER trg_fail_walkin_att BEFORE INSERT ON match_attendances
         BEGIN SELECT RAISE(ABORT, 'Simulated attendance failure'); END;`
      );
      raw.prepare(
        `INSERT INTO matches (id, match_number, label, match_date, fee_per_player, pitch_cost)
         VALUES (1, 1, 'Trận 1', '2026-06-01', 100000, 600000)`
      ).run();

      const walkinFailRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: JSON.stringify({
            action: "add_walkin_player",
            payload: { match_id: 1, new_player_name: "Orphan Test", amount: 100000, paid: 1 },
          }),
        })
      );
      expect(walkinFailRes.status).toBe(500);
      expect(
        raw.prepare("SELECT COUNT(*) AS c FROM players WHERE full_name = 'Orphan Test'").get()
      ).toEqual({ c: 0 });
      raw.exec("DROP TRIGGER trg_fail_walkin_att;");

      // Simulate failure on linked expense insert inside upsert_match -> match & attendances rolled back
      raw.exec(
        `CREATE TRIGGER trg_fail_match_exp BEFORE INSERT ON expenses
         BEGIN SELECT RAISE(ABORT, 'Simulated expense failure'); END;`
      );
      const matchFailRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: JSON.stringify({
            action: "upsert_match",
            payload: {
              match_number: 2,
              label: "Trận Atomic",
              match_date: "2026-06-02",
              fee_per_player: 100000,
              pitch_cost: 700000,
              sync_pitch_expense: true,
            },
          }),
        })
      );
      expect(matchFailRes.status).toBe(500);
      expect(
        raw.prepare("SELECT COUNT(*) AS c FROM matches WHERE label = 'Trận Atomic'").get()
      ).toEqual({ c: 0 });
      raw.exec("DROP TRIGGER trg_fail_match_exp;");

      // Commit timeout maps cleanly to 503 DB_WRITE_OUTCOME_UNKNOWN
      vi.spyOn(db, "transaction").mockRejectedValueOnce(
        new TursoWriteOutcomeUnknownError({
          operationType: "transaction.commit",
          timeoutMs: 5000,
        })
      );
      const timeoutRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: JSON.stringify({
            action: "delete_match",
            payload: { id: 1 },
          }),
        })
      );
      expect(timeoutRes.status).toBe(503);
      const timeoutJson = await timeoutRes.json();
      expect(timeoutJson.code).toBe("DB_WRITE_OUTCOME_UNKNOWN");
      expect(timeoutJson.retryable).toBe(false);
    } finally {
      raw.close();
    }
  });

  it("enforces 4MB serverless upload cap (413) on POST /api/import and POST /api/webp including Content-Length and missing Content-Length", async () => {
    const { raw, db } = createTestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, access_role, username, pin_code, status)
         VALUES (1, 'Manager', 'Mgr', 'manager', 'mgra', ?, 'Đang sinh hoạt')`
      ).run(hashPassword("MgrStrong@2026"));

      const mgr = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgrToken = createSessionToken(mgr, 24);
      const FOUR_MB = 4 * 1024 * 1024;

      // 1. /api/webp: Content-Length > 4MB -> 413
      const clOverWebp = await postWebpRoute(
        new NextRequest("http://localhost:3000/api/webp", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            "content-type": "multipart/form-data; boundary=----test",
            "content-length": String(FOUR_MB + 1),
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: "------test--",
        })
      );
      expect(clOverWebp.status).toBe(413);

      // 2. /api/webp: missing Content-Length with actual file > 4MB -> 413
      const fdWebpOver = new FormData();
      fdWebpOver.append(
        "file",
        new File([new Uint8Array(FOUR_MB + 1)], "over.png", { type: "image/png" })
      );
      const bodyOverWebp = await postWebpRoute(
        new NextRequest("http://localhost:3000/api/webp", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: fdWebpOver,
        })
      );
      expect(bodyOverWebp.status).toBe(413);

      // 3. /api/import: file > 4MB (4MB + 1) -> 413
      const fdImportOver = new FormData();
      fdImportOver.append(
        "file",
        new File([new Uint8Array(FOUR_MB + 1)], "over.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      const bodyOverImport = await postImportRoute(
        new NextRequest("http://localhost:3000/api/import", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: fdImportOver,
        })
      );
      expect(bodyOverImport.status).toBe(413);

      // 4. Invalid Content-Length header falls through to actual file size check; exact 4MB passes size gate
      const fdWebpExact = new FormData();
      fdWebpExact.append(
        "file",
        new File([new Uint8Array(FOUR_MB)], "exact.png", { type: "image/png" })
      );
      const exactWebpRes = await postWebpRoute(
        new NextRequest("http://localhost:3000/api/webp", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            "content-length": "not-a-number",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: fdWebpExact,
        })
      );
      expect(exactWebpRes.status).not.toBe(413);

      const fdImportExact = new FormData();
      fdImportExact.append(
        "file",
        new File([new Uint8Array(FOUR_MB)], "exact.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      const exactImportRes = await postImportRoute(
        new NextRequest("http://localhost:3000/api/import", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: fdImportExact,
        })
      );
      expect(exactImportRes.status).not.toBe(413);

      // 5. Invalid MIME type, empty file, and malformed multipart body -> 400
      const fdBadMime = new FormData();
      fdBadMime.append(
        "file",
        new File(["hello"], "bad.txt", { type: "text/plain" })
      );
      const badMimeRes = await postWebpRoute(
        new NextRequest("http://localhost:3000/api/webp", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: fdBadMime,
        })
      );
      expect(badMimeRes.status).toBe(400);

      const fdEmpty = new FormData();
      fdEmpty.append("file", new File([], "empty.png", { type: "image/png" }));
      const emptyFileRes = await postWebpRoute(
        new NextRequest("http://localhost:3000/api/webp", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: fdEmpty,
        })
      );
      expect(emptyFileRes.status).toBe(400);

      const badMultipartRes = await postImportRoute(
        new NextRequest("http://localhost:3000/api/import", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            "content-type": "multipart/form-data; boundary=broken",
            cookie: `${SESSION_COOKIE_NAME}=${mgrToken}`,
          },
          body: "corrupted-multipart-payload",
        })
      );
      expect(badMultipartRes.status).toBe(400);
    } finally {
      raw.close();
    }
  });

  it("enforces P2-08 audit-log transaction atomicity and DB-backed collect_match_fees_batch idempotency", async () => {
    const { raw, db } = createTestDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    spyFullAppData(raw);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, access_role, username, pin_code, status)
         VALUES
           (1, 'Manager One', 'Mgr1', 'manager', 'mgr1', ?, 'Đang sinh hoạt'),
           (2, 'Manager Two', 'Mgr2', 'manager', 'mgr2', ?, 'Đang sinh hoạt'),
           (3, 'Player Three', 'P3', 'player', 'p3', ?, 'Đang sinh hoạt')`
      ).run(
        hashPassword("Mgr1Strong@2026"),
        hashPassword("Mgr2Strong@2026"),
        hashPassword("Player3@2026")
      );
      raw.prepare(
        `INSERT INTO matches (id, match_number, label, match_date, fee_per_player, pitch_cost)
         VALUES (1, 1, 'Trận 1', '2026-06-10', 100000, 600000)`
      ).run();

      const mgr1 = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const mgr2 = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
      const token1 = createSessionToken(mgr1, 24);
      const token2 = createSessionToken(mgr2, 24);

      // 1. Audit failure inside transaction rolls back financial write (upsert_expense)
      await dbModule.ensureAuditLogsReady(db);
      raw.exec(
        `CREATE TRIGGER trg_fail_audit BEFORE INSERT ON audit_logs
         BEGIN SELECT RAISE(ABORT, 'Simulated audit write failure'); END;`
      );
      const auditFailRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: `${SESSION_COOKIE_NAME}=${token1}`,
          },
          body: JSON.stringify({
            action: "upsert_expense",
            payload: {
              expense_date: "2026-06-10",
              category: "Nước uống",
              description: "Rollback Expense",
              amount: 50000,
              payer: "Mgr1",
            },
          }),
        })
      );
      expect(auditFailRes.status).toBe(500);
      expect(
        raw.prepare("SELECT COUNT(*) AS c FROM expenses WHERE description = 'Rollback Expense'").get()
      ).toEqual({ c: 0 });
      raw.exec("DROP TRIGGER trg_fail_audit;");

      // 2. collect_match_fees_batch idempotency: first call commits, replay returns 200 without duplicate audit/write, mismatch returns 409
      const batchPayload = {
        match_id: 1,
        collected_by: "Mgr1",
        items: [
          {
            player_id: 3,
            attended: 1,
            paid: 1,
            amount: 100000,
            note: "Idempotent batch",
          },
        ],
      };

      const firstBatchRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            "idempotency-key": "batch-key-1",
            cookie: `${SESSION_COOKIE_NAME}=${token1}`,
          },
          body: JSON.stringify({
            action: "collect_match_fees_batch",
            payload: batchPayload,
          }),
        })
      );
      expect(firstBatchRes.status).toBe(200);
      expect(firstBatchRes.headers.get("x-idempotent-replay")).toBeNull();
      expect(
        raw.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'collect_match_fees_batch'").get()
      ).toEqual({ c: 1 });
      expect(
        raw.prepare("SELECT amount, paid FROM match_attendances WHERE match_id = 1 AND player_id = 3").get()
      ).toEqual({ amount: 100000, paid: 1 });

      // Replay identical payload with same key -> 200 with X-Idempotent-Replay: true, no duplicate audit log
      const replayBatchRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            "idempotency-key": "batch-key-1",
            cookie: `${SESSION_COOKIE_NAME}=${token1}`,
          },
          body: JSON.stringify({
            action: "collect_match_fees_batch",
            payload: batchPayload,
          }),
        })
      );
      expect(replayBatchRes.status).toBe(200);
      expect(replayBatchRes.headers.get("x-idempotent-replay")).toBe("true");
      expect(
        raw.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'collect_match_fees_batch'").get()
      ).toEqual({ c: 1 });

      // Reuse key with different payload -> 409 Conflict
      const conflictBatchRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            "idempotency-key": "batch-key-1",
            cookie: `${SESSION_COOKIE_NAME}=${token1}`,
          },
          body: JSON.stringify({
            action: "collect_match_fees_batch",
            payload: {
              ...batchPayload,
              items: [{ player_id: 3, attended: 1, paid: 1, amount: 150000 }],
            },
          }),
        })
      );
      expect(conflictBatchRes.status).toBe(409);
      expect(
        raw.prepare("SELECT amount FROM match_attendances WHERE match_id = 1 AND player_id = 3").get()
      ).toEqual({ amount: 100000 });

      // Same key used by another actor (mgr2) is isolated by actor_id
      const otherActorRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            "idempotency-key": "batch-key-1",
            cookie: `${SESSION_COOKIE_NAME}=${token2}`,
          },
          body: JSON.stringify({
            action: "collect_match_fees_batch",
            payload: {
              match_id: 1,
              collected_by: "Mgr2",
              items: [{ player_id: 3, attended: 1, paid: 1, amount: 120000 }],
            },
          }),
        })
      );
      expect(otherActorRes.status).toBe(200);
      expect(
        raw.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'collect_match_fees_batch'").get()
      ).toEqual({ c: 2 });

      // 3. Migration script phase7-idempotency-v1.mjs is idempotent on isolated synthetic SQLite
      const { runPhase7IdempotencyMigration, createLocalSqliteTransactionRunner } = await import(
        "../../scripts/migrations/phase7-idempotency-v1.mjs"
      );
      const { DatabaseSync } = await import("node:sqlite");
      const migDb = new DatabaseSync(":memory:");
      try {
        const exec = async (sql: string, params: unknown[] = []) => {
          migDb.prepare(sql).run(...(params as never[]));
        };
        const qry = async (sql: string, params: unknown[] = []) =>
          migDb.prepare(sql).all(...(params as never[]));
        const txRunner = createLocalSqliteTransactionRunner(migDb);
        const dryRes = await runPhase7IdempotencyMigration({ execute: exec, query: qry, dryRun: true });
        expect(dryRes.actions).toContain("CREATE TABLE idempotency_keys");
        const applyRes = await runPhase7IdempotencyMigration({
          execute: exec,
          query: qry,
          withTransaction: txRunner as never,
          dryRun: false,
        });
        expect(applyRes.actions).toContain("CREATE TABLE idempotency_keys");
        const rerunRes = await runPhase7IdempotencyMigration({
          execute: exec,
          query: qry,
          withTransaction: txRunner as never,
          dryRun: false,
        });
        expect(rerunRes.actions).not.toContain("CREATE TABLE idempotency_keys");
      } finally {
        migDb.close();
      }
    } finally {
      raw.close();
    }
  });
});
