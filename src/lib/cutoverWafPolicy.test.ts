import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as dbModule from "./db";
import * as authModule from "./auth";
import * as mediaStorageModule from "./media/storage";
import { CUTOVER_FREEZE_ERROR_CODE } from "./cutoverFreeze";
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
 * In-test simulation of the Vercel Firewall / Edge WAF Deny policy documented in
 * docs/p103-production-cutover-plan.md (NOT live Vercel Firewall verification).
 *
 * - Stage 1 (Drain): Edge WAF Deny returns HTTP 403 for POST /api/* EXCEPT BOTH
 *   callback paths (/api/media/client-upload and /api/media/client-upload/callback),
 *   because the Edge WAF cannot inspect JSON body.type to distinguish
 *   blob.generate-client-token from blob.upload-completed on the legacy endpoint;
 *   it also denies GET /api/cron/analytics-cleanup.
 * - Stage 2 (Closed): Edge WAF Deny returns HTTP 403 for ALL POST /api/*
 *   including both /api/media/client-upload and /api/media/client-upload/callback.
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
      (pathname === "/api/media/client-upload/callback" ||
        pathname === "/api/media/client-upload")
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

function signVercelBlobCallback(body: unknown, token: string): string {
  return crypto
    .createHmac("sha256", token)
    .update(JSON.stringify(body))
    .digest("hex");
}

function createInMemoryMediaDb(sqlite: import("node:sqlite").DatabaseSync) {
  const adapter: ReturnType<typeof dbModule.getAsyncDb> = {
    async query<T>(sql: string, params: unknown[] = []) {
      return sqlite
        .prepare(sql)
        .all(...(params as Array<string | number | null>)) as T[];
    },
    async queryOne<T>(sql: string, params: unknown[] = []) {
      const row = sqlite
        .prepare(sql)
        .get(...(params as Array<string | number | null>));
      return (row as T | undefined) ?? null;
    },
    async run(sql: string, params: unknown[] = []) {
      const res = sqlite
        .prepare(sql)
        .run(...(params as Array<string | number | null>));
      return {
        lastInsertRowid: Number(res.lastInsertRowid),
        changes: Number(res.changes),
      };
    },
    async batch() {},
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    async transaction<T>(
      fn: (tx: ReturnType<typeof dbModule.getAsyncDb>) => Promise<T>
    ) {
      return fn(adapter);
    },
  } as unknown as ReturnType<typeof dbModule.getAsyncDb>;
  return adapter;
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

describe("In-test Edge WAF policy simulation (HTTP 403 Deny vs app-level 503; live Vercel Firewall verified separately)", () => {
  const originalFreezeEnv = process.env.P103_CUTOVER_FREEZE_WRITES;
  const originalCallbackFreezeEnv = process.env.P103_CUTOVER_FREEZE_CALLBACKS;
  const originalMediaEnabled = process.env.MEDIA_STORAGE_ENABLED;
  const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;

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
    if (originalMediaEnabled === undefined) {
      delete process.env.MEDIA_STORAGE_ENABLED;
    } else {
      process.env.MEDIA_STORAGE_ENABLED = originalMediaEnabled;
    }
    if (originalBlobToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
    }
  });

  it("Stage 1 Drain: WAF denies mutating POST /api/* & cron GET (403), allows BOTH callback paths through, while app blocks token-gen (503 legacy / 403 new) and persists signed callbacks", async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const sqlite = new DatabaseSync(":memory:");
    const adapter = createInMemoryMediaDb(sqlite);
    const getAsyncDbSpy = vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter);
    const verifyCredsSpy = vi.spyOn(authModule, "verifyCredentials");
    const getMediaProviderSpy = vi.spyOn(
      mediaStorageModule,
      "getMediaStorageProvider"
    );

    const rwToken = "vercel_blob_rw_mockstore123_secret456";
    process.env.P103_CUTOVER_FREEZE_WRITES = "true";
    process.env.MEDIA_STORAGE_ENABLED = "true";
    process.env.BLOB_READ_WRITE_TOKEN = rwToken;

    try {
      // 1. Other mutating POST /api/* and cron GET are blocked at Edge WAF with 403 before handlers run
      for (const url of [
        "http://localhost:3000/api/team",
        "http://localhost:3000/api/auth",
      ]) {
        const res = await dispatchThroughEdgeWaf(
          new NextRequest(url, { method: "POST" }),
          "stage1_drain",
          url.endsWith("/team") ? postTeamRoute : postAuthRoute
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
      expect(verifyCredsSpy).not.toHaveBeenCalled();
      expect(getMediaProviderSpy).not.toHaveBeenCalled();

      // 2. Legacy /api/media/client-upload passes Stage 1 WAF, but app blocks token-gen with 503 CUTOVER_WRITE_FROZEN
      const legacyTokenRes = await dispatchThroughEdgeWaf(
        new NextRequest("http://localhost:3000/api/media/client-upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "blob.generate-client-token" }),
        }),
        "stage1_drain",
        postMediaClientUploadRoute
      );
      expect(legacyTokenRes.status).toBe(503);
      expect(((await legacyTokenRes.json()) as { code?: string }).code).toBe(
        CUTOVER_FREEZE_ERROR_CODE
      );

      // 3. New /api/media/client-upload/callback passes Stage 1 WAF, app rejects token-gen with 403 CALLBACK_TOKEN_GENERATION_FORBIDDEN
      const newTokenRes = await dispatchThroughEdgeWaf(
        new NextRequest(
          "http://localhost:3000/api/media/client-upload/callback",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "blob.generate-client-token" }),
          }
        ),
        "stage1_drain",
        postMediaClientUploadCallbackRoute
      );
      expect(newTokenRes.status).toBe(403);
      expect(((await newTokenRes.json()) as { code?: string }).code).toBe(
        "CALLBACK_TOKEN_GENERATION_FORBIDDEN"
      );
      expect(getAsyncDbSpy).not.toHaveBeenCalled();

      // 4. Valid signed blob.upload-completed succeeds on BOTH legacy and new paths through Stage 1 WAF
      const legacyCallbackBody = {
        type: "blob.upload-completed",
        payload: {
          blob: {
            url: "https://mockstore123.public.blob.vercel-storage.com/public-media/uploads/player/waf-legacy.webp",
            downloadUrl:
              "https://mockstore123.public.blob.vercel-storage.com/public-media/uploads/player/waf-legacy.webp?download=1",
            pathname: "public-media/uploads/player/waf-legacy.webp",
            contentType: "image/webp",
            contentDisposition: 'inline; filename="waf-legacy.webp"',
          },
          tokenPayload: JSON.stringify({
            entity: "player",
            uploadedByPlayerId: 7,
          }),
        },
      };
      const legacyOkRes = await dispatchThroughEdgeWaf(
        new NextRequest("http://localhost:3000/api/media/client-upload", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-vercel-signature": signVercelBlobCallback(
              legacyCallbackBody,
              rwToken
            ),
          },
          body: JSON.stringify(legacyCallbackBody),
        }),
        "stage1_drain",
        postMediaClientUploadRoute
      );
      expect(legacyOkRes.status).toBe(200);
      expect(await legacyOkRes.json()).toEqual({
        type: "blob.upload-completed",
        response: "ok",
      });

      const newCallbackBody = {
        type: "blob.upload-completed",
        payload: {
          blob: {
            url: "https://mockstore123.public.blob.vercel-storage.com/public-media/uploads/post/waf-new.webp",
            downloadUrl:
              "https://mockstore123.public.blob.vercel-storage.com/public-media/uploads/post/waf-new.webp?download=1",
            pathname: "public-media/uploads/post/waf-new.webp",
            contentType: "image/webp",
            contentDisposition: 'inline; filename="waf-new.webp"',
          },
          tokenPayload: JSON.stringify({
            entity: "post",
            playerId: null,
            uploadedByPlayerId: 1,
            issuedAt: Date.now() - 2000,
            expiresAt: Date.now() + 58_000,
          }),
        },
      };
      const newOkRes = await dispatchThroughEdgeWaf(
        new NextRequest(
          "http://localhost:3000/api/media/client-upload/callback",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-vercel-signature": signVercelBlobCallback(
                newCallbackBody,
                rwToken
              ),
            },
            body: JSON.stringify(newCallbackBody),
          }
        ),
        "stage1_drain",
        postMediaClientUploadCallbackRoute
      );
      expect(newOkRes.status).toBe(200);
      expect(await newOkRes.json()).toEqual({
        type: "blob.upload-completed",
        response: "ok",
      });

      const total = sqlite
        .prepare("SELECT COUNT(*) as cnt FROM media_upload_records")
        .get() as { cnt: number };
      expect(total.cnt).toBe(2);
    } finally {
      sqlite.close();
    }
  });

  it("Stage 2 Closed: Edge WAF denies BOTH /api/media/client-upload and /api/media/client-upload/callback with HTTP 403 before app handlers run", async () => {
    const getAsyncDbSpy = vi.spyOn(dbModule, "getAsyncDb");

    for (const target of [
      {
        url: "http://localhost:3000/api/media/client-upload",
        handler: postMediaClientUploadRoute,
      },
      {
        url: "http://localhost:3000/api/media/client-upload/callback",
        handler: postMediaClientUploadCallbackRoute,
      },
    ]) {
      const res = await dispatchThroughEdgeWaf(
        new NextRequest(target.url, { method: "POST" }),
        "stage2_closed",
        target.handler
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toContain("Edge WAF");
    }

    expect(getAsyncDbSpy).not.toHaveBeenCalled();
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
