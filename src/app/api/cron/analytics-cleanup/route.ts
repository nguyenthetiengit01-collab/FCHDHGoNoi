import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAsyncDb } from "@/lib/db";
import { guardCutoverWrite } from "@/lib/cutoverFreeze";
import { ANALYTICS_RAW_RETENTION_DAYS } from "@/lib/analytics/config";
import {
  CleanupAlreadyRunningError,
  CleanupTargetError,
  runBoundedRawEventsCleanup,
  validateProductionCleanupTarget,
} from "@/lib/analytics/cleanup";
import { logAnalyticsEvent } from "@/lib/analytics/observability";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function constantTimeTokenMatch(provided: string, expected: string): boolean {
  const digestProvided = crypto.createHash("sha256").update(provided, "utf8").digest();
  const digestExpected = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(digestProvided, digestExpected);
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { ...NO_STORE_HEADERS, Allow: "GET" } }
  );
}

export async function POST() {
  return methodNotAllowed();
}
export async function PUT() {
  return methodNotAllowed();
}
export async function PATCH() {
  return methodNotAllowed();
}
export async function DELETE() {
  return methodNotAllowed();
}

export async function GET(req: NextRequest) {
  const freezeRes = guardCutoverWrite("GET /api/cron/analytics-cleanup");
  if (freezeRes) return freezeRes;

  const startedAt = Date.now();
  const cronSecret = typeof process.env.CRON_SECRET === "string" ? process.env.CRON_SECRET.trim() : "";

  if (!cronSecret || cronSecret.length < 16) {
    logAnalyticsEvent("error", {
      event: "analytics_cleanup_failed",
      status: 503,
      errorCode: "CRON_SECRET_MISSING",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Cleanup configuration unavailable" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const providedToken = match ? match[1].trim() : "";

  if (!providedToken || !constantTimeTokenMatch(providedToken, cronSecret)) {
    logAnalyticsEvent("warn", {
      event: "analytics_cleanup_failed",
      status: 401,
      errorCode: "UNAUTHORIZED",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  if (process.env.VERCEL_ENV !== "production") {
    logAnalyticsEvent("warn", {
      event: "analytics_cleanup_failed",
      status: 503,
      errorCode: "NON_PRODUCTION_ENV",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Cleanup endpoint requires VERCEL_ENV=production" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  try {
    validateProductionCleanupTarget(process.env);
  } catch (err) {
    logAnalyticsEvent("error", {
      event: "analytics_cleanup_failed",
      status: 503,
      errorCode: err instanceof CleanupTargetError ? err.code : "CLEANUP_TARGET_INVALID",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Production database target validation failed" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  logAnalyticsEvent("info", {
    event: "analytics_cleanup_started",
    status: 200,
  });

  try {
    const db = getAsyncDb();
    const result = await runBoundedRawEventsCleanup({
      db,
      days: ANALYTICS_RAW_RETENTION_DAYS,
    });

    logAnalyticsEvent("info", {
      event: "analytics_cleanup_completed",
      status: 200,
      deletedCount: result.deletedCount,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    if (err instanceof CleanupAlreadyRunningError) {
      logAnalyticsEvent("warn", {
        event: "analytics_cleanup_failed",
        status: 409,
        errorCode: err.code,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Cleanup already in progress" },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    logAnalyticsEvent("error", {
      event: "analytics_cleanup_failed",
      status: 500,
      errorCode: "CLEANUP_EXECUTION_FAILED",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Cleanup execution failed" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
