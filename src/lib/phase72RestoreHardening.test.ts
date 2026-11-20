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
      triggers: [],
      views: [],
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
});
