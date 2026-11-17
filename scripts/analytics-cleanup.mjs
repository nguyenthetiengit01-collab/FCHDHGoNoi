#!/usr/bin/env node
/**
 * Retention cleanup script for raw product_analytics_events (> 90 days).
 * Preserves product_analytics_daily, product_analytics_monthly_actors, and all business tables.
 *
 * Usage:
 *   node scripts/analytics-cleanup.mjs --sqlite data/gonoifc.sqlite [--days 90] [--dry-run]
 *   node scripts/analytics-cleanup.mjs --env staging [--days 90] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { validateStagingTarget } from "./lib/turso-preflight.mjs";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const envMode = getArg("--env");
  const sqliteArg = getArg("--sqlite");
  const daysRaw = Number(getArg("--days") || "90");
  const retentionDays = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : 90;
  const cutoffIso = new Date(Date.now() - retentionDays * 86400000).toISOString();

  if (envMode === "staging") {
    const stagingUrl = process.env.TURSO_STAGING_DATABASE_URL;
    const stagingToken = process.env.TURSO_STAGING_AUTH_TOKEN;
    validateStagingTarget({
      url: stagingUrl,
      token: stagingToken,
      envUrlName: "TURSO_STAGING_DATABASE_URL",
      envTokenName: "TURSO_STAGING_AUTH_TOKEN",
      role: "target",
      disallowUrls: [process.env.TURSO_DATABASE_URL],
    });

    const client = createClient({ url: stagingUrl, authToken: stagingToken });
    try {
      const cntRes = await client.execute({
        sql: "SELECT COUNT(*) AS cnt FROM product_analytics_events WHERE occurred_at < ?",
        args: [cutoffIso],
      });
      const expiredCount = Number(cntRes.rows[0]?.cnt || 0);
      let deletedCount = 0;
      if (!dryRun && expiredCount > 0) {
        const delRes = await client.execute({
          sql: "DELETE FROM product_analytics_events WHERE occurred_at < ?",
          args: [cutoffIso],
        });
        deletedCount = Number(delRes.rowsAffected || 0);
      }
      console.log(
        JSON.stringify(
          { status: "ok", target: "staging", dryRun, retentionDays, cutoffIso, expiredCount, deletedCount },
          null,
          2
        )
      );
    } finally {
      client.close();
    }
    return;
  }

  const sqlitePath = path.resolve(sqliteArg || process.env.SQLITE_DB_PATH || "data/gonoifc.sqlite");
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found: ${sqlitePath}`);
  }

  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(sqlitePath);
  try {
    const hasTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_analytics_events'")
      .get();
    if (!hasTable) {
      console.log(
        JSON.stringify({ status: "ok", target: sqlitePath, dryRun, retentionDays, cutoffIso, expiredCount: 0, deletedCount: 0 }, null, 2)
      );
      return;
    }

    const row = db
      .prepare("SELECT COUNT(*) AS cnt FROM product_analytics_events WHERE occurred_at < ?")
      .get(cutoffIso);
    const expiredCount = Number(row?.cnt || 0);
    let deletedCount = 0;
    if (!dryRun && expiredCount > 0) {
      const res = db
        .prepare("DELETE FROM product_analytics_events WHERE occurred_at < ?")
        .run(cutoffIso);
      deletedCount = Number(res.changes || 0);
    }

    console.log(
      JSON.stringify(
        { status: "ok", target: sqlitePath, dryRun, retentionDays, cutoffIso, expiredCount, deletedCount },
        null,
        2
      )
    );
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
