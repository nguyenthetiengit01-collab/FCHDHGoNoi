#!/usr/bin/env node
/**
 * Production Cutover Restore Tooling (P103).
 *
 * Restores a validated backup v3 artifact (plaintext JSON or X25519+AES-256-GCM
 * encrypted envelope) into a fresh, empty Turso Production cutover target database.
 *
 * Safety invariants:
 * - Never accepts `--env staging` and never weakens staging allowlists.
 * - Requires explicit `TURSO_CUTOVER_TARGET_DATABASE_URL` (libsql:// only, no
 *   embedded credentials/query/fragment) and `TURSO_CUTOVER_TARGET_AUTH_TOKEN`.
 * - Rejects source Production (`fchdhgonoi.<org>`), staging, syn15d, and
 *   restore-staging hostnames, as well as any overlap with `TURSO_DATABASE_URL`,
 *   `TURSO_STAGING_DATABASE_URL`, or `TURSO_STAGING_RESTORE_DATABASE_URL`.
 * - Requires explicit allowlist match (`fchdhgonoi-prod-cutover*` or
 *   `--expected-target-host <hostname>`).
 * - Defaults to `--dry-run` (zero writes). Writes require BOTH `--apply` and
 *   `--confirm-production-cutover`.
 * - Validates backup v3 payload BEFORE touching the target database.
 * - Enforces empty-target guard (aborts if any non-system table exists; never
 *   DELETEs or DROPs from a non-empty database).
 * - Fails closed on mid-restore errors (no auto-retry on a non-empty DB).
 * - Runs post-restore integrity, foreign-key, row-count, migration, and P103
 *   schema verification without logging secrets, tokens, PINs, hashes, or PII.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { decryptEnvelopeWithPrivateKey } from "./backup-crypto.mjs";
import {
  decodeRow,
  isValidIdentifier,
  validateBackupPayload,
} from "./lib/backup-format.mjs";

export const REQUIRED_MIGRATIONS = Object.freeze([
  "phase7-p103-pin-default-v1",
  "phase7-p103-must-change-pin-v1",
]);

const DISALLOWED_HOST_PATTERNS = [/staging/i, /syn15d/i, /restore-staging/i];

function getArg(flag, argv = process.argv) {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return null;
}

function makeIfNotExistsDdl(sql, kindRegex) {
  return sql.replace(kindRegex, (match) => `${match} IF NOT EXISTS`);
}

function parseUrlHostnameSafe(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.hostname ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function isSourceProductionDb(dbName) {
  return dbName === "fchdhgonoi" || dbName.startsWith("fchdhgonoi-nguyenthetiengit01");
}

export const APPROVED_CUTOVER_TARGET_HOST =
  "fchdhgonoi-prod-cutover-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io";
export const APPROVED_CUTOVER_TARGET_DB_NAME =
  "fchdhgonoi-prod-cutover-nguyenthetiengit01-collab";

function isAllowlistedCutoverDb(hostname, dbName) {
  return (
    hostname === APPROVED_CUTOVER_TARGET_HOST &&
    dbName === APPROVED_CUTOVER_TARGET_DB_NAME
  );
}

/**
 * Validates Production cutover target URL, token, host allowlist, and isolation.
 * @param {{ url?: string; token?: string; expectedTargetHost?: string | null; disallowUrls?: Array<string | undefined> | null; env?: Record<string, string | undefined> }} [options]
 */
export function validateCutoverTarget({
  url,
  token,
  expectedTargetHost = null,
  disallowUrls = null,
  env = process.env,
} = {}) {
  const rawUrl = url !== undefined ? url : env.TURSO_CUTOVER_TARGET_DATABASE_URL;
  const rawToken =
    token !== undefined ? token : env.TURSO_CUTOVER_TARGET_AUTH_TOKEN;

  const cleanUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
  const cleanToken = typeof rawToken === "string" ? rawToken.trim() : "";

  if (!cleanUrl || !cleanToken) {
    throw new Error(
      "Preflight blocked: missing TURSO_CUTOVER_TARGET_DATABASE_URL or TURSO_CUTOVER_TARGET_AUTH_TOKEN."
    );
  }

  let parsed;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    throw new Error("Preflight blocked: invalid TURSO_CUTOVER_TARGET_DATABASE_URL format.");
  }

  if (parsed.protocol !== "libsql:") {
    throw new Error(
      `Preflight blocked: unsupported protocol "${parsed.protocol}". Cutover target must use libsql://.`
    );
  }

  if (parsed.username || parsed.password) {
    throw new Error(
      "Preflight blocked: TURSO_CUTOVER_TARGET_DATABASE_URL must not contain embedded credentials."
    );
  }

  if (parsed.search || parsed.hash) {
    throw new Error(
      "Preflight blocked: TURSO_CUTOVER_TARGET_DATABASE_URL must not contain query parameters or fragments."
    );
  }

  if (parsed.pathname && parsed.pathname !== "/") {
    throw new Error(
      "Preflight blocked: TURSO_CUTOVER_TARGET_DATABASE_URL must not contain a URL path."
    );
  }

  if (parsed.port) {
    throw new Error(
      "Preflight blocked: TURSO_CUTOVER_TARGET_DATABASE_URL must not contain an explicit port."
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new Error("Preflight blocked: TURSO_CUTOVER_TARGET_DATABASE_URL is missing hostname.");
  }
  if (!/^[a-z0-9-]+\.(?:[a-z0-9-]+\.)*turso\.io$/.test(hostname)) {
    throw new Error(
      `Preflight blocked: target hostname "${hostname}" is not a valid *.turso.io hostname.`
    );
  }

  const dbName = hostname.split(".")[0] || "";
  const safeHost = `libsql://${hostname}`;

  for (const pattern of DISALLOWED_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(
        `Preflight blocked: target hostname "${hostname}" matches disallowed staging/syn15d pattern.`
      );
    }
  }

  if (isSourceProductionDb(dbName)) {
    throw new Error(
      `Preflight blocked: database "${dbName}" is the current Production source, not an isolated cutover target.`
    );
  }

  if (!isAllowlistedCutoverDb(hostname, dbName)) {
    throw new Error(
      `Preflight blocked: target "${hostname}" is not the exact Owner-approved Production cutover host (${APPROVED_CUTOVER_TARGET_HOST}).`
    );
  }

  const disallowedList = Array.isArray(disallowUrls)
    ? disallowUrls
    : [
        env.TURSO_DATABASE_URL,
        env.TURSO_STAGING_DATABASE_URL,
        env.TURSO_STAGING_RESTORE_DATABASE_URL,
      ];

  for (const disallowed of disallowedList) {
    if (!disallowed || typeof disallowed !== "string" || !disallowed.trim()) continue;
    const disallowedHost = parseUrlHostnameSafe(disallowed);
    if (disallowedHost === hostname || disallowed.trim() === cleanUrl) {
      throw new Error(
        `Preflight blocked: TURSO_CUTOVER_TARGET_DATABASE_URL overlaps with disallowed source/staging database (${safeHost}).`
      );
    }
  }

  const cleanExpected =
    typeof expectedTargetHost === "string" && expectedTargetHost.trim()
      ? expectedTargetHost.trim().toLowerCase()
      : typeof env.TURSO_CUTOVER_EXPECTED_HOST === "string" && env.TURSO_CUTOVER_EXPECTED_HOST.trim()
        ? env.TURSO_CUTOVER_EXPECTED_HOST.trim().toLowerCase()
        : null;

  if (cleanExpected && hostname !== cleanExpected) {
    throw new Error(
      `Preflight blocked: target hostname "${hostname}" does not match --expected-target-host "${cleanExpected}".`
    );
  }

  return {
    url: cleanUrl,
    authToken: cleanToken,
    dbName,
    safeHost,
    role: "production-cutover",
  };
}

/**
 * Loads and validates a plaintext or encrypted backup v3 payload BEFORE
 * touching the target database.
 */
export function loadAndValidateCutoverBackup({ rawContent, privateKey = "" }) {
  if (typeof rawContent !== "string" || !rawContent.trim()) {
    throw new Error("Invalid backup file: content is empty.");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("Invalid backup file: content is not valid JSON.");
  }

  let backup = parsed;
  let encrypted = false;

  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    parsed.alg === "X25519-HKDF-SHA256-AES-256-GCM"
  ) {
    encrypted = true;
    const cleanPriv = typeof privateKey === "string" ? privateKey.trim() : "";
    if (!cleanPriv) {
      throw new Error(
        "Encrypted backup requires BACKUP_DECRYPTION_PRIVATE_KEY."
      );
    }
    const plaintextBuf = decryptEnvelopeWithPrivateKey(rawContent, cleanPriv);
    try {
      backup = JSON.parse(plaintextBuf.toString("utf8"));
    } catch {
      throw new Error("Decrypted backup payload is not valid JSON.");
    }
  }

  const { version } = validateBackupPayload(backup);
  if (version !== 3) {
    throw new Error(
      `Production cutover restore requires backup version 3 (received version ${version}).`
    );
  }

  return { backup, version, encrypted };
}

/**
 * Enforces empty-target guard (fail closed if any non-system table/view/index/trigger exists).
 */
export async function assertEmptyTargetDatabase(client) {
  const res = await client.execute(
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view', 'index', 'trigger') AND name NOT LIKE 'sqlite_%' ORDER BY name;"
  );
  if (res.rows.length > 0) {
    const names = res.rows.map((r) => String(r.name)).slice(0, 10).join(", ");
    throw new Error(
      `Empty-target guard blocked: target database already contains ${res.rows.length} object(s) [${names}]. Never DELETE or DROP from a non-empty database.`
    );
  }
}

async function restoreViewsWithDependencies(views, execFn) {
  let pending = [...views];
  let lastError = null;

  while (pending.length > 0) {
    const nextPending = [];
    let progress = 0;

    for (const view of pending) {
      try {
        const safeSql = makeIfNotExistsDdl(
          view.sql,
          /^CREATE\s+VIEW\b(?!\s+IF\s+NOT\s+EXISTS)/i
        );
        await execFn(safeSql);
        progress += 1;
      } catch (err) {
        lastError = err;
        nextPending.push(view);
      }
    }

    if (progress === 0 && nextPending.length > 0) {
      const failingNames = nextPending.map((v) => v.name).join(", ");
      const reason =
        lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(
        `Failed to create view(s) [${failingNames}]: ${reason}. Fail closed: provision a fresh empty target database before retrying.`
      );
    }
    pending = nextPending;
  }
}

/**
 * Verifies post-restore integrity, foreign keys, row counts, migrations,
 * and P103 players schema requirements.
 */
export async function verifyCutoverTargetDatabase(client, backup) {
  const actualRowCounts = {};
  for (const [tableName, expectedCount] of Object.entries(backup.rowCounts || {})) {
    if (!isValidIdentifier(tableName)) {
      throw new Error(`Verification failed: unsafe table name "${tableName}".`);
    }
    const countRes = await client.execute(
      `SELECT COUNT(*) AS cnt FROM "${tableName}";`
    );
    const actualCount = Number(countRes.rows[0]?.cnt ?? -1);
    if (actualCount !== expectedCount) {
      throw new Error(
        `Verification failed: row count mismatch on "${tableName}" (expected ${expectedCount}, actual ${actualCount}).`
      );
    }
    actualRowCounts[tableName] = actualCount;
  }

  const migTableRes = await client.execute(
    "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations' LIMIT 1;"
  );
  if (migTableRes.rows.length === 0) {
    throw new Error("Verification failed: schema_migrations table is missing.");
  }

  const migRes = await client.execute("SELECT version FROM schema_migrations;");
  const appliedMigrations = new Set(migRes.rows.map((r) => String(r.version)));
  for (const required of REQUIRED_MIGRATIONS) {
    if (!appliedMigrations.has(required)) {
      throw new Error(
        `Verification failed: schema_migrations is missing required migration "${required}".`
      );
    }
  }

  const playersTblRes = await client.execute(
    "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'players' LIMIT 1;"
  );
  if (playersTblRes.rows.length === 0) {
    throw new Error("Verification failed: players table is missing.");
  }

  const colsRes = await client.execute("PRAGMA table_info(players);");
  const pinCol = colsRes.rows.find((c) => String(c.name) === "pin_code");
  if (!pinCol) {
    throw new Error("Verification failed: players.pin_code column is missing.");
  }
  const pinDefault = pinCol.dflt_value === null || pinCol.dflt_value === undefined
    ? null
    : String(pinCol.dflt_value).trim();
  if (pinDefault === "'1234'" || pinDefault === "1234") {
    throw new Error(
      "Verification failed: players.pin_code default must NOT be '1234'."
    );
  }

  const mustChangeCol = colsRes.rows.find(
    (c) => String(c.name) === "must_change_pin"
  );
  if (!mustChangeCol) {
    throw new Error(
      "Verification failed: players.must_change_pin column is missing."
    );
  }
  if (String(mustChangeCol.type || "").toUpperCase() !== "INTEGER") {
    throw new Error(
      `Verification failed: players.must_change_pin type must be INTEGER (got "${String(mustChangeCol.type)}").`
    );
  }
  if (Number(mustChangeCol.notnull) !== 1) {
    throw new Error(
      `Verification failed: players.must_change_pin notnull must be 1 (got ${String(mustChangeCol.notnull)}).`
    );
  }
  const mustChangeDefault =
    mustChangeCol.dflt_value === null || mustChangeCol.dflt_value === undefined
      ? null
      : String(mustChangeCol.dflt_value).trim();
  if (mustChangeDefault !== "0") {
    throw new Error(
      `Verification failed: players.must_change_pin default must be '0' (got ${String(mustChangeDefault)}).`
    );
  }

  const integrityRes = await client.execute("PRAGMA integrity_check;");
  const integrityVal =
    integrityRes.rows.length === 1
      ? String(Object.values(integrityRes.rows[0])[0]).toLowerCase()
      : "";
  if (integrityVal !== "ok") {
    throw new Error(
      `Verification failed: PRAGMA integrity_check did not return 'ok'.`
    );
  }

  const fkRes = await client.execute("PRAGMA foreign_key_check;");
  if (fkRes.rows.length > 0) {
    throw new Error(
      `Verification failed: PRAGMA foreign_key_check reported ${fkRes.rows.length} violation(s).`
    );
  }

  return {
    rowCounts: actualRowCounts,
    migrationsVerified: [...REQUIRED_MIGRATIONS],
    playersSchemaVerified: true,
    integrityCheck: "ok",
    foreignKeyViolations: 0,
  };
}

/**
 * Executes dry-run or live Production cutover restore against a libSQL-compatible client.
 */
export async function runCutoverRestore({
  client,
  backup,
  preflight,
  dryRun = true,
  encrypted = false,
}) {
  await assertEmptyTargetDatabase(client);

  const tableDefs = backup.objects.tables.map((t) => ({
    name: t.name,
    sql: t.sql,
  }));

  if (dryRun) {
    return {
      status: "dry_run_ok",
      mode: "production-cutover-restore",
      dryRun: true,
      encrypted,
      targetHost: preflight.safeHost,
      dbName: preflight.dbName,
      targetEmpty: true,
      backupVersion: 3,
      plannedObjects: {
        tables: tableDefs.length,
        indexes: backup.objects.indexes.length,
        views: backup.objects.views.length,
        triggers: backup.objects.triggers.length,
      },
      plannedRowCounts: { ...backup.rowCounts },
    };
  }

  const restoredCounts = {};
  const schemaMap = Object.fromEntries(tableDefs.map((t) => [t.name, t.sql]));

  await client.execute("PRAGMA foreign_keys = OFF;");

  // 1. Create tables
  for (const { name, sql } of tableDefs) {
    try {
      const safeDdl = makeIfNotExistsDdl(
        sql,
        /^CREATE\s+TABLE\b(?!\s+IF\s+NOT\s+EXISTS)/i
      );
      await client.execute(safeDdl);
    } catch (err) {
      throw new Error(
        `Failed creating table "${name}": ${err instanceof Error ? err.message : String(err)}. Fail closed: provision a fresh empty target database before retrying.`
      );
    }
  }

  // 2. Restore row data (before triggers are created)
  for (const [tableName, rows] of Object.entries(backup.tables)) {
    if (!isValidIdentifier(tableName) || !Array.isArray(rows)) continue;

    if (!schemaMap[tableName] && rows.length > 0) {
      const fallbackCols = Object.keys(rows[0])
        .filter((c) => isValidIdentifier(c))
        .map((c) => `"${c}" TEXT`)
        .join(", ");
      if (fallbackCols) {
        await client.execute(
          `CREATE TABLE IF NOT EXISTS "${tableName}" (${fallbackCols});`
        );
      }
    }

    if (rows.length === 0) {
      restoredCounts[tableName] = 0;
      continue;
    }

    const decodedRows = rows.map((r) => decodeRow(r));
    const cols = Object.keys(decodedRows[0]).filter((c) => isValidIdentifier(c));
    if (cols.length === 0) {
      restoredCounts[tableName] = 0;
      continue;
    }

    const placeholders = cols.map(() => "?").join(", ");
    const insertSql = `INSERT INTO "${tableName}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders});`;

    for (const row of decodedRows) {
      try {
        await client.execute({
          sql: insertSql,
          args: cols.map((c) => (row[c] === undefined ? null : row[c])),
        });
      } catch (err) {
        throw new Error(
          `Failed inserting row into table "${tableName}": ${err instanceof Error ? err.message : String(err)}. Fail closed: provision a fresh empty target database before retrying.`
        );
      }
    }
    restoredCounts[tableName] = decodedRows.length;
  }

  const objectCounts = {
    tables: tableDefs.length,
    indexes: 0,
    views: 0,
    triggers: 0,
  };

  // 3. Create indexes
  for (const idx of backup.objects.indexes) {
    try {
      const safeSql = makeIfNotExistsDdl(
        idx.sql,
        /^CREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+IF\s+NOT\s+EXISTS)/i
      );
      await client.execute(safeSql);
      objectCounts.indexes += 1;
    } catch (err) {
      throw new Error(
        `Failed creating index "${idx.name}": ${err instanceof Error ? err.message : String(err)}. Fail closed: provision a fresh empty target database before retrying.`
      );
    }
  }

  // 4. Create views in dependency order
  await restoreViewsWithDependencies(backup.objects.views, (sql) =>
    client.execute(sql)
  );
  objectCounts.views = backup.objects.views.length;

  // 5. Create triggers AFTER historical data is restored
  for (const trg of backup.objects.triggers) {
    try {
      const safeSql = makeIfNotExistsDdl(
        trg.sql,
        /^CREATE\s+TRIGGER\b(?!\s+IF\s+NOT\s+EXISTS)/i
      );
      await client.execute(safeSql);
      objectCounts.triggers += 1;
    } catch (err) {
      throw new Error(
        `Failed creating trigger "${trg.name}": ${err instanceof Error ? err.message : String(err)}. Fail closed: provision a fresh empty target database before retrying.`
      );
    }
  }

  // 6. Restore sqlite_sequence for AUTOINCREMENT tables
  if (Array.isArray(backup.sequences) && backup.sequences.length > 0) {
    for (const seqEntry of backup.sequences) {
      if (!isValidIdentifier(seqEntry.name)) continue;
      try {
        await client.execute({
          sql: `INSERT INTO sqlite_sequence (name, seq) VALUES (?, MAX(?, COALESCE((SELECT MAX(rowid) FROM "${seqEntry.name}"), 0)));`,
          args: [seqEntry.name, seqEntry.seq],
        });
      } catch (err) {
        throw new Error(
          `Failed restoring sqlite_sequence for "${seqEntry.name}": ${err instanceof Error ? err.message : String(err)}. Fail closed: provision a fresh empty target database before retrying.`
        );
      }
    }
  }

  await client.execute("PRAGMA foreign_keys = ON;");

  const verification = await verifyCutoverTargetDatabase(client, backup);

  return {
    status: "ok",
    mode: "production-cutover-restore",
    dryRun: false,
    encrypted,
    targetHost: preflight.safeHost,
    dbName: preflight.dbName,
    backupVersion: 3,
    objectCounts,
    restoredCounts,
    verification,
  };
}

/**
 * Parses CLI flags and enforces Production cutover safety rules.
 */
export function parseCutoverCliArgs(argv = process.argv) {
  const envEqFlag = argv.find((arg) => typeof arg === "string" && arg.startsWith("--env="));
  const envFlag = getArg("--env", argv) ?? (envEqFlag ? envEqFlag.slice("--env=".length) : null);
  if (envFlag !== null) {
    throw new Error(
      `Unsupported --env "${envFlag}": p103-cutover-restore never uses --env staging or env switching.`
    );
  }

  const inPath = getArg("--in", argv);
  if (!inPath) {
    throw new Error(
      "Usage: node scripts/p103-cutover-restore.mjs --in <backup-v3.json(.enc)> [--expected-target-host <hostname>] [--dry-run | --apply --confirm-production-cutover]"
    );
  }

  const expectedTargetHost = getArg("--expected-target-host", argv);
  const hasApply = argv.includes("--apply");
  const hasConfirm = argv.includes("--confirm-production-cutover");
  const hasDryRun = argv.includes("--dry-run");

  if (hasApply && hasDryRun) {
    throw new Error("Invalid flags: cannot combine --apply with --dry-run.");
  }

  if (hasApply && !hasConfirm) {
    throw new Error(
      "Confirmation required: --apply requires --confirm-production-cutover for Production writes."
    );
  }

  const dryRun = !hasApply;

  return {
    inPath,
    expectedTargetHost,
    dryRun,
    confirmed: hasConfirm,
  };
}

async function main() {
  const { inPath, expectedTargetHost, dryRun } = parseCutoverCliArgs(process.argv);

  const preflight = validateCutoverTarget({
    expectedTargetHost,
    env: process.env,
  });

  const resolvedIn = path.resolve(inPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Backup file not found: ${resolvedIn}`);
  }

  const rawContent = fs.readFileSync(resolvedIn, "utf8");
  const { backup, encrypted } = loadAndValidateCutoverBackup({
    rawContent,
    privateKey: process.env.BACKUP_DECRYPTION_PRIVATE_KEY,
  });

  const client = createClient({
    url: preflight.url,
    authToken: preflight.authToken,
  });

  try {
    const report = await runCutoverRestore({
      client,
      backup,
      preflight,
      dryRun,
      encrypted,
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    client.close();
  }
}

const isEntrypoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
