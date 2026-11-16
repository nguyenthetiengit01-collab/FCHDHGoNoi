export type AnalyticsSection =
  | "overview"
  | "matches"
  | "engagement"
  | "finance"
  | "sponsors"
  | "community"
  | "product"
  | "my-insights";

export type AnalyticsPreset = "30d" | "90d" | "12m" | "ytd" | "all" | "custom";
export type AnalyticsGroupBy = "match" | "week" | "month" | "quarter";

export type ProductEventName =
  | "page_view"
  | "club_post_view"
  | "player_profile_view"
  | "sponsor_impression"
  | "sponsor_click"
  | "rsvp_flow_open"
  | "rsvp_submit_success"
  | "feature_action_success";

export interface AnalyticsPeriod {
  from: string;
  to: string;
  preset: AnalyticsPreset;
}

export interface AnalyticsCoverage {
  baselineAt: string | null;
  rate: number | null;
  eligibleRecords: number;
  knownRecords: number;
  missingRecords: number;
  isLowCoverage: boolean;
  limitations: string[];
}

export interface AnalyticsEnvelope<T> {
  enabled: boolean;
  section: AnalyticsSection;
  generatedAt: string;
  timezone: "Asia/Ho_Chi_Minh";
  period: AnalyticsPeriod;
  comparison?: { from: string; to: string };
  coverage: AnalyticsCoverage;
  data: T | null;
  message?: string;
}

export interface ClubHealthMetrics {
  activePlayers: number;
  pausedPlayers: number;
  stoppedPlayers: number;
  unknownPlayers: number;
  newMembers: number | null;
  stoppedInPeriod: number | null;
  netMemberGrowth: number | null;
  eligibleSlots: number;
  knownAttendanceSlots: number;
  missingAttendanceSlots: number;
  attendanceCoverage: number | null;
  teamAttendanceRate: number | null;
  rsvpRespondedSlots: number;
  rsvpResponseRate: number | null;
  rsvpPositiveSlots: number;
  rsvpPositiveRate: number | null;
  attendanceAfterPositiveRsvp: number | null;
}

export interface MatchPerformanceMetrics {
  totalMatchesInPeriod: number;
  completedMatches: number;
  scoredMatches: number;
  missingScoreMatches: number;
  missingCostMatches: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number | null;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  recentForm: Array<{
    matchId: number;
    matchDate: string;
    opponent: string;
    teamScore: number;
    opponentScore: number;
    result: "W" | "D" | "L";
  }>;
  totalMatchCost: number;
  totalAttendees: number;
  costPerAttendee: number | null;
  matches: Array<{
    id: number;
    matchNumber: number;
    label: string;
    matchDate: string;
    opponent: string;
    venue: string;
    status: string;
    teamScore: number | null;
    opponentScore: number | null;
    result: "W" | "D" | "L" | null;
    rsvpCount: number;
    attendeesCount: number;
    paidCount: number;
    collected: number;
    expense: number;
    net: number;
    costPerAttendee: number | null;
    hasMissingScore: boolean;
    hasMissingCost: boolean;
  }>;
}

export interface EngagementMetrics {
  clubHealth: ClubHealthMetrics;
  retention30d: {
    eligibleCohortSize: number;
    retainedCount: number;
    rate: number | null;
    available: boolean;
  };
  retention90d: {
    eligibleCohortSize: number;
    retainedCount: number;
    rate: number | null;
    available: boolean;
  };
  monthlyActivePlayers: number;
  monthlyActiveManagers: number;
  lifecycleTrend: Array<{
    month: string;
    joined: number;
    paused: number;
    stopped: number;
  }>;
  activityTrend: Array<{
    periodKey: string;
    label: string;
    rsvpPositive: number;
    attended: number;
    eligibleSlots: number;
    attendanceRate: number | null;
  }>;
}

export interface FinanceAnalyticsMetrics {
  matchIncome: number;
  mandatoryExpected: number;
  mandatoryCollected: number;
  collectionRate: number | null;
  outstandingDebt: number;
  voluntaryContribution: number;
  voluntaryCount: number;
  otherIncome: number;
  totalIncome: number;
  operatingExpense: number;
  operatingBalance: number;
  cumulativeBalance: number;
  averageMatchCost: number | null;
  costPerAttendance: number | null;
  sponsorAttributedIncome: number;
  unattributedOtherIncome: number;
  expenseBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  cashflowTrend: Array<{
    periodKey: string;
    label: string;
    income: number;
    expense: number;
    net: number;
  }>;
}

export interface SponsorCommunityMetrics {
  totalImpressions: number;
  totalClicks: number;
  overallCtr: number | null;
  sponsorAttributedIncome: number;
  unattributedOtherIncome: number;
  sponsors: Array<{
    sponsorId: number;
    name: string;
    tier: string;
    isActive: boolean;
    impressions: number;
    clicks: number;
    ctr: number | null;
    attributedIncome: number;
  }>;
  totalPostViews: number;
  posts: Array<{
    postId: number;
    slug: string;
    title: string;
    category: string;
    views: number;
  }>;
}

export interface ProductAnalyticsMetrics {
  totalEvents: number;
  totalPageViews: number;
  totalPostViews: number;
  totalProfileViews: number;
  totalSponsorImpressions: number;
  totalSponsorClicks: number;
  rsvpFunnel: {
    flowOpens: number;
    submitSuccesses: number;
    conversionRate: number | null;
  };
  monthlyActivePlayers: number;
  monthlyActiveManagers: number;
  routeViews: Array<{ routeKey: string; views: number }>;
  featureUsage: Array<{ action: string; count: number }>;
  dailyTrend: Array<{ date: string; pageViews: number; events: number }>;
}

export interface SmartInsight {
  id: string;
  severity: "warning" | "info" | "success";
  title: string;
  description: string;
  metricKey: string;
  currentValue: number | null;
  comparisonValue: number | null;
  changePct: number | null;
  period: { from: string; to: string };
  evidenceCount: number;
  coverage: number | null;
  targetTab: "schedule" | "matrix" | "finance" | "collection" | "sponsors" | "posts";
  actionLabel: string;
  generatedAt: string;
}

export interface OverviewAnalyticsData {
  clubHealth: ClubHealthMetrics;
  matchPerformance: Pick<
    MatchPerformanceMetrics,
    "completedMatches" | "scoredMatches" | "wins" | "draws" | "losses" | "winRate" | "recentForm"
  >;
  finance: Pick<
    FinanceAnalyticsMetrics,
    "operatingBalance" | "cumulativeBalance" | "collectionRate" | "outstandingDebt" | "totalIncome" | "operatingExpense"
  >;
  comparisonSummary?: {
    attendanceRateDeltaPp: number | null;
    rsvpResponseDeltaPp: number | null;
    collectionRateDeltaPp: number | null;
    outstandingDebtDeltaPct: number | null;
  };
  trends: {
    attendanceByMonth: EngagementMetrics["activityTrend"];
    cashflowByMonth: FinanceAnalyticsMetrics["cashflowTrend"];
    lifecycleByMonth: EngagementMetrics["lifecycleTrend"];
  };
  insights: SmartInsight[];
}

export interface MyInsightsData {
  playerId: number;
  fullName: string;
  shortName: string;
  jerseyNumber: number | null;
  eligibleCompletedMatches: number;
  attendedMatches: number;
  missingAttendanceRecords: number;
  attendanceRate: number | null;
  rsvpRespondedCount: number;
  rsvpPositiveCount: number;
  rsvpResponseRate: number | null;
  monthlyTrend: Array<{
    month: string;
    label: string;
    eligible: number;
    attended: number;
    rsvpPositive: number;
  }>;
}

export interface ProductEventInput {
  eventUuid: string;
  eventName: ProductEventName;
  routeKey?: string | null;
  contentType?: string | null;
  contentId?: number | null;
  sponsorId?: number | null;
  metadata?: Record<string, string | number | boolean> | null;
}
