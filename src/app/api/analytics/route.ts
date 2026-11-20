import { NextRequest, NextResponse } from "next/server";
import { requirePlayerSession } from "@/lib/auth";
import { getAsyncDb, recordAuditLog } from "@/lib/db";
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
    const auth = await requirePlayerSession(req);
    if (!auth.authorized || !auth.player) {
      return NextResponse.json(
        { error: auth.error || "Vui lòng đăng nhập để truy cập dữ liệu phân tích" },
        { status: auth.status, headers: NO_STORE_HEADERS }
      );
    }

    const accessRole = auth.player.access_role;
    const playerId = auth.player.id;
    const fullName = auth.player.full_name;

    const searchParams = req.nextUrl.searchParams;
    const section = parseSection(searchParams.get("section"));
    if (!section) {
      return NextResponse.json(
        { error: "Section analytics không hợp lệ" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (accessRole !== "manager" && MANAGER_ONLY_SECTIONS.has(section)) {
      return NextResponse.json(
        { error: "Chỉ Ban Quản Lý mới có quyền xem phân hệ phân tích này" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const requestedPlayerIdRaw = searchParams.get("playerId");
    if (
      accessRole !== "manager" &&
      requestedPlayerIdRaw !== null &&
      requestedPlayerIdRaw !== "" &&
      Number(requestedPlayerIdRaw) !== playerId
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
        ? accessRole === "manager" && requestedPlayerIdRaw
          ? Number(requestedPlayerIdRaw)
          : playerId
        : playerId;

    if (
      section === "my-insights" &&
      accessRole === "manager" &&
      requestedPlayerIdRaw &&
      Number(requestedPlayerIdRaw) !== playerId
    ) {
      await recordAuditLog({
        actorId: playerId,
        actorName: fullName,
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
