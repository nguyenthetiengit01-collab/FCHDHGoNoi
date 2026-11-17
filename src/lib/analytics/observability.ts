export type AnalyticsLogEventName =
  | "analytics_secret_invalid"
  | "analytics_rate_limit_blocked"
  | "analytics_rate_limit_degraded"
  | "analytics_event_ingestion_failed"
  | "analytics_cleanup_started"
  | "analytics_cleanup_completed"
  | "analytics_cleanup_failed";

export interface AnalyticsLogPayload {
  event: AnalyticsLogEventName;
  status?: number;
  errorCode?: string;
  durationMs?: number;
  deletedCount?: number;
}

/**
 * Emits a strictly allowlisted structured JSON log line for analytics operations.
 * Never includes PINs, passwords, secrets, Authorization headers, IPs, player IDs, or raw payloads.
 */
export function logAnalyticsEvent(
  level: "info" | "warn" | "error",
  payload: AnalyticsLogPayload
): void {
  const safeRecord: AnalyticsLogPayload = {
    event: payload.event,
  };
  if (typeof payload.status === "number") {
    safeRecord.status = payload.status;
  }
  if (typeof payload.errorCode === "string" && payload.errorCode.length > 0) {
    safeRecord.errorCode = payload.errorCode;
  }
  if (typeof payload.durationMs === "number" && Number.isFinite(payload.durationMs)) {
    safeRecord.durationMs = Math.max(0, Math.round(payload.durationMs));
  }
  if (typeof payload.deletedCount === "number" && Number.isFinite(payload.deletedCount)) {
    safeRecord.deletedCount = Math.max(0, Math.floor(payload.deletedCount));
  }

  const serialized = JSON.stringify(safeRecord);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}
