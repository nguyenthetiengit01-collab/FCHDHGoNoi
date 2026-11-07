"use client";

import React, { useState } from "react";
import {
  UserPlus,
  Search,
  Phone,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Shield,
  KeyRound,
  RotateCcw,
  FileSpreadsheet,
  Printer,
  Upload,
  Lock,
  LayoutGrid,
} from "lucide-react";
import type {
  FullAppData,
  MutateActionFn,
  Player,
  AuthSession,
} from "@/types/app";
import { OFFICIAL_LOGO_URL } from "@/types/app";
import { formatVND, formatDateVN } from "@/lib/format";
import { convertFileToWebp } from "@/lib/imageToWebp";
import { ModalDialog } from "./ModalDialog";

interface PlayersTabProps {
  data: FullAppData;
  session: AuthSession;
  onMutate: MutateActionFn;
  isSaving: boolean;
}

const POSITIONS = ["Thủ môn", "Hậu vệ", "Tiền vệ", "Tiền đạo", "Đa năng"];
const ROLES = [
  "Thành viên",
  "Đội trưởng / Thủ quỹ",
  "Đội phó / Quản lý thu",
  "Ban quản lý / Thủ quỹ phụ",
];
const PRESET_AVATARS = Array.from(
  { length: 14 },
  (_, i) => `/uploads/avatars/member-${i + 1}.jpg`
);

export function PlayersTab({
  data,
  session,
  onMutate,
  isSaving,
}: PlayersTabProps) {
  const { players, matches, attendances, settings } = data;
  const isManager = session.role === "manager";

  // Chế độ xem: "cards" (Hồ sơ đội hình có ảnh) hoặc "roster" (Lập danh sách đăng ký thi đấu giải)
  const [viewMode, setViewMode] = useState<"cards" | "roster">("cards");
  const [selectedRosterIds, setSelectedRosterIds] = useState<number[]>(
    players.map((p) => p.id)
  );
  const [tournamentName, setTournamentName] = useState(
    "DANH SÁCH ĐĂNG KÝ THI ĐẤU — FC HĐH GÒ NỔI"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [filterPosition, setFilterPosition] = useState<string>("Tất cả");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);

  // Modal đổi mật khẩu cá nhân (cho chính cầu thủ đang đăng nhập)
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pwdError, setPwdError] = useState("");

  // Form states
  const [fullName, setFullName] = useState("");
  const [shortName, setShortName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [position, setPosition] = useState("Tiền vệ");
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("1991");
  const [avatarUrl, setAvatarUrl] = useState("/uploads/avatars/member-1.jpg");
  const [webpInfo, setWebpInfo] = useState("");
  const [isConvertingWebp, setIsConvertingWebp] = useState(false);
  const [role, setRole] = useState("Thành viên");
  const [accessRole, setAccessRole] = useState<"manager" | "player">("player");
  const [pinCode, setPinCode] = useState("1234");
  const [status, setStatus] = useState("Đang sinh hoạt");
  const [notes, setNotes] = useState("");

  // Chặn tuyệt đối nếu là Khách (Guest)
  if (session.role === "guest") {
    return (
      <div className="rounded-xl bg-white p-8 text-center border border-slate-200">
        <Lock className="h-8 w-8 text-slate-400 mx-auto mb-2" />
        <p className="font-bold text-slate-800">
          Thông tin đội hình chỉ dành cho Thành viên & Ban Quản Lý đã đăng nhập.
        </p>
      </div>
    );
  }

  function openAddPlayer() {
    if (!isManager) return;
    setEditingPlayer(null);
    setFullName("");
    setShortName("");
    setJerseyNumber("");
    setPosition("Tiền vệ");
    setPhone("");
    setBirthYear("1992");
    setAvatarUrl("/uploads/avatars/member-1.jpg");
    setWebpInfo("");
    setRole("Thành viên");
    setAccessRole("player");
    setPinCode("1234");
    setStatus("Đang sinh hoạt");
    setNotes("");
    setFormOpen(true);
  }

  function openEditPlayer(p: Player) {
    // Cầu thủ chỉ được sửa thông tin của chính mình; Quản lý sửa được tất cả
    if (!isManager && session.playerId !== p.id) return;
    setEditingPlayer(p);
    setFullName(p.full_name);
    setShortName(p.short_name);
    setJerseyNumber(p.jersey_number !== null ? String(p.jersey_number) : "");
    setPosition(p.position);
    setPhone(p.phone || "");
    setBirthYear(p.birth_year ? String(p.birth_year) : "1991");
    setAvatarUrl(p.avatar_url || "/uploads/avatars/member-1.jpg");
    setWebpInfo("");
    setRole(p.role);
    setAccessRole(p.access_role || "player");
    setPinCode(p.pin_code || "1234");
    setStatus(p.status);
    setNotes(p.notes || "");
    setFormOpen(true);
  }

  const handleImageFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsConvertingWebp(true);
    setWebpInfo("Đang tự động chuyển ảnh sang định dạng WebP...");
    try {
      const converted = await convertFileToWebp(file, {
        mode: "portrait",
        maxWidth: 600,
        maxHeight: 800,
        quality: 0.86,
      });
      setAvatarUrl(converted.dataUrl);
      setWebpInfo(
        `✅ Đã tự động chuyển sang chuẩn WebP (${converted.webpFileName} • ${converted.originalSizeKB}KB → ${converted.webpSizeKB}KB${
          converted.savedPercent > 0 ? `, nhẹ hơn ${converted.savedPercent}%` : ""
        })`
      );
    } catch {
      setWebpInfo("❌ Không thể xử lý ảnh. Vui lòng chọn file ảnh khác.");
    } finally {
      setIsConvertingWebp(false);
      e.target.value = "";
    }
  };

  async function handleSavePlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!isManager && editingPlayer && editingPlayer.id === session.playerId) {
      // Cầu thủ tự sửa thông tin của chính mình
      await onMutate("update_own_profile", {
        player_id: editingPlayer.id,
        short_name: shortName,
        jersey_number: jerseyNumber === "" ? null : Number(jerseyNumber),
        position,
        phone,
        birth_year: birthYear === "" ? null : Number(birthYear),
        avatar_url: avatarUrl,
        notes,
      });
      setFormOpen(false);
      return;
    }

    // Ban Quản Lý lưu toàn bộ thông tin & phân quyền
    await onMutate("upsert_player", {
      id: editingPlayer?.id,
      code_order: editingPlayer?.code_order,
      full_name: fullName,
      short_name: shortName,
      jersey_number: jerseyNumber === "" ? null : Number(jerseyNumber),
      position,
      phone,
      birth_year: birthYear === "" ? null : Number(birthYear),
      avatar_url: avatarUrl,
      role,
      access_role: accessRole,
      pin_code: pinCode,
      status,
      notes,
    });
    setFormOpen(false);
  }

  async function handleResetPassword(p: Player) {
    if (!isManager) return;
    if (
      !window.confirm(
        `Ban Quản Lý xác nhận reset mật khẩu (PIN) của cầu thủ "${p.full_name}" về mặc định "1234"?`
      )
    ) {
      return;
    }
    await onMutate("reset_player_password", {
      player_id: p.id,
      new_pin: "1234",
    });
  }

  async function handleChangeOwnPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!session.playerId) return;
    if (newPin.trim().length < 4) {
      setPwdError("Mật khẩu mới cần ít nhất 4 ký tự");
      return;
    }
    await onMutate("change_own_password", {
      player_id: session.playerId,
      old_pin: oldPin.trim(),
      new_pin: newPin.trim(),
    });
    setPwdModalOpen(false);
    setOldPin("");
    setNewPin("");
  }

  async function handleDeletePlayer(p: Player) {
    if (!isManager) return;
    if (
      !window.confirm(
        `Bạn có chắc muốn xoá hồ sơ cầu thủ "${p.full_name}" khỏi danh sách đội bóng?`
      )
    ) {
      return;
    }
    await onMutate("delete_player", { id: p.id });
  }

  const toggleRosterPlayer = (id: number) => {
    setSelectedRosterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const enrichedPlayers = players
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
      const rate =
        matches.length > 0
          ? Math.round((matchesPlayed / matches.length) * 100)
          : 0;
      return {
        ...p,
        matchesPlayed,
        totalPaid,
        unpaid,
        rate,
      };
    })
    .filter((p) => {
      if (filterPosition !== "Tất cả" && p.position !== filterPosition) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.short_name.toLowerCase().includes(q) ||
        String(p.jersey_number ?? "").includes(q) ||
        (isManager && p.phone.includes(q))
      );
    });

  const rosterPlayers = enrichedPlayers.filter((p) =>
    selectedRosterIds.includes(p.id)
  );

  return (
    <div className="space-y-5">
      {/* Header & Chuyển đổi chế độ Hồ sơ / Lập danh sách thi đấu */}
      <div className="rounded-xl bg-white p-4 sm:p-5 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-extrabold text-[#1e4fc2]">
              Đội Hình & Hồ Sơ Cầu Thủ ({players.length} thành viên)
            </h2>
            <span className="rounded-full bg-[#1e4fc2]/10 px-2.5 py-0.5 text-xs font-bold text-[#1e4fc2]">
              {isManager
                ? "Chế độ Ban Quản Lý (Thấy đầy đủ thông tin)"
                : "Chế độ Cầu Thủ (Chỉ sửa thông tin của mình)"}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Hình ảnh hồ sơ thật phục vụ lập danh sách đăng ký thi đấu. Trang
            khách hoàn toàn không được thấy danh sách này.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Nút chuyển đổi 2 chế độ: Thẻ đội hình vs Lập danh sách thi đấu */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === "cards"
                  ? "bg-[#1e4fc2] text-[#ffc933] shadow-2xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Hồ Sơ Ảnh Đội Hình</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("roster")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                viewMode === "roster"
                  ? "bg-[#1e4fc2] text-[#ffc933] shadow-2xs"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Lập Danh Sách Thi Đấu ({rosterPlayers.length})</span>
            </button>
          </div>

          {isManager && (
            <button
              type="button"
              onClick={openAddPlayer}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1e4fc2] px-4 py-2 text-xs sm:text-sm font-bold text-[#ffc933] hover:bg-[#2f66dd] transition cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Thêm Cầu Thủ</span>
            </button>
          )}
        </div>
      </div>

      {/* Thanh tìm kiếm & Bộ lọc vị trí */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {["Tất cả", ...POSITIONS].map((pos) => {
            const count =
              pos === "Tất cả"
                ? players.length
                : players.filter((p) => p.position === pos).length;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => setFilterPosition(pos)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  filterPosition === pos
                    ? "bg-[#1e4fc2] text-[#ffc933] border-[#1e4fc2]"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {pos} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[230px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Tìm kiếm cầu thủ"
            placeholder="Tìm tên, số áo, vị trí..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs sm:text-sm focus-visible:outline-2 focus-visible:outline-[#1e4fc2]"
          />
        </div>
      </div>

      {/* CHẾ ĐỘ 1: LẬP DANH SÁCH ĐĂNG KÝ THI ĐẤU (CÓ ẢNH HỒ SƠ THẬT) */}
      {viewMode === "roster" && (
        <section className="rounded-xl bg-white border-2 border-[#1e4fc2] p-4 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Logo FC HĐH Gò Nổi"
                className="h-16 w-16 rounded-xl object-contain border border-slate-200 bg-white p-1 shrink-0"
              />
              <div>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  className="text-base sm:text-lg font-extrabold text-[#1e4fc2] border-b border-dashed border-slate-300 focus:border-[#1e4fc2] focus:outline-none w-full sm:w-[420px]"
                />
                <p className="text-xs text-slate-600 mt-1">
                  Đơn vị: <strong>{settings.team_name}</strong> • Đã chọn:{" "}
                  <strong className="text-[#1e4fc2]">
                    {rosterPlayers.length}/{players.length} cầu thủ
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedRosterIds(players.map((p) => p.id))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Chọn tất cả ({players.length})
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4fc2] px-4 py-2 text-xs font-bold text-[#ffc933] hover:bg-[#2f66dd] cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>In / Xuất PDF Danh Sách Thi Đấu</span>
              </button>
            </div>
          </div>

          {/* Chọn nhanh cầu thủ đưa vào danh sách đăng ký thi đấu */}
          <div className="flex flex-wrap gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700 mr-1 self-center">
              Tích chọn cầu thủ đăng ký:
            </span>
            {players.map((p) => {
              const checked = selectedRosterIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleRosterPlayer(p.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold border transition cursor-pointer ${
                    checked
                      ? "bg-[#1e4fc2] text-white border-[#1e4fc2]"
                      : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  #{p.jersey_number ?? "-"} {p.short_name}
                </button>
              );
            })}
          </div>

          {/* Bảng / Thẻ Danh Sách Thi Đấu Có Ảnh Chân Dung Thật */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {rosterPlayers.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center gap-3.5 rounded-xl border border-slate-300 bg-white p-3 shadow-2xs"
              >
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.avatar_url || "/uploads/avatars/member-1.jpg"}
                    alt={p.full_name}
                    className="h-20 w-20 rounded-xl object-cover border-2 border-[#1e4fc2] bg-slate-100"
                  />
                  <span className="absolute -top-1.5 -left-1.5 h-6 w-6 rounded-full bg-[#1e4fc2] text-[#ffc933] text-[11px] font-extrabold flex items-center justify-center border border-white">
                    {idx + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-sm text-[#1e4fc2] truncate">
                      {p.full_name}
                    </span>
                    <span className="rounded bg-[#ffc933] px-1.5 py-0.5 text-xs font-extrabold text-slate-950 shrink-0">
                      Số #{p.jersey_number ?? "-"}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Năm sinh: <strong>{p.birth_year || "1991"}</strong> • Vị trí:{" "}
                    <strong className="text-[#0284c7]">{p.position}</strong>
                  </p>
                  <p className="text-slate-600">
                    Chức vụ: <strong>{p.role}</strong>
                  </p>
                  {isManager && p.phone && (
                    <p className="text-slate-700 font-semibold">
                      SĐT: {p.phone}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CHẾ ĐỘ 2: LƯỚI THẺ HỒ SƠ CẦU THỦ CÓ ẢNH THẬT */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {enrichedPlayers.map((p) => {
            const isSelf = session.playerId === p.id;
            const canSeePrivate = isManager || isSelf;

            return (
              <div
                key={p.id}
                className={`rounded-xl bg-white border p-4 flex flex-col justify-between transition shadow-2xs ${
                  isSelf
                    ? "border-2 border-[#ffc933] ring-2 ring-[#ffc933]/30"
                    : "border-slate-200 hover:border-[#1e4fc2]/50"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.avatar_url || "/uploads/avatars/member-1.jpg"}
                          alt={p.full_name}
                          className="h-16 w-16 rounded-xl object-cover border-2 border-[#1e4fc2] bg-slate-100"
                        />
                        <span className="absolute -bottom-1.5 -right-1.5 rounded-md bg-[#1e4fc2] text-[#ffc933] px-1.5 py-0.5 text-[11px] font-extrabold border border-white">
                          #{p.jersey_number ?? "-"}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-base font-extrabold text-slate-900 truncate">
                            {p.full_name}
                          </h3>
                          {isSelf && (
                            <span className="rounded bg-[#ffc933] px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
                              Hồ sơ của bạn
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Tên sân:{" "}
                          <strong className="text-slate-900">
                            {p.short_name}
                          </strong>{" "}
                          •{" "}
                          <span className="font-bold text-[#0284c7]">
                            {p.position}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Năm sinh: <strong>{p.birth_year || "1991"}</strong> •{" "}
                          {p.role}
                        </p>
                      </div>
                    </div>

                    {p.access_role === "manager" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 shrink-0">
                        <Shield className="h-3 w-3" />
                        Quản lý
                      </span>
                    )}
                  </div>

                  {/* Thống kê chuyên cần & quỹ */}
                  <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 block">
                        Số trận tham gia
                      </span>
                      <span className="font-extrabold text-sm text-slate-900">
                        {p.matchesPlayed}/{matches.length} trận ({p.rate}%)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block">
                        {canSeePrivate ? "Tổng quỹ đã nộp" : "Trạng thái"}
                      </span>
                      {canSeePrivate ? (
                        <span className="font-extrabold text-sm text-emerald-700">
                          {formatVND(p.totalPaid)}
                        </span>
                      ) : (
                        <span className="font-bold text-xs text-slate-700">
                          {p.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thông tin đầy đủ chỉ hiển thị cho Ban Quản Lý hoặc chính Cầu thủ đó */}
                  {canSeePrivate ? (
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{p.phone || "Chưa cập nhật SĐT"}</span>
                      </span>
                      {isManager && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          <KeyRound className="h-3 w-3 text-slate-500" />
                          PIN: {p.pin_code || "1234"}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2.5 text-[11px] text-slate-400 italic flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      <span>
                        SĐT & thông tin cá nhân chỉ hiển thị với Ban Quản Lý
                      </span>
                    </p>
                  )}
                </div>

                {/* Thanh công cụ theo đúng quyền hạn */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailPlayer(p)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#1e4fc2] hover:text-[#0284c7] cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Lịch sử {p.matchesPlayed} trận</span>
                  </button>

                  {/* Nếu là chính cầu thủ đó (và không phải Manager) -> Hiện nút Sửa hồ sơ của tôi & Đổi mật khẩu */}
                  {!isManager && isSelf && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditPlayer(p)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1e4fc2] px-2.5 py-1 text-xs font-bold text-[#ffc933] hover:bg-[#2f66dd] cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Sửa hồ sơ của tôi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPwdError("");
                          setPwdModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <KeyRound className="h-3 w-3" />
                        <span>Đổi PIN</span>
                      </button>
                    </div>
                  )}

                  {/* Nếu là Ban Quản Lý -> Hiện nút Sửa toàn bộ, Reset mật khẩu giúp cầu thủ, Xoá */}
                  {isManager && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleResetPassword(p)}
                        title={`Reset mật khẩu của ${p.full_name} về 1234`}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset PIN</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditPlayer(p)}
                        aria-label={`Sửa hồ sơ ${p.full_name}`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlayer(p)}
                        aria-label={`Xoá hồ sơ ${p.full_name}`}
                        className="inline-flex items-center justify-center rounded-md border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
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
      )}

      {/* Modal Xem Lịch Sử Tham Gia Từng Trận Của Cầu Thủ */}
      <ModalDialog
        isOpen={Boolean(detailPlayer)}
        onClose={() => setDetailPlayer(null)}
        title={
          detailPlayer
            ? `Hồ Sơ Cầu Thủ: ${detailPlayer.full_name} (#${
                detailPlayer.jersey_number ?? "-"
              })`
            : "Chi tiết cầu thủ"
        }
        subtitle={
          detailPlayer
            ? `${detailPlayer.position} • Năm sinh: ${
                detailPlayer.birth_year || "1991"
              } • Tên gọi: ${detailPlayer.short_name}`
            : ""
        }
      >
        {detailPlayer && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  detailPlayer.avatar_url || "/uploads/avatars/member-1.jpg"
                }
                alt={detailPlayer.full_name}
                className="h-16 w-16 rounded-xl object-cover border-2 border-[#1e4fc2]"
              />
              <div className="grid grid-cols-3 gap-2 flex-1 text-center">
                <div className="rounded-lg bg-white p-2 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">
                    Số Áo
                  </span>
                  <span className="text-base font-extrabold text-[#1e4fc2]">
                    #{detailPlayer.jersey_number ?? "-"}
                  </span>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-200">
                  <span className="text-[11px] text-emerald-800 block">
                    Đã Đóng
                  </span>
                  <span className="text-sm font-extrabold text-emerald-700">
                    {formatVND(
                      attendances
                        .filter(
                          (a) =>
                            a.player_id === detailPlayer.id && a.paid === 1
                        )
                        .reduce((s, a) => s + a.amount, 0)
                    )}
                  </span>
                </div>
                <div className="rounded-lg bg-amber-50 p-2 border border-amber-200">
                  <span className="text-[11px] text-amber-800 block">
                    Số Trận
                  </span>
                  <span className="text-base font-extrabold text-amber-900">
                    {
                      attendances.filter(
                        (a) =>
                          a.player_id === detailPlayer.id &&
                          (a.attended === 1 || a.paid === 1)
                      ).length
                    }
                    /{matches.length}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                Chi Tiết Điểm Danh & Đóng Quỹ Qua {matches.length} Trận
              </h3>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 max-h-80 overflow-y-auto">
                {matches.map((m) => {
                  const att = attendances.find(
                    (a) =>
                      a.match_id === m.id && a.player_id === detailPlayer.id
                  );
                  const isPaid = att?.paid === 1;
                  const isUnpaid = att?.attended === 1 && att?.paid === 0;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm"
                    >
                      <div>
                        <span className="font-bold text-slate-900">
                          {m.label}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          ({formatDateVN(m.match_date)} - {m.venue})
                        </span>
                      </div>
                      <div>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Đã nộp {formatVND(att?.amount || 100000)}
                          </span>
                        ) : isUnpaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                            <Clock className="h-3.5 w-3.5" />
                            Chưa nộp ({formatVND(att?.amount || 100000)})
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Vắng</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Modal Thêm / Sửa Hồ Sơ & Ảnh Chân Dung Cầu Thủ */}
      <ModalDialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingPlayer
            ? `Cập Nhật Hồ Sơ & Ảnh: ${editingPlayer.full_name}`
            : "Thêm Thành Viên Mới Vào Đội Bóng"
        }
        subtitle={
          isManager
            ? "Ban Quản Lý được phép chỉnh sửa toàn bộ thông tin, ảnh hồ sơ, phân quyền và mật khẩu."
            : "Bạn đang cập nhật thông tin và ảnh hồ sơ cá nhân của chính mình."
        }
      >
        <form onSubmit={handleSavePlayer} className="space-y-4">
          {/* Chọn hoặc tải ảnh chân dung thật (Tự động chuyển sang WebP) */}
          <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl || "/uploads/avatars/member-1.jpg"}
              alt="Ảnh hồ sơ"
              className="h-24 w-20 rounded-xl object-cover object-top border-2 border-[#1e4fc2] shrink-0"
            />
            <div className="space-y-2 flex-1 text-center sm:text-left">
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4fc2] hover:bg-[#2f66dd] px-3.5 py-2 text-xs font-bold text-[#ffc933] cursor-pointer transition">
                <Upload className="h-3.5 w-3.5" />
                <span>
                  {isConvertingWebp
                    ? "Đang chuyển đổi ảnh sang WebP..."
                    : "Tải Ảnh Hồ Sơ (Tự Động Chuyển Sang WebP)"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isConvertingWebp}
                  onChange={handleImageFileUpload}
                  className="sr-only"
                />
              </label>
              {webpInfo && (
                <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 inline-block">
                  {webpInfo}
                </p>
              )}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => {
                      setAvatarUrl(url);
                      setWebpInfo("");
                    }}
                    className={`h-9 w-9 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                      avatarUrl === url
                        ? "border-[#ffc933] ring-2 ring-[#1e4fc2]"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Avatar ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="player-fullname"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Họ và Tên đầy đủ *
              </label>
              <input
                id="player-fullname"
                name="full_name"
                type="text"
                required
                disabled={!isManager}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input disabled:bg-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="player-shortname"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Tên gọi ngắn
              </label>
              <input
                id="player-shortname"
                name="short_name"
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="player-jersey"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Số Áo
              </label>
              <input
                id="player-jersey"
                name="jersey_number"
                type="text"
                inputMode="numeric"
                value={jerseyNumber}
                onChange={(e) =>
                  setJerseyNumber(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="form-input"
              />
            </div>
            <div>
              <label
                htmlFor="player-birthyear"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Năm Sinh
              </label>
              <input
                id="player-birthyear"
                name="birth_year"
                type="text"
                inputMode="numeric"
                value={birthYear}
                onChange={(e) =>
                  setBirthYear(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="form-input"
              />
            </div>
            <div>
              <label
                htmlFor="player-position"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Vị Trí
              </label>
              <select
                id="player-position"
                name="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="form-select"
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="player-phone"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Số Điện Thoại
              </label>
              <input
                id="player-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {isManager && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="player-role"
                    className="block text-sm font-semibold text-slate-700 mb-1"
                  >
                    Chức Danh Trong Đội
                  </label>
                  <select
                    id="player-role"
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="form-select"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="player-pin"
                    className="block text-sm font-semibold text-slate-700 mb-1"
                  >
                    Mật khẩu / Mã PIN Đăng Nhập
                  </label>
                  <div className="relative">
                    <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="player-pin"
                      name="pin_code"
                      type="text"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      className="form-input !pl-9"
                    />
                  </div>
                </div>
              </div>

              <fieldset className="rounded-xl bg-amber-50 border border-amber-200 p-3.5">
                <legend className="text-xs font-extrabold uppercase tracking-wider text-amber-900 px-1">
                  Phân Quyền Hệ Thống
                </legend>
                <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="access_role"
                      value="player"
                      checked={accessRole === "player"}
                      onChange={() => setAccessRole("player")}
                      className="accent-[#1e4fc2] h-4 w-4"
                    />
                    <span>Cầu thủ (Chỉ sửa thông tin cá nhân của mình)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-bold text-amber-950 cursor-pointer">
                    <input
                      type="radio"
                      name="access_role"
                      value="manager"
                      checked={accessRole === "manager"}
                      onChange={() => setAccessRole("manager")}
                      className="accent-amber-600 h-4 w-4"
                    />
                    <span>Ban Quản Lý (Thu tiền, Quản lý & Reset PIN)</span>
                  </label>
                </div>
              </fieldset>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#1e4fc2] px-5 py-2 text-sm font-bold text-[#ffc933] hover:bg-[#2f66dd] cursor-pointer"
            >
              Lưu Hồ Sơ
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal Đổi mật khẩu dành cho chính Cầu thủ */}
      <ModalDialog
        isOpen={pwdModalOpen}
        onClose={() => setPwdModalOpen(false)}
        title="Đổi Mật Khẩu (PIN) Của Tôi"
        subtitle="Cập nhật mã PIN đăng nhập cá nhân của bạn"
      >
        <form onSubmit={handleChangeOwnPassword} className="space-y-4">
          <div>
            <label
              htmlFor="self-old-pin"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Mật khẩu (PIN) hiện tại
            </label>
            <input
              id="self-old-pin"
              type="password"
              required
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            <label
              htmlFor="self-new-pin"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Mật khẩu (PIN) mới
            </label>
            <input
              id="self-new-pin"
              type="password"
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="form-input"
            />
          </div>
          {pwdError && (
            <p className="text-xs font-bold text-rose-600">{pwdError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPwdModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#1e4fc2] px-4 py-2 text-xs font-bold text-[#ffc933] cursor-pointer"
            >
              Lưu Mật Khẩu Mới
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
