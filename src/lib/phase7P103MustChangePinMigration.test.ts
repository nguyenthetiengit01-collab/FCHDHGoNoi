import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "./auth";

type MigrationTx = {
  query: (sql: string, params?: SQLInputValue[]) => Promise<Array<Record<string, unknown>>>;
  execute: (sql: string, params?: SQLInputValue[]) => Promise<void>;
};

type MigrationModule = {
  runMustChangePinMigration: (opts: {
    query: MigrationTx["query"];
    execute?: MigrationTx["execute"];
    withTransaction?: (fn: (tx: MigrationTx) => Promise<void>) => Promise<void>;
    dryRun?: boolean;
  }) => Promise<Record<string, unknown>>;
  createLocalSqliteTransactionRunner: (
    db: DatabaseSync
  ) => (fn: (tx: MigrationTx) => Promise<void>) => Promise<void>;
  validateLocalSqlitePath: (
    sqlitePath: string,
    repoRoot?: string,
    tmpRoot?: string
  ) => string;
  runStagingMigration: (opts?: { dryRun?: boolean }) => Promise<Record<string, unknown>>;
};

const SCRIPT_PATH = path.resolve(
  process.cwd(),
  "scripts/migrations/phase7-p103-must-change-pin-v1.mjs"
);

function runCli(args: string[], envOverrides: Record<string, string | undefined> = {}) {
  const env = { ...process.env };
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: "utf8",
    env,
  });
}

describe("Phase 7 P1-03 must_change_pin Migration (v1)", () => {
  const tempDirs: string[] = [];
  const openDbs: DatabaseSync[] = [];

  afterEach(() => {
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

  function makeTempSqlite() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p103-mig-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "isolated.sqlite");
    const raw = new DatabaseSync(dbPath);
    openDbs.push(raw);
    return { dir, dbPath, raw };
  }

  it("rejects invalid CLI flag combinations, missing/multiple targets, Production env, unconfigured Staging, and out-of-tmpdir/symlink SQLite paths", async () => {
    const mod = (await import(
      "../../scripts/migrations/phase7-p103-must-change-pin-v1.mjs"
    )) as unknown as MigrationModule;

    // 1. --apply missing target -> fail
    const missingTarget = runCli(["--apply"]);
    expect(missingTarget.status).not.toBe(0);

    // 2. --apply with multiple targets (--sqlite + --env staging) -> fail
    const { dbPath, raw } = makeTempSqlite();
    raw.close();
    const multiTarget = runCli(["--sqlite", dbPath, "--env", "staging", "--apply"]);
    expect(multiTarget.status).not.toBe(0);

    // 3. --dry-run and --apply simultaneously -> fail
    const bothFlags = runCli(["--sqlite", dbPath, "--dry-run", "--apply"]);
    expect(bothFlags.status).not.toBe(0);

    // 4. --env production -> fail
    const prodEnv = runCli(["--env", "production", "--apply"]);
    expect(prodEnv.status).not.toBe(0);

    // 5. --env staging missing config (must NOT fall back to Production TURSO_DATABASE_URL) -> fail
    const unconfiguredStaging = runCli(["--env", "staging", "--dry-run"], {
      TURSO_STAGING_DATABASE_URL: undefined,
      TURSO_STAGING_AUTH_TOKEN: undefined,
      TURSO_DATABASE_URL: "libsql://fchdhgonoi-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io",
      TURSO_AUTH_TOKEN: "prod-token-must-not-be-used",
    });
    expect(unconfiguredStaging.status).not.toBe(0);

    // 6. --env staging pointing to Production-like URL -> fail closed without network call
    const prodUrlInStaging = runCli(["--env", "staging", "--apply"], {
      TURSO_STAGING_DATABASE_URL:
        "libsql://fchdhgonoi-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io",
      TURSO_STAGING_AUTH_TOKEN: "dummy-token",
    });
    expect(prodUrlInStaging.status).not.toBe(0);

    // 7. --sqlite outside allowed tmpRoot -> fail
    const outsideTmpFile = path.join(process.cwd(), "outside-tmp-test.sqlite");
    expect(() =>
      mod.validateLocalSqlitePath(outsideTmpFile, process.cwd(), os.tmpdir())
    ).toThrow(/repository directory|OS temporary directory/i);

    const controlledTmp = fs.mkdtempSync(path.join(os.tmpdir(), "p103-ctrl-tmp-"));
    const outsideCtrlDir = fs.mkdtempSync(path.join(os.tmpdir(), "p103-outside-ctrl-"));
    tempDirs.push(controlledTmp, outsideCtrlDir);
    const externalTarget = path.join(outsideCtrlDir, "external.sqlite");
    fs.writeFileSync(externalTarget, "");

    expect(() =>
      mod.validateLocalSqlitePath(externalTarget, process.cwd(), controlledTmp)
    ).toThrow(/OS temporary directory/i);

    // 8. Symlink/junction inside controlled tmp pointing outside controlled tmp -> fail
    const linkDir = path.join(controlledTmp, "symlinked-dir");
    fs.symlinkSync(outsideCtrlDir, linkDir, "junction");
    const viaSymlink = path.join(linkDir, "external.sqlite");
    expect(() =>
      mod.validateLocalSqlitePath(viaSymlink, process.cwd(), controlledTmp)
    ).toThrow(/symlink realpath/i);
  });

  it("fails closed when players table is missing or column definition is incompatible", async () => {
    const { dbPath } = makeTempSqlite();
    const mod = (await import(
      "../../scripts/migrations/phase7-p103-must-change-pin-v1.mjs"
    )) as unknown as MigrationModule;
    const raw = new DatabaseSync(dbPath);
    openDbs.push(raw);

    await expect(
      mod.runMustChangePinMigration({
        query: async (sql, params = []) => raw.prepare(sql).all(...params),
        execute: async (sql, params = []) => {
          raw.prepare(sql).run(...params);
        },
        withTransaction: mod.createLocalSqliteTransactionRunner(raw),
        dryRun: true,
      })
    ).rejects.toThrow(/players table does not exist/i);

    const { raw: badRaw } = makeTempSqlite();
    badRaw.exec(`
      CREATE TABLE players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        must_change_pin TEXT DEFAULT 'yes'
      );
    `);
    await expect(
      mod.runMustChangePinMigration({
        query: async (sql, params = []) => badRaw.prepare(sql).all(...params),
        execute: async (sql, params = []) => {
          badRaw.prepare(sql).run(...params);
        },
        withTransaction: mod.createLocalSqliteTransactionRunner(badRaw),
        dryRun: false,
      })
    ).rejects.toThrow(/Incompatible must_change_pin column definition/i);
  });

  it("defaults CLI to --dry-run (0 DDL/DML), applies idempotently, preserves existing rows/PINs, and handles duplicate-column race", async () => {
    const mod = (await import(
      "../../scripts/migrations/phase7-p103-must-change-pin-v1.mjs"
    )) as unknown as MigrationModule;

    // Verify dryRun executes zero DDL/DML
    let executeCount = 0;
    const dryRes = await mod.runMustChangePinMigration({
      query: async (sql) => {
        if (sql.includes("sqlite_master")) return [{ name: "players" }];
        return [{ name: "id", type: "INTEGER", notnull: 1, dflt_value: null }];
      },
      execute: async () => {
        executeCount += 1;
      },
      dryRun: true,
    });
    expect(dryRes.status).toBe("planned");
    expect(executeCount).toBe(0);

    const { dbPath, raw } = makeTempSqlite();
    const mgrHash = hashPassword("MgrSecret@2026");
    const plrHash = hashPassword("PlrSecret@2026");

    raw.exec(`
      CREATE TABLE players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        pin_code TEXT NOT NULL DEFAULT ''
      );
    `);
    raw.prepare("INSERT INTO players (full_name, phone, pin_code) VALUES (?, ?, ?)").run(
      "Nguyen Van A",
      "0905111222",
      mgrHash
    );
    raw.prepare("INSERT INTO players (full_name, phone, pin_code) VALUES (?, ?, ?)").run(
      "Tran Van B",
      "0905333444",
      plrHash
    );
    raw.close();

    // 1. Default CLI (--dry-run) reports planned DDL without modifying DB
    const dryCli = runCli(["--sqlite", dbPath]);
    expect(dryCli.status).toBe(0);
    const dryJson = JSON.parse(dryCli.stdout) as Record<string, unknown>;
    expect(dryJson.dryRun).toBe(true);
    expect(dryJson.status).toBe("planned");
    expect(dryJson.applied).toBe(false);
    expect(dryCli.stdout).not.toContain("Nguyen Van A");
    expect(dryCli.stdout).not.toContain("scrypt$");

    // 2. Explicit --apply adds must_change_pin INTEGER NOT NULL DEFAULT 0 and keeps existing rows intact
    const applyCli = runCli(["--sqlite", dbPath, "--apply"]);
    expect(applyCli.status).toBe(0);
    const applyJson = JSON.parse(applyCli.stdout) as Record<string, unknown>;
    expect(applyJson.dryRun).toBe(false);
    expect(applyJson.status).toBe("applied");
    expect(applyJson.applied).toBe(true);
    expect(applyJson.verified).toBe(true);

    const verifyDb = new DatabaseSync(dbPath, { readOnly: true });
    openDbs.push(verifyDb);
    const cols = verifyDb.prepare("PRAGMA table_info(players)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>;
    const col = cols.find((c) => c.name === "must_change_pin");
    expect(col).toBeDefined();
    expect(col?.type.toUpperCase()).toBe("INTEGER");
    expect(col?.notnull).toBe(1);
    expect(col?.dflt_value).toBe("0");

    const rows = verifyDb
      .prepare("SELECT full_name, phone, pin_code, must_change_pin FROM players ORDER BY id ASC")
      .all() as Array<{ full_name: string; phone: string; pin_code: string; must_change_pin: number }>;
    expect(rows).toEqual([
      { full_name: "Nguyen Van A", phone: "0905111222", pin_code: mgrHash, must_change_pin: 0 },
      { full_name: "Tran Van B", phone: "0905333444", pin_code: plrHash, must_change_pin: 0 },
    ]);
    verifyDb.close();

    // 3. Repeated --apply -> already_applied
    const repeatCli = runCli(["--sqlite", dbPath, "--apply"]);
    expect(repeatCli.status).toBe(0);
    const repeatJson = JSON.parse(repeatCli.stdout) as Record<string, unknown>;
    expect(repeatJson.status).toBe("already_applied");
    expect(repeatJson.applied).toBe(false);
    expect(repeatJson.verified).toBe(true);

    // 4. Concurrent duplicate-column race -> re-reads schema and succeeds as already_applied
    let seenAfterRace = false;
    const raceResult = await mod.runMustChangePinMigration({
      query: async (sql) => {
        if (sql.includes("sqlite_master")) return [{ name: "players" }];
        if (seenAfterRace) {
          return [{ name: "must_change_pin", type: "INTEGER", notnull: 1, dflt_value: "0" }];
        }
        return [{ name: "id", type: "INTEGER", notnull: 1, dflt_value: null }];
      },
      execute: async () => {},
      withTransaction: async (fn) => {
        await fn({
          query: async (sql) => {
            if (sql.includes("sqlite_master")) return [{ name: "players" }];
            if (seenAfterRace) {
              return [{ name: "must_change_pin", type: "INTEGER", notnull: 1, dflt_value: "0" }];
            }
            return [{ name: "id", type: "INTEGER", notnull: 1, dflt_value: null }];
          },
          execute: async () => {
            seenAfterRace = true;
            throw new Error("duplicate column name: must_change_pin");
          },
        });
      },
      dryRun: false,
    });
    expect(raceResult.status).toBe("already_applied");
    expect(raceResult.verified).toBe(true);
  });
});
