"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Download,
  ExternalLink,
  Filter,
  Info,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
  StatCard,
} from "@/components/ui";
import { formatVND } from "@/lib/format";
import { buildAnalyticsCsv } from "@/lib/analytics/exportCsv";
import type {
  AnalyticsEnvelope,
  AnalyticsPreset,
  AnalyticsSection,
  EngagementMetrics,
  FinanceAnalyticsMetrics,
  MatchPerformanceMetrics,
  OverviewAnalyticsData,
  ProductAnalyticsMetrics,
  SponsorCommunityMetrics,
} from "@/lib/analytics/types";

interface AnalyticsCenterTabProps {
  onNavigateTab?: (
    tab: "schedule" | "matrix" | "finance" | "collection" | "sponsors" | "posts"
  ) => void;
}

const SECTION_TABS: Array<{
  id: Exclude<AnalyticsSection, "community" | "my-insights">;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Tổng quan", icon: BarChart3 },
  { id: "matches", label: "Trận đấu", icon: Trophy },
  { id: "engagement", label: "Gắn kết", icon: Users },
  { id: "finance", label: "Tài chính", icon: Wallet },
  { id: "sponsors", label: "Tài trợ & Cộng đồng", icon: TrendingUp },
  { id: "product", label: "Website Analytics", icon: Activity },
];

function fmtPct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  return `${Math.round(rate * 1000) / 10}%`;
}

function fmtDeltaPp(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return "—";
  return `${delta >= 0 ? "+" : ""}${delta} điểm %`;
}

export function AnalyticsCenterTab({ onNavigateTab }: AnalyticsCenterTabProps) {
  const [section, setSection] =
    useState<Exclude<AnalyticsSection, "community" | "my-insights">>("overview");
  const [preset, setPreset] = useState<AnalyticsPreset>("90d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [comparePrevious, setComparePrevious] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [envelope, setEnvelope] = useState<AnalyticsEnvelope<unknown> | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ section });
      if (preset === "custom" && customFrom && customTo) {
        qs.set("from", customFrom);
        qs.set("to", customTo);
      } else {
        qs.set("preset", preset);
      }
      if (comparePrevious) {
        qs.set("compare", "previous");
      }

      const res = await fetch(`/api/analytics?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Không thể tải dữ liệu phân tích");
        setEnvelope(null);
        return;
      }
      setEnvelope(json as AnalyticsEnvelope<unknown>);
    } catch {
      setError("Lỗi kết nối khi tải dữ liệu phân tích");
      setEnvelope(null);
    } finally {
      setLoading(false);
    }
  }, [section, preset, customFrom, customTo, comparePrevious]);

  useEffect(() => {
    if (preset === "custom" && (!customFrom || !customTo)) return;
    void fetchAnalytics();
  }, [fetchAnalytics, preset, customFrom, customTo]);

  const handleExportCsv = () => {
    if (!envelope) return;
    const csv = buildAnalyticsCsv({ section, envelope });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fc-gonoi-analytics-${section}-${envelope.period.from}_${envelope.period.to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <Card tone="navy">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gold-400" />
              <h2 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-wide text-white">
                Thống kê &amp; Phân tích CLB
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Trung tâm chỉ số gắn kết, hiệu suất trận đấu, tài chính minh bạch và analytics nội bộ (múi giờ Asia/Ho_Chi_Minh).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void fetchAnalytics()}
              disabled={loading}
              aria-label="Làm mới dữ liệu phân tích"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </Button>
            <Button
              variant="gold"
              size="sm"
              onClick={handleExportCsv}
              disabled={!envelope || !envelope.enabled || !envelope.data}
            >
              <Download className="h-4 w-4" />
              <span>Xuất CSV</span>
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 pt-4 border-t border-white/15 flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <label
              htmlFor="analytics-preset-select"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1"
            >
              <Filter className="h-3 w-3 inline mr-1" />
              Khoảng thời gian
            </label>
            <Select
              id="analytics-preset-select"
              value={preset}
              onChange={(e) => setPreset(e.target.value as AnalyticsPreset)}
              className="bg-navy-800 text-white border-white/20"
            >
              <option value="30d">30 ngày gần nhất</option>
              <option value="90d">90 ngày gần nhất</option>
              <option value="12m">12 tháng gần nhất</option>
              <option value="ytd">Từ đầu năm nay</option>
              <option value="all">Toàn thời gian</option>
              <option value="custom">Tùy chỉnh từ/đến</option>
            </Select>
          </div>

          {preset === "custom" && (
            <>
              <div>
                <label
                  htmlFor="analytics-from-date"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Từ ngày
                </label>
                <Input
                  id="analytics-from-date"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-navy-800 text-white border-white/20"
                />
              </div>
              <div>
                <label
                  htmlFor="analytics-to-date"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Đến ngày
                </label>
                <Input
                  id="analytics-to-date"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-navy-800 text-white border-white/20"
                />
              </div>
            </>
          )}

          <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer min-h-10 px-2">
            <input
              type="checkbox"
              checked={comparePrevious}
              onChange={(e) => setComparePrevious(e.target.checked)}
              className="h-4 w-4 accent-[#d4af37] rounded"
            />
            <span>So sánh với kỳ liền trước</span>
          </label>

          {envelope && (
            <div className="ml-auto text-xs text-slate-300 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gold-400" />
              <span className="tabular-nums">
                {envelope.period.from} → {envelope.period.to}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Sub-navigation */}
      <nav aria-label="Phân hệ Thống kê & Phân tích" className="flex flex-wrap gap-2">
        {SECTION_TABS.map((t) => {
          const Icon = t.icon;
          const active = section === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition min-h-10 cursor-pointer ${
                active
                  ? "bg-navy-800 text-gold-300 border border-gold-500/40 shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* States */}
      {loading && <LoadingState label="Đang tổng hợp dữ liệu phân tích..." />}
      {!loading && error && (
        <ErrorState title="Không thể tải Analytics" description={error} onRetry={fetchAnalytics} />
      )}
      {!loading && !error && envelope && !envelope.enabled && (
        <EmptyState
          icon={<ShieldCheck className="h-7 w-7 text-slate-500" />}
          title="Analytics đang tắt theo Feature Flag"
          description="Biến môi trường ANALYTICS_ENABLED chưa được bật (mặc định OFF để bảo đảm an toàn trước khi chạy migration trên Staging/Production)."
        />
      )}

      {/* Coverage Banner */}
      {!loading && !error && envelope && envelope.enabled && (
        <Card tone="subtle" className="p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={envelope.coverage.isLowCoverage ? "warning" : "success"}>
                {envelope.coverage.isLowCoverage
                  ? "Dữ liệu chưa đầy đủ"
                  : "Độ phủ đạt ngưỡng tin cậy (>=95%)"}
              </Badge>
              <span className="text-slate-700 font-medium tabular-nums">
                Độ phủ: {fmtPct(envelope.coverage.rate)} ({envelope.coverage.knownRecords}/
                {envelope.coverage.eligibleRecords})
              </span>
              {envelope.coverage.baselineAt && (
                <span className="text-slate-500">
                  • Baseline: {envelope.coverage.baselineAt.slice(0, 10)}
                </span>
              )}
            </div>
            {envelope.coverage.limitations.length > 0 && (
              <div className="text-amber-800 flex items-center gap-1">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>{envelope.coverage.limitations[0]}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* SECTION 1: OVERVIEW */}
      {!loading && !error && envelope?.enabled && section === "overview" && envelope.data != null && (() => {
        const d = envelope.data as OverviewAnalyticsData;
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <StatCard
                label="Cầu thủ hoạt động"
                value={String(d.clubHealth.activePlayers)}
                hint={`Tạm nghỉ: ${d.clubHealth.pausedPlayers} • Ngừng: ${d.clubHealth.stoppedPlayers}`}
                accent="navy"
              />
              <StatCard
                label="Tỷ lệ ra sân (Attendance)"
                value={fmtPct(d.clubHealth.teamAttendanceRate)}
                hint={`Độ phủ: ${fmtPct(d.clubHealth.attendanceCoverage)}${
                  envelope.comparison && d.comparisonSummary
                    ? ` • So kỳ trước: ${fmtDeltaPp(d.comparisonSummary.attendanceRateDeltaPp)}`
                    : ""
                }`}
                accent="emerald"
              />
              <StatCard
                label="Trận hoàn thành & Win Rate"
                value={`${d.matchPerformance.completedMatches} trận (${fmtPct(d.matchPerformance.winRate)})`}
                hint={`W ${d.matchPerformance.wins} - D ${d.matchPerformance.draws} - L ${d.matchPerformance.losses}`}
                accent="gold"
              />
              <StatCard
                label="Cân đối thu-chi trong kỳ"
                value={formatVND(d.finance.operatingBalance)}
                hint={`Quỹ lũy kế: ${formatVND(d.finance.cumulativeBalance)}`}
                accent={d.finance.operatingBalance >= 0 ? "emerald" : "rose"}
              />
              <StatCard
                label="Tỷ lệ thu quỹ trận"
                value={fmtPct(d.finance.collectionRate)}
                hint={
                  envelope.comparison && d.comparisonSummary
                    ? `So kỳ trước: ${fmtDeltaPp(d.comparisonSummary.collectionRateDeltaPp)}`
                    : "Mandatory collected / expected"
                }
                accent="navy"
              />
              <StatCard
                label="Công nợ quỹ trận (Manager)"
                value={formatVND(d.finance.outstandingDebt)}
                hint="Chỉ tính cầu thủ đã ra sân nhưng chưa nộp"
                accent={d.finance.outstandingDebt > 0 ? "rose" : "emerald"}
              />
            </div>

            {/* Smart Insights */}
            <Card>
              <h3 className="font-display text-base sm:text-lg font-extrabold uppercase tracking-wide text-navy-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Nhận định điều hành (Rule-based Smart Insights)
              </h3>
              {d.insights.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Không phát hiện bất thường đáng kể trong kỳ hiện tại.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {d.insights.map((ins) => (
                    <div
                      key={ins.id}
                      className={`rounded-lg border p-3.5 flex flex-col justify-between gap-2 ${
                        ins.severity === "warning"
                          ? "bg-amber-50/70 border-amber-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Badge variant={ins.severity === "warning" ? "warning" : "info"}>
                            {ins.metricKey}
                          </Badge>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            Bằng chứng: {ins.evidenceCount}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-navy-900">{ins.title}</p>
                        <p className="text-xs text-slate-700 mt-1">{ins.description}</p>
                      </div>
                      {onNavigateTab && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onNavigateTab(ins.targetTab)}
                          className="self-start"
                        >
                          <span>{ins.actionLabel}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Trends Table & Visual Bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <h3 className="text-sm font-bold uppercase tracking-wide text-navy-900 mb-3">
                  Xu hướng chuyên cần theo tháng
                </h3>
                {d.trends.attendanceByMonth.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có dữ liệu trận hoàn thành trong kỳ.</p>
                ) : (
                  <div className="space-y-2.5">
                    {d.trends.attendanceByMonth.map((pt) => {
                      const pct = pt.attendanceRate !== null ? Math.round(pt.attendanceRate * 100) : 0;
                      return (
                        <div key={pt.periodKey} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium text-slate-700 tabular-nums">
                            <span>{pt.label}</span>
                            <span>
                              {pt.attended} lượt ra sân ({fmtPct(pt.attendanceRate)})
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="text-sm font-bold uppercase tracking-wide text-navy-900 mb-3">
                  Dòng tiền Thu / Chi theo tháng
                </h3>
                {d.trends.cashflowByMonth.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có giao dịch thu/chi trong kỳ.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-500">
                          <th className="py-1.5 pr-2">Tháng</th>
                          <th className="py-1.5 pr-2 text-right">Thu</th>
                          <th className="py-1.5 pr-2 text-right">Chi</th>
                          <th className="py-1.5 text-right">Chênh lệch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 tabular-nums">
                        {d.trends.cashflowByMonth.map((c) => (
                          <tr key={c.periodKey}>
                            <td className="py-1.5 pr-2 font-semibold text-navy-900">{c.label}</td>
                            <td className="py-1.5 pr-2 text-right text-emerald-700">{formatVND(c.income)}</td>
                            <td className="py-1.5 pr-2 text-right text-rose-700">{formatVND(c.expense)}</td>
                            <td className="py-1.5 text-right font-bold">{formatVND(c.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </div>
        );
      })()}

      {/* SECTION 2: MATCHES */}
      {!loading && !error && envelope?.enabled && section === "matches" && envelope.data != null && (() => {
        const d = envelope.data as MatchPerformanceMetrics;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Hoàn thành / Có tỷ số" value={`${d.completedMatches} / ${d.scoredMatches}`} accent="navy" />
              <StatCard label="Thắng - Hòa - Thua" value={`${d.wins}-${d.draws}-${d.losses}`} hint={`Win rate: ${fmtPct(d.winRate)}`} accent="emerald" />
              <StatCard label="Hiệu số bàn thắng" value={`${d.goalsFor} : ${d.goalsAgainst}`} hint={`Hiệu số: ${d.goalDifference >= 0 ? "+" : ""}${d.goalDifference}`} accent="gold" />
              <StatCard label="Chi phí / lượt ra sân" value={d.costPerAttendee !== null ? formatVND(d.costPerAttendee) : "—"} hint={`${d.missingCostMatches} trận chưa nhập chi phí`} accent="sky" />
            </div>

            <Card>
              <h3 className="text-sm font-bold uppercase tracking-wide text-navy-900 mb-3">
                Chi tiết từng trận trong kỳ
              </h3>
              {d.matches.length === 0 ? (
                <p className="text-xs text-slate-500">Không có trận đấu trong khoảng thời gian này.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-2 pr-3">Ngày</th>
                        <th className="py-2 pr-3">Trận / Đối thủ</th>
                        <th className="py-2 pr-3">Tỷ số</th>
                        <th className="py-2 pr-3 text-right">RSVP / Ra sân</th>
                        <th className="py-2 pr-3 text-right">Chi phí</th>
                        <th className="py-2 text-right">Cảnh báo dữ liệu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 tabular-nums">
                      {d.matches.map((m) => (
                        <tr key={m.id}>
                          <td className="py-2 pr-3 whitespace-nowrap">{m.matchDate}</td>
                          <td className="py-2 pr-3">
                            <span className="font-semibold text-navy-900">{m.label}</span>
                            <span className="text-slate-500 block">{m.opponent}</span>
                          </td>
                          <td className="py-2 pr-3">
                            {m.teamScore !== null && m.opponentScore !== null ? (
                              <Badge variant={m.result === "W" ? "success" : m.result === "L" ? "danger" : "neutral"}>
                                {m.teamScore} - {m.opponentScore} ({m.result})
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {m.rsvpCount} / <span className="font-bold">{m.attendeesCount}</span>
                          </td>
                          <td className="py-2 pr-3 text-right">{formatVND(m.expense)}</td>
                          <td className="py-2 text-right">
                            {m.hasMissingScore && <Badge variant="warning">Thiếu tỷ số</Badge>}
                            {!m.hasMissingScore && m.hasMissingCost && <Badge variant="warning">Thiếu chi phí</Badge>}
                            {!m.hasMissingScore && !m.hasMissingCost && <span className="text-emerald-700">Đủ</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        );
      })()}

      {/* SECTION 3: ENGAGEMENT */}
      {!loading && !error && envelope?.enabled && section === "engagement" && envelope.data != null && (() => {
        const d = envelope.data as EngagementMetrics;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Phản hồi RSVP" value={fmtPct(d.clubHealth.rsvpResponseRate)} hint={`${d.clubHealth.rsvpRespondedSlots}/${d.clubHealth.eligibleSlots} lượt`} accent="navy" />
              <StatCard label="RSVP Tích cực" value={fmtPct(d.clubHealth.rsvpPositiveRate)} hint={`Ra sân sau RSVP: ${fmtPct(d.clubHealth.attendanceAfterPositiveRsvp)}`} accent="emerald" />
              <StatCard label="Retention 30 ngày" value={d.retention30d.available ? fmtPct(d.retention30d.rate) : "Chưa đủ dữ liệu"} hint={`Cohort đủ tuổi: ${d.retention30d.eligibleCohortSize}`} accent="gold" />
              <StatCard label="MAU Thành viên" value={`${d.monthlyActivePlayers} C.Thủ / ${d.monthlyActiveManagers} BQL`} hint="Aggregate ẩn danh server-side" accent="sky" />
            </div>

            <Card>
              <h3 className="text-sm font-bold uppercase tracking-wide text-navy-900 mb-2">
                Phân bổ trạng thái thành viên cuối kỳ &amp; Độ phủ
              </h3>
              <p className="text-xs text-slate-600 mb-3">
                Chỉ số chỉ tính các slot có lịch sử hợp lệ; các slot thiếu row attendance ({d.clubHealth.missingAttendanceSlots}) không bị quy đổi thành vắng mặt.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">Đang sinh hoạt: {d.clubHealth.activePlayers}</Badge>
                <Badge variant="warning">Tạm nghỉ: {d.clubHealth.pausedPlayers}</Badge>
                <Badge variant="danger">Ngừng tham gia: {d.clubHealth.stoppedPlayers}</Badge>
                <Badge variant="neutral">Không xác định: {d.clubHealth.unknownPlayers}</Badge>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* SECTION 4: FINANCE */}
      {!loading && !error && envelope?.enabled && section === "finance" && envelope.data != null && (() => {
        const d = envelope.data as FinanceAnalyticsMetrics;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Tổng thu trong kỳ" value={formatVND(d.totalIncome)} hint={`Quỹ trận: ${formatVND(d.matchIncome)}`} accent="emerald" />
              <StatCard label="Tổng chi vận hành" value={formatVND(d.operatingExpense)} hint={d.averageMatchCost !== null ? `TB/trận: ${formatVND(d.averageMatchCost)}` : undefined} accent="rose" />
              <StatCard label="Đóng góp tự nguyện" value={formatVND(d.voluntaryContribution)} hint={`${d.voluntaryCount} lượt vắng tự nguyện đóng`} accent="gold" />
              <StatCard label="Thu gắn Tài trợ / Chưa phân bổ" value={formatVND(d.sponsorAttributedIncome)} hint={`Chưa phân bổ: ${formatVND(d.unattributedOtherIncome)}`} accent="navy" />
            </div>

            <Card>
              <h3 className="text-sm font-bold uppercase tracking-wide text-navy-900 mb-3">
                Cơ cấu chi phí vận hành
              </h3>
              {d.expenseBreakdown.length === 0 ? (
                <p className="text-xs text-slate-500">Không có khoản chi trong kỳ.</p>
              ) : (
                <div className="space-y-2">
                  {d.expenseBreakdown.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium tabular-nums">
                        <span>{cat.category}</span>
                        <span>
                          {formatVND(cat.amount)} ({cat.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded bg-slate-100 overflow-hidden">
                        <div className="h-full bg-navy-600 rounded" style={{ width: `${Math.min(100, cat.percentage)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        );
      })()}

      {/* SECTION 5: SPONSORS & COMMUNITY */}
      {!loading && !error && envelope?.enabled && section === "sponsors" && envelope.data != null && (() => {
        const d = envelope.data as SponsorCommunityMetrics;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Impressions Tài trợ" value={String(d.totalImpressions)} accent="navy" />
              <StatCard label="Clicks Tài trợ" value={String(d.totalClicks)} hint={`CTR: ${fmtPct(d.overallCtr)}`} accent="gold" />
              <StatCard label="Thu gắn Tài trợ" value={formatVND(d.sponsorAttributedIncome)} hint={`Chưa phân bổ: ${formatVND(d.unattributedOtherIncome)}`} accent="emerald" />
              <StatCard label="Lượt xem Bài viết" value={String(d.totalPostViews)} accent="sky" />
            </div>

            <Card>
              <h3 className="text-sm font-bold uppercase tracking-wide text-navy-900 mb-3">
                Hiệu quả hiển thị &amp; đóng góp theo Nhà tài trợ
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-3">Nhà tài trợ</th>
                      <th className="py-2 pr-3">Hạng</th>
                      <th className="py-2 pr-3 text-right">Impressions</th>
                      <th className="py-2 pr-3 text-right">Clicks</th>
                      <th className="py-2 pr-3 text-right">CTR</th>
                      <th className="py-2 text-right">Thu gắn tài trợ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {d.sponsors.map((s) => (
                      <tr key={s.sponsorId}>
                        <td className="py-2 pr-3 font-semibold text-navy-900">{s.name}</td>
                        <td className="py-2 pr-3 uppercase">{s.tier}</td>
                        <td className="py-2 pr-3 text-right">{s.impressions}</td>
                        <td className="py-2 pr-3 text-right">{s.clicks}</td>
                        <td className="py-2 pr-3 text-right">{fmtPct(s.ctr)}</td>
                        <td className="py-2 text-right font-semibold">{formatVND(s.attributedIncome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* SECTION 6: PRODUCT ANALYTICS */}
      {!loading && !error && envelope?.enabled && section === "product" && envelope.data != null && (() => {
        const d = envelope.data as ProductAnalyticsMetrics;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Page Views" value={String(d.totalPageViews)} hint={`Tổng events: ${d.totalEvents}`} accent="navy" />
              <StatCard label="RSVP Funnel" value={`${d.rsvpFunnel.submitSuccesses}/${d.rsvpFunnel.flowOpens}`} hint={`Chuyển đổi: ${fmtPct(d.rsvpFunnel.conversionRate)}`} accent="emerald" />
              <StatCard label="Xem Hồ sơ / Bài viết" value={`${d.totalProfileViews} / ${d.totalPostViews}`} accent="gold" />
              <StatCard label="MAU (Ẩn danh)" value={`${d.monthlyActivePlayers} C.Thủ / ${d.monthlyActiveManagers} BQL`} accent="sky" />
            </div>

            <Card>
              <h3 className="text-sm font-bold uppercase tracking-wide text-navy-900 mb-3">
                Lượt xem theo nhóm tuyến đường (Route Group Allowlist)
              </h3>
              {d.routeViews.length === 0 ? (
                <p className="text-xs text-slate-500">Chưa có event page_view trong kỳ.</p>
              ) : (
                <div className="space-y-2">
                  {d.routeViews.map((rv) => (
                    <div key={rv.routeKey} className="flex justify-between text-xs border-b border-slate-100 py-1.5 tabular-nums">
                      <code className="font-mono text-navy-800">{rv.routeKey}</code>
                      <span className="font-bold">{rv.views} lượt</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        );
      })()}
    </div>
  );
}
