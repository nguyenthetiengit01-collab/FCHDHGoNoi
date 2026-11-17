#!/usr/bin/env node
/**
 * Legacy Base64 Media Migration CLI (dry-run by default).
 * Production and Staging remote execution are strictly disabled in this PR.
 * Usage:
 *   node scripts/migrations/migrate-legacy-media.mjs --sqlite /tmp/test.sqlite [--dry-run | --write]
 */
import fs from "node:fs";
import path from "node:path";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

async function main() {
  const envArg = getArg("--env");
  if (envArg) {
    throw new Error(
      `Refusing --env ${envArg}: remote Production and Staging media migration are not authorized in this CLI.`
    );
  }

  const sqliteArg = getArg("--sqlite");
  if (!sqliteArg) {
    throw new Error("Missing required --sqlite <path> target for local disposable DB.");
  }

  const writeMode = process.argv.includes("--write");
  const dryRun = !writeMode || process.argv.includes("--dry-run");
  const sqlitePath = path.resolve(sqliteArg);

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite target not found: ${sqlitePath}`);
  }

  console.log(
    JSON.stringify({
      status: "ready",
      target: path.basename(sqlitePath),
      dryRun,
      note: "Run migrateLegacyMedia() via Vitest or tsx with a configured MediaStorageProvider.",
    })
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
