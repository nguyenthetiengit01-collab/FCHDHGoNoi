#!/usr/bin/env node
/**
 * Additive, backward-compatible, idempotent migration (v1) to add
 * `players.must_change_pin INTEGER NOT NULL DEFAULT 0`.
 *
 * Existing users default to 0 (false). Manager-initiated resets set 1 (true),
 * and self-service PIN changes clear it back to 0.
 *
 * Usage:
 *   node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --sqlite <isolated-temp-path.sqlite> [--dry-run]
 *   node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --env staging [--dry-run]
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@libsql/client";
import { validateStagingTarget } from "../lib/turso-preflight.mjs";
import { validateLocalSqlitePath } from "./phase7-p103-pin-default-v1.mjs";

export const MIGRATION_VERSION = "phase7-p103-must-change-pin-v1";

function getArg(flag, argv = process.argv) {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return null;
}

export function runMustChangePinLocalMigration({
  db,
  now = new Date(),
  dryRun = false,
}) {
  const tableRow = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'players' LIMIT 1"
    )
    .get();
  if (!tableRow) {
    throw new Error("Preflight error: players table does not exist.");
  }

  const columns = db.prepare("PRAGMA table_info(players)").all();
  const hasMustChangeCol = columns.some((c) => c.name === "must_change_pin");

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
  if (!hasMustChangeCol) {
    actions.push(
      "ALTER TABLE players ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!hasMigrationsTable) {
    actions.push("CREATE TABLE schema_migrations");
  }
  if (!alreadyRecorded) {
    actions.push(`RECORD MIGRATION ${MIGRATION_VERSION}`);
  }

  if (hasMustChangeCol && alreadyRecorded) {
    return {
      version: MIGRATION_VERSION,
      dryRun,
      applied: false,
      alreadyApplied: true,
      actions: [],
    };
  }

  if (dryRun) {
    return {
      version: MIGRATION_VERSION,
      dryRun: true,
      applied: false,
      alreadyApplied: false,
      actions,
    };
  }

  let inTx = false;
  try {
    db.exec("BEGIN IMMEDIATE;");
    inTx = true;

    if (!hasMustChangeCol) {
      db.exec(
        "ALTER TABLE players ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0;"
      );
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
        "Add additive must_change_pin INTEGER NOT NULL DEFAULT 0 column to players"
      );
    }

    const integrityRows = db.prepare("PRAGMA integrity_check").all();
    if (
      !Array.isArray(integrityRows) ||
      integrityRows.length !== 1 ||
      integrityRows[0]?.integrity_check !== "ok"
    ) {
      throw new Error(
        `Pre-commit PRAGMA integrity_check failed: ${JSON.stringify(integrityRows)}`
      );
    }

    db.exec("COMMIT;");
    inTx = false;
  } catch (err) {
    if (inTx) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // Ignore rollback failure if connection aborted
      }
    }
    throw err;
  }

  return {
    version: MIGRATION_VERSION,
    dryRun: false,
    applied: true,
    alreadyApplied: false,
    actions,
  };
}

export async function runMustChangePinTursoStagingMigration({
  client,
  now = new Date(),
  dryRun = false,
}) {
  const colsRes = await client.execute("PRAGMA table_info(players)");
  const hasMustChangeCol = colsRes.rows.some(
    (r) => String(r.name) === "must_change_pin"
  );

  const migTblRes = await client.execute(
    "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations' LIMIT 1"
  );
  const hasMigrationsTable = migTblRes.rows.length > 0;
  let alreadyRecorded = false;
  if (hasMigrationsTable) {
    const recRes = await client.execute({
      sql: "SELECT 1 AS ok FROM schema_migrations WHERE version = ? LIMIT 1",
      args: [MIGRATION_VERSION],
    });
    alreadyRecorded = recRes.rows.length > 0;
  }

  const actions = [];
  if (!hasMustChangeCol) {
    actions.push(
      "ALTER TABLE players ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!hasMigrationsTable) {
    actions.push("CREATE TABLE schema_migrations");
  }
  if (!alreadyRecorded) {
    actions.push(`RECORD MIGRATION ${MIGRATION_VERSION}`);
  }

  if (hasMustChangeCol && alreadyRecorded) {
    return {
      version: MIGRATION_VERSION,
      dryRun,
      applied: false,
      alreadyApplied: true,
      actions: [],
    };
  }

  if (dryRun) {
    return {
      version: MIGRATION_VERSION,
      dryRun: true,
      applied: false,
      alreadyApplied: false,
      actions,
    };
  }

  if (!hasMustChangeCol) {
    await client.execute(
      "ALTER TABLE players ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!hasMigrationsTable) {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL,
        summary TEXT
      )
    `);
  }
  if (!alreadyRecorded) {
    await client.execute({
      sql: "INSERT OR REPLACE INTO schema_migrations (version, applied_at, summary) VALUES (?, ?, ?)",
      args: [
        MIGRATION_VERSION,
        now.toISOString(),
        "Add additive must_change_pin INTEGER NOT NULL DEFAULT 0 column to players",
      ],
    });
  }

  return {
    version: MIGRATION_VERSION,
    dryRun: false,
    applied: true,
    alreadyApplied: false,
    actions,
  };
}

async function main() {
  const sqlitePath = getArg("--sqlite");
  const envName = getArg("--env");
  const dryRun = process.argv.includes("--dry-run");

  if (!sqlitePath && envName !== "staging") {
    throw new Error(
      "Missing target. Specify --sqlite <isolated-temp-path.sqlite> or --env staging [--dry-run]."
    );
  }

  if (sqlitePath) {
    const safePath = validateLocalSqlitePath(sqlitePath);
    const db = new DatabaseSync(safePath);
    try {
      const result = runMustChangePinLocalMigration({ db, dryRun });
      console.log(JSON.stringify({ status: "ok", mode: "sqlite", ...result }, null, 2));
    } finally {
      db.close();
    }
    return;
  }

  const { url, authToken } = validateStagingTarget({
    url: process.env.TURSO_STAGING_DATABASE_URL,
    token: process.env.TURSO_STAGING_AUTH_TOKEN,
    envUrlName: "TURSO_STAGING_DATABASE_URL",
    envTokenName: "TURSO_STAGING_AUTH_TOKEN",
    role: "target",
    disallowUrls: [process.env.TURSO_DATABASE_URL],
  });
  const client = createClient({ url, authToken });
  try {
    const result = await runMustChangePinTursoStagingMigration({ client, dryRun });
    console.log(JSON.stringify({ status: "ok", mode: "staging", ...result }, null, 2));
  } finally {
    client.close();
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
