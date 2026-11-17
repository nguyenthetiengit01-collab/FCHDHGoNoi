import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postAnalyticsEventsRoute } from "@/app/api/analytics/events/route";
import {
  GET as getCronCleanupRoute,
  POST as postCronCleanupRoute,
} from "@/app/api/cron/analytics-cleanup/route";
import type { AsyncDb } from "@/lib/db";
import { runPhase4Migration } from "../../../scripts/migrations/phase4-analytics-v1.mjs";
import { validateProductionTarget } from "../../../scripts/lib/turso-preflight.mjs";
import {
  __resetCleanupLockForTest,
  runBoundedRawEventsCleanup,
  validateProductionCleanupTarget,
} from "./cleanup";
import {
  AnalyticsSecretError,
  deriveActorKeyHash,
  getActorHashSecret,
  ingestProductEvents,
} from "./productEvents";
import {
  __getFallbackBucketCountForTest,
  __resetRateLimitStateForTest,
  __setRateLimiterForTest,
  buildPseudonymousRateLimitKey,
  DEGRADED_RATE_LIMIT_MAX,
  evaluateAnalyticsEventRateLimit,
} from "./rateLimit";

const VALID_ACTOR_SECRET = "prod-analytics-actor-secret-at-least-32-chars!!";
const VALID_CRON_SECRET = "prod-cron-secret-at-least-32-chars!!";
const VALID_EVENT_BODY = {
  events: [
    {
      eventUuid: "11111111-2222-4333-8444-555555555555",
      eventName: "page_view",
      routeKey: "/",
    },
  ],
};

const tempDirs: string[] = [];

function createTempSqliteAsyncDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-wa-"));
  tempDirs.push(dir);
  const sqlitePath = path.join(dir, "test.sqlite");
  const raw = new DatabaseSync(sqlitePath);
  raw.exec(`
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_order INTEGER DEFAULT 0,
      full_name TEXT NOT NULL,
      short_name TEXT,
      access_role TEXT DEFAULT 'player',
      status TEXT DEFAULT 'Đang sinh hoạt'
    );
    CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, match_date TEXT NOT NULL);
    CREATE TABLE expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, expense_date TEXT NOT NULL, match_id INTEGER);
    CREATE TABLE other_incomes (id INTEGER PRIMARY KEY AUTOINCREMENT, income_date TEXT NOT NULL, amount INTEGER DEFAULT 0);
  `);

  const db: AsyncDb = {
    async query<T>(sql: string, args: unknown[] = []): Promise<T[]> {
      return raw.prepare(sql).all(...(args as never[])) as T[];
    },
    async queryOne<T>(sql: string, args: unknown[] = []): Promise<T | null> {
      return (raw.prepare(sql).get(...(args as never[])) as T | undefined) ?? null;
    },
    async run(sql: string, args: unknown[] = []) {
      const res = raw.prepare(sql).run(...(args as never[]));
      return {
        changes: Number(res.changes || 0),
        lastInsertRowid: Number(res.lastInsertRowid || 0),
      };
    },
    async exec(sql: string) {
      raw.exec(sql);
    },
    async batch(statements: Array<{ sql: string; params?: unknown[] }>) {
      for (const s of statements) {
        raw.prepare(s.sql).run(...((s.params ?? []) as never[]));
      }
    },
    async transaction<T>(fn: (tx: AsyncDb) => Promise<T>): Promise<T> {
      raw.exec("BEGIN IMMEDIATE;");
      try {
        const res = await fn(db);
        raw.exec("COMMIT;");
        return res;
      } catch (err) {
        raw.exec("ROLLBACK;");
        throw err;
      }
    },
  };

  return { sqlitePath, raw, db };
}

afterEach(() => {
  delete process.env.ANALYTICS_ENABLED;
  delete process.env.ANALYTICS_ACTOR_SECRET;
  delete process.env.AUTH_SECRET;
  delete process.env.APP_SECRET;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.CRON_SECRET;
  delete process.env.VERCEL_ENV;
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.USE_LOCAL_SQLITE;
  delete process.env.SQLITE_DB_PATH;
  __resetRateLimitStateForTest();
  __resetCleanupLockForTest();
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup race
    }
  }
});

describe("Workstream A — Dedicated HMAC Secret & Fail-Closed", () => {
  it("rejects missing, empty, whitespace, and short secrets even when AUTH_SECRET/APP_SECRET exist", () => {
    const authEnv = { AUTH_SECRET: VALID_ACTOR_SECRET, APP_SECRET: VALID_ACTOR_SECRET };
    expect(() => getActorHashSecret({ ...authEnv })).toThrow(AnalyticsSecretError);
    expect(() => getActorHashSecret({ ...authEnv, ANALYTICS_ACTOR_SECRET: "" })).toThrow(
      AnalyticsSecretError
    );
    expect(() => getActorHashSecret({ ...authEnv, ANALYTICS_ACTOR_SECRET: "   " })).toThrow(
      AnalyticsSecretError
    );
    expect(() =>
      getActorHashSecret({ ...authEnv, ANALYTICS_ACTOR_SECRET: "too-short-31-chars-12345678901" })
    ).toThrow(AnalyticsSecretError);
  });

  it("accepts valid >=32-char secret, trims it, and keeps actor_key_hash deterministic", () => {
    const h1 = deriveActorKeyHash("player", 42, {
      ANALYTICS_ACTOR_SECRET: `  ${VALID_ACTOR_SECRET}  `,
    });
    const h2 = deriveActorKeyHash("player", 42, {
      ANALYTICS_ACTOR_SECRET: VALID_ACTOR_SECRET,
    });
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
  });

  it("returns 503 with zero DB writes when ANALYTICS_ENABLED=true without valid secret", async () => {
    const { sqlitePath, raw, db } = createTempSqliteAsyncDb();
    try {
      await runPhase4Migration({
        execute: (sql: string, args: unknown[] = []) => db.run(sql, args),
        query: (sql: string, args: unknown[] = []) => db.query(sql, args),
      });
      raw.close();

      process.env.USE_LOCAL_SQLITE = "true";
      process.env.SQLITE_DB_PATH = sqlitePath;
      process.env.ANALYTICS_ENABLED = "true";
      process.env.ANALYTICS_ACTOR_SECRET = "short";

      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await postAnalyticsEventsRoute(
        new NextRequest("http://localhost/api/analytics/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Host: "localhost",
            Origin: "http://localhost",
          },
          body: JSON.stringify(VALID_EVENT_BODY),
        })
      );

      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toContain("no-store");
      expect(errSpy).toHaveBeenCalledTimes(1);
      const logged = String(errSpy.mock.calls[0]?.[0] || "");
      expect(logged).toContain("analytics_secret_invalid");
      expect(logged).not.toContain("short");

      const checkDb = new DatabaseSync(sqlitePath);
      const cnt = checkDb.prepare("SELECT COUNT(*) AS cnt FROM product_analytics_events").get() as {
        cnt: number;
      };
      checkDb.close();
      expect(cnt.cnt).toBe(0);
    } finally {
      try {
        raw.close();
      } catch {
        // Already closed
      }
    }
  });

  it("keeps safe disabled behavior (200 enabled=false) when ANALYTICS_ENABLED=false without secret", async () => {
    process.env.ANALYTICS_ENABLED = "false";
    const res = await postAnalyticsEventsRoute(
      new NextRequest("http://localhost/api/analytics/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Host: "localhost",
          Origin: "http://localhost",
        },
        body: JSON.stringify(VALID_EVENT_BODY),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, enabled: false, accepted: 0, deduped: 0 });
  });
});

describe("Workstream A — Shared Atomic Rate Limiting & Degraded Fallback", () => {
  it("pseudonymizes identity consistently without exposing raw IP or player ID", () => {
    const k1 = buildPseudonymousRateLimitKey(
      { playerId: 987654321, clientIp: "203.0.113.9" },
      { ANALYTICS_ACTOR_SECRET: VALID_ACTOR_SECRET }
    );
    const k2 = buildPseudonymousRateLimitKey(
      { playerId: 987654321, clientIp: "198.51.100.2" },
      { ANALYTICS_ACTOR_SECRET: VALID_ACTOR_SECRET }
    );
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^[0-9a-f]{32}$/);
    expect(k1).not.toContain("987654321");
    expect(k1).not.toContain("actor:");
    expect(k1).not.toContain("203.0.113.9");
  });

  it("fails closed with 503 when Upstash config is missing", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await evaluateAnalyticsEventRateLimit({
      playerId: 1,
      headers: new Headers({ "x-vercel-forwarded-for": "203.0.113.5" }),
      env: { ANALYTICS_ACTOR_SECRET: VALID_ACTOR_SECRET },
    });
    expect(res).toEqual({ allowed: false, status: 503, errorCode: "RATE_LIMIT_CONFIG_MISSING" });
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  it("allows shared requests and returns 429 when shared limiter rejects", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const limitMock = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });
    __setRateLimiterForTest({ limit: limitMock });

    const r1 = await evaluateAnalyticsEventRateLimit({
      playerId: 1,
      headers: new Headers(),
      env: { ANALYTICS_ACTOR_SECRET: VALID_ACTOR_SECRET },
    });
    const r2 = await evaluateAnalyticsEventRateLimit({
      playerId: 1,
      headers: new Headers(),
      env: { ANALYTICS_ACTOR_SECRET: VALID_ACTOR_SECRET },
    });

    expect(r1).toEqual({ allowed: true, mode: "shared" });
    expect(r2).toEqual({ allowed: false, status: 429, mode: "shared" });
    expect(limitMock).toHaveBeenCalledTimes(2);
    expect(String(warnSpy.mock.calls[0]?.[0] || "")).toContain("analytics_rate_limit_blocked");
  });

  it("invokes controlled degraded fallback on Redis timeout and connection error, enforcing stricter local cap", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    __setRateLimiterForTest({
      limit: () => new Promise(() => {}),
    });

    const timeoutRes = await evaluateAnalyticsEventRateLimit({
      playerId: null,
      headers: new Headers({ "x-vercel-forwarded-for": "203.0.113.88" }),
      env: { ANALYTICS_ACTOR_SECRET: VALID_ACTOR_SECRET },
      timeoutMs: 15,
      now: 1000,
    });
    expect(timeoutRes).toEqual({ allowed: true, mode: "degraded" });
    const timeoutLog = String(warnSpy.mock.calls[0]?.[0] || "");
    expect(timeoutLog).toContain("analytics_rate_limit_degraded");
    expect(timeoutLog).toContain("REDIS_TIMEOUT");
    expect(timeoutLog).not.toContain("203.0.113.88");

    __setRateLimiterForTest({
      limit: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    for (let i = 1; i < DEGRADED_RATE_LIMIT_MAX; i++) {
      const ok = await evaluateAnalyticsEventRateLimit({
        playerId: null,
        headers: new Headers({ "x-vercel-forwarded-for": "203.0.113.88" }),
        env: { ANALYTICS_ACTOR_SECRET: VALID_ACTOR_SECRET },
        now: 1000 + i,
      });
      expect(ok.allowed).toBe(true);
    }

    const blocked = await evaluateAnalyticsEventRateLimit({
      playerId: null,
      headers: new Headers({ "x-vercel-forwarded-for": "203.0.113.88" }),
      env: { ANALYTICS_ACTOR_SECRET: VALID_ACTOR_SECRET },
      now: 2000,
    });
    expect(blocked).toEqual({ allowed: false, status: 429, mode: "degraded" });
    expect(__getFallbackBucketCountForTest()).toBe(1);
  });
});

describe("Workstream A — Protected Cron Cleanup, Target Safety & Batch Retention", () => {
  it("enforces CRON_SECRET, Bearer auth, VERCEL_ENV=production, method allowlist, and Production target validation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect((await postCronCleanupRoute()).status).toBe(405);

    const noSecretRes = await getCronCleanupRoute(
      new NextRequest("http://localhost/api/cron/analytics-cleanup")
    );
    expect(noSecretRes.status).toBe(503);
    expect(noSecretRes.headers.get("cache-control")).toContain("no-store");

    process.env.CRON_SECRET = VALID_CRON_SECRET;
    const badAuthRes = await getCronCleanupRoute(
      new NextRequest("http://localhost/api/cron/analytics-cleanup", {
        headers: { Authorization: "Bearer wrong-token" },
      })
    );
    expect(badAuthRes.status).toBe(401);

    process.env.VERCEL_ENV = "preview";
    const nonProdRes = await getCronCleanupRoute(
      new NextRequest("http://localhost/api/cron/analytics-cleanup", {
        headers: { Authorization: `Bearer ${VALID_CRON_SECRET}` },
      })
    );
    expect(nonProdRes.status).toBe(503);

    process.env.VERCEL_ENV = "production";
    process.env.TURSO_DATABASE_URL =
      "libsql://fchdhgonoi-staging-restore-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io";
    process.env.TURSO_AUTH_TOKEN = "dummy-token";
    const stagingBlockedRes = await getCronCleanupRoute(
      new NextRequest("http://localhost/api/cron/analytics-cleanup", {
        headers: { Authorization: `Bearer ${VALID_CRON_SECRET}` },
      })
    );
    expect(stagingBlockedRes.status).toBe(503);

    expect(() =>
      validateProductionTarget({
        url: "libsql://fchdhgonoi-staging-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io",
        token: "tok",
      })
    ).toThrow(/Staging/);
    expect(() =>
      validateProductionCleanupTarget({
        TURSO_DATABASE_URL:
          "libsql://fchdhgonoi-nguyenthetiengit01-collab.aws-ap-northeast-1.turso.io",
        TURSO_AUTH_TOKEN: "tok",
      })
    ).not.toThrow();
  });

  it("performs bounded 90-day batch deletion, preserves rollups/business data, supports dry-run, and reports partial completion", async () => {
    const { raw, db } = createTempSqliteAsyncDb();
    try {
      raw.prepare("INSERT INTO players (code_order, full_name, access_role, status) VALUES (1, 'P1', 'player', 'Đang sinh hoạt')").run();
      await runPhase4Migration({
        execute: (sql: string, args: unknown[] = []) => db.run(sql, args),
        query: (sql: string, args: unknown[] = []) => db.query(sql, args),
      });

      process.env.ANALYTICS_ACTOR_SECRET = VALID_ACTOR_SECRET;
      const now = new Date("2026-11-17T00:00:00.000Z");

      // Insert 3 expired events (>90d) and 1 fresh event (<=90d)
      for (const [idx, iso] of [
        [1, "2026-01-01T00:00:00.000Z"],
        [2, "2026-02-01T00:00:00.000Z"],
        [3, "2026-03-01T00:00:00.000Z"],
        [4, "2026-11-10T00:00:00.000Z"],
      ] as const) {
        await ingestProductEvents({
          db,
          events: [
            {
              eventUuid: `00000000-0000-4000-8000-00000000000${idx}`,
              eventName: "page_view",
              routeKey: "/",
            },
          ],
          actorRole: "player",
          playerId: 1,
          now: new Date(iso),
        });
      }

      const dryRun = await runBoundedRawEventsCleanup({ db, days: 90, dryRun: true, now });
      expect(dryRun.deletedCount).toBe(0);
      expect(dryRun.remainingEligible).toBe(3);
      expect(dryRun.partial).toBe(true);

      // Partial bounded run: batchSize=2, maxBatches=1 -> deletes 2, leaves 1
      const partialRun = await runBoundedRawEventsCleanup({
        db,
        days: 90,
        batchSize: 2,
        maxBatches: 1,
        now,
      });
      expect(partialRun.deletedCount).toBe(2);
      expect(partialRun.remainingEligible).toBe(1);
      expect(partialRun.partial).toBe(true);
      expect(partialRun.preservedRollups).toBe(true);

      // Finalize remaining 1 expired row
      const finalRun = await runBoundedRawEventsCleanup({
        db,
        days: 90,
        batchSize: 2,
        maxBatches: 5,
        now,
      });
      expect(finalRun.deletedCount).toBe(1);
      expect(finalRun.remainingEligible).toBe(0);
      expect(finalRun.partial).toBe(false);

      // Idempotent repeated run
      const repeatRun = await runBoundedRawEventsCleanup({ db, days: 90, now });
      expect(repeatRun.deletedCount).toBe(0);
      expect(repeatRun.partial).toBe(false);

      // Fresh event + rollups + lifecycle + players remain intact
      expect((await db.queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM product_analytics_events"))?.cnt).toBe(1);
      expect((await db.queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM product_analytics_daily"))?.cnt).toBe(4);
      expect((await db.queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM product_analytics_monthly_actors"))?.cnt).toBe(4);
      expect((await db.queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM player_lifecycle_events"))?.cnt).toBe(1);
      expect((await db.queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM players"))?.cnt).toBe(1);
    } finally {
      raw.close();
    }
  });
});
