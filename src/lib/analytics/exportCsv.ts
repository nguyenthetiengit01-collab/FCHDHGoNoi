import type {
  AnalyticsEnvelope,
  AnalyticsSection,
  FinanceAnalyticsMetrics,
  MatchPerformanceMetrics,
  OverviewAnalyticsData,
  ProductAnalyticsMetrics,
  SponsorCommunityMetrics,
  EngagementMetrics,
} from "./types";

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function fmtPct(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 1000) / 10}%`;
}

export function buildAnalyticsCsv(params: {
  section: AnalyticsSection;
  envelope: AnalyticsEnvelope<unknown>;
}): string {
  const { section, envelope } = params;
  const rows: Array<Array<string | number | null | undefined>> = [
    ["Báo cáo Analytics — FC HĐH Gò Nổi tại TP.HCM"],
    ["Phân hệ", section],
    ["Kỳ báo cáo", `${envelope.period.from} -> ${envelope.period.to}`],
    ["Múi giờ", envelope.timezone],
    ["Thời điểm xuất", envelope.generatedAt],
    [
      "Độ phủ dữ liệu",
      envelope.coverage.rate !== null
        ? `${Math.round(envelope.coverage.rate * 1000) / 10}% (${envelope.coverage.knownRecords}/${envelope.coverage.eligibleRecords})`
        : "Chưa có mẫu số",
    ],
    [],
  ];

  if (section === "overview" && envelope.data) {
    const d = envelope.data as OverviewAnalyticsData;
    rows.push(["Chỉ số (KPI)", "Giá trị", "Định nghĩa / Ghi chú"]);
    rows.push(["Cầu thủ hoạt động", d.clubHealth.activePlayers, "Trạng thái active cuối kỳ"]);
    rows.push(["Tỷ lệ ra sân", fmtPct(d.clubHealth.teamAttendanceRate), "attended=1 / known slots"]);
    rows.push(["Độ phủ điểm danh", fmtPct(d.clubHealth.attendanceCoverage), "known slots / eligible slots"]);
    rows.push(["Trận hoàn thành", d.matchPerformance.completedMatches, "Status completed trong kỳ"]);
    rows.push(["Tỷ lệ thắng (Win Rate)", fmtPct(d.matchPerformance.winRate), "Wins / Scored completed matches"]);
    rows.push(["Số dư vận hành kỳ (VNĐ)", d.finance.operatingBalance, "Tổng thu kỳ - Tổng chi kỳ"]);
    rows.push(["Tỷ lệ thu quỹ trận", fmtPct(d.finance.collectionRate), "Mandatory collected / expected"]);
    rows.push(["Công nợ quỹ trận (VNĐ)", d.finance.outstandingDebt, "attended=1 AND paid=0"]);
  } else if (section === "matches" && envelope.data) {
    const d = envelope.data as MatchPerformanceMetrics;
    rows.push(["Ngày", "Trận", "Đối thủ", "Trạng thái", "Tỷ số", "KQ", "RSVP", "Ra sân", "Thu (VNĐ)", "Chi (VNĐ)", "Chi phí/người"]);
    for (const m of d.matches) {
      rows.push([
        m.matchDate,
        m.label,
        m.opponent,
        m.status,
        m.teamScore !== null && m.opponentScore !== null ? `${m.teamScore}-${m.opponentScore}` : "—",
        m.result || "—",
        m.rsvpCount,
        m.attendeesCount,
        m.collected,
        m.expense,
        m.costPerAttendee ?? "—",
      ]);
    }
  } else if (section === "engagement" && envelope.data) {
    const d = envelope.data as EngagementMetrics;
    rows.push(["Chỉ số Gắn kết", "Giá trị"]);
    rows.push(["Active Players", d.clubHealth.activePlayers]);
    rows.push(["Paused Players", d.clubHealth.pausedPlayers]);
    rows.push(["Stopped Players", d.clubHealth.stoppedPlayers]);
    rows.push(["RSVP Response Rate", fmtPct(d.clubHealth.rsvpResponseRate)]);
    rows.push(["RSVP Positive Rate", fmtPct(d.clubHealth.rsvpPositiveRate)]);
    rows.push(["Attendance After Positive RSVP", fmtPct(d.clubHealth.attendanceAfterPositiveRsvp)]);
    rows.push(["Monthly Active Players", d.monthlyActivePlayers]);
    rows.push(["Monthly Active Managers", d.monthlyActiveManagers]);
  } else if (section === "finance" && envelope.data) {
    const d = envelope.data as FinanceAnalyticsMetrics;
    rows.push(["Khoản mục Tài chính", "Giá trị (VNĐ)"]);
    rows.push(["Tiền quỹ trận thực thu", d.matchIncome]);
    rows.push(["Quỹ trận phải thu (attended=1)", d.mandatoryExpected]);
    rows.push(["Tỷ lệ thu quỹ trận", fmtPct(d.collectionRate)]);
    rows.push(["Công nợ tồn đọng", d.outstandingDebt]);
    rows.push(["Đóng góp tự nguyện (vắng nhưng đóng)", d.voluntaryContribution]);
    rows.push(["Thu khác hợp lệ", d.otherIncome]);
    rows.push(["Thu gắn nhà tài trợ", d.sponsorAttributedIncome]);
    rows.push(["Thu khác chưa phân bổ sponsor", d.unattributedOtherIncome]);
    rows.push(["Tổng chi vận hành", d.operatingExpense]);
    rows.push(["Cân đối thu-chi trong kỳ", d.operatingBalance]);
    rows.push(["Số dư quỹ lũy kế đến cuối kỳ", d.cumulativeBalance]);
  } else if ((section === "sponsors" || section === "community") && envelope.data) {
    const d = envelope.data as SponsorCommunityMetrics;
    rows.push(["Nhà tài trợ", "Hạng", "Impressions", "Clicks", "CTR", "Thu gắn tài trợ (VNĐ)"]);
    for (const s of d.sponsors) {
      rows.push([s.name, s.tier, s.impressions, s.clicks, fmtPct(s.ctr), s.attributedIncome]);
    }
    rows.push([]);
    rows.push(["Bài viết cộng đồng", "Chuyên mục", "Lượt xem"]);
    for (const p of d.posts) {
      rows.push([p.title, p.category, p.views]);
    }
  } else if (section === "product" && envelope.data) {
    const d = envelope.data as ProductAnalyticsMetrics;
    rows.push(["Chỉ số Product Analytics", "Giá trị"]);
    rows.push(["Tổng events hợp lệ", d.totalEvents]);
    rows.push(["Tổng page views", d.totalPageViews]);
    rows.push(["Club post views", d.totalPostViews]);
    rows.push(["Player profile views", d.totalProfileViews]);
    rows.push(["RSVP flow opens", d.rsvpFunnel.flowOpens]);
    rows.push(["RSVP submit successes", d.rsvpFunnel.submitSuccesses]);
    rows.push(["RSVP funnel conversion", fmtPct(d.rsvpFunnel.conversionRate)]);
  }

  return "\uFEFF" + rows.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
}
