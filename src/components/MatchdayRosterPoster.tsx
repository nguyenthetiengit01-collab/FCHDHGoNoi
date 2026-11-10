"use client";

import React, { useRef, useState } from "react";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  Loader2,
  MapPin,
  Users,
  X,
} from "lucide-react";
import type { MatchRecord, MatchAttendance, Player } from "@/types/app";
import { getPlayerPositionBadge } from "@/lib/athleteProfile";
import {
  downloadElementAsPng,
  buildMatchdayRosterFilename,
} from "@/lib/exportImage";

export interface MatchdayRosterPosterProps {
  isOpen: boolean;
  onClose: () => void;
  match: MatchRecord;
  attendances: MatchAttendance[];
  players: Player[];
  zaloCopyText?: string;
}

export function MatchdayRosterPosterModal({
  isOpen,
  onClose,
  match,
  attendances,
  players,
  zaloCopyText,
}: MatchdayRosterPosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [copiedZalo, setCopiedZalo] = useState(false);

  if (!isOpen) return null;

  // Lọc danh sách điểm danh cho trận này
  const matchAtts = attendances.filter((a) => a.match_id === match.id);

  // 1. Cầu thủ Đã Đăng Ký Ra Sân (Có mặt)
  const registeredPlayerList = players
    .filter((p) => {
      const att = matchAtts.find((a) => a.player_id === p.id);
      return att?.rsvp_status === "registered" || att?.attended === 1;
    })
    .sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));

  // 2. Cầu thủ Báo Vắng
  const absentPlayerList = players.filter((p) => {
    const att = matchAtts.find((a) => a.player_id === p.id);
    return att?.rsvp_status === "absent_notice";
  });

  const handleExportPoster = async () => {
    if (!posterRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const filename = buildMatchdayRosterFilename(match.label, match.match_date);
      // Tải trực tiếp file ảnh PNG sắc nét về máy (Downloads)
      await downloadElementAsPng(posterRef.current, filename, {
        pixelRatio: 2.5,
        quality: 0.98,
      });
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Export poster error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyZalo = () => {
    if (zaloCopyText) {
      navigator.clipboard.writeText(zaloCopyText);
      setCopiedZalo(true);
      setTimeout(() => setCopiedZalo(false), 2500);
    }
  };

  // Định dạng ngày Việt Nam
  const formatDateVN = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl my-auto rounded-2xl bg-[#030c17] border border-[#d4af37]/40 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden text-white">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10 bg-[#061830]">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#d4af37]" />
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                Bảng Điểm Danh (Chuẩn Fanpage &amp; Zalo)
              </h3>
              <p className="text-[11px] text-sky-200/80">
                Bố cục gọn gàng, hiển thị vừa vặn trọn vẹn 1 khung hình trên điện thoại
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {zaloCopyText && (
              <button
                type="button"
                onClick={handleCopyZalo}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 border border-white/15 transition cursor-pointer"
                title="Sao chép nội dung tin nhắn dạng chữ"
              >
                {copiedZalo ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Đã chép text!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-[#d4af37]" />
                    <span>Sao chép text</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleExportPoster}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#e6c466] hover:from-[#e6c466] hover:to-[#f5d97f] text-slate-950 text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-md disabled:opacity-60"
              title="Tải trực tiếp ảnh bảng điểm danh PNG sắc nét về máy"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  <span>Đang tải ảnh...</span>
                </>
              ) : exportSuccess ? (
                <>
                  <Check className="h-4 w-4 text-emerald-950" />
                  <span>Đã tải về máy!</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 text-slate-950" />
                  <span>Tải Ảnh Về Máy (PNG)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Đóng modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex justify-center bg-[#020813]">
          {/* POSTER CHÍNH ĐƯỢC CHỤP ẢNH (BỐ CỤC CHUẨN GỌN GÀNG FANPAGE & ZALO) */}
          <div
            ref={posterRef}
            className="w-full max-w-[620px] bg-gradient-to-b from-[#0b2447] via-[#081a33] to-[#040e1a] rounded-xl border-2 border-[#d4af37] p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-white space-y-3.5"
          >
            {/* Header Poster: Logo + Tên Đội + Huy hiệu Matchday */}
            <div className="flex items-center justify-between pb-3 border-b border-[#d4af37]/40 gap-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/logo.jpg"
                  alt="FC HĐH Gò Nổi"
                  className="h-11 w-11 rounded-full object-contain bg-white p-0.5 border border-[#d4af37] shadow shrink-0"
                />
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#d4af37] block">
                    ĐIỆN BÀN • QUẢNG NAM
                  </span>
                  <h1 className="font-display font-black uppercase text-base sm:text-lg text-white tracking-wide leading-tight">
                    FC HỘI ĐỒNG HƯƠNG GÒ NỔI
                  </h1>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block px-2.5 py-0.5 rounded bg-[#d4af37] text-slate-950 font-black text-[11px] uppercase tracking-wider shadow">
                  MATCHDAY ROSTER
                </span>
                <span className="block text-[9px] uppercase font-bold text-slate-400 mt-0.5">
                  ĐIỂM DANH THI ĐẤU
                </span>
              </div>
            </div>

            {/* Khung Thông Tin Trận Đấu Rút Gọn */}
            <div className="rounded-xl bg-[#041224] border border-[#d4af37]/40 p-3 text-center space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                {/* Đội nhà */}
                <div className="flex-1 text-right min-w-0">
                  <span className="text-[9px] uppercase font-bold text-[#d4af37] tracking-wider block">
                    CHỦ NHÀ
                  </span>
                  <h2 className="font-display font-black uppercase text-sm sm:text-base text-white truncate">
                    FC HĐH GÒ NỔI
                  </h2>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center justify-center px-3 py-1 rounded-md bg-[#061b36] border border-white/10 shrink-0 mx-2">
                  <span className="font-display font-black text-base sm:text-lg text-[#fde047] leading-none">
                    VS
                  </span>
                </div>

                {/* Đối thủ */}
                <div className="flex-1 text-left min-w-0">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">
                    ĐỐI THỦ
                  </span>
                  <h2 className="font-display font-black uppercase text-sm sm:text-base text-sky-100 truncate">
                    {match.opponent || "ĐỐI THỦ GIAO HỮU"}
                  </h2>
                </div>
              </div>

              {/* Chi tiết thời gian & sân thi đấu */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-white">
                  <Clock className="h-3 w-3 text-[#d4af37]" />
                  <span>{match.kickoff_time || "19:00"}</span>
                </span>
                <span className="text-white/30">•</span>
                <span className="inline-flex items-center gap-1 font-bold text-white">
                  <Calendar className="h-3 w-3 text-[#d4af37]" />
                  <span>{formatDateVN(match.match_date)}</span>
                </span>
                <span className="text-white/30">•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-sky-200">
                  <MapPin className="h-3 w-3 text-[#d4af37]" />
                  <span>{match.venue}</span>
                </span>
                <span className="text-white/30 hidden sm:inline">•</span>
                <span className="text-[9px] font-black uppercase tracking-wider text-[#d4af37] bg-[#d4af37]/15 px-1.5 py-0.5 rounded border border-[#d4af37]/30">
                  SÂN 7 NGƯỜI
                </span>
              </div>
            </div>

            {/* MỤC 1: CHIẾN BINH ĐÃ ĐĂNG KÝ RA SÂN (LƯỚI 3 CỘT GỌN GÀNG) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="font-display font-black uppercase text-xs sm:text-sm text-white tracking-wider">
                    CHIẾN BINH RA SÂN ({registeredPlayerList.length} CẦU THỦ)
                  </h3>
                </div>
                <span className="text-[10px] font-black uppercase text-[#d4af37] bg-[#d4af37]/20 border border-[#d4af37]/50 px-2 py-0.5 rounded">
                  ĐÃ XÁC NHẬN
                </span>
              </div>

              {registeredPlayerList.length === 0 ? (
                <div className="p-3 rounded-lg bg-white/5 text-center text-xs text-slate-400 italic">
                  Chưa có cầu thủ điểm danh có mặt cho trận này.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                  {registeredPlayerList.map((player, idx) => {
                    const posBadge = getPlayerPositionBadge(player);

                    return (
                      <div
                        key={player.id}
                        className="flex items-center gap-2 p-1.5 px-2 rounded-lg bg-[#051426] border border-white/15 min-w-0"
                      >
                        {/* Số áo */}
                        <span className="h-6 w-6 rounded bg-[#040e1a] border border-[#d4af37]/50 flex items-center justify-center shrink-0 font-display font-black text-xs text-[#d4af37]">
                          #{player.jersey_number ?? idx + 1}
                        </span>

                        {/* Tên ngắn */}
                        <span className="font-bold text-xs text-white uppercase truncate flex-1 min-w-0">
                          {player.short_name || player.full_name}
                        </span>

                        {/* Vị trí */}
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${posBadge.badgeClass}`}
                        >
                          {posBadge.code}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MỤC 2: CẦU THỦ BÁO VẮNG (DẠNG HÀNG GỌN GÀNG) */}
            {absentPlayerList.length > 0 && (
              <div className="rounded-lg bg-rose-950/40 border border-rose-500/20 px-3 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 shrink-0">
                  BÁO BẬN ({absentPlayerList.length}):
                </span>
                <span className="text-[11px] text-rose-200">
                  {absentPlayerList.map((p) => p.short_name || p.full_name).join(", ")}
                </span>
              </div>
            )}

            {/* MỤC 3: LƯU Ý THI ĐẤU & CHÂN TRANG THƯƠNG HIỆU */}
            <div className="pt-2 border-t border-[#d4af37]/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-300">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#d4af37]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/logo.jpg"
                  alt="Logo Gò Nổi"
                  className="h-3.5 w-3.5 rounded-full object-contain bg-white"
                />
                <span>FC HỘI ĐỒNG HƯƠNG GÒ NỔI • MÙA GIẢI 2026</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-400">⏰ Có mặt trước 15p</span>
                <span className="font-mono text-[#fde047] font-semibold">fchdhgonoi.vercel.app</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#061830] flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-400">
            💡 Mẹo: Ảnh được tối ưu tỷ lệ vàng để đăng Facebook Fanpage và gửi vào nhóm Zalo không bị crop hay nén mờ.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
}
