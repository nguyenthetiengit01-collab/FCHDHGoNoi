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
  Eye,
  EyeOff,
  Crop,
  Image as ImageIcon,
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
import { resolvePublicMediaUpload } from "@/lib/media/clientUpload";
import { ModalDialog } from "./ModalDialog";
import { Button, FormField, Input } from "./ui";
import { PlayerProfileEditor } from "./shared/PlayerProfileEditor";
import { PlayerGalleryManager } from "./shared/PlayerGalleryManager";
import {
  ImageLightboxModal,
  type LightboxImage,
} from "./ImageLightboxModal";
import { BroadcastAthleteCard } from "./BroadcastAthleteCard";
import { PlayerInsights } from "./PlayerInsights";
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
      const newUrls = await Promise.all(
        results.map((r) =>
          resolvePublicMediaUpload({
            dataUrl: r.dataUrl,
            entity: "player",
            playerId: me?.id,
            maxWidth: 1200,
            maxHeight: 900,
            quality: 0.85,
          })
        )
      );
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
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-450 hover:from-gold-450 hover:to-gold-300 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 transition cursor-pointer shadow-lg hover:shadow-xl"
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
              <Crop className="h-4 w-4 text-gold-400" />
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
              <KeyRound className="h-4 w-4 text-gold-500" />
              <span>Đổi Mật Khẩu</span>
            </button>
          </>
        }
        onOpenLightbox={(imgs, idx) => {
          setLightboxIndex(idx);
          setLightboxOpen(true);
        }}
      />

      <PlayerInsights />

      {/* Điểm danh nhanh cho trận tuần hiện tại */}
      {latestMatch && (
        <section className="rounded-xl bg-white p-4 sm:p-5 border-2 border-royal-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <BellRing className="h-5 w-5 text-royal-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-brand-sky">
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
              <Calendar className="h-5 w-5 text-royal-600" />
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
            <QrCode className="h-5 w-5 text-royal-600" />
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
              <p className="font-extrabold text-sm text-royal-600">
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
          <PlayerProfileEditor
            idPrefix="my"
            avatarUrl={avatarUrl}
            avatarAlt={me.full_name}
            webpInfo={webpInfo}
            profileImageUrl={profileImageUrl}
            profileWebpInfo={profileWebpInfo}
            galleryUrls={galleryUrls}
            presetAvatars={PRESET_AVATARS}
            positions={POSITIONS}
            birthYearOptions={BIRTH_YEAR_OPTIONS}
            fullName={fullName}
            shortName={shortName}
            jerseyNumber={jerseyNumber}
            birthYear={birthYear}
            position={position}
            phone={phone}
            hometown={hometown}
            nickname={nickname}
            playingStyle={playingStyle}
            bio={bio}
            emptyActivityGalleryHint='Chưa có ảnh trong Album hoạt động bên dưới. Bạn có thể kéo xuống mục "Album ảnh thi đấu & hoạt động" bên dưới để tải ảnh lên hoặc tải trực tiếp ở trên.'
            syncNoticeTitle="Đồng bộ Thẻ Vận Động Viên (Mục số 3 ngoài Trang Chủ):"
            syncNoticeBody="Mọi thông tin về họ tên, số áo, vị trí, quê quán, lối chơi, lời ngỏ và ảnh chân dung / album khoảnh khắc bạn lưu tại đây sẽ được cập nhật hiển thị chính xác ngay lập tức ra ngoài Trang chủ."
            onChangeFullName={setFullName}
            onChangeShortName={setShortName}
            onChangeJerseyNumber={setJerseyNumber}
            onChangeBirthYear={setBirthYear}
            onChangePosition={setPosition}
            onChangePhone={setPhone}
            onChangeHometown={setHometown}
            onChangeNickname={setNickname}
            onChangePlayingStyle={setPlayingStyle}
            onChangeBio={setBio}
            onAvatarFileUpload={handleAvatarFileUpload}
            onOpenAvatarCropper={() => {
              setCropperMode("avatar");
              setCropperSource(avatarUrl || "/uploads/avatars/member-1.jpg");
              setCropperOpen(true);
            }}
            onSelectPresetAvatar={(url) => {
              setAvatarUrl(url);
              setWebpInfo("");
            }}
            onProfileFileUpload={handleProfileImageFileUpload}
            onOpenProfileCropper={(srcUrl) => {
              setCropperMode("profile");
              setCropperSource(srcUrl);
              setCropperOpen(true);
            }}
            onClearProfileImage={() => {
              setProfileImageUrl("");
              setProfileWebpInfo("");
            }}
            onSelectActivityForProfile={(url, idx) => {
              setProfileImageUrl(url);
              setProfileWebpInfo(`✅ Đã chọn ảnh hoạt động #${idx + 1} làm ảnh Profile!`);
            }}
            onCropActivityForProfile={(url) => {
              setCropperMode("profile");
              setCropperSource(url);
              setCropperOpen(true);
            }}
          />

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

          <PlayerGalleryManager
            title={`Album ảnh thi đấu & hoạt động của bạn (${galleryUrls.length} ảnh)`}
            galleryUrls={galleryUrls}
            profileImageUrl={profileImageUrl}
            isConvertingGallery={isConvertingGallery}
            galleryWebpInfo={galleryWebpInfo}
            onUploadFiles={handleGalleryUpload}
            onSelectAsProfile={(url, idx) => {
              setProfileImageUrl(url);
              setProfileWebpInfo(`✅ Đã chọn ảnh #${idx + 1} làm ảnh Profile rộng!`);
            }}
            onCropForProfile={(url) => {
              setCropperMode("profile");
              setCropperSource(url);
              setCropperOpen(true);
            }}
            onRemoveImage={handleRemoveGalleryImage}
          />

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => setProfileModalOpen(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" variant="primary" loading={isSaving}>
              Lưu Hồ Sơ Của Tôi
            </Button>
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
              <span className="text-navy-500 font-black">
                {me.username || me.short_name.toLowerCase()}
              </span>
            </p>
            <p className="text-slate-600">
              Bạn có thể tự đổi Tên tài khoản và Mật khẩu theo ý muốn bất cứ lúc nào.
            </p>
          </div>

          <FormField
            label="Tên đăng nhập mới (tùy chọn)"
            htmlFor="new-username"
            hint="Có thể để trống nếu chỉ muốn đổi mật khẩu."
          >
            <Input
              id="new-username"
              type="text"
              placeholder="Nhập tên đăng nhập mới (vd: tiengfc, tin_gonoi, ...)"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="font-medium"
            />
          </FormField>

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
                    className="form-input !pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin(!showNewPin)}
                    aria-label={showNewPin ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                    className="absolute right-0.5 md:right-1 top-1/2 -translate-y-1/2 inline-flex min-h-11 min-w-11 md:min-h-9 md:min-w-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-on-light"
                  >
                    {showNewPin ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
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
                    className="form-input !pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    aria-label={showConfirmPin ? "Ẩn xác nhận mật khẩu mới" : "Hiện xác nhận mật khẩu mới"}
                    className="absolute right-0.5 md:right-1 top-1/2 -translate-y-1/2 inline-flex min-h-11 min-w-11 md:min-h-9 md:min-w-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-on-light"
                  >
                    {showConfirmPin ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
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
                className="form-input !pr-12 font-bold"
              />
              <button
                type="button"
                onClick={() => setShowOldPin(!showOldPin)}
                aria-label={showOldPin ? "Ẩn mật khẩu hiện tại" : "Hiện mật khẩu hiện tại"}
                className="absolute right-0.5 md:right-1 top-1/2 -translate-y-1/2 inline-flex min-h-11 min-w-11 md:min-h-9 md:min-w-9 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-on-light"
              >
                {showOldPin ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {pwdError && (
            <p
              role="alert"
              className="text-xs font-bold text-rose-600 flex items-center gap-1.5"
            >
              <span aria-hidden="true">⚠️</span>
              <span>{pwdError}</span>
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <Button variant="outline" onClick={() => setPwdModalOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" variant="primary" loading={isSaving}>
              Lưu Thay Đổi Tài Khoản
            </Button>
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
