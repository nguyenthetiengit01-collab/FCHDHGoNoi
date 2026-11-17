import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { logAnalyticsEvent } from "./observability";
import { getActorHashSecret } from "./productEvents";

export const SHARED_RATE_LIMIT_MAX = 60;
export const SHARED_RATE_LIMIT_WINDOW_MS = 60_000;
export const DEGRADED_RATE_LIMIT_MAX = 20;
export const MAX_FALLBACK_BUCKETS = 1000;
export const UPSTASH_TIMEOUT_MS = 1500;

export interface RateLimitDriver {
  limit(identifier: string): Promise<{ success: boolean; remaining?: number; reset?: number }>;
}

export type RateLimitEvaluation =
  | { allowed: true; mode: "shared" | "degraded" }
  | { allowed: false; status: 429; mode: "shared" | "degraded" }
  | { allowed: false; status: 503; errorCode: "RATE_LIMIT_CONFIG_MISSING" };

interface FallbackBucket {
  count: number;
  resetAt: number;
}

const fallbackBuckets = new Map<string, FallbackBucket>();
let cachedDriverKey = "";
let cachedDriver: RateLimitDriver | null = null;
let testDriverOverride: RateLimitDriver | null = null;

export function __setRateLimiterForTest(driver: RateLimitDriver | null): void {
  testDriverOverride = driver;
}

export function __resetRateLimitStateForTest(): void {
  fallbackBuckets.clear();
  cachedDriverKey = "";
  cachedDriver = null;
  testDriverOverride = null;
}

export function __getFallbackBucketCountForTest(): number {
  return fallbackBuckets.size;
}

export function hasValidUpstashConfig(
  env: Record<string, string | undefined> = process.env
): boolean {
  const url = typeof env.UPSTASH_REDIS_REST_URL === "string" ? env.UPSTASH_REDIS_REST_URL.trim() : "";
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

function getSharedRateLimiter(
  env: Record<string, string | undefined> = process.env
): RateLimitDriver | null {
  if (testDriverOverride) return testDriverOverride;
  if (!hasValidUpstashConfig(env)) return null;

  const url = env.UPSTASH_REDIS_REST_URL!.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN!.trim();
  const cacheKey = `${url}:${token.length}`;
  if (cachedDriver && cachedDriverKey === cacheKey) {
    return cachedDriver;
  }

  const redis = new Redis({ url, token });
  cachedDriver = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(SHARED_RATE_LIMIT_MAX, "60 s"),
    prefix: "fcgn:rl:ae",
    analytics: false,
  });
  cachedDriverKey = cacheKey;
  return cachedDriver;
}

/**
 * Extracts client IP respecting Vercel's trusted proxy boundary header first.
 */
export function extractTrustedClientIp(headers: Headers): string {
  const vercelIp = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercelIp) return vercelIp;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "anon";
}

/**
 * Pseudonymizes rate-limit identity using HMAC-SHA256 so no raw player ID or IP
 * is ever stored as a Redis key or in fallback memory.
 */
export function buildPseudonymousRateLimitKey(
  params: { playerId?: number | null; clientIp: string },
  env: Record<string, string | undefined> = process.env
): string {
  const secret = getActorHashSecret(env);
  const rawIdentity =
    params.playerId && params.playerId > 0
      ? `actor:${params.playerId}`
      : `ip:${params.clientIp || "anon"}`;
  return crypto
    .createHmac("sha256", secret)
    .update(`rl:${rawIdentity}`)
    .digest("hex")
    .slice(0, 32);
}

function evaluateDegradedFallback(
  pseudonymousKey: string,
  now = Date.now(),
  maxBuckets = MAX_FALLBACK_BUCKETS
): boolean {
  for (const [k, b] of fallbackBuckets.entries()) {
    if (now >= b.resetAt) {
      fallbackBuckets.delete(k);
    }
  }

  const existing = fallbackBuckets.get(pseudonymousKey);
  if (!existing || now >= existing.resetAt) {
    while (fallbackBuckets.size >= maxBuckets) {
      const oldestKey = fallbackBuckets.keys().next().value;
      if (oldestKey === undefined) break;
      fallbackBuckets.delete(oldestKey);
    }
    fallbackBuckets.set(pseudonymousKey, {
      count: 1,
      resetAt: now + SHARED_RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (existing.count >= DEGRADED_RATE_LIMIT_MAX) {
    return false;
  }
  existing.count += 1;
  return true;
}

export async function evaluateAnalyticsEventRateLimit(params: {
  playerId?: number | null;
  headers: Headers;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  now?: number;
}): Promise<RateLimitEvaluation> {
  const env = params.env ?? process.env;
  const driver = getSharedRateLimiter(env);
  if (!driver) {
    logAnalyticsEvent("error", {
      event: "analytics_rate_limit_degraded",
      status: 503,
      errorCode: "RATE_LIMIT_CONFIG_MISSING",
    });
    return { allowed: false, status: 503, errorCode: "RATE_LIMIT_CONFIG_MISSING" };
  }

  const clientIp = extractTrustedClientIp(params.headers);
  const key = buildPseudonymousRateLimitKey(
    { playerId: params.playerId, clientIp },
    env
  );
  const timeoutMs = params.timeoutMs ?? UPSTASH_TIMEOUT_MS;

  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("REDIS_TIMEOUT"));
      }, timeoutMs);
    });

    const result = await Promise.race([driver.limit(key), timeoutPromise]);
    if (!result.success) {
      logAnalyticsEvent("warn", {
        event: "analytics_rate_limit_blocked",
        status: 429,
      });
      return { allowed: false, status: 429, mode: "shared" };
    }
    return { allowed: true, mode: "shared" };
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "REDIS_TIMEOUT";
    const allowedLocal = evaluateDegradedFallback(key, params.now ?? Date.now());
    logAnalyticsEvent("warn", {
      event: "analytics_rate_limit_degraded",
      status: allowedLocal ? 200 : 429,
      errorCode: isTimeout ? "REDIS_TIMEOUT" : "REDIS_ERROR",
    });
    if (!allowedLocal) {
      return { allowed: false, status: 429, mode: "degraded" };
    }
    return { allowed: true, mode: "degraded" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
