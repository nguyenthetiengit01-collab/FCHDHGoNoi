#!/usr/bin/env node
/**
 * Retention cleanup script for raw product_analytics_events (> 90 days).
 * Preserves product_analytics_daily, product_analytics_monthly_actors, and all business tables.
 *
 * Usage:
 *   node scripts/analytics-cleanup.mjs --sqlite data/gonoifc.sqlite [--days 90] [--dry-run]
 *   node scripts/analytics-cleanup.mjs --env staging [--days 90] [--dry-run]
 *   node scripts/analytics-cleanup.mjs --env production --confirm-production [--days 90] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { validateProductionTarget, validateStagingTarget } from "./lib/turso-preflight.mjs";

const DEFAULT_BATCH_SIZE = 5000;
const MAX_BATCHES_PER_RUN = 10;
const MAX_DURATION_MS = 8000;

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

async function runLibsqlBoundedCleanup({ client, targetLabel, dryRun, retentionDays, cutoffIso }) {
  const tableRes = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='product_analytics_events' LIMIT 1"
  );
  if (tableRes.rows.length === 0) {
    return {
      status: "ok",
      target: targetLabel,
      dryRun,
      retentionDays,
      cutoffIso,
      preservedRollups: true,
      deletedCount: 0,
      remainingEligible: 0,
      partial: false,
    };
  }

  const cntRes = await client.execute({
    sql: "SELECT COUNT(*) AS cnt FROM product_analytics_events WHERE occurred_at < ?",
    args: [cutoffIso],
  });
  const initialEligible = Number(cntRes.rows[0]?.cnt || 0);

  if (dryRun || initialEligible === 0) {
    return {
      status: "ok",
      target: targetLabel,
      dryRun,
      retentionDays,
      cutoffIso,
      preservedRollups: true,
      deletedCount: 0,
      remainingEligible: initialEligible,
      partial: dryRun ? initialEligible > 0 : false,
    };
  }

  const startedAt = Date.now();
  let deletedCount = 0;

  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    if (i > 0 && Date.now() - startedAt >= MAX_DURATION_MS) {
      break;
    }

    const tx = await client.transaction("write");
    let batchDeleted = 0;
    try {
      const delRes = await tx.execute({
        sql: `DELETE FROM product_analytics_events
              WHERE id IN (
                SELECT id FROM product_analytics_events
                WHERE occurred_at < ?
                ORDER BY id ASC
                LIMIT ?
              )`,
        args: [cutoffIso, DEFAULT_BATCH_SIZE],
      });
      batchDeleted = Number(delRes.rowsAffected || 0);
      await tx.commit();
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // Ignore rollback failure
      }
      throw err;
    }

    deletedCount += batchDeleted;
    if (batchDeleted < DEFAULT_BATCH_SIZE) {
      break;
    }
  }

  const afterRes = await client.execute({
    sql: "SELECT COUNT(*) AS cnt FROM product_analytics_events WHERE occurred_at < ?",
    args: [cutoffIso],
  });
  const remainingEligible = Number(afterRes.rows[0]?.cnt || 0);

  return {
    status: "ok",
    target: targetLabel,
    dryRun: false,
    retentionDays,
    cutoffIso,
    preservedRollups: true,
    deletedCount,
    remainingEligible,
    partial: remainingEligible > 0,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirmProduction = process.argv.includes("--confirm-production");
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
      const summary = await runLibsqlBoundedCleanup({
        client,
        targetLabel: "staging",
        dryRun,
        retentionDays,
        cutoffIso,
      });
      console.log(JSON.stringify(summary, null, 2));
    } finally {
      client.close();
    }
    return;
  }

  if (envMode === "production") {
    if (!confirmProduction) {
      throw new Error(
        "Refusing Production cleanup without explicit --confirm-production flag."
      );
    }

    const prodUrl = process.env.TURSO_DATABASE_URL;
    const prodToken = process.env.TURSO_AUTH_TOKEN;
    validateProductionTarget({
      url: prodUrl,
      token: prodToken,
      envUrlName: "TURSO_DATABASE_URL",
      envTokenName: "TURSO_AUTH_TOKEN",
      disallowUrls: [
        process.env.TURSO_STAGING_DATABASE_URL,
        process.env.TURSO_STAGING_RESTORE_DATABASE_URL,
      ],
    });

    const client = createClient({ url: prodUrl, authToken: prodToken });
    try {
      const summary = await runLibsqlBoundedCleanup({
        client,
        targetLabel: "production",
        dryRun,
        retentionDays,
        cutoffIso,
      });
      console.log(JSON.stringify(summary, null, 2));
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
        JSON.stringify(
          {
            status: "ok",
            target: path.basename(sqlitePath),
            dryRun,
            retentionDays,
            cutoffIso,
            preservedRollups: true,
            deletedCount: 0,
            remainingEligible: 0,
            partial: false,
          },
          null,
          2
        )
      );
      return;
    }

    const row = db
      .prepare("SELECT COUNT(*) AS cnt FROM product_analytics_events WHERE occurred_at < ?")
      .get(cutoffIso);
    const initialEligible = Number(row?.cnt || 0);
    let deletedCount = 0;

    if (!dryRun && initialEligible > 0) {
      const startedAt = Date.now();
      for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
        if (i > 0 && Date.now() - startedAt >= MAX_DURATION_MS) break;
        db.exec("BEGIN IMMEDIATE;");
        let batchDeleted = 0;
        try {
          const res = db
            .prepare(
              `DELETE FROM product_analytics_events
               WHERE id IN (
                 SELECT id FROM product_analytics_events
                 WHERE occurred_at < ?
                 ORDER BY id ASC
                 LIMIT ?
               )`
            )
            .run(cutoffIso, DEFAULT_BATCH_SIZE);
          batchDeleted = Number(res.changes || 0);
          db.exec("COMMIT;");
        } catch (err) {
          try {
            db.exec("ROLLBACK;");
          } catch {
            // Ignore
          }
          throw err;
        }
        deletedCount += batchDeleted;
        if (batchDeleted < DEFAULT_BATCH_SIZE) break;
      }
    }

    const afterRow = db
      .prepare("SELECT COUNT(*) AS cnt FROM product_analytics_events WHERE occurred_at < ?")
      .get(cutoffIso);
    const remainingEligible = Number(afterRow?.cnt || 0);

    console.log(
      JSON.stringify(
        {
          status: "ok",
          target: path.basename(sqlitePath),
          dryRun,
          retentionDays,
          cutoffIso,
          preservedRollups: true,
          deletedCount,
          remainingEligible,
          partial: dryRun ? initialEligible > 0 : remainingEligible > 0,
        },
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
