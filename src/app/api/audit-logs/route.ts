import { NextRequest, NextResponse } from "next/server";
import { requireManagerSession } from "@/lib/auth";
import { getAuditLogs } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireManagerSession(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const rawLimit = Number(req.nextUrl.searchParams.get("limit") || "50");
    const logs = await getAuditLogs(Number.isFinite(rawLimit) ? rawLimit : 50);
    return NextResponse.json(
      { logs },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    return NextResponse.json(
      { error: "Không thể tải nhật ký thao tác quản trị" },
      { status: 500 }
    );
  }
}
