#!/usr/bin/env node
/**
 * Idempotent Phase 4 Analytics & Lifecycle Migration (v1).
 * Usage:
 *   node scripts/migrations/phase4-analytics-v1.mjs --sqlite data/gonoifc.sqlite [--dry-run]
 *   node scripts/migrations/phase4-analytics-v1.mjs --env staging [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { validateStagingTarget } from "../lib/turso-preflight.mjs";

const MIGRATION_VERSION = "phase4-analytics-v1";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

export async function runPhase4Migration({
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

  const playerCols = await query(`PRAGMA table_info("players")`);
  const hasJoinedAt = playerCols.some((c) => c.name === "joined_at");
  if (!hasJoinedAt) {
    actions.push("ADD COLUMN players.joined_at");
    if (!dryRun) {
      await execute(`ALTER TABLE players ADD COLUMN joined_at TEXT`);
    }
  }

  const incomeCols = await query(`PRAGMA table_info("other_incomes")`);
  const hasSponsorId = incomeCols.some((c) => c.name === "sponsor_id");
  if (!hasSponsorId) {
    actions.push("ADD COLUMN other_incomes.sponsor_id");
    if (!dryRun) {
      await execute(`ALTER TABLE other_incomes ADD COLUMN sponsor_id INTEGER`);
    }
  }

  if (!dryRun) {
    await execute(`
      CREATE TABLE IF NOT EXISTS player_lifecycle_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        effective_at TEXT NOT NULL,
        actor_id INTEGER,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    await execute(
      `CREATE INDEX IF NOT EXISTS idx_lifecycle_player_effective ON player_lifecycle_events(player_id, effective_at)`
    );
    await execute(
      `CREATE INDEX IF NOT EXISTS idx_lifecycle_type_effective ON player_lifecycle_events(event_type, effective_at)`
    );

    await execute(`
      CREATE TABLE IF NOT EXISTS product_analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_uuid TEXT NOT NULL UNIQUE,
        event_name TEXT NOT NULL,
        route_key TEXT,
        content_type TEXT,
        content_id INTEGER,
        sponsor_id INTEGER,
        actor_role TEXT NOT NULL,
        actor_key_hash TEXT,
        occurred_at TEXT NOT NULL,
        metadata_json TEXT
      )
    `);
    await execute(
      `CREATE INDEX IF NOT EXISTS idx_pa_events_occurred_name ON product_analytics_events(occurred_at, event_name)`
    );
    await execute(
      `CREATE INDEX IF NOT EXISTS idx_pa_events_route ON product_analytics_events(route_key)`
    );

    await execute(`
      CREATE TABLE IF NOT EXISTS product_analytics_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_date TEXT NOT NULL,
        event_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        route_key TEXT NOT NULL DEFAULT '',
        content_type TEXT NOT NULL DEFAULT '',
        content_id INTEGER NOT NULL DEFAULT 0,
        sponsor_id INTEGER NOT NULL DEFAULT 0,
        event_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(event_date, event_name, actor_role, route_key, content_type, content_id, sponsor_id)
      )
    `);
    await execute(
      `CREATE INDEX IF NOT EXISTS idx_pa_daily_date_name ON product_analytics_daily(event_date, event_name)`
    );

    await execute(`
      CREATE TABLE IF NOT EXISTS product_analytics_monthly_actors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month_key TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        actor_key_hash TEXT NOT NULL,
        UNIQUE(month_key, actor_role, actor_key_hash)
      )
    `);

    await execute(`CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_expenses_date_match ON expenses(expense_date, match_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_other_incomes_date ON other_incomes(income_date)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_other_incomes_sponsor ON other_incomes(sponsor_id)`);
  }
  actions.push("ENSURE analytics tables and indexes");

  // Idempotent baseline lifecycle events (1 per player, only if missing)
  const players = await query(`SELECT id, status FROM players ORDER BY id ASC`);
  let existingBaselines = [];
  if (!dryRun) {
    existingBaselines = await query(
      `SELECT player_id FROM player_lifecycle_events WHERE event_type = 'baseline'`
    );
  }
  const baselinedSet = new Set(existingBaselines.map((r) => Number(r.player_id)));

  let insertedBaselines = 0;
  for (const p of players) {
    const pid = Number(p.id);
    if (baselinedSet.has(pid)) continue;
    insertedBaselines += 1;
    if (!dryRun) {
      await execute(
        `INSERT INTO player_lifecycle_events
         (player_id, event_type, from_status, to_status, effective_at, actor_id, source, created_at)
         VALUES (?, 'baseline', NULL, ?, ?, NULL, 'migration', ?)`,
        [pid, String(p.status || "Đang sinh hoạt"), nowIso, nowIso]
      );
    }
  }
  actions.push(`INSERT baseline lifecycle events: ${insertedBaselines}`);

  if (!dryRun) {
    await execute(
      `INSERT OR REPLACE INTO schema_migrations (version, applied_at, summary) VALUES (?, ?, ?)`,
      [MIGRATION_VERSION, nowIso, JSON.stringify(actions)]
    );
  }

  return {
    version: MIGRATION_VERSION,
    dryRun,
    appliedAt: nowIso,
    insertedBaselines,
    actions,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const envMode = getArg("--env");
  const sqliteArg = getArg("--sqlite");

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
    const tx = await client.transaction("write");
    try {
      const res = await runPhase4Migration({
        execute: (sql, args = []) => tx.execute({ sql, args }),
        query: async (sql, args = []) => (await tx.execute({ sql, args })).rows,
        dryRun,
      });
      if (dryRun) {
        await tx.rollback();
      } else {
        await tx.commit();
      }
      console.log(JSON.stringify({ status: "ok", target: "staging", ...res }, null, 2));
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // Ignore rollback failure
      }
      throw err;
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
  let inTx = false;
  try {
    db.exec("BEGIN IMMEDIATE;");
    inTx = true;
    const res = await runPhase4Migration({
      execute: async (sql, args = []) => {
        if (args.length === 0) db.exec(sql);
        else db.prepare(sql).run(...args);
      },
      query: async (sql, args = []) => db.prepare(sql).all(...args),
      dryRun,
    });
    if (dryRun) {
      db.exec("ROLLBACK;");
      inTx = false;
    } else {
      db.exec("COMMIT;");
      inTx = false;
    }
    console.log(JSON.stringify({ status: "ok", target: sqlitePath, ...res }, null, 2));
  } catch (err) {
    if (inTx) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // Ignore
      }
    }
    throw err;
  } finally {
    db.close();
  }
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
