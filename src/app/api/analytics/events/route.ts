import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, verifyCsrfOrigin } from "@/lib/auth";
import { getAsyncDb } from "@/lib/db";
import { isAnalyticsEnabled } from "@/lib/analytics/config";
import { logAnalyticsEvent } from "@/lib/analytics/observability";
import {
  AnalyticsSecretError,
  getActorHashSecret,
  ingestProductEvents,
} from "@/lib/analytics/productEvents";
import { evaluateAnalyticsEventRateLimit } from "@/lib/analytics/rateLimit";
import { validateProductEventBatch } from "@/lib/analytics/validation";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    if (!verifyCsrfOrigin(req)) {
      return NextResponse.json(
        { error: "Origin không hợp lệ" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload vượt quá giới hạn cho phép" },
        { status: 413, headers: NO_STORE_HEADERS }
      );
    }

    const rawText = await req.text();
    if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload vượt quá giới hạn cho phép" },
        { status: 413, headers: NO_STORE_HEADERS }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "JSON không hợp lệ" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const eventsRaw =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as { events?: unknown }).events
        : null;

    const validation = validateProductEventBatch(eventsRaw);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!isAnalyticsEnabled()) {
      return NextResponse.json(
        { ok: true, enabled: false, accepted: 0, deduped: 0 },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    try {
      getActorHashSecret();
    } catch (err) {
      logAnalyticsEvent("error", {
        event: "analytics_secret_invalid",
        status: 503,
        errorCode:
          err instanceof AnalyticsSecretError ? err.code : "ANALYTICS_SECRET_INVALID",
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Dịch vụ analytics chưa sẵn sàng" },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const session = getAuthSession(req);
    const rateLimit = await evaluateAnalyticsEventRateLimit({
      playerId: session?.playerId ?? null,
      headers: req.headers,
    });
    if (!rateLimit.allowed) {
      if (rateLimit.status === 503) {
        return NextResponse.json(
          { error: "Dịch vụ giới hạn tần suất analytics chưa sẵn sàng" },
          { status: 503, headers: NO_STORE_HEADERS }
        );
      }
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu analytics, vui lòng thử lại sau" },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    const actorRole: "guest" | "player" | "manager" = session
      ? session.accessRole === "manager"
        ? "manager"
        : "player"
      : "guest";

    const db = getAsyncDb();
    const result = await ingestProductEvents({
      db,
      events: validation.events,
      actorRole,
      playerId: session?.playerId ?? null,
    });

    return NextResponse.json(
      { ok: true, enabled: true, ...result },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    if (err instanceof AnalyticsSecretError) {
      logAnalyticsEvent("error", {
        event: "analytics_secret_invalid",
        status: 503,
        errorCode: err.code,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Dịch vụ analytics chưa sẵn sàng" },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }
    logAnalyticsEvent("error", {
      event: "analytics_event_ingestion_failed",
      status: 500,
      errorCode: "INGESTION_FAILED",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Không thể ghi nhận analytics events" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
