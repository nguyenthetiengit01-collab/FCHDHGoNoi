#!/usr/bin/env node
/**
 * Explicit, versioned, idempotent migration (v1) to remove legacy
 * `pin_code DEFAULT '1234'` / `DEFAULT ('1234')` from `players` on local SQLite.
 *
 * Usage:
 *   node scripts/migrations/phase7-p103-pin-default-v1.mjs --sqlite <isolated-temp-path.sqlite> [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

export const MIGRATION_VERSION = "phase7-p103-pin-default-v1";

function getArg(flag, argv = process.argv) {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return null;
}

export function validateLocalSqlitePath(
  sqlitePath,
  repoRoot = process.cwd()
) {
  if (!sqlitePath || typeof sqlitePath !== "string" || !sqlitePath.trim()) {
    throw new Error("Local SQLite safety guard: missing --sqlite path.");
  }

  const resolved = path.resolve(sqlitePath.trim());
  const resolvedRoot = path.resolve(repoRoot);
  const realRoot = fs.existsSync(resolvedRoot)
    ? fs.realpathSync(resolvedRoot)
    : resolvedRoot;

  const checkCandidate = (candidatePath, label) => {
    const normalizedTarget =
      process.platform === "win32" ? candidatePath.toLowerCase() : candidatePath;
    for (const rootCandidate of [resolvedRoot, realRoot]) {
      const normalizedRoot =
        process.platform === "win32" ? rootCandidate.toLowerCase() : rootCandidate;
      if (
        normalizedTarget === normalizedRoot ||
        normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
      ) {
        throw new Error(
          `Local SQLite safety guard: refusing to target a database inside the repository directory (${label}).`
        );
      }
    }

    const base = path.basename(normalizedTarget);
    if (
      base === "gonoifc.sqlite" ||
      /(^|[-_.])(prod|production)([-_.]|$)/i.test(base)
    ) {
      throw new Error(
        `Local SQLite safety guard: refusing to target protected or production-like database "${base}".`
      );
    }
  };

  checkCandidate(resolved, "direct path");
  if (!fs.existsSync(resolved)) {
    throw new Error(`SQLite file not found: ${resolved}`);
  }
  const realResolved = fs.realpathSync(resolved);
  checkCandidate(realResolved, "symlink realpath");
  return realResolved;
}

/**
 * Normalizes SQLite PRAGMA table_info().dflt_value for players.pin_code and
 * classifies it fail-closed:
 * - null / undefined / '' -> safe (no default or empty default)
 * - '1234' / ('1234') / (('1234')) -> legacy default "1234" (requires rebuild)
 * - any other non-empty expression -> unsafe/unknown (abort preflight)
 */
export function classifyPinCodeDefault(dfltValue) {
  if (dfltValue === null || dfltValue === undefined) {
    return { kind: "none", hasLegacyDefault: false };
  }

  let normalized = String(dfltValue).trim();
  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    const inner = normalized.slice(1, -1).trim();
    if (!inner) break;
    normalized = inner;
  }

  if (normalized === "''" || normalized === '""' || normalized === "") {
    return { kind: "empty", hasLegacyDefault: false };
  }

  if (normalized === "'1234'" || normalized === '"1234"') {
    return { kind: "legacy_1234", hasLegacyDefault: true };
  }

  throw new Error(
    `Preflight error: unsupported or unknown non-empty players.pin_code default expression (${String(dfltValue)}). Aborting fail-closed.`
  );
}

function replacePinDefaultInDdl(tableSql) {
  const updated = tableSql.replace(
    /(\bpin_code\b[^,]*?\bDEFAULT\s+)(?:\(\s*['"]1234['"]\s*\)|['"]1234['"])/i,
    "$1''"
  );
  if (updated === tableSql) {
    throw new Error(
      "Preflight error: could not safely rewrite pin_code default '1234' in players DDL."
    );
  }
  return updated.replace(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"players"|players)\s*\(/i,
    'CREATE TABLE "players_p103_new" ('
  );
}

/**
 * Runs the P1-03 players.pin_code default removal migration on a local SQLite
 * DatabaseSync instance, preserving all columns, rows, indexes, triggers, and FKs.
 * Runs PRAGMA foreign_key_check and PRAGMA integrity_check BEFORE COMMIT.
 *
 * @param {{
 *   db: import("node:sqlite").DatabaseSync;
 *   now?: Date;
 *   dryRun?: boolean;
 *   checks?: {
 *     foreignKeyCheck?: (db: import("node:sqlite").DatabaseSync) => unknown[];
 *     integrityCheck?: (db: import("node:sqlite").DatabaseSync) => unknown;
 *   };
 * }} params
 */
export function runPhase7P103PinDefaultLocalMigration({
  db,
  now = new Date(),
  dryRun = false,
  checks = undefined,
}) {
  const tableRow = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'players' LIMIT 1"
    )
    .get();
  if (!tableRow || typeof tableRow.sql !== "string") {
    throw new Error("Preflight error: players table does not exist.");
  }

  const columns = db.prepare("PRAGMA table_info(players)").all();
  const pinCol = columns.find((c) => c.name === "pin_code");
  if (!pinCol) {
    throw new Error("Preflight error: players.pin_code column does not exist.");
  }

  const defaultInfo = classifyPinCodeDefault(pinCol.dflt_value);
  const hasLegacyDefault = defaultInfo.hasLegacyDefault;

  const hasMigrationsTable = Boolean(
    db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations' LIMIT 1"
      )
      .get()
  );
  const alreadyRecorded = hasMigrationsTable
    ? Boolean(
        db
          .prepare(
            "SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1"
          )
          .get(MIGRATION_VERSION)
      )
    : false;

  const actions = [];
  if (hasLegacyDefault) {
    actions.push("REBUILD players TABLE (pin_code DEFAULT '1234' -> DEFAULT '')");
  }
  if (!hasMigrationsTable) {
    actions.push("CREATE TABLE schema_migrations");
  }
  if (!alreadyRecorded) {
    actions.push(`RECORD MIGRATION ${MIGRATION_VERSION}`);
  }

  if (!hasLegacyDefault && alreadyRecorded) {
    return {
      version: MIGRATION_VERSION,
      dryRun,
      applied: false,
      alreadyApplied: true,
      defaultKind: defaultInfo.kind,
      actions: [],
    };
  }

  if (dryRun) {
    return {
      version: MIGRATION_VERSION,
      dryRun: true,
      applied: false,
      alreadyApplied: false,
      defaultKind: defaultInfo.kind,
      actions,
    };
  }

  const savedIndexes = db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'players' AND sql IS NOT NULL ORDER BY name"
    )
    .all();
  const savedTriggers = db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'players' AND sql IS NOT NULL ORDER BY name"
    )
    .all();

  const fkBeforeRow = db.prepare("PRAGMA foreign_keys").get();
  const fkWasOn = Number(fkBeforeRow?.foreign_keys ?? 1) === 1;

  db.exec("PRAGMA foreign_keys = OFF;");
  let inTx = false;
  try {
    db.exec("BEGIN IMMEDIATE;");
    inTx = true;

    if (hasLegacyDefault) {
      const colNames = columns
        .map((c) => `"${String(c.name).replace(/"/g, '""')}"`)
        .join(", ");
      const createNewSql = replacePinDefaultInDdl(tableRow.sql);
      const beforeCount = Number(
        db.prepare("SELECT COUNT(*) AS c FROM players").get()?.c ?? 0
      );

      db.exec(createNewSql);
      db.exec(
        `INSERT INTO "players_p103_new" (${colNames}) SELECT ${colNames} FROM players;`
      );

      const afterCount = Number(
        db.prepare('SELECT COUNT(*) AS c FROM "players_p103_new"').get()?.c ?? -1
      );
      if (beforeCount !== afterCount) {
        throw new Error(
          `Row count mismatch during players rebuild: before=${beforeCount}, after=${afterCount}`
        );
      }

      db.exec("DROP TABLE players;");
      db.exec('ALTER TABLE "players_p103_new" RENAME TO players;');

      for (const idx of savedIndexes) {
        db.exec(idx.sql);
      }
      for (const trg of savedTriggers) {
        db.exec(trg.sql);
      }
    }

    if (!hasMigrationsTable) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL,
          summary TEXT
        );
      `);
    }

    if (!alreadyRecorded) {
      db.prepare(
        "INSERT OR REPLACE INTO schema_migrations (version, applied_at, summary) VALUES (?, ?, ?)"
      ).run(
        MIGRATION_VERSION,
        now.toISOString(),
        "Rebuild players table to replace legacy pin_code DEFAULT '1234' with DEFAULT ''"
      );
    }

    // M1: Run foreign_key_check and integrity_check BEFORE COMMIT
    const fkViolations = checks?.foreignKeyCheck
      ? checks.foreignKeyCheck(db)
      : db.prepare("PRAGMA foreign_key_check").all();
    if (!Array.isArray(fkViolations) || fkViolations.length > 0) {
      throw new Error(
        `Pre-commit PRAGMA foreign_key_check failed with ${Array.isArray(fkViolations) ? fkViolations.length : "invalid"} violation(s).`
      );
    }

    const integrityStatus = checks?.integrityCheck
      ? checks.integrityCheck(db)
      : db.prepare("PRAGMA integrity_check").get()?.integrity_check;
    if (integrityStatus !== "ok") {
      throw new Error(
        `Pre-commit PRAGMA integrity_check failed: ${String(integrityStatus)}`
      );
    }

    db.exec("COMMIT;");
    inTx = false;
  } catch (err) {
    if (inTx) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // Ignore rollback failure if connection already aborted
      }
    }
    throw err;
  } finally {
    db.exec(`PRAGMA foreign_keys = ${fkWasOn ? "ON" : "OFF"};`);
  }

  return {
    version: MIGRATION_VERSION,
    dryRun: false,
    applied: true,
    alreadyApplied: false,
    defaultKind: defaultInfo.kind,
    actions,
    preservedIndexes: savedIndexes.length,
    preservedTriggers: savedTriggers.length,
  };
}

async function main() {
  const envName = getArg("--env");
  if (envName !== null || process.argv.includes("--env")) {
    throw new Error(
      "Remote execution not implemented/authorized: phase7-p103-pin-default-v1.mjs supports local SQLite (--sqlite) only."
    );
  }

  const sqlitePath = getArg("--sqlite");
  const dryRun = process.argv.includes("--dry-run");

  if (!sqlitePath) {
    throw new Error(
      "Missing target. Specify --sqlite <isolated-temp-path.sqlite> [--dry-run]."
    );
  }

  const safePath = validateLocalSqlitePath(sqlitePath);
  const db = new DatabaseSync(safePath);
  try {
    const result = runPhase7P103PinDefaultLocalMigration({ db, dryRun });
    console.log(JSON.stringify({ status: "ok", mode: "sqlite", ...result }, null, 2));
  } finally {
    db.close();
  }
}

const isEntrypoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error("Migration failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
