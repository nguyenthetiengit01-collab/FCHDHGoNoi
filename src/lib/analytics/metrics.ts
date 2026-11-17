import { classifyMatchStatus, classifyPlayerStatus } from "@/lib/teamStatistics";
import {
  isCountableExpense,
  isCountableOtherIncome,
  formatMonthLabelVN,
} from "@/lib/dashboardIntelligence";
import { EXPENSE_CATEGORIES, type ExpenseRecord, type MatchAttendance, type MatchRecord, type OtherIncome, type Player } from "@/types/app";
import type {
  AnalyticsCoverage,
  ClubHealthMetrics,
  FinanceAnalyticsMetrics,
  MatchPerformanceMetrics,
  MyInsightsData,
  SmartInsight,
} from "./types";
import { ANALYTICS_COVERAGE_THRESHOLD } from "./config";
import { addDaysIsoDate, diffDaysInclusive } from "./validation";

export interface LifecycleEventRow {
  id: number;
  player_id: number;
  event_type: "baseline" | "joined" | "status_changed" | string;
  from_status: string | null;
  to_status: string;
  effective_at: string;
  source: string;
}

export interface PlayerWithJoinedAt extends Player {
  joined_at?: string | null;
}

export interface OtherIncomeWithSponsor extends OtherIncome {
  sponsor_id?: number | null;
}

const RESPONDED_RSVP_SET = new Set([
  "registered",
  "attending",
  "absent_notice",
  "declined",
  "tentative",
]);

const POSITIVE_RSVP_SET = new Set(["registered", "attending"]);

export function toVNDateKey(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return "";
  const trimmed = String(isoOrDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export function resolvePlayerStatusAtDate(
  player: Pick<PlayerWithJoinedAt, "id" | "status" | "joined_at">,
  events: LifecycleEventRow[],
  targetDate: string
): "active" | "paused" | "stopped" | "unknown" {
  const playerEvents = events
    .filter((e) => e.player_id === player.id)
    .sort((a, b) => {
      const da = toVNDateKey(a.effective_at);
      const db = toVNDateKey(b.effective_at);
      if (da !== db) return da.localeCompare(db);
      if (a.effective_at !== b.effective_at) {
        return a.effective_at.localeCompare(b.effective_at);
      }
      return a.id - b.id;
    });

  return resolveFromSortedPlayerEvents(playerEvents, targetDate);
}

function resolveFromSortedPlayerEvents(
  sortedPlayerEvents: LifecycleEventRow[],
  targetDate: string
): "active" | "paused" | "stopped" | "unknown" {
  if (sortedPlayerEvents.length === 0) {
    return "unknown";
  }

  const firstEventDate = toVNDateKey(sortedPlayerEvents[0].effective_at);
  if (targetDate < firstEventDate) {
    return "unknown";
  }

  let latest: LifecycleEventRow | null = null;
  for (const ev of sortedPlayerEvents) {
    const evDate = toVNDateKey(ev.effective_at);
    if (evDate <= targetDate) {
      latest = ev;
    }
  }

  if (!latest) return "unknown";
  return classifyPlayerStatus(latest.to_status);
}

function groupSortedEventsByPlayer(
  events: LifecycleEventRow[]
): Map<number, LifecycleEventRow[]> {
  const map = new Map<number, LifecycleEventRow[]>();
  for (const ev of events) {
    let list = map.get(ev.player_id);
    if (!list) {
      list = [];
      map.set(ev.player_id, list);
    }
    list.push(ev);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const da = toVNDateKey(a.effective_at);
      const db = toVNDateKey(b.effective_at);
      if (da !== db) return da.localeCompare(db);
      if (a.effective_at !== b.effective_at) {
        return a.effective_at.localeCompare(b.effective_at);
      }
      return a.id - b.id;
    });
  }
  return map;
}

export function isValidMatchScore(
  teamScore: number | null | undefined,
  opponentScore: number | null | undefined
): boolean {
  return (
    typeof teamScore === "number" &&
    typeof opponentScore === "number" &&
    Number.isInteger(teamScore) &&
    Number.isInteger(opponentScore) &&
    teamScore >= 0 &&
    opponentScore >= 0
  );
}

export function computeCoverage(
  eligibleRecords: number,
  knownRecords: number,
  baselineAt: string | null,
  extraLimitations: string[] = []
): AnalyticsCoverage {
  const missingRecords = Math.max(0, eligibleRecords - knownRecords);
  const rate =
    eligibleRecords > 0
      ? Math.round((knownRecords / eligibleRecords) * 10000) / 10000
      : null;
  const limitations = [...extraLimitations];
  if (rate !== null && rate < ANALYTICS_COVERAGE_THRESHOLD) {
    limitations.push(
      `Dữ liệu chưa đầy đủ (${Math.round(rate * 1000) / 10}% < ${Math.round(
        ANALYTICS_COVERAGE_THRESHOLD * 100
      )}% ngưỡng tin cậy).`
    );
  }
  return {
    baselineAt,
    rate,
    eligibleRecords,
    knownRecords,
    missingRecords,
    isLowCoverage: rate === null || rate < ANALYTICS_COVERAGE_THRESHOLD,
    limitations,
  };
}

export function computeClubHealthMetrics(params: {
  players: PlayerWithJoinedAt[];
  matches: MatchRecord[];
  attendances: MatchAttendance[];
  lifecycleEvents: LifecycleEventRow[];
  periodFrom: string;
  periodTo: string;
}): ClubHealthMetrics {
  const { players, matches, attendances, lifecycleEvents, periodFrom, periodTo } = params;

  const hasLifecycle = lifecycleEvents.length > 0;
  const eventsByPlayer = hasLifecycle
    ? groupSortedEventsByPlayer(lifecycleEvents)
    : new Map<number, LifecycleEventRow[]>();
  let activePlayers = 0;
  let pausedPlayers = 0;
  let stoppedPlayers = 0;
  let unknownPlayers = 0;

  for (const p of players) {
    const cat = hasLifecycle
      ? resolveFromSortedPlayerEvents(eventsByPlayer.get(p.id) || [], periodTo)
      : classifyPlayerStatus(p.status);
    if (cat === "active") activePlayers += 1;
    else if (cat === "paused") pausedPlayers += 1;
    else if (cat === "stopped") stoppedPlayers += 1;
    else unknownPlayers += 1;
  }

  let newMembers: number | null = null;
  let stoppedInPeriod: number | null = null;
  let netMemberGrowth: number | null = null;

  if (hasLifecycle) {
    const joinedEvents = lifecycleEvents.filter((e) => {
      const d = toVNDateKey(e.effective_at);
      return e.event_type === "joined" && d >= periodFrom && d <= periodTo;
    });
    const stoppedEvents = lifecycleEvents.filter((e) => {
      const d = toVNDateKey(e.effective_at);
      return (
        e.event_type === "status_changed" &&
        classifyPlayerStatus(e.to_status) === "stopped" &&
        d >= periodFrom &&
        d <= periodTo
      );
    });
    newMembers = joinedEvents.length;
    stoppedInPeriod = stoppedEvents.length;
    netMemberGrowth = newMembers - stoppedInPeriod;
  }

  const completedMatches = matches.filter((m) => {
    const md = toVNDateKey(m.match_date);
    return (
      classifyMatchStatus(m.status) === "completed" &&
      md >= periodFrom &&
      md <= periodTo
    );
  });

  const attMap = new Map<string, MatchAttendance>();
  for (const a of attendances) {
    attMap.set(`${a.match_id}:${a.player_id}`, a);
  }

  let eligibleSlots = 0;
  let knownAttendanceSlots = 0;
  let attendedYes = 0;
  let rsvpRespondedSlots = 0;
  let rsvpPositiveSlots = 0;
  let positiveWithKnownAttendance = 0;
  let attendedAfterPositiveRsvp = 0;

  for (const m of completedMatches) {
    const md = toVNDateKey(m.match_date);
    for (const p of players) {
      const statusOnMatchDay = hasLifecycle
        ? resolveFromSortedPlayerEvents(eventsByPlayer.get(p.id) || [], md)
        : classifyPlayerStatus(p.status);

      const att = attMap.get(`${m.id}:${p.id}`);
      // If lifecycle unknown at match date (historical match before baseline), include only if attendance row exists
      if (statusOnMatchDay === "unknown" && !att) {
        continue;
      }
      if (statusOnMatchDay === "paused" || statusOnMatchDay === "stopped") {
        if (!att) continue;
      }

      eligibleSlots += 1;
      if (!att) {
        continue; // Missing row is NOT counted as absent
      }

      knownAttendanceSlots += 1;
      if (att.attended === 1) {
        attendedYes += 1;
      }

      const rsvp = (att.rsvp_status || "none").toLowerCase();
      if (RESPONDED_RSVP_SET.has(rsvp)) {
        rsvpRespondedSlots += 1;
      }
      if (POSITIVE_RSVP_SET.has(rsvp)) {
        rsvpPositiveSlots += 1;
        positiveWithKnownAttendance += 1;
        if (att.attended === 1) {
          attendedAfterPositiveRsvp += 1;
        }
      }
    }
  }

  const missingAttendanceSlots = Math.max(0, eligibleSlots - knownAttendanceSlots);

  return {
    activePlayers,
    pausedPlayers,
    stoppedPlayers,
    unknownPlayers,
    newMembers,
    stoppedInPeriod,
    netMemberGrowth,
    eligibleSlots,
    knownAttendanceSlots,
    missingAttendanceSlots,
    attendanceCoverage:
      eligibleSlots > 0 ? Math.round((knownAttendanceSlots / eligibleSlots) * 10000) / 10000 : null,
    teamAttendanceRate:
      knownAttendanceSlots > 0
        ? Math.round((attendedYes / knownAttendanceSlots) * 10000) / 10000
        : null,
    rsvpRespondedSlots,
    rsvpResponseRate:
      eligibleSlots > 0
        ? Math.round((rsvpRespondedSlots / eligibleSlots) * 10000) / 10000
        : null,
    rsvpPositiveSlots,
    rsvpPositiveRate:
      rsvpRespondedSlots > 0
        ? Math.round((rsvpPositiveSlots / rsvpRespondedSlots) * 10000) / 10000
        : null,
    attendanceAfterPositiveRsvp:
      positiveWithKnownAttendance > 0
        ? Math.round((attendedAfterPositiveRsvp / positiveWithKnownAttendance) * 10000) / 10000
        : null,
  };
}

export function computeMatchPerformance(params: {
  matches: MatchRecord[];
  attendances: MatchAttendance[];
  expenses: ExpenseRecord[];
  periodFrom: string;
  periodTo: string;
}): MatchPerformanceMetrics {
  const { matches, attendances, expenses, periodFrom, periodTo } = params;

  const periodMatches = matches
    .filter((m) => {
      const md = toVNDateKey(m.match_date);
      return md >= periodFrom && md <= periodTo;
    })
    .sort((a, b) => a.match_date.localeCompare(b.match_date) || a.id - b.id);

  let completedMatches = 0;
  let scoredMatches = 0;
  let missingScoreMatches = 0;
  let missingCostMatches = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let totalMatchCost = 0;
  let totalAttendees = 0;

  const scoredCompleted: Array<{
    matchId: number;
    matchDate: string;
    opponent: string;
    teamScore: number;
    opponentScore: number;
    result: "W" | "D" | "L";
  }> = [];

  const matchRows: MatchPerformanceMetrics["matches"] = [];

  const attByMatchId = new Map<number, MatchAttendance[]>();
  for (const a of attendances) {
    let list = attByMatchId.get(a.match_id);
    if (!list) {
      list = [];
      attByMatchId.set(a.match_id, list);
    }
    list.push(a);
  }

  const expByMatchId = new Map<number, ExpenseRecord[]>();
  for (const e of expenses) {
    if (e.match_id === null || e.match_id === undefined) continue;
    let list = expByMatchId.get(e.match_id);
    if (!list) {
      list = [];
      expByMatchId.set(e.match_id, list);
    }
    list.push(e);
  }

  for (const m of periodMatches) {
    const lifecycle = classifyMatchStatus(m.status);
    const matchAtts = attByMatchId.get(m.id) || [];
    const rsvpCount = matchAtts.filter((a) =>
      POSITIVE_RSVP_SET.has((a.rsvp_status || "").toLowerCase())
    ).length;
    const attendeesCount = matchAtts.filter((a) => a.attended === 1).length;
    const paidCount = matchAtts.filter((a) => a.paid === 1).length;
    const collected = matchAtts
      .filter((a) => a.paid === 1)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0);

    const countableExps = (expByMatchId.get(m.id) || []).filter(isCountableExpense);
    const pitchExpRecords = countableExps.filter((e) => e.category === "Tiền sân");
    const pitchExpense =
      pitchExpRecords.length > 0
        ? pitchExpRecords.reduce((s, e) => s + (Number(e.amount) || 0), 0)
        : Number(m.pitch_cost) || 0;
    const otherMatchExpense = countableExps
      .filter((e) => e.category !== "Tiền sân")
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expense = pitchExpense + otherMatchExpense;

    const validScore = isValidMatchScore(m.team_score, m.opponent_score);
    let result: "W" | "D" | "L" | null = null;
    const isCompleted = lifecycle === "completed";
    const hasMissingScore = isCompleted && !validScore;
    const hasMissingCost = isCompleted && expense <= 0;

    if (isCompleted) {
      completedMatches += 1;
      if (hasMissingScore) missingScoreMatches += 1;
      if (hasMissingCost) missingCostMatches += 1;
      if (validScore) {
        scoredMatches += 1;
        const ts = m.team_score as number;
        const os = m.opponent_score as number;
        goalsFor += ts;
        goalsAgainst += os;
        if (ts > os) {
          wins += 1;
          result = "W";
        } else if (ts === os) {
          draws += 1;
          result = "D";
        } else {
          losses += 1;
          result = "L";
        }
        scoredCompleted.push({
          matchId: m.id,
          matchDate: m.match_date,
          opponent: m.opponent || "Đối thủ",
          teamScore: ts,
          opponentScore: os,
          result,
        });
      }
      if (attendeesCount > 0) {
        totalMatchCost += expense;
        totalAttendees += attendeesCount;
      }
    }

    matchRows.push({
      id: m.id,
      matchNumber: m.match_number,
      label: m.label,
      matchDate: m.match_date,
      opponent: m.opponent || "Đối thủ",
      venue: m.venue,
      status: m.status,
      teamScore: validScore ? (m.team_score as number) : null,
      opponentScore: validScore ? (m.opponent_score as number) : null,
      result,
      rsvpCount,
      attendeesCount,
      paidCount,
      collected,
      expense,
      net: collected - expense,
      costPerAttendee: attendeesCount > 0 ? Math.round(expense / attendeesCount) : null,
      hasMissingScore,
      hasMissingCost,
    });
  }

  return {
    totalMatchesInPeriod: periodMatches.length,
    completedMatches,
    scoredMatches,
    missingScoreMatches,
    missingCostMatches,
    wins,
    draws,
    losses,
    winRate:
      scoredMatches > 0
        ? Math.round((wins / scoredMatches) * 10000) / 10000
        : null,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    recentForm: scoredCompleted.slice(-5).reverse(),
    totalMatchCost,
    totalAttendees,
    costPerAttendee:
      totalAttendees > 0 ? Math.round(totalMatchCost / totalAttendees) : null,
    matches: matchRows.reverse(),
  };
}

export function computeRetentionCohort(params: {
  players: PlayerWithJoinedAt[];
  lifecycleEvents: LifecycleEventRow[];
  windowDays: 30 | 90;
  asOfDate: string;
}): {
  eligibleCohortSize: number;
  retainedCount: number;
  rate: number | null;
  available: boolean;
} {
  const { players, lifecycleEvents, windowDays, asOfDate } = params;
  let eligibleCohortSize = 0;
  let retainedCount = 0;

  for (const p of players) {
    const joinedDate = p.joined_at ? toVNDateKey(p.joined_at) : "";
    if (!joinedDate) continue;
    const daysSinceJoin = diffDaysInclusive(joinedDate, asOfDate) - 1;
    if (daysSinceJoin < windowDays) continue;

    eligibleCohortSize += 1;
    const checkDate = addDaysIsoDate(joinedDate, windowDays);
    const statusAtCheck =
      lifecycleEvents.length > 0
        ? resolvePlayerStatusAtDate(p, lifecycleEvents, checkDate)
        : classifyPlayerStatus(p.status);
    if (statusAtCheck === "active") {
      retainedCount += 1;
    }
  }

  return {
    eligibleCohortSize,
    retainedCount,
    rate:
      eligibleCohortSize > 0
        ? Math.round((retainedCount / eligibleCohortSize) * 10000) / 10000
        : null,
    available: eligibleCohortSize > 0,
  };
}

export function computeFinanceAnalytics(params: {
  matches: MatchRecord[];
  attendances: MatchAttendance[];
  otherIncomes: OtherIncomeWithSponsor[];
  expenses: ExpenseRecord[];
  periodFrom: string;
  periodTo: string;
  cumulativeMatchIncomeUpToOverride?: number | null;
}): FinanceAnalyticsMetrics {
  const {
    matches,
    attendances,
    otherIncomes,
    expenses,
    periodFrom,
    periodTo,
    cumulativeMatchIncomeUpToOverride,
  } = params;

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const periodMatchIds = new Set(
    matches
      .filter((m) => {
        const md = toVNDateKey(m.match_date);
        return md >= periodFrom && md <= periodTo;
      })
      .map((m) => m.id)
  );

  const periodAtts = attendances.filter((a) => periodMatchIds.has(a.match_id));
  const matchIncome = periodAtts
    .filter((a) => a.paid === 1)
    .reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const mandatoryExpected = periodAtts
    .filter((a) => a.attended === 1)
    .reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const mandatoryCollected = periodAtts
    .filter((a) => a.attended === 1 && a.paid === 1)
    .reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const outstandingDebt = periodAtts
    .filter((a) => a.attended === 1 && a.paid === 0)
    .reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const voluntaryAtts = periodAtts.filter((a) => a.attended === 0 && a.paid === 1);
  const voluntaryContribution = voluntaryAtts.reduce(
    (s, a) => s + (Number(a.amount) || 0),
    0
  );

  const periodOtherIncomes = otherIncomes.filter((o) => {
    const d = toVNDateKey(o.income_date);
    return d >= periodFrom && d <= periodTo && isCountableOtherIncome(o);
  });
  const otherIncome = periodOtherIncomes.reduce(
    (s, o) => s + (Number(o.amount) || 0),
    0
  );
  const sponsorAttributedIncome = periodOtherIncomes
    .filter((o) => o.sponsor_id !== null && o.sponsor_id !== undefined)
    .reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const unattributedOtherIncome = otherIncome - sponsorAttributedIncome;

  const periodExpenses = expenses.filter((e) => {
    const d = toVNDateKey(e.expense_date);
    return d >= periodFrom && d <= periodTo && isCountableExpense(e);
  });
  const operatingExpense = periodExpenses.reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0
  );

  const totalIncome = matchIncome + otherIncome;
  const operatingBalance = totalIncome - operatingExpense;

  // Cumulative balance across all time up to periodTo
  const allMatchIncomeUpTo =
    cumulativeMatchIncomeUpToOverride !== undefined &&
    cumulativeMatchIncomeUpToOverride !== null
      ? cumulativeMatchIncomeUpToOverride
      : attendances
          .filter((a) => {
            const m = matchById.get(a.match_id);
            return m && toVNDateKey(m.match_date) <= periodTo && a.paid === 1;
          })
          .reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const allOtherIncomeUpTo = otherIncomes
    .filter((o) => toVNDateKey(o.income_date) <= periodTo && isCountableOtherIncome(o))
    .reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const allExpensesUpTo = expenses
    .filter((e) => toVNDateKey(e.expense_date) <= periodTo && isCountableExpense(e))
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const cumulativeBalance = allMatchIncomeUpTo + allOtherIncomeUpTo - allExpensesUpTo;

  // Match-linked average cost & cost per attendance
  const completedPeriodMatches = matches.filter(
    (m) => periodMatchIds.has(m.id) && classifyMatchStatus(m.status) === "completed"
  );
  let totalLinkedMatchCost = 0;
  let matchesWithCost = 0;
  let totalMatchAttendees = 0;
  for (const m of completedPeriodMatches) {
    const exps = periodExpenses.filter((e) => e.match_id === m.id);
    const pitchExps = exps.filter((e) => e.category === "Tiền sân");
    const pitchCost =
      pitchExps.length > 0
        ? pitchExps.reduce((s, e) => s + (Number(e.amount) || 0), 0)
        : Number(m.pitch_cost) || 0;
    const otherCost = exps
      .filter((e) => e.category !== "Tiền sân")
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const cost = pitchCost + otherCost;
    if (cost > 0) {
      totalLinkedMatchCost += cost;
      matchesWithCost += 1;
    }
    totalMatchAttendees += periodAtts.filter(
      (a) => a.match_id === m.id && a.attended === 1
    ).length;
  }

  const expenseBreakdown = EXPENSE_CATEGORIES.map((category) => {
    const amount = periodExpenses
      .filter((e) => e.category === category)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return {
      category,
      amount,
      percentage:
        operatingExpense > 0
          ? Math.round((amount / operatingExpense) * 1000) / 10
          : 0,
    };
  }).filter((item) => item.amount > 0);

  // Cashflow trend by month
  const monthMap = new Map<string, { income: number; expense: number }>();
  const ensureMonth = (mk: string) => {
    if (!monthMap.has(mk)) monthMap.set(mk, { income: 0, expense: 0 });
    return monthMap.get(mk)!;
  };
  for (const a of periodAtts) {
    if (a.paid !== 1) continue;
    const m = matchById.get(a.match_id);
    if (!m) continue;
    const mk = toVNDateKey(m.match_date).slice(0, 7);
    if (mk) ensureMonth(mk).income += Number(a.amount) || 0;
  }
  for (const o of periodOtherIncomes) {
    const mk = toVNDateKey(o.income_date).slice(0, 7);
    if (mk) ensureMonth(mk).income += Number(o.amount) || 0;
  }
  for (const e of periodExpenses) {
    const mk = toVNDateKey(e.expense_date).slice(0, 7);
    if (mk) ensureMonth(mk).expense += Number(e.amount) || 0;
  }

  const cashflowTrend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, val]) => ({
      periodKey,
      label: formatMonthLabelVN(periodKey),
      income: val.income,
      expense: val.expense,
      net: val.income - val.expense,
    }));

  return {
    matchIncome,
    mandatoryExpected,
    mandatoryCollected,
    collectionRate:
      mandatoryExpected > 0
        ? Math.round((mandatoryCollected / mandatoryExpected) * 10000) / 10000
        : null,
    outstandingDebt,
    voluntaryContribution,
    voluntaryCount: voluntaryAtts.length,
    otherIncome,
    totalIncome,
    operatingExpense,
    operatingBalance,
    cumulativeBalance,
    averageMatchCost:
      matchesWithCost > 0 ? Math.round(totalLinkedMatchCost / matchesWithCost) : null,
    costPerAttendance:
      totalMatchAttendees > 0
        ? Math.round(totalLinkedMatchCost / totalMatchAttendees)
        : null,
    sponsorAttributedIncome,
    unattributedOtherIncome,
    expenseBreakdown,
    cashflowTrend,
  };
}

export function computePlayerPersonalInsights(params: {
  player: PlayerWithJoinedAt;
  matches: MatchRecord[];
  attendances: MatchAttendance[];
  lifecycleEvents: LifecycleEventRow[];
  periodFrom: string;
  periodTo: string;
}): MyInsightsData {
  const { player, matches, attendances, lifecycleEvents, periodFrom, periodTo } = params;
  const hasLifecycle = lifecycleEvents.length > 0;

  const completedPeriodMatches = matches
    .filter((m) => {
      const md = toVNDateKey(m.match_date);
      return (
        classifyMatchStatus(m.status) === "completed" &&
        md >= periodFrom &&
        md <= periodTo
      );
    })
    .sort((a, b) => a.match_date.localeCompare(b.match_date));

  const attByMatch = new Map<number, MatchAttendance>();
  for (const a of attendances) {
    if (a.player_id === player.id) {
      attByMatch.set(a.match_id, a);
    }
  }

  let eligibleCompletedMatches = 0;
  let attendedMatches = 0;
  let missingAttendanceRecords = 0;
  let rsvpRespondedCount = 0;
  let rsvpPositiveCount = 0;

  const monthMap = new Map<
    string,
    { eligible: number; attended: number; rsvpPositive: number }
  >();

  for (const m of completedPeriodMatches) {
    const md = toVNDateKey(m.match_date);
    const statusOnDay = hasLifecycle
      ? resolvePlayerStatusAtDate(player, lifecycleEvents, md)
      : classifyPlayerStatus(player.status);
    const att = attByMatch.get(m.id);

    if ((statusOnDay === "unknown" || statusOnDay === "paused" || statusOnDay === "stopped") && !att) {
      continue;
    }

    eligibleCompletedMatches += 1;
    const mk = md.slice(0, 7);
    if (!monthMap.has(mk)) {
      monthMap.set(mk, { eligible: 0, attended: 0, rsvpPositive: 0 });
    }
    const bucket = monthMap.get(mk)!;
    bucket.eligible += 1;

    if (!att) {
      missingAttendanceRecords += 1;
      continue;
    }

    if (att.attended === 1) {
      attendedMatches += 1;
      bucket.attended += 1;
    }
    const rsvp = (att.rsvp_status || "none").toLowerCase();
    if (RESPONDED_RSVP_SET.has(rsvp)) {
      rsvpRespondedCount += 1;
    }
    if (POSITIVE_RSVP_SET.has(rsvp)) {
      rsvpPositiveCount += 1;
      bucket.rsvpPositive += 1;
    }
  }

  const knownCount = eligibleCompletedMatches - missingAttendanceRecords;
  return {
    playerId: player.id,
    fullName: player.full_name,
    shortName: player.short_name,
    jerseyNumber: player.jersey_number,
    eligibleCompletedMatches,
    attendedMatches,
    missingAttendanceRecords,
    attendanceRate:
      knownCount > 0 ? Math.round((attendedMatches / knownCount) * 10000) / 10000 : null,
    rsvpRespondedCount,
    rsvpPositiveCount,
    rsvpResponseRate:
      eligibleCompletedMatches > 0
        ? Math.round((rsvpRespondedCount / eligibleCompletedMatches) * 10000) / 10000
        : null,
    monthlyTrend: Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, val]) => ({
        month,
        label: formatMonthLabelVN(month),
        ...val,
      })),
  };
}

export function generateSmartInsights(params: {
  period: { from: string; to: string };
  currentHealth: ClubHealthMetrics;
  previousHealth?: ClubHealthMetrics | null;
  currentMatches: MatchPerformanceMetrics;
  currentFinance: FinanceAnalyticsMetrics;
  previousFinance?: FinanceAnalyticsMetrics | null;
  sponsorSummary?: { totalImpressions: number; totalClicks: number };
  generatedAt: string;
}): SmartInsight[] {
  const {
    period,
    currentHealth,
    previousHealth,
    currentMatches,
    currentFinance,
    previousFinance,
    sponsorSummary,
    generatedAt,
  } = params;

  const insights: SmartInsight[] = [];

  // Rule 1: Attendance rate drop >= 10pp when both periods >= 95% coverage and >= 3 completed matches
  if (
    previousHealth &&
    currentHealth.teamAttendanceRate !== null &&
    previousHealth.teamAttendanceRate !== null &&
    (currentHealth.attendanceCoverage ?? 0) >= ANALYTICS_COVERAGE_THRESHOLD &&
    (previousHealth.attendanceCoverage ?? 0) >= ANALYTICS_COVERAGE_THRESHOLD &&
    currentMatches.completedMatches >= 3
  ) {
    const deltaPp = Math.round(
      (currentHealth.teamAttendanceRate - previousHealth.teamAttendanceRate) * 1000
    ) / 10;
    if (deltaPp <= -10) {
      insights.push({
        id: `attendance-drop-${period.from}-${period.to}`,
        severity: "warning",
        title: `Tỷ lệ ra sân giảm ${Math.abs(deltaPp)} điểm % so với kỳ trước`,
        description: `Tỷ lệ ra sân đạt ${Math.round(
          currentHealth.teamAttendanceRate * 1000
        ) / 10}% (kỳ trước ${Math.round(
          previousHealth.teamAttendanceRate * 1000
        ) / 10}%).`,
        metricKey: "teamAttendanceRate",
        currentValue: currentHealth.teamAttendanceRate,
        comparisonValue: previousHealth.teamAttendanceRate,
        changePct: deltaPp,
        period,
        evidenceCount: currentMatches.completedMatches,
        coverage: currentHealth.attendanceCoverage,
        targetTab: "schedule",
        actionLabel: "Xem lịch & điểm danh",
        generatedAt,
      });
    }
  }

  // Rule 2: RSVP response rate drop >= 10pp
  if (
    previousHealth &&
    currentHealth.rsvpResponseRate !== null &&
    previousHealth.rsvpResponseRate !== null &&
    currentHealth.eligibleSlots >= 10
  ) {
    const deltaPp = Math.round(
      (currentHealth.rsvpResponseRate - previousHealth.rsvpResponseRate) * 1000
    ) / 10;
    if (deltaPp <= -10) {
      insights.push({
        id: `rsvp-drop-${period.from}-${period.to}`,
        severity: "warning",
        title: `Tỷ lệ phản hồi RSVP giảm ${Math.abs(deltaPp)} điểm %`,
        description: `Phản hồi RSVP đạt ${Math.round(
          currentHealth.rsvpResponseRate * 1000
        ) / 10}% trên ${currentHealth.eligibleSlots} lượt đủ điều kiện.`,
        metricKey: "rsvpResponseRate",
        currentValue: currentHealth.rsvpResponseRate,
        comparisonValue: previousHealth.rsvpResponseRate,
        changePct: deltaPp,
        period,
        evidenceCount: currentHealth.eligibleSlots,
        coverage: currentHealth.attendanceCoverage,
        targetTab: "schedule",
        actionLabel: "Nhắc anh em điểm danh",
        generatedAt,
      });
    }
  }

  // Rule 3: Collection rate drop >= 10pp or outstanding debt increase >= 20%
  if (
    previousFinance &&
    currentFinance.mandatoryExpected > 0 &&
    currentFinance.collectionRate !== null &&
    previousFinance.collectionRate !== null
  ) {
    const collDeltaPp = Math.round(
      (currentFinance.collectionRate - previousFinance.collectionRate) * 1000
    ) / 10;
    const debtIncreasePct =
      previousFinance.outstandingDebt > 0
        ? Math.round(
            ((currentFinance.outstandingDebt - previousFinance.outstandingDebt) /
              previousFinance.outstandingDebt) *
              1000
          ) / 10
        : null;

    if (collDeltaPp <= -10 || (debtIncreasePct !== null && debtIncreasePct >= 20)) {
      insights.push({
        id: `collection-alert-${period.from}-${period.to}`,
        severity: "warning",
        title: "Tỷ lệ thu quỹ trận giảm hoặc công nợ tăng đáng kể",
        description: `Tỷ lệ thu quỹ đạt ${Math.round(
          currentFinance.collectionRate * 1000
        ) / 10}% (${collDeltaPp >= 0 ? "+" : ""}${collDeltaPp} pp).`,
        metricKey: "collectionRate",
        currentValue: currentFinance.collectionRate,
        comparisonValue: previousFinance.collectionRate,
        changePct: collDeltaPp,
        period,
        evidenceCount: currentMatches.completedMatches,
        coverage: currentHealth.attendanceCoverage,
        targetTab: "collection",
        actionLabel: "Mở Thu tiền trận",
        generatedAt,
      });
    }
  }

  // Rule 4: Completed matches missing score
  if (currentMatches.missingScoreMatches > 0) {
    insights.push({
      id: `missing-scores-${period.from}-${period.to}`,
      severity: "info",
      title: `${currentMatches.missingScoreMatches} trận đã kết thúc chưa cập nhật tỷ số`,
      description:
        "Các trận thiếu tỷ số hợp lệ sẽ không được tính vào chỉ số W/D/L và hiệu số bàn thắng.",
      metricKey: "missingScoreMatches",
      currentValue: currentMatches.missingScoreMatches,
      comparisonValue: null,
      changePct: null,
      period,
      evidenceCount: currentMatches.missingScoreMatches,
      coverage:
        currentMatches.completedMatches > 0
          ? currentMatches.scoredMatches / currentMatches.completedMatches
          : null,
      targetTab: "schedule",
      actionLabel: "Cập nhật tỷ số",
      generatedAt,
    });
  }

  // Rule 5: Completed matches missing pitch/match cost
  if (currentMatches.missingCostMatches > 0) {
    insights.push({
      id: `missing-costs-${period.from}-${period.to}`,
      severity: "info",
      title: `${currentMatches.missingCostMatches} trận đã kết thúc chưa ghi nhận chi phí sân`,
      description:
        "Bổ sung tiền sân hoặc chứng từ chi theo trận để tính chính xác chi phí bình quân mỗi lượt ra sân.",
      metricKey: "missingCostMatches",
      currentValue: currentMatches.missingCostMatches,
      comparisonValue: null,
      changePct: null,
      period,
      evidenceCount: currentMatches.missingCostMatches,
      coverage: null,
      targetTab: "finance",
      actionLabel: "Bổ sung chi phí",
      generatedAt,
    });
  }

  // Rule 6: Sponsor impressions >= 20 with 0 clicks
  if (sponsorSummary && sponsorSummary.totalImpressions >= 20 && sponsorSummary.totalClicks === 0) {
    insights.push({
      id: `sponsor-zero-click-${period.from}-${period.to}`,
      severity: "info",
      title: "Nhà tài trợ đã có lượt hiển thị nhưng chưa ghi nhận click",
      description: `Đã ghi nhận ${sponsorSummary.totalImpressions} lượt hiển thị đủ ngưỡng và 0 lượt click trong kỳ (mẫu nhỏ, chưa kết luận hiệu quả kém).`,
      metricKey: "sponsorClicks",
      currentValue: 0,
      comparisonValue: sponsorSummary.totalImpressions,
      changePct: null,
      period,
      evidenceCount: sponsorSummary.totalImpressions,
      coverage: null,
      targetTab: "sponsors",
      actionLabel: "Xem nhà tài trợ",
      generatedAt,
    });
  }

  return insights.slice(0, 6);
}
