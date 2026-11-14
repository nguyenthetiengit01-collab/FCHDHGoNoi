"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calendar,
  Camera,
  Clock,
  Handshake,
  Info,
  PieChart,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { OFFICIAL_LOGO_URL } from "@/types/app";
import { formatDateVN, formatShortVND, formatVND } from "@/lib/format";
import { formatMonthLabelVN } from "@/lib/dashboardIntelligence";
import type { PublicFinancialReportResponse } from "@/lib/publicFinancialReport";

const CATEGORY_ACCENTS: Record<string, string> = {
  "Tiền sân": "bg-sky-400",
  "Nước uống": "bg-cyan-400",
  "Trọng tài": "bg-amber-400",
  "Áo đấu/Phụ kiện": "bg-emerald-400",
  "Liên hoan/Ăn uống": "bg-rose-400",
  "Khác": "bg-slate-400",
};

export default function PublicFinancialReportPage() {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [report, setReport] = useState<PublicFinancialReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedYear !== "all") params.set("year", selectedYear);
        if (selectedMonth !== "all") params.set("month", selectedMonth);
        const query = params.toString();
        const url = query
          ? `/api/public/financial-report?${query}`
          : "/api/public/financial-report";

        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Không thể tải dữ liệu báo cáo tài chính.");
        }
        const json = (await res.json()) as PublicFinancialReportResponse;
        setReport(json);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Không thể tải báo cáo tài chính công khai. Vui lòng thử lại.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadReport();
    return () => controller.abort();
  }, [selectedYear, selectedMonth]);

  const monthsForSelectedYear = useMemo(() => {
    if (!report) return [];
    if (selectedYear === "all") return report.availableMonths;
    return report.availableMonths.filter((m) => m.startsWith(`${selectedYear}-`));
  }, [report, selectedYear]);

  const maxTrendAmount = useMemo(() => {
    if (!report || report.monthlyTrend.length === 0) return 1;
    const maxVal = report.monthlyTrend.reduce(
      (acc, item) => Math.max(acc, item.totalIncome, item.totalExpense),
      0
    );
    return maxVal > 0 ? maxVal : 1;
  }, [report]);

  const formattedUpdatedTime = useMemo(() => {
    if (!report) return "Đang đồng bộ";
    if (report.latestActivityDate) {
      return `Số liệu đến ${formatDateVN(report.latestActivityDate)}`;
    }
    return "Chưa có phát sinh thu chi";
  }, [report]);

  const handleYearChange = (nextYear: string) => {
    setSelectedYear(nextYear);
    if (
      selectedMonth !== "all" &&
      nextYear !== "all" &&
      !selectedMonth.startsWith(`${nextYear}-`)
    ) {
      setSelectedMonth("all");
    }
  };

  return (
    <div className="min-h-screen bg-[#040e1a] text-slate-100 flex flex-col">
      {/* Header đồng bộ thương hiệu FC HĐH Gò Nổi */}
      <header className="sticky top-0 z-30 bg-[#040e1a]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 min-w-0 group">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-[#d4af37]/60 bg-white shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Logo FC HĐH Gò Nổi tại TP.HCM"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold uppercase tracking-tight text-sm sm:text-base text-white truncate group-hover:text-[#fde047] transition">
                FC HĐH GÒ NỔI TẠI TP.HCM
              </div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#d4af37] truncate">
                Xã Gò Nổi • TP. Đà Nẵng
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/cau-chuyen-go-noi"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition"
            >
              <BookOpen className="h-3.5 w-3.5 text-[#d4af37]" />
              Câu chuyện Gò Nổi
            </Link>
            <Link
              href="/hoat-dong"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition"
            >
              <Camera className="h-3.5 w-3.5 text-[#d4af37]" />
              Hoạt động CLB
            </Link>
            <Link
              href="/nha-tai-tro"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition"
            >
              <Handshake className="h-3.5 w-3.5 text-[#d4af37]" />
              Nhà tài trợ
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0b2447] hover:bg-[#11315f] border border-white/15 text-xs font-bold uppercase tracking-wider text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Trang chủ
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative border-b border-white/10 bg-gradient-to-b from-[#081a33] via-[#061326] to-[#040e1a] py-10 sm:py-14">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/40 text-[#fde047] text-[11px] font-bold uppercase tracking-widest mb-4">
              <ShieldCheck className="h-3.5 w-3.5" />
              Minh bạch tài chính cộng đồng
            </div>
            <h1 className="font-display font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white">
              BÁO CÁO{" "}
              <span className="text-[#fde047]">TÀI CHÍNH MINH BẠCH</span>
            </h1>
            <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base text-slate-300 font-light leading-relaxed">
              Tổng hợp công khai tình hình thu – chi quỹ sinh hoạt và quỹ giải của{" "}
              <span className="text-white font-semibold">FC HĐH Gò Nổi tại TP.HCM</span>{" "}
              (Xã Gò Nổi • TP. Đà Nẵng — cội nguồn Điện Quang, Điện Trung, Điện Phong).
            </p>
          </div>
        </section>

        {/* Filter Bar & Update Timestamp */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
          <div className="rounded-xl bg-[#081a33]/90 border border-white/10 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Calendar className="h-4 w-4 text-[#d4af37]" />
                Kỳ báo cáo:
              </div>

              <select
                aria-label="Lọc theo năm"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="rounded-lg bg-[#040e1a] border border-white/15 px-3 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-[#d4af37]"
              >
                <option value="all">Tất cả các năm</option>
                {(report?.availableYears ?? []).map((y) => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>

              <select
                aria-label="Lọc theo tháng"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg bg-[#040e1a] border border-white/15 px-3 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-[#d4af37]"
              >
                <option value="all">Tất cả các tháng</option>
                {monthsForSelectedYear.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabelVN(m)}
                  </option>
                ))}
              </select>

              {(selectedYear !== "all" || selectedMonth !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedYear("all");
                    setSelectedMonth("all");
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-[#fde047] bg-[#d4af37]/10 border border-[#d4af37]/30 hover:bg-[#d4af37]/20 transition"
                >
                  Xem toàn bộ
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Clock className="h-3.5 w-3.5 text-[#d4af37] shrink-0" />
              <span>{formattedUpdatedTime}</span>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-32 rounded-xl bg-[#081a33]/80 border border-white/10 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl bg-[#081a33]/80 border border-rose-500/30 p-8 text-center text-sm text-rose-200">
              {error}
            </div>
          ) : !report || !report.hasData ? (
            <div className="rounded-xl bg-[#081a33]/80 border border-dashed border-white/15 p-10 text-center space-y-2">
              <Wallet className="h-8 w-8 text-[#d4af37]/70 mx-auto" />
              <div className="font-display font-bold uppercase text-base text-white">
                CHƯA CÓ DỮ LIỆU TÀI CHÍNH TRONG KỲ ĐÃ CHỌN
              </div>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                Hệ thống chưa ghi nhận khoản thu hoặc chi hợp lệ trong khoảng thời gian này.
              </p>
            </div>
          ) : (
            <>
              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl bg-[#081a33]/90 border border-emerald-500/30 p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-300">
                    <span>Tổng thu</span>
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="font-display font-black text-2xl text-white">
                    {formatVND(report.summary.totalIncome)}
                  </div>
                  <div className="text-xs text-slate-400">
                    Quỹ trận + Thu khác hợp lệ
                  </div>
                </div>

                <div className="rounded-xl bg-[#081a33]/90 border border-rose-500/30 p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-rose-300">
                    <span>Tổng chi</span>
                    <TrendingDown className="h-4 w-4 text-rose-400" />
                  </div>
                  <div className="font-display font-black text-2xl text-white">
                    {formatVND(report.summary.totalExpense)}
                  </div>
                  <div className="text-xs text-slate-400">
                    Chi phí 6 nhóm hoạt động
                  </div>
                </div>

                <div className="rounded-xl bg-[#081a33]/90 border border-sky-400/35 p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-sky-300">
                    <span>
                      {report.filter.year !== "all" || report.filter.month !== "all"
                        ? "Số dư hoạt động trong kỳ"
                        : "Số dư hoạt động"}
                    </span>
                    <Wallet className="h-4 w-4 text-sky-400" />
                  </div>
                  <div
                    className={`font-display font-black text-2xl ${
                      report.summary.currentBalance >= 0
                        ? "text-white"
                        : "text-rose-300"
                    }`}
                  >
                    {formatVND(report.summary.currentBalance)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {report.filter.year !== "all" || report.filter.month !== "all"
                      ? "Tổng thu − Tổng chi trong kỳ"
                      : "Tổng thu − Tổng chi"}
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-[#0e2e5c] to-[#081a33] border border-[#d4af37]/50 p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#fde047]">
                    <span>Quỹ giải (Độc lập)</span>
                    <Trophy className="h-4 w-4 text-[#fde047]" />
                  </div>
                  <div className="font-display font-black text-2xl text-[#fde047]">
                    {formatVND(report.tournamentReserve)}
                  </div>
                  <div className="text-xs text-slate-300">
                    Quỹ giải hiện tại của toàn CLB, được theo dõi độc lập và không thay đổi theo bộ lọc tháng/năm.
                  </div>
                </div>
              </div>

              {/* Cơ cấu nguồn thu & Cơ cấu chi phí 6 nhóm */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Nguồn thu */}
                <div className="rounded-xl bg-[#081a33]/90 border border-white/10 p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-emerald-400" />
                      <h2 className="font-display font-extrabold uppercase text-lg text-white">
                        Cơ cấu nguồn thu
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      Đã loại trừ chuyển quỹ nội bộ
                    </span>
                  </div>

                  <div className="space-y-4">
                    {report.incomeSources.map((src) => (
                      <div key={src.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="font-semibold text-slate-200">
                            {src.label}
                          </span>
                          <span className="font-bold text-white">
                            {formatVND(src.amount)}{" "}
                            <span className="text-slate-400 font-normal">
                              ({src.percentage}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[#040e1a] overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all ${
                              src.key === "match" ? "bg-emerald-400" : "bg-[#d4af37]"
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(0, src.percentage))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cơ cấu chi phí theo 6 nhóm */}
                <div className="rounded-xl bg-[#081a33]/90 border border-white/10 p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-sky-400" />
                      <h2 className="font-display font-extrabold uppercase text-lg text-white">
                        Cơ cấu chi phí (6 nhóm)
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      Theo chuẩn kế toán CLB
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {report.summary.categoryBreakdown.map((item) => (
                      <div key={item.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="font-semibold text-slate-200">
                            {item.category}
                          </span>
                          <span className="font-bold text-white">
                            {formatVND(item.amount)}{" "}
                            <span className="text-slate-400 font-normal">
                              ({item.percentage}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[#040e1a] overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all ${
                              CATEGORY_ACCENTS[item.category] || "bg-slate-400"
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Biểu đồ thu chi theo tháng */}
              <div className="rounded-xl bg-[#081a33]/90 border border-white/10 p-5 sm:p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-extrabold uppercase text-lg text-white">
                      Diễn biến thu – chi theo tháng
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      So sánh tổng thu thực tế và tổng chi hợp lệ qua từng tháng
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-emerald-300">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                      Thu
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-rose-300">
                      <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />
                      Chi
                    </span>
                  </div>
                </div>

                {report.monthlyTrend.length === 0 ? (
                  <div className="py-8 text-center text-xs sm:text-sm text-slate-400 border border-dashed border-white/10 rounded-lg">
                    Chưa có chuỗi dữ liệu theo tháng trong khoảng thời gian đã chọn.
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-2">
                    <div className="min-w-[420px] grid grid-flow-col auto-cols-fr gap-3 items-end pt-4">
                      {report.monthlyTrend.map((point) => {
                        const incomeHeight = Math.max(
                          4,
                          Math.round((Math.max(0, point.totalIncome) / maxTrendAmount) * 140)
                        );
                        const expenseHeight = Math.max(
                          4,
                          Math.round((Math.max(0, point.totalExpense) / maxTrendAmount) * 140)
                        );
                        return (
                          <div
                            key={point.month}
                            className="flex flex-col items-center gap-2 rounded-lg bg-[#040e1a]/70 border border-white/5 p-3"
                          >
                            <div className="text-[11px] font-semibold text-slate-300 text-center">
                              <div>+{formatShortVND(point.totalIncome)}</div>
                              <div className="text-rose-300">-{formatShortVND(point.totalExpense)}</div>
                            </div>
                            <div className="h-36 flex items-end gap-1.5">
                              <div
                                title={`Thu: ${formatVND(point.totalIncome)}`}
                                className="w-4 sm:w-5 rounded-t bg-emerald-400/90"
                                style={{ height: `${incomeHeight}px` }}
                              />
                              <div
                                title={`Chi: ${formatVND(point.totalExpense)}`}
                                className="w-4 sm:w-5 rounded-t bg-rose-400/90"
                                style={{ height: `${expenseHeight}px` }}
                              />
                            </div>
                            <div className="text-xs font-bold text-white">
                              {point.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Ghi chú minh bạch & bảo mật */}
              <div className="rounded-xl bg-[#081a33]/60 border border-white/10 p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm text-slate-300">
                <Info className="h-4 w-4 text-[#d4af37] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Báo cáo được tổng hợp trực tiếp từ hệ thống kế toán chuẩn của CLB (chỉ tính
                  khoản thu đã hoàn tất, loại trừ các giao dịch chuyển quỹ nội bộ, tách riêng
                  Quỹ giải độc lập). Trang công khai không hiển thị thông tin cá nhân, công nợ
                  thành viên hoặc chứng từ nội bộ.
                </p>
              </div>
            </>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#040e1a] py-6 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 space-y-1">
          <div className="font-semibold text-slate-200">
            FC HĐH Gò Nổi tại TP.HCM • Xã Gò Nổi • TP. Đà Nẵng
          </div>
          <div>Cội nguồn: Điện Quang – Điện Trung – Điện Phong • Kết nối nghĩa tình đồng hương</div>
        </div>
      </footer>
    </div>
  );
}
