#!/usr/bin/env node
/**
 * Read-only backup utility for FC HĐH Gò Nổi database (Local SQLite or Turso LibSQL).
 * Exports exact table DDL schema + all row data as JSON.
 * Usage:
 *   node scripts/db-backup.mjs --out backups/backup.json [--sqlite data/gonoifc.sqlite]
 *   node scripts/db-backup.mjs --env staging --out backups/staging.json [--preflight-only]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { validateStagingTarget } from "./lib/turso-preflight.mjs";

const TABLES = [
  "team_settings",
  "players",
  "matches",
  "match_attendances",
  "other_incomes",
  "expenses",
  "club_posts",
  "sponsors",
  "audit_logs",
];

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
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

  const schema = {};
  const tablesData = {};
  const rowCounts = {};

  if (envMode === "staging" || (!sqlitePath && tursoUrl && tursoToken)) {
    const client = createClient({ url: tursoUrl, authToken: tursoToken });
    try {
      const schemaRes = await client.execute(
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
      );
      for (const row of schemaRes.rows) {
        if (row.name && row.sql) {
          schema[String(row.name)] = String(row.sql);
        }
      }

      for (const table of TABLES) {
        try {
          const res = await client.execute(`SELECT * FROM ${table}`);
          tablesData[table] = res.rows.map((r) => ({ ...r }));
          rowCounts[table] = tablesData[table].length;
        } catch {
          tablesData[table] = [];
          rowCounts[table] = 0;
        }
      }
    } finally {
      client.close();
    }
  } else {
    const { DatabaseSync } = await import("node:sqlite");
    const targetFile = path.resolve(sqlitePath || process.env.SQLITE_DB_PATH || "data/gonoifc.sqlite");
    if (!fs.existsSync(targetFile)) {
      console.error(`SQLite file not found: ${targetFile}`);
      process.exit(1);
    }
    const db = new DatabaseSync(targetFile, { readOnly: true });
    try {
      const schemaRows = db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
        )
        .all();
      for (const row of schemaRows) {
        if (row.name && row.sql) {
          schema[String(row.name)] = String(row.sql);
        }
      }

      for (const table of TABLES) {
        try {
          const rows = db.prepare(`SELECT * FROM ${table}`).all();
          tablesData[table] = rows;
          rowCounts[table] = rows.length;
        } catch {
          tablesData[table] = [];
          rowCounts[table] = 0;
        }
      }
    } finally {
      db.close();
    }
  }

  const payload = {
    version: 2,
    createdAt: new Date().toISOString(),
    schema,
    rowCounts,
    tables: tablesData,
  };

  const resolvedOut = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, JSON.stringify(payload, null, 2), "utf8");
  console.log(JSON.stringify({ status: "ok", out: resolvedOut, schemaTables: Object.keys(schema).length, rowCounts }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
