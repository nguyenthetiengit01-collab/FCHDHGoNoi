"use client";

import React from "react";
import { Camera, MapPin, Quote, Shield } from "lucide-react";
import type { Player, MatchAttendance, MatchRecord } from "@/types/app";
import type { LightboxImage } from "./ImageLightboxModal";
import {
  getPlayerPositionBadge,
  getPlayerHamlet,
  buildAthleteLightboxImages,
  type PositionBadgeInfo,
} from "@/lib/athleteProfile";

export type Attendance = MatchAttendance;
export type Match = MatchRecord;

export {
  getPlayerPositionBadge,
  getPlayerHamlet,
  buildAthleteLightboxImages,
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
  className = "",
}: BroadcastAthleteCardProps) {
  const posBadge = getPlayerPositionBadge(player);
  const hamlet = getPlayerHamlet(player);

  const myAtts = attendances.filter((a) => a.player_id === player.id);
  const matchesPlayed = myAtts.filter(
    (a) => a.attended === 1 || a.paid === 1 || a.rsvp_status === "registered"
  ).length;

  const totalMatches =
    totalMatchesCount ?? (matches ? matches.length : 17);

  const currentYear = new Date().getFullYear();
  const birthYearNum = player.birth_year ? Number(player.birth_year) : null;
  const playerAge =
    birthYearNum && !isNaN(birthYearNum)
      ? `${currentYear - birthYearNum} tuổi`
      : "Nòng cốt";

  const allLightboxImages = buildAthleteLightboxImages(player, fallbackPhotos);

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
        className={`relative rounded-xl overflow-hidden border border-[#d4af37]/40 bg-gradient-to-br from-[#0b2447] via-[#081a33] to-[#040e1a] p-4 text-white shadow-md ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div
            onClick={() => handleImageClick(0)}
            className="relative shrink-0 cursor-pointer group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={player.avatar_url || "/uploads/avatars/member-1.jpg"}
              alt={player.full_name}
              className="h-28 w-24 rounded-lg object-cover border-2 border-[#d4af37]/70 shadow-lg bg-slate-800 group-hover:scale-105 transition"
            />
            <span className="absolute -bottom-2 -right-2 rounded-md bg-[#d4af37] text-slate-950 font-black text-xs px-2 py-0.5 shadow-md border border-white/50">
              #{player.jersey_number ?? "--"}
            </span>
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase border ${posBadge.badgeClass}`}
              >
                <span>{posBadge.code}</span>
                <span>•</span>
                <span>{posBadge.label}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                <MapPin className="h-3 w-3 text-[#d4af37]" />
                <span>Xã {hamlet}</span>
              </span>
              {player.nickname && (
                <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 border border-amber-400/30">
                  Biệt danh: {player.nickname}
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              {player.full_name}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Tên gọi sân:{" "}
              <span className="font-bold text-[#d4af37]">
                {player.short_name}
              </span>
              {player.birth_year ? ` • Sinh năm ${player.birth_year}` : ""}
              {player.role ? ` • ${player.role}` : ""}
            </p>

            {player.playing_style && (
              <p className="text-xs text-sky-200 mt-1 italic">
                Phong cách: &ldquo;{player.playing_style}&rdquo;
              </p>
            )}

            {player.bio && (
              <div className="mt-2.5 rounded-lg border-l-2 border-[#d4af37] bg-white/5 p-2.5 text-xs text-slate-200 italic">
                <Quote className="h-3 w-3 text-[#d4af37] inline mr-1" />
                {player.bio}
              </div>
            )}
          </div>
        </div>

        {/* Gallery thumbnails */}
        {player.gallery_urls && player.gallery_urls.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#d4af37] flex items-center gap-1 mb-2">
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
                  className="relative aspect-video rounded-lg overflow-hidden border border-white/20 group hover:border-[#d4af37] transition cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Khoảnh khắc ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // LAYOUT 2: SPLIT (Dùng cho Trang cá nhân PlayerPersonalTab)
  if (layout === "split") {
    return (
      <section
        className={`rounded-xl overflow-hidden bg-gradient-to-b from-[#0b2447] via-[#081a33] to-[#040e1a] border border-[#d4af37]/60 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-white p-5 sm:p-7 space-y-5 ${className}`}
      >
        {/* Top bar: Technical badge + Số áo kỹ thuật + Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-lg bg-[#040e1a] border border-[#d4af37]/60 flex items-center justify-center shrink-0 shadow-inner">
              <span className="font-display font-black text-3xl sm:text-4xl text-[#d4af37] leading-none">
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
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  OFFICIAL ATHLETE CARD
                </span>
                {player.access_role === "manager" && (
                  <span className="inline-flex items-center gap-1 rounded bg-[#d4af37]/20 border border-[#d4af37]/50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#fde047]">
                    <Shield className="h-3 w-3" />
                    <span>BAN ĐIỀU HÀNH &amp; THỦ QUỸ</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-sky-200/80 font-medium">
                  Tài khoản đăng nhập:{" "}
                  <strong className="text-white">
                    @{player.username || player.short_name.toLowerCase()}
                  </strong>
                </span>
                {player.phone && (
                  <span className="text-xs text-slate-400">
                    • SĐT: {player.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {actions && (
            <div className="flex flex-wrap items-center gap-2.5 sm:self-start">
              {actions}
            </div>
          )}
        </div>

        {/* Nội dung danh tính + Ảnh chân dung + Lối chơi */}
        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] lg:grid-cols-[180px_1fr] gap-6 items-start">
          <div
            onClick={() => handleImageClick(0)}
            className="relative aspect-[3/4] rounded-lg overflow-hidden border border-white/15 bg-gradient-to-b from-[#092244] via-[#061730] to-[#040e1a] shadow-lg group cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={player.avatar_url || "/uploads/avatars/member-1.jpg"}
              alt={player.full_name}
              className="w-full h-full object-cover object-top filter brightness-105 contrast-[1.02] group-hover:scale-105 transition duration-500"
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20 flex items-center gap-1">
              <Camera className="h-3 w-3 text-[#d4af37]" />
              <span>Phóng to</span>
            </div>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#040e1a] to-transparent pointer-events-none"
            />
            <span
              aria-hidden="true"
              className="absolute right-2 bottom-0 font-display font-black text-6xl text-transparent [-webkit-text-stroke:1px_rgba(212,175,55,0.3)] pointer-events-none select-none leading-none"
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
                  <span className="text-lg text-[#d4af37] font-bold">
                    ({player.short_name})
                  </span>
                )}
                {player.nickname && (
                  <span className="text-xs font-bold text-[#fde047] bg-[#d4af37]/20 border border-[#d4af37]/40 px-2.5 py-0.5 rounded">
                    Biệt danh: &ldquo;{player.nickname}&rdquo;
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-sky-200 mt-1 flex items-center gap-1 flex-wrap">
                <span>{player.role || "Cầu thủ thi đấu"}</span>
                <span>•</span>
                <span>
                  {player.birth_year
                    ? `Sinh năm ${player.birth_year}`
                    : "Thành viên nòng cốt"}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-white">
                  <MapPin className="h-3.5 w-3.5 text-[#d4af37]" />
                  <span>Xã {hamlet} (Gò Nổi)</span>
                </span>
              </p>
              {player.playing_style && (
                <div className="mt-2.5 inline-flex items-center gap-2 bg-[#051426] border border-white/15 px-3 py-1.5 rounded-md text-xs text-sky-100">
                  <span className="text-[#d4af37] font-bold uppercase tracking-wider text-[10px]">
                    Lối chơi:
                  </span>
                  <span className="font-semibold">{player.playing_style}</span>
                </div>
              )}
            </div>

            {/* 4 Chỉ số thực tế */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              <div className="bg-[#051426] p-2.5 rounded-lg border border-white/10">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Ra Sân Mùa Này
                </span>
                <span className="text-lg font-display font-black text-[#d4af37] block mt-0.5">
                  {matchesPlayed}/{totalMatches} trận
                </span>
                <span className="text-[9px] text-sky-300/70 block mt-0.5">
                  Đội hình chính
                </span>
              </div>
              <div className="bg-[#051426] p-2.5 rounded-lg border border-white/10">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Độ Tuổi
                </span>
                <span className="text-lg font-display font-black text-white block mt-0.5">
                  {playerAge}
                </span>
                <span className="text-[9px] text-sky-300/70 block mt-0.5">
                  Thể lực bền bỉ
                </span>
              </div>
              <div className="bg-[#051426] p-2.5 rounded-lg border border-white/10">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Quê Quán
                </span>
                <span className="text-base font-display font-black text-white block mt-0.5 truncate">
                  Xã {hamlet}
                </span>
                <span className="text-[9px] text-sky-300/70 block mt-0.5">
                  Gò Nổi (Quảng Nam)
                </span>
              </div>
              <div className="bg-[#051426] p-2.5 rounded-lg border border-white/10">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Vị Trí Sân
                </span>
                <span className="text-base font-display font-black text-white block mt-0.5 truncate">
                  {player.position}
                </span>
                <span className="text-[9px] text-sky-300/70 block mt-0.5">
                  Kỹ thuật cá nhân
                </span>
              </div>
            </div>

            {/* Trích dẫn châm ngôn */}
            <div className="rounded-lg bg-gradient-to-r from-[#051426] to-[#081a33] border-l-4 border-[#d4af37] p-3.5 text-xs text-slate-200">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#d4af37] block mb-1">
                LỜI NHẮN NHỦ &amp; TINH THẦN SÂN CỎ
              </span>
              <p className="italic leading-relaxed">
                <Quote className="h-3 w-3 text-[#d4af37] inline mr-1" />
                &ldquo;{bioText}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Gallery thumbnails */}
        {allLightboxImages.length > 1 && (
          <div className="pt-3 border-t border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#d4af37] flex items-center gap-1.5 mb-2.5">
              <Camera className="h-4 w-4" />
              Bộ sưu tập khoảnh khắc thi đấu &amp; hoạt động ({allLightboxImages.length} ảnh)
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {allLightboxImages.slice(1).map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleImageClick(i + 1)}
                  className="relative aspect-video rounded-lg overflow-hidden border border-white/20 group hover:border-[#d4af37] transition cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.title || `Ảnh ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  // LAYOUT 3: STACKED (Mặc định - Dùng cho Section 3 ngoài PublicGuestPortal)
  return (
    <div
      className={`rounded-xl overflow-hidden bg-gradient-to-b from-[#0b2447] via-[#081a33] to-[#040e1a] border border-[#d4af37]/60 shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-5 sm:p-6 space-y-5 ${className}`}
    >
      {/* Top Bar: Số áo kỹ thuật + Huy hiệu vị trí + Quê quán */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="h-14 w-14 rounded-lg bg-[#040e1a] border border-[#d4af37]/60 flex items-center justify-center shrink-0 shadow-inner">
            <span className="font-display font-black text-3xl sm:text-4xl text-[#d4af37] leading-none">
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
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold hidden sm:inline">
                OFFICIAL ROSTER
              </span>
            </div>
            <span className="text-xs text-sky-200/80 font-medium block mt-1">
              Chiến binh FC HĐH Gò Nổi • Mùa giải 2026
            </span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200 bg-white/5 px-3 py-1 rounded-md border border-white/10">
            <MapPin className="h-3.5 w-3.5 text-[#d4af37]" />
            <span>Xã {hamlet}</span>
          </span>
          {player.nickname && (
            <span className="text-[11px] font-bold text-[#fde047] tracking-wide">
              Biệt danh: &ldquo;{player.nickname}&rdquo;
            </span>
          )}
        </div>
      </div>

      {/* Ảnh chân dung lớn: Nhấp để phóng to Lightbox */}
      <div
        onClick={() => handleImageClick(0)}
        className="relative w-full aspect-[3/4] max-h-[480px] rounded-lg overflow-hidden border border-white/15 shadow-[0_15px_40px_rgba(0,0,0,0.8)] bg-gradient-to-b from-[#092244] via-[#061730] to-[#040e1a] flex items-center justify-center cursor-pointer group"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={player.avatar_url || "/uploads/avatars/member-1.jpg"}
          alt={player.full_name}
          className="w-full h-full object-cover object-top filter brightness-105 contrast-[1.02] group-hover:scale-105 transition duration-500"
        />

        {/* Nút bấm phóng to hiển thị khi hover */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-md border border-white/20 flex items-center gap-1.5 shadow-lg">
          <Camera className="h-3.5 w-3.5 text-[#d4af37]" />
          <span>Phóng to ảnh</span>
        </div>

        {/* Lớp phủ chuyển sắc nhẹ đáy ảnh */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#040e1a] via-[#040e1a]/60 to-transparent pointer-events-none"
        />

        {/* Số áo in chìm kỹ thuật */}
        <span
          aria-hidden="true"
          className="absolute right-3 bottom-1 font-display font-black text-7xl text-transparent [-webkit-text-stroke:1.5px_rgba(212,175,55,0.35)] pointer-events-none select-none leading-none drop-shadow-lg"
        >
          {player.jersey_number ?? ""}
        </span>
      </div>

      {/* Thông tin danh tính & Lối chơi */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display font-black uppercase text-2xl sm:text-3xl text-white">
            {player.full_name}
          </h3>
          {player.short_name && (
            <span className="text-lg text-[#d4af37] font-bold">
              ({player.short_name})
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-sky-200 mt-1">
          {player.role || "Cầu thủ thi đấu"} •{" "}
          {player.birth_year
            ? `Năm sinh ${player.birth_year}`
            : "Thành viên nòng cốt"}
        </p>

        {player.playing_style && (
          <div className="mt-2.5 inline-flex items-center gap-2 bg-[#051426] border border-white/15 px-3 py-1.5 rounded-md text-xs text-sky-100">
            <span className="text-[#d4af37] font-bold uppercase tracking-wider text-[10px]">
              Lối chơi:
            </span>
            <span className="font-semibold">{player.playing_style}</span>
          </div>
        )}
      </div>

      {/* 4 Chỉ số thực tế của cầu thủ (Real Stat Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-center">
        <div className="bg-[#051426] p-2.5 sm:p-3 rounded-lg border border-white/10">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            Ra Sân Mùa Này
          </span>
          <span className="text-lg sm:text-xl font-display font-black text-[#d4af37] block mt-0.5">
            {matchesPlayed > 0 ? `${matchesPlayed} trận` : "Sẵn sàng"}
          </span>
          <span className="text-[9px] text-sky-300/70 block mt-0.5">
            Sân 7 người
          </span>
        </div>
        <div className="bg-[#051426] p-2.5 sm:p-3 rounded-lg border border-white/10">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            Độ Tuổi
          </span>
          <span className="text-lg sm:text-xl font-display font-black text-white block mt-0.5">
            {playerAge}
          </span>
          <span className="text-[9px] text-sky-300/70 block mt-0.5">
            Thể lực ổn định
          </span>
        </div>
        <div className="bg-[#051426] p-2.5 sm:p-3 rounded-lg border border-white/10">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            Quê Quán
          </span>
          <span className="text-base sm:text-lg font-display font-black text-white block mt-0.5 truncate">
            Xã {hamlet}
          </span>
          <span className="text-[9px] text-sky-300/70 block mt-0.5">
            Gò Nổi, Điện Bàn
          </span>
        </div>
        <div className="bg-[#051426] p-2.5 sm:p-3 rounded-lg border border-white/10">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            Vị Trí Sân
          </span>
          <span className="text-base sm:text-lg font-display font-black text-white block mt-0.5 truncate">
            {player.position}
          </span>
          <span className="text-[9px] text-sky-300/70 block mt-0.5">
            {posBadge.code}
          </span>
        </div>
      </div>

      {/* Trích dẫn châm ngôn / Bio cá nhân */}
      <div className="rounded-lg bg-gradient-to-r from-[#051426] to-[#081a33] border-l-4 border-[#d4af37] p-3.5 text-xs text-slate-200">
        <span className="text-[10px] uppercase font-black tracking-widest text-[#d4af37] block mb-1">
          CHÂM NGÔN &amp; LỜI GIỚI THIỆU SÂN CỎ
        </span>
        <p className="italic leading-relaxed">
          <Quote className="h-3 w-3 text-[#d4af37] inline mr-1" />
          &ldquo;{bioText}&rdquo;
        </p>
      </div>

      {/* Bộ sưu tập ảnh thi đấu */}
      {allLightboxImages.length > 1 && (
        <div className="pt-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#d4af37] flex items-center gap-1.5 mb-2">
            <Camera className="h-3.5 w-3.5" />
            Khoảnh khắc sân cỏ ({allLightboxImages.length} ảnh)
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {allLightboxImages.slice(1, 5).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleImageClick(i + 1)}
                className="relative aspect-video rounded-lg overflow-hidden border border-white/20 group hover:border-[#d4af37] transition cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.title || `Khoảnh khắc ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
