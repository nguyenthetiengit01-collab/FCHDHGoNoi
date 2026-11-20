import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { validateBackupPayload } from "../../scripts/lib/backup-format.mjs";
import {
  restoreToLocalSqlite,
  restoreToTursoStaging,
  validateLocalRestoreTarget,
} from "../../scripts/db-restore.mjs";

const tempDirs: string[] = [];

function makeTempDir(prefix = "p72-restore-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeValidV3Backup() {
  return {
    version: 3,
    schema: {
      teams: "CREATE TABLE teams (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)",
      members:
        "CREATE TABLE members (id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER NOT NULL REFERENCES teams(id), full_name TEXT NOT NULL)",
    },
    objects: {
      tables: [
        {
          name: "teams",
          sql: "CREATE TABLE teams (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)",
        },
        {
          name: "members",
          sql: "CREATE TABLE members (id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER NOT NULL REFERENCES teams(id), full_name TEXT NOT NULL)",
        },
      ],
      indexes: [
        {
          name: "idx_members_team",
          sql: "CREATE INDEX idx_members_team ON members(team_id)",
        },
      ],
      triggers: [] as Array<{ name: string; sql: string }>,
      views: [] as Array<{ name: string; sql: string }>,
    },
    tables: {
      teams: [{ id: 1, name: "Synthetic FC" }],
      members: [
        { id: 1, team_id: 1, full_name: "Player One" },
        { id: 2, team_id: 1, full_name: "Player Two" },
      ],
    },
    rowCounts: {
      teams: 1,
      members: 2,
    },
    sequences: [
      { name: "teams", seq: 1 },
      { name: "members", seq: 2 },
    ],
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore Windows handle release timing
      }
    }
  }
});

describe("Phase 7.2 – Restore Payload Validation & Failure Injection", () => {
  it("rejects v3 backups with missing sequences, malformed schema metadata, or malformed rowCounts", () => {
    const noSeq = makeValidV3Backup() as Record<string, unknown>;
    delete noSeq.sequences;
    expect(() => validateBackupPayload(noSeq)).toThrow(/sequences/);

    const badSchema = makeValidV3Backup();
    badSchema.schema.teams = "DROP TABLE teams";
    expect(() => validateBackupPayload(badSchema)).toThrow(/schema/);

    const missingSchemaObj = makeValidV3Backup() as Record<string, unknown>;
    delete missingSchemaObj.schema;
    expect(() => validateBackupPayload(missingSchemaObj)).toThrow(/schema/);

    const badRowCounts = makeValidV3Backup();
    badRowCounts.rowCounts.members = 999;
    expect(() => validateBackupPayload(badRowCounts)).toThrow(/rowCounts/);

    const negativeRowCounts = makeValidV3Backup();
    negativeRowCounts.rowCounts.teams = -1;
    expect(() => validateBackupPayload(negativeRowCounts)).toThrow(/non-negative integer/);
  });

  it("rejects non-empty local target, missing parent dir, and wrong local/staging target identity", async () => {
    const dir = makeTempDir();
    const nonEmptyPath = path.join(dir, "existing.sqlite");
    const existingDb = new DatabaseSync(nonEmptyPath);
    existingDb.exec("CREATE TABLE keep_me (id INTEGER PRIMARY KEY); INSERT INTO keep_me VALUES (42);");
    existingDb.close();

    const backup = makeValidV3Backup();
    await expect(restoreToLocalSqlite(backup, 3, nonEmptyPath)).rejects.toThrow(/not empty/);

    const verifyDb = new DatabaseSync(nonEmptyPath);
    const kept = verifyDb.prepare("SELECT id FROM keep_me").get() as { id: number };
    verifyDb.close();
    expect(kept.id).toBe(42);

    expect(() =>
      validateLocalRestoreTarget(path.join(dir, "missing-subdir", "out.sqlite"))
    ).toThrow(/parent directory does not exist/);

    expect(() =>
      validateLocalRestoreTarget(path.resolve(process.cwd(), "data", "gonoifc.sqlite"))
    ).toThrow(/Restore blocked/);

    // Wrong staging target identity via CLI preflight
    expect(() =>
      execFileSync(
        "node",
        ["scripts/db-restore.mjs", "--env", "staging", "--preflight-only"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            TURSO_STAGING_RESTORE_DATABASE_URL: "libsql://fchdhgonoi-prod.turso.io",
            TURSO_STAGING_RESTORE_AUTH_TOKEN: "fake-token",
          },
          stdio: "pipe",
        }
      )
    ).toThrow();
  });

  it("rolls back atomically on failure halfway through inserts, index creation, sequence restoration, FK check, integrity_check, and commit", async () => {
    const dir = makeTempDir();
    const backup = makeValidV3Backup();

    const targetInsertFail = path.join(dir, "fail-insert.sqlite");
    await expect(
      restoreToLocalSqlite(backup, 3, targetInsertFail, {
        hooks: {
          onBeforeRowInsert: (tbl: string, idx: number) => {
            if (tbl === "members" && idx === 1) {
              throw new Error("Simulated mid-insert failure");
            }
          },
        },
      })
    ).rejects.toThrow(/Simulated mid-insert failure/);

    const checkInsert = new DatabaseSync(targetInsertFail);
    expect(
      checkInsert
        .prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
        .all()
    ).toEqual([]);
    checkInsert.close();

    const targetIdxFail = path.join(dir, "fail-index.sqlite");
    await expect(
      restoreToLocalSqlite(backup, 3, targetIdxFail, {
        hooks: {
          onBeforeIndexCreate: () => {
            throw new Error("Simulated index failure");
          },
        },
      })
    ).rejects.toThrow(/Simulated index failure/);

    const checkIdx = new DatabaseSync(targetIdxFail);
    expect(
      checkIdx
        .prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
        .all()
    ).toEqual([]);
    checkIdx.close();

    const targetSeqFail = path.join(dir, "fail-seq.sqlite");
    await expect(
      restoreToLocalSqlite(backup, 3, targetSeqFail, {
        hooks: {
          onBeforeSequenceRestore: () => {
            throw new Error("Simulated sequence failure");
          },
        },
      })
    ).rejects.toThrow(/Simulated sequence failure/);

    const checkSeq = new DatabaseSync(targetSeqFail);
    expect(
      checkSeq
        .prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
        .all()
    ).toEqual([]);
    checkSeq.close();

    const badFkBackup = makeValidV3Backup();
    badFkBackup.tables.members.push({ id: 3, team_id: 999, full_name: "Orphan" });
    badFkBackup.rowCounts.members = 3;
    const targetFkFail = path.join(dir, "fail-fk.sqlite");
    await expect(restoreToLocalSqlite(badFkBackup, 3, targetFkFail)).rejects.toThrow(
      /Foreign key integrity check failed/
    );

    const checkFk = new DatabaseSync(targetFkFail);
    expect(
      checkFk
        .prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
        .all()
    ).toEqual([]);
    checkFk.close();

    const targetIntegrityFail = path.join(dir, "fail-integrity.sqlite");
    await expect(
      restoreToLocalSqlite(backup, 3, targetIntegrityFail, {
        hooks: {
          overrideIntegrityCheck: () => [{ integrity_check: "corrupt page 1" }],
        },
      })
    ).rejects.toThrow(/integrity_check failed/);

    const checkIntegrity = new DatabaseSync(targetIntegrityFail);
    expect(
      checkIntegrity
        .prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
        .all()
    ).toEqual([]);
    checkIntegrity.close();

    const targetCommitFail = path.join(dir, "fail-commit.sqlite");
    await expect(
      restoreToLocalSqlite(backup, 3, targetCommitFail, {
        hooks: {
          onBeforeCommit: () => {
            throw new Error("Simulated commit outcome unknown");
          },
        },
      })
    ).rejects.toThrow(/Simulated commit outcome unknown/);
  });

  it("marks remote Staging target contaminated on partial failure and refuses subsequent restore", async () => {
    const executedSql: string[] = [];
    let contaminatedInserted = false;
    let calls = 0;

    const mockClient = {
      execute: vi.fn(async (stmt: unknown) => {
        const sql = typeof stmt === "string" ? stmt : (stmt as { sql: string }).sql;
        executedSql.push(sql);
        calls += 1;
        if (sql.includes("sqlite_master")) {
          return contaminatedInserted
            ? { rows: [{ name: "_restore_contaminated" }] }
            : { rows: [] };
        }
        if (sql.includes("INSERT INTO \"members\"")) {
          throw new Error("Remote network drop mid-restore");
        }
        if (sql.includes("INSERT INTO _restore_contaminated")) {
          contaminatedInserted = true;
        }
        return { rows: [] };
      }),
      close: vi.fn(),
    } as unknown as Client;

    const backup = makeValidV3Backup();
    let caught: (Error & { contaminated?: boolean }) | null = null;
    try {
      await restoreToTursoStaging(
        backup,
        3,
        { safeHost: "fchdhgonoi-staging-restore.turso.io", dbName: "fchdhgonoi-staging-restore" },
        { client: mockClient, keepClientOpen: true }
      );
    } catch (err) {
      caught = err as Error & { contaminated?: boolean };
    }

    expect(caught).toBeTruthy();
    expect(caught?.contaminated).toBe(true);
    expect(contaminatedInserted).toBe(true);
    expect(calls).toBeGreaterThan(2);

    // Subsequent restore attempt on contaminated target is rejected before any mutation
    await expect(
      restoreToTursoStaging(
        backup,
        3,
        { safeHost: "fchdhgonoi-staging-restore.turso.io", dbName: "fchdhgonoi-staging-restore" },
        { client: mockClient, keepClientOpen: true }
      )
    ).rejects.toThrow(/not empty/);
  });

  it("rejects malicious/malformed DDL: table name mismatch, appended SQL statement, duplicate object, malformed trigger/view, and duplicate sequence", () => {
    const mismatch = makeValidV3Backup();
    mismatch.objects.tables[0].sql = "CREATE TABLE other_tbl (id INTEGER PRIMARY KEY)";
    mismatch.schema.teams = mismatch.objects.tables[0].sql;
    expect(() => validateBackupPayload(mismatch)).toThrow(/name mismatch/);

    const appendedStmt = makeValidV3Backup();
    appendedStmt.objects.tables[0].sql =
      "CREATE TABLE teams (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL); DROP TABLE members;";
    appendedStmt.schema.teams = appendedStmt.objects.tables[0].sql;
    expect(() => validateBackupPayload(appendedStmt)).toThrow(/malformed tables DDL/);

    const dupObj = makeValidV3Backup();
    dupObj.objects.indexes.push({ ...dupObj.objects.indexes[0] });
    expect(() => validateBackupPayload(dupObj)).toThrow(/duplicate indexes/);

    const badTrigger = makeValidV3Backup();
    badTrigger.objects.triggers.push({
      name: "trg_evil",
      sql: "CREATE TABLE trg_evil (id INT)",
    });
    expect(() => validateBackupPayload(badTrigger)).toThrow(/malformed triggers DDL/);

    const badView = makeValidV3Backup();
    badView.objects.views.push({
      name: "v_evil",
      sql: "CREATE VIEW v_other AS SELECT 1",
    });
    expect(() => validateBackupPayload(badView)).toThrow(/name mismatch/);

    const dupSeq = makeValidV3Backup();
    dupSeq.sequences.push({ name: "teams", seq: 5 });
    expect(() => validateBackupPayload(dupSeq)).toThrow(/duplicate sqlite_sequence/);
  });

  it("handles adversarial DDL scanner cases: literals, quoted identifiers, escaped quotes, comments, triggers with BEGIN/END and CASE/END, and real sqlite_master DDL", async () => {
    const { hasMultipleSqlStatements, extractDdlObjectName } = await import(
      "../../scripts/lib/backup-format.mjs"
    );
    const { DatabaseSync } = await import("node:sqlite");

    // 1. String literals with semicolons & escaped single quotes
    const litSql =
      "CREATE TABLE notes_tbl (id INTEGER PRIMARY KEY, val TEXT DEFAULT 'a;b''c;d')";
    expect(hasMultipleSqlStatements(litSql, "tables")).toBe(false);
    expect(extractDdlObjectName(litSql, "tables")).toBe("notes_tbl");

    // 2. Quoted identifiers (double quotes, backticks, brackets) with semicolons & escaped quotes
    expect(
      hasMultipleSqlStatements(
        'CREATE TABLE "odd;""name" (id INTEGER PRIMARY KEY)',
        "tables"
      )
    ).toBe(false);
    expect(
      hasMultipleSqlStatements(
        "CREATE TABLE `back;tick` (id INTEGER PRIMARY KEY)",
        "tables"
      )
    ).toBe(false);
    expect(
      hasMultipleSqlStatements(
        "CREATE TABLE [bracket;tbl] (id INTEGER PRIMARY KEY)",
        "tables"
      )
    ).toBe(false);

    // 3. Line comments, block comments, and trailing comments
    const commentedSql = `
      /* leading ; comment */
      CREATE TABLE clean_tbl (
        id INTEGER PRIMARY KEY, -- inline ; comment
        note TEXT DEFAULT 'ok'
      ); -- trailing ; comment
    `;
    expect(hasMultipleSqlStatements(commentedSql, "tables")).toBe(false);
    expect(extractDdlObjectName(commentedSql, "tables")).toBe("clean_tbl");

    // 4. Multiple statements (even disguised after comments/literals) must be rejected
    expect(
      hasMultipleSqlStatements(
        "CREATE TABLE ok_tbl (id INT); DROP TABLE other_tbl;",
        "tables"
      )
    ).toBe(true);
    expect(
      hasMultipleSqlStatements(
        "CREATE TABLE ok_tbl (id INT DEFAULT 'x;y'); SELECT 1",
        "tables"
      )
    ).toBe(true);

    // 5. CREATE TRIGGER with BEGIN/END and nested CASE/END
    const validTriggerSql = `
      CREATE TRIGGER trg_audit_case AFTER INSERT ON teams
      BEGIN
        UPDATE teams
        SET name = CASE WHEN NEW.name = '' THEN 'x;y' ELSE NEW.name END
        WHERE id = NEW.id;
      END;
    `;
    expect(hasMultipleSqlStatements(validTriggerSql, "triggers")).toBe(false);
    expect(extractDdlObjectName(validTriggerSql, "triggers")).toBe(
      "trg_audit_case"
    );

    // Trigger followed by injected statement must be rejected
    const evilTriggerSql = `${validTriggerSql} DROP TABLE teams;`;
    expect(hasMultipleSqlStatements(evilTriggerSql, "triggers")).toBe(true);

    // 6. Real synthetic SQLite sqlite_master DDL round-trip
    const mem = new DatabaseSync(":memory:");
    try {
      mem.exec(`
        CREATE TABLE teams (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT DEFAULT 'a;b');
        CREATE INDEX idx_teams_note ON teams(note);
        CREATE VIEW v_teams AS SELECT id, note FROM teams;
        CREATE TRIGGER trg_teams_ins AFTER INSERT ON teams
        BEGIN
          UPDATE teams SET note = CASE WHEN NEW.note IS NULL THEN 'n;a' ELSE NEW.note END WHERE id = NEW.id;
        END;
      `);
      const masterRows = mem
        .prepare(
          "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'"
        )
        .all() as Array<{ type: string; name: string; sql: string }>;

      const kindMap: Record<string, string> = {
        table: "tables",
        index: "indexes",
        view: "views",
        trigger: "triggers",
      };
      for (const row of masterRows) {
        const kind = kindMap[row.type];
        expect(hasMultipleSqlStatements(row.sql, kind)).toBe(false);
        expect(extractDdlObjectName(row.sql, kind)).toBe(row.name);
      }
    } finally {
      mem.close();
    }
  });
});
