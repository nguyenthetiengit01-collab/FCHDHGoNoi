"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  QrCode,
  Calendar,
  BellRing,
  XCircle,
  KeyRound,
  Edit3,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Crop,
  Image as ImageIcon,
  Camera,
  Check,
} from "lucide-react";
import type {
  FullAppData,
  AuthSession,
  MutateActionFn,
  RsvpStatus,
} from "@/types/app";
import { OFFICIAL_QR_URL } from "@/types/app";
import { formatVND, formatDateVN } from "@/lib/format";
import {
  convertMultipleFilesToWebp,
} from "@/lib/imageToWebp";
import { ModalDialog } from "./ModalDialog";
import {
  ImageLightboxModal,
  type LightboxImage,
} from "./ImageLightboxModal";
import { BroadcastAthleteCard } from "./BroadcastAthleteCard";
import { AvatarCropperModal } from "./AvatarCropperModal";
import {
  formatBirthYear,
  BIRTH_YEAR_OPTIONS,
  buildAthleteLightboxImages,
} from "@/lib/athleteProfile";

interface PlayerPersonalTabProps {
  data: FullAppData;
  session: AuthSession;
  onMutate: MutateActionFn;
  isSaving: boolean;
}

const POSITIONS = ["Thủ môn", "Hậu vệ", "Tiền vệ", "Tiền đạo", "Đa năng"];
const PRESET_AVATARS = Array.from(
  { length: 14 },
  (_, i) => `/uploads/avatars/member-${i + 1}.jpg`
);

export function PlayerPersonalTab({
  data,
  session,
  onMutate,
  isSaving,
}: PlayerPersonalTabProps) {
  const { players, matches, attendances } = data;
  const me = players.find((p) => p.id === session.playerId);

  // State cho Modal sửa thông tin & ảnh hồ sơ cá nhân
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [shortName, setShortName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [position, setPosition] = useState("Tiền vệ");
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [webpInfo, setWebpInfo] = useState<string>("");
  const [profileWebpInfo, setProfileWebpInfo] = useState<string>("");
  const [bio, setBio] = useState("");
  const [notes, setNotes] = useState("");
  const [hometown, setHometown] = useState("Điện Quang");
  const [nickname, setNickname] = useState("");
  const [playingStyle, setPlayingStyle] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [isConvertingGallery, setIsConvertingGallery] = useState(false);
  const [galleryWebpInfo, setGalleryWebpInfo] = useState("");

  // Studio Canh chỉnh & Cắt ảnh đại diện
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSource, setCropperSource] = useState<string | File | null>(null);
  const [cropperMode, setCropperMode] = useState<"avatar" | "profile">("avatar");

  // Lightbox xem ảnh toàn màn hình
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // State cho Modal đổi tên đăng nhập & mật khẩu cá nhân
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  if (!me) {
    return (
      <div className="rounded-xl bg-white p-8 text-center border border-slate-200">
        Vui lòng đăng nhập tài khoản cầu thủ để xem hồ sơ cá nhân.
      </div>
    );
  }

  const myLightboxImages: LightboxImage[] = buildAthleteLightboxImages(me);

  const openEditMyProfile = () => {
    setFullName(me.full_name);
    setShortName(me.short_name);
    setJerseyNumber(me.jersey_number !== null ? String(me.jersey_number) : "");
    setPosition(me.position);
    setPhone(me.phone || "");
    setBirthYear(formatBirthYear(me.birth_year));
    setAvatarUrl(me.avatar_url || "/uploads/avatars/member-1.jpg");
    setProfileImageUrl(me.profile_image_url || "");
    setWebpInfo("");
    setProfileWebpInfo("");
    setBio(me.bio || "");
    setNotes(me.notes || "");
    setHometown(me.hometown || "Điện Quang");
    setNickname(me.nickname || "");
    setPlayingStyle(me.playing_style || "");
    setGalleryUrls(me.gallery_urls || []);
    setGalleryWebpInfo("");
    setProfileModalOpen(true);
  };

  const handleAvatarFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropperMode("avatar");
    setCropperSource(file);
    setCropperOpen(true);
    e.target.value = "";
  };

  const handleProfileImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropperMode("profile");
    setCropperSource(file);
    setCropperOpen(true);
    e.target.value = "";
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsConvertingGallery(true);
    setGalleryWebpInfo(`Đang tự động chuyển ${files.length} ảnh sang chuẩn WebP...`);
    try {
      const results = await convertMultipleFilesToWebp(files, {
        maxWidth: 1200,
        maxHeight: 900,
        quality: 0.85,
      });
      const newUrls = results.map((r) => r.dataUrl);
      setGalleryUrls((prev) => [...prev, ...newUrls]);
      setGalleryWebpInfo(`✅ Đã chuyển thành công ${results.length} ảnh sang WebP.`);
    } catch {
      setGalleryWebpInfo("❌ Có lỗi khi chuyển đổi ảnh album.");
    } finally {
      setIsConvertingGallery(false);
      e.target.value = "";
    }
  };

  const handleRemoveGalleryImage = (index: number) => {
    setGalleryUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await onMutate("update_own_profile", {
      player_id: me.id,
      full_name: fullName,
      short_name: shortName,
      jersey_number: jerseyNumber === "" ? null : Number(jerseyNumber),
      position,
      phone,
      birth_year: birthYear === "" ? null : Number(birthYear),
      avatar_url: avatarUrl,
      profile_image_url: profileImageUrl || null,
      bio,
      notes,
      hometown,
      nickname,
      playing_style: playingStyle,
      gallery_urls: galleryUrls,
    });
    setProfileModalOpen(false);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    if (!oldPin.trim()) {
      setPwdError("Vui lòng nhập Mật khẩu hiện tại để xác thực");
      return;
    }
    if (!newUsername.trim() && !newPin.trim()) {
      setPwdError(
        "Vui lòng nhập Tên đăng nhập mới hoặc Mật khẩu mới cần thay đổi"
      );
      return;
    }
    if (newUsername.trim() && newUsername.trim().length < 3) {
      setPwdError("Tên đăng nhập mới cần ít nhất 3 ký tự");
      return;
    }
    if (newPin.trim()) {
      if (newPin.trim().length < 6) {
        setPwdError("Mật khẩu mới phải có ít nhất 6 ký tự để đảm bảo an toàn");
        return;
      }
      if (newPin.trim() === "1234" || newPin.trim() === "123456") {
        setPwdError(
          "Không thể dùng mật khẩu mặc định (1234, 123456). Vui lòng chọn mật khẩu khác an toàn hơn"
        );
        return;
      }
      if (newPin.trim() !== confirmPin.trim()) {
        setPwdError("Xác nhận mật khẩu mới chưa khớp");
        return;
      }
    }
    await onMutate("change_own_password", {
      player_id: me.id,
      old_pin: oldPin.trim(),
      new_pin: newPin.trim() || undefined,
      new_username: newUsername.trim() || undefined,
    });
    setPwdModalOpen(false);
    setOldPin("");
    setNewPin("");
    setConfirmPin("");
    setShowOldPin(false);
    setShowNewPin(false);
    setShowConfirmPin(false);
  };

  const myAtts = attendances.filter((a) => a.player_id === me.id);
  const totalPaid = myAtts
    .filter((a) => a.paid === 1)
    .reduce((s, a) => s + a.amount, 0);

  const latestMatch = matches[matches.length - 1];
  const latestAtt = myAtts.find((a) => a.match_id === latestMatch?.id);

  const handleSetRsvp = async (rsvpStatus: RsvpStatus) => {
    if (!latestMatch) return;
    await onMutate("set_rsvp", {
      match_id: latestMatch.id,
      player_id: me.id,
      rsvp_status: rsvpStatus,
    });
  };

  return (
    <div className="space-y-6">
      {/* THẺ VẬN ĐỘNG VIÊN CÁ NHÂN (DEEP MODULE: BROADCAST ATHLETE CARD) */}
      <BroadcastAthleteCard
        player={me}
        matches={matches}
        attendances={attendances}
        layout="split"
        actions={
          <>
            <button
              type="button"
              onClick={openEditMyProfile}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 transition cursor-pointer shadow-lg hover:shadow-xl"
            >
              <Edit3 className="h-4 w-4" />
              <span>Sửa Thông Tin &amp; Ảnh Hồ Sơ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCropperMode("avatar");
                setCropperSource(me.avatar_url || "/uploads/avatars/member-1.jpg");
                setCropperOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2.5 text-xs font-bold text-sky-200 hover:text-white transition cursor-pointer"
              title="Mở Studio để canh chỉnh hoặc đổi ảnh Avatar chân dung 3:4"
            >
              <Crop className="h-4 w-4 text-[#ffd700]" />
              <span>✂️ Canh Avatar 3:4</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCropperMode("profile");
                setCropperSource(me.profile_image_url || me.avatar_url || "/images/cover-team.jpg");
                setCropperOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 px-3.5 py-2.5 text-xs font-bold text-sky-100 hover:text-white transition cursor-pointer"
              title="Mở Studio để canh chỉnh hoặc đổi ảnh giới thiệu Profile khung rộng 16:9 / 4:3"
            >
              <ImageIcon className="h-4 w-4 text-sky-300" />
              <span>🖼️ Canh Ảnh Profile Rộng</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPwdError("");
                setNewUsername(me.username || "");
                setOldPin("");
                setNewPin("");
                setConfirmPin("");
                setPwdModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2.5 text-xs font-bold text-white transition cursor-pointer"
            >
              <KeyRound className="h-4 w-4 text-[#d4af37]" />
              <span>Đổi Mật Khẩu</span>
            </button>
          </>
        }
        onOpenLightbox={(imgs, idx) => {
          setLightboxIndex(idx);
          setLightboxOpen(true);
        }}
      />

      {/* Điểm danh nhanh cho trận tuần hiện tại */}
      {latestMatch && (
        <section className="rounded-xl bg-white p-4 sm:p-5 border-2 border-[#1e4fc2] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <BellRing className="h-5 w-5 text-[#1e4fc2] shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0284c7]">
                Điểm Danh Lịch Thi Đấu Tuần Này
              </span>
              <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                {latestMatch.label} — {latestMatch.kickoff_time} ngày{" "}
                {formatDateVN(latestMatch.match_date)} ({latestMatch.venue})
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Trạng thái điểm danh của bạn:{" "}
                <strong className="text-slate-900">
                  {latestAtt?.rsvp_status === "registered"
                    ? "✅ Đã đăng ký tham gia"
                    : latestAtt?.rsvp_status === "absent_notice"
                      ? "❌ Đã báo vắng"
                      : "⏳ Chưa phản hồi"}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSetRsvp("registered")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-extrabold transition cursor-pointer ${latestAtt?.rsvp_status === "registered"
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-800 hover:bg-emerald-100"
                }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Có Mặt</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSetRsvp("absent_notice")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-xs font-bold transition cursor-pointer ${latestAtt?.rsvp_status === "absent_notice"
                  ? "bg-rose-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-rose-100"
                }`}
            >
              <XCircle className="h-4 w-4" />
              <span>Báo Vắng</span>
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái: Lịch sử tham gia & đóng quỹ cá nhân qua từng trận */}
        <section className="lg:col-span-8 rounded-xl bg-white p-5 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#1e4fc2]" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Lịch Sử Ra Sân & Đóng Quỹ Cá Nhân ({me.full_name})
                </h3>
                <p className="text-xs text-slate-500">
                  Chi tiết điểm danh và tiền trận của riêng bạn qua{" "}
                  {matches.length} trận đấu
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-emerald-700">
              Tổng đã đóng: {formatVND(totalPaid)}
            </span>
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden max-h-[460px] overflow-y-auto">
            {matches
              .slice()
              .reverse()
              .map((m) => {
                const att = myAtts.find((a) => a.match_id === m.id);
                const isPaid = att?.paid === 1;
                const isUnpaid = att?.attended === 1 && att?.paid === 0;
                const rsvp = att?.rsvp_status || "none";

                return (
                  <div
                    key={m.id}
                    className="p-3.5 flex items-center justify-between gap-3 text-sm hover:bg-slate-50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {m.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({formatDateVN(m.match_date)} • {m.venue})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Điểm danh trước trận:{" "}
                        <strong>
                          {rsvp === "registered"
                            ? "Đăng ký tham gia"
                            : rsvp === "absent_notice"
                              ? "Báo vắng"
                              : "—"}
                        </strong>
                        {att?.walk_in === 1
                          ? " • Tham gia bổ sung tại sân"
                          : ""}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Đã đóng {formatVND(att?.amount || 100000)}</span>
                        </span>
                      ) : isUnpaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            Chưa nộp ({formatVND(att?.amount || 100000)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">
                          Không tham gia
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* Cột phải: Mã QR Chính Xác Của Thủ Quỹ NGUYEN THE TIENG */}
        <section className="lg:col-span-4 rounded-xl bg-white p-5 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <QrCode className="h-5 w-5 text-[#1e4fc2]" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Mã QR Đóng Quỹ Đội Bóng
              </h3>
              <p className="text-xs text-slate-500">
                Quét mã chuyển tiền từ mọi ứng dụng ngân hàng & ZaloPay
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-center space-y-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_QR_URL}
              alt="Mã QR nhận tiền quỹ NGUYEN THE TIENG"
              className="mx-auto max-w-[260px] w-full rounded-xl border border-slate-200 bg-white shadow-2xs"
            />
            <div className="text-xs text-slate-700 space-y-1">
              <p className="font-extrabold text-sm text-[#1e4fc2]">
                NGUYEN THE TIENG
              </p>
              <p>
                Nội dung CK:{" "}
                <strong className="text-slate-900">
                  {me.short_name} #{me.jersey_number ?? ""} dong quy GONOIFC
                </strong>
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Modal 1: Cầu thủ tự cập nhật thông tin & ảnh hồ sơ cá nhân */}
      <ModalDialog
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title={`Cập Nhật Hồ Sơ Cá Nhân: ${me.full_name}`}
        subtitle="Bạn chỉ có thể thay đổi thông tin và ảnh hồ sơ của chính mình để phục vụ lập danh sách thi đấu."
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
                src={avatarUrl || "/uploads/avatars/member-1.jpg"}
                alt={me.full_name}
                className="h-28 w-21 rounded-xl object-cover object-top border-2 border-[#1e4fc2] shadow-sm shrink-0"
              />
              <div className="space-y-2 flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e4fc2] hover:bg-[#2f66dd] px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition shadow-xs">
                    <Upload className="h-3.5 w-3.5 text-[#ffc933]" />
                    <span>Tải Avatar Mới</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileUpload}
                      className="sr-only"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setCropperMode("avatar");
                      setCropperSource(avatarUrl || "/uploads/avatars/member-1.jpg");
                      setCropperOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-900 px-3 py-2 text-xs font-bold transition cursor-pointer"
                    title="Mở Studio để kéo thả, phóng to và cắt ảnh Avatar chuẩn 3:4"
                  >
                    <Crop className="h-3.5 w-3.5 text-amber-700" />
                    <span>✂️ Canh Chỉnh 3:4</span>
                  </button>
                </div>
                {webpInfo && (
                  <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                    {webpInfo}
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  Hoặc chọn nhanh ảnh chân dung từ ảnh mẫu:
                </p>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => {
                        setAvatarUrl(url);
                        setWebpInfo("");
                      }}
                      className={`h-8 w-8 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${avatarUrl === url
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
                Ảnh Toàn Thân / Hoạt Động
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-full sm:w-44 aspect-video rounded-xl overflow-hidden bg-slate-900 border-2 border-sky-400 shrink-0 shadow-sm flex items-center justify-center">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageUrl}
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
                  Ảnh dáng đứng toàn thân, khoảnh khắc thi đấu khái quát làm nền thẻ cầu thủ và tạo ảnh xem trước khi gửi link hồ sơ lên Facebook, Zalo.
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-lg bg-sky-800 hover:bg-sky-900 px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition shadow-xs">
                    <Upload className="h-3.5 w-3.5 text-[#ffc933]" />
                    <span>Tải Ảnh Profile Mới</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfileImageFileUpload}
                      className="sr-only"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setCropperMode("profile");
                      setCropperSource(profileImageUrl || avatarUrl || "/images/cover-team.jpg");
                      setCropperOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-sky-300 text-sky-900 hover:bg-sky-100 px-3 py-2 text-xs font-bold transition cursor-pointer"
                    title="Mở Studio để cắt ảnh theo tỉ lệ 16:9 hoặc 4:3"
                  >
                    <Crop className="h-3.5 w-3.5 text-sky-700" />
                    <span>✂️ Canh Chỉnh Khung Rộng</span>
                  </button>

                  {profileImageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileImageUrl("");
                        setProfileWebpInfo("");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-2.5 py-2 text-xs font-semibold transition cursor-pointer"
                      title="Gỡ ảnh profile rộng này"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Gỡ</span>
                    </button>
                  )}
                </div>
                {profileWebpInfo && (
                  <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                    {profileWebpInfo}
                  </p>
                )}
              </div>
            </div>

            {/* Chọn nhanh ảnh Profile từ Album hoạt động cá nhân bên dưới */}
            <div className="pt-2.5 border-t border-sky-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-[#1e4fc2]" />
                  <span>Hoặc chọn nhanh từ Album hoạt động cá nhân ({galleryUrls.length} ảnh):</span>
                </span>
                {galleryUrls.length > 0 && (
                  <span className="text-[11px] text-slate-500 italic">Nhấn vào ảnh để chọn</span>
                )}
              </div>

              {galleryUrls.length > 0 ? (
                <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
                  {galleryUrls.map((url, idx) => {
                    const isSelected = profileImageUrl === url;
                    return (
                      <div key={idx} className="relative group shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileImageUrl(url);
                            setProfileWebpInfo(`✅ Đã chọn ảnh hoạt động #${idx + 1} làm ảnh Profile!`);
                          }}
                          className={`relative h-14 w-24 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                            isSelected
                              ? "border-[#ffc933] ring-2 ring-[#1e4fc2] shadow-md"
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
                            <span className="absolute bottom-0 inset-x-0 bg-[#092244]/85 text-[9px] font-black text-[#ffc933] text-center py-0.5 flex items-center justify-center gap-0.5">
                              <Check className="h-2.5 w-2.5" />
                              <span>Đang chọn</span>
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCropperMode("profile");
                            setCropperSource(url);
                            setCropperOpen(true);
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

          {/* Hộp thông báo đồng bộ với Thẻ vận động viên Trang Chủ */}
          <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2">
            <span className="text-base">💡</span>
            <div>
              <p className="font-bold text-[#17488c]">
                Đồng bộ Thẻ Vận Động Viên (Mục số 3 ngoài Trang Chủ):
              </p>
              <p className="text-slate-600 mt-0.5">
                Mọi thông tin về họ tên, số áo, vị trí, quê quán, lối chơi, lời ngỏ và ảnh chân dung / album khoảnh khắc bạn lưu tại đây sẽ được cập nhật hiển thị chính xác ngay lập tức ra ngoài Trang chủ.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="my-fullname"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Họ và Tên đầy đủ *
              </label>
              <input
                id="my-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label
                htmlFor="my-shortname"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Tên gọi trên sân *
              </label>
              <input
                id="my-shortname"
                type="text"
                required
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="my-jersey"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Số áo đăng ký thi đấu
              </label>
              <input
                id="my-jersey"
                type="text"
                inputMode="numeric"
                placeholder="VD: 10, 7, 23..."
                value={jerseyNumber}
                onChange={(e) =>
                  setJerseyNumber(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="form-input font-bold"
              />
            </div>
            <div>
              <label
                htmlFor="my-birthyear"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Năm sinh
              </label>
              <select
                id="my-birthyear"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                className="form-select"
              >
                <option value="">-- Chọn năm sinh --</option>
                {BIRTH_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={String(y)}>
                    {y} ({new Date().getFullYear() - y} tuổi)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="my-position"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Vị trí sở trường
              </label>
              <select
                id="my-position"
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
                htmlFor="my-phone"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Số điện thoại liên hệ
              </label>
              <input
                id="my-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Quê quán Gò Nổi & Biệt danh */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="my-hometown"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Quê quán tại Gò Nổi
              </label>
              <select
                id="my-hometown"
                value={hometown}
                onChange={(e) => setHometown(e.target.value)}
                className="form-select"
              >
                <option value="Điện Quang">Xã Điện Quang</option>
                <option value="Điện Trung">Xã Điện Trung</option>
                <option value="Điện Phong">Xã Điện Phong</option>
                <option value="Gò Nổi">Gò Nổi chung</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="my-nickname"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Biệt danh sân cỏ / Tên thân mật
              </label>
              <input
                id="my-nickname"
                type="text"
                placeholder="VD: Tiếng Ronaldo, Tín Mười, Trung Thần Tốc..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="my-playingstyle"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Phong cách thi đấu / Sở trường
            </label>
            <input
              id="my-playingstyle"
              type="text"
              placeholder="VD: Càn lướt mạnh mẽ, sút xa uy lực, đeo bám lì lợm..."
              value={playingStyle}
              onChange={(e) => setPlayingStyle(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label
              htmlFor="my-notes"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Ghi chú cá nhân (Size áo, sở thích...)
            </label>
            <input
              id="my-notes"
              type="text"
              placeholder="VD: Size XL - Thích đá sân 7 tối thứ 4"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label
              htmlFor="my-bio"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Bài viết / Lời tự giới thiệu sân cỏ (Hiển thị thẻ Profile ngoài trang chủ)
            </label>
            <textarea
              id="my-bio"
              rows={3}
              placeholder="Chia sẻ về phong cách thi đấu, sở trường, kỷ niệm hoặc lời nhắn nhủ anh em FC HĐH Gò Nổi..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="form-input text-sm leading-relaxed"
            />
            <p className="text-xs text-slate-500 mt-1">
              Bài viết này được hiển thị nổi bật trên Thẻ Profile 3D tương tác ngoài Trang chủ để cổ động viên và người hâm mộ theo dõi.
            </p>
          </div>

          {/* Album ảnh khoảnh khắc thi đấu cá nhân */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-700">
                Album ảnh thi đấu &amp; hoạt động của bạn ({galleryUrls.length} ảnh)
              </label>
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#17488c] hover:bg-[#1e5eb8] text-white px-3 py-1 text-xs font-bold cursor-pointer transition">
                <Upload className="h-3.5 w-3.5" />
                <span>{isConvertingGallery ? "Đang xử lý..." : "Thêm ảnh (WebP)"}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryUpload}
                  disabled={isConvertingGallery}
                  className="hidden"
                />
              </label>
            </div>
            {galleryWebpInfo && (
              <p className="text-xs text-sky-800 font-medium">{galleryWebpInfo}</p>
            )}
            {galleryUrls.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                {galleryUrls.map((url, idx) => {
                  const isProfile = profileImageUrl === url;
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
                            setProfileImageUrl(url);
                            setProfileWebpInfo(`✅ Đã chọn ảnh #${idx + 1} làm ảnh Profile rộng!`);
                          }}
                          className="h-7 w-7 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center transition shadow cursor-pointer"
                          title="Đặt ảnh này làm ảnh Giới thiệu Profile rộng"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCropperMode("profile");
                            setCropperSource(url);
                            setCropperOpen(true);
                          }}
                          className="h-7 w-7 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center transition shadow cursor-pointer"
                          title="Canh chỉnh & cắt ảnh này làm Profile rộng"
                        >
                          <Crop className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryImage(idx)}
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

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setProfileModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#1e4fc2] px-5 py-2 text-sm font-bold text-[#ffc933] hover:bg-[#2f66dd] cursor-pointer"
            >
              Lưu Hồ Sơ Của Tôi
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal 2: Cầu thủ tự đổi mật khẩu (PIN) cá nhân */}
      <ModalDialog
        isOpen={pwdModalOpen}
        onClose={() => setPwdModalOpen(false)}
        title="Quản Lý Tài Khoản & Mật Khẩu Đăng Nhập"
        subtitle={`Cầu thủ: ${me.full_name} (#${me.jersey_number ?? "-"}) • Vai trò: ${me.access_role === "manager" ? "Ban Quản Lý" : "Cầu thủ thành viên"
          }`}
      >
        <form onSubmit={handleSavePassword} className="space-y-4">
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-xs text-sky-900 space-y-1">
            <p className="font-bold">
              Tên đăng nhập hiện tại:{" "}
              <span className="text-[#17488c] font-black">
                {me.username || me.short_name.toLowerCase()}
              </span>
            </p>
            <p className="text-slate-600">
              Bạn có thể tự đổi Tên tài khoản và Mật khẩu theo ý muốn bất cứ lúc nào.
            </p>
          </div>

          <div>
            <label
              htmlFor="new-username"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Tên đăng nhập mới (tùy chọn)
            </label>
            <input
              id="new-username"
              type="text"
              placeholder="Nhập tên đăng nhập mới (vd: tiengfc, tin_gonoi, ...)"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="form-input font-medium"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Có thể để trống nếu chỉ muốn đổi mật khẩu.
            </p>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="new-pin"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Mật khẩu mới (tối thiểu 6 ký tự)
                </label>
                <div className="relative">
                  <input
                    id="new-pin"
                    type={showNewPin ? "text" : "password"}
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="form-input !pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showNewPin ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="confirm-pin"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    id="confirm-pin"
                    type={showConfirmPin ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    className="form-input !pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showConfirmPin ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {newPin && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Độ an toàn:</span>
                  <span
                    className={`font-bold ${
                      newPin.length < 6
                        ? "text-rose-600"
                        : newPin.length >= 8 && /[0-9]/.test(newPin) && /[a-zA-Z]/.test(newPin)
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {newPin.length < 6
                      ? "Chưa đủ 6 ký tự"
                      : newPin.length >= 8 && /[0-9]/.test(newPin) && /[a-zA-Z]/.test(newPin)
                      ? "Mạnh (Chữ + Số + Độ dài tốt)"
                      : "Trung bình"}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      newPin.length < 6
                        ? "w-1/4 bg-rose-500"
                        : newPin.length >= 8 && /[0-9]/.test(newPin) && /[a-zA-Z]/.test(newPin)
                        ? "w-full bg-emerald-500"
                        : "w-2/3 bg-amber-500"
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200">
            <label
              htmlFor="old-pin"
              className="block text-xs font-bold text-slate-800 mb-1"
            >
              Mật khẩu hiện tại (bắt buộc để xác thực)
            </label>
            <div className="relative">
              <input
                id="old-pin"
                type={showOldPin ? "text" : "password"}
                required
                placeholder="Nhập mật khẩu hiện tại"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                className="form-input !pr-10 font-bold"
              />
              <button
                type="button"
                onClick={() => setShowOldPin(!showOldPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showOldPin ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {pwdError && (
            <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{pwdError}</span>
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPwdModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#1e4fc2] px-5 py-2 text-sm font-bold text-[#ffc933] hover:bg-[#2f66dd] cursor-pointer"
            >
              Lưu Thay Đổi Tài Khoản
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Studio Canh Chỉnh & Cắt Ảnh Đại Diện & Profile */}
      <AvatarCropperModal
        isOpen={cropperOpen}
        cropMode={cropperMode}
        onClose={() => {
          setCropperOpen(false);
          setCropperSource(null);
        }}
        imageSource={cropperSource}
        playerName={me.full_name}
        jerseyNumber={me.jersey_number}
        onConfirm={(res) => {
          if (cropperMode === "profile") {
            setProfileImageUrl(res.dataUrl);
            setProfileWebpInfo(
              `✅ Đã chuẩn bị ảnh Profile rộng (${res.width}x${res.height} • ${res.webpSizeKB}KB)! Hãy nhấn "Lưu Thay Đổi Hồ Sơ" bên dưới để hoàn tất cập nhật.`
            );
          } else {
            setAvatarUrl(res.dataUrl);
            setWebpInfo(
              `✅ Đã cắt ảnh chuẩn 3:4 (${res.width}x${res.height} • ${res.webpSizeKB}KB)! Hãy nhấn "Lưu Thay Đổi Hồ Sơ" bên dưới để hoàn tất cập nhật.`
            );
          }
        }}
        onDirectSave={async (res) => {
          if (cropperMode === "profile") {
            await onMutate("update_own_profile", {
              player_id: me.id,
              full_name: fullName || me.full_name,
              short_name: shortName || me.short_name,
              jersey_number: jerseyNumber === "" ? null : Number(jerseyNumber || me.jersey_number),
              position: position || me.position,
              phone: phone || me.phone,
              birth_year: birthYear === "" ? null : Number(birthYear || me.birth_year),
              avatar_url: avatarUrl || me.avatar_url,
              profile_image_url: res.dataUrl,
              bio: bio !== undefined ? bio : me.bio,
              notes: notes !== undefined ? notes : me.notes,
              hometown: hometown !== undefined ? hometown : me.hometown,
              nickname: nickname !== undefined ? nickname : me.nickname,
              playing_style: playingStyle !== undefined ? playingStyle : me.playing_style,
              gallery_urls: galleryUrls.length > 0 ? galleryUrls : (me.gallery_urls || []),
            });
            setProfileImageUrl(res.dataUrl);
            setProfileWebpInfo(
              `✅ Đã lưu trực tiếp ảnh Profile rộng (${res.width}x${res.height} • ${res.webpSizeKB}KB)!`
            );
          } else {
            await onMutate("update_own_profile", {
              player_id: me.id,
              full_name: fullName || me.full_name,
              short_name: shortName || me.short_name,
              jersey_number: jerseyNumber === "" ? null : Number(jerseyNumber || me.jersey_number),
              position: position || me.position,
              phone: phone || me.phone,
              birth_year: birthYear === "" ? null : Number(birthYear || me.birth_year),
              avatar_url: res.dataUrl,
              profile_image_url: profileImageUrl !== undefined ? profileImageUrl : me.profile_image_url,
              bio: bio !== undefined ? bio : me.bio,
              notes: notes !== undefined ? notes : me.notes,
              hometown: hometown !== undefined ? hometown : me.hometown,
              nickname: nickname !== undefined ? nickname : me.nickname,
              playing_style: playingStyle !== undefined ? playingStyle : me.playing_style,
              gallery_urls: galleryUrls.length > 0 ? galleryUrls : (me.gallery_urls || []),
            });
            setAvatarUrl(res.dataUrl);
            setWebpInfo(
              `✅ Đã lưu trực tiếp ảnh Avatar 3:4 (${res.width}x${res.height} • ${res.webpSizeKB}KB)!`
            );
          }
        }}
      />

      {/* Lightbox phóng to ảnh cá nhân & album khoảnh khắc */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={myLightboxImages}
        currentIndex={lightboxIndex}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}
