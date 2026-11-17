#!/usr/bin/env node
/**
 * Legacy Base64 Media Migration CLI (dry-run by default).
 * Production, Staging, and remote database targets are strictly forbidden.
 * Usage:
 *   node scripts/migrations/migrate-legacy-media.mjs --sqlite /tmp/test.sqlite [--dry-run | --write]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

function getArg(flag) {
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === flag && i + 1 < process.argv.length) {
      return process.argv[i + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return null;
}

function hasFlag(flag) {
  return process.argv.includes(flag) || process.argv.some((a) => a.startsWith(`${flag}=`));
}

function installTsLoader() {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      let target = specifier;
      if (target.startsWith("@/")) {
        target = path.join(REPO_ROOT, "src", target.slice(2));
      } else if (
        (target.startsWith("./") || target.startsWith("../")) &&
        context.parentURL?.startsWith("file://") &&
        !context.parentURL.includes("/node_modules/")
      ) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        target = path.resolve(parentDir, target);
      } else {
        return nextResolve(specifier, context);
      }

      if (!path.extname(target)) {
        if (fs.existsSync(`${target}.ts`)) {
          target = `${target}.ts`;
        } else if (fs.existsSync(`${target}.mts`)) {
          target = `${target}.mts`;
        } else if (fs.existsSync(path.join(target, "index.ts"))) {
          target = path.join(target, "index.ts");
        }
      }

      return {
        shortCircuit: true,
        url: pathToFileURL(target).href,
      };
    },
    load(url, context, nextLoad) {
      if (url.endsWith(".ts") || url.endsWith(".mts")) {
        const filePath = fileURLToPath(url);
        const source = fs.readFileSync(filePath, "utf8");
        const stripped = stripTypeScriptTypes(source, { mode: "transform" });
        return {
          shortCircuit: true,
          format: "module",
          source: stripped,
        };
      }
      return nextLoad(url, context);
    },
  });
}

function createSqliteAsyncDb(sqliteDb) {
  const txAdapter = {
    async query(sql, params = []) {
      const stmt = sqliteDb.prepare(sql);
      return stmt.all(...params);
    },
    async queryOne(sql, params = []) {
      const stmt = sqliteDb.prepare(sql);
      return stmt.get(...params) ?? null;
    },
    async run(sql, params = []) {
      const stmt = sqliteDb.prepare(sql);
      const info = stmt.run(...params);
      return {
        lastInsertRowid: Number(info.lastInsertRowid ?? 0),
        changes: Number(info.changes ?? 0),
      };
    },
    async exec(sql) {
      sqliteDb.exec(sql);
    },
  };

  return {
    ...txAdapter,
    async batch(statements) {
      sqliteDb.exec("BEGIN");
      try {
        for (const s of statements) {
          sqliteDb.prepare(s.sql).run(...(s.params ?? []));
        }
        sqliteDb.exec("COMMIT");
      } catch (err) {
        sqliteDb.exec("ROLLBACK");
        throw err;
      }
    },
    async transaction(fn) {
      sqliteDb.exec("BEGIN");
      try {
        const result = await fn(txAdapter);
        sqliteDb.exec("COMMIT");
        return result;
      } catch (err) {
        sqliteDb.exec("ROLLBACK");
        throw err;
      }
    },
  };
}

function sanitizeValueForLog(val) {
  if (typeof val !== "string") return val;
  if (/^data:image\//i.test(val.trim())) {
    return "[redacted-data-uri]";
  }
  return val;
}

function sanitizeReport(report, targetBasename) {
  return {
    status: report.failedFields > 0 ? "completed_with_failures" : "ok",
    target: targetBasename,
    dryRun: report.dryRun,
    scannedRows: report.scannedRows,
    migratedFields: report.migratedFields,
    skippedFields: report.skippedFields,
    failedFields: report.failedFields,
    orphanObjects: (report.orphanObjects || []).map((o) => ({
      table: o.table,
      rowId: o.rowId,
      column: o.column,
      url: sanitizeValueForLog(o.url),
      pathname: o.pathname,
    })),
    entries: (report.entries || []).map((e) => ({
      table: e.table,
      rowId: e.rowId,
      column: e.column,
      status: e.status,
      ...(e.sha256 ? { sha256: e.sha256 } : {}),
      ...(e.pathname ? { pathname: e.pathname } : {}),
      ...(e.newUrl ? { newUrl: sanitizeValueForLog(e.newUrl) } : {}),
      ...(e.orphanUrl ? { orphanUrl: sanitizeValueForLog(e.orphanUrl) } : {}),
      ...(e.error ? { error: sanitizeValueForLog(e.error) } : {}),
    })),
  };
}

async function main() {
  if (hasFlag("--env")) {
    const envArg = getArg("--env") || "(empty)";
    throw new Error(
      `Refusing --env ${envArg}: remote Production and Staging media migration are strictly forbidden.`
    );
  }

  const sqliteArg = getArg("--sqlite");
  if (!sqliteArg) {
    throw new Error("Missing required --sqlite <path> target for local disposable DB.");
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(sqliteArg)) {
    throw new Error("Remote database URLs are forbidden; provide a local disposable SQLite file path.");
  }

  const writeMode = hasFlag("--write");
  const dryRun = !writeMode || hasFlag("--dry-run");
  const sqlitePath = path.resolve(sqliteArg);

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite target not found: ${sqlitePath}`);
  }

  installTsLoader();
  const { migrateLegacyMedia } = await import(
    pathToFileURL(path.join(REPO_ROOT, "src/lib/media/migration.ts")).href
  );
  const { getMediaStorageProvider } = await import(
    pathToFileURL(path.join(REPO_ROOT, "src/lib/media/storage.ts")).href
  );

  const provider = dryRun
    ? {
        async uploadPublicAsset() {
          throw new Error("Dry-run mode must never invoke uploadPublicAsset.");
        },
      }
    : getMediaStorageProvider();

  const sqliteDb = new DatabaseSync(sqlitePath);
  try {
    const db = createSqliteAsyncDb(sqliteDb);
    const report = await migrateLegacyMedia({ db, provider, dryRun });
    const sanitized = sanitizeReport(report, path.basename(sqlitePath));
    console.log(JSON.stringify(sanitized, null, 2));
    if (report.failedFields > 0) {
      process.exitCode = 1;
    }
  } finally {
    sqliteDb.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
