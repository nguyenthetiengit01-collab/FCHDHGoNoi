import type { AsyncDb } from "@/lib/db";
import { classifyPlayerStatus, classifyMatchStatus } from "@/lib/teamStatistics";
import { formatMonthLabelVN } from "@/lib/dashboardIntelligence";
import type {
  ExpenseRecord,
  MatchAttendance,
  MatchRecord,
  Sponsor,
} from "@/types/app";
import { ANALYTICS_TIMEZONE } from "./config";
import {
  computeClubHealthMetrics,
  computeCoverage,
  computeFinanceAnalytics,
  computeMatchPerformance,
  computePlayerPersonalInsights,
  computeRetentionCohort,
  generateSmartInsights,
  toVNDateKey,
  type LifecycleEventRow,
  type OtherIncomeWithSponsor,
  type PlayerWithJoinedAt,
} from "./metrics";
import type {
  AnalyticsEnvelope,
  AnalyticsPeriod,
  AnalyticsSection,
  EngagementMetrics,
  FinanceAnalyticsMetrics,
  MatchPerformanceMetrics,
  MyInsightsData,
  OverviewAnalyticsData,
  ProductAnalyticsMetrics,
  SponsorCommunityMetrics,
} from "./types";
import { computePreviousPeriod } from "./validation";

async function tableExists(db: AsyncDb, tableName: string): Promise<boolean> {
  const row = await db.queryOne<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
    [tableName]
  );
  return Boolean(row?.name);
}

async function columnExists(
  db: AsyncDb,
  tableName: string,
  colName: string
): Promise<boolean> {
  const cols = await db.query<{ name: string }>(`PRAGMA table_info("${tableName}")`);
  return cols.some((c) => c.name === colName);
}

async function loadCoreAnalyticsSource(
  db: AsyncDb,
  attMinDate?: string,
  attMaxDate?: string
) {
  const [hasJoinedAt, hasSponsorId, hasLifecycle, hasRollupDaily, hasMonthlyActors] =
    await Promise.all([
      columnExists(db, "players", "joined_at"),
      columnExists(db, "other_incomes", "sponsor_id"),
      tableExists(db, "player_lifecycle_events"),
      tableExists(db, "product_analytics_daily"),
      tableExists(db, "product_analytics_monthly_actors"),
    ]);

  const playerSelect = hasJoinedAt
    ? "SELECT id, code_order, full_name, short_name, jersey_number, position, birth_year, role, status, joined_at FROM players ORDER BY code_order ASC, id ASC"
    : "SELECT id, code_order, full_name, short_name, jersey_number, position, birth_year, role, status, NULL AS joined_at FROM players ORDER BY code_order ASC, id ASC";

  const incomeSelect = hasSponsorId
    ? "SELECT id, income_date, contributor, amount, fund_type, note, sponsor_id FROM other_incomes ORDER BY income_date DESC, id DESC"
    : "SELECT id, income_date, contributor, amount, fund_type, note, NULL AS sponsor_id FROM other_incomes ORDER BY income_date DESC, id DESC";

  const attendanceQuery =
    attMinDate && attMaxDate
      ? db.query<MatchAttendance>(
          `SELECT ma.* FROM match_attendances ma
           JOIN matches m ON m.id = ma.match_id
           WHERE m.match_date >= ? AND m.match_date <= ?`,
          [attMinDate, attMaxDate]
        )
      : db.query<MatchAttendance>("SELECT * FROM match_attendances");

  const cumulativeMatchIncomeQuery = attMaxDate
    ? db
        .queryOne<{ total: number }>(
          `SELECT COALESCE(SUM(ma.amount), 0) AS total
           FROM match_attendances ma
           JOIN matches m ON m.id = ma.match_id
           WHERE ma.paid = 1 AND m.match_date <= ?`,
          [attMaxDate]
        )
        .then((r) => Number(r?.total || 0))
    : Promise.resolve<number | null>(null);

  const [
    players,
    matches,
    attendances,
    cumulativeMatchIncomeUpTo,
    otherIncomes,
    expenses,
    lifecycleEvents,
    sponsors,
    posts,
  ] = await Promise.all([
    db.query<PlayerWithJoinedAt>(playerSelect),
    db.query<MatchRecord>("SELECT * FROM matches ORDER BY match_date ASC, id ASC"),
    attendanceQuery,
    cumulativeMatchIncomeQuery,
    db.query<OtherIncomeWithSponsor>(incomeSelect),
    db.query<ExpenseRecord>("SELECT * FROM expenses ORDER BY expense_date ASC, id ASC"),
    hasLifecycle
      ? db.query<LifecycleEventRow>(
          "SELECT id, player_id, event_type, from_status, to_status, effective_at, source FROM player_lifecycle_events ORDER BY effective_at ASC, id ASC"
        )
      : Promise.resolve([] as LifecycleEventRow[]),
    (await tableExists(db, "sponsors"))
      ? db.query<Sponsor>("SELECT id, name, tier, is_active FROM sponsors ORDER BY sort_order ASC, id ASC")
      : Promise.resolve([] as Sponsor[]),
    (await tableExists(db, "club_posts"))
      ? db.query<{ id: number; slug: string; title: string; category: string }>(
          "SELECT rowid AS id, slug, title, category FROM club_posts ORDER BY published_date DESC"
        )
      : Promise.resolve([] as Array<{ id: number; slug: string; title: string; category: string }>),
  ]);

  const baselineRow = lifecycleEvents.find((e) => e.event_type === "baseline");
  const baselineAt = baselineRow ? baselineRow.effective_at : null;

  return {
    players,
    matches,
    attendances,
    cumulativeMatchIncomeUpTo,
    otherIncomes,
    expenses,
    lifecycleEvents,
    sponsors,
    posts,
    baselineAt,
    hasRollupDaily,
    hasMonthlyActors,
  };
}

interface DailyRollupRow {
  event_date: string;
  event_name: string;
  actor_role: string;
  route_key: string;
  content_type: string;
  content_id: number;
  sponsor_id: number;
  event_count: number;
}

async function loadRollupDaily(
  db: AsyncDb,
  hasRollupDaily: boolean,
  from: string,
  to: string
): Promise<DailyRollupRow[]> {
  if (!hasRollupDaily) return [];
  return db.query<DailyRollupRow>(
    `SELECT event_date, event_name, actor_role, route_key, content_type, content_id, sponsor_id, event_count
     FROM product_analytics_daily
     WHERE event_date >= ? AND event_date <= ?`,
    [from, to]
  );
}

async function loadMonthlyActors(
  db: AsyncDb,
  hasMonthlyActors: boolean,
  monthKey: string
): Promise<{ players: number; managers: number }> {
  if (!hasMonthlyActors) return { players: 0, managers: 0 };
  const rows = await db.query<{ actor_role: string; cnt: number }>(
    `SELECT actor_role, COUNT(*) AS cnt
     FROM product_analytics_monthly_actors
     WHERE month_key = ?
     GROUP BY actor_role`,
    [monthKey]
  );
  let players = 0;
  let managers = 0;
  for (const r of rows) {
    if (r.actor_role === "player") players = Number(r.cnt || 0);
    else if (r.actor_role === "manager") managers = Number(r.cnt || 0);
  }
  return { players, managers };
}

function buildEngagementTrends(params: {
  players: PlayerWithJoinedAt[];
  matches: MatchRecord[];
  attendances: MatchAttendance[];
  lifecycleEvents: LifecycleEventRow[];
  periodFrom: string;
  periodTo: string;
}): Pick<EngagementMetrics, "lifecycleTrend" | "activityTrend"> {
  const { players, matches, attendances, lifecycleEvents, periodFrom, periodTo } = params;

  const lifecycleMap = new Map<
    string,
    { joined: number; paused: number; stopped: number }
  >();
  for (const ev of lifecycleEvents) {
    const d = toVNDateKey(ev.effective_at);
    if (d < periodFrom || d > periodTo) continue;
    const mk = d.slice(0, 7);
    if (!lifecycleMap.has(mk)) {
      lifecycleMap.set(mk, { joined: 0, paused: 0, stopped: 0 });
    }
    const bucket = lifecycleMap.get(mk)!;
    if (ev.event_type === "joined") bucket.joined += 1;
    else if (ev.event_type === "status_changed") {
      const cat = classifyPlayerStatus(ev.to_status);
      if (cat === "paused") bucket.paused += 1;
      else if (cat === "stopped") bucket.stopped += 1;
    }
  }

  const lifecycleTrend = Array.from(lifecycleMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, val]) => ({ month, ...val }));

  const activeCount = Math.max(
    1,
    players.filter((p) => classifyPlayerStatus(p.status) === "active").length
  );
  const actMap = new Map<
    string,
    { rsvpPositive: number; attended: number; eligibleSlots: number; knownSlots: number }
  >();

  const attByMatchId = new Map<number, MatchAttendance[]>();
  for (const a of attendances) {
    let list = attByMatchId.get(a.match_id);
    if (!list) {
      list = [];
      attByMatchId.set(a.match_id, list);
    }
    list.push(a);
  }

  for (const m of matches) {
    const md = toVNDateKey(m.match_date);
    if (md < periodFrom || md > periodTo) continue;
    if (classifyMatchStatus(m.status) !== "completed") continue;
    const mk = md.slice(0, 7);
    if (!actMap.has(mk)) {
      actMap.set(mk, {
        rsvpPositive: 0,
        attended: 0,
        eligibleSlots: 0,
        knownSlots: 0,
      });
    }
    const b = actMap.get(mk)!;
    const matchAtts = attByMatchId.get(m.id) || [];
    b.eligibleSlots += Math.max(activeCount, matchAtts.length);
    b.knownSlots += matchAtts.length;
    b.attended += matchAtts.filter((a) => a.attended === 1).length;
    b.rsvpPositive += matchAtts.filter((a) =>
      ["registered", "attending"].includes((a.rsvp_status || "").toLowerCase())
    ).length;
  }

  const activityTrend = Array.from(actMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, val]) => ({
      periodKey,
      label: formatMonthLabelVN(periodKey),
      rsvpPositive: val.rsvpPositive,
      attended: val.attended,
      eligibleSlots: val.eligibleSlots,
      attendanceRate:
        val.knownSlots > 0
          ? Math.round((val.attended / val.knownSlots) * 10000) / 10000
          : null,
    }));

  return { lifecycleTrend, activityTrend };
}

export async function queryAnalyticsSection(params: {
  db: AsyncDb;
  section: AnalyticsSection;
  period: AnalyticsPeriod;
  comparePrevious: boolean;
  playerId?: number | null;
  now?: Date;
}): Promise<AnalyticsEnvelope<unknown>> {
  const {
    db,
    section,
    period,
    comparePrevious,
    playerId,
    now = new Date(),
  } = params;

  const generatedAt = now.toISOString();
  const comparison = comparePrevious
    ? computePreviousPeriod(period.from, period.to)
    : undefined;

  const attMinDate = comparison ? comparison.from : period.from;
  const src = await loadCoreAnalyticsSource(db, attMinDate, period.to);

  if (section === "my-insights") {
    const player = src.players.find((p) => Number(p.id) === Number(playerId));
    if (!player) {
      return {
        enabled: true,
        section,
        generatedAt,
        timezone: ANALYTICS_TIMEZONE,
        period,
        comparison,
        coverage: computeCoverage(0, 0, src.baselineAt, ["Không tìm thấy hồ sơ cầu thủ."]),
        data: null,
      };
    }

    const myData: MyInsightsData = computePlayerPersonalInsights({
      player,
      matches: src.matches,
      attendances: src.attendances,
      lifecycleEvents: src.lifecycleEvents,
      periodFrom: period.from,
      periodTo: period.to,
    });

    const known = Math.max(
      0,
      myData.eligibleCompletedMatches - myData.missingAttendanceRecords
    );
    const coverage = computeCoverage(
      myData.eligibleCompletedMatches,
      known,
      src.baselineAt,
      myData.eligibleCompletedMatches === 0
        ? ["Chưa có trận đấu hoàn thành đủ điều kiện trong kỳ đã chọn."]
        : []
    );

    return {
      enabled: true,
      section,
      generatedAt,
      timezone: ANALYTICS_TIMEZONE,
      period,
      comparison,
      coverage,
      data: myData,
    };
  }

  const currentHealth = computeClubHealthMetrics({
    players: src.players,
    matches: src.matches,
    attendances: src.attendances,
    lifecycleEvents: src.lifecycleEvents,
    periodFrom: period.from,
    periodTo: period.to,
  });

  const currentMatches = computeMatchPerformance({
    matches: src.matches,
    attendances: src.attendances,
    expenses: src.expenses,
    periodFrom: period.from,
    periodTo: period.to,
  });

  const currentFinance = computeFinanceAnalytics({
    matches: src.matches,
    attendances: src.attendances,
    otherIncomes: src.otherIncomes,
    expenses: src.expenses,
    periodFrom: period.from,
    periodTo: period.to,
    cumulativeMatchIncomeUpToOverride: src.cumulativeMatchIncomeUpTo,
  });

  const rollupRows = await loadRollupDaily(
    db,
    src.hasRollupDaily,
    period.from,
    period.to
  );

  const monthKey = period.to.slice(0, 7);
  const mau = await loadMonthlyActors(db, src.hasMonthlyActors, monthKey);

  if (section === "matches") {
    const coverage = computeCoverage(
      currentMatches.completedMatches,
      currentMatches.scoredMatches,
      src.baselineAt,
      currentMatches.missingScoreMatches > 0
        ? [`Còn ${currentMatches.missingScoreMatches} trận hoàn thành chưa cập nhật tỷ số.`]
        : []
    );
    return {
      enabled: true,
      section,
      generatedAt,
      timezone: ANALYTICS_TIMEZONE,
      period,
      comparison,
      coverage,
      data: currentMatches satisfies MatchPerformanceMetrics,
    };
  }

  if (section === "engagement") {
    const { lifecycleTrend, activityTrend } = buildEngagementTrends({
      players: src.players,
      matches: src.matches,
      attendances: src.attendances,
      lifecycleEvents: src.lifecycleEvents,
      periodFrom: period.from,
      periodTo: period.to,
    });
    const retention30d = computeRetentionCohort({
      players: src.players,
      lifecycleEvents: src.lifecycleEvents,
      windowDays: 30,
      asOfDate: period.to,
    });
    const retention90d = computeRetentionCohort({
      players: src.players,
      lifecycleEvents: src.lifecycleEvents,
      windowDays: 90,
      asOfDate: period.to,
    });

    const limitations: string[] = [];
    if (!retention30d.available) {
      limitations.push("Chưa đủ dữ liệu ngày gia nhập (joined_at) xác thực để tính Retention 30/90 ngày.");
    }
    if (src.lifecycleEvents.length === 0) {
      limitations.push("Chưa chạy migration tạo player_lifecycle_events; số liệu trạng thái dựa trên snapshot hiện tại.");
    }

    const coverage = computeCoverage(
      currentHealth.eligibleSlots,
      currentHealth.knownAttendanceSlots,
      src.baselineAt,
      limitations
    );

    return {
      enabled: true,
      section,
      generatedAt,
      timezone: ANALYTICS_TIMEZONE,
      period,
      comparison,
      coverage,
      data: {
        clubHealth: currentHealth,
        retention30d,
        retention90d,
        monthlyActivePlayers: mau.players,
        monthlyActiveManagers: mau.managers,
        lifecycleTrend,
        activityTrend,
      } satisfies EngagementMetrics,
    };
  }

  if (section === "finance") {
    const coverage = computeCoverage(
      currentHealth.eligibleSlots,
      currentHealth.knownAttendanceSlots,
      src.baselineAt,
      currentFinance.unattributedOtherIncome > 0
        ? ["Một số khoản thu khác lịch sử chưa gắn sponsor_id (hiển thị Chưa phân bổ)."]
        : []
    );
    return {
      enabled: true,
      section,
      generatedAt,
      timezone: ANALYTICS_TIMEZONE,
      period,
      comparison,
      coverage,
      data: currentFinance satisfies FinanceAnalyticsMetrics,
    };
  }

  if (section === "sponsors" || section === "community") {
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalPostViews = 0;
    const sponsorImpMap = new Map<number, number>();
    const sponsorClickMap = new Map<number, number>();
    const postViewMap = new Map<number, number>();

    for (const r of rollupRows) {
      if (r.event_name === "sponsor_impression") {
        totalImpressions += r.event_count;
        if (r.sponsor_id > 0) {
          sponsorImpMap.set(
            r.sponsor_id,
            (sponsorImpMap.get(r.sponsor_id) || 0) + r.event_count
          );
        }
      } else if (r.event_name === "sponsor_click") {
        totalClicks += r.event_count;
        if (r.sponsor_id > 0) {
          sponsorClickMap.set(
            r.sponsor_id,
            (sponsorClickMap.get(r.sponsor_id) || 0) + r.event_count
          );
        }
      } else if (r.event_name === "club_post_view") {
        totalPostViews += r.event_count;
        if (r.content_id > 0) {
          postViewMap.set(
            r.content_id,
            (postViewMap.get(r.content_id) || 0) + r.event_count
          );
        }
      }
    }

    const incomeBySponsor = new Map<number, number>();
    for (const inc of src.otherIncomes) {
      const d = toVNDateKey(inc.income_date);
      if (d < period.from || d > period.to) continue;
      if (inc.sponsor_id && inc.sponsor_id > 0) {
        incomeBySponsor.set(
          inc.sponsor_id,
          (incomeBySponsor.get(inc.sponsor_id) || 0) + (Number(inc.amount) || 0)
        );
      }
    }

    const sponsorRows = src.sponsors.map((s) => {
      const imp = sponsorImpMap.get(Number(s.id)) || 0;
      const clk = sponsorClickMap.get(Number(s.id)) || 0;
      return {
        sponsorId: Number(s.id),
        name: s.name,
        tier: s.tier,
        isActive: Boolean(s.is_active),
        impressions: imp,
        clicks: clk,
        ctr: imp > 0 ? Math.round((clk / imp) * 10000) / 10000 : null,
        attributedIncome: incomeBySponsor.get(Number(s.id)) || 0,
      };
    });

    const postRows = src.posts.map((p) => ({
      postId: p.id,
      slug: p.slug,
      title: p.title,
      category: p.category,
      views: postViewMap.get(p.id) || 0,
    }));

    const limitations: string[] = [];
    if (!src.hasRollupDaily || rollupRows.length === 0) {
      limitations.push("Chưa có dữ liệu product analytics events trong kỳ đã chọn.");
    }

    const coverage = computeCoverage(
      src.sponsors.length + src.posts.length,
      rollupRows.length > 0 ? src.sponsors.length + src.posts.length : 0,
      src.baselineAt,
      limitations
    );

    return {
      enabled: true,
      section,
      generatedAt,
      timezone: ANALYTICS_TIMEZONE,
      period,
      comparison,
      coverage,
      data: {
        totalImpressions,
        totalClicks,
        overallCtr:
          totalImpressions > 0
            ? Math.round((totalClicks / totalImpressions) * 10000) / 10000
            : null,
        sponsorAttributedIncome: currentFinance.sponsorAttributedIncome,
        unattributedOtherIncome: currentFinance.unattributedOtherIncome,
        sponsors: sponsorRows,
        totalPostViews,
        posts: postRows,
      } satisfies SponsorCommunityMetrics,
    };
  }

  if (section === "product") {
    let totalEvents = 0;
    let totalPageViews = 0;
    let totalPostViews = 0;
    let totalProfileViews = 0;
    let totalSponsorImpressions = 0;
    let totalSponsorClicks = 0;
    let flowOpens = 0;
    let submitSuccesses = 0;

    const routeMap = new Map<string, number>();
    const dailyMap = new Map<string, { pageViews: number; events: number }>();

    for (const r of rollupRows) {
      totalEvents += r.event_count;
      if (!dailyMap.has(r.event_date)) {
        dailyMap.set(r.event_date, { pageViews: 0, events: 0 });
      }
      const dBucket = dailyMap.get(r.event_date)!;
      dBucket.events += r.event_count;

      if (r.event_name === "page_view") {
        totalPageViews += r.event_count;
        dBucket.pageViews += r.event_count;
        if (r.route_key) {
          routeMap.set(r.route_key, (routeMap.get(r.route_key) || 0) + r.event_count);
        }
      } else if (r.event_name === "club_post_view") totalPostViews += r.event_count;
      else if (r.event_name === "player_profile_view") totalProfileViews += r.event_count;
      else if (r.event_name === "sponsor_impression") totalSponsorImpressions += r.event_count;
      else if (r.event_name === "sponsor_click") totalSponsorClicks += r.event_count;
      else if (r.event_name === "rsvp_flow_open") flowOpens += r.event_count;
      else if (r.event_name === "rsvp_submit_success") submitSuccesses += r.event_count;
    }

    const coverage = computeCoverage(
      rollupRows.length > 0 ? 1 : 0,
      rollupRows.length > 0 ? 1 : 0,
      src.baselineAt,
      rollupRows.length === 0 ? ["Chưa ghi nhận product analytics event nào trong kỳ."] : []
    );

    return {
      enabled: true,
      section,
      generatedAt,
      timezone: ANALYTICS_TIMEZONE,
      period,
      comparison,
      coverage,
      data: {
        totalEvents,
        totalPageViews,
        totalPostViews,
        totalProfileViews,
        totalSponsorImpressions,
        totalSponsorClicks,
        rsvpFunnel: {
          flowOpens,
          submitSuccesses,
          conversionRate:
            flowOpens > 0
              ? Math.round((submitSuccesses / flowOpens) * 10000) / 10000
              : null,
        },
        monthlyActivePlayers: mau.players,
        monthlyActiveManagers: mau.managers,
        routeViews: Array.from(routeMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([routeKey, views]) => ({ routeKey, views })),
        featureUsage: [],
        dailyTrend: Array.from(dailyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, val]) => ({ date, ...val })),
      } satisfies ProductAnalyticsMetrics,
    };
  }

  // Overview section
  const prevHealth = comparison
    ? computeClubHealthMetrics({
        players: src.players,
        matches: src.matches,
        attendances: src.attendances,
        lifecycleEvents: src.lifecycleEvents,
        periodFrom: comparison.from,
        periodTo: comparison.to,
      })
    : null;

  const prevFinance = comparison
    ? computeFinanceAnalytics({
        matches: src.matches,
        attendances: src.attendances,
        otherIncomes: src.otherIncomes,
        expenses: src.expenses,
        periodFrom: comparison.from,
        periodTo: comparison.to,
      })
    : null;

  const totalImpressions = rollupRows
    .filter((r) => r.event_name === "sponsor_impression")
    .reduce((s, r) => s + r.event_count, 0);
  const totalClicks = rollupRows
    .filter((r) => r.event_name === "sponsor_click")
    .reduce((s, r) => s + r.event_count, 0);

  const insights = generateSmartInsights({
    period: { from: period.from, to: period.to },
    currentHealth,
    previousHealth: prevHealth,
    currentMatches,
    currentFinance,
    previousFinance: prevFinance,
    sponsorSummary: { totalImpressions, totalClicks },
    generatedAt,
  });

  const { lifecycleTrend, activityTrend } = buildEngagementTrends({
    players: src.players,
    matches: src.matches,
    attendances: src.attendances,
    lifecycleEvents: src.lifecycleEvents,
    periodFrom: period.from,
    periodTo: period.to,
  });

  const comparisonSummary =
    prevHealth && prevFinance
      ? {
          attendanceRateDeltaPp:
            currentHealth.teamAttendanceRate !== null &&
            prevHealth.teamAttendanceRate !== null
              ? Math.round(
                  (currentHealth.teamAttendanceRate - prevHealth.teamAttendanceRate) * 1000
                ) / 10
              : null,
          rsvpResponseDeltaPp:
            currentHealth.rsvpResponseRate !== null &&
            prevHealth.rsvpResponseRate !== null
              ? Math.round(
                  (currentHealth.rsvpResponseRate - prevHealth.rsvpResponseRate) * 1000
                ) / 10
              : null,
          collectionRateDeltaPp:
            currentFinance.collectionRate !== null &&
            prevFinance.collectionRate !== null
              ? Math.round(
                  (currentFinance.collectionRate - prevFinance.collectionRate) * 1000
                ) / 10
              : null,
          outstandingDebtDeltaPct:
            prevFinance.outstandingDebt > 0
              ? Math.round(
                  ((currentFinance.outstandingDebt - prevFinance.outstandingDebt) /
                    prevFinance.outstandingDebt) *
                    1000
                ) / 10
              : null,
        }
      : undefined;

  const coverage = computeCoverage(
    currentHealth.eligibleSlots,
    currentHealth.knownAttendanceSlots,
    src.baselineAt,
    currentMatches.missingScoreMatches > 0
      ? [`${currentMatches.missingScoreMatches} trận đã kết thúc chưa có tỷ số.`]
      : []
  );

  return {
    enabled: true,
    section: "overview",
    generatedAt,
    timezone: ANALYTICS_TIMEZONE,
    period,
    comparison,
    coverage,
    data: {
      clubHealth: currentHealth,
      matchPerformance: {
        completedMatches: currentMatches.completedMatches,
        scoredMatches: currentMatches.scoredMatches,
        wins: currentMatches.wins,
        draws: currentMatches.draws,
        losses: currentMatches.losses,
        winRate: currentMatches.winRate,
        recentForm: currentMatches.recentForm,
      },
      finance: {
        operatingBalance: currentFinance.operatingBalance,
        cumulativeBalance: currentFinance.cumulativeBalance,
        collectionRate: currentFinance.collectionRate,
        outstandingDebt: currentFinance.outstandingDebt,
        totalIncome: currentFinance.totalIncome,
        operatingExpense: currentFinance.operatingExpense,
      },
      comparisonSummary,
      trends: {
        attendanceByMonth: activityTrend,
        cashflowByMonth: currentFinance.cashflowTrend,
        lifecycleByMonth: lifecycleTrend,
      },
      insights,
    } satisfies OverviewAnalyticsData,
  };
}
