#!/usr/bin/env node
/**
 * Controlled bulk PIN reset for all authenticated accounts in the isolated
 * Turso Staging database (fchdhgonoi-staging-nguyenthetiengit01-collab).
 *
 * Defaults to --dry-run. Applying requires explicit --apply, --env staging,
 * --approval-ref <ref>, and an interactive local TTY.
 *
 * Never targets Production, Restore, unknown DBs, or local SQLite.
 * Never prints or persists plaintext passwords or scrypt hashes in dry-run,
 * JSON output, files, or audit logs.
 */
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { extractTursoDbName } from "./lib/turso-preflight.mjs";
import {
  APPROVAL_REF_PATTERN,
  EXACT_STAGING_DB_NAME,
  RECOVERY_ACTOR_ID,
  RECOVERY_ACTOR_NAME,
  RECOVERY_ACTOR_ROLE,
  assertInteractiveLocalTerminal,
  ensureAuditLogsSchema,
  hashPassword,
  normalizeLoginString,
  parseApprovalRefFromSummary,
  validatePasswordStrength,
  verifyAuditLogsSchema,
} from "./p103-staging-manager-recovery.mjs";

export const EXACT_STAGING_HOSTNAME =
  "fchdhgonoi-staging-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io";
export const BULK_RESET_ACTION = "operator_bulk_pin_reset";

export function validateExactStagingBulkTarget({
  url,
  token,
  envUrlName = "TURSO_STAGING_DATABASE_URL",
  envTokenName = "TURSO_STAGING_AUTH_TOKEN",
}) {
  const cleanUrl = typeof url === "string" ? url.trim() : "";
  const cleanToken = typeof token === "string" ? token.trim() : "";

  if (!cleanUrl || !cleanToken) {
    throw new Error(
      `Preflight blocked: missing ${envUrlName} or ${envTokenName}. Refusing to fall back to Production (TURSO_DATABASE_URL) or local SQLite.`
    );
  }

  const { dbName, safeHost } = extractTursoDbName(cleanUrl);
  const parsedHostname = new URL(cleanUrl).hostname.toLowerCase();

  if (dbName === "fchdhgonoi" || dbName.startsWith("fchdhgonoi-nguyenthetiengit01")) {
    throw new Error(
      `Preflight blocked: database "${dbName}" appears to be Production. Refusing bulk reset.`
    );
  }

  if (dbName.includes("restore") || dbName.includes("drill")) {
    throw new Error(
      `Preflight blocked: database "${dbName}" appears to be a restore/drill database. Exact Staging DB required.`
    );
  }

  if (
    dbName !== EXACT_STAGING_DB_NAME ||
    parsedHostname !== EXACT_STAGING_HOSTNAME
  ) {
    throw new Error(
      `Preflight blocked: hostname "${parsedHostname}" does not match exact approved Staging hostname (${EXACT_STAGING_HOSTNAME}).`
    );
  }

  return {
    dbName,
    hostname: parsedHostname,
    safeHost,
    url: cleanUrl,
    token: cleanToken,
  };
}

export function generateTwelveRandomDigits() {
  let digits = "";
  for (let i = 0; i < 12; i++) {
    digits += String(crypto.randomInt(0, 10));
  }
  return digits;
}

export function generateBulkTemporaryPassword(account, usedPasswords) {
  const rawIdentifier = String(
    account.username || account.short_name || account.full_name || ""
  ).trim();
  const normalizedLoginName = normalizeLoginString(rawIdentifier);
  if (!normalizedLoginName) {
    throw new Error(
      `Account id=${account.id} has no valid normalized login identifier.`
    );
  }

  for (let attempt = 0; attempt < 16; attempt++) {
    const candidate = `${normalizedLoginName}@${generateTwelveRandomDigits()}`;
    if (usedPasswords.has(candidate)) continue;
    const strength = validatePasswordStrength(candidate, rawIdentifier);
    if (!strength.valid) {
      throw new Error(
        `Generated password for account id=${account.id} failed strength policy: ${strength.error}`
      );
    }
    usedPasswords.add(candidate);
    return {
      identifier: rawIdentifier,
      normalizedLoginName,
      temporaryPassword: candidate,
    };
  }

  throw new Error(
    `Failed to generate a unique temporary password for account id=${account.id}.`
  );
}

function getArg(flag, argv = process.argv) {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return null;
}

/**
 * @param {{
 *   client: any;
 *   targetInfo: { dbName: string; hostname?: string; safeHost: string };
 *   apply?: boolean;
 *   approvalRef?: string | null;
 *   env?: Record<string, string | undefined>;
 *   io?: { stdinIsTTY?: boolean; stdoutIsTTY?: boolean };
 *   onCredentialsHandoff?: (entries: Array<{ identifier: string; accessRole: string; status: string; temporaryPassword: string }>) => void;
 * }} params
 */
export async function runStagingBulkPinReset({
  client,
  targetInfo,
  apply = false,
  approvalRef = null,
  env = process.env,
  io = {},
  onCredentialsHandoff = undefined,
}) {
  if (apply) {
    assertInteractiveLocalTerminal(env, io);
    const cleanApproval = typeof approvalRef === "string" ? approvalRef.trim() : "";
    if (!cleanApproval || cleanApproval.length > 64 || !APPROVAL_REF_PATTERN.test(cleanApproval)) {
      throw new Error(
        "Approval guard blocked: --apply requires a structured Owner-approved --approval-ref (e.g. OWNER-..., STG-..., P103-..., INC-..., CHG-...)."
      );
    }
  }

  const playerColsRes = await client.execute("PRAGMA table_info(players)");
  const hasMustChangePin = (playerColsRes.rows || []).some(
    (col) => col.name === "must_change_pin"
  );
  if (!hasMustChangePin) {
    throw new Error(
      "Schema guard blocked: players.must_change_pin column is missing."
    );
  }

  const auditExistsRes = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_logs' LIMIT 1"
  );
  const auditTableExists = (auditExistsRes.rows || []).length > 0;
  if (auditTableExists) {
    await verifyAuditLogsSchema(client);
  }

  const accountsRes = await client.execute(
    `SELECT id, full_name, short_name, username, access_role, pin_code, status
     FROM players
     ORDER BY id ASC`
  );
  const allRows = accountsRes.rows || [];

  const eligible = [];
  let activeCount = 0;
  let inactiveCount = 0;
  let excludedCount = 0;

  for (const row of allRows) {
    const hasCredential = String(row.pin_code || "").trim().length > 0;
    const normName = normalizeLoginString(
      row.username || row.short_name || row.full_name || ""
    );
    if (!hasCredential || !normName) {
      excludedCount++;
      continue;
    }
    const isInactive = row.status === "inactive";
    if (isInactive) inactiveCount++;
    else activeCount++;
    eligible.push(row);
  }

  const counts = {
    total: allRows.length,
    eligible: eligible.length,
    active: activeCount,
    inactive: inactiveCount,
    excluded: excludedCount,
  };

  if (eligible.length === 0) {
    throw new Error(
      "Account guard blocked: no eligible authenticated accounts found."
    );
  }

  if (!apply) {
    return {
      mode: "dry-run",
      status: "planned",
      applied: false,
      targetDb: targetInfo.dbName,
      safeHost: targetInfo.safeHost,
      counts,
      auditTableExists,
      plannedAction: BULK_RESET_ACTION,
    };
  }

  const cleanApproval = approvalRef.trim();

  if (!auditTableExists) {
    await ensureAuditLogsSchema(client);
    await verifyAuditLogsSchema(client);
  }

  const priorApprovalRes = await client.execute({
    sql: "SELECT summary FROM audit_logs WHERE action = ?",
    args: [BULK_RESET_ACTION],
  });
  const alreadyUsed = (priorApprovalRes.rows || []).some(
    (row) => parseApprovalRefFromSummary(row.summary) === cleanApproval
  );
  if (alreadyUsed) {
    throw new Error(
      `Approval guard blocked: approval-ref "${cleanApproval}" was already used. Repeated bulk reset requires a new explicit Owner approval.`
    );
  }

  const usedPasswords = new Set();
  const prepared = eligible.map((account) => {
    const { identifier, temporaryPassword } = generateBulkTemporaryPassword(
      account,
      usedPasswords
    );
    const hashedPin = hashPassword(temporaryPassword);
    return {
      id: account.id,
      identifier,
      accessRole: String(account.access_role || "player"),
      status: String(account.status || ""),
      isInactive: account.status === "inactive",
      temporaryPassword,
      hashedPin,
    };
  });

  const createdAt = new Date().toISOString();
  const tx = await client.transaction("write");
  try {
    for (const item of prepared) {
      const updateRes = await tx.execute({
        sql: "UPDATE players SET pin_code = ?, must_change_pin = 1 WHERE id = ?",
        args: [item.hashedPin, item.id],
      });
      if (Number(updateRes.rowsAffected || 0) !== 1) {
        throw new Error(
          `Unexpected rowsAffected (${updateRes.rowsAffected}) for player_id=${item.id}.`
        );
      }

      const verifyInTx = await tx.execute({
        sql: "SELECT must_change_pin, status FROM players WHERE id = ? LIMIT 1",
        args: [item.id],
      });
      const verifiedRow = verifyInTx.rows?.[0];
      if (
        !verifiedRow ||
        Number(verifiedRow.must_change_pin ?? 0) !== 1 ||
        String(verifiedRow.status || "") !== item.status
      ) {
        throw new Error(
          `In-transaction verification failed for player_id=${item.id}.`
        );
      }

      const summary = `Staging bulk PIN reset for player_id=${item.id} (role=${item.accessRole}, status=${item.isInactive ? "inactive" : "active"}, must_change_pin=1); approval=${cleanApproval}`;
      await tx.execute({
        sql: `INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, summary, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          RECOVERY_ACTOR_ID,
          RECOVERY_ACTOR_NAME,
          RECOVERY_ACTOR_ROLE,
          BULK_RESET_ACTION,
          summary,
          createdAt,
        ],
      });
    }

    await tx.commit();
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // ignore secondary rollback error
    }
    throw new Error(
      `Bulk reset transaction rolled back: ${err instanceof Error ? err.message : "UNKNOWN_ERROR"}`
    );
  }

  for (const item of prepared) {
    const postRes = await client.execute({
      sql: "SELECT must_change_pin, status FROM players WHERE id = ? LIMIT 1",
      args: [item.id],
    });
    const postRow = postRes.rows?.[0];
    if (
      !postRow ||
      Number(postRow.must_change_pin ?? 0) !== 1 ||
      String(postRow.status || "") !== item.status
    ) {
      throw new Error(
        `Post-commit verification failed for player_id=${item.id}.`
      );
    }
  }

  const handoffList = prepared.map((item) => ({
    identifier: item.identifier,
    accessRole: item.accessRole,
    status: item.isInactive ? "inactive" : "active",
    temporaryPassword: item.temporaryPassword,
  }));

  if (typeof onCredentialsHandoff === "function") {
    onCredentialsHandoff(handoffList);
  } else {
    const lines = [
      "",
      "=== ONE-TIME STAGING BULK PIN HANDOFF (DO NOT LOG / RECORD / REDIRECT) ===",
      "SECURITY WARNING: Ensure terminal transcript, screen recording, and centralized logging are OFF.",
      ...handoffList.map(
        (entry) =>
          `- ${entry.identifier} [${entry.accessRole} / ${entry.status}]: ${entry.temporaryPassword}`
      ),
      "Action required: Every account has must_change_pin=1 and must change PIN on first login.",
      "===========================================================================",
      "",
    ];
    process.stdout.write(lines.join("\n"));
  }

  return {
    mode: "apply",
    status: "reset",
    applied: true,
    targetDb: targetInfo.dbName,
    safeHost: targetInfo.safeHost,
    counts,
    updatedCount: prepared.length,
    mustChangePinVerifiedCount: prepared.length,
    auditAction: BULK_RESET_ACTION,
    approvalRef: cleanApproval,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const envArg = getArg("--env", argv);
  const hasDryRun = argv.includes("--dry-run");
  const hasApply = argv.includes("--apply");
  const approvalRef = getArg("--approval-ref", argv);

  if (hasDryRun && hasApply) {
    throw new Error("Invalid flags: specify either --dry-run or --apply, not both.");
  }
  if (envArg !== "staging") {
    throw new Error("Environment guard blocked: --env staging is required.");
  }

  const targetInfo = validateExactStagingBulkTarget({
    url: process.env.TURSO_STAGING_DATABASE_URL,
    token: process.env.TURSO_STAGING_AUTH_TOKEN,
    envUrlName: "TURSO_STAGING_DATABASE_URL",
    envTokenName: "TURSO_STAGING_AUTH_TOKEN",
  });

  const client = createClient({
    url: targetInfo.url,
    authToken: targetInfo.token,
  });

  try {
    const result = await runStagingBulkPinReset({
      client,
      targetInfo,
      apply: hasApply,
      approvalRef,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.close();
  }
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((err) => {
    console.error(
      `Bulk reset blocked/failed: ${err instanceof Error ? err.message : "UNKNOWN_ERROR"}`
    );
    process.exit(1);
  });
}
