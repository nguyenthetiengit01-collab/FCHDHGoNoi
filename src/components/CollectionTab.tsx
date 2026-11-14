"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Save,
  RotateCcw,
  UserCheck,
  Search,
  AlertCircle,
} from "lucide-react";
import type { FullAppData, MutateActionFn, AuthSession } from "@/types/app";
import { formatVND, formatDateVN } from "@/lib/format";
import {
  type CollectionDraftState,
  getEffectiveAttendance,
  calculateDraftTotals,
  buildBatchPayloadItems,
  loadDraftFromStorage,
  saveDraftToStorage,
  clearDraftFromStorage,
} from "@/lib/collectionDraft";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  Select,
  StatCard,
} from "@/components/ui";

const VENUE_PRESETS = [
  { venue: "Sân Vĩnh Lộc", cost: 900000, shortLabel: "Vĩnh Lộc (900k)" },
  { venue: "Sân Vũ Khánh", cost: 1335000, shortLabel: "Vũ Khánh (1.335k)" },
  { venue: "Sân Gò Mây", cost: 950000, shortLabel: "Gò Mây (950k)" },
  { venue: "Sân DEMI", cost: 600000, shortLabel: "DEMI (600k)" },
];

const QUICK_PAYERS = ["Tiếng", "Tín", "H.Sơn", "Thịnh", "Huy", "Trí"];

type PlayerFilterStatus = "all" | "unpaid" | "paid" | "attended" | "absent";

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
  const [selectedWalkInPlayerId, setSelectedWalkInPlayerId] =
    useState<string>("");
  const [newWalkInName, setNewWalkInName] = useState<string>("");
  const [walkInAmount, setWalkInAmount] = useState<string>("100000");

  // Search & filter UI only (không làm thay đổi tổng thu hay draft)
  const [playerSearch, setPlayerSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<PlayerFilterStatus>("all");
  const [batchError, setBatchError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<
    | { type: "discard" }
    | { type: "switch_match"; matchId: number }
    | null
  >(null);

  const activeMatch =
    matches.find((m) => m.id === selectedMatchId) ||
    matches[matches.length - 1];

  // Local draft state cho trận đấu đang chọn (Record<number, DraftItem>)
  const [draft, setDraft] = useState<CollectionDraftState>(() =>
    activeMatch ? loadDraftFromStorage(activeMatch.id) : {}
  );

  const applyMatchSwitch = (newMatchId: number) => {
    setSelectedMatchId(newMatchId);
    setDraft(loadDraftFromStorage(newMatchId));
    setBatchError(null);
    const found = matches.find((x) => x.id === newMatchId);
    if (found) {
      setPitchVenue(found.venue || "Sân Vĩnh Lộc");
      setPitchCostInput(String(found.pitch_cost || 900000));
      setPitchPayer(
        (found.payer_name || "Tiếng").split("-")[0].trim() || "Tiếng"
      );
    }
  };

  // Khi đổi trận đấu: nạp draft của trận đó (hỏi xác nhận nếu đang có nháp chưa lưu)
  const handleSelectMatch = (newMatchId: number) => {
    if (selectedMatchId === newMatchId) return;
    const dirtyCount = Object.keys(draft).length;
    if (dirtyCount > 0) {
      setPendingConfirm({ type: "switch_match", matchId: newMatchId });
      return;
    }
    applyMatchSwitch(newMatchId);
  };

  // Đồng bộ draft vào localStorage mỗi khi draft thay đổi
  useEffect(() => {
    if (activeMatch) {
      saveDraftToStorage(activeMatch.id, draft);
    }
  }, [draft, activeMatch]);

  const [pitchVenue, setPitchVenue] = useState<string>(
    activeMatch?.venue || "Sân Vĩnh Lộc"
  );
  const [pitchCostInput, setPitchCostInput] = useState<string>(
    String(activeMatch?.pitch_cost || 900000)
  );
  const [pitchPayer, setPitchPayer] = useState<string>(
    (activeMatch?.payer_name || "Tiếng").split("-")[0].trim() || "Tiếng"
  );

  const matchAtts = useMemo(
    () =>
      activeMatch ? attendances.filter((a) => a.match_id === activeMatch.id) : [],
    [attendances, activeMatch]
  );

  const attByPlayer = useMemo(
    () => new Map(matchAtts.map((a) => [a.player_id, a])),
    [matchAtts]
  );

  // Lấy attendance thực tế sau khi đã áp dụng nháp cục bộ
  const getPlayerEffective = useCallback(
    (playerId: number) => {
      const defaultFee = activeMatch?.fee_per_player || 100000;
      const origAtt = attByPlayer.get(playerId);
      const draftItem = draft[playerId];
      const eff = getEffectiveAttendance(playerId, origAtt, draftItem, defaultFee);

      return {
        ...origAtt,
        paid: eff.paid,
        amount: eff.amount,
        attended: eff.attended,
        walk_in: eff.walk_in,
        isRemoved: eff.isRemoved,
        isDirty: eff.isDirty,
        rsvp_status: origAtt?.rsvp_status ?? ("none" as const),
        collected_by: origAtt?.collected_by || collectorName,
      };
    },
    [attByPlayer, draft, activeMatch, collectorName]
  );

  // Danh sách thu tiền trận = Các cầu thủ đã Điểm danh (rsvp_status === 'registered')
  // HOẶC các cầu thủ không đăng ký nhưng vẫn tham gia (walk_in === 1 || attended === 1 || paid === 1)
  const participatingPlayers = useMemo(() => {
    return players.filter((p) => {
      const eff = getPlayerEffective(p.id);
      if (eff.isRemoved) return false;
      return (
        eff.rsvp_status === "registered" ||
        eff.walk_in === 1 ||
        eff.attended === 1 ||
        eff.paid === 1
      );
    });
  }, [players, getPlayerEffective]);

  // Danh sách hiển thị sau khi lọc tìm kiếm / trạng thái (không ảnh hưởng totals)
  const visiblePlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    return participatingPlayers.filter((p) => {
      const eff = getPlayerEffective(p.id);
      if (statusFilter === "paid" && eff.paid !== 1) return false;
      if (statusFilter === "unpaid" && eff.paid === 1) return false;
      if (statusFilter === "attended" && eff.attended !== 1) return false;
      if (statusFilter === "absent" && eff.attended === 1) return false;

      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.short_name.toLowerCase().includes(q) ||
        String(p.jersey_number ?? "").includes(q)
      );
    });
  }, [participatingPlayers, getPlayerEffective, playerSearch, statusFilter]);

  // Các cầu thủ trong đội CHƯA đăng ký điểm danh & chưa có trong danh sách thu tiền
  const unregisteredPlayers = useMemo(() => {
    return players.filter(
      (p) => !participatingPlayers.some((joined) => joined.id === p.id)
    );
  }, [players, participatingPlayers]);

  // Tính toán tổng thu và số lượng theo nháp
  const totals = useMemo(() => {
    const defaultFee = activeMatch?.fee_per_player || 100000;
    return calculateDraftTotals(
      participatingPlayers,
      attByPlayer,
      draft,
      defaultFee
    );
  }, [participatingPlayers, attByPlayer, draft, activeMatch]);

  const dirtyCount = totals.dirtyCount;

  if (!activeMatch) {
    return (
      <Card>
        <EmptyState
          title="Chưa có trận đấu nào để thu tiền"
          description="Hãy tạo lịch thi đấu trước khi bắt đầu thu quỹ trận."
        />
      </Card>
    );
  }

  // Xử lý Toggle Thu Tiền (Lưu vào draft cục bộ, phản hồi ngay 0ms)
  // CHUẨN HÓA 3 TRẠNG THÁI: Không tự động chuyển attended = 1 khi chỉ nộp tiền
  const handleTogglePaidDraft = (playerId: number) => {
    const eff = getPlayerEffective(playerId);
    const newPaid = eff.paid === 1 ? 0 : 1;
    const defaultFee = activeMatch.fee_per_player || 100000;
    const newAmount =
      newPaid === 1
        ? eff.amount > 0
          ? eff.amount
          : defaultFee
        : eff.amount;

    setDraft((prev) => ({
      ...prev,
      [playerId]: {
        attended: eff.attended, // Giữ nguyên trạng thái ra sân thực tế
        paid: newPaid,
        amount: newAmount,
        walk_in: eff.walk_in,
        removed: false,
      },
    }));
  };

  // Xử lý Toggle Xác Nhận Có Mặt Ra Sân Thực Tế (Độc lập với việc đã nộp tiền hay chưa)
  const handleToggleAttendedDraft = (playerId: number) => {
    const eff = getPlayerEffective(playerId);
    const newAttended = eff.attended === 1 ? 0 : 1;

    setDraft((prev) => ({
      ...prev,
      [playerId]: {
        attended: newAttended,
        paid: eff.paid,
        amount: eff.amount,
        walk_in: eff.walk_in,
        removed: false,
      },
    }));
  };

  // Sửa số tiền thu trong draft
  const handleAmountChangeDraft = (playerId: number, rawVal: string) => {
    const num = Number(rawVal.replace(/[^0-9]/g, "")) || 0;
    const eff = getPlayerEffective(playerId);
    setDraft((prev) => ({
      ...prev,
      [playerId]: {
        attended: eff.attended,
        paid: eff.paid,
        amount: num,
        walk_in: eff.walk_in,
        removed: false,
      },
    }));
  };

  // Bỏ cầu thủ khỏi trận trong draft
  const handleRemoveFromMatchDraft = (playerId: number) => {
    setDraft((prev) => ({
      ...prev,
      [playerId]: {
        attended: 0,
        paid: 0,
        amount: 0,
        walk_in: 0,
        removed: true,
      },
    }));
  };

  // Huỷ bỏ các thay đổi nháp
  const handleDiscardDraft = () => {
    if (dirtyCount === 0) return;
    setPendingConfirm({ type: "discard" });
  };

  // Lưu toàn bộ phiếu thu lên máy chủ qua 1 Transaction Batch duy nhất (kèm Idempotency Key)
  const handleSaveBatch = async () => {
    if (dirtyCount === 0 || isSaving) return;
    const items = buildBatchPayloadItems(
      draft,
      attByPlayer,
      activeMatch.fee_per_player || 100000
    );
    if (items.length === 0) return;

    setBatchError(null);
    const idempotencyKey = `batch_${activeMatch.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      await onMutate("collect_match_fees_batch", {
        match_id: activeMatch.id,
        collected_by: collectorName,
        items,
        idempotency_key: idempotencyKey,
      });

      clearDraftFromStorage(activeMatch.id);
      setDraft({});
    } catch (err) {
      console.error("Lỗi khi lưu phiếu thu:", err);
      setBatchError(
        "Không thể lưu phiếu thu lên máy chủ. Dữ liệu nháp vẫn được giữ an toàn trên máy để bạn thử lại."
      );
    }
  };

  // Thêm thành viên có sẵn (Walk-in) trực tiếp vào draft
  const handleAddWalkInMemberToDraft = (playerId: number) => {
    const amt =
      Number(walkInAmount.replace(/[^0-9]/g, "")) ||
      activeMatch.fee_per_player ||
      100000;
    setDraft((prev) => ({
      ...prev,
      [playerId]: {
        attended: 1,
        paid: 1,
        amount: amt,
        walk_in: 1,
        removed: false,
      },
    }));
    setSelectedWalkInPlayerId("");
  };

  // Thêm khách mời mới ngoài danh sách: gọi server tạo record
  const handleAddNewGuestWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalkInName.trim() || isSaving) return;
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
    <div className="space-y-6 pb-28">
      {/* Header Khu Vực Thu Tiền Trận (Chỉ dành cho Ban Quản Lý) */}
      <Card className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1.5">
            <Badge variant="navy" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#d4af37]" />
              <span>
                Phân hệ Thu Tiền Trận — Ban Quản Lý (
                {managers.map((m) => m.short_name).join(", ")})
              </span>
            </Badge>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#092244] tracking-tight">
              Thu Tiền Trận Nhanh — {activeMatch.label}
            </h2>
            <p className="text-xs text-slate-600">
              {formatDateVN(activeMatch.match_date)} • {activeMatch.venue} • Thao tác tức thì, bấm{" "}
              <strong>Lưu Phiếu Thu</strong> để đồng bộ nguyên tử lên máy chủ.
            </p>
          </div>

          {/* Chọn Trận Đấu & Người Phụ Trách Thu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-[300px] lg:min-w-[420px]">
            <FormField label="Chọn Trận Đấu Cần Thu" htmlFor="collect-match-select">
              <Select
                id="collect-match-select"
                value={activeMatch.id}
                onChange={(e) => handleSelectMatch(Number(e.target.value))}
                className="font-bold text-[#092244]"
              >
                {matches
                  .slice()
                  .reverse()
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({formatDateVN(m.match_date)} - {m.venue})
                    </option>
                  ))}
              </Select>
            </FormField>

            <FormField label="Người Quản Lý Thu Tiền" htmlFor="collect-manager-select">
              <Select
                id="collect-manager-select"
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
                className="font-semibold text-emerald-800"
              >
                {managers.map((m) => (
                  <option key={m.id} value={m.short_name}>
                    {m.full_name} ({m.short_name})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </div>

        {/* 4 Chỉ số nhanh của trận đang thu (Phản ánh trực tiếp nháp hiện tại) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Danh sách tham gia"
            value={`${participatingPlayers.length} cầu thủ`}
            hint={`Định mức: ${formatVND(activeMatch.fee_per_player)}/người`}
            accent="navy"
          />
          <StatCard
            label={`Đã thu (${totals.totalPaidCount} người)`}
            value={formatVND(totals.totalCollected)}
            hint="Theo nháp & dữ liệu hiện tại"
            accent="emerald"
          />
          <StatCard
            label="Chưa nộp tiền trận"
            value={`${totals.totalUnpaidCount} người`}
            hint={
              totals.totalUnpaidCount > 0
                ? "Cần đối chiếu & thu thêm"
                : "Đã hoàn tất thu trận này"
            }
            accent="amber"
          />
          <StatCard
            label={`Tiền sân (${activeMatch.venue})`}
            value={formatVND(activeMatch.pitch_cost)}
            hint={`Người chi: ${activeMatch.payer_name || "Tiếng"}`}
            accent="rose"
          />
        </div>

        {/* HỘP CHI TIỀN SÂN NHANH DÀNH CHO BAN QUẢN LÝ */}
        <div className="rounded-xl bg-[#092244]/[0.03] border border-[#0d2e5b]/15 p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#092244]">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#0d2e5b] text-[#fde047]">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <span>
                Chi Tiền Sân Nhanh ({activeMatch.label}) — Chọn sân & người chi 1 chạm
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {VENUE_PRESETS.map((preset) => {
                const isSelected =
                  pitchVenue === preset.venue &&
                  Number(pitchCostInput) === preset.cost;
                return (
                  <button
                    key={preset.venue}
                    type="button"
                    onClick={() => {
                      setPitchVenue(preset.venue);
                      setPitchCostInput(String(preset.cost));
                    }}
                    className={`min-h-9 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      isSelected
                        ? "bg-[#0d2e5b] text-[#fde047] border-[#0d2e5b]"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {preset.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            <div className="sm:col-span-3">
              <Input
                type="text"
                aria-label="Sân thi đấu"
                value={pitchVenue}
                onChange={(e) => setPitchVenue(e.target.value)}
                className="text-xs font-bold text-slate-900"
              />
            </div>
            <div className="sm:col-span-3">
              <Input
                type="text"
                inputMode="numeric"
                aria-label="Số tiền sân"
                value={pitchCostInput}
                onChange={(e) =>
                  setPitchCostInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="text-xs font-extrabold text-rose-600 tabular-nums"
              />
            </div>
            <div className="sm:col-span-4 flex flex-wrap items-center gap-1.5">
              {QUICK_PAYERS.map((pName) => (
                <button
                  key={pName}
                  type="button"
                  onClick={() => setPitchPayer(pName)}
                  className={`min-h-9 px-2.5 py-1 rounded-md text-xs font-bold border transition cursor-pointer ${
                    pitchPayer === pName
                      ? "bg-[#0d2e5b] text-[#fde047] border-[#0d2e5b]"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {pName}
                </button>
              ))}
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={isSaving}
                onClick={() =>
                  onMutate("quick_pitch_expense", {
                    match_id: activeMatch.id,
                    venue: pitchVenue,
                    pitch_cost:
                      Number(pitchCostInput.replace(/[^0-9]/g, "")) || 0,
                    payer_name: pitchPayer,
                  })
                }
                className="w-full min-h-10 sm:min-h-9"
              >
                Lưu Chi Sân
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {batchError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{batchError}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setBatchError(null)}
          >
            Đóng
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái (8 cols): Danh sách cầu thủ tham gia trận này để nhập tiền & bấm tích */}
        <Card className="lg:col-span-8 space-y-4">
          <CardHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wallet className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>
                  Danh Sách Cầu Thủ Tham Gia & Thu Tiền ({activeMatch.label})
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  RSVP, Ra sân thực tế và Đã nộp tiền là 3 trạng thái độc lập • Nhớ bấm &quot;Lưu Phiếu Thu&quot; ở thanh dưới
                </p>
              </div>
            </div>
            <Badge variant="neutral" className="tabular-nums">
              Định mức: {formatVND(activeMatch.fee_per_player)}
            </Badge>
          </CardHeader>

          {/* Thanh tìm kiếm & lọc trạng thái */}
          {participatingPlayers.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="search"
                  aria-label="Tìm cầu thủ trong phiếu thu"
                  placeholder="Tìm tên hoặc số áo..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: "all", label: `Tất cả (${participatingPlayers.length})` },
                    { key: "unpaid", label: `Chưa nộp (${totals.totalUnpaidCount})` },
                    { key: "paid", label: `Đã thu (${totals.totalPaidCount})` },
                    { key: "attended", label: "Ra sân" },
                    { key: "absent", label: "Vắng mặt" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatusFilter(item.key)}
                    className={`min-h-9 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      statusFilter === item.key
                        ? "bg-[#0d2e5b] text-white border-[#0d2e5b]"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {participatingPlayers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Chưa có cầu thủ nào trong danh sách tham gia trận này"
              description="Bạn có thể bổ sung nhanh thành viên hoặc khách mời từ khung bên phải."
            />
          ) : visiblePlayers.length === 0 ? (
            <EmptyState
              title="Không tìm thấy cầu thủ phù hợp"
              description="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPlayerSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Xoá bộ lọc
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {visiblePlayers.map((p, index) => {
                const eff = getPlayerEffective(p.id);
                const isPaid = eff.paid === 1;
                const isWalkIn =
                  eff.walk_in === 1 && eff.rsvp_status !== "registered";
                const isDirty = eff.isDirty;

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      isPaid
                        ? "bg-emerald-50/40"
                        : "bg-white hover:bg-slate-50/80"
                    } ${isDirty ? "ring-1 ring-inset ring-amber-400 bg-amber-50/30" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-slate-400 w-5 tabular-nums">
                        {index + 1}.
                      </span>
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0d2e5b] text-white text-xs font-extrabold tabular-nums">
                        #{p.jersey_number ?? "-"}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-[#092244]">
                            {p.full_name}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({p.short_name})
                          </span>
                          {/* 4 trạng thái độc lập giữa Attended và Paid */}
                          {eff.attended === 1 && isPaid ? (
                            <Badge variant="success">Ra sân • Đã nộp</Badge>
                          ) : eff.attended === 1 && !isPaid ? (
                            <Badge variant="warning">Ra sân • Chưa nộp</Badge>
                          ) : eff.attended === 0 && isPaid ? (
                            <Badge variant="purple">Vắng mặt • Ủng hộ</Badge>
                          ) : (
                            <Badge variant="neutral">Đã báo • Chưa ra sân</Badge>
                          )}

                          {isWalkIn && <Badge variant="info">Vãng lai</Badge>}
                          {isDirty && (
                            <Badge variant="gold" className="animate-pulse">
                              Lưu tạm
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {p.position}
                          {isPaid && (eff.collected_by || collectorName)
                            ? ` • Người thu: ${eff.collected_by || collectorName}`
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
                          value={eff.amount > 0 ? String(eff.amount) : "0"}
                          onChange={(e) =>
                            handleAmountChangeDraft(p.id, e.target.value)
                          }
                          className="w-full min-h-11 sm:min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 pr-6 text-right text-sm font-bold text-[#092244] tabular-nums focus-visible:outline-2 focus-visible:outline-[#0d2e5b]"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                          đ
                        </span>
                      </div>

                      {/* Nút độc lập: Xác nhận Ra sân / Vắng mặt */}
                      <button
                        type="button"
                        onClick={() => handleToggleAttendedDraft(p.id)}
                        title={
                          eff.attended === 1
                            ? "Cầu thủ có mặt ra sân (Bấm để chuyển vắng)"
                            : "Cầu thủ vắng mặt (Bấm để xác nhận có mặt ra sân)"
                        }
                        className={`inline-flex items-center gap-1 min-h-11 sm:min-h-9 rounded-lg px-2.5 py-2 text-xs font-bold transition cursor-pointer select-none ${
                          eff.attended === 1
                            ? "bg-[#092244] text-emerald-400 hover:bg-[#0d2e5b]"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <UserCheck
                          className={`h-3.5 w-3.5 ${
                            eff.attended === 1
                              ? "text-emerald-400"
                              : "text-slate-400"
                          }`}
                        />
                        <span>{eff.attended === 1 ? "Ra sân" : "Vắng"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTogglePaidDraft(p.id)}
                        className={`inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 rounded-lg px-3.5 py-2 text-xs font-extrabold transition cursor-pointer select-none ${
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
                        onClick={() => handleRemoveFromMatchDraft(p.id)}
                        aria-label={`Bỏ ${p.full_name} khỏi danh sách thu`}
                        title="Cầu thủ này thực tế không ra sân (Bỏ khỏi danh sách thu)"
                        className="inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Cột phải (4 cols): Bổ sung cầu thủ KHÔNG đăng ký trước nhưng vẫn tham gia */}
        <Card className="lg:col-span-4 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-[#092244]">
              <UserPlus className="h-5 w-5 text-[#17488c]" />
              <h3 className="text-base font-bold">
                Thêm Cầu Thủ Vào Phiếu Thu
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Dành cho anh em quên báo danh trên web hoặc khách mời/giao lưu ngoài danh sách.
            </p>
          </div>

          {/* Mức tiền áp dụng khi thêm nhanh */}
          <FormField
            label="Số tiền thu mặc định khi thêm (VND)"
            htmlFor="walkin-fee-input"
          >
            <Input
              id="walkin-fee-input"
              type="text"
              inputMode="numeric"
              value={walkInAmount}
              onChange={(e) =>
                setWalkInAmount(e.target.value.replace(/[^0-9]/g, ""))
              }
              className="font-bold text-emerald-800 tabular-nums"
            />
          </FormField>

          {/* Cách 1: Chọn từ danh sách thành viên trong đội chưa có trong phiếu */}
          <div className="space-y-2.5">
            <label
              htmlFor="walkin-member-select"
              className="block text-sm font-bold text-[#092244]"
            >
              1. Thành viên trong đội ({unregisteredPlayers.length})
            </label>
            <div className="flex gap-2">
              <Select
                id="walkin-member-select"
                value={selectedWalkInPlayerId}
                onChange={(e) => setSelectedWalkInPlayerId(e.target.value)}
                className="flex-1 text-sm"
              >
                <option value="">-- Chọn cầu thủ ra sân --</option>
                {unregisteredPlayers.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    #{p.jersey_number ?? "-"} - {p.full_name} ({p.short_name})
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!selectedWalkInPlayerId}
                onClick={() =>
                  handleAddWalkInMemberToDraft(Number(selectedWalkInPlayerId))
                }
                className="shrink-0 min-h-11 sm:min-h-9"
              >
                + Thêm & Thu
              </Button>
            </div>

            {/* Danh sách bấm nhanh 1 chạm */}
            {unregisteredPlayers.length > 0 && (
              <div className="pt-1">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  Bấm nhanh tên để đưa vào phiếu thu:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1">
                  {unregisteredPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddWalkInMemberToDraft(p.id)}
                      className="inline-flex items-center gap-1 min-h-9 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-emerald-900 transition cursor-pointer"
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

          {/* Cách 2: Thêm cầu thủ mới / khách đá ké chưa có trong danh sách */}
          <form
            onSubmit={handleAddNewGuestWalkIn}
            className="pt-4 border-t border-slate-200 space-y-2.5"
          >
            <label
              htmlFor="new-walkin-name"
              className="block text-sm font-bold text-[#092244]"
            >
              2. Cầu thủ mới / Khách mời ngoài danh sách
            </label>
            <div className="flex gap-2">
              <Input
                id="new-walkin-name"
                type="text"
                placeholder="Nhập họ tên cầu thủ..."
                value={newWalkInName}
                onChange={(e) => setNewWalkInName(e.target.value)}
                className="flex-1 text-sm"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                loading={isSaving}
                disabled={!newWalkInName.trim() || isSaving}
                className="shrink-0 min-h-11 sm:min-h-9"
              >
                Thêm & Thu
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* THANH TÁC VỤ CỐ ĐỊNH Ở ĐÁY: HIỆN SỐ LƯỢNG THAY ĐỔI & NÚT LƯU PHIẾU THU */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#081a33]/95 backdrop-blur-md border-t border-white/10 px-4 py-3 shadow-2xl transition-transform">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {dirtyCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/50 px-3 py-1 text-xs font-extrabold text-[#fde047]">
                <span className="h-2 w-2 rounded-full bg-[#fde047] animate-ping" />
                <span>{dirtyCount} thay đổi chưa lưu</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Đã đồng bộ với máy chủ</span>
              </span>
            )}

            <div className="text-xs text-slate-300 hidden md:block">
              {activeMatch.label} • Thu bởi:{" "}
              <strong className="text-white">{collectorName}</strong>
              {totals.netAmountDiff !== 0 && (
                <span className="ml-2 font-bold text-[#fde047] tabular-nums">
                  ({totals.netAmountDiff > 0 ? "+" : ""}
                  {formatVND(totals.netAmountDiff)})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {dirtyCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={handleDiscardDraft}
                leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                className="min-h-11 sm:min-h-9 border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white"
              >
                Huỷ Thay Đổi
              </Button>
            )}

            <Button
              type="button"
              variant="gold"
              size="md"
              loading={isSaving}
              disabled={dirtyCount === 0 || isSaving}
              onClick={handleSaveBatch}
              leftIcon={<Save className="h-4 w-4" />}
              className={`min-h-11 sm:min-h-10 font-extrabold ${
                dirtyCount > 0 && !isSaving
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-500"
                  : ""
              }`}
            >
              {isSaving
                ? "Đang ghi nhận..."
                : dirtyCount > 0
                ? `Lưu Phiếu Thu (${dirtyCount})`
                : "Phiếu Thu Đã Lưu"}
            </Button>
          </div>
        </div>
      </div>

      {/* ConfirmDialog cho Huỷ Nháp hoặc Đổi Trận khi có thay đổi chưa lưu */}
      <ConfirmDialog
        isOpen={Boolean(pendingConfirm)}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (!pendingConfirm) return;
          if (pendingConfirm.type === "discard") {
            clearDraftFromStorage(activeMatch.id);
            setDraft({});
          } else if (pendingConfirm.type === "switch_match") {
            applyMatchSwitch(pendingConfirm.matchId);
          }
          setPendingConfirm(null);
        }}
        title={
          pendingConfirm?.type === "discard"
            ? "Huỷ các thay đổi nháp?"
            : "Chuyển sang trận đấu khác?"
        }
        description={
          pendingConfirm?.type === "discard"
            ? `Bạn có chắc muốn huỷ bỏ ${dirtyCount} thay đổi thu tiền chưa lưu của ${activeMatch.label}?`
            : `Bạn đang có ${dirtyCount} thay đổi chưa lưu ở ${activeMatch.label}. Các thay đổi nháp vẫn được giữ tạm trên máy nếu bạn chuyển trận.`
        }
        confirmLabel={
          pendingConfirm?.type === "discard" ? "Huỷ Thay Đổi" : "Chuyển Trận"
        }
        danger={pendingConfirm?.type === "discard"}
      />
    </div>
  );
}
