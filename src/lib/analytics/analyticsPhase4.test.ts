import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { runPhase4Migration } from "../../../scripts/migrations/phase4-analytics-v1.mjs";
import {
  computeClubHealthMetrics,
  computeCoverage,
  computeFinanceAnalytics,
  computeMatchPerformance,
  computeRetentionCohort,
  generateSmartInsights,
  resolvePlayerStatusAtDate,
  type LifecycleEventRow,
} from "./metrics";
import {
  cleanupExpiredRawEvents,
  deriveActorKeyHash,
  ingestProductEvents,
  rebuildAnalyticsRollups,
} from "./productEvents";
import { queryAnalyticsSection } from "./queries";
import {
  computePreviousPeriod,
  resolveAnalyticsPeriod,
  validateProductEventBatch,
} from "./validation";
import { buildAnalyticsCsv } from "./exportCsv";
import { GET as getAnalyticsRoute } from "@/app/api/analytics/route";
import { POST as postAnalyticsEventsRoute } from "@/app/api/analytics/events/route";
import type { AsyncDb } from "@/lib/db";

const tempDirs: string[] = [];

function createTempSqliteAsyncDb(): { sqlitePath: string; db: AsyncDb; raw: DatabaseSync } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gonoi-p4-"));
  tempDirs.push(dir);
  const sqlitePath = path.join(dir, "test.sqlite");
  const raw = new DatabaseSync(sqlitePath);

  raw.exec(`
    CREATE TABLE team_settings (id INTEGER PRIMARY KEY, team_name TEXT, short_name TEXT, default_match_fee INTEGER, bank_bin TEXT, bank_name TEXT, bank_account_no TEXT, bank_account_name TEXT, tournament_fund_reserve INTEGER, tournament_fund_note TEXT, fanpage_url TEXT);
    CREATE TABLE players (id INTEGER PRIMARY KEY AUTOINCREMENT, code_order INTEGER, full_name TEXT, short_name TEXT, jersey_number INTEGER, position TEXT, phone TEXT, birth_year TEXT, avatar_url TEXT, profile_image_url TEXT, bio TEXT, role TEXT, access_role TEXT, pin_code TEXT, status TEXT, notes TEXT, hometown TEXT, nickname TEXT, playing_style TEXT, gallery_urls_json TEXT);
    CREATE TABLE matches (id INTEGER PRIMARY KEY AUTOINCREMENT, match_number INTEGER, label TEXT, match_date TEXT, kickoff_time TEXT, venue TEXT, opponent TEXT, fee_per_player INTEGER, pitch_cost INTEGER, payer_name TEXT, team_score INTEGER, opponent_score INTEGER, status TEXT, notes TEXT);
    CREATE TABLE match_attendances (id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER, player_id INTEGER, rsvp_status TEXT, walk_in INTEGER, attended INTEGER, paid INTEGER, amount INTEGER, collected_by TEXT, note TEXT, UNIQUE(match_id, player_id));
    CREATE TABLE other_incomes (id INTEGER PRIMARY KEY AUTOINCREMENT, income_date TEXT, contributor TEXT, amount INTEGER, fund_type TEXT, note TEXT);
    CREATE TABLE expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, expense_date TEXT, category TEXT, description TEXT, amount INTEGER, payer TEXT, match_id INTEGER);
    CREATE TABLE sponsors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, tier TEXT, logo_url TEXT, banner_url TEXT, website_url TEXT, description TEXT, start_date TEXT, end_date TEXT, display_positions_json TEXT, is_active INTEGER, sort_order INTEGER, note TEXT, created_at TEXT);
    CREATE TABLE club_posts (id TEXT PRIMARY KEY, category TEXT, category_label TEXT, category_badge_class TEXT, title TEXT, slug TEXT, summary TEXT, published_date TEXT, event_year TEXT, author TEXT, featured_image TEXT, gallery_images_json TEXT, reading_time TEXT, paragraphs_json TEXT, quote TEXT, highlights_json TEXT, tagged_players_json TEXT);
    CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER, actor_name TEXT, actor_role TEXT, action TEXT, summary TEXT, created_at TEXT);
  `);

  const db: AsyncDb = {
    async query(sql, params = []) {
      return raw.prepare(sql).all(...(params as never[])) as never[];
    },
    async queryOne(sql, params = []) {
      return (raw.prepare(sql).get(...(params as never[])) ?? null) as never;
    },
    async run(sql, params = []) {
      const res = raw.prepare(sql).run(...(params as never[]));
      return {
        lastInsertRowid: Number(res.lastInsertRowid || 0),
        changes: Number(res.changes || 0),
      };
    },
    async exec(sql) {
      raw.exec(sql);
    },
    async batch(statements) {
      raw.exec("BEGIN IMMEDIATE;");
      try {
        for (const s of statements) {
          raw.prepare(s.sql).run(...((s.params || []) as never[]));
        }
        raw.exec("COMMIT;");
      } catch (err) {
        raw.exec("ROLLBACK;");
        throw err;
      }
    },
    async transaction(fn) {
      raw.exec("BEGIN IMMEDIATE;");
      try {
        const result = await fn(db);
        raw.exec("COMMIT;");
        return result;
      } catch (err) {
        raw.exec("ROLLBACK;");
        throw err;
      }
    },
  };

  return { sqlitePath, db, raw };
}

afterEach(() => {
  delete process.env.ANALYTICS_ENABLED;
  delete process.env.USE_LOCAL_SQLITE;
  delete process.env.SQLITE_DB_PATH;
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows SQLite handle cleanup
    }
  }
});

describe("Phase 4 — KPI Engine, Validation & Smart Insights", () => {
  it("validates period boundaries, previous period length, and rejects from > to", () => {
    expect(resolveAnalyticsPeriod({ from: "2026-05-10", to: "2026-05-01" }).ok).toBe(false);
    expect(resolveAnalyticsPeriod({ from: "2026-02-30", to: "2026-03-01" }).ok).toBe(false);
    const valid = resolveAnalyticsPeriod({ from: "2026-03-01", to: "2026-03-30" });
    expect(valid.ok).toBe(true);
    const prev = computePreviousPeriod("2026-03-01", "2026-03-30");
    expect(prev).toEqual({ from: "2026-01-30", to: "2026-02-28" });
  });

  it("handles lifecycle status ordering, unknown before baseline, and missing attendance rows", () => {
    const events: LifecycleEventRow[] = [
      { id: 1, player_id: 1, event_type: "baseline", from_status: null, to_status: "Đang sinh hoạt", effective_at: "2026-10-01T00:00:00Z", source: "migration" },
      { id: 2, player_id: 1, event_type: "status_changed", from_status: "Đang sinh hoạt", to_status: "Tạm nghỉ", effective_at: "2026-10-10T01:00:00Z", source: "manager_action" },
      { id: 3, player_id: 1, event_type: "status_changed", from_status: "Tạm nghỉ", to_status: "Đang sinh hoạt", effective_at: "2026-10-10T10:00:00Z", source: "manager_action" },
    ];
    expect(resolvePlayerStatusAtDate({ id: 1, status: "Đang sinh hoạt" }, events, "2026-09-15")).toBe("unknown");
    expect(resolvePlayerStatusAtDate({ id: 1, status: "Đang sinh hoạt" }, events, "2026-10-10")).toBe("active");

    const health = computeClubHealthMetrics({
      players: [
        { id: 1, code_order: 1, full_name: "A", short_name: "A", jersey_number: 1, position: "MF", phone: "", birth_year: "1990", role: "", status: "Đang sinh hoạt", avatar_url: "", access_role: "player", pin_code: "", notes: "" },
        { id: 2, code_order: 2, full_name: "B", short_name: "B", jersey_number: 2, position: "DF", phone: "", birth_year: "1991", role: "", status: "Đang sinh hoạt", avatar_url: "", access_role: "player", pin_code: "", notes: "" },
      ],
      matches: [
        { id: 10, match_number: 1, label: "T1", match_date: "2026-10-15", kickoff_time: "19:00", venue: "Sân A", opponent: "FC Bạn", fee_per_player: 100000, pitch_cost: 900000, payer_name: "", status: "Đã kết thúc", team_score: 3, opponent_score: 2, notes: "" },
      ],
      attendances: [
        // Player 1 present, Player 2 row missing (must NOT be counted as absent!)
        { id: 1, match_id: 10, player_id: 1, rsvp_status: "registered", walk_in: 0, attended: 1, paid: 1, amount: 100000, collected_by: "", note: "" },
      ],
      lifecycleEvents: [
        ...events,
        { id: 4, player_id: 2, event_type: "baseline", from_status: null, to_status: "Đang sinh hoạt", effective_at: "2026-10-01T00:00:00Z", source: "migration" },
      ],
      periodFrom: "2026-10-01",
      periodTo: "2026-10-31",
    });

    expect(health.eligibleSlots).toBe(2);
    expect(health.knownAttendanceSlots).toBe(1);
    expect(health.missingAttendanceSlots).toBe(1);
    expect(health.attendanceCoverage).toBe(0.5);
    expect(health.teamAttendanceRate).toBe(1); // 1/1 known, NOT 1/2!
  });

  it("computes W/D/L strictly for scored completed matches and avoids double counting pitch cost", () => {
    const perf = computeMatchPerformance({
      matches: [
        { id: 1, match_number: 1, label: "M1", match_date: "2026-10-01", kickoff_time: "19:00", venue: "A", opponent: "FC X", fee_per_player: 100000, pitch_cost: 900000, payer_name: "", status: "Đã kết thúc", team_score: 4, opponent_score: 2, notes: "" },
        { id: 2, match_number: 2, label: "M2", match_date: "2026-10-08", kickoff_time: "19:00", venue: "A", opponent: "FC Y", fee_per_player: 100000, pitch_cost: 900000, payer_name: "", status: "Đã kết thúc", team_score: null, opponent_score: null, notes: "" },
        { id: 3, match_number: 3, label: "M3", match_date: "2026-10-15", kickoff_time: "19:00", venue: "A", opponent: "FC Z", fee_per_player: 100000, pitch_cost: 0, payer_name: "", status: "Đã hủy", team_score: 5, opponent_score: 0, notes: "" },
      ],
      attendances: [
        { id: 1, match_id: 1, player_id: 1, rsvp_status: "registered", walk_in: 0, attended: 1, paid: 1, amount: 100000, collected_by: "", note: "" },
        { id: 2, match_id: 1, player_id: 2, rsvp_status: "registered", walk_in: 0, attended: 1, paid: 1, amount: 100000, collected_by: "", note: "" },
      ],
      expenses: [
        { id: 1, expense_date: "2026-10-01", category: "Tiền sân", description: "Sân M1", amount: 900000, payer: "Tiếng", match_id: 1 },
        { id: 2, expense_date: "2026-10-01", category: "Nước uống", description: "Nước M1", amount: 100000, payer: "Tiếng", match_id: 1 },
      ],
      periodFrom: "2026-10-01",
      periodTo: "2026-10-31",
    });

    expect(perf.completedMatches).toBe(2);
    expect(perf.scoredMatches).toBe(1);
    expect(perf.missingScoreMatches).toBe(1);
    expect(perf.wins).toBe(1);
    expect(perf.winRate).toBe(1);
    expect(perf.totalMatchCost).toBe(1000000); // 900k (Tiền sân) + 100k (Nước), NOT 900k+900k+100k!
    expect(perf.costPerAttendee).toBe(500000);
  });

  it("handles zero denominator safely without NaN/Infinity, retention cohorts, and low coverage badge", () => {
    const fin = computeFinanceAnalytics({
      matches: [],
      attendances: [],
      otherIncomes: [
        { id: 1, income_date: "2026-10-02", contributor: "Transfer", amount: 500000, fund_type: "Chuyển quỹ nội bộ", note: "", sponsor_id: null },
        { id: 2, income_date: "2026-10-03", contributor: "Sponsor A", amount: 2000000, fund_type: "Tài trợ", note: "", sponsor_id: 1 },
      ],
      expenses: [
        { id: 1, expense_date: "2026-10-02", category: "Chuyển quỹ nội bộ", description: "Nội bộ", amount: 500000, payer: "Tiếng", match_id: null },
      ],
      periodFrom: "2026-10-01",
      periodTo: "2026-10-31",
    });

    expect(fin.collectionRate).toBeNull();
    expect(fin.averageMatchCost).toBeNull();
    expect(fin.costPerAttendance).toBeNull();
    expect(fin.otherIncome).toBe(2000000);
    expect(fin.operatingExpense).toBe(0);
    expect(fin.sponsorAttributedIncome).toBe(2000000);
    expect(fin.unattributedOtherIncome).toBe(0);

    const cov = computeCoverage(10, 9, "2026-10-01");
    expect(cov.isLowCoverage).toBe(true);

    const retention = computeRetentionCohort({
      players: [
        { id: 1, code_order: 1, full_name: "A", short_name: "A", jersey_number: 1, position: "MF", phone: "", birth_year: "1990", role: "", status: "Đang sinh hoạt", avatar_url: "", access_role: "player", pin_code: "", notes: "", joined_at: "2026-08-01T00:00:00Z" },
        { id: 2, code_order: 2, full_name: "B", short_name: "B", jersey_number: 2, position: "DF", phone: "", birth_year: "1990", role: "", status: "Đang sinh hoạt", avatar_url: "", access_role: "player", pin_code: "", notes: "", joined_at: null },
      ],
      lifecycleEvents: [
        { id: 1, player_id: 1, event_type: "joined", from_status: null, to_status: "Đang sinh hoạt", effective_at: "2026-08-01T00:00:00Z", source: "manager_action" },
      ],
      windowDays: 30,
      asOfDate: "2026-10-01",
    });
    expect(retention.eligibleCohortSize).toBe(1);
    expect(retention.rate).toBe(1);
  });

  it("generates deterministic smart insights and exports clean CSV without PII", () => {
    const insights = generateSmartInsights({
      period: { from: "2026-10-01", to: "2026-10-31" },
      currentHealth: {
        activePlayers: 20, pausedPlayers: 0, stoppedPlayers: 0, unknownPlayers: 0,
        newMembers: 0, stoppedInPeriod: 0, netMemberGrowth: 0,
        eligibleSlots: 60, knownAttendanceSlots: 60, missingAttendanceSlots: 0,
        attendanceCoverage: 1, teamAttendanceRate: 0.5, rsvpRespondedSlots: 60,
        rsvpResponseRate: 0.6, rsvpPositiveSlots: 40, rsvpPositiveRate: 0.67,
        attendanceAfterPositiveRsvp: 0.8,
      },
      previousHealth: {
        activePlayers: 20, pausedPlayers: 0, stoppedPlayers: 0, unknownPlayers: 0,
        newMembers: 0, stoppedInPeriod: 0, netMemberGrowth: 0,
        eligibleSlots: 60, knownAttendanceSlots: 60, missingAttendanceSlots: 0,
        attendanceCoverage: 1, teamAttendanceRate: 0.75, rsvpRespondedSlots: 60,
        rsvpResponseRate: 0.8, rsvpPositiveSlots: 48, rsvpPositiveRate: 0.8,
        attendanceAfterPositiveRsvp: 0.9,
      },
      currentMatches: {
        totalMatchesInPeriod: 3, completedMatches: 3, scoredMatches: 2,
        missingScoreMatches: 1, missingCostMatches: 1, wins: 1, draws: 1, losses: 0,
        winRate: 0.5, goalsFor: 4, goalsAgainst: 2, goalDifference: 2,
        recentForm: [], totalMatchCost: 1800000, totalAttendees: 30, costPerAttendee: 60000, matches: [],
      },
      currentFinance: {
        matchIncome: 1500000, mandatoryExpected: 2000000, mandatoryCollected: 1200000,
        collectionRate: 0.6, outstandingDebt: 800000, voluntaryContribution: 300000,
        voluntaryCount: 3, otherIncome: 0, totalIncome: 1500000, operatingExpense: 1800000,
        operatingBalance: -300000, cumulativeBalance: 5000000, averageMatchCost: 900000,
        costPerAttendance: 60000, sponsorAttributedIncome: 0, unattributedOtherIncome: 0,
        expenseBreakdown: [], cashflowTrend: [],
      },
      sponsorSummary: { totalImpressions: 25, totalClicks: 0 },
      generatedAt: "2026-10-31T12:00:00Z",
    });

    expect(insights.some((i) => i.metricKey === "teamAttendanceRate")).toBe(true);
    expect(insights.some((i) => i.metricKey === "missingScoreMatches")).toBe(true);
    expect(insights.some((i) => i.metricKey === "sponsorClicks")).toBe(true);

    const csv = buildAnalyticsCsv({
      section: "overview",
      envelope: {
        enabled: true,
        section: "overview",
        generatedAt: "2026-10-31T12:00:00Z",
        timezone: "Asia/Ho_Chi_Minh",
        period: { from: "2026-10-01", to: "2026-10-31", preset: "custom" },
        coverage: computeCoverage(60, 60, "2026-10-01"),
        data: {
          clubHealth: {
            activePlayers: 20, pausedPlayers: 0, stoppedPlayers: 0, unknownPlayers: 0,
            newMembers: 0, stoppedInPeriod: 0, netMemberGrowth: 0,
            eligibleSlots: 60, knownAttendanceSlots: 60, missingAttendanceSlots: 0,
            attendanceCoverage: 1, teamAttendanceRate: 0.5, rsvpRespondedSlots: 60,
            rsvpResponseRate: 0.6, rsvpPositiveSlots: 40, rsvpPositiveRate: 0.67,
            attendanceAfterPositiveRsvp: 0.8,
          },
          matchPerformance: {
            completedMatches: 3, scoredMatches: 2, wins: 1, draws: 1, losses: 0, winRate: 0.5, recentForm: [],
          },
          finance: {
            operatingBalance: -300000, cumulativeBalance: 5000000, collectionRate: 0.6,
            outstandingDebt: 800000, totalIncome: 1500000, operatingExpense: 1800000,
          },
          trends: { attendanceByMonth: [], cashflowByMonth: [], lifecycleByMonth: [] },
          insights,
        },
      },
    });
    expect(csv).not.toContain("actor_key_hash");
    expect(csv).not.toContain("pin_code");
    expect(csv).toContain("Asia/Ho_Chi_Minh");
  });
});

describe("Phase 4 — Migration, Rollup, Retention & API Security", () => {
  it("runs idempotent migration twice, preserves old data, and verifies event dedupe/rollup/cleanup", async () => {
    const { db, raw } = createTempSqliteAsyncDb();
    try {
      raw.prepare("INSERT INTO players (code_order, full_name, short_name, status) VALUES (?, ?, ?, ?)").run(1, "Nguyễn Văn A", "A", "Đang sinh hoạt");
      raw.prepare("INSERT INTO other_incomes (income_date, contributor, amount, fund_type, note) VALUES (?, ?, ?, ?, ?)").run("2026-09-01", "Cũ", 1000000, "Tài trợ", "Lịch sử");

      const execFn = (sql: string, args: unknown[] = []) => db.run(sql, args);
      const queryFn = (sql: string, args: unknown[] = []) => db.query(sql, args);

      const m1 = await runPhase4Migration({ execute: execFn, query: queryFn });
      expect(m1.insertedBaselines).toBe(1);

      const m2 = await runPhase4Migration({ execute: execFn, query: queryFn });
      expect(m2.insertedBaselines).toBe(0);

      const playerRow = await db.queryOne<{ joined_at: string | null }>("SELECT joined_at FROM players WHERE id = 1");
      expect(playerRow?.joined_at).toBeNull();

      const uuid = "11111111-2222-4333-8444-555555555555";
      const r1 = await ingestProductEvents({
        db,
        actorRole: "player",
        playerId: 1,
        now: new Date("2026-10-15T10:00:00Z"),
        events: [{ eventUuid: uuid, eventName: "page_view", routeKey: "/" }],
      });
      expect(r1).toEqual({ accepted: 1, deduped: 0 });

      const r2 = await ingestProductEvents({
        db,
        actorRole: "player",
        playerId: 1,
        now: new Date("2026-10-15T10:00:05Z"),
        events: [{ eventUuid: uuid, eventName: "page_view", routeKey: "/" }],
      });
      expect(r2).toEqual({ accepted: 0, deduped: 1 });

      const daily = await db.queryOne<{ event_count: number }>("SELECT event_count FROM product_analytics_daily WHERE event_name = 'page_view'");
      expect(daily?.event_count).toBe(1);

      await rebuildAnalyticsRollups(db);
      const rebuilt = await db.queryOne<{ event_count: number }>("SELECT event_count FROM product_analytics_daily WHERE event_name = 'page_view'");
      expect(rebuilt?.event_count).toBe(1);

      // Expired raw event cleanup preserves daily & monthly rollups
      const oldUuid = "22222222-2222-4333-8444-555555555555";
      await ingestProductEvents({
        db,
        actorRole: "player",
        playerId: 1,
        now: new Date("2025-01-01T10:00:00Z"),
        events: [{ eventUuid: oldUuid, eventName: "page_view", routeKey: "/hoat-dong" }],
      });

      const dryCleanup = await cleanupExpiredRawEvents({
        db,
        now: new Date("2026-11-16T00:00:00Z"),
        dryRun: true,
      });
      expect(dryCleanup.expiredCount).toBe(1);
      expect(dryCleanup.deletedCount).toBe(0);

      const realCleanup = await cleanupExpiredRawEvents({
        db,
        now: new Date("2026-11-16T00:00:00Z"),
        dryRun: false,
      });
      expect(realCleanup.deletedCount).toBe(1);
      const stillDaily = await db.queryOne<{ cnt: number }>("SELECT COUNT(*) AS cnt FROM product_analytics_daily");
      expect(stillDaily?.cnt).toBe(2);

      // Actor hash is deterministic and never raw ID
      const hash = deriveActorKeyHash("player", 1);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(deriveActorKeyHash("guest", null)).toBeNull();
    } finally {
      raw.close();
    }
  });

  it("enforces strict RBAC, CSRF, PII rejection, and no-store on /api/analytics routes", async () => {
    const { sqlitePath, db, raw } = createTempSqliteAsyncDb();
    try {
      raw.prepare("INSERT INTO players (code_order, full_name, short_name, access_role, status) VALUES (?, ?, ?, ?, ?)").run(1, "Player One", "One", "player", "Đang sinh hoạt");
      raw.prepare("INSERT INTO players (code_order, full_name, short_name, access_role, status) VALUES (?, ?, ?, ?, ?)").run(2, "Manager One", "Mgr", "manager", "Đang sinh hoạt");
      await runPhase4Migration({
        execute: (sql: string, args: unknown[] = []) => db.run(sql, args),
        query: (sql: string, args: unknown[] = []) => db.query(sql, args),
      });
      raw.close();

      process.env.USE_LOCAL_SQLITE = "true";
      process.env.SQLITE_DB_PATH = sqlitePath;
      process.env.ANALYTICS_ENABLED = "true";

      const playerCookie = createSessionToken({
        id: 1,
        code_order: 1,
        full_name: "Player One",
        short_name: "One",
        jersey_number: 7,
        position: "MF",
        phone: "",
        birth_year: "1990",
        role: "Thành viên",
        status: "Đang sinh hoạt",
        avatar_url: "",
        access_role: "player",
        pin_code: "1234",
        notes: "",
      });
      const managerCookie = createSessionToken({
        id: 2,
        code_order: 2,
        full_name: "Manager One",
        short_name: "Mgr",
        jersey_number: 1,
        position: "GK",
        phone: "",
        birth_year: "1988",
        role: "Đội trưởng",
        status: "Đang sinh hoạt",
        avatar_url: "",
        access_role: "manager",
        pin_code: "1234",
        notes: "",
      });

      // Guest -> 401
      const guestRes = await getAnalyticsRoute(
        new NextRequest("http://localhost/api/analytics?section=overview")
      );
      expect(guestRes.status).toBe(401);
      expect(guestRes.headers.get("cache-control")).toContain("no-store");

      // Player calling manager finance section -> 403
      const playerFinRes = await getAnalyticsRoute(
        new NextRequest("http://localhost/api/analytics?section=finance", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${playerCookie}` },
        })
      );
      expect(playerFinRes.status).toBe(403);

      // Player passing another playerId -> 403
      const playerIdorRes = await getAnalyticsRoute(
        new NextRequest("http://localhost/api/analytics?section=my-insights&playerId=2", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${playerCookie}` },
        })
      );
      expect(playerIdorRes.status).toBe(403);

      // Player self my-insights -> 200
      const playerSelfRes = await getAnalyticsRoute(
        new NextRequest("http://localhost/api/analytics?section=my-insights", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${playerCookie}` },
        })
      );
      expect(playerSelfRes.status).toBe(200);
      const selfJson = await playerSelfRes.json();
      expect(selfJson.enabled).toBe(true);
      expect(selfJson.data, JSON.stringify(selfJson)).not.toBeNull();
      expect(selfJson.data.playerId).toBe(1);

      // Manager overview -> 200
      const mgrRes = await getAnalyticsRoute(
        new NextRequest("http://localhost/api/analytics?section=overview", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${managerCookie}` },
        })
      );
      expect(mgrRes.status).toBe(200);

      // Feature flag OFF -> disabled envelope
      process.env.ANALYTICS_ENABLED = "false";
      const offRes = await getAnalyticsRoute(
        new NextRequest("http://localhost/api/analytics?section=overview", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${managerCookie}` },
        })
      );
      expect(offRes.status).toBe(200);
      expect((await offRes.json()).enabled).toBe(false);
      process.env.ANALYTICS_ENABLED = "true";

      // POST /api/analytics/events: CSRF invalid -> 403
      const badOriginRes = await postAnalyticsEventsRoute(
        new NextRequest("http://localhost/api/analytics/events", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "https://evil.example.com" },
          body: JSON.stringify({ events: [{ eventUuid: "11111111-2222-4333-8444-555555555555", eventName: "page_view", routeKey: "/" }] }),
        })
      );
      expect(badOriginRes.status).toBe(403);

      // Forbidden PII metadata -> 400
      const piiCheck = validateProductEventBatch([
        {
          eventUuid: "11111111-2222-4333-8444-555555555555",
          eventName: "page_view",
          routeKey: "/",
          metadata: { phone: "0909123456" },
        },
      ]);
      expect(piiCheck.ok).toBe(false);

      // Valid POST event -> 200 without actor_key_hash
      const okEventRes = await postAnalyticsEventsRoute(
        new NextRequest("http://localhost/api/analytics/events", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            host: "localhost",
            origin: "http://localhost",
            cookie: `${SESSION_COOKIE_NAME}=${playerCookie}`,
          },
          body: JSON.stringify({
            events: [
              {
                eventUuid: "33333333-2222-4333-8444-555555555555",
                eventName: "page_view",
                routeKey: "/",
              },
            ],
          }),
        })
      );
      expect(okEventRes.status).toBe(200);
      const okEventJson = await okEventRes.json();
      expect(okEventJson).toEqual({ ok: true, enabled: true, accepted: 1, deduped: 0 });
    } finally {
      try {
        raw.close();
      } catch {
        // Already closed
      }
    }
  });

  it("handles stress dataset (250 players, 500 matches, 100k attendances, 5k finance) under 1.5s and reconciles SQL totals", async () => {
    const { db, raw } = createTempSqliteAsyncDb();
    try {
      await runPhase4Migration({
        execute: (sql: string, args: unknown[] = []) => db.run(sql, args),
        query: (sql: string, args: unknown[] = []) => db.query(sql, args),
      });

      raw.exec("BEGIN;");
      const insPlayer = raw.prepare("INSERT INTO players (code_order, full_name, short_name, status) VALUES (?, ?, ?, ?)");
      for (let i = 1; i <= 250; i++) {
        insPlayer.run(i, `Player ${i}`, `P${i}`, "Đang sinh hoạt");
      }
      const insMatch = raw.prepare("INSERT INTO matches (match_number, label, match_date, kickoff_time, venue, pitch_cost, payer_name, status, team_score, opponent_score) VALUES (?, ?, ?, '19:00', 'Sân A', 900000, 'Tiếng', 'Đã kết thúc', 3, 2)");
      for (let m = 1; m <= 500; m++) {
        insMatch.run(m, `Trận ${m}`, m > 490 ? "2026-10-15" : "2025-05-01");
      }
      const insAtt = raw.prepare("INSERT INTO match_attendances (match_id, player_id, rsvp_status, walk_in, attended, paid, amount, collected_by, note) VALUES (?, ?, 'registered', 0, 1, 1, 100000, '', '')");
      for (let m = 1; m <= 500; m++) {
        for (let p = 1; p <= 200; p++) {
          insAtt.run(m, p);
        }
      }
      const insExp = raw.prepare("INSERT INTO expenses (expense_date, category, description, amount, payer, match_id) VALUES ('2026-10-15', 'Nước uống', 'Nước', 50000, 'Tiếng', NULL)");
      for (let e = 1; e <= 5000; e++) {
        insExp.run();
      }
      raw.exec("COMMIT;");

      const t0 = performance.now();
      const res = await queryAnalyticsSection({
        db,
        section: "overview",
        period: { from: "2026-10-01", to: "2026-10-31", preset: "custom" },
        comparePrevious: true,
      });
      const elapsedMs = performance.now() - t0;
      expect(elapsedMs).toBeLessThan(1500);

      // Independent SQL reconciliation check
      const sqlAttCount = raw.prepare(
        "SELECT COUNT(*) AS cnt FROM match_attendances ma JOIN matches m ON m.id = ma.match_id WHERE m.match_date >= '2026-10-01' AND m.match_date <= '2026-10-31' AND ma.attended = 1"
      ).get() as { cnt: number };
      expect(sqlAttCount.cnt).toBe(2000); // 10 matches in Oct 2026 * 200 players
      expect((res.data as { clubHealth: { knownAttendanceSlots: number } }).clubHealth.knownAttendanceSlots).toBe(2000);
    } finally {
      raw.close();
    }
  });
});
