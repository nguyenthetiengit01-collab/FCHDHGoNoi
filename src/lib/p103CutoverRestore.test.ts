import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";
import { generateBackupKeypair, encryptBufferWithPublicKey } from "../../scripts/backup-crypto.mjs";
import {
  APPROVED_CUTOVER_TARGET_HOST,
  assertEmptyTargetDatabase,
  loadAndValidateCutoverBackup,
  parseCutoverCliArgs,
  runCutoverRestore,
  validateCutoverTarget,
  verifyCutoverTargetDatabase,
} from "../../scripts/p103-cutover-restore.mjs";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gonoi-p103-cutover-"));

function createSqliteLibsqlAdapter(db: DatabaseSync) {
  const executedSql: string[] = [];
  return {
    executedSql,
    async execute(stmt: string | { sql: string; args?: unknown[] }) {
      const sql = typeof stmt === "string" ? stmt : stmt.sql;
      const args = typeof stmt === "string" ? [] : stmt.args || [];
      executedSql.push(sql);

      const trimmed = sql.trim().toUpperCase();
      if (
        trimmed.startsWith("SELECT") ||
        trimmed.startsWith("PRAGMA TABLE_INFO") ||
        trimmed.startsWith("PRAGMA INTEGRITY_CHECK") ||
        trimmed.startsWith("PRAGMA FOREIGN_KEY_CHECK")
      ) {
        const rows = db.prepare(sql).all(...(args as never[]));
        return { rows };
      }

      if (args.length > 0) {
        db.prepare(sql).run(...(args as never[]));
      } else {
        db.exec(sql);
      }
      return { rows: [] };
    },
    close() {
      db.close();
    },
  };
}

function buildValidP103BackupV3() {
  const srcPath = path.join(tmpDir, `src-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  const backupPath = path.join(tmpDir, `backup-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  const db = new DatabaseSync(srcPath);
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL,
        summary TEXT
      );
      CREATE TABLE players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        pin_code TEXT NOT NULL,
        must_change_pin INTEGER NOT NULL DEFAULT 0,
        avatar BLOB
      );
      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL REFERENCES players(id),
        amount INTEGER NOT NULL
      );
      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event TEXT NOT NULL
      );

      CREATE INDEX idx_payments_player_id ON payments(player_id);
      CREATE VIEW v_player_totals AS
        SELECT p.id, p.name, COALESCE(SUM(v.amount), 0) AS total
        FROM players p
        LEFT JOIN v_valid_payments v ON v.player_id = p.id
        GROUP BY p.id;
      CREATE VIEW v_valid_payments AS
        SELECT id, player_id, amount FROM payments WHERE amount > 0;
      CREATE TRIGGER trg_payments_insert
      AFTER INSERT ON payments
      BEGIN
        INSERT INTO audit_log(event) VALUES ('payment:' || NEW.id);
      END;
    `);

    db.prepare("INSERT INTO schema_migrations (version, applied_at, summary) VALUES (?, ?, ?)").run(
      "phase7-p103-pin-default-v1",
      "2026-04-01T00:00:00.000Z",
      "Remove default 1234"
    );
    db.prepare("INSERT INTO schema_migrations (version, applied_at, summary) VALUES (?, ?, ?)").run(
      "phase7-p103-must-change-pin-v1",
      "2026-04-01T00:01:00.000Z",
      "Add must_change_pin"
    );
    db.prepare("INSERT INTO players (id, name, pin_code, must_change_pin, avatar) VALUES (?, ?, ?, ?, ?)").run(
      1,
      "Nguyen Van A",
      "$2b$10$hashedsecretpin",
      0,
      new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    );
    db.prepare("INSERT INTO payments (id, player_id, amount) VALUES (?, ?, ?)").run(10, 1, 50000);
  } finally {
    db.close();
  }

  const res = spawnSync(
    process.execPath,
    ["scripts/db-backup.mjs", "--sqlite", srcPath, "--out", backupPath],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  if (res.status !== 0) {
    throw new Error(`Failed to generate v3 backup fixture: ${res.stderr}`);
  }
  return JSON.parse(fs.readFileSync(backupPath, "utf8"));
}

describe("P103 Production Cutover Restore Tooling", () => {
  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore Windows file lock cleanup warnings
      }
    }
  });

  describe("1. Target Preflight & Allowlist Validation", () => {
    const validToken = "cutover-full-access-token-secret";

    it("rejects missing TURSO_CUTOVER_TARGET_DATABASE_URL or TURSO_CUTOVER_TARGET_AUTH_TOKEN", () => {
      expect(() => validateCutoverTarget({ env: {} })).toThrow(/missing TURSO_CUTOVER_TARGET_DATABASE_URL/i);
      expect(() =>
        validateCutoverTarget({
          url: "libsql://fchdhgonoi-prod-cutover-nguyenthetiengit01.turso.io",
          token: "",
        })
      ).toThrow(/missing TURSO_CUTOVER_TARGET_DATABASE_URL/i);
    });

    it("rejects non-libsql protocols, embedded credentials, query params, fragments, and paths", () => {
      expect(() =>
        validateCutoverTarget({
          url: "https://fchdhgonoi-prod-cutover-nguyenthetiengit01.turso.io",
          token: validToken,
        })
      ).toThrow(/libsql:\/\//i);

      expect(() =>
        validateCutoverTarget({
          url: "libsql://user:pass@fchdhgonoi-prod-cutover-nguyenthetiengit01.turso.io",
          token: validToken,
        })
      ).toThrow(/embedded credentials/i);

      expect(() =>
        validateCutoverTarget({
          url: "libsql://fchdhgonoi-prod-cutover-nguyenthetiengit01.turso.io?authToken=abc",
          token: validToken,
        })
      ).toThrow(/query parameters or fragments/i);

      expect(() =>
        validateCutoverTarget({
          url: "libsql://fchdhgonoi-prod-cutover-nguyenthetiengit01.turso.io#frag",
          token: validToken,
        })
      ).toThrow(/query parameters or fragments/i);

      expect(() =>
        validateCutoverTarget({
          url: "libsql://fchdhgonoi-prod-cutover-nguyenthetiengit01.turso.io/extra",
          token: validToken,
        })
      ).toThrow(/URL path/i);

      expect(() =>
        validateCutoverTarget({
          url: `libsql://${APPROVED_CUTOVER_TARGET_HOST}:8443`,
          token: validToken,
        })
      ).toThrow(/must not contain an explicit port/i);

      const backupFile = path.join(tmpDir, "port-preflight-test.json");
      fs.writeFileSync(backupFile, JSON.stringify(buildValidP103BackupV3()), "utf8");
      const cliPortRes = spawnSync(
        process.execPath,
        [
          "scripts/p103-cutover-restore.mjs",
          "--in",
          backupFile,
          "--apply",
          "--confirm-production-cutover",
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: {
            ...process.env,
            TURSO_CUTOVER_TARGET_DATABASE_URL: `libsql://${APPROVED_CUTOVER_TARGET_HOST}:8443`,
            TURSO_CUTOVER_TARGET_AUTH_TOKEN: validToken,
          },
        }
      );
      expect(cliPortRes.status).toBe(1);
      expect(cliPortRes.stderr).toMatch(/must not contain an explicit port/i);
      expect(cliPortRes.stdout.trim()).toBe("");
    });

    it("rejects staging, syn15d, restore-staging, and source Production hostnames", () => {
      for (const badHost of [
        "libsql://fchdhgonoi-staging-nguyenthetiengit01.turso.io",
        "libsql://fchdhgonoi-staging-restore-nguyenthetiengit01.turso.io",
        "libsql://fchdhgonoi-syn15d-cutover.turso.io",
        "libsql://fchdhgonoi-restore-staging.turso.io",
        "libsql://fchdhgonoi.nguyenthetiengit01.turso.io",
        "libsql://fchdhgonoi-nguyenthetiengit01.turso.io",
      ]) {
        expect(() =>
          validateCutoverTarget({
            url: badHost,
            token: validToken,
            expectedTargetHost: new URL(badHost).hostname,
          })
        ).toThrow(/Preflight blocked/i);
      }
    });

    it("rejects overlap with TURSO_DATABASE_URL, TURSO_STAGING_DATABASE_URL, or TURSO_STAGING_RESTORE_DATABASE_URL", () => {
      const targetUrl = `libsql://${APPROVED_CUTOVER_TARGET_HOST}`;
      expect(() =>
        validateCutoverTarget({
          url: targetUrl,
          token: validToken,
          env: {
            TURSO_DATABASE_URL: targetUrl,
          },
        })
      ).toThrow(/overlaps with disallowed source\/staging/i);

      expect(() =>
        validateCutoverTarget({
          url: targetUrl,
          token: validToken,
          env: {
            TURSO_STAGING_RESTORE_DATABASE_URL: `https://${APPROVED_CUTOVER_TARGET_HOST}`,
          },
        })
      ).toThrow(/overlaps with disallowed source\/staging/i);
    });

    it("enforces exact Owner-approved target host (no prefix wildcard) and --expected-target-host confirmation", () => {
      for (const deceptiveUrl of [
        "libsql://random-db-name.turso.io",
        "libsql://fchdhgonoi-prod-cutover.turso.io",
        "libsql://fchdhgonoi-prod-cutover-2026.turso.io",
        "libsql://fchdhgonoi-prod-cutover-extra.aws-ap-northeast-1.turso.io",
        "libsql://evil-fchdhgonoi-prod-cutover.turso.io",
        "libsql://fchdhgonoi-prod-cutover.evil.example",
        "libsql://fchdhgonoi-prod-cutover.turso.io.evil.com",
        "libsql://custom-gonoi-cutover-db.turso.io",
      ]) {
        expect(() =>
          validateCutoverTarget({
            url: deceptiveUrl,
            token: validToken,
            expectedTargetHost: new URL(deceptiveUrl).hostname,
          })
        ).toThrow(/Preflight blocked/i);
      }

      expect(() =>
        validateCutoverTarget({
          url: `libsql://${APPROVED_CUTOVER_TARGET_HOST}`,
          token: validToken,
          expectedTargetHost: "other-host.turso.io",
        })
      ).toThrow(/does not match --expected-target-host/i);

      const okDefault = validateCutoverTarget({
        url: `libsql://${APPROVED_CUTOVER_TARGET_HOST}`,
        token: validToken,
        expectedTargetHost: APPROVED_CUTOVER_TARGET_HOST,
      });
      expect(okDefault.safeHost).toBe(`libsql://${APPROVED_CUTOVER_TARGET_HOST}`);
      expect(okDefault.dbName).toBe("fchdhgonoi-prod-cutover-nguyenthetiengit01-collab");
    });
  });

  describe("2. CLI Flag Enforcement", () => {
    it("rejects --env staging, missing --confirm-production-cutover, and conflicting --apply + --dry-run", () => {
      expect(() =>
        parseCutoverCliArgs(["node", "script", "--env", "staging", "--in", "b.json"])
      ).toThrow(/never uses --env staging/i);

      expect(() =>
        parseCutoverCliArgs(["node", "script", "--in", "b.json", "--apply"])
      ).toThrow(/--confirm-production-cutover/i);

      expect(() =>
        parseCutoverCliArgs(["node", "script", "--in", "b.json", "--apply", "--dry-run"])
      ).toThrow(/cannot combine --apply with --dry-run/i);

      const defaultDryRun = parseCutoverCliArgs(["node", "script", "--in", "b.json"]);
      expect(defaultDryRun.dryRun).toBe(true);

      const applyConfirmed = parseCutoverCliArgs([
        "node",
        "script",
        "--in",
        "b.json",
        "--apply",
        "--confirm-production-cutover",
      ]);
      expect(applyConfirmed.dryRun).toBe(false);
      expect(applyConfirmed.confirmed).toBe(true);
    });
  });

  describe("3. Backup v3 Validation (Plaintext & Encrypted)", () => {
    it("rejects v2 backups and malformed payloads before touching DB", () => {
      expect(() =>
        loadAndValidateCutoverBackup({
          rawContent: JSON.stringify({ version: 2, tables: { players: [] } }),
        })
      ).toThrow(/requires backup version 3/i);

      expect(() =>
        loadAndValidateCutoverBackup({
          rawContent: JSON.stringify({ version: 3, tables: {} }),
        })
      ).toThrow(/missing 'objects' metadata/i);

      expect(() =>
        loadAndValidateCutoverBackup({ rawContent: "not-json" })
      ).toThrow(/not valid JSON/i);
    });

    it("decrypts and validates an encrypted v3 backup, and rejects missing private key", () => {
      const backup = buildValidP103BackupV3();
      const { publicKey, privateKey } = generateBackupKeypair();
      const encryptedEnvelope = encryptBufferWithPublicKey(
        Buffer.from(JSON.stringify(backup), "utf8"),
        publicKey
      );

      expect(() =>
        loadAndValidateCutoverBackup({ rawContent: encryptedEnvelope, privateKey: "" })
      ).toThrow(/BACKUP_DECRYPTION_PRIVATE_KEY/i);

      const loaded = loadAndValidateCutoverBackup({
        rawContent: encryptedEnvelope,
        privateKey,
      });
      expect(loaded.version).toBe(3);
      expect(loaded.encrypted).toBe(true);
      expect(loaded.backup.rowCounts.players).toBe(1);
    });
  });

  describe("4. Empty-Target Guard & Mid-Restore Fail-Closed", () => {
    it("aborts immediately if target DB has any non-system table (never DELETE/DROP)", async () => {
      const db = new DatabaseSync(":memory:");
      db.exec("CREATE TABLE existing_data (id INTEGER PRIMARY KEY);");
      const client = createSqliteLibsqlAdapter(db);

      try {
        await expect(assertEmptyTargetDatabase(client)).rejects.toThrow(
          /Empty-target guard blocked/i
        );
        expect(
          client.executedSql.some((s) => /\b(DELETE|DROP)\b/i.test(s))
        ).toBe(false);
      } finally {
        client.close();
      }
    });

    it("fails closed on mid-restore error without auto-retrying", async () => {
      const backup = buildValidP103BackupV3();
      const db = new DatabaseSync(":memory:");
      const baseClient = createSqliteLibsqlAdapter(db);
      let insertAttempts = 0;

      const failingClient = {
        async execute(stmt: string | { sql: string; args?: unknown[] }) {
          const sql = typeof stmt === "string" ? stmt : stmt.sql;
          if (/INSERT INTO "players"/i.test(sql)) {
            insertAttempts += 1;
            throw new Error("Simulated network/constraint failure mid-restore");
          }
          return baseClient.execute(stmt);
        },
        close() {
          baseClient.close();
        },
      };

      const preflight = validateCutoverTarget({
        url: `libsql://${APPROVED_CUTOVER_TARGET_HOST}`,
        token: "secret-token",
      });

      try {
        await expect(
          runCutoverRestore({
            client: failingClient,
            backup,
            preflight,
            dryRun: false,
          })
        ).rejects.toThrow(/Fail closed: provision a fresh empty target database/i);
        expect(insertAttempts).toBe(1);
      } finally {
        failingClient.close();
      }
    });
  });

  describe("5. Post-Restore Verification Failures", () => {
    it("fails on row count mismatch, missing migrations, default 1234 PIN, bad must_change_pin, or FK violations", async () => {
      const backup = buildValidP103BackupV3();

      // 5a. Row count mismatch
      const dbRowMismatch = new DatabaseSync(":memory:");
      const clientRowMismatch = createSqliteLibsqlAdapter(dbRowMismatch);
      try {
        await runCutoverRestore({
          client: clientRowMismatch,
          backup,
          preflight: { safeHost: "libsql://fchdhgonoi-prod-cutover-t.turso.io", dbName: "fchdhgonoi-prod-cutover-t" },
          dryRun: false,
        });
        dbRowMismatch.exec("DELETE FROM payments;");
        await expect(verifyCutoverTargetDatabase(clientRowMismatch, backup)).rejects.toThrow(
          /row count mismatch/i
        );
      } finally {
        clientRowMismatch.close();
      }

      // 5b. Missing required migration
      const dbMissingMig = new DatabaseSync(":memory:");
      const clientMissingMig = createSqliteLibsqlAdapter(dbMissingMig);
      try {
        await runCutoverRestore({
          client: clientMissingMig,
          backup,
          preflight: { safeHost: "libsql://fchdhgonoi-prod-cutover-t.turso.io", dbName: "fchdhgonoi-prod-cutover-t" },
          dryRun: false,
        });
        dbMissingMig.exec("UPDATE schema_migrations SET version = 'other-v1' WHERE version = 'phase7-p103-must-change-pin-v1';");
        await expect(verifyCutoverTargetDatabase(clientMissingMig, backup)).rejects.toThrow(
          /missing required migration/i
        );
      } finally {
        clientMissingMig.close();
      }

      // 5c. Legacy pin_code DEFAULT '1234'
      const dbLegacyPin = new DatabaseSync(":memory:");
      dbLegacyPin.exec(`
        CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL, summary TEXT);
        INSERT INTO schema_migrations VALUES ('phase7-p103-pin-default-v1', '2026-04-01', 'ok');
        INSERT INTO schema_migrations VALUES ('phase7-p103-must-change-pin-v1', '2026-04-01', 'ok');
        CREATE TABLE players (id INTEGER PRIMARY KEY, pin_code TEXT NOT NULL DEFAULT '1234', must_change_pin INTEGER NOT NULL DEFAULT 0);
      `);
      const clientLegacyPin = createSqliteLibsqlAdapter(dbLegacyPin);
      try {
        await expect(
          verifyCutoverTargetDatabase(clientLegacyPin, { rowCounts: { players: 0 } })
        ).rejects.toThrow(/pin_code default must NOT be '1234'/i);
      } finally {
        clientLegacyPin.close();
      }

      // 5d. Bad must_change_pin schema (nullable or wrong default)
      const dbBadMustChange = new DatabaseSync(":memory:");
      dbBadMustChange.exec(`
        CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL, summary TEXT);
        INSERT INTO schema_migrations VALUES ('phase7-p103-pin-default-v1', '2026-04-01', 'ok');
        INSERT INTO schema_migrations VALUES ('phase7-p103-must-change-pin-v1', '2026-04-01', 'ok');
        CREATE TABLE players (id INTEGER PRIMARY KEY, pin_code TEXT NOT NULL, must_change_pin TEXT DEFAULT '1');
      `);
      const clientBadMustChange = createSqliteLibsqlAdapter(dbBadMustChange);
      try {
        await expect(
          verifyCutoverTargetDatabase(clientBadMustChange, { rowCounts: { players: 0 } })
        ).rejects.toThrow(/must_change_pin type must be INTEGER/i);
      } finally {
        clientBadMustChange.close();
      }

      // 5e. Foreign key violation
      const dbFk = new DatabaseSync(":memory:");
      dbFk.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL, summary TEXT);
        INSERT INTO schema_migrations VALUES ('phase7-p103-pin-default-v1', '2026-04-01', 'ok');
        INSERT INTO schema_migrations VALUES ('phase7-p103-must-change-pin-v1', '2026-04-01', 'ok');
        CREATE TABLE players (id INTEGER PRIMARY KEY, pin_code TEXT NOT NULL, must_change_pin INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE payments (id INTEGER PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players(id));
        INSERT INTO payments VALUES (1, 999);
      `);
      const clientFk = createSqliteLibsqlAdapter(dbFk);
      try {
        await expect(
          verifyCutoverTargetDatabase(clientFk, { rowCounts: { players: 0, payments: 1 } })
        ).rejects.toThrow(/foreign_key_check reported 1 violation/i);
      } finally {
        clientFk.close();
      }
    });
  });

  describe("6. Success Branches (Dry-Run & Apply)", () => {
    it("performs zero writes in --dry-run mode on an empty target", async () => {
      const backup = buildValidP103BackupV3();
      const db = new DatabaseSync(":memory:");
      const client = createSqliteLibsqlAdapter(db);
      const preflight = validateCutoverTarget({
        url: `libsql://${APPROVED_CUTOVER_TARGET_HOST}`,
        token: "super-secret-token-never-logged",
      });

      try {
        const report = await runCutoverRestore({
          client,
          backup,
          preflight,
          dryRun: true,
          encrypted: true,
        });

        expect(report.status).toBe("dry_run_ok");
        expect(report.dryRun).toBe(true);
        expect(report.targetEmpty).toBe(true);
        expect(client.executedSql).toHaveLength(1); // Only SELECT from sqlite_master
        expect(JSON.stringify(report)).not.toContain("super-secret-token-never-logged");
      } finally {
        client.close();
      }
    });

    it("restores full v3 backup in --apply mode, verifies all checks, and leaks no secrets or PII", async () => {
      const backup = buildValidP103BackupV3();
      const targetPath = path.join(tmpDir, "target-cutover.sqlite");
      const db = new DatabaseSync(targetPath);
      const client = createSqliteLibsqlAdapter(db);
      const preflight = validateCutoverTarget({
        url: `libsql://${APPROVED_CUTOVER_TARGET_HOST}`,
        token: "super-secret-token-never-logged",
      });

      try {
        const report = await runCutoverRestore({
          client,
          backup,
          preflight,
          dryRun: false,
          encrypted: false,
        });

        expect(report.status).toBe("ok");
        expect(report.dryRun).toBe(false);
        expect(report.objectCounts).toEqual({
          tables: 4,
          indexes: 1,
          views: 2,
          triggers: 1,
        });
        expect(report.verification?.integrityCheck).toBe("ok");
        expect(report.verification?.foreignKeyViolations).toBe(0);
        expect(report.verification?.playersSchemaVerified).toBe(true);

        const serialized = JSON.stringify(report);
        expect(serialized).not.toContain("super-secret-token-never-logged");
        expect(serialized).not.toContain("$2b$10$hashedsecretpin");
        expect(serialized).not.toContain("Nguyen Van A");
      } finally {
        client.close();
      }
    });

    it("blocks CLI --env staging and missing --confirm-production-cutover via subprocess", () => {
      const resStaging = spawnSync(
        process.execPath,
        ["scripts/p103-cutover-restore.mjs", "--env", "staging", "--in", "x.json"],
        { cwd: process.cwd(), encoding: "utf8" }
      );
      expect(resStaging.status).not.toBe(0);
      expect(resStaging.stderr).toMatch(/never uses --env staging/i);

      const resNoConfirm = spawnSync(
        process.execPath,
        ["scripts/p103-cutover-restore.mjs", "--in", "x.json", "--apply"],
        { cwd: process.cwd(), encoding: "utf8" }
      );
      expect(resNoConfirm.status).not.toBe(0);
      expect(resNoConfirm.stderr).toMatch(/--confirm-production-cutover/i);
    });
  });
});
