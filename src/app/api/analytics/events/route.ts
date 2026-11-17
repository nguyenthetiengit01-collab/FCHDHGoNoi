import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, verifyCsrfOrigin } from "@/lib/auth";
import { getAsyncDb } from "@/lib/db";
import { isAnalyticsEnabled } from "@/lib/analytics/config";
import { ingestProductEvents } from "@/lib/analytics/productEvents";
import { validateProductEventBatch } from "@/lib/analytics/validation";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

const MAX_BODY_BYTES = 32 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 60;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkEventRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_MAX_REQUESTS) {
    return false;
  }
  bucket.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
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

    const session = getAuthSession(req);
    const rateKey = session
      ? `actor:${session.playerId}`
      : `ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon"}`;

    if (!checkEventRateLimit(rateKey)) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu analytics, vui lòng thử lại sau" },
        { status: 429, headers: NO_STORE_HEADERS }
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
  } catch (error) {
    console.error("POST /api/analytics/events error:", error);
    return NextResponse.json(
      { error: "Không thể ghi nhận analytics events" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
