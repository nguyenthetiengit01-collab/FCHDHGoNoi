import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as dbModule from "./db";
import * as authModule from "./auth";
import * as mediaStorageModule from "./media/storage";
import { GET as getHealthRoute } from "@/app/api/health/route";
import { GET as getTeamRoute, POST as postTeamRoute } from "@/app/api/team/route";
import { GET as getAuthRoute, POST as postAuthRoute } from "@/app/api/auth/route";
import { GET as getPublicFinancialReportRoute } from "@/app/api/public/financial-report/route";
import { GET as getCronAnalyticsCleanupRoute } from "@/app/api/cron/analytics-cleanup/route";
import { POST as postMediaClientUploadRoute } from "@/app/api/media/client-upload/route";
import { POST as postMediaClientUploadCallbackRoute } from "@/app/api/media/client-upload/callback/route";
import type { FullAppData } from "@/types/app";

type WafFreezeStage = "stage1_drain" | "stage2_closed";

/**
 * Simulates the Vercel Firewall / Edge WAF Deny rule documented in
 * docs/p103-production-cutover-plan.md during Two-Stage Cutover Freeze:
 *
 * - Stage 1 (Drain): Edge WAF Deny returns HTTP 403 for POST /api/* EXCEPT
 *   /api/media/client-upload/callback (allowing Vercel-signed callbacks to drain),
 *   and denies GET /api/cron/analytics-cleanup.
 * - Stage 2 (Closed): Edge WAF Deny returns HTTP 403 for ALL POST /api/*
 *   including /api/media/client-upload/callback.
 *
 * Distinct from application-level guardCutoverWrite() / guardCutoverCallbackWrite(),
 * which return HTTP 503 CUTOVER_WRITE_FROZEN.
 */
function shouldEdgeWafDeny(
  method: string,
  pathname: string,
  stage: WafFreezeStage
): boolean {
  const upperMethod = method.toUpperCase();
  if (upperMethod === "POST" && pathname.startsWith("/api/")) {
    if (
      stage === "stage1_drain" &&
      pathname === "/api/media/client-upload/callback"
    ) {
      return false;
    }
    return true;
  }
  if (upperMethod === "GET" && pathname === "/api/cron/analytics-cleanup") {
    return true;
  }
  return false;
}

async function dispatchThroughEdgeWaf(
  req: NextRequest,
  stage: WafFreezeStage,
  appHandler: (r: NextRequest) => Promise<Response>
): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (shouldEdgeWafDeny(req.method, pathname, stage)) {
    return NextResponse.json(
      { error: "Forbidden by Edge WAF Cutover Freeze Policy" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  return appHandler(req);
}

function makeMinimalFullAppData(): FullAppData {
  return {
    settings: {
      id: 1,
      team_name: "FC HĐH Gò Nổi tại TP.HCM",
      short_name: "GÒ NỔI FC",
      default_match_fee: 100000,
      bank_bin: "970422",
      bank_name: "MB Bank",
      bank_account_no: "0000",
      bank_account_name: "FC GO NOI",
      tournament_fund_reserve: 0,
      tournament_fund_note: "",
      fanpage_url: "",
    },
    players: [],
    matches: [],
    attendances: [],
    otherIncomes: [],
    expenses: [],
    posts: [],
    sponsors: [],
    summary: {
      totalMatchIncome: 0,
      totalOtherIncome: 0,
      totalIncome: 0,
      totalExpense: 0,
      currentBalance: 0,
      totalUnpaidAmount: 0,
      categoryBreakdown: [],
    },
  };
}

describe("WAF-level edge barrier integration assertions (HTTP 403 Deny vs app-level 503)", () => {
  const originalFreezeEnv = process.env.P103_CUTOVER_FREEZE_WRITES;
  const originalCallbackFreezeEnv = process.env.P103_CUTOVER_FREEZE_CALLBACKS;

  beforeEach(() => {
    delete process.env.P103_CUTOVER_FREEZE_WRITES;
    delete process.env.P103_CUTOVER_FREEZE_CALLBACKS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFreezeEnv === undefined) {
      delete process.env.P103_CUTOVER_FREEZE_WRITES;
    } else {
      process.env.P103_CUTOVER_FREEZE_WRITES = originalFreezeEnv;
    }
    if (originalCallbackFreezeEnv === undefined) {
      delete process.env.P103_CUTOVER_FREEZE_CALLBACKS;
    } else {
      process.env.P103_CUTOVER_FREEZE_CALLBACKS = originalCallbackFreezeEnv;
    }
  });

  it("Stage 1 Drain: blocks POST /api/* (403) before app handlers while allowing /api/media/client-upload/callback through Edge WAF", async () => {
    const getAsyncDbSpy = vi.spyOn(dbModule, "getAsyncDb");
    const verifyCredsSpy = vi.spyOn(authModule, "verifyCredentials");
    const getMediaProviderSpy = vi.spyOn(
      mediaStorageModule,
      "getMediaStorageProvider"
    );

    const postTargets: Array<{
      url: string;
      handler: (r: NextRequest) => Promise<Response>;
    }> = [
      { url: "http://localhost:3000/api/team", handler: postTeamRoute },
      { url: "http://localhost:3000/api/auth", handler: postAuthRoute },
      {
        url: "http://localhost:3000/api/media/client-upload",
        handler: postMediaClientUploadRoute,
      },
    ];

    for (const target of postTargets) {
      const req = new NextRequest(target.url, { method: "POST" });
      const res = await dispatchThroughEdgeWaf(
        req,
        "stage1_drain",
        target.handler
      );
      expect(res.status).toBe(403);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }

    const cronRes = await dispatchThroughEdgeWaf(
      new NextRequest("http://localhost:3000/api/cron/analytics-cleanup", {
        method: "GET",
      }),
      "stage1_drain",
      getCronAnalyticsCleanupRoute
    );
    expect(cronRes.status).toBe(403);

    // Callback route passes through Edge WAF in Stage 1 (reaches app handler, which rejects unsigned body with 403/401, not WAF 403)
    const callbackReq = new NextRequest(
      "http://localhost:3000/api/media/client-upload/callback",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "blob.generate-client-token" }),
      }
    );
    const callbackRes = await dispatchThroughEdgeWaf(
      callbackReq,
      "stage1_drain",
      postMediaClientUploadCallbackRoute
    );
    const callbackJson = (await callbackRes.json()) as { code?: string };
    expect(callbackRes.status).toBe(403);
    expect(callbackJson.code).toBe("CALLBACK_TOKEN_GENERATION_FORBIDDEN");

    expect(getAsyncDbSpy).not.toHaveBeenCalled();
    expect(verifyCredsSpy).not.toHaveBeenCalled();
    expect(getMediaProviderSpy).not.toHaveBeenCalled();
  });

  it("Stage 2 Closed: blocks /api/media/client-upload/callback with HTTP 403 at Edge WAF before app handler runs", async () => {
    const callbackRes = await dispatchThroughEdgeWaf(
      new NextRequest("http://localhost:3000/api/media/client-upload/callback", {
        method: "POST",
      }),
      "stage2_closed",
      postMediaClientUploadCallbackRoute
    );
    expect(callbackRes.status).toBe(403);
    const json = (await callbackRes.json()) as { error: string };
    expect(json.error).toContain("Edge WAF");
  });

  it("allows read-only GET routes through Edge WAF (200 OK)", async () => {
    vi.spyOn(dbModule, "pingDatabase").mockResolvedValue({
      ok: true,
      latencyMs: 1,
    });
    vi.spyOn(dbModule, "getFullAppData").mockResolvedValue(
      makeMinimalFullAppData()
    );

    const healthRes = await dispatchThroughEdgeWaf(
      new NextRequest("http://localhost:3000/api/health", { method: "GET" }),
      "stage2_closed",
      () => getHealthRoute()
    );
    expect(healthRes.status).toBe(200);

    const teamRes = await dispatchThroughEdgeWaf(
      new NextRequest("http://localhost:3000/api/team", { method: "GET" }),
      "stage2_closed",
      getTeamRoute
    );
    expect(teamRes.status).toBe(200);

    const authRes = await dispatchThroughEdgeWaf(
      new NextRequest("http://localhost:3000/api/auth", { method: "GET" }),
      "stage2_closed",
      getAuthRoute
    );
    expect(authRes.status).toBe(200);

    const reportRes = await dispatchThroughEdgeWaf(
      new NextRequest("http://localhost:3000/api/public/financial-report", {
        method: "GET",
      }),
      "stage2_closed",
      getPublicFinancialReportRoute
    );
    expect(reportRes.status).toBe(200);
  });
});
