import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { getAuthSecret, isProductionAuthEnv, normalizeLoginString } from "./auth";

export const AUTH_ACCOUNT_MAX_ATTEMPTS = 5;
export const AUTH_PAIR_MAX_ATTEMPTS = 5;
export const AUTH_IP_MAX_ATTEMPTS = 15;
export const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const AUTH_LOCKOUT_SECONDS = 300; // 5 minutes
export const AUTH_REDIS_TIMEOUT_MS = 1500;

export interface AuthRateLimitStepResult {
  success: boolean;
  remaining?: number;
  reset?: number; // Unix timestamp ms
}

export interface AuthRateLimitDriver {
  limitAccount(hashedKey: string): Promise<AuthRateLimitStepResult>;
  limitIp(hashedKey: string): Promise<AuthRateLimitStepResult>;
  limitPair(hashedKey: string): Promise<AuthRateLimitStepResult>;
  resetAccount?(hashedKey: string): Promise<void>;
  resetPair?(hashedKey: string): Promise<void>;
}

export type AuthRateLimitEvaluation =
  | { allowed: true; mode: "shared" | "local-dev" }
  | {
      allowed: false;
      status: 429 | 503;
      errorCode:
        | "AUTH_RATE_LIMITED"
        | "AUTH_RATE_LIMIT_CONFIG_MISSING"
        | "AUTH_RATE_LIMIT_TIMEOUT"
        | "AUTH_RATE_LIMIT_ERROR";
      waitSeconds?: number;
      error: string;
    };

interface LocalAttemptBucket {
  count: number;
  resetAt: number;
}

const localDevBuckets = new Map<string, LocalAttemptBucket>();
const MAX_LOCAL_BUCKETS = 2000;

let cachedRedisDriverKey = "";
let cachedRedisDriver: AuthRateLimitDriver | null = null;
let testDriverOverride: AuthRateLimitDriver | null = null;

export function __setAuthRateLimitDriverForTest(driver: AuthRateLimitDriver | null): void {
  testDriverOverride = driver;
}

export function __resetAuthRateLimitForTest(): void {
  localDevBuckets.clear();
  cachedRedisDriverKey = "";
  cachedRedisDriver = null;
  testDriverOverride = null;
}

export function __getLocalAuthRateLimitBucketCountForTest(): number {
  return localDevBuckets.size;
}

export function hasValidAuthUpstashConfig(
  env: Record<string, string | undefined> = process.env
): boolean {
  const url =
    typeof env.UPSTASH_REDIS_REST_URL === "string" ? env.UPSTASH_REDIS_REST_URL.trim() : "";
  const token =
    typeof env.UPSTASH_REDIS_REST_TOKEN === "string" ? env.UPSTASH_REDIS_REST_TOKEN.trim() : "";
  if (!url || !token) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function getUpstashAuthDriver(
  env: Record<string, string | undefined> = process.env
): AuthRateLimitDriver | null {
  if (testDriverOverride) return testDriverOverride;
  if (!hasValidAuthUpstashConfig(env)) return null;

  const url = env.UPSTASH_REDIS_REST_URL!.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN!.trim();
  const cacheKey = `${url}:${token.length}`;
  if (cachedRedisDriver && cachedRedisDriverKey === cacheKey) {
    return cachedRedisDriver;
  }

  const redis = new Redis({ url, token });
  const accountLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(AUTH_ACCOUNT_MAX_ATTEMPTS, "15 m"),
    prefix: "fcgn:auth:acct",
    ephemeralCache: false,
    analytics: false,
  });
  const pairLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(AUTH_PAIR_MAX_ATTEMPTS, "15 m"),
    prefix: "fcgn:auth:pair",
    ephemeralCache: false,
    analytics: false,
  });
  const ipLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(AUTH_IP_MAX_ATTEMPTS, "15 m"),
    prefix: "fcgn:auth:ip",
    ephemeralCache: false,
    analytics: false,
  });

  cachedRedisDriver = {
    limitAccount: (k) => accountLimiter.limit(k),
    limitPair: (k) => pairLimiter.limit(k),
    limitIp: (k) => ipLimiter.limit(k),
    resetAccount: (k) => accountLimiter.resetUsedTokens(k),
    resetPair: (k) => pairLimiter.resetUsedTokens(k),
  };
  cachedRedisDriverKey = cacheKey;
  return cachedRedisDriver;
}

/**
 * Extracts trusted client IP prioritizing Vercel's proxy header.
 */
export function extractTrustedClientIp(headers: Headers): string {
  const vercelIp = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercelIp) return vercelIp;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "local";
}

/**
 * Hashes auth rate-limit identifiers with HMAC-SHA256 before storing in Redis
 * so raw usernames, phone numbers, jersey numbers, and client IPs never appear in Redis keys.
 */
export function hashAuthRateLimitIdentifier(
  scope: "acct" | "ip" | "pair",
  rawIdentifier: string,
  env: Record<string, string | undefined> = process.env
): string {
  const secret = getAuthSecret(env);
  return crypto
    .createHmac("sha256", secret)
    .update(`auth-rl:v1:${scope}:${rawIdentifier}`)
    .digest("hex")
    .slice(0, 32);
}

function buildHashedRateLimitKeys(
  username: string,
  clientIp: string,
  env: Record<string, string | undefined>
): { acctKey: string; ipKey: string; pairKey: string } {
  const normUser = normalizeLoginString(username) || username.trim().toLowerCase() || "anon";
  const normIp = String(clientIp || "local").trim() || "local";
  return {
    acctKey: hashAuthRateLimitIdentifier("acct", normUser, env),
    ipKey: hashAuthRateLimitIdentifier("ip", normIp, env),
    pairKey: hashAuthRateLimitIdentifier("pair", `${normUser}:${normIp}`, env),
  };
}

function evaluateLocalDevBucket(
  scopedHashKey: string,
  maxAttempts: number,
  now = Date.now()
): { success: boolean; reset: number } {
  for (const [k, v] of localDevBuckets.entries()) {
    if (now >= v.resetAt) {
      localDevBuckets.delete(k);
    }
  }

  const existing = localDevBuckets.get(scopedHashKey);
  if (!existing || now >= existing.resetAt) {
    while (localDevBuckets.size >= MAX_LOCAL_BUCKETS) {
      const oldest = localDevBuckets.keys().next().value;
      if (oldest === undefined) break;
      localDevBuckets.delete(oldest);
    }
    const resetAt = now + AUTH_WINDOW_MS;
    localDevBuckets.set(scopedHashKey, { count: 1, resetAt });
    return { success: true, reset: resetAt };
  }

  if (existing.count >= maxAttempts) {
    return { success: false, reset: existing.resetAt };
  }

  existing.count += 1;
  return { success: true, reset: existing.resetAt };
}

function computeWaitSeconds(resetMs?: number, now = Date.now()): number {
  if (typeof resetMs === "number" && Number.isFinite(resetMs) && resetMs > now) {
    return Math.max(1, Math.min(AUTH_LOCKOUT_SECONDS, Math.ceil((resetMs - now) / 1000)));
  }
  return AUTH_LOCKOUT_SECONDS;
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("AUTH_REDIS_TIMEOUT"));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Evaluates distributed auth rate limiting across Account, IP, and Account+IP pair.
 * Fails closed (503) in Production if Upstash Redis is missing, unreachable, or times out.
 * Never falls back to per-instance memory in Production.
 */
export async function evaluateAuthRateLimit(params: {
  username: string;
  clientIp: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  now?: number;
}): Promise<AuthRateLimitEvaluation> {
  const env = params.env ?? process.env;
  const isProd = isProductionAuthEnv(env);
  const driver = getUpstashAuthDriver(env);
  const { acctKey, ipKey, pairKey } = buildHashedRateLimitKeys(
    params.username,
    params.clientIp,
    env
  );

  if (!driver) {
    if (isProd) {
      console.error("[AUTH SECURITY] Missing Upstash Redis configuration for production rate limiting.");
      return {
        allowed: false,
        status: 503,
        errorCode: "AUTH_RATE_LIMIT_CONFIG_MISSING",
        error: "Hệ thống bảo vệ đăng nhập chưa được cấu hình đầy đủ trên máy chủ.",
      };
    }

    const now = params.now ?? Date.now();
    const ipRes = evaluateLocalDevBucket(`ip:${ipKey}`, AUTH_IP_MAX_ATTEMPTS, now);
    const acctRes = evaluateLocalDevBucket(`acct:${acctKey}`, AUTH_ACCOUNT_MAX_ATTEMPTS, now);
    const pairRes = evaluateLocalDevBucket(`pair:${pairKey}`, AUTH_PAIR_MAX_ATTEMPTS, now);

    if (!ipRes.success || !acctRes.success || !pairRes.success) {
      const waitSeconds = computeWaitSeconds(
        Math.min(ipRes.reset, acctRes.reset, pairRes.reset),
        now
      );
      return {
        allowed: false,
        status: 429,
        errorCode: "AUTH_RATE_LIMITED",
        waitSeconds,
        error: `Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ${waitSeconds} giây.`,
      };
    }

    return { allowed: true, mode: "local-dev" };
  }

  const timeoutMs = params.timeoutMs ?? AUTH_REDIS_TIMEOUT_MS;
  try {
    const [ipRes, acctRes, pairRes] = await runWithTimeout(
      Promise.all([
        driver.limitIp(ipKey),
        driver.limitAccount(acctKey),
        driver.limitPair(pairKey),
      ]),
      timeoutMs
    );

    if (!ipRes.success || !acctRes.success || !pairRes.success) {
      const now = params.now ?? Date.now();
      const blockedResets = [ipRes, acctRes, pairRes]
        .filter((r) => !r.success && typeof r.reset === "number")
        .map((r) => r.reset as number);
      const waitSeconds = computeWaitSeconds(
        blockedResets.length > 0 ? Math.min(...blockedResets) : undefined,
        now
      );
      return {
        allowed: false,
        status: 429,
        errorCode: "AUTH_RATE_LIMITED",
        waitSeconds,
        error: `Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ${waitSeconds} giây.`,
      };
    }

    return { allowed: true, mode: "shared" };
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "AUTH_REDIS_TIMEOUT";
    console.error("[AUTH SECURITY] Distributed rate limiter failed (fail-closed):", isTimeout ? "TIMEOUT" : "REDIS_ERROR");
    return {
      allowed: false,
      status: 503,
      errorCode: isTimeout ? "AUTH_RATE_LIMIT_TIMEOUT" : "AUTH_RATE_LIMIT_ERROR",
      error: "Hệ thống bảo vệ đăng nhập tạm thời gián đoạn. Vui lòng thử lại sau ít phút.",
    };
  }
}

/**
 * Resets per-account and account+IP counters upon valid authentication.
 * Retains per-IP counter so multi-account stuffing from one IP stays bounded.
 */
export async function clearAuthRateLimitOnSuccess(params: {
  username: string;
  clientIp: string;
  env?: Record<string, string | undefined>;
}): Promise<void> {
  const env = params.env ?? process.env;
  const { acctKey, pairKey } = buildHashedRateLimitKeys(
    params.username,
    params.clientIp,
    env
  );

  const driver = getUpstashAuthDriver(env);
  if (!driver) {
    if (!isProductionAuthEnv(env)) {
      localDevBuckets.delete(`acct:${acctKey}`);
      localDevBuckets.delete(`pair:${pairKey}`);
    }
    return;
  }

  await Promise.allSettled([
    driver.resetAccount ? driver.resetAccount(acctKey) : Promise.resolve(),
    driver.resetPair ? driver.resetPair(pairKey) : Promise.resolve(),
  ]);
}
