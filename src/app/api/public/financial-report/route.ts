import { NextRequest, NextResponse } from "next/server";
import { getFullAppData } from "@/lib/db";
import { buildPublicFinancialReport } from "@/lib/publicFinancialReport";

export async function GET(req: NextRequest) {
  try {
    const year = req.nextUrl.searchParams.get("year");
    const month = req.nextUrl.searchParams.get("month");

    const data = await getFullAppData();
    const report = buildPublicFinancialReport(data, { year, month });

    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("GET /api/public/financial-report error:", error);
    return NextResponse.json(
      { error: "Không thể tải báo cáo tài chính công khai" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
