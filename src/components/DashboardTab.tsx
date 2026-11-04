"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import type { FullAppData } from "@/types/app";
import { OFFICIAL_LOGO_URL, OFFICIAL_QR_URL } from "@/types/app";
import { formatVND, formatShortVND, formatDateVN } from "@/lib/format";
import { ModalDialog } from "./ModalDialog";

interface DashboardTabProps {
  data: FullAppData;
  onNavigateTab: (tab: "schedule" | "matrix" | "players" | "finance") => void;
}

export function DashboardTab({ data, onNavigateTab }: DashboardTabProps) {
  const { settings, summary, players, matches, attendances, expenses } = data;
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [qrAmount] = useState<number>(
    settings.default_match_fee || 100000
  );
  const [qrMatchLabel, setQrMatchLabel] = useState<string>(
    matches[matches.length - 1]?.label || "Quỹ trận tuần"
  );
  const [copiedNote, setCopiedNote] = useState(false);

  const matchStats = matches.map((m) => {
    const collected = attendances
      .filter((a) => a.match_id === m.id && a.paid === 1)
      .reduce((s, a) => s + a.amount, 0);
    const attendeesCount = attendances.filter(
      (a) => a.match_id === m.id && (a.attended === 1 || a.paid === 1)
    ).length;
    const matchExp = expenses
      .filter((e) => e.match_id === m.id)
      .reduce((s, e) => s + e.amount, 0);
    const pitchOrExp = matchExp > 0 ? matchExp : m.pitch_cost;
    return {
      ...m,
      collected,
      attendeesCount,
      expense: pitchOrExp,
      net: collected - pitchOrExp,
    };
  });

  const playerLeaderboard = players
    .map((p) => {
      const pAtt = attendances.filter((a) => a.player_id === p.id);
      const matchesPlayed = pAtt.filter(
        (a) => a.attended === 1 || a.paid === 1
      ).length;
      const totalPaid = pAtt
        .filter((a) => a.paid === 1)
        .reduce((s, a) => s + a.amount, 0);
      const unpaid = pAtt
        .filter((a) => a.attended === 1 && a.paid === 0)
        .reduce((s, a) => s + a.amount, 0);
      return {
        ...p,
        matchesPlayed,
        totalPaid,
        unpaid,
        attendanceRate:
          matches.length > 0
            ? Math.round((matchesPlayed / matches.length) * 100)
            : 0,
      };
    })
    .sort(
      (a, b) => b.totalPaid - a.totalPaid || b.matchesPlayed - a.matchesPlayed
    );

  const selectedPlayer = players.find(
    (p) => String(p.id) === selectedPlayerId
  );
  const qrNote = selectedPlayer
    ? `${selectedPlayer.short_name} #${selectedPlayer.jersey_number ?? ""} dong quy ${qrMatchLabel}`
    : `Dong quy ${qrMatchLabel} FC HDH Go Noi`;

  const maxBarValue = Math.max(
    1500000,
    ...matchStats.map((m) => Math.max(m.collected, m.expense))
  );

  return (
    <div className="space-y-6">
      {/* Banner thông tin đội đồng bộ màu Navy & Gold với Logo chính thức */}
      <section className="rounded-xl bg-[#1e4fc2] text-white p-5 sm:p-6 shadow-sm border-2 border-[#ffc933]/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-white p-1 border-2 border-[#ffc933] shrink-0 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Logo FC HĐH Gò Nổi"
                className="h-full w-full object-contain rounded-xl"
              />
            </div>
            <div>
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-[#2f66dd] px-3 py-0.5 text-xs font-bold text-[#ffc933] border border-[#ffc933]/40">
                <span>⚽ {settings.short_name}</span>
                <span>•</span>
                <span>{players.length} Thành viên</span>
                <span>•</span>
                <span>{matches.length} Trận đã đấu</span>
              </div>
              <h1 className="mt-1.5 text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                {settings.team_name}{" "}
                <span className="text-[#ffc933] text-base sm:text-lg font-bold">
                  • TẠI TP. HỒ CHÍ MINH
                </span>
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-300">
                Hệ thống quản lý Hồ sơ đội hình, Điểm danh tuần & Báo cáo tài chính minh bạch
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ffc933] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#1e4fc2] hover:bg-[#eab308] transition cursor-pointer shadow-xs"
            >
              <QrCode className="h-4 w-4" />
              <span>Mã QR Đóng Quỹ</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("schedule")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2f66dd] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#1b4379] border border-[#ffc933]/40 transition cursor-pointer"
            >
              <Calendar className="h-4 w-4 text-[#ffc933]" />
              <span>Lịch & Điểm Danh Tuần</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4 Thẻ KPI Tài Chính Cốt Lõi */}
      <section
        aria-label="Tổng hợp tài chính đội bóng"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <div className="rounded-xl bg-white p-4 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Tổng Thu Quỹ Đội
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2.5 text-lg sm:text-2xl font-extrabold text-emerald-700">
            {formatVND(summary.totalIncome)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Thu trận: <strong>{formatShortVND(summary.totalMatchIncome)}</strong>
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Tổng Chi Tiêu
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
              <TrendingDown className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2.5 text-lg sm:text-2xl font-extrabold text-rose-600">
            {formatVND(summary.totalExpense)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {expenses.length} khoản chi tiêu
          </p>
        </div>

        <div className="rounded-xl bg-[#1e4fc2] text-white p-4 sm:p-5 border-2 border-[#ffc933] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#ffc933]">
              Tồn Quỹ Hiện Tại
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffc933] text-[#1e4fc2]">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2.5 text-lg sm:text-2xl font-extrabold text-white">
            {formatVND(summary.currentBalance)}
          </p>
          <p className="mt-1 text-[11px] text-slate-300">
            Thu ({formatShortVND(summary.totalIncome)}) − Chi (
            {formatShortVND(summary.totalExpense)})
          </p>
        </div>

        <div className="rounded-xl bg-white p-4 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Quỹ Giải Tồn Riêng
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Trophy className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2.5 text-lg sm:text-2xl font-extrabold text-amber-700">
            {formatVND(settings.tournament_fund_reserve)}
          </p>
          <p
            className="mt-1 text-[11px] text-slate-500 truncate"
            title={settings.tournament_fund_note}
          >
            {settings.tournament_fund_note}
          </p>
        </div>
      </section>

      {summary.totalUnpaidAmount > 0 && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-amber-950"
        >
          <div className="flex items-center gap-2.5 text-sm">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>
              Hiện có <strong>{formatVND(summary.totalUnpaidAmount)}</strong>{" "}
              tiền trận của cầu thủ đã tham gia nhưng đang ghi nhận{" "}
              <strong>Chưa nộp</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab("matrix")}
            className="text-xs font-bold text-[#1e4fc2] underline self-start sm:self-auto"
          >
            Xem bảng thu trận →
          </button>
        </div>
      )}

      {/* Bảng Phân Bổ Hạng Mục Chi & Biểu Đồ Thu/Chi Theo Từng Trận */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 rounded-xl bg-white p-5 border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-[#1e4fc2]">
                  Bảng Phân Bổ Hạng Mục Chi
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tổng hợp tự động theo 6 nhóm chi tiêu
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("matrix")}
                className="text-xs font-bold text-[#0284c7] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Bảng thu</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              {summary.categoryBreakdown.map((item) => (
                <div key={item.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">
                      {item.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1e4fc2]">
                        {formatVND(item.amount)}
                      </span>
                      <span className="w-12 text-right text-xs font-semibold text-slate-500">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.category === "Tiền sân"
                          ? "bg-[#1e4fc2]"
                          : item.amount > 0
                          ? "bg-[#ffc933]"
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
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-slate-50 p-3.5 border border-slate-200/80 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">
              Tổng cộng chi tiêu:
            </span>
            <span className="text-base font-extrabold text-rose-600">
              {formatVND(summary.totalExpense)}
            </span>
          </div>
        </section>

        <section className="lg:col-span-7 rounded-xl bg-white p-5 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-[#1e4fc2]">
                Biểu Đồ Thu Trận & Chi Sân Hằng Tuần
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                So sánh số tiền thu được (100k/người) và chi phí sân của từng trận
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 text-[#1e4fc2]">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#1e4fc2]" />
                Thu trận
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#d97706]">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#ffc933]" />
                Chi phí sân
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto pb-2">
            <div className="min-w-[560px] grid grid-cols-15 gap-2 items-end h-52 pt-6 px-1">
              {matchStats.slice(-15).map((m) => {
                const incPct = Math.round((m.collected / maxBarValue) * 100);
                const expPct = Math.round((m.expense / maxBarValue) * 100);
                return (
                  <div
                    key={m.id}
                    className="flex flex-col items-center h-full justify-end group"
                    title={`${m.label} (${m.venue})\nThu: ${formatVND(m.collected)} (${m.attendeesCount} người)\nChi: ${formatVND(m.expense)}\nChênh lệch: ${m.net >= 0 ? "+" : ""}${formatVND(m.net)}`}
                  >
                    <div className="text-[10px] font-bold text-slate-500 mb-1">
                      {m.attendeesCount}p
                    </div>
                    <div className="w-full flex items-end justify-center gap-1 h-36 bg-slate-50 rounded-t px-1 border-b border-slate-200">
                      <div
                        className="w-2.5 bg-[#1e4fc2] rounded-t transition-all"
                        style={{ height: `${Math.max(4, incPct)}%` }}
                      />
                      <div
                        className="w-2.5 bg-[#ffc933] rounded-t transition-all"
                        style={{ height: `${Math.max(4, expPct)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 text-[11px] font-bold text-[#1e4fc2]">
                      T{m.match_number}
                    </div>
                    <div
                      className={`text-[10px] font-semibold ${
                        m.net >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {m.net >= 0
                        ? `+${formatShortVND(m.net)}`
                        : formatShortVND(m.net)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Bảng Xếp Hạng Chuyên Cần & Lịch Đấu Gần Đây */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-xl bg-white p-5 border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-[#d97706]" />
              <div>
                <h2 className="text-base font-extrabold text-[#1e4fc2]">
                  Bảng Vàng Chuyên Cần & Đóng Quỹ
                </h2>
                <p className="text-xs text-slate-500">
                  Xếp hạng theo số trận tham gia và tổng quỹ đã đóng góp
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("players")}
              className="text-xs font-bold text-[#0284c7] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Đội hình</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {playerLeaderboard.slice(0, 8).map((p, index) => (
              <div
                key={p.id}
                className="py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                      index === 0
                        ? "bg-[#ffc933] text-[#1e4fc2]"
                        : index === 1
                        ? "bg-slate-200 text-slate-800"
                        : index === 2
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden border border-[#1e4fc2] bg-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.avatar_url || "/uploads/avatars/member-1.jpg"}
                      alt={p.full_name}
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#1e4fc2] truncate">
                      {p.full_name}{" "}
                      <span className="text-xs font-semibold text-slate-500">
                        (#{p.jersey_number ?? "-"})
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.position} • Tham gia{" "}
                      <strong className="text-slate-700">
                        {p.matchesPlayed}/{matches.length} trận
                      </strong>{" "}
                      ({p.attendanceRate}%)
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
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
        </section>

        <section className="lg:col-span-5 rounded-xl bg-white p-5 border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#1e4fc2]" />
              <div>
                <h2 className="text-base font-extrabold text-[#1e4fc2]">
                  Nhật Ký Trận Đấu Gần Đây
                </h2>
                <p className="text-xs text-slate-500">
                  Thông tin sân bãi, quân số & cân đối thu chi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("schedule")}
              className="text-xs font-bold text-[#0284c7] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Lịch đấu</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {matchStats
              .slice()
              .reverse()
              .slice(0, 5)
              .map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-slate-200 p-3 hover:border-[#1e4fc2] transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#1e4fc2]">
                      {m.label}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {formatDateVN(m.match_date)} • {m.kickoff_time}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      🏟️ <strong>{m.venue}</strong> ({m.attendeesCount} cầu thủ)
                    </span>
                    <span>Chi sân: {m.payer_name}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-emerald-700 font-semibold">
                      Thu: {formatVND(m.collected)}
                    </span>
                    <span className="text-rose-600 font-semibold">
                      Sân: {formatVND(m.expense)}
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded ${
                        m.net >= 0
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
              ))}
          </div>
        </section>
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4fc2] px-3.5 py-2 text-xs font-bold text-[#ffc933] hover:bg-[#2f66dd]"
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

          <div className="rounded-xl bg-[#1e4fc2] text-white p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] text-[#ffc933] font-bold block">
                Số tiền gợi ý: {formatVND(qrAmount)} • Nội dung chuyển khoản:
              </span>
              <span className="text-sm font-extrabold truncate block">
                {qrNote}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(qrNote);
                setCopiedNote(true);
                window.setTimeout(() => setCopiedNote(false), 2000);
              }}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-[#ffc933] px-3 py-2 text-xs font-extrabold text-[#1e4fc2] cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copiedNote ? "Đã chép" : "Copy ND"}</span>
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
