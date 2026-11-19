"use client";

import React from "react";
import { ArrowRight, Search } from "lucide-react";
import type { FullAppData, Player } from "@/types/app";
import {
  BroadcastAthleteCard,
  getPlayerHamlet,
  getPlayerPositionBadge,
} from "../BroadcastAthleteCard";
import type { LightboxImage } from "../ImageLightboxModal";
import { FALLBACK_ACTION_PHOTOS, Reveal, WRAP, type ExpandedPlayerDetailProps } from "./shared";

function ExpandedPlayerDetail({
  player,
  attendances,
  onOpenImage,
}: ExpandedPlayerDetailProps) {
  if (!player) return null;

  return (
    <BroadcastAthleteCard
      player={player}
      attendances={attendances}
      layout="stacked"
      fallbackPhotos={FALLBACK_ACTION_PHOTOS}
      onOpenLightbox={(imgs, idx) => {
        if (onOpenImage) onOpenImage(imgs, idx);
      }}
    />
  );
}



/* =========================================================================
   THẺ CẦU THỦ THU NHỎ XẾP GỌN (MATCHDAY TEAM SHEET ROSTER)
   ========================================================================= */
interface CompactPlayerRowProps {
  player: Player;
  isSelected: boolean;
  onSelect: () => void;
}

function CompactPlayerRow({
  player,
  isSelected,
  onSelect,
}: CompactPlayerRowProps) {
  const posBadge = getPlayerPositionBadge(player);
  const hamlet = getPlayerHamlet(player);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`group w-full text-left flex items-center justify-between p-3 rounded-lg transition-all border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-on-dark ${isSelected
        ? "bg-navy-500 border-l-4 border-l-gold-400 border-y-gold-400/70 border-r-gold-400/70 shadow-[0_4px_25px_rgba(20,70,140,0.5)]"
        : "bg-navy-700 border border-white/15 hover:border-sky-300/40 hover:bg-navy-500"
        }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-md bg-navy-800 border border-gold-400/60 flex items-center justify-center shrink-0 font-display font-black text-base text-gold-400">
          #{player.jersey_number ?? "--"}
        </div>

        <div className="relative h-11 w-11 rounded-md overflow-hidden bg-navy-800 border border-white/20 shrink-0">
          {player.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.avatar_url}
              alt={player.full_name}
              loading="lazy"
              className="h-full w-full object-cover object-top filter brightness-105 contrast-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-sky-200">
              {posBadge.code}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-display font-bold uppercase text-sm text-white truncate">
              {player.full_name}
            </span>
            {player.nickname && (
              <span className="text-xs text-gold-400 font-semibold shrink-0">
                ({player.nickname})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${posBadge.badgeClass}`}
            >
              {posBadge.code}
            </span>
            <span className="text-[11px] text-sky-200/80 truncate">
              Xã {hamlet}
            </span>
          </div>
        </div>
      </div>

      <div className="text-right shrink-0 pl-2">
        {isSelected ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gold-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-sm">
            <span>ĐANG XEM</span>
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-sky-200 group-hover:text-white transition inline-flex items-center gap-1">
            <span>Xem</span>
            <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </button>
  );
}


export interface RosterShowcaseProps {
  data: FullAppData;
  totalPlayerCount: number;
  squadFilter: "all" | "GK" | "DF" | "MF" | "FW" | "ĐN";
  setSquadFilter: React.Dispatch<
    React.SetStateAction<"all" | "GK" | "DF" | "MF" | "FW" | "ĐN">
  >;
  playerSearchQuery: string;
  setPlayerSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  displayedSquad: Player[];
  selectedPlayer: Player | null;
  setSelectedPlayerId: React.Dispatch<React.SetStateAction<number | null>>;
  handleOpenLightbox: (images: LightboxImage[], startIndex?: number) => void;
}

export function RosterShowcase({
  data,
  totalPlayerCount,
  squadFilter,
  setSquadFilter,
  playerSearchQuery,
  setPlayerSearchQuery,
  displayedSquad,
  selectedPlayer,
  setSelectedPlayerId,
  handleOpenLightbox,
}: RosterShowcaseProps) {
  return (
      <section
        id="squad-section"
        className="relative bg-gradient-to-b from-navy-600 via-navy-500 to-navy-700 py-20 sm:py-28 overflow-hidden border-y border-gold-400/30"
      >
        <div className={WRAP}>
          <Reveal>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-white/15">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-gold-400 bg-gold-400/15 px-2.5 py-1 rounded border border-gold-400/40">
                    03 // ĐỘI HÌNH &amp; HỒ SƠ {totalPlayerCount}+ CẦU THỦ
                  </span>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-sky-200">
                    ROSTER 2026
                  </span>
                </div>
                <h2 className="mt-3 font-display font-black uppercase leading-tight text-4xl sm:text-6xl text-white">
                  Đội hình <span className="text-gold-400">{totalPlayerCount}+ chiến binh</span>
                </h2>
                <p className="text-xs sm:text-sm text-sky-100 mt-2 max-w-2xl leading-relaxed font-light">
                  Bảng danh sách đăng ký thi đấu chính thức mùa giải 2026. Chọn cầu thủ bên danh sách để xem thẻ vận động viên và hồ sơ chuyên sâu.
                </p>
              </div>

              {/* Thông số nhanh */}
              <div className="flex items-center gap-3">
                <div className="bg-navy-700 px-5 py-3 rounded-lg border border-gold-400/50 shadow-md text-right">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-sky-200 block">
                    Đội hình chính thức
                  </span>
                  <span className="text-2xl font-display font-black text-gold-300 leading-none">
                    {totalPlayerCount}+ Cầu thủ
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* BỐ CỤC 50/50: 1/2 TRÁI PHÓNG TO CHI TIẾT - 1/2 PHẢI THU NHỎ XẾP GỌN */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* CỘT 1/2 BÊN TRÁI: CHI TIẾT CẦU THỦ ĐƯỢC CHỌN */}
            <div className="lg:col-span-6 lg:sticky lg:top-24">
              <Reveal>
                <ExpandedPlayerDetail
                  player={selectedPlayer}
                  attendances={data.attendances}
                  onOpenImage={handleOpenLightbox}
                />
              </Reveal>
            </div>

            {/* CỘT 1/2 BÊN PHẢI: TEAM SHEET ROSTER */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-xl bg-navy-600 border border-white/20 p-4 sm:p-5 shadow-xl space-y-4">
                {/* Thanh tìm kiếm & lọc */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Ô tìm kiếm */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-200" />
                    <input
                      type="text"
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      placeholder="Tìm theo tên, số áo, vị trí..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-navy-800 border border-white/25 text-white placeholder-sky-200/60 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-on-dark focus:border-gold-400 transition"
                    />
                    {playerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setPlayerSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sky-200 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-navy-800 border border-white/20 text-xs font-bold uppercase tracking-wider shrink-0 overflow-x-auto">
                    {(
                      [
                        ["all", "Tất cả"],
                        ["GK", "Thủ môn"],
                        ["DF", "Hậu vệ"],
                        ["MF", "Tiền vệ"],
                        ["FW", "Tiền đạo"],
                        ["ĐN", "Đa năng"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSquadFilter(key)}
                        className={`px-2.5 py-1.5 rounded transition cursor-pointer text-[11px] shrink-0 ${squadFilter === key
                          ? "bg-gold-400 text-slate-950 font-black shadow-sm"
                          : "text-sky-200 hover:text-white"
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 px-1 pt-1 border-t border-white/15">
                  <span>
                    Hiển thị: <strong className="text-gold-300">{displayedSquad.length}</strong> cầu thủ
                  </span>
                  <span className="text-[11px] text-sky-200/80">
                    Chọn cầu thủ để xem hồ sơ bên trái
                  </span>
                </div>
              </div>

              {/* Danh sách cuộn thu nhỏ */}
              <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1 gn-hide-scroll">
                {displayedSquad.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-navy-600 border border-white/20 text-slate-300 text-sm">
                    Không tìm thấy cầu thủ nào phù hợp với &ldquo;{playerSearchQuery}&rdquo;
                  </div>
                ) : (
                  displayedSquad.map((p) => (
                    <CompactPlayerRow
                      key={p.id}
                      player={p}
                      isSelected={selectedPlayer?.id === p.id}
                      onSelect={() => setSelectedPlayerId(p.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
