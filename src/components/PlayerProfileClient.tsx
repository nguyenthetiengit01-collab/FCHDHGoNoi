"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Share2,
  Check,
  Copy,
  Users,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { Player, MatchAttendance, MatchRecord } from "@/types/app";
import { OFFICIAL_LOGO_URL, FANPAGE_URL } from "@/types/app";
import {
  BroadcastAthleteCard,
  getPlayerPositionBadge,
  getPlayerHamlet,
} from "./BroadcastAthleteCard";
import {
  ImageLightboxModal,
  type LightboxImage,
} from "./ImageLightboxModal";

interface PlayerProfileClientProps {
  player: Player;
  attendances: MatchAttendance[];
  matches: MatchRecord[];
  allPlayers: Player[];
}

export function PlayerProfileClient({
  player,
  attendances,
  matches,
  allPlayers,
}: PlayerProfileClientProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const posBadge = getPlayerPositionBadge(player);
  const hamlet = getPlayerHamlet(player);

  const handleOpenLightbox = (images: LightboxImage[], index = 0) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const getProfileUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/cau-thu/${player.id}`;
    }
    return `https://fchdhgonoi.vercel.app/cau-thu/${player.id}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getProfileUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
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
    handleCopyLink();
  };

  // Teammates excluding current player
  const teammates = allPlayers.filter((p) => p.id !== player.id);

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col selection:bg-gold-400 selection:text-slate-950">
      <a href="#main-content" className="skip-link">
        Bỏ qua điều hướng, tới nội dung chính
      </a>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-navy-900/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-sky-200 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-gold-400" />
            <span className="hidden sm:inline">Quay Lại Trang Chủ CLB</span>
            <span className="sm:hidden">Trang chủ</span>
          </Link>

          {/* Logo & CLB */}
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="FC HĐH Gò Nổi"
              className="h-9 w-9 rounded-full object-contain bg-white p-0.5 border border-gold-400/70 shrink-0"
            />
            <div className="text-left hidden md:block">
              <span className="block font-display font-black text-xs text-gold-400 uppercase tracking-wider">
                FC HỘI ĐỒNG HƯƠNG GÒ NỔI
              </span>
              <span className="text-[10px] text-sky-200/80">
                Hồ Sơ Vận Động Viên Chính Thức
              </span>
            </div>
          </Link>

          {/* Share Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition cursor-pointer"
              title="Sao chép liên kết"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-gold-400" />
              )}
              <span className="hidden sm:inline">{copiedLink ? "Đã chép!" : "Copy Link"}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-royal-500 to-royal-600 hover:from-royal-600 hover:to-navy-500 text-xs font-bold text-white shadow-md transition cursor-pointer"
              title="Chia sẻ hồ sơ qua Zalo / Facebook"
            >
              <Share2 className="h-3.5 w-3.5 text-sky-200" />
              <span>Chia sẻ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Banner giới thiệu hồ sơ định danh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-navy-700 via-navy-800 to-navy-850 border border-gold-400/30 shadow-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gold-400/20 border border-gold-400/50 flex items-center justify-center text-gold-400 shrink-0 font-display font-black text-lg">
              #{player.jersey_number ?? "--"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-tight">
                  Danh Thiếp Vận Động Viên • FC HĐH Gò Nổi
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${posBadge.badgeClass}`}
                >
                  {posBadge.code} • {posBadge.label}
                </span>
              </div>
              <p className="text-xs text-sky-200 mt-0.5">
                Trang hồ sơ chính thức có thể chia sẻ, lưu trữ hoặc in ấn giới thiệu tham gia các giải đấu.
              </p>
            </div>
          </div>

          <a
            href={FANPAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-gold-400 hover:text-gold-300 transition shrink-0 self-end sm:self-center"
          >
            <span>Fanpage CLB</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Thẻ Vận Động Viên Đầy Đủ (BroadcastAthleteCard) */}
        <BroadcastAthleteCard
          player={player}
          attendances={attendances}
          matches={matches}
          layout="split"
          onOpenLightbox={handleOpenLightbox}
          exportable={true}
        />

        {/* Khu vực Đồng Đội Trong Tuyển (Teammates Carousel / Grid) */}
        {teammates.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gold-400" />
                <h3 className="font-display font-black text-lg sm:text-xl text-white uppercase tracking-tight">
                  Đồng Đội Trong Đội Hình ({teammates.length} cầu thủ)
                </h3>
              </div>
              <Link
                href="/"
                className="text-xs font-bold text-sky-300 hover:text-white transition inline-flex items-center gap-1"
              >
                <span>Xem toàn đội</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {teammates.slice(0, 12).map((tm) => {
                const tmPos = getPlayerPositionBadge(tm);
                const tmHamlet = getPlayerHamlet(tm);
                return (
                  <Link
                    key={tm.id}
                    href={`/cau-thu/${tm.id}`}
                    className="group rounded-xl p-3 bg-navy-800/80 hover:bg-navy-500 border border-white/10 hover:border-gold-400/70 transition-all flex flex-col items-center text-center shadow-sm hover:shadow-[0_8px_25px_rgba(20,70,140,0.5)] cursor-pointer"
                  >
                    <div className="relative h-16 w-14 rounded-lg overflow-hidden border border-white/20 group-hover:border-gold-400 transition mb-2 bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tm.avatar_url || "/uploads/avatars/member-1.jpg"}
                        alt={tm.full_name}
                        className="h-full w-full object-cover object-top filter brightness-105 group-hover:scale-105 transition"
                      />
                      <span className="absolute bottom-0 right-0 rounded-tl bg-gold-400 text-slate-950 font-black text-[9px] px-1 leading-tight">
                        #{tm.jersey_number ?? "-"}
                      </span>
                    </div>

                    <h4 className="font-display font-bold text-xs text-white uppercase truncate max-w-full group-hover:text-gold-400 transition">
                      {tm.short_name || tm.full_name}
                    </h4>

                    <div className="flex items-center gap-1 mt-1">
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${tmPos.badgeClass}`}
                      >
                        {tmPos.code}
                      </span>
                      <span className="text-[10px] text-sky-200/80 truncate">
                        Xã {tmHamlet}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 bg-navy-850 py-6 px-4 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-gold-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Logo"
              className="h-5 w-5 rounded-full object-contain bg-white"
            />
            <span>CLB BÓNG ĐÁ HỘI ĐỒNG HƯƠNG GÒ NỔI (TP.HCM)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Hồ sơ vận động viên chính thức • Cập nhật tự động từ cơ sở dữ liệu CLB
          </p>
        </div>
      </footer>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}
