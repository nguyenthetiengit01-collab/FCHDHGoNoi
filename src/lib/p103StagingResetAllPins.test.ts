import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  BULK_RESET_ACTION,
  EXACT_STAGING_HOSTNAME,
  runStagingBulkPinReset,
  validateExactStagingBulkTarget,
} from "../../scripts/p103-staging-reset-all-pins.mjs";
import {
  EXACT_STAGING_DB_NAME,
  RECOVERY_ACTOR_ID,
  RECOVERY_ACTOR_NAME,
  RECOVERY_ACTOR_ROLE,
} from "../../scripts/p103-staging-manager-recovery.mjs";

function createTestLibsqlClient(sqliteDb: DatabaseSync) {
  const execSql = (sql: string, args: unknown[] = []) => {
    const trimmed = sql.trim();
    const stmt = sqliteDb.prepare(trimmed);
    const upper = trimmed.toUpperCase();
    if (upper.startsWith("SELECT") || upper.startsWith("PRAGMA")) {
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

function createSeededBulkDb() {
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

  const insert = db.prepare(
    `INSERT INTO players (code_order, full_name, short_name, username, access_role, pin_code, must_change_pin, status)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  );
  insert.run(1, "QA_MANAGER_363B", "QA_MANAGER_363B", "QA_MANAGER_363B", "manager", "scrypt$s1$h1", "Đang sinh hoạt");
  insert.run(2, "QA_PLAYER_363B", "QA_PLAYER_363B", "QA_PLAYER_363B", "player", "scrypt$s2$h2", "Đang sinh hoạt");
  insert.run(3, "Inactive Member", "Inactive", "inactive_member", "player", "scrypt$s3$h3", "inactive");
  insert.run(4, "No Credential Row", "NoCred", "nocred", "player", "", "Đang sinh hoạt");

  return db;
}

const VALID_STAGING_TARGET = {
  dbName: EXACT_STAGING_DB_NAME,
  hostname: EXACT_STAGING_HOSTNAME,
  safeHost: `libsql://${EXACT_STAGING_HOSTNAME}`,
};

describe("P1-03C Bulk Staging PIN Reset CLI", () => {
  it("requires exact Staging hostname and blocks Production, Restore, wrong hostname, and SQLite fallback", () => {
    const ok = validateExactStagingBulkTarget({
      url: `libsql://${EXACT_STAGING_HOSTNAME}`,
      token: "staging-rw-token",
    });
    expect(ok.hostname).toBe(EXACT_STAGING_HOSTNAME);

    expect(() =>
      validateExactStagingBulkTarget({
        url: "libsql://fchdhgonoi-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io",
        token: "tok",
      })
    ).toThrow(/Production/i);

    expect(() =>
      validateExactStagingBulkTarget({
        url: "libsql://fchdhgonoi-staging-restore-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io",
        token: "tok",
      })
    ).toThrow(/restore/i);

    expect(() =>
      validateExactStagingBulkTarget({
        url: `libsql://${EXACT_STAGING_DB_NAME}.aws-us-east-1.turso.io`,
        token: "tok",
      })
    ).toThrow(/exact approved Staging hostname/i);

    expect(() =>
      validateExactStagingBulkTarget({
        url: "file:./data/gonoifc.sqlite",
        token: "tok",
      })
    ).toThrow(/Unsupported Turso URL protocol/i);

    expect(() =>
      validateExactStagingBulkTarget({
        url: "",
        token: "tok",
      })
    ).toThrow(/missing TURSO_STAGING_DATABASE_URL/i);
  });

  it("dry-run performs zero writes, reports accurate counts, and never leaks credentials", async () => {
    const db = createSeededBulkDb();
    let handoffCalled = false;

    const res = await runStagingBulkPinReset({
      client: createTestLibsqlClient(db),
      targetInfo: VALID_STAGING_TARGET,
      apply: false,
      onCredentialsHandoff: () => {
        handoffCalled = true;
      },
    });

    expect(res.mode).toBe("dry-run");
    expect(res.applied).toBe(false);
    expect(handoffCalled).toBe(false);
    expect(res.counts).toEqual({
      total: 4,
      eligible: 3,
      active: 2,
      inactive: 1,
      excluded: 1,
    });

    const rows = db
      .prepare("SELECT id, pin_code, must_change_pin, status FROM players ORDER BY id ASC")
      .all() as Array<{ id: number; pin_code: string; must_change_pin: number; status: string }>;
    expect(rows[0].pin_code).toBe("scrypt$s1$h1");
    expect(rows[1].pin_code).toBe("scrypt$s2$h2");
    expect(rows[2].pin_code).toBe("scrypt$s3$h3");
    expect(rows.every((r) => r.must_change_pin === 0)).toBe(true);
    expect((db.prepare("SELECT COUNT(*) AS c FROM audit_logs").get() as { c: number }).c).toBe(0);
  });

  it("apply resets all eligible accounts atomically, preserves inactive state, verifies must_change_pin=1 and scrypt hashes, and writes per-account audit without plaintext/hash", async () => {
    const db = createSeededBulkDb();
    let handedOff: Array<{
      identifier: string;
      accessRole: string;
      status: string;
      temporaryPassword: string;
    }> = [];

    const res = await runStagingBulkPinReset({
      client: createTestLibsqlClient(db),
      targetInfo: VALID_STAGING_TARGET,
      apply: true,
      approvalRef: "STG-BULK-001",
      env: {},
      io: { stdinIsTTY: true, stdoutIsTTY: true },
      onCredentialsHandoff: (entries) => {
        handedOff = entries;
      },
    });

    expect(res.mode).toBe("apply");
    expect(res.applied).toBe(true);
    expect(res.updatedCount).toBe(3);
    expect(res.mustChangePinVerifiedCount).toBe(3);
    expect(handedOff).toHaveLength(3);

    const uniquePasswords = new Set(handedOff.map((e) => e.temporaryPassword));
    expect(uniquePasswords.size).toBe(3);

    expect(handedOff[0].temporaryPassword).toMatch(/^qamanager363b@\d{12}$/);
    expect(handedOff[1].temporaryPassword).toMatch(/^qaplayer363b@\d{12}$/);
    expect(handedOff[2].temporaryPassword).toMatch(/^inactivemember@\d{12}$/);
    expect(handedOff[2].status).toBe("inactive");

    const rows = db
      .prepare("SELECT id, username, pin_code, must_change_pin, status FROM players ORDER BY id ASC")
      .all() as Array<{
        id: number;
        username: string;
        pin_code: string;
        must_change_pin: number;
        status: string;
      }>;

    // 3 eligible accounts updated with valid scrypt$ hashes and must_change_pin=1
    for (let i = 0; i < 3; i++) {
      expect(rows[i].must_change_pin).toBe(1);
      expect(rows[i].pin_code.startsWith("scrypt$")).toBe(true);
      const [, salt, hex] = rows[i].pin_code.split("$");
      const derived = crypto
        .scryptSync(handedOff[i].temporaryPassword, salt, 64)
        .toString("hex");
      expect(derived).toBe(hex);
      expect(JSON.stringify(res)).not.toContain(handedOff[i].temporaryPassword);
    }

    // Inactive status preserved
    expect(rows[2].status).toBe("inactive");
    // Excluded account untouched
    expect(rows[3].pin_code).toBe("");
    expect(rows[3].must_change_pin).toBe(0);

    const auditRows = db.prepare("SELECT * FROM audit_logs ORDER BY id ASC").all() as Array<{
      actor_id: number;
      actor_name: string;
      actor_role: string;
      action: string;
      summary: string;
    }>;
    expect(auditRows).toHaveLength(3);
    for (const audit of auditRows) {
      expect(audit.actor_id).toBe(RECOVERY_ACTOR_ID);
      expect(audit.actor_name).toBe(RECOVERY_ACTOR_NAME);
      expect(audit.actor_role).toBe(RECOVERY_ACTOR_ROLE);
      expect(audit.action).toBe(BULK_RESET_ACTION);
      expect(audit.summary).toContain("approval=STG-BULK-001");
      expect(audit.summary).not.toContain("scrypt$");
      for (const entry of handedOff) {
        expect(audit.summary).not.toContain(entry.temporaryPassword);
      }
    }

    // Approval replay blocked
    await expect(
      runStagingBulkPinReset({
        client: createTestLibsqlClient(db),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "STG-BULK-001",
        env: {},
        io: { stdinIsTTY: true, stdoutIsTTY: true },
        onCredentialsHandoff: () => {},
      })
    ).rejects.toThrow(/already used/i);
  });

  it("rolls back entire batch when audit insertion fails or mid-batch update fails", async () => {
    const db = createSeededBulkDb();
    db.exec(`
      CREATE TRIGGER trg_fail_audit_second_row BEFORE INSERT ON audit_logs
      WHEN (SELECT COUNT(*) FROM audit_logs) >= 1
      BEGIN
        SELECT RAISE(ABORT, 'simulated audit insert failure mid-batch');
      END;
    `);

    await expect(
      runStagingBulkPinReset({
        client: createTestLibsqlClient(db),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "STG-BULK-ROLLBACK",
        env: {},
        io: { stdinIsTTY: true, stdoutIsTTY: true },
        onCredentialsHandoff: () => {},
      })
    ).rejects.toThrow(/rolled back/i);

    const rows = db
      .prepare("SELECT id, pin_code, must_change_pin FROM players ORDER BY id ASC")
      .all() as Array<{ id: number; pin_code: string; must_change_pin: number }>;
    expect(rows[0].pin_code).toBe("scrypt$s1$h1");
    expect(rows[1].pin_code).toBe("scrypt$s2$h2");
    expect(rows[2].pin_code).toBe("scrypt$s3$h3");
    expect(rows.every((r) => r.must_change_pin === 0)).toBe(true);
    expect((db.prepare("SELECT COUNT(*) AS c FROM audit_logs").get() as { c: number }).c).toBe(0);
  });

  it("rejects non-interactive or CI apply", async () => {
    const db = createSeededBulkDb();
    await expect(
      runStagingBulkPinReset({
        client: createTestLibsqlClient(db),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "STG-BULK-TTY",
        env: {},
        io: { stdinIsTTY: false, stdoutIsTTY: true },
      })
    ).rejects.toThrow(/interactive local terminal/i);

    await expect(
      runStagingBulkPinReset({
        client: createTestLibsqlClient(db),
        targetInfo: VALID_STAGING_TARGET,
        apply: true,
        approvalRef: "STG-BULK-CI",
        env: { CI: "true" },
        io: { stdinIsTTY: true, stdoutIsTTY: true },
      })
    ).rejects.toThrow(/forbidden in CI/i);
  });
});
