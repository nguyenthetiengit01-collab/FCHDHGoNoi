import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getAsyncDb, recordAuditLog } from "@/lib/db";
import { isCutoverWriteFrozen } from "@/lib/cutoverFreeze";
import { ANALYTICS_TIMEZONE, isAnalyticsEnabled } from "@/lib/analytics/config";
import { queryAnalyticsSection } from "@/lib/analytics/queries";
import {
  parseSection,
  resolveAnalyticsPeriod,
} from "@/lib/analytics/validation";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

const MANAGER_ONLY_SECTIONS = new Set([
  "finance",
  "sponsors",
  "community",
  "product",
]);

export async function GET(req: NextRequest) {
  try {
    const session = getAuthSession(req);
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để truy cập dữ liệu phân tích" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const section = parseSection(searchParams.get("section"));
    if (!section) {
      return NextResponse.json(
        { error: "Section analytics không hợp lệ" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (session.accessRole !== "manager" && MANAGER_ONLY_SECTIONS.has(section)) {
      return NextResponse.json(
        { error: "Chỉ Ban Quản Lý mới có quyền xem phân hệ phân tích này" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const requestedPlayerIdRaw = searchParams.get("playerId");
    if (
      session.accessRole !== "manager" &&
      requestedPlayerIdRaw !== null &&
      requestedPlayerIdRaw !== "" &&
      Number(requestedPlayerIdRaw) !== session.playerId
    ) {
      return NextResponse.json(
        { error: "Không được phép truy cập thống kê cá nhân của cầu thủ khác" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const periodResult = resolveAnalyticsPeriod({
      preset: searchParams.get("preset"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });
    if (!periodResult.ok) {
      return NextResponse.json(
        { error: periodResult.error },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!isAnalyticsEnabled()) {
      return NextResponse.json(
        {
          enabled: false,
          section,
          generatedAt: new Date().toISOString(),
          timezone: ANALYTICS_TIMEZONE,
          period: periodResult.period,
          coverage: {
            baselineAt: null,
            rate: null,
            eligibleRecords: 0,
            knownRecords: 0,
            missingRecords: 0,
            isLowCoverage: true,
            limitations: ["Tính năng Analytics đang tắt (ANALYTICS_ENABLED=false)."],
          },
          data: null,
          message: "Analytics đang ở trạng thái tắt theo cấu hình feature flag.",
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    const targetPlayerId =
      section === "my-insights"
        ? session.accessRole === "manager" && requestedPlayerIdRaw
          ? Number(requestedPlayerIdRaw)
          : session.playerId
        : session.playerId;

    if (
      section === "my-insights" &&
      session.accessRole === "manager" &&
      requestedPlayerIdRaw &&
      Number(requestedPlayerIdRaw) !== session.playerId &&
      !isCutoverWriteFrozen()
    ) {
      await recordAuditLog({
        actorId: session.playerId,
        actorName: session.fullName,
        actorRole: "manager",
        action: "view_player_insights",
        summary: `Xem thống kê cá nhân cầu thủ #${Number(requestedPlayerIdRaw)}`,
      });
    }

    const comparePrevious = searchParams.get("compare") === "previous";
    const db = getAsyncDb();
    const envelope = await queryAnalyticsSection({
      db,
      section,
      period: periodResult.period,
      comparePrevious,
      playerId: targetPlayerId,
    });

    return NextResponse.json(envelope, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("GET /api/analytics error:", error);
    return NextResponse.json(
      { error: "Không thể tải dữ liệu phân tích" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
