#!/usr/bin/env node
/**
 * Controlled Staging-only out-of-band CLI recovery for QA_MANAGER_363B.
 * Defaults to --dry-run. Applying requires explicit --apply, --env staging,
 * --approval-ref <ref>, an interactive local TTY, and the exact Staging DB:
 *   fchdhgonoi-staging-nguyenthetiengit01-collab
 *
 * Never targets Production, Restore, unknown DBs, or local SQLite.
 * Never logs or persists plaintext PINs or scrypt hashes.
 */
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { extractTursoDbName } from "./lib/turso-preflight.mjs";

export const EXACT_STAGING_DB_NAME = "fchdhgonoi-staging-nguyenthetiengit01-collab";
export const ALLOWED_RECOVERY_TARGET = "QA_MANAGER_363B";
export const RECOVERY_ACTOR_ID = 0;
export const RECOVERY_ACTOR_NAME = "STAGING_OPERATOR_CLI";
export const RECOVERY_ACTOR_ROLE = "operator";
export const RECOVERY_ACTION = "operator_manager_pin_recovery";

const COMMON_WEAK_PASSWORDS = new Set([
  "123456",
  "12345678",
  "123456789",
  "000000",
  "111111",
  "666666",
  "888888",
  "password",
  "matkhau",
  "qwerty",
  "admin123",
  "fchdhgonoi",
  "gonoi123",
]);

export function normalizeLoginString(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function validatePasswordStrength(pin, username) {
  const p = String(pin || "").trim();
  if (p.length < 6) {
    return { valid: false, error: "PIN must be at least 6 characters." };
  }
  if (p.length > 128) {
    return { valid: false, error: "PIN must be at most 128 characters." };
  }
  if (/^(.)\1{5,}$/.test(p) || COMMON_WEAK_PASSWORDS.has(p.toLowerCase())) {
    return { valid: false, error: "PIN is too weak or predictable." };
  }
  if (username && p.toLowerCase() === String(username).trim().toLowerCase()) {
    return { valid: false, error: "PIN must not match username." };
  }
  return { valid: true };
}

export function generateTemporaryPin() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%&*!";
  const all = upper + lower + digits + symbols;
  const chars = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];
  for (let i = 0; i < 8; i++) {
    chars.push(all[crypto.randomInt(all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function hashPassword(password) {
  const clean = String(password || "").trim();
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(clean, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

export function validateExactStagingRecoveryTarget({
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

  if (dbName === "fchdhgonoi" || dbName.startsWith("fchdhgonoi-nguyenthetiengit01")) {
    throw new Error(
      `Preflight blocked: database "${dbName}" appears to be Production. Refusing recovery.`
    );
  }

  if (dbName.includes("restore") || dbName.includes("drill")) {
    throw new Error(
      `Preflight blocked: database "${dbName}" appears to be a restore/drill database. Exact Staging DB required.`
    );
  }

  if (dbName !== EXACT_STAGING_DB_NAME) {
    throw new Error(
      `Preflight blocked: database "${dbName}" is not the exact Staging database (${EXACT_STAGING_DB_NAME}).`
    );
  }

  return { dbName, safeHost, url: cleanUrl, token: cleanToken };
}

function getArg(flag, argv = process.argv) {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return null;
}

export function assertInteractiveLocalTerminal(env = process.env, io = {}) {
  const isCi =
    Boolean(env.CI) ||
    Boolean(env.GITHUB_ACTIONS) ||
    Boolean(env.VERCEL);
  if (isCi) {
    throw new Error(
      "Interactive guard blocked: --apply is forbidden in CI or hosted environments."
    );
  }
  const stdinTty = io.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  const stdoutTty = io.stdoutIsTTY ?? Boolean(process.stdout.isTTY);
  if (!stdinTty || !stdoutTty) {
    throw new Error(
      "Interactive guard blocked: --apply requires an interactive local terminal (TTY) without output redirection."
    );
  }
}

function findMatchingManagers(rows, targetName) {
  const cleanTarget = String(targetName || "").trim();
  const uNorm = normalizeLoginString(cleanTarget);
  const cleanDigits = cleanTarget.replace(/\D/g, "");
  const cleanJersey = cleanTarget.replace("#", "").trim();

  return rows.filter((p) => {
    const matchesIdentity =
      (p.username && p.username.toLowerCase() === cleanTarget.toLowerCase()) ||
      (p.username && normalizeLoginString(p.username) === uNorm) ||
      normalizeLoginString(p.short_name) === uNorm ||
      normalizeLoginString(p.full_name) === uNorm ||
      (p.phone && cleanDigits && p.phone.replace(/\D/g, "") === cleanDigits) ||
      (p.jersey_number !== null &&
        p.jersey_number !== undefined &&
        String(p.jersey_number) === cleanJersey);
    return Boolean(matchesIdentity && p.access_role === "manager");
  });
}

export async function ensureAuditLogsSchema(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

const REQUIRED_AUDIT_COLUMNS = [
  "id",
  "actor_id",
  "actor_name",
  "actor_role",
  "action",
  "summary",
  "created_at",
];

export async function verifyAuditLogsSchema(db) {
  const colsRes = await db.execute("PRAGMA table_info(audit_logs)");
  const colNames = new Set((colsRes.rows || []).map((c) => String(c.name || "")));
  for (const reqCol of REQUIRED_AUDIT_COLUMNS) {
    if (!colNames.has(reqCol)) {
      throw new Error(
        `Schema guard blocked: audit_logs is missing required column "${reqCol}".`
      );
    }
  }
  const fksRes = await db.execute("PRAGMA foreign_key_list(audit_logs)");
  const actorFk = (fksRes.rows || []).find(
    (fk) => String(fk.from || "").toLowerCase() === "actor_id"
  );
  if (actorFk) {
    throw new Error(
      "Schema guard blocked: audit_logs.actor_id has a foreign key constraint incompatible with operator actor_id=0."
    );
  }
}

export const APPROVAL_REF_PATTERN = /^(OWNER|STG|P103|INC|CHG)-[A-Za-z0-9._:-]{4,56}$/;

export function parseApprovalRefFromSummary(summary) {
  const match = String(summary || "").match(/(?:^|;\s*)approval=([^\s;]+)/);
  return match ? match[1] : null;
}

/**
 * @param {{
 *   client: any;
 *   targetInfo: { dbName: string; safeHost: string };
 *   targetName?: string;
 *   apply?: boolean;
 *   approvalRef?: string | null;
 *   env?: Record<string, string | undefined>;
 *   io?: { stdinIsTTY?: boolean; stdoutIsTTY?: boolean };
 *   onTemporaryPinHandoff?: (pin: string) => void;
 * }} params
 */
export async function runStagingManagerRecovery({
  client,
  targetInfo,
  targetName = ALLOWED_RECOVERY_TARGET,
  apply = false,
  approvalRef = null,
  env = process.env,
  io = {},
  onTemporaryPinHandoff = undefined,
}) {
  if (targetName !== ALLOWED_RECOVERY_TARGET) {
    throw new Error(
      `Target guard blocked: only "${ALLOWED_RECOVERY_TARGET}" is permitted for recovery.`
    );
  }

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

  const candidatesRes = await client.execute(
    `SELECT id, full_name, short_name, username, jersey_number, phone, access_role, status
     FROM players
     ORDER BY id ASC`
  );
  const matchedManagers = findMatchingManagers(candidatesRes.rows || [], targetName);
  const activeManagers = matchedManagers.filter((m) => m.status !== "inactive");

  if (matchedManagers.length === 0) {
    throw new Error(`Target not found: no manager matches "${targetName}".`);
  }
  if (matchedManagers.length > 1 || activeManagers.length > 1) {
    throw new Error(
      `Ambiguous target: ${matchedManagers.length} manager records match "${targetName}".`
    );
  }
  if (activeManagers.length === 0) {
    throw new Error(
      `Inactive target: manager "${targetName}" is inactive and cannot be recovered.`
    );
  }

  const targetManager = activeManagers[0];

  const auditExistsRes = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_logs' LIMIT 1"
  );
  const auditTableExists = (auditExistsRes.rows || []).length > 0;
  if (auditTableExists) {
    await verifyAuditLogsSchema(client);
  }

  if (!apply) {
    return {
      mode: "dry-run",
      status: "planned",
      applied: false,
      targetDb: targetInfo.dbName,
      safeHost: targetInfo.safeHost,
      targetLabel: ALLOWED_RECOVERY_TARGET,
      matchedCount: activeManagers.length,
      auditTableExists,
      plannedAction: RECOVERY_ACTION,
    };
  }

  const cleanApproval = approvalRef.trim();

  if (!auditTableExists) {
    await ensureAuditLogsSchema(client);
    await verifyAuditLogsSchema(client);
  }

  const priorApprovalRes = await client.execute({
    sql: "SELECT summary FROM audit_logs WHERE action = ?",
    args: [RECOVERY_ACTION],
  });
  const alreadyUsed = (priorApprovalRes.rows || []).some(
    (row) => parseApprovalRefFromSummary(row.summary) === cleanApproval
  );
  if (alreadyUsed) {
    throw new Error(
      `Approval guard blocked: approval-ref "${cleanApproval}" was already used. Repeated recovery requires a new explicit Owner approval.`
    );
  }

  const temporaryPin = generateTemporaryPin();
  const strength = validatePasswordStrength(temporaryPin, targetManager.username);
  if (!strength.valid) {
    throw new Error(`Generated PIN failed strength policy: ${strength.error}`);
  }
  const hashedPin = hashPassword(temporaryPin);
  const auditSummary = `Staging operator recovery for manager player_id=${targetManager.id}; must_change_pin=1; approval=${cleanApproval}`;
  const createdAt = new Date().toISOString();

  const tx = await client.transaction("write");
  try {
    const updateRes = await tx.execute({
      sql: "UPDATE players SET pin_code = ?, must_change_pin = 1 WHERE id = ? AND access_role = 'manager' AND status != 'inactive'",
      args: [hashedPin, targetManager.id],
    });
    if (Number(updateRes.rowsAffected || 0) !== 1) {
      throw new Error(
        `Unexpected rowsAffected (${updateRes.rowsAffected}) while updating manager.`
      );
    }

    await tx.execute({
      sql: `INSERT INTO audit_logs (actor_id, actor_name, actor_role, action, summary, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        RECOVERY_ACTOR_ID,
        RECOVERY_ACTOR_NAME,
        RECOVERY_ACTOR_ROLE,
        RECOVERY_ACTION,
        auditSummary,
        createdAt,
      ],
    });

    await tx.commit();
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // ignore secondary rollback error
    }
    throw new Error(
      `Recovery transaction rolled back: ${err instanceof Error ? err.message : "UNKNOWN_ERROR"}`
    );
  }

  const verifyRes = await client.execute({
    sql: "SELECT must_change_pin FROM players WHERE id = ? LIMIT 1",
    args: [targetManager.id],
  });
  const verifiedFlag = Number(verifyRes.rows?.[0]?.must_change_pin ?? 0) === 1;
  if (!verifiedFlag) {
    throw new Error("Post-commit verification failed: must_change_pin is not 1.");
  }

  if (typeof onTemporaryPinHandoff === "function") {
    onTemporaryPinHandoff(temporaryPin);
  } else {
    process.stdout.write(
      [
        "",
        "=== ONE-TIME MANAGER PIN HANDOFF (DO NOT LOG / RECORD / REDIRECT) ===",
        "SECURITY WARNING: Ensure terminal transcript, screen recording, and centralized logging are OFF.",
        `Target: ${ALLOWED_RECOVERY_TARGET}`,
        `Temporary PIN (displayed ONCE): ${temporaryPin}`,
        "Action required: Log in immediately and change to a personal PIN (must_change_pin=1).",
        "======================================================================",
        "",
      ].join("\n")
    );
  }

  return {
    mode: "apply",
    status: "recovered",
    applied: true,
    targetDb: targetInfo.dbName,
    safeHost: targetInfo.safeHost,
    targetLabel: ALLOWED_RECOVERY_TARGET,
    mustChangePinVerified: true,
    auditAction: RECOVERY_ACTION,
    approvalRef: cleanApproval,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const envArg = getArg("--env", argv);
  const hasDryRun = argv.includes("--dry-run");
  const hasApply = argv.includes("--apply");
  const targetArg = getArg("--target", argv) || ALLOWED_RECOVERY_TARGET;
  const approvalRef = getArg("--approval-ref", argv);

  if (hasDryRun && hasApply) {
    throw new Error("Invalid flags: specify either --dry-run or --apply, not both.");
  }
  if (envArg !== "staging") {
    throw new Error("Environment guard blocked: --env staging is required.");
  }

  const targetInfo = validateExactStagingRecoveryTarget({
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
    const result = await runStagingManagerRecovery({
      client,
      targetInfo,
      targetName: targetArg,
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
      `Recovery blocked/failed: ${err instanceof Error ? err.message : "UNKNOWN_ERROR"}`
    );
    process.exit(1);
  });
}
