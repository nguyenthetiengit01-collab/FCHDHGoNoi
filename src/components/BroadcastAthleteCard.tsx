"use client";

import React, { useRef, useState } from "react";
import {
  Camera,
  Check,
  Download,
  Loader2,
  MapPin,
  Quote,
  Share2,
  Copy,
} from "lucide-react";
import type { Player, MatchAttendance, MatchRecord } from "@/types/app";
import type { LightboxImage } from "./ImageLightboxModal";
import {
  getPlayerPositionBadge,
  getPlayerHamlet,
  buildAthleteLightboxImages,
  formatBirthYear,
  getPlayerAgeText,
  type PositionBadgeInfo,
} from "@/lib/athleteProfile";
import {
  downloadElementAsPng,
  buildAthleteCardFilename,
} from "@/lib/exportImage";

export type Attendance = MatchAttendance;
export type Match = MatchRecord;

export {
  getPlayerPositionBadge,
  getPlayerHamlet,
  buildAthleteLightboxImages,
  formatBirthYear,
  getPlayerAgeText,
  type PositionBadgeInfo,
};

export interface BroadcastAthleteCardProps {
  player: Player;
  attendances?: Attendance[];
  totalMatchesCount?: number;
  matches?: Match[];
  layout?: "stacked" | "split" | "compact";
  actions?: React.ReactNode;
  fallbackPhotos?: string[];
  onOpenLightbox?: (images: LightboxImage[], index: number) => void;
  exportable?: boolean;
  className?: string;
}

export function BroadcastAthleteCard({
  player,
  attendances = [],
  totalMatchesCount,
  matches,
  layout = "stacked",
  actions,
  fallbackPhotos = [],
  onOpenLightbox,
  exportable = true,
  className = "",
}: BroadcastAthleteCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const getProfileUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/cau-thu/${player.id}`;
    }
    return `https://fchdhgonoi.vercel.app/cau-thu/${player.id}`;
  };

  const handleCopyProfileLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const url = getProfileUrl();
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleShareProfile = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getProfileUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Hồ Sơ Cầu Thủ ${player.full_name} #${player.jersey_number ?? ""}`,
          text: `Xem hồ sơ vận động viên ${player.full_name} (${posBadge.label} • Xã ${hamlet}) - FC HĐH Gò Nổi`,
          url,
        });
        return;
      } catch {
        // Fallback to copy link
      }
    }
    handleCopyProfileLink(e);
  };

  const handleExportCard = async () => {
    if (!cardRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const filename = buildAthleteCardFilename(
        player.full_name,
        player.jersey_number
      );
      // Tải trực tiếp file ảnh PNG sắc nét về máy (Downloads)
      await downloadElementAsPng(cardRef.current, filename, {
        pixelRatio: 2.5,
        quality: 0.98,
      });
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Export athlete card failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const posBadge = getPlayerPositionBadge(player);
  const hamlet = getPlayerHamlet(player);

  const myAtts = attendances.filter((a) => a.player_id === player.id);
  const matchesPlayed = myAtts.filter(
    (a) => a.attended === 1 || a.paid === 1 || a.rsvp_status === "registered"
  ).length;

  const totalMatches =
    totalMatchesCount ?? (matches ? matches.length : 17);

  const cleanBirthYear = formatBirthYear(player.birth_year);
  const playerAge = getPlayerAgeText(player.birth_year);

  const allLightboxImages = buildAthleteLightboxImages(player, fallbackPhotos);

  const profileImageSrc =
    player.profile_image_url ||
    (player.gallery_urls && player.gallery_urls.length > 0 ? player.gallery_urls[0] : null) ||
    (fallbackPhotos.length > 0 ? fallbackPhotos[0] : null);

  const profileImgIdx = allLightboxImages.findIndex(
    (img) => img.src === (player.profile_image_url || profileImageSrc || "")
  );
  const avatarImgIdx = allLightboxImages.findIndex(
    (img) => img.src === (player.avatar_url || "")
  );

  const handleImageClick = (index = 0) => {
    if (onOpenLightbox && allLightboxImages.length > 0) {
      onOpenLightbox(allLightboxImages, index);
    }
  };

  const bioText =
    player.bio?.trim() ||
    "Chiến binh nhiệt huyết của FC HĐH Gò Nổi. Luôn thi đấu với tinh thần fair-play, kỷ luật và niềm tự hào quê hương xứ Quảng sâu nặng.";

  // LAYOUT 1: COMPACT (Dùng cho Modal chi tiết cầu thủ của Ban Quản Lý)
  if (layout === "compact") {
    return (
      <div
        ref={cardRef}
        className={`relative rounded-xl overflow-hidden border border-[#d4af37]/70 bg-gradient-to-br from-[#123e7a] via-[#0e3164] to-[#0a2347] p-4 text-white shadow-[0_10px_30px_rgba(14,49,100,0.45)] ${className}`}
      >
        {exportable && (
          <div data-export-ignore="true" className="absolute top-3 right-3 flex items-center gap-1 z-10">
            <button
              type="button"
              onClick={handleCopyProfileLink}
              className="inline-flex items-center gap-1 p-1.5 px-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-bold text-white transition cursor-pointer"
              title="Sao chép link hồ sơ cá nhân"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-sky-200" />
              )}
              <span className="text-[10px]">{copiedLink ? "Đã chép!" : "Link"}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCard}
              disabled={isExporting}
              className="inline-flex items-center gap-1 p-1.5 px-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-bold text-white transition cursor-pointer"
              title="Xuất ảnh thẻ VĐV gửi Zalo"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ffd700]" />
              ) : exportSuccess ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Download className="h-3.5 w-3.5 text-[#ffd700]" />
              )}
              <span className="text-[10px]">Xuất ảnh</span>
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div
            onClick={() => handleImageClick(0)}
            className="relative shrink-0 cursor-pointer group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={player.avatar_url || "/uploads/avatars/member-1.jpg"}
              alt={player.full_name}
              className="h-28 w-24 rounded-lg object-cover border-2 border-[#ffd700] shadow-lg bg-slate-800 filter brightness-110 contrast-105 group-hover:scale-105 transition"
            />
            <span className="absolute -bottom-2 -right-2 rounded-md bg-[#d4af37] text-slate-950 font-black text-xs px-2 py-0.5 shadow-md border border-white/50">
              #{player.jersey_number ?? "--"}
            </span>
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0 pr-16 sm:pr-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase border ${posBadge.badgeClass}`}
              >
                <span>{posBadge.code}</span>
                <span>•</span>
                <span>{posBadge.label}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                <MapPin className="h-3 w-3 text-[#ffd700]" />
                <span>Xã {hamlet}</span>
              </span>
              {player.nickname && (
                <span className="rounded bg-amber-400/25 px-2 py-0.5 text-[10px] font-bold text-amber-100 border border-amber-400/40">
                  Biệt danh: {player.nickname}
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              {player.full_name}
            </h3>
            <p className="text-xs text-sky-200 mt-0.5">
              Tên gọi sân:{" "}
              <span className="font-bold text-[#ffd700]">
                {player.short_name}
              </span>
              <span> • Thành viên</span>
              {cleanBirthYear ? ` • Sinh năm ${cleanBirthYear}` : ""}
            </p>

            {player.playing_style && (
              <p className="text-xs text-sky-100 mt-1 italic">
                Phong cách: &ldquo;{player.playing_style}&rdquo;
              </p>
            )}

            {player.bio && (
              <div className="mt-2.5 rounded-lg border-l-2 border-[#ffd700] bg-[#082042]/70 p-2.5 text-xs text-slate-100 italic">
                <Quote className="h-3 w-3 text-[#ffd700] inline mr-1" />
                {player.bio}
              </div>
            )}
          </div>
        </div>

        {/* Gallery thumbnails */}
        {player.gallery_urls && player.gallery_urls.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/15">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#ffd700] flex items-center gap-1 mb-2">
              <Camera className="h-3.5 w-3.5" />
              Khoảnh khắc sân cỏ ({player.gallery_urls.length} ảnh)
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {player.gallery_urls.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    handleImageClick(player.avatar_url ? idx + 1 : idx)
                  }
                  className="relative aspect-video rounded-lg overflow-hidden border border-white/20 group hover:border-[#ffd700] transition cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Khoảnh khắc ${idx + 1}`}
                    className="w-full h-full object-cover filter brightness-105 group-hover:scale-105 transition duration-300"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chân trang nhận diện bản quyền khi xuất ảnh */}
        <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-[9px] text-slate-300">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#ffd700]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.jpg"
              alt="FC Gò Nổi"
              className="h-3.5 w-3.5 rounded-full object-contain bg-white shrink-0"
            />
            <span>FC HỘI ĐỒNG HƯƠNG GÒ NỔI • OFFICIAL ATHLETE</span>
          </div>
          <span className="font-mono text-slate-300">fchdhgonoi.vercel.app/cau-thu/{player.id}</span>
        </div>
      </div>
    );
  }

  // LAYOUT 2: SPLIT (Dùng cho Trang cá nhân PlayerPersonalTab)
  if (layout === "split") {
    return (
      <section
        ref={cardRef}
        className={`rounded-xl overflow-hidden bg-gradient-to-b from-[#144485] via-[#0f3468] to-[#0a244c] border border-[#d4af37]/70 shadow-[0_20px_50px_rgba(10,35,80,0.5)] text-white p-5 sm:p-7 space-y-5 ${className}`}
      >
        {/* Top bar: Technical badge + Số áo kỹ thuật + Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/15">
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-lg bg-[#09254d] border border-[#ffd700]/70 flex items-center justify-center shrink-0 shadow-inner">
              <span className="font-display font-black text-3xl sm:text-4xl text-[#ffd700] leading-none">
                #{player.jersey_number ?? "--"}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border ${posBadge.badgeClass}`}
                >
                  {posBadge.code} • {posBadge.label}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-sky-200 font-bold">
                  OFFICIAL ATHLETE CARD
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-sky-100 font-medium">
                  Tài khoản đăng nhập:{" "}
                  <strong className="text-white">
                    @{player.username || player.short_name.toLowerCase()}
                  </strong>
                </span>
                {player.phone && (
                  <span className="text-xs text-sky-200/80">
                    • SĐT: {player.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:self-start">
            <button
              type="button"
              data-export-ignore="true"
              onClick={handleShareProfile}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3 py-2.5 text-xs font-bold transition cursor-pointer shadow-md"
              title="Chia sẻ hồ sơ vận động viên qua Zalo / Facebook"
            >
              <Share2 className="h-4 w-4 text-sky-200" />
              <span>Chia sẻ</span>
            </button>

            <button
              type="button"
              data-export-ignore="true"
              onClick={handleCopyProfileLink}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-2.5 text-xs font-bold transition cursor-pointer shadow-md"
              title="Sao chép đường dẫn hồ sơ"
            >
              {copiedLink ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4 text-[#ffd700]" />
              )}
              <span>{copiedLink ? "Đã chép link!" : "Copy Link"}</span>
            </button>

            {exportable && (
              <button
                type="button"
                data-export-ignore="true"
                onClick={handleExportCard}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2.5 text-xs font-bold transition cursor-pointer shadow-md disabled:opacity-60"
                title="Xuất ảnh thẻ vận động viên sắc nét để gửi Zalo"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#ffd700]" />
                    <span>Đang tạo ảnh...</span>
                  </>
                ) : exportSuccess ? (
                  <>
                    <Check className="h-4 w-4 text-[#fde047]" />
                    <span>Đã lưu / chia sẻ!</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 text-[#ffd700]" />
                    <span>Tải Ảnh Thẻ Về Máy (PNG)</span>
                  </>
                )}
              </button>
            )}
            {actions}
          </div>
        </div>

        {/* ẢNH ĐẠI DIỆN GIỚI THIỆU PROFILE CẦU THỦ (KHUNG RỘNG) */}
        {profileImageSrc && (
          <div
            onClick={() => handleImageClick(profileImgIdx >= 0 ? profileImgIdx : 0)}
            className="relative w-full aspect-[21/9] sm:aspect-[24/9] max-h-[220px] rounded-xl overflow-hidden border border-white/20 shadow-md group cursor-pointer bg-slate-900"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profileImageSrc}
              alt={`${player.full_name} - Ảnh Giới Thiệu Profile`}
              className="w-full h-full object-cover object-center filter brightness-105 group-hover:scale-105 transition duration-700"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#0a244c] via-transparent to-transparent pointer-events-none"
            />
            <div className="absolute top-2.5 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20 flex items-center gap-1">
              <Camera className="h-3 w-3 text-[#ffd700]" />
              <span>Phóng to</span>
            </div>
          </div>
        )}

        {/* Nội dung danh tính + Ảnh Avatar 3:4 hồ sơ thi đấu + Lối chơi */}
        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] lg:grid-cols-[180px_1fr] gap-6 items-start">
          <div
            onClick={() => handleImageClick(avatarImgIdx >= 0 ? avatarImgIdx : 0)}
            className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-[#ffd700]/70 bg-gradient-to-b from-[#10386d] via-[#0d2d58] to-[#092244] shadow-lg group cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={player.avatar_url || "/uploads/avatars/member-1.jpg"}
              alt={player.full_name}
              className="w-full h-full object-cover object-top filter brightness-110 contrast-105 saturate-105 group-hover:scale-105 transition duration-500"
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20 flex items-center gap-1">
              <Camera className="h-3 w-3 text-[#ffd700]" />
              <span>Avatar 3:4</span>
            </div>
            <div className="absolute bottom-1.5 left-1.5 bg-black/75 backdrop-blur-xs px-2 py-0.5 rounded text-[9px] font-bold text-[#ffd700] border border-white/10 pointer-events-none">
              Avatar 3:4 Hồ Sơ
            </div>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#092244] to-transparent pointer-events-none"
            />
            <span
              aria-hidden="true"
              className="absolute right-2 bottom-0 font-display font-black text-6xl text-transparent [-webkit-text-stroke:1px_rgba(255,215,0,0.4)] pointer-events-none select-none leading-none"
            >
              {player.jersey_number ?? ""}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-display font-black uppercase text-2xl sm:text-3xl text-white">
                  {player.full_name}
                </h2>
                {player.short_name && (
                  <span className="text-lg text-[#ffd700] font-bold">
                    ({player.short_name})
                  </span>
                )}
                {player.nickname && (
                  <span className="text-xs font-bold text-[#fde047] bg-[#d4af37]/25 border border-[#d4af37]/50 px-2.5 py-0.5 rounded">
                    Biệt danh: &ldquo;{player.nickname}&rdquo;
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-sky-100 mt-1 flex items-center gap-1 flex-wrap">
                <span className="font-semibold text-white">Thành viên</span>
                <span>•</span>
                <span>
                  {cleanBirthYear
                    ? `Sinh năm ${cleanBirthYear}`
                    : "Thành viên nòng cốt"}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-white">
                  <MapPin className="h-3.5 w-3.5 text-[#ffd700]" />
                  <span>Xã {hamlet} (Gò Nổi)</span>
                </span>
              </p>
              {player.playing_style && (
                <div className="mt-2.5 inline-flex items-center gap-2 bg-[#0c2f5e]/80 border border-sky-300/30 px-3 py-1.5 rounded-md text-xs text-sky-100">
                  <span className="text-[#ffd700] font-bold uppercase tracking-wider text-[10px]">
                    Lối chơi:
                  </span>
                  <span className="font-semibold">{player.playing_style}</span>
                </div>
              )}
            </div>

            {/* 4 Chỉ số thực tế */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="bg-[#0c2f5e]/85 p-2.5 rounded-lg border border-sky-300/25 backdrop-blur-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-200 block">
                  Ra Sân Mùa Này
                </span>
                <span className="text-lg font-display font-black text-[#ffd700] block mt-0.5">
                  {matchesPlayed}/{totalMatches} trận
                </span>
                <span className="text-[9px] text-sky-200/80 block mt-0.5">
                  Đội hình chính
                </span>
              </div>
              <div className="bg-[#0c2f5e]/85 p-2.5 rounded-lg border border-sky-300/25 backdrop-blur-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-200 block">
                  Độ Tuổi
                </span>
                <span className="text-lg font-display font-black text-white block mt-0.5">
                  {playerAge}
                </span>
                <span className="text-[9px] text-sky-200/80 block mt-0.5">
                  Thể lực bền bỉ
                </span>
              </div>
              <div className="bg-[#0c2f5e]/85 p-2.5 rounded-lg border border-sky-300/25 backdrop-blur-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-200 block">
                  Quê Quán
                </span>
                <span className="text-base font-display font-black text-white block mt-0.5 truncate">
                  Xã {hamlet}
                </span>
                <span className="text-[9px] text-sky-200/80 block mt-0.5">
                  Gò Nổi (Quảng Nam)
                </span>
              </div>
              <div className="bg-[#0c2f5e]/85 p-2.5 rounded-lg border border-sky-300/25 backdrop-blur-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-200 block">
                  Vị Trí Sân
                </span>
                <span className="text-base font-display font-black text-white block mt-0.5 truncate">
                  {player.position}
                </span>
                <span className="text-[9px] text-sky-200/80 block mt-0.5">
                  Kỹ thuật cá nhân
                </span>
              </div>
            </div>

            {/* Trích dẫn châm ngôn */}
            <div className="rounded-lg bg-gradient-to-r from-[#0c2f5e] to-[#124285] border-l-4 border-[#ffd700] p-3.5 text-xs text-slate-100 shadow-sm">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#ffd700] block mb-1">
                LỜI NHẮN NHỦ &amp; TINH THẦN SÂN CỎ
              </span>
              <p className="italic leading-relaxed">
                <Quote className="h-3 w-3 text-[#ffd700] inline mr-1" />
                &ldquo;{bioText}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Gallery thumbnails */}
        {allLightboxImages.length > 1 && (
          <div className="pt-3 border-t border-white/15">
            <span className="text-xs font-bold uppercase tracking-wider text-[#ffd700] flex items-center gap-1.5 mb-2.5">
              <Camera className="h-4 w-4" />
              Bộ sưu tập khoảnh khắc thi đấu &amp; hoạt động ({allLightboxImages.length} ảnh)
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {allLightboxImages.slice(1).map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleImageClick(i + 1)}
                  className="relative aspect-video rounded-lg overflow-hidden border border-white/20 group hover:border-[#ffd700] transition cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.title || `Ảnh ${i + 1}`}
                    className="w-full h-full object-cover filter brightness-105 group-hover:scale-110 transition duration-300"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Chân trang nhận diện bản quyền khi xuất ảnh */}
        <div className="pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-slate-300">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[#ffd700]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo.jpg"
              alt="FC Gò Nổi"
              className="h-4 w-4 rounded-full object-contain bg-white shrink-0"
            />
            <span>FC HỘI ĐỒNG HƯƠNG GÒ NỔI • OFFICIAL ATHLETE</span>
          </div>
          <span className="text-slate-300 font-mono text-[10px] hidden sm:inline">
            fchdhgonoi.vercel.app/cau-thu/{player.id}
          </span>
        </div>
      </section>
    );
  }

  // LAYOUT 3: STACKED (Mặc định - Dùng cho Section 3 ngoài PublicGuestPortal)
  return (
    <div
      ref={cardRef}
      className={`rounded-xl overflow-hidden bg-gradient-to-b from-[#144485] via-[#0f3468] to-[#0a244c] border border-[#d4af37]/70 shadow-[0_20px_50px_rgba(10,35,80,0.5)] p-5 sm:p-6 space-y-5 ${className}`}
    >
      {/* Top Bar: Số áo kỹ thuật + Huy hiệu vị trí + Quê quán */}
      <div className="flex items-center justify-between pb-4 border-b border-white/15">
        <div className="flex items-center gap-3.5">
          <div className="h-14 w-14 rounded-lg bg-[#09254d] border border-[#ffd700]/70 flex items-center justify-center shrink-0 shadow-inner">
            <span className="font-display font-black text-3xl sm:text-4xl text-[#ffd700] leading-none">
              #{player.jersey_number ?? "--"}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border ${posBadge.badgeClass}`}
              >
                {posBadge.code} • {posBadge.label}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-sky-200 font-bold hidden sm:inline">
                OFFICIAL ROSTER
              </span>
            </div>
            <span className="text-xs text-sky-100 font-medium block mt-1">
              Chiến binh FC HĐH Gò Nổi • Mùa giải 2026
            </span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/15 px-3 py-1 rounded-md border border-white/20">
              <MapPin className="h-3.5 w-3.5 text-[#ffd700]" />
              <span>Xã {hamlet}</span>
            </span>

            <button
              type="button"
              data-export-ignore="true"
              onClick={handleCopyProfileLink}
              className="inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white px-2 py-1 text-xs font-bold transition cursor-pointer"
              title="Sao chép link hồ sơ cá nhân"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-sky-200" />
              )}
              <span className="hidden sm:inline">{copiedLink ? "Đã chép!" : "Copy Link"}</span>
            </button>

            {exportable && (
              <button
                type="button"
                data-export-ignore="true"
                onClick={handleExportCard}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#d4af37]/25 hover:bg-[#d4af37]/40 border border-[#d4af37]/60 text-[#fde047] px-2.5 py-1 text-xs font-extrabold transition cursor-pointer shadow-xs disabled:opacity-60"
                title="Xuất ảnh thẻ cầu thủ gửi Zalo"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ffd700]" />
                    <span className="hidden sm:inline">Đang xuất...</span>
                  </>
                ) : exportSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Đã tải!</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 text-[#ffd700]" />
                    <span>Tải Ảnh Thẻ</span>
                  </>
                )}
              </button>
            )}
          </div>

          {player.nickname && (
            <span className="text-[11px] font-bold text-[#fde047] tracking-wide">
              Biệt danh: &ldquo;{player.nickname}&rdquo;
            </span>
          )}
        </div>
      </div>

      {/* Khung Ảnh Profile Khung Rộng & Avatar Chân Dung Kết Hợp Kép */}
      <div className="space-y-3">
        {/* 1. Ảnh Profile Khung Rộng (Toàn thân / Hoạt động sân cỏ) */}
        <div
          onClick={() => handleImageClick(profileImgIdx >= 0 ? profileImgIdx : 0)}
          className="relative w-full aspect-[16/9] sm:aspect-[16/10] max-h-[380px] rounded-xl overflow-hidden border border-white/20 shadow-[0_15px_40px_rgba(10,35,80,0.5)] bg-slate-900 group cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profileImageSrc || player.avatar_url || "/uploads/avatars/member-1.jpg"}
            alt={`${player.full_name} - Ảnh Giới Thiệu Profile`}
            className="w-full h-full object-cover object-center filter brightness-105 group-hover:scale-105 transition duration-700"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#092244] via-transparent to-transparent pointer-events-none"
          />
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-md border border-white/20 flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 text-[#ffd700]" />
            <span>Phóng to</span>
          </div>

          {/* Huy hiệu Avatar 3:4 chân dung lồng ở góc dưới */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleImageClick(avatarImgIdx >= 0 ? avatarImgIdx : 0);
            }}
            className="absolute bottom-3 left-3 flex items-center gap-2.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-xl border border-[#ffd700]/70 shadow-2xl hover:scale-105 transition"
            title="Nhấp để xem ảnh thẻ Avatar chuẩn 3:4"
          >
            <div className="relative h-16 w-12 rounded-lg overflow-hidden border border-white/30 bg-slate-800 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={player.avatar_url || "/uploads/avatars/member-1.jpg"}
                alt="Avatar 3:4"
                className="h-full w-full object-cover object-top filter brightness-110"
              />
            </div>
            <div className="pr-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#ffd700] block">
                Avatar 3:4
              </span>
              <span className="text-xs font-extrabold text-white block">
                Hồ sơ thi đấu
              </span>
            </div>
          </div>

          {/* Số áo in chìm */}
          <span
            aria-hidden="true"
            className="absolute right-3 bottom-0 font-display font-black text-6xl sm:text-7xl text-transparent [-webkit-text-stroke:1.5px_rgba(255,215,0,0.4)] pointer-events-none select-none leading-none drop-shadow-lg"
          >
            {player.jersey_number ?? ""}
          </span>
        </div>
      </div>

      {/* Thông tin danh tính & Lối chơi */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display font-black uppercase text-2xl sm:text-3xl text-white">
            {player.full_name}
          </h3>
          {player.short_name && (
            <span className="text-lg text-[#ffd700] font-bold">
              ({player.short_name})
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-sky-100 mt-1">
          <span className="font-semibold text-white">Thành viên</span> •{" "}
          {cleanBirthYear
            ? `Năm sinh ${cleanBirthYear}`
            : "Thành viên nòng cốt"}
        </p>

        {player.playing_style && (
          <div className="mt-2.5 inline-flex items-center gap-2 bg-[#0c2f5e]/80 border border-sky-300/30 px-3 py-1.5 rounded-md text-xs text-sky-100">
            <span className="text-[#ffd700] font-bold uppercase tracking-wider text-[10px]">
              Lối chơi:
            </span>
            <span className="font-semibold">{player.playing_style}</span>
          </div>
        )}
      </div>

      {/* 4 Chỉ số thực tế của cầu thủ (Real Stat Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/15 text-center">
        <div className="bg-[#0c2f5e]/85 p-2.5 sm:p-3 rounded-lg border border-sky-300/25 backdrop-blur-xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-sky-200 block">
            Ra Sân Mùa Này
          </span>
          <span className="text-lg sm:text-xl font-display font-black text-[#ffd700] block mt-0.5">
            {matchesPlayed > 0 ? `${matchesPlayed} trận` : "Sẵn sàng"}
          </span>
          <span className="text-[9px] text-sky-200/80 block mt-0.5">
            Sân 7 người
          </span>
        </div>
        <div className="bg-[#0c2f5e]/85 p-2.5 sm:p-3 rounded-lg border border-sky-300/25 backdrop-blur-xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-sky-200 block">
            Độ Tuổi
          </span>
          <span className="text-lg sm:text-xl font-display font-black text-white block mt-0.5">
            {playerAge}
          </span>
          <span className="text-[9px] text-sky-200/80 block mt-0.5">
            Thể lực ổn định
          </span>
        </div>
        <div className="bg-[#0c2f5e]/85 p-2.5 sm:p-3 rounded-lg border border-sky-300/25 backdrop-blur-xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-sky-200 block">
            Quê Quán
          </span>
          <span className="text-base sm:text-lg font-display font-black text-white block mt-0.5 truncate">
            Xã {hamlet}
          </span>
          <span className="text-[9px] text-sky-200/80 block mt-0.5">
            Gò Nổi, Điện Bàn
          </span>
        </div>
        <div className="bg-[#0c2f5e]/85 p-2.5 sm:p-3 rounded-lg border border-sky-300/25 backdrop-blur-xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-sky-200 block">
            Vị Trí Sân
          </span>
          <span className="text-base sm:text-lg font-display font-black text-white block mt-0.5 truncate">
            {player.position}
          </span>
          <span className="text-[9px] text-sky-200/80 block mt-0.5">
            {posBadge.code}
          </span>
        </div>
      </div>

      {/* Trích dẫn châm ngôn / Bio cá nhân */}
      <div className="rounded-lg bg-gradient-to-r from-[#0c2f5e] to-[#124285] border-l-4 border-[#ffd700] p-3.5 text-xs text-slate-100 shadow-sm">
        <span className="text-[10px] uppercase font-black tracking-widest text-[#ffd700] block mb-1">
          CHÂM NGÔN &amp; LỜI GIỚI THIỆU SÂN CỎ
        </span>
        <p className="italic leading-relaxed">
          <Quote className="h-3 w-3 text-[#ffd700] inline mr-1" />
          &ldquo;{bioText}&rdquo;
        </p>
      </div>

      {/* Bộ sưu tập ảnh thi đấu */}
      {allLightboxImages.length > 1 && (
        <div className="pt-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#ffd700] flex items-center gap-1.5 mb-2">
            <Camera className="h-3.5 w-3.5" />
            Khoảnh khắc sân cỏ ({allLightboxImages.length} ảnh)
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {allLightboxImages.slice(1, 5).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleImageClick(i + 1)}
                className="relative aspect-video rounded-lg overflow-hidden border border-white/20 group hover:border-[#ffd700] transition cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.title || `Khoảnh khắc ${i + 1}`}
                  className="w-full h-full object-cover filter brightness-105 group-hover:scale-110 transition duration-300"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Chân trang nhận diện bản quyền khi xuất ảnh */}
      <div className="pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-slate-300">
        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[#ffd700]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.jpg"
            alt="FC Gò Nổi"
            className="h-4 w-4 rounded-full object-contain bg-white shrink-0"
          />
          <span>FC HỘI ĐỒNG HƯƠNG GÒ NỔI • OFFICIAL ATHLETE</span>
        </div>
        <span className="text-slate-300 font-mono text-[10px] hidden sm:inline">
          fchdhgonoi.vercel.app/cau-thu/{player.id}
        </span>
      </div>
    </div>
  );
}
