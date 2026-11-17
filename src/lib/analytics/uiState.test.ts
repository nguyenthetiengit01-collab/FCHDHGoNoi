import { describe, expect, it } from "vitest";
import {
  buildAnalyticsSearchParams,
  hasValidSectionEnvelope,
  type ManagerAnalyticsSection,
} from "./uiState";
import { resolveAnalyticsPeriod } from "./validation";
import type { AnalyticsEnvelope } from "./types";

function makeEnvelope(
  section: ManagerAnalyticsSection,
  data: unknown,
  enabled = true
): AnalyticsEnvelope<unknown> {
  return {
    enabled,
    section,
    generatedAt: "2026-11-17T00:00:00.000Z",
    timezone: "Asia/Ho_Chi_Minh",
    period: { from: "2026-10-19", to: "2026-11-17", preset: "30d" },
    coverage: {
      baselineAt: "2026-11-16T00:00:00.000Z",
      rate: 1,
      eligibleRecords: 2,
      knownRecords: 2,
      missingRecords: 0,
      isLowCoverage: false,
      limitations: [],
    },
    data,
  };
}

const VALID_PAYLOADS: Record<ManagerAnalyticsSection, unknown> = {
  overview: {
    clubHealth: { activePlayers: 2, pausedPlayers: 0, stoppedPlayers: 0 },
    matchPerformance: { completedMatches: 1, wins: 0, draws: 0, losses: 0, winRate: null },
    finance: { operatingBalance: -900000, cumulativeBalance: -900000, collectionRate: null, outstandingDebt: 0 },
    trends: { attendanceByMonth: [], cashflowByMonth: [] },
    insights: [],
  },
  matches: {
    completedMatches: 1,
    scoredMatches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: null,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    costPerAttendee: null,
    missingCostMatches: 0,
    matches: [],
  },
  engagement: {
    clubHealth: {
      rsvpResponseRate: null,
      rsvpRespondedSlots: 0,
      eligibleSlots: 0,
      rsvpPositiveRate: null,
      attendanceAfterPositiveRsvp: null,
      missingAttendanceSlots: 0,
      activePlayers: 2,
      pausedPlayers: 0,
      stoppedPlayers: 0,
      unknownPlayers: 0,
    },
    retention30d: { available: false, rate: null, eligibleCohortSize: 0 },
    monthlyActivePlayers: 1,
    monthlyActiveManagers: 1,
  },
  finance: {
    totalIncome: 0,
    matchIncome: 0,
    operatingExpense: 900000,
    averageMatchCost: 900000,
    voluntaryContribution: 0,
    voluntaryCount: 0,
    sponsorAttributedIncome: 0,
    unattributedOtherIncome: 0,
    expenseBreakdown: [],
  },
  sponsors: {
    totalImpressions: 0,
    totalClicks: 0,
    overallCtr: null,
    sponsorAttributedIncome: 0,
    unattributedOtherIncome: 0,
    totalPostViews: 0,
    sponsors: [],
  },
  product: {
    totalPageViews: 10,
    totalEvents: 12,
    rsvpFunnel: { submitSuccesses: 0, flowOpens: 0, conversionRate: null },
    totalProfileViews: 1,
    totalPostViews: 2,
    monthlyActivePlayers: 1,
    monthlyActiveManagers: 1,
    routeViews: [],
  },
};

describe("DEF-P4-01: hasValidSectionEnvelope & stale/schema guards", () => {
  const sections: ManagerAnalyticsSection[] = [
    "overview",
    "matches",
    "engagement",
    "finance",
    "sponsors",
    "product",
  ];

  it("accepts valid envelopes when envelope.section matches active section across all 6 tabs", () => {
    for (const sec of sections) {
      expect(hasValidSectionEnvelope(sec, makeEnvelope(sec, VALID_PAYLOADS[sec]))).toBe(true);
    }
  });

  it("rejects stale overview envelope when switching to any of the other 5 tabs", () => {
    const staleOverview = makeEnvelope("overview", VALID_PAYLOADS.overview);
    for (const sec of sections.filter((s) => s !== "overview")) {
      expect(hasValidSectionEnvelope(sec, staleOverview)).toBe(false);
    }
  });

  it("rejects cross-section mismatched envelopes and malformed schemas across all 6 tabs", () => {
    for (const sec of sections) {
      expect(hasValidSectionEnvelope(sec, makeEnvelope(sec, null))).toBe(false);
      expect(hasValidSectionEnvelope(sec, makeEnvelope(sec, {}))).toBe(false);
      expect(hasValidSectionEnvelope(sec, makeEnvelope(sec, VALID_PAYLOADS[sec], false))).toBe(false);
    }
  });
});

describe("DEF-P4-02: buildAnalyticsSearchParams & custom date validation", () => {
  it("builds valid from/to URLSearchParams for custom range 2020-01-01 to 2020-01-31 without preset=custom", () => {
    const res = buildAnalyticsSearchParams({
      section: "overview",
      preset: "custom",
      customFrom: "2020-01-01",
      customTo: "2020-01-31",
      comparePrevious: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.params.get("preset")).toBeNull();
    expect(res.params.get("from")).toBe("2020-01-01");
    expect(res.params.get("to")).toBe("2020-01-31");
    expect(res.params.get("compare")).toBe("previous");

    const period = resolveAnalyticsPeriod({
      preset: res.params.get("preset"),
      from: res.params.get("from"),
      to: res.params.get("to"),
    });
    expect(period).toEqual({
      ok: true,
      period: { from: "2020-01-01", to: "2020-01-31", preset: "custom" },
    });
  });

  it("rejects incomplete, malformed, or reversed custom date ranges without emitting preset=custom", () => {
    expect(
      buildAnalyticsSearchParams({ section: "overview", preset: "custom", customFrom: "", customTo: "" }).ok
    ).toBe(false);
    expect(
      buildAnalyticsSearchParams({ section: "overview", preset: "custom", customFrom: "2020-01-01", customTo: "" }).ok
    ).toBe(false);
    expect(
      buildAnalyticsSearchParams({ section: "overview", preset: "custom", customFrom: "2020-02-30", customTo: "2020-03-01" }).ok
    ).toBe(false);
    expect(
      buildAnalyticsSearchParams({ section: "overview", preset: "custom", customFrom: "2020-02-01", customTo: "2020-01-31" }).ok
    ).toBe(false);
  });

  it("keeps standard presets 30d, 90d, 12m, ytd, all unchanged", () => {
    for (const preset of ["30d", "90d", "12m", "ytd", "all"] as const) {
      const res = buildAnalyticsSearchParams({
        section: "matches",
        preset,
        comparePrevious: false,
      });
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      expect(res.params.get("section")).toBe("matches");
      expect(res.params.get("preset")).toBe(preset);
      expect(res.params.get("from")).toBeNull();
      expect(res.params.get("to")).toBeNull();
    }
  });
});
