#!/usr/bin/env node
/**
 * Standalone, idempotent migration (v1) for `players.must_change_pin`.
 * Defaults to --dry-run. Applying requires explicit --apply and an explicit target
 * (--sqlite <isolated-path> or --env staging). Never targets Production or repo-local DBs.
 *
 * Usage:
 *   node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --sqlite <isolated-path> [--dry-run | --apply]
 *   node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --env staging [--dry-run | --apply]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { validateStagingTarget } from "../lib/turso-preflight.mjs";

export const MIGRATION_VERSION = "phase7-p103-must-change-pin-v1";
export const PLANNED_DDL =
  "ALTER TABLE players ADD COLUMN must_change_pin INTEGER NOT NULL DEFAULT 0;";

function getArg(flag, argv = process.argv) {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return null;
}

export function validateLocalSqlitePath(
  sqlitePath,
  repoRoot = process.cwd(),
  tmpRoot = os.tmpdir()
) {
  if (!sqlitePath || typeof sqlitePath !== "string" || !sqlitePath.trim()) {
    throw new Error("Local SQLite safety guard: missing --sqlite path.");
  }

  const resolved = path.resolve(sqlitePath.trim());
  const resolvedRoot = path.resolve(repoRoot);
  const realRoot = fs.existsSync(resolvedRoot)
    ? fs.realpathSync(resolvedRoot)
    : resolvedRoot;
  const resolvedTmp = path.resolve(tmpRoot);
  const realTmp = fs.existsSync(resolvedTmp)
    ? fs.realpathSync(resolvedTmp)
    : resolvedTmp;

  const isInsideDir = (targetPath, dirPath) => {
    const normTarget = process.platform === "win32" ? targetPath.toLowerCase() : targetPath;
    const normDir = process.platform === "win32" ? dirPath.toLowerCase() : dirPath;
    return normTarget.startsWith(`${normDir}${path.sep}`);
  };

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

    if (!isInsideDir(candidatePath, resolvedTmp) && !isInsideDir(candidatePath, realTmp)) {
      throw new Error(
        `Local SQLite safety guard: --sqlite target must reside inside the OS temporary directory (${label}).`
      );
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

function normalizeDefaultValue(dfltValue) {
  if (dfltValue === null || dfltValue === undefined) return null;
  let normalized = String(dfltValue).trim();
  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    const inner = normalized.slice(1, -1).trim();
    if (!inner) break;
    normalized = inner;
  }
  return normalized;
}

export function inspectMustChangePinColumn(tableInfoRows) {
  const col = tableInfoRows.find((r) => String(r?.name || "") === "must_change_pin");
  if (!col) {
    return { present: false, compatible: false, reason: "missing" };
  }

  const colType = String(col.type || "").trim().toUpperCase();
  const notNull = Number(col.notnull || 0) === 1;
  const dflt = normalizeDefaultValue(col.dflt_value);

  const typeOk = colType === "INTEGER" || colType === "INT";
  const defaultOk = dflt === "0";

  if (!typeOk || !notNull || !defaultOk) {
    return {
      present: true,
      compatible: false,
      reason: `Incompatible must_change_pin column definition (type="${colType}", notnull=${col.notnull}, default=${String(col.dflt_value)})`,
    };
  }

  return { present: true, compatible: true, reason: "ok" };
}

function isDuplicateColumnError(err) {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("duplicate column") || msg.includes("already exists");
}

async function readPlayersSchema(query) {
  const tables = await query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'players' LIMIT 1"
  );
  if (!Array.isArray(tables) || tables.length === 0) {
    throw new Error("Preflight failed: players table does not exist.");
  }
  const cols = await query("PRAGMA table_info(players)");
  return inspectMustChangePinColumn(cols);
}

export async function runMustChangePinMigration({
  execute,
  query,
  withTransaction,
  dryRun = true,
}) {
  if (typeof query !== "function") {
    throw new Error("Migration requires a query(sql, params) function.");
  }

  const before = await readPlayersSchema(query);
  if (before.present && !before.compatible) {
    throw new Error(`Migration aborted (fail-closed): ${before.reason}`);
  }

  if (before.present && before.compatible) {
    return {
      version: MIGRATION_VERSION,
      dryRun,
      status: "already_applied",
      applied: false,
      plannedDdl: null,
      verified: true,
    };
  }

  if (dryRun) {
    return {
      version: MIGRATION_VERSION,
      dryRun: true,
      status: "planned",
      applied: false,
      plannedDdl: PLANNED_DDL,
      verified: false,
    };
  }

  if (typeof execute !== "function") {
    throw new Error("Migration apply requires an execute(sql, params) function.");
  }
  if (typeof withTransaction !== "function") {
    throw new Error(
      "Migration apply requires withTransaction (fail-closed: non-transactional apply is forbidden)."
    );
  }

  let racedDuplicate = false;
  await withTransaction(async (tx) => {
    if (!tx || typeof tx.execute !== "function" || typeof tx.query !== "function") {
      throw new Error(
        "Transaction context must provide both execute() and query()."
      );
    }

    const inTxBefore = await readPlayersSchema(tx.query);
    if (inTxBefore.present) {
      if (!inTxBefore.compatible) {
        throw new Error(`Migration aborted (fail-closed): ${inTxBefore.reason}`);
      }
      racedDuplicate = true;
      return;
    }

    try {
      await tx.execute(PLANNED_DDL);
    } catch (err) {
      if (!isDuplicateColumnError(err)) {
        throw err;
      }
      racedDuplicate = true;
    }

    const inTxAfter = await readPlayersSchema(tx.query);
    if (!inTxAfter.present || !inTxAfter.compatible) {
      throw new Error(
        `Post-migration schema verification failed inside transaction: ${inTxAfter.reason}`
      );
    }
  });

  const finalCheck = await readPlayersSchema(query);
  if (!finalCheck.present || !finalCheck.compatible) {
    throw new Error(
      `Post-migration schema verification failed: ${finalCheck.reason}`
    );
  }

  return {
    version: MIGRATION_VERSION,
    dryRun: false,
    status: racedDuplicate ? "already_applied" : "applied",
    applied: !racedDuplicate,
    plannedDdl: racedDuplicate ? null : PLANNED_DDL,
    verified: true,
  };
}

export function createLocalSqliteTransactionRunner(db) {
  return async (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      await fn({
        execute: async (sql, params = []) => {
          db.prepare(sql).run(...params);
        },
        query: async (sql, params = []) => db.prepare(sql).all(...params),
      });
      db.exec("COMMIT");
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  };
}

export async function runStagingMigration({ dryRun = true } = {}) {
  const stagingUrl = process.env.TURSO_STAGING_DATABASE_URL?.trim() || "";
  const stagingToken = process.env.TURSO_STAGING_AUTH_TOKEN?.trim() || "";
  const target = validateStagingTarget({
    url: stagingUrl,
    token: stagingToken,
    envUrlName: "TURSO_STAGING_DATABASE_URL",
    envTokenName: "TURSO_STAGING_AUTH_TOKEN",
    role: "source",
    disallowUrls: [
      process.env.TURSO_DATABASE_URL,
      process.env.TURSO_PROD_DATABASE_URL,
      process.env.TURSO_STAGING_RESTORE_DATABASE_URL,
    ],
  });

  const client = createClient({
    url: stagingUrl,
    authToken: stagingToken,
  });

  try {
    const result = await runMustChangePinMigration({
      execute: async (sql, params = []) => {
        await client.execute({ sql, args: params });
      },
      query: async (sql, params = []) => {
        const res = await client.execute({ sql, args: params });
        return res.rows.map((r) => ({ ...r }));
      },
      withTransaction:
        typeof client.transaction === "function"
          ? async (fn) => {
              const tx = await client.transaction("write");
              try {
                await fn({
                  execute: async (sql, params = []) => {
                    await tx.execute({ sql, args: params });
                  },
                  query: async (sql, params = []) => {
                    const res = await tx.execute({ sql, args: params });
                    return res.rows.map((r) => ({ ...r }));
                  },
                });
                await tx.commit();
              } catch (err) {
                try {
                  await tx.rollback();
                } catch {
                  // ignore rollback error
                }
                throw err;
              } finally {
                tx.close();
              }
            }
          : undefined,
      dryRun,
    });

    return {
      ...result,
      target: {
        dbName: target.dbName,
        safeHost: target.safeHost,
        role: target.role,
      },
    };
  } finally {
    client.close();
  }
}

async function main() {
  const hasDryRun = process.argv.includes("--dry-run");
  const hasApply = process.argv.includes("--apply");
  if (hasDryRun && hasApply) {
    throw new Error("Cannot pass both --dry-run and --apply.");
  }
  const dryRun = !hasApply;

  const sqlitePath = getArg("--sqlite");
  const envTarget = getArg("--env");

  if (sqlitePath && envTarget) {
    throw new Error("Cannot combine --sqlite and --env targets in a single invocation.");
  }

  if (envTarget && envTarget !== "staging") {
    throw new Error(
      `Refusing unsupported target --env "${envTarget}". Only --env staging or --sqlite <temp-path> is allowed.`
    );
  }

  if (!sqlitePath && envTarget !== "staging") {
    throw new Error(
      "Explicit target required. Usage: node scripts/migrations/phase7-p103-must-change-pin-v1.mjs --sqlite <isolated-temp-path> | --env staging [--dry-run | --apply]"
    );
  }

  if (sqlitePath) {
    const { DatabaseSync } = await import("node:sqlite");
    const resolved = validateLocalSqlitePath(sqlitePath);
    const db = new DatabaseSync(resolved);
    try {
      const result = await runMustChangePinMigration({
        execute: async (sql, params = []) => {
          db.prepare(sql).run(...params);
        },
        query: async (sql, params = []) => db.prepare(sql).all(...params),
        withTransaction: createLocalSqliteTransactionRunner(db),
        dryRun,
      });
      console.log(JSON.stringify(result, null, 2));
    } finally {
      db.close();
    }
    return;
  }

  const result = await runStagingMigration({ dryRun });
  console.log(JSON.stringify(result, null, 2));
}

const isEntrypoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error("Migration failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
