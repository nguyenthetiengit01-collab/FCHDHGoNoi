"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Trophy,
  QrCode,
  Calendar,
  Award,
  AlertCircle,
  ArrowRight,
  Copy,
  Download,
  BarChart3,
  Clock,
  CheckCircle2,
  HeartHandshake,
  Receipt,
  Info,
} from "lucide-react";
import type { FullAppData } from "@/types/app";
import { OFFICIAL_LOGO_URL, OFFICIAL_QR_URL } from "@/types/app";
import { formatVND, formatShortVND, formatDateVN } from "@/lib/format";
import {
  calculatePlayerAttendanceStats,
  formatAttendanceRate,
  getMatchStatistics,
  getPlayerStatistics,
} from "@/lib/teamStatistics";
import {
  buildCashflowSeries,
  buildCollectionIntelligence,
  buildManagementInsights,
  buildMatchAnalytics,
  buildRecentTransactions,
} from "@/lib/dashboardIntelligence";
import { ModalDialog } from "./ModalDialog";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  PositionBadge,
  StatCard,
} from "./ui";

interface DashboardTabProps {
  data: FullAppData;
  onNavigateTab: (tab: "schedule" | "matrix" | "players" | "finance") => void;
  onGoToCollection?: () => void;
}

export function DashboardTab({
  data,
  onNavigateTab,
  onGoToCollection,
}: DashboardTabProps) {
  const { settings, summary, players, matches, attendances, expenses } = data;
  const playerStats = useMemo(
    () => data.statistics?.players ?? getPlayerStatistics(players),
    [data.statistics?.players, players]
  );
  const matchStats = useMemo(
    () => data.statistics?.matches ?? getMatchStatistics(matches),
    [data.statistics?.matches, matches]
  );

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [qrAmount] = useState<number>(settings.default_match_fee || 100000);
  const [qrMatchLabel, setQrMatchLabel] = useState<string>(
    matches[matches.length - 1]?.label || "Quỹ trận tuần"
  );
  const [copiedNote, setCopiedNote] = useState(false);

  // Interactive Cashflow controls
  const [chartMode, setChartMode] = useState<"match" | "month">("match");
  const [chartRange, setChartRange] = useState<number>(12);
  const [selectedPointKey, setSelectedPointKey] = useState<string | null>(null);

  const cashflow = useMemo(
    () =>
      buildCashflowSeries(
        data,
        chartMode,
        chartRange > 0 ? chartRange : undefined
      ),
    [data, chartMode, chartRange]
  );

  const collection = useMemo(() => buildCollectionIntelligence(data), [data]);
  const recentTransactions = useMemo(
    () => buildRecentTransactions(data, 8),
    [data]
  );
  const matchAnalytics = useMemo(() => buildMatchAnalytics(data), [data]);
  const insights = useMemo(
    () =>
      buildManagementInsights(
        data,
        matchAnalytics,
        collection,
        Boolean(onGoToCollection)
      ),
    [data, matchAnalytics, collection, onGoToCollection]
  );

  const activePoint = useMemo(() => {
    if (cashflow.points.length === 0) return null;
    return (
      cashflow.points.find((p) => p.key === selectedPointKey) ??
      cashflow.points[cashflow.points.length - 1]
    );
  }, [cashflow.points, selectedPointKey]);

  const maxBarValue = useMemo(
    () =>
      Math.max(
        100000,
        ...cashflow.points.map((p) =>
          Math.max(p.actualIncome, p.expense, p.unpaidDebt)
        )
      ),
    [cashflow.points]
  );

  const playerLeaderboard = useMemo(() => {
    return players
      .map((p) => {
        const pAtt = attendances.filter((a) => a.player_id === p.id);
        const attStats = calculatePlayerAttendanceStats(p.id, matches, attendances);
        const totalPaid = pAtt
          .filter((a) => a.paid === 1)
          .reduce((s, a) => s + a.amount, 0);
        const unpaid = pAtt
          .filter((a) => a.attended === 1 && a.paid === 0)
          .reduce((s, a) => s + a.amount, 0);
        const voluntaryContributions = pAtt
          .filter((a) => a.attended === 0 && a.paid === 1)
          .reduce((s, a) => s + a.amount, 0);
        return {
          ...p,
          matchesPlayed: attStats.matchesPlayed,
          eligibleMatchesCount: attStats.eligibleMatchesCount,
          totalPaid,
          unpaid,
          voluntaryContributions,
          attendanceRate: attStats.attendanceRate,
        };
      })
      .sort(
        (a, b) => b.totalPaid - a.totalPaid || b.matchesPlayed - a.matchesPlayed
      );
  }, [players, attendances, matches]);

  const selectedPlayer = players.find(
    (p) => String(p.id) === selectedPlayerId
  );
  const qrNote = selectedPlayer
    ? `${selectedPlayer.short_name} #${selectedPlayer.jersey_number ?? ""} dong quy ${qrMatchLabel}`
    : `Dong quy ${qrMatchLabel} FC HDH Go Noi`;

  const handleInsightNavigate = (
    target: "schedule" | "matrix" | "finance" | "collection"
  ) => {
    if (target === "collection") {
      if (onGoToCollection) {
        onGoToCollection();
      } else {
        onNavigateTab("matrix");
      }
      return;
    }
    onNavigateTab(target);
  };

  return (
    <div className="space-y-6">
      {/* 1. Banner Điều Hành CLB */}
      <section className="rounded-xl bg-gradient-to-br from-[#092244] via-[#0d2e5b] to-[#17488c] text-white p-5 sm:p-6 shadow-sm border border-[#d4af37]/40">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-white p-1 border-2 border-[#d4af37] shrink-0 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Logo FC HĐH Gò Nổi"
                className="h-full w-full object-contain rounded-lg"
              />
            </div>
            <div>
              <div className="inline-flex flex-wrap items-center gap-2 rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold text-[#fde047] border border-white/15">
                <span>{settings.short_name}</span>
                <span className="text-white/40">•</span>
                <span>Xã Gò Nổi • TP. Đà Nẵng</span>
                <span className="text-white/40">•</span>
                <span className="tabular-nums">{playerStats.total} Thành viên</span>
                <span className="text-white/40">•</span>
                <span className="tabular-nums">{matchStats.total} Trận</span>
              </div>
              <h2 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                {settings.team_name}{" "}
                <span className="text-[#fde047] text-sm sm:text-base font-bold">
                  • Tại TP.HCM
                </span>
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-sky-100/80">
                Trung tâm điều hành tài chính minh bạch, chuyên cần & lịch thi đấu
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="gold"
              onClick={() => setQrModalOpen(true)}
              leftIcon={<QrCode className="h-4 w-4" />}
              className="min-h-11 sm:min-h-10"
            >
              Mã QR Đóng Quỹ
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigateTab("schedule")}
              leftIcon={<Calendar className="h-4 w-4 text-[#fde047]" />}
              className="min-h-11 sm:min-h-10 !bg-white/10 !text-white !border-white/25 hover:!bg-white/20"
            >
              Lịch & Điểm Danh
            </Button>
            {onGoToCollection && (
              <Button
                variant="outline"
                onClick={onGoToCollection}
                leftIcon={<Wallet className="h-4 w-4 text-emerald-300" />}
                className="min-h-11 sm:min-h-10 !bg-emerald-500/20 !text-white !border-emerald-300/40 hover:!bg-emerald-500/30"
              >
                Thu Tiền Trận
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 2. KPI Tổng Quan Tài Chính (Tách biệt hoàn toàn Quỹ Sinh Hoạt & Quỹ Dự Phòng) */}
      <section
        aria-label="Tổng hợp tài chính đội bóng"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5"
      >
        <StatCard
          label="Tổng Thu Quỹ Đội"
          value={formatVND(summary.totalIncome)}
          hint={`Thu trận ${formatShortVND(summary.totalMatchIncome)} • Thu khác ${formatShortVND(summary.totalOtherIncome)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="emerald"
        />
        <StatCard
          label="Tổng Chi Tiêu"
          value={formatVND(summary.totalExpense)}
          hint={`${expenses.length} phiếu chi đã ghi nhận`}
          icon={<TrendingDown className="h-4 w-4" />}
          accent="rose"
        />
        <StatCard
          label="Tồn Quỹ Sinh Hoạt"
          value={formatVND(summary.currentBalance)}
          hint={`Thu (${formatShortVND(summary.totalIncome)}) − Chi (${formatShortVND(summary.totalExpense)})`}
          icon={<Wallet className="h-4 w-4" />}
          accent="navy"
        />
        <StatCard
          label="Quỹ Dự Phòng Giải Đấu"
          value={formatVND(settings.tournament_fund_reserve)}
          hint={
            settings.tournament_fund_note ||
            "Theo dõi tách riêng • Không gộp quỹ sinh hoạt"
          }
          icon={<Trophy className="h-4 w-4" />}
          accent="gold"
        />
      </section>

      {/* 3. Management Insights (Chỉ hiển thị thông tin xác minh được từ dữ liệu thật) */}
      {insights.length > 0 && (
        <section aria-label="Thông tin cần lưu ý cho Ban Quản Lý">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {insights.slice(0, 3).map((item) => (
              <div
                key={item.id}
                role={item.severity === "warning" ? "status" : undefined}
                className={`rounded-xl border p-3.5 flex items-start justify-between gap-3 ${item.severity === "warning"
                    ? "bg-amber-50/90 border-amber-300 text-amber-950"
                    : "bg-sky-50/80 border-sky-200 text-slate-900"
                  }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {item.severity === "warning" ? (
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs opacity-80 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleInsightNavigate(item.targetTab)}
                  className="shrink-0 text-xs font-bold text-[#0d2e5b] hover:text-[#17488c] underline cursor-pointer whitespace-nowrap"
                >
                  {item.actionLabel} →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Financial Intelligence: Biến động Thu/Chi & Cơ cấu Chi tiêu */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 4A. Biến động thu chi theo trận hoặc theo tháng */}
        <Card className="lg:col-span-7 space-y-4">
          <CardHeader>
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#0d2e5b]" />
                <CardTitle>Biến Động Thu Chi & Công Nợ</CardTitle>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {chartMode === "match"
                  ? "Theo trận: chỉ tính chi phí gắn theo trận • Thu trận theo ngày thi đấu (chưa lưu ngày thu thực tế)"
                  : "Theo tháng: gồm toàn bộ thu/chi hợp lệ trong tháng (kể cả chi phí ngoài trận) • Thu trận phân bổ theo tháng thi đấu (chưa lưu ngày thu thực tế), thu khác và chi tiêu theo ngày ghi nhận"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setChartMode("match");
                    setSelectedPointKey(null);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${chartMode === "match"
                      ? "bg-[#0d2e5b] text-white"
                      : "text-slate-600 hover:text-[#092244]"
                    }`}
                >
                  Theo trận
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChartMode("month");
                    setSelectedPointKey(null);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${chartMode === "month"
                      ? "bg-[#0d2e5b] text-white"
                      : "text-slate-600 hover:text-[#092244]"
                    }`}
                >
                  Theo tháng
                </button>
              </div>

              <select
                aria-label="Chọn khoảng dữ liệu biểu đồ"
                value={chartRange}
                onChange={(e) => {
                  setChartRange(Number(e.target.value));
                  setSelectedPointKey(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-[#092244]"
              >
                <option value={6}>
                  {chartMode === "match" ? "6 trận gần nhất" : "6 tháng gần nhất"}
                </option>
                <option value={12}>
                  {chartMode === "match"
                    ? "12 trận gần nhất"
                    : "12 tháng gần nhất"}
                </option>
                <option value={0}>Tất cả dữ liệu</option>
              </select>
            </div>
          </CardHeader>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-[#0d2e5b]">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#0d2e5b]" />
                Thực thu
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#8a6d14]">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#d4af37]" />
                Chi tiêu
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-700">
                <span className="h-2.5 w-2.5 rounded-xs bg-rose-400" />
                Chưa thu (Nợ)
              </span>
            </div>
            {!cashflow.hasEnoughTrendData && cashflow.points.length > 0 && (
              <span className="text-[11px] font-medium text-slate-500">
                Chưa đủ nhiều kỳ để phân tích xu hướng
              </span>
            )}
          </div>

          {cashflow.points.length === 0 ? (
            <EmptyState
              title="Chưa có dữ liệu thu chi"
              description="Khi có dữ liệu trận đấu hoặc phiếu thu chi, biểu đồ sẽ hiển thị tự động."
            />
          ) : (
            <>
              <div className="overflow-x-auto pb-2">
                <div
                  className="flex items-end gap-2 h-52 pt-4 px-1"
                  style={{
                    minWidth: `${Math.max(460, cashflow.points.length * 46)}px`,
                  }}
                >
                  {cashflow.points.map((pt) => {
                    const incPct = Math.round(
                      (pt.actualIncome / maxBarValue) * 100
                    );
                    const expPct = Math.round((pt.expense / maxBarValue) * 100);
                    const debtPct = Math.round(
                      (pt.unpaidDebt / maxBarValue) * 100
                    );
                    const isSelected = activePoint?.key === pt.key;

                    return (
                      <button
                        key={pt.key}
                        type="button"
                        onMouseEnter={() => setSelectedPointKey(pt.key)}
                        onFocus={() => setSelectedPointKey(pt.key)}
                        onClick={() => setSelectedPointKey(pt.key)}
                        aria-label={`${pt.fullLabel}: Thực thu ${formatVND(pt.actualIncome)}, Chi ${formatVND(pt.expense)}, Chưa thu ${formatVND(pt.unpaidDebt)}`}
                        className={`flex-1 min-w-[38px] flex flex-col items-center h-full justify-end rounded-lg px-1 py-1 transition cursor-pointer ${isSelected
                            ? "bg-[#0d2e5b]/[0.06] ring-1 ring-[#0d2e5b]/25"
                            : "hover:bg-slate-50"
                          }`}
                      >
                        <div className="w-full flex items-end justify-center gap-0.5 h-36 border-b border-slate-200 px-0.5">
                          <div
                            className="w-2.5 bg-[#0d2e5b] rounded-t transition-all"
                            style={{
                              height: `${pt.actualIncome > 0 ? Math.max(5, incPct) : 0}%`,
                            }}
                          />
                          <div
                            className="w-2.5 bg-[#d4af37] rounded-t transition-all"
                            style={{
                              height: `${pt.expense > 0 ? Math.max(5, expPct) : 0}%`,
                            }}
                          />
                          {pt.unpaidDebt > 0 && (
                            <div
                              className="w-2 bg-rose-400 rounded-t transition-all"
                              style={{ height: `${Math.max(5, debtPct)}%` }}
                            />
                          )}
                        </div>
                        <div className="mt-1.5 text-[11px] font-bold text-[#092244] whitespace-nowrap">
                          {pt.label}
                        </div>
                        <div
                          className={`text-[10px] font-semibold tabular-nums whitespace-nowrap ${pt.net >= 0 ? "text-emerald-700" : "text-rose-600"
                            }`}
                        >
                          {pt.net >= 0
                            ? `+${formatShortVND(pt.net)}`
                            : formatShortVND(pt.net)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activePoint && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-[#092244]">
                    {activePoint.fullLabel}
                  </span>
                  <div className="flex flex-wrap items-center gap-4 tabular-nums">
                    <span className="text-emerald-700 font-bold">
                      Thực thu: {formatVND(activePoint.actualIncome)}
                    </span>
                    <span className="text-rose-600 font-bold">
                      Chi: {formatVND(activePoint.expense)}
                    </span>
                    <span className="text-amber-700 font-bold">
                      Chưa thu: {formatVND(activePoint.unpaidDebt)}
                    </span>
                    <span
                      className={`font-extrabold ${activePoint.net >= 0
                          ? "text-emerald-700"
                          : "text-rose-600"
                        }`}
                    >
                      Ròng: {activePoint.net >= 0 ? "+" : ""}
                      {formatVND(activePoint.net)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* 4B. Cơ cấu chi tiêu */}
        <Card className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <CardHeader>
              <div>
                <CardTitle>Cơ Cấu Chi Tiêu Theo Hạng Mục</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Phân bổ theo {summary.categoryBreakdown.length} nhóm chi tiêu thực tế
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("finance")}
                className="text-xs font-bold text-[#0d2e5b] hover:text-[#17488c] inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Sổ chi</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </CardHeader>

            <div className="space-y-3">
              {summary.categoryBreakdown.map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => onNavigateTab("finance")}
                  className="w-full text-left space-y-1.5 rounded-lg p-1.5 -mx-1.5 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#092244]">
                      {item.category}
                    </span>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="font-bold text-[#0d2e5b]">
                        {formatVND(item.amount)}
                      </span>
                      <span className="w-12 text-right text-xs font-semibold text-slate-500">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${item.category === "Tiền sân"
                          ? "bg-[#0d2e5b]"
                          : item.amount > 0
                            ? "bg-[#d4af37]"
                            : "bg-slate-200"
                        }`}
                      style={{
                        width: `${Math.max(
                          item.amount > 0 ? 4 : 0,
                          item.percentage
                        )}%`,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200/80 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">
              Tổng chi tiêu quỹ sinh hoạt:
            </span>
            <span className="text-base font-extrabold tabular-nums text-rose-600">
              {formatVND(summary.totalExpense)}
            </span>
          </div>
        </Card>
      </div>

      {/* 4C + 5. Nguồn Thu & Collection Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Nguồn thu & Tình trạng đóng quỹ */}
        <Card className="lg:col-span-6 space-y-4">
          <CardHeader>
            <div>
              <CardTitle>Nguồn Thu & Tình Trạng Đóng Quỹ</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Phân tách thực thu, công nợ chưa thu và đóng góp tự nguyện
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onGoToCollection ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onGoToCollection}
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Mở Thu Quỹ
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigateTab("matrix")}
                  className="text-xs font-bold text-[#0d2e5b] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Bảng thu trận</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </CardHeader>

          {/* 4 chỉ số nguồn thu */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
              <span className="text-[11px] font-bold uppercase text-emerald-800 block">
                Thu tiền trận
              </span>
              <span className="mt-1 text-base sm:text-lg font-extrabold text-emerald-700 tabular-nums block">
                {formatVND(summary.totalMatchIncome)}
              </span>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3">
              <span className="text-[11px] font-bold uppercase text-sky-800 block">
                Thu khác & Tài trợ
              </span>
              <span className="mt-1 text-base sm:text-lg font-extrabold text-sky-700 tabular-nums block">
                {formatVND(summary.totalOtherIncome)}
              </span>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
              <span className="text-[11px] font-bold uppercase text-amber-800 block">
                Tiền trận chưa thu (Nợ)
              </span>
              <span className="mt-1 text-base sm:text-lg font-extrabold text-amber-900 tabular-nums block">
                {formatVND(collection.totalUnpaidAmount)}
              </span>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-3">
              <span className="text-[11px] font-bold uppercase text-purple-800 block">
                Đóng góp tự nguyện
              </span>
              <span className="mt-1 text-base sm:text-lg font-extrabold text-purple-800 tabular-nums block">
                {formatVND(collection.totalVoluntaryAmount)}
              </span>
            </div>
          </div>

          {/* Tách bạch lượt tham dự và lượt thanh toán */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between font-bold text-[#092244]">
              <span>Đối chiếu lượt tham dự & thanh toán</span>
              <span className="tabular-nums text-slate-600">
                {collection.totalAttendanceTurns} lượt ra sân thực tế
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ra sân • Đã đóng
                </span>
                <strong className="tabular-nums text-[#092244]">
                  {collection.paidAttendedTurns}
                </strong>
              </div>
              <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
                  <Clock className="h-3.5 w-3.5" />
                  Ra sân • Còn nợ
                </span>
                <strong className="tabular-nums text-rose-600">
                  {collection.unpaidAttendedTurns}
                </strong>
              </div>
              <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-purple-700 font-semibold">
                  <HeartHandshake className="h-3.5 w-3.5" />
                  Vắng • Tự nguyện
                </span>
                <strong className="tabular-nums text-purple-800">
                  {collection.voluntaryTurns}
                </strong>
              </div>
            </div>
          </div>

          {/* Danh sách cầu thủ còn nợ quỹ trận */}
          {collection.topDebtors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Cầu thủ có lượt ra sân chưa đóng quỹ</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab("matrix")}
                  className="text-[#0d2e5b] hover:underline cursor-pointer"
                >
                  Chi tiết công nợ →
                </button>
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {collection.topDebtors.slice(0, 4).map((d) => (
                  <div
                    key={d.playerId}
                    className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold text-[#092244] truncate">
                      #{d.jerseyNumber ?? "-"} {d.fullName}
                    </span>
                    <span className="shrink-0 tabular-nums font-bold text-rose-600">
                      {formatVND(d.unpaidAmount)} ({d.unpaidMatchesCount} trận)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* 4D. Lịch sử giao dịch gần đây */}
        <Card className="lg:col-span-6 space-y-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#0d2e5b]" />
              <div>
                <CardTitle>Lịch Sử Giao Dịch Gần Đây</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thu trận hiển thị theo ngày thi đấu (chưa lưu ngày thu thực tế); thu khác và chi tiêu theo ngày ghi nhận
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("finance")}
              className="text-xs font-bold text-[#0d2e5b] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </CardHeader>

          {recentTransactions.length === 0 ? (
            <EmptyState
              title="Chưa có giao dịch nào"
              description="Các giao dịch thu và chi gần đây sẽ hiển thị tại đây."
            />
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition text-xs sm:text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={
                          tx.type === "expense"
                            ? "danger"
                            : tx.type === "other_income"
                              ? "info"
                              : "success"
                        }
                      >
                        {tx.category}
                      </Badge>
                      <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                        {tx.type === "match_income"
                          ? `Ngày trận: ${formatDateVN(tx.date)}`
                          : formatDateVN(tx.date)}
                      </span>
                    </div>
                    <p className="font-semibold text-[#092244] truncate">
                      {tx.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {tx.actor}
                    </p>
                  </div>
                  <div
                    className={`shrink-0 font-extrabold tabular-nums text-right ${tx.isPositive ? "text-emerald-700" : "text-rose-600"
                      }`}
                  >
                    {tx.isPositive ? "+" : "-"}
                    {formatVND(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 6. Match Analytics & Bảng Vàng Chuyên Cần */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bảng Vàng Chuyên Cần & Đóng Quỹ */}
        <Card className="lg:col-span-7 space-y-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-[#d4af37]" />
              <div>
                <CardTitle>Bảng Vàng Chuyên Cần & Đóng Quỹ</CardTitle>
                <p className="text-xs text-slate-500">
                  Xếp hạng theo số trận ra sân thực tế và tổng quỹ đã đóng góp
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("players")}
              className="text-xs font-bold text-[#0d2e5b] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Đội hình</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </CardHeader>

          {playerLeaderboard.length === 0 ? (
            <EmptyState
              title="Chưa có dữ liệu cầu thủ"
              description="Danh sách cầu thủ sẽ hiển thị khi đội bóng có thành viên."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {playerLeaderboard.slice(0, 8).map((p, index) => (
                <div
                  key={p.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-extrabold tabular-nums ${index === 0
                          ? "bg-[#d4af37] text-[#092244]"
                          : index === 1
                            ? "bg-slate-200 text-slate-800"
                            : index === 2
                              ? "bg-amber-100 text-amber-900"
                              : "bg-slate-100 text-slate-600"
                        }`}
                    >
                      {index + 1}
                    </span>
                    <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden border border-[#0d2e5b]/30 bg-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.avatar_url || "/uploads/avatars/member-1.jpg"}
                        alt={p.full_name}
                        loading="lazy"
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-[#092244] truncate">
                          {p.full_name}
                        </p>
                        <span className="text-xs font-semibold text-slate-500 tabular-nums">
                          #{p.jersey_number ?? "-"}
                        </span>
                        <PositionBadge position={p.position} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tham gia{" "}
                        <strong className="text-slate-700 tabular-nums">
                          {p.matchesPlayed}/{p.eligibleMatchesCount} trận
                        </strong>{" "}
                        ({formatAttendanceRate(p.attendanceRate)})
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <p className="font-extrabold text-emerald-700">
                      {formatVND(p.totalPaid)}
                    </p>
                    {p.unpaid > 0 && (
                      <p className="text-xs font-semibold text-rose-600">
                        Chưa đóng: {formatVND(p.unpaid)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Hoạt động thi đấu: Trận sắp tới, Trận gần nhất & Lịch sử */}
        <Card className="lg:col-span-5 space-y-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#0d2e5b]" />
              <div>
                <CardTitle>Hoạt Động Thi Đấu</CardTitle>
                <p className="text-xs text-slate-500">
                  Trận sắp tới, trận gần nhất & lịch sử sân bãi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("schedule")}
              className="text-xs font-bold text-[#0d2e5b] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Lịch đấu</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </CardHeader>

          {matchAnalytics.upcomingMatch && (
            <div className="rounded-xl bg-[#092244] text-white p-3.5 border border-[#d4af37]/50 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="gold">Trận sắp tới</Badge>
                <span className="text-xs text-sky-200 tabular-nums">
                  {formatDateVN(matchAnalytics.upcomingMatch.match_date)} •{" "}
                  {matchAnalytics.upcomingMatch.kickoff_time}
                </span>
              </div>
              <p className="font-extrabold text-sm">
                {matchAnalytics.upcomingMatch.label} •{" "}
                {matchAnalytics.upcomingMatch.venue || "Chưa cập nhật sân"}
              </p>
              <div className="flex items-center justify-between text-xs text-sky-100 tabular-nums">
                <span>
                  Đã đăng ký:{" "}
                  <strong>
                    {matchAnalytics.upcomingMatch.registeredCount} cầu thủ
                  </strong>
                </span>
                <span>
                  Tiền sân:{" "}
                  {matchAnalytics.upcomingMatch.expense > 0
                    ? formatVND(matchAnalytics.upcomingMatch.expense)
                    : "Chưa nhập"}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {matchAnalytics.recentMatches.length === 0 ? (
              <EmptyState
                title="Chưa có trận đấu nào"
                description="Danh sách các trận đấu gần đây sẽ hiển thị sau khi tạo lịch thi đấu."
              />
            ) : (
              matchAnalytics.recentMatches.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-slate-200 p-3 hover:border-[#0d2e5b]/50 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-sm text-[#092244] truncate">
                        {m.label}
                      </span>
                      <Badge
                        variant={
                          m.status === "Đã kết thúc"
                            ? "success"
                            : m.status === "Đã hủy"
                              ? "danger"
                              : "info"
                        }
                      >
                        {m.status}
                      </Badge>
                    </div>
                    <span className="text-xs font-medium text-slate-500 tabular-nums shrink-0">
                      {formatDateVN(m.match_date)} • {m.kickoff_time}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-600 gap-2">
                    <span className="truncate">
                      <strong>{m.venue || "Chưa rõ sân"}</strong> •{" "}
                      {m.attendeesCount} ra sân ({m.paidCount} đã đóng)
                    </span>
                    <span className="shrink-0">
                      Chi sân: {m.payer_name || "—"}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs tabular-nums">
                    <span className="text-emerald-700 font-semibold">
                      Thu: {formatVND(m.collected)}
                    </span>
                    <span className="text-rose-600 font-semibold">
                      Sân: {formatVND(m.expense)}
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded ${m.net >= 0
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-rose-50 text-rose-700"
                        }`}
                    >
                      {m.net >= 0
                        ? `Dư +${formatShortVND(m.net)}`
                        : `Bù ${formatShortVND(m.net)}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Modal Mã QR Chính Thức của Thủ Quỹ NGUYEN THE TIENG */}
      <ModalDialog
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Mã QR Đóng Quỹ Đội Bóng — NGUYEN THE TIENG"
        subtitle="Quét mã QR chính thức bên dưới bằng mọi ứng dụng Ngân hàng hoặc ZaloPay"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-center space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_QR_URL}
              alt="Mã QR nhận tiền chính thức của NGUYEN THE TIENG"
              className="mx-auto max-w-[280px] w-full rounded-xl border border-slate-200 shadow-xs bg-white"
            />
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <a
                href={OFFICIAL_QR_URL}
                download="QR_Quy_FC_HDH_Go_Noi_NguyenTheTieng.jpg"
                className="inline-flex items-center gap-1.5 min-h-10 rounded-lg bg-[#0d2e5b] px-3.5 py-2 text-xs font-bold text-[#fde047] hover:bg-[#17488c] transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tải ảnh QR về điện thoại</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="qr-player-select"
                className="block text-xs font-bold uppercase text-slate-600 mb-1"
              >
                Chọn tên cầu thủ để tạo nội dung CK
              </label>
              <select
                id="qr-player-select"
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="form-select text-sm"
              >
                <option value="">-- Chọn cầu thủ --</option>
                {players.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    #{p.jersey_number ?? "-"} - {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="qr-match-select"
                className="block text-xs font-bold uppercase text-slate-600 mb-1"
              >
                Đóng cho trận
              </label>
              <select
                id="qr-match-select"
                value={qrMatchLabel}
                onChange={(e) => setQrMatchLabel(e.target.value)}
                className="form-select text-sm"
              >
                {matches
                  .slice()
                  .reverse()
                  .map((m) => (
                    <option key={m.id} value={m.label}>
                      {m.label} ({formatDateVN(m.match_date)})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-[#0d2e5b] text-white p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] text-[#fde047] font-bold block">
                Số tiền gợi ý: {formatVND(qrAmount)} • Nội dung chuyển khoản:
              </span>
              <span className="text-sm font-extrabold truncate block">
                {qrNote}
              </span>
            </div>
            <Button
              variant="gold"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(qrNote);
                setCopiedNote(true);
                window.setTimeout(() => setCopiedNote(false), 2000);
              }}
              leftIcon={<Copy className="h-3.5 w-3.5" />}
            >
              {copiedNote ? "Đã chép" : "Copy ND"}
            </Button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
