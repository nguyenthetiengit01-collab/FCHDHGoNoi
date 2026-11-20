#!/usr/bin/env node
/**
 * Idempotent Phase 7.1.3 Batch Fee Idempotency Migration (v1).
 * Usage:
 *   node scripts/migrations/phase7-idempotency-v1.mjs --sqlite data/gonoifc.sqlite [--dry-run]
 *   node scripts/migrations/phase7-idempotency-v1.mjs --env staging [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { validateStagingTarget } from "../lib/turso-preflight.mjs";

const MIGRATION_VERSION = "phase7-idempotency-v1";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

export async function runPhase7IdempotencyMigration({
  execute,
  query,
  now = new Date(),
  dryRun = false,
}) {
  const nowIso = now.toISOString();
  const actions = [];

  await execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL,
      summary TEXT
    )
  `);

  const tables = await query(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'idempotency_keys'`
  );
  const hasIdempotencyTable = tables.some((t) => t.name === "idempotency_keys");
  if (!hasIdempotencyTable) {
    actions.push("CREATE TABLE idempotency_keys");
    if (!dryRun) {
      await execute(`
        CREATE TABLE IF NOT EXISTS idempotency_keys (
          idempotency_key TEXT NOT NULL,
          actor_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          response_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          expires_at TEXT NOT NULL,
          PRIMARY KEY (idempotency_key, actor_id, action)
        )
      `);
    }
  }

  actions.push("ENSURE INDEX idx_idempotency_expires_at");
  if (!dryRun) {
    await execute(
      `CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_keys(expires_at)`
    );
    await execute(
      `INSERT OR REPLACE INTO schema_migrations (version, applied_at, summary) VALUES (?, ?, ?)`,
      [MIGRATION_VERSION, nowIso, actions.join("; ") || "No-op already up to date"]
    );
  }

  return {
    version: MIGRATION_VERSION,
    dryRun,
    actions,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sqlitePath = getArg("--sqlite");
  const envTarget = getArg("--env");

  if (!sqlitePath && envTarget !== "staging") {
    console.error(
      "Usage: node scripts/migrations/phase7-idempotency-v1.mjs --sqlite <path> | --env staging [--dry-run]"
    );
    process.exit(1);
  }

  if (sqlitePath) {
    const { DatabaseSync } = await import("node:sqlite");
    const resolved = path.resolve(sqlitePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`SQLite file not found: ${resolved}`);
    }
    const db = new DatabaseSync(resolved);
    try {
      const result = await runPhase7IdempotencyMigration({
        execute: async (sql, params = []) => {
          db.prepare(sql).run(...params);
        },
        query: async (sql, params = []) => db.prepare(sql).all(...params),
        dryRun,
      });
      console.log(JSON.stringify(result, null, 2));
    } finally {
      db.close();
    }
    return;
  }

  const target = validateStagingTarget({
    url: process.env.TURSO_DATABASE_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
    allowProdEnvName: false,
  });
  const client = createClient({
    url: target.url,
    authToken: target.authToken,
  });
  try {
    const result = await runPhase7IdempotencyMigration({
      execute: async (sql, params = []) => {
        await client.execute({ sql, args: params });
      },
      query: async (sql, params = []) => {
        const res = await client.execute({ sql, args: params });
        return res.rows.map((r) => ({ ...r }));
      },
      dryRun,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.close();
  }
}

if (
  import.meta.url ===
  new URL(process.argv[1] ? `file:///${process.argv[1].replace(/\\/g, "/")}` : "", "file:///").href
) {
  main().catch((err) => {
    console.error("Migration failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
