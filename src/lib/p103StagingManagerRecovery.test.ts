import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  ALLOWED_RECOVERY_TARGET,
  EXACT_STAGING_DB_NAME,
  RECOVERY_ACTION,
  RECOVERY_ACTOR_ID,
  RECOVERY_ACTOR_NAME,
  RECOVERY_ACTOR_ROLE,
  runStagingManagerRecovery,
  validateExactStagingRecoveryTarget,
} from "../../scripts/p103-staging-manager-recovery.mjs";

function createTestLibsqlClient(sqliteDb: DatabaseSync) {
  const execSql = (sql: string, args: unknown[] = []) => {
    const trimmed = sql.trim();
    const stmt = sqliteDb.prepare(trimmed);
    const upper = trimmed.toUpperCase();
    if (
      upper.startsWith("SELECT") ||
      upper.startsWith("PRAGMA")
    ) {
      const rows = stmt.all(...(args as never[]));
      return { rows, rowsAffected: 0 };
    }
    const info = stmt.run(...(args as never[]));
    return { rows: [], rowsAffected: Number(info.changes ?? 0) };
  };

  return {
    async execute(input: string | { sql: string; args?: unknown[] }) {
      if (typeof input === "string") {
        return execSql(input, []);
      }
      return execSql(input.sql, input.args || []);
    },
    async transaction() {
      sqliteDb.exec("BEGIN IMMEDIATE");
      let settled = false;
      return {
        async execute(input: string | { sql: string; args?: unknown[] }) {
          if (typeof input === "string") {
            return execSql(input, []);
          }
          return execSql(input.sql, input.args || []);
        },
        async commit() {
          if (!settled) {
            settled = true;
            sqliteDb.exec("COMMIT");
          }
        },
        async rollback() {
          if (!settled) {
            settled = true;
            sqliteDb.exec("ROLLBACK");
          }
        },
      };
    },
  };
}

function createSeededMemoryDb(options?: { omitManager?: boolean; inactiveManager?: boolean; duplicateManager?: boolean }) {
  const db = new DatabaseSync(":memory:");
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
      role TEXT NOT NULL DEFAULT 'Thành viên',
      access_role TEXT NOT NULL DEFAULT 'player',
      username TEXT NOT NULL DEFAULT '',
      pin_code TEXT NOT NULL DEFAULT '',
      must_change_pin INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  if (!options?.omitManager) {
    db.prepare(
      `INSERT INTO players (code_order, full_name, short_name, username, access_role, pin_code, must_change_pin, status)
       VALUES (?, ?, ?, ?, 'manager', ?, 0, ?)`
    ).run(
      1,
      "QA_MANAGER_363B",
      "QA_MANAGER_363B",
      "QA_MANAGER_363B",
      "scrypt$deadbeef$initialhash",
      options?.inactiveManager ? "inactive" : "Đang sinh hoạt"
    );
  }

  if (options?.duplicateManager) {
    db.prepare(
      `INSERT INTO players (code_order, full_name, short_name, username, access_role, pin_code, must_change_pin, status)
       VALUES (?, ?, ?, ?, 'manager', ?, 0, 'Đang sinh hoạt')`
    ).run(
      2,
      "QA_MANAGER_363B",
      "QA_MANAGER_363B",
      "QA_MANAGER_363B",
      "scrypt$deadbeef$secondhash"
    );
  }

  db.prepare(
    `INSERT INTO players (code_order, full_name, short_name, username, access_role, pin_code, must_change_pin, status)
     VALUES (?, ?, ?, ?, 'player', ?, 0, 'Đang sinh hoạt')`
  ).run(3, "QA_PLAYER_363B", "QA_PLAYER_363B", "QA_PLAYER_363B", "scrypt$deadbeef$playerhash");

  return db;
}

const VALID_STAGING_TARGET = {
  dbName: EXACT_STAGING_DB_NAME,
  safeHost: `libsql://${EXACT_STAGING_DB_NAME}.aws-ap-northeast-1.turso.io`,
};

describe("P1-03C.4.6 — Controlled Staging Manager Recovery CLI", () => {
  it("accepts exact Staging target and rejects Production, Restore, unknown DBs, and missing credentials", () => {
    const ok = validateExactStagingRecoveryTarget({
      url: `libsql://${EXACT_STAGING_DB_NAME}.aws-ap-northeast-1.turso.io`,
      token: "staging-ro-or-rw-token",
    });
    expect(ok.dbName).toBe(EXACT_STAGING_DB_NAME);

    expect(() =>
      validateExactStagingRecoveryTarget({
        url: "libsql://fchdhgonoi-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io",
        token: "tok",
      })
    ).toThrow(/Production/i);

    expect(() =>
      validateExactStagingRecoveryTarget({
        url: "libsql://fchdhgonoi-staging-restore-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io",
        token: "tok",
      })
    ).toThrow(/restore/i);

    expect(() =>
      validateExactStagingRecoveryTarget({
        url: "libsql://fchdhgonoi-staging-other.aws-ap-northeast-1.turso.io",
        token: "tok",
      })
    ).toThrow(/not the exact Staging database/i);

    expect(() =>
      validateExactStagingRecoveryTarget({
        url: "file:./data/gonoifc.sqlite",
        token: "tok",
      })
    ).toThrow(/Unsupported Turso URL protocol/i);

    expect(() =>
      validateExactStagingRecoveryTarget({
        url: "",
        token: "tok",
      })
    ).toThrow(/missing TURSO_STAGING_DATABASE_URL/i);
  });

  it("rejects missing, inactive, or ambiguous Manager targets", async () => {
    const missingDb = createSeededMemoryDb({ omitManager: true });
    await expect(
      runStagingManagerRecovery({
        client: createTestLibsqlClient(missingDb),
        targetInfo: VALID_STAGING_TARGET,
        apply: false,
      })
    ).rejects.toThrow(/Target not found/i);

    const inactiveDb = createSeededMemoryDb({ inactiveManager: true });
    await expect(
      runStagingManagerRecovery({
        client: createTestLibsqlClient(inactiveDb),
        targetInfo: VALID_STAGING_TARGET,
        apply: false,
      })
    ).rejects.toThrow(/Inactive target/i);

    const dupDb = createSeededMemoryDb({ duplicateManager: true });
    await expect(
      runStagingManagerRecovery({
        client: createTestLibsqlClient(dupDb),
        targetInfo: VALID_STAGING_TARGET,
        apply: false,
      })
    ).rejects.toThrow(/Ambiguous target/i);
  });

  it("dry-run performs zero writes and leaves pin_code, must_change_pin, and audit_logs untouched", async () => {
    const db = createSeededMemoryDb();
    const res = await runStagingManagerRecovery({
      client: createTestLibsqlClient(db),
      targetInfo: VALID_STAGING_TARGET,
      apply: false,
    });

    expect(res.mode).toBe("dry-run");
    expect(res.applied).toBe(false);
    expect(res.matchedCount).toBe(1);

    const row = db
      .prepare("SELECT pin_code, must_change_pin FROM players WHERE username = ?")
      .get(ALLOWED_RECOVERY_TARGET) as { pin_code: string; must_change_pin: number };
    expect(row.pin_code).toBe("scrypt$deadbeef$initialhash");
    expect(row.must_change_pin).toBe(0);

    const auditCount = db.prepare("SELECT COUNT(*) AS c FROM audit_logs").get() as { c: number };
    expect(auditCount.c).toBe(0);
  });

  it("rejects non-interactive or CI apply", async () => {
    const db = createSeededMemoryDb();
    await expect(
      runStagingManagerRecovery({
        client: createTestLibsqlClient(db),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "INC-001",
        env: {},
        io: { stdinIsTTY: false, stdoutIsTTY: true },
      })
    ).rejects.toThrow(/interactive local terminal/i);

    await expect(
      runStagingManagerRecovery({
        client: createTestLibsqlClient(db),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "INC-001",
        env: { CI: "true" },
        io: { stdinIsTTY: true, stdoutIsTTY: true },
      })
    ).rejects.toThrow(/forbidden in CI/i);
  });

  it("apply updates exactly one Manager with valid scrypt hash, sets must_change_pin=1, inserts audit, never leaks PIN, and requires fresh approval for repeat", async () => {
    const db = createSeededMemoryDb();
    let handedOffPin = "";

    const res = await runStagingManagerRecovery({
      client: createTestLibsqlClient(db),
      targetInfo: VALID_STAGING_TARGET,
      apply: true,
      approvalRef: "STG-REC-001",
      env: {},
      io: { stdinIsTTY: true, stdoutIsTTY: true },
      onTemporaryPinHandoff: (pin) => {
        handedOffPin = pin;
      },
    });

    expect(res.mode).toBe("apply");
    expect(res.applied).toBe(true);
    expect(res.mustChangePinVerified).toBe(true);
    expect(handedOffPin.length).toBe(12);
    expect(JSON.stringify(res)).not.toContain(handedOffPin);

    const mgrRow = db
      .prepare("SELECT pin_code, must_change_pin FROM players WHERE username = ?")
      .get(ALLOWED_RECOVERY_TARGET) as { pin_code: string; must_change_pin: number };
    expect(mgrRow.must_change_pin).toBe(1);
    expect(mgrRow.pin_code.startsWith("scrypt$")).toBe(true);
    expect(mgrRow.pin_code).not.toContain(handedOffPin);

    const [, salt, hex] = mgrRow.pin_code.split("$");
    const derived = crypto.scryptSync(handedOffPin, salt, 64).toString("hex");
    expect(derived).toBe(hex);

    const plrRow = db
      .prepare("SELECT pin_code, must_change_pin FROM players WHERE username = ?")
      .get("QA_PLAYER_363B") as { pin_code: string; must_change_pin: number };
    expect(plrRow.pin_code).toBe("scrypt$deadbeef$playerhash");
    expect(plrRow.must_change_pin).toBe(0);

    const auditRows = db.prepare("SELECT * FROM audit_logs").all() as Array<{
      actor_id: number;
      actor_name: string;
      actor_role: string;
      action: string;
      summary: string;
    }>;
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].actor_id).toBe(RECOVERY_ACTOR_ID);
    expect(auditRows[0].actor_name).toBe(RECOVERY_ACTOR_NAME);
    expect(auditRows[0].actor_role).toBe(RECOVERY_ACTOR_ROLE);
    expect(auditRows[0].action).toBe(RECOVERY_ACTION);
    expect(auditRows[0].summary).not.toContain(handedOffPin);
    expect(auditRows[0].summary).not.toContain("scrypt$");

    // Reusing the same approval-ref is blocked
    await expect(
      runStagingManagerRecovery({
        client: createTestLibsqlClient(db),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "STG-REC-001",
        env: {},
        io: { stdinIsTTY: true, stdoutIsTTY: true },
        onTemporaryPinHandoff: () => {},
      })
    ).rejects.toThrow(/already used/i);

    // A fresh approval-ref succeeds
    let secondPin = "";
    const res2 = await runStagingManagerRecovery({
      client: createTestLibsqlClient(db),
      targetInfo: VALID_STAGING_TARGET,
      apply: true,
      approvalRef: "STG-REC-002",
      env: {},
      io: { stdinIsTTY: true, stdoutIsTTY: true },
      onTemporaryPinHandoff: (pin) => {
        secondPin = pin;
      },
    });
    expect(res2.applied).toBe(true);
    expect(secondPin).not.toBe(handedOffPin);
  });

  it("rolls back PIN update completely when audit insertion fails", async () => {
    const db = createSeededMemoryDb();
    db.exec(`
      CREATE TRIGGER trg_fail_audit BEFORE INSERT ON audit_logs
      BEGIN
        SELECT RAISE(ABORT, 'simulated audit insert failure');
      END;
    `);

    await expect(
      runStagingManagerRecovery({
        client: createTestLibsqlClient(db),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "STG-REC-ROLLBACK",
        env: {},
        io: { stdinIsTTY: true, stdoutIsTTY: true },
        onTemporaryPinHandoff: () => {},
      })
    ).rejects.toThrow(/rolled back/i);

    const mgrRow = db
      .prepare("SELECT pin_code, must_change_pin FROM players WHERE username = ?")
      .get(ALLOWED_RECOVERY_TARGET) as { pin_code: string; must_change_pin: number };
    expect(mgrRow.pin_code).toBe("scrypt$deadbeef$initialhash");
    expect(mgrRow.must_change_pin).toBe(0);
  });

  it("fails closed on incompatible audit_logs schema and arbitrary approval references", async () => {
    const badColDb = createSeededMemoryDb();
    badColDb.exec("DROP TABLE audit_logs; CREATE TABLE audit_logs (id INTEGER PRIMARY KEY, actor_id INTEGER NOT NULL);");
    await expect(
      runStagingManagerRecovery({
        client: createTestLibsqlClient(badColDb),
        targetInfo: VALID_STAGING_TARGET,
        apply: false,
      })
    ).rejects.toThrow(/missing required column/i);

    const fkDb = createSeededMemoryDb();
    fkDb.exec(`
      DROP TABLE audit_logs;
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER NOT NULL REFERENCES players(id),
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    await expect(
      runStagingManagerRecovery({
        client: createTestLibsqlClient(fkDb),
        targetInfo: VALID_STAGING_TARGET,
        apply: false,
      })
    ).rejects.toThrow(/foreign key constraint incompatible/i);

    const casualDb = createSeededMemoryDb();
    await expect(
      runStagingManagerRecovery({
        client: createTestLibsqlClient(casualDb),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "casual-string",
        env: {},
        io: { stdinIsTTY: true, stdoutIsTTY: true },
        onTemporaryPinHandoff: () => {},
      })
    ).rejects.toThrow(/structured Owner-approved --approval-ref/i);
  });

  it("enforces approval-ref uniqueness durably across separate DB connections/processes without prefix collision", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "p103-rec-"));
    const dbPath = path.join(tmpDir, "staging-sim.sqlite");
    try {
      const db1 = new DatabaseSync(dbPath);
      db1.exec(`
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
          role TEXT NOT NULL DEFAULT 'Thành viên',
          access_role TEXT NOT NULL DEFAULT 'player',
          username TEXT NOT NULL DEFAULT '',
          pin_code TEXT NOT NULL DEFAULT '',
          must_change_pin INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
          notes TEXT NOT NULL DEFAULT ''
        );
      `);
      db1
        .prepare(
          `INSERT INTO players (code_order, full_name, short_name, username, access_role, pin_code, must_change_pin, status)
           VALUES (1, 'QA_MANAGER_363B', 'QA_MANAGER_363B', 'QA_MANAGER_363B', 'manager', 'scrypt$salt$hash', 0, 'Đang sinh hoạt')`
        )
        .run();

      await runStagingManagerRecovery({
        client: createTestLibsqlClient(db1),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "OWNER-REC-10",
        env: {},
        io: { stdinIsTTY: true, stdoutIsTTY: true },
        onTemporaryPinHandoff: () => {},
      });
      db1.close();

      // Separate process/connection: reusing OWNER-REC-10 fails, but OWNER-REC-1 (prefix) is NOT falsely blocked
      const db2 = new DatabaseSync(dbPath);
      await expect(
        runStagingManagerRecovery({
          client: createTestLibsqlClient(db2),
          targetInfo: VALID_STAGING_TARGET,
          apply: true,
          approvalRef: "OWNER-REC-10",
          env: {},
          io: { stdinIsTTY: true, stdoutIsTTY: true },
          onTemporaryPinHandoff: () => {},
        })
      ).rejects.toThrow(/already used/i);

      const resPrefix = await runStagingManagerRecovery({
        client: createTestLibsqlClient(db2),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "OWNER-REC-1",
        env: {},
        io: { stdinIsTTY: true, stdoutIsTTY: true },
        onTemporaryPinHandoff: () => {},
      });
      expect(resPrefix.applied).toBe(true);
      db2.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
