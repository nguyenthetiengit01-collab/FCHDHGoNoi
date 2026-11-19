"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, HeartHandshake } from "lucide-react";
import { HERO_PHOTOS, SoccerBallIcon, WRAP } from "./shared";

export interface HeroBannerProps {
  heroIdx: number;
  totalPlayerCount: number;
  matchStats: { total: number; completed: number };
  wins: number;
  ticker: string[];
  go: (id: string) => void;
  onOpenLogin: () => void;
}

export function HeroBanner({
  heroIdx,
  totalPlayerCount,
  matchStats,
  wins,
  ticker,
  go,
  onOpenLogin,
}: HeroBannerProps) {
  return (
      <section
        id="banner-hero"
        className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden"
      >
        {/* Nền ảnh WebP từ folder hinhanh tự động xử lý */}
        {HERO_PHOTOS.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={i === 0 ? "Tập thể FC HĐH Gò Nổi tại TP.HCM" : ""}
            aria-hidden={heroIdx !== i}
            fetchPriority={i === 0 ? "high" : "low"}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ${heroIdx === i ? "opacity-100 scale-100" : "opacity-0 scale-105"
              }`}
          />
        ))}

        {/* Lớp phủ chuyển sắc xanh lam sapphire sang trọng & chiều sâu sân vận động ScrollCraft */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-radial-[circle_at_50%_25%] from-navy-600/30 via-transparent to-transparent mix-blend-screen pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-radial-[circle_at_20%_20%] from-gold-500/15 via-transparent to-transparent mix-blend-screen pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-navy-800 via-navy-700/75 to-navy-900/45"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-navy-700/85 via-navy-700/40 to-transparent"
        />

        {/* Chữ in chìm không gian sâu (Depth Watermark) */}
        <div
          aria-hidden="true"
          className="absolute top-[32%] left-1/2 -translate-x-1/2 -translate-y-1/2 font-display font-black text-[22vw] leading-none text-white/[0.03] select-none whitespace-nowrap pointer-events-none tracking-widest uppercase"
        >
          GO NOI FC
        </div>

        <div className={`${WRAP} relative z-10 pt-40 pb-14 sm:pb-20`}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="font-bold uppercase tracking-[0.35em] text-xs sm:text-sm text-gold-500 flex items-center gap-2">
              <SoccerBallIcon className="h-4 w-4 text-gold-500 gn-spin-slow" />
              <span>Bóng đá phủi • Đồng hương Gò Nổi • TP.HCM</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/20 border border-gold-500/50 px-3 py-0.5 text-[11px] font-extrabold text-gold-300 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{totalPlayerCount}+ Cầu thủ • Mở rộng đón anh em Gò Nổi</span>
            </span>
          </div>

          <h1 className="font-display font-bold uppercase leading-[0.82] tracking-tight">
            <span className="block text-[22vw] sm:text-[17vw] lg:text-[13rem] drop-shadow-lg">
              Đá phủi
            </span>
            <span className="block text-[22vw] sm:text-[17vw] lg:text-[13rem] text-transparent [-webkit-text-stroke:2px_#d4af37] drop-shadow-md">
              Hết mình
            </span>
          </h1>

          <div className="mt-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <p className="max-w-xl text-lg sm:text-xl text-sky-100 leading-relaxed font-light">
              Ngôi nhà chung của <strong className="text-gold-300 font-bold">{totalPlayerCount}+ anh em chiến binh</strong> và không ngừng mở rộng, hướng đến việc quy tụ toàn bộ anh em con em Điện Quang, Điện Trung, Điện Phong tại TP.HCM. Bất kể bạn đá ở vị trí nào, chỉ cần mang trong mình tinh thần Gò Nổi — sân bóng luôn sẵn sàng đón bạn!
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-3 bg-gradient-to-r from-navy-500 to-royal-500 hover:from-royal-500 hover:to-royal-600 text-white font-bold px-8 py-4 sm:py-5 text-sm uppercase tracking-widest rounded-xl cursor-pointer shadow-xl border border-sky-300/30 transition hover:scale-[1.02]"
              >
                <span>Vào khu thành viên</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go("join-us")}
                className="inline-flex items-center gap-3 border-2 border-gold-500 hover:bg-gold-500 hover:text-slate-950 text-gold-500 font-bold px-8 py-[14px] sm:py-[18px] text-sm uppercase tracking-widest rounded-xl cursor-pointer transition shadow-md hover:scale-[1.02]"
              >
                <HeartHandshake className="h-5 w-5" />
                <span>Gia nhập đội bóng</span>
              </button>
              <Link
                href="/cau-chuyen-go-noi"
                className="inline-flex items-center gap-2 border border-white/25 bg-white/10 hover:bg-white/15 hover:border-gold-500/60 text-white font-bold px-6 py-[14px] sm:py-[18px] text-sm uppercase tracking-wider rounded-xl transition"
              >
                <BookOpen className="h-4 w-4 text-gold-300" />
                <span>Câu chuyện Gò Nổi</span>
              </Link>
            </div>
          </div>

          {/* Số liệu thật */}
          <dl className="mt-14 flex flex-wrap gap-x-14 gap-y-6 border-t border-white/20 pt-8">
            {[
              { n: `${totalPlayerCount}+`, l: "Cầu thủ tham gia" },
              { n: matchStats.total, l: "Trận đã lên lịch" },
              { n: wins, l: "Trận thắng" },
            ].map((s) => (
              <div key={s.l}>
                <dd className="font-display text-6xl sm:text-7xl font-bold text-gold-500 leading-none">
                  {s.n}
                </dd>
                <dt className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-sky-200">
                  {s.l}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        <button
          type="button"
          onClick={() => go("match-center")}
          aria-label="Cuộn xuống"
          className="absolute right-6 sm:right-12 bottom-36 hidden sm:flex flex-col items-center gap-2 text-sky-200/80 hover:text-gold-500 text-[11px] uppercase tracking-[0.3em] cursor-pointer [writing-mode:vertical-rl]"
        >
          <span>Cuộn</span>
          <ChevronDown className="h-4 w-4 gn-float text-gold-500" />
        </button>

        {/* Dải chữ chạy vàng kim loại */}
        <div className="relative z-10 bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 text-slate-950 overflow-hidden shadow-inner">
          <div className="gn-marquee flex w-max gap-12 py-3 font-display font-bold uppercase text-lg tracking-[0.2em]">
            {[...ticker, ...ticker, ...ticker, ...ticker].map((t, i) => (
              <span key={i} className="inline-flex items-center gap-12">
                <span>{t}</span>
                <SoccerBallIcon className="h-5 w-5 inline text-slate-950" />
              </span>
            ))}
          </div>
        </div>
      </section>
  );
}
