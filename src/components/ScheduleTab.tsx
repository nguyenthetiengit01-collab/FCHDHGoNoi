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
  UserCircle2,
  KeyRound,
  Quote,
  Upload,
  Camera,
  Eye,
  EyeOff,
  Crop,
  Image as ImageIcon,
  Check,
  Search,
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
import {
  convertMultipleFilesToWebp,
} from "@/lib/imageToWebp";
import { ModalDialog } from "./ModalDialog";
import { Badge, EmptyState, PositionBadge } from "./ui";
import { MatchdayRosterPosterModal } from "./MatchdayRosterPoster";
import { BroadcastAthleteCard } from "./BroadcastAthleteCard";
import { AvatarCropperModal } from "./AvatarCropperModal";
import { formatBirthYear, BIRTH_YEAR_OPTIONS } from "@/lib/athleteProfile";

interface ScheduleTabProps {
  data: FullAppData;
  session: AuthSession;
  onMutate: MutateActionFn;
  isSaving: boolean;
  onGoToCollection?: () => void;
}

const POSITIONS = ["Thủ môn", "Hậu vệ", "Tiền vệ", "Tiền đạo", "Đa năng"];
const PRESET_AVATARS = Array.from(
  { length: 14 },
  (_, i) => `/uploads/avatars/member-${i + 1}.jpg`
);

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
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterRsvpFilter, setRosterRsvpFilter] = useState<
    "all" | "registered" | "absent_notice" | "none"
  >("all");
  const [finishedSearch, setFinishedSearch] = useState("");

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
          `   ${i + 1}. ${p.full_name} (Số áo #${p.jersey_number ?? "-"} • ${p.position
          })`
      )
      .join("\n");

    const baseLines = [
      `🔥 [THÔNG BÁO LỊCH THI ĐẤU TUẦN] — FC HĐH GÒ NỔI TẠI TP. HCM ⚽`,
      `💛💙 Gắn kết tình quê hương Xã Gò Nổi (TP. Đà Nẵng) – cội nguồn 3 xã Điện Quang, Điện Trung, Điện Phong cũ trên sân cỏ Sài Gòn!`,
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

  const me = players.find((p) => p.id === session.playerId);
  const myAtts = me ? attendances.filter((a) => a.player_id === me.id) : [];
  const myMatchesPlayed = myAtts.filter((a) => a.attended === 1).length;
  const myTotalPaid = myAtts
    .filter((a) => a.paid === 1)
    .reduce((s, a) => s + a.amount, 0);
  const myTotalUnpaid = myAtts
    .filter((a) => a.attended === 1 && a.paid === 0)
    .reduce((s, a) => s + a.amount, 0);
  const myRate =
    matches.length > 0
      ? Math.round((myMatchesPlayed / matches.length) * 100)
      : 0;

  // Chế độ xem: "my_profile" (Mặc định: thông tin đầy đủ & bài viết của bạn) hoặc "team_roster" (Danh sách điểm danh cả đội)
  const [rosterViewMode, setRosterViewMode] = useState<"my_profile" | "team_roster">("my_profile");

  // State cho Modal Xuất Ảnh Điểm Danh Gửi Zalo
  const [posterModalOpen, setPosterModalOpen] = useState(false);

  // State cho Modal Sửa Thông Tin & Bài Viết Cá Nhân (Bio)
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileShortName, setProfileShortName] = useState("");
  const [profileJerseyNumber, setProfileJerseyNumber] = useState("");
  const [profilePosition, setProfilePosition] = useState("Tiền vệ");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileBirthYear, setProfileBirthYear] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileProfileImageUrl, setProfileProfileImageUrl] = useState("");
  const [profileWebpInfo, setProfileWebpInfo] = useState("");
  const [profileProfileWebpInfo, setProfileProfileWebpInfo] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileNotes, setProfileNotes] = useState("");
  const [profileHometown, setProfileHometown] = useState("Điện Quang");
  const [profileNickname, setProfileNickname] = useState("");
  const [profilePlayingStyle, setProfilePlayingStyle] = useState("");
  const [profileGalleryUrls, setProfileGalleryUrls] = useState<string[]>([]);
  const [isConvertingProfileGallery, setIsConvertingProfileGallery] = useState(false);
  const [profileGalleryWebpInfo, setProfileGalleryWebpInfo] = useState("");

  // Studio Canh Chỉnh & Cắt Ảnh Đại Diện
  const [profileCropperOpen, setProfileCropperOpen] = useState(false);
  const [profileCropperSource, setProfileCropperSource] = useState<string | File | null>(null);
  const [profileCropperMode, setProfileCropperMode] = useState<"avatar" | "profile">("avatar");

  // State cho Modal Đổi Tên Đăng Nhập & Mật Khẩu Cá Nhân
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdNewUsername, setPwdNewUsername] = useState("");
  const [pwdOldPin, setPwdOldPin] = useState("");
  const [pwdNewPin, setPwdNewPin] = useState("");
  const [pwdConfirmPin, setPwdConfirmPin] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdShowOldPin, setPwdShowOldPin] = useState(false);
  const [pwdShowNewPin, setPwdShowNewPin] = useState(false);
  const [pwdShowConfirmPin, setPwdShowConfirmPin] = useState(false);

  const openEditMyProfile = () => {
    if (!me) return;
    setProfileShortName(me.short_name);
    setProfileJerseyNumber(
      me.jersey_number !== null ? String(me.jersey_number) : ""
    );
    setProfilePosition(me.position || "Tiền vệ");
    setProfilePhone(me.phone || "");
    setProfileBirthYear(formatBirthYear(me.birth_year) || "1991");
    setProfileAvatarUrl(me.avatar_url || "/uploads/avatars/member-1.jpg");
    setProfileProfileImageUrl(me.profile_image_url || "");
    setProfileWebpInfo("");
    setProfileProfileWebpInfo("");
    setProfileBio(me.bio || "");
    setProfileNotes(me.notes || "");
    setProfileHometown(me.hometown || "Điện Quang");
    setProfileNickname(me.nickname || "");
    setProfilePlayingStyle(me.playing_style || "");
    setProfileGalleryUrls(me.gallery_urls || []);
    setProfileGalleryWebpInfo("");
    setProfileModalOpen(true);
  };

  const handleProfileAvatarUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileCropperMode("avatar");
    setProfileCropperSource(file);
    setProfileCropperOpen(true);
    e.target.value = "";
  };

  const handleProfileProfileImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileCropperMode("profile");
    setProfileCropperSource(file);
    setProfileCropperOpen(true);
    e.target.value = "";
  };

  const handleProfileGalleryUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsConvertingProfileGallery(true);
    setProfileGalleryWebpInfo(`Đang tự động chuyển ${files.length} ảnh sang chuẩn WebP...`);
    try {
      const results = await convertMultipleFilesToWebp(files, {
        maxWidth: 1200,
        maxHeight: 900,
        quality: 0.85,
      });
      const newUrls = results.map((r) => r.dataUrl);
      setProfileGalleryUrls((prev) => [...prev, ...newUrls]);
      setProfileGalleryWebpInfo(`✅ Đã chuyển thành công ${results.length} ảnh sang WebP.`);
    } catch {
      setProfileGalleryWebpInfo("❌ Có lỗi khi chuyển đổi ảnh.");
    } finally {
      setIsConvertingProfileGallery(false);
      e.target.value = "";
    }
  };

  const handleRemoveProfileGalleryImage = (index: number) => {
    setProfileGalleryUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) return;
    await onMutate("update_own_profile", {
      player_id: me.id,
      short_name: profileShortName.trim(),
      jersey_number:
        profileJerseyNumber === "" ? null : Number(profileJerseyNumber),
      position: profilePosition,
      phone: profilePhone.trim(),
      birth_year:
        profileBirthYear === "" ? null : Number(profileBirthYear),
      avatar_url: profileAvatarUrl,
      profile_image_url: profileProfileImageUrl || null,
      bio: profileBio.trim(),
      notes: profileNotes.trim(),
      hometown: profileHometown,
      nickname: profileNickname.trim(),
      playing_style: profilePlayingStyle.trim(),
      gallery_urls: profileGalleryUrls,
    });
    setProfileModalOpen(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) return;
    if (pwdNewPin.trim().length < 6) {
      setPwdError("Mật khẩu mới phải có ít nhất 6 ký tự để đảm bảo an toàn.");
      return;
    }
    if (pwdNewPin.trim() === "1234" || pwdNewPin.trim() === "123456") {
      setPwdError(
        "Không thể dùng mật khẩu mặc định (1234, 123456). Vui lòng chọn mật khẩu khác an toàn hơn."
      );
      return;
    }
    if (pwdNewPin !== pwdConfirmPin) {
      setPwdError("Xác nhận mật khẩu mới không trùng khớp.");
      return;
    }
    setPwdError("");
    await onMutate("change_own_password", {
      player_id: me.id,
      new_username: pwdNewUsername.trim(),
      old_pin: pwdOldPin.trim(),
      new_pin: pwdNewPin.trim(),
    });
    setPwdModalOpen(false);
    setPwdOldPin("");
    setPwdNewPin("");
    setPwdConfirmPin("");
    setPwdShowOldPin(false);
    setPwdShowNewPin(false);
    setPwdShowConfirmPin(false);
  };

  return (
    <div className="space-y-5">
      {/* THANH CHUYỂN ĐỔI 2 KHÔNG GIAN RIÊNG BIỆT: LỊCH TUẦN HIỆN TẠI vs TRẬN ĐẤU ĐÃ KẾT THÚC */}
      <div className="rounded-xl bg-white p-3.5 sm:p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setSpaceMode("upcoming")}
            className={`inline-flex items-center gap-2 min-h-11 sm:min-h-9 rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-extrabold transition ${spaceMode === "upcoming"
                ? "bg-[#0d2e5b] text-[#fde047] shadow-xs"
                : "text-slate-700 hover:text-slate-900"
              }`}
          >
            <BellRing className="h-4 w-4" />
            <span>Lịch Tuần & Điểm Danh ({upcomingMatches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSpaceMode("finished")}
            className={`inline-flex items-center gap-2 min-h-11 sm:min-h-9 rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-extrabold transition ${spaceMode === "finished"
                ? "bg-[#0d2e5b] text-[#fde047] shadow-xs"
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
              className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-10 rounded-lg border border-[#0d2e5b]/30 bg-slate-50 px-3.5 py-2 text-xs font-bold text-[#0d2e5b] hover:bg-slate-100 transition"
            >
              <Wallet className="h-4 w-4 text-[#0284c7]" />
              <span>Sang Mục Thu Tiền Trận →</span>
            </button>
          )}
          {isManager && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-1.5 min-h-11 sm:min-h-10 rounded-lg bg-[#0d2e5b] px-4 py-2 text-xs font-bold text-[#fde047] hover:bg-[#17488c] transition"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo Lịch Tuần Mới</span>
            </button>
          )}
        </div>
      </div>

      {spaceMode === "upcoming" && !activeMatch && (
        <EmptyState
          title="Chưa có lịch thi đấu tuần nào"
          description="Khi Ban Quản Lý tạo lịch trận đấu mới, thông tin sân bãi và nút điểm danh RSVP sẽ hiển thị tại đây."
          action={
            isManager ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 min-h-10 rounded-lg bg-[#0d2e5b] px-4 py-2 text-xs font-bold text-[#fde047] hover:bg-[#17488c] transition"
              >
                <Plus className="h-4 w-4" />
                <span>Tạo Lịch Tuần Mới</span>
              </button>
            ) : undefined
          }
        />
      )}

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
                    className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-extrabold border transition cursor-pointer ${isSelected
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

          {/* HỘP ƯU TIÊN SỐ 1: THÔNG BÁO LỊCH TUẦN & ĐIỂM DANH 1-CHẠM */}
          {session.playerId && (
            <section className="rounded-xl bg-gradient-to-br from-[#092244] via-[#0d2e5b] to-[#17488c] text-white p-5 sm:p-6 border border-[#d4af37]/60 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#d4af37] text-[#092244] px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
                      <BellRing className="h-3.5 w-3.5" />
                      <span>ĐIỂM DANH LỊCH TUẦN</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1 text-xs font-bold text-[#fde047] border border-white/15">
                      <span>Cầu thủ:</span>
                      <strong className="text-white">
                        #{session.jerseyNumber ?? "-"} {session.fullName}
                      </strong>
                    </span>
                    <span className="inline-flex items-center rounded-md bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 text-xs font-bold text-emerald-200">
                      {activeMatch.status}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                    {activeMatch.label} — {activeMatch.venue}
                  </h2>

                  <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-sky-100">
                    <span className="inline-flex items-center gap-1.5 font-bold bg-white/10 text-[#fde047] px-3 py-1.5 rounded-lg border border-white/15 tabular-nums">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>
                        {activeMatch.kickoff_time} • {formatDateVN(activeMatch.match_date)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold bg-white/10 text-sky-100 px-3 py-1.5 rounded-lg border border-white/15">
                      <MapPin className="h-4 w-4 shrink-0 text-[#fde047]" />
                      <span>
                        {activeMatch.venue} ({activeMatch.opponent})
                      </span>
                    </span>
                  </div>

                  {/* Banner trạng thái phản hồi RSVP của cầu thủ */}
                  <div className="pt-0.5">
                    {myAttendance?.rsvp_status === "registered" ? (
                      <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/90 text-white font-bold text-xs sm:text-sm px-3.5 py-2 border border-emerald-400/50">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Bạn đã đăng ký Có Mặt ra sân trận này</span>
                      </div>
                    ) : myAttendance?.rsvp_status === "absent_notice" ? (
                      <div className="inline-flex items-center gap-2 rounded-lg bg-rose-600/90 text-white font-bold text-xs sm:text-sm px-3.5 py-2 border border-rose-400/50">
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span>Bạn đã Báo Vắng trận này</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-lg bg-[#d4af37] text-[#092244] font-extrabold text-xs sm:text-sm px-3.5 py-2">
                        <BellRing className="h-4 w-4 shrink-0" />
                        <span>Bạn chưa điểm danh — Chọn Có Mặt hoặc Báo Vắng bên cạnh</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2 Nút Điểm Danh RSVP độc lập, dễ thao tác trên mọi kích thước */}
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 shrink-0 pt-1 lg:pt-0">
                  <button
                    type="button"
                    disabled={isSaving}
                    aria-pressed={myAttendance?.rsvp_status === "registered"}
                    onClick={() =>
                      handleSetRsvp(session.playerId!, "registered")
                    }
                    className={`min-h-12 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm sm:text-base font-extrabold transition focus-visible:outline-2 focus-visible:outline-[#d4af37] ${myAttendance?.rsvp_status === "registered"
                        ? "bg-emerald-500 text-white ring-2 ring-white shadow-sm"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/60"
                      }`}
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span>Có Mặt Ra Sân</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    aria-pressed={myAttendance?.rsvp_status === "absent_notice"}
                    onClick={() =>
                      handleSetRsvp(session.playerId!, "absent_notice")
                    }
                    className={`min-h-12 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm sm:text-base font-extrabold transition focus-visible:outline-2 focus-visible:outline-[#d4af37] ${myAttendance?.rsvp_status === "absent_notice"
                        ? "bg-rose-600 text-white ring-2 ring-white shadow-sm"
                        : "bg-white/10 hover:bg-rose-600 text-white border border-white/25 hover:border-rose-400"
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
                      className={`rounded-lg px-3 py-1.5 text-xs font-extrabold border transition cursor-pointer ${isActivePreset
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
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${quickPayer === pName
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
                  className={`rounded-lg py-1.5 px-2 text-xs font-bold transition cursor-pointer ${postTemplateMode === "fanpage"
                      ? "bg-[#1e4fc2] text-[#ffc933]"
                      : "text-slate-700 hover:text-slate-900"
                    }`}
                >
                  Mẫu 1: Đăng Fanpage
                </button>
                <button
                  type="button"
                  onClick={() => setPostTemplateMode("with_roster")}
                  className={`rounded-lg py-1.5 px-2 text-xs font-bold transition cursor-pointer ${postTemplateMode === "with_roster"
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

              {/* Nút Copy, Xuất Ảnh & Mở Fanpage */}
              <div className="flex flex-wrap items-stretch gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCopyFanpagePost}
                  className="w-full sm:w-auto sm:flex-1 sm:min-w-[172px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e4fc2] hover:bg-[#2f66dd] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#ffc933] transition cursor-pointer shadow-xs"
                >
                  <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {copiedReminder
                      ? "Đã Copy Bài Đăng!"
                      : "Copy Bài Thông Báo"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPosterModalOpen(true)}
                  className="w-full sm:w-auto sm:flex-1 sm:min-w-[205px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 transition cursor-pointer shadow-md"
                  title="Tải trực tiếp ảnh bảng điểm danh cầu thủ chất lượng cao về máy để chia sẻ vào Zalo"
                >
                  <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>📸 Tải Ảnh Điểm Danh (PNG)</span>
                </button>

                <a
                  href={settings.fanpage_url || FANPAGE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] px-3.5 py-2.5 text-xs font-bold text-white transition"
                >
                  <span>Fanpage</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </section>

            {/* Cột phải (7 cols): THAY THẾ BẰNG THÔNG TIN ĐẦY ĐỦ & BÀI VIẾT (BIO) CỦA CẦU THỦ ĐĂNG NHẬP */}
            <section className="lg:col-span-7 rounded-xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4 shadow-2xs">
              {rosterViewMode === "my_profile" && me ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-[#1e4fc2] text-[#ffc933] flex items-center justify-center shrink-0 shadow-xs">
                        <UserCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-extrabold text-[#1e4fc2]">
                          Hồ Sơ & Bài Viết Của Bạn
                        </h3>
                        <p className="text-xs text-slate-500">
                          Dễ dàng cập nhật ảnh chân dung WebP, thông tin và lời ngỏ giới thiệu bản thân
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setRosterViewMode("team_roster")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition cursor-pointer"
                        title="Xem danh sách điểm danh cả đội tuần này"
                      >
                        <Users className="h-3.5 w-3.5 text-[#1e4fc2]" />
                        <span>Xem DS Đội ({registeredPlayers.length} ra sân)</span>
                      </button>

                      <button
                        type="button"
                        onClick={openEditMyProfile}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#ffc933] hover:bg-[#ffd95e] px-3.5 py-1.5 text-xs font-extrabold text-slate-950 transition cursor-pointer shadow-xs"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Sửa Hồ Sơ & Bài Viết</span>
                      </button>
                    </div>
                  </div>

                  {/* Thẻ Vận Động Viên Đồng Bộ Tuyệt Đối Chuẩn Toàn Dự Án */}
                  <BroadcastAthleteCard
                    player={me}
                    matches={matches}
                    attendances={attendances}
                    layout="split"
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRosterViewMode("team_roster")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 hover:bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 transition cursor-pointer"
                          title="Xem danh sách điểm danh cả đội tuần này"
                        >
                          <Users className="h-3.5 w-3.5 text-[#ffd700]" />
                          <span>DS Đội ({registeredPlayers.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={openEditMyProfile}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#ffd700] to-[#f5c518] hover:from-[#f5c518] hover:to-[#ffd700] px-3.5 py-2 text-xs font-black uppercase tracking-wider text-slate-950 transition cursor-pointer shadow-md"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Sửa Hồ Sơ &amp; Bài Viết</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPwdError("");
                            setPwdNewUsername(me.username || "");
                            setPwdOldPin("");
                            setPwdNewPin("");
                            setPwdModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 text-xs font-bold text-white transition cursor-pointer"
                        >
                          <KeyRound className="h-3.5 w-3.5 text-[#ffd700]" />
                          <span>Đổi Mật Khẩu</span>
                        </button>
                      </div>
                    }
                  />

                  {/* Thanh Điểm Danh Nhanh Tuần Này & Tài Chính Cá Nhân */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Hộp điểm danh nhanh */}
                    <div className="rounded-xl bg-gradient-to-r from-[#123e7a] to-[#0d2d5a] border border-[#ffd700]/50 p-3.5 flex flex-col justify-between gap-2.5 text-white shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-sky-200 font-bold flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-[#ffd700]" />
                          <span>Điểm danh: {activeMatch.label}</span>
                        </span>
                        {myAttendance?.rsvp_status === "registered" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Có Mặt Ra Sân</span>
                          </span>
                        ) : myAttendance?.rsvp_status === "absent_notice" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-rose-300 bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 rounded">
                            <XCircle className="h-3.5 w-3.5 text-rose-400" />
                            <span>Báo Vắng Trận Này</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-300 bg-amber-950/50 border border-amber-500/40 px-2 py-0.5 rounded">
                            Chưa điểm danh
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSetRsvp(session.playerId!, "registered")}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition cursor-pointer text-center ${myAttendance?.rsvp_status === "registered"
                              ? "bg-emerald-500 text-white shadow-xs"
                              : "bg-emerald-700/80 hover:bg-emerald-600 text-white"
                            }`}
                        >
                          ✓ Xác Nhận Ra Sân
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSetRsvp(session.playerId!, "absent_notice")}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition cursor-pointer text-center ${myAttendance?.rsvp_status === "absent_notice"
                              ? "bg-rose-500 text-white shadow-xs"
                              : "bg-rose-700/80 hover:bg-rose-600 text-white"
                            }`}
                        >
                          ✕ Báo Bận Vắng
                        </button>
                      </div>
                    </div>

                    {/* Hộp tài chính & chuyên cần cá nhân */}
                    <div className="grid grid-cols-2 gap-2 text-center text-white">
                      <div className="rounded-xl bg-gradient-to-br from-[#123e7a] to-[#0d2d5a] p-3 border border-sky-300/30 flex flex-col justify-center">
                        <span className="text-[10px] uppercase font-bold text-sky-200 tracking-wider">
                          Tiền Quỹ Đã Nộp
                        </span>
                        <span className="text-base font-black text-emerald-300 mt-0.5">
                          {formatVND(myTotalPaid)}
                        </span>
                        <span className="text-[9px] text-sky-200/70 mt-0.5">
                          {myMatchesPlayed}/{matches.length} trận ({myRate}%)
                        </span>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-[#123e7a] to-[#0d2d5a] p-3 border border-sky-300/30 flex flex-col justify-center">
                        <span className="text-[10px] uppercase font-bold text-sky-200 tracking-wider">
                          Tiền Sân Còn Nợ
                        </span>
                        <span className={`text-base font-black mt-0.5 ${myTotalUnpaid > 0 ? "text-rose-300" : "text-white"}`}>
                          {formatVND(myTotalUnpaid)}
                        </span>
                        <span className="text-[9px] text-sky-200/70 mt-0.5">
                          {myTotalUnpaid > 0 ? "Cần thanh toán" : "Đã hoàn thành"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mục Bài Viết / Lời Ngỏ Giới Thiệu Bản Thân (Bio) */}
                  <div className="rounded-2xl bg-amber-50/70 border border-[#ffc933]/50 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#1e4fc2]">
                        <Quote className="h-4 w-4 text-[#ffc933]" />
                        <span>Bài Viết / Lời Ngỏ Của Cầu Thủ (Bio)</span>
                      </div>
                      <button
                        type="button"
                        onClick={openEditMyProfile}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1e4fc2] hover:text-[#2f66dd] cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>{me.bio ? "Chỉnh sửa bài viết" : "Viết bài ngỏ"}</span>
                      </button>
                    </div>

                    {me.bio ? (
                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed italic bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        &ldquo;{me.bio}&rdquo;
                      </p>
                    ) : (
                      <div className="rounded-xl bg-white p-3.5 border border-dashed border-amber-300 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="leading-relaxed">
                          Bạn chưa viết bài giới thiệu về bản thân. Hãy chia sẻ đôi dòng về niềm đam mê bóng đá, phong cách thi đấu và tình cảm với FC HĐH Gò Nổi để hiển thị nổi bật trên website!
                        </p>
                        <button
                          type="button"
                          onClick={openEditMyProfile}
                          className="shrink-0 rounded-lg bg-[#1e4fc2] hover:bg-[#2f66dd] text-[#ffc933] px-3.5 py-1.5 font-extrabold text-xs transition cursor-pointer shadow-xs"
                        >
                          ✍️ Viết Bài Ngay
                        </button>
                      </div>
                    )}

                    {me.notes && (
                      <div className="text-xs text-slate-500 bg-white/70 p-2.5 rounded-lg border border-slate-200">
                        <strong className="text-slate-700">Ghi chú cá nhân:</strong> {me.notes}
                      </div>
                    )}
                  </div>

                  {/* Nút hành động nhanh: Sửa hồ sơ & Đổi tài khoản / mật khẩu */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={openEditMyProfile}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e4fc2] hover:bg-[#2f66dd] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#ffc933] transition cursor-pointer shadow-xs"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>Cập Nhật Hồ Sơ, Ảnh (WebP) & Bài Viết</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPwdError("");
                        setPwdNewUsername(me.username || "");
                        setPwdOldPin("");
                        setPwdNewPin("");
                        setPwdConfirmPin("");
                        setPwdModalOpen(true);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 transition cursor-pointer"
                    >
                      <KeyRound className="h-4 w-4 text-[#1e4fc2]" />
                      <span>Đổi Mật Khẩu</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Chế độ xem Danh Sách Cả Đội (Khi người dùng bấm xem DS Đội) */
                <>
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

                    <div className="flex items-center gap-2 flex-wrap">
                      {me && (
                        <button
                          type="button"
                          onClick={() => setRosterViewMode("my_profile")}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#1e4fc2] hover:bg-[#2f66dd] text-[#ffc933] px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs"
                        >
                          <UserCircle2 className="h-3.5 w-3.5" />
                          <span>← Xem Hồ Sơ & Bài Viết Của Bạn</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setPosterModalOpen(true)}
                        className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 transition cursor-pointer shadow-xs"
                        title="Tải trực tiếp ảnh bảng điểm danh cầu thủ chất lượng cao về máy để chia sẻ vào Zalo"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>Tải Ảnh Gửi Zalo</span>
                      </button>

                      {/* 3 Huy hiệu quân số */}
                      <div className="flex items-center gap-1.5 text-xs font-bold">
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
                  </div>

                  {/* Bộ lọc & Tìm kiếm nhanh danh sách điểm danh */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc theo trạng thái điểm danh">
                      {[
                        { key: "all", label: `Tất cả (${players.length})` },
                        { key: "registered", label: `Có mặt (${registeredPlayers.length})` },
                        { key: "absent_notice", label: `Vắng (${absentNoticePlayers.length})` },
                        { key: "none", label: `Chờ (${pendingPlayers.length})` },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          aria-pressed={rosterRsvpFilter === opt.key}
                          onClick={() =>
                            setRosterRsvpFilter(
                              opt.key as "all" | "registered" | "absent_notice" | "none"
                            )
                          }
                          className={`min-h-11 sm:min-h-8 px-2.5 py-1 rounded-md text-xs font-bold border transition ${rosterRsvpFilter === opt.key
                              ? "bg-[#0d2e5b] text-[#fde047] border-[#0d2e5b]"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[190px]">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        aria-label="Tìm cầu thủ trong danh sách điểm danh"
                        placeholder="Tìm tên, số áo..."
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        className="min-h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1 text-xs text-[#092244] focus-visible:outline-2 focus-visible:outline-[#d4af37]"
                      />
                    </div>
                  </div>

                  {(() => {
                    const filteredRosterPlayers = players.filter((p) => {
                      const att = activeAttendances.find((a) => a.player_id === p.id);
                      const rsvp = att?.rsvp_status || "none";
                      if (rosterRsvpFilter !== "all" && rsvp !== rosterRsvpFilter) {
                        return false;
                      }
                      if (!rosterSearch.trim()) return true;
                      const q = rosterSearch.toLowerCase();
                      return (
                        p.full_name.toLowerCase().includes(q) ||
                        p.short_name.toLowerCase().includes(q) ||
                        String(p.jersey_number ?? "").includes(q)
                      );
                    });

                    if (filteredRosterPlayers.length === 0) {
                      return (
                        <EmptyState
                          title="Không có cầu thủ phù hợp"
                          description="Thử thay đổi bộ lọc điểm danh hoặc từ khoá tìm kiếm."
                        />
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[480px] overflow-y-auto pr-1">
                        {filteredRosterPlayers.map((p) => {
                          const att = activeAttendances.find(
                            (a) => a.player_id === p.id
                          );
                          const rsvp = att?.rsvp_status || "none";
                          const isAttended = att?.attended === 1;
                          const isPaid = att?.paid === 1;
                          const isMe = session.playerId === p.id;
                          const canToggle = isManager || isMe;

                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition ${isMe
                                  ? "ring-2 ring-[#d4af37] border-[#0d2e5b] bg-amber-50/70 shadow-xs"
                                  : rsvp === "registered"
                                    ? "bg-emerald-50/70 border-emerald-300"
                                    : rsvp === "absent_notice"
                                      ? "bg-rose-50/70 border-rose-300"
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
                                    loading="lazy"
                                    className="h-10 w-10 rounded-lg object-cover object-top border border-[#0d2e5b]"
                                  />
                                  <span className="absolute -bottom-1 -right-1 rounded bg-[#0d2e5b] text-[#fde047] px-1 text-[9px] font-extrabold tabular-nums">
                                    #{p.jersey_number ?? "-"}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-xs sm:text-sm font-bold text-[#092244] truncate">
                                      {p.full_name}
                                    </p>
                                    {isMe && (
                                      <Badge variant="gold">BẠN</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span className="text-[11px] text-slate-600 font-medium">
                                      {p.short_name}
                                    </span>
                                    <PositionBadge position={p.position} />
                                    {/* Hiển thị tách biệt Attended & Paid (không gộp với RSVP) */}
                                    {isAttended && (
                                      <Badge variant="info">Đã ra sân</Badge>
                                    )}
                                    {isPaid ? (
                                      <Badge variant="success">Đã nộp quỹ</Badge>
                                    ) : isAttended ? (
                                      <Badge variant="warning">Chưa nộp</Badge>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={!canToggle || isSaving}
                                  aria-pressed={rsvp === "registered"}
                                  aria-label={`Điểm danh Có mặt cho ${p.full_name}`}
                                  onClick={() =>
                                    handleSetRsvp(
                                      p.id,
                                      rsvp === "registered" ? "none" : "registered"
                                    )
                                  }
                                  className={`min-h-11 sm:min-h-9 px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition ${!canToggle
                                      ? "opacity-70 cursor-default"
                                      : "cursor-pointer"
                                    } ${rsvp === "registered"
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
                                  aria-pressed={rsvp === "absent_notice"}
                                  aria-label={`Báo vắng cho ${p.full_name}`}
                                  onClick={() =>
                                    handleSetRsvp(
                                      p.id,
                                      rsvp === "absent_notice"
                                        ? "none"
                                        : "absent_notice"
                                    )
                                  }
                                  title="Báo vắng trận này"
                                  className={`min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-bold transition ${!canToggle
                                      ? "opacity-70 cursor-default"
                                      : "cursor-pointer"
                                    } ${rsvp === "absent_notice"
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
                    );
                  })()}
                </>
              )}
            </section>
          </div>
        </div>
      )}

      {/* =====================================================================
          KHÔNG GIAN 2 (RIÊNG BIỆT): KHO LƯU TRỮ CÁC TRẬN ĐẤU ĐÃ KẾT THÚC
         ===================================================================== */}
      {spaceMode === "finished" && (
        <section className="rounded-xl bg-white border border-slate-200 p-4 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-[#0d2e5b] text-[#fde047] flex items-center justify-center shrink-0">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#092244]">
                  Lịch Sử Các Trận Đấu Đã Kết Thúc ({finishedMatches.length} trận)
                </h3>
                <p className="text-xs text-slate-500">
                  Lưu trữ kết quả, sân bãi, chi phí sân và danh sách cầu thủ ra sân thực tế.
                </p>
              </div>
            </div>

            {finishedMatches.length > 0 && (
              <div className="relative min-w-[220px]">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="Tìm trận đấu đã kết thúc"
                  placeholder="Tìm tên trận, sân đấu..."
                  value={finishedSearch}
                  onChange={(e) => setFinishedSearch(e.target.value)}
                  className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs sm:text-sm text-[#092244] focus-visible:outline-2 focus-visible:outline-[#d4af37]"
                />
              </div>
            )}
          </div>

          {(() => {
            const visibleFinished = finishedMatches.filter((m) => {
              if (!finishedSearch.trim()) return true;
              const q = finishedSearch.toLowerCase();
              return (
                m.label.toLowerCase().includes(q) ||
                m.venue.toLowerCase().includes(q) ||
                m.opponent.toLowerCase().includes(q)
              );
            });

            if (visibleFinished.length === 0) {
              return (
                <EmptyState
                  title={
                    finishedMatches.length === 0
                      ? "Chưa có trận đấu nào kết thúc"
                      : "Không tìm thấy trận đấu phù hợp"
                  }
                  description={
                    finishedMatches.length === 0
                      ? "Các trận đã hoàn thành sẽ tự động được lưu trữ vào không gian này để tra cứu lịch sử."
                      : "Thử xóa từ khóa tìm kiếm để xem toàn bộ lịch sử trận đấu."
                  }
                />
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleFinished.map((m) => {
                  const mAtt = attendances.filter((a) => a.match_id === m.id);
                  const playedCount = mAtt.filter((a) => a.attended === 1).length;

                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-[#0d2e5b]/40 p-4 flex flex-col justify-between gap-3 transition shadow-xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                              Đã kết thúc • Trận #{m.match_number}
                            </span>
                            <h4 className="mt-1 text-base font-extrabold text-[#092244]">
                              {m.label}
                            </h4>
                          </div>

                          {m.team_score !== null && m.opponent_score !== null ? (
                            <div className="rounded-lg bg-[#0d2e5b] text-[#fde047] px-2.5 py-1 text-xs font-extrabold tabular-nums">
                              {m.team_score} - {m.opponent_score}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-500 tabular-nums">
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
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 tabular-nums">
                              <Users className="h-3.5 w-3.5" />
                              {playedCount} cầu thủ ra sân
                            </span>
                          </div>
                          {isManager && (
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/70 tabular-nums">
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
                          className="text-xs font-bold text-[#0d2e5b] hover:text-[#0284c7]"
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
                              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Mở lại</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(m)}
                              aria-label={`Sửa trận ${m.label}`}
                              className="rounded border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                              title="Sửa trận đấu"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMatch(m.id, m.label)}
                              aria-label={`Xoá trận ${m.label}`}
                              className="rounded border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
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
            );
          })()}
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 truncate">
                            {p.full_name} (#{p.jersey_number ?? "-"})
                          </span>
                          {(() => {
                            const a = attendances.find(
                              (att) =>
                                att.match_id === selectedFinishedMatch.id &&
                                att.player_id === p.id
                            );
                            if (a?.attended === 1 && a?.paid === 1) {
                              return (
                                <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[9px] font-bold">
                                  Ra sân • Đã nộp
                                </span>
                              );
                            }
                            if (a?.attended === 1 && a?.paid === 0) {
                              return (
                                <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-bold">
                                  Ra sân (Nợ)
                                </span>
                              );
                            }
                            if (a?.attended === 0 && a?.paid === 1) {
                              return (
                                <span className="rounded bg-purple-100 text-purple-800 px-1.5 py-0.5 text-[9px] font-bold">
                                  Vắng (Ủng hộ)
                                </span>
                              );
                            }
                            return null;
                          })()}
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${venue === preset.venue
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

      {/* Modal Cập Nhật Thông Tin, Ảnh Chân Dung (WebP) & Bài Viết Cá Nhân */}
      {me && (
        <ModalDialog
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          title={`Cập Nhật Hồ Sơ & Bài Viết: ${me.full_name}`}
          subtitle="Tự do cập nhật ảnh chân dung, thông tin thi đấu và viết bài ngỏ / bio giới thiệu bản thân."
        >
          <form onSubmit={handleSaveMyProfile} className="space-y-4">
            {/* 1. Ảnh đại diện Avatar thi đấu (Chuẩn 3:4) */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Crop className="h-4 w-4 text-[#1e4fc2]" />
                  <span>1. Ảnh Avatar Thi Đấu (Chuẩn 3:4)</span>
                </span>
                <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                  Chân dung 3:4 WebP HD
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profileAvatarUrl || "/uploads/avatars/member-1.jpg"}
                  alt="Ảnh chân dung"
                  className="h-28 w-21 rounded-xl object-cover object-top border-2 border-[#1e4fc2] shrink-0 bg-slate-900 shadow-sm"
                />
                <div className="space-y-2 flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4fc2] hover:bg-[#2f66dd] px-3.5 py-2 text-xs font-bold text-[#ffc933] cursor-pointer transition shadow-xs">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Tải Avatar Mới</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileAvatarUpload}
                        className="sr-only"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileCropperMode("avatar");
                        setProfileCropperSource(profileAvatarUrl || "/uploads/avatars/member-1.jpg");
                        setProfileCropperOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-900 px-3 py-2 text-xs font-bold transition cursor-pointer"
                      title="Mở Studio để kéo thả, phóng to và cắt ảnh Avatar chuẩn 3:4"
                    >
                      <Crop className="h-3.5 w-3.5 text-amber-700" />
                      <span>✂️ Canh Chỉnh 3:4</span>
                    </button>
                  </div>
                  {profileWebpInfo && (
                    <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 inline-block">
                      {profileWebpInfo}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {PRESET_AVATARS.map((url, idx) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => {
                          setProfileAvatarUrl(url);
                          setProfileWebpInfo("");
                        }}
                        className={`h-8 w-8 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${profileAvatarUrl === url
                            ? "border-[#ffc933] ring-2 ring-[#1e4fc2]"
                            : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        title={`Ảnh thành viên #${idx + 1}`}
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
            </div>

            {/* 2. Ảnh Giới Thiệu Profile / Hoạt Động (Khung Rộng 16:9 hoặc 4:3) */}
            <div className="rounded-xl bg-sky-50/60 p-4 border border-sky-200 space-y-3">
              <div className="flex items-center justify-between border-b border-sky-200/60 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-[#1e4fc2]" />
                  <span>2. Ảnh Giới Thiệu Profile (Khung Rộng 16:9 / 4:3)</span>
                </span>
                <span className="rounded-md bg-sky-100 border border-sky-300 px-2 py-0.5 text-[10px] font-black text-sky-800">
                  Toàn Thân / Hành Động Sân Cỏ
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-full sm:w-44 aspect-video rounded-xl overflow-hidden bg-slate-900 border-2 border-sky-400 shrink-0 shadow-sm flex items-center justify-center">
                  {profileProfileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profileProfileImageUrl}
                      alt="Ảnh profile rộng"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-400 text-[11px] font-semibold flex flex-col items-center gap-1">
                      <ImageIcon className="h-6 w-6 text-slate-500" />
                      <span>Chưa có ảnh rộng</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1 text-center sm:text-left">
                  <p className="text-xs text-slate-600">
                    Ảnh dáng đứng toàn thân, khoảnh khắc thi đấu khái quát làm nền hồ sơ profile và tạo link chia sẻ Facebook/Zalo trực quan.
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-lg bg-sky-800 hover:bg-sky-900 px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition shadow-xs">
                      <Upload className="h-3.5 w-3.5 text-[#ffc933]" />
                      <span>Tải Ảnh Profile Mới</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfileProfileImageUpload}
                        className="sr-only"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileCropperMode("profile");
                        setProfileCropperSource(profileProfileImageUrl || profileAvatarUrl || "/images/cover-team.jpg");
                        setProfileCropperOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-sky-300 text-sky-900 hover:bg-sky-100 px-3 py-2 text-xs font-bold transition cursor-pointer"
                      title="Mở Studio để cắt ảnh theo tỉ lệ 16:9 hoặc 4:3"
                    >
                      <Crop className="h-3.5 w-3.5 text-sky-700" />
                      <span>✂️ Canh Chỉnh Khung Rộng</span>
                    </button>

                    {profileProfileImageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileProfileImageUrl("");
                          setProfileProfileWebpInfo("");
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-2.5 py-2 text-xs font-semibold transition cursor-pointer"
                        title="Gỡ ảnh profile rộng này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Gỡ</span>
                      </button>
                    )}
                  </div>
                  {profileProfileWebpInfo && (
                    <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                      {profileProfileWebpInfo}
                    </p>
                  )}
                </div>
              </div>

              {/* Chọn nhanh ảnh Profile từ Album hoạt động cá nhân */}
              <div className="pt-2.5 border-t border-sky-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-[#1e4fc2]" />
                    <span>Hoặc chọn nhanh từ Album hoạt động cá nhân ({profileGalleryUrls.length} ảnh):</span>
                  </span>
                  {profileGalleryUrls.length > 0 && (
                    <span className="text-[11px] text-slate-500 italic">Nhấn vào ảnh để chọn</span>
                  )}
                </div>

                {profileGalleryUrls.length > 0 ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
                    {profileGalleryUrls.map((url, idx) => {
                      const isSelected = profileProfileImageUrl === url;
                      return (
                        <div key={idx} className="relative group shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileProfileImageUrl(url);
                              setProfileProfileWebpInfo(`✅ Đã chọn ảnh hoạt động #${idx + 1} làm ảnh Profile!`);
                            }}
                            className={`relative h-14 w-24 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                              isSelected
                                ? "border-[#ffd700] ring-2 ring-[#1e4fc2] shadow-md"
                                : "border-slate-300 opacity-80 hover:opacity-100 hover:border-sky-500"
                            }`}
                            title={`Chọn ảnh hoạt động #${idx + 1} làm ảnh Profile`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Ảnh hoạt động ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {isSelected && (
                              <span className="absolute bottom-0 inset-x-0 bg-[#092244]/85 text-[9px] font-black text-[#ffd700] text-center py-0.5 flex items-center justify-center gap-0.5">
                                <Check className="h-2.5 w-2.5" />
                                <span>Đang chọn</span>
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileCropperMode("profile");
                              setProfileCropperSource(url);
                              setProfileCropperOpen(true);
                            }}
                            className="absolute top-1 right-1 bg-black/80 hover:bg-black text-[#ffc933] p-1 rounded-md opacity-0 group-hover:opacity-100 transition shadow cursor-pointer"
                            title="Canh chỉnh & cắt ảnh này theo khung rộng 16:9 / 4:3"
                          >
                            <Crop className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg bg-sky-100/50 border border-dashed border-sky-300 p-2 text-center text-xs text-sky-800">
                    Chưa có ảnh trong Album hoạt động bên dưới. Bạn có thể kéo xuống mục &ldquo;Album ảnh thi đấu &amp; hoạt động&rdquo; bên dưới để tải ảnh lên hoặc tải trực tiếp ở trên.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên thường gọi / Tên sân *
                </label>
                <input
                  type="text"
                  required
                  value={profileShortName}
                  onChange={(e) => setProfileShortName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số áo thi đấu
                </label>
                <input
                  type="number"
                  value={profileJerseyNumber}
                  onChange={(e) => setProfileJerseyNumber(e.target.value)}
                  placeholder="VD: 12, 26, 9..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vị trí sở trường
                </label>
                <select
                  value={profilePosition}
                  onChange={(e) => setProfilePosition(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Năm sinh
                </label>
                <select
                  value={profileBirthYear}
                  onChange={(e) => setProfileBirthYear(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none bg-white"
                >
                  <option value="">-- Chọn năm sinh --</option>
                  {BIRTH_YEAR_OPTIONS.map((y) => (
                    <option key={y} value={String(y)}>
                      {y} ({new Date().getFullYear() - y} tuổi)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quê quán Gò Nổi
                </label>
                <select
                  value={profileHometown}
                  onChange={(e) => setProfileHometown(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
                >
                  <option value="Điện Quang">Xã Điện Quang</option>
                  <option value="Điện Trung">Xã Điện Trung</option>
                  <option value="Điện Phong">Xã Điện Phong</option>
                  <option value="Gò Nổi">Gò Nổi chung</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Biệt danh sân cỏ
                </label>
                <input
                  type="text"
                  value={profileNickname}
                  onChange={(e) => setProfileNickname(e.target.value)}
                  placeholder="VD: Tiếng Ronaldo, Tín Mười..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phong cách thi đấu / Sở trường
                </label>
                <input
                  type="text"
                  value={profilePlayingStyle}
                  onChange={(e) => setProfilePlayingStyle(e.target.value)}
                  placeholder="VD: Tốc độ cao, sút xa hiểm hóc, đeo bám quyết liệt..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số điện thoại liên hệ
                </label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="VD: 0905123456"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
                />
              </div>
            </div>

            {/* Album ảnh khoảnh khắc thi đấu cá nhân */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Album ảnh thi đấu &amp; hoạt động ({profileGalleryUrls.length} ảnh)
                </label>
                <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4fc2] hover:bg-[#2f66dd] text-[#ffc933] px-3 py-1 text-xs font-bold cursor-pointer transition">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isConvertingProfileGallery ? "Đang xử lý..." : "Thêm ảnh (WebP)"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleProfileGalleryUpload}
                    disabled={isConvertingProfileGallery}
                    className="hidden"
                  />
                </label>
              </div>
              {profileGalleryWebpInfo && (
                <p className="text-xs text-emerald-800 font-medium">{profileGalleryWebpInfo}</p>
              )}
              {profileGalleryUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                  {profileGalleryUrls.map((url, idx) => {
                    const isProfile = profileProfileImageUrl === url;
                    return (
                      <div
                        key={idx}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 group bg-slate-900 transition ${
                          isProfile
                            ? "border-[#ffd700] ring-2 ring-sky-500 shadow-md"
                            : "border-slate-300"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />

                        {isProfile && (
                          <div className="absolute top-1 left-1 bg-[#092244]/90 text-[9px] font-black text-[#ffd700] px-1.5 py-0.5 rounded border border-white/20 shadow flex items-center gap-0.5">
                            <Check className="h-2.5 w-2.5" />
                            <span>Profile</span>
                          </div>
                        )}

                        {/* Nút hành động nổi lên khi hover */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 p-1">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileProfileImageUrl(url);
                              setProfileProfileWebpInfo(`✅ Đã chọn ảnh #${idx + 1} làm ảnh Profile rộng!`);
                            }}
                            className="h-7 w-7 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center transition shadow cursor-pointer"
                            title="Đặt ảnh này làm ảnh Giới thiệu Profile rộng"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileCropperMode("profile");
                              setProfileCropperSource(url);
                              setProfileCropperOpen(true);
                            }}
                            className="h-7 w-7 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center transition shadow cursor-pointer"
                            title="Canh chỉnh & cắt ảnh này làm Profile rộng"
                          >
                            <Crop className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveProfileGalleryImage(idx)}
                            className="h-7 w-7 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition shadow cursor-pointer"
                            title="Xoá ảnh này khỏi Album"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bài viết / Lời ngỏ về bản thân (Bio) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Bài viết / Lời ngỏ giới thiệu về bản thân (Bio)
                </label>
                <span className="text-[11px] text-[#1e4fc2] font-semibold">
                  Hiển thị trên Trang chủ & Thẻ Cầu Thủ
                </span>
              </div>
              <textarea
                rows={4}
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value)}
                placeholder="Viết đôi nét về phong cách đá bóng của bạn, niềm đam mê hoặc những lời chúc gửi đến anh em FC HĐH Gò Nổi..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none leading-relaxed"
              />
            </div>

            {/* Ghi chú cá nhân */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ghi chú cá nhân (tuỳ chọn)
              </label>
              <input
                type="text"
                value={profileNotes}
                onChange={(e) => setProfileNotes(e.target.value)}
                placeholder="VD: Quê quán xã Điện Trung, thường đá cánh phải..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={isSaving || isConvertingProfileGallery}
                className="rounded-xl bg-[#1e4fc2] hover:bg-[#2f66dd] disabled:opacity-50 px-5 py-2 text-xs font-black text-[#ffc933] shadow-md cursor-pointer"
              >
                {isSaving ? "Đang lưu..." : "Lưu Hồ Sơ & Bài Viết"}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}

      {/* Modal Đổi Tên Đăng Nhập & Mật Khẩu Cá Nhân */}
      {me && (
        <ModalDialog
          isOpen={pwdModalOpen}
          onClose={() => setPwdModalOpen(false)}
          title="Đổi Tên Đăng Nhập & Mật Khẩu (PIN)"
          subtitle={`Thay đổi thông tin đăng nhập cho tài khoản của cầu thủ ${me.full_name}.`}
        >
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên đăng nhập mới (hoặc giữ nguyên)
              </label>
              <input
                type="text"
                value={pwdNewUsername}
                onChange={(e) => setPwdNewUsername(e.target.value)}
                placeholder="VD: tieng, tin, trung..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu hiện tại *
              </label>
              <div className="relative">
                <input
                  type={pwdShowOldPin ? "text" : "password"}
                  required
                  value={pwdOldPin}
                  onChange={(e) => setPwdOldPin(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại (mặc định 1234)"
                  className="w-full rounded-xl border border-slate-300 pl-3 pr-10 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPwdShowOldPin(!pwdShowOldPin)}
                  aria-label={
                    pwdShowOldPin
                      ? "Ẩn mật khẩu hiện tại"
                      : "Hiện mật khẩu hiện tại"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {pwdShowOldPin ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu mới * (tối thiểu 6 ký tự)
              </label>
              <div className="relative">
                <input
                  type={pwdShowNewPin ? "text" : "password"}
                  required
                  value={pwdNewPin}
                  onChange={(e) => setPwdNewPin(e.target.value)}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  className="w-full rounded-xl border border-slate-300 pl-3 pr-10 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPwdShowNewPin(!pwdShowNewPin)}
                  aria-label={
                    pwdShowNewPin ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {pwdShowNewPin ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {pwdNewPin && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Độ an toàn:</span>
                  <span
                    className={`font-bold ${pwdNewPin.length < 6
                        ? "text-rose-600"
                        : pwdNewPin.length >= 8 &&
                          /[0-9]/.test(pwdNewPin) &&
                          /[a-zA-Z]/.test(pwdNewPin)
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }`}
                  >
                    {pwdNewPin.length < 6
                      ? "Chưa đủ 6 ký tự"
                      : pwdNewPin.length >= 8 &&
                        /[0-9]/.test(pwdNewPin) &&
                        /[a-zA-Z]/.test(pwdNewPin)
                        ? "Mạnh"
                        : "Trung bình"}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${pwdNewPin.length < 6
                        ? "w-1/4 bg-rose-500"
                        : pwdNewPin.length >= 8 &&
                          /[0-9]/.test(pwdNewPin) &&
                          /[a-zA-Z]/.test(pwdNewPin)
                          ? "w-full bg-emerald-500"
                          : "w-2/3 bg-amber-500"
                      }`}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Xác nhận lại mật khẩu mới *
              </label>
              <div className="relative">
                <input
                  type={pwdShowConfirmPin ? "text" : "password"}
                  required
                  value={pwdConfirmPin}
                  onChange={(e) => setPwdConfirmPin(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full rounded-xl border border-slate-300 pl-3 pr-10 py-2 text-sm text-slate-900 focus:border-[#1e4fc2] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPwdShowConfirmPin(!pwdShowConfirmPin)}
                  aria-label={
                    pwdShowConfirmPin
                      ? "Ẩn xác nhận mật khẩu mới"
                      : "Hiện xác nhận mật khẩu mới"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {pwdShowConfirmPin ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {pwdError && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                {pwdError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPwdModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-[#1e4fc2] hover:bg-[#2f66dd] px-5 py-2 text-xs font-black text-[#ffc933] shadow-md cursor-pointer"
              >
                {isSaving ? "Đang lưu..." : "Cập Nhật Mật Khẩu"}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}

      {/* Studio Canh Chỉnh & Cắt Ảnh Đại Diện & Profile */}
      {me && (
        <AvatarCropperModal
          isOpen={profileCropperOpen}
          cropMode={profileCropperMode}
          onClose={() => {
            setProfileCropperOpen(false);
            setProfileCropperSource(null);
          }}
          imageSource={profileCropperSource}
          playerName={me.full_name}
          jerseyNumber={me.jersey_number}
          onConfirm={(res) => {
            if (profileCropperMode === "profile") {
              setProfileProfileImageUrl(res.dataUrl);
              setProfileProfileWebpInfo(
                `✅ Đã chuẩn bị ảnh Profile rộng (${res.width}x${res.height} • ${res.webpSizeKB}KB)! Hãy bấm nút "Lưu Hồ Sơ Điểm Danh" để hoàn tất.`
              );
            } else {
              setProfileAvatarUrl(res.dataUrl);
              setProfileWebpInfo(
                `✅ Đã cắt ảnh chuẩn 3:4 (${res.width}x${res.height} • ${res.webpSizeKB}KB)! Hãy bấm nút "Lưu Hồ Sơ Điểm Danh" để hoàn tất.`
              );
            }
          }}
          onDirectSave={async (res) => {
            if (profileCropperMode === "profile") {
              await onMutate("update_own_profile", {
                player_id: me.id,
                short_name: profileShortName || me.short_name,
                jersey_number: profileJerseyNumber === "" ? null : Number(profileJerseyNumber || me.jersey_number),
                position: profilePosition || me.position,
                phone: profilePhone || me.phone,
                birth_year: profileBirthYear === "" ? null : Number(profileBirthYear || me.birth_year),
                avatar_url: profileAvatarUrl || me.avatar_url,
                profile_image_url: res.dataUrl,
                bio: profileBio !== undefined ? profileBio : me.bio,
                notes: profileNotes !== undefined ? profileNotes : me.notes,
                hometown: profileHometown !== undefined ? profileHometown : me.hometown,
                nickname: profileNickname !== undefined ? profileNickname : me.nickname,
                playing_style: profilePlayingStyle !== undefined ? profilePlayingStyle : me.playing_style,
                gallery_urls: profileGalleryUrls.length > 0 ? profileGalleryUrls : (me.gallery_urls || []),
              });
              setProfileProfileImageUrl(res.dataUrl);
              setProfileProfileWebpInfo(
                `✅ Đã lưu trực tiếp ảnh Profile rộng (${res.width}x${res.height} • ${res.webpSizeKB}KB)!`
              );
            } else {
              await onMutate("update_own_profile", {
                player_id: me.id,
                short_name: profileShortName || me.short_name,
                jersey_number: profileJerseyNumber === "" ? null : Number(profileJerseyNumber || me.jersey_number),
                position: profilePosition || me.position,
                phone: profilePhone || me.phone,
                birth_year: profileBirthYear === "" ? null : Number(profileBirthYear || me.birth_year),
                avatar_url: res.dataUrl,
                profile_image_url: profileProfileImageUrl !== undefined ? profileProfileImageUrl : me.profile_image_url,
                bio: profileBio !== undefined ? profileBio : me.bio,
                notes: profileNotes !== undefined ? profileNotes : me.notes,
                hometown: profileHometown !== undefined ? profileHometown : me.hometown,
                nickname: profileNickname !== undefined ? profileNickname : me.nickname,
                playing_style: profilePlayingStyle !== undefined ? profilePlayingStyle : me.playing_style,
                gallery_urls: profileGalleryUrls.length > 0 ? profileGalleryUrls : (me.gallery_urls || []),
              });
              setProfileAvatarUrl(res.dataUrl);
              setProfileWebpInfo(
                `✅ Đã lưu trực tiếp ảnh Avatar 3:4 (${res.width}x${res.height} • ${res.webpSizeKB}KB)!`
              );
            }
          }}
        />
      )}

      {/* Modal Xem & Xuất Ảnh Bảng Điểm Danh Trận Đấu */}
      {activeMatch && (
        <MatchdayRosterPosterModal
          isOpen={posterModalOpen}
          onClose={() => setPosterModalOpen(false)}
          match={activeMatch}
          attendances={attendances}
          players={players}
          zaloCopyText={fanpagePreviewText}
        />
      )}
    </div>
  );
}
