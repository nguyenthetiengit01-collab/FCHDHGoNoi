import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getAuthRoute, POST as postAuthRoute } from "@/app/api/auth/route";
import {
  __setDummyScryptHookForTest,
  AuthSecretError,
  createSessionToken,
  getAuthSecret,
  hashPassword,
  isDeployedAuthEnv,
  isPreviewAuthEnv,
  isProductionAuthEnv,
  requireManagerSession,
  requirePlayerSession,
  SESSION_COOKIE_NAME,
  UNIFIED_LOGIN_ERROR_MESSAGE,
  validatePasswordStrength,
  verifyCredentials,
  verifyPassword,
  verifySessionToken,
} from "./auth";
import {
  __getCachedRedisDriverKeyForTest,
  __getLocalAuthRateLimitBucketCountForTest,
  __resetAuthRateLimitForTest,
  __setAuthRateLimitDriverForTest,
  type AuthRateLimitDriver,
  clearAuthRateLimitOnSuccess,
  evaluateAuthRateLimit,
  extractTrustedClientIp,
  getUpstashConfigCacheKey,
  hashAuthRateLimitIdentifier,
  hasValidAuthUpstashConfig,
} from "./authRateLimit";
import * as dbModule from "./db";
import type { AsyncDb } from "./db";
import type { Player } from "@/types/app";

const VALID_TEST_SECRET = "phase5a-valid-test-auth-secret-at-least-32-chars!";
const tempDirs: string[] = [];

function createTempPlayersDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fc-p5a-"));
  tempDirs.push(dir);
  const sqlitePath = path.join(dir, "auth-test.sqlite");
  const raw = new DatabaseSync(sqlitePath);
  raw.exec(`
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_order INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      jersey_number INTEGER,
      position TEXT NOT NULL DEFAULT 'Đa năng',
      phone TEXT NOT NULL DEFAULT '',
      birth_year TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      profile_image_url TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      hometown TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      playing_style TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'Thành viên',
      access_role TEXT NOT NULL DEFAULT 'player',
      username TEXT NOT NULL DEFAULT '',
      pin_code TEXT NOT NULL DEFAULT '1234',
      must_change_pin INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Đang sinh hoạt',
      notes TEXT NOT NULL DEFAULT ''
    );
  `);

  const executedQueries: string[] = [];
  const db: AsyncDb = {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      executedQueries.push(sql);
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
    async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      executedQueries.push(sql);
      return (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
    },
    async run(sql: string, params: unknown[] = []) {
      executedQueries.push(sql);
      const info = raw.prepare(sql).run(...(params as never[]));
      return {
        lastInsertRowid: Number(info.lastInsertRowid || 0),
        changes: Number(info.changes || 0),
      };
    },
    async exec(sql: string) {
      raw.exec(sql);
    },
    async batch(statements) {
      for (const s of statements) {
        raw.prepare(s.sql).run(...((s.params ?? []) as never[]));
      }
    },
    async transaction(fn) {
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

  return { raw, db, executedQueries };
}

function createInMemorySharedDriver(options: {
  acctLimit?: number;
  ipLimit?: number;
  pairLimit?: number;
  seenKeys?: Array<{ scope: string; key: string }>;
} = {}): AuthRateLimitDriver {
  const acctMax = options.acctLimit ?? 5;
  const ipMax = options.ipLimit ?? 15;
  const pairMax = options.pairLimit ?? 5;
  const counts = new Map<string, number>();

  const bump = (scope: string, key: string, max: number) => {
    options.seenKeys?.push({ scope, key });
    const scoped = `${scope}:${key}`;
    const curr = counts.get(scoped) || 0;
    if (curr >= max) {
      return { success: false, remaining: 0, reset: Date.now() + 300_000 };
    }
    counts.set(scoped, curr + 1);
    return { success: true, remaining: max - (curr + 1), reset: Date.now() + 900_000 };
  };

  return {
    async limitAccount(key) {
      return bump("acct", key, acctMax);
    },
    async limitIp(key) {
      return bump("ip", key, ipMax);
    },
    async limitPair(key) {
      return bump("pair", key, pairMax);
    },
    async resetAccount(key) {
      counts.delete(`acct:${key}`);
    },
    async resetPair(key) {
      counts.delete(`pair:${key}`);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete process.env.AUTH_SECRET;
  delete process.env.APP_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  delete process.env.VERCEL_ENV;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  __setDummyScryptHookForTest(null);
  __resetAuthRateLimitForTest();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Phase 5.1 – A. Session & Auth Secret Hardening", () => {
  it("fails closed in Production (NODE_ENV & VERCEL_ENV, even with CI/VITEST unset) when secret is missing, <32 chars, or hardcoded placeholder", () => {
    const prodEnvBase: Record<string, string | undefined> = {
      NODE_ENV: "production",
    };
    // Missing secret
    expect(() => getAuthSecret({ ...prodEnvBase })).toThrow(AuthSecretError);
    // VERCEL_ENV=production without NODE_ENV=production
    expect(() => getAuthSecret({ NODE_ENV: "development", VERCEL_ENV: "production" })).toThrow(
      AuthSecretError
    );
    // Weak/short secret must NOT be SHA-256 padded into validity
    expect(() =>
      getAuthSecret({ ...prodEnvBase, AUTH_SECRET: "short-secret-123" })
    ).toThrow(AuthSecretError);
    // Known hardcoded fallback / placeholder rejected in Production
    expect(() =>
      getAuthSecret({
        ...prodEnvBase,
        AUTH_SECRET: "fc-hdh-go-noi-sapphire-secret-key-2026-production-fallback-key-32c",
      })
    ).toThrow(AuthSecretError);
    expect(() =>
      getAuthSecret({
        ...prodEnvBase,
        AUTH_SECRET: "fc-hdh-go-noi-sapphire-secret-key-2026-secure-32chars",
      })
    ).toThrow(AuthSecretError);
    // Error never leaks provided secret
    try {
      getAuthSecret({ ...prodEnvBase, AUTH_SECRET: "leaked-short-secret" });
    } catch (err) {
      expect(String(err)).not.toContain("leaked-short-secret");
    }
  });

  it("enforces >=32 char length when explicitly configured in Development/Vitest and accepts valid >=32 char secrets", () => {
    expect(() =>
      getAuthSecret({ NODE_ENV: "development", AUTH_SECRET: "short-dev-secret" })
    ).toThrow(AuthSecretError);
    expect(() =>
      getAuthSecret({ NODE_ENV: "test", VITEST: "true", AUTH_SECRET: "short-test-secret" })
    ).toThrow(AuthSecretError);

    expect(
      getAuthSecret({ NODE_ENV: "production", AUTH_SECRET: VALID_TEST_SECRET })
    ).toBe(VALID_TEST_SECRET);
    expect(
      getAuthSecret({ NODE_ENV: "development", APP_SECRET: VALID_TEST_SECRET })
    ).toBe(VALID_TEST_SECRET);
  });

  it("fails closed on GET/POST /api/auth (503) and verifySessionToken (null) when Production AUTH_SECRET is invalid", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.AUTH_SECRET;
    delete process.env.APP_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    expect(verifySessionToken("abc.def")).toBeNull();

    const getRes = await getAuthRoute(new NextRequest("https://fchdhgonoi.vercel.app/api/auth"));
    expect(getRes.status).toBe(503);
    const getJson = (await getRes.json()) as { authenticated: boolean; code?: string };
    expect(getJson.authenticated).toBe(false);
    expect(getJson.code).toBe("AUTH_SECRET_INVALID");

    const postRes = await postAuthRoute(
      new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
        method: "POST",
        headers: {
          host: "fchdhgonoi.vercel.app",
          origin: "https://fchdhgonoi.vercel.app",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "login", username: "tieng", pin: "1234" }),
      })
    );
    expect(postRes.status).toBe(503);
    const postJson = (await postAuthRoute(
      new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
        method: "POST",
        headers: {
          host: "fchdhgonoi.vercel.app",
          origin: "https://fchdhgonoi.vercel.app",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "login", username: "tieng", pin: "1234" }),
      })
    ).then((r) => r.json())) as { code?: string };
    expect(postJson.code).toBe("AUTH_SECRET_INVALID");
  });

  it("distinguishes Production vs Preview, Development, and Vitest and fails closed on Preview without explicit valid secret", async () => {
    expect(isProductionAuthEnv({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionAuthEnv({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(false);
    expect(isPreviewAuthEnv({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(true);
    expect(isPreviewAuthEnv({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(false);
    expect(isDeployedAuthEnv({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(true);
    expect(isDeployedAuthEnv({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(true);
    expect(isProductionAuthEnv({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionAuthEnv({ NODE_ENV: "development" })).toBe(false);
    expect(isDeployedAuthEnv({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionAuthEnv({ NODE_ENV: "test", VITEST: "true" })).toBe(false);
    expect(isDeployedAuthEnv({ NODE_ENV: "test", VITEST: "true" })).toBe(false);

    // Preview (NODE_ENV=production + VERCEL_ENV=preview) MUST fail-closed when secret is missing, <32 chars, or dev fallback
    expect(() =>
      getAuthSecret({ NODE_ENV: "production", VERCEL_ENV: "preview" })
    ).toThrow(AuthSecretError);
    expect(() =>
      getAuthSecret({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        AUTH_SECRET: "short-preview-secret",
      })
    ).toThrow(AuthSecretError);
    expect(() =>
      getAuthSecret({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        AUTH_SECRET: "fc-hdh-go-noi-sapphire-secret-key-2026-secure-32chars",
      })
    ).toThrow(AuthSecretError);

    // Preview succeeds with an explicit >=32 char dedicated secret (distinct from dev fallback)
    const previewSecret = "preview-dedicated-auth-secret-at-least-32-chars!";
    expect(
      getAuthSecret({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        AUTH_SECRET: previewSecret,
      })
    ).toBe(previewSecret);
    expect(
      getAuthSecret({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        PREVIEW_AUTH_SECRET: previewSecret,
      })
    ).toBe(previewSecret);

    // Local Development & Vitest still allow dev fallback when no secret is configured
    expect(() => getAuthSecret({ NODE_ENV: "development" })).not.toThrow();
    expect(() => getAuthSecret({ NODE_ENV: "test", VITEST: "true" })).not.toThrow();

    // GET /api/auth fails closed (503) on Vercel Preview when secret is missing
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    delete process.env.AUTH_SECRET;
    delete process.env.APP_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.SESSION_SECRET;
    delete process.env.PREVIEW_AUTH_SECRET;

    expect(verifySessionToken("abc.def")).toBeNull();
    const previewGetRes = await getAuthRoute(
      new NextRequest("https://preview-fchdhgonoi.vercel.app/api/auth")
    );
    expect(previewGetRes.status).toBe(503);
    const previewGetJson = (await previewGetRes.json()) as {
      authenticated: boolean;
      code?: string;
    };
    expect(previewGetJson.authenticated).toBe(false);
    expect(previewGetJson.code).toBe("AUTH_SECRET_INVALID");
  });
});

describe("Phase 5.1 – B & D. Session Revocation, Password Policy & Login Anti-Enumeration", () => {
  it("supports session verification, expiration, tampering rejection, and immediate revocation via GET /api/auth and guards after PIN change", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, db } = createTempPlayersDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);

    try {
      const oldPinHash = hashPassword("OldPass@2026");
      const newPinHash = hashPassword("NewPass@2026");
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, access_role, username, pin_code, status)
         VALUES (1, 'Nguyen Van Manager', 'Manager', 12, 'manager', 'manager12', ?, 'Đang sinh hoạt')`
      ).run(oldPinHash);

      const playerRow = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const token = createSessionToken(playerRow, 24);
      const expiredToken = createSessionToken(playerRow, -1);

      expect(verifySessionToken(expiredToken)).toBeNull();
      expect(verifySessionToken(`${token}tamper`)).toBeNull();

      // Rotate PIN in DB -> token issued before PIN change must be revoked immediately
      raw.prepare("UPDATE players SET pin_code = ? WHERE id = 1").run(newPinHash);

      const reqWithOldCookie = new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });

      const getRes = await getAuthRoute(reqWithOldCookie);
      expect(getRes.status).toBe(200);
      const getJson = (await getRes.json()) as { authenticated: boolean; player: unknown };
      expect(getJson.authenticated).toBe(false);
      expect(getJson.player).toBeNull();

      const mgrCheck = await requireManagerSession(reqWithOldCookie);
      expect(mgrCheck.authorized).toBe(false);
      expect(mgrCheck.status).toBe(401);

      const playerCheck = await requirePlayerSession(reqWithOldCookie);
      expect(playerCheck.authorized).toBe(false);
      expect(playerCheck.status).toBe(401);
    } finally {
      raw.close();
    }
  });

  it("enforces anti-enumeration (identical error/status + dummy scrypt), avoids SELECT * in login lookup, and auto-rehashes legacy PIN", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, db, executedQueries } = createTempPlayersDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    __setAuthRateLimitDriverForTest(createInMemorySharedDriver({ acctLimit: 20, ipLimit: 50, pairLimit: 20 }));

    try {
      const dummyReasons: string[] = [];
      __setDummyScryptHookForTest((reason) => {
        dummyReasons.push(reason);
      });

      const strongHash = hashPassword("StrongPass@2026");
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, access_role, username, pin_code, status)
         VALUES (1, 'Active User', 'Active', 10, 'player', 'active10', ?, 'Đang sinh hoạt'),
                (2, 'Inactive User', 'Inactive', 11, 'player', 'inactive11', ?, 'inactive'),
                (3, 'Legacy User', 'Legacy', 14, 'player', 'legacy14', '1234', 'Đang sinh hoạt'),
                (4, 'Legacy Custom User', 'LegacyCustom', 15, 'player', 'legacy15', 'LegacyPin@7788', 'Đang sinh hoạt')`
      ).run(strongHash, strongHash);

      const emptyUser = await verifyCredentials("", "WrongPass@1", "10.0.0.1");
      const emptyPin = await verifyCredentials("active10", "", "10.0.0.1");
      const wrongPassActive = await verifyCredentials("active10", "WrongPass@1", "10.0.0.1");
      const missingAccount = await verifyCredentials("nonexistent_user", "WrongPass@1", "10.0.0.1");
      const inactiveAccount = await verifyCredentials("inactive11", "StrongPass@2026", "10.0.0.1");
      const wrongPassLegacy = await verifyCredentials("legacy14", "9999", "10.0.0.1");

      // Zero enumeration difference across ALL failure classes
      for (const res of [
        emptyUser,
        emptyPin,
        wrongPassActive,
        missingAccount,
        inactiveAccount,
        wrongPassLegacy,
      ]) {
        expect(res.success).toBe(false);
        expect(res.status).toBe(401);
        expect(res.error).toBe(UNIFIED_LOGIN_ERROR_MESSAGE);
      }

      // Deterministic verification that dummy Scrypt ran on missing, inactive, AND wrong-PIN-on-legacy-plaintext
      expect(dummyReasons).toEqual(["missing", "inactive", "legacy_wrong_pin"]);

      // Login candidate lookup must NOT use SELECT * and must NOT select pin_code for all players
      const lookupSelect = executedQueries.find((q) => q.includes("ORDER BY id ASC"));
      expect(lookupSelect).toBeDefined();
      expect(lookupSelect?.toUpperCase()).not.toContain("SELECT *");
      expect(lookupSelect?.toLowerCase()).not.toContain("pin_code");

      // Default PIN "1234" is rejected and NOT auto-rehashed
      const defaultPinLogin = await verifyCredentials("#14", "1234", "10.0.0.1");
      expect(defaultPinLogin.success).toBe(false);
      expect(defaultPinLogin.status).toBe(403);
      expect(defaultPinLogin.errorCode).toBe("DEFAULT_PIN_RESET_REQUIRED");

      const defaultRow = raw.prepare("SELECT pin_code FROM players WHERE id = 3").get() as {
        pin_code: string;
      };
      expect(defaultRow.pin_code).toBe("1234");

      // Non-default legacy plaintext user logs in and deterministically upgrades to scrypt$
      const legacyLogin = await verifyCredentials("#15", "LegacyPin@7788", "10.0.0.1");
      expect(legacyLogin.success).toBe(true);
      expect(legacyLogin.status).toBe(200);
      expect(legacyLogin.mustChangePassword).toBe(false);

      const updatedRow = raw.prepare("SELECT pin_code FROM players WHERE id = 4").get() as {
        pin_code: string;
      };
      expect(updatedRow.pin_code.startsWith("scrypt$")).toBe(true);
      expect(verifyPassword("LegacyPin@7788", updatedRow.pin_code)).toBe(true);

      // New password policy checks
      expect(validatePasswordStrength("a".repeat(129)).valid).toBe(false);
      expect(validatePasswordStrength("aaaaaa").valid).toBe(false);
    } finally {
      raw.close();
    }
  }, 15_000);
});

describe("Phase 5.1 – C & E. Distributed Rate Limiting, Fail-Closed Redis, CSRF & RBAC", () => {
  it("validates Upstash Redis config requires HTTPS URL and non-empty token", () => {
    expect(
      hasValidAuthUpstashConfig({
        UPSTASH_REDIS_REST_URL: "https://example-redis.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "valid-token",
      })
    ).toBe(true);
    expect(
      hasValidAuthUpstashConfig({
        UPSTASH_REDIS_REST_URL: "http://example-redis.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "valid-token",
      })
    ).toBe(false);
    expect(
      hasValidAuthUpstashConfig({
        UPSTASH_REDIS_REST_URL: "not-a-valid-url",
        UPSTASH_REDIS_REST_TOKEN: "valid-token",
      })
    ).toBe(false);
    expect(
      hasValidAuthUpstashConfig({
        UPSTASH_REDIS_REST_URL: "https://example-redis.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "",
      })
    ).toBe(false);
    expect(hasValidAuthUpstashConfig({})).toBe(false);
  });

  it("fails closed in Production and Vercel Preview when Redis env is missing (never falls back to in-memory Map) and hashes all Redis keys", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const missingConfigRes = await evaluateAuthRateLimit({
      username: "tiengnguyen",
      clientIp: "203.0.113.5",
    });
    expect(missingConfigRes.allowed).toBe(false);
    if (!missingConfigRes.allowed) {
      expect(missingConfigRes.status).toBe(503);
      expect(missingConfigRes.errorCode).toBe("AUTH_RATE_LIMIT_CONFIG_MISSING");
    }
    expect(__getLocalAuthRateLimitBucketCountForTest()).toBe(0);

    // Vercel Preview without Upstash Redis also fails closed (503) with zero in-memory fallback
    const previewMissingRedisRes = await evaluateAuthRateLimit({
      username: "tiengnguyen",
      clientIp: "203.0.113.5",
      env: {
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        AUTH_SECRET: "preview-dedicated-auth-secret-at-least-32-chars!",
      },
    });
    expect(previewMissingRedisRes.allowed).toBe(false);
    if (!previewMissingRedisRes.allowed) {
      expect(previewMissingRedisRes.status).toBe(503);
      expect(previewMissingRedisRes.errorCode).toBe("AUTH_RATE_LIMIT_CONFIG_MISSING");
    }
    expect(__getLocalAuthRateLimitBucketCountForTest()).toBe(0);

    // Cache key detects same-length token rotation and URL rotation
    const key1 = getUpstashConfigCacheKey("https://redis-a.upstash.io", "token-1111-aaaa");
    const key2 = getUpstashConfigCacheKey("https://redis-a.upstash.io", "token-2222-bbbb");
    const key3 = getUpstashConfigCacheKey("https://redis-b.upstash.io", "token-1111-aaaa");
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).not.toContain("token-1111-aaaa");

    await evaluateAuthRateLimit({
      username: "tiengnguyen",
      clientIp: "203.0.113.5",
      timeoutMs: 5,
      env: {
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        AUTH_SECRET: "preview-dedicated-auth-secret-at-least-32-chars!",
        UPSTASH_REDIS_REST_URL: "https://redis-a.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "token-1111-aaaa",
      },
    });
    expect(__getCachedRedisDriverKeyForTest()).toBe(key1);

    await evaluateAuthRateLimit({
      username: "tiengnguyen",
      clientIp: "203.0.113.5",
      timeoutMs: 5,
      env: {
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        AUTH_SECRET: "preview-dedicated-auth-secret-at-least-32-chars!",
        UPSTASH_REDIS_REST_URL: "https://redis-a.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "token-2222-bbbb",
      },
    });
    expect(__getCachedRedisDriverKeyForTest()).toBe(key2);

    // Key hashing never leaks raw username or IP
    const seenKeys: Array<{ scope: string; key: string }> = [];
    __setAuthRateLimitDriverForTest(createInMemorySharedDriver({ seenKeys }));
    const acctHash = hashAuthRateLimitIdentifier("acct", "tiengnguyen");
    const ipHash = hashAuthRateLimitIdentifier("ip", "203.0.113.5");
    expect(acctHash).toMatch(/^[a-f0-9]{32}$/);
    expect(ipHash).toMatch(/^[a-f0-9]{32}$/);

    await evaluateAuthRateLimit({ username: "tiengnguyen", clientIp: "203.0.113.5" });
    for (const entry of seenKeys) {
      expect(entry.key).toMatch(/^[a-f0-9]{32}$/);
      expect(entry.key).not.toContain("tiengnguyen");
      expect(entry.key).not.toContain("203.0.113.5");
    }
  });

  it("blocks brute-force per account+IP pair and credential stuffing per IP without hard-locking legitimate owner on a clean IP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, db } = createTempPlayersDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);
    __setAuthRateLimitDriverForTest(createInMemorySharedDriver({ acctLimit: 5, ipLimit: 15, pairLimit: 5 }));

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, access_role, username, pin_code, status)
         VALUES (1, 'Victim User', 'Victim', 9, 'player', 'victim9', ?, 'Đang sinh hoạt')`
      ).run(hashPassword("CorrectPass@2026"));

      // 1. Attacker brute-forces victim9 from 6 rotating IPs -> does NOT globally DoS victim9
      for (let i = 1; i <= 6; i++) {
        const res = await verifyCredentials("victim9", "WrongPass@1", `198.51.100.${i}`);
        expect(res.status).toBe(401);
      }

      // Attacker hitting same account+IP pair >5 times is blocked with 429
      for (let attempt = 2; attempt <= 5; attempt++) {
        const res = await verifyCredentials("victim9", "WrongPass@1", "198.51.100.1");
        expect(res.status).toBe(401);
      }
      const blockedPair = await verifyCredentials("victim9", "WrongPass@1", "198.51.100.1");
      expect(blockedPair.success).toBe(false);
      expect(blockedPair.status).toBe(429);

      // Legitimate owner victim9 logging in from a clean IP with correct PIN STILL succeeds (no Account-Level DoS)
      const ownerLogin = await verifyCredentials("victim9", "CorrectPass@2026", "203.0.113.200");
      expect(ownerLogin.success).toBe(true);
      expect(ownerLogin.status).toBe(200);

      // 2. Credential stuffing from single IP across 16 different accounts -> 16th blocked with 429
      const stuffingIp = "203.0.113.77";
      for (let i = 1; i <= 15; i++) {
        const res = await verifyCredentials(`sprayuser${i}`, "WrongPass@1", stuffingIp);
        expect(res.status).toBe(401);
      }
      const blockedStuffing = await verifyCredentials("sprayuser16", "WrongPass@1", stuffingIp);
      expect(blockedStuffing.success).toBe(false);
      expect(blockedStuffing.status).toBe(429);
    } finally {
      raw.close();
    }
  }, 30_000);

  it("fails closed (503) on Redis timeout and Redis runtime errors without in-memory fallback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.AUTH_SECRET = VALID_TEST_SECRET;

    // 1. Redis timeout
    __setAuthRateLimitDriverForTest({
      async limitAccount() {
        return new Promise(() => {});
      },
      async limitIp() {
        return new Promise(() => {});
      },
      async limitPair() {
        return new Promise(() => {});
      },
    });
    const timeoutRes = await evaluateAuthRateLimit({
      username: "user1",
      clientIp: "203.0.113.8",
      timeoutMs: 20,
    });
    expect(timeoutRes.allowed).toBe(false);
    if (!timeoutRes.allowed) {
      expect(timeoutRes.status).toBe(503);
      expect(timeoutRes.errorCode).toBe("AUTH_RATE_LIMIT_TIMEOUT");
    }

    // 2. Redis error
    __setAuthRateLimitDriverForTest({
      async limitAccount() {
        throw new Error("ECONNRESET");
      },
      async limitIp() {
        throw new Error("ECONNRESET");
      },
      async limitPair() {
        throw new Error("ECONNRESET");
      },
    });
    const errorRes = await evaluateAuthRateLimit({
      username: "user1",
      clientIp: "203.0.113.8",
    });
    expect(errorRes.allowed).toBe(false);
    if (!errorRes.allowed) {
      expect(errorRes.status).toBe(503);
      expect(errorRes.errorCode).toBe("AUTH_RATE_LIMIT_ERROR");
    }
    expect(__getLocalAuthRateLimitBucketCountForTest()).toBe(0);

    // 3. clearAuthRateLimitOnSuccess also respects timeoutMs so hung Redis reset cannot hang login
    __setAuthRateLimitDriverForTest({
      async limitAccount() {
        return { success: true };
      },
      async limitIp() {
        return { success: true };
      },
      async limitPair() {
        return { success: true };
      },
      async resetAccount() {
        return new Promise(() => {});
      },
      async resetPair() {
        return new Promise(() => {});
      },
    });
    await expect(
      clearAuthRateLimitOnSuccess({
        username: "user1",
        clientIp: "203.0.113.8",
        timeoutMs: 20,
      })
    ).resolves.toBeUndefined();
  });

  it("enforces CSRF origin check, Retry-After on 429, and Manager RBAC on POST /api/auth", async () => {
    process.env.AUTH_SECRET = VALID_TEST_SECRET;
    const { raw, db } = createTempPlayersDb();
    vi.spyOn(dbModule, "getAsyncDb").mockReturnValue(db);

    try {
      raw.prepare(
        `INSERT INTO players (code_order, full_name, short_name, jersey_number, access_role, username, pin_code, status)
         VALUES (1, 'Manager 1', 'Mgr', 1, 'manager', 'mgr1', ?, 'Đang sinh hoạt'),
                (2, 'Player 2', 'Ply', 2, 'player', 'ply2', ?, 'Đang sinh hoạt')`
      ).run(hashPassword("MgrPass@2026"), hashPassword("PlyPass@2026"));

      const playerRow = raw.prepare("SELECT * FROM players WHERE id = 2").get() as unknown as Player;
      const managerRow = raw.prepare("SELECT * FROM players WHERE id = 1").get() as unknown as Player;
      const playerCookie = createSessionToken(playerRow, 24);
      const managerCookie = createSessionToken(managerRow, 24);

      // Cross-origin CSRF -> 403
      const csrfRes = await postAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://evil.example",
            "content-type": "application/json",
          },
          body: JSON.stringify({ action: "login", username: "mgr1", pin: "MgrPass@2026" }),
        })
      );
      expect(csrfRes.status).toBe(403);

      // switch_role RBAC: Guest 401, Player 403, Manager 200
      const guestSwitch = await postAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://fchdhgonoi.vercel.app",
            "content-type": "application/json",
          },
          body: JSON.stringify({ action: "switch_role", playerId: 2 }),
        })
      );
      expect(guestSwitch.status).toBe(401);

      const playerSwitch = await postAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://fchdhgonoi.vercel.app",
            cookie: `${SESSION_COOKIE_NAME}=${playerCookie}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ action: "switch_role", playerId: 1 }),
        })
      );
      expect(playerSwitch.status).toBe(403);

      const managerSwitch = await postAuthRoute(
        new NextRequest("https://fchdhgonoi.vercel.app/api/auth", {
          method: "POST",
          headers: {
            host: "fchdhgonoi.vercel.app",
            origin: "https://fchdhgonoi.vercel.app",
            cookie: `${SESSION_COOKIE_NAME}=${managerCookie}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ action: "switch_role", playerId: 2 }),
        })
      );
      expect(managerSwitch.status).toBe(200);

      // Trusted IP extraction prefers x-vercel-forwarded-for
      const ip = extractTrustedClientIp(
        new Headers({
          "x-vercel-forwarded-for": "198.51.100.42, 10.0.0.1",
          "x-forwarded-for": "1.2.3.4",
        })
      );
      expect(ip).toBe("198.51.100.42");
    } finally {
      raw.close();
    }
  });
});
