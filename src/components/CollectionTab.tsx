"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  UserPlus,
  ShieldCheck,
  Wallet,
  Users,
  XCircle,
  Plus,
  Zap,
} from "lucide-react";
import type { FullAppData, MutateActionFn, AuthSession } from "@/types/app";
import { formatVND, formatDateVN } from "@/lib/format";

const VENUE_PRESETS = [
  { venue: "Sân Vĩnh Lộc", cost: 900000, shortLabel: "Vĩnh Lộc (900k)" },
  { venue: "Sân Vũ Khánh", cost: 1335000, shortLabel: "Vũ Khánh (1.335k)" },
  { venue: "Sân Gò Mây", cost: 950000, shortLabel: "Gò Mây (950k)" },
  { venue: "Sân DEMI", cost: 600000, shortLabel: "DEMI (600k)" },
];

const QUICK_PAYERS = ["Tiếng", "Tín", "H.Sơn", "Thịnh", "Huy", "Trí"];

interface CollectionTabProps {
  data: FullAppData;
  session: AuthSession;
  onMutate: MutateActionFn;
  isSaving: boolean;
}

export function CollectionTab({
  data,
  session,
  onMutate,
  isSaving,
}: CollectionTabProps) {
  const { matches, players, attendances } = data;
  const managers = players.filter((p) => p.access_role === "manager");

  const [selectedMatchId, setSelectedMatchId] = useState<number>(
    matches[matches.length - 1]?.id ?? 1
  );
  const [collectorName, setCollectorName] = useState<string>(
    session.shortName || managers[0]?.short_name || "Tiếng"
  );
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});
  const [selectedWalkInPlayerId, setSelectedWalkInPlayerId] =
    useState<string>("");
  const [newWalkInName, setNewWalkInName] = useState<string>("");
  const [walkInAmount, setWalkInAmount] = useState<string>("100000");

  const activeMatch =
    matches.find((m) => m.id === selectedMatchId) ||
    matches[matches.length - 1];

  const [pitchVenue, setPitchVenue] = useState<string>(
    activeMatch?.venue || "Sân Vĩnh Lộc"
  );
  const [pitchCostInput, setPitchCostInput] = useState<string>(
    String(activeMatch?.pitch_cost || 900000)
  );
  const [pitchPayer, setPitchPayer] = useState<string>(
    (activeMatch?.payer_name || "Tiếng").split("-")[0].trim() || "Tiếng"
  );

  if (!activeMatch) {
    return (
      <div className="rounded-xl bg-white p-8 text-center border border-slate-200">
        Chưa có trận đấu nào để thu tiền.
      </div>
    );
  }

  const matchAtts = attendances.filter((a) => a.match_id === activeMatch.id);
  const attByPlayer = new Map(matchAtts.map((a) => [a.player_id, a]));

  // Danh sách thu tiền trận = Các cầu thủ đã Điểm danh (rsvp_status === 'registered')
  // HOẶC các cầu thủ không đăng ký nhưng vẫn tham gia (walk_in === 1 || attended === 1 || paid === 1)
  const participatingPlayers = players.filter((p) => {
    const a = attByPlayer.get(p.id);
    if (!a) return false;
    return (
      a.rsvp_status === "registered" ||
      a.walk_in === 1 ||
      a.attended === 1 ||
      a.paid === 1
    );
  });

  // Các cầu thủ trong đội CHƯA đăng ký điểm danh & chưa có trong danh sách thu tiền
  const unregisteredPlayers = players.filter(
    (p) => !participatingPlayers.some((joined) => joined.id === p.id)
  );

  const totalCollected = matchAtts
    .filter((a) => a.paid === 1)
    .reduce((s, a) => s + a.amount, 0);
  const totalPaidCount = matchAtts.filter((a) => a.paid === 1).length;
  const totalUnpaidCount = participatingPlayers.filter((p) => {
    const a = attByPlayer.get(p.id);
    return !a || a.paid === 0;
  }).length;

  const getPlayerInputAmount = (playerId: number): number => {
    const existing = attByPlayer.get(playerId);
    if (customAmounts[playerId] !== undefined) {
      return Number(customAmounts[playerId].replace(/[^0-9]/g, "")) || 0;
    }
    if (existing && existing.amount > 0) {
      return existing.amount;
    }
    return activeMatch.fee_per_player || 100000;
  };

  const handleTogglePaid = async (playerId: number, markPaid: boolean) => {
    const amt = getPlayerInputAmount(playerId);
    const existing = attByPlayer.get(playerId);
    await onMutate("collect_match_fee", {
      match_id: activeMatch.id,
      player_id: playerId,
      attended: 1,
      paid: markPaid ? 1 : 0,
      amount: amt,
      walk_in: existing?.walk_in ?? 0,
      collected_by: collectorName,
    });
  };

  const handleUpdateAmountBlur = async (playerId: number) => {
    const existing = attByPlayer.get(playerId);
    if (!existing || existing.paid === 0) return;
    const amt = getPlayerInputAmount(playerId);
    if (amt === existing.amount) return;
    await onMutate("collect_match_fee", {
      match_id: activeMatch.id,
      player_id: playerId,
      attended: 1,
      paid: 1,
      amount: amt,
      walk_in: existing.walk_in,
      collected_by: collectorName,
    });
  };

  const handleRemoveFromMatch = async (playerId: number) => {
    await onMutate("collect_match_fee", {
      match_id: activeMatch.id,
      player_id: playerId,
      attended: 0,
      paid: 0,
      amount: 0,
      walk_in: 0,
      collected_by: collectorName,
    });
    await onMutate("set_rsvp", {
      match_id: activeMatch.id,
      player_id: playerId,
      rsvp_status: "absent_notice",
    });
  };

  const handleAddWalkInMember = async (
    playerId: number,
    immediatePaid: boolean
  ) => {
    const amt =
      Number(walkInAmount.replace(/[^0-9]/g, "")) ||
      activeMatch.fee_per_player ||
      100000;
    await onMutate("add_walkin_player", {
      match_id: activeMatch.id,
      player_id: playerId,
      amount: amt,
      paid: immediatePaid ? 1 : 0,
      collected_by: collectorName,
    });
    setSelectedWalkInPlayerId("");
  };

  const handleAddNewGuestWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalkInName.trim()) return;
    const amt =
      Number(walkInAmount.replace(/[^0-9]/g, "")) ||
      activeMatch.fee_per_player ||
      100000;
    await onMutate("add_walkin_player", {
      match_id: activeMatch.id,
      new_player_name: newWalkInName.trim(),
      amount: amt,
      paid: 1,
      collected_by: collectorName,
    });
    setNewWalkInName("");
  };

  return (
    <div className="space-y-6">
      {/* Header Khu Vực Thu Tiền Trận (Chỉ dành cho Ban Quản Lý) */}
      <div className="rounded-xl bg-white p-5 border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-900">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>
                Phân hệ Thu Tiền Trận — Ban Quản Lý (
                {managers.map((m) => m.short_name).join(", ")})
              </span>
            </div>
            <h2 className="mt-1.5 text-lg sm:text-xl font-extrabold text-slate-900">
              Thu Tiền Trận Dựa Trên Danh Sách Điểm Danh
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Nhập số tiền thực thu & bấm tích xác nhận cho các cầu thủ đã điểm
              danh, hoặc bổ sung cầu thủ không đăng ký trước nhưng vẫn ra sân.
            </p>
          </div>

          {/* Chọn Trận Đấu & Người Phụ Trách Thu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-[320px]">
            <div>
              <label
                htmlFor="collect-match-select"
                className="block text-xs font-bold uppercase text-slate-500 mb-1"
              >
                Chọn Trận Đấu Cần Thu
              </label>
              <select
                id="collect-match-select"
                value={activeMatch.id}
                onChange={(e) => {
                  const idNum = Number(e.target.value);
                  setSelectedMatchId(idNum);
                  const found = matches.find((x) => x.id === idNum);
                  if (found) {
                    setPitchVenue(found.venue || "Sân Vĩnh Lộc");
                    setPitchCostInput(String(found.pitch_cost || 900000));
                    setPitchPayer(
                      (found.payer_name || "Tiếng").split("-")[0].trim() ||
                        "Tiếng"
                    );
                  }
                }}
                className="form-select font-bold text-slate-900"
              >
                {matches
                  .slice()
                  .reverse()
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({formatDateVN(m.match_date)} - {m.venue})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="collect-manager-select"
                className="block text-xs font-bold uppercase text-slate-500 mb-1"
              >
                Người Quản Lý Đang Thu
              </label>
              <select
                id="collect-manager-select"
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
                className="form-select font-semibold text-emerald-800"
              >
                {managers.map((m) => (
                  <option key={m.id} value={m.short_name}>
                    {m.full_name} ({m.short_name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4 Chỉ số nhanh của trận đang thu */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
            <span className="text-xs text-slate-500 font-semibold block">
              Danh sách tham gia
            </span>
            <span className="mt-1 text-lg font-extrabold text-slate-900 block">
              {participatingPlayers.length} cầu thủ
            </span>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
            <span className="text-xs text-emerald-800 font-semibold block">
              Đã thu tiền ({totalPaidCount} người)
            </span>
            <span className="mt-1 text-lg font-extrabold text-emerald-700 block">
              {formatVND(totalCollected)}
            </span>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5">
            <span className="text-xs text-amber-800 font-semibold block">
              Chưa nộp tiền trận
            </span>
            <span className="mt-1 text-lg font-extrabold text-amber-900 block">
              {totalUnpaidCount} người
            </span>
          </div>
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5">
            <span className="text-xs text-rose-800 font-semibold block">
              Tiền sân ({activeMatch.venue})
            </span>
            <span className="mt-1 text-lg font-extrabold text-rose-600 block">
              {formatVND(activeMatch.pitch_cost)} ({activeMatch.payer_name || "Tiếng"})
            </span>
          </div>
        </div>

        {/* HỘP CHI TIỀN SÂN NHANH DÀNH CHO BAN QUẢN LÝ NGAY TRONG MÀN HÌNH THU TIỀN */}
        <div className="rounded-xl bg-amber-50/90 border border-[#ffc933] p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1e4fc2]">
              <Zap className="h-4 w-4 text-amber-600" />
              <span>
                Chi Tiền Sân Nhanh ({activeMatch.label}) — Chọn sân & người chi
                1 chạm:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {VENUE_PRESETS.map((preset) => (
                <button
                  key={preset.venue}
                  type="button"
                  onClick={() => {
                    setPitchVenue(preset.venue);
                    setPitchCostInput(String(preset.cost));
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    pitchVenue === preset.venue &&
                    Number(pitchCostInput) === preset.cost
                      ? "bg-[#1e4fc2] text-[#ffc933] border-[#1e4fc2]"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  🏟️ {preset.shortLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <div className="sm:col-span-3">
              <input
                type="text"
                aria-label="Sân thi đấu"
                value={pitchVenue}
                onChange={(e) => setPitchVenue(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
              />
            </div>
            <div className="sm:col-span-3">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Số tiền sân"
                value={pitchCostInput}
                onChange={(e) =>
                  setPitchCostInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-extrabold text-rose-600"
              />
            </div>
            <div className="sm:col-span-4 flex flex-wrap items-center gap-1">
              {QUICK_PAYERS.map((pName) => (
                <button
                  key={pName}
                  type="button"
                  onClick={() => setPitchPayer(pName)}
                  className={`px-2 py-1 rounded-md text-xs font-bold border transition cursor-pointer ${
                    pitchPayer === pName
                      ? "bg-[#1e4fc2] text-[#ffc933] border-[#1e4fc2]"
                      : "bg-white text-slate-700 border-slate-300"
                  }`}
                >
                  {pName}
                </button>
              ))}
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  onMutate("quick_pitch_expense", {
                    match_id: activeMatch.id,
                    venue: pitchVenue,
                    pitch_cost:
                      Number(pitchCostInput.replace(/[^0-9]/g, "")) || 0,
                    payer_name: pitchPayer,
                  })
                }
                className="w-full rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1.5 text-xs font-extrabold text-white transition cursor-pointer"
              >
                Lưu Chi Sân
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái (8 cols): Danh sách cầu thủ tham gia trận này để nhập tiền & bấm tích */}
        <section className="lg:col-span-8 rounded-xl bg-white p-5 border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-700" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Danh Sách Cầu Thủ Tham Gia & Thu Tiền ({activeMatch.label})
                </h3>
                <p className="text-xs text-slate-500">
                  Tự động lấy từ danh sách Điểm danh tuần + các cầu thủ bổ sung
                  tại sân
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-600">
              Định mức chuẩn: <strong>{formatVND(activeMatch.fee_per_player)}</strong>
            </span>
          </div>

          {participatingPlayers.length === 0 ? (
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-8 text-center space-y-2">
              <Users className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                Chưa có cầu thủ nào đăng ký điểm danh ở trận này
              </p>
              <p className="text-xs text-slate-500">
                Bạn có thể nhắc anh em vào mục <strong>Lịch & Điểm Danh</strong>{" "}
                để báo danh, hoặc thêm trực tiếp ở khung bên phải.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {participatingPlayers.map((p, index) => {
                const att = attByPlayer.get(p.id);
                const isPaid = att?.paid === 1;
                const isWalkIn =
                  att?.walk_in === 1 && att?.rsvp_status !== "registered";
                const inputVal =
                  customAmounts[p.id] !== undefined
                    ? customAmounts[p.id]
                    : String(
                        att && att.amount > 0
                          ? att.amount
                          : activeMatch.fee_per_player || 100000
                      );

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      isPaid ? "bg-emerald-50/50" : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-slate-400 w-5">
                        {index + 1}.
                      </span>
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-extrabold">
                        #{p.jersey_number ?? "-"}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">
                            {p.full_name}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({p.short_name})
                          </span>
                          {isWalkIn ? (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-900">
                              Không đăng ký trước • Vẫn tham gia
                            </span>
                          ) : (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                              Đã điểm danh
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {p.position}
                          {isPaid && att?.collected_by
                            ? ` • Người thu: ${att.collected_by}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    {/* Ô nhập số tiền & Nút bấm tích xác nhận thu */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <div className="relative w-28 sm:w-32">
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Số tiền thu của ${p.full_name}`}
                          value={inputVal}
                          onChange={(e) =>
                            setCustomAmounts((prev) => ({
                              ...prev,
                              [p.id]: e.target.value.replace(/[^0-9]/g, ""),
                            }))
                          }
                          onBlur={() => handleUpdateAmountBlur(p.id)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 pr-6 text-right text-sm font-bold text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                          đ
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleTogglePaid(p.id, !isPaid)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-extrabold transition cursor-pointer ${
                          isPaid
                            ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                            : "bg-amber-400 text-slate-950 hover:bg-amber-500"
                        }`}
                      >
                        {isPaid ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Đã Thu</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-4 w-4" />
                            <span>Bấm Thu</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleRemoveFromMatch(p.id)}
                        title="Cầu thủ này thực tế không ra sân (Bỏ khỏi danh sách thu)"
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Cột phải (4 cols): Bổ sung cầu thủ KHÔNG đăng ký trước nhưng vẫn tham gia */}
        <section className="lg:col-span-4 rounded-xl bg-white p-5 border border-slate-200 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-purple-900">
              <UserPlus className="h-5 w-5 text-purple-700" />
              <h3 className="text-base font-bold">
                Thêm Cầu Thủ Không Đăng Ký Vẫn Tham Gia
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dành cho cầu thủ quên điểm danh trên app nhưng vẫn ra sân đá, hoặc
              khách mời / anh em mới tham gia trận này.
            </p>
          </div>

          {/* Mức tiền áp dụng khi thêm nhanh */}
          <div>
            <label
              htmlFor="walkin-fee-input"
              className="block text-xs font-bold uppercase text-slate-500 mb-1"
            >
              Số tiền thu mặc định khi thêm (VND)
            </label>
            <input
              id="walkin-fee-input"
              type="text"
              inputMode="numeric"
              value={walkInAmount}
              onChange={(e) =>
                setWalkInAmount(e.target.value.replace(/[^0-9]/g, ""))
              }
              className="form-input font-bold text-emerald-800"
            />
          </div>

          {/* Cách 1: Chọn từ danh sách thành viên trong đội chưa đăng ký */}
          <div className="space-y-2.5">
            <label
              htmlFor="walkin-member-select"
              className="block text-sm font-bold text-slate-800"
            >
              1. Thành viên trong đội chưa điểm danh ({unregisteredPlayers.length})
            </label>
            <div className="flex gap-2">
              <select
                id="walkin-member-select"
                value={selectedWalkInPlayerId}
                onChange={(e) => setSelectedWalkInPlayerId(e.target.value)}
                className="form-select flex-1 text-sm"
              >
                <option value="">-- Chọn cầu thủ ra sân --</option>
                {unregisteredPlayers.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    #{p.jersey_number ?? "-"} - {p.full_name} ({p.short_name})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedWalkInPlayerId || isSaving}
                onClick={() =>
                  handleAddWalkInMember(Number(selectedWalkInPlayerId), true)
                }
                className="shrink-0 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-40 cursor-pointer"
              >
                + Thêm & Thu
              </button>
            </div>

            {/* Danh sách bấm nhanh 1 chạm */}
            {unregisteredPlayers.length > 0 && (
              <div className="pt-1">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  Hoặc bấm nhanh vào tên để đưa vào danh sách thu tiền:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1">
                  {unregisteredPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleAddWalkInMember(p.id, true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-emerald-900 transition cursor-pointer"
                    >
                      <Plus className="h-3 w-3 text-emerald-600" />
                      <span>
                        #{p.jersey_number ?? "-"} {p.short_name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cách 2: Thêm cầu thủ mới / khách đá ké chưa có trong danh sách 23 người */}
          <form
            onSubmit={handleAddNewGuestWalkIn}
            className="pt-4 border-t border-slate-200 space-y-2.5"
          >
            <label
              htmlFor="new-walkin-name"
              className="block text-sm font-bold text-slate-800"
            >
              2. Cầu thủ mới / Khách mời ngoài danh sách
            </label>
            <div className="flex gap-2">
              <input
                id="new-walkin-name"
                type="text"
                placeholder="Nhập họ tên cầu thủ..."
                value={newWalkInName}
                onChange={(e) => setNewWalkInName(e.target.value)}
                className="form-input flex-1 text-sm"
              />
              <button
                type="submit"
                disabled={!newWalkInName.trim() || isSaving}
                className="shrink-0 rounded-lg bg-purple-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-40 cursor-pointer"
              >
                Thêm & Thu
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

