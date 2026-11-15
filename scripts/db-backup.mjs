#!/usr/bin/env node
/**
 * Read-only backup utility for FC HĐH Gò Nổi database (Local SQLite or Turso LibSQL).
 * Usage:
 *   node scripts/db-backup.mjs --out backups/backup.json [--sqlite data/gonoifc.sqlite]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

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
  const outPath = getArg("--out");
  if (!outPath) {
    console.error("Usage: node scripts/db-backup.mjs --out <file.json> [--sqlite <path>]");
    process.exit(1);
  }

  const sqlitePath = getArg("--sqlite");
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  const tablesData = {};
  const rowCounts = {};

  if (!sqlitePath && tursoUrl && tursoToken) {
    const client = createClient({ url: tursoUrl, authToken: tursoToken });
    try {
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
    version: 1,
    createdAt: new Date().toISOString(),
    rowCounts,
    tables: tablesData,
  };

  const resolvedOut = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, JSON.stringify(payload, null, 2), "utf8");
  console.log(JSON.stringify({ status: "ok", out: resolvedOut, rowCounts }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
