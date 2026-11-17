import { ANALYTICS_MAX_BATCH_SIZE, ANALYTICS_TIMEZONE } from "./config";
import type {
  AnalyticsGroupBy,
  AnalyticsPeriod,
  AnalyticsPreset,
  AnalyticsSection,
  ProductEventInput,
  ProductEventName,
} from "./types";

export const VALID_SECTIONS: ReadonlySet<AnalyticsSection> = new Set([
  "overview",
  "matches",
  "engagement",
  "finance",
  "sponsors",
  "community",
  "product",
  "my-insights",
]);

export const VALID_EVENT_NAMES: ReadonlySet<ProductEventName> = new Set([
  "page_view",
  "club_post_view",
  "player_profile_view",
  "sponsor_impression",
  "sponsor_click",
  "rsvp_flow_open",
  "rsvp_submit_success",
  "feature_action_success",
]);

export const VALID_ROUTE_KEYS: ReadonlySet<string> = new Set([
  "/",
  "/hoat-dong",
  "/hoat-dong/[id]",
  "/cau-thu/[id]",
  "/bao-cao-tai-chinh",
  "/nha-tai-tro",
  "/cau-chuyen-go-noi",
  "/offline",
  "/workspace",
]);

export const VALID_METADATA_KEYS: ReadonlySet<string> = new Set([
  "placement",
  "action",
  "category",
  "tab",
]);

const FORBIDDEN_METADATA_PATTERN =
  /(pin|phone|password|token|secret|note|notes|bank|account|email|ip|user[_-]?agent|referrer|query|full[_-]?url|username)/i;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function getTodayVN(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidIsoDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function addDaysIsoDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function diffDaysInclusive(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.floor((end - start) / 86400000) + 1;
}

export function computePreviousPeriod(from: string, to: string): {
  from: string;
  to: string;
} {
  const days = Math.max(1, diffDaysInclusive(from, to));
  const prevTo = addDaysIsoDate(from, -1);
  const prevFrom = addDaysIsoDate(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

export function resolveAnalyticsPeriod(params: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
  earliestDataDate?: string | null;
}): { ok: true; period: AnalyticsPeriod } | { ok: false; error: string } {
  const today = getTodayVN(params.now);
  const rawPreset = (params.preset || "").trim() as AnalyticsPreset;
  const rawFrom = (params.from || "").trim();
  const rawTo = (params.to || "").trim();

  if (rawFrom || rawTo) {
    if (!rawFrom || !rawTo) {
      return { ok: false, error: "Cần truyền đủ cả ngày bắt đầu (from) và kết thúc (to)." };
    }
    if (!isValidIsoDate(rawFrom) || !isValidIsoDate(rawTo)) {
      return { ok: false, error: "Định dạng ngày không hợp lệ (yêu cầu YYYY-MM-DD)." };
    }
    if (rawFrom > rawTo) {
      return { ok: false, error: "Ngày bắt đầu (from) không được lớn hơn ngày kết thúc (to)." };
    }
    return {
      ok: true,
      period: {
        from: rawFrom,
        to: rawTo,
        preset: rawPreset && rawPreset !== "custom" ? rawPreset : "custom",
      },
    };
  }

  const preset: AnalyticsPreset = rawPreset || "90d";
  switch (preset) {
    case "30d":
      return { ok: true, period: { from: addDaysIsoDate(today, -29), to: today, preset } };
    case "90d":
      return { ok: true, period: { from: addDaysIsoDate(today, -89), to: today, preset } };
    case "12m":
      return { ok: true, period: { from: addDaysIsoDate(today, -364), to: today, preset } };
    case "ytd": {
      const year = today.slice(0, 4);
      return { ok: true, period: { from: `${year}-01-01`, to: today, preset } };
    }
    case "all": {
      const start =
        params.earliestDataDate && isValidIsoDate(params.earliestDataDate)
          ? params.earliestDataDate
          : "2024-01-01";
      return { ok: true, period: { from: start <= today ? start : today, to: today, preset } };
    }
    default:
      return { ok: false, error: "Khoảng thời gian (preset) không hợp lệ." };
  }
}

export function parseSection(raw: string | null): AnalyticsSection | null {
  if (!raw) return "overview";
  const clean = raw.trim() as AnalyticsSection;
  return VALID_SECTIONS.has(clean) ? clean : null;
}

export function parseGroupBy(raw: string | null): AnalyticsGroupBy {
  if (raw === "match" || raw === "week" || raw === "month" || raw === "quarter") {
    return raw;
  }
  return "month";
}

export function validateProductEventBatch(
  rawEvents: unknown
): { ok: true; events: ProductEventInput[] } | { ok: false; error: string } {
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return { ok: false, error: "Danh sách events không hợp lệ hoặc rỗng." };
  }
  if (rawEvents.length > ANALYTICS_MAX_BATCH_SIZE) {
    return {
      ok: false,
      error: `Mỗi batch chỉ được gửi tối đa ${ANALYTICS_MAX_BATCH_SIZE} events.`,
    };
  }

  const validated: ProductEventInput[] = [];
  for (const item of rawEvents) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Cấu trúc event không hợp lệ." };
    }
    const rec = item as Record<string, unknown>;
    const eventUuid = typeof rec.eventUuid === "string" ? rec.eventUuid.trim() : "";
    if (!UUID_REGEX.test(eventUuid)) {
      return { ok: false, error: "eventUuid phải đúng định dạng UUID." };
    }

    const eventName = typeof rec.eventName === "string" ? rec.eventName.trim() : "";
    if (!VALID_EVENT_NAMES.has(eventName as ProductEventName)) {
      return { ok: false, error: `eventName không thuộc allowlist: ${eventName}` };
    }

    let routeKey: string | null = null;
    if (rec.routeKey !== undefined && rec.routeKey !== null && rec.routeKey !== "") {
      if (typeof rec.routeKey !== "string" || !VALID_ROUTE_KEYS.has(rec.routeKey.trim())) {
        return { ok: false, error: "routeKey không thuộc allowlist hoặc chứa query/URL thô." };
      }
      routeKey = rec.routeKey.trim();
    }

    let contentType: string | null = null;
    if (rec.contentType !== undefined && rec.contentType !== null && rec.contentType !== "") {
      if (
        typeof rec.contentType !== "string" ||
        !["club_post", "player_profile", "sponsor", "match"].includes(rec.contentType)
      ) {
        return { ok: false, error: "contentType không hợp lệ." };
      }
      contentType = rec.contentType;
    }

    let contentId: number | null = null;
    if (rec.contentId !== undefined && rec.contentId !== null && rec.contentId !== "") {
      const n = Number(rec.contentId);
      if (!Number.isInteger(n) || n <= 0) {
        return { ok: false, error: "contentId phải là số nguyên dương." };
      }
      contentId = n;
    }

    let sponsorId: number | null = null;
    if (rec.sponsorId !== undefined && rec.sponsorId !== null && rec.sponsorId !== "") {
      const n = Number(rec.sponsorId);
      if (!Number.isInteger(n) || n <= 0) {
        return { ok: false, error: "sponsorId phải là số nguyên dương." };
      }
      sponsorId = n;
    }

    let metadata: Record<string, string | number | boolean> | null = null;
    if (rec.metadata !== undefined && rec.metadata !== null) {
      if (typeof rec.metadata !== "object" || Array.isArray(rec.metadata)) {
        return { ok: false, error: "metadata phải là object phẳng." };
      }
      const cleanMeta: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(rec.metadata as Record<string, unknown>)) {
        if (FORBIDDEN_METADATA_PATTERN.test(k) || !VALID_METADATA_KEYS.has(k)) {
          return { ok: false, error: `metadata key "${k}" không được phép.` };
        }
        if (typeof v === "string") {
          if (v.length > 64) {
            return { ok: false, error: `metadata.${k} vượt quá 64 ký tự.` };
          }
          cleanMeta[k] = v;
        } else if (typeof v === "number" || typeof v === "boolean") {
          cleanMeta[k] = v;
        } else {
          return { ok: false, error: `metadata.${k} chỉ nhận primitive.` };
        }
      }
      metadata = Object.keys(cleanMeta).length > 0 ? cleanMeta : null;
    }

    validated.push({
      eventUuid,
      eventName: eventName as ProductEventName,
      routeKey,
      contentType,
      contentId,
      sponsorId,
      metadata,
    });
  }

  return { ok: true, events: validated };
}
