"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  MapPin,
} from "lucide-react";
import type { FullAppData, MatchRecord, Sponsor } from "@/types/app";
import { SPONSOR_TIERS } from "@/lib/sponsors";
import { formatDateVN } from "@/lib/format";
import { Reveal, SoccerBallIcon, WRAP, type GuestNavLink } from "./shared";

export interface MatchdaySectionProps {
  data: FullAppData;
  fanpageUrl: string;
  navLinks: GuestNavLink[];
  totalPlayerCount: number;
  homeBanners: Sponsor[];
  activeBannerIdx: number;
  setActiveBannerIdx: React.Dispatch<React.SetStateAction<number>>;
  nextMatch: MatchRecord | undefined;
  upcomingMatches: MatchRecord[];
  pastMatches: MatchRecord[];
  matchTab: "fixtures" | "results";
  setMatchTab: React.Dispatch<React.SetStateAction<"fixtures" | "results">>;
  matchRows: MatchRecord[];
  go: (id: string) => void;
  setPosterModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenLogin: () => void;
}

export function MatchdaySection({
  data,
  fanpageUrl,
  navLinks,
  totalPlayerCount,
  homeBanners,
  activeBannerIdx,
  setActiveBannerIdx,
  nextMatch,
  upcomingMatches,
  pastMatches,
  matchTab,
  setMatchTab,
  matchRows,
  go,
  setPosterModalOpen,
  onOpenLogin,
}: MatchdaySectionProps) {
  return (
    <>
      <nav
        aria-label="Thanh nhảy nhanh chuyên mục"
        className="sticky top-[60px] sm:top-[68px] z-30 bg-navy-900/95 backdrop-blur-md border-y border-gold-400/30 shadow-lg py-2.5"
      >
        <div className={`${WRAP} flex items-center justify-between gap-3 overflow-x-auto gn-hide-scroll`}>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {navLinks.slice(1).map((l) => {
              const Icon = l.icon;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => go(l.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-700 hover:bg-navy-500 border border-white/10 hover:border-gold-400/60 text-xs font-bold text-sky-100 hover:text-white transition whitespace-nowrap cursor-pointer shrink-0 group"
                >
                  <Icon className="h-3.5 w-3.5 text-gold-400 group-hover:scale-110 transition" />
                  <span>{l.label}</span>
                  {l.badge && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-gold-400/15 text-gold-400 border border-gold-400/30">
                      {l.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0 pl-3 border-l border-white/10 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-sky-300 font-bold">
              FC HĐH Gò Nổi:
            </span>
            <span className="font-extrabold text-gold-300">
              {totalPlayerCount}+ Cầu Thủ
            </span>
          </div>
        </div>
      </nav>

      {/* ===================== BANNER ĐƠN VỊ TÀI TRỢ & ĐỐI TÁC TRANG CHỦ ===================== */}
      {homeBanners.length > 0 && (
        <section className="relative bg-navy-900 py-6 sm:py-8 border-b border-white/10">
          <div className={WRAP}>
            <div className="relative rounded-xl overflow-hidden border border-gold-500/40 shadow-2xl bg-gradient-to-r from-navy-900 to-navy-700">
              {/* Slide hình ảnh Banner */}
              <div className="relative aspect-[21/9] sm:aspect-[24/9] min-h-[180px] w-full overflow-hidden">
                {homeBanners.map((sp, idx) => {
                  const isActive = idx === activeBannerIdx;
                  const tierMeta = SPONSOR_TIERS[sp.tier] || SPONSOR_TIERS.partner;

                  return (
                    <div
                      key={sp.id}
                      className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${isActive
                          ? "opacity-100 z-10 pointer-events-auto"
                          : "opacity-0 pointer-events-none z-0"
                        }`}
                    >
                      <Image
                        src={sp.banner_url!}
                        alt={`Banner ${sp.name}`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 1152px"
                        unoptimized={!sp.banner_url!.startsWith("/")}
                        className="object-cover object-center"
                      />
                      {/* Lớp phủ chuyển sắc bảo đảm chữ luôn nổi bật */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex flex-col justify-end p-5 sm:p-8">
                        <div className="max-w-2xl space-y-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border ${tierMeta.badgeClass}`}
                            >
                              {tierMeta.label}
                            </span>
                            {sp.logo_url && (
                              <div className="relative h-6 w-6 rounded bg-white p-0.5 shadow-xs overflow-hidden">
                                <Image
                                  src={sp.logo_url}
                                  alt=""
                                  fill
                                  sizes="24px"
                                  unoptimized={!sp.logo_url.startsWith("/")}
                                  className="object-contain"
                                />
                              </div>
                            )}
                          </div>
                          <h2 className="font-display font-extrabold uppercase text-xl sm:text-3xl text-white drop-shadow">
                            {sp.name}
                          </h2>
                          {sp.description && (
                            <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 max-w-xl font-light">
                              {sp.description}
                            </p>
                          )}
                          {sp.website_url && (
                            <div className="pt-1">
                              <a
                                href={sp.website_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 hover:bg-gold-300 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 transition"
                              >
                                <span>Ghé thăm đơn vị</span>
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Điều khiển lùi/tiến nếu có từ 2 banner */}
              {homeBanners.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveBannerIdx(
                        (prev) =>
                          (prev - 1 + homeBanners.length) % homeBanners.length
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-950/70 hover:bg-slate-950 p-2 text-white border border-white/20 transition cursor-pointer"
                    aria-label="Banner trước"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveBannerIdx(
                        (prev) => (prev + 1) % homeBanners.length
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-950/70 hover:bg-slate-950 p-2 text-white border border-white/20 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-on-dark"
                    aria-label="Banner tiếp theo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-1 right-3 z-20 flex items-center gap-0.5">
                    {homeBanners.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveBannerIdx(i)}
                        className="min-h-11 min-w-11 flex items-center justify-center rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-on-dark"
                        aria-label={`Tới banner ${i + 1}`}
                        aria-current={i === activeBannerIdx ? "true" : undefined}
                      >
                        <span
                          aria-hidden="true"
                          className={`block h-2 rounded-full transition-all ${
                            i === activeBannerIdx
                              ? "w-6 bg-gold-500"
                              : "w-2 bg-white/40 hover:bg-white/70"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ===================== TRẬN CẦU TÂM ĐIỂM (BROADCAST MATCHDAY SCOREBOARD) ===================== */}
      {nextMatch && (
        <section
          id="match-center"
          className="relative bg-gradient-to-b from-navy-600 via-navy-500 to-navy-700 py-16 sm:py-24 overflow-hidden border-y border-white/15"
        >
          <span
            aria-hidden="true"
            className="absolute -left-4 top-1/2 -translate-y-1/2 font-display font-black text-[24vw] leading-none text-white/[0.03] select-none whitespace-nowrap pointer-events-none"
          >
            MATCHDAY
          </span>
          <div className={`${WRAP} relative`}>
            <Reveal>
              {/* Technical Section Index */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-white/15">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-gold-400 bg-gold-400/15 px-2.5 py-1 rounded border border-gold-400/40">
                    01 // MATCHDAY FIXTURE
                  </span>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-slate-200">
                    {nextMatch.label}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {(data.attendances || []).filter(
                      (a) => a.match_id === nextMatch.id && a.rsvp_status === "registered"
                    ).length}{" "}
                    Cầu thủ đã báo danh ra sân
                  </span>
                </div>
              </div>

              {/* TV Broadcast Scoreboard Box */}
              <div className="mt-8 rounded-xl bg-gradient-to-br from-navy-500 via-navy-600 to-navy-800 border border-gold-400/50 p-6 sm:p-10 shadow-[0_20px_50px_rgba(14,49,100,0.5)] relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-8 lg:gap-12">
                  {/* Đội chủ nhà FC Gò Nổi */}
                  <div className="flex flex-col lg:items-end items-center text-center lg:text-right space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-gold-400 bg-gold-400/15 px-2 py-0.5 rounded border border-gold-400/40">
                        CHỦ NHÀ
                      </span>
                    </div>
                    <h2 className="font-display font-black uppercase text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-none drop-shadow">
                      FC HĐH Gò Nổi
                    </h2>
                    <p className="text-xs text-sky-200 uppercase tracking-widest">
                      Xã Gò Nổi • TP. Đà Nẵng
                    </p>
                  </div>

                  {/* Tỷ số hoặc VS Broadcast Center */}
                  <div className="flex flex-col items-center justify-center px-6 py-4 rounded-lg bg-navy-800 border border-white/20 shrink-0 shadow-md">
                    {nextMatch.team_score !== null &&
                      nextMatch.opponent_score !== null ? (
                      <div className="font-display font-black text-5xl sm:text-7xl text-gold-300 leading-none tracking-tight">
                        {nextMatch.team_score}
                        <span className="mx-2 text-white/40">:</span>
                        {nextMatch.opponent_score}
                      </div>
                    ) : (
                      <div className="font-display font-black text-4xl sm:text-5xl text-gold-400 leading-none tracking-widest">
                        VS
                      </div>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-200 mt-2">
                      SÂN 7 NGƯỜI
                    </span>
                  </div>

                  {/* Đội đối thủ */}
                  <div className="flex flex-col lg:items-start items-center text-center lg:text-left space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300 bg-white/10 px-2 py-0.5 rounded border border-white/20">
                        ĐỐI THỦ
                      </span>
                    </div>
                    <h2 className="font-display font-black uppercase text-4xl sm:text-6xl lg:text-7xl text-sky-100 tracking-tight leading-none">
                      {nextMatch.opponent}
                    </h2>
                    <p className="text-xs text-sky-200/80 uppercase tracking-widest">
                      Giao Hữu Phong Trào
                    </p>
                  </div>
                </div>

                {/* Match Bottom Bar */}
                <div className="mt-10 pt-6 border-t border-white/15 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-8 gap-y-2 text-sm text-white">
                    <span className="inline-flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gold-400" />
                      <span className="font-bold">{nextMatch.kickoff_time}</span>
                      <span className="text-white/40">•</span>
                      <span>{formatDateVN(nextMatch.match_date)}</span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-sky-100">
                      <MapPin className="h-4 w-4 text-gold-400" />
                      <span>{nextMatch.venue}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPosterModalOpen(true)}
                      className="inline-flex items-center gap-2 bg-navy-600 hover:bg-navy-500 text-gold-400 border border-gold-400/60 font-extrabold px-5 py-3.5 text-xs uppercase tracking-wider rounded-lg cursor-pointer transition shadow-md"
                      title="Tải trực tiếp ảnh đội hình ra sân về máy để gửi vào Zalo"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Tải Ảnh Đội Hình (PNG)</span>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenLogin}
                      className="inline-flex items-center gap-2.5 bg-gradient-to-r from-gold-400 to-gold-300 hover:from-gold-300 hover:to-gold-400 text-slate-950 font-black px-6 py-3.5 text-xs uppercase tracking-widest rounded-lg cursor-pointer transition shadow-lg hover:shadow-xl"
                    >
                      <SoccerBallIcon className="h-4 w-4" />
                      <span>Đăng nhập để điểm danh</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <section
        id="join-us"
        className="relative bg-gradient-to-b from-navy-900 via-navy-800 to-navy-900 py-20 sm:py-28 text-white overflow-hidden border-y border-white/10"
      >
        <span
          aria-hidden="true"
          className="absolute -right-6 top-1/2 -translate-y-1/2 font-display font-black text-[24vw] leading-none text-white/[0.02] select-none whitespace-nowrap pointer-events-none"
        >
          GO NOI FC
        </span>

        <div className={WRAP}>
          <Reveal>
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-gold-500 bg-gold-500/15 px-2.5 py-1 rounded border border-gold-500/30">
                  04 // KẾT NỐI ĐỒNG HƯƠNG
                </span>
                <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                  ĐIỆN QUANG • ĐIỆN TRUNG • ĐIỆN PHONG
                </span>
              </div>
              <h2 className="font-display font-black uppercase leading-tight text-4xl sm:text-6xl lg:text-7xl text-white">
                Mở rộng cửa đón
                <br />
                <span className="text-gold-500">anh em Gò Nổi</span>
              </h2>
              <p className="mt-4 text-base sm:text-lg text-sky-100 font-light leading-relaxed">
                Mục tiêu xuyên suốt của FC HĐH Gò Nổi là <strong className="text-gold-300 font-semibold">quy tụ và chào đón tất cả anh em con em quê hương Gò Nổi</strong> đang sinh sống, học tập và làm việc tại TP.HCM cùng tề tựu trên sân cỏ.
              </p>
            </div>

            {/* 4 Trụ cột cam kết chào đón anh em (Athletic Technical Index) */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="rounded-xl bg-gradient-to-br from-navy-500 to-navy-600 p-6 border border-white/20 hover:border-gold-400/60 shadow-lg transition group">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-black text-2xl text-gold-400">
                    01
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-200 bg-white/10 px-2 py-0.5 rounded">
                    QUY MÔ
                  </span>
                </div>
                <h3 className="font-display font-bold uppercase text-lg text-white mb-2 group-hover:text-gold-400 transition">
                  {totalPlayerCount}+ Cầu thủ nòng cốt
                </h3>
                <p className="text-xs sm:text-sm text-sky-100 leading-relaxed font-light">
                  Đội bóng đã quy tụ hơn {totalPlayerCount} anh em từ các thế hệ và luôn mở rộng đón nhận thêm thành viên mới mỗi tuần mà không giới hạn số lượng.
                </p>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-navy-500 to-navy-600 p-6 border border-white/20 hover:border-emerald-400/60 shadow-lg transition group">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-black text-2xl text-emerald-400">
                    02
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-200 bg-white/10 px-2 py-0.5 rounded">
                    CƠ HỘI
                  </span>
                </div>
                <h3 className="font-display font-bold uppercase text-lg text-white mb-2 group-hover:text-emerald-300 transition">
                  Ai cũng được ra sân
                </h3>
                <p className="text-xs sm:text-sm text-sky-100 leading-relaxed font-light">
                  Chỉ cần bạn yêu bóng đá và mang trong mình nhiệt huyết quê hương. Đội luôn tạo điều kiện xoay tua để mọi anh em đều được đá và toả sáng.
                </p>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-navy-500 to-navy-600 p-6 border border-white/20 hover:border-sky-300/60 shadow-lg transition group">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-black text-2xl text-sky-300">
                    03
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-200 bg-white/10 px-2 py-0.5 rounded">
                    NGHĨA TÌNH
                  </span>
                </div>
                <h3 className="font-display font-bold uppercase text-lg text-white mb-2 group-hover:text-sky-200 transition">
                  Gắn kết đồng hương
                </h3>
                <p className="text-xs sm:text-sm text-sky-100 leading-relaxed font-light">
                  Sau 90 phút trên sân cỏ là những câu chuyện quê nhà, hỗ trợ nhau trong công việc, nghề nghiệp và cuộc sống tại đất Sài Gòn.
                </p>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-navy-500 to-navy-600 p-6 border border-white/20 hover:border-gold-300/60 shadow-lg transition group">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display font-black text-2xl text-gold-300">
                    04
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-sky-200 bg-white/10 px-2 py-0.5 rounded">
                    QUẢN TRỊ
                  </span>
                </div>
                <h3 className="font-display font-bold uppercase text-lg text-white mb-2 group-hover:text-gold-300 transition">
                  Minh bạch &amp; Bài bản
                </h3>
                <p className="text-xs sm:text-sm text-sky-100 leading-relaxed font-light">
                  Hệ thống website quản lý hiện đại: quỹ thu chi công khai từng đồng, điểm danh trực tuyến và thông báo lịch đấu rõ ràng hàng tuần.
                </p>
                <div className="mt-3">
                  <Link
                    href="/bao-cao-tai-chinh"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-300 hover:text-white transition"
                  >
                    Xem báo cáo tài chính <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Khung hành động & Ban Quản Lý */}
            <div className="mt-10 rounded-xl bg-gradient-to-r from-navy-500 via-navy-500 to-navy-600 p-6 sm:p-8 border border-gold-400/50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 shadow-2xl">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gold-500 block mb-1">
                  BẠN LÀ NGƯỜI CON GÒ NỔI TẠI TP.HCM?
                </span>
                <h3 className="font-display font-black uppercase text-2xl sm:text-3xl text-white">
                  Hãy xách giày và ra sân cùng anh em ngay tuần này!
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-sky-200 max-w-xl font-light">
                  Liên hệ ngay với Ban Điều Hành đội bóng hoặc gửi tin nhắn qua Fanpage để được xếp đội và tham gia buổi tập / giao hữu gần nhất.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-sky-200">
                  <span className="font-semibold text-white">Ban Điều Hành:</span>
                  <span className="rounded bg-white/5 px-2.5 py-0.5 border border-white/10">
                    Nguyễn Thế Tiếng (Đội trưởng)
                  </span>
                  <span className="rounded bg-white/5 px-2.5 py-0.5 border border-white/10">
                    Hồ Viết Tín (Đội phó)
                  </span>
                  <span className="rounded bg-white/5 px-2.5 py-0.5 border border-white/10">
                    Dương Hiển Hoài Sơn (BQL)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <a
                  href={fanpageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-450 hover:from-gold-450 hover:to-gold-300 text-slate-950 font-black px-6 py-3.5 text-xs uppercase tracking-wider transition shadow-lg cursor-pointer"
                >
                  <span>Nhắn Fanpage Tham Gia</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 hover:bg-white hover:text-slate-950 text-white font-bold px-6 py-3.5 text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Đăng Nhập Thành Viên</span>
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== LỊCH ĐẤU & KẾT QUẢ ===================== */}
      <section
        id="fixtures-section"
        className="relative bg-gradient-to-b from-navy-900 via-navy-800 to-navy-900 text-white py-20 sm:py-28 border-b border-white/15"
      >
        <div className={WRAP}>
          <Reveal>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 pb-6 border-b border-white/15">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-gold-400 bg-gold-400/15 px-2.5 py-1 rounded border border-gold-400/40">
                    05 // KẾT QUẢ &amp; LỊCH THI ĐẤU
                  </span>
                  <span className="text-xs uppercase font-extrabold tracking-widest text-sky-200">
                    BÓNG LĂN MỖI TUẦN
                  </span>
                </div>
                <h2 className="mt-3 font-display font-black uppercase leading-tight text-4xl sm:text-6xl text-white">
                  Lịch đấu <span className="text-gold-400">&amp; kết quả</span>
                </h2>
              </div>
              <div className="flex gap-3 text-xs font-black uppercase tracking-wider">
                {(
                  [
                    ["fixtures", `Sắp tới (${upcomingMatches.length})`],
                    ["results", `Đã đấu (${pastMatches.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMatchTab(key)}
                    aria-pressed={matchTab === key}
                    className={`px-4 py-2.5 rounded-lg border transition cursor-pointer ${matchTab === key
                      ? "bg-gold-400 text-slate-950 font-black border-gold-400 shadow-md"
                      : "bg-navy-700 text-sky-200 border-white/15 hover:border-white/30 hover:text-white"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="mt-8 space-y-3">
            {matchRows.length === 0 && (
              <div className="py-14 text-center rounded-xl bg-navy-700 border border-white/15 text-sky-200 italic text-sm">
                Chưa có lịch mới. Ban điều hành đang chốt kèo giao hữu tiếp theo!
              </div>
            )}
            {matchRows.map((m) => (
              <div
                key={m.id}
                className="group grid grid-cols-1 md:grid-cols-[220px_1fr_auto] items-center gap-3 md:gap-8 py-5 px-4 sm:px-6 rounded-xl bg-navy-700/60 hover:bg-navy-600 border border-white/10 hover:border-gold-400/60 transition-all shadow-md"
              >
                <div className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                  <div className="text-gold-400 font-black">{m.label}</div>
                  <div className="text-sky-200/80 mt-0.5">
                    {formatDateVN(m.match_date)}
                    {m.kickoff_time ? ` • ${m.kickoff_time}` : ""}
                  </div>
                </div>
                <div className="font-display font-black uppercase text-2xl sm:text-3xl leading-none flex flex-wrap items-center gap-x-3">
                  <span className="text-white">FC HĐH Gò Nổi</span>
                  {matchTab === "results" ? (
                    <span className="text-slate-950 px-2.5 py-1 rounded bg-gold-400 font-black shadow-sm text-xl sm:text-2xl">
                      {m.team_score ?? 0} - {m.opponent_score ?? 0}
                    </span>
                  ) : (
                    <span className="text-gold-400 text-lg font-black">VS</span>
                  )}
                  <span className="text-sky-100">{m.opponent}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-sky-200">
                    <MapPin className="h-3.5 w-3.5 text-gold-400" />
                    {m.venue}
                  </span>
                  {matchTab === "fixtures" && (
                    <button
                      type="button"
                      onClick={onOpenLogin}
                      className="font-black uppercase tracking-wider text-slate-950 bg-gradient-to-r from-gold-400 to-gold-300 hover:from-gold-300 hover:to-gold-400 px-3.5 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow-sm transition"
                    >
                      <span>Điểm danh</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
