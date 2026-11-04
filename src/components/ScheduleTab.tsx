"use client";

import React, { useState } from "react";
import {
  MapPin,
  Users,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  BellRing,
  Copy,
  Wallet,
  Clock,
  ExternalLink,
  Sparkles,
  Archive,
  Trophy,
  Zap,
  RotateCcw,
} from "lucide-react";
import type {
  FullAppData,
  MutateActionFn,
  MatchRecord,
  AuthSession,
  RsvpStatus,
} from "@/types/app";
import { FANPAGE_URL, OFFICIAL_LOGO_URL } from "@/types/app";
import { formatVND, formatDateVN } from "@/lib/format";
import { ModalDialog } from "./ModalDialog";

interface ScheduleTabProps {
  data: FullAppData;
  session: AuthSession;
  onMutate: MutateActionFn;
  isSaving: boolean;
  onGoToCollection?: () => void;
}

const VENUE_PRESETS = [
  { venue: "Sân Vĩnh Lộc", cost: 900000, shortLabel: "Vĩnh Lộc (900k)" },
  { venue: "Sân Vũ Khánh", cost: 1335000, shortLabel: "Vũ Khánh (1.335k)" },
  { venue: "Sân Gò Mây", cost: 950000, shortLabel: "Gò Mây (950k)" },
  { venue: "Sân DEMI", cost: 600000, shortLabel: "DEMI (600k)" },
];

const QUICK_PAYERS = ["Tiếng", "Tín", "H.Sơn", "Thịnh", "Huy", "Trí"];

export function ScheduleTab({
  data,
  session,
  onMutate,
  isSaving,
  onGoToCollection,
}: ScheduleTabProps) {
  const { matches, players, attendances, settings } = data;
  const isManager = session.role === "manager";

  // Tách các trận đang điểm danh (Sắp diễn ra + trận mới nhất nếu chưa tạo trận mới) và các trận đã kết thúc
  const latestMatchOverall = matches[matches.length - 1];
  const upcomingMatches = matches.filter(
    (m) =>
      m.status === "Sắp diễn ra" ||
      (matches.every((x) => x.status !== "Sắp diễn ra") &&
        m.id === latestMatchOverall?.id)
  );
  const finishedMatches = matches
    .filter((m) => !upcomingMatches.some((u) => u.id === m.id))
    .slice()
    .reverse();

  // Không gian hiển thị: "upcoming" (Lịch tuần & Điểm danh) vs "finished" (Không gian riêng cho các trận đã kết thúc)
  const [spaceMode, setSpaceMode] = useState<"upcoming" | "finished">(
    "upcoming"
  );

  const [selectedUpcomingId, setSelectedUpcomingId] = useState<number>(
    upcomingMatches[upcomingMatches.length - 1]?.id ??
      latestMatchOverall?.id ??
      1
  );
  const [selectedFinishedMatch, setSelectedFinishedMatch] =
    useState<MatchRecord | null>(null);

  // Chế độ mẫu thông báo Fanpage (không để quỹ)
  const [postTemplateMode, setPostTemplateMode] = useState<
    "fanpage" | "with_roster"
  >("fanpage");
  const [copiedReminder, setCopiedReminder] = useState(false);

  // State cho Hộp Chi Tiền Sân Nhanh của Ban Quản Lý
  const activeMatch =
    upcomingMatches.find((m) => m.id === selectedUpcomingId) ||
    upcomingMatches[upcomingMatches.length - 1] ||
    latestMatchOverall;

  const [quickVenue, setQuickVenue] = useState<string>(
    activeMatch?.venue || "Sân Vĩnh Lộc"
  );
  const [quickPitchCost, setQuickPitchCost] = useState<string>(
    String(activeMatch?.pitch_cost || 900000)
  );
  const [quickPayer, setQuickPayer] = useState<string>(
    (activeMatch?.payer_name || "Tiếng").split("-")[0].trim()
  );

  // Modal Tạo / Sửa Lịch Thi Đấu
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchRecord | null>(null);
  const [matchNumber, setMatchNumber] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [matchDate, setMatchDate] = useState<string>("2026-11-04");
  const [kickoffTime, setKickoffTime] = useState<string>("19:00");
  const [venue, setVenue] = useState<string>("Sân Vĩnh Lộc");
  const [opponent, setOpponent] = useState<string>("Giao hữu / Nội bộ");
  const [pitchCost, setPitchCost] = useState<string>("900000");
  const [payerName, setPayerName] = useState<string>("Tiếng");
  const [teamScore, setTeamScore] = useState<string>("");
  const [opponentScore, setOpponentScore] = useState<string>("");
  const [status, setStatus] = useState<string>("Sắp diễn ra");
  const [notes, setNotes] = useState<string>("");
  const [syncPitchExpense, setSyncPitchExpense] = useState<boolean>(true);

  const syncQuickPitchInputs = (m: MatchRecord) => {
    setQuickVenue(m.venue || "Sân Vĩnh Lộc");
    setQuickPitchCost(String(m.pitch_cost || 900000));
    setQuickPayer((m.payer_name || "Tiếng").split("-")[0].trim() || "Tiếng");
  };

  function openCreateModal() {
    const nextNum =
      matches.reduce((max, m) => Math.max(max, m.match_number), 0) + 1;
    const today = new Date().toISOString().slice(0, 10);
    const [, mm, dd] = today.split("-");
    setEditingMatch(null);
    setMatchNumber(String(nextNum));
    setLabel(`Trận ${nextNum} - ${dd}/${Number(mm)}`);
    setMatchDate(today);
    setKickoffTime("19:00");
    setVenue("Sân Vĩnh Lộc");
    setOpponent("Giao hữu / Sinh hoạt tuần");
    setPitchCost("900000");
    setPayerName("Tiếng");
    setTeamScore("");
    setOpponentScore("");
    setStatus("Sắp diễn ra");
    setNotes("");
    setSyncPitchExpense(true);
    setModalOpen(true);
  }

  function openEditModal(m: MatchRecord) {
    setEditingMatch(m);
    setMatchNumber(String(m.match_number));
    setLabel(m.label);
    setMatchDate(m.match_date);
    setKickoffTime(m.kickoff_time);
    setVenue(m.venue);
    setOpponent(m.opponent);
    setPitchCost(String(m.pitch_cost));
    setPayerName((m.payer_name || "Tiếng").split("-")[0].trim());
    setTeamScore(m.team_score !== null ? String(m.team_score) : "");
    setOpponentScore(m.opponent_score !== null ? String(m.opponent_score) : "");
    setStatus(m.status);
    setNotes(m.notes);
    setSyncPitchExpense(true);
    setModalOpen(true);
  }

  async function handleSaveMatch(e: React.FormEvent) {
    e.preventDefault();
    const shortVenue = venue.replace(/^Sân\s+/i, "");
    const formattedPayer = payerName.includes("-")
      ? payerName
      : `${payerName} - ${shortVenue}`;
    await onMutate("upsert_match", {
      id: editingMatch?.id,
      match_number: Number(matchNumber),
      label,
      match_date: matchDate,
      kickoff_time: kickoffTime,
      venue,
      opponent,
      fee_per_player: settings.default_match_fee || 100000,
      pitch_cost: Number(pitchCost),
      payer_name: formattedPayer,
      team_score: teamScore === "" ? null : Number(teamScore),
      opponent_score: opponentScore === "" ? null : Number(opponentScore),
      status,
      notes,
      sync_pitch_expense: syncPitchExpense,
    });
    setModalOpen(false);
  }

  async function handleQuickSavePitchExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!activeMatch) return;
    await onMutate("quick_pitch_expense", {
      match_id: activeMatch.id,
      venue: quickVenue,
      pitch_cost: Number(quickPitchCost.replace(/[^0-9]/g, "")) || 0,
      payer_name: quickPayer,
    });
  }

  async function handleMoveMatchStatus(
    match: MatchRecord,
    targetStatus: "Sắp diễn ra" | "Đã kết thúc"
  ) {
    await onMutate("set_match_status", {
      match_id: match.id,
      status: targetStatus,
    });
  }

  async function handleDeleteMatch(id: number, matchLabel: string) {
    if (!window.confirm(`Bạn có chắc muốn xoá "${matchLabel}"?`)) return;
    await onMutate("delete_match", { id });
  }

  const activeAttendances = attendances.filter(
    (a) => a.match_id === activeMatch?.id
  );
  const registeredPlayers = players.filter((p) => {
    const a = activeAttendances.find((att) => att.player_id === p.id);
    return a?.rsvp_status === "registered";
  });
  const absentNoticePlayers = players.filter((p) => {
    const a = activeAttendances.find((att) => att.player_id === p.id);
    return a?.rsvp_status === "absent_notice";
  });
  const pendingPlayers = players.filter((p) => {
    const a = activeAttendances.find((att) => att.player_id === p.id);
    return !a || a.rsvp_status === "none";
  });

  const handleSetRsvp = async (playerId: number, rsvpStatus: RsvpStatus) => {
    if (!activeMatch) return;
    await onMutate("set_rsvp", {
      match_id: activeMatch.id,
      player_id: playerId,
      rsvp_status: rsvpStatus,
    });
  };

  // XÂY DỰNG NỘI DUNG THÔNG BÁO CHUẨN ĐĂNG FANPAGE (TUYỆT ĐỐI KHÔNG ĐỂ QUỸ)
  const buildFanpagePostText = (
    m: MatchRecord,
    mode: "fanpage" | "with_roster"
  ): string => {
    const regNames = registeredPlayers
      .map(
        (p, i) =>
          `   ${i + 1}. ${p.full_name} (Số áo #${p.jersey_number ?? "-"} • ${
            p.position
          })`
      )
      .join("\n");

    const baseLines = [
      `🔥 [THÔNG BÁO LỊCH THI ĐẤU TUẦN] — FC HĐH GÒ NỔI TẠI TP. HCM ⚽`,
      `💛💙 Gắn kết tình quê hương Gò Nổi – Điện Bàn – Quảng Nam trên sân cỏ Sài Gòn!`,
      ``,
      `🏆 Trận đấu: ${m.label} (${m.opponent})`,
      `⏰ Thời gian: ${m.kickoff_time} | Ngày ${formatDateVN(m.match_date)}`,
      `🏟️ Địa điểm: ${m.venue}`,
      `👕 Trang phục: Áo Vàng Truyền Thống – Quần Xanh`,
    ];

    if (mode === "with_roster") {
      baseLines.push(
        `----------------------------------------`,
        `✅ DANH SÁCH CẦU THỦ ĐÃ ĐIỂM DANH RA SÂN (${registeredPlayers.length} anh em):`,
        regNames || "   (Đang cập nhật danh sách điểm danh...)",
        `----------------------------------------`
      );
    } else {
      baseLines.push(`----------------------------------------`);
    }

    baseLines.push(
      `👉 Anh em cầu thủ vào App điểm danh [Có Mặt Ra Sân] hoặc [Báo Vắng] sớm để Ban Quản Lý chốt đội hình thi đấu nhé!`,
      `📣 Kính mời bà con đồng hương Gò Nổi tại TP. HCM đến sân cổ vũ và tiếp lửa cho đội bóng!`,
      ``,
      `🌐 Fanpage chính thức: ${settings.fanpage_url || FANPAGE_URL}`,
      `#FCHDHGoNoi #HoiDongHuongGoNoi #DienBan #QuangNam #BongDaPhongTrao`
    );

    return baseLines.join("\n");
  };

  const fanpagePreviewText = activeMatch
    ? buildFanpagePostText(activeMatch, postTemplateMode)
    : "";

  const handleCopyFanpagePost = () => {
    if (!fanpagePreviewText) return;
    navigator.clipboard.writeText(fanpagePreviewText);
    setCopiedReminder(true);
    window.setTimeout(() => setCopiedReminder(false), 2500);
  };

  const myAttendance = activeAttendances.find(
    (a) => a.player_id === session.playerId
  );

  return (
    <div className="space-y-5">
      {/* THANH CHUYỂN ĐỔI 2 KHÔNG GIAN RIÊNG BIỆT: LỊCH TUẦN HIỆN TẠI vs TRẬN ĐẤU ĐÃ KẾT THÚC */}
      <div className="rounded-xl bg-white p-3.5 sm:p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setSpaceMode("upcoming")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              spaceMode === "upcoming"
                ? "bg-[#1e4fc2] text-[#ffc933] shadow-xs"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <BellRing className="h-4 w-4" />
            <span>Lịch Tuần & Điểm Danh ({upcomingMatches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSpaceMode("finished")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              spaceMode === "finished"
                ? "bg-[#1e4fc2] text-[#ffc933] shadow-xs"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <Archive className="h-4 w-4" />
            <span>Các Trận Đã Kết Thúc ({finishedMatches.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isManager && onGoToCollection && (
            <button
              type="button"
              onClick={onGoToCollection}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#1e4fc2] bg-slate-50 px-3.5 py-2 text-xs font-bold text-[#1e4fc2] hover:bg-slate-100 cursor-pointer"
            >
              <Wallet className="h-4 w-4 text-[#0284c7]" />
              <span>Sang Mục Thu Tiền Trận →</span>
            </button>
          )}
          {isManager && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1e4fc2] px-4 py-2 text-xs font-bold text-[#ffc933] hover:bg-[#2f66dd] transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo Lịch Tuần Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          KHÔNG GIAN 1: LỊCH TUẦN HIỆN TẠI, BÀI ĐĂNG FANPAGE & ĐIỂM DANH
         ===================================================================== */}
      {spaceMode === "upcoming" && activeMatch && (
        <div className="space-y-5">
          {/* Nếu có nhiều hơn 1 lịch sắp diễn ra -> Thanh chọn lịch sắp tới */}
          {upcomingMatches.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-slate-600 shrink-0">
                Lịch đang mở điểm danh:
              </span>
              {upcomingMatches.map((m) => {
                const isSelected = activeMatch.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedUpcomingId(m.id);
                      syncQuickPitchInputs(m);
                    }}
                    className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-extrabold border transition cursor-pointer ${
                      isSelected
                        ? "bg-[#1e4fc2] text-[#ffc933] border-[#1e4fc2]"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {m.label} ({m.venue})
                  </button>
                );
              })}
            </div>
          )}

          {/* HỘP ƯU TIÊN SỐ 1: THÔNG BÁO LỊCH TUẦN & ĐIỂM DANH 1-CHẠM (KHÔNG ĐỂ QUỸ) */}
          {session.playerId && (
            <section className="rounded-xl bg-brand-navy text-white p-4 sm:p-6 border-2 border-[#ffc933]/70 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#ffc933]/20 border border-[#ffc933]/50 px-3 py-1 text-xs font-extrabold text-[#ffc933]">
                    <BellRing className="h-3.5 w-3.5" />
                    <span>
                      ĐIỂM DANH LỊCH TUẦN • #{session.jerseyNumber ?? "-"}{" "}
                      {session.fullName}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                    {activeMatch.label} — {activeMatch.venue}
                  </h2>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-sky-100">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Clock className="h-4 w-4 text-[#ffc933]" />
                      {activeMatch.kickoff_time} • Ngày{" "}
                      {formatDateVN(activeMatch.match_date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <MapPin className="h-4 w-4 text-[#5cc8ff]" />
                      {activeMatch.venue} ({activeMatch.opponent})
                    </span>
                  </div>

                  <p className="text-xs text-sky-200/90 pt-0.5">
                    Trạng thái điểm danh của bạn:{" "}
                    <strong className="text-[#ffc933]">
                      {myAttendance?.rsvp_status === "registered"
                        ? "✅ ĐÃ ĐĂNG KÝ CÓ MẶT RA SÂN"
                        : myAttendance?.rsvp_status === "absent_notice"
                        ? "❌ ĐÃ BÁO VẮNG TRẬN NÀY"
                        : "⏳ CHƯA PHẢN HỒI — Bấm nút bên dưới để điểm danh"}
                    </strong>
                  </p>
                </div>

                {/* 2 Nút Điểm Danh cực lớn trên điện thoại */}
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      handleSetRsvp(session.playerId!, "registered")
                    }
                    className={`min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold transition cursor-pointer shadow-sm ${
                      myAttendance?.rsvp_status === "registered"
                        ? "bg-[#ffc933] text-slate-950 ring-2 ring-white"
                        : "bg-emerald-600 text-white hover:bg-emerald-500"
                    }`}
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span>Có Mặt Ra Sân</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      handleSetRsvp(session.playerId!, "absent_notice")
                    }
                    className={`min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition cursor-pointer ${
                      myAttendance?.rsvp_status === "absent_notice"
                        ? "bg-rose-600 text-white ring-2 ring-white"
                        : "bg-white/10 text-white border border-white/25 hover:bg-rose-600 hover:border-rose-500"
                    }`}
                  >
                    <XCircle className="h-5 w-5 shrink-0" />
                    <span>Báo Vắng</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* KHUNG GHI NHANH CHI TIỀN SÂN DÀNH CHO BAN QUẢN LÝ (ĐƠN GIẢN & TIỆN LỢI 1-CHẠM) */}
          {isManager && (
            <section className="rounded-xl bg-amber-50/90 border-2 border-[#ffc933] p-4 sm:p-5 space-y-3.5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e4fc2] text-[#ffc933]">
                    <Zap className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-[#1e4fc2]">
                      Chi Tiền Sân Nhanh Cho Ban Quản Lý ({activeMatch.label})
                    </h3>
                    <p className="text-xs text-slate-600">
                      Bấm chọn nhanh sân & người chi bên dưới — Tự động đồng bộ
                      ngay vào Sổ Chi Quỹ Đội!
                    </p>
                  </div>
                </div>

                <div className="text-xs font-bold text-emerald-900 bg-emerald-100/90 border border-emerald-300 rounded-lg px-3 py-1.5 self-start sm:self-auto">
                  Đang ghi nhận:{" "}
                  <strong>{formatVND(activeMatch.pitch_cost)}</strong> (
                  {activeMatch.payer_name || "Tiếng"})
                </div>
              </div>

              {/* Bước 1: Bấm 1 chạm chọn Sân + Giá tiền sân chuẩn */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700">
                  1. Chọn nhanh sân & giá:
                </span>
                {VENUE_PRESETS.map((preset) => {
                  const isActivePreset =
                    quickVenue === preset.venue &&
                    Number(quickPitchCost) === preset.cost;
                  return (
                    <button
                      key={preset.venue}
                      type="button"
                      onClick={() => {
                        setQuickVenue(preset.venue);
                        setQuickPitchCost(String(preset.cost));
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-extrabold border transition cursor-pointer ${
                        isActivePreset
                          ? "bg-[#1e4fc2] text-[#ffc933] border-[#1e4fc2]"
                          : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      🏟️ {preset.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Bước 2: Bấm chọn Người chi + Nhập số tiền + Lưu 1 chạm */}
              <form
                onSubmit={handleQuickSavePitchExpense}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1"
              >
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Tên sân thi đấu
                  </label>
                  <input
                    type="text"
                    value={quickVenue}
                    onChange={(e) => setQuickVenue(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-900"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Số tiền sân (VND)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quickPitchCost}
                    onChange={(e) =>
                      setQuickPitchCost(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-extrabold text-rose-600"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                    Người chi tiền sân (Bấm chọn nhanh)
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_PAYERS.map((pName) => (
                      <button
                        key={pName}
                        type="button"
                        onClick={() => setQuickPayer(pName)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          quickPayer === pName
                            ? "bg-[#1e4fc2] text-[#ffc933] border-[#1e4fc2]"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {pName}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-white transition cursor-pointer shadow-xs"
                  >
                    Lưu Chi Sân
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* LƯỚI 2 CỘT: BÊN TRÁI = MẪU THÔNG BÁO ĐĂNG FANPAGE (KHÔNG ĐỂ QUỸ) | BÊN PHẢI = DANH SÁCH ĐIỂM DANH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Cột trái (5 cols): Bản tin Nhắc lịch chuẩn đăng Fanpage (Không để quỹ) */}
            <section className="lg:col-span-5 rounded-xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={OFFICIAL_LOGO_URL}
                    alt="Logo FC HĐH Gò Nổi"
                    className="h-10 w-10 rounded-xl object-contain border border-[#ffc933] bg-white p-0.5 shrink-0"
                  />
                  <div>
                    <div className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-[#0284c7]">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Chuẩn bài đăng Fanpage • Không để quỹ</span>
                    </div>
                    <h3 className="text-base font-extrabold text-[#1e4fc2]">
                      Bản Tin Thông Báo Lịch Thi Đấu
                    </h3>
                  </div>
                </div>

                {isManager && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(activeMatch)}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                      title="Sửa thông tin lịch"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleMoveMatchStatus(activeMatch, "Đã kết thúc")
                      }
                      className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
                      title="Chuyển trận này sang không gian Các trận đã kết thúc"
                    >
                      Kết thúc trận →
                    </button>
                  </div>
                )}
              </div>

              {/* Tuỳ chọn 2 mẫu bài đăng */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPostTemplateMode("fanpage")}
                  className={`rounded-lg py-1.5 px-2 text-xs font-bold transition cursor-pointer ${
                    postTemplateMode === "fanpage"
                      ? "bg-[#1e4fc2] text-[#ffc933]"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Mẫu 1: Đăng Fanpage
                </button>
                <button
                  type="button"
                  onClick={() => setPostTemplateMode("with_roster")}
                  className={`rounded-lg py-1.5 px-2 text-xs font-bold transition cursor-pointer ${
                    postTemplateMode === "with_roster"
                      ? "bg-[#1e4fc2] text-[#ffc933]"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Mẫu 2: Kèm DS Điểm Danh ({registeredPlayers.length})
                </button>
              </div>

              {/* Nội dung bản tin chuẩn Fanpage (Không nhắc tới tiền quỹ) */}
              <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed text-slate-800 bg-slate-50 rounded-xl p-3.5 border border-slate-200 max-h-[340px] overflow-y-auto">
                {fanpagePreviewText}
              </pre>

              {/* Nút Copy & Mở Fanpage */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCopyFanpagePost}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e4fc2] hover:bg-[#2f66dd] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#ffc933] transition cursor-pointer shadow-xs"
                >
                  <Copy className="h-4 w-4" />
                  <span>
                    {copiedReminder
                      ? "Đã Copy Bài Đăng!"
                      : "Copy Bài Thông Báo Chuẩn Fanpage"}
                  </span>
                </button>

                <a
                  href={settings.fanpage_url || FANPAGE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] px-3.5 py-2.5 text-xs font-bold text-white transition"
                >
                  <span>Mở Fanpage</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </section>

            {/* Cột phải (7 cols): Bảng Điểm Danh Thành Viên Tuần Này */}
            <section className="lg:col-span-7 rounded-xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[#1e4fc2]">
                    Danh Sách Điểm Danh Ra Sân ({activeMatch.label})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isManager
                      ? "Ban Quản Lý có thể tích điểm danh hộ bất kỳ cầu thủ nào"
                      : "Cầu thủ bấm Có mặt / Báo vắng tại dòng tên của mình"}
                  </p>
                </div>

                {/* 3 Huy hiệu quân số */}
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-emerald-800">
                    Có mặt: <strong>{registeredPlayers.length}</strong>
                  </span>
                  <span className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-rose-700">
                    Vắng: <strong>{absentNoticePlayers.length}</strong>
                  </span>
                  <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-700">
                    Chờ: <strong>{pendingPlayers.length}</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[480px] overflow-y-auto pr-1">
                {players.map((p) => {
                  const att = activeAttendances.find(
                    (a) => a.player_id === p.id
                  );
                  const rsvp = att?.rsvp_status || "none";
                  const isMe = session.playerId === p.id;
                  const canToggle = isManager || isMe;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition ${
                        isMe
                          ? "ring-2 ring-[#ffc933] border-[#1e4fc2] bg-amber-50/30"
                          : rsvp === "registered"
                          ? "bg-emerald-50/70 border-emerald-300"
                          : rsvp === "absent_notice"
                          ? "bg-rose-50/50 border-rose-200"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              p.avatar_url || "/uploads/avatars/member-1.jpg"
                            }
                            alt={p.full_name}
                            className="h-10 w-10 rounded-lg object-cover border border-[#1e4fc2]"
                          />
                          <span className="absolute -bottom-1 -right-1 rounded bg-[#1e4fc2] text-[#ffc933] px-1 text-[9px] font-extrabold">
                            #{p.jersey_number ?? "-"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {p.full_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {p.short_name} • {p.position}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={!canToggle || isSaving}
                          onClick={() =>
                            handleSetRsvp(
                              p.id,
                              rsvp === "registered" ? "none" : "registered"
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition ${
                            !canToggle
                              ? "opacity-75 cursor-default"
                              : "cursor-pointer"
                          } ${
                            rsvp === "registered"
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800"
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Có mặt</span>
                        </button>

                        <button
                          type="button"
                          disabled={!canToggle || isSaving}
                          onClick={() =>
                            handleSetRsvp(
                              p.id,
                              rsvp === "absent_notice"
                                ? "none"
                                : "absent_notice"
                            )
                          }
                          title="Báo vắng trận này"
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition ${
                            !canToggle
                              ? "opacity-75 cursor-default"
                              : "cursor-pointer"
                          } ${
                            rsvp === "absent_notice"
                              ? "bg-rose-600 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
                          }`}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* =====================================================================
          KHÔNG GIAN 2 (RIÊNG BIỆT): KHO LƯU TRỮ CÁC TRẬN ĐẤU ĐÃ KẾT THÚC
         ===================================================================== */}
      {spaceMode === "finished" && (
        <section className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-[#1e4fc2] text-[#ffc933] flex items-center justify-center shrink-0">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#1e4fc2]">
                  Không Gian Riêng: Lịch Sử Các Trận Đấu Đã Kết Thúc (
                  {finishedMatches.length} trận)
                </h3>
                <p className="text-xs text-slate-500">
                  Lưu trữ toàn bộ kết quả, sân bãi, chi phí sân và danh sách cầu
                  thủ tham gia của các trận đã qua.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {finishedMatches.map((m) => {
              const mAtt = attendances.filter((a) => a.match_id === m.id);
              const playedCount = mAtt.filter(
                (a) => a.attended === 1 || a.paid === 1
              ).length;

              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-[#1e4fc2]/40 p-4 flex flex-col justify-between gap-3 transition shadow-2xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                          Đã kết thúc • Trận #{m.match_number}
                        </span>
                        <h4 className="mt-1 text-base font-extrabold text-[#1e4fc2]">
                          {m.label}
                        </h4>
                      </div>

                      {m.team_score !== null && m.opponent_score !== null ? (
                        <div className="rounded-lg bg-[#1e4fc2] text-[#ffc933] px-2.5 py-1 text-xs font-extrabold">
                          {m.team_score} - {m.opponent_score}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">
                          {formatDateVN(m.match_date)}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <MapPin className="h-3.5 w-3.5 text-[#0284c7]" />
                          {m.venue}
                        </span>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                          <Users className="h-3.5 w-3.5" />
                          {playedCount} cầu thủ ra sân
                        </span>
                      </div>
                      {isManager && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/70">
                          <span>
                            Tiền sân:{" "}
                            <strong className="text-rose-600">
                              {formatVND(m.pitch_cost)}
                            </strong>
                          </span>
                          <span>Người chi: {m.payer_name || "Tiếng"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedFinishedMatch(m)}
                      className="text-xs font-bold text-[#1e4fc2] hover:text-[#0284c7] cursor-pointer"
                    >
                      Xem danh sách ra sân →
                    </button>

                    {isManager && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleMoveMatchStatus(m, "Sắp diễn ra")
                          }
                          title="Đưa trận này trở lại mục Lịch Tuần & Điểm Danh"
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Mở lại</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(m)}
                          className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          title="Sửa trận đấu"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMatch(m.id, m.label)}
                          className="rounded border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 cursor-pointer"
                          title="Xoá trận đấu"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal xem chi tiết một trận đấu đã kết thúc */}
      <ModalDialog
        isOpen={Boolean(selectedFinishedMatch)}
        onClose={() => setSelectedFinishedMatch(null)}
        title={
          selectedFinishedMatch
            ? `Chi Tiết Trận Đã Kết Thúc: ${selectedFinishedMatch.label}`
            : "Chi tiết trận đấu"
        }
        subtitle={
          selectedFinishedMatch
            ? `${selectedFinishedMatch.venue} • Ngày ${formatDateVN(
                selectedFinishedMatch.match_date
              )}`
            : ""
        }
      >
        {selectedFinishedMatch && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 p-3 text-xs">
              <span>
                Sân: <strong>{selectedFinishedMatch.venue}</strong>
              </span>
              <span>
                Đối thủ: <strong>{selectedFinishedMatch.opponent}</strong>
              </span>
              {isManager && (
                <span>
                  Tiền sân:{" "}
                  <strong className="text-rose-600">
                    {formatVND(selectedFinishedMatch.pitch_cost)}
                  </strong>{" "}
                  ({selectedFinishedMatch.payer_name})
                </span>
              )}
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-2">
                Danh Sách Cầu Thủ Tham Gia Trận Này
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {players
                  .filter((p) => {
                    const a = attendances.find(
                      (att) =>
                        att.match_id === selectedFinishedMatch.id &&
                        att.player_id === p.id
                    );
                    return a?.attended === 1 || a?.paid === 1;
                  })
                  .map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2 text-xs"
                    >
                      <span className="font-bold text-slate-400 w-4">
                        {i + 1}.
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.avatar_url || "/uploads/avatars/member-1.jpg"}
                        alt={p.full_name}
                        className="h-8 w-8 rounded-lg object-cover border border-[#1e4fc2]"
                      />
                      <div>
                        <div className="font-bold text-slate-900">
                          {p.full_name} (#{p.jersey_number ?? "-"})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {p.position}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Modal Tạo / Sửa Lịch Thi Đấu */}
      <ModalDialog
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingMatch
            ? `Cập Nhật ${editingMatch.label}`
            : "Tạo Lịch Thi Đấu & Thông Báo Nhắc Tuần"
        }
        subtitle="Thiết lập lịch ra sân và tự động tạo bài thông báo chuẩn đăng Fanpage"
      >
        <form onSubmit={handleSaveMatch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="match-num"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Trận số
              </label>
              <input
                id="match-num"
                name="match_number"
                type="text"
                inputMode="numeric"
                required
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="match-label"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Tên hiển thị (VD: Trận 16 - 04/11)
              </label>
              <input
                id="match-label"
                name="label"
                type="text"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="match-date"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Ngày thi đấu
              </label>
              <input
                id="match-date"
                name="match_date"
                type="date"
                required
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label
                htmlFor="match-time"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Giờ bóng lăn
              </label>
              <input
                id="match-time"
                name="kickoff_time"
                type="time"
                required
                value={kickoffTime}
                onChange={(e) => setKickoffTime(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Chọn nhanh Sân & Tiền sân trong Modal */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2.5">
            <span className="text-xs font-extrabold uppercase text-amber-950 block">
              ⚡ Chọn nhanh Sân & Chi phí sân:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {VENUE_PRESETS.map((preset) => (
                <button
                  key={preset.venue}
                  type="button"
                  onClick={() => {
                    setVenue(preset.venue);
                    setPitchCost(String(preset.cost));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    venue === preset.venue
                      ? "bg-[#1e4fc2] text-[#ffc933] border-[#1e4fc2]"
                      : "bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  {preset.shortLabel}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên sân
                </label>
                <input
                  type="text"
                  required
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tiền sân (VND)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pitchCost}
                  onChange={(e) =>
                    setPitchCost(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="form-input font-bold text-rose-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Người chi sân
                </label>
                <select
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="form-select"
                >
                  {QUICK_PAYERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Đối thủ / Hình thức
              </label>
              <input
                type="text"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Tỷ số (Gò Nổi - Đối thủ)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="GN"
                  value={teamScore}
                  onChange={(e) =>
                    setTeamScore(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="form-input text-center"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Bạn"
                  value={opponentScore}
                  onChange={(e) =>
                    setOpponentScore(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="form-input text-center"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Không gian hiển thị
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="form-select font-semibold"
              >
                <option value="Sắp diễn ra">Lịch Tuần & Điểm Danh</option>
                <option value="Đã kết thúc">Các Trận Đã Kết Thúc</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs sm:text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={syncPitchExpense}
              onChange={(e) => setSyncPitchExpense(e.target.checked)}
              className="accent-[#1e4fc2] h-4 w-4 rounded"
            />
            <span>
              Tự động ghi{" "}
              <strong>Tiền sân ({formatVND(Number(pitchCost) || 0)})</strong>{" "}
              vào Sổ Chi Quỹ Đội
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#1e4fc2] px-5 py-2 text-sm font-bold text-[#ffc933] hover:bg-[#2f66dd] cursor-pointer"
            >
              {editingMatch ? "Lưu Cập Nhật" : "Tạo Lịch Mới"}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
