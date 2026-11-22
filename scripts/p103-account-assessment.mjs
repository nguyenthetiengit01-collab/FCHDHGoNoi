#!/usr/bin/env node
/**
 * P1-03 Read-Only Production Account Assessment Script.
 * Outputs ONLY aggregate counts. Never prints player IDs, names, phones, PINs, or hashes.
 *
 * Usage:
 *   node scripts/p103-account-assessment.mjs --turso
 *   node scripts/p103-account-assessment.mjs --sqlite <path-to-snapshot.sqlite>
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@libsql/client";

function getArg(flag, argv = process.argv) {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return null;
}

function verifyScryptValue(candidate, stored) {
  const cleanInput = String(candidate || "").trim();
  const cleanStored = String(stored || "").trim();
  if (!cleanInput || !cleanStored.startsWith("scrypt$")) return false;
  const parts = cleanStored.split("$");
  if (parts.length !== 3) return false;
  const [, salt, expectedKeyHex] = parts;
  if (!salt || !expectedKeyHex) return false;
  try {
    const derivedKey = crypto.scryptSync(cleanInput, salt, 64);
    const expectedKey = Buffer.from(expectedKeyHex, "hex");
    if (derivedKey.length !== expectedKey.length) return false;
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}

export function classifyCredential(pinOrHash) {
  const stored = typeof pinOrHash === "string" ? pinOrHash.trim() : "";
  if (!stored) return "missingOrEmpty";
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 3 || !parts[1] || !parts[2]) {
      return "undetermined";
    }
    return verifyScryptValue("1234", stored)
      ? "scryptDefault1234"
      : "scryptNonDefault";
  }
  if (stored === "1234") {
    return "legacyPlaintextDefault1234";
  }
  return "legacyPlaintextNonDefault";
}

export function classifySchemaPinDefault(dfltValue) {
  if (dfltValue === null || dfltValue === undefined) return "none";
  let normalized = String(dfltValue).trim();
  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    const inner = normalized.slice(1, -1).trim();
    if (!inner) break;
    normalized = inner;
  }
  if (normalized === "''" || normalized === '""' || normalized === "") {
    return "empty";
  }
  if (normalized === "'1234'" || normalized === '"1234"') {
    return "legacy_1234";
  }
  return "unknown";
}

export function aggregateAccountAssessment(rows, options = {}) {
  const activeCredentials = {
    missingOrEmpty: 0,
    legacyPlaintextDefault1234: 0,
    legacyPlaintextNonDefault: 0,
    scryptDefault1234: 0,
    scryptNonDefault: 0,
    undetermined: 0,
  };
  const activeByRole = { manager: 0, player: 0, other: 0 };
  let activeAccounts = 0;
  let inactiveAccounts = 0;
  let mustChangePinPending = options.hasMustChangePinColumn ? 0 : null;

  for (const row of rows) {
    const status = String(row.status || "").trim().toLowerCase();
    const isInactive = status === "inactive" || status === "ngừng sinh hoạt";
    if (isInactive) {
      inactiveAccounts += 1;
      continue;
    }
    activeAccounts += 1;

    const role = String(row.access_role || "").trim().toLowerCase();
    if (role === "manager") activeByRole.manager += 1;
    else if (role === "player") activeByRole.player += 1;
    else activeByRole.other += 1;

    const credClass = classifyCredential(row.pin_code);
    activeCredentials[credClass] += 1;

    if (options.hasMustChangePinColumn && Number(row.must_change_pin || 0) === 1) {
      mustChangePinPending += 1;
    }
  }

  return {
    status: "ok",
    readOnly: true,
    totalAccounts: rows.length,
    activeAccounts,
    inactiveAccounts,
    activeByRole,
    activeCredentials,
    resetRequiredCount:
      activeCredentials.missingOrEmpty +
      activeCredentials.legacyPlaintextDefault1234 +
      activeCredentials.legacyPlaintextNonDefault +
      activeCredentials.scryptDefault1234 +
      activeCredentials.undetermined,
    mustChangePinPending,
    schemaPinCodeDefault: options.schemaPinCodeDefault ?? "unknown",
  };
}

async function runAssessment() {
  const sqliteArg = getArg("--sqlite");
  const useTurso = process.argv.includes("--turso");

  if (!sqliteArg && !useTurso) {
    throw new Error(
      "Usage: node scripts/p103-account-assessment.mjs --turso | --sqlite <path>"
    );
  }

  if (sqliteArg) {
    const resolved = path.resolve(sqliteArg);
    if (!fs.existsSync(resolved)) {
      throw new Error(`SQLite file not found: ${resolved}`);
    }
    const db = new DatabaseSync(resolved, { readOnly: true });
    try {
      const cols = db.prepare("PRAGMA table_info(players)").all();
      const pinCol = cols.find((c) => c.name === "pin_code");
      const hasMustChange = cols.some((c) => c.name === "must_change_pin");
      const selectSql = hasMustChange
        ? "SELECT status, access_role, pin_code, must_change_pin FROM players"
        : "SELECT status, access_role, pin_code FROM players";
      const rows = db.prepare(selectSql).all();
      return aggregateAccountAssessment(rows, {
        hasMustChangePinColumn: hasMustChange,
        schemaPinCodeDefault: classifySchemaPinDefault(pinCol?.dflt_value),
      });
    } finally {
      db.close();
    }
  }

  const url =
    process.env.TURSO_PROD_DATABASE_URL?.trim() ||
    process.env.TURSO_DATABASE_URL?.trim() ||
    "";
  const authToken =
    process.env.TURSO_PROD_AUTH_TOKEN_RO?.trim() ||
    process.env.TURSO_AUTH_TOKEN?.trim() ||
    "";
  if (!url || !authToken) {
    throw new Error(
      "Missing TURSO_PROD_DATABASE_URL / TURSO_PROD_AUTH_TOKEN_RO (or TURSO_DATABASE_URL / TURSO_AUTH_TOKEN)."
    );
  }

  const client = createClient({ url, authToken });
  let tx = null;
  try {
    tx = await client.transaction("read");
    const pragmaRes = await tx.execute("PRAGMA table_info(players)");
    const cols = pragmaRes.rows;
    const pinCol = cols.find((c) => c.name === "pin_code");
    const hasMustChange = cols.some((c) => c.name === "must_change_pin");
    const selectSql = hasMustChange
      ? "SELECT status, access_role, pin_code, must_change_pin FROM players"
      : "SELECT status, access_role, pin_code FROM players";
    const rowsRes = await tx.execute(selectSql);
    await tx.commit();
    return aggregateAccountAssessment(rowsRes.rows, {
      hasMustChangePinColumn: hasMustChange,
      schemaPinCodeDefault: classifySchemaPinDefault(pinCol?.dflt_value),
    });
  } catch (err) {
    if (tx) {
      try {
        await tx.rollback();
      } catch {
        // ignore rollback error
      }
    }
    throw err;
  } finally {
    client.close();
  }
}

const isEntrypoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  runAssessment()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
