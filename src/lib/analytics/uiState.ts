import type {
  AnalyticsEnvelope,
  AnalyticsPreset,
  AnalyticsSection,
} from "./types";
import { isValidIsoDate } from "./validation";

export type ManagerAnalyticsSection = Exclude<
  AnalyticsSection,
  "community" | "my-insights"
>;

export type BuildAnalyticsParamsResult =
  | { ok: true; params: URLSearchParams }
  | { ok: false; error: string };

const STANDARD_PRESETS = new Set<AnalyticsPreset>([
  "30d",
  "90d",
  "12m",
  "ytd",
  "all",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Builds validated URLSearchParams for `/api/analytics`.
 * Never emits `preset=custom` without valid `from` and `to` dates.
 */
export function buildAnalyticsSearchParams(input: {
  section: ManagerAnalyticsSection;
  preset: AnalyticsPreset;
  customFrom?: string;
  customTo?: string;
  comparePrevious?: boolean;
}): BuildAnalyticsParamsResult {
  const params = new URLSearchParams({ section: input.section });

  if (input.preset === "custom") {
    const from = (input.customFrom || "").trim();
    const to = (input.customTo || "").trim();

    if (!from || !to) {
      return {
        ok: false,
        error: "Vui lòng chọn đủ cả Từ ngày và Đến ngày.",
      };
    }
    if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
      return {
        ok: false,
        error: "Định dạng ngày tùy chỉnh không hợp lệ (yêu cầu YYYY-MM-DD).",
      };
    }
    if (from > to) {
      return {
        ok: false,
        error: "Ngày bắt đầu (Từ ngày) không được lớn hơn ngày kết thúc (Đến ngày).",
      };
    }

    params.set("from", from);
    params.set("to", to);
  } else if (STANDARD_PRESETS.has(input.preset)) {
    params.set("preset", input.preset);
  } else {
    return {
      ok: false,
      error: "Khoảng thời gian (preset) không hợp lệ.",
    };
  }

  if (input.comparePrevious) {
    params.set("compare", "previous");
  }

  return { ok: true, params };
}

/**
 * Validates that an analytics envelope matches the currently selected section
 * and contains the expected section-specific payload shape before rendering.
 */
export function hasValidSectionEnvelope(
  section: ManagerAnalyticsSection,
  envelope: AnalyticsEnvelope<unknown> | null | undefined
): envelope is AnalyticsEnvelope<unknown> & { enabled: true; data: unknown } {
  if (!isRecord(envelope)) return false;
  if (envelope.enabled !== true) return false;
  if (envelope.section !== section) return false;
  if (!isRecord(envelope.data)) return false;

  const d = envelope.data;
  switch (section) {
    case "overview":
      return (
        isRecord(d.clubHealth) &&
        isRecord(d.matchPerformance) &&
        isRecord(d.finance) &&
        isRecord(d.trends) &&
        Array.isArray(d.trends.attendanceByMonth) &&
        Array.isArray(d.trends.cashflowByMonth) &&
        Array.isArray(d.insights)
      );
    case "matches":
      return (
        typeof d.completedMatches === "number" &&
        typeof d.scoredMatches === "number" &&
        typeof d.wins === "number" &&
        typeof d.draws === "number" &&
        typeof d.losses === "number" &&
        typeof d.goalsFor === "number" &&
        typeof d.goalsAgainst === "number" &&
        typeof d.goalDifference === "number" &&
        typeof d.missingCostMatches === "number" &&
        Array.isArray(d.matches)
      );
    case "engagement":
      return (
        isRecord(d.clubHealth) &&
        isRecord(d.retention30d) &&
        typeof d.monthlyActivePlayers === "number" &&
        typeof d.monthlyActiveManagers === "number"
      );
    case "finance":
      return (
        typeof d.totalIncome === "number" &&
        typeof d.matchIncome === "number" &&
        typeof d.operatingExpense === "number" &&
        typeof d.voluntaryContribution === "number" &&
        typeof d.sponsorAttributedIncome === "number" &&
        typeof d.unattributedOtherIncome === "number" &&
        Array.isArray(d.expenseBreakdown)
      );
    case "sponsors":
      return (
        typeof d.totalImpressions === "number" &&
        typeof d.totalClicks === "number" &&
        typeof d.sponsorAttributedIncome === "number" &&
        typeof d.unattributedOtherIncome === "number" &&
        typeof d.totalPostViews === "number" &&
        Array.isArray(d.sponsors)
      );
    case "product":
      return (
        typeof d.totalPageViews === "number" &&
        typeof d.totalEvents === "number" &&
        typeof d.totalProfileViews === "number" &&
        typeof d.totalPostViews === "number" &&
        typeof d.monthlyActivePlayers === "number" &&
        typeof d.monthlyActiveManagers === "number" &&
        isRecord(d.rsvpFunnel) &&
        Array.isArray(d.routeViews)
      );
    default:
      return false;
  }
}
