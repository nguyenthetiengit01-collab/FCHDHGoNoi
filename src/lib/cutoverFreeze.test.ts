import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_UPLOAD_TOKEN_TTL_MS,
  CUTOVER_FREEZE_ERROR_CODE,
  CUTOVER_FREEZE_ERROR_MESSAGE,
  CUTOVER_FREEZE_RETRY_AFTER_SECONDS,
  createCutoverFreezeResponse,
  guardCutoverCallbackWrite,
  guardCutoverWrite,
  isCutoverCallbackFrozen,
  isCutoverWriteFrozen,
} from "./cutoverFreeze";
import crypto from "node:crypto";
import * as dbModule from "./db";
import * as authModule from "./auth";
import * as mediaStorageModule from "./media/storage";
import { POST as postTeamRoute, GET as getTeamRoute } from "@/app/api/team/route";
import { POST as postAuthRoute, GET as getAuthRoute } from "@/app/api/auth/route";
import { POST as postImportRoute } from "@/app/api/import/route";
import { POST as postMediaUploadRoute } from "@/app/api/media/upload/route";
import { POST as postMediaClientUploadRoute } from "@/app/api/media/client-upload/route";
import { POST as postMediaClientUploadCallbackRoute } from "@/app/api/media/client-upload/callback/route";
import { getPayloadFromClientToken } from "@vercel/blob/client";
import { POST as postWebpRoute } from "@/app/api/webp/route";
import { POST as postAnalyticsEventsRoute } from "@/app/api/analytics/events/route";
import { GET as getCronAnalyticsCleanupRoute } from "@/app/api/cron/analytics-cleanup/route";
import { GET as getHealthRoute } from "@/app/api/health/route";
import { GET as getPublicFinancialReportRoute } from "@/app/api/public/financial-report/route";
import { GET as getAnalyticsRoute } from "@/app/api/analytics/route";
import type { FullAppData } from "@/types/app";

const TEST_AUTH_SECRET = "cutover-freeze-test-auth-secret-32-chars-min!";

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

function makeRequest(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): NextRequest {
  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      ...(init?.headers ?? {}),
    },
    body: init?.body,
  });
}

async function expectFrozen503(res: Response) {
  expect(res.status).toBe(503);
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  expect(res.headers.get("Retry-After")).toBe(
    String(CUTOVER_FREEZE_RETRY_AFTER_SECONDS)
  );
  const json = await res.json();
  expect(json).toEqual({
    error: CUTOVER_FREEZE_ERROR_MESSAGE,
    code: CUTOVER_FREEZE_ERROR_CODE,
    retryAfterSeconds: CUTOVER_FREEZE_RETRY_AFTER_SECONDS,
  });
}

describe("cutoverFreeze (P1-03 write freeze & cutover safety)", () => {
  const originalFreezeEnv = process.env.P103_CUTOVER_FREEZE_WRITES;
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalCronSecret = process.env.CRON_SECRET;
  const originalAnalyticsEnabled = process.env.ANALYTICS_ENABLED;

  beforeEach(() => {
    delete process.env.P103_CUTOVER_FREEZE_WRITES;
    process.env.AUTH_SECRET = TEST_AUTH_SECRET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFreezeEnv === undefined) {
      delete process.env.P103_CUTOVER_FREEZE_WRITES;
    } else {
      process.env.P103_CUTOVER_FREEZE_WRITES = originalFreezeEnv;
    }
    if (originalAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalAuthSecret;
    }
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
    if (originalAnalyticsEnabled === undefined) {
      delete process.env.ANALYTICS_ENABLED;
    } else {
      process.env.ANALYTICS_ENABLED = originalAnalyticsEnabled;
    }
  });

  describe("helper functions", () => {
    it("isCutoverWriteFrozen returns true only when P103_CUTOVER_FREEZE_WRITES trims to 'true'", () => {
      expect(isCutoverWriteFrozen({})).toBe(false);
      expect(isCutoverWriteFrozen({ P103_CUTOVER_FREEZE_WRITES: "false" })).toBe(false);
      expect(isCutoverWriteFrozen({ P103_CUTOVER_FREEZE_WRITES: "1" })).toBe(false);
      expect(isCutoverWriteFrozen({ P103_CUTOVER_FREEZE_WRITES: "" })).toBe(false);
      expect(isCutoverWriteFrozen({ P103_CUTOVER_FREEZE_WRITES: "true" })).toBe(true);
      expect(isCutoverWriteFrozen({ P103_CUTOVER_FREEZE_WRITES: "  true  " })).toBe(true);
    });

    it("createCutoverFreezeResponse returns 503 with required JSON and headers", async () => {
      const res = createCutoverFreezeResponse("POST /api/team");
      await expectFrozen503(res);
    });

    it("guardCutoverWrite returns null when unfrozen and 503 NextResponse when frozen", async () => {
      expect(
        guardCutoverWrite("POST /api/team", {
          P103_CUTOVER_FREEZE_WRITES: "false",
        })
      ).toBeNull();

      const frozen = guardCutoverWrite("POST /api/team", {
        P103_CUTOVER_FREEZE_WRITES: "true",
      });
      expect(frozen).not.toBeNull();
      await expectFrozen503(frozen!);
    });
  });

  describe("when P103_CUTOVER_FREEZE_WRITES=true", () => {
    beforeEach(() => {
      process.env.P103_CUTOVER_FREEZE_WRITES = "true";
    });

    it("blocks all mutating/side-effect routes with 503 CUTOVER_WRITE_FROZEN and zero DB/blob writes", async () => {
      const getAsyncDbSpy = vi.spyOn(dbModule, "getAsyncDb");
      const recordAuditLogSpy = vi.spyOn(dbModule, "recordAuditLog");
      const verifyCredsSpy = vi.spyOn(authModule, "verifyCredentials");
      const getMediaProviderSpy = vi.spyOn(
        mediaStorageModule,
        "getMediaStorageProvider"
      );

      const postTeamRes = await postTeamRoute(
        makeRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "upsert_player", payload: {} }),
        })
      );
      await expectFrozen503(postTeamRes);

      const postAuthRes = await postAuthRoute(
        makeRequest("http://localhost:3000/api/auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "login", username: "1", pin: "1234" }),
        })
      );
      await expectFrozen503(postAuthRes);

      const postImportRes = await postImportRoute(
        makeRequest("http://localhost:3000/api/import", {
          method: "POST",
        })
      );
      await expectFrozen503(postImportRes);

      const postMediaUploadRes = await postMediaUploadRoute(
        makeRequest("http://localhost:3000/api/media/upload", {
          method: "POST",
        })
      );
      await expectFrozen503(postMediaUploadRes);

      const postMediaClientUploadRes = await postMediaClientUploadRoute(
        makeRequest("http://localhost:3000/api/media/client-upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "blob.generate-client-token" }),
        })
      );
      await expectFrozen503(postMediaClientUploadRes);

      const postWebpRes = await postWebpRoute(
        makeRequest("http://localhost:3000/api/webp", {
          method: "POST",
        })
      );
      await expectFrozen503(postWebpRes);

      const postAnalyticsEventsRes = await postAnalyticsEventsRoute(
        makeRequest("http://localhost:3000/api/analytics/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ events: [] }),
        })
      );
      await expectFrozen503(postAnalyticsEventsRes);

      const getCronCleanupRes = await getCronAnalyticsCleanupRoute(
        makeRequest("http://localhost:3000/api/cron/analytics-cleanup", {
          method: "GET",
          headers: { authorization: "Bearer test-cron-secret-123456" },
        })
      );
      await expectFrozen503(getCronCleanupRes);

      expect(getAsyncDbSpy).not.toHaveBeenCalled();
      expect(recordAuditLogSpy).not.toHaveBeenCalled();
      expect(verifyCredsSpy).not.toHaveBeenCalled();
      expect(getMediaProviderSpy).not.toHaveBeenCalled();
    });

    it("keeps read-only routes working (GET /api/health, /api/public/financial-report, /api/team, /api/auth, /api/analytics)", async () => {
      vi.spyOn(dbModule, "pingDatabase").mockResolvedValue({
        ok: true,
        latencyMs: 2,
      });
      vi.spyOn(dbModule, "getFullAppData").mockResolvedValue(
        makeMinimalFullAppData()
      );

      const healthRes = await getHealthRoute();
      expect(healthRes.status).toBe(200);
      const healthJson = await healthRes.json();
      expect(healthJson.status).toBe("ok");
      expect(healthJson.db).toBe("connected");

      const reportRes = await getPublicFinancialReportRoute(
        makeRequest("http://localhost:3000/api/public/financial-report")
      );
      expect(reportRes.status).toBe(200);
      const reportJson = await reportRes.json();
      expect(reportJson).toHaveProperty("summary");

      const teamRes = await getTeamRoute(
        makeRequest("http://localhost:3000/api/team")
      );
      expect(teamRes.status).toBe(200);
      const teamJson = await teamRes.json();
      expect(teamJson).toHaveProperty("players");

      const authRes = await getAuthRoute(
        makeRequest("http://localhost:3000/api/auth")
      );
      expect(authRes.status).toBe(200);
      const authJson = await authRes.json();
      expect(authJson).toEqual({ authenticated: false, player: null });

      process.env.ANALYTICS_ENABLED = "false";
      const token = authModule.createSessionToken(
        {
          id: 1,
          code_order: 1,
          full_name: "Manager Test",
          short_name: "Mgr",
          jersey_number: 1,
          position: "MF",
          birth_year: "1995",
          phone: "",
          role: "Đội trưởng",
          status: "active",
          access_role: "manager",
          pin_code: authModule.hashPassword("MgrStrong@2026"),
          notes: "",
          hometown: "Điện Phong",
          nickname: "",
          playing_style: "",
          bio: "",
          avatar_url: "",
          profile_image_url: "",
          gallery_urls: [],
        },
        1
      );
      const analyticsReq = new NextRequest(
        "http://localhost:3000/api/analytics?section=overview",
        {
          method: "GET",
          headers: {
            cookie: `${authModule.SESSION_COOKIE_NAME}=${token}`,
          },
        }
      );
      const analyticsRes = await getAnalyticsRoute(analyticsReq);
      expect(analyticsRes.status).toBe(200);
      const analyticsJson = await analyticsRes.json();
      expect(analyticsJson.enabled).toBe(false);
    });

    it("remains backward-compatible on legacy schema (without must_change_pin) while frozen and skips DDL/audit writes", async () => {
      const { DatabaseSync } = await import("node:sqlite");
      const legacyDb = new DatabaseSync(":memory:");
      try {
        legacyDb.exec(`
          CREATE TABLE team_settings (id INTEGER PRIMARY KEY, team_name TEXT, short_name TEXT, default_match_fee INTEGER, bank_bin TEXT, bank_name TEXT, bank_account_no TEXT, bank_account_name TEXT, tournament_fund_reserve INTEGER, tournament_fund_note TEXT, fanpage_url TEXT);
          INSERT INTO team_settings (id, team_name, short_name, default_match_fee, bank_bin, bank_name, bank_account_no, bank_account_name, tournament_fund_reserve, tournament_fund_note, fanpage_url)
          VALUES (1, 'FC Go Noi', 'GNFC', 100000, '970422', 'MB', '123', 'TEST', 0, '', 'https://example.com');
          CREATE TABLE players (id INTEGER PRIMARY KEY, code_order INTEGER, full_name TEXT, short_name TEXT, jersey_number INTEGER, position TEXT, phone TEXT, birth_year TEXT, avatar_url TEXT, profile_image_url TEXT, bio TEXT, role TEXT, access_role TEXT, username TEXT, pin_code TEXT, status TEXT, notes TEXT, hometown TEXT, nickname TEXT, playing_style TEXT, gallery_urls_json TEXT);
          INSERT INTO players (id, code_order, full_name, short_name, jersey_number, position, phone, birth_year, avatar_url, profile_image_url, bio, role, access_role, username, pin_code, status, notes, hometown, nickname, playing_style, gallery_urls_json)
          VALUES (1, 1, 'Manager Legacy', 'Mgr', 1, 'MF', '0901', '1995', '', '', '', 'Đội trưởng', 'manager', 'mgr1', '${authModule.hashPassword("MgrStrong@2026")}', 'Đang sinh hoạt', '', 'Điện Phong', '', '', '[]');
          CREATE TABLE matches (id INTEGER PRIMARY KEY, match_number INTEGER, label TEXT, match_date TEXT, kickoff_time TEXT, venue TEXT, opponent TEXT, fee_per_player INTEGER, pitch_cost INTEGER, payer_name TEXT, team_score INTEGER, opponent_score INTEGER, status TEXT, notes TEXT);
          CREATE TABLE match_attendances (id INTEGER PRIMARY KEY, match_id INTEGER, player_id INTEGER, rsvp_status TEXT, attended INTEGER, paid INTEGER, amount INTEGER, walk_in INTEGER, collected_by TEXT, note TEXT);
          CREATE TABLE other_incomes (id INTEGER PRIMARY KEY, income_date TEXT, source TEXT, amount INTEGER, note TEXT);
          CREATE TABLE expenses (id INTEGER PRIMARY KEY, expense_date TEXT, category TEXT, description TEXT, amount INTEGER, payer_name TEXT, match_id INTEGER, note TEXT);
          CREATE TABLE club_posts (id TEXT PRIMARY KEY, category TEXT, category_label TEXT, category_badge_class TEXT, title TEXT, slug TEXT, summary TEXT, published_date TEXT, event_year TEXT, author TEXT, featured_image TEXT, gallery_images_json TEXT, reading_time TEXT, paragraphs_json TEXT, quote TEXT, highlights_json TEXT, tagged_players_json TEXT);
          CREATE TABLE sponsors (id INTEGER PRIMARY KEY, name TEXT, tier TEXT, logo_url TEXT, banner_url TEXT, website_url TEXT, description TEXT, start_date TEXT, end_date TEXT, display_positions_json TEXT, is_active INTEGER, sort_order INTEGER, note TEXT, created_at TEXT);
        `);

        const executedSql: string[] = [];
        const adapter = {
          async query<T>(sql: string, params: unknown[] = []) {
            executedSql.push(sql);
            return legacyDb.prepare(sql).all(...(params as Array<string | number | null>)) as T[];
          },
          async queryOne<T>(sql: string, params: unknown[] = []) {
            executedSql.push(sql);
            const row = legacyDb.prepare(sql).get(...(params as Array<string | number | null>));
            return (row as T | undefined) ?? null;
          },
          async run(sql: string, params: unknown[] = []) {
            executedSql.push(sql);
            const res = legacyDb.prepare(sql).run(...(params as Array<string | number | null>));
            return { lastInsertRowid: Number(res.lastInsertRowid), changes: Number(res.changes) };
          },
          async batch(stmts: Array<{ sql: string; params?: unknown[] }>) {
            for (const s of stmts) executedSql.push(s.sql);
          },
          async exec(sql: string) {
            executedSql.push(sql);
            legacyDb.exec(sql);
          },
          async transaction<T>(fn: (tx: ReturnType<typeof dbModule.getAsyncDb>) => Promise<T>) {
            return fn(adapter);
          },
        } as unknown as ReturnType<typeof dbModule.getAsyncDb>;
        vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter);

        // 1. Read-only GET /api/team works on legacy schema without must_change_pin & executes zero DDL/DML
        const teamRes = await getTeamRoute(makeRequest("http://localhost:3000/api/team"));
        expect(teamRes.status).toBe(200);
        const ddlOrDml = executedSql.filter((s) => /\b(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i.test(s));
        expect(ddlOrDml).toEqual([]);

        // 2. GET /api/auth works for authenticated legacy session (falls back to must_change_pin=0)
        const legacyPlayer = legacyDb.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Parameters<typeof authModule.createSessionToken>[0];
        const token = authModule.createSessionToken(legacyPlayer, 1);
        const authRes = await getAuthRoute(
          makeRequest("http://localhost:3000/api/auth", {
            headers: { cookie: `${authModule.SESSION_COOKIE_NAME}=${token}` },
          })
        );
        expect(authRes.status).toBe(200);
        const authJson = (await authRes.json()) as { authenticated: boolean; mustChangePassword?: boolean };
        expect(authJson.authenticated).toBe(true);
        expect(authJson.mustChangePassword).toBe(false);

        // 3. GET /api/media/legacy executes read-only SELECT only
        const { GET: getMediaLegacyRoute } = await import("@/app/api/media/legacy/route");
        const mediaLegacyRes = await getMediaLegacyRoute(
          makeRequest("http://localhost:3000/api/media/legacy?entity=player&field=avatar&id=1")
        );
        expect(mediaLegacyRes.status).toBe(404);
        const postMediaDdlOrDml = executedSql.filter((s) => /\b(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i.test(s));
        expect(postMediaDdlOrDml).toEqual([]);

        // 4. Pre-freeze Manager session cookie can read audit-logs and export with 0 DDL/DML and 0 Blob writes
        const { GET: getAuditLogsRoute } = await import("@/app/api/audit-logs/route");
        const { GET: getExportRoute } = await import("@/app/api/export/route");
        legacyDb.exec("CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER, actor_name TEXT, actor_role TEXT, action TEXT, summary TEXT, created_at TEXT);");
        const auditRes = await getAuditLogsRoute(
          makeRequest("http://localhost:3000/api/audit-logs?limit=10", {
            headers: { cookie: `${authModule.SESSION_COOKIE_NAME}=${token}` },
          })
        );
        expect(auditRes.status).toBe(200);
        const exportRes = await getExportRoute(
          makeRequest("http://localhost:3000/api/export", {
            headers: { cookie: `${authModule.SESSION_COOKIE_NAME}=${token}` },
          })
        );
        expect(exportRes.status).toBe(200);
        expect(executedSql.filter((s) => /\b(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\b/i.test(s))).toEqual([]);

        // 5. Mutating routes still fail closed with 503 CUTOVER_WRITE_FROZEN on legacy schema
        await expectFrozen503(
          await postTeamRoute(makeRequest("http://localhost:3000/api/team", { method: "POST", body: JSON.stringify({ action: "set_rsvp" }) }))
        );
        await expectFrozen503(
          await postAuthRoute(makeRequest("http://localhost:3000/api/auth", { method: "POST", body: JSON.stringify({ action: "login" }) }))
        );
      } finally {
        legacyDb.close();
      }
    });
  });

  describe("when P103_CUTOVER_FREEZE_WRITES is unset or 'false'", () => {
    it("preserves normal route behavior (does not return CUTOVER_WRITE_FROZEN)", async () => {
      process.env.P103_CUTOVER_FREEZE_WRITES = "false";

      // POST /api/team without valid origin returns 403 CSRF, not 503 freeze
      const teamRes = await postTeamRoute(
        new NextRequest("http://localhost:3000/api/team", {
          method: "POST",
          headers: {
            origin: "https://evil.example",
            host: "localhost:3000",
          },
          body: JSON.stringify({ action: "upsert_player" }),
        })
      );
      expect(teamRes.status).toBe(403);

      // POST /api/auth logout succeeds normally
      const logoutRes = await postAuthRoute(
        makeRequest("http://localhost:3000/api/auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        })
      );
      expect(logoutRes.status).toBe(200);
      const logoutJson = await logoutRes.json();
      expect(logoutJson.success).toBe(true);

      // GET /api/cron/analytics-cleanup with missing CRON_SECRET returns 503 Cleanup configuration unavailable (not CUTOVER_WRITE_FROZEN)
      delete process.env.CRON_SECRET;
      const cronRes = await getCronAnalyticsCleanupRoute(
        makeRequest("http://localhost:3000/api/cron/analytics-cleanup")
      );
      expect(cronRes.status).toBe(503);
      const cronJson = await cronRes.json();
      expect(cronJson.code).not.toBe(CUTOVER_FREEZE_ERROR_CODE);
    });
  });

  describe("Two-stage Vercel Blob callback & drain closure (P1-03)", () => {
    const originalMediaEnabled = process.env.MEDIA_STORAGE_ENABLED;
    const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
    const originalCallbackUrl = process.env.VERCEL_BLOB_CALLBACK_URL;
    const originalCallbackFreeze = process.env.P103_CUTOVER_FREEZE_CALLBACKS;

    function signVercelBlobCallback(body: unknown, token: string): string {
      return crypto
        .createHmac("sha256", token)
        .update(JSON.stringify(body))
        .digest("hex");
    }

    function createInMemoryMediaDb(sqlite: import("node:sqlite").DatabaseSync) {
      return {
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
      // eslint-disable-next-line no-var
      var adapter: ReturnType<typeof dbModule.getAsyncDb>;
    }

    afterEach(() => {
      vi.useRealTimers();
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
      if (originalCallbackUrl === undefined) {
        delete process.env.VERCEL_BLOB_CALLBACK_URL;
      } else {
        process.env.VERCEL_BLOB_CALLBACK_URL = originalCallbackUrl;
      }
      if (originalCallbackFreeze === undefined) {
        delete process.env.P103_CUTOVER_FREEZE_CALLBACKS;
      } else {
        process.env.P103_CUTOVER_FREEZE_CALLBACKS = originalCallbackFreeze;
      }
    });

    it("sets deterministic callbackUrl and bounds handleUpload clientToken validUntil <= 60s from issuance", async () => {
      process.env.MEDIA_STORAGE_ENABLED = "true";
      process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_mockstore123_secret456";
      process.env.VERCEL_BLOB_CALLBACK_URL = "http://localhost:3000";

      const managerCookie = authModule.createSessionToken(
        {
          id: 1,
          code_order: 1,
          full_name: "Manager Test",
          short_name: "Mgr",
          jersey_number: 1,
          position: "MF",
          birth_year: "1995",
          phone: "",
          role: "Đội trưởng",
          status: "active",
          access_role: "manager",
          pin_code: authModule.hashPassword("MgrStrong@2026"),
          notes: "",
          hometown: "Điện Phong",
          nickname: "",
          playing_style: "",
          bio: "",
          avatar_url: "",
          profile_image_url: "",
          gallery_urls: [],
        },
        1
      );

      const beforeMs = Date.now();
      const res = await postMediaClientUploadRoute(
        makeRequest("http://localhost:3000/api/media/client-upload", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${authModule.SESSION_COOKIE_NAME}=${managerCookie}`,
          },
          body: JSON.stringify({
            type: "blob.generate-client-token",
            payload: {
              pathname:
                "public-media/uploads/post/0123456789abcdef0123456789abcdef.webp",
              multipart: false,
              clientPayload: JSON.stringify({
                entity: "post",
                contentType: "image/webp",
                sizeBytes: 1024,
              }),
            },
          }),
        })
      );
      const afterMs = Date.now();

      expect(res.status).toBe(200);
      const json = (await res.json()) as { type: string; clientToken: string };
      expect(json.type).toBe("blob.generate-client-token");

      const payload = getPayloadFromClientToken(json.clientToken);
      expect(CLIENT_UPLOAD_TOKEN_TTL_MS).toBe(60_000);
      expect(payload.validUntil).toBeTypeOf("number");
      expect(payload.validUntil!).toBeGreaterThanOrEqual(
        beforeMs + CLIENT_UPLOAD_TOKEN_TTL_MS - 1000
      );
      expect(payload.validUntil!).toBeLessThanOrEqual(
        afterMs + CLIENT_UPLOAD_TOKEN_TTL_MS + 1000
      );
      expect(payload.validUntil! - beforeMs).toBeLessThanOrEqual(
        CLIENT_UPLOAD_TOKEN_TTL_MS + 1000
      );
      expect(payload.onUploadCompleted?.callbackUrl).toBe(
        "http://localhost:3000/api/media/client-upload/callback"
      );

      // Verify token is deterministically expired after 60s drain
      expect(beforeMs + 61_000).toBeGreaterThan(payload.validUntil!);
    });

    it("Stage 1 Drain: blocks new token issuance (503) while allowing valid Vercel-signed callback, rejecting bad signatures/expired tokens, and staying idempotent on duplicates", async () => {
      const { DatabaseSync } = await import("node:sqlite");
      const sqlite = new DatabaseSync(":memory:");
      const adapter = createInMemoryMediaDb(sqlite);
      vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(adapter);

      const rwToken = "vercel_blob_rw_mockstore123_secret456";
      process.env.MEDIA_STORAGE_ENABLED = "true";
      process.env.BLOB_READ_WRITE_TOKEN = rwToken;
      process.env.P103_CUTOVER_FREEZE_WRITES = "true";
      delete process.env.P103_CUTOVER_FREEZE_CALLBACKS;

      try {
        expect(isCutoverWriteFrozen()).toBe(true);
        expect(isCutoverCallbackFrozen()).toBe(false);
        expect(guardCutoverCallbackWrite("callback")).toBeNull();

        // 1. Token issuance route is blocked (503) in Stage 1
        const tokenRes = await postMediaClientUploadRoute(
          makeRequest("http://localhost:3000/api/media/client-upload", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "blob.generate-client-token" }),
          })
        );
        await expectFrozen503(tokenRes);

        // 2. Callback route NEVER issues tokens even if requested
        const tokenOnCallbackRes = await postMediaClientUploadCallbackRoute(
          makeRequest("http://localhost:3000/api/media/client-upload/callback", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "blob.generate-client-token" }),
          })
        );
        expect(tokenOnCallbackRes.status).toBe(403);

        const nowMs = Date.now();
        const validCallbackBody = {
          type: "blob.upload-completed",
          payload: {
            blob: {
              url: "https://mockstore123.public.blob.vercel-storage.com/public-media/uploads/post/abc123.webp",
              downloadUrl:
                "https://mockstore123.public.blob.vercel-storage.com/public-media/uploads/post/abc123.webp?download=1",
              pathname: "public-media/uploads/post/abc123.webp",
              contentType: "image/webp",
              contentDisposition: 'inline; filename="abc123.webp"',
            },
            tokenPayload: JSON.stringify({
              entity: "post",
              playerId: null,
              uploadedByPlayerId: 1,
              issuedAt: nowMs - 5000,
              expiresAt: nowMs + 55_000,
            }),
          },
        };

        // 3. Invalid signature rejected (401), 0 DB rows
        const badSigRes = await postMediaClientUploadCallbackRoute(
          makeRequest("http://localhost:3000/api/media/client-upload/callback", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-vercel-signature": "0".repeat(64),
            },
            body: JSON.stringify(validCallbackBody),
          })
        );
        expect(badSigRes.status).toBe(401);

        // 4. Expired tokenPayload rejected (400), 0 DB rows
        const expiredBody = {
          ...validCallbackBody,
          payload: {
            ...validCallbackBody.payload,
            tokenPayload: JSON.stringify({
              entity: "post",
              playerId: null,
              uploadedByPlayerId: 1,
              issuedAt: nowMs - 120_000,
              expiresAt: nowMs - 60_000,
            }),
          },
        };
        const expiredRes = await postMediaClientUploadCallbackRoute(
          makeRequest("http://localhost:3000/api/media/client-upload/callback", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-vercel-signature": signVercelBlobCallback(expiredBody, rwToken),
            },
            body: JSON.stringify(expiredBody),
          })
        );
        expect(expiredRes.status).toBe(400);

        // 5. Valid Vercel-signed callback succeeds during Stage 1 Drain (new route + legacy route)
        const validSig = signVercelBlobCallback(validCallbackBody, rwToken);
        const okRes = await postMediaClientUploadCallbackRoute(
          makeRequest("http://localhost:3000/api/media/client-upload/callback", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-vercel-signature": validSig,
            },
            body: JSON.stringify(validCallbackBody),
          })
        );
        expect(okRes.status).toBe(200);
        expect(await okRes.json()).toEqual({
          type: "blob.upload-completed",
          response: "ok",
        });

        // 5b. Legacy callback issued BEFORE route split (/api/media/client-upload) with EXACT old tokenPayload
        //     from baseline b9bad43 ({ entity, uploadedByPlayerId } without playerId/issuedAt/expiresAt)
        const preSplitCallbackBody = {
          type: "blob.upload-completed",
          payload: {
            blob: {
              url: "https://mockstore123.public.blob.vercel-storage.com/public-media/uploads/player/legacy-presplit.webp",
              downloadUrl:
                "https://mockstore123.public.blob.vercel-storage.com/public-media/uploads/player/legacy-presplit.webp?download=1",
              pathname: "public-media/uploads/player/legacy-presplit.webp",
              contentType: "image/webp",
              contentDisposition: 'inline; filename="legacy-presplit.webp"',
            },
            tokenPayload: JSON.stringify({
              entity: "player",
              uploadedByPlayerId: 7,
            }),
          },
        };
        const preSplitSig = signVercelBlobCallback(preSplitCallbackBody, rwToken);
        const legacyOkRes = await postMediaClientUploadRoute(
          makeRequest("http://localhost:3000/api/media/client-upload", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-vercel-signature": preSplitSig,
            },
            body: JSON.stringify(preSplitCallbackBody),
          })
        );
        expect(legacyOkRes.status).toBe(200);
        expect(await legacyOkRes.json()).toEqual({
          type: "blob.upload-completed",
          response: "ok",
        });

        // 6. Duplicate delivery / retries across both routes are idempotent (strictly 1 record per blob_url)
        //    and reconciliation query confirms all completed uploads are accounted for without duplicates.
        const dupNewRes = await postMediaClientUploadCallbackRoute(
          makeRequest("http://localhost:3000/api/media/client-upload/callback", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-vercel-signature": validSig,
            },
            body: JSON.stringify(validCallbackBody),
          })
        );
        expect(dupNewRes.status).toBe(200);

        const dupLegacyRes = await postMediaClientUploadRoute(
          makeRequest("http://localhost:3000/api/media/client-upload", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-vercel-signature": preSplitSig,
            },
            body: JSON.stringify(preSplitCallbackBody),
          })
        );
        expect(dupLegacyRes.status).toBe(200);

        const countNew = sqlite
          .prepare("SELECT COUNT(*) as cnt FROM media_upload_records WHERE blob_url = ?")
          .get(validCallbackBody.payload.blob.url) as { cnt: number };
        expect(countNew.cnt).toBe(1);
        const countLegacy = sqlite
          .prepare("SELECT COUNT(*) as cnt FROM media_upload_records WHERE blob_url = ?")
          .get(preSplitCallbackBody.payload.blob.url) as { cnt: number };
        expect(countLegacy.cnt).toBe(1);

        // 7. Stage 2 Closed: once drain completes, P103_CUTOVER_FREEZE_CALLBACKS=true blocks BOTH callback routes
        //    and token generation, with ZERO DB writes and ZERO Blob writes.
        process.env.P103_CUTOVER_FREEZE_CALLBACKS = "true";
        const dbSpyStage2 = vi.spyOn(dbModule, "getAsyncDb");
        dbSpyStage2.mockClear();
        const mediaSpyStage2 = vi.spyOn(
          mediaStorageModule,
          "getMediaStorageProvider"
        );
        mediaSpyStage2.mockClear();

        const stage2NewRes = await postMediaClientUploadCallbackRoute(
          makeRequest("http://localhost:3000/api/media/client-upload/callback", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-vercel-signature": validSig,
            },
            body: JSON.stringify(validCallbackBody),
          })
        );
        await expectFrozen503(stage2NewRes);

        const stage2LegacyCallbackRes = await postMediaClientUploadRoute(
          makeRequest("http://localhost:3000/api/media/client-upload", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-vercel-signature": preSplitSig,
            },
            body: JSON.stringify(preSplitCallbackBody),
          })
        );
        await expectFrozen503(stage2LegacyCallbackRes);

        const stage2LegacyTokenRes = await postMediaClientUploadRoute(
          makeRequest("http://localhost:3000/api/media/client-upload", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "blob.generate-client-token" }),
          })
        );
        await expectFrozen503(stage2LegacyTokenRes);

        expect(dbSpyStage2).not.toHaveBeenCalled();
        expect(mediaSpyStage2).not.toHaveBeenCalled();
      } finally {
        sqlite.close();
      }
    });
  });
});
