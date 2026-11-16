export const ANALYTICS_TIMEZONE = "Asia/Ho_Chi_Minh" as const;
export const ANALYTICS_COVERAGE_THRESHOLD = 0.95;
export const ANALYTICS_RAW_RETENTION_DAYS = 90;
export const ANALYTICS_MAX_BATCH_SIZE = 20;

export function isAnalyticsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ANALYTICS_ENABLED?.trim().toLowerCase() === "true";
}

export function isLowCoverage(rate: number | null | undefined): boolean {
  if (rate === null || rate === undefined) return true;
  return rate < ANALYTICS_COVERAGE_THRESHOLD;
}
