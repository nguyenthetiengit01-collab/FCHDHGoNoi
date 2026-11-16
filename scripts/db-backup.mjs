#!/usr/bin/env node
/**
 * Read-only backup utility v3 for FC HĐH Gò Nổi database (Local SQLite or Turso LibSQL).
 * Exports full database schema (tables, indexes, triggers, views) + typed row data (including BLOB).
 * Usage:
 *   node scripts/db-backup.mjs --out backups/backup.json [--sqlite data/gonoifc.sqlite]
 *   node scripts/db-backup.mjs --env staging --out backups/staging.json [--preflight-only]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { validateStagingTarget } from "./lib/turso-preflight.mjs";
import {
  encodeRow,
  isValidIdentifier,
  topoSortTables,
  validateBackupPayload,
} from "./lib/backup-format.mjs";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

function collectObjects(masterRows) {
  const schema = {};
  const objects = {
    tables: [],
    indexes: [],
    triggers: [],
    views: [],
  };

  for (const row of masterRows) {
    const name = row.name ? String(row.name) : "";
    const type = row.type ? String(row.type) : "";
    const tblName = row.tbl_name ? String(row.tbl_name) : "";
    const sql = row.sql ? String(row.sql) : "";
    if (!name || !sql || name.startsWith("sqlite_") || !isValidIdentifier(name)) {
      continue;
    }

    const entry = { name, tbl_name: tblName, sql };
    if (type === "table") {
      schema[name] = sql;
      objects.tables.push(entry);
    } else if (type === "index") {
      objects.indexes.push(entry);
    } else if (type === "trigger") {
      objects.triggers.push(entry);
    } else if (type === "view") {
      objects.views.push(entry);
    }
  }

  return { schema, objects };
}

export async function backupFromTurso(tursoUrl, tursoToken, options = {}) {
  const client = createClient({ url: tursoUrl, authToken: tursoToken });
  let tx = null;
  try {
    try {
      tx = await client.transaction("read");
    } catch (err) {
      throw new Error(
        `Consistent read transaction ("read") is required for Turso backup but failed to start: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    const masterRes = await tx.execute(
      "SELECT name, type, tbl_name, sql FROM sqlite_master WHERE type IN ('table', 'index', 'trigger', 'view') AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type ASC, name ASC"
    );
    const { schema, objects } = collectObjects(masterRes.rows);

    const rawTableNames = objects.tables.map((t) => t.name);
    const fkEdges = [];
    for (const table of rawTableNames) {
      const fkRes = await tx.execute(`PRAGMA foreign_key_list("${table}")`);
      for (const fk of fkRes.rows) {
        if (fk.table) {
          fkEdges.push({ child: table, parent: String(fk.table) });
        }
      }
    }

    const orderedTables = topoSortTables(rawTableNames, fkEdges);
    const tablesData = {};
    const rowCounts = {};

    for (let i = 0; i < orderedTables.length; i++) {
      const table = orderedTables[i];
      if (typeof options.onBeforeTableRead === "function") {
        await options.onBeforeTableRead(table, i);
      }
      const res = await tx.execute(`SELECT * FROM "${table}"`);
      tablesData[table] = res.rows.map((r) => encodeRow({ ...r }));
      rowCounts[table] = tablesData[table].length;
    }

    let sequences = [];
    const seqTableRes = await tx.execute(
      "SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='sqlite_sequence' LIMIT 1"
    );
    if (seqTableRes.rows.length > 0) {
      const seqRes = await tx.execute("SELECT name, seq FROM sqlite_sequence ORDER BY name ASC");
      sequences = seqRes.rows
        .filter((r) => r.name && isValidIdentifier(String(r.name)))
        .map((r) => ({ name: String(r.name), seq: Number(r.seq) }));
    }

    return { schema, objects, tablesData, rowCounts, sequences };
  } finally {
    if (tx) {
      try {
        tx.close();
      } catch {
        // Ignore already-closed read transaction
      }
    }
    client.close();
  }
}

export async function backupFromSqlite(targetFile) {
  const { DatabaseSync } = await import("node:sqlite");
  if (!fs.existsSync(targetFile)) {
    throw new Error(`SQLite file not found: ${targetFile}`);
  }
  const db = new DatabaseSync(targetFile, { readOnly: true });
  let inTx = false;
  try {
    db.exec("BEGIN;");
    inTx = true;

    const masterRows = db
      .prepare(
        "SELECT name, type, tbl_name, sql FROM sqlite_master WHERE type IN ('table', 'index', 'trigger', 'view') AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type ASC, name ASC"
      )
      .all();
    const { schema, objects } = collectObjects(masterRows);

    const rawTableNames = objects.tables.map((t) => t.name);
    const fkEdges = [];
    for (const table of rawTableNames) {
      const fkRows = db.prepare(`PRAGMA foreign_key_list("${table}")`).all();
      for (const fk of fkRows) {
        if (fk.table) {
          fkEdges.push({ child: table, parent: String(fk.table) });
        }
      }
    }

    const orderedTables = topoSortTables(rawTableNames, fkEdges);
    const tablesData = {};
    const rowCounts = {};

    for (const table of orderedTables) {
      const rows = db.prepare(`SELECT * FROM "${table}"`).all();
      tablesData[table] = rows.map((r) => encodeRow(r));
      rowCounts[table] = tablesData[table].length;
    }

    let sequences = [];
    const seqTableRow = db
      .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='sqlite_sequence' LIMIT 1")
      .get();
    if (seqTableRow) {
      const seqRows = db.prepare("SELECT name, seq FROM sqlite_sequence ORDER BY name ASC").all();
      sequences = seqRows
        .filter((r) => r.name && isValidIdentifier(String(r.name)))
        .map((r) => ({ name: String(r.name), seq: Number(r.seq) }));
    }

    return { schema, objects, tablesData, rowCounts, sequences };
  } finally {
    if (inTx) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // Ignore
      }
    }
    db.close();
  }
}

async function main() {
  const envMode = getArg("--env");
  const preflightOnly = process.argv.includes("--preflight-only");
  const outPath = getArg("--out");
  if (!preflightOnly && !outPath) {
    console.error(
      "Usage: node scripts/db-backup.mjs --out <file.json> [--sqlite <path>] [--env staging] [--preflight-only]"
    );
    process.exit(1);
  }

  const sqlitePath = getArg("--sqlite");
  let tursoUrl = process.env.TURSO_DATABASE_URL;
  let tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (envMode === "staging") {
    if (sqlitePath) {
      console.error("Preflight blocked: --sqlite cannot be combined with --env staging.");
      process.exit(1);
    }
    const stagingUrl = process.env.TURSO_STAGING_DATABASE_URL;
    const stagingToken = process.env.TURSO_STAGING_AUTH_TOKEN;
    const preflight = validateStagingTarget({
      url: stagingUrl,
      token: stagingToken,
      envUrlName: "TURSO_STAGING_DATABASE_URL",
      envTokenName: "TURSO_STAGING_AUTH_TOKEN",
      role: "source",
      disallowUrls: [process.env.TURSO_DATABASE_URL],
    });
    if (preflightOnly) {
      console.log(JSON.stringify({ status: "preflight_ok", mode: "staging", ...preflight }, null, 2));
      return;
    }
    tursoUrl = stagingUrl;
    tursoToken = stagingToken;
  } else if (envMode) {
    console.error(`Unsupported --env value "${envMode}". Expected "staging".`);
    process.exit(1);
  }

  const useTurso = envMode === "staging" || (!sqlitePath && tursoUrl && tursoToken);
  const sourceType = envMode === "staging" ? "turso-staging" : useTurso ? "turso" : "sqlite";

  const { schema, objects, tablesData, rowCounts, sequences } = useTurso
    ? await backupFromTurso(tursoUrl, tursoToken)
    : await backupFromSqlite(path.resolve(sqlitePath || process.env.SQLITE_DB_PATH || "data/gonoifc.sqlite"));

  const payload = {
    version: 3,
    createdAt: new Date().toISOString(),
    sourceType,
    schema,
    objects,
    sequences,
    rowCounts,
    tables: tablesData,
  };

  validateBackupPayload(payload);

  const resolvedOut = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    JSON.stringify(
      {
        status: "ok",
        version: 3,
        out: resolvedOut,
        objectCounts: {
          tables: objects.tables.length,
          indexes: objects.indexes.length,
          triggers: objects.triggers.length,
          views: objects.views.length,
          sequences: sequences.length,
        },
        rowCounts,
      },
      null,
      2
    )
  );
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
