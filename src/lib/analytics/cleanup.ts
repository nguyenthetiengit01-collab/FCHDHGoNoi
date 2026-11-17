import type { AsyncDb } from "@/lib/db";
import { ANALYTICS_RAW_RETENTION_DAYS } from "./config";

export const CLEANUP_DEFAULT_BATCH_SIZE = 5000;
export const CLEANUP_MAX_BATCHES_PER_RUN = 10;
export const CLEANUP_MAX_DURATION_MS = 8000;

export class CleanupAlreadyRunningError extends Error {
  readonly code = "CLEANUP_ALREADY_RUNNING" as const;
  constructor() {
    super("Cleanup job is already running in this instance.");
    this.name = "CleanupAlreadyRunningError";
  }
}

export class CleanupTargetError extends Error {
  readonly code = "CLEANUP_TARGET_INVALID" as const;
  constructor(message: string) {
    super(message);
    this.name = "CleanupTargetError";
  }
}

export interface ProductionTargetValidation {
  dbName: string;
  safeHost: string;
}

export function validateProductionCleanupTarget(
  env: Record<string, string | undefined> = process.env
): ProductionTargetValidation {
  const url = typeof env.TURSO_DATABASE_URL === "string" ? env.TURSO_DATABASE_URL.trim() : "";
  const token = typeof env.TURSO_AUTH_TOKEN === "string" ? env.TURSO_AUTH_TOKEN.trim() : "";
  if (!url || !token) {
    throw new CleanupTargetError("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CleanupTargetError("Invalid TURSO_DATABASE_URL format.");
  }

  if (parsed.protocol !== "libsql:" && parsed.protocol !== "https:") {
    throw new CleanupTargetError("Unsupported TURSO_DATABASE_URL protocol.");
  }

  const hostname = parsed.hostname.toLowerCase();
  const dbName = hostname.split(".")[0] || "";
  if (!dbName || dbName.startsWith("fchdhgonoi-staging")) {
    throw new CleanupTargetError("Target database is not an allowed Production database.");
  }

  const isAllowedProd =
    dbName === "fchdhgonoi" || dbName.startsWith("fchdhgonoi-nguyenthetiengit01");
  if (!isAllowedProd) {
    throw new CleanupTargetError("Target database is outside Production allowlist.");
  }

  const stagingUrls = [
    env.TURSO_STAGING_DATABASE_URL,
    env.TURSO_STAGING_RESTORE_DATABASE_URL,
  ];
  for (const sUrl of stagingUrls) {
    if (typeof sUrl === "string" && sUrl.trim() && sUrl.trim() === url) {
      throw new CleanupTargetError("Production URL overlaps with Staging URL.");
    }
  }

  return { dbName, safeHost: `${parsed.protocol}//${hostname}` };
}

export interface BoundedCleanupResult {
  deletedCount: number;
  cutoffIso: string;
  preservedRollups: true;
  partial: boolean;
  remainingEligible: number;
  dryRun: boolean;
  batchesExecuted: number;
}

let cleanupInFlight = false;

export function __resetCleanupLockForTest(): void {
  cleanupInFlight = false;
}

export async function runBoundedRawEventsCleanup(params: {
  db: AsyncDb;
  days?: number;
  batchSize?: number;
  maxBatches?: number;
  maxDurationMs?: number;
  dryRun?: boolean;
  now?: Date;
}): Promise<BoundedCleanupResult> {
  if (cleanupInFlight) {
    throw new CleanupAlreadyRunningError();
  }
  cleanupInFlight = true;

  try {
    const retentionDays =
      typeof params.days === "number" && Number.isFinite(params.days) && params.days > 0
        ? Math.floor(params.days)
        : ANALYTICS_RAW_RETENTION_DAYS;
    const batchSize =
      typeof params.batchSize === "number" && Number.isFinite(params.batchSize) && params.batchSize > 0
        ? Math.floor(params.batchSize)
        : CLEANUP_DEFAULT_BATCH_SIZE;
    const maxBatches =
      typeof params.maxBatches === "number" && Number.isFinite(params.maxBatches) && params.maxBatches > 0
        ? Math.floor(params.maxBatches)
        : CLEANUP_MAX_BATCHES_PER_RUN;
    const maxDurationMs =
      typeof params.maxDurationMs === "number" && Number.isFinite(params.maxDurationMs) && params.maxDurationMs > 0
        ? Math.floor(params.maxDurationMs)
        : CLEANUP_MAX_DURATION_MS;
    const dryRun = Boolean(params.dryRun);
    const now = params.now ?? new Date();
    const cutoffIso = new Date(now.getTime() - retentionDays * 86400000).toISOString();

    const tableRow = await params.db.queryOne<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='product_analytics_events' LIMIT 1"
    );
    if (!tableRow?.name) {
      return {
        deletedCount: 0,
        cutoffIso,
        preservedRollups: true,
        partial: false,
        remainingEligible: 0,
        dryRun,
        batchesExecuted: 0,
      };
    }

    const beforeRow = await params.db.queryOne<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM product_analytics_events WHERE occurred_at < ?",
      [cutoffIso]
    );
    const initialEligible = Number(beforeRow?.cnt || 0);

    if (dryRun || initialEligible === 0) {
      return {
        deletedCount: 0,
        cutoffIso,
        preservedRollups: true,
        partial: dryRun ? initialEligible > 0 : false,
        remainingEligible: initialEligible,
        dryRun,
        batchesExecuted: 0,
      };
    }

    const startedAt = Date.now();
    let deletedCount = 0;
    let batchesExecuted = 0;

    for (let i = 0; i < maxBatches; i++) {
      if (i > 0 && Date.now() - startedAt >= maxDurationMs) {
        break;
      }

      const batchDeleted = await params.db.transaction(async (tx) => {
        const res = await tx.run(
          `DELETE FROM product_analytics_events
           WHERE id IN (
             SELECT id FROM product_analytics_events
             WHERE occurred_at < ?
             ORDER BY id ASC
             LIMIT ?
           )`,
          [cutoffIso, batchSize]
        );
        return Number(res.changes || 0);
      });

      batchesExecuted += 1;
      deletedCount += batchDeleted;
      if (batchDeleted < batchSize) {
        break;
      }
    }

    const afterRow = await params.db.queryOne<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM product_analytics_events WHERE occurred_at < ?",
      [cutoffIso]
    );
    const remainingEligible = Number(afterRow?.cnt || 0);

    return {
      deletedCount,
      cutoffIso,
      preservedRollups: true,
      partial: remainingEligible > 0,
      remainingEligible,
      dryRun: false,
      batchesExecuted,
    };
  } finally {
    cleanupInFlight = false;
  }
}
