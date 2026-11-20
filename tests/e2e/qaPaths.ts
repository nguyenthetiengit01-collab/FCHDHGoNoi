import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_RUN_ID = `${process.pid}-${Date.now()}`;

export function getQaRoot(): string {
  const configured = process.env.QA_ROOT?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  const generated = path.resolve(
    os.tmpdir(),
    `gonoifc-phase65-qa-${DEFAULT_RUN_ID}`
  );
  process.env.QA_ROOT = generated;
  return generated;
}

export const QA_ROOT = getQaRoot();
export const QA_DB_PATH = path.resolve(QA_ROOT, "qa.sqlite");
export const SCREENSHOT_DIR = path.resolve(
  process.env.QA_SCREENSHOT_DIR?.trim() || path.join(QA_ROOT, "screenshots")
);
export const HTML_REPORT_DIR = path.resolve(QA_ROOT, "html-report");
export const TEST_RESULTS_DIR = path.resolve(QA_ROOT, "test-results");

const QA_SQLITE_SUFFIXES = ["", "-wal", "-shm", "-journal"] as const;

function isSubPath(parentPath: string, targetPath: string): boolean {
  const rel = path.relative(parentPath, targetPath);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function resolveRealPathAllowingMissing(targetPath: string): string {
  const abs = path.resolve(targetPath);
  const missingSegments: string[] = [];
  let cursor = abs;

  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    missingSegments.unshift(path.basename(cursor));
    cursor = parent;
  }

  const realBase = fs.realpathSync(cursor);
  return path.resolve(realBase, ...missingSegments);
}

function assertNotSymlink(targetPath: string, label: string): void {
  if (fs.existsSync(targetPath)) {
    const stat = fs.lstatSync(targetPath);
    if (stat.isSymbolicLink()) {
      throw new Error(`Security rejection: ${label} must not be a symlink (${targetPath})`);
    }
  }
}

export function validateQaPaths(): {
  repoRoot: string;
  qaRoot: string;
  qaDbPath: string;
} {
  if (
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.TURSO_DATABASE_URL?.trim()) ||
    Boolean(process.env.TURSO_AUTH_TOKEN?.trim()) ||
    Boolean(process.env.LIBSQL_URL?.trim())
  ) {
    throw new Error(
      "Refusing QA database setup when Production, Vercel, or Turso/LibSQL environment variables are present."
    );
  }

  const repoRoot = fs.realpathSync(process.cwd());
  const defaultBundledDb = path.resolve(repoRoot, "data", "gonoifc.sqlite");
  const qaRoot = getQaRoot();
  const qaDbPath = path.resolve(qaRoot, "qa.sqlite");

  if (!path.isAbsolute(qaRoot) || !path.isAbsolute(qaDbPath)) {
    throw new Error(`QA paths must be absolute: QA_ROOT=${qaRoot}, QA_DB_PATH=${qaDbPath}`);
  }

  assertNotSymlink(qaRoot, "QA_ROOT");
  assertNotSymlink(qaDbPath, "QA_DB_PATH");

  const realQaRoot = resolveRealPathAllowingMissing(qaRoot);
  const realQaDbPath = resolveRealPathAllowingMissing(qaDbPath);

  if (isSubPath(repoRoot, qaRoot) || isSubPath(repoRoot, realQaRoot)) {
    throw new Error(`QA_ROOT must be outside repository root (${repoRoot}): ${qaRoot}`);
  }

  if (isSubPath(repoRoot, qaDbPath) || isSubPath(repoRoot, realQaDbPath)) {
    throw new Error(`QA_DB_PATH must be outside repository root (${repoRoot}): ${qaDbPath}`);
  }

  if (realQaDbPath === defaultBundledDb || path.resolve(qaDbPath) === defaultBundledDb) {
    throw new Error(`QA_DB_PATH must never target bundled ${defaultBundledDb}`);
  }

  return { repoRoot, qaRoot: realQaRoot, qaDbPath: realQaDbPath };
}

export function cleanupQaSqliteFiles(): {
  cleaned: string[];
  locked: Array<{ file: string; code: string; message: string }>;
} {
  const { qaDbPath } = validateQaPaths();
  const cleaned: string[] = [];
  const locked: Array<{ file: string; code: string; message: string }> = [];

  for (const suffix of QA_SQLITE_SUFFIXES) {
    const target = `${qaDbPath}${suffix}`;
    if (!fs.existsSync(target)) continue;
    assertNotSymlink(target, `QA SQLite artifact (${suffix || "main"})`);
    try {
      fs.rmSync(target);
      cleaned.push(target);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code || "UNKNOWN";
      const message = err instanceof Error ? err.message : String(err);
      if (code === "EBUSY" || code === "EPERM" || code === "EACCES") {
        locked.push({ file: target, code, message });
      } else {
        throw err;
      }
    }
  }

  return { cleaned, locked };
}
