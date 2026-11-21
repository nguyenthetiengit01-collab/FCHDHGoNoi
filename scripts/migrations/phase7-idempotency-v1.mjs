#!/usr/bin/env node
/**
 * Idempotent Phase 7.1.4 Batch Fee Idempotency Migration (v1).
 * Authoritative schema migration for `idempotency_keys` on isolated local SQLite
 * (`--sqlite`) or authorized Staging (`--env staging`) ONLY.
 * No Production target is supported by this script; Production schema preparation
 * requires a separate Owner/Operator-authorized DDL procedure.
 *
 * Usage:
 *   node scripts/migrations/phase7-idempotency-v1.mjs --sqlite <isolated-temp-path.sqlite> [--dry-run]
 *   node scripts/migrations/phase7-idempotency-v1.mjs --env staging [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { validateStagingTarget } from "../lib/turso-preflight.mjs";

export const MIGRATION_VERSION = "phase7-idempotency-v1";

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
          `Local SQLite safety guard: refusing to target a database inside the repository directory (${label}). Use an isolated path outside the repo (e.g. os.tmpdir()).`
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

const REQUIRED_IDEMPOTENCY_COLUMNS = [
  "idempotency_key",
  "actor_id",
  "action",
  "payload_hash",
  "status_code",
  "response_json",
  "created_at",
  "expires_at",
];
const REQUIRED_IDEMPOTENCY_PK = ["idempotency_key", "actor_id", "action"];

export async function verifyIdempotencySchemaContract(
  query,
  { requireTable = true, requireIndex = true } = {}
) {
  const existingObjects = await query(
    `SELECT type, name FROM sqlite_master
     WHERE (type = 'table' AND name = 'idempotency_keys')
        OR (type = 'index' AND name = 'idx_idempotency_expires_at')`
  );
  const hasTable = existingObjects.some(
    (r) => String(r.type) === "table" && String(r.name) === "idempotency_keys"
  );
  const hasIndex = existingObjects.some(
    (r) => String(r.type) === "index" && String(r.name) === "idx_idempotency_expires_at"
  );

  const violations = [];
  if (requireTable && !hasTable) {
    violations.push("missing table:idempotency_keys");
  }
  if (requireIndex && !hasIndex) {
    violations.push("missing index:idx_idempotency_expires_at");
  }

  if (hasTable) {
    const cols = await query(`PRAGMA table_info(idempotency_keys)`);
    const colNames = new Set(cols.map((c) => String(c.name)));
    for (const reqCol of REQUIRED_IDEMPOTENCY_COLUMNS) {
      if (!colNames.has(reqCol)) {
        violations.push(`missing column:idempotency_keys.${reqCol}`);
      }
    }
    const pkCols = cols
      .filter((c) => Number(c.pk) > 0)
      .sort((a, b) => Number(a.pk) - Number(b.pk))
      .map((c) => String(c.name));
    const pkMatches =
      pkCols.length === REQUIRED_IDEMPOTENCY_PK.length &&
      REQUIRED_IDEMPOTENCY_PK.every((col, idx) => pkCols[idx] === col);
    if (!pkMatches) {
      violations.push(
        `invalid primary key on idempotency_keys: expected (${REQUIRED_IDEMPOTENCY_PK.join(", ")}), got (${pkCols.join(", ") || "none"})`
      );
    }
  }

  if (hasTable && hasIndex) {
    const idxList = await query(`PRAGMA index_list(idempotency_keys)`);
    const attached = idxList.some(
      (idx) => String(idx.name) === "idx_idempotency_expires_at"
    );
    if (!attached) {
      violations.push(
        "invalid index: idx_idempotency_expires_at is not attached to idempotency_keys"
      );
    } else {
      const idxInfo = await query(`PRAGMA index_info('idx_idempotency_expires_at')`);
      const orderedCols = [...idxInfo]
        .sort((a, b) => Number(a.seqno) - Number(b.seqno))
        .map((c) => String(c.name));
      if (orderedCols.length !== 1 || orderedCols[0] !== "expires_at") {
        violations.push(
          `invalid index columns on idx_idempotency_expires_at: expected (expires_at), got (${orderedCols.join(", ") || "none"})`
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Idempotency schema contract violation: ${violations.join("; ")}`
    );
  }
}

export async function runPhase7IdempotencyMigration({
  execute,
  query,
  withTransaction = undefined,
  now = new Date(),
  dryRun = false,
}) {
  const nowIso = now.toISOString();
  const actions = [];

  const existingObjects = await query(
    `SELECT type, name FROM sqlite_master
     WHERE (type = 'table' AND name IN ('schema_migrations', 'idempotency_keys'))
        OR (type = 'index' AND name = 'idx_idempotency_expires_at')`
  );
  const hasMigrationsTable = existingObjects.some(
    (r) => r.type === "table" && r.name === "schema_migrations"
  );
  const hasIdempotencyTable = existingObjects.some(
    (r) => r.type === "table" && r.name === "idempotency_keys"
  );
  const hasExpiresIndex = existingObjects.some(
    (r) => r.type === "index" && r.name === "idx_idempotency_expires_at"
  );

  // Preflight: validate existing idempotency table/index contract when already present
  if (hasIdempotencyTable || hasExpiresIndex) {
    await verifyIdempotencySchemaContract(query, {
      requireTable: false,
      requireIndex: false,
    });
  }

  let alreadyRecorded = false;
  if (hasMigrationsTable) {
    const rows = await query(
      `SELECT version FROM schema_migrations WHERE version = ? LIMIT 1`,
      [MIGRATION_VERSION]
    );
    alreadyRecorded = rows.length > 0;
  }

  if (!hasMigrationsTable) {
    actions.push("CREATE TABLE schema_migrations");
  }
  if (!hasIdempotencyTable) {
    actions.push("CREATE TABLE idempotency_keys");
  }
  if (!hasExpiresIndex) {
    actions.push("CREATE INDEX idx_idempotency_expires_at");
  }
  if (!alreadyRecorded) {
    actions.push(`RECORD MIGRATION ${MIGRATION_VERSION}`);
  }

  if (dryRun) {
    return {
      version: MIGRATION_VERSION,
      dryRun: true,
      applied: false,
      actions,
    };
  }

  const runApply = async (execFn) => {
    if (!hasMigrationsTable) {
      await execFn(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL,
          summary TEXT
        )
      `);
    }

    if (!hasIdempotencyTable) {
      await execFn(`
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

    if (!hasExpiresIndex) {
      await execFn(
        `CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_keys(expires_at)`
      );
    }

    if (!alreadyRecorded) {
      await execFn(
        `INSERT OR REPLACE INTO schema_migrations (version, applied_at, summary) VALUES (?, ?, ?)`,
        [
          MIGRATION_VERSION,
          nowIso,
          actions.join("; ") || "No-op already up to date",
        ]
      );
    }
  };

  if (typeof withTransaction === "function") {
    await withTransaction(runApply);
  } else {
    await runApply(execute);
  }

  await verifyIdempotencySchemaContract(query, {
    requireTable: true,
    requireIndex: true,
  });

  return {
    version: MIGRATION_VERSION,
    dryRun: false,
    applied: actions.length > 0,
    actions,
  };
}

export async function runStagingMigration({
  env = process.env,
  dryRun = false,
  clientFactory = createClient,
} = {}) {
  const stagingUrl =
    typeof env.TURSO_STAGING_DATABASE_URL === "string"
      ? env.TURSO_STAGING_DATABASE_URL.trim()
      : "";
  const stagingToken =
    typeof env.TURSO_STAGING_AUTH_TOKEN === "string"
      ? env.TURSO_STAGING_AUTH_TOKEN.trim()
      : "";

  const disallowUrls = [];
  if (typeof env.TURSO_DATABASE_URL === "string" && env.TURSO_DATABASE_URL.trim()) {
    disallowUrls.push(env.TURSO_DATABASE_URL.trim());
  }

  const target = validateStagingTarget({
    url: stagingUrl,
    token: stagingToken,
    envUrlName: "TURSO_STAGING_DATABASE_URL",
    envTokenName: "TURSO_STAGING_AUTH_TOKEN",
    role: "source",
    disallowUrls,
  });

  const client = clientFactory({
    url: stagingUrl,
    authToken: stagingToken,
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
      withTransaction:
        typeof client.transaction === "function"
          ? async (fn) => {
              const tx = await client.transaction("write");
              try {
                await fn(async (sql, params = []) => {
                  await tx.execute({ sql, args: params });
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
  const dryRun = process.argv.includes("--dry-run");
  const sqlitePath = getArg("--sqlite");
  const envTarget = getArg("--env");

  if (!sqlitePath && envTarget !== "staging") {
    console.error(
      "Usage: node scripts/migrations/phase7-idempotency-v1.mjs --sqlite <isolated-path> | --env staging [--dry-run]"
    );
    process.exit(1);
  }

  if (sqlitePath) {
    const { DatabaseSync } = await import("node:sqlite");
    const resolved = validateLocalSqlitePath(sqlitePath);
    const db = new DatabaseSync(resolved);
    try {
      const result = await runPhase7IdempotencyMigration({
        execute: async (sql, params = []) => {
          db.prepare(sql).run(...params);
        },
        query: async (sql, params = []) => db.prepare(sql).all(...params),
        withTransaction: async (fn) => {
          db.exec("BEGIN IMMEDIATE");
          try {
            await fn(async (sql, params = []) => {
              db.prepare(sql).run(...params);
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
        },
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

if (
  import.meta.url ===
  new URL(process.argv[1] ? `file:///${process.argv[1].replace(/\\/g, "/")}` : "", "file:///").href
) {
  main().catch((err) => {
    console.error("Migration failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
